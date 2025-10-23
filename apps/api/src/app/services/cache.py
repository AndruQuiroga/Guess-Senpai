from __future__ import annotations

import asyncio
import json
import time
from abc import ABC, abstractmethod
from typing import Any, Awaitable, Callable, Optional

from redis.asyncio import Redis


class CacheBackend(ABC):
    """Abstract cache contract supporting async usage."""

    @abstractmethod
    async def get(self, key: str) -> Any:
        raise NotImplementedError

    @abstractmethod
    async def set(self, key: str, value: Any, ttl: int | None = None) -> None:
        raise NotImplementedError

    async def remember(
        self,
        key: str,
        ttl: int | None,
        creator: Callable[[], Awaitable[Any]],
    ) -> Any:
        existing = await self.get(key)
        if existing is not None:
            return existing
        value = await creator()
        await self.set(key, value, ttl)
        return value


class InMemoryCache(CacheBackend):
    """Simple process-local cache with TTL support."""

    def __init__(self) -> None:
        self._store: dict[str, tuple[Any, float | None]] = {}
        self._lock = asyncio.Lock()

    async def get(self, key: str) -> Any:
        async with self._lock:
            entry = self._store.get(key)
            if not entry:
                return None
            value, expires_at = entry
            if expires_at is not None and expires_at < time.time():
                del self._store[key]
                return None
            return value

    async def set(self, key: str, value: Any, ttl: int | None = None) -> None:
        if value is None:
            async with self._lock:
                self._store.pop(key, None)
            return
        expires_at = time.time() + ttl if ttl else None
        async with self._lock:
            self._store[key] = (value, expires_at)


class RedisCache(CacheBackend):
    """Redis-backed cache."""

    def __init__(self, client: Redis) -> None:
        self._client = client

    async def get(self, key: str) -> Any:
        raw = await self._client.get(key)
        if raw is None:
            return None
        return json.loads(raw)

    async def set(self, key: str, value: Any, ttl: int | None = None) -> None:
        if value is None:
            await self._client.delete(key)
            return
        payload = json.dumps(value, ensure_ascii=False)
        if ttl:
            await self._client.set(key, payload, ex=ttl)
        else:
            await self._client.set(key, payload)


_cache: CacheBackend | None = None


async def get_cache(redis_url: str | None = None) -> CacheBackend:
    global _cache
    if _cache is not None:
        return _cache
    if redis_url:
        redis_client = Redis.from_url(redis_url, decode_responses=True)
        _cache = RedisCache(redis_client)
    else:
        _cache = InMemoryCache()
    return _cache
