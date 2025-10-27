from __future__ import annotations

import asyncio
import logging
import time
import uuid
from dataclasses import dataclass, field
from typing import Dict, Iterable, List, Optional, Tuple

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from starlette.websockets import WebSocketState


logger = logging.getLogger(__name__)

router = APIRouter()


@dataclass
class LobbyPlayer:
    id: str
    name: Optional[str]
    avatar: Optional[str]
    ready: bool = False
    last_active: float = field(default_factory=lambda: time.time())


@dataclass
class ReactionEvent:
    id: str
    player_id: str
    emoji: str
    timestamp: float


@dataclass
class LobbyState:
    slug: str
    lobby_id: str
    countdown: Optional[int] = None
    updated_at: float = field(default_factory=lambda: time.time())
    players: Dict[str, LobbyPlayer] = field(default_factory=dict)
    connections: Dict[str, WebSocket] = field(default_factory=dict)
    reactions: List[ReactionEvent] = field(default_factory=list)


@dataclass
class GuessEvent:
    id: str
    player_id: str
    guess: str
    timestamp: float


@dataclass
class MatchTimer:
    remaining: Optional[int] = None
    running: bool = False
    updated_at: float = field(default_factory=lambda: time.time())


@dataclass
class MatchState:
    slug: str
    match_id: str
    guesses: List[GuessEvent] = field(default_factory=list)
    timer: MatchTimer = field(default_factory=MatchTimer)
    connections: Dict[str, WebSocket] = field(default_factory=dict)
    players: Dict[str, LobbyPlayer] = field(default_factory=dict)
    seen_event_ids: set[str] = field(default_factory=set)


