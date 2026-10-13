from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .core.config import settings
from .core.database import register_database
from .routers import auth, health, live, notifications, profile, puzzles



def create_app() -> FastAPI:
    app = FastAPI(title="GuessSenpai API", version="0.1.0")

    origins = [str(origin).rstrip("/") for origin in settings.cors_origins or []]

    if settings.frontend_base_url:
        frontend_origin = str(settings.frontend_base_url).rstrip("/")
        if frontend_origin and frontend_origin not in origins:
            origins.append(frontend_origin)

    if not origins:
        origins = ["*"]

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
    app.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
    app.include_router(profile.router, prefix="/profile", tags=["profile"])
    app.include_router(live.router, prefix="/live", tags=["live"])
    app.include_router(auth.router)

    register_database(app)

    return app


app = create_app()


# Daily publication is lazy. Upstream metadata/media work must not block startup
# or prevent health checks and unrelated routes from becoming available.
