"use client";

import { useCallback, useMemo, useRef, useState, type FormEvent } from "react";

import type { GameProgress } from "../types/progress";
import type { PosterZoomGame, PosterZoomRound } from "../types/puzzles";
import { verifyGuess } from "../utils/verifyGuess";
import {
  TitleGuessField,
  type TitleGuessFieldHandle,
} from "./games/TitleGuessField";
import {
  GameSummary,
  HintShop,
  LegacyFinished,
  RoundResult,
  RoundTabs,
} from "./rounds/RoundUI";
import { buildOutcome, difficultyLabel, line } from "./rounds/scoring";
import { useRoundGame, type RoundGameState } from "./rounds/useRoundGame";
import {
  matchesSeriesTitle,
  seasonBonusLines,
  SeasonBonusFields,
  seasonRoundMax,
} from "./rounds/SeasonBonus";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

/** Title is most of the round; season and year are bonus questions. */
export const POSTER_POINTS = {
  title: 600,
  season: 100,
  year: 100,
  seasonNumber: 200,
} as const;
export const ZOOM_HINT_COST = 150;
export const GENRE_HINT_COST = 100;
const MAX_ZOOM_HINTS = 2;

function posterUrl(
  round: PosterZoomRound,
  zoomHints: number,
  modified = false,
) {
  return `${API_BASE}/puzzles/poster/${round.mediaId}/image?hints=${zoomHints}&difficulty=${round.difficulty}${modified && round.meta.modification ? `&modification=${round.meta.modification}` : ""}`;
}

export const MODIFICATION_LABELS = {
  black_white: "Black and white",
  mosaic: "Mosaic",
  shuffled: "Shuffled tiles",
} as const;

/** Full, unzoomed poster for the results screen. */
function fullPoster(round: PosterZoomRound) {
  return (
    round.solution?.coverImage ??
    `${API_BASE}/puzzles/poster/${round.mediaId}/image?hints=2`
  );
}

/** Hints are counted as one total: genres first if taken, zooms otherwise. */
function splitHints(hints: number, genresShown: boolean) {
  const zooms = Math.min(MAX_ZOOM_HINTS, hints - (genresShown ? 1 : 0));
  return { zooms: Math.max(0, zooms), genres: genresShown };
}

interface Props {
  modified?: boolean;
  payload: PosterZoomGame;
  initialProgress?: GameProgress;
  onProgressChange(state: GameProgress): void;
  nextSlug?: string | null;
}

export default function PosterZoom({
  payload,
  initialProgress,
  onProgressChange,
  nextSlug,
  modified = false,
}: Props) {
  const rounds = payload.rounds;
  const game = useRoundGame({
    roundCount: rounds.length,
    roundMaxPoints: rounds.map((round) =>
      seasonRoundMax(POSTER_POINTS.title, round.meta),
    ),
    initialProgress,
    onProgressChange,
    puzzleKey: rounds.map((round) => round.mediaId).join(":"),
  });
  const tabs = rounds.map((round) => ({
    label: difficultyLabel(round.difficulty, round.order),
  }));

  if (rounds.length === 0) {
    return (
      <p className="text-muted">
        {modified ? "Poster Modified" : "Poster Zoomed"} is unavailable today.
      </p>
    );
  }
  if (game.legacyFinished) return <LegacyFinished nextSlug={nextSlug} />;

  return (
    <div className="space-y-5">
      <RoundTabs
        rounds={tabs}
        records={game.records}
        view={game.view}
        canView={game.canView}
        onSelect={game.goTo}
      />
      {game.view >= rounds.length ? (
        <GameSummary
          title={modified ? "Poster Modified" : "Poster Zoomed"}
          nextSlug={nextSlug}
          rows={rounds.map((round, index) => ({
            label: `Round ${index + 1} · ${tabs[index].label}`,
            answer: round.answer,
            coverImage: fullPoster(round),
            points: game.records[index]?.outcome?.points ?? 0,
            max:
              game.records[index]?.outcome?.max ??
              seasonRoundMax(POSTER_POINTS.title, round.meta),
          }))}
        />
      ) : (
        <PosterRound
          key={game.view}
          index={game.view}
          round={rounds[game.view]}
          label={`Round ${game.view + 1} · ${tabs[game.view].label}`}
          game={game}
          isLast={game.view === rounds.length - 1}
          modified={modified}
        />
      )}
    </div>
  );
}

