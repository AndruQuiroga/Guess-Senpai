from __future__ import annotations

from fastapi import APIRouter, Request, Response, status
from pydantic import BaseModel, ConfigDict, Field, HttpUrl

from ..services.notifications import PushSubscription, register_subscription, remove_subscription
from ..services.session import SessionData, get_session_manager

router = APIRouter()


class SubscriptionEnvelope(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    subscription: PushSubscription
    user_agent: str | None = Field(default=None, alias="userAgent")


class UnsubscribePayload(BaseModel):
    endpoint: HttpUrl | str


async def _get_optional_session(request: Request) -> SessionData | None:
    token = request.cookies.get("guesssenpai_session")
    if not token:
        return None
    manager = await get_session_manager()
    session = await manager.get_session(token)
    return session


@router.post("/subscribe", status_code=status.HTTP_204_NO_CONTENT)
async def subscribe(request: Request, payload: SubscriptionEnvelope) -> Response:
    session = await _get_optional_session(request)
    await register_subscription(
        payload.subscription,
        user_id=session.user_id if session else None,
        user_agent=payload.user_agent,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/unsubscribe", status_code=status.HTTP_204_NO_CONTENT)
async def unsubscribe(payload: UnsubscribePayload) -> Response:
    endpoint = str(payload.endpoint)
    removed = await remove_subscription(endpoint)
    if not removed:
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
