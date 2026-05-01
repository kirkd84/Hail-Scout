"""Audit service — write helpers + query helper."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from hailscout_api.db.models.audit import AuditEvent


async def write_event(
    session: AsyncSession,
    *,
    action: str,
    org_id: Optional[str] = None,
    user_id: Optional[str] = None,
    subject_type: Optional[str] = None,
    subject_id: Optional[str] = None,
    metadata: Optional[dict[str, Any]] = None,
    commit: bool = True,
) -> AuditEvent:
    evt = AuditEvent(
        ts=datetime.now(timezone.utc),
        org_id=org_id,
        user_id=user_id,
        action=action,
        subject_type=subject_type,
        subject_id=subject_id,
        metadata_json=json.dumps(metadata) if metadata else None,
    )
    session.add(evt)
    if commit:
        await session.commit()
        await session.refresh(evt)
    return evt
