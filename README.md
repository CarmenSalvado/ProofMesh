# ProofMesh

ProofMesh is a collaborative workspace for mathematical writing, exploration, and formalization.

It combines a LaTeX lab, a visual proof canvas, a knowledge library, and AI-assisted workflows, with Lean 4 and TeX compilation isolated in dedicated services.

## What This Repository Contains

- `frontend/`: Next.js 16 application (TypeScript, Tailwind CSS 4).
- `backend/`: FastAPI API server (SQLAlchemy async, PostgreSQL, Redis, MinIO).
- `mesh/`: internal AI orchestration/agent package imported by backend.
- `lean-runner/`: isolated Lean 4 execution service.
- `latex-compiler/`: isolated TeXLive compilation + SyncTeX lookup service.
- `docker-compose.yml`: local development stack.
- `Makefile`: common development commands.

## Architecture at a Glance

Runtime services in local development:

- `frontend` (`http://localhost:3000`)
- `backend` (`http://localhost:8080`, docs at `/docs`)
- `postgres` (`localhost:5432`)
- `redis` (`localhost:6379`)
- `minio` (`http://localhost:9000`, console `http://localhost:9001`)
- `lean-runner` (`localhost:9008`)
- `texlive-compiler` (internal service, used by backend)
- `canvas-ai-worker` (background jobs)

Core flow:

1. User actions go through `frontend` into `backend`.
2. Backend persists metadata in PostgreSQL and files/artifacts in MinIO.
3. Long-running AI canvas jobs are processed by `canvas-ai-worker` via Redis.
4. Lean verification is delegated to `lean-runner`.
5. LaTeX compile and SyncTeX mapping are delegated to `texlive-compiler`.

## Gemini 3 (Hackathon)

This project is explicitly wired to Gemini 3 for assistant workflows in LaTeX and canvas exploration.

### Where Gemini 3 Is Used

- LaTeX AI chat/edit/autocomplete (frontend server routes):
  - `frontend/src/app/api/latex-ai/chat/route.ts`
  - `frontend/src/app/api/latex-ai/edit/route.ts`
  - `frontend/src/app/api/latex-ai/autocomplete/route.ts`
- Canvas AI routes:
  - `frontend/src/app/api/canvas-ai/explore/route.ts`
  - `frontend/src/app/api/canvas-ai/formalize/route.ts`
  - `frontend/src/app/api/canvas-ai/critique/route.ts`
- Backend orchestration + worker path:
  - `backend/app/api/orchestration.py`
  - `backend/app/workers/canvas_ai_worker.py`
  - `mesh/backend/agents/`

### Gemini 3 Models Configured in Repo

- `gemini-3-flash-preview`
- `gemini-3-flash-preview-thinking`
- `gemini-3-pro-preview`

Current usage defaults in UI:

- LaTeX Lab mode selector maps to:
  - `flash` -> `gemini-3-flash-preview`
  - `thinking` -> `gemini-3-flash-preview-thinking`

Reference:

- `frontend/src/app/problems/[id]/lab/page.tsx`

### Required Environment Variables

Set at least one of:

- `GEMINI_API_KEY`
- `GOOGLE_GENERATIVE_AI_API_KEY`

In Docker flow, define them in `.env` before `make dev`.

### Minimal Gemini 3 Demo Flow

1. Start stack with `make dev`.
2. Open `http://localhost:3000/problems/<problem_id>/lab`.
3. In LaTeX Lab AI panel, run one prompt in `Flash` mode and one in `Thinking` mode.
4. Open `/problems/<problem_id>/canvas` and trigger explore/formalize/critique.
5. Verify responses stream and state transitions complete without API errors.

### Verification Checklist (Hackathon)

- API key is present in container env.
- `backend` logs do not show `GEMINI_API_KEY not found`.
- LaTeX AI routes return content, not fallback errors.
- Canvas AI endpoints produce generated output.
- No 401/403 from frontend server routes using Gemini.

## Prerequisites

- Docker Engine with Compose plugin
- GNU Make

## Quick Start (Recommended)

```bash
cp .env.example .env
make dev
```

Then open:

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8080`
- API docs: `http://localhost:8080/docs`
- MinIO Console: `http://localhost:9001`

## Common Commands

```bash
# lifecycle
make dev
make down
make logs
make logs-backend
make logs-frontend

# database
make migrate
make migrate-status
make migration

# shells
make shell-backend
make shell-frontend
make shell-db

# data seeding
make seed
make seed-clean
make seed-custom

# cleanup / rebuild
make clean
make rebuild
```

## Development Notes

- Backend and frontend run with source mounts for hot reload.
- Backend startup runs migrations via container entrypoint.
- `mesh/` is a Python package mounted into backend; it is not a separate HTTP service.
- LaTeX artifacts are stored under MinIO object prefixes (e.g. `latex/<problem_id>/.output/*`).

## Manual Setup (Without Docker)

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
alembic upgrade head
uvicorn app.main:app --reload --host 0.0.0.0 --port 8080
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Auxiliary Services

Manual mode still requires PostgreSQL, Redis, MinIO, Lean runner, and LaTeX compiler reachable through the URLs configured in `.env`.

## Environment Configuration

Use `.env.example` as the baseline. Important groups:

- Database/queue/storage:
  - `DATABASE_URL`
  - `REDIS_URL`
  - `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`, `S3_REGION`, `S3_SECURE`
- External/aux services:
  - `LATEX_COMPILER_URL`
  - `LATEX_COMPILE_TIMEOUT`
  - `LEAN_RUNNER_URL`
  - `LEAN_TIMEOUT`
- AI keys:
  - `GEMINI_API_KEY`
  - `GOOGLE_GENERATIVE_AI_API_KEY`
- Frontend:
  - `NEXT_PUBLIC_API_URL`
  - `NEXT_PUBLIC_WS_URL`

## Repository Layout

```text
backend/
  app/
    api/
    models/
    schemas/
    services/
    workers/
  alembic/
  scripts/
frontend/
  src/
mesh/
lean-runner/
latex-compiler/
```

## Known Scope and Limitations

- Test coverage is currently limited; changes are validated mostly through local runtime checks.
- This repository is optimized for local development and iteration speed over production-hardening defaults.

## Troubleshooting

- Service not updating after code changes (especially `texlive-compiler`, `lean-runner`):

```bash
make rebuild
```

- Backend cannot access private problem or returns auth errors:
  - verify `access_token` in frontend session
  - verify `NEXT_PUBLIC_API_URL` points to the current backend

- Missing PDFs / compile artifacts:
  - check `make logs-backend`
  - check `docker logs proofmesh-texlive-compiler`
  - verify MinIO credentials and bucket from `.env`

## Contributing

1. Create a branch for the change.
2. Keep changes scoped and include reproduction/validation steps in PR descriptions.
3. Prefer non-breaking API updates and document any required migrations.
