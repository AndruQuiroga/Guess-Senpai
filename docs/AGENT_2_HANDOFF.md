# Agent 2 handoff — Ink & Signal Today → Anidle → results

Date: 2026-10-12

## Implemented

- Replaced the discovery-heavy home with Today: Anidle and Poster are featured,
  each with progress-aware Play / Resume / Results actions. Synopsis and
  Character Silhouette remain available below; future modes are absent from this
  primary play surface.
- Simplified the shared navigation to Today, Archive, and account access. The
  Games directory, How to Play, `/games/daily`, and archive routes remain
  reachable.
- Added opaque Ink & Signal tokens and shared `Panel`, `Button`, `Field`,
  `Status`, and `Dialog` primitives. The shell has a skip link, visible focus,
  reduced-motion rules, smaller corners, and no page-wide gradient/noise/blur.
- Reworked Anidle instructions, separate round and attempt counts, real hint
  schedule, opaque comparison surfaces, text/symbol match feedback, responsive
  expandable guess details, answer reveal, one primary next action, and
  spoiler-free share text. Share cancellation is neutral.
- Kept the Agent 1 autocomplete and evaluation contract. Suggestion selection
  fills the field; submit is explicit; a failed evaluation preserves the input
  and does not append history.
- Improved the retained preview dialog with bounded scrolling, focus return,
  and isolation of main content while open.
- Added `/dev/anidle-fixture` for local browser review only. It is blocked in
  production and explicitly labels its synthetic puzzle and solved progress.

## Key files

- Today page and tokens: `apps/web/src/app/page.tsx`,
  `apps/web/src/styles/globals.css`, `apps/web/tailwind.config.ts`.
- Navigation and layout: `apps/web/src/app/layout.tsx`,
  `apps/web/src/components/{HeaderNavigation,PrimaryNav,NavLink,AccountBadge}.tsx`.
- Shared UI: `apps/web/src/components/ui/Primitives.tsx`.
- Anidle journey: `apps/web/src/components/Anidle.tsx`,
  `apps/web/src/components/GameShell.tsx`,
  `apps/web/src/components/games/TitleGuessField.tsx`,
  `apps/web/src/components/NextPuzzleButton.tsx`.
- Fixture: `apps/web/src/app/dev/anidle-fixture/`.

## Validation

- Vitest: 11 files / 27 tests passed after the final edits, including neutral
  handling of native-share cancellation.
- TypeScript: passed after the final edits.
- Production build: compilation, type validation, and page generation passed;
  final standalone trace packaging failed with `EPERM` creating dependency
  symlinks under `.next/standalone`.
- Browser: local Next dev server on port 3101; desktop Today and Anidle plus
  mobile 390px Today and Anidle were inspected. At 320×640, 390×844, 768×900,
  and 1024×768, Today’s first Play button fit within the viewport and no
  horizontal page overflow was measured. The button also fit at 390×480.
  Anidle had no horizontal page overflow at those widths. The fixture did not
  auto-focus the answer field.
- Screenshots were captured and visually inspected in the browser tool, but its
  screenshot output did not provide a local export path. No screenshot files
  are included. This does not satisfy the requested screenshot-file delivery.
- Calculated contrast ratios: `#F4F0E7` on `#171819` is 15.63:1; on `#242628`
  it is 13.35:1; `#27110B` on `#FF7658` is 6.82:1; and `#C1C2BD` on `#242628`
  is 8.47:1. This is not a complete measurement of all legacy routes.
- API startup was unavailable, so there is no live answer suggestion,
  evaluation, reload/resume, or upstream integration verification. The fixture
  is not evidence of any external integration.

## Preserve for Agent 3

- Keep Today’s per-game action derived from `getGameAction` and date-scoped
  progress; do not replace the established local/account progress schema.
- Keep the `TitleGuessField` selection-versus-submit behavior and avoid opening
  the mobile keyboard automatically.
- Keep Anidle rounds distinct from the number of accepted attempts. Its actual
  synopsis hint threshold is ten incorrect guesses, then every two guesses.
- Keep spoiler-free share content and treat native-share cancellation as a
  neutral outcome.
- Keep `/dev/anidle-fixture` visibly labeled and out of production behavior.

## Remaining

- Rerun tests and type checking after final edits; retry a production build when
  Windows symlink creation is available.
- Export requested desktop/mobile screenshot files if the browser tooling offers
  a writable screenshot destination. Check 200% zoom, reduced motion, short
  viewport dialogs, real mobile keyboard/dropdown positioning, and keyboard-only
  gameplay with a live or controlled API.
- An idle API prevented confirmation of data-backed resume and completed-state
  reload. The rest of the older UI still contains glass-like classes outside
  the Today/Anidle slice; shared game-shell blur is disabled in the new shell.
