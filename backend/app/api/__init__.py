from app.api.problems import router as problems_router
from app.api.canvases import router as canvases_router
from app.api.lines import router as lines_router
from app.api.library import router as library_router
from app.api.agents import router as agents_router

__all__ = [
    "problems_router",
    "canvases_router", 
    "lines_router",
    "library_router",
    "agents_router",
]
