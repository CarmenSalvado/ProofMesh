from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.api.auth import router as auth_router
from app.api import (
    problems_router,
    library_router,
    workspaces_router,
    agents_router,
    social_router,
    realtime_router,
)

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
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

# WebSocket Router
app.include_router(realtime_router)


@app.get("/")
async def root():
    return {"message": "ProofMesh API", "version": "0.3.0"}


@app.get("/health")
async def health():
    return {"status": "ok"}
