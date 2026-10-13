# Stage A2 handoff: navigation, Today, availability, GameShell

Date: 2026-10-12. Branch `redesign/ink-and-signal`. Nothing committed, reset or
stashed. Runs in parallel with the design-token agent (globals.css,
tailwind.config.ts, hex sweep); all new code uses the semantic Tailwind names
(`ink`, `panel`, `panel-raised`, `hover`, `line`, `line-subtle`, `line-strong`,
`paper`, `muted`, `signal`, `signal-ink`, `correct`, `wrong-ink`). No opacity
modifiers on tokens. globals.css was not edited.

## Design decisions

**Navigation (`components/PrimaryNav.tsx`).**
- md+: a sticky 256px left sidebar on every page: wordmark (home), Today, the
  playable daily modes (icon, title, status for today), Archive, How to play,
  and Sign in / account / Log out pinned to the bottom. Active item gets
  `aria-current="page"`, a raised surface and a vermilion inset bar.
- Below md: compact top bar (wordmark + icon account link) and a horizontally
  scrolling row of chips (Today, each mode with status glyph, Archive, How to
  play). Chosen over a bottom tab bar because there are 4 to 5 modes plus
  Archive and Help (a tab bar tops out around 5 and would collide with the
  on-screen keyboard and the title autocomplete on game pages). The hamburger,
  its dialog, focus trap and body-scroll lock are gone, which removes the two
  P1 audit defects (drawer closing on open, hidden-but-focusable drawer) by
  construction. Chips are 44px tall, the row hides its scrollbar and scrolls the
  active chip into view; chip names include the status ("Poster Zoomed, In
  progress") through sr-only text.
- Statuses use `getGameStatus` (new in `utils/gameAction.ts`, built on
  `getGameOutcome`/`getGameAction`) so "Out of guesses" is never "Resume". Text
  plus glyph (○ ◐ ✓ ✕); colour only supplements. While progress is unknown
  (daily or account not resolved) no status is shown rather than a false "New".
- Sidebar progress is read-only: `useStoredDailyProgress` (new, in
  `hooks/usePuzzleProgress.tsx`) reads the same storage key the providers write
  and follows a new same-tab `guesssenpai:progress-changed` event dispatched from
  the provider's `persist`, plus the `storage` event. Navigation never starts its
  own sync or fetch. Verified live: a game with saved attempts shows "In
  progress" in the sidebar and chips and on Today.
- Account: `components/nav/NavAccount.tsx` (sign in, account link, Log out,
  loading, retry on error). `AccountBadge.tsx` is now unused by navigation
  (left in place, not deleted).
- Deleted `HeaderNavigation.tsx`. `NavLink.tsx` kept (semantic tokens, 44px,
  `aria-current`, exported `matchesPath` that ignores query strings, so the
  Archive link with `?selected=` stays active on `/archive/...`).

**Today (`app/page.tsx`).** h1 "Today", one small line (date, "Resets 00:00 UTC",
streak for signed-in users only), then a 1 column (mobile, art left) / 2 column
grid of equal tiles. Each tile is a single `<Link>` straight to the game: art,
name, one-line description (`tagline`), status. No eyebrows, hero subtitle, More
puzzles list, preview modal, or separate Play/Resume buttons. Kept: loading,
error + Retry (+ "Play Anidle" fallback), `DailyRolloverNotice`,
`PuzzleProgressProvider` (server sync for signed-in users), guest sign-in note.
The old `.today-*`, `.featured-*`, `.more-puzzles` CSS in globals.css is now dead;
the token agent can delete it.

**Availability as single source of truth (`config/games.ts`).**
New `release: "always" | "daily" | "unreleased"` on every entry.
- `unreleased` (mystery-voice, emoji-synopsis, quote-quiz): never in a user-facing list.
- `daily` (guess-the-opening): `comingSoon` is now false; `playable` is resolved
  only from `buildRuntimeGamesDirectory({guessTheOpeningEnabled})`.
- `getPlayableGames` / `isUserFacingGame` helpers; `useRuntimeGamesDirectory()`
  now returns only playable user-facing modes (so the opening is hidden while
  availability is pending or errored, and `GamesDirectory`, `GameSwitcher`, nav
  and Today all agree). `buildRuntimeGamesDirectory` still returns every entry for
  tests.
- Direct visit to `/games/<unreleased>` renders `GameUnavailable` ("isn't
  available yet", Back to Today) from `games/[slug]/page.tsx`; unknown slugs stay
  404. Visiting `/games/guess-the-opening` when it is off falls through
  `PuzzleSlugContent` to `PlaceholderPuzzlePage`, now the same friendly page.

**GameShell.** Title as `h1` plus a 44px "?" button (`aria-expanded`,
`aria-controls`, Escape closes and refocuses) that discloses the config
summary/rules; slug comes from the `slug` prop, else the route, else a title
match. Optional `status` ReactNode slot (renders nothing by default). Round badge,
progress bar, and the card chrome are removed. `round`, `totalRounds`,
`roundLabel`, `actions` remain as optional, ignored, `@deprecated` props so
AnidlePage and the other puzzle pages compile unchanged. The in-header
GameSwitcher is dropped (sidebar and chips replace it); `GameSwitcher.tsx` is
`@deprecated` and only used by the dev fixture and its test.
`games/[slug]/page.tsx` lost its duplicate title/"Part of GuessSenpai Daily"/
"← Today" header (the h1 only renders there when the puzzle fetch failed).

## Files touched

Edited: `app/layout.tsx`, `app/page.tsx`, `components/PrimaryNav.tsx`,
`components/NavLink.tsx`, `components/GameShell.tsx`,
`components/GameSwitcher.tsx` (deprecation comment only), `config/games.ts`,
`utils/gameAction.ts` (added `getGameStatus`, `GAME_STATUS_TEXT`),
`hooks/useDailyAvailability.tsx` (`useRuntimeGamesDirectory`),
`hooks/usePuzzleProgress.tsx` (event + `useStoredDailyProgress`),
`app/games/[slug]/page.tsx`, `components/puzzle-pages/PlaceholderPuzzlePage.tsx`,
`components/__tests__/PrimaryNav.test.tsx` (rewritten),
`components/__tests__/AnidlePage.test.tsx`.
New: `components/nav/NavIcon.tsx`, `NavAccount.tsx`, `StatusMark.tsx`,
`useNavGames.ts`, `components/GameUnavailable.tsx`,
`app/__tests__/page.test.tsx`, `components/__tests__/GameShell.test.tsx`,
`utils/__tests__/gameStatus.test.ts`.
Deleted: `components/HeaderNavigation.tsx`.
(Paths relative to `apps/web/src`; all under `apps/web` except this doc.)

## Validation

- `node node_modules/typescript/bin/tsc --noEmit --incremental false`: pass.
- `node node_modules/vitest/vitest.mjs run`: 19 files, 67 passed, 2 skipped.
- Prettier run on every touched file.
- Browser (Next dev :3102, disposable API container :8002 from the local API
  source mounted read-only with an in-container SQLite file, AniList reads;
  container removed and dev server stopped afterwards; existing containers
  untouched): 1280 Today (sidebar + 2x2 tiles), Anidle with "?" open, 390 Today,
  390 Poster, 390 `/games/mystery-voice` (friendly page, no crash). No horizontal
  page overflow at 390 (layout width equals viewport). Not checked: signed-in
  account row, Guess the Opening on, real keyboard Tab pass, 200% zoom, screen
  reader, tablet widths 768 to 1024 (sidebar appears at 768; 256px sidebar leaves
  about 510px of content).
- API note: the stock `guess-senpai-api` image is stale (its schema bootstrap
  runs `CREATE EXTENSION` on SQLite); mount `apps/api/src` as the handoff did. A
  first `/puzzles/today` cached an empty AniList pool once; restarting the
  container fixed it.

## Stage B must pick up

1. **Anidle progress in the shell.** Pass `status={<>Guess n / 8</>}` from
   `AnidlePage` (it still computes `displayRound`/`totalRounds`/`roundLabel` and
   passes them to the now-ignored props). Un-skip the two skipped tests in
   `AnidlePage.test.tsx` and adapt them to the status slot. Other pages
   (Poster, Silhouette, Synopsis, Opening) also pass the ignored props and
   `actions={<GameSwitcher/>}`; remove those and the `GameSwitcher` imports.
2. **Duplicate rules UI on Anidle.** Anidle.tsx has its own "How to play Anidle"
   `<details>`; with the shell "?" there are two. Keep one.
3. **Shell no longer frames the game in a `.panel`.** Poster/Silhouette/Opening
   components were rendered inside that card; check each for spacing and
   background (Poster and Anidle looked fine at 390/1280).
4. `/games` (GamesDirectorySection) still has a "Coming soon" filter that is now
   always empty (count 0), and the opening shows only when enabled. Consider
   removing the page or redirecting it to Today; footer no longer links to it.
5. Dead code to delete: `AccountBadge.tsx`, `GameSwitcher.tsx` (+ its test and
   the fixture usage), legacy `.today-*`/`.featured-*`/`.more-puzzles` CSS,
   `GamePreviewModal` (no longer opened from Today).
6. Token agent: `--signal-text: var(--signal-text)` in globals.css is
   self-referential (invalid). Nav code avoids it, but anything using
   `text-signal-text` will not resolve.
7. The sidebar reads local progress only. Signed-in progress made on another
   device appears in the sidebar after a provider-backed page (Today or a game)
   refreshes it, not on Archive, How to play or Account.
8. `Daily.tsx` timeline still lists modes by `GAMES_DIRECTORY` and bundle
   presence (works because unreleased modes have no `gameKey`); it should move
   to `useRuntimeGamesDirectory` if it is kept.
