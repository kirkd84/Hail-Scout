"""Hail color legend — source of truth for all products."""

# Industry-standard hail size categories and their hex colors
# See COLOR_LEGEND.md for complete documentation
HAIL_COLORS: dict[str, str] = {
    "0.75": "#2ca02c",    # Green — minimal damage
    "1.0": "#ffff00",     # Yellow — light damage
    "1.25": "#ff7f0e",    # Orange — moderate damage (start)
    "1.5": "#ff7f0e",     # Orange — moderate damage (end)
    "1.75": "#d62728",    # Red — severe damage (start)
    "2.0": "#d62728",     # Red — severe damage (end)
    "2.5": "#9467bd",     # Purple — extreme damage
    "3.0+": "#000000",    # Black — catastrophic damage
}

# Numeric ordering for hail size (used in tile properties)
HAIL_CATEGORY_ORDER: dict[str, float] = {
    "0.75": 0.0,
    "1.0": 1.0,
    "1.25": 2.0,
    "1.5": 3.0,
    "1.75": 4.0,
    "2.0": 5.0,
    "2.5": 6.0,
    "3.0+": 7.0,
}

# All valid hail size categories
VALID_HAIL_SIZES = set(HAIL_COLORS.keys())


def get_color(hail_size: str) -> str:
    """Get hex color for a hail size category.

    Args:
        hail_size: One of the valid hail size categories

    Returns:
        Hex color string (e.g., "#d62728")

    Raises:
        ValueError: If hail_size is not a valid category
    """
    if hail_size not in HAIL_COLORS:
        raise ValueError(
            f"Invalid hail_size '{hail_size}'. "
            f"Must be one of {sorted(VALID_HAIL_SIZES)}"
        )
    return HAIL_COLORS[hail_size]


def get_category_order(hail_size: str) -> float:
    """Get numeric order for a hail size category (0.0 = smallest, 7.0 = largest).

    Args:
        hail_size: One of the valid hail size categories

    Returns:
        Float order value

    Raises:
        ValueError: If hail_size is not a valid category
    """
    if hail_size not in HAIL_CATEGORY_ORDER:
        raise ValueError(
            f"Invalid hail_size '{hail_size}'. "
            f"Must be one of {sorted(VALID_HAIL_SIZES)}"
        )
    return HAIL_CATEGORY_ORDER[hail_size]


def get_maplibre_paint_expression() -> list:
    """Generate a MapLibre paint expression for hail colors.

    Returns:
        A MapLibre match expression ready for layer paint config:
        [
          "match",
          ["get", "hail_size"],
          "0.75", "#2ca02c",
          "1.0", "#ffff00",
          ...
          "#cccccc"  # default fallback
        ]
    """
    expr = ["match", ["get", "hail_size"]]
    for size in sorted(VALID_HAIL_SIZES, key=lambda s: HAIL_CATEGORY_ORDER[s]):
        expr.append(size)
        expr.append(HAIL_COLORS[size])
    expr.append("#cccccc")  # Default color for unknown/missing values
    return expr
