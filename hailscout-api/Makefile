.PHONY: help install dev test lint mypy migrate docker-up docker-down docker-logs

help:
	@echo "HailScout API - Development Commands"
	@echo "===================================="
	@echo "make install       - Install dependencies with Poetry"
	@echo "make dev           - Run dev server (requires make docker-up)"
	@echo "make test          - Run pytest suite"
	@echo "make lint          - Run ruff linter"
	@echo "make mypy          - Run mypy type checker"
	@echo "make format        - Format code with black (via ruff)"
	@echo "make migrate       - Run Alembic migrations"
	@echo "make docker-up     - Start Docker Compose (Postgres + PostGIS)"
	@echo "make docker-down   - Stop Docker Compose"
	@echo "make docker-logs   - Tail Docker Compose logs"
	@echo "make clean         - Remove cache, __pycache__, etc."

install:
	poetry install

dev:
	poetry run uvicorn hailscout_api.main:app --reload --host 0.0.0.0 --port 8000

test:
	poetry run pytest tests/ -v --tb=short

test-cov:
	poetry run pytest tests/ -v --cov=hailscout_api --cov-report=html

lint:
	poetry run ruff check src/ tests/

format:
	poetry run ruff check --fix src/ tests/
	poetry run black src/ tests/

mypy:
	poetry run mypy src/

migrate:
	poetry run alembic upgrade head

migrate-undo:
	poetry run alembic downgrade -1

migrate-new:
	@read -p "Enter migration name: " name; \
	poetry run alembic revision --autogenerate -m "$$name"

docker-up:
	docker-compose up -d

docker-down:
	docker-compose down

docker-logs:
	docker-compose logs -f

clean:
	find . -type d -name __pycache__ -exec rm -r {} +
	find . -type f -name '*.pyc' -delete
	rm -rf .pytest_cache .mypy_cache .coverage htmlcov dist build *.egg-info

# CI/CD helpers
ci-test: lint mypy test
	@echo "All CI checks passed!"

.DEFAULT_GOAL := help
