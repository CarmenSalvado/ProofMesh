# AGENTS.md - ProofMesh Development Guide

This document contains essential information for AI coding agents working on the ProofMesh project.

---

## Project Overview

**ProofMesh** is a human-controlled reasoning workspace for mathematics. It provides a collaborative environment where users can explore mathematical problems, formalize proofs using Lean 4, and leverage AI agents for exploration and verification.

### Core Concepts

- **Problem**: A mathematical problem to explore, with metadata (title, description, difficulty, tags, visibility)
- **Workspace (Lab)**: A markdown-first workspace powered by Milkdown Crepe editor
- **Library**: Accumulated knowledge (lemmas, claims, theorems, definitions, etc.)
- **Canvas**: Visual proof exploration interface
- **Agent**: AI assistant that proposes mathematical results

---

## Technology Stack

### Backend
- **Framework**: FastAPI (Python 3.12)
- **Database**: PostgreSQL 16 with SQLAlchemy 2.0 (async)
- **Migrations**: Alembic
- **Cache/Queue**: Redis 7
- **Storage**: MinIO (S3-compatible)
- **Authentication**: JWT with bcrypt password hashing
- **AI Integration**: Google Gemini API (via `google-genai`)

### Frontend
- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 4
- **UI Components**: Custom components + Lucide icons
- **Editor**: Milkdown Crepe (markdown), Monaco Editor (code)
- **Math Rendering**: KaTeX

### Specialized Services
- **Lean Runner**: Isolated Python service for Lean 4 code execution
- **LaTeX Compiler**: TeXLive-based service for PDF compilation

### Infrastructure
- **Containerization**: Docker & Docker Compose
- **Development**: Hot-reload via volume mounts

---

## Project Structure

```
ProofMesh/
├── backend/              # FastAPI backend
│   ├── app/
│   │   ├── api/          # REST API route handlers
│   │   ├── models/       # SQLAlchemy ORM models
│   │   ├── schemas/      # Pydantic request/response schemas
│   │   ├── services/     # Business logic (auth, storage, etc.)
│   │   ├── agents/       # AI agent implementations
│   │   ├── config.py     # Settings (pydantic-settings)
│   │   ├── database.py   # DB connection & session management
│   │   └── main.py       # FastAPI app entry point
│   ├── alembic/          # Database migrations
│   ├── scripts/          # Entrypoint & seed scripts
│   ├── requirements.txt
│   ├── Dockerfile.dev
│   └── README.md
├── frontend/             # Next.js frontend
│   ├── src/
│   │   ├── app/          # App Router pages (route.tsx, page.tsx, layout.tsx)
│   │   ├── components/   # React components
│   │   │   ├── agents/   # Agent-related UI
│   │   │   ├── canvas/   # Proof canvas components
│   │   │   ├── editor/   # Editor components
│   │   │   ├── layout/   # Layout components
│   │   │   ├── library/  # Library item components
│   │   │   ├── social/   # Social features UI
│   │   │   └── ui/       # Generic UI components
│   │   ├── hooks/        # Custom React hooks
│   │   └── lib/          # Utilities & API client
│   │       ├── api.ts    # Backend API client
│   │       ├── types.ts  # TypeScript type definitions
│   │       └── auth.tsx  # Auth context & provider
│   ├── package.json
│   ├── tsconfig.json
│   ├── next.config.ts
│   └── Dockerfile.dev
├── mesh/                 # AI Agent Architecture (separate Python module)
│   ├── backend/
│   │   ├── agents/       # Explorer, Formalizer, Critic agents
│   │   ├── tools/        # LeanRunner, FactStore
│   │   ├── models/       # Shared Pydantic types
│   │   ├── orchestrator.py    # Main state machine
│   │   └── adk_runtime.py     # Agent runtime
│   └── mesh_project/     # Lean 4 project for verification
├── lean-runner/          # Isolated Lean execution service
├── latex-compiler/       # TeXLive PDF compilation service
├── docker-compose.yml
├── Makefile
└── .env.example
```

---

## Build & Development Commands

### Docker Development (Recommended)

