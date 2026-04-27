# Test Fixtures

This directory holds test data fixtures for the HailScout data pipeline.

## GRIB2 Fixtures

Real MRMS MESH GRIB2 files are large (~50MB) and should not be committed to git.

### Adding Real Fixtures

To test with real NOAA MRMS data:

1. **Download a recent MESH file:**
   ```bash
   # Example from NOAA MRMS bucket
   aws s3 cp s3://noaa-mrms-pds/MESH_Max_1440min_00.50_20240401-140000.grib2 ./local_fixtures/
   ```

2. **Place in `local_fixtures/` subdirectory** (git-ignored):
   ```
   tests/fixtures/local_fixtures/
   └── MESH_Max_1440min_00.50_20240401-140000.grib2
   ```

3. **Reference in tests:**
   ```python
   import pytest
   from pathlib import Path
   
   FIXTURE_DIR = Path(__file__).parent / "local_fixtures"
   
   @pytest.fixture
   def real_mesh_grib2():
       fixture_path = FIXTURE_DIR / "MESH_Max_1440min_00.50_20240401-140000.grib2"
       if not fixture_path.exists():
           pytest.skip("Real MRMS fixture not available")
       return str(fixture_path)
   ```

## GeoTIFF Fixtures

Once GRIB2 fixtures are available, generate GeoTIFFs:

```bash
poetry run python -m hailscout_pipeline.ingestion.grib_to_geotiff \
  tests/fixtures/local_fixtures/MESH_Max_1440min_00.50_20240401-140000.grib2 \
  --output tests/fixtures/local_fixtures/MESH_20240401_140000.tif
```

## Synthetic Fixtures

For MVP testing, create synthetic test data:

```python
from tests.fixtures.synthetic import create_synthetic_mesh_geotiff

# Generate a dummy GeoTIFF with known hail swaths
path = create_synthetic_mesh_geotiff(
    timestamp="2024-04-01T14:00:00Z",
    hail_pixels={
        (40.0, -100.0): 1.5,  # 1.5" hail at lat/lon
        (40.1, -100.1): 2.5,  # 2.5" hail
    }
)
```

(Synthetic fixture generator not yet implemented — add as needed.)

## Notes

- `.gitignore` excludes `local_fixtures/` to avoid committing large binary files
- Real MRMS data updates every 2 minutes
- For integration testing, use the smallest available files (usually < 100MB)
- Always verify fixture integrity: `gdalinfo <file.grib2>`
