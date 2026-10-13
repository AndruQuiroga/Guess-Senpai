# Stage A1 handoff - single-source design tokens (2026-10-12)

Nothing committed, reset or stashed. Layout, nav, Today page, `GameShell`, `GameSwitcher`,
`games.ts`, `Anidle.tsx`, `AnidlePage.tsx`, share-card/OG code were not edited by this stage.

## Tokens (`apps/web/src/styles/globals.css` `:root`, mapped in `tailwind.config.ts`)

Tailwind uses plain `var(--x)`, so opacity modifiers (`bg-signal/50`) do not work; use a token.
Contrast is measured against `--ink` / `--panel` / `--panel-raised`.

| Token (utility) | Value | Use | Contrast ink / panel / raised |
| --- | --- | --- | --- |
| `ink` | #171819 | page background | - |
| `panel` | #242628 | cards, fields | - |
| `panel-raised` | #2c2f31 | raised cards, buttons, menus | - |
| `hover` | #34373a | hover surface | - |
| `line` / `line-subtle` / `line-strong` | #484b4d / #383a3c / #686b6d | borders / dividers / interactive borders | borders only (3.3:1 on ink for strong) |
| `paper` | #f4f0e7 | primary text | 15.6 / 13.4 / 11.9 |
| `muted` | #c1c2bd | secondary text | 9.9 / 8.5 / 7.5 |
| `signal` (`-hover`, `-text`, `-soft`, `-deep`, `-ink`) | #ff7658, #ff8a70, #ff987f, #3a2a25, #a44b38, #27110b | accent fill, hover, accent text, tinted surface, border on soft, text on signal | signal 6.8 / 5.8 / 5.1; signal-text 8.5 / 7.3 / 6.5; signal-ink on signal 6.8 |
| `focus` | #ff9b83 | focus ring | 8.7 / 7.4 / 6.6 |
| `correct` (`-soft`, `-ink`) | #5aa97c, #1f3a2c, #9fd8b0 | correct tile/border, surface, text on soft | 6.3 / 5.4 / 4.8; ink-on-soft 7.6 |
| `close` (`-soft`, `-ink`) | #c9a13e, #3d3220, #f2c36b | partial/close | 7.3 / 6.3 / 5.6; ink-on-soft 7.6 |
| `wrong` (`-soft`, `-ink`) | #8f9293, #2c2f31, #b4b6b1 | wrong/neutral grey | wrong ~4.9 / 4.2 / 3.8 (fill/border); wrong-ink 7+ for text |
| `danger` (`-soft`, `-ink`) | #e07a8d, #40242a, #ffb3bf | errors | 6.2 / 5.3 / 4.7; ink-on-soft 8.3 |
| `info` (`-soft`, `-ink`) | #4b87a6, #22343f, #a9d8ef | share/info | ink-on-soft 8.4 |
| radius | `--radius-sm` 6px, `--radius` 10px | `rounded-sm/md` = 6px; `rounded`, `lg`, `xl`, `2xl`, `3xl` = 10px | |

Note: `correct`, `danger` were lightened from the old #3f8a5f / #c0566a so they pass AA as text on all three
surfaces. `wrong` contrast is approximate for the two lower surfaces (grey is meant for fills, text uses `-ink`).
Legacy `brand-*` and `surface-*` colours remain in tailwind for the not-yet-migrated files (`Anidle.tsx`, nav files);
`surface.base/raised` now alias `ink` / `panel-raised`.

## Typography

- Display (logo, headings only): **Bricolage Grotesque** (variable, 600-800). A characterful grotesque with
  quirky ink traps and a slightly editorial/manga-lettering feel; it stays highly readable at small heading sizes
  and pairs with the matte look without turning into a novelty face (Dela Gothic/Bowlby were too heavy and
  harder to read in longer headings).
- Body: **DM Sans** (clean geometric sans, good at 14-16px).
- Loaded via the CSS `@import` in `globals.css` (no `layout.tsx` change needed; layout is owned by the nav agent, so next/font
  was not used). Exposed as `--font-display` / `--font-sans`, and `font-display` / `font-sans` in tailwind. The OG image
  still names Inter (not touched).
- Switching to next/font later needs a layout.tsx edit: set the variables there and drop the @import.

## What changed

- ~740 hex utilities (`text-[#c1c2bd]`, `bg-[#242628]`, ...) in 47 files replaced by semantic utilities, plus `text-white`,
  `text-rose/amber/sky-*`, `text-neutral-400/500`, `text-brand-*`, `text-emerald-*`, `ring-brand-*` mapped to tokens. Near greys
  were snapped (#202223 -> ink, #d0d0ca/#b8bbb7 -> muted, #352c28/#382521/#302c2a -> signal-soft, #383a3c -> hover).
- Band-aid `[class*=]` / `backdrop-filter !important` overrides were already gone; the only `!important` left is the
  `prefers-reduced-motion` reset. No `backdrop-blur`, `bg-white/x`, `shadow-black` left. `GuessOpening` translucent `bg-black/40|60`
  surfaces -> `bg-ink` (the poster/clip blur is a mechanic and stays). Modal scrims (`bg-black/60-75`) kept.
- Deleted: HomeHero, HomeSectionsTabs, ShareRecapCard, DailyRestNotice, DailyCompletionBanner, UpcomingTimeline
  (grep: no importers, no tests).
- Streak heatmap uses correct tokens; milestone frames in `config/streak.ts` partly mapped (cyan/fuchsia/violet
  reward colours intentionally left).

## Still using literals (follow-up)

- `Anidle.tsx` (~60 hex classes), `layout.tsx`, `GameShell.tsx`, `GameSwitcher.tsx`, `HeaderNavigation.tsx`, `NavLink.tsx`,
  `PrimaryNav.tsx`: excluded; the hex values are identical to the token values, so a mechanical sweep with the same
  mapping works once their owners finish. Run the sweep script logic: hex -> table above.
- `config/games.ts` `accentColor` gradient strings (unused by UI), `utils/shareThemes.ts`, `share-card/opengraph-image.tsx`
  (literal colours for exported images), `layout.tsx` `themeColor` (#171819).

## Validation

- `node node_modules/typescript/bin/tsc --noEmit --incremental false`: pass.
- `node node_modules/vitest/vitest.mjs run`: 16 files / 51 tests pass.
- `npx prettier --write` on changed files (npx fetched prettier 3.9.10; files reported unchanged or reformatted trivially).
- Dev server on :3101: `/how-to-play` and `/games` rendered with the new fonts (computed font-family confirmed,
  Bricolage Grotesque loaded) and tokens. Puzzle pages were not viewed (no API container started).
