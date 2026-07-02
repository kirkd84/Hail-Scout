"""Storm-alert generation against LIVE DB storms.

Phase 23. Replaces the fixture-driven path that used to live inline
in `routes/monitored.py`. Pulls real storms from the `storms` +
`hail_swaths` tables via PostGIS `ST_Contains`, persists new alerts,
and fans out to every configured channel (Slack, email) — with
per-channel idempotency tracked on `storm_alerts.slack_sent_at` /
`email_sent_at` so re-running doesn't re-deliver.

Why a service module (vs. an inline helper):

* Both the on-demand `/v1/alerts` route and a background worker
  (Railway cron, planned next phase) need this exact logic.
* Channels are pluggable — adding Teams or Webhook would be one
  more `await _send_*` block here, not a touch on the route.
"""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Iterable

from sqlalchemy import and_, bindparam, delete, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from hailscout_api.db.models.canvass import (
    AlertZone,
    MobilePushToken,
    MonitoredAddress,
    PushSubscription,
    StormAlert,
)
from hailscout_api.db.models.org import Organization
from hailscout_api.services.email_alerts import (
    parse_recipient_list,
    render_alert_email,
    send_alert_email,
)
from hailscout_api.services.expo_push import send_expo_push
from hailscout_api.services.push_alerts import push_configured, send_web_push
from hailscout_api.services.slack import format_alert_message, send_slack_alert
from hailscout_api.services.sms_alerts import (
    parse_phone_list,
    render_alert_sms,
    send_sms,
)
from hailscout_api.services.storm_query import query_hail_at_point

log = logging.getLogger(__name__)


# Bound the per-address storm lookup so we never alert on a months-old
# event the user just signed up to watch. The /v1/alerts route still
# returns whatever's persisted in storm_alerts (no recency cutoff there),
# but the *generator* only emits new rows for fresh events.
_NEW_ALERT_LOOKBACK_DAYS = 14

# Zone alarms are LIVE pop-ups, not history: only storms from the last
# 24h fire, never storms older than the zone itself (creating a
# "Colorado ≥1.5\"" zone must not blast last week's outbreak).
_ZONE_LOOKBACK_HOURS = 24
# Outbreak-day guard — one nationwide 0.75" zone shouldn't mint hundreds
# of rows per worker pass. Dedupe means the tail arrives on later passes.
_ZONE_MAX_MATCHES_PER_RUN = 25

# Kind-specific SQL predicate on the storm centroid. Radius uses
# geography casts for true miles; states matches against the seeded
# us_states polygons.
_ZONE_PRED = {
    "radius": (
        "ST_DWithin(s.centroid_geom::geography, "
        "ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography, :meters)"
    ),
    "states": (
        "EXISTS (SELECT 1 FROM us_states st "
        "WHERE st.code IN :codes AND ST_Contains(st.geom, s.centroid_geom))"
    ),
    "nationwide": "TRUE",
}


async def _match_zone_storms(
    session: AsyncSession, org, zones: list[AlertZone]
) -> list[dict]:
    """Fresh storms matching each enabled zone's geometry + hail threshold.

    Wind matching lands with the wind-ingestion phase — zones already
    carry min_wind_mph so no schema change will be needed then.
    """
    matches: list[dict] = []
    now = datetime.now(timezone.utc)
    for zone in zones:
        if zone.min_hail_in is None:
            continue  # wind-only zone; nothing to match yet
        pred = _ZONE_PRED.get(zone.kind)
        if pred is None:
            continue
        cutoff = max(
            now - timedelta(hours=_ZONE_LOOKBACK_HOURS),
            zone.created_at if zone.created_at.tzinfo else
            zone.created_at.replace(tzinfo=timezone.utc),
        )
        sql = text(
            f"""
            SELECT s.id, s.max_hail_size_in, s.start_time
              FROM storms s
             WHERE s.start_time >= :cutoff
               AND s.suspect = false
               AND s.source <> 'SPC-LSR'
               AND s.max_hail_size_in >= :min_hail
               AND {pred}
             ORDER BY s.start_time DESC
             LIMIT :cap
            """
        )
        params: dict = {
            "cutoff": cutoff,
            "min_hail": zone.min_hail_in,
            "cap": _ZONE_MAX_MATCHES_PER_RUN,
        }
        if zone.kind == "radius":
            if zone.center_lat is None or zone.center_lng is None or not zone.radius_mi:
                continue
            params.update(
                lng=zone.center_lng,
                lat=zone.center_lat,
                meters=zone.radius_mi * 1609.34,
            )
        elif zone.kind == "states":
            codes = json.loads(zone.states) if zone.states else []
            if not codes:
                continue
            sql = sql.bindparams(bindparam("codes", expanding=True))
            params["codes"] = codes
        try:
            rows = (await session.execute(sql, params)).all()
        except Exception:  # pragma: no cover — bad geometry shouldn't kill the run
            log.exception("alert.zone_match_failed zone=%s", zone.id)
            continue
        for r in rows:
            matches.append({
                "alert_zone_id": zone.id,
                "zone_name": zone.name,
                "storm_id": r.id,
                "peak_size_in": float(r.max_hail_size_in),
                "storm_started_at": r.start_time,
            })
    return matches


