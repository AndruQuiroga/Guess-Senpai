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
        className="h-10 w-10 rounded-full border border-white/20 object-cover shadow-inner shadow-black/30"
      />
    );
  }
  const fallback = player?.name?.slice(0, 2) ?? "GS";
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/10 text-sm font-semibold uppercase text-white/80">
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
      <p className="text-sm text-neutral-400">No reactions yet. Fire up the hype!</p>
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
              className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/5 px-3 py-2 text-sm text-white/90"
            >
              <div className="flex items-center gap-3">
                <span className="text-lg">{reaction.emoji}</span>
                <span>{getPlayerLabel(player, reaction.playerId)}</span>
              </div>
              <span className="text-xs text-neutral-400">{timestamp}</span>
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
  const [displayTimer, setDisplayTimer] = useState<number | null>(timerRemaining);

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
      <header className="relative overflow-hidden rounded-3xl border border-white/10 bg-surface-raised p-6 shadow-ambient backdrop-blur-2xl">
        <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-brand-400/60 to-transparent" />
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.35em] text-brand-300/80">Live puzzle arena</p>
            <h1 className="text-3xl font-display font-semibold tracking-tight text-white drop-shadow-[0_0_20px_rgba(59,130,246,0.4)]">
              {slugDefinition.title}
            </h1>
            <p className="text-sm text-neutral-300">
              Coordinate guesses in real-time or drop back to solo play if things go quiet.
            </p>
          </div>
          <div className="flex flex-col items-start gap-3 text-sm text-neutral-200 lg:items-end">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-white/80">
              <span
                className={`h-2 w-2 rounded-full ${
                  offlineMode ? "bg-amber-400 animate-pulse" : "bg-emerald-400"
                }`}
                aria-hidden
              />
              {connectionLabel}
            </span>
            <button
              type="button"
              onClick={reconnect}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-xs font-medium text-white/70 transition hover:border-white/20 hover:text-white"
            >
              ↻ Refresh connection
            </button>
            <Link
              href={`/games/${slugDefinition.slug}`}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-xs font-medium text-white/70 transition hover:border-white/20 hover:text-white"
            >
              ↩ Back to daily mode
            </Link>
          </div>
        </div>
      </header>

      {offlineMode && (
        <div className="rounded-3xl border border-amber-400/40 bg-amber-500/10 p-5 text-amber-100 shadow-ambient">
          <p className="text-sm font-medium">
            We&apos;re keeping your actions queued while we reconnect. You can keep guessing or jump into solo mode.
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setShowFallback(true)}
              className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-white/80 transition hover:border-white/40 hover:bg-white/20"
            >
              Launch solo fallback
            </button>
            <button
              type="button"
              onClick={() => handleCountdown(null)}
              className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-white/70 transition hover:border-white/40 hover:bg-white/10"
            >
              Clear lobby countdown
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[340px_1fr]">
        <section className="space-y-6 rounded-3xl border border-white/10 bg-surface-raised p-6 shadow-ambient">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Lobby</h2>
            <button
              type="button"
              onClick={() => toggleReady()}
              className="rounded-full border border-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/80 transition hover:border-white/30 hover:text-white"
            >
              {lobby?.players.find((entry) => entry.id === playerId)?.ready ? "Set not ready" : "I&apos;m ready"}
            </button>
          </div>
          <div className="space-y-3">
            {lobby?.players.length ? (
              <ul className="space-y-3">
                {lobby.players.map((player) => (
                  <li
                    key={player.id}
                    className={`flex items-center justify-between rounded-2xl border px-3 py-2 ${
                      player.ready
                        ? "border-emerald-400/40 bg-emerald-500/10"
                        : "border-white/10 bg-white/5"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar player={player} />
                      <div>
                        <p className="text-sm font-medium text-white/90">{getPlayerLabel(player, player.id)}</p>
                        <p className="text-xs text-neutral-400">
                          {player.ready ? "Ready" : "Waiting"}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-neutral-400">
                      {player.lastActive ? new Date(player.lastActive).toLocaleTimeString() : "--"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-neutral-400">No one&apos;s here yet—share the room link to rally teammates.</p>
            )}
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-neutral-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-white/60">Lobby countdown</p>
                <p className="text-2xl font-semibold text-white">{lobby?.countdown ?? "∞"}</p>
              </div>
              <div className="flex flex-col gap-2">
                {[30, 60, 120].map((seconds) => (
                  <button
                    key={seconds}
                    type="button"
                    onClick={() => handleCountdown(seconds)}
                    className="rounded-full border border-white/10 px-3 py-1 text-xs font-medium text-white/70 transition hover:border-white/30 hover:text-white"
                  >
                    {seconds}s
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => handleCountdown(null)}
                  className="rounded-full border border-white/10 px-3 py-1 text-xs font-medium text-white/70 transition hover:border-white/30 hover:text-white"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-wide text-white/60">Send a reaction</p>
            <div className="flex flex-wrap gap-2">
              {REACTION_OPTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => sendReaction(emoji)}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/10 text-xl transition hover:border-brand-400/50 hover:bg-brand-500/20"
                >
                  {emoji}
                </button>
              ))}
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <ReactionFeed reactions={reactions} players={playersById} />
            </div>
          </div>
        </section>

        <section className="space-y-6 rounded-3xl border border-white/10 bg-surface-raised p-6 shadow-ambient">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Match room</h2>
              <p className="text-sm text-neutral-400">
                Share your best guess and track the hype. Timers stay in sync for everyone connected.
              </p>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-2">
              <span className="text-xs uppercase tracking-wide text-white/60">Countdown</span>
              <span className="text-2xl font-semibold text-white">{formatTimer(displayTimer)}</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setTimer(timerRemaining ?? 60, true)}
                  className="rounded-full border border-white/10 px-3 py-1 text-xs font-medium text-white/70 transition hover:border-white/30 hover:text-white"
                >
                  Start
                </button>
                <button
                  type="button"
                  onClick={() => setTimer(timerRemaining, false)}
                  className="rounded-full border border-white/10 px-3 py-1 text-xs font-medium text-white/70 transition hover:border-white/30 hover:text-white"
                >
                  Pause
                </button>
                <button
                  type="button"
                  onClick={() => setTimer(60, true)}
                  className="rounded-full border border-white/10 px-3 py-1 text-xs font-medium text-white/70 transition hover:border-white/30 hover:text-white"
                >
                  60s
                </button>
              </div>
            </div>
          </div>

          <form onSubmit={handleGuessSubmit} className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
            <label htmlFor="live-guess" className="text-xs uppercase tracking-wide text-white/60">
              Drop a guess
            </label>
            <div className="flex gap-3">
              <input
                id="live-guess"
                value={guess}
                onChange={(event) => setGuess(event.target.value)}
                placeholder="Type your answer and press enter"
                className="flex-1 rounded-xl border border-white/10 bg-black/20 px-4 py-2 text-sm text-white placeholder:text-neutral-500 focus:border-brand-400 focus:outline-none"
              />
              <button
                type="submit"
                className="rounded-xl border border-brand-400/50 bg-brand-500/20 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-500/40"
              >
                Send
              </button>
            </div>
            <p className="text-xs text-neutral-400">
              Your guesses sync instantly across the room{offlineMode ? ", even while offline." : "."}
            </p>
          </form>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <h3 className="text-sm font-semibold text-white/80">Recent guesses</h3>
            {recentGuesses.length ? (
              <ul className="mt-3 space-y-2 text-sm text-neutral-100">
                {recentGuesses.map((entry: GuessEvent) => {
                  const player = playersById.get(entry.playerId);
                  const timestamp = new Date(entry.timestamp).toLocaleTimeString();
                  return (
                    <li
                      key={entry.id}
                      className={`flex items-center justify-between rounded-xl border px-3 py-2 ${
                        entry.optimistic
                          ? "border-brand-400/40 bg-brand-500/10"
                          : "border-white/10 bg-black/20"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar player={player ?? null} />
                        <div>
                          <p className="font-medium text-white">{entry.guess}</p>
                          <p className="text-xs text-neutral-400">
                            {getPlayerLabel(player ?? undefined, entry.playerId)}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs text-neutral-400">{timestamp}</span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-neutral-400">
                No guesses yet. Be the first to spark the chain!
              </p>
            )}
          </div>
        </section>
      </div>

      {showFallback && (
        <div className="space-y-4 rounded-3xl border border-white/10 bg-surface-raised p-6 shadow-ambient">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Solo fallback</h2>
              <p className="text-sm text-neutral-400">
                Continue asynchronously—your progress stays saved even without the live room.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowFallback(false)}
              className="rounded-full border border-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/70 transition hover:border-white/30 hover:text-white"
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
