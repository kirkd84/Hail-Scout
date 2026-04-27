"""Schemas for AI endpoints (M4+)."""

from __future__ import annotations

from pydantic import BaseModel, Field


class StormScoreRequest(BaseModel):
    """Score a storm algorithmically (M4)."""

    storm_id: str


class StormScoreResponse(BaseModel):
    """Storm score result (M4)."""

    storm_id: str
    score: int = Field(..., ge=1, le=5, description="Star rating 1-5")
    reasoning: str | None = None


class DamageTriageRequest(BaseModel):
    """Analyze roof photos for hail damage (M4)."""

    parcel_id: str
    photo_urls: list[str] = Field(..., description="S3 URLs of contractor photos")


class DamageTriageResponse(BaseModel):
    """Damage assessment result (M4)."""

    parcel_id: str
    hail_damage_probability: float = Field(..., ge=0, le=1)
    estimated_hail_size_in: float | None = None
    recommendations: list[str] = Field(default_factory=list)


class NaturalLanguageQueryRequest(BaseModel):
    """Natural language search (M5)."""

    query: str = Field(..., example="storms > 1.5in in Denton 2024")


class NaturalLanguageQueryResponse(BaseModel):
    """Query results (M5)."""

    query: str
    interpreted_as: str
    results: list[dict] = Field(default_factory=list)


class ClaimLetterRequest(BaseModel):
    """Draft insurance claim support letter (M5)."""

    parcel_id: str
    storm_id: str
    homeowner_name: str


class ClaimLetterResponse(BaseModel):
    """Draft letter (M5)."""

    parcel_id: str
    storm_id: str
    letter_text: str
    s3_key: str | None = None
