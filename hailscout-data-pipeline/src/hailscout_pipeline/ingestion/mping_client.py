"""mPING crowd-sourced hail reports — a second ground-truth source.

mPING (Meteorological Phenomena Identification Near the Ground; run by
NOAA/NSSL + OU) collects weather reports the public submits from the mPING
app. Its hail feed is far denser than SPC's official LSRs, so it fills the
gaps where no NWS spotter reported AND radar coverage is thin (e.g. near
the Canadian border) — exactly where a radar-first pipeline misses storms
the commercial products catch.

Each mPING hail report becomes a ground-truth point Storm row with
`source="mPING"`, alongside SPC-LSR + MRMS + NEXRAD — no schema change; it
reuses the SPC-LSR upsert path (upsert_lsr_report) via matching attributes.

API v2 (needs a free app token — register at mping.ou.edu):
    GET  {base}/reports/?obtime_gte=<iso>&obtime_lte=<iso>&category=Hail
    Authorization: Token <MPING_API_TOKEN>
Each result: {id, obtime, category, description, geom:{coordinates:[lng,lat]}}.
The size is parsed from the description text (e.g. "Quarter (1.00 in.)").

NOTE: the exact query params / field names should be spot-checked against a
live token the first time this runs — the size parse + a client-side
category filter are deliberately defensive so a param the API ignores still
yields correct (if larger) results.
"""
from __future__ import annotations
import json
import re
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Iterable, Optional
from urllib.error import HTTPError, URLError

import structlog

log = structlog.get_logger()

MPING_BASE = "https://mping.ou.edu/mping/api/v2"

# Size parsed from the mPING description. Nearly every hail description
# carries an explicit "(X.XX in.)"; the keyword map is a fallback.
_SIZE_RE = re.compile(r"([0-9]*\.?[0-9]+)\s*in", re.IGNORECASE)
_HAIL_SIZE_MAP = {
    "pea": 0.25, "half-inch": 0.5, "half inch": 0.5, "marble": 0.5,
    "penny": 0.75, "dime": 0.75, "nickel": 0.88, "quarter": 1.0,
    "half dollar": 1.25, "ping": 1.5, "walnut": 1.5, "golf": 1.75,
    "hen egg": 2.0, "egg": 2.0, "tennis": 2.5, "baseball": 2.75,
    "apple": 3.0, "teacup": 3.0, "grapefruit": 4.0, "softball": 4.5,
}


def _size_from_description(desc: str) -> Optional[float]:
    m = _SIZE_RE.search(desc or "")
    if m:
        try:
            v = float(m.group(1))
            return v if 0 < v < 8 else None
        except ValueError:
            pass
    d = (desc or "").lower()
    for kw, inches in _HAIL_SIZE_MAP.items():
        if kw in d:
            return inches
    return None


def _parse_obtime(raw: Optional[str]) -> Optional[datetime]:
    if not raw:
        return None
    try:
        dt = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except (ValueError, AttributeError):
        return None


@dataclass
class MpingReport:
    """One crowd-sourced hail observation from mPING. Mirrors the attribute
    surface upsert_lsr_report reads, so mPING reuses the SPC-LSR Storm-row
    code untouched."""
    report_id: int
    timestamp: datetime
    size_in: float
    lat: float
    lng: float
    description: str
    # SPC-parity fields (mPING has none of these) so the shared upsert and
    # its logging work unchanged.
    location: str = "mPING report"
    county: str = ""
    state: str = ""
    comments: str = ""
    nws_office: Optional[str] = None

    @property
    def synthetic_id(self) -> str:
        # mPING ids are globally unique + stable → idempotent re-ingest, and
        # the "mping_" prefix can't collide with SPC LSRs ("lsr_" prefix).
        return f"mping_{self.report_id}"


class MpingClient:
    """Fetch + parse mPING hail reports for a UTC time range."""

    def __init__(self, token: str, base: str = MPING_BASE) -> None:
        self.token = token
        self.base = base

    def _get(self, url: str) -> Optional[dict]:
        req = urllib.request.Request(
            url,
            headers={
                "Authorization": f"Token {self.token}",
                "Accept": "application/json",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                return json.loads(resp.read().decode("utf-8", errors="replace"))
        except HTTPError as e:
            log.warning("mping_http_error", status=e.code, url=url)
            return None
        except (URLError, ValueError) as e:
            log.warning("mping_fetch_failed", error=str(e))
            return None

    @staticmethod
    def _parse(row: dict) -> Optional[MpingReport]:
        try:
            if "hail" not in str(row.get("category", "")).lower():
                return None
            desc = str(row.get("description") or "")
            size = _size_from_description(desc)
            if size is None:
                return None
            coords = (row.get("geom") or {}).get("coordinates") or []
            if len(coords) < 2:
                return None
            lng, lat = float(coords[0]), float(coords[1])
            ts = _parse_obtime(row.get("obtime"))
            rid = row.get("id")
            if ts is None or rid is None:
                return None
            return MpingReport(
                report_id=int(rid), timestamp=ts, size_in=size,
                lat=lat, lng=lng, description=desc, comments=desc,
            )
        except (ValueError, TypeError):
            return None

    def fetch_range(
        self, since: datetime, until: datetime,
    ) -> Iterable[MpingReport]:
        """Yield mPING hail reports with obtime in [since, until] (UTC),
        following the API's `next` pagination. Empty (no-op) without a token."""
        if not self.token:
            log.info("mping_no_token")
            return
        fmt = "%Y-%m-%dT%H:%M:%SZ"
        url = (
            f"{self.base}/reports/"
            f"?category=Hail"
            f"&obtime_gte={since.strftime(fmt)}"
            f"&obtime_lte={until.strftime(fmt)}"
        )
        pages = 0
        while url and pages < 200:  # hard page cap — safety
            data = self._get(url)
            if not data:
                return
            for row in data.get("results", []):
                rep = self._parse(row)
                if rep is not None:
                    yield rep
            url = data.get("next")
            pages += 1