```bash
# Start all services (runs migrations automatically)
make dev

# View logs
make logs
make logs-backend
make logs-frontend

# Database operations
make migrate          # Run migrations manually
make migrate-status   # Check migration status
make migration        # Generate new migration (prompts for name)
make shell-db         # Access PostgreSQL shell

# Container management
make up               # Start containers
make down             # Stop containers
make clean            # Remove everything including volumes
make rebuild          # Rebuild without cache

# Shell access
make shell-backend    # Bash into backend container
make shell-frontend   # Sh into frontend container
```

### URLs (Development)

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8080
- **API Docs**: http://localhost:8080/docs
- **MinIO Console**: http://localhost:9001

### Manual Setup (Without Docker)

**Backend:**
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # Edit with your settings
alembic upgrade head
uvicorn app.main:app --reload
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

---

## Database & Migrations

### Migration Workflow

1. **Auto-generate migration** (after model changes):
   ```bash
   make migration
   # Enter migration name when prompted
   ```

2. **Apply migrations**:
   ```bash
   make migrate
   ```

3. **Check status**:
   ```bash
   make migrate-status
   ```

### Key Models

| Model | Description |
|-------|-------------|
| `User` | Authentication, profiles, social features |
| `Problem` | Mathematical problems with metadata |
| `LibraryItem` | Knowledge items (lemma, theorem, etc.) |
| `WorkspaceFile` | File storage for workspaces |
| `DocSection/DocAnchor` | Document organization |
| `Discussion/Comment` | Social discussion features |
| `Star` | Bookmarking system |
| `Follow` | Social graph |
| `Team/TeamMember` | Collaboration groups |
| `Notification` | User notifications |
| `LatexAIMemory/Message/Run` | LaTeX AI assistant state |

---

## Code Style Guidelines

### Python (Backend)

- **Type hints**: Use full type annotations (`from __future__ import annotations`)
- **Async**: Database operations use `asyncpg` + SQLAlchemy async
- **Models**: Use `Mapped[]` syntax with SQLAlchemy 2.0 style
- **Schemas**: Pydantic v2 models for API validation
- **Imports**: Group as stdlib → third-party → local

Example:
```python
from uuid import UUID
from datetime import datetime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base

class Problem(Base):
    __tablename__ = "problems"
    
    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
```

### TypeScript (Frontend)

- **Strict mode**: Enabled in tsconfig.json
- **Path aliases**: Use `@/*` for imports from `src/`
- **Components**: Prefer function components with explicit return types
- **API types**: Mirror backend Pydantic schemas in `lib/types.ts`
- **Error handling**: Use typed errors with proper fallbacks

Example:
```typescript
import { Problem } from "@/lib/types";

interface ProblemCardProps {
  problem: Problem;
  onClick?: (id: string) => void;
}

export function ProblemCard({ problem, onClick }: ProblemCardProps): JSX.Element {
  // ...
}
```

---

## Authentication Flow

1. **Login/Register**: `POST /api/auth/login` or `/api/auth/register`
2. **Token Storage**: JWT access token stored in `localStorage`
3. **API Requests**: Token sent via `Authorization: Bearer <token>` header
4. **Token Refresh**: Use refresh token to get new access token
5. **Logout**: Clear localStorage, token expires server-side

### Protected Routes

- Backend: Use `Depends(get_current_user)` dependency
- Frontend: Check `isAuthenticated()` from `lib/api.ts`

---

## Agent Architecture (Mesh)

The AI system follows a principle: **"ADK is your runtime, not your backend."**

### Components

| Component | Type | Uses AI |
|-----------|------|---------|
| `Orchestrator` | State Machine | No |
| `Explorer` | Agent | Yes (Gemini) |
| `Formalizer` | Agent | Yes (Gemini) |
| `Critic` | Agent | Yes (Gemini) |
| `LaTeX Assistant` | Agent | Yes (Gemini) |
| `LeanRunner` | Tool | No |
| `FactStore` | Tool | No |

### Usage Pattern

```python
from mesh.backend import Orchestrator

orch = Orchestrator()

# 1. Create a block
block_id = orch.canvas.create("Prove sum of two even numbers is even.")

# 2. Explore proposals
proposals = await orch.explore(block_id)

# 3. Formalize to Lean
formalization = await orch.formalize(chosen_proposal)

# 4. Verify
result = await orch.verify(formalization.lean_code)

# 5. Persist if successful
if result.success:
    fact = orch.persist(result, block_id, statement)
```