class LiveConnectionManager:
    def __init__(self) -> None:
        self.lobbies: Dict[Tuple[str, str], LobbyState] = {}
        self.matches: Dict[Tuple[str, str], MatchState] = {}
        self._lock = asyncio.Lock()

    @staticmethod
    def _lobby_key(slug: str, lobby_id: str) -> Tuple[str, str]:
        return (slug, lobby_id)

    @staticmethod
    def _match_key(slug: str, match_id: str) -> Tuple[str, str]:
        return (slug, match_id)

    async def connect_lobby(
        self,
        slug: str,
        lobby_id: str,
        player: LobbyPlayer,
        websocket: WebSocket,
    ) -> None:
        await websocket.accept()
        async with self._lock:
            key = self._lobby_key(slug, lobby_id)
            lobby = self.lobbies.get(key)
            if not lobby:
                lobby = LobbyState(slug=slug, lobby_id=lobby_id)
                self.lobbies[key] = lobby
            lobby.connections[player.id] = websocket
            existing = lobby.players.get(player.id)
            if existing:
                existing.name = player.name
                existing.avatar = player.avatar
                existing.last_active = time.time()
            else:
                lobby.players[player.id] = player
            lobby.updated_at = time.time()
        await websocket.send_json({
            "type": "welcome",
            "scope": "lobby",
            "playerId": player.id,
        })
        await self.broadcast_lobby_state(slug, lobby_id)

    async def disconnect_lobby(
        self,
        slug: str,
        lobby_id: str,
        player_id: str,
    ) -> None:
        async with self._lock:
            key = self._lobby_key(slug, lobby_id)
            lobby = self.lobbies.get(key)
            if not lobby:
                return
            lobby.connections.pop(player_id, None)
            lobby.players.pop(player_id, None)
            lobby.updated_at = time.time()
            if not lobby.connections:
                self.lobbies.pop(key, None)
                return
        await self.broadcast_lobby_state(slug, lobby_id)

    async def connect_match(
        self,
        slug: str,
        match_id: str,
        player: LobbyPlayer,
        websocket: WebSocket,
    ) -> None:
        await websocket.accept()
        async with self._lock:
            key = self._match_key(slug, match_id)
            match = self.matches.get(key)
            if not match:
                match = MatchState(slug=slug, match_id=match_id)
                self.matches[key] = match
            match.connections[player.id] = websocket
            existing = match.players.get(player.id)
            if existing:
                existing.name = player.name
                existing.avatar = player.avatar
                existing.last_active = time.time()
            else:
                match.players[player.id] = player
        await websocket.send_json({
            "type": "welcome",
            "scope": "match",
            "playerId": player.id,
        })
        await self.send_match_state(slug, match_id, websocket)

    async def disconnect_match(
        self,
        slug: str,
        match_id: str,
        player_id: str,
    ) -> None:
        async with self._lock:
            key = self._match_key(slug, match_id)
            match = self.matches.get(key)
            if not match:
                return
            match.connections.pop(player_id, None)
            if not match.connections:
                self.matches.pop(key, None)
                return
        await self.broadcast_match_state(slug, match_id)

    async def handle_lobby_message(
        self,
        slug: str,
        lobby_id: str,
        player_id: str,
        message: dict,
    ) -> None:
        message_type = message.get("type")
        if message_type == "ready":
            await self._handle_ready(slug, lobby_id, player_id, message)
        elif message_type == "reaction":
            await self._handle_reaction(slug, lobby_id, player_id, message)
        elif message_type == "set_countdown":
            await self._handle_countdown(slug, lobby_id, player_id, message)
        elif message_type == "sync":
            await self._handle_lobby_sync(slug, lobby_id, player_id)
        else:
            logger.debug("Unknown lobby message type: %s", message_type)

    async def _handle_ready(
        self,
        slug: str,
        lobby_id: str,
        player_id: str,
        message: dict,
    ) -> None:
        ready = bool(message.get("ready"))
        async with self._lock:
            lobby = self.lobbies.get(self._lobby_key(slug, lobby_id))
            if not lobby:
                return
            player = lobby.players.get(player_id)
            if not player:
                return
            player.ready = ready
            player.last_active = time.time()
            lobby.updated_at = time.time()
        await self.broadcast_lobby_state(slug, lobby_id)

    async def _handle_reaction(
        self,
        slug: str,
        lobby_id: str,
        player_id: str,
        message: dict,
    ) -> None:
        emoji = message.get("emoji")
        if not emoji or not isinstance(emoji, str):
            return
        timestamp = time.time()
        event = ReactionEvent(
            id=message.get("eventId") or str(uuid.uuid4()),
            player_id=player_id,
            emoji=emoji,
            timestamp=timestamp,
        )
        async with self._lock:
            lobby = self.lobbies.get(self._lobby_key(slug, lobby_id))
            if not lobby:
                return
            lobby.reactions.append(event)
            if len(lobby.reactions) > 50:
                lobby.reactions = lobby.reactions[-50:]
            player = lobby.players.get(player_id)
            if player:
                player.last_active = timestamp
            lobby.updated_at = timestamp
        payload = {
            "type": "reaction",
            "event": self._serialize_reaction(event),
        }
        await self._broadcast(lobby.connections.values(), payload)

    async def _handle_countdown(
        self,
        slug: str,
        lobby_id: str,
        player_id: str,
        message: dict,
    ) -> None:
        seconds_raw = message.get("seconds")
        seconds: Optional[int]
        if seconds_raw is None:
            seconds = None
        elif isinstance(seconds_raw, (int, float)):
            seconds = int(seconds_raw)
        else:
            return
        async with self._lock:
            lobby = self.lobbies.get(self._lobby_key(slug, lobby_id))
            if not lobby:
                return
            lobby.countdown = seconds
            lobby.updated_at = time.time()
            player = lobby.players.get(player_id)
            if player:
                player.last_active = lobby.updated_at
        await self.broadcast_lobby_state(slug, lobby_id)

    async def _handle_lobby_sync(
        self,
        slug: str,
        lobby_id: str,
        player_id: str,
    ) -> None:
        lobby = self.lobbies.get(self._lobby_key(slug, lobby_id))
        if not lobby:
            return
        websocket = lobby.connections.get(player_id)
        if not websocket:
            return
        await websocket.send_json({
            "type": "lobby_state",
            "lobby": self._serialize_lobby(lobby),
        })

    async def handle_match_message(
        self,
        slug: str,
        match_id: str,
        player_id: str,
        message: dict,
    ) -> None:
        message_type = message.get("type")
        if message_type == "guess":
            await self._handle_guess(slug, match_id, player_id, message)
        elif message_type == "timer":
            await self._handle_timer(slug, match_id, player_id, message)
        elif message_type == "sync":
            await self._handle_match_sync(slug, match_id, player_id)
        else:
            logger.debug("Unknown match message type: %s", message_type)

    async def _handle_guess(
        self,
        slug: str,
        match_id: str,
        player_id: str,
        message: dict,
    ) -> None:
        guess = message.get("guess")
        if not guess or not isinstance(guess, str):
            return
        guess = guess.strip()
        if not guess:
            return
        event_id = message.get("eventId") or str(uuid.uuid4())
        timestamp = time.time()
        async with self._lock:
            match = self.matches.get(self._match_key(slug, match_id))
            if not match:
                return
            if event_id in match.seen_event_ids:
                return
            match.seen_event_ids.add(event_id)
            event = GuessEvent(
                id=event_id,
                player_id=player_id,
                guess=guess,
                timestamp=timestamp,
            )
            match.guesses.append(event)
            if len(match.guesses) > 300:
                match.guesses = match.guesses[-300:]
            player = match.players.get(player_id)
            if player:
                player.last_active = timestamp
        payload = {
            "type": "guess",
            "event": self._serialize_guess(event),
        }
        await self.broadcast_match_event(slug, match_id, payload)

    async def _handle_timer(
        self,
        slug: str,
        match_id: str,
        player_id: str,
        message: dict,
    ) -> None:
        remaining_raw = message.get("remaining")
        running = bool(message.get("running"))
        remaining: Optional[int]
        if remaining_raw is None:
            remaining = None
        elif isinstance(remaining_raw, (int, float)):
            remaining = int(remaining_raw)
        else:
            return
        timestamp = time.time()
        async with self._lock:
            match = self.matches.get(self._match_key(slug, match_id))
            if not match:
                return
            match.timer.remaining = remaining
            match.timer.running = running
            match.timer.updated_at = timestamp
            player = match.players.get(player_id)
            if player:
                player.last_active = timestamp
        payload = {
            "type": "timer",
            "timer": self._serialize_timer(slug, match_id),
        }
        await self.broadcast_match_event(slug, match_id, payload)

    async def _handle_match_sync(
        self,
        slug: str,
        match_id: str,
        player_id: str,
    ) -> None:
        match = self.matches.get(self._match_key(slug, match_id))
        if not match:
            return
        websocket = match.connections.get(player_id)
        if not websocket:
            return
        await websocket.send_json({
            "type": "match_state",
            "state": self._serialize_match(match),
        })

    async def broadcast_lobby_state(self, slug: str, lobby_id: str) -> None:
        lobby = self.lobbies.get(self._lobby_key(slug, lobby_id))
        if not lobby:
            return
        payload = {
            "type": "lobby_state",
            "lobby": self._serialize_lobby(lobby),
        }
        await self._broadcast(lobby.connections.values(), payload)

    async def send_match_state(
        self,
        slug: str,
        match_id: str,
        websocket: WebSocket,
    ) -> None:
        match = self.matches.get(self._match_key(slug, match_id))
        if not match:
            return
        await websocket.send_json({
            "type": "match_state",
            "state": self._serialize_match(match),
        })

    async def broadcast_match_state(self, slug: str, match_id: str) -> None:
        match = self.matches.get(self._match_key(slug, match_id))
        if not match:
            return
        payload = {
            "type": "match_state",
            "state": self._serialize_match(match),
        }
        await self._broadcast(match.connections.values(), payload)

    async def broadcast_match_event(
        self,
        slug: str,
        match_id: str,
        payload: dict,
    ) -> None:
        match = self.matches.get(self._match_key(slug, match_id))
        if not match:
            return
        await self._broadcast(match.connections.values(), payload)

    async def _broadcast(
        self,
        connections: Iterable[WebSocket],
        payload: dict,
    ) -> None:
        send_tasks = []
        for connection in list(connections):
            if connection.client_state != WebSocketState.CONNECTED:
                continue
            send_tasks.append(connection.send_json(payload))
        if send_tasks:
            results = await asyncio.gather(*send_tasks, return_exceptions=True)
            for result in results:
                if isinstance(result, Exception):
                    logger.debug("Broadcast send failed: %s", result)

    def _serialize_lobby(self, lobby: LobbyState) -> dict:
        return {
            "id": lobby.lobby_id,
            "slug": lobby.slug,
            "countdown": lobby.countdown,
            "updatedAt": lobby.updated_at,
            "players": [
                {
                    "id": player.id,
                    "name": player.name,
                    "avatar": player.avatar,
                    "ready": player.ready,
                    "lastActive": player.last_active,
                }
                for player in lobby.players.values()
            ],
            "reactions": [self._serialize_reaction(event) for event in lobby.reactions],
        }

    def _serialize_match(self, match: MatchState) -> dict:
        return {
            "id": match.match_id,
            "slug": match.slug,
            "updatedAt": time.time(),
            "guesses": [self._serialize_guess(event) for event in match.guesses],
            "timer": self._serialize_timer(match.slug, match.match_id),
            "players": [
                {
                    "id": player.id,
                    "name": player.name,
                    "avatar": player.avatar,
                    "lastActive": player.last_active,
                }
                for player in match.players.values()
            ],
        }

    def _serialize_guess(self, event: GuessEvent) -> dict:
        return {
            "id": event.id,
            "playerId": event.player_id,
            "guess": event.guess,
            "timestamp": event.timestamp,
        }

    def _serialize_reaction(self, event: ReactionEvent) -> dict:
        return {
            "id": event.id,
            "playerId": event.player_id,
            "emoji": event.emoji,
            "timestamp": event.timestamp,
        }

    def _serialize_timer(self, slug: str, match_id: str) -> dict:
        match = self.matches.get(self._match_key(slug, match_id))
        timer = match.timer if match else MatchTimer()
        return {
            "remaining": timer.remaining,
            "running": timer.running,
            "updatedAt": timer.updated_at,
        }


