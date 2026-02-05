# ProofMesh

**Human-controlled reasoning workspace for mathematics.**

ProofMesh is a collaborative platform for mathematical exploration and proof development. It combines:
- 📝 **Latex workspaces** for formal mathematical writing
- 🎨 **Visual canvas** for proof exploration and diagram generation
- 🤖 **AI agents** for mathematical assistance (exploration, formalization, critique)
- 📚 **Knowledge library** for theorems, lemmas, and definitions
- 🔗 **Social features** for collaboration and discussion
- ⚡ **Lean 4 integration** for formal verification

---

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Make (optional, for convenience commands)

### Start Development Environment

```bash
# Clone the repository
git clone https://github.com/yourusername/ProofMesh.git
cd ProofMesh

# Start all services (backend, frontend, PostgreSQL, Redis, MinIO)
make dev

# View logs
make logs                 # All services
make logs-backend         # Backend only
make logs-frontend        # Frontend only
```

**Service URLs:**
- 🌐 Frontend: http://localhost:3000
- 🔌 Backend API: http://localhost:8080
- 📖 API Documentation: http://localhost:8080/docs
- 📦 MinIO Console: http://localhost:9001

### Seed Demo Data

```bash
# Populate database with demo users, problems, and library items
docker compose exec backend python backend/scripts/seed_platform.py
```

---

## 🏗️ Architecture

### Tech Stack

**Backend:**
- FastAPI (Python 3.12)
- PostgreSQL (async with SQLAlchemy 2.0)
- Redis (job queues)
- MinIO (S3-compatible object storage)
- Google Gemini API (AI agents)

**Frontend:**
- Next.js 16 (React, TypeScript)
- Tailwind CSS 4
- Milkdown Crepe (markdown editor)
- Monaco Editor (code editor)
- KaTeX (LaTeX rendering)
- PDF.js (document viewing)

**Isolated Services:**
- `lean-runner`: Lean 4 code execution (sandboxed)
- `latex-compiler`: TeXLive PDF compilation

### Project Structure

```
ProofMesh/
├── backend/                    # FastAPI backend
│   ├── app/
│   │   ├── api/                # REST API routes
│   │   │   ├── auth.py         # Authentication (JWT)
│   │   │   ├── problems.py     # Problem management
│   │   │   ├── workspaces.py   # File workspace
│   │   │   ├── library.py      # Knowledge library
│   │   │   ├── canvas_blocks.py # Canvas blocks
│   │   │   ├── canvas_ai.py    # Canvas AI operations
│   │   │   ├── agents.py       # Agent orchestration
│   │   │   ├── social/         # Social features
│   │   │   └── documents.py    # Document management
│   │   ├── models/             # SQLAlchemy ORM models
│   │   ├── schemas/            # Pydantic request/response schemas
│   │   ├── services/           # Business logic
│   │   └── workers/            # Background job processors
│   ├── alembic/                # Database migrations
│   └── scripts/                # Utility scripts
├── frontend/                   # Next.js frontend
│   └── src/
│       ├── app/                # Next.js pages (App Router)
│       ├── components/         # React components
│       │   ├── canvas/         # Canvas visualization
│       │   ├── editor/         # Markdown/code editors
│       │   └── ui/             # Reusable UI components
│       └── lib/                # API client, types, utilities
├── mesh/                       # AI agents module
│   └── backend/
│       ├── agents/             # Agent implementations
│       │   ├── explorer.py     # Proposes mathematical results
│       │   ├── formalizer.py   # Converts to Lean 4
│       │   ├── critic.py       # Evaluates proposals
│       │   └── latex_assistant.py # LaTeX generation
│       ├── tools/              # Agent tools
│       │   ├── lean_runner.py  # Lean 4 execution
│       │   ├── fact_store.py   # Knowledge persistence
│       │   └── embeddings.py   # Vector embeddings
│       ├── orchestrator.py     # Main agent orchestrator
│       └── adk_runtime.py      # Agent runtime
├── lean-runner/                # Isolated Lean 4 execution
└── latex-compiler/             # Isolated LaTeX compilation
```

### Key Concepts

