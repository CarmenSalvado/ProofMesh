# ProofMesh Backend

Human-controlled reasoning workspace API.

## Setup

1. Create virtual environment:
```bash
python -m venv venv
source venv/bin/activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Copy environment file:
```bash
cp .env.example .env
# Edit .env with your database credentials
```

4. Start PostgreSQL and create database:
```bash
createdb proofmesh
```

5. Run migrations:
```bash
alembic upgrade head
```

6. Start development server:
```bash
uvicorn app.main:app --reload
```

## API Endpoints

- `GET /` - API info
- `GET /health` - Health check
- `POST/GET /api/problems` - Problems CRUD
- `GET/POST /api/workspaces/{id}/contents` - Workspace contents (markdown file store)
- `GET/PUT/PATCH/DELETE /api/workspaces/{id}/contents/{path}` - Files and notebooks
- `POST/GET /api/problems/{id}/library` - Library items
