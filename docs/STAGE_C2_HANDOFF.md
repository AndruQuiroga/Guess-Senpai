# Stage C2 handoff: Unlimited Anidle, evaluation fields, UTC reset_at (2026-10-12)

Nothing committed, reset or stashed. Paths: API under `apps/api`, frontend under `apps/web/src`.

## Backend

- **`GET /puzzles/anidle/practice`** (router stays thin, logic in `services/anidle_practice.py`). Returns
  `AnidlePracticeResponse { practice_id, rules_version: "2", anidle: AnidlePuzzleBundle }`, the same bundle shape as
  `games.anidle` in `/puzzles/today` (rules v2, 8 attempts, hints at 2/4/6, synopsis hints, `solution.coverImage`).
  It reuses the daily's `_load_popular_pool`, `_build_candidate_pool`, `_load_media_details`, `_build_anidle` and
  `_build_solution`. The pick is uniformly random (`secrets`), with optional repeated `?exclude=<mediaId>` (max 20)
  to avoid recent answers (falls back to the whole pool). It never touches `DailyPuzzleSet`, progress, streaks or the
  recent-media history. Empty pool / upstream `ValueError` gives 503.
- `practice_id` is `practice:<random token>`, opaque and **not stored server side**; the client uses it as a storage
  and React key. Guesses are evaluated by the existing `POST /puzzles/anidle/evaluate` (and `/batch`), which is keyed by
  `puzzle_media_id` only, so no practice variant was needed. (Consequence: the media id in the bundle is the answer, as it
  already is for the daily; this is not anti-cheat.)
