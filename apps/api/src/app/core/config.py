from __future__ import annotations

from functools import lru_cache
from typing import List, Optional

from pydantic import Field, HttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration derived from environment variables."""

    api_port: int = Field(default=8000, alias="API_PORT")
    cors_origins: List[str] = Field(default_factory=lambda: ["http://localhost:3000"], alias="CORS_ORIGINS")
    frontend_base_url: Optional[HttpUrl] = Field(default=None, alias="FRONTEND_BASE_URL")

    anilist_client_id: Optional[str] = Field(default=None, alias="ANILIST_CLIENT_ID")
    anilist_client_secret: Optional[str] = Field(default=None, alias="ANILIST_CLIENT_SECRET")
    anilist_redirect_uri: Optional[HttpUrl] = Field(default=None, alias="ANILIST_REDIRECT_URI")
    anilist_cache_ttl_seconds: int = Field(default=86_400, alias="ANILIST_CACHE_TTL_SECONDS")
    puzzle_cache_ttl_seconds: int = Field(default=172_800, alias="PUZZLE_CACHE_TTL_SECONDS")
    puzzle_history_days: int = Field(default=14, alias="PUZZLE_HISTORY_DAYS")

    animethemes_enabled: bool = Field(default=True, alias="ANIMETHEMES_ENABLED")
    guess_opening_pool_enabled: bool = Field(default=True, alias="GUESS_OPENING_POOL_ENABLED")

    session_secret: str = Field(default="dev-insecure-session-secret", alias="SESSION_SECRET")

    redis_url: Optional[str] = Field(default=None, alias="REDIS_URL")

    web_push_vapid_public_key: Optional[str] = Field(default=None, alias="WEB_PUSH_VAPID_PUBLIC_KEY")
    web_push_vapid_private_key: Optional[str] = Field(default=None, alias="WEB_PUSH_VAPID_PRIVATE_KEY")
    web_push_contact: Optional[str] = Field(default=None, alias="WEB_PUSH_CONTACT")

    database_url: str = Field(
        default="postgresql+asyncpg://guesssenpai:guesssenpai@postgres:5432/guesssenpai",
        alias="DATABASE_URL",
    )
    alembic_ini_path: str = Field(default="alembic.ini", alias="ALEMBIC_INI_PATH")
    alembic_migrations_path: str = Field(default="alembic", alias="ALEMBIC_MIGRATIONS_PATH")

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
