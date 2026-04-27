"""AI feature endpoints (Month 4+)."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

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

router = APIRouter()


@router.post("/ai/storm-score", response_model=StormScoreResponse)
async def score_storm(request: StormScoreRequest) -> StormScoreResponse:
    """Algorithmic storm scoring (Month 4).

    TODO(M4): Implement ML-based storm impact scoring
    """
    raise HTTPException(status_code=501, detail="Not implemented (Month 4)")


@router.post("/ai/damage-triage", response_model=DamageTriageResponse)
async def triage_damage(request: DamageTriageRequest) -> DamageTriageResponse:
    """Analyze contractor photos for hail damage (Month 4).

    TODO(M4): Implement CNN-based damage triage model
    """
    raise HTTPException(status_code=501, detail="Not implemented (Month 4)")


@router.post("/ai/query", response_model=NaturalLanguageQueryResponse)
async def natural_language_query(
    request: NaturalLanguageQueryRequest,
) -> NaturalLanguageQueryResponse:
    """Natural language search over storms (Month 5).

    TODO(M5): Implement NLP query parser with semantic search
    """
    raise HTTPException(status_code=501, detail="Not implemented (Month 5)")


@router.post("/ai/claim-letter", response_model=ClaimLetterResponse)
async def draft_claim_letter(request: ClaimLetterRequest) -> ClaimLetterResponse:
    """Draft insurance claim support letter (Month 5).

    TODO(M5): Implement LLM-based letter drafting
    """
    raise HTTPException(status_code=501, detail="Not implemented (Month 5)")
