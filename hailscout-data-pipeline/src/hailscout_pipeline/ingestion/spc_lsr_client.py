"""SPC Local Storm Reports — ground-truth hail observations.

Phase 21. SPC (Storm Prediction Center) publishes a daily CSV of
storm reports filed by NWS-affiliated spotters, emergency managers,
police, public, etc. — humans who saw hail and called it in. Each
row is a single observation with a timestamp, location, size, and
free-text comments.

URL pattern (UTC date):
    https://www.spc.noaa.gov/climo/reports/{YYMMDD}_rpts_hail.csv

CSV columns:
    Time, Size, Location, County, State, Lat, Lon, Comments

Size is encoded as hundredths of an inch (so 175 = 1.75″).

We treat LSRs as a third pipeline source alongside MRMS + NEXRAD —
each report becomes a Storm row with `source="SPC-LSR"`. This lets
the same UI surfaces (map, picker, /stats, /storms catalog) render
ground-truth observations alongside radar-derived cells, no schema
changes required.

Cross-referencing radar cells with LSRs is a query-time concern
(API can ask "any storms whose bbox contains a SPC-LSR centroid in
the same time window") — see Phase 21 follow-up if/when wired.
"""
from __future__ import annotations
import csv
import io
import re
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Iterable, List, Optional
from urllib.error import HTTPError, URLError

import structlog

log = structlog.get_logger()


SPC_BASE = "https://www.spc.noaa.gov/climo/reports"

# CSV "Time" field is HHMM UTC. SPC daily files cover the CONVECTIVE
# day: 12:00 UTC on the file date through 11:59 UTC the NEXT day. So a
# row with Time=0030 in the file dated 260518 happened at
# 2026-05-19T00:30 UTC (the evening of the 18th, US local time) — any
# HH < 12 belongs to the day AFTER the file date. Getting this wrong
# stamps evening-local reports 24h early, which silently breaks the
# ±30-min LSR↔radar linker for every post-midnight-UTC report.
TIME_RE = re.compile(r"^\s*(?P<hh>\d{1,2})(?P<mm>\d{2})\s*$")


@dataclass
class StormReport:
    """One human-filed hail observation from the SPC LSR feed."""
    timestamp: datetime
    size_in: float
    lat: float
    lng: float
    location: str
    county: str
    state: str
    comments: str
    nws_office: Optional[str] = None  # parsed from "(LWX)"-style suffix

    @property
    def synthetic_id(self) -> str:
        """Deterministic id derived from (date, lat, lng, time) so
        re-ingesting the same daily CSV is idempotent at the Storm
        level."""
        return (
            "lsr_"
            f"{self.timestamp.strftime('%Y%m%d%H%M')}"
            f"_{int(self.lat * 1000):+06d}"
            f"_{int(self.lng * 1000):+07d}"
        ).replace("+", "p").replace("-", "n")


def _parse_size(raw: str) -> Optional[float]:
    """SPC encodes size as hundredths of an inch (e.g. '175' → 1.75)."""
    try:
        return float(raw.strip()) / 100.0
    except (ValueError, AttributeError):
        return None


def _parse_time(raw: str, date: datetime) -> Optional[datetime]:
    """Combine HHMM-of-day with the file's UTC date into a full ts.

    SPC files are convective-day scoped (12Z → 11:59Z next day), so an
    HH < 12 row rolls over to the day after the file date.
    """
    m = TIME_RE.match(raw or "")
    if not m:
        return None
    hh = int(m.group("hh"))
    mm = int(m.group("mm"))
    if hh > 23 or mm > 59:
        return None
    ts = date.replace(hour=hh, minute=mm, second=0, microsecond=0)
    if hh < 12:
        ts += timedelta(days=1)
    return ts


_OFFICE_RE = re.compile(r"\(([A-Z]{3})\)\s*$")


def _extract_office(comments: str) -> Optional[str]:
    """Most LSR rows end with the issuing NWS WFO code in parens, e.g.
    '...north of Shelby. (ILX)'. We pull that out as a useful tag."""
    m = _OFFICE_RE.search(comments or "")
    return m.group(1) if m else None


def parse_lsr_csv(csv_text: str, file_date: datetime) -> List[StormReport]:
    """Parse SPC's daily hail-CSV text into StormReport records.

    Skips header row, rows with missing lat/lon/size, and rows whose
    time parses out-of-range.
    """
    out: List[StormReport] = []
    reader = csv.DictReader(io.StringIO(csv_text))
    for row in reader:
        try:
            lat = float(row.get("Lat", "").strip())
            lng = float(row.get("Lon", "").strip())
        except (ValueError, AttributeError):
            continue
        size = _parse_size(row.get("Size", ""))
        if size is None:
            continue
        ts = _parse_time(row.get("Time", ""), file_date)
        if ts is None:
            continue
        comments = (row.get("Comments") or "").strip()
        out.append(StormReport(
            timestamp=ts,
            size_in=size,
            lat=lat,
            lng=lng,
            location=(row.get("Location") or "").strip(),
            county=(row.get("County") or "").strip(),
            state=(row.get("State") or "").strip().upper(),
            comments=comments,
            nws_office=_extract_office(comments),
        ))
    return out


class SpcLsrClient:
    """Fetch + parse SPC daily hail LSR CSVs."""

    def __init__(self, base: str = SPC_BASE) -> None:
        self.base = base

    def url_for(self, dt: datetime) -> str:
        # SPC uses YYMMDD (2-digit year) in the filename.
        return f"{self.base}/{dt.strftime('%y%m%d')}_rpts_hail.csv"

    def fetch(self, dt: datetime) -> List[StormReport]:
        """Fetch one day's hail LSRs. Returns an empty list if the file
        404s (quiet day, file not yet published, far future) or if the
        network fails — caller logs warnings, this never raises."""
        url = self.url_for(dt)
        try:
            with urllib.request.urlopen(url, timeout=30) as resp:
                body = resp.read().decode("utf-8", errors="replace")
        except HTTPError as e:
            log.info("spc_lsr_no_file", url=url, status=e.code)
            return []
        except URLError as e:
            log.warning("spc_lsr_fetch_failed", url=url, error=str(e))
            return []
        reports = parse_lsr_csv(body, dt.replace(tzinfo=timezone.utc))
        log.info("spc_lsr_fetched", url=url, reports=len(reports))
        return reports

    def fetch_range(
        self, since: datetime, until: datetime,
    ) -> Iterable[StormReport]:
        """Fetch LSRs for every UTC day in [since, until] (inclusive)."""
        cur = since.replace(hour=0, minute=0, second=0, microsecond=0)
        end = until.replace(hour=0, minute=0, second=0, microsecond=0)
        one_day = timedelta(days=1)
        while cur <= end:
            yield from self.fetch(cur)
            cur += one_day
