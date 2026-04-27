"""Python wrapper for tippecanoe tile generation."""

import logging
import subprocess
from pathlib import Path

logger = logging.getLogger(__name__)


def run_tippecanoe(
    input_path: str,
    output_path: str,
    layer_name: str = "swaths",
    min_zoom: int = 4,
    max_zoom: int = 14,
) -> None:
    """Run tippecanoe to generate MVT tiles from GeoJSON.

    Args:
        input_path: Path to newline-delimited GeoJSON input
        output_path: Path to output .mbtiles file
        layer_name: Name of the layer in the tileset
        min_zoom: Minimum zoom level
        max_zoom: Maximum zoom level

    Tippecanoe command-line args:
    - --layer: Layer name
    - -Z / -z: Min/max zoom levels
    - --drop-densest-as-needed: Auto-simplify if features too dense
    - --coalesce-densest-as-needed: Merge similar features
    - --extend-zooms-if-still-dropping: Keep zooming out if still dropping features
    - --read-parallel: Parallel input reading (faster for large files)
    """
    logger.info(f"Running tippecanoe: {input_path} -> {output_path}")

    cmd = [
        "tippecanoe",
        "-o",
        output_path,
        f"--layer={layer_name}",
        f"-Z{min_zoom}",
        f"-z{max_zoom}",
        "--drop-densest-as-needed",
        "--coalesce-densest-as-needed",
        "--extend-zooms-if-still-dropping",
        "--read-parallel",
        input_path,
    ]

    logger.info(f"Executing: {' '.join(cmd)}")

    try:
        result = subprocess.run(
            cmd,
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        logger.info(f"Tippecanoe completed successfully")
        if result.stdout:
            logger.debug(f"stdout: {result.stdout}")
    except subprocess.CalledProcessError as e:
        logger.error(f"Tippecanoe failed with exit code {e.returncode}")
        logger.error(f"stderr: {e.stderr}")
        raise

    # Verify output file exists
    if not Path(output_path).exists():
        raise FileNotFoundError(f"Output file not created: {output_path}")

    size_mb = Path(output_path).stat().st_size / (1024 * 1024)
    logger.info(f"Generated {output_path} ({size_mb:.1f} MB)")
