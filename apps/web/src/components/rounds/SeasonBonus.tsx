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
  const fieldClass =
    "w-full rounded-md border border-line-strong bg-ink px-3 py-3 text-paper disabled:opacity-60";
  return (
    <fieldset className="space-y-3" disabled={disabled}>
      <legend className="text-sm font-semibold text-paper">
        Optional bonus guesses
      </legend>
      <p className="text-sm text-muted">
        With the correct anime:{" "}
        {year ? "+50 for a year one off, +100 for the exact year. " : ""}
        {year && season
          ? "Exact year and release season earn +200 total. "
          : ""}
        {numberBonus ? "Numbered season earns a separate +200. " : ""}Skip any
        field without losing anime points.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {year ? (
          <div className="space-y-2">
            <label
              htmlFor={`${id}-year`}
              className="text-sm font-semibold text-paper"
            >
              Release year
            </label>
            <input
              id={`${id}-year`}
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              value={value.year}
              onChange={(event) =>
                onChange({
                  ...value,
                  year: event.target.value.replace(/\D/g, "").slice(0, 4),
                })
              }
              placeholder="e.g. 2019"
              className={fieldClass}
            />
          </div>
        ) : null}
        {year && season ? (
          <div className="space-y-2">
            <label
              htmlFor={`${id}-season`}
              className="text-sm font-semibold text-paper"
            >
              Release season
            </label>
            <select
              id={`${id}-season`}
              value={value.season}
              onChange={(event) =>
                onChange({ ...value, season: event.target.value })
              }
              className={fieldClass}
            >
              <option value="">Skip</option>
              {SEASONS.map((season) => (
                <option key={season} value={season}>
                  {season.charAt(0) + season.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        {numberBonus ? (
          <div className="space-y-2">
            <label
              htmlFor={`${id}-number`}
              className="text-sm font-semibold text-paper"
            >
              Numbered season (+200)
            </label>
            <select
              id={`${id}-number`}
              value={value.seasonNumber}
              onChange={(event) =>
                onChange({
                  ...value,
                  seasonNumber: event.target.value,
                })
              }
              className={fieldClass}
            >
              <option value="">Skip</option>
              {meta.seasonOptions?.map((number) => (
                <option key={number} value={number}>
                  Season {number}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>
    </fieldset>
  );
}
