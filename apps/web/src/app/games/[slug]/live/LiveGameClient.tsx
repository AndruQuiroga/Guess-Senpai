"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";

import {
  useLiveGame,
  type GuessEvent,
  type LobbyPlayer,
  type ReactionEvent,
} from "../../../../hooks/useLiveGame";
import { PuzzleSlugContent } from "../../../../components/puzzle-pages/PuzzleSlugContent";
import type { DailyPuzzleResponse } from "../../../../types/puzzles";
import type { PuzzleSlugDefinition } from "../slugs";

const REACTION_OPTIONS = ["🔥", "👏", "😮", "🎉", "❤️", "💥"];

interface LiveGameClientProps {
  slugDefinition: PuzzleSlugDefinition;
  puzzleData: DailyPuzzleResponse | null;
  lobbyId: string;
  matchId: string;
  playerProfile: {
    id?: string;
    name?: string | null;
    avatar?: string | null;
  };
  autoReconnect?: boolean;
}

function formatTimer(value: number | null): string {
  if (value === null || value === undefined) {
    return "--:--";
  }
  const minutes = Math.floor(value / 60);
  const seconds = Math.max(value % 60, 0);
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

function getPlayerLabel(player: LobbyPlayer | undefined, id: string): string {
  if (player?.name) {
    return player.name;
  }
  return `Player ${id.slice(0, 6)}`;
}

function Avatar({ player }: { player?: LobbyPlayer | null }) {
  if (player?.avatar) {
    return (
      <img
        src={player.avatar}
        alt={player.name ?? "Lobby player"}
        className="h-10 w-10 rounded-full border border-line-strong object-cover"
      />
    );
  }
  const fallback = player?.name?.slice(0, 2) ?? "GS";
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-panel-raised text-sm font-semibold uppercase text-paper">
      {fallback}
    </div>
  );
}

function ReactionFeed({
  reactions,
  players,
}: {
  reactions: ReactionEvent[];
  players: Map<string, LobbyPlayer>;
}) {
  if (!reactions.length) {
    return (
      <p className="text-sm text-muted">No reactions yet. Fire up the hype!</p>
    );
  }
  return (
    <ul className="space-y-2">
      {reactions
        .slice(-10)
        .reverse()
        .map((reaction) => {
          const player = players.get(reaction.playerId);
          const timestamp = new Date(reaction.timestamp).toLocaleTimeString();
          return (
            <li
              key={reaction.id}
              className="flex items-center justify-between rounded-lg border border-line bg-panel px-3 py-2 text-sm text-paper"
            >
              <div className="flex items-center gap-3">
                <span className="text-lg">{reaction.emoji}</span>
                <span>{getPlayerLabel(player, reaction.playerId)}</span>
              </div>
              <span className="text-xs text-muted">{timestamp}</span>
            </li>
          );
        })}
    </ul>
  );
}

