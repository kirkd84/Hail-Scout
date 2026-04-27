"""Split .mbtiles into individual .pbf tile files."""

import gzip
import logging
import sqlite3
from pathlib import Path

logger = logging.getLogger(__name__)


def split_mbtiles_to_pbf(mbtiles_path: str, output_dir: str) -> None:
    """Split an .mbtiles file into individual gzipped .pbf files.

    Args:
        mbtiles_path: Path to .mbtiles (SQLite3 container)
        output_dir: Output directory to write tiles to

    Output structure:
        output_dir/
        ├── 4/
        │   └── 0/
        │       └── 0.pbf
        ├── 5/
        │   └── ...
        └── ...

    Each .pbf file is gzipped and ready for S3 upload with:
    - Content-Type: application/x-protobuf
    - Content-Encoding: gzip
    """
    logger.info(f"Splitting {mbtiles_path} to {output_dir}")

    output_dir_path = Path(output_dir)
    output_dir_path.mkdir(parents=True, exist_ok=True)

    # Open .mbtiles (SQLite3 database)
    conn = sqlite3.connect(mbtiles_path)
    cursor = conn.cursor()

    # Query tile data from mbtiles
    # Standard .mbtiles schema: tiles(zoom_level, tile_column, tile_row, tile_data)
    cursor.execute("SELECT zoom_level, tile_column, tile_row, tile_data FROM tiles")

    tile_count = 0
    for zoom_level, tile_column, tile_row, tile_data in cursor.fetchall():
        # Create zoom/column directory
        tile_dir = output_dir_path / str(zoom_level) / str(tile_column)
        tile_dir.mkdir(parents=True, exist_ok=True)

        # Write gzipped .pbf file
        pbf_path = tile_dir / f"{tile_row}.pbf"
        with gzip.open(pbf_path, "wb") as f:
            f.write(tile_data)

        tile_count += 1

    conn.close()

    logger.info(f"Wrote {tile_count} tiles to {output_dir}")


def create_gzipped_pbf(pbf_data: bytes) -> bytes:
    """Gzip raw .pbf tile data.

    Args:
        pbf_data: Raw protobuf tile data

    Returns:
        Gzipped bytes
    """
    import io

    buf = io.BytesIO()
    with gzip.GzipFile(fileobj=buf, mode="wb") as f:
        f.write(pbf_data)
    return buf.getvalue()
