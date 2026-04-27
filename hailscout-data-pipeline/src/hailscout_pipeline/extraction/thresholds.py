"""
Hail size category definitions.

Defines the 8 standard hail-size bins used across MRMS, IHM, HailTrace.
Categories are in inches (matching US roofer expectations).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Sequence


@dataclass(frozen=True)
class HailCategory:
    """Single hail size category."""

    label: str  # e.g., '0.75', '1.0', '3.0+'
    min_inches: float  # Inclusive lower bound
    max_inches: float | None  # Exclusive upper bound (None = unbounded)
    color_hex: str  # Industry-standard color for tiles

    def contains(self, inches: float) -> bool:
        """Check if value falls in this category."""
        if inches < self.min_inches:
            return False
        if self.max_inches is not None and inches >= self.max_inches:
            return False
        return True


# Standard 8-category hail size bins (matching IHM/HailTrace)
HAIL_CATEGORIES: Sequence[HailCategory] = (
    HailCategory(
        label="0.75",
        min_inches=0.75,
        max_inches=1.0,
        color_hex="#90EE90",  # Light green
    ),
    HailCategory(
        label="1.0",
        min_inches=1.0,
        max_inches=1.25,
        color_hex="#FFFF00",  # Yellow
    ),
    HailCategory(
        label="1.25",
        min_inches=1.25,
        max_inches=1.5,
        color_hex="#FFA500",  # Orange
    ),
    HailCategory(
        label="1.5",
        min_inches=1.5,
        max_inches=1.75,
        color_hex="#FF8C00",  # Dark orange
    ),
    HailCategory(
        label="1.75",
        min_inches=1.75,
        max_inches=2.0,
        color_hex="#FF6347",  # Tomato
    ),
    HailCategory(
        label="2.0",
        min_inches=2.0,
        max_inches=2.5,
        color_hex="#DC143C",  # Crimson
    ),
    HailCategory(
        label="2.5",
        min_inches=2.5,
        max_inches=3.0,
        color_hex="#8B008B",  # Dark magenta
    ),
    HailCategory(
        label="3.0+",
        min_inches=3.0,
        max_inches=None,
        color_hex="#000000",  # Black
    ),
)

# Lookup by label for convenience
CATEGORY_BY_LABEL: dict[str, HailCategory] = {cat.label: cat for cat in HAIL_CATEGORIES}


def get_category(inches: float) -> HailCategory | None:
    """
    Find hail category for a given size in inches.

    Args:
        inches: Hail size in inches

    Returns:
        HailCategory if found, None if below 0.75"
    """
    for category in HAIL_CATEGORIES:
        if category.contains(inches):
            return category
    return None
