# UX/UI audit

Reviewed: 2026-10-12 against `f55f08f` and the repository state review.
Scope: navigation, home/discovery, daily and individual games, account/login,
archive, sharing, notifications, styling, and accessibility patterns.

This is a source-based audit. The existing frontend dependency directory is
incomplete (Next/Vitest executable modules are unavailable), and the previous
pnpm attempt failed with a filesystem permission error. No rendered screenshots,
measured contrast, mobile device behavior, or end-to-end results are claimed.
Findings below distinguish direct code defects from concerns needing visual QA.

## Overall assessment

The product has a recognizable design direction and substantial UI coverage.
Dark navy surfaces, blue accents, Inter/Space Grotesk typography, glass effects,
rounded cards, and mode-specific illustrations establish a consistent identity.
The daily experience includes saved progress, completion state, reset timers,
next-game actions, account sync, and sharing rather than just isolated demos.

The primary weakness is interaction reliability and accurate expectations.
Navigation, keyboard selection, dialogs, availability states, and recovery have
concrete defects or inconsistent contracts. Address these before a broad visual
redesign. Source styling also suggests small text, excessive decorative emphasis,
and cramped mobile layouts; these require a rendered pass before final judgments.

## Strengths to retain

- Shared layout, navigation links, game shell, and glass section components.
- Distinct playable/coming-soon states and mode-specific artwork.
- Resume/completed actions, guest progress, account synchronization and next-game
  navigation that support a daily habit.
- Title autocomplete includes debounce, arrow-key navigation, input Enter
  selection, combobox/listbox semantics, and loading/empty/error states.
- Several game feedback regions use `aria-live="polite"`; toast feedback uses a
  status role. Poster season/year controls have accessible names.
- Preview dialog has an accessible title/description, Escape handling, a focus
  loop, and body scroll locking. Mobile navigation attempts similar safeguards.
- Sharing includes native share, clipboard/text, and downloadable-card paths.
- Notification permission is requested through an explicit user action, with
  unsupported and denied-permission handling.

## Prioritized findings

P1 means a core journey or access method is blocked. P2 means a meaningful
usability/accessibility/trust defect. P3 means polish or consistency work.

### P1 — Mobile navigation closes as soon as it opens

**Confirmed source defect.** In `PrimaryNav.tsx`, the effect at lines 50–55 calls
`close()` whenever `isOpen` is true and depends on `isOpen`. Opening the drawer
therefore triggers the same effect intended to close it after a route change.
Mobile users lose the main path to Games, Archive, How to Play, and account access.

Close only when the pathname changes, rather than when open state changes.
Verify that opening holds the drawer open, route selection closes it, and Escape
returns focus to the toggle. A focused navigation regression test is warranted.

### P1 — Invisible mobile navigation stays in the keyboard sequence

**Confirmed source defect.** `PrimaryNav.tsx:157` hides the closed mobile wrapper
from assistive technology using `aria-hidden`, opacity, and pointer-events, but
its links/buttons remain mounted and focusable. These properties do not remove
elements from Tab navigation. At mobile widths, keyboard users can focus invisible
controls hidden from screen readers.

Unmount the closed drawer, use actual visibility removal, or make it inert while
closed. Keep any exit animation separate from the interactive mounted state.
Validate Tab order both before opening and after closing.

### P1 — Suggestion buttons do not activate through keyboard click

**Confirmed source defect.** In `games/TitleGuessField.tsx:295`, suggestion buttons
select using `onMouseDown` only, with no `onClick`. Input Arrow/Enter selection
works, but Tab to a suggestion followed by Enter/Space, or an assistive-technology
click, does not use that selection path. The input's blur timeout can additionally
close the menu while focus is entering it.

Choose one coherent combobox interaction model. Keep focus on the input with
active-descendant navigation, or make suggestion activation work for all click
sources. Prevent blur without making mouse-down the sole activation handler.
Explain whether choosing a suggestion immediately submits a guess: the current
implementation does, which can surprise players who expect a separate submit step.

### P2 — Game descriptions contradict the actual game

