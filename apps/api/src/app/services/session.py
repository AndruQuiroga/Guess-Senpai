from __future__ import annotations

import asyncio
import hashlib
import secrets
import time
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Dict, Optional

from itsdangerous import BadSignature, URLSafeSerializer
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from ..core.config import settings
from ..core.database import get_session_factory
from ..db import models
from .cache import CacheBackend, get_cache

STATE_PREFIX = "guesssenpai:auth:state:"


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
    refresh_token: Optional[str] = None
    refresh_expires_at: Optional[float] = None
    session_id: Optional[str] = None


class SessionManager:
    """Manage AniList OAuth state and persisted sessions."""

    def __init__(
        self,
        secret: str,
        cache: CacheBackend,
        state_ttl: int = 600,
    ) -> None:
        self.serializer = URLSafeSerializer(secret, salt="guesssenpai-session")
        self.state_ttl = state_ttl
        self.cache = cache
        self.session_factory = get_session_factory()
        self._hash_secret = secret

    async def issue_state(self, redirect_to: Optional[str]) -> str:
        state_id = secrets.token_urlsafe(16)
        signed = self.serializer.dumps(state_id)
        data: Dict[str, Optional[str] | float] = {
            "redirect_to": redirect_to,
            "created_at": time.time(),
        }
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
        await self.cache.set(key, None, ttl=1)
        if isinstance(payload, dict):
            return StateData(redirect_to=payload.get("redirect_to"), created_at=payload.get("created_at", 0.0))
        return None

    def _hash_session_token(self, session_id: str) -> str:
        token = f"{session_id}:{self._hash_secret}".encode("utf-8")
        return hashlib.sha256(token).hexdigest()

    async def issue_session(self, session: SessionData) -> str:
        session_id = str(uuid.uuid4())
        signed = self.serializer.dumps(session_id)
        issued_at = datetime.fromtimestamp(session.created_at, tz=timezone.utc)
        access_expires_at = datetime.fromtimestamp(session.expires_at, tz=timezone.utc)
        refresh_expires_at = (
            datetime.fromtimestamp(session.refresh_expires_at, tz=timezone.utc)
            if session.refresh_expires_at
            else None
        )
        token_hash = self._hash_session_token(session_id)

        session_factory = self.session_factory
        async with session_factory() as db_session:
            try:
                user = await db_session.get(models.User, session.user_id)
                if user is None:
                    user = models.User(
                        id=session.user_id,
                        username=session.username,
                        avatar=session.avatar,
                        access_token=session.access_token,
                        access_token_expires_at=access_expires_at,
                        refresh_token=session.refresh_token,
                        refresh_token_expires_at=refresh_expires_at,
                    )
                    db_session.add(user)
                else:
                    user.username = session.username
                    user.avatar = session.avatar
                    user.access_token = session.access_token
                    user.access_token_expires_at = access_expires_at
                    user.refresh_token = session.refresh_token
                    user.refresh_token_expires_at = refresh_expires_at

                db_session.add(
                    models.Session(
                        id=session_id,
                        user=user,
                        token_hash=token_hash,
                        issued_at=issued_at,
                        expires_at=access_expires_at,
                    )
                )
                await db_session.commit()
            except Exception:
                await db_session.rollback()
                raise
        session.session_id = session_id
        return signed

    async def get_session(self, signed_session_id: str) -> Optional[SessionData]:
        try:
            session_id = self.serializer.loads(signed_session_id)
        except BadSignature:
            return None
        if not isinstance(session_id, str):
            return None
        return await self.get_session_by_id(session_id)

    async def get_session_by_id(self, session_id: str) -> Optional[SessionData]:
        session_factory = self.session_factory
        async with session_factory() as db_session:
            try:
                result = await db_session.execute(
                    select(models.Session)
                    .options(selectinload(models.Session.user))
                    .where(models.Session.id == session_id)
                )
                stored_session = result.scalar_one_or_none()
                if stored_session is None:
                    await db_session.commit()
                    return None
                if stored_session.revoked_at is not None:
                    await db_session.commit()
                    return None
                if stored_session.token_hash != self._hash_session_token(session_id):
                    await db_session.commit()
                    return None

                now = datetime.now(timezone.utc)
                if stored_session.expires_at <= now:
                    stored_session.revoked_at = now
                    await db_session.commit()
                    return None

                user = stored_session.user
                if user is None:
                    await db_session.commit()
                    return None

                data = SessionData(
                    session_id=stored_session.id,
                    user_id=user.id,
                    username=user.username,
                    avatar=user.avatar,
                    access_token=user.access_token,
                    expires_at=stored_session.expires_at.timestamp(),
                    created_at=stored_session.issued_at.timestamp(),
                    refresh_token=user.refresh_token,
                    refresh_expires_at=(
                        user.refresh_token_expires_at.timestamp() if user.refresh_token_expires_at else None
                    ),
                )
                await db_session.commit()
                return data
            except Exception:
                await db_session.rollback()
                raise

    async def revoke_session(self, signed_session_id: str) -> None:
        try:
            session_id = self.serializer.loads(signed_session_id)
        except BadSignature:
            return
        if not isinstance(session_id, str):
            return
        await self.revoke_session_by_id(session_id)

    async def revoke_session_by_id(self, session_id: str) -> None:
        session_factory = self.session_factory
        async with session_factory() as db_session:
            try:
                result = await db_session.execute(
                    select(models.Session).where(models.Session.id == session_id)
                )
                stored_session = result.scalar_one_or_none()
                if stored_session is None:
                    await db_session.commit()
                    return
                stored_session.revoked_at = datetime.now(timezone.utc)
                await db_session.commit()
            except Exception:
                await db_session.rollback()
                raise


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
