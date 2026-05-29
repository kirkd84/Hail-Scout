"""Multi-source hail verification scoring.

Phase 24. This is the competitive core: HailStrike / HailRecon sell a
single-source MESH blob on a map. We fuse every independent signal we
have about a storm cell into a defensibility tier + a plain-English
statement a roofer can hand to an insurance adjuster.

Signals, in descending evidentiary weight:

  1. Ground-truth report  — an SPC Local Storm Report (a human who saw
     hail and called it in) fell inside this cell within ±30 min.
     `lsr_confirmed`, `lsr_observed_size_in`, `lsr_observed_at`.
  2. Dual-pol confirmation — the radar's polarimetric variables
     (ZDR + RhoHV) at the cell's high-reflectivity gates match the
     hail signature, not rain. `hail_confirmed`, `hail_gate_fraction`.
  3. Cross-source agreement — both MRMS (national mosaic) and NEXRAD
     (single-site Level II) independently detected hail at this point
     in the same window. Computed across the result set, not per-row.
  4. Radar reflectivity   — peak composite dBZ; >60 dBZ is a strong
     hail indicator on its own.
  5. Screener confidence  — the false-positive screener's 0..1 score.

The output `tier` is the single best label; `signals` is the full
itemized breakdown the report renders as a checklist.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Optional


# Tiers, strongest first. The numeric rank lets callers sort / compare.
TIER_GROUND_TRUTH = "ground_truth_confirmed"
TIER_DUAL_POL = "dual_pol_confirmed"
TIER_MULTI_SOURCE = "multi_source"
TIER_RADAR_INDICATED = "radar_indicated"
TIER_UNVERIFIED = "unverified"

_TIER_RANK = {
    TIER_GROUND_TRUTH: 5,
    TIER_DUAL_POL: 4,
    TIER_MULTI_SOURCE: 3,
    TIER_RADAR_INDICATED: 2,
    TIER_UNVERIFIED: 1,
}

_TIER_LABEL = {
    TIER_GROUND_TRUTH: "Ground-truth confirmed",
    TIER_DUAL_POL: "Dual-polarization confirmed",
    TIER_MULTI_SOURCE: "Multi-source confirmed",
    TIER_RADAR_INDICATED: "Radar-indicated",
    TIER_UNVERIFIED: "Unverified",
}

# A strong single-radar hail signal even absent dual-pol / LSR.
STRONG_DBZ = 60.0


@dataclass
class Signal:
    """One itemized piece of evidence for the report checklist."""
    key: str
    label: str
    present: bool
    detail: str = ""

    def as_dict(self) -> dict[str, Any]:
        return {
            "key": self.key,
            "label": self.label,
            "present": self.present,
            "detail": self.detail,
        }


@dataclass
class Verification:
    tier: str
    tier_label: str
    tier_rank: int
    confidence: float
    headline: str          # one-line badge text
    defensibility: str     # the adjuster-facing paragraph
    signals: list[Signal] = field(default_factory=list)

    def as_dict(self) -> dict[str, Any]:
        return {
            "tier": self.tier,
            "tier_label": self.tier_label,
            "tier_rank": self.tier_rank,
            "confidence": round(self.confidence, 3),
            "headline": self.headline,
            "defensibility": self.defensibility,
            "signals": [s.as_dict() for s in self.signals],
        }


def _fmt_size(inches: Optional[float]) -> str:
    if inches is None:
        return "unknown size"
    return f"{inches:.2f}″"


def score_storm(
    storm: dict[str, Any],
    *,
    cross_source: bool = False,
    cross_source_detail: str = "",
) -> Verification:
    """Compute the verification for one storm dict.

    `storm` is the dict shape returned by storm_query (must include
    source, max_hail_size_in, confidence, suspect, lsr_confirmed,
    lsr_observed_size_in, lsr_observed_at, hail_confirmed,
    hail_gate_fraction, peak_dbz — missing keys default safely).

    `cross_source` is supplied by the caller when it has seen the same
    point hit by a different-source storm in the same window (computed
    across the result set in `attach_verification`).
    """
    size = storm.get("max_hail_size_in")
    confidence = float(storm.get("confidence", 1.0) or 1.0)
    suspect = bool(storm.get("suspect", False))
    lsr_confirmed = bool(storm.get("lsr_confirmed", False))
    lsr_size = storm.get("lsr_observed_size_in")
    lsr_at = storm.get("lsr_observed_at")
    hail_confirmed = bool(storm.get("hail_confirmed", False))
    gate_frac = storm.get("hail_gate_fraction")
    peak_dbz = storm.get("peak_dbz")
    source = storm.get("source", "")

    # Build the itemized signal checklist (order = report display order).
    signals: list[Signal] = []

    # 1. Ground truth
    if lsr_confirmed:
        when = ""
        if lsr_at is not None:
            try:
                when = f" on {lsr_at.strftime('%b %d %Y at %H:%M UTC')}"
            except Exception:
                when = ""
        detail = (
            f"NWS storm spotter reported {_fmt_size(lsr_size)} hail nearby{when}"
            if lsr_size else f"NWS storm spotter reported hail nearby{when}"
        )
    else:
        detail = "No ground report matched within ±30 min"
    signals.append(Signal("ground_truth", "Ground-truth storm report",
                          lsr_confirmed, detail))

    # 2. Dual-pol
    if hail_confirmed:
        pct = f" ({gate_frac * 100:.0f}% of core gates)" if gate_frac else ""
        detail = f"Polarimetric ZDR/RhoHV hail signature present{pct}"
    elif source.upper().startswith("NEXRAD"):
        detail = "Dual-pol signature not met (reflective-rain caution)"
    else:
        detail = "No dual-pol data (source is not Level II radar)"
    signals.append(Signal("dual_pol", "Dual-polarization hail signature",
                          hail_confirmed, detail))

    # 3. Cross-source
    signals.append(Signal(
        "cross_source", "Independent source agreement", cross_source,
        cross_source_detail or (
            "Confirmed by a second independent source"
            if cross_source else "Single-source detection"
        ),
    ))

    # 4. Reflectivity
    strong_dbz = peak_dbz is not None and peak_dbz >= STRONG_DBZ
    if peak_dbz is not None:
        detail = (
            f"Peak reflectivity {peak_dbz:.0f} dBZ"
            + (" — strong hail indicator" if strong_dbz else "")
        )
    else:
        detail = "No reflectivity recorded"
    signals.append(Signal("reflectivity", "Radar reflectivity", strong_dbz, detail))

    # 5. Screener
    signals.append(Signal(
        "screened", "Passed false-positive screening", not suspect,
        f"Confidence {confidence:.0%}"
        + ("" if not suspect else " — flagged as likely false positive"),
    ))

    # ── Decide the tier (best evidence wins) ──
    if suspect:
        tier = TIER_UNVERIFIED
    elif lsr_confirmed:
        tier = TIER_GROUND_TRUTH
    elif hail_confirmed:
        tier = TIER_DUAL_POL
    elif cross_source:
        tier = TIER_MULTI_SOURCE
    else:
        tier = TIER_RADAR_INDICATED

    headline, defensibility = _narrate(
        tier, size, lsr_size, peak_dbz, gate_frac, confidence,
    )

    return Verification(
        tier=tier,
        tier_label=_TIER_LABEL[tier],
        tier_rank=_TIER_RANK[tier],
        confidence=confidence,
        headline=headline,
        defensibility=defensibility,
        signals=signals,
    )


def _narrate(
    tier: str,
    size: Optional[float],
    lsr_size: Optional[float],
    peak_dbz: Optional[float],
    gate_frac: Optional[float],
    confidence: float,
) -> tuple[str, str]:
    """Produce the badge headline + the adjuster-facing paragraph.

    Voice: factual, methodology-forward, no hype. This is meant to be
    read by a skeptical insurance adjuster, so it states what was
    measured and how — not "DAMAGE LIKELY!!!"
    """
    sz = _fmt_size(size)

    if tier == TIER_GROUND_TRUTH:
        head = f"Ground-truth confirmed · {sz}"
        body = (
            f"Radar detected hail of approximately {sz} at this location, and "
            f"an independent National Weather Service storm report "
            + (f"recorded {_fmt_size(lsr_size)} hail " if lsr_size else "recorded hail ")
            + "in the immediate area within 30 minutes of the radar pass. "
            "Ground-truth corroboration is the strongest class of evidence "
            "for a hail-damage claim."
        )
        return head, body

    if tier == TIER_DUAL_POL:
        pct = f"{gate_frac * 100:.0f}% of " if gate_frac else ""
        head = f"Dual-pol confirmed · {sz}"
        body = (
            f"Dual-polarization radar confirmed a hail signature at this "
            f"location ({pct}storm-core gates showed the polarimetric "
            "ZDR/RhoHV pattern that distinguishes hail from heavy rain), "
            f"with an estimated maximum diameter of {sz}. This is direct "
            "physical evidence of hail aloft, not a reflectivity proxy alone."
        )
        return head, body

    if tier == TIER_MULTI_SOURCE:
        head = f"Multi-source confirmed · {sz}"
        body = (
            f"Two independent radar products (the national MRMS mosaic and "
            f"single-site NEXRAD Level II) both detected hail of about {sz} "
            "at this location in the same time window. Agreement between "
            "independent sources materially raises confidence over any "
            "single product."
        )
        return head, body

    if tier == TIER_RADAR_INDICATED:
        dbz = f" (peak {peak_dbz:.0f} dBZ)" if peak_dbz is not None else ""
        head = f"Radar-indicated · {sz}"
        body = (
            f"Radar indicated hail of approximately {sz} at this location"
            f"{dbz}. This is a single-source estimate without independent "
            "ground or dual-pol confirmation; treat as a screening indicator "
            "and pair with an on-site inspection."
        )
        return head, body

    # Unverified
    head = "Unverified · screening only"
    body = (
        "This detection did not pass our false-positive screening "
        f"(confidence {confidence:.0%}) and may be radar noise, biological "
        "scatter, or ground clutter rather than hail. It is excluded from "
        "claims and alerts by default."
    )
    return head, body


def attach_verification(storms: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Compute cross-source agreement across a result set, then attach a
    `verification` dict to each storm.

    Cross-source = the same point was hit by both an MRMS-family and a
    NEXRAD storm within a 6-hour window of each other. We pair them and
    mark both as cross-source confirmed.
    """
    def family(src: str) -> str:
        s = (src or "").upper()
        if s.startswith("NEXRAD"):
            return "NEXRAD"
        if s.startswith("MRMS") or s == "MESH":
            return "MRMS"
        return s  # SPC-LSR or other

    for storm in storms:
        fam = family(storm.get("source", ""))
        st = storm.get("start_time")
        cross = False
        detail = ""
        if fam in ("NEXRAD", "MRMS") and st is not None:
            for other in storms:
                if other is storm:
                    continue
                ofam = family(other.get("source", ""))
                ost = other.get("start_time")
                if ofam in ("NEXRAD", "MRMS") and ofam != fam and ost is not None:
                    try:
                        gap = abs((st - ost).total_seconds())
                    except Exception:
                        continue
                    if gap <= 6 * 3600:
                        cross = True
                        detail = f"Detected by both {fam} and {ofam}"
                        break
        storm["verification"] = score_storm(
            storm, cross_source=cross, cross_source_detail=detail,
        ).as_dict()
    return storms
