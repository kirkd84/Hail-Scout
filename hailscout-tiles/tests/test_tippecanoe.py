"""Tests for tippecanoe wrapper."""

import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from hailscout_tiles.pipeline.tippecanoe import run_tippecanoe


def test_run_tippecanoe_command_construction() -> None:
    """Test that run_tippecanoe constructs correct command."""
    with patch("hailscout_tiles.pipeline.tippecanoe.subprocess.run") as mock_run:
        # Mock successful execution
        mock_run.return_value = MagicMock(returncode=0, stdout="", stderr="")

        with tempfile.TemporaryDirectory() as tmpdir:
            input_path = f"{tmpdir}/input.geojson"
            output_path = f"{tmpdir}/output.mbtiles"

            # Create dummy input file
            Path(input_path).touch()

            # Create dummy output file (normally created by tippecanoe)
            Path(output_path).touch()

            run_tippecanoe(
                input_path=input_path,
                output_path=output_path,
                layer_name="swaths",
                min_zoom=4,
                max_zoom=14,
            )

            # Verify command was constructed correctly
            mock_run.assert_called_once()
            args = mock_run.call_args[0][0]

            assert "tippecanoe" in args[0]
            assert "-o" in args
            assert output_path in args
            assert "--layer=swaths" in args
            assert "-Z4" in args
            assert "-z14" in args
            assert "--drop-densest-as-needed" in args
            assert "--coalesce-densest-as-needed" in args
            assert "--extend-zooms-if-still-dropping" in args
            assert "--read-parallel" in args
            assert input_path in args


def test_run_tippecanoe_missing_output() -> None:
    """Test that run_tippecanoe raises if output file is not created."""
    with patch("hailscout_tiles.pipeline.tippecanoe.subprocess.run") as mock_run:
        mock_run.return_value = MagicMock(returncode=0, stdout="", stderr="")

        with tempfile.TemporaryDirectory() as tmpdir:
            input_path = f"{tmpdir}/input.geojson"
            output_path = f"{tmpdir}/output.mbtiles"

            Path(input_path).touch()
            # Don't create output file — this will trigger the error

            with pytest.raises(FileNotFoundError):
                run_tippecanoe(input_path, output_path)


def test_run_tippecanoe_subprocess_error() -> None:
    """Test that run_tippecanoe raises on subprocess failure."""
    with patch("hailscout_tiles.pipeline.tippecanoe.subprocess.run") as mock_run:
        import subprocess

        mock_run.side_effect = subprocess.CalledProcessError(
            returncode=1, cmd="tippecanoe", stderr="Test error"
        )

        with tempfile.TemporaryDirectory() as tmpdir:
            input_path = f"{tmpdir}/input.geojson"
            output_path = f"{tmpdir}/output.mbtiles"

            Path(input_path).touch()

            with pytest.raises(subprocess.CalledProcessError):
                run_tippecanoe(input_path, output_path)
