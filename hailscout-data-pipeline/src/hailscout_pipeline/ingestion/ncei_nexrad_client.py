"""NCEI deep-archive NEXRAD client — historical Level II access.

Phase 22. The Unidata mirror (`unidata-nexrad-level2`) only retains
~7 days of recent volume scans, which is fine for the live loop but
useless for back-populating last May's outbreaks or 2024's derechos.

NOAA's `noaa-nexrad-level2` S3 bucket holds the full archive going
back to ~1991. The catch: NOAA revoked anonymous LIST permission via
the AWS SDK signature chain — `boto3` with `UNSIGNED` config gets
AccessDenied on `list_objects_v2`. Individual GETs still work
anonymously, but you can't enumerate.

The workaround: the bucket's S3 REST endpoint at
`https://noaa-nexrad-level2.s3.amazonaws.com/` still serves the
listing XML to plain anonymous HTTP requests (no SDK, no signature
attempt). We parse the XML directly with stdlib `xml.etree`.

This module deliberately mirrors `nexrad_client.NexradClient` so
`nexrad_main.cmd_backfill` can swap one for the other based on
how far back the date range goes.

Key layout (same as Unidata mirror, same as S3):
    {YYYY}/{MM}/{DD}/{Station}/{Station}{YYYYMMDD}_{HHMMSS}_V06[_MDM]
"""
from __future__ import annotations
import re
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from pathlib import Path
from tempfile import gettempdir
from urllib.error import HTTPError, URLError

import structlog

from hailscout_pipeline.ingestion.nexrad_client import (
    NEXRAD_PATTERN,
    VolumeScanKey,
)

log = structlog.get_logger()


# Anonymous REST endpoint for the NOAA archive bucket. The bucket
# blocks SDK-signed anonymous LIST but the plain REST URL still serves
# listing XML.
NCEI_BUCKET_HOST = "https://noaa-nexrad-level2.s3.amazonaws.com"

# S3 ListObjectsV2 XML namespace
_NS = {"s3": "http://s3.amazonaws.com/doc/2006-03-01/"}


class NceiNexradClient:
    """Anonymous client for NOAA's full Level II archive over HTTPS.

    Reuses `VolumeScanKey` so downstream processing (download → SCIT)
    doesn't care whether the scan came from the Unidata mirror or here.
    `s3_key` on each VolumeScanKey is the bucket-relative path; we
    fetch via `{host}/{key}` to dodge the SDK signature path.
    """

    def __init__(self, host: str = NCEI_BUCKET_HOST) -> None:
        self.host = host.rstrip("/")

    def _prefix_for(self, dt: datetime, station: str) -> str:
        return (
            f"{dt.strftime('%Y')}/{dt.strftime('%m')}/{dt.strftime('%d')}/"
            f"{station.upper()}/"
        )

    def _list_prefix(self, prefix: str) -> list[str]:
        """Return all keys under `prefix`, paginating ContinuationToken."""
        out: list[str] = []
        token: str | None = None
        while True:
            qs = {
                "list-type": "2",
                "prefix": prefix,
                "max-keys": "1000",
            }
            if token:
                qs["continuation-token"] = token
            url = f"{self.host}/?{urllib.parse.urlencode(qs)}"
            try:
                with urllib.request.urlopen(url, timeout=30) as resp:
                    body = resp.read()
            except (HTTPError, URLError) as e:
                log.warning("ncei_list_failed", url=url, error=str(e))
                return out

            root = ET.fromstring(body)
            for c in root.findall("s3:Contents", _NS):
                key_el = c.find("s3:Key", _NS)
                if key_el is not None and key_el.text:
                    out.append(key_el.text)

            truncated = root.find("s3:IsTruncated", _NS)
            if truncated is None or (truncated.text or "").lower() != "true":
                break
            tok_el = root.find("s3:NextContinuationToken", _NS)
            if tok_el is None or not tok_el.text:
                break
            token = tok_el.text
        return out

    def list_volume_scans(
        self, dt: datetime, station: str,
    ) -> list[VolumeScanKey]:
        """List all parsed volume scans for one station on one UTC date."""
        prefix = self._prefix_for(dt, station)
        keys = self._list_prefix(prefix)
        out: list[VolumeScanKey] = []
        for key in keys:
            name = key.rsplit("/", 1)[-1]
            m = NEXRAD_PATTERN.match(name)
            if not m:
                continue
            try:
                ts = datetime.strptime(
                    f"{m['date']}{m['time']}", "%Y%m%d%H%M%S"
                ).replace(tzinfo=timezone.utc)
            except ValueError:
                continue
            out.append(VolumeScanKey(
                station=m["station"],
                timestamp=ts,
                s3_key=key,
                is_mdm=bool(m["mdm"]),
            ))
        out.sort(key=lambda v: v.timestamp)
        return out

    def list_volume_scans_window(
        self, start: datetime, end: datetime, station: str,
    ) -> list[VolumeScanKey]:
        """List all full-volume scans for one station in [start, end] UTC.

        Walks UTC days from start..end inclusive, filters MDM partials.
        """
        out: list[VolumeScanKey] = []
        cur = start.replace(hour=0, minute=0, second=0, microsecond=0)
        end_floor = end.replace(hour=0, minute=0, second=0, microsecond=0)
        one_day = timedelta(days=1)
        while cur <= end_floor:
            for scan in self.list_volume_scans(cur, station):
                if scan.is_mdm:
                    continue
                if start <= scan.timestamp <= end:
                    out.append(scan)
            cur += one_day
        return out

    def download(self, key: VolumeScanKey) -> str:
        """Download one volume scan to /tmp via plain anonymous HTTPS."""
        name = key.s3_key.rsplit("/", 1)[-1]
        local = Path(gettempdir()) / name
        url = f"{self.host}/{key.s3_key}"
        log.info("ncei_download", url=url, local=str(local),
                 station=key.station, ts=key.timestamp.isoformat())
        with urllib.request.urlopen(url, timeout=120) as resp, \
                open(local, "wb") as f:
            while True:
                chunk = resp.read(1024 * 256)
                if not chunk:
                    break
                f.write(chunk)
        log.info("ncei_downloaded", url=url, size=local.stat().st_size)
        return str(local)
