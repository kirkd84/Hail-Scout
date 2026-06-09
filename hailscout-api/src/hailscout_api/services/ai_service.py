"""AI features via Anthropic (vision + text).

Lazy-imports the SDK and is gated on ``ANTHROPIC_API_KEY`` — a missing dep or
unset key is a clean 503 at the route, never a boot failure.
"""

from __future__ import annotations

import json
import re
from typing import Any

from hailscout_api.config import get_settings
from hailscout_api.core import get_logger

logger = get_logger(__name__)


class AINotConfigured(Exception):
    """ANTHROPIC_API_KEY unset or the SDK isn't installed."""


class AIError(Exception):
    """The model call failed or returned something unusable."""


def ai_configured() -> bool:
    if not get_settings().anthropic_api_key.strip():
        return False
    try:
        import anthropic  # noqa: F401
    except Exception:
        logger.warning("ai.sdk_not_installed")
        return False
    return True


def _client():
    import anthropic

    return anthropic.AsyncAnthropic(api_key=get_settings().anthropic_api_key.strip())


def _text_of(msg: Any) -> str:
    return "".join(
        getattr(b, "text", "") for b in msg.content if getattr(b, "type", None) == "text"
    )


def _extract_json(text: str) -> dict[str, Any]:
    m = re.search(r"\{.*\}", text, re.DOTALL)
    if not m:
        raise AIError("Model did not return JSON")
    try:
        return json.loads(m.group(0))
    except json.JSONDecodeError as exc:
        raise AIError("Model returned malformed JSON") from exc


_TRIAGE_PROMPT = """You are a senior roofing-insurance inspector analyzing a single
photo for HAIL damage specifically. Distinguish genuine hail impact (random
circular bruising, granule loss exposing the mat, soft spots, spatter marks)
from look-alikes you must NOT call hail: foot traffic, blistering, mechanical
damage, manufacturing defects, normal granule wear, or moss/algae.

Respond with ONLY a JSON object, no prose, in exactly this shape:
{
  "hail_damage_probability": <float 0..1>,
  "severity": "Low" | "Moderate" | "Severe" | "Total Loss",
  "confidence": <float 0..1>,
  "estimated_hail_size_in": <float or null>,
  "findings": [<short evidence strings>],
  "summary": "<2-3 sentence plain-English assessment>",
  "recommended_action": "<one sentence>"
}
Be conservative — if the photo is unclear or the damage is ambiguous, lower the
probability and confidence and say so in the summary."""


async def triage_damage(
    image_base64: str, media_type: str, context: str | None = None
) -> dict[str, Any]:
    if not ai_configured():
        raise AINotConfigured("AI is not configured")
    settings = get_settings()
    prompt = _TRIAGE_PROMPT + (f"\n\nInspector context: {context}" if context else "")
    try:
        msg = await _client().messages.create(
            model=settings.anthropic_model,
            max_tokens=1024,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": media_type,
                                "data": image_base64,
                            },
                        },
                        {"type": "text", "text": prompt},
                    ],
                }
            ],
        )
        return _extract_json(_text_of(msg))
    except (AINotConfigured, AIError):
        raise
    except Exception as exc:  # noqa: BLE001
        logger.error("ai.triage_failed", error=str(exc))
        raise AIError("Damage analysis failed") from exc


async def complete_text(prompt: str, *, max_tokens: int = 1500) -> str:
    """Single-turn text completion (claim letters, NL query parsing)."""
    if not ai_configured():
        raise AINotConfigured("AI is not configured")
    settings = get_settings()
    try:
        msg = await _client().messages.create(
            model=settings.anthropic_model,
            max_tokens=max_tokens,
            messages=[{"role": "user", "content": prompt}],
        )
        return _text_of(msg).strip()
    except (AINotConfigured, AIError):
        raise
    except Exception as exc:  # noqa: BLE001
        logger.error("ai.text_failed", error=str(exc))
        raise AIError("AI request failed") from exc
