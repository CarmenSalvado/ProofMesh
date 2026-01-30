# ProofMesh — Agent Guide

This document provides essential information for AI coding agents working on ProofMesh. Read this first before making any changes.

---

## 1. Project Overview

**ProofMesh** is a human-controlled reasoning workspace for mathematics. It provides a structured environment where humans can think, explore problems, and accumulate knowledge in a traceable way.

### Core Philosophy (Non-Negotiable)

- **Human Control First**: The workspace belongs to the human. Agents NEVER edit notebooks or files directly.
- **Explicit Insertion**: Nothing enters a notebook unless a human accepts or inserts it.
- **Traceability**: Everything has author, origin, time, and status. No anonymous blobs.
- **Not a Chat App**: This is a reasoning workspace, not a conversational interface.

### Mental Model

```
Problem
  ├── Library (shared memory - cumulative)
  └── Workspace (markdown-backed - disposable)
```

- **Problems**: Mathematical problems to explore
- **Workspaces**: Where humans think (markdown-first, file-based)
- **Library**: Where results live (reusable, referenceable, verifiable)

---

## 2. Technology Stack

### Backend
- **Language**: Python 3.12+
- **Framework**: FastAPI
- **Validation**: Pydantic v2
- **Database**: PostgreSQL 16 (async via asyncpg)
- **ORM**: SQLAlchemy 2.0 (async)
- **Migrations**: Alembic
- **Cache/Queue**: Redis 7
- **Storage**: MinIO (S3-compatible)
- **Auth**: JWT (python-jose + bcrypt)

### Frontend
- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript 5
- **UI**: React 19
- **Styling**: Tailwind CSS 4
- **Editor**: Milkdown Crepe (markdown editor)
- **Math**: KaTeX
- **Icons**: Lucide React

### Infrastructure
- **Containerization**: Docker + Docker Compose
- **LaTeX**: TeXLive compiler service (separate container)
- **AI Integration**: Google Generative AI (Gemini)

### Other Components
- `/mesh` - Agent framework (Python, experimental)
- `/open-canvas` - Third-party LangChain document collaboration tool (separate)

---

## 3. Project Structure

```
ProofMesh/
├── backend/                 # FastAPI backend
│   ├── app/
│   │   ├── api/            # API route handlers
│   │   │   ├── auth.py
│   │   │   ├── problems.py
│   │   │   ├── workspaces.py
│   │   │   ├── library.py
│   │   │   ├── agents.py
│   │   │   ├── social.py
│   │   │   ├── realtime.py      # WebSocket
│   │   │   ├── latex.py         # LaTeX compilation
│   │   │   ├── latex_ai.py      # LaTeX AI features
│   │   │   ├── orchestration.py # Document workflows
│   │   │   └── documents.py     # Document management
│   │   ├── models/         # SQLAlchemy models
│   │   │   ├── user.py
│   │   │   ├── problem.py
│   │   │   ├── library_item.py
│   │   │   ├── workspace_file.py
│   │   │   ├── doc_section.py
│   │   │   ├── team.py
│   │   │   ├── activity.py
│   │   │   ├── discussion.py
│   │   │   ├── comment.py
│   │   │   ├── star.py
│   │   │   └── notification.py
│   │   ├── schemas/        # Pydantic schemas
│   │   ├── services/       # Business logic
│   │   │   ├── auth.py
│   │   │   └── storage.py  # S3/MinIO operations
│   │   ├── config.py       # Settings (pydantic-settings)
│   │   ├── database.py     # DB engine & session
│   │   └── main.py         # FastAPI app factory
│   ├── alembic/            # Database migrations
│   │   └── versions/       # Migration files
│   ├── scripts/            # Utility scripts
│   │   ├── entrypoint.sh   # Container startup
│   │   ├── seed_platform.py
│   │   └── seed_social.py
│   ├── requirements.txt
│   ├── alembic.ini
│   └── Dockerfile.dev
├── frontend/               # Next.js frontend
│   ├── src/
│   │   ├── app/           # App Router pages
│   │   │   ├── (dashboard)/
│   │   │   ├── problems/[id]/
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── page.tsx
│   │   │   │   ├── lab/page.tsx      # Markdown workspace
│   │   │   │   └── canvas/page.tsx   # Visual canvas
│   │   │   ├── api/latex-ai/         # API routes
│   │   │   ├── discussions/
│   │   │   ├── social/
│   │   │   ├── library/
│   │   │   ├── teams/
│   │   │   └── ...
│   │   ├── components/     # React components
│   │   │   ├── editor/
│   │   │   ├── library/
│   │   │   ├── social/
│   │   │   ├── agents/
│   │   │   └── collaboration/
│   │   ├── hooks/          # Custom React hooks
│   │   └── lib/            # Utilities
│   │       ├── api.ts      # API client
│   │       ├── types.ts    # TypeScript types
│   │       └── auth.tsx    # Auth context
│   ├── package.json
│   ├── tsconfig.json
│   └── Dockerfile.dev
├── latex-compiler/         # LaTeX service
│   ├── app/main.py        # FastAPI LaTeX compiler
│   ├── Dockerfile
│   └── requirements.txt
├── mesh/                   # Agent framework (experimental)
│   ├── backend/
│   ├── mesh_project/      # Lean 4 project
│   └── test_agents.py
├── docker-compose.yml      # All services
├── Makefile               # Common commands
├── .env.example           # Environment template
├── CLAUDE.md              # Product specification (READ THIS)
├── DESIGN.md              # UI/UX design principles
└── FRONTEND_ARCHITECTURE.md  # Frontend patterns

```

