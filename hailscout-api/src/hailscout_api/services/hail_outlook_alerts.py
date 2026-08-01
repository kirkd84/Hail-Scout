"""Daily "hail risk in your area" notifications from the SPC outlook.

Sibling to `alert_generator` but a different promise. That one says "hail HIT
your address" after the fact; this one says "hail is FORECAST for your area
today" while there's still time to line up a crew. Same alarm zones, same
fan-out channels (email + browser push + mobile push), so a customer who set
up "Colorado" gets both without configuring anything twice.

Two rules shape the whole module:

* **A forecast is not a size.** A zone's `min_hail_in` can't gate an outlook —
  SPC publishes a probability, not inches — so we gate on probability instead
  (`HAIL_OUTLOOK_MIN_PROB`, default 0.15). Nobody gets woken up on a 5% day.
* **Claim before you send.** The `hail_outlook_alerts` row goes in FIRST and
  the unique constraint is the dedupe; a crash halfway through a fan-out can
  therefore never double-notify. The cost is that a crash loses one
  notification, which is the right side to fail on.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import bindparam, delete, select, text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from hailscout_api.db.models.canvass import (
    AlertZone,
    MobilePushToken,
    PushSubscription,
)
from hailscout_api.db.models.org import Organization
from hailscout_api.db.models.radar import HailOutlookAlert
from hailscout_api.services.email_alerts import parse_recipient_list, send_alert_email
from hailscout_api.services.expo_push import send_expo_push
from hailscout_api.services.push_alerts import push_configured, send_web_push

log = logging.getLogger(__name__)


# Kind-specific SQL predicate against the outlook polygon. Mirrors
# `alert_generator._ZONE_PRED` — same three zone kinds, same us_states join —
# but tests the forecast area instead of a storm centroid.
_ZONE_PRED = {
    "radius": (
        "ST_DWithin(o.geom::geography, "
        "ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography, :meters)"
    ),
    "states": (
        "EXISTS (SELECT 1 FROM us_states st "
        "WHERE st.code IN :codes AND ST_Intersects(st.geom, o.geom))"
    ),
    "nationwide": "TRUE",
}

# Only outlooks whose window is open RIGHT NOW. SPC's convective day runs
# 12Z→12Z, and the day-1 outlook is re-issued through it, so there is
# essentially always a live day-1 window; the day-2 outlook (valid from
# tomorrow 12Z) correctly stays quiet until it becomes day 1. That puts the
# first ping of a new risk day at 12Z — early morning across the US, which is
# when a roofer can still do something about it.
# Two subtleties in the WHERE/ORDER BY, both learned the hard way:
#
# 1. The probability floor applies to `hail` ONLY. Significant-hail contours
#    are stored at a flat 0.10 by convention (it isn't a forecast probability
#    — SPC's sighail is a hatched area, not a percentage), so gating them on
#    the same floor as `hail` silently disabled the single most valuable
#    alert a roofer can get: 2"+ hail means roof replacement, not repair.
#
# 2. Prefer the LOWEST day number on a tie. SPC's day-2 outlook covers the
#    same 12Z-12Z window as the next morning's day-1, and both stay "currently
#    valid" at once. Without this, a day-2 row with a higher probability (a
#    routine overnight downgrade) wins and the rep is told the risk is
#    "tomorrow" when it's today — and because the dedupe key is
#    (zone, kind, valid_from) and both rows share valid_from, the correct
#    day-1 message is then swallowed as a duplicate.
_MATCH_SQL = """
    SELECT o.id, o.day, o.kind, o.probability, o.label, o.valid_from, o.valid_to
      FROM hail_outlooks o
     WHERE o.valid_from <= :now
       AND o.valid_to > :now
       AND (o.kind <> 'hail' OR o.probability >= :min_prob)
       AND {pred}
     ORDER BY o.day ASC, o.probability DESC, o.valid_from DESC
