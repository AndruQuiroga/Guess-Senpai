"use client";

import {
  createRef,
  useCallback,
  useMemo,
  useState,
  type FormEvent,
  type RefObject,
} from "react";

import type { GameProgress } from "../types/progress";
import type {
  CharacterGuessEntry,
  CharacterGuessRound,
  CharacterSilhouetteGame,
} from "../types/puzzles";
import { verifyGuess } from "../utils/verifyGuess";
import {
  ART_LEVELS,
  ART_MODE_LABELS,
  CharacterArt,
  artModeFor,
} from "./games/CharacterArt";
import {
  TitleGuessField,
  type TitleGuessFieldHandle,
} from "./games/TitleGuessField";
import {
  GameSummary,
  HintButton,
  LegacyFinished,
  RoundResult,
  RoundTabs,
  VERDICT,
} from "./rounds/RoundUI";
import {
  buildOutcome,
  difficultyLabel,
  line,
  ROUND_POINTS,
  formatPoints,
  type ScoreLine,
} from "./rounds/scoring";
import { useRoundGame, type RoundGameState } from "./rounds/useRoundGame";

export const SHARPEN_HINT_COST = 60;

interface CardHints {
  [cardIndex: string]: number;
}

function cardHints(answers: Record<string, unknown>): CardHints {
  const raw = answers.cardHints;
  return raw && typeof raw === "object" ? (raw as CardHints) : {};
}

interface Props {
  payload: CharacterSilhouetteGame;
  /** Fallback anime for cards from older payloads without their own id. */
  mediaId: number;
  initialProgress?: GameProgress;
  onProgressChange(state: GameProgress): void;
  nextSlug?: string | null;
}

export default function CharacterSilhouette({
  payload,
  mediaId,
  initialProgress,
  onProgressChange,
  nextSlug,
}: Props) {
  const rounds = payload.rounds.filter((round) => round.entries.length > 0);
  const game = useRoundGame({
    roundCount: rounds.length,
    initialProgress,
    onProgressChange,
    puzzleKey: rounds
      .map((round) =>
        round.entries.map((entry) => entry.character.id).join(","),
      )
      .join(":"),
  });
  const tabs = rounds.map((round) => ({
    label: difficultyLabel(round.difficulty, round.order),
  }));

  if (rounds.length === 0) {
    return (
      <p className="text-muted">Guess the Character is unavailable today.</p>
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
          title="Guess the Character"
          nextSlug={nextSlug}
          rows={rounds.map((round, index) => ({
            label: `Round ${index + 1} · ${tabs[index].label}`,
            answer: round.entries
              .map((entry) => entry.characterAnswer)
              .join(", "),
            coverImage: round.entries[0]?.character.image,
            points: game.records[index]?.outcome?.points ?? 0,
          }))}
        />
      ) : (
        <CharacterRound
          key={game.view}
          index={game.view}
          round={rounds[game.view]}
          fallbackMediaId={mediaId}
          label={`Round ${game.view + 1} · ${tabs[game.view].label}`}
          game={game}
          isLast={game.view === rounds.length - 1}
        />
      )}
    </div>
  );
}

interface CardDraft {
  name: string;
  anime: string;
}

