"""
Tests for hail size category thresholds.

Validates bin assignment and edge cases.
"""

from __future__ import annotations

import pytest

from hailscout_pipeline.extraction.thresholds import CATEGORY_BY_LABEL, HAIL_CATEGORIES, get_category


class TestHailCategories:
    """Test hail size category definitions."""

    def test_all_categories_exist(self) -> None:
        """Verify all 8 standard categories are defined."""
        assert len(HAIL_CATEGORIES) == 8
        assert len(CATEGORY_BY_LABEL) == 8

    def test_category_labels(self) -> None:
        """Verify category labels."""
        expected_labels = ["0.75", "1.0", "1.25", "1.5", "1.75", "2.0", "2.5", "3.0+"]
        actual_labels = [cat.label for cat in HAIL_CATEGORIES]
        assert actual_labels == expected_labels

    def test_category_by_label_lookup(self) -> None:
        """Test label-based category lookup."""
        cat = CATEGORY_BY_LABEL["1.5"]
        assert cat.label == "1.5"
        assert cat.min_inches == 1.5
        assert cat.max_inches == 1.75

    def test_get_category_below_minimum(self) -> None:
        """Test that sizes below 0.75" return None."""
        assert get_category(0.5) is None
        assert get_category(0.0) is None

    def test_get_category_exact_lower_bound(self) -> None:
        """Test exact lower bound assignment."""
        cat = get_category(0.75)
        assert cat is not None
        assert cat.label == "0.75"

    def test_get_category_exact_upper_bound_exclusive(self) -> None:
        """Test that upper bound is exclusive."""
        cat = get_category(1.0)
        assert cat is not None
        assert cat.label == "1.0"  # 1.0 belongs to 1.0-1.25 category

    def test_get_category_middle_value(self) -> None:
        """Test value in middle of bin."""
        cat = get_category(1.125)
        assert cat is not None
        assert cat.label == "1.0"

    def test_get_category_large_hail(self) -> None:
        """Test 3.0+ unbounded category."""
        cat = get_category(3.0)
        assert cat is not None
        assert cat.label == "3.0+"

        cat = get_category(5.0)
        assert cat is not None
        assert cat.label == "3.0+"

    def test_get_category_all_ranges_cover_spectrum(self) -> None:
        """Test that categories cover continuous range without gaps."""
        test_values = [0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0, 5.0]
        for val in test_values:
            cat = get_category(val)
            assert cat is not None, f"No category found for {val}"

    def test_category_colors_are_valid_hex(self) -> None:
        """Test that all colors are valid hex codes."""
        for cat in HAIL_CATEGORIES:
            # Should be #RRGGBB format
            assert cat.color_hex.startswith("#")
            assert len(cat.color_hex) == 7
            assert all(c in "0123456789ABCDEFabcdef" for c in cat.color_hex[1:])

    def test_category_contains_method(self) -> None:
        """Test contains() method on category objects."""
        cat = CATEGORY_BY_LABEL["1.5"]
        assert cat.contains(1.5)
        assert cat.contains(1.75 - 0.01)
        assert not cat.contains(1.49)
        assert not cat.contains(1.75)
