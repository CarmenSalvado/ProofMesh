from app.api.problems import router as problems_router
from app.api.library import router as library_router
from app.api.workspaces import router as workspaces_router
from app.api.agents import router as agents_router

__all__ = [
    "problems_router",
    "library_router",
    "workspaces_router",
    "agents_router",
]
