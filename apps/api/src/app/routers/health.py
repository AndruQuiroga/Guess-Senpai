from __future__ import annotations

from fastapi import APIRouter


router = APIRouter()


@router.get("/live", response_model=dict)
async def live() -> dict:
    return {"ok": True}