---

## Environment Configuration

Copy `.env.example` to `.env` and configure:

### Required Variables

```bash
# Database
DATABASE_URL=postgresql+asyncpg://proofmesh:proofmesh@postgres:5432/proofmesh

# JWT (generate a strong secret for production)
JWT_SECRET_KEY=change-me-in-production

# Google AI
GEMINI_API_KEY=your-api-key
GOOGLE_GENERATIVE_AI_API_KEY=your-api-key

# S3/MinIO
S3_ENDPOINT=http://minio:9000
S3_ACCESS_KEY=proofmesh
S3_SECRET_KEY=proofmesh
S3_BUCKET=proofmesh
```

### Service URLs (Docker)

- Backend internal: `http://backend:8000`
- Lean Runner: `http://lean-runner:9008`
- LaTeX Compiler: `http://texlive-compiler:9009`
- Frontend public: `http://localhost:3000`

---

## Testing

### Backend Component Tests

Individual components can be tested via module execution:

```bash
cd mesh

# Test Lean runner
python -m backend.tools.lean_runner --test

# Test FactStore
python -m backend.tools.fact_store --test

# Test agents (requires GEMINI_API_KEY)
python -m backend.agents.explorer --test
python -m backend.agents.formalizer --test
python -m backend.agents.critic --test

# Test orchestrator
python -m backend.orchestrator --test
```

### Manual Testing

1. **Seed data**: `python backend/scripts/seed_social.py`
2. **Create test problem**: Via frontend at `/problems/new`
3. **Test LaTeX**: Create `.tex` file, compile, view PDF

---

## Security Considerations

1. **JWT Secret**: Change default in production
2. **Passwords**: Bcrypt hashed, never stored plaintext
3. **CORS**: Restrict origins in production (see `CORS_ORIGINS`)
4. **S3/MinIO**: Use proper credentials, restrict bucket policies
5. **Lean Runner**: Runs in isolated container (code execution risk)
6. **LaTeX Compiler**: Isolated service (compilation risk)
7. **File Uploads**: Validate mimetypes, scan for malicious content

---

## Common Development Tasks

### Adding a New API Endpoint

1. **Define schema** in `backend/app/schemas/`
2. **Create route** in `backend/app/api/{feature}.py`
3. **Register router** in `backend/app/main.py`
4. **Add types** to `frontend/src/lib/types.ts`
5. **Add API function** to `frontend/src/lib/api.ts`
6. **Create component** in `frontend/src/components/`

### Adding a Database Model

1. **Create model** in `backend/app/models/`
2. **Export** in `backend/app/models/__init__.py`
3. **Generate migration**: `make migration`
4. **Apply migration**: `make migrate`
5. **Create schema** in `backend/app/schemas/`

### Adding an AI Agent

1. **Create agent** in `mesh/backend/agents/`
2. **Inherit from** `BaseAgent` or `LoopAgent`
3. **Register** in `mesh/backend/adk_runtime.py`
4. **Add orchestrator method** in `mesh/backend/orchestrator.py`

---

## Troubleshooting

### Common Issues

**Database connection errors:**
```bash
make down
make up
# Wait for postgres healthcheck
make migrate
```

**Lean cache issues:**
```bash
docker compose exec lean-runner bash
cd /workspace/mesh_project
lake exe cache get
```

**Frontend build errors:**
```bash
cd frontend
rm -rf .next node_modules
npm install
npm run dev
```

**Backend module not found:**
Ensure you're running from the correct directory. Backend imports use absolute imports from `app.*`.

---

## Resources

- **FastAPI**: https://fastapi.tiangolo.com/
- **SQLAlchemy 2.0**: https://docs.sqlalchemy.org/
- **Alembic**: https://alembic.sqlalchemy.org/
- **Next.js**: https://nextjs.org/docs
- **Tailwind CSS**: https://tailwindcss.com/
- **Milkdown**: https://milkdown.dev/
- **Lean 4**: https://lean-lang.org/lean4/doc/
- **Google ADK**: https://developers.google.com/adk