**Confirmed source mismatch.** `config/games.ts` describes Anidle as OP/ED mashups;
`components/Anidle.tsx` and the How to Play page implement/describe metadata
comparison. How to Play also claims each incorrect guess unlocks another hint
round, while Anidle contains separate progression and a synopsis threshold of ten
incorrect guesses followed by two-guess intervals.

Use one game rules source for directory, preview, help, and in-game instructions.
Explain rounds, attempts, hint unlocks, and completion accurately. Validate rules
against current difficulty settings rather than writing a universal claim.

### P2 — Reset and archive promises are inaccurate

**Resolved in Agent 3 source changes.** Daily date selection now uses midnight
UTC, the API supplies `reset_at`, date labels specify UTC, and archive discovery
lists only published snapshots. An unpublished past date returns 404; upstream
cache expiry cannot regenerate a published row. Verify this with a live API and
negative-offset browser before release.

The open daily page retains its fetched puzzle after midnight and displays an
explicit “new daily available” action; choosing it reloads into the new snapshot.
The archive remains limited to dates with published rows.

Navigation now reads lightweight `/puzzles/availability` metadata instead of
hydrating the puzzle/clip payload. The service worker caches static assets only;
HTML, daily puzzle responses, and progress are network requests to avoid shared
stale/cross-account cache entries.

### P2 — Dialog focus and viewport behavior are inconsistent

**Confirmed missing safeguards; clipping needs rendered validation.**
`GamePreviewModal.tsx` does not restore focus to its opener. Its centered dialog
has no viewport-height limit or internal vertical scrolling, while body scrolling
is disabled. Expanded rules and mobile/zoomed screens can make actions inaccessible.
`games/character-silhouette/RoundSummaryModal.tsx` restores focus but lacks a focus
trap, background inertness, body scroll lock, and viewport overflow handling.

Use a shared dialog primitive with focus placement, containment, restoration,
background isolation, and a scrollable height-constrained body. Define Escape
behavior for mandatory round transitions; retaining an explicit Continue action
is reasonable, but focus must stay within the modal. Check fixed dialog positioning
inside ancestors that use backdrop filtering; preview already uses a portal while
the round summary does not.

### P2 — Home tiles nest interactive controls and mislabel their action

**Confirmed source behavior.** In `app/page.tsx:237`, a focusable `role="button"`
tile contains Start and Retry buttons. The outer Enter/Space handler does not
exclude descendant targets, so keyboard activation can open a preview while a
user operates an inner control. Start also opens a preview rather than starting
the game, and the generic label appears on upcoming tiles.

Use a non-interactive card container with separate sibling preview/play actions.
Label actions by what happens: Preview, Play, Resume, View results, or Coming soon.
Keep unavailable status text consistent with the action.

### P2 — Availability state can misrepresent playable content

**Confirmed source behavior.** `useDailyAvailability.tsx` starts the opening flag
as false while loading; `GamesDirectory.tsx` uses that boolean without a loading
state, initially classifying the mode as coming soon. Malformed JSON is converted
to a successful disabled state. `GamePreviewModal.tsx:117` removes the primary
action for every game when the shared availability request fails.

Represent loading, unavailable, disabled, and enabled separately. Show checking
status while resolving the optional mode, report parse failures, and scope gating
to the information actually affected. Test React Strict Mode: the provider's
mounted ref is set false in cleanup but is not reset true in effect setup.

### P2 — Load failures provide weak recovery

**Confirmed source behavior.** `Daily.tsx:69`, `PuzzleSlugContent.tsx:90`, and
archive error screens ask users to refresh/try later without a direct retry action.
No custom route `error.tsx` or `loading.tsx` files were found. Account stats failures
throw an error; `account/page.tsx:10` uses the public API base for server fetches,
unlike other server pages using `API_BASE_URL`. Under the sample Docker settings,
this can turn a working login into an account page connection failure.

Provide explicit Retry and safe navigation, preserve local progress, and include
route loading/error boundaries. Use the internal API base for server account
requests. In `useAccount.ts`, distinguish connection failure from logged-out state
and avoid displaying a failed streak fetch as an actual zero streak.

### P2 — Accessibility support is incomplete across shared components

