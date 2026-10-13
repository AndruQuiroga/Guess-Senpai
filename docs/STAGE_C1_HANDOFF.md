# Stage C1 handoff - daily score and Stage A2 cleanup (2026-10-12)

Nothing committed, reset or stashed. Anidle files (owned by another agent) were not edited by this stage.
Paths are relative to `apps/web` unless noted.

## Daily score

Client-side, presentation only. It is computed from the progress records already stored for today and is
**client-reported: it is not verified by the server and must not be treated as competitive (no leaderboards, no
sharing as a ranking) until scoring moves server-side.**

Pure logic: `src/utils/dailyScore.ts` (tests in `src/utils/__tests__/dailyScore.test.ts`). It reuses
`getGameOutcome` from `utils/gameAction.ts`, so only `solved` scores; exhausted, in-progress and new score 0.

| Mode | Formula |
| --- | --- |
| each playable mode | up to 1,000 points; daily max = 1,000 x today's playable modes |
| Anidle (v2) | attempts `a` of limit `L` (`attemptLimit`, default 8): `1000 * (L - a + 1) / L` (attempt 1 = 1,000, attempt 8 = 125). `a` = `anidleHistory.length`, else `guesses.length`, clamped to 1..L |
| Poster Zoomed, Guess the Opening | per round: efficiency = `max(25%, 100% - 25% * misses)`, misses = `stage - 1` (extra hint stage or wrong guess) or, with no stage, `guesses - 1`. Mode score = mean over rounds x 1,000 |
| Character Silhouette | same, with misses = `guesses - max(1, solved cards)` (its `stage` is solved cards) |
| Redacted Synopsis | single round, misses = `round - 1` (round is the 1..3 hint stage) |
| Legacy records | no `rounds`: falls back to top-level `round` (Synopsis) or `guesses.length - 1`; non-numeric or malformed entries count as 0 misses; missing `attemptLimit` means 8 |

Surfaces:
- `components/nav/useDailyScore.ts` wraps `useStoredDailyProgress`, so it updates live on `guesssenpai:progress-changed`.
  Verified in the browser: dispatching the event updated the sidebar from 0 to 1,750 / 5,000 without reload.
- Desktop sidebar, bottom area above Account: "Today's score" + value (`PrimaryNav.tsx`), links to `/how-to-play#daily-score`.
- Mobile: compact top bar, between the wordmark and the account icon (`n / max`, linked). It hides while progress is unknown.
- Today meta line: "Today 2,450 / 5,000" link (`app/page.tsx`, uses the live context progress).
- How to play: new "Daily score" panel (`id="daily-score"`) with four bullets. `PanelSection` gained an optional `id`.

## Cleanup done

- Poster, Silhouette, Synopsis, Opening pages: dropped `GameSwitcher`, deprecated `round/totalRounds/roundLabel/actions`
  and the unused `slug`/`dailyProgress` props. `status` slots: "Round n / 3" (Poster, Silhouette), "Hint n / 3" or
  "Revealed" (Synopsis), "Opening n / total" (Opening). `PlaceholderPuzzlePage` now takes only `title`.
- AnidlePage and the Anidle fixture no longer used the deprecated props or `GameSwitcher` when this stage finished, so the
  deprecated `GameShell` props were removed and `GameSwitcher.tsx` + its test were deleted.
- Deleted: `AccountBadge.tsx`, `GameSwitcher.tsx` (+ test), `GamePreviewModal.tsx`, `GamesDirectory.tsx`; the `.today-*`,
  `.featured-*`, `.more-puzzles`, `.eyebrow`, `.secondary-heading`, `.play-link`, `.muted-status`, `.account-note` CSS
  (`.status-pill` kept: `ui/Primitives.tsx` uses it). The preview components (`games/*Preview`, `GamePreviewCard`) stay:
  `Daily.tsx` still renders them.
- `/games` is now a simple list of today's playable modes using the same `GameTile` as Today (no filters, so the empty
  "Coming soon" filter is gone). New `components/GameTile.tsx`, shared with `app/page.tsx`.
- Today tiles: art is a 96px (112px from `sm`) square with `object-cover` (the SVGs are 480x480), text on the right at
  every width; no dark letterbox. Checked at 1280 and 390.
