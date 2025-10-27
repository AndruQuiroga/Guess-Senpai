from __future__ import annotations

import asyncio
import json
import logging
import time
from datetime import date
from typing import Any, List, Optional

from pydantic import BaseModel, ConfigDict, Field, HttpUrl
from pywebpush import WebPushException, webpush

from ..core.config import settings
from ..puzzles.engine import get_daily_puzzle
from ..puzzles.models import DailyPuzzleResponse, SolutionPayload
from ..services.cache import get_cache

logger = logging.getLogger(__name__)

SUBSCRIPTIONS_KEY = "guesssenpai:webpush:subscriptions"
LAST_DISPATCH_KEY = "guesssenpai:webpush:last-dispatch"
DEFAULT_NOTIFICATION_ICON = "/icons/icon-192.svg"
DEFAULT_NOTIFICATION_TAG = "guesssenpai-daily"


class PushKeys(BaseModel):
    p256dh: str
    auth: str


class PushSubscription(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    endpoint: HttpUrl
    expiration_time: Optional[int] = Field(default=None, alias="expirationTime")
    keys: PushKeys


class StoredSubscription(PushSubscription):
    model_config = ConfigDict(populate_by_name=True)

    user_id: Optional[int] = Field(default=None, alias="userId")
    user_agent: Optional[str] = Field(default=None, alias="userAgent")
    created_at: float = Field(default_factory=lambda: time.time(), alias="createdAt")


class NotificationDispatchResult(BaseModel):
    attempted: int = 0
    delivered: int = 0
    removed: int = 0
    skipped: bool = False
    reason: Optional[str] = None


async def _load_subscriptions() -> List[StoredSubscription]:
    cache = await get_cache(settings.redis_url)
    raw = await cache.get(SUBSCRIPTIONS_KEY)
    if not raw:
        return []

    subscriptions: List[StoredSubscription] = []
    for entry in raw:
        try:
            subscriptions.append(StoredSubscription.model_validate(entry))
        except Exception:
            continue
    return subscriptions


async def _persist_subscriptions(subscriptions: List[StoredSubscription]) -> None:
    cache = await get_cache(settings.redis_url)
    payload = [subscription.model_dump(by_alias=True) for subscription in subscriptions]
    await cache.set(SUBSCRIPTIONS_KEY, payload)


async def register_subscription(
    subscription: PushSubscription,
    *,
    user_id: Optional[int] = None,
    user_agent: Optional[str] = None,
) -> StoredSubscription:
    """Persist or update the provided subscription entry."""

    existing = await _load_subscriptions()
    filtered = [entry for entry in existing if entry.endpoint != subscription.endpoint]
    stored = StoredSubscription(
        endpoint=subscription.endpoint,
        expiration_time=subscription.expiration_time,
        keys=subscription.keys,
        user_id=user_id,
        user_agent=user_agent,
        created_at=time.time(),
    )
    filtered.append(stored)
    await _persist_subscriptions(filtered)
    return stored


async def remove_subscription(endpoint: str) -> bool:
    """Remove the subscription for the given endpoint if it exists."""

    existing = await _load_subscriptions()
    filtered = [entry for entry in existing if str(entry.endpoint) != endpoint]
    if len(filtered) == len(existing):
        return False
    await _persist_subscriptions(filtered)
    return True


def _preferred_title(solution: Optional[SolutionPayload]) -> Optional[str]:
    if solution is None:
        return None
    titles = solution.titles
    for attr in ("userPreferred", "english", "romaji", "native"):
        value = getattr(titles, attr, None)
        if value:
            return value
    return None


def _build_daily_payload(puzzle: DailyPuzzleResponse, puzzle_date: date) -> dict[str, Any]:
    primary_title = _preferred_title(puzzle.games.anidle.solution)
    if not primary_title:
        primary_title = _preferred_title(puzzle.games.poster_zoomed.solution)
    if not primary_title:
        primary_title = _preferred_title(puzzle.games.character_silhouette.solution)
    if not primary_title:
        primary_title = _preferred_title(puzzle.games.redacted_synopsis.solution)

    streak_hint = "Keep your streak alive" if primary_title else "Your daily challenge awaits"
    headline = primary_title or "New GuessSenpai puzzles"

    base_url = str(settings.frontend_base_url or "https://guesssenpai.com").rstrip("/")
    target_url = f"{base_url}/games/daily"
    icon_url = f"{base_url}{DEFAULT_NOTIFICATION_ICON}" if base_url else DEFAULT_NOTIFICATION_ICON

    media_ids = [
        puzzle.games.anidle.mediaId,
        puzzle.games.poster_zoomed.mediaId,
        puzzle.games.character_silhouette.mediaId,
        puzzle.games.redacted_synopsis.mediaId,
    ]
    guess_opening = puzzle.games.guess_the_opening
    if guess_opening is not None:
        media_ids.append(guess_opening.mediaId)

    return {
        "title": "GuessSenpai Daily is live",
        "body": f"{headline} just landed. {streak_hint}.",
        "icon": icon_url,
        "badge": icon_url,
        "tag": f"{DEFAULT_NOTIFICATION_TAG}-{puzzle_date.isoformat()}",
        "data": {
            "url": target_url,
            "date": puzzle_date.isoformat(),
            "mediaIds": media_ids,
        },
        "renotify": False,
        "requireInteraction": False,
    }


async def dispatch_daily_notifications(puzzle_date: Optional[date] = None) -> NotificationDispatchResult:
    """Deliver daily puzzle notifications to all active subscribers."""

    result = NotificationDispatchResult()

    if not settings.web_push_vapid_private_key or not settings.web_push_vapid_public_key:
        result.skipped = True
        result.reason = "missing_credentials"
        return result

    subscriptions = await _load_subscriptions()
    if not subscriptions:
        result.skipped = True
        result.reason = "no_subscribers"
        return result

    cache = await get_cache(settings.redis_url)
    target_date = puzzle_date or date.today()
    last_dispatched = await cache.get(LAST_DISPATCH_KEY)
    if isinstance(last_dispatched, str) and last_dispatched == target_date.isoformat():
        result.skipped = True
        result.reason = "already_dispatched"
        return result

    puzzle = await get_daily_puzzle(
        target_date,
        include_guess_opening=settings.animethemes_enabled,
    )
    payload = _build_daily_payload(puzzle, target_date)

    vapid_claims = {
        "sub": settings.web_push_contact or "mailto:notifications@guesssenpai.com",
    }

    for entry in list(subscriptions):
        result.attempted += 1
        try:
            await asyncio.to_thread(
                webpush,
                subscription_info={
                    "endpoint": str(entry.endpoint),
                    "keys": {
                        "p256dh": entry.keys.p256dh,
                        "auth": entry.keys.auth,
                    },
                },
                data=json.dumps(payload),
                vapid_private_key=settings.web_push_vapid_private_key,
                vapid_claims=vapid_claims,
                timeout=10,
            )
            result.delivered += 1
        except WebPushException as exc:  # pragma: no cover - network errors not deterministic
            status_code = getattr(exc.response, "status_code", None)
            if status_code in {404, 410}:
                await remove_subscription(str(entry.endpoint))
                result.removed += 1
            logger.warning("Failed to deliver push notification to %s: %s", entry.endpoint, exc)
        except Exception as exc:  # pragma: no cover - safeguard for unexpected issues
            logger.warning("Unexpected error delivering push notification to %s: %s", entry.endpoint, exc)

    await cache.set(LAST_DISPATCH_KEY, target_date.isoformat())
    return result


__all__ = [
    "PushSubscription",
    "StoredSubscription",
    "NotificationDispatchResult",
    "register_subscription",
    "remove_subscription",
    "dispatch_daily_notifications",
]
