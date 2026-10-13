# GuessSenpai: product and UX redesign brief

Reviewed 2026-10-12. Status: proposed direction and unchecked implementation backlog.

## Recommendation

Re-envision GuessSenpai as a compact anime puzzle club: open it, recognize a
challenge, make a guess, learn something, and compare your result with friends.
Use opaque surfaces, expressive typography, restrained color, and actual puzzle
content to establish identity. Make the game the main event.

Keep Next.js, FastAPI, existing evaluators, guest progress, AniList integration,
and the useful tests. Rework the experience around them. A framework rewrite or
more game modes would not address the problems found here.

The previous UX audit recommends refinement within the current visual direction.
This brief deliberately changes that recommendation in response to the owner's
rejection of glassmorphism. Its interaction findings remain useful.

## Evidence and limits

- Read [Repository State](REPOSITORY_STATE.md), [UX/UI Audit](UX_UI_AUDIT.md),
  README, and AGENTS.md. The referenced `agent_actions` directory is absent.
- Rechecked the current home page, navigation, hero, game shell, title field,
  preview modal, availability provider, theme, account fetch, puzzle models,
  puzzle router, and daily generation code. Existing user changes were preserved.
- Inspected AniGuessr's rendered desktop home and Anidle entry page, and
  AniGuesser's rendered home and Browse page. Read AniGuess and AMQ's public
  pages and W3C interaction guidance. No account was created or quiz submitted.
- GuessSenpai findings are source-based. This review did not launch the local
  app, reproduce bugs in a browser, measure performance/contrast, or rerun tests.
  Prior environment blockers are documented in Repository State; they were not
  independently retested here.
- The name “aniguesser” is ambiguous. Both aniguessr.com and aniguesser.net were
  examined; no preference between them is assumed.
- Suggested durations, usability thresholds, and designs below are hypotheses
  or release targets, not measured outcomes.

## Reference research: what to borrow

