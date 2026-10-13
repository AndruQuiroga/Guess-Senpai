# Next agent prompts

Run these in order, in separate chats against the resulting repository state.
Agent 2 depends on Agent 1. Agent 3 depends on Agent 2. Do not run them concurrently
against the same checkout: they touch overlapping UI and progress contracts.

These prompts authorize implementation and local validation, not production
deployment, external publishing, or destructive database changes. Preserve
existing user changes. Do not create additional agents unless separately asked.

## Agent 1 — Make the core guest journey reliable

```text
Work in C:\Users\Dreski-PC\PycharmProjects\Guess-Senpai.

Implement the reliability foundation for our UX redesign. Read AGENTS.md,
docs/REPOSITORY_STATE.md, docs/UX_UI_AUDIT.md, and
docs/PRODUCT_REIMAGINING.md first. Recheck the current source; the documents are
review snapshots, not proof that every issue remains. Inspect git status and
preserve existing changes. Do not create subagents.

The product owner dislikes the glassy visual design and unreliable interactions.
This task fixes the core journey before the visual redesign. Keep changes focused
and retain the current stack and game rules.

Implement:
1. Establish a working local frontend/backend validation path using the pinned
   pnpm workspace and Python setup. Do not create a second lockfile. Address the
   API health-check tooling defect if still present. Verify clean web build and
   API configuration where the environment permits. Record migration/deployment
   blockers; do not turn this task into a broad infrastructure rewrite.
2. Fix PrimaryNav: opening must stay open, pathname changes must close it, closed
   controls must leave the keyboard sequence, and closing must restore focus.
3. Repair TitleGuessField and all affected callers. Selecting a suggestion fills
   the field; an explicit Guess action submits. Enter selects the active option;
   after selection, Enter can submit. Use a coherent accessible combobox model.
   Mouse, touch, keyboard, and assistive activation must work. Prevent duplicate
   submission; a network/evaluation failure must not consume an attempt or erase
   the selected title. Verify existing modes with different submit requirements.
4. Represent availability as distinct pending/ready/disabled/error states; fix
   malformed-response handling and Strict Mode lifecycle behavior. An optional
   opening-mode failure must not remove unrelated game actions. Keep this repair
   compatible with existing endpoints; endpoint redesign belongs to Agent 3.
5. Correct Play/Resume/Results derivation. Unfinished does not mean started.
   Correct the Anidle description, rules, and preview semantics. Remove nested
   interactive controls in any touched tiles; Play should navigate into a game.
   Remove unsupported reward, scheduled-reminder, and speculative launch claims
   from the relevant discovery/account copy.
6. Fix the account page's server-side API base and distinguish connection errors
   from logged-out/zero-streak states. Add usable retry/loading/error handling to
   the core puzzle journey, preserving local progress.

Validation:
- Add focused regression tests for the repaired interactions and failure paths,
  using the existing suites. Include a new guest, partial progress, completed
  progress, unavailable optional mode, and malformed availability response.
- Run frontend tests, TypeScript checking, production build, and relevant backend
  tests. Report commands and outcomes accurately; do not claim passing checks
  when environment problems prevented them.
- If local execution works, browser-check mobile navigation, keyboard guessing,
  failed-request retry, and reload/resume. Use approved browser tooling.
- Format touched code with the repository's formatter; avoid unrelated churn.

Do not redesign the whole app, alter difficulty/streak rules, introduce practice,
add leaderboards, or rewrite daily identity in this task. Do not deploy or publish.
If credentials or external services block an integration, complete independent
work and identify the precise remaining dependency; never invent credentials.

Finish with docs/AGENT_1_HANDOFF.md: changes, validation evidence, remaining
blockers, and information Agent 2 needs. Update audit findings you actually
resolve without erasing their historical context. Summarize the user-visible
behavior and any unverified paths in your final response.
```

## Agent 2 — Redesign Today → Anidle → results

