from app.api.problems import router as problems_router
from app.api.library import router as library_router
from app.api.workspaces import router as workspaces_router
from app.api.agents import router as agents_router
from app.api.social import router as social_router
from app.api.realtime import router as realtime_router
from app.api.latex import router as latex_router
from app.api.latex_ai import router as latex_ai_router
from app.api.latex_ai_store import router as latex_ai_store_router

__all__ = [
    "problems_router",
    "library_router",
    "workspaces_router",
    "agents_router",
    "social_router",
    "realtime_router",
    "latex_router",
    "latex_ai_router",
    "latex_ai_store_router",
]
