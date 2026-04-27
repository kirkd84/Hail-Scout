.PHONY: install lint format test mypy clean help deploy docker-up docker-down

help:
	@echo "HailScout Data Pipeline - Makefile"
	@echo ""
	@echo "Available targets:"
	@echo "  install      Install dependencies via Poetry"
	@echo "  lint         Run ruff linter"
	@echo "  format       Format code with ruff"
	@echo "  test         Run pytest"
	@echo "  test-cov     Run pytest with coverage report"
	@echo "  mypy         Type-check with mypy"
	@echo "  check        Run all checks (lint, test, mypy)"
	@echo "  clean        Remove build/cache files"
	@echo "  docker-up    Start local Postgres + PostGIS"
	@echo "  docker-down  Stop local Postgres"
	@echo "  deploy       Deploy Lambda via SAM (guided)"
	@echo "  deploy-fast  Deploy Lambda via SAM (cached)"

install:
	poetry install

lint:
	poetry run ruff check src/ tests/

format:
	poetry run ruff format src/ tests/
	poetry run ruff check --fix src/ tests/

test:
	poetry run pytest tests/ -v

test-cov:
	poetry run pytest tests/ -v --cov=src/ --cov-report=html

mypy:
	poetry run mypy src/

check: lint test mypy
	@echo "✓ All checks passed!"

clean:
	find . -type d -name __pycache__ -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete
	rm -rf build/ dist/ *.egg-info .pytest_cache/ .coverage htmlcov/
	rm -rf .mypy_cache/

docker-up:
	docker-compose up -d postgres
	@echo "Waiting for Postgres to be ready..."
	@sleep 5
	poetry run alembic upgrade head

docker-down:
	docker-compose down

deploy:
	sam build
	sam deploy --guided

deploy-fast:
	sam build
	sam deploy

.PHONY: all
all: clean install check