async def generate_alerts_for_org(
    session: AsyncSession,
    org: Organization,
) -> dict:
    """Compute + persist new alerts for one org, then fan out.

    Returns a summary dict: {created, slack_sent, email_sent,
    skipped_already_delivered}. The caller can show these in the
    `/v1/alerts` response or surface them in worker logs.
    """
    addresses = (
        await session.execute(
            select(MonitoredAddress).where(MonitoredAddress.org_id == org.id),
        )
    ).scalars().all()
    address_by_id = {a.id: a for a in addresses}

    # Alarm zones (Phase 33) — matched alongside addresses so both alert
    # kinds ride the same fan-out pass.
    zones = (
        await session.execute(
            select(AlertZone).where(
                and_(AlertZone.org_id == org.id, AlertZone.enabled.is_(True))
            ),
        )
    ).scalars().all()

    if not addresses and not zones:
        return _empty_summary()

    cutoff_from = datetime.now(timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0,
    )
    # Walk back N days. Storms predating this aren't generated as fresh
    # alerts (they may already exist; re-runs are idempotent).
    from datetime import timedelta
    cutoff_from -= timedelta(days=_NEW_ALERT_LOOKBACK_DAYS)
    cutoff_to = datetime.now(timezone.utc)

    # Each address gets its own ST_Contains lookup. This is N round-trips
    # but each is cheap (sub-50ms in tests) and CONUS-wide canvassing
    # orgs typically have < 200 addresses. If that ever changes, batch
    # via a single SQL with `ST_Contains(geom, ANY(points))`.
    new_matches: list[dict] = []
    for addr in addresses:
        if addr.lat is None or addr.lng is None:
            continue
        threshold = (
            addr.alert_threshold_in
            if addr.alert_threshold_in is not None
            else (org.alert_min_size_in or 0.75)
        )
        hits = await query_hail_at_point(
            session, lat=addr.lat, lng=addr.lng,
            from_date=cutoff_from, to_date=cutoff_to, limit=50,
        )
        for storm in hits:
            if (storm.get("max_hail_size_in") or 0) < threshold:
                continue
            # Phase 23.5: never alert on a storm the screener flagged
            # as a likely false positive. Worse than no alert is an
            # alert that erodes trust — once a rep gets one bad
            # "2.5″ hit Denver" email, they'll mute the channel.
            if storm.get("suspect"):
                continue
            new_matches.append({
                "monitored_address_id": addr.id,
                "storm_id": storm["id"],
                # Live storms don't carry `city` like the fixtures did;
                # leave it nullable. A future enhancement reverse-geocodes
                # the centroid at storm-creation time.
                "storm_city": None,
                "peak_size_in": float(storm["max_hail_size_in"]),
                "storm_started_at": storm["start_time"],
            })

    # Zone matches (alarm zones) — separate matcher, same fan-out pass.
    zone_matches = await _match_zone_storms(session, org, list(zones))

    # Persist net-new (dedupe by (org, address, storm) uniq index).
    # We track three buckets:
    #   * truly_new        — rows added this pass; counts toward "created"
    #   * retry_candidates — pre-existing rows that never delivered on
    #     some channel; eligible for re-attempt fan-out below
    # Both buckets feed the channel loops; only `truly_new` increments
    # the user-facing "new alerts this fetch" counter.
    truly_new: list[StormAlert] = []
    retry_candidates: list[StormAlert] = []
    for m in new_matches:
        existing = (
            await session.execute(
                select(StormAlert).where(
                    and_(
                        StormAlert.org_id == org.id,
                        StormAlert.monitored_address_id ==
                        m["monitored_address_id"],
                        StormAlert.storm_id == m["storm_id"],
                    ),
                ),
            )
        ).scalars().first()
        if existing is not None:
            if existing.slack_sent_at is None or existing.email_sent_at is None:
                retry_candidates.append(existing)
            continue
        alert = StormAlert(
            org_id=org.id,
            monitored_address_id=m["monitored_address_id"],
            storm_id=m["storm_id"],
            storm_city=m["storm_city"],
            peak_size_in=m["peak_size_in"],
            storm_started_at=m["storm_started_at"],
        )
        session.add(alert)
        truly_new.append(alert)

    # Zone alerts dedupe on (org, zone, storm) — one pop per storm per zone.
    for m in zone_matches:
        existing = (
            await session.execute(
                select(StormAlert).where(
                    and_(
                        StormAlert.org_id == org.id,
                        StormAlert.alert_zone_id == m["alert_zone_id"],
                        StormAlert.storm_id == m["storm_id"],
                    ),
                ),
            )
        ).scalars().first()
        if existing is not None:
            continue
        alert = StormAlert(
            org_id=org.id,
            monitored_address_id=None,
            alert_zone_id=m["alert_zone_id"],
            zone_name=m["zone_name"],
            kind="zone_hail",
            storm_id=m["storm_id"],
            storm_city=None,
            peak_size_in=m["peak_size_in"],
            storm_started_at=m["storm_started_at"],
        )
        session.add(alert)
        truly_new.append(alert)

    if truly_new:
        await session.commit()

    summary = _empty_summary()
    summary["created"] = len(truly_new)
    delivery_targets: list[StormAlert] = truly_new + retry_candidates

    # ── Fan out to Slack ──
    # v1 zone-alarm scope is in-app (SSE) + push; Slack/email/SMS remain
    # address-alert channels so an outbreak day doesn't flood them.
    if org.slack_enabled and org.slack_webhook_url:
        for alert in delivery_targets:
            if alert.kind != "address":
                continue
            if alert.slack_sent_at is not None:
                summary["skipped_already_delivered"] += 1
                continue
            addr = address_by_id.get(alert.monitored_address_id)
            payload = format_alert_message(
                address=addr.address if addr else "",
                address_label=addr.label if addr else None,
                storm_city=alert.storm_city,
                peak_size_in=alert.peak_size_in,
                started_at=alert.storm_started_at.isoformat()
                if alert.storm_started_at else "",
            )
            try:
                ok = await send_slack_alert(org.slack_webhook_url, payload)
                if ok:
                    alert.slack_sent_at = datetime.now(timezone.utc)
                    summary["slack_sent"] += 1
            except Exception:  # pragma: no cover
                log.exception("alert.slack_send_failed")
        await session.commit()

    # ── Fan out to email ──
    recipients = parse_recipient_list(org.alert_email_recipients)
    if org.alert_emails_enabled and recipients:
        for alert in delivery_targets:
            if alert.kind != "address":
                continue
            if alert.email_sent_at is not None:
                continue
            addr = address_by_id.get(alert.monitored_address_id)
            subject, text_body, html_body = render_alert_email(
                address=(addr.address if addr else ""),
                address_label=(addr.label if addr else None),
                storm_city=alert.storm_city,
                peak_size_in=alert.peak_size_in,
                started_at=alert.storm_started_at,
                # LSR confirmation is read from the Storm at render time
                # in a future cut; for now we surface false to keep this
                # service decoupled from the lsr_linker pass.
                lsr_confirmed=False,
            )
            try:
                ok = await send_alert_email(
                    to_addresses=recipients,
                    subject=subject,
                    text_body=text_body,
                    html_body=html_body,
                )
                if ok:
                    alert.email_sent_at = datetime.now(timezone.utc)
                    summary["email_sent"] += 1
            except Exception:  # pragma: no cover
                log.exception("alert.email_send_failed")
        await session.commit()

    # ── Fan out to SMS ──
    sms_numbers = parse_phone_list(org.sms_recipients)
    if org.sms_enabled and sms_numbers:
        for alert in delivery_targets:
            if alert.kind != "address":
                continue
            if alert.sms_sent_at is not None:
                continue
            addr = address_by_id.get(alert.monitored_address_id)
            body = render_alert_sms(
                address=(addr.address if addr else None),
                address_label=(addr.label if addr else None),
                peak_size_in=alert.peak_size_in,
                storm_city=alert.storm_city,
            )
            try:
                n = await send_sms(sms_numbers, body)
                if n > 0:
                    alert.sms_sent_at = datetime.now(timezone.utc)
                    summary["sms_sent"] += 1
            except Exception:  # pragma: no cover
                log.exception("alert.sms_send_failed")
        await session.commit()

    # ── Fan out to web push ──
    if org.push_enabled and push_configured():
        subs = (
            await session.execute(
                select(PushSubscription).where(PushSubscription.org_id == org.id)
            )
        ).scalars().all()
        if subs:
            for alert in delivery_targets:
                if alert.push_sent_at is not None:
                    continue
                addr = address_by_id.get(alert.monitored_address_id)
                if alert.kind == "zone_hail":
                    where = alert.zone_name or "an alarm zone"
                    body_text = "Storm in one of your alarm zones. Tap to see the swath."
                else:
                    where = (
                        (addr.label or addr.address) if addr else None
                    ) or alert.storm_city or "a monitored address"
                    body_text = "New hail on a monitored address. Tap to verify and pull a report."
                payload = {
                    "title": f'{alert.peak_size_in:.2f}" hail — {where}',
                    "body": body_text,
                    "url": "/app/alerts",
                    "tag": f"storm-{alert.storm_id}",
                }
                delivered = False
                dead: list[str] = []
                for sub in subs:
                    res = await asyncio.to_thread(
                        send_web_push,
                        endpoint=sub.endpoint,
                        p256dh=sub.p256dh,
                        auth=sub.auth,
                        payload=payload,
                    )
                    if res == "ok":
                        delivered = True
                    elif res == "gone":
                        dead.append(sub.id)
                for sid in dead:
                    await session.execute(
                        delete(PushSubscription).where(PushSubscription.id == sid)
                    )
                if delivered:
                    alert.push_sent_at = datetime.now(timezone.utc)
                    summary["push_sent"] += 1
            await session.commit()

    # ── Fan out to mobile (Expo) push ──
    # Device-level opt-in: anyone who installed the native app and granted
    # permission registered a token, so we send regardless of the org's
    # browser web-push toggle.
    device_tokens = (
        await session.execute(
            select(MobilePushToken).where(MobilePushToken.org_id == org.id)
        )
    ).scalars().all()
    if device_tokens:
        all_tokens = [t.token for t in device_tokens]
        for alert in delivery_targets:
            if alert.mobile_push_sent_at is not None:
                continue
            addr = address_by_id.get(alert.monitored_address_id)
            if alert.kind == "zone_hail":
                where = alert.zone_name or "an alarm zone"
                mobile_body = "Storm in one of your alarm zones. Tap to see the swath."
            else:
                where = (
                    (addr.label or addr.address) if addr else None
                ) or alert.storm_city or "a monitored address"
                mobile_body = "New hail on a monitored address. Tap to verify and pull a report."
            dead = await send_expo_push(
                tokens=all_tokens,
                title=f'{alert.peak_size_in:.2f}" hail — {where}',
                body=mobile_body,
                data={
                    "type": "storm_alert",
                    "storm_id": alert.storm_id,
                    "url": "/app/alerts",
                },
            )
            # At least one live token delivered → mark sent (idempotent re-runs).
            if len(dead) < len(all_tokens):
                alert.mobile_push_sent_at = datetime.now(timezone.utc)
                summary["mobile_push_sent"] += 1
            for dt in device_tokens:
                if dt.token in dead:
                    await session.execute(
                        delete(MobilePushToken).where(MobilePushToken.id == dt.id)
                    )
        await session.commit()

    return summary


def _empty_summary() -> dict:
    return {
        "created": 0,
        "slack_sent": 0,
        "email_sent": 0,
        "sms_sent": 0,
        "push_sent": 0,
        "mobile_push_sent": 0,
        "skipped_already_delivered": 0,
    }


async def generate_alerts_for_all_orgs(session: AsyncSession) -> dict:
    """Worker entrypoint: walk every org and run the generator.

    Returns a per-org summary. Designed for the Railway cron worker
    (planned next phase). Stops on no-op orgs quickly — the
    `query_hail_at_point` call is the only meaningful cost and only
    fires when an org has monitored addresses with lat/lng set.
    """
    orgs = (
        await session.execute(select(Organization))
    ).scalars().all()

    out: dict[str, dict] = {}
    for org in orgs:
        try:
            out[org.id] = await generate_alerts_for_org(session, org)
        except Exception as exc:  # pragma: no cover
            log.exception("alert.org_failed: org=%s err=%s", org.id, exc)
            out[org.id] = {"error": str(exc)}
    return out