"""

# SPC re-issues the day-1 outlook up to five times a day. Each issuance is a
# new `valid_from`, so the unique constraint alone would let one storm day
# ping a zone five times. Every issuance covering the same convective day
# shares an EXPIRE, and its VALID always falls inside the 24h before it — so
# "already told them about this risk day" is: an alert whose valid_from sits
# in [valid_to - 24h, valid_to]. We re-ping inside that window only when the
# risk actually went UP, which is news a roofer wants.
_RISK_DAY_SPAN = timedelta(hours=24)

# What "significant hail" means in inches — the copy says the size, never the
# forecaster's word for it.
_SIGHAIL_SIZE = '2"'


def min_probability() -> float:
    """Probability floor below which nobody is notified."""
    raw = os.environ.get("HAIL_OUTLOOK_MIN_PROB", "0.15")
    try:
        v = float(raw)
    except ValueError:
        return 0.15
    # Tolerate "15" meaning 15% — an easy env-var mistake to make.
    if v > 1.0:
        v = v / 100.0
    return min(1.0, max(0.0, v))


def _window_text(valid_from: datetime, valid_to: datetime) -> str:
    """Human forecast window, matching the storm email's timestamp voice."""
    return (
        f"{valid_from.strftime('%b %d %H:%M')} – "
        f"{valid_to.strftime('%b %d %H:%M')} UTC"
    )


def render_outlook_message(
    *,
    zone_name: str,
    kind: str,
    day: int,
    probability: float,
    valid_from: datetime,
    valid_to: datetime,
) -> tuple[str, str]:
    """(headline, detail) in plain language — no SPC/POSH/probability jargon.

    A roofer reads the headline on a lock screen and needs to know whether to
    care; the detail tells them when.
    """
    when = "today" if day == 1 else "tomorrow"
    window = _window_text(valid_from, valid_to)
    if kind == "sighail":
        headline = f"Large hail possible — {zone_name}"
        detail = (
            f"Forecasters have {zone_name} in the area for damaging hail "
            f"({_SIGHAIL_SIZE}+) {when}. Forecast window {window}."
        )
    else:
        headline = f"{probability:.0%} chance of hail in {zone_name} {when}"
        detail = (
            f"Hail is in the forecast for {zone_name} {when}. "
            f"Forecast window {window}."
        )
    return headline, detail


def render_outlook_email(
    *,
    zone_name: str,
    kind: str,
    day: int,
    probability: float,
    valid_from: datetime,
    valid_to: datetime,
    app_url: str = "https://hailgps.com",
) -> tuple[str, str, str]:
    """(subject, text_body, html_body) — same calm voice + dark-mode-safe
    markup as `email_alerts.render_alert_email`."""
    headline, detail = render_outlook_message(
        zone_name=zone_name,
        kind=kind,
        day=day,
        probability=probability,
        valid_from=valid_from,
        valid_to=valid_to,
    )

    text_body = "\n".join([
        headline,
        detail,
        "",
        "This is a forecast, not a confirmed hit — open the map to watch the "
        "risk area and get ahead of the canvass:",
        f"  {app_url}/live",
        "",
        "— Hail GPS",
        "",
        "You're receiving this because one of your alarm zones covers the "
        "forecast area. Manage zones in the app.",
    ])

    html_body = f"""\
<!doctype html>
<html>
<body style="margin:0;padding:24px;background:#0b1220;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#e6ecf3">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="max-width:540px;width:100%">
<tr><td>
  <div style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#8a9bb8;margin-bottom:6px">Hail GPS forecast</div>
  <div style="font-size:26px;font-weight:600;line-height:1.25">{headline}</div>

  <div style="margin-top:20px;padding:16px;border:1px solid #1f2a3a;border-radius:8px;background:#111a2c">
    <div style="color:#8a9bb8;font-size:12px;text-transform:uppercase;letter-spacing:.06em">Alarm zone</div>
    <div style="font-size:15px;margin-top:2px">{zone_name}</div>
    <div style="color:#cdd6e3;font-size:13px;margin-top:8px;line-height:1.5">{detail}</div>
  </div>

  <div style="margin-top:20px">
    <a href="{app_url}/live"
       style="display:inline-block;padding:10px 18px;background:#3b82f6;color:#fff;text-decoration:none;border-radius:6px;font-size:14px">
      Open the map
    </a>
  </div>

  <div style="margin-top:32px;padding-top:16px;border-top:1px solid #1f2a3a;color:#8a9bb8;font-size:12px;line-height:1.5">
    This is a forecast, not a confirmed hit. You're receiving it because one
    of your alarm zones covers the forecast area.
  </div>
</td></tr>
</table>
</body>
</html>
"""
    return headline, text_body, html_body


