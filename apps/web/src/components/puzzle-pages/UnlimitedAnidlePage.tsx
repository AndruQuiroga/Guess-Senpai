"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import Anidle from "../Anidle";
import { AttemptMeter } from "../anidle/AttemptMeter";
import { StakeBadge, StakeProvider } from "../rounds/RoundUI";
import { GameShell } from "../GameShell";
import type { GameProgress } from "../../types/progress";
import { isProgressExhausted } from "../../utils/gameAction";
import { describeAnidleRules } from "../anidle/hints";
import {
  EMPTY_TALLY,
  RECENT_LIMIT,
  fetchPracticeGame,
  formatAverage,
  loadPracticeSession,
  loadPracticeTally,
  recordPracticeResult,
  savePracticeSession,
  savePracticeTally,
  type PracticeSession,
  type PracticeTally,
} from "../../utils/practiceAnidle";

const PRACTICE_INTRO =
  "Practice mode: a fresh random anime each time, with the same rules as the daily Anidle.";
const PRACTICE_RULES = [
  "Invalid titles, repeated anime and failed requests cost no guess.",
  "Nothing here counts toward your streak, your daily score or your account. Your practice tally stays in this browser.",
];

function isFinished(progress: GameProgress | undefined, limit: number) {
  return (
    Boolean(progress?.completed) ||
    isProgressExhausted({
      completed: progress?.completed,
      anidleHistory: progress?.anidleHistory,
      attemptLimit: limit,
    })
  );
}

type LoadState = "loading" | "ready" | "error";

/**
 * Unlimited Anidle. Reuses the daily Anidle components but keeps everything
 * (current game, tally) under its own storage keys and never calls the daily
 * progress provider.
 */
export function UnlimitedAnidlePage() {
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<PracticeSession | null>(null);
  const [live, setLive] = useState<GameProgress | undefined>();
  const [tally, setTally] = useState<PracticeTally>(EMPTY_TALLY);
  /** Latest session, mutated without re-rendering so Anidle keeps a stable initialProgress. */
  const sessionRef = useRef<PracticeSession | null>(null);
  const tallyRef = useRef<PracticeTally>(EMPTY_TALLY);
  const requestId = useRef(0);

  const startNewGame = useCallback(async () => {
    const ticket = ++requestId.current;
    setState("loading");
    setError(null);
    try {
      const recent = sessionRef.current?.recentMediaIds ?? [];
      const game = await fetchPracticeGame(recent);
      if (ticket !== requestId.current) return;
      const next: PracticeSession = {
        ...game,
        progress: undefined,
        tallied: false,
        recentMediaIds: [
          game.mediaId,
          ...recent.filter((id) => id !== game.mediaId),
        ].slice(0, RECENT_LIMIT),
      };
      sessionRef.current = next;
      savePracticeSession(next);
      setLive(undefined);
      setSession(next);
      setState("ready");
    } catch (failure) {
      if (ticket !== requestId.current) return;
      setError(
        failure instanceof Error
          ? failure.message
          : "Couldn't load a practice puzzle.",
      );
      setState("error");
    }
  }, []);

  useEffect(() => {
    const savedTally = loadPracticeTally();
    tallyRef.current = savedTally;
    setTally(savedTally);
    const saved = loadPracticeSession();
    if (saved) {
      sessionRef.current = saved;
      setLive(saved.progress);
      setSession(saved);
      setState("ready");
      return;
    }
    void startNewGame();
  }, [startNewGame]);

  const handleProgressChange = useCallback((progress: GameProgress) => {
    const current = sessionRef.current;
    if (!current) return;
    const limit = current.puzzle.rules?.max_attempts ?? 20;
    let updated: PracticeSession = { ...current, progress };
    if (isFinished(progress, limit) && !current.tallied) {
      const next = recordPracticeResult(tallyRef.current, {
        solved: Boolean(progress.completed),
        guesses: progress.anidleHistory?.length ?? progress.guesses.length,
      });
      tallyRef.current = next;
      savePracticeTally(next);
      setTally(next);
      updated = { ...updated, tallied: true };
    }
    sessionRef.current = updated;
    savePracticeSession(updated);
    setLive(progress);
  }, []);

  const rules =
    session?.puzzle.rules?.version === "2" ? session.puzzle.rules : null;
  const used = live?.anidleHistory?.length ?? 0;
  const finished = rules ? isFinished(live, rules.max_attempts) : false;
  const average = formatAverage(tally);

  return (
    <StakeProvider>
      <GameShell
        title="Unlimited Anidle"
        slug="unlimited-anidle"
        rules={[
          PRACTICE_INTRO,
          ...(rules ? describeAnidleRules(rules) : []),
          ...PRACTICE_RULES,
        ]}
        status={
          rules && state === "ready" ? (
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <AttemptMeter
                used={used}
                max={rules.max_attempts}
                hintAfter={rules.hint_after_incorrect}
                finished={finished}
              />
              <StakeBadge />
            </span>
          ) : null
        }
      >
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm text-muted">
          <p>
            Practice mode. Not counted toward your streak or daily score.{" "}
            <Link href="/games/anidle" className="text-paper underline">
              Play today&apos;s Anidle
            </Link>
          </p>
          <p aria-label="Practice tally">
            Played {tally.played} · Solved {tally.solved} · Avg {average}
            {average === "—" ? "" : " guesses"}
          </p>
        </div>

        {state === "loading" ? (
          <p role="status" className="text-base text-muted">
            Loading a new puzzle…
          </p>
        ) : null}

        {state === "error" ? (
          <div className="space-y-3" role="alert">
            <p className="text-base text-wrong-ink">{error}</p>
            <button
              type="button"
              className="button button-primary"
              onClick={() => void startNewGame()}
            >
              Try again
            </button>
          </div>
        ) : null}

        {state === "ready" && session ? (
          <>
            <Anidle
              key={session.practiceId}
              mediaId={session.mediaId}
              payload={session.puzzle}
              initialProgress={session.progress}
              onProgressChange={handleProgressChange}
              answerCoverImage={session.coverImage}
              onNewPuzzle={() => void startNewGame()}
            />
            {!finished ? (
              <p className="text-sm text-muted">
                <button
                  type="button"
                  className="underline hover:text-paper"
                  onClick={() => void startNewGame()}
                >
                  Skip this puzzle
                </button>{" "}
                (not counted in your tally)
              </p>
            ) : null}
          </>
        ) : null}
      </GameShell>
    </StakeProvider>
  );
}