**Problem**: A mathematical problem or question with metadata (title, description, difficulty, tags)

**Workspace**: File-based workspace for informal mathematical writing (markdown, Lean code, etc.)

**Library**: Collection of knowledge items (theorems, lemmas, definitions, claims, axioms)

**Canvas**: Visual proof exploration interface with blocks for diagrams, LaTeX, and AI-generated content

**Agent**: AI assistant for mathematical reasoning (explorer, formalizer, critic, LaTeX assistant)

---

## 🔧 Development

### Docker Development (Recommended)

Docker setup uses **volume mounts** for instant hot-reload:
- Edit `backend/app/**` → Backend reloads automatically
- Edit `frontend/src/**` → Frontend reloads with Fast Refresh

**No need to rebuild containers for code changes!**

```bash
# Core commands
make dev              # Start all services
make down             # Stop containers
make logs             # View all logs
make restart          # Restart all services

# Database
make migrate          # Run database migrations
make migrate-status   # Check migration status
make migration        # Create new migration (prompts for name)
make shell-db         # Access PostgreSQL shell (psql)

# Container access
make shell-backend    # Bash shell in backend container
make shell-frontend   # Bash shell in frontend container

# Cleanup
make clean            # Remove everything including volumes
make rebuild          # Rebuild containers without cache
```

### Manual Backend Setup (without Docker)

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your credentials

# Run migrations
alembic upgrade head

# Start development server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8080
```

### Manual Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev

# Other commands
npm run build         # Production build
npm run lint          # ESLint
```

### Environment Variables

Key environment variables (see `.env.example`):

```bash
# Database
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/proofmesh

# Redis
REDIS_URL=redis://localhost:6379/0

# MinIO (S3-compatible storage)
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET=proofmesh

# AI Agents
GEMINI_API_KEY=your-gemini-api-key

# Services
LEAN_RUNNER_URL=http://lean-runner:8000
LATEX_COMPILER_URL=http://latex-compiler:8000
LEAN_TIMEOUT=60

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:8080
NEXT_PUBLIC_WS_URL=ws://localhost:8080/ws
```

---

## 🗄️ Database

### Migrations

ProofMesh uses Alembic for database migrations:

```bash
# Run all pending migrations (also runs automatically on backend startup)
make migrate

# Create new migration
make migration
# Enter migration name when prompted

# Check migration status
make migrate-status

# Manual Alembic commands (in backend container or venv)
alembic revision --autogenerate -m "Add new table"
alembic upgrade head
alembic downgrade -1
alembic history
```

### Core Data Models

| Model | Description |
|-------|-------------|
| `User` | User accounts with authentication |
| `Problem` | Mathematical problems/questions |
| `LibraryItem` | Knowledge items (theorem, lemma, definition, claim, axiom) |
| `WorkspaceFile` | Files in problem workspaces |
| `CanvasBlock` | Blocks on visual canvas |
| `Discussion` | Discussion threads |
| `Comment` | Comments on discussions |
| `Team` | Collaboration teams |
| `Star` | User stars (favorites) |
| `Follow` | User follow relationships |

---

## 🔌 API Reference

### Main Endpoints

**Authentication** (`/api/auth`)
- `POST /register` - Create new user account
- `POST /login` - Login with credentials (returns JWT)
- `POST /refresh` - Refresh access token
- `GET /me` - Get current user info

**Problems** (`/api/problems`)
- `GET /` - List problems (with filters)
- `POST /` - Create new problem
- `GET /{id}` - Get problem details
- `PUT /{id}` - Update problem
- `DELETE /{id}` - Delete problem

**Workspaces** (`/api/workspaces`)
- `GET /{problem_id}/files` - List workspace files
- `POST /{problem_id}/files` - Create file
- `GET /{problem_id}/files/{file_id}` - Get file content
- `PUT /{problem_id}/files/{file_id}` - Update file
- `DELETE /{problem_id}/files/{file_id}` - Delete file

**Library** (`/api/library`)
- `GET /` - List library items (theorems, lemmas, etc.)
- `POST /` - Create library item
- `GET /{id}` - Get item details
- `PUT /{id}` - Update item
- `DELETE /{id}` - Delete item

