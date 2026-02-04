# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Docker Development (Recommended)
```bash
make dev              # Start all services with hot-reload
make logs             # View all logs
make logs-backend     # View backend logs only
make logs-frontend    # View frontend logs only
make down             # Stop containers
make migrate          # Run database migrations
make migrate-status   # Check migration status
make migration        # Generate new migration (prompts for name)
make shell-backend    # Access backend container shell
make shell-frontend   # Access frontend container shell
make shell-db         # Access PostgreSQL shell (psql)
make clean            # Remove everything including volumes
make rebuild          # Rebuild without cache
make seed             # Seed realistic platform data
make seed-clean       # Seed with clearing existing data first
make seed-custom      # Seed with custom quantities (interactive)
```

### Service URLs (Development)
- Frontend: http://localhost:3000
- Backend API: http://localhost:8080
- API Docs: http://localhost:8080/docs
- MinIO Console: http://localhost:9001

### Manual Backend Setup (without Docker)
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # Edit with your credentials
alembic upgrade head
uvicorn app.main:app --reload
```

### Frontend Development
```bash
cd frontend
npm run dev    # Start dev server
npm run build  # Production build
npm run lint   # ESLint
```

## Architecture Overview

ProofMesh is a microservices-based platform for mathematical collaboration with AI assistance. The system is built around:

1. **Backend API** (`backend/`) - FastAPI service with PostgreSQL, Redis, and MinIO
2. **Frontend** (`frontend/`) - Next.js 16 with TypeScript and Tailwind CSS 4
3. **Mesh AI Module** (`mesh/`) - AI agents for mathematical reasoning (NOT part of backend API)
4. **Lean Runner** (`lean-runner/`) - Isolated Lean 4 code execution service
5. **LaTeX Compiler** (`latex-compiler/`) - TeXLive PDF compilation service

### Key Architectural Principle
**ADK (Agent Development Kit) is your runtime, NOT your backend.**

The `mesh/` module is a separate Python package containing AI agents that the backend imports via volume mount (`./mesh:/app/mesh:cached`). The backend calls into mesh agents, but mesh is not a REST API—it's a Python library used internally.

## Backend Structure

```
backend/
├── app/
│   ├── api/           # Route handlers (auth, problems, workspaces, canvas, etc.)
│   ├── models/        # SQLAlchemy ORM models
│   ├── schemas/       # Pydantic request/response schemas
│   ├── services/      # Business logic (auth, storage, queue)
│   ├── workers/       # Background job processors (canvas_ai_worker)
│   └── main.py        # FastAPI app entry point
├── alembic/           # Database migrations
└── scripts/           # Organized utility scripts
    ├── seed_realistic/      # Platform data seeding
    │   ├── run.py          # Orchestrator
    │   ├── seed_users.py
    │   ├── seed_teams.py
    │   ├── seed_problems.py
    │   ├── seed_workspaces.py
    │   ├── seed_library_items.py
    │   └── seed_social_activity.py
    ├── knowledge_graph/    # Knowledge graph tools
    │   ├── build_math_kg.py
    │   └── manage_math_kb.py
    ├── arxiv/             # ArXiv paper tools
    │   ├── import_arxiv_papers.py
    │   ├── cluster_math_papers.py
    │   └── extract_pattern_summaries.py
    └── entrypoint.sh
