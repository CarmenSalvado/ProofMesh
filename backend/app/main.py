from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.services.storage import ensure_bucket
from app.api.auth import router as auth_router
from app.api import (
    problems_router,
    library_router,
    workspaces_router,
    agents_router,
    social_router,
    realtime_router,
    latex_router,
    latex_ai_router,
    latex_ai_store_router,
)
from app.api.orchestration import router as orchestration_router
from app.api.documents import router as documents_router

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    try:
        await ensure_bucket()
    except Exception as exc:
        print(f"[startup] Failed to ensure S3 bucket: {exc}")
    yield
    # Shutdown


app = FastAPI(
    title="ProofMesh API",
    description="Human-controlled reasoning workspace for mathematics",
    version="0.3.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# REST Routers
app.include_router(auth_router)
app.include_router(problems_router)
app.include_router(library_router)
app.include_router(workspaces_router)
app.include_router(agents_router)
app.include_router(social_router)
app.include_router(latex_router)
app.include_router(latex_ai_router)
app.include_router(latex_ai_store_router)
app.include_router(orchestration_router)
app.include_router(documents_router, prefix="/api/documents", tags=["documents"])

# WebSocket Router
app.include_router(realtime_router)


@app.get("/")
async def root():
    return {"message": "ProofMesh API", "version": "0.3.0"}


@app.get("/health")
async def health():
    return {"status": "ok"}
