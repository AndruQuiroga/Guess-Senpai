import { useState, type ReactNode } from "react";

import { line, type ScoreLine } from "./scoring";

export const SEASON_NUMBER_POINTS = 200;
export const RELEASE_YEAR_POINTS = 100;
export const RELEASE_SEASON_POINTS = 100;
const SEASONS = ["WINTER", "SPRING", "SUMMER", "FALL"] as const;

export interface SeasonMeta {
  seasonOptions?: number[];
  year?: number | null;
  season?: string | null;
  seasonNumber?: number | null;
  seriesTitles?: string[];
}

export interface SeasonAnswers {
  year: string;
  season: string;
  seasonNumber: string;
}

export function releaseYear(meta: SeasonMeta): number | null {
  return meta.year ?? (Number(meta.season?.match(/\b\d{4}\b/)?.[0]) || null);
}

function releaseSeason(meta: SeasonMeta): string | null {
  return (
    SEASONS.find((season) => meta.season?.toUpperCase().startsWith(season)) ??
    null
  );
}

export function hasNumberedSeasonBonus(meta: SeasonMeta): boolean {
  return Boolean(
    meta.seasonNumber &&
    meta.seasonOptions &&
    meta.seasonOptions.length > 1 &&
    meta.seasonOptions.includes(meta.seasonNumber),
  );
}

export function seasonRoundMax(base: number, meta: SeasonMeta): number {
  return (
    base +
    (releaseYear(meta)
      ? RELEASE_YEAR_POINTS + (releaseSeason(meta) ? RELEASE_SEASON_POINTS : 0)
      : 0) +
    (hasNumberedSeasonBonus(meta) ? SEASON_NUMBER_POINTS : 0)
  );
}

export function matchesSeriesTitle(guess: string, meta: SeasonMeta): boolean {
  const normalize = (value: string) =>
    value.trim().replace(/\s+/g, " ").toLowerCase();
  return (
    Boolean(guess.trim()) &&
    Boolean(
      meta.seriesTitles?.some((title) => normalize(title) === normalize(guess)),
    )
  );
}

export function seasonBonusLines(
  meta: SeasonMeta,
  answers: SeasonAnswers,
  animeCorrect: boolean,
): ScoreLine[] {
  const year = releaseYear(meta);
  const season = releaseSeason(meta);
  const guessedYear = /^\d{4}$/.test(answers.year)
    ? Number(answers.year)
    : null;
  const exactYear = animeCorrect && year !== null && guessedYear === year;
  const result: ScoreLine[] = [];
  if (year) {
    result.push(
      line(
        "Release year",
        answers.year,
        String(year),
        exactYear
          ? "correct"
          : animeCorrect &&
              guessedYear !== null &&
              Math.abs(guessedYear - year) === 1
            ? "close"
            : "wrong",
        RELEASE_YEAR_POINTS,
      ),
    );
    if (season)
      result.push(
        line(
          "Release season + exact year",
          answers.season ? `${answers.season} ${answers.year}`.trim() : "",
          `${season} ${year}`,
          exactYear && answers.season === season ? "correct" : "wrong",
          RELEASE_SEASON_POINTS,
        ),
      );
  }
  if (hasNumberedSeasonBonus(meta))
    result.push(
      line(
        "Numbered season",
        answers.seasonNumber ? `Season ${answers.seasonNumber}` : "",
        `Season ${meta.seasonNumber}`,
        animeCorrect && Number(answers.seasonNumber) === meta.seasonNumber
          ? "correct"
          : "wrong",
        SEASON_NUMBER_POINTS,
      ),
    );
  return result;
}

const SEASON_ICONS: Record<(typeof SEASONS)[number], string> = {
  WINTER: "❄️",
  SPRING: "🌸",
  SUMMER: "☀️",
  FALL: "🍂",
};
const FIRST_DECADE = 1970;

const chipClass = (selected: boolean) =>
  `inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition disabled:cursor-not-allowed disabled:opacity-60 ${
    selected
      ? "border-signal bg-signal-soft font-semibold text-paper"
      : "border-line-strong text-paper hover:bg-hover"
  }`;