```

### Key Backend Concepts
- **Async/Await**: All database operations use SQLAlchemy 2.0 async
- **Queue System**: Redis-backed job queue for canvas AI operations
- **Storage**: MinIO (S3-compatible) for file storage
- **Authentication**: JWT tokens with bcrypt password hashing

### Main API Routers
- `/api/auth` - Authentication (login, register, token refresh)
- `/api/problems` - Mathematical problems CRUD
- `/api/workspaces` - Workspace file management
- `/api/library` - Knowledge items (lemmas, theorems, definitions)
- `/api/canvas-blocks` - Canvas block management
- `/api/canvas-ai` - Canvas AI operations (explore, formalize, critique)
- `/api/agents` - Agent orchestration endpoints
- `/api/social/*` - Social features (users, discussions, teams, trending)
- `/api/documents` - Document management
- `/ws` - WebSocket for real-time updates

## Frontend Structure

```
frontend/src/
├── app/              # Next.js App Router pages
├── components/       # React components
│   ├── canvas/       # Canvas visualization components
│   ├── editor/       # Milkdown/Monaco editors
│   └── ui/           # Reusable UI components
└── lib/              # API client, types, utilities
```

### Key Frontend Technologies
- **Editor**: Milkdown Crepe (markdown), Monaco Editor (code)
- **Math**: KaTeX for LaTeX rendering
- **Styling**: Tailwind CSS 4
- **Icons**: Lucide React
- **PDF**: PDF.js for document viewing

### Main Pages
- `/` - Home page
- `/problems` - Problem catalog
- `/problems/[id]` - Problem detail
- `/problems/[id]/lab` - Workspace (markdown editor)
- `/problems/[id]/canvas` - Visual proof canvas
- `/library` - Knowledge library
- `/social` - Social feed
- `/discussions` - Discussion forums
- `/teams` - Team collaboration

## Mesh AI Module

The mesh module contains AI agents and tools for mathematical reasoning:

```
mesh/backend/
├── agents/
│   ├── base.py          # Base Agent class with Gemini integration
│   ├── explorer.py      # Proposes mathematical results
│   ├── formalizer.py    # Converts to Lean 4 code
│   ├── critic.py        # Evaluates proposals
│   ├── latex_assistant.py  # LaTeX generation
│   └── canvas_agents.py # Canvas-specific agents
├── tools/
│   ├── lean_runner.py   # Lean 4 execution interface
│   ├── fact_store.py    # Knowledge persistence
│   ├── knowledge_graph.py  # Concept relationships
│   └── embeddings.py    # Vector embeddings
├── orchestrator.py      # Main state machine (NOT an agent)
└── adk_runtime.py       # Agent runtime
```

### Agent Usage Pattern
```python
from mesh.backend.orchestrator import Orchestrator

orch = Orchestrator()

# Explore mathematical concepts
proposals = await orch.explore(block_id)

# Formalize to Lean
lean_code = await orch.formalize(text)

# Verify with Lean
result = await orch.verify(lean_code)

# Critique proposal
critique = await orch.critique(proposal)
```

### Base Agent Features
- **Gemini Integration**: Uses `google-genai` client library
- **Streaming**: Supports streaming responses for real-time UI updates
- **Retry Logic**: Built-in retry with exponential backoff
- **Safety Settings**: Disabled for mathematical content
- **Loop Agent**: For iterative exploration tasks

## Core Data Models

- **User**: Authentication and profiles
- **Problem**: Mathematical problems with metadata (title, description, difficulty, tags)
- **LibraryItem**: Knowledge items (types: lemma, theorem, definition, claim, axiom)
- **WorkspaceFile**: File storage for workspaces
- **CanvasBlock**: Canvas blocks for visual proof exploration
- **Discussion/Comment**: Social features
- **Star/Follow**: Social graph
- **Team/TeamMember**: Collaboration groups

## Environment Variables

Key environment variables (see `.env.example`):

**Database & Infrastructure:**
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection for queues
- `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` - MinIO/S3 configuration

**Services:**
- `LATEX_COMPILER_URL` - LaTeX compiler service URL
- `LEAN_RUNNER_URL` - Lean runner service URL
- `LEAN_TIMEOUT` - Lean execution timeout (default: 60s)

**AI:**
- `GEMINI_API_KEY` - Google Gemini API key
- `GOOGLE_GENERATIVE_AI_API_KEY` - Alternative Gemini key

**Frontend:**
- `NEXT_PUBLIC_API_URL` - Backend API URL
- `NEXT_PUBLIC_WS_URL` - WebSocket URL

## Database Migrations

```bash
# Run migrations (also runs automatically on backend startup)
make migrate

# Create a new migration
make migration  # Prompts for migration name

# Check migration status
make migrate-status
```

## Testing

Currently, the project has minimal test coverage. The main test file is `mesh/test_agents.py` for agent testing.

## Common Patterns

### Adding a New API Endpoint
1. Create route handler in `backend/app/api/`
2. Add schemas in `backend/app/schemas/` if needed
3. Register router in `backend/app/main.py`
4. Add frontend API client methods in `frontend/src/lib/api.ts`

### Adding a New Agent
1. Create agent class in `mesh/backend/agents/` inheriting from `Agent`
2. Register in `mesh/backend/adk_runtime.py`
3. Use via `Orchestrator` or directly in backend API routes

### Canvas AI Operations
Canvas AI operations run asynchronously via Redis queue:
1. Backend accepts request and pushes job to queue
2. `canvas-ai-worker` processes jobs in background
3. Frontend polls for updates via WebSocket or HTTP

### Lean Code Execution
Lean 4 code execution is isolated in the `lean-runner` service:
- Access via `LEAN_RUNNER_URL` environment variable
- Uses separate container with elan toolchain
- Persistent `.lake` cache via Docker volume