function PosterRound({
  index,
  round,
  label,
  game,
  isLast,
  modified,
}: {
  index: number;
  round: PosterZoomRound;
  label: string;
  game: RoundGameState;
  isLast: boolean;
  modified: boolean;
}) {
  const record = game.records[index];
  const fieldRef = useRef<TitleGuessFieldHandle | null>(null);
  const [title, setTitle] = useState(String(record.answers.title ?? ""));
  const [bonus, setBonus] = useState({
    year: String(record.answers.year ?? ""),
    season: String(record.answers.season ?? ""),
    seasonNumber: String(record.answers.seasonNumber ?? ""),
  });
  const [genresShown, setGenresShown] = useState(
    Boolean(record.answers.genresShown),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { zooms } = splitHints(record.hints, genresShown);
  const hintCost = zooms * ZOOM_HINT_COST + (genresShown ? GENRE_HINT_COST : 0);

  const submit = useCallback(
    async (event?: FormEvent) => {
      event?.preventDefault();
      if (busy) return;
      const selection = fieldRef.current?.submit() ?? null;
      const guess = (selection?.value ?? title).trim();
      if (!guess) {
        setError("Type an anime title first.");
        return;
      }
      setBusy(true);
      setError(null);
      try {
        const titleCorrect =
          matchesSeriesTitle(guess, round.meta) ||
          (await verifyGuess(round.mediaId, guess, selection?.suggestionId))
            .animeMatch;
        const outcome = buildOutcome(
          [
            line(
              "Title",
              guess,
              round.answer,
              titleCorrect ? "correct" : "wrong",
              POSTER_POINTS.title,
            ),
            ...seasonBonusLines(round.meta, bonus, titleCorrect),
          ],
          hintCost,
          seasonRoundMax(POSTER_POINTS.title, round.meta),
        );
        game.submitRound(index, {
          answers: {
            title: guess,
            season: bonus.season,
            year: bonus.year,
            seasonNumber: bonus.seasonNumber,
            genresShown,
          },
          guesses: guess ? [guess] : [],
          outcome,
        });
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Couldn't check your answer. Try again.",
        );
      } finally {
        setBusy(false);
      }
    },
    [busy, bonus, game, genresShown, hintCost, index, round, title],
  );

  const genres = useMemo(() => round.meta.genres.slice(0, 4), [round]);

  if (record.submitted && record.outcome) {
    return (
      <RoundResult
        roundLabel={label}
        outcome={record.outcome}
        answerTitle={round.answer}
        subtitle={[round.meta.season, round.meta.format]
          .filter(Boolean)
          .join(" · ")}
        coverImage={fullPoster(round)}
        aniListUrl={round.solution?.aniListUrl ?? null}
        onNext={game.advance}
        nextLabel={isLast ? "See final score" : "Next round"}
      />
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <figure className="space-y-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={posterUrl(round, zooms, modified)}
            alt={
              modified
                ? `${round.meta.modification ? MODIFICATION_LABELS[round.meta.modification] : "Modified"} poster for round ${index + 1}`
                : `Zoomed-in crop of the round ${index + 1} poster`
            }
            className="aspect-[2/3] w-full rounded-lg border border-line-strong bg-ink object-cover"
          />
          <figcaption className="text-xs text-muted">
            {modified
              ? `${round.meta.modification ? MODIFICATION_LABELS[round.meta.modification] : "Modified poster"} · ${zooms} of ${MAX_ZOOM_HINTS} clearer views`
              : zooms === 0
                ? "Closest zoom"
                : `Zoomed out ${zooms} of ${MAX_ZOOM_HINTS} times`}
          </figcaption>
        </figure>

        <div className="space-y-5">
          <HintShop
            max={seasonRoundMax(POSTER_POINTS.title, round.meta)}
            spent={hintCost}
            disabled={busy}
            onBuy={(id) => {
              if (id === "genres") {
                setGenresShown(true);
                game.takeHint(index, { genresShown: true });
              } else {
                game.takeHint(index);
              }
            }}
            clues={[
              {
                id: "zoom",
                label: modified ? "Clearer image" : "Zoom out",
                cost: ZOOM_HINT_COST,
                uses: { used: zooms, max: MAX_ZOOM_HINTS },
              },
              ...(genres.length
                ? [
                    {
                      id: "genres",
                      label: "Genres",
                      cost: GENRE_HINT_COST,
                      bought: genresShown,
                      reveal: genres.join(" · "),
                    },
                  ]
                : []),
            ]}
          />

          <div className="space-y-2">
            <label
              htmlFor={`poster-title-${index}`}
              className="text-sm font-semibold text-paper"
            >
              Anime title{" "}
              <span className="font-normal text-muted">
                ({POSTER_POINTS.title} pts)
              </span>
            </label>
            <TitleGuessField
              ref={fieldRef}
              id={`poster-title-${index}`}
              value={title}
              onValueChange={setTitle}
              onSubmit={() => void submit()}
              disabled={busy}
              placeholder="Type an anime title…"
              ariaLabel="Poster anime title"
              suggestionsLabel="Poster title suggestions"
            />
          </div>

          <SeasonBonusFields
            id={`poster-${index}`}
            meta={round.meta}
            value={bonus}
            onChange={setBonus}
            disabled={busy}
          />

          {error ? (
            <p
              role="alert"
              className="rounded-md border border-danger bg-danger-soft px-3 py-2 text-sm text-danger-ink"
            >
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={busy}
              className="button button-primary disabled:opacity-60"
            >
              {busy ? "Checking…" : "Lock in answer"}
            </button>
            <p className="text-sm text-muted">
              One answer per round. Blank fields score 0.
            </p>
          </div>
        </div>
      </div>
    </form>
  );
}
