"""Live radar frames + SPC hail-outlook endpoints.

Public and unauthenticated — same posture as /v1/storms — so the marketing
map, the web app and mobile all read the live layers without a session.

Three radar products, in increasing order of "does a roofer care":

    reflectivity — where the storm is (context, drawn underneath)
    posh         — hail is LIKELY here
    mesh         — hail is FALLING here, and this big (the hero layer)

Frames are immutable once written (the id pins product + valid time), so
the PNG endpoint is cached hard and answers 304s. The list endpoint never
selects the blob column — clients fetch each image by URL so the browser
cache and parallel preloading do the work.

Both list endpoints degrade to an empty list on a DB error (e.g. an
environment that hasn't run migration 027 yet) rather than 500 the map.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from geoalchemy2.functions import ST_AsGeoJSON
from pydantic import BaseModel, Field
from sqlalchemy import and_, func, or_, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from hailscout_api.core import get_logger
from hailscout_api.db.models.radar import RADAR_PRODUCTS, HailOutlook, RadarFrame
from hailscout_api.db.session import get_db_session
from hailscout_api.schemas.storm import GeoMultiPolygon

logger = get_logger(__name__)
router = APIRouter()

# Frames never change once written, so the browser/CDN can hold them
# forever. Kept as a constant so the 200 and the 304 answer identically.
_FRAME_CACHE_CONTROL = "public, max-age=31536000, immutable"

# SPC publishes two hail products: the general severe-hail probability
# and the "significant" (2in+) subset.
OUTLOOK_KINDS = ("hail", "sighail")


# ---- Response models ----

class RadarFrameBounds(BaseModel):
    """Geographic extent of a frame — a MapLibre image-source corner box."""
    min_lat: float
    min_lng: float
    max_lat: float
    max_lng: float


class RadarFrameResponse(BaseModel):
    id: str
    product: str
    valid_time: datetime
    bounds: RadarFrameBounds
    width: int
    height: int
    # Inches for hail size, % for "hail likely", dBZ for the storm layer —
    # so a client can caption the frame without decoding the PNG.
    peak_value: float | None = None
    url: str = Field(..., description="Path to the immutable PNG for this frame")


class RadarFramesResponse(BaseModel):
    frames: list[RadarFrameResponse] = Field(default_factory=list)


class HailOutlookResponse(BaseModel):
    id: str
    day: int
    kind: str
    probability: float
    label: str | None = None
    valid_from: datetime
    valid_to: datetime
    issued_at: datetime | None = None
    geometry: GeoMultiPolygon | None = None


class HailOutlooksResponse(BaseModel):
    outlooks: list[HailOutlookResponse] = Field(default_factory=list)


def _frame_url(frame_id: str) -> str:
    """Path to a frame's PNG. Router is mounted under /v1."""
    return f"/v1/radar/frames/{quote(frame_id, safe='')}.png"


def _frame_etag(frame_id: str) -> str:
    """Strong ETag from the (immutable) frame id.

    The id is echoed into a response header, so drop anything that isn't
    a plain slug character rather than trust a path param verbatim.
    """
    safe = "".join(c for c in frame_id if c.isalnum() or c in "-_.:")
    return f'"{safe}"'


# ---- Live radar frames ----

@router.get("/radar/frames", response_model=RadarFramesResponse)
async def list_radar_frames(
    product: str = Query(
        "mesh",
        description="Which layer: 'mesh' (hail size — the one reps care "
                    "about), 'posh' (hail likely), or 'reflectivity' "
                    "(where the storm is).",
    ),
    limit: int = Query(
        12,
        ge=1, le=60,
        description="How many frames, newest first. Frames land about every "
                    "2 minutes, so the default 12 ≈ 24 minutes of loop "
                    "history and the 60 cap ≈ 2 hours.",
    ),
    session: AsyncSession = Depends(get_db_session),
) -> RadarFramesResponse:
    """Newest-first frames for one product, as image metadata + a URL.

    The PNG bytes are deliberately NOT inlined — a loop is a dozen images
    and base64-in-JSON would balloon the payload and defeat caching. The
    client fetches each `url` (immutable, cached forever) in parallel.
    """
    key = product.strip().lower()
    if key not in RADAR_PRODUCTS:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown product '{product}'. "
                   f"Expected one of: {', '.join(RADAR_PRODUCTS)}",
        )

    # Explicit column list — never pull RadarFrame.png into a list query,
    # it's a several-hundred-KB blob per row.
    stmt = (
        select(
            RadarFrame.id,
            RadarFrame.product,
            RadarFrame.valid_time,
            RadarFrame.min_lat,
            RadarFrame.min_lng,
            RadarFrame.max_lat,
            RadarFrame.max_lng,
            RadarFrame.width,
            RadarFrame.height,
            RadarFrame.peak_value,
        )
        .where(RadarFrame.product == key)
        .order_by(RadarFrame.valid_time.desc())
        .limit(limit)
    )
    try:
        rows = (await session.execute(stmt)).all()
    except SQLAlchemyError as exc:
        # Missing table (un-migrated env) or a DB hiccup shouldn't take the
        # map down — the live layer just stays empty.
        logger.warning("radar.frames.query_failed", product=key, error=str(exc))
        return RadarFramesResponse(frames=[])

    frames = [
        RadarFrameResponse(
            id=r.id,
            product=r.product,
            valid_time=r.valid_time,
            bounds=RadarFrameBounds(
                min_lat=r.min_lat,
                min_lng=r.min_lng,
                max_lat=r.max_lat,
                max_lng=r.max_lng,
            ),
            width=r.width,
            height=r.height,
            peak_value=r.peak_value,
            url=_frame_url(r.id),
        )
        for r in rows
    ]
    return RadarFramesResponse(frames=frames)


