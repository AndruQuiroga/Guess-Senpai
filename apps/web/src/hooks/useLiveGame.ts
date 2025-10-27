"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

const STORAGE_KEY = "guesssenpai-live-player";

function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function normalizeTimestamp(value: unknown): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return Date.now();
  }
  if (value > 10_000_000_000) {
    return value;
  }
  return Math.round(value * 1000);
}

function toWebSocketUrl(base: string): string {
  if (base.startsWith("https://")) {
    return `wss://${base.slice("https://".length)}`;
  }
  if (base.startsWith("http://")) {
    return `ws://${base.slice("http://".length)}`;
  }
  return base.replace(/^http/, "ws");
}

const WS_BASE = toWebSocketUrl(API_BASE);

type ConnectionStatus = "idle" | "connecting" | "open" | "closed" | "error";

export interface LivePlayerProfile {
  id?: string;
  name?: string | null;
  avatar?: string | null;
}

export interface LobbyPlayer {
  id: string;
  name?: string | null;
  avatar?: string | null;
  ready: boolean;
  lastActive?: number;
}

export interface ReactionEvent {
  id: string;
  playerId: string;
  emoji: string;
  timestamp: number;
}

export interface LobbyState {
  id: string;
  slug: string;
  countdown: number | null;
  updatedAt: number;
  players: LobbyPlayer[];
  reactions: ReactionEvent[];
}

export interface GuessEvent {
  id: string;
  playerId: string;
  guess: string;
  timestamp: number;
  optimistic?: boolean;
}

export interface TimerState {
  remaining: number | null;
  running: boolean;
  updatedAt: number;
}

export interface MatchState {
  id: string;
  slug: string;
  updatedAt: number;
  guesses: GuessEvent[];
  timer: TimerState;
  players: Array<Omit<LobbyPlayer, "ready">>;
}

export interface UseLiveGameOptions {
  slug: string;
  lobbyId: string;
  matchId: string;
  player: LivePlayerProfile;
  autoReconnect?: boolean;
}

interface QueuedMessage {
  type: string;
  payload: Record<string, unknown>;
}

interface UseLiveGameState {
  lobby: LobbyState | null;
  match: MatchState | null;
  lobbyStatus: ConnectionStatus;
  matchStatus: ConnectionStatus;
  offlineMode: boolean;
  lastError: Error | null;
  reactions: ReactionEvent[];
  playerId: string;
  toggleReady(next?: boolean): void;
  sendReaction(emoji: string): void;
  sendGuess(guess: string): void;
  setTimer(remaining: number | null, running: boolean): void;
  setCountdown(seconds: number | null): void;
  requestSync(): void;
  reconnect(): void;
}

function getStoredPlayerId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored || null;
  } catch (error) {
    console.warn("Failed to read live player id", error);
    return null;
  }
}

function setStoredPlayerId(id: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
  } catch (error) {
    console.warn("Failed to persist live player id", error);
  }
}

function resolvePlayerId(profile: LivePlayerProfile): string {
  if (profile.id) {
    return profile.id;
  }
  if (typeof window !== "undefined") {
    const stored = getStoredPlayerId();
    if (stored) {
      return stored;
    }
  }
  const generated = generateId();
  setStoredPlayerId(generated);
  return generated;
}

function appendUniqueGuess(list: GuessEvent[], event: GuessEvent): GuessEvent[] {
  const exists = list.some((entry) => entry.id === event.id);
  if (exists) {
    return list.map((entry) =>
      entry.id === event.id ? { ...entry, ...event, optimistic: false } : entry,
    );
  }
  return [...list, event];
}

function appendUniqueReaction(
  list: ReactionEvent[],
  event: ReactionEvent,
): ReactionEvent[] {
  if (list.some((entry) => entry.id === event.id)) {
    return list;
  }
  return [...list.slice(-19), event];
}