| Reference | Observed evidence | Application to GuessSenpai |
| --- | --- | --- |
| [AniGuessr](https://aniguessr.com/) and [Anidle](https://aniguessr.com/anidle) | Home uses solid dark tiles, pink accents, and distinctive display lettering. Modes describe the task directly. Anidle presents a first-guess prompt, answer field, and Guess button. Home includes replay and community streaks. | Borrow direct entry, simple mode language, and a recognizable identity. Avoid reproducing the crowded sidebar, small secondary copy, and advertising interruptions observed in the desktop view. |
| [AniGuesser](https://www.aniguesser.net/) and [Browse](https://www.aniguesser.net/browse) | Home has a clear play/browse split and promotes friend rooms. Browse exposes categories and difficulty/sorting choices; it displayed “No quizzes found” during this visit. | A future pack library could separate immediate play from exploration. Do not treat promoted features as verified gameplay or imitate an empty catalog before content exists. |
| [AniGuess](https://aniguess.moe/) | Public page exposes a daily/unlimited switch, remaining guesses, search, Submit, and Skip. | A small, comprehensible play loop is a useful benchmark. Separate a finite daily habit from repeatable practice. This was a text review, not a visual or gameplay evaluation. |
| [Anime Music Quiz](https://animemusicquiz.com/) | Official page advertises quizzes built from AniList, MyAnimeList, or Kitsu, plus friend play and ranked play. | Personal relevance and shared play are promising expansion paths. GuessSenpai already has part of the AniList foundation; implement one coherent extension before a broad social system. Advertised capabilities were not play-tested. |

These comparisons explain design choices; they do not establish that any
competitor has higher retention, better accessibility, or a particular backend.

## Diagnosis

### 1. Decoration dominates the hierarchy

`globals.css` adds fixed radial backgrounds and a noise layer. Tailwind defines
translucent surfaces, glow shadows, and aurora backgrounds. `HomeHero.tsx` and
`GameShell.tsx` add more blur, gradients, rounded containers, and decorative
highlights. Repeated effects give the hero, statistics, controls, and actual
puzzle similar emphasis.

Removing blur alone will leave the same oversized and repetitive structure.
Reduce the hero, eliminate duplicate progress blocks, simplify navigation, and
put playable choices close to the top of the page.

### 2. Core interactions undermine confidence

The previously documented mobile navigation close effect, hidden focusable
drawer, mouse-down-only suggestion activation, misleading Anidle copy, nested
tile controls, and shared availability failure gating remain visible in source.
These are concrete implementation problems, not matters of taste.

An additional home-page issue: `nextIncompleteGame` means unfinished, but the
hero uses it to label the CTA “Resume” and say “You left off on ...”. A fresh
player can therefore be told to resume something never started. Use saved
attempts/round activity to distinguish unstarted from in-progress.

### 3. Daily identity is unclear

`puzzles/engine.py` changes the candidate pool and seed for signed-in users and
caches per user. “Today's puzzle” can therefore mean different content for two
friends. The availability provider also fetches the entire `/puzzles/today`
payload to learn whether one optional mode is enabled, coupling discovery to
puzzle generation and upstream media.

Define the product contract before redesigning streaks and sharing: shared daily
content, personalized practice, and explicit puzzle IDs. Persist daily snapshots
so old dates retain their content after cache expiry or upstream changes.

### 4. The daily commitment may be too demanding

Poster play includes release metadata; silhouette play asks for both anime and
character across a multi-card lineup. Those are legitimate enthusiast mechanics,
but they add effort beyond recognizing an image. Test whether the daily feels
rewarding or like homework. The current completion framing also emphasizes an
entire lineup rather than celebrating one satisfying solve.

## Proposed product shape

**Daily:** the same published puzzle set for everyone, guest access, a short
default experience. Start by making Anidle and Poster excellent; retain other
working games in a secondary list while their experience is evaluated.

**Practice:** a subsequent feature using AniList lists, difficulty, and optional
era/genre filters. Practice does not affect the shared daily score. Show pool
size/insufficiency clearly and offer an explicit broader pool fallback.

**Archive:** published historical sets, with date, completion, and replay status.
Until snapshots exist, keep the current window and regeneration limitations
honest in the interface.

**Friends:** begin later with asynchronous “try this same challenge” links.
Live rooms and rankings require separate reliability and authority work.

Suggested streak rule to test: solving any one eligible daily puzzle counts as
an active day; completing the whole set earns a separate clean-sweep mark.
Treat this as a versioned rules change: preserve historical achievements and
explain the change. Do not silently reinterpret existing streak records.

## Visual direction

Recommended: **Ink & Signal**, a restrained anime magazine / puzzle-club look.
This is an art direction, not a requirement to add a new visual framework.

| Element | Proposed treatment |
| --- | --- |
| Canvas | Flat ink `#171819`; no aurora or page-wide texture/filter |
| Surface | Opaque charcoal `#242628`, with deliberate borders |
| Primary text | Warm off-white `#F4F0E7`; muted text `#B8BBB7` |
| Accent | Vermilion `#F36A4B`, primarily for the main action; dark text on accent buttons |
| Typography | Readable sans-serif body; one expressive, compact display treatment for page titles/wordmark; no pixel font for instructions |
| Shape | Mostly 6–10px radii, flat panels, occasional hard offset treatment for a featured tile |
| Artwork | Small purposeful mode illustrations; actual clue media owns the game screen. Do not expose today's answer art in discovery. |
| Status | Text plus icon; color supplements meaning. Use “New”, “In progress”, “Solved”, “Unavailable”. |
| Density | 16px body/input baseline, generally 14px functional secondary text; avoid the existing 0.55rem labels |
| Motion | Short feedback transitions; no glowing hover animation across the game shell; reduced-motion alternative |

These colors are candidates. Measure every actual text/background and focus
pair before acceptance. Aim for 4.5:1 normal text contrast and 3:1 for large text
and applicable control boundaries; review the exact WCAG criteria linked below.
Use a 44px control-height design target, which is intentionally more generous
than the WCAG 2.2 AA minimum target-size criterion.

Two alternatives worth showing alongside the recommended direction in a small
design exploration: warm paper with ink borders and vermilion accents for a more
editorial feel; or a matte dark arcade with a single electric accent and compact
scoreboard typography. Avoid combining all three into a new collection of effects.

## Screen and interaction blueprint

### Today / home

Compact header: wordmark, Today, Archive, account. Add Practice when it works.
Put Help next to the game and supporting links in the footer. Keep existing URLs
working when consolidating the duplicated Home/Daily/Games discovery surfaces.

```text
GuessSenpai                     Today   Archive   Account

Monday's puzzles                  Resets in 04:12
A little anime knowledge, every day.

[ Anidle                                  Play ]
  Find the anime using clues from your guesses.
[ Poster                         In progress → ]
  Recognize the anime as the image opens up.

More puzzles                  Synopsis · Characters
Your week                     ○ ○ ● ● ● ○ ○
```

This is a structural sketch; date, progress, and countdown are illustrative.
At 390px wide, the first Play action should be visible without scrolling. Cards
have one direct play/resume link and optional separate Rules control. Remove
upcoming modes and speculative launch explanations from the main play surface.
Offer sign-in after a meaningful result, with an accurate save/sync benefit.

### Game

Use one shared shell: title/date, concise rule, clue, answer input, feedback,
history, optional hint, completion. Distinguish attempt count from round count.
On mobile, put the current clue and entry field before historical guesses.

Selecting an autocomplete result fills the field. A clearly labeled Guess
button submits; Enter selects an active suggestion, and Enter after selection
submits. Prevent double submission. Show canonical title, alias where relevant,
year, and format so sequels are distinguishable. Deduplicate by media identity.
Explain exact-season versus franchise matching in each mode's rules.

Keep focus on the input through the listbox using the W3C combobox pattern.
Do not move focus on touch automatically and open the keyboard before a player
has seen the clue. Keep errors beside the field; a failed request never consumes
an attempt. Keep the typed selection and existing progress after retry.

Prefer inline round results with Continue. Use dialogs only when interruption
serves the task; any remaining dialog needs focus containment/restoration,
background isolation, Escape policy, and viewport scrolling.

### Completion

Reveal the answer, show a concise explanation, preserve the guess history,
and offer one next action. Secondary actions: spoiler-free share and optional
AniList link to learn about the title. Native-share cancellation is neutral.
Account sync failures should read “Saved on this device; sync needs retry,”
only when the local save actually succeeded.

### Mode-specific experiments

| Mode | Proposed change | Validation |
| --- | --- | --- |
| Anidle | Make this the initial polished vertical slice; correct its description; explain match/partial/higher/lower feedback with labels and symbols. Use mobile guess summaries with expandable details. | Players understand why a guess helps, including without relying on color. |
| Poster | Test title recognition as the required daily task; move year/season to an optional expert bonus. Show deterministic reveal steps with accurate labels. | Compare completion and enjoyment; update evaluator, progress schema, scoring, and rules together if adopted. |
| Silhouette | Test a short daily selection with one active character at a time; retain the larger lineup for expert/practice play. State whether character alone or character + series is required. | Users can finish without discovering a hidden twelve-card commitment; existing progress still resumes correctly. |
| Synopsis | Preserve readable line lengths and stable redaction layout; stage useful reveals and exclude empty/spoiler-heavy content. | Human review of a varied content sample confirms clues are solvable and not accidental giveaways. |
| Opening | Clear Play/Pause/replay, user-initiated playback, loading and unavailable states. Exclude broken media from daily requirements. | Missing clips do not consume attempts, block unrelated games, or prevent earning the intended daily completion. |

## Implementation backlog

P0 = prerequisite/core journey failure; P1 = redesign release; P2 = subsequent
product expansion. S/M/L are relative scope, not time estimates. Each item needs
an implementation owner and evidence attached when checked off.

| Done | ID / scope | Action and where to start | Acceptance criteria |
| --- | --- | --- | --- |
| [ ] | P0-01 / M | Restore reproducible runtime using Repository State setup notes; install the pinned workspace dependencies, fix API health check, verify migration and Docker build paths. | Web/API tests, type check, production build, fresh container health and DB upgrade evidence recorded; unresolved failures are explicit. |
| [ ] | P0-02 / S | Repair `PrimaryNav.tsx`: close on pathname change; remove closed drawer from focus order; return focus on close. | Menu stays open, links navigate, Escape closes, closed links never receive Tab focus; regression tests cover these paths. |
| [ ] | P0-03 / M | Repair `games/TitleGuessField.tsx` and callers; adopt consistent selection/submission contract and canonical IDs. | Mouse, touch, keyboard and assistive click each select once; deliberate submit records exactly one guess; failed evaluation costs no attempt. |
| [ ] | P0-04 / M | Replace boolean-only availability in `useDailyAvailability.tsx`/`config/games.ts`; fix mounted-ref lifecycle and JSON failure handling. Scope preview/home gating to affected modes. | Loading, disabled, temporary failure and ready render differently; Strict Mode settles; optional-mode failure cannot remove other play actions. |
| [ ] | P0-05 / M | Fix account server API base; add route error/loading boundaries and explicit Retry to puzzle/archive failures. | Connection failure is not shown as logout/zero streak; retry retains input and local progress; account page works with internal Compose API URL. |
| [ ] | P0-06 / S | Correct home CTA derivation and game rules/copy. Centralize catalog descriptions and derive counts from real specs. Remove unsupported reward/reminder/launch claims. | New player sees Play; partial player sees Resume; completed player sees Results; Anidle is accurately described everywhere. |
| [ ] | P1-01 / M | Build opaque semantic theme tokens and shared Button, Panel, Status, Field and Dialog. Start with `globals.css`, Tailwind, `GlassSection`, `GameShell`. | No aurora/blur/glow in the redesigned route; emitted utilities exist; measured contrast, focus and reduced-motion checks pass. |
| [ ] | P1-02 / M | Replace `HomeHero`, home tiles, and redundant tabs with the compact Today surface. Keep redirects/links for existing routes. | Direct game entry in one click, first action visible on mobile, no nested interactive elements, no unimplemented mode in primary choices. |
| [ ] | P1-03 / L | Complete an Anidle vertical slice including loading, empty search, incorrect guess, hint, solved, failure and resumed states. | One coherent guest journey passes desktop/mobile, keyboard, reload and slow-network checks before styling every other mode. |
| [ ] | P1-04 / M | Consolidate remaining dialog behaviors; prefer inline round summaries; add skip link and finish any retained tabs' keyboard support. | Focus stays visible and contained when appropriate; restoration works; 200% zoom and short viewports lose no actions. |
| [ ] | P1-05 / L | Add shared published daily identity and snapshots in API/DB. Define `puzzle_id`, mode, rules version, date, reset timestamp, clue/answer snapshot and availability. Split personalized generation into practice. | Two accounts and guest receive the same daily IDs/content; cache expiry leaves historical answers unchanged; UTC rollover and open-tab behavior agree. |
| [ ] | P1-06 / M | Decouple discovery availability from full puzzle generation; return lightweight published-set metadata and reset time. | Navigation can render independently of clip hydration; response schema is validated; day/mode failures remain scoped. |
| [ ] | P1-07 / M | Version progress keys by puzzle ID and rules; migrate existing records without resetting achievements. Review service worker account partition and logout invalidation. | Reload, account switch, sync conflict and stale cache never assign guesses to a different puzzle; migration is tested on old records. |
| [ ] | P1-08 / M | Simplify result screen and share payload; include puzzle identity and spoiler-free summary. | Same-challenge link resolves correctly; cancel is quiet; copy fallback works; result and next action stay reachable on mobile. |
| [ ] | P1-09 / M | Add content eligibility checks and a small reviewed fixture corpus to puzzle generation. Check missing art, alias/season confusion, redactions and broken clips. | Every published required mode has usable content or an explicit prepublication fallback; broken content cannot become a required win condition. |
| [ ] | P1-10 / M | Add browser regression coverage and lightweight journey instrumentation. | Guest start → guess → reload → finish passes; error/retry and next-day paths pass; baseline funnel and error rates can be read. |
| [ ] | P2-01 / L | Add personalized practice and optional difficulty/era filters using existing AniList foundation. | Explicit pool, no effect on daily comparisons/streaks, useful handling of small/private/unavailable lists. |
| [ ] | P2-02 / M | Add a small set of themed packs and richer answer explanations. | Packs have stable IDs and reviewed content; theme alone does not leak the answer; discovery does not overwhelm Today. |
| [ ] | P2-03 / L | Add asynchronous friend challenges first. Consider competitive rankings/live rooms only after authoritative server attempts, timers, scoring and room persistence. | Same puzzle/rules for participants; replay/reconnect tested; client cannot author a trusted score or receive unrevealed solutions. |

The shared-daily and progress changes are architectural work, not styling tasks.
Ship them together with a migration plan. Persist answer data server-side; expose
only the clue/evaluation fields needed by the browser before reveal if trusted
competition becomes part of the release.

## Delivery order and checks

1. Establish a runnable baseline and repair P0 interactions. Capture current
   screens once the runtime works; do not mistake a source audit for visual QA.
2. Prototype Today + Anidle + completion in the recommended direction. Review
   desktop and phone sizes, including failure/resume states. Keep this first
   prototype independent of a whole-app data rewrite.
3. Implement the chosen shell and Anidle slice with existing behavior, then roll
   the shared components into the other modes. Test gameplay simplifications
   separately from the visual change.
4. Release the versioned daily/snapshot/progress contract and truthful archive;
   qualify it with seeded fixtures and rollover/cache/account-switch scenarios.
5. Add practice and asynchronous challenges after the core journey works.

Invite five anime fans with mixed familiarity for a formative usability round:
find a game, explain the rules, make a guess, recover from a simulated failure,
leave/resume, and share. Record hesitation and misunderstandings, not just likes.
Five participants can expose problems; they do not establish population metrics.

Proposed gates: at least four of five can reach the first guess without help;
direct entry requires one click from Today; every tested failed request preserves
progress; keyboard-only completion is possible; 320/390/768/1024px widths, 200%
zoom and reduced motion retain usable controls. Test a real mobile keyboard.

Track landing → game ready → first accepted guess → completion → next puzzle;
time to first guess; suggestion/evaluation/media failures; resume success; and
return visits. Separate mode and guest/account cohorts. Establish the baseline
before setting retention uplift targets. Do not log raw searches or AniList lists
when coarse events answer the product question.

## Deferred scope

Defer global leaderboards, elaborate XP/cosmetics, new placeholder modes, a quiz
creator, and scheduled notifications. They introduce content, authority, or
operational work before improving the daily game. Existing live rooms should not
be promoted as trustworthy competition in their current documented state.

The distinctive next step is **a good shared daily puzzle plus practice informed
by what you watch**. Better content selection, forgiving input, clear reveals,
and dependable progress can provide more value than another layer of decoration.

## Implementation references

- [W3C combobox pattern](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/):
  keyboard navigation and active-descendant focus model.
- [W3C modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/):
  focus containment, return focus, and background isolation.
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/): contrast, keyboard, reflow,
  focus visibility, and target-size requirements; validate the rendered UI.

No application code was changed by this research/audit. Checkboxes describe
future work and must not be read as completed fixes or validated behavior.
