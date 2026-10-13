# Integration handoff - 2026-10-12

Combines the Anidle, visual and release agents' uncommitted work. Nothing was
committed, reset, stashed or reverted; no real database, secret or `.env` was
touched.

## Changes

Anidle exhaustion outside the game (v2 rules: `completed=false`, answer revealed,
entry closed, never a streak solve):
- `apps/web/src/utils/gameAction.ts`: single shared helper (`isProgressExhausted`,
  `getGameOutcome`, `getGameStatusLabel`; `getGameAction` now returns `results`
  for exhausted). Anidle.tsx now derives `exhausted` through the same helper.
- Progress carries `attemptLimit` (v2 budget) so non-game views can derive
  exhaustion from `anidleHistory.length`: `types/progress.ts`, `hooks/usePuzzleProgress.tsx`
  (normalizer), `components/Anidle.tsx` (persists it), backend
  `apps/api/src/app/puzzles/models.py` (`attempt_limit`, alias `attemptLimit`) and
  `services/progress.py` (fallback path).
- Consumers: `app/page.tsx` (Today: "Results" + "Out of guesses"), `GameSwitcher.tsx`,
  `Daily.tsx` timeline (new `exhausted` status, CTA "Results"), `GamePreviewModal.tsx`,
  `games/GamePreviewCard.tsx`, `hooks/useCelebration.ts` (exhausted never triggers
  "Streak saved"). `completed` stays false, so streak/all-complete logic is unchanged.
- AnidlePage header: v2 shows "Guess n / 8" (guess budget; stays at the final
  count once finished) instead of "Round 1 / 1"; legacy rules keep "Round".
  `components/puzzle-pages/AnidlePage.tsx`. (The handoff docs do not literally
  mention an "Anime" label; the stale label was the one-round "Round" header.)
- Tests added: `utils/__tests__/gameAction.test.ts` (4), `__tests__/GameSwitcher.test.tsx`,
  `__tests__/AnidlePage.test.tsx` (2), backend `tests/services/test_progress.py`
  (attempt limit round trip).
- The `Anidle.test.tsx:268` typecheck error was not present when rechecked
  (typecheck already passed); no change was needed.

Matte styling:
- `GlassSection.tsx` removed; replaced by `components/PanelSection.tsx` (opaque
  `.panel`, 1px border, 10px radius, optional `dashed`; decorative
  accent/hoverGlow/borderIntensity props dropped). Imports updated in account,
  login, how-to-play, Daily, GamesDirectory, NotificationOptInCard, account/*.
- Repo-wide pass over non-test src: removed backdrop-blur, shadow-glow/ambient,
  decorative gradient strips/blobs, gradient buttons (now vermilion `#ff7658`
  with dark ink), translucent `bg-white/*`, `border-white/*`, tinted state
  surfaces (now opaque), `hover:scale`, `rounded-3xl/4xl`; streak heatmap
  (`styles/streak.css`) and milestone frames (`config/streak.ts`) are flat colours;
  `GamePreviewCard` rewritten matte; unused glow/aurora tokens removed from
  `tailwind.config.ts` and glow overrides from `globals.css`.
- Intentionally kept: poster crop, silhouette filter and redacted-synopsis
  masking; modal scrims (`bg-black/60-75`); character-card image scrim; share-card
  theme gradients (`utils/shareThemes.ts`, `app/share-card/opengraph-image.tsx`,
  theme swatches) since they preview exported images; `accentColor` gradient
  strings in `config/games.ts` (now unused by UI).
- Small layout fix: "← Today" button on game routes no longer wraps at 390px.
- Prettier 3.3.3 was run on all touched frontend files.

## Validation (exact)

Web tooling was already restored when I started (pnpm layout:
`pnpm-lock.yaml`, symlinks into `node_modules/.pnpm`; no reinstall needed).
- `cd apps/web && node node_modules/typescript/bin/tsc --noEmit --incremental false`: pass.
- `cd apps/web && node node_modules/vitest/vitest.mjs run`: 16 files, 51 tests pass
  (baseline before my edits: 14 files / 44).
- Backend, disposable container, source mounted read-only, no `.env`:
  `docker run --rm -v <apps/api>:/work:ro -w /work -e PYTHONPATH=src guess-senpai-api sh -c "pip install -q pytest pytest-asyncio alembic==1.14.0; pytest -q -p no:cacheprovider"`
  -> 45 passed, 3 skipped (opt-in PostgreSQL / live network), 0 failed.
  (Use the `pytest` binary, not `python -m pytest`: cwd `alembic/` shadows the package.)
- Browser: Next dev server on :3100 against a disposable API container (:8001,
  SQLite file inside the container, public AniList reads; container removed).
  Viewed Today, Anidle, Poster, Archive, Login (Account redirects there when
  signed out), How to play, Games and Daily at 1280 wide, and Today, Anidle, Poster,
  Archive, Login, How to play, Daily at 390 wide. Live puzzle generation, title
  search and guess evaluation worked. Exhaustion was checked by padding the saved
  local progress to 8 accepted guesses: Anidle showed "Out of guesses - Answer
  revealed" with header "Guess 8 / 8", Today showed "Out of guesses" and "Results",
  Daily timeline showed "Out of guesses" / "Results".

## Not verified / remaining

- Signed-in Account page and AniList login flow (no credentials, no OAuth).
- Poster/Synopsis/Silhouette/Opening gameplay beyond first render; mobile
  Synopsis, Silhouette and archive-date pages were not viewed.
- `Daily.tsx` "Time left" read 26:41:33 in the browser (more than 24h);
  not caused by this work, not investigated.
- Progress saved before this change, with no `attemptLimit`, keeps showing
  "Resume" until that Anidle route is reopened (it then persists the limit).
- Dead components (HomeHero, HomeSectionsTabs, ShareRecapCard, DailyRestNotice,
  DailyCompletionBanner, UpcomingTimeline) were restyled mechanically but are
  not imported anywhere; consider deleting.
- Daily "all complete" banner/share logic still counts only solves, so an
  exhausted day never reads as "all done".
- Server-authoritative scoring, answer exposure and release gates from the
  earlier handoffs are unchanged.
- `docs/REPOSITORY_STATE.md` was not updated.