export function useLiveGame(options: UseLiveGameOptions): UseLiveGameState {
  const playerIdState = useMemo(() => resolvePlayerId(options.player), [options.player]);
  const [lobbyStatus, setLobbyStatus] = useState<ConnectionStatus>("idle");
  const [matchStatus, setMatchStatus] = useState<ConnectionStatus>("idle");
  const [lobby, setLobby] = useState<LobbyState | null>(null);
  const [match, setMatch] = useState<MatchState | null>(null);
  const [reactions, setReactions] = useState<ReactionEvent[]>([]);
  const [lastError, setLastError] = useState<Error | null>(null);

  const lobbySocketRef = useRef<WebSocket | null>(null);
  const matchSocketRef = useRef<WebSocket | null>(null);
  const lobbyQueueRef = useRef<QueuedMessage[]>([]);
  const matchQueueRef = useRef<QueuedMessage[]>([]);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const playerProfile = useMemo(() => {
    const base = options.player;
    if (typeof window !== "undefined") {
      const stored = getStoredPlayerId();
      if (!stored) {
        setStoredPlayerId(playerIdState);
      }
    }
    return {
      ...base,
      id: playerIdState,
    };
  }, [options.player, playerIdState]);

  const offlineMode = useMemo(() => {
    return lobbyStatus !== "open" || matchStatus !== "open";
  }, [lobbyStatus, matchStatus]);

  const closeSockets = useCallback(() => {
    if (lobbySocketRef.current) {
      lobbySocketRef.current.close();
      lobbySocketRef.current = null;
    }
    if (matchSocketRef.current) {
      matchSocketRef.current.close();
      matchSocketRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      closeSockets();
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [closeSockets]);

  const connectSockets = useCallback(() => {
    if (typeof window === "undefined") return;

    closeSockets();
    setLobbyStatus("connecting");
    setMatchStatus("connecting");
    setLastError(null);

    const urlParams = new URLSearchParams();
    urlParams.set("playerId", playerProfile.id ?? "guest");
    if (playerProfile.name) {
      urlParams.set("name", playerProfile.name);
    }
    if (playerProfile.avatar) {
      urlParams.set("avatar", playerProfile.avatar);
    }

    const lobbyUrl = `${WS_BASE}/live/lobby/${options.slug}/${options.lobbyId}?${urlParams.toString()}`;
    const matchUrl = `${WS_BASE}/live/match/${options.slug}/${options.matchId}?${urlParams.toString()}`;

    const lobbySocket = new WebSocket(lobbyUrl);
    lobbySocketRef.current = lobbySocket;

    lobbySocket.addEventListener("open", () => {
      setLobbyStatus("open");
      const queue = lobbyQueueRef.current.splice(0, lobbyQueueRef.current.length);
      queue.forEach((item) => {
        lobbySocket.send(JSON.stringify({ ...item.payload, type: item.type }));
      });
      lobbySocket.send(JSON.stringify({ type: "sync" }));
    });

    lobbySocket.addEventListener("message", (event) => {
      try {
        const payload = JSON.parse(event.data as string);
        if (payload.type === "lobby_state" && payload.lobby) {
          const lobbyPayload = payload.lobby as LobbyState;
          const normalizedPlayers = (lobbyPayload.players ?? []).map((entry) => ({
            ...entry,
            lastActive:
              entry.lastActive !== undefined ? normalizeTimestamp(entry.lastActive) : undefined,
          }));
          const normalizedReactions = (lobbyPayload.reactions ?? []).map((reaction) => ({
            ...reaction,
            timestamp: normalizeTimestamp(reaction.timestamp),
          }));
          setLobby({
            ...lobbyPayload,
            updatedAt: normalizeTimestamp(lobbyPayload.updatedAt),
            countdown:
              lobbyPayload.countdown === null || lobbyPayload.countdown === undefined
                ? null
                : lobbyPayload.countdown,
            players: normalizedPlayers,
            reactions: normalizedReactions,
          });
          setReactions(normalizedReactions);
        } else if (payload.type === "reaction" && payload.event) {
          const eventPayload = payload.event as ReactionEvent;
          const normalized = {
            ...eventPayload,
            timestamp: normalizeTimestamp(eventPayload.timestamp),
          };
          setReactions((prev) => appendUniqueReaction(prev, normalized));
        }
      } catch (error) {
        console.warn("Failed to parse lobby message", error);
      }
    });

    lobbySocket.addEventListener("close", () => {
      setLobbyStatus("closed");
    });

    lobbySocket.addEventListener("error", (error) => {
      setLobbyStatus("error");
      setLastError(error as Error);
    });

    const matchSocket = new WebSocket(matchUrl);
    matchSocketRef.current = matchSocket;

    matchSocket.addEventListener("open", () => {
      setMatchStatus("open");
      const queue = matchQueueRef.current.splice(0, matchQueueRef.current.length);
      queue.forEach((item) => {
        matchSocket.send(JSON.stringify({ ...item.payload, type: item.type }));
      });
      matchSocket.send(JSON.stringify({ type: "sync" }));
    });

    matchSocket.addEventListener("message", (event) => {
      try {
        const payload = JSON.parse(event.data as string);
        if (payload.type === "match_state" && payload.state) {
          const state = payload.state as MatchState;
          const normalizedState: MatchState = {
            ...state,
            updatedAt: normalizeTimestamp(state.updatedAt),
            guesses: (state.guesses ?? []).map((entry) => ({
              ...entry,
              timestamp: normalizeTimestamp(entry.timestamp),
            })),
            timer: {
              remaining: state.timer?.remaining ?? null,
              running: Boolean(state.timer?.running),
              updatedAt: normalizeTimestamp(state.timer?.updatedAt),
            },
            players: (state.players ?? []).map((entry) => ({
              ...entry,
              lastActive:
                entry.lastActive !== undefined
                  ? normalizeTimestamp(entry.lastActive)
                  : undefined,
            })),
          };
          setMatch(normalizedState);
        } else if (payload.type === "guess" && payload.event) {
          const eventPayload = payload.event as GuessEvent;
          const normalizedEvent = {
            ...eventPayload,
            timestamp: normalizeTimestamp(eventPayload.timestamp),
          };
          setMatch((prev) => {
            if (!prev) {
              return {
                id: options.matchId,
                slug: options.slug,
                updatedAt: Date.now(),
                guesses: [normalizedEvent],
                timer: { remaining: null, running: false, updatedAt: Date.now() },
                players: [],
              };
            }
            return {
              ...prev,
              updatedAt: Date.now(),
              guesses: appendUniqueGuess(prev.guesses, normalizedEvent),
            };
          });
        } else if (payload.type === "timer" && payload.timer) {
          const timerPayload = payload.timer as TimerState;
          const normalizedTimer: TimerState = {
            remaining: timerPayload.remaining ?? null,
            running: Boolean(timerPayload.running),
            updatedAt: normalizeTimestamp(timerPayload.updatedAt),
          };
          setMatch((prev) => {
            if (!prev) {
              return {
                id: options.matchId,
                slug: options.slug,
                updatedAt: Date.now(),
                guesses: [],
                timer: normalizedTimer,
                players: [],
              };
            }
            return {
              ...prev,
              timer: normalizedTimer,
            };
          });
        }
      } catch (error) {
        console.warn("Failed to parse match message", error);
      }
    });

    matchSocket.addEventListener("close", () => {
      setMatchStatus("closed");
    });

    matchSocket.addEventListener("error", (error) => {
      setMatchStatus("error");
      setLastError(error as Error);
    });
  }, [closeSockets, options.slug, options.lobbyId, options.matchId, playerProfile]);

  useEffect(() => {
    connectSockets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.slug, options.lobbyId, options.matchId, playerProfile.id]);

  useEffect(() => {
    if (!options.autoReconnect) return;
    if (!offlineMode) return;
    if (reconnectTimeoutRef.current) {
      return;
    }
    reconnectTimeoutRef.current = setTimeout(() => {
      reconnectTimeoutRef.current = null;
      connectSockets();
    }, 3000);
  }, [offlineMode, options.autoReconnect, connectSockets]);

  const sendLobbyMessage = useCallback(
    (type: string, payload: Record<string, unknown>) => {
      const socket = lobbySocketRef.current;
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type, ...payload }));
        return;
      }
      lobbyQueueRef.current.push({ type, payload });
    },
    [],
  );

  const sendMatchMessage = useCallback(
    (type: string, payload: Record<string, unknown>) => {
      const socket = matchSocketRef.current;
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type, ...payload }));
        return;
      }
      matchQueueRef.current.push({ type, payload });
      if (type === "guess") {
        const eventId = String(payload.eventId ?? payload.id ?? generateId());
        const guess = String(payload.guess ?? "");
        if (guess) {
          const event: GuessEvent = {
            id: eventId,
            playerId: playerProfile.id ?? "guest",
            guess,
            timestamp: Date.now(),
            optimistic: true,
          };
          setMatch((prev) => {
            if (!prev) {
              return {
                id: options.matchId,
                slug: options.slug,
                updatedAt: Date.now(),
                guesses: [event],
                timer: { remaining: null, running: false, updatedAt: Date.now() },
                players: [],
              };
            }
            return {
              ...prev,
              guesses: appendUniqueGuess(prev.guesses, event),
            };
          });
        }
      }
    },
    [options.matchId, options.slug, playerProfile.id],
  );

  const toggleReady = useCallback(
    (next?: boolean) => {
      let ready = next;
      if (ready === undefined && lobby) {
        const self = lobby.players.find((entry) => entry.id === playerProfile.id);
        ready = !self?.ready;
      }
      sendLobbyMessage("ready", { ready: Boolean(ready) });
      setLobby((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          players: prev.players.map((entry) =>
            entry.id === playerProfile.id
              ? { ...entry, ready: ready ?? !entry.ready }
              : entry,
          ),
        };
      });
    },
    [lobby, playerProfile.id, sendLobbyMessage],
  );

  const sendReaction = useCallback(
    (emoji: string) => {
      if (!emoji) return;
      const eventId = generateId();
      sendLobbyMessage("reaction", { emoji, eventId });
      const optimistic: ReactionEvent = {
        id: eventId,
        emoji,
        playerId: playerProfile.id ?? "guest",
        timestamp: Date.now(),
      };
      setReactions((prev) => appendUniqueReaction(prev, optimistic));
    },
    [playerProfile.id, sendLobbyMessage],
  );

  const sendGuess = useCallback(
    (guess: string) => {
      const trimmed = guess.trim();
      if (!trimmed) return;
      const eventId = generateId();
      sendMatchMessage("guess", { guess: trimmed, eventId });
      const optimistic: GuessEvent = {
        id: eventId,
        guess: trimmed,
        playerId: playerProfile.id ?? "guest",
        timestamp: Date.now(),
        optimistic: true,
      };
      setMatch((prev) => {
        if (!prev) {
          return {
            id: options.matchId,
            slug: options.slug,
            updatedAt: Date.now(),
            guesses: [optimistic],
            timer: { remaining: null, running: false, updatedAt: Date.now() },
            players: [],
          };
        }
        return {
          ...prev,
          guesses: appendUniqueGuess(prev.guesses, optimistic),
        };
      });
    },
    [options.matchId, options.slug, playerProfile.id, sendMatchMessage],
  );

  const setTimer = useCallback(
    (remaining: number | null, running: boolean) => {
      sendMatchMessage("timer", { remaining, running });
    },
    [sendMatchMessage],
  );

  const setCountdown = useCallback(
    (seconds: number | null) => {
      sendLobbyMessage("set_countdown", { seconds });
    },
    [sendLobbyMessage],
  );

  const requestSync = useCallback(() => {
    sendLobbyMessage("sync", {});
    sendMatchMessage("sync", {});
  }, [sendLobbyMessage, sendMatchMessage]);

  const reconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    connectSockets();
  }, [connectSockets]);

  return {
    lobby,
    match,
    lobbyStatus,
    matchStatus,
    offlineMode,
    lastError,
    reactions,
    playerId: playerProfile.id ?? "guest",
    toggleReady,
    sendReaction,
    sendGuess,
    setTimer,
    setCountdown,
    requestSync,
    reconnect,
  };
}