```text
Work in C:\Users\Dreski-PC\PycharmProjects\Guess-Senpai.

Implement the first complete visual redesign slice. Read AGENTS.md,
docs/REPOSITORY_STATE.md, docs/UX_UI_AUDIT.md,
docs/PRODUCT_REIMAGINING.md, and docs/AGENT_1_HANDOFF.md. Inspect current code and
git status; preserve existing work. Do not create subagents. If Agent 1's handoff
is missing, inspect whether its core fixes exist and identify unmet dependencies
before relying on them. Proceed with independent design work where possible.

The chosen direction is Ink & Signal: a compact anime puzzle club using opaque
charcoal surfaces, warm off-white text, a restrained vermilion accent, crisp
borders, modest corners, and expressive headings. Remove aurora backgrounds,
page-wide texture/blur, glowing controls, translucent stacks, oversized marketing
panels, and tiny widely tracked functional labels. Use the brief's palette as a
starting point, then adjust it for measured contrast. Keep anime personality in
the typography, mode artwork, puzzle content, and result presentation.

Build the full Today → Anidle → completion → resume experience:
1. Introduce semantic tokens and reusable Panel, Button, Field, Status, and any
   necessary Dialog primitives. Replace the shared glass treatment coherently.
   Check other routes affected by shared styles so text remains readable.
2. Replace the oversized home hero and repetitive discovery sections with a
   compact Today screen. Feature Anidle and Poster with direct Play/Resume/Results
   actions; retain other playable games in a quieter secondary list. Keep
   unimplemented games and speculative promises off the primary play surface.
3. Simplify primary navigation to Today, Archive, and account access. Keep help
   contextual and existing routes reachable. Do not expose Practice until it
   exists. Preserve old route behavior or provide deliberate redirects.
4. Redesign Anidle around its real rules: concise instructions, answer field,
   useful comparison feedback, hints, and history. Distinguish attempts from
   rounds. Use symbols/text as well as colors. Give mobile users compact guess
   summaries with accessible detail expansion where appropriate.
5. Design loading, empty search, incorrect guess, submitting, request failure,
   resumed, and solved states as carefully as the ideal screen. Preserve the
   selection/submission contract established by Agent 1. Do not consume attempts
   on errors or open the mobile keyboard automatically before the clue is seen.
6. Make completion reveal the answer clearly, retain history, and provide one
   primary next action plus spoiler-free sharing. Treat share cancellation as
   neutral. Keep account prompts secondary and benefits accurate.
7. Add a skip link, visible focus, reduced-motion support, and accessible overflow
   handling for retained dialogs. Prefer inline feedback to unnecessary modals.

Keep the existing Next.js/FastAPI architecture and evaluators. Do not change
daily generation, game difficulty, streak rules, progress schemas, or introduce
new game modes. Avoid adding dependencies when existing capabilities suffice.
This is an implementation task, not just a mockup or a proposal.

Acceptance:
- At 390px width the initial Play action is visible without scrolling.
- Today enters the chosen game in one click, with truthful action labels.
- No glass/aurora/glow treatment remains in the redesigned experience.
- Existing progress reloads and completed games still show correct results.
- Keyboard-only navigation and guessing work; feedback is understandable
  without color; primary controls meet a 44px design target where practical.
- Check 320/390/768/1024px widths, short viewports, 200% zoom, reduced motion,
  and mobile input/dropdown positioning. Measure contrast on rendered surfaces.
- Run relevant tests, TypeScript checking, and a production build. Add behavioral
  coverage only where new behavior warrants it, not tests mirroring CSS.
- Use browser screenshots to inspect and refine the actual screens. Deliver
  desktop/mobile screenshots of Today, Anidle, and completion, using clearly
  identified local fixtures if live data is unavailable. Never present fixture
  validation as proof of an external integration.

Do not deploy, publish, or create a separate hosted site. Format touched files.
Update docs/UX_UI_AUDIT.md with verified resolutions and remaining concerns.
Write docs/AGENT_2_HANDOFF.md with design decisions, validation, screenshot paths,
shared components, and any limitations Agent 3 must preserve. Finish with a
concise description of the implemented experience and evidence.
```