**Confirmed source omissions.** `HomeSectionsTabs.tsx` uses tab roles but lacks
arrow/Home/End navigation and roving tab focus. `layout.tsx` has no skip-to-main
link. No reduced-motion handling was found across frontend source despite
transitions/celebration effects. `UpcomingTimeline.tsx` removes the outer button
focus outline while focus-visible styling is on an unfocusable inner div.

Complete tab keyboard behavior, add a visible-on-focus skip link, honor reduced
motion, and put focus indication on the element receiving focus. Retain the
existing game feedback announcements and verify them with a screen reader.

### P2 — Notification and account copy overpromises

**Confirmed source mismatch.** `NotificationOptInCard.tsx` promises a ping when
tomorrow's challenge is ready, but no daily dispatch scheduler is wired in the
repository. Login advertises bonus rewards with no reward implementation found.
Notification permission help hardcodes `guesssenpai.com`, while the footer uses
`guessenpai.app` and site metadata defaults to localhost.

Advertise supported benefits only, gate reminders on a working delivery setup,
and centralize the canonical site/support identity. Keep roadmap language distinct
from guarantees made during login or notification opt-in.

### P3 — Theme utilities drift from the configured design tokens

**Confirmed source/config mismatch.** `rounded-4xl` is used on hero and completion
surfaces but the Tailwind 3 theme only extends `2xl` and `3xl`; there is no `4xl`
radius definition. Classes such as `border-white/12`, `bg-white/4`, and `bg-white/8`
also use opacity values outside the configured/default scale rather than explicit
arbitrary values. These styles can be absent from generated CSS.

Define the missing tokens or use supported/arbitrary utilities consistently.
Inspect emitted CSS and compare the main card shapes in a clean build. Consolidate
button, status badge, field, card, and focus styles to reduce further drift.

### P3 — Visual hierarchy and mobile density need a rendered pass

**Design concern, not a measured failure.** Many cards, badges, and actions use
uppercase text with wide tracking, small sizes (including 0.55rem), shadows,
gradients, and translucent layers. Home hero starts at `p-10` inside an already
padded viewport. Desktop navigation switches on at 768px and includes five links
plus a potentially wide account badge inside a non-wrapping header.

Make the current puzzle and primary play/resume action visually dominant. Increase
functional label sizes, reduce decorative competition, and make mobile padding
and the navigation breakpoint reflect content width. Check real contrast over
artwork rather than inferring accessibility from token colors. Large blur layers
and external font loading also warrant testing on a slower mobile device.

### P3 — Share cancellation is presented as failure

**Confirmed source behavior.** `ShareComposer.tsx` catches native share cancellation
in the same path as operational errors and displays Unable to share. Cancellation
should return to the previous state quietly; actual errors should offer Copy or
Download recovery. Validate unavailable clipboard and image generation failures.

## Suggested implementation order

1. Fix navigation open state/hidden focus and suggestion activation. Add focused
   regression coverage for these core input paths.
2. Unify dialogs, correct tile interaction semantics, and fix account server fetching.
3. Align rules/reset/archive/reminder copy with actual behavior; standardize
   availability and recovery states.
4. Complete keyboard/reduced-motion support and repair missing theme tokens.
5. Run visual QA and refine typography, spacing, and action hierarchy using the
   existing design direction.

## Browser validation checklist

| Scenario                                           | Verify                                                                                            |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 320/375/390px widths and short landscape viewport  | Header, hero, cards, expanded dialogs, fields and actions remain reachable                        |
| 768/820/1024px and signed-in long username         | Header avoids overflow; menu breakpoint is appropriate                                            |
| Keyboard-only guest journey                        | Visible focus, stable menu, correct Tab order, preview close restoration, autocomplete submission |
| Screen reader                                      | Landmarks, tabs, modal isolation, field names, suggestions and game feedback announcements        |
| 200% zoom and reduced motion                       | Reflow without lost controls; nonessential movement suppressed                                    |
| Cold load, slow API, malformed response, offline   | Accurate pending/error state, retry, no false coming-soon or logged-out claim                     |
| Partial game, reload, account switch, sync failure | Progress survives; local versus synced state is clear                                             |
| Completion and each silhouette round transition    | Single clear next action; modal focus remains contained                                           |
| UTC rollover and PT-local evening                  | Puzzle date, reset countdown and archive labels agree                                             |
| Share cancel, unsupported share, clipboard failure | Cancellation is neutral; usable copy/download fallback                                            |
| Opening clip fails or is unavailable               | Accurate status and useful recovery; other games remain understandable                            |