async def _match_zone_outlooks(
    session: AsyncSession, zone: AlertZone, now: datetime, min_prob: float
) -> list[dict[str, Any]]:
    """Currently-valid outlooks covering this zone — at most one per hazard.

    Overlapping contours are normal (a 45% area sits inside the 15% area), so
    we keep only the highest probability per kind; a zone should hear the
    worst number once, not every ring it happens to sit in.
    """
    pred = _ZONE_PRED.get(zone.kind)
    if pred is None:
        return []

    sql = text(_MATCH_SQL.format(pred=pred))
    params: dict[str, Any] = {"now": now, "min_prob": min_prob}
    if zone.kind == "radius":
        if zone.center_lat is None or zone.center_lng is None or not zone.radius_mi:
            return []
        params.update(
            lng=zone.center_lng,
            lat=zone.center_lat,
            meters=zone.radius_mi * 1609.34,
        )
    elif zone.kind == "states":
        codes = json.loads(zone.states) if zone.states else []
        if not codes:
            return []
        sql = sql.bindparams(bindparam("codes", expanding=True))
        params["codes"] = codes

    try:
        rows = (await session.execute(sql, params)).all()
    except Exception:  # pragma: no cover — bad geometry shouldn't kill the run
        log.exception("hail_outlook.zone_match_failed zone=%s", zone.id)
        return []

    best: dict[str, dict[str, Any]] = {}
    for r in rows:
        if r.kind in best:
            continue  # ordered probability DESC — the first is the worst
        best[r.kind] = {
            "outlook_id": r.id,
            "day": r.day,
            "kind": r.kind,
            "probability": float(r.probability),
            "label": r.label,
            "valid_from": r.valid_from,
            "valid_to": r.valid_to,
        }
    return list(best.values())


async def _already_notified_at_or_above(
    session: AsyncSession, zone_id: str, match: dict[str, Any]
) -> bool:
    """True when this zone already heard about this risk day at >= this risk.

    A later issuance that raises the number still goes out; one that repeats
    or lowers it stays quiet.
    """
    since = match["valid_to"] - _RISK_DAY_SPAN
    prior = (
        await session.execute(
            text(
                """
                SELECT COALESCE(MAX(probability), -1) AS peak
                  FROM hail_outlook_alerts
                 WHERE zone_id = :zone_id
                   AND kind = :kind
                   AND valid_from >= :since
                """
            ),
            {"zone_id": zone_id, "kind": match["kind"], "since": since},
        )
    ).scalar()
    return prior is not None and float(prior) >= match["probability"]


async def _claim(
    session: AsyncSession, org_id: str, zone_id: str, match: dict[str, Any]
) -> bool:
    """Insert the dedupe row BEFORE sending. False = someone already has it.

    `on_conflict_do_nothing` + RETURNING gives us the claim and the answer in
    one round-trip, and the commit makes it durable before a single message
    leaves the process.
    """
    stmt = (
        pg_insert(HailOutlookAlert)
        .values(
            org_id=org_id,
            zone_id=zone_id,
            kind=match["kind"],
            day=match["day"],
            probability=match["probability"],
            valid_from=match["valid_from"],
        )
        .on_conflict_do_nothing(constraint="uq_hail_outlook_alert_zone_period")
        .returning(HailOutlookAlert.id)
    )
    try:
        claimed = (await session.execute(stmt)).scalar_one_or_none()
        await session.commit()
    except Exception:  # pragma: no cover
        await session.rollback()
        log.exception("hail_outlook.claim_failed zone=%s", zone_id)
        return False
    return claimed is not None


async def _load_channels(session: AsyncSession, org: Organization) -> dict[str, Any]:
    """One fetch of every delivery target for an org, reused across its zones."""
    subs: list[PushSubscription] = []
    if org.push_enabled and push_configured():
        subs = list(
            (
                await session.execute(
                    select(PushSubscription).where(PushSubscription.org_id == org.id)
                )
            ).scalars().all()
        )
    tokens = list(
        (
            await session.execute(
                select(MobilePushToken).where(MobilePushToken.org_id == org.id)
            )
        ).scalars().all()
    )
    recipients = (
        parse_recipient_list(org.alert_email_recipients)
        if org.alert_emails_enabled
        else []
    )
    return {"recipients": recipients, "subs": subs, "tokens": tokens}


