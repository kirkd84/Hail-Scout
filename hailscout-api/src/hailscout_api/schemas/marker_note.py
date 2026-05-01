"""Schemas for marker note thread."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class MarkerNoteCreate(BaseModel):
    body: str = Field(..., min_length=1, max_length=2000)


class MarkerNoteResponse(BaseModel):
    id: int
    marker_id: str
    user_id: str
    user_email: Optional[str] = None
    body: str
    created_at: datetime

    model_config = {"from_attributes": True}
