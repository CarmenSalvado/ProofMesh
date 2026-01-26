# ProofMesh

Human-controlled reasoning workspace for mathematics.

## Quick Start (Docker)

```bash
# Start everything
make dev

# View logs
make logs
```

**URLs:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:8080
- API Docs: http://localhost:8080/docs

## Development

The Docker setup uses **volume mounts** for hot-reload:
- Edit `backend/app/**` → Backend reloads automatically
- Edit `frontend/src/**` → Frontend reloads automatically

No need to rebuild containers for code changes!

### Useful Commands

```bash
make up          # Start containers
make down        # Stop containers
make logs        # View all logs
make migrate     # Run DB migrations
make shell-db    # Access PostgreSQL shell
make clean       # Remove everything (including data)
```

### Manual Setup (without Docker)

See [backend/README.md](backend/README.md) and run frontend with `npm run dev`.

## Architecture

```
ProofMesh/
├── backend/          # FastAPI + PostgreSQL
│   ├── app/
│   │   ├── api/      # Route handlers
│   │   ├── models/   # SQLAlchemy models
│   │   └── schemas/  # Pydantic schemas
│   └── alembic/      # DB migrations
├── frontend/         # Next.js + TypeScript
│   └── src/
│       ├── app/      # Pages (App Router)
│       ├── components/
│       └── lib/      # Types + API client
└── docker-compose.yml
```

## Core Concepts

- **Problem**: A mathematical problem to explore
- **Workspace (Lab)**: A markdown-first workspace powered by Milkdown Crepe
- **Library**: Accumulated knowledge (lemmas, claims, etc.)
- **Agent**: AI assistant that proposes results (integrated later)

See [CLAUDE.md](CLAUDE.md) for full specification.
