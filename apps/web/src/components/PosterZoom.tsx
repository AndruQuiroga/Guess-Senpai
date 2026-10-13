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
import {
  buildOutcome,
  difficultyLabel,
  line,
  ROUND_POINTS,
} from "./rounds/scoring";
import { useRoundGame, type RoundGameState } from "./rounds/useRoundGame";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

/** Title is most of the round; season and year are bonus questions. */
export const POSTER_POINTS = { title: 600, season: 200, year: 200 } as const;
export const ZOOM_HINT_COST = 150;
export const GENRE_HINT_COST = 100;
const MAX_ZOOM_HINTS = 2;

const SEASONS = ["WINTER", "SPRING", "SUMMER", "FALL"] as const;
type Season = (typeof SEASONS)[number];

function titleCase(value: string) {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

function answerSeason(round: PosterZoomRound): Season | null {
  const token = round.meta.season?.trim().split(/\s+/)[0]?.toUpperCase();
  return SEASONS.find((season) => season === token) ?? null;
}

function posterUrl(round: PosterZoomRound, zoomHints: number) {
  return `${API_BASE}/puzzles/poster/${round.mediaId}/image?hints=${zoomHints}&difficulty=${round.difficulty}`;
}

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
}: Props) {
  const rounds = payload.rounds;
  const game = useRoundGame({
    roundCount: rounds.length,
    initialProgress,
    onProgressChange,
    puzzleKey: rounds.map((round) => round.mediaId).join(":"),
  });
  const tabs = rounds.map((round) => ({
    label: difficultyLabel(round.difficulty, round.order),
  }));

  if (rounds.length === 0) {
    return <p className="text-muted">Poster Zoomed is unavailable today.</p>;
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
          title="Poster Zoomed"
          nextSlug={nextSlug}
          rows={rounds.map((round, index) => ({
            label: `Round ${index + 1} · ${tabs[index].label}`,
            answer: round.answer,
            coverImage: fullPoster(round),
            points: game.records[index]?.outcome?.points ?? 0,
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
}: {
  index: number;
  round: PosterZoomRound;
  label: string;
  game: RoundGameState;
  isLast: boolean;
}) {
  const record = game.records[index];
  const fieldRef = useRef<TitleGuessFieldHandle | null>(null);
  const [title, setTitle] = useState(String(record.answers.title ?? ""));
  const [season, setSeason] = useState<string>(
    String(record.answers.season ?? ""),
  );
  const [year, setYear] = useState(String(record.answers.year ?? ""));
  const [genresShown, setGenresShown] = useState(
    Boolean(record.answers.genresShown),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { zooms } = splitHints(record.hints, genresShown);
  const hintCost = zooms * ZOOM_HINT_COST + (genresShown ? GENRE_HINT_COST : 0);

  const correctSeason = answerSeason(round);
  const correctYear = round.meta.year ?? null;

  const submit = useCallback(
    async (event?: FormEvent) => {
      event?.preventDefault();
      if (busy) return;
      const selection = fieldRef.current?.submit() ?? null;
      const guess = (selection?.value ?? title).trim();
      if (!guess && !season && !year) {
        setError("Fill in at least one answer first.");
        return;
      }
      setBusy(true);
      setError(null);
      try {
        const titleCorrect = guess
          ? (await verifyGuess(round.mediaId, guess, selection?.suggestionId))
              .animeMatch
          : false;
        const parsedYear = Number.parseInt(year, 10);
        const yearVerdict =
          correctYear == null || !Number.isFinite(parsedYear)
            ? "wrong"
            : parsedYear === correctYear
              ? "correct"
              : Math.abs(parsedYear - correctYear) === 1
                ? "close"
                : "wrong";
        const outcome = buildOutcome(
          [
            line(
              "Title",
              guess,
              round.answer,
              titleCorrect ? "correct" : "wrong",
              POSTER_POINTS.title,
            ),
            line(
              "Season",
              season ? titleCase(season) : "",
              correctSeason ? titleCase(correctSeason) : "Unknown",
              correctSeason && season === correctSeason ? "correct" : "wrong",
              POSTER_POINTS.season,
            ),
            line(
              "Year",
              Number.isFinite(parsedYear) ? String(parsedYear) : "",
              correctYear != null ? String(correctYear) : "Unknown",
              yearVerdict,
              POSTER_POINTS.year,
            ),
          ],
          hintCost,
          ROUND_POINTS,
        );
        game.submitRound(index, {
          answers: { title: guess, season, year, genresShown },
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
    [
      busy,
      correctSeason,
      correctYear,
      game,
      genresShown,
      hintCost,
      index,
      round,
      season,
      title,
      year,
    ],
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
      <div className="grid gap-5 md:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <figure className="space-y-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={posterUrl(round, zooms)}
            alt={`Zoomed-in crop of the round ${index + 1} poster`}
            className="aspect-[2/3] w-full rounded-lg border border-line-strong bg-ink object-cover"
          />
          <figcaption className="text-xs text-muted">
            {zooms === 0
              ? "Closest zoom"
              : `Zoomed out ${zooms} of ${MAX_ZOOM_HINTS} times`}
          </figcaption>
        </figure>

        <div className="space-y-5">
          <HintShop
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
                label: "Zoom out",
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

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <label
                htmlFor={`poster-season-${index}`}
                className="text-sm font-semibold text-paper"
              >
                Season{" "}
                <span className="font-normal text-muted">
                  (+{POSTER_POINTS.season})
                </span>
              </label>
              <select
                id={`poster-season-${index}`}
                value={season}
                onChange={(event) => setSeason(event.target.value)}
                disabled={busy}
                className="w-full rounded-md border border-line-strong bg-ink px-3 py-3 text-paper"
              >
                <option value="">Skip</option>
                {SEASONS.map((value) => (
                  <option key={value} value={value}>
                    {titleCase(value)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label
                htmlFor={`poster-year-${index}`}
                className="text-sm font-semibold text-paper"
              >
                Year{" "}
                <span className="font-normal text-muted">
                  (+{POSTER_POINTS.year}, half if off by one)
                </span>
              </label>
              <input
                id={`poster-year-${index}`}
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                value={year}
                onChange={(event) =>
                  setYear(event.target.value.replace(/\D/g, "").slice(0, 4))
                }
                disabled={busy}
                placeholder="e.g. 2019"
                className="w-full rounded-md border border-line-strong bg-ink px-3 py-3 text-paper"
              />
            </div>
          </div>

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