export function LiveGameClient({
  slugDefinition,
  puzzleData,
  lobbyId,
  matchId,
  playerProfile,
  autoReconnect = true,
}: LiveGameClientProps) {
  const [guess, setGuess] = useState("");
  const [showFallback, setShowFallback] = useState(false);

  const {
    lobby,
    match,
    reactions,
    offlineMode,
    lobbyStatus,
    matchStatus,
    toggleReady,
    sendReaction,
    sendGuess,
    setTimer,
    setCountdown,
    playerId,
    reconnect,
  } = useLiveGame({
    slug: slugDefinition.slug,
    lobbyId,
    matchId,
    player: playerProfile,
    autoReconnect,
  });

  const playersById = useMemo(() => {
    const map = new Map<string, LobbyPlayer>();
    if (lobby) {
      lobby.players.forEach((player) => {
        map.set(player.id, player);
      });
    }
    if (match) {
      match.players.forEach((player) => {
        if (!map.has(player.id)) {
          map.set(player.id, { ...player, ready: false });
        }
      });
    }
    return map;
  }, [lobby, match]);

  const timerRemaining = match?.timer.remaining ?? null;
  const timerRunning = match?.timer.running ?? false;
  const timerUpdatedAt = match?.timer.updatedAt ?? Date.now();
  const [displayTimer, setDisplayTimer] = useState<number | null>(
    timerRemaining,
  );

  useEffect(() => {
    if (timerRemaining === null) {
      setDisplayTimer(null);
      return;
    }
    const updateDisplay = () => {
      if (!timerRunning) {
        setDisplayTimer(timerRemaining);
        return;
      }
      const elapsed = Math.floor((Date.now() - timerUpdatedAt) / 1000);
      setDisplayTimer(Math.max(timerRemaining - elapsed, 0));
    };
    updateDisplay();
    if (!timerRunning) {
      return;
    }
    const interval = window.setInterval(updateDisplay, 1000);
    return () => window.clearInterval(interval);
  }, [timerRemaining, timerRunning, timerUpdatedAt]);

  const recentGuesses = useMemo(() => {
    const history = match?.guesses ?? [];
    return [...history.slice(-20)].reverse();
  }, [match?.guesses]);

  const connectionLabel = useMemo(() => {
    if (!offlineMode) {
      return "Connected";
    }
    if (lobbyStatus === "connecting" || matchStatus === "connecting") {
      return "Connecting…";
    }
    if (lobbyStatus === "error" || matchStatus === "error") {
      return "Connection lost";
    }
    return "Offline";
  }, [offlineMode, lobbyStatus, matchStatus]);

  const handleGuessSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    sendGuess(guess);
    setGuess("");
  };

  const handleCountdown = (seconds: number | null) => {
    setCountdown(seconds);
  };

  return (
    <div className="space-y-8">
      <header className="relative overflow-hidden rounded-lg border border-line bg-surface-raised p-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.35em] text-signal-text">
              Live puzzle arena
            </p>
            <h1 className="text-3xl font-display font-semibold tracking-tight text-paper drop-">
              {slugDefinition.title}
            </h1>
            <p className="text-sm text-muted">
              Coordinate guesses in real-time or drop back to solo play if
              things go quiet.
            </p>
          </div>
          <div className="flex flex-col items-start gap-3 text-sm text-muted lg:items-end">
            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-panel-raised px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-paper">
              <span
                className={`h-2 w-2 rounded-full ${
                  offlineMode ? "bg-close animate-pulse" : "bg-correct"
                }`}
                aria-hidden
              />
              {connectionLabel}
            </span>
            <button
              type="button"
              onClick={reconnect}
              className="inline-flex items-center gap-2 rounded-full border border-line px-3 py-1 text-xs font-medium text-paper transition hover:border-line-strong hover:text-paper"
            >
              ↻ Refresh connection
            </button>
            <Link
              href={`/games/${slugDefinition.slug}`}
              className="inline-flex items-center gap-2 rounded-full border border-line px-3 py-1 text-xs font-medium text-paper transition hover:border-line-strong hover:text-paper"
            >
              ↩ Back to daily mode
            </Link>
          </div>
        </div>
      </header>

      {offlineMode && (
        <div className="rounded-lg border border-close bg-close-soft p-5 text-close-ink">
          <p className="text-sm font-medium">
            We&apos;re keeping your actions queued while we reconnect. You can
            keep guessing or jump into solo mode.
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setShowFallback(true)}
              className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-panel-raised px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-paper transition hover:border-line-strong hover:bg-hover"
            >
              Launch solo fallback
            </button>
            <button
              type="button"
              onClick={() => handleCountdown(null)}
              className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-panel px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-paper transition hover:border-line-strong hover:bg-panel-raised"
            >
              Clear lobby countdown
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[340px_1fr]">
        <section className="space-y-6 rounded-lg border border-line bg-surface-raised p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-paper">Lobby</h2>
            <button
              type="button"
              onClick={() => toggleReady()}
              className="rounded-full border border-line-strong px-3 py-1 text-xs font-semibold uppercase tracking-wide text-paper transition hover:border-line-strong hover:text-paper"
            >
              {lobby?.players.find((entry) => entry.id === playerId)?.ready
                ? "Set not ready"
                : "I&apos;m ready"}
            </button>
          </div>
          <div className="space-y-3">
            {lobby?.players.length ? (
              <ul className="space-y-3">
                {lobby.players.map((player) => (
                  <li
                    key={player.id}
                    className={`flex items-center justify-between rounded-lg border px-3 py-2 ${
                      player.ready
                        ? "border-correct bg-correct-soft"
                        : "border-line bg-panel"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar player={player} />
                      <div>
                        <p className="text-sm font-medium text-paper">
                          {getPlayerLabel(player, player.id)}
                        </p>
                        <p className="text-xs text-muted">
                          {player.ready ? "Ready" : "Waiting"}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-muted">
                      {player.lastActive
                        ? new Date(player.lastActive).toLocaleTimeString()
                        : "--"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">
                No one&apos;s here yet—share the room link to rally teammates.
              </p>
            )}
          </div>
          <div className="rounded-lg border border-line bg-panel p-4 text-sm text-muted">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted">
                  Lobby countdown
                </p>
                <p className="text-2xl font-semibold text-paper">
                  {lobby?.countdown ?? "∞"}
                </p>
              </div>
              <div className="flex flex-col gap-2">
                {[30, 60, 120].map((seconds) => (
                  <button
                    key={seconds}
                    type="button"
                    onClick={() => handleCountdown(seconds)}
                    className="rounded-full border border-line px-3 py-1 text-xs font-medium text-paper transition hover:border-line-strong hover:text-paper"
                  >
                    {seconds}s
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => handleCountdown(null)}
                  className="rounded-full border border-line px-3 py-1 text-xs font-medium text-paper transition hover:border-line-strong hover:text-paper"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-wide text-muted">
              Send a reaction
            </p>
            <div className="flex flex-wrap gap-2">
              {REACTION_OPTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => sendReaction(emoji)}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-panel-raised text-xl transition hover:border-signal hover:bg-signal-soft"
                >
                  {emoji}
                </button>
              ))}
            </div>
            <div className="rounded-lg border border-line bg-panel p-4">
              <ReactionFeed reactions={reactions} players={playersById} />
            </div>
          </div>
        </section>

        <section className="space-y-6 rounded-lg border border-line bg-surface-raised p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-paper">Match room</h2>
              <p className="text-sm text-muted">
                Share your best guess and track the hype. Timers stay in sync
                for everyone connected.
              </p>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-line bg-panel px-4 py-2">
              <span className="text-xs uppercase tracking-wide text-muted">
                Countdown
              </span>
              <span className="text-2xl font-semibold text-paper">
                {formatTimer(displayTimer)}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setTimer(timerRemaining ?? 60, true)}
                  className="rounded-full border border-line px-3 py-1 text-xs font-medium text-paper transition hover:border-line-strong hover:text-paper"
                >
                  Start
                </button>
                <button
                  type="button"
                  onClick={() => setTimer(timerRemaining, false)}
                  className="rounded-full border border-line px-3 py-1 text-xs font-medium text-paper transition hover:border-line-strong hover:text-paper"
                >
                  Pause
                </button>
                <button
                  type="button"
                  onClick={() => setTimer(60, true)}
                  className="rounded-full border border-line px-3 py-1 text-xs font-medium text-paper transition hover:border-line-strong hover:text-paper"
                >
                  60s
                </button>
              </div>
            </div>
          </div>

          <form
            onSubmit={handleGuessSubmit}
            className="flex flex-col gap-3 rounded-lg border border-line bg-panel p-4"
          >
            <label
              htmlFor="live-guess"
              className="text-xs uppercase tracking-wide text-muted"
            >
              Drop a guess
            </label>
            <div className="flex gap-3">
              <input
                id="live-guess"
                value={guess}
                onChange={(event) => setGuess(event.target.value)}
                placeholder="Type your answer and press enter"
                className="flex-1 rounded-xl border border-line bg-ink px-4 py-2 text-sm text-paper placeholder:text-muted focus:border-signal-text focus:outline-none"
              />
              <button
                type="submit"
                className="rounded-xl border border-signal bg-signal-soft px-4 py-2 text-sm font-semibold text-paper transition hover:bg-signal-soft"
              >
                Send
              </button>
            </div>
            <p className="text-xs text-muted">
              Your guesses sync instantly across the room
              {offlineMode ? ", even while offline." : "."}
            </p>
          </form>

          <div className="rounded-lg border border-line bg-panel p-4">
            <h3 className="text-sm font-semibold text-paper">Recent guesses</h3>
            {recentGuesses.length ? (
              <ul className="mt-3 space-y-2 text-sm text-paper">
                {recentGuesses.map((entry: GuessEvent) => {
                  const player = playersById.get(entry.playerId);
                  const timestamp = new Date(
                    entry.timestamp,
                  ).toLocaleTimeString();
                  return (
                    <li
                      key={entry.id}
                      className={`flex items-center justify-between rounded-xl border px-3 py-2 ${
                        entry.optimistic
                          ? "border-signal bg-signal-soft"
                          : "border-line bg-ink"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar player={player ?? null} />
                        <div>
                          <p className="font-medium text-paper">
                            {entry.guess}
                          </p>
                          <p className="text-xs text-muted">
                            {getPlayerLabel(
                              player ?? undefined,
                              entry.playerId,
                            )}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs text-muted">{timestamp}</span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted">
                No guesses yet. Be the first to spark the chain!
              </p>
            )}
          </div>
        </section>
      </div>

      {showFallback && (
        <div className="space-y-4 rounded-lg border border-line bg-surface-raised p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-paper">
                Solo fallback
              </h2>
              <p className="text-sm text-muted">
                Continue asynchronously—your progress stays saved even without
                the live room.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowFallback(false)}
              className="rounded-full border border-line-strong px-3 py-1 text-xs font-semibold uppercase tracking-wide text-paper transition hover:border-line-strong hover:text-paper"
            >
              Hide
            </button>
          </div>
          <PuzzleSlugContent data={puzzleData} slug={slugDefinition} />
        </div>
      )}
    </div>
  );
}
