.PHONY: dev up down logs migrate shell-backend shell-frontend clean

# Start all services in development mode
dev: up migrate
	@echo "ProofMesh is running!"
	@echo "  Frontend: http://localhost:3000"
	@echo "  Backend:  http://localhost:8080"
	@echo "  API Docs: http://localhost:8080/docs"

# Start containers
up:
	docker compose up -d --build

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

# Run database migrations
migrate:
	docker compose exec backend alembic upgrade head

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