- **Evaluation payload** now also has `episodes` (scalar feedback, same shape as year/score: guess, target,
  `status`), `format` (list feedback with one item, labels "TV", "TV Short", "Movie", "OVA", ...) and `cover_image`
  (the guessed anime's cover URL, `large` then `extraLarge`/`medium`). Unresolved guesses return unknown episodes,
  empty format, null cover. All have defaults, so older consumers still validate.
- **`reset_at`**: new `UtcDatetime` type (`puzzles/models.py`, `ensure_utc`: naive means UTC) used by
  `DailyPuzzleResponse` and the router's `DailyAvailabilityResponse`. The only two places that serialise it. Verified
  live: `/puzzles/today` and `/puzzles/availability` both emit `...T00:00:00Z`, including when read back from SQLite.
- Tests: `tests/test_anidle_practice.py` (10): practice shape and rules, no snapshot written and
  `_assemble_daily_puzzle` never called, unique opaque ids, exclude/fallback, 503, evaluation of a practice game with
  episodes/format/cover, unresolved guess defaults, `ensure_utc`, `reset_at` ending in `Z` for generated, SQLite-naive
  and unpublished availability. AniList is monkeypatched throughout.

## Frontend

- **Route `/games/anidle/unlimited`** (`app/games/anidle/unlimited/page.tsx` -> `components/puzzle-pages/UnlimitedAnidlePage.tsx`).
  `/games/anidle` still resolves to the dynamic `[slug]` page.
- Reuses `Anidle` (useAnidleGame, GuessInput, HintStrip, GuessGrid, ResultCard) and `AttemptMeter` in `GameShell`.
  It never uses `PuzzleProgressProvider`/`usePuzzleProgress`, the streak or the score.
- Storage (`utils/practiceAnidle.ts`): `guesssenpai:practice:anidle:game:v1` (current game incl. progress, so a reload
  resumes) and `guesssenpai:practice:anidle:tally:v1` (`played`, `solved`, `solvedGuesses`). The tally is counted
  once per game when it finishes (solved or out of guesses); average = guesses over solved games. "Skip this puzzle"
  fetches a new one and is not tallied. Last 10 media ids are sent as `exclude`. All storage access is try/catch.
- Result card: `onNewPuzzle` prop turns the primary action into a **New puzzle** button (no link to the next daily
  mode) and switches share copy to "Unlimited Anidle ..." (`buildShareText(..., practice)`).
- Nav: `config/games.ts` has `release: "practice"`, `PRACTICE_MODES`, `UNLIMITED_ANIDLE_HREF`, optional `href`.
  Sidebar gets a "Practice" group with "Unlimited" under the daily modes; mobile gets a dashed-border "Unlimited" chip
  after the daily chips. No status mark. `/games/anidle` is no longer marked current on the unlimited route
  (`isGameActive`). Today has the line "Want more? Play Unlimited Anidle ->" under the tiles; it is outside the daily list
  and score.
- **Grid columns**: Episodes (numeric arrow, "close" within 30%) and Format (correct/wrong; single-value columns
  Format and Source now always show the value, not "+1"). Column order: Title, Year, Score, Popularity, Episodes,
  Format, Source, Genres, Tags, Studio. Mobile card rows: title; year/score/popularity; episodes/format/source;
  genres/tags; studio. Cover thumbnail is wired in the title cell (`coverImage` is now on `AnidleGuessEvaluation`)
  and the ResultCard shows the answer cover (from the correct guess, else from the bundle's `solution.coverImage`,
  new `answerCoverImage` prop, so an exhausted daily/practice game also shows it).
- `CURRENT_ANIDLE_EVALUATION_VERSION` bumped 1 to 2 so saved guesses are re-evaluated (batched replay) and gain the new
  fields. Old records that cannot be refreshed render "no data" tiles. `normalizeAnidleEvaluation` and
  `evaluateAnidleGuess` carry the new fields. Anidle dev fixture uses the constant and has episodes/format data.
- Fixed while testing (pre-existing): at 390 the mobile chip row made the page 733px wide because `sr-only` status
  text in the chips escaped the scroller. Added `relative` to the chip `ul` (scrollWidth now 390).

## Files

Backend: `puzzles/models.py`, `routers/puzzles.py`, `services/anidle_evaluator.py`, new `services/anidle_practice.py`,
new `tests/test_anidle_practice.py`.
Frontend modified: `app/page.tsx`, `app/dev/anidle-fixture/AnidleFixtureClient.tsx`, `components/{Anidle,PrimaryNav}.tsx`,
`components/anidle/{GuessGrid,ResultCard,tiles}.ts(x)`, `components/nav/NavIcon.tsx`,
`components/puzzle-pages/{AnidlePage,PuzzleSlugContent}.tsx`, `config/games.ts`, `types/anidle.ts`,
`utils/{evaluateAnidleGuess,normalizeAnidleEvaluation}.ts`, tests `app/__tests__/page.test.tsx`,
`components/__tests__/{AnidleParts,PrimaryNav}.test.tsx`.
New: `app/games/anidle/unlimited/page.tsx`, `components/puzzle-pages/UnlimitedAnidlePage.tsx`, `utils/practiceAnidle.ts`,
tests `components/__tests__/{UnlimitedAnidlePage,ResultCard}.test.tsx`, `utils/__tests__/practiceAnidle.test.ts`.

## Validation

- pytest (disposable container, source read-only, no .env): 55 passed, 3 skipped.
- `tsc --noEmit --incremental false`: pass. `vitest run`: 24 files, 118 tests pass. Prettier 3.3.3 `--check` clean on all touched files.
- Browser (Next :3106 with `NEXT_DIST_DIR=.next-c2`, API container `gs-stagec2-api` :8006 with live AniList): real guesses in
  daily Anidle (1280 and 390) and Unlimited (1280 and 390). Title suggestions loaded, grid tiles/arrows/new columns/cover
  correct, hint unlocked after 2 wrong, solve showed the result card with cover and "New puzzle", New puzzle fetched a
  different anime, tally went to "Played 2 / Solved 2 / Avg 2.5", and the daily progress key and score were unchanged by
  practice play. Mobile chips show the dashed Unlimited chip with no status. Cleaned up: container removed, dev server
  stopped, `.next-c2` deleted, `tsconfig.json` restored, browser storage for :3106 cleared.

## Not verified / notes

- An exhausted (8 wrong) practice game was only unit-tested, not played in the browser. Reduced motion, screen reader and
  tablet widths not checked.
- Practice evaluation is unauthenticated and keyed by media id: anyone can read any answer's metadata. Same as the daily.
- Pre-existing, noticed: submitting a free-typed title that matches no suggestion is evaluated with all "?" tiles and
  still consumed a guess in the browser run, which seems at odds with the "invalid titles cost no guess" rule text.
  Not touched.
- Practice tally and current game are per browser only; no account sync by design.
- Tile art on Today did not render in dev (image optimiser/CDN in the sandbox); unrelated to this stage.
