from uuid import UUID

from fastapi import APIRouter, HTTPException, Response

from app.services.storage import get_object_bytes, head_object


router = APIRouter(prefix="/api/avatars", tags=["avatars"])


@router.get("/{user_id}")
async def get_avatar(user_id: UUID):
    key = f"avatars/{user_id}"
    data = await get_object_bytes(key)
    if data is None:
        raise HTTPException(status_code=404, detail="Avatar not found")
    meta = await head_object(key) or {}
    content_type = meta.get("ContentType") or "application/octet-stream"
    return Response(content=data, media_type=content_type)
