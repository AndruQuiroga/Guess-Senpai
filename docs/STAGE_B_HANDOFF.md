# Stage B handoff: Anidle rebuild (2026-10-12)

Nothing committed, reset or stashed. Shared files (`types/progress.ts`, `types/anidle.ts`, `utils/gameAction.ts`,
`usePuzzleProgress`, `GameShell`, globals/tailwind) were not edited.

## Component map (`apps/web/src/components`)

| File | Role |
| --- | --- |
| `Anidle.tsx` | Thin composition, same props as before. Order: GuessInput, HintStrip, ResultCard (finished only), GuessGrid. |
| `anidle/useAnidleGame.ts` | State, v2/legacy rules, persistence (`onProgressChange`), submit lock, free invalid/repeat/alias handling, hint selection, `lastAddedIndex` for the reveal. Behaviour ported verbatim from the old file. |
| `anidle/useAnidleHydration.ts` | Batched rebuild of saved guesses without a current evaluation, plus `createFallbackEvaluation`, `getHistoryKey`, `makeCacheKey`. |
| `anidle/hints.ts` | Pure `computeAnidleHints(payload, rules, incorrectCount)`; v2 (2/4/6, metadata fallback) and legacy (10, then every 2). |
| `anidle/tiles.ts` | Pure tile logic: `scalarTile`, `listTile`, `evaluationTones`, column definitions, tone classes. |
| `anidle/GuessInput.tsx` | Prompt, `TitleGuessField`, Guess button, inline error, refocus after a guess is processed. |
| `anidle/HintStrip.tsx` | Compact hint area; `RedactedText` turns `[REDACTED]` into black inline bars. |
| `anidle/AttemptMeter.tsx` | "Guess n / max" plus pips (`data-pip="used|open"`, `data-hint` at thresholds). |
| `anidle/GuessGrid.tsx` | Comparison grid, legend (`GridLegend`), hydration overlay. |
| `anidle/ResultCard.tsx` | Solve or exhausted card: answer, mini colour grid, Share (`buildShareText`, unchanged copy), Next puzzle. |
| `puzzle-pages/AnidlePage.tsx` | Passes `status` (AttemptMeter for v2, "Round n" for legacy) and `rules` copy to `GameShell`. Dropped the ignored `round`/`actions` props and the `GameSwitcher` import. |

`app/dev/anidle-fixture`: now renders `AnidlePage` (so the shell meter and "?" are real) with local state.
`?state=empty|progress|solved|exhausted` (default empty). The old `?state=solved` still works. `AnidlePreview.tsx` needed no change.

## Design decisions

- **Empty state**: only "Enter a first guess to start", the input and a "Guess" button (accessible name stays "Submit Guess").
  The "How to play" `<details>` is gone; the rules are passed to `GameShell` through its `rules: string[]` prop.
- **Hints** appear below the input only once unlocked. Redaction bars cycle through fixed widths. The engine emits one
  `[REDACTED]` token per word and drops the word length, so true "sized to word length" would need the API to send lengths.
- **Grid**: newest first; solid tiles. correct = green fill, close = yellow fill with dashed border, wrong = dark
  neutral fill with grey border (so eight rows are not a wall of grey). Meaning is also carried by an icon (check, arrows,
  "?") and an sr-only label per cell. Arrows point toward the answer (up = answer is higher), matching the old semantics.
  "Close" is computed in `tiles.ts` from guess/target: year within 2, score within 5, popularity within 30%.
  Lists: tile tone = all/some/none matched; matched chips (cap 3 genres/tags, 2 studio, 1 source) then `+n`.
  New row reveals cell by cell (90 ms stagger, CSS keyframes injected by the grid, disabled under reduced motion).
- **Mobile (390): compact card per guess**, not a scrolling table. The grid is 6 columns (title row, 3 scalar tiles,
  then lists in pairs) with each tile carrying its own tiny caption, so every colour is visible without sideways scrolling
  or tapping, and no scroll trap competes with the autocomplete/keyboard. Cost: a card is about 270px tall, so a long game scrolls.
  The table layout starts at `xl` (1280), not `lg`, because the 256px sidebar leaves only about 720px at 1024.
  Verified: no horizontal overflow at 1280 (scrollWidth equals clientWidth) and cards fit at 390.
- **Fields the evaluation really returns**: year (+season), score, popularity, genres, tags, studios, source. It has no
  episodes, format or cover. So no Episodes or Format column and no thumbnail is rendered. `AnidleEvaluationView`
  (in `tiles.ts`) adds an optional `coverImage` that GuessGrid and ResultCard already honour if the API adds it.
  The result card therefore shows no cover today.
- Result card text: "Solved in n/8" (legacy: "Solved in n attempts") and "Out of guesses" + "Answer revealed".
  Next puzzle is an own `Link` ("Back to Today" with no `nextSlug`) instead of `NextPuzzleButton`, which linked to the dead `/games/daily`.
- Literal hex: none left in the owned files (grep clean).

## Validation

- `tsc --noEmit --incremental false`: pass. `vitest run`: 22 files, 98 tests pass (no skips left in AnidlePage).
- Changed existing tests only where wording changed: submit label check (`/^Guess$/`), "Solved in 8/8".
- New: `AnidleParts.test.tsx` (tile colouring and arrows, grid order/chips/+n/animation target, AttemptMeter pips and
  thresholds, redaction bars, empty state, prompt hidden once guesses exist); `AnidlePage.test.tsx` rewritten
  (legacy Round, v2 "Guess 3 / 8", exhausted "Guess 8 / 8", rules behind "?").
- Prettier 3.3.3 run on all touched files.
- Browser (Next dev :3104, review API :8003): fixture empty/progress/solved at 1280, progress at 390, real
  `/games/anidle` at 390 and 1280. Not verified: a real new guess end to end (title suggestions failed with "Couldn't
  load suggestions" from this origin, likely AniList/CORS in the review API, so the live reveal animation was only unit-tested), exhausted fixture visually,
  reduced-motion, screen reader pass.

## For Stage C (Unlimited Anidle)

- Reuse `useAnidleGame` (pass a payload with `rules` for a finite run, or without for unlimited), `GuessInput`, `GuessGrid`,
  `HintStrip`, `ResultCard` (`maxAttempts` null = legacy wording), `AttemptMeter`. `Anidle.tsx` is a ~70-line template.
- `ResultCard` share text is daily-specific ("today's Anidle"); give it a prop if unlimited needs different copy.
- The hook calls `onProgressChange` on every history change, and persists `attemptLimit` only for v2.
- Pre-existing quirks left alone: the hook resets its state whenever `initialProgress` identity changes (needed for provider
  round trips); the legacy three-round controller is still wired through `registerRoundController`.
- Possible shared-file follow-ups (not done): add `coverImage`/episodes/format to the evaluation API and `types/anidle.ts`;
  have the engine emit redacted word lengths; `NextPuzzleButton` still points to `/games/daily`.