## Agent 3 — Give the daily challenge a stable identity

```text
Work in C:\Users\Dreski-PC\PycharmProjects\Guess-Senpai.

Implement the shared daily puzzle contract while preserving the redesigned UI.
Read AGENTS.md, docs/REPOSITORY_STATE.md, docs/UX_UI_AUDIT.md,
docs/PRODUCT_REIMAGINING.md, and both prior agent handoffs. Recheck the engine,
API models/routes, persistence, progress hooks, share payloads, date helpers,
archive, and service worker before editing. Preserve existing user changes.
Do not create subagents.

Product contract:
- Guest and signed-in players receive the same published daily set.
- Published historical puzzles do not change when caches expire, user lists
  change, or upstream ordering changes.
- Use midnight UTC as the daily boundary, with an API-provided reset timestamp
  and explicit display labeling. Keep date labels consistent across timezones.
- AniList personalization is reserved for future practice. Preserve reusable
  personalized generation code, but do not build or advertise Practice here.
- Keep current scoring/difficulty/streak rules unless a minimal compatibility
  adjustment is required; do not silently reinterpret prior achievements.

Implement in reviewable stages:
1. Write a concise schema/migration design note, then implement it. Separate a
   daily-set identity from individual mode puzzle identities where needed. Store
   published content, answer snapshot, rules version, date/reset metadata, and
   mode availability in durable storage. Make publication idempotent and safe
   under concurrent requests. Define behavior when a required upstream source
   is unavailable; never silently mutate an already published set.
2. Establish a tested database migration path, including required dependencies
   and container migration files. Provide upgrade/rollback guidance without
   running destructive changes against an unknown database. Validate on a
   disposable local/test database if available.
3. Serve shared daily and archive content from those snapshots. Ensure login
   cannot change the active daily puzzle. Add lightweight availability metadata
   so navigation does not hydrate all puzzles or clips just to render choices.
4. Return puzzle IDs, rules versions, and reset timestamps to the frontend.
   Update the UI and sharing to use that identity and the API time contract.
   Define open-tab rollover behavior that preserves an in-progress old puzzle
   and offers the new daily without silently replacing the current clue.
5. Version local/account progress by puzzle identity and rules. Inspect legacy
   personalized records carefully: do not attach them to a new shared puzzle
   merely because the dates match. Preserve incompatible history separately and
   retain earned achievements. Document and test the migration/conflict policy.
6. Review account-switch/logout and service-worker caching. Prevent stale or
   cross-account progress from appearing against a different puzzle. Keep retry
   and local-save status truthful when synchronization fails.
7. Keep answers in server-side snapshots. Review browser payload exposure and
   describe any remaining limitations honestly. Competitive leaderboards and
   full server-authoritative scoring are out of scope; do not imply this task
   alone establishes anti-cheat protection.

Required validation:
- Guest and two accounts receive identical daily puzzle IDs and content.
- Concurrent publication creates one stable set.
- Cache expiration and changed upstream fixtures do not alter published history.
- UTC boundary, negative-offset date labels, and an open-tab rollover agree.
- Old personalized progress is preserved without being misapplied to shared play.
- Reload, offline/retry, account switch, sync conflict, and unavailable optional
  opening content have explicit tested behavior.
- Run relevant backend/frontend tests, TypeScript checking, migration checks,
  and production build. Report any unexecuted integration checks accurately.

Do not add Practice UI, live-room infrastructure, notifications, public rankings,
or new game modes. Do not deploy, publish, or run destructive migrations on user
data. Continue independent work when external services are unavailable and state
the exact integration blocker.

Update docs/REPOSITORY_STATE.md for implemented architecture boundaries and
docs/UX_UI_AUDIT.md for resolved date/archive/cache issues. Write
docs/AGENT_3_HANDOFF.md with schema/API changes, migration and recovery steps,
validation evidence, legacy-history behavior, and remaining work. Finish with
the observable product changes and material limitations.
```
