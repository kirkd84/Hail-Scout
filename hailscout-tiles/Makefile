.PHONY: help install lint test type-check format gen-tiles upload clean

help:
	@echo "HailScout Tiles — Makefile targets"
	@echo "  make install        Install dependencies via Poetry"
	@echo "  make lint           Run ruff linter"
	@echo "  make format         Format code with ruff"
	@echo "  make type-check     Run mypy type checker"
	@echo "  make test           Run pytest"
	@echo "  make gen-tiles      Generate current tileset (requires DB + tippecanoe)"
	@echo "  make gen-historical Generate historical tileset"
	@echo "  make upload         Upload tiles to S3"
	@echo "  make invalidate     Invalidate CloudFront cache"
	@echo "  make clean          Remove build artifacts"

install:
	poetry install

lint:
	poetry run ruff check src tests

format:
	poetry run ruff format src tests

type-check:
	poetry run mypy src

test:
	poetry run pytest

gen-tiles:
	poetry run python -m hailscout_tiles.cli generate-current

gen-historical:
	poetry run python -m hailscout_tiles.cli generate-historical

upload:
	poetry run python -m hailscout_tiles.cli upload

invalidate:
	poetry run python -m hailscout_tiles.cli invalidate-cache

clean:
	find . -type f -name "*.pyc" -delete
	find . -type d -name "__pycache__" -delete
	find . -type d -name ".pytest_cache" -delete
	find . -type d -name ".mypy_cache" -delete
	find . -type d -name ".ruff_cache" -delete
	rm -rf build dist .eggs *.egg-info htmlcov .coverage
