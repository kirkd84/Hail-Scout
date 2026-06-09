"""Personal access tokens — generate, list, revoke.

Managed with a real login (the session access token), never with a PAT — so a
leaked read token can't mint more tokens. The plaintext is returned exactly
once, on creation.
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from hailscout_api.auth import api_token as pat
from hailscout_api.auth.middleware import extract_auth_context
from hailscout_api.core import get_logger
from hailscout_api.db.models.org import ApiToken
from hailscout_api.db.session import get_db_session

logger = get_logger(__name__)
router = APIRouter(prefix="/tokens", tags=["tokens"])


class CreateTokenRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class TokenOut(BaseModel):
    id: str
    name: str
    prefix: str
    scope: str
    last_used_at: datetime | None
    created_at: datetime
    revoked: bool


class TokenCreatedOut(TokenOut):
    # Plaintext token — shown ONCE.
    token: str


@router.get("", response_model=list[TokenOut])
async def list_tokens(
    request: Request,
    session: AsyncSession = Depends(get_db_session),
) -> list[TokenOut]:
    ctx = await extract_auth_context(request)
    rows = (
        await session.execute(
            select(ApiToken)
            .where(ApiToken.user_id == ctx.user_id)
            .order_by(ApiToken.created_at.desc())
        )
    ).scalars().all()
    return [
        TokenOut(
            id=r.id,
            name=r.name,
            prefix=r.prefix,
            scope=r.scope,
            last_used_at=r.last_used_at,
            created_at=r.created_at,
            revoked=r.revoked_at is not None,
        )
        for r in rows
    ]


@router.post("", response_model=TokenCreatedOut, status_code=status.HTTP_201_CREATED)
async def create_token(
    body: CreateTokenRequest,
    request: Request,
    session: AsyncSession = Depends(get_db_session),
) -> TokenCreatedOut:
    ctx = await extract_auth_context(request)
    full, token_hash, prefix = pat.generate()
    row = ApiToken(
        id=pat.new_token_id(),
        org_id=ctx.org_id,
        user_id=ctx.user_id,
        name=body.name.strip(),
        token_hash=token_hash,
        prefix=prefix,
        scope="read",
    )
    session.add(row)
    await session.commit()
    await session.refresh(row)
    logger.info("token.created", user_id=ctx.user_id, token_id=row.id)
    return TokenCreatedOut(
        id=row.id,
        name=row.name,
        prefix=row.prefix,
        scope=row.scope,
        last_used_at=None,
        created_at=row.created_at,
        revoked=False,
        token=full,
    )


@router.delete("/{token_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_token(
    token_id: str,
    request: Request,
    session: AsyncSession = Depends(get_db_session),
) -> Response:
    ctx = await extract_auth_context(request)
    row = (
        await session.execute(
            select(ApiToken).where(
                ApiToken.id == token_id, ApiToken.user_id == ctx.user_id
            )
        )
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Token not found")
    if row.revoked_at is None:
        row.revoked_at = datetime.now(timezone.utc)
        await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
