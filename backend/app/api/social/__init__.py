"""
Social API Routes - Modular structure for social features.

This package provides:
- users.py: User directory, connections, follow/unfollow
- feed.py: Activity feed and contributions
- discussions.py: Discussion and comment management
- stars.py: Star/bookmark functionality
- notifications.py: User notifications
- teams.py: Team management
- trending.py: Trending problems and platform stats
"""

from fastapi import APIRouter

from .users import router as users_router
from .feed import router as feed_router
from .discussions import router as discussions_router
from .stars import router as stars_router
from .notifications import router as notifications_router
from .teams import router as teams_router
from .trending import router as trending_router

# Main router that combines all sub-routers
router = APIRouter(prefix="/api/social", tags=["social"])

# Include all sub-routers
router.include_router(users_router)
router.include_router(feed_router)
router.include_router(discussions_router)
router.include_router(stars_router)
router.include_router(notifications_router)
router.include_router(teams_router)
router.include_router(trending_router)
