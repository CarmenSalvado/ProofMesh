.PHONY: dev up down logs migrate shell-backend shell-frontend clean

# Start all services in development mode (migrations run automatically via entrypoint)
dev: up
	@echo "ProofMesh is running!"
	@echo "  Frontend: http://localhost:3000"
	@echo "  Backend:  http://localhost:8080"
	@echo "  API Docs: http://localhost:8080/docs"
	@echo ""
	@echo "Migrations run automatically on backend startup."
	@echo "Check logs with: make logs-backend"

# Start containers
up:
	docker compose up -d

# Stop containers
down:
	docker compose down

# View logs
logs:
	docker compose logs -f

logs-backend:
	docker compose logs -f backend

logs-frontend:
	docker compose logs -f frontend

# Run database migrations (also runs automatically on backend start)
migrate:
	docker compose exec backend alembic upgrade head

# Check migration status
migrate-status:
	docker compose exec backend alembic current
	docker compose exec backend alembic heads

# Generate new migration
migration:
	@read -p "Migration name: " name; \
	docker compose exec backend alembic revision --autogenerate -m "$$name"

# Shell access
shell-backend:
	docker compose exec backend bash

shell-frontend:
	docker compose exec frontend sh

shell-db:
	docker compose exec postgres psql -U proofmesh -d proofmesh

# Clean everything (including volumes)
clean:
	docker compose down -v --rmi local
	@echo "Cleaned up containers, volumes, and images"

# Rebuild without cache
rebuild:
	docker compose build --no-cache
	docker compose up -d

# Seed realistic platform data
seed:
	docker compose exec backend python -m scripts.seed_realistic.run

# Seed with clearing existing data
seed-clean:
	docker compose exec backend python -m scripts.seed_realistic.run --clear

# Seed with custom quantities
seed-custom:
	@read -p "Number of users (default 80): " users; \
	read -p "Number of teams (default 25): " teams; \
	read -p "Number of problems (default 120): " problems; \
	docker compose exec backend python -m scripts.seed_realistic.run \
		--users $${users:-80} --teams $${teams:-25} --problems $${problems:-120}
