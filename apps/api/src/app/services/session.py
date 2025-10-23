from __future__ import annotations

import asyncio
import json
import secrets
import time
from dataclasses import asdict, dataclass
from typing import Dict, Optional

from itsdangerous import BadSignature, URLSafeSerializer

from ..core.config import settings
from .cache import CacheBackend, get_cache

STATE_PREFIX = "guesssenpai:auth:state:"
SESSION_PREFIX = "guesssenpai:auth:session:"


@dataclass
class StateData:
    redirect_to: Optional[str]
    created_at: float


@dataclass
class SessionData:
    user_id: int
    username: Optional[str]
    avatar: Optional[str]
    access_token: str
    expires_at: float
    created_at: float


class SessionManager:
    """Session/state helper backed by the configured cache backend."""

    def __init__(self, secret: str, cache: CacheBackend, state_ttl: int = 600) -> None:
        self.serializer = URLSafeSerializer(secret, salt="guesssenpai-session")
        self.state_ttl = state_ttl
        self.cache = cache

    async def issue_state(self, redirect_to: Optional[str]) -> str:
        state_id = secrets.token_urlsafe(16)
        signed = self.serializer.dumps(state_id)
        data = {"redirect_to": redirect_to, "created_at": time.time()}
        await self.cache.set(f"{STATE_PREFIX}{state_id}", data, ttl=self.state_ttl)
        return signed

    async def consume_state(self, state_token: str) -> Optional[StateData]:
        try:
            state_id = self.serializer.loads(state_token)
        except BadSignature:
            return None
        key = f"{STATE_PREFIX}{state_id}"
        payload = await self.cache.get(key)
        if payload is None:
            return None
        await self.cache.set(key, None, ttl=1)  # expire immediately
        if isinstance(payload, dict):
            return StateData(redirect_to=payload.get("redirect_to"), created_at=payload.get("created_at", 0.0))
        return None

    async def issue_session(self, session: SessionData) -> str:
        session_id = secrets.token_urlsafe(24)
        signed = self.serializer.dumps(session_id)
        ttl = max(1, int(session.expires_at - time.time()))
        await self.cache.set(f"{SESSION_PREFIX}{session_id}", asdict(session), ttl=ttl)
        return signed

    async def get_session(self, signed_session_id: str) -> Optional[SessionData]:
        try:
            session_id = self.serializer.loads(signed_session_id)
        except BadSignature:
            return None
        payload = await self.cache.get(f"{SESSION_PREFIX}{session_id}")
        if not isinstance(payload, dict):
            return None
        expires_at = payload.get("expires_at")
        if expires_at and expires_at < time.time():
            await self.cache.set(f"{SESSION_PREFIX}{session_id}", None, ttl=1)
            return None
        return SessionData(
            user_id=int(payload.get("user_id")),
            username=payload.get("username"),
            avatar=payload.get("avatar"),
            access_token=payload.get("access_token"),
            expires_at=payload.get("expires_at", 0.0),
            created_at=payload.get("created_at", 0.0),
        )

    async def revoke_session(self, signed_session_id: str) -> None:
        try:
            session_id = self.serializer.loads(signed_session_id)
        except BadSignature:
            return
        await self.cache.set(f"{SESSION_PREFIX}{session_id}", None, ttl=1)


_session_manager: Optional[SessionManager] = None
_session_lock = asyncio.Lock()


async def get_session_manager() -> SessionManager:
    global _session_manager
    if _session_manager is not None:
        return _session_manager
    async with _session_lock:
        if _session_manager is None:
            cache = await get_cache(settings.redis_url)
            _session_manager = SessionManager(
                secret=settings.session_secret,
                cache=cache,
                state_ttl=600,
            )
    return _session_manager
