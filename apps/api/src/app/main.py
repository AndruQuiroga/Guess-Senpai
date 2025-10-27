from __future__ import annotations

import logging
from datetime import date

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .core.config import settings
from .core.database import register_database
from .puzzles.engine import get_daily_puzzle
from .routers import auth, health, profile, puzzles


logger = logging.getLogger(__name__)


def create_app() -> FastAPI:
    app = FastAPI(title="GuessSenpai API", version="0.1.0")

    origins = settings.cors_origins or ["*"]
    allow_origins = ["*"] if "*" in origins else origins

    app.add_middleware(
        CORSMiddleware,
        allow_origins=allow_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health.router, prefix="/health", tags=["health"])
    app.include_router(puzzles.router, prefix="/puzzles", tags=["puzzles"])
    app.include_router(profile.router, prefix="/profile", tags=["profile"])
    app.include_router(auth.router)

    register_database(app)

    return app


app = create_app()


@app.on_event("startup")
async def warm_puzzle_cache() -> None:
    try:
        await get_daily_puzzle(
            date.today(),
            include_guess_opening=settings.animethemes_enabled,
        )
    except Exception as exc:
        logger.warning("Failed to warm puzzle cache: %s", exc)