**Canvas** (`/api/canvas-blocks`, `/api/canvas-ai`)
- `GET /problems/{problem_id}/blocks` - Get canvas blocks
- `POST /problems/{problem_id}/blocks` - Create block
- `PUT /blocks/{id}` - Update block
- `DELETE /blocks/{id}` - Delete block
- `POST /canvas-ai/explore` - AI exploration task
- `POST /canvas-ai/formalize` - Formalize to Lean 4
- `POST /canvas-ai/critique` - Critique proposal

**Social** (`/api/social/*`)
- `GET /users` - List users
- `GET /users/{id}` - User profile
- `POST /users/{id}/follow` - Follow user
- `GET /discussions` - List discussions
- `POST /discussions` - Create discussion
- `GET /teams` - List teams

**Documents** (`/api/documents`)
- `POST /upload` - Upload PDF document
- `GET /{id}` - Get document metadata
- `GET /{id}/download` - Download document

**WebSocket** (`/ws`)
- Real-time updates for canvas, discussions, and notifications

📖 **Full API Documentation**: http://localhost:8080/docs

---

## 🤖 AI Agents

ProofMesh includes AI agents powered by Google Gemini for mathematical assistance.

### Available Agents

| Agent | Purpose | Usage |
|-------|---------|-------|
| **Explorer** | Proposes new mathematical results based on context | Canvas "Explore" button |
| **Formalizer** | Converts informal math to Lean 4 code | Canvas "Formalize" button |
| **Critic** | Evaluates mathematical proposals for correctness | Canvas "Critique" button |
| **LaTeX Assistant** | Generates LaTeX for mathematical expressions | Canvas "LaTeX" block |

### Agent Architecture