This audit is a prioritized repair brief rather than certification of visual
quality or accessibility compliance. Agent 3 changes are source-reviewed; API,
database, and browser-backed rollover behavior still require runtime validation.

## Implementation follow-up — 2026-10-12

The reliability foundation pass resolved these source findings while preserving
the historical audit above: mobile navigation no longer closes on open, the
closed drawer is hidden from the focus tree, and Escape restores focus; title suggestions fill the
field and require a deliberate submit; availability validates the existing daily
response and separates pending, ready/disabled, and error outcomes; optional
opening availability failures no longer suppress playable game actions; daily
page and account connection failures now show retry/error states; Anidle copy and
preview semantics match metadata comparison and progressive synopsis clues; new,
partial, and completed progress derive Play, Resume, and Results; discovery tiles
use separate Preview and Play controls; and scheduled-notification/launch claims
were removed or qualified.

Regression tests cover the repaired suggestion behavior, evaluation failure,
availability malformed/disabled response, and progress action derivation. The
mobile navigation and daily retry state were checked in a local browser. Full
visual QA, a successful backend-backed reload/resume flow, and account OAuth
remain outstanding because the API runtime was unavailable. This follow-up is
not a certification of the remaining dialog, contrast, or responsive findings.

## Ink & Signal redesign slice — 2026-10-12

Implemented in source: the root route is now a compact Today page with Anidle and
Poster as the featured choices, progress-derived Play/Resume/Results labels, and
the two other implemented games in a secondary list. Navigation is Today,
Archive, and account; the Games directory, How to Play, existing daily route,
and archive routes remain reachable. Opaque charcoal/off-white/vermilion tokens,
shared Panel/Button/Field/Status/Dialog primitives, a skip link, stronger focus,
and reduced-motion rules replace the home and shared game-shell glass/aurora
presentation.

Anidle now explains its three rounds, separate attempt count, comparison symbols,
and real hint schedule. Failed evaluation still leaves history untouched. Guess
history remains a table on wider screens and uses expandable per-attempt details
on narrow screens; list comparisons include a symbol and text label so color is
not the only signal. Completion reveals the answer, keeps history visible, offers
one next action and a spoiler-free share action. The preview dialog has a bounded,
scrollable viewport, focus restoration, and main-content isolation.

Rendered local browser review confirmed the Today hierarchy at desktop and 390px,
with the first Play action visible at 390px, and inspected Anidle and solved
Anidle through the clearly labeled development-only fixture route. This is a
local fixture, not evidence of live API integration. Contrast ratios calculated
from the CSS token pairs are 15.63:1 for #F4F0E7 on #171819, 13.35:1 for
#F4F0E7 on #242628, 6.82:1 for #27110B on the #FF7658 button, and 8.47:1 for
#C1C2BD on #242628. These pass WCAG AA normal-text contrast; this does not
measure every legacy route or feedback combination.

Frontend Vitest passed (11 files, 27 tests), and TypeScript passed. The Next
production build compiled, type-checked, and generated pages, then failed while
copying standalone traces because Windows denied symlink creation. API-backed
guess, reload, and resume were unavailable because the API did not start. The
Today was checked at 320×640, 390×844, 768×900, and 1024×768; its first Play
action also remains visible at 390×480. The Anidle fixture had no horizontal
page overflow at those widths. 200% zoom, short-viewport dialog behavior,
reduced-motion emulation, and real mobile keyboard/dropdown positioning remain
outstanding. No screenshots were exported as repository files in this pass.

## Follow-up correction review

See [Review corrections](REVIEW_CORRECTIONS.md) for fixes to progress/account
isolation, truthful status, recovery, rollover, real-route matte styling, and
mobile Anidle layout. Desktop Today and 390 × 844 Anidle were inspected using
synthetic local data. Full live-media and remaining-mode visual QA is pending.
