"""Tests for color legend."""

import pytest

from hailscout_tiles.colors import (
    HAIL_CATEGORY_ORDER,
    HAIL_COLORS,
    VALID_HAIL_SIZES,
    get_category_order,
    get_color,
    get_maplibre_paint_expression,
)


class TestColorLegend:
    """Test hail color mappings."""

    def test_valid_hail_sizes(self) -> None:
        """Test that all valid sizes are defined."""
        expected_sizes = {"0.75", "1.0", "1.25", "1.5", "1.75", "2.0", "2.5", "3.0+"}
        assert VALID_HAIL_SIZES == expected_sizes

    def test_all_sizes_have_colors(self) -> None:
        """Test that all sizes map to hex colors."""
        for size in VALID_HAIL_SIZES:
            assert size in HAIL_COLORS
            assert HAIL_COLORS[size].startswith("#")
            assert len(HAIL_COLORS[size]) == 7  # #RRGGBB

    def test_all_sizes_have_category_order(self) -> None:
        """Test that all sizes have numeric ordering."""
        for size in VALID_HAIL_SIZES:
            assert size in HAIL_CATEGORY_ORDER
            assert isinstance(HAIL_CATEGORY_ORDER[size], (int, float))
            assert 0 <= HAIL_CATEGORY_ORDER[size] <= 7

    def test_get_color(self) -> None:
        """Test get_color function."""
        assert get_color("0.75") == "#2ca02c"  # Green
        assert get_color("1.0") == "#ffff00"  # Yellow
        assert get_color("3.0+") == "#000000"  # Black

    def test_get_color_invalid(self) -> None:
        """Test get_color raises on invalid input."""
        with pytest.raises(ValueError):
            get_color("0.5")
        with pytest.raises(ValueError):
            get_color("invalid")

    def test_get_category_order(self) -> None:
        """Test get_category_order function."""
        assert get_category_order("0.75") == 0.0
        assert get_category_order("1.0") == 1.0
        assert get_category_order("3.0+") == 7.0

    def test_get_category_order_invalid(self) -> None:
        """Test get_category_order raises on invalid input."""
        with pytest.raises(ValueError):
            get_category_order("0.5")

    def test_ordering_monotonic(self) -> None:
        """Test that category order is monotonically increasing."""
        sizes_sorted = sorted(VALID_HAIL_SIZES, key=lambda s: HAIL_CATEGORY_ORDER[s])
        orders = [HAIL_CATEGORY_ORDER[s] for s in sizes_sorted]
        assert orders == sorted(orders)

    def test_maplibre_paint_expression(self) -> None:
        """Test MapLibre paint expression generation."""
        expr = get_maplibre_paint_expression()

        # Should be a match expression
        assert expr[0] == "match"
        assert expr[1] == ["get", "hail_size"]

        # Should have all size/color pairs
        for size in VALID_HAIL_SIZES:
            assert size in expr
            assert HAIL_COLORS[size] in expr

        # Should have default fallback
        assert expr[-1] == "#cccccc"

    def test_color_severity_progression(self) -> None:
        """Test that colors progress from low to high severity."""
        # Green (0.75) < Yellow (1.0) < Orange (1.25/1.5) < Red (1.75/2.0) < Purple (2.5) < Black (3.0+)
        # Verify order is preserved
        order = [
            "0.75",
            "1.0",
            "1.25",
            "1.5",
            "1.75",
            "2.0",
            "2.5",
            "3.0+",
        ]
        for i, size in enumerate(order):
            assert HAIL_CATEGORY_ORDER[size] == float(i)