---

## 4. Build and Development Commands

### Quick Start (Docker - Recommended)

```bash
# Start all services
make dev

# URLs:
# - Frontend: http://localhost:3000
# - Backend API: http://localhost:8080
# - API Docs: http://localhost:8080/docs
# - MinIO Console: http://localhost:9001
```

### Common Make Commands

```bash
make up              # Start containers
make down            # Stop containers
make logs            # View all logs
make logs-backend    # Backend logs only
make logs-frontend   # Frontend logs only
make migrate         # Run DB migrations
make migrate-status  # Check migration status
make migration       # Generate new migration (interactive)
make shell-backend   # Shell into backend container
make shell-frontend  # Shell into frontend container
make shell-db        # PostgreSQL shell
make clean           # Remove everything (including data)
make rebuild         # Rebuild without cache
```

### Manual Setup (without Docker)

**Backend:**
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # Edit as needed
createdb proofmesh
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

## 5. Database Migrations

Migrations run automatically on backend container startup via `entrypoint.sh`.

### Manual Migration Workflow

```bash
# Check current status
docker compose exec backend alembic current
docker compose exec backend alembic heads

# Generate new migration (after model changes)
make migration
# Enter migration name when prompted

# Apply migrations
make migrate

# Rollback (if needed)
docker compose exec backend alembic downgrade -1
```

### Migration Guidelines

- Always review auto-generated migrations before applying
- Migration files are in `backend/alembic/versions/`
- Use descriptive migration names (e.g., `add_user_profile_fields`)
- Test migrations on a copy of production data when possible

---

## 6. Code Style Guidelines

### Python (Backend)

- Follow PEP 8
- Use type hints where practical
- Prefer `async/await` for I/O operations
- Use Pydantic v2 for validation
- SQLAlchemy 2.0 style (type hints, async)

```python
# Good: SQLAlchemy 2.0 async style
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

async def get_user(db: AsyncSession, user_id: UUID) -> User | None:
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()
```

### TypeScript (Frontend)

- Strict TypeScript configuration
- Use explicit types for API contracts
- Prefer functional components with hooks
- Use Tailwind for styling

```typescript
// Good: Explicit types matching backend
interface LibraryItem {
  id: UUID;
  title: string;
  kind: LibraryItemKind;
  status: LibraryItemStatus;
  // ...
}
```

### General Principles

- **Working > Beautiful**: Prioritize functionality
- **No speculative abstractions**: Don't over-engineer
- **Small commits**: Keep changes focused
- **No silent magic**: Explicit is better than implicit
- **If it's clever but opaque, delete it**

---

## 7. Testing

### Current State

Testing infrastructure is minimal in the MVP:
- No automated test suite configured
- Manual testing via Docker Compose setup
- API testing can be done via `/docs` (Swagger UI)

### Manual Testing Approach

```bash
# 1. Start the stack
make dev

# 2. Check health endpoints
curl http://localhost:8080/health
curl http://localhost:3000

# 3. Test via API docs
open http://localhost:8080/docs
```

### When Adding Tests

If you add tests:
- Place backend tests in `backend/tests/`
- Place frontend tests alongside components (`*.test.tsx`)
- Follow existing patterns in `mesh/test_agents.py` if available

---

## 8. Key API Endpoints