/** Single-choice pills; tapping the chosen pill again clears it (a skip). */
function ChoicePills<T extends string | number>({
  labelId,
  options,
  value,
  onChange,
  render,
}: {
  labelId: string;
  options: readonly T[];
  value: T | null;
  onChange(value: T | null): void;
  render(option: T): ReactNode;
}) {
  return (
    <div
      role="radiogroup"
      aria-labelledby={labelId}
      className="flex flex-wrap gap-2"
    >
      {options.map((option) => {
        const selected = option === value;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(selected ? null : option)}
            className={chipClass(selected)}
          >
            {render(option)}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Year entry built for thumbs: pick a decade, then a year, or nudge with
 * the steppers. The text field still takes a typed year.
 */
function YearPicker({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange(value: string): void;
}) {
  const latestDecade = Math.max(
    2020,
    Math.floor(new Date().getFullYear() / 10) * 10,
  );
  const decades: number[] = [];
  for (let decade = FIRST_DECADE; decade <= latestDecade; decade += 10)
    decades.push(decade);
  const typed = /^\d{4}$/.test(value) ? Number(value) : null;
  // The year row only opens on a decade tap and closes again after a pick.
  const [openDecade, setOpenDecade] = useState<number | null>(null);
  const decade =
    openDecade ?? (typed !== null ? Math.floor(typed / 10) * 10 : null);
  // With nothing entered yet, the steppers start from the open decade.
  const step = (delta: number) => {
    setOpenDecade(null);
    onChange(String(typed !== null ? typed + delta : (decade ?? 2010) + 5));
  };
  const stepperClass =
    "min-h-11 min-w-11 rounded-md border border-line-strong bg-panel text-lg font-semibold text-paper hover:bg-hover disabled:opacity-60";
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-stretch gap-2">
        <button
          type="button"
          onClick={() => step(-1)}
          className={stepperClass}
          aria-label="One year earlier"
        >
          −
        </button>
        <input
          id={`${id}-year`}
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={4}
          value={value}
          onChange={(event) => {
            setOpenDecade(null);
            onChange(event.target.value.replace(/\D/g, "").slice(0, 4));
          }}
          placeholder="Year"
          className="w-24 rounded-md border border-line-strong bg-ink px-3 py-2 text-center text-lg tabular-nums text-paper disabled:opacity-60"
        />
        <button
          type="button"
          onClick={() => step(1)}
          className={stepperClass}
          aria-label="One year later"
        >
          +
        </button>
        {value ? (
          <button
            type="button"
            onClick={() => {
              setOpenDecade(null);
              onChange("");
            }}
            className="min-h-11 px-2 text-sm text-muted underline-offset-2 hover:text-paper hover:underline"
          >
            Clear
          </button>
        ) : null}
      </div>
      <div role="group" aria-label="Decade" className="flex flex-wrap gap-1.5">
        {decades.map((start) => (
          <button
            key={start}
            type="button"
            aria-pressed={decade === start}
            onClick={() => setOpenDecade(openDecade === start ? null : start)}
            className={chipClass(decade === start)}
          >
            {start}s
          </button>
        ))}
      </div>
      {openDecade !== null ? (
        <div
          role="group"
          aria-label={`Years in the ${openDecade}s`}
          className="flex flex-wrap gap-1.5"
        >
          {Array.from({ length: 10 }, (_, offset) => openDecade + offset).map(
            (year) => (
              <button
                key={year}
                type="button"
                aria-pressed={typed === year}
                onClick={() => {
                  setOpenDecade(null);
                  onChange(String(year));
                }}
                className={`${chipClass(typed === year)} tabular-nums`}
              >
                {year}
              </button>
            ),
          )}
        </div>
      ) : null}
    </div>
  );
}

export function SeasonBonusFields({
  id,
  meta,
  value,
  onChange,
  disabled,
}: {
  id: string;
  meta: SeasonMeta;
  value: SeasonAnswers;
  onChange(value: SeasonAnswers): void;
  disabled: boolean;
}) {
  const year = releaseYear(meta);
  const season = releaseSeason(meta);
  const numberBonus = hasNumberedSeasonBonus(meta);
  if (!year && !numberBonus) return null;
  const labelClass = "text-sm font-semibold text-paper";
  return (
    <fieldset
      className="space-y-4 rounded-lg border border-line p-4"
      disabled={disabled}
    >
      <legend className="px-1 text-sm font-semibold text-paper">
        Optional bonus guesses
      </legend>
      <p className="text-sm text-muted">
        With the correct anime:{" "}
        {year ? "+50 for a year one off, +100 for the exact year. " : ""}
        {year && season
          ? "Exact year and release season earn +200 total. "
          : ""}
        {numberBonus ? "Numbered season earns a separate +200. " : ""}Skip any
        of them without losing anime points.
      </p>
      {year ? (
        <div className="space-y-2">
          <label htmlFor={`${id}-year`} className={labelClass}>
            Release year
          </label>
          <YearPicker
            id={id}
            value={value.year}
            onChange={(next) => onChange({ ...value, year: next })}
          />
        </div>
      ) : null}
      {year && season ? (
        <div className="space-y-2">
          <p id={`${id}-season`} className={labelClass}>
            Release season
          </p>
          <ChoicePills
            labelId={`${id}-season`}
            options={SEASONS}
            value={SEASONS.find((option) => option === value.season) ?? null}
            onChange={(next) => onChange({ ...value, season: next ?? "" })}
            render={(option) => (
              <>
                <span aria-hidden>{SEASON_ICONS[option]}</span>
                {option.charAt(0) + option.slice(1).toLowerCase()}
              </>
            )}
          />
        </div>
      ) : null}
      {numberBonus ? (
        <div className="space-y-2">
          <p id={`${id}-number`} className={labelClass}>
            Numbered season (+200)
          </p>
          <ChoicePills
            labelId={`${id}-number`}
            options={meta.seasonOptions ?? []}
            value={
              meta.seasonOptions?.find(
                (option) => String(option) === value.seasonNumber,
              ) ?? null
            }
            onChange={(next) =>
              onChange({
                ...value,
                seasonNumber: next === null ? "" : String(next),
              })
            }
            render={(option) => `Season ${option}`}
          />
        </div>
      ) : null}
    </fieldset>
  );
}