Agents use the **Orchestrator** pattern (NOT REST API - it's a Python library):

```python
from mesh.backend.orchestrator import Orchestrator

orch = Orchestrator()

# Explore mathematical concepts
proposals = await orch.explore(block_id)

# Formalize to Lean 4
lean_code = await orch.formalize(text)

# Verify with Lean runner
result = await orch.verify(lean_code)

# Critique proposal
critique = await orch.critique(proposal)
```

**Key Points:**
- ⚠️ **ADK (Agent Development Kit) is a runtime library, NOT a backend API**
- Agents are Python classes in `mesh/backend/agents/`
- Backend imports mesh as a Python module (via Docker volume mount)
- Agents use Gemini Flash 3 model (`gemini-3-flash-preview`)
- Canvas AI operations run asynchronously via Redis queue

📖 **Agent Development Guide**: See [AGENTS.md](AGENTS.md) for detailed agent development documentation.

---

## 🛠️ Common Tasks

### Adding a New API Endpoint

1. **Create route handler** in `backend/app/api/`:
   ```python
   # backend/app/api/my_feature.py
   from fastapi import APIRouter, Depends
   from sqlalchemy.ext.asyncio import AsyncSession
   from app.database import get_db
   
   router = APIRouter(prefix="/api/my-feature", tags=["My Feature"])
   
   @router.get("/")
   async def list_items(db: AsyncSession = Depends(get_db)):
       # Your logic here
       return {"items": []}
   ```

2. **Add schemas** in `backend/app/schemas/` if needed:
   ```python
   # backend/app/schemas/my_feature.py
   from pydantic import BaseModel
   
   class MyItemCreate(BaseModel):
       name: str
       value: int
   ```

3. **Register router** in `backend/app/main.py`:
   ```python
   from app.api import my_feature
   
   app.include_router(my_feature.router)
   ```

4. **Add frontend API client** in `frontend/src/lib/api.ts`:
   ```typescript
   export const myFeatureApi = {
     list: () => api.get('/api/my-feature/'),
     create: (data: MyItemCreate) => api.post('/api/my-feature/', data),
   };
   ```

### Creating a Database Migration

```bash
# Auto-generate migration from model changes
make migration
# Enter description: "Add my_table"

# Review generated migration in backend/alembic/versions/
# Edit if needed

# Apply migration
make migrate
```

### Adding a New Agent

1. **Create agent class** in `mesh/backend/agents/`:
   ```python
   # mesh/backend/agents/my_agent.py
   from mesh.backend.agents.base import Agent
   
   class MyAgent(Agent):
       async def process(self, input_data: str) -> str:
           # Your agent logic
           return await self.call_llm(prompt=f"Process: {input_data}")
   ```

2. **Register in orchestrator** `mesh/backend/orchestrator.py`:
   ```python
   from mesh.backend.agents.my_agent import MyAgent
   
   class Orchestrator:
       def __init__(self):
           self.my_agent = MyAgent()
   ```

3. **Use in backend API** `backend/app/api/agents.py`:
   ```python
   from mesh.backend.orchestrator import Orchestrator
   
   orch = Orchestrator()
   result = await orch.my_agent.process(input_data)
   ```

### Running Lean 4 Code

```python
from mesh.backend.tools.lean_runner import run_lean_code

result = await run_lean_code(
    code='#eval 2 + 2',
    timeout=60
)

if result['success']:
    print(result['output'])
else:
    print(result['error'])
```

---

## 🧪 Testing

### Running Tests

```bash
# Backend tests
docker compose exec backend pytest

# Frontend tests
docker compose exec frontend npm test

# Specific test file
docker compose exec backend pytest app/tests/test_auth.py
```

### Agent Testing

```bash
# Test agents directly
python mesh/test_agents.py
```

---

## 🐛 Troubleshooting

### Backend won't start

**Problem**: `sqlalchemy.exc.OperationalError: could not connect to server`

**Solution**: Wait for PostgreSQL to fully initialize (30 seconds on first run)

```bash
make logs-backend  # Check if waiting for database
make logs-db       # Check database logs
```

---

### Frontend shows "Network Error"

**Problem**: Frontend can't reach backend API

**Solution**: Verify backend is running and accessible:
```bash
curl http://localhost:8080/health
# Should return: {"status":"ok"}
```

Check `NEXT_PUBLIC_API_URL` in frontend environment.

---

### Migration conflicts

**Problem**: `alembic.util.exc.CommandError: Multiple head revisions are present`

**Solution**: Merge migration heads:
```bash
docker compose exec backend alembic merge heads -m "Merge migrations"
make migrate
```

---

### Lean runner timeout

**Problem**: Lean code execution times out

**Solution**: Increase timeout in environment:
```bash
# .env
LEAN_TIMEOUT=120  # Increase to 120 seconds
```

Or optimize Lean code (reduce complexity, add imports).

---

### MinIO connection errors

**Problem**: `botocore.exceptions.EndpointConnectionError`

**Solution**: Ensure MinIO is running and bucket exists:
```bash
make logs-minio
docker compose exec backend python -c "from app.services.storage import storage_service; import asyncio; asyncio.run(storage_service.init_bucket())"
```

---

### AI agent API errors

**Problem**: `google.api_core.exceptions.ResourceExhausted: 429 Quota exceeded`

**Solution**: 
1. Check Gemini API quota at https://aistudio.google.com/
2. Wait for quota reset (usually 1 minute)
3. Reduce concurrent requests

**Problem**: `UNAVAILABLE: 503 Service unavailable`

**Solution**: Retry with exponential backoff (already implemented in agents)

---

## 📚 Additional Documentation

- **[AGENTS.md](AGENTS.md)** - AI agent development guide (for AI assistants working on this codebase)
- **API Docs** - http://localhost:8080/docs (interactive OpenAPI documentation)

---

## 🤝 Contributing

### Code Style

**Python:**
- Follow PEP 8
- Use type hints
- Async/await for all I/O operations
- SQLAlchemy 2.0 async syntax

**TypeScript:**
- Follow ESLint configuration
- Use functional components with hooks
- Prefer async/await over promises

### Commit Messages

Use conventional commits:
- `feat: Add new feature`
- `fix: Fix bug`
- `docs: Update documentation`
- `refactor: Refactor code`
- `test: Add tests`

---

## 📄 License

[Your License Here]

---

## 🙏 Acknowledgments

- Google Gemini for AI capabilities
- Lean 4 community for formal verification tools
- Open source contributors

---

**ProofMesh** - Where human reasoning meets AI assistance for mathematical exploration.
