"""AI feature endpoints — real, powered by Anthropic (gated on ANTHROPIC_API_KEY)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from hailscout_api.auth.middleware import extract_auth_context
from hailscout_api.core import get_logger
from hailscout_api.db.models.storm import Storm
from hailscout_api.db.session import get_db_session
from hailscout_api.schemas.ai import (
    ClaimLetterRequest,
    ClaimLetterResponse,
    DamageTriageRequest,
    DamageTriageResponse,
    NaturalLanguageQueryRequest,
    NaturalLanguageQueryResponse,
    StormScoreRequest,
    StormScoreResponse,
)
from hailscout_api.services.ai_service import (
    AIError,
    AINotConfigured,
    complete_text,
    triage_damage,
)
from hailscout_api.services.impact import storm_impact

logger = get_logger(__name__)
router = APIRouter()

_NOT_CONFIGURED = (
    "AI features aren't enabled yet. Set ANTHROPIC_API_KEY on the API to turn them on."
)


@router.post("/ai/damage-triage", response_model=DamageTriageResponse)
async def triage_damage_endpoint(
    body: DamageTriageRequest,
    request: Request,
) -> DamageTriageResponse:
    """Run a roof photo through a vision model for hail-damage triage."""
    await extract_auth_context(request)
    # Tolerate a data: URL prefix.
    image = body.image_base64.split(",")[-1].strip()
    try:
        data = await triage_damage(image, body.media_type, body.context)
    except AINotConfigured as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, _NOT_CONFIGURED) from exc
    except AIError as exc:
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY, "Damage analysis failed. Please try again."
        ) from exc

    def _f(key: str) -> float:
        try:
            return float(data.get(key) or 0.0)
        except (TypeError, ValueError):
            return 0.0

    est = data.get("estimated_hail_size_in")
    return DamageTriageResponse(
        hail_damage_probability=max(0.0, min(1.0, _f("hail_damage_probability"))),
        severity=str(data.get("severity") or "Low"),
        confidence=max(0.0, min(1.0, _f("confidence"))),
        estimated_hail_size_in=(float(est) if isinstance(est, (int, float)) else None),
        findings=[str(x) for x in (data.get("findings") or [])][:8],
        summary=str(data.get("summary") or ""),
        recommended_action=str(data.get("recommended_action") or ""),
    )


@router.post("/ai/claim-letter", response_model=ClaimLetterResponse)
async def draft_claim_letter(
    body: ClaimLetterRequest,
    request: Request,
) -> ClaimLetterResponse:
    """Draft an insurance claim support letter."""
    await extract_auth_context(request)
    prompt = (
        "Draft a concise, professional insurance claim support letter for a "
        "homeowner. Keep it factual — no exaggeration.\n"
        f"Homeowner: {body.homeowner_name}\n"
        f"Storm reference: {body.storm_id}\n"
        f"Property reference: {body.parcel_id}\n"
        "The letter should: state that a documented hail event affected the "
        "property, reference the storm record, request a claim inspection, and "
        "close politely. 4-6 short paragraphs, ready to send. Output only the "
        "letter body."
    )
    try:
        letter = await complete_text(prompt, max_tokens=1200)
    except AINotConfigured as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, _NOT_CONFIGURED) from exc
    except AIError as exc:
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY, "Letter drafting failed. Please try again."
        ) from exc
    return ClaimLetterResponse(
        parcel_id=body.parcel_id,
        storm_id=body.storm_id,
        letter_text=letter,
        s3_key=None,
    )


@router.post("/ai/query", response_model=NaturalLanguageQueryResponse)
async def natural_language_query(
    body: NaturalLanguageQueryRequest,
    request: Request,
) -> NaturalLanguageQueryResponse:
    """Interpret a natural-language hail search into plain-English filters."""
    await extract_auth_context(request)
    prompt = (
        "Interpret this hail-search request into ONE plain-English sentence "
        "describing the filters (location, date range, minimum hail size, "
        "radar source). Don't add commentary.\n"
        f"Request: {body.query}"
    )
    try:
        interpreted = await complete_text(prompt, max_tokens=200)
    except AINotConfigured as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, _NOT_CONFIGURED) from exc
    except AIError as exc:
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY, "Search interpretation failed."
        ) from exc
    return NaturalLanguageQueryResponse(
        query=body.query, interpreted_as=interpreted, results=[]
    )


@router.post("/ai/storm-score", response_model=StormScoreResponse)
async def score_storm(
    body: StormScoreRequest,
    request: Request,
    session: AsyncSession = Depends(get_db_session),
) -> StormScoreResponse:
    """Impact score (1-5) for a storm — the same heuristic the map uses."""
    await extract_auth_context(request)
    storm = (
        await session.execute(select(Storm).where(Storm.id == body.storm_id))
    ).scalars().first()
    if storm is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Storm not found")
    imp = storm_impact(
        storm.max_hail_size_in,
        500.0,  # nominal footprint; the score is size-dominated
        lsr_confirmed=bool(getattr(storm, "lsr_confirmed", False)),
        suspect=bool(getattr(storm, "suspect", False)),
    )
    return StormScoreResponse(
        storm_id=body.storm_id,
        score=int(imp["score"]),
        reasoning=imp.get("label"),
    )