manager = LiveConnectionManager()


def _build_player_from_query(websocket: WebSocket) -> LobbyPlayer:
    player_id = websocket.query_params.get("playerId") or str(uuid.uuid4())
    name = websocket.query_params.get("name")
    avatar = websocket.query_params.get("avatar")
    if avatar == "":
        avatar = None
    return LobbyPlayer(id=player_id, name=name, avatar=avatar)


@router.websocket("/lobby/{slug}/{lobby_id}")
async def lobby_socket(websocket: WebSocket, slug: str, lobby_id: str) -> None:
    player = _build_player_from_query(websocket)
    await manager.connect_lobby(slug, lobby_id, player, websocket)
    try:
        while True:
            message = await websocket.receive_json()
            await manager.handle_lobby_message(slug, lobby_id, player.id, message)
    except WebSocketDisconnect:
        await manager.disconnect_lobby(slug, lobby_id, player.id)
    except Exception as exc:  # pragma: no cover - safety net
        logger.warning("Lobby websocket closed due to error: %s", exc)
        await manager.disconnect_lobby(slug, lobby_id, player.id)


@router.websocket("/match/{slug}/{match_id}")
async def match_socket(websocket: WebSocket, slug: str, match_id: str) -> None:
    player = _build_player_from_query(websocket)
    await manager.connect_match(slug, match_id, player, websocket)
    try:
        while True:
            message = await websocket.receive_json()
            await manager.handle_match_message(slug, match_id, player.id, message)
    except WebSocketDisconnect:
        await manager.disconnect_match(slug, match_id, player.id)
    except Exception as exc:  # pragma: no cover - safety net
        logger.warning("Match websocket closed due to error: %s", exc)
        await manager.disconnect_match(slug, match_id, player.id)