@router.get(
    "/radar/frames/{frame_id}.png",
    response_class=Response,
    responses={200: {"content": {"image/png": {}}, "description": "Frame image"}},
)
async def get_radar_frame_png(
    frame_id: str,
    request: Request,
    session: AsyncSession = Depends(get_db_session),
) -> Response:
    """The rendered PNG for one frame.

    Immutable: a given id is always the same product at the same valid
    time, so this is cached for a year and answers 304 to a matching
    If-None-Match — a looping client re-fetches nothing.
    """
    etag = _frame_etag(frame_id)
    headers = {"Cache-Control": _FRAME_CACHE_CONTROL, "ETag": etag}

    inm = request.headers.get("if-none-match", "")
    if etag in [tag.strip() for tag in inm.split(",") if tag.strip()]:
        return Response(status_code=304, headers=headers)

    try:
        png = (
            await session.execute(
                select(RadarFrame.png).where(RadarFrame.id == frame_id)
            )
        ).scalar_one_or_none()
    except SQLAlchemyError as exc:
        logger.warning("radar.frame_png.query_failed",
                       frame_id=frame_id, error=str(exc))
        png = None

    if not png:
        raise HTTPException(status_code=404, detail="Radar frame not found")

    return Response(content=bytes(png), media_type="image/png", headers=headers)


# ---- SPC hail outlooks ----

@router.get("/outlook/hail", response_model=HailOutlooksResponse)
async def get_hail_outlook(
    day: int = Query(
        1,
        ge=1, le=3,
        description="Forecast day: 1 = today, 2 = tomorrow, 3 = the day after.",
    ),
    kind: str | None = Query(
        None,
        description="'hail' for any severe hail, 'sighail' for the "
                    "significant (2in+) subset. Omit for both.",
    ),
    include_expired: bool = Query(
        False,
        description="Also return outlook periods that have already ended. "
                    "Off by default — the map only wants what's still in "
                    "force.",
    ),
    session: AsyncSession = Depends(get_db_session),
) -> HailOutlooksResponse:
    """SPC hail-probability contours for a forecast day, as GeoJSON.

    Only the newest issuance is returned per kind. SPC re-issues day 1
    several times a day and the superseded contours stay technically
    unexpired until tomorrow's cycle, so returning everything unexpired
    would stack this morning's forecast under the current one.

    A quiet day legitimately has no contours — that returns an empty list,
    never a placeholder shape.
    """
    kind_key = kind.strip().lower() if kind and kind.strip() else None
    if kind_key and kind_key not in OUTLOOK_KINDS:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown kind '{kind}'. "
                   f"Expected one of: {', '.join(OUTLOOK_KINDS)}",
        )

    now = datetime.now(timezone.utc)
    filters = [HailOutlook.day == day]
    if kind_key:
        filters.append(HailOutlook.kind == kind_key)
    if not include_expired:
        filters.append(HailOutlook.valid_to >= now)

    # Two-step so the geometry columns are only read for the issuance we
    # actually return. `valid_from` advances with each re-issue, so its max
    # per kind identifies the current one (issued_at is nullable).
    latest_stmt = (
        select(
            HailOutlook.kind,
            func.max(HailOutlook.valid_from).label("valid_from"),
        )
        .where(and_(*filters))
        .group_by(HailOutlook.kind)
    )
    try:
        latest = (await session.execute(latest_stmt)).all()
    except SQLAlchemyError as exc:
        logger.warning("outlook.hail.query_failed", day=day, error=str(exc))
        return HailOutlooksResponse(outlooks=[])

    if not latest:
        return HailOutlooksResponse(outlooks=[])

    current_issuance = or_(*[
        and_(HailOutlook.kind == r.kind, HailOutlook.valid_from == r.valid_from)
        for r in latest
    ])
    # Ascending probability so a client that draws them in order stacks the
    # low-risk contour underneath the high-risk one.
    stmt = (
        select(
            HailOutlook.id,
            HailOutlook.day,
            HailOutlook.kind,
            HailOutlook.probability,
            HailOutlook.label,
            HailOutlook.valid_from,
            HailOutlook.valid_to,
            HailOutlook.issued_at,
            ST_AsGeoJSON(HailOutlook.geom).label("geom_json"),
        )
        .where(and_(HailOutlook.day == day, current_issuance))
        .order_by(HailOutlook.kind, HailOutlook.probability.asc())
    )
    try:
        rows = (await session.execute(stmt)).all()
    except SQLAlchemyError as exc:
        logger.warning("outlook.hail.geometry_query_failed",
                       day=day, error=str(exc))
        return HailOutlooksResponse(outlooks=[])

    outlooks = [
        HailOutlookResponse(
            id=r.id,
            day=r.day,
            kind=r.kind,
            probability=float(r.probability),
            label=r.label,
            valid_from=r.valid_from,
            valid_to=r.valid_to,
            issued_at=r.issued_at,
            geometry=json.loads(r.geom_json) if r.geom_json else None,
        )
        for r in rows
    ]
    return HailOutlooksResponse(outlooks=outlooks)