async def _fan_out(
    session: AsyncSession,
    zone: AlertZone,
    match: dict[str, Any],
    channels: dict[str, Any],
    summary: dict[str, int],
) -> None:
    """Deliver one claimed outlook alert on every configured channel.

    Slack and SMS are deliberately skipped: both are storm-hit channels today,
    and a forecast is lower-urgency news that shouldn't spend an SMS segment.
    """
    zone_name = zone.name or "your area"
    headline, detail = render_outlook_message(
        zone_name=zone_name,
        kind=match["kind"],
        day=match["day"],
        probability=match["probability"],
        valid_from=match["valid_from"],
        valid_to=match["valid_to"],
    )

    # ── Email ──
    if channels["recipients"]:
        subject, text_body, html_body = render_outlook_email(
            zone_name=zone_name,
            kind=match["kind"],
            day=match["day"],
            probability=match["probability"],
            valid_from=match["valid_from"],
            valid_to=match["valid_to"],
        )
        try:
            if await send_alert_email(
                to_addresses=channels["recipients"],
                subject=subject,
                text_body=text_body,
                html_body=html_body,
            ):
                summary["email_sent"] += 1
        except Exception:  # pragma: no cover
            log.exception("hail_outlook.email_send_failed zone=%s", zone.id)

    tag = f"outlook-{match['outlook_id']}"

    # ── Browser web push ──
    if channels["subs"]:
        payload = {
            "title": headline,
            "body": detail,
            "url": "/app/map",
            "tag": tag,
        }
        delivered = False
        dead: list[str] = []
        for sub in channels["subs"]:
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
        if dead:
            channels["subs"] = [s for s in channels["subs"] if s.id not in dead]
            await session.commit()
        if delivered:
            summary["push_sent"] += 1

    # ── Mobile (Expo) push ──
    if channels["tokens"]:
        all_tokens = [t.token for t in channels["tokens"]]
        dead_tokens = await send_expo_push(
            tokens=all_tokens,
            title=headline,
            body=detail,
            data={
                "type": "hail_outlook",
                "zone_id": zone.id,
                "outlook_id": match["outlook_id"],
                "url": "/app/map",
            },
        )
        if len(dead_tokens) < len(all_tokens):
            summary["mobile_push_sent"] += 1
        if dead_tokens:
            for dt in list(channels["tokens"]):
                if dt.token in dead_tokens:
                    await session.execute(
                        delete(MobilePushToken).where(MobilePushToken.id == dt.id)
                    )
            channels["tokens"] = [
                t for t in channels["tokens"] if t.token not in dead_tokens
            ]
            await session.commit()


async def notify_hail_outlooks(session: AsyncSession) -> dict:
    """Notify every enabled alarm zone sitting under a live hail outlook.

    Returns {zones_checked, matched, notified, skipped_duplicate,
    skipped_not_escalated, email_sent, push_sent, mobile_push_sent}.

    Nothing is written to `storm_alerts` — an outlook has no storm behind it,
    and inventing one would put a phantom row in the in-app hit feed.
    """
    now = datetime.now(timezone.utc)
    min_prob = min_probability()
    summary = {
        "zones_checked": 0,
        "matched": 0,
        "notified": 0,
        "skipped_duplicate": 0,
        "skipped_not_escalated": 0,
        "email_sent": 0,
        "push_sent": 0,
        "mobile_push_sent": 0,
    }

    zones = (
        await session.execute(select(AlertZone).where(AlertZone.enabled.is_(True)))
    ).scalars().all()
    by_org: dict[str, list[AlertZone]] = {}
    for zone in zones:
        # Wind-only zones opted out of hail; the threshold itself can't gate a
        # forecast (see the module docstring), only its presence can.
        if zone.min_hail_in is None:
            continue
        by_org.setdefault(zone.org_id, []).append(zone)

    for org_id, org_zones in by_org.items():
        # Match first, load delivery targets only if this org has news — most
        # orgs on most days match nothing.
        pending: list[tuple[AlertZone, dict[str, Any]]] = []
        for zone in org_zones:
            summary["zones_checked"] += 1
            for match in await _match_zone_outlooks(session, zone, now, min_prob):
                summary["matched"] += 1
                pending.append((zone, match))
        if not pending:
            continue

        org = await session.get(Organization, org_id)
        if org is None:  # pragma: no cover — FK makes this near-impossible
            continue
        channels = await _load_channels(session, org)

        for zone, match in pending:
            if await _already_notified_at_or_above(session, zone.id, match):
                summary["skipped_not_escalated"] += 1
                continue
            if not await _claim(session, org_id, zone.id, match):
                summary["skipped_duplicate"] += 1
                continue
            summary["notified"] += 1
            try:
                await _fan_out(session, zone, match, channels, summary)
            except Exception:  # pragma: no cover — one zone, not the batch
                log.exception("hail_outlook.fan_out_failed zone=%s", zone.id)

    log.info("hail_outlook.notify_done %s", summary)
    return summary