function CharacterRound({
  index,
  round,
  fallbackMediaId,
  label,
  game,
  isLast,
}: {
  index: number;
  round: CharacterGuessRound;
  fallbackMediaId: number;
  label: string;
  game: RoundGameState;
  isLast: boolean;
}) {
  const record = game.records[index];
  const entries = round.entries;
  const stored = record.answers.cards as CardDraft[] | undefined;
  const [drafts, setDrafts] = useState<CardDraft[]>(() =>
    entries.map((_, card) => ({
      name: stored?.[card]?.name ?? "",
      anime: stored?.[card]?.anime ?? "",
    })),
  );
  const nameRefs = useMemo(
    () => entries.map(() => createRef<TitleGuessFieldHandle>()),
    [entries],
  );
  const animeRefs = useMemo(
    () => entries.map(() => createRef<TitleGuessFieldHandle>()),
    [entries],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hintsByCard = cardHints(record.answers);
  const mode = artModeFor(round.difficulty);
  const spentOnCards = Object.values(hintsByCard).reduce(
    (sum, count) => sum + count * SHARPEN_HINT_COST,
    0,
  );
  const perCard = Math.floor(ROUND_POINTS / entries.length);
  const half = Math.floor(perCard / 2);

  const update = (card: number, patch: Partial<CardDraft>) =>
    setDrafts((prev) =>
      prev.map((draft, at) => (at === card ? { ...draft, ...patch } : draft)),
    );

  const checkAll = useCallback(
    async (event?: FormEvent) => {
      event?.preventDefault();
      if (busy) return;
      if (drafts.every((draft) => !draft.name.trim() && !draft.anime.trim())) {
        setError("Fill in at least one card first.");
        return;
      }
      setBusy(true);
      setError(null);
      try {
        const results = await Promise.all(
          entries.map(async (entry, card) => {
            const nameSel = nameRefs[card].current?.submit() ?? null;
            const animeSel = animeRefs[card].current?.submit() ?? null;
            const name = (nameSel?.value ?? drafts[card].name).trim();
            const anime = (animeSel?.value ?? drafts[card].anime).trim();
            if (!name && !anime) {
              return { name, anime, nameOk: false, animeOk: false };
            }
            const result = await verifyGuess(
              entry.mediaId ?? fallbackMediaId,
              anime,
              animeSel?.suggestionId,
              {
                characterGuess: name || null,
                characterId: nameSel?.suggestionId ?? null,
                targetCharacterId: entry.character.id,
              },
            );
            return {
              name,
              anime,
              nameOk: Boolean(name) && result.characterMatch === true,
              animeOk: Boolean(anime) && result.animeMatch,
            };
          }),
        );
        const lines: ScoreLine[] = [];
        let hintCost = 0;
        results.forEach((result, card) => {
          const entry = entries[card];
          const cardLines = [
            line(
              `#${card + 1} Character`,
              result.name,
              entry.characterAnswer,
              result.nameOk ? "correct" : "wrong",
              half,
            ),
            line(
              `#${card + 1} Anime`,
              result.anime,
              entry.animeAnswer,
              result.animeOk ? "correct" : "wrong",
              perCard - half,
            ),
          ];
          lines.push(...cardLines);
          // A card's sharpen hints only cost what that card earned.
          const earned = cardLines.reduce((sum, item) => sum + item.points, 0);
          hintCost += Math.min(
            earned,
            (hintsByCard[card] ?? 0) * SHARPEN_HINT_COST,
          );
        });
        game.submitRound(index, {
          answers: {
            ...record.answers,
            cards: results.map(({ name, anime }) => ({ name, anime })),
          },
          guesses: results.flatMap(({ name, anime }) =>
            [name, anime].filter(Boolean),
          ),
          outcome: buildOutcome(lines, hintCost, perCard * entries.length),
        });
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Couldn't check your answers. Try again.",
        );
      } finally {
        setBusy(false);
      }
    },
    [
      animeRefs,
      busy,
      drafts,
      entries,
      fallbackMediaId,
      game,
      half,
      hintsByCard,
      index,
      nameRefs,
      perCard,
      record.answers,
    ],
  );

  if (record.submitted && record.outcome) {
    const lines = record.outcome.lines;
    return (
      <RoundResult
        roundLabel={label}
        outcome={record.outcome}
        answerTitle={`${entries.length} characters`}
        breakdown={false}
        onNext={game.advance}
        nextLabel={isLast ? "See final score" : "Next round"}
        media={
          <ul className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {entries.map((entry, card) => (
              <RevealedCard
                key={entry.character.id}
                number={card + 1}
                entry={entry}
                name={lines[card * 2]}
                anime={lines[card * 2 + 1]}
                sharpened={hintsByCard[card] ?? 0}
              />
            ))}
          </ul>
        }
      />
    );
  }

  return (
    <form onSubmit={checkAll} className="space-y-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-line bg-panel px-3 py-2 text-sm">
        <p className="text-muted">
          <span className="font-semibold text-paper">
            {ART_MODE_LABELS[mode]}
          </span>{" "}
          · Name each character and their anime, then check them all at once.
          Each card is worth {perCard} (half name, half anime).
        </p>
        <p className="font-semibold text-paper">
          Playing for{" "}
          <span
            className="font-display text-lg tabular-nums"
            aria-live="polite"
          >
            {formatPoints(Math.max(0, perCard * entries.length - spentOnCards))}
          </span>{" "}
          <span className="font-normal text-muted">
            / {formatPoints(perCard * entries.length)} pts
          </span>
        </p>
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {entries.map((entry, card) => {
          const sharpened = Math.min(ART_LEVELS - 1, hintsByCard[card] ?? 0);
          return (
            <li
              key={entry.character.id}
              className="space-y-3 rounded-lg border border-line-strong bg-panel p-3"
            >
              <div className="relative overflow-hidden rounded-md border border-line">
                <CharacterArt
                  src={entry.character.image}
                  mode={mode}
                  level={sharpened}
                  seed={entry.character.id}
                  label={`Character ${card + 1}, obscured (${ART_MODE_LABELS[mode].toLowerCase()})`}
                />
                <span className="absolute left-2 top-2 rounded bg-ink px-2 py-0.5 text-xs font-bold text-paper">
                  #{card + 1}
                </span>
              </div>
              <HintButton
                label="Buy a clearer view"
                cost={SHARPEN_HINT_COST}
                disabled={sharpened >= ART_LEVELS - 1}
                used="Clearest"
                onClick={() =>
                  game.takeHint(index, {
                    cardHints: { ...hintsByCard, [card]: sharpened + 1 },
                  })
                }
              />
              <CardField
                id={`character-${index}-${card}-name`}
                label="Character name"
                source="characters"
                fieldRef={nameRefs[card]}
                value={drafts[card].name}
                onChange={(name) => update(card, { name })}
                disabled={busy}
              />
              <CardField
                id={`character-${index}-${card}-anime`}
                label="Anime title"
                source="titles"
                fieldRef={animeRefs[card]}
                value={drafts[card].anime}
                onChange={(anime) => update(card, { anime })}
                disabled={busy}
              />
            </li>
          );
        })}
      </ul>
      {error ? (
        <p
          role="alert"
          className="rounded-md border border-danger bg-danger-soft px-3 py-2 text-sm text-danger-ink"
        >
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={busy}
        className="button button-primary w-full sm:w-auto disabled:opacity-60"
      >
        {busy ? "Checking…" : "Check all"}
      </button>
    </form>
  );
}

function CardField({
  id,
  label,
  source,
  fieldRef,
  value,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  source: "titles" | "characters";
  fieldRef: RefObject<TitleGuessFieldHandle>;
  value: string;
  onChange(value: string): void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-xs font-semibold text-muted">
        {label}
      </label>
      <TitleGuessField
        ref={fieldRef}
        id={id}
        source={source}
        value={value}
        onValueChange={onChange}
        // Enter in a card field moves on instead of checking every card.
        onSubmit={() => undefined}
        disabled={disabled}
        placeholder={label}
        ariaLabel={label}
        suggestionsLabel={`${label} suggestions`}
        suggestionLimit={6}
      />
    </div>
  );
}

function AnswerRow({ label, line }: { label: string; line?: ScoreLine }) {
  if (!line) return null;
  const verdict = VERDICT[line.verdict];
  return (
    <div className="space-y-0.5">
      <dt className="flex items-baseline justify-between gap-2 text-[0.65rem] font-bold uppercase tracking-wide text-muted">
        {label}
        <span className="tabular-nums normal-case tracking-normal">
          {formatPoints(line.points)} / {formatPoints(line.max)}
        </span>
      </dt>
      <dd className="text-sm">
        <span className={`mr-1 font-bold ${verdict.tone}`} aria-hidden>
          {verdict.icon}
        </span>
        <span className="sr-only">{verdict.text}: </span>
        {line.verdict === "correct" ? (
          <span className="font-semibold text-paper">{line.answer}</span>
        ) : (
          <>
            <span
              className={line.guess ? "text-muted line-through" : "text-muted"}
            >
              {line.guess || "No answer"}
            </span>
            <span className="block font-semibold text-paper">
              <span className="sr-only">Answer: </span>
              {line.answer}
            </span>
          </>
        )}
      </dd>
    </div>
  );
}

/** A revealed card with its own answers, so results sit under each guess. */
function RevealedCard({
  number,
  entry,
  name,
  anime,
  sharpened,
}: {
  number: number;
  entry: CharacterGuessEntry;
  name?: ScoreLine;
  anime?: ScoreLine;
  sharpened: number;
}) {
  const right = [name, anime].filter(
    (item) => item?.verdict === "correct",
  ).length;
  const tone =
    right === 2
      ? "border-correct"
      : right === 1
        ? "border-close"
        : "border-line";
  return (
    <li className={`space-y-3 rounded-lg border-2 bg-ink p-3 ${tone}`}>
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={entry.character.image}
          alt={entry.characterAnswer}
          className="aspect-[3/4] w-full rounded-md object-cover"
        />
        <span className="absolute left-2 top-2 rounded bg-ink px-2 py-0.5 text-xs font-bold text-paper">
          #{number}
        </span>
      </div>
      <dl className="space-y-2">
        <AnswerRow label="Character" line={name} />
        <AnswerRow label="Anime" line={anime} />
      </dl>
      {sharpened > 0 ? (
        <p className="text-xs text-muted">
          Sharpened {sharpened}×: −
          {formatPoints(
            Math.min(
              (name?.points ?? 0) + (anime?.points ?? 0),
              sharpened * SHARPEN_HINT_COST,
            ),
          )}
        </p>
      ) : null}
    </li>
  );
}