### Problems
- `GET/POST /api/problems` - List/Create problems
- `GET/PUT/DELETE /api/problems/{id}` - Problem CRUD

### Workspaces
- `GET /api/workspaces/{id}/contents` - List workspace files
- `GET/PUT/PATCH/DELETE /api/workspaces/{id}/contents/{path}` - File operations

### Library
- `GET/POST /api/problems/{id}/library` - List/Create library items
- `GET/PUT/DELETE /api/library/{id}` - Library item CRUD

### Social
- `GET/POST /api/social/feed` - Activity feed
- `POST /api/social/follow` - Follow users
- `GET/POST /api/discussions` - Discussions

### Documents & LaTeX
- `POST /api/latex/compile` - Compile LaTeX to PDF
- `GET /api/documents/{id}` - Get document
- `POST /api/documents/{id}/export` - Export document

### Real-time
- `WS /ws/realtime/{problem_id}` - WebSocket for collaboration

---

## 9. Environment Configuration

Copy `.env.example` to `.env` and configure:

```bash
# Database
DATABASE_URL=postgresql+asyncpg://proofmesh:proofmesh@postgres:5432/proofmesh

# Redis
REDIS_URL=redis://redis:6379

# MinIO / S3
S3_ENDPOINT=http://minio:9000
S3_ACCESS_KEY=proofmesh
S3_SECRET_KEY=proofmesh
S3_BUCKET=proofmesh

# LaTeX Compiler
LATEX_COMPILER_URL=http://texlive-compiler:9009

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:8080

# Google AI (optional)
GEMINI_API_KEY=your-api-key
GOOGLE_GENERATIVE_AI_API_KEY=your-api-key
```

---

## 10. Security Considerations

### Current Security Model

- JWT-based authentication
- Password hashing with bcrypt
- CORS configured for local development
- No HTTPS in local Docker setup

### When Implementing Features

- Never expose secrets in frontend code (use `NEXT_PUBLIC_` only for non-secrets)
- Validate all inputs with Pydantic schemas
- Use parameterized queries (SQLAlchemy handles this)
- Check user permissions at API boundaries
- Sanitize file paths (prevent directory traversal)

### Secrets Management

- `.env` file is gitignored
- Never commit credentials
- Rotate JWT secret in production

---

## 11. Important Design Constraints

### UI/UX (from DESIGN.md)

- **Notebook-centric**: Single central column, max width ~720-860px
- **Minimalism**: Every element must justify its existence
- **No chat interface**: This is NOT a conversational UI
- **Semantic colors only**: Color maps to state, not decoration
- **Typography first**: Inter/SF Pro for text, KaTeX for math

### Core Rules (from CLAUDE.md)

1. **Agents NEVER edit notebooks or files directly**
2. **Insertion is explicit** - Nothing enters without human action
3. **Humans MAY publish discoveries; Agents ALWAYS publish as "proposed"**
4. **Everything is traceable** - Author, origin, time, status

### Anti-Goals

DO NOT:
- Turn this into a chat interface
- Let agents write directly into notebooks
- Auto-merge agent output
- Hide verification failures
- Add speculative features

---

## 12. Troubleshooting

### Database connection issues
```bash
# Check if PostgreSQL is healthy
docker compose ps
docker compose logs postgres

# Reset database (WARNING: deletes data)
make clean && make dev
```

### Migration conflicts
```bash
# Check current revision
docker compose exec backend alembic current

# If needed, manually fix in alembic/versions/
```

### Frontend build issues
```bash
# Clear Next.js cache
rm -rf frontend/.next
make rebuild
```

### S3/MinIO issues
```bash
# Check MinIO console at http://localhost:9001
# (login with MINIO_ROOT_USER/PASSWORD from .env)
```

---

## 13. Reference Documents

- **CLAUDE.md** - Complete product specification and philosophy
- **DESIGN.md** - UI/UX design principles and visual language
- **FRONTEND_ARCHITECTURE.md** - Frontend component and layout patterns
- **README.md** - Quick start and overview

---

## 14. Summary Checklist

Before submitting changes, verify:

- [ ] Human control is preserved
- [ ] Epistemic status is explicit (proposed/verified/rejected)
- [ ] Authorship is unambiguous
- [ ] Changes reduce cognitive load (or at least don't increase it)
- [ ] Database migrations are included if schema changed
- [ ] No secrets committed
- [ ] Code follows existing patterns
- [ ] Working > Beautiful

When in doubt, refer to **CLAUDE.md** - it is the authoritative source for product decisions.