- Daily "Time left" over 24h: root cause is the API's `reset_at` arriving without a timezone suffix (SQLite drops it),
  which JS parses as local time; a UTC-4 viewer then saw up to 28h. `Daily.tsx` now counts down to the next 00:00 UTC
  via `getMsUntilNextUtcMidnight` (`utils/time.ts`, tests in `utils/__tests__/time.test.ts`) and ignores `reset_at`.
  The API should still emit an explicit `Z` (not changed here: no server changes).
- Silhouette/Synopsis/Opening spacing without the shell `.panel`: checked at 1280 and 390; each game already owns its
  containers (Silhouette cards, Synopsis/Opening bordered boxes) and matches Poster, so no layout change was needed.
- Literal hex: `NavLink.tsx` and `PrimaryNav.tsx` were already token-only; `layout.tsx` keeps `themeColor: "#171819"`
  because the Next viewport API needs a literal (comment added, mirrors `--ink`).
- Found while browsing: Character Silhouette crashed in dev with "hostname s4.anilist.co is not configured under images"
  (`next/image` with no `remotePatterns`). Added `images.remotePatterns` for `**.anilist.co` in `next.config.mjs`.
  Also added `distDir: process.env.NEXT_DIST_DIR || '.next'` so parallel dev servers do not share one cache (two servers
  on one `.next` produced 404s). Default behaviour is unchanged.

## Files

Added: `src/utils/dailyScore.ts`, `src/utils/__tests__/dailyScore.test.ts`, `src/utils/__tests__/time.test.ts`,
`src/components/nav/useDailyScore.ts`, `src/components/GameTile.tsx`, `docs/STAGE_C1_HANDOFF.md` (repo root).
Modified: `next.config.mjs`, `src/utils/time.ts`, `src/app/page.tsx`, `src/app/__tests__/page.test.tsx`,
`src/app/how-to-play/page.tsx`, `src/app/layout.tsx`, `src/app/games/page.tsx`, `src/app/games/GamesDirectorySection.tsx`,
`src/components/PrimaryNav.tsx`, `src/components/__tests__/PrimaryNav.test.tsx`, `src/components/PanelSection.tsx`,
`src/components/Daily.tsx`, `src/components/GameShell.tsx`, `src/components/__tests__/GameShell.test.tsx`,
`src/components/puzzle-pages/{PosterZoomedPage,CharacterSilhouettePage,RedactedSynopsisPage,GuessOpeningPage,PlaceholderPuzzlePage,PuzzleSlugContent}.tsx`,
`src/styles/globals.css`.
Deleted: `AccountBadge.tsx`, `GameSwitcher.tsx`, `__tests__/GameSwitcher.test.tsx`, `GamePreviewModal.tsx`,
`GamesDirectory.tsx` (all under `src/components`).

## Validation

- `node node_modules/typescript/bin/tsc --noEmit --incremental false`: pass.
- `node node_modules/vitest/vitest.mjs run`: 21 files, 97 passed (includes the Anidle agent's in-flight work).
- Prettier 3.3.3 run on touched files.
- Browser (Next dev :3105 with `NEXT_DIST_DIR=.next-stagec`, disposable API `gs-stagec-api` on :8005; both removed
  afterwards): 1280 and 390 for Today, Poster, Silhouette, Synopsis, Opening, Daily, /games, How to play. No horizontal
  overflow at 390 (scrollWidth equals width). Daily countdown showed 19:11 (under 24h). Not checked: signed-in account row,
  tablet widths, a real play-through that records progress (progress was injected into localStorage and the event
  dispatched), Silhouette art (AniList CDN images did not load in the sandbox; the boxes were empty).

## Leftovers

- Score is client-only; server-side scoring is needed before anything competitive. Persisted `anidleHistory` entries that
  fail normalisation are dropped on load, so such a record scores as attempt 1 (only seen with hand-injected data).
- Silhouette shows "Round n / 3" in the shell and "Round n of 3" in its own stats card; one of them could go.
- `Daily.tsx` still uses `GAMES_DIRECTORY`/bundle presence (Stage A2 item 8) and its own `.panel` look.
- The API should return `reset_at` with an explicit UTC offset.
