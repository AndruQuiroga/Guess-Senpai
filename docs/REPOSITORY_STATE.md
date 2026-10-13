# GuessSenpai repository state

Reviewed: 2026-10-12. Baseline: `f55f08f` (merge of PR #186).
Updated 2026-10-13 for the `redesign/ink-and-signal` branch; see
"Redesign branch" below and the `docs/STAGE_*_HANDOFF.md` notes.
Baseline notes below are supplemented by [Review corrections](REVIEW_CORRECTIONS.md),
which records local regression, migration, build, and browser validation. This is
not confirmation of a production deployment.

See [UX/UI Audit](UX_UI_AUDIT.md) for interaction, accessibility, copy, styling,
and recovery findings, with a prioritized repair order and browser QA checklist.

## What it is

GuessSenpai is an anime guessing web application with daily puzzles, optional
AniList login and personalization, browser progress, account progress persistence,
and sharing. It is an existing implementation with unfinished product and
operational work, rather than an empty scaffold.

The pnpm monorepo contains a Next.js 15 / React 19 / TypeScript / Tailwind frontend
in `apps/web` and a Python 3.11+ FastAPI backend in `apps/api`. PostgreSQL stores
users, sessions, progress, streaks, preferences, recent media, and searchable
title/character indexes. Redis provides caching with an in-memory alternative.
Docker Compose defines web, API, Redis, and PostgreSQL services.

## Feature boundaries

| Area                                      | Evidence in code                                                                                                                            | Boundary                                                                                                                                |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Anidle                                    | `components/anidle/*` (useAnidleGame, GuessGrid, HintStrip, AttemptMeter, ResultCard), evaluator, API evaluation and batch endpoints, tests | v2 rules: 8 accepted guesses, hints after 2/4/6 misses; unmatched, repeated and failed guesses are free; legacy snapshots keep v1 rules |
| Unlimited Anidle                          | `GET /puzzles/anidle/practice`, `services/anidle_practice.py`, `/games/anidle/unlimited`                                                    | Practice only: random v2 game, local tally, never touches daily progress, streak or score                                               |
| Poster Zoomed                             | Multi-round components, image processing endpoint, tests                                                                                    | Requires external media; real image quality and release guessing need runtime validation                                                |
| Redacted Synopsis                         | Redaction engine, component and tests                                                                                                       | Depends on upstream descriptions                                                                                                        |
| Character Silhouette                      | Character pools, rounds/cards, name search, tests                                                                                           | Filters character imagery; content availability can affect generated rounds                                                             |
| Guess the Opening                         | AnimeThemes integration, frontend component and tests                                                                                       | `release: "daily"`; listed only when daily availability reports a playable clip set                                                     |
| Mystery Voice, Emoji Synopsis, Quote Quiz | Directory entries with `release: "unreleased"`, illustrations                                                                               | Hidden from all lists; direct routes show a "not available yet" page                                                                    |
| Daily score                               | `utils/dailyScore.ts`, sidebar / mobile bar / Today                                                                                         | Client-side presentation (1,000 per mode); not competitive or server-verified                                                           |
| Daily puzzles                             | UTC-date keyed PostgreSQL snapshots with rules version, reset time, availability, and stable set/mode IDs                                   | First publication still depends on upstream metadata; published dates remain immutable, unavailable past dates are not backfilled       |
| Accounts                                  | AniList OAuth state, signed session identifier, database-backed sessions, refresh/logout/me                                                 | Requires configured credentials and database; no independent email/password account system found                                        |
| Progress and streaks                      | Browser hooks, API endpoints and SQL repositories                                                                                           | Client-supplied progress is not an authoritative competitive score system                                                               |
| Archive                                   | Published snapshot index and dated snapshot pages                                                                                           | Only published dates are listed; unpublished past dates are unavailable                                                                 |
| Sharing                                   | Share text, composer/recap UI, OpenGraph image route                                                                                        | No social network or discussion system found                                                                                            |
| Live rooms                                | Lobby/match WebSockets and frontend client                                                                                                  | In-process room state; client identity, guesses and timers; no authoritative scoring or distributed room coordination                   |
| PWA and notifications                     | Manifest, worker caching, subscribe/unsubscribe and push dispatch service                                                                   | Partial offline support; no scheduler/caller for daily dispatch found                                                                   |

## How the parts fit together

1. Frontend pages fetch the API using `API_BASE_URL` on the server and
   `NEXT_PUBLIC_API_BASE` in browser code.
2. `/puzzles/today` uses UTC dates and returns a persisted shared daily set.
   First publication generates content from the shared source pool; account lists
   do not affect daily selection. Later reads serve its database snapshot.
3. AniList supplies metadata and character images; AnimeThemes supplies optional
   opening clips. Cache services reduce upstream requests. SQL indexes support
   title/character suggestions and aliases.
4. Frontend game components manage guesses, hints, reveals, and progress. Backend
   verification/evaluation endpoints support matching and Anidle feedback;
   `/puzzles/availability` supplies the lightweight navigation projection.
5. Browser state supports guest play. Account hooks synchronize supported state
   through progress, streak, statistics, and preference endpoints.
6. Live room traffic is handled separately by the WebSocket manager. It does not
   currently establish a server-authoritative competitive game lifecycle.

## What it is not yet

- A production-verified service: no CI workflow, deployment configuration beyond
  Docker, monitoring integration, or browser end-to-end suite was found.
- A competitive leaderboard platform: no leaderboard implementation was found;
  puzzle responses contain answers/solutions and progress can be submitted by
  clients. Server verification alone does not prevent inspecting answers.
- A fully offline game or native mobile application. The service worker caches
  static assets only; daily data, HTML, account actions, and external media need
  network access.
- A scheduled daily push system. Dispatch code exists but scheduling is absent
  from the tracked source reviewed.
- Competitive anti-cheat protection: snapshots preserve answers in the database,
  but current puzzle responses still expose answer/solution fields. Scoring and
  submitted client progress are not server-authoritative.
- A repository with no tests. Pytest and Vitest suites already exist, despite the
  README's unchecked frontend testing item.

## Concrete review findings

| Priority                                  | Finding                                                   | Source / consequence                                                                                                                                                                                                         |
| ----------------------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| High                                      | API Docker health check invokes missing tooling           | Compose calls `wget`; the Python slim Dockerfile only installs `build-essential`. Validate and replace the health command or add the dependency.                                                                             |
| High                                      | Database upgrade path needs rollout validation            | Alembic is now pinned and the image includes migrations; the additive revision is not yet verified against disposable PostgreSQL. Startup `metadata.create_all` remains and should be removed after deployments use Alembic. |
| Medium                                    | Local backend instructions miss import setup              | Source is under `src`; bare `uvicorn app.main:app` after installing requirements needs `--app-dir src`, `PYTHONPATH`, or an installed package.                                                                               |
| Medium                                    | Build-time public environment handling needs verification | Compose supplies `NEXT_PUBLIC_API_BASE` at runtime; the web Docker build does not explicitly provide it. Check the compiled browser API URL before deployment.                                                               |
| Medium                                    | Web Docker dependency copy needs verification             | Filtered pnpm install occurs in the deps image, but only root `node_modules` is copied to builder. Verify workspace package links are available in a clean build.                                                            |
| Resolved in source; runtime check pending | Daily boundary and cache policy                           | UTC date/reset contract and explicit UTC labels are implemented; worker caches static assets only. Verify rollover and account switch in a live browser.                                                                     |
| Low                                       | Documentation is behind implementation                    | README omits PostgreSQL from its infrastructure table, marks frontend tests absent, and lists several implemented capabilities as future work. Anidle directory copy disagrees with gameplay.                                |
| Low                                       | Referenced/supporting files are missing                   | AGENTS.md references `agent_actions`, but that directory is absent. README claims MIT licensing, but no LICENSE file was found.                                                                                              |

These findings are source observations and validation targets, not a complete
security audit. Daily snapshot implementation follows this review; its runtime
and migration checks remain incomplete.

## Setup and validation reference

Use the pinned pnpm workspace (`pnpm@9.12.0`) and root lockfile rather than creating
a second npm lockfile. Docker uses Python 3.11 and Node 20.

For Docker, copy `.env.example` to `.env`, replace placeholders, then run
`docker compose up --build`. Do not use the sample session secret in a deployed
environment. Configure AniList OAuth for login and VAPID keys for push.

For local development, configure PostgreSQL/Redis hosts appropriately; the sample
`postgres` and `redis` hosts are Compose service names. Frontend server/browser
API URLs should both point to the local API when running outside Docker.

From `apps/api`, in an activated Python environment:

```sh
pip install -r requirements.txt
pip install pytest pytest-asyncio
uvicorn app.main:app --app-dir src --reload --port 8000
python -m pytest tests -q
```

Install dev dependencies for the frontend from the repository root, then:

```sh
pnpm install --frozen-lockfile
pnpm -C apps/web dev
pnpm -C apps/web test
pnpm -C apps/web exec tsc --noEmit
pnpm -C apps/web build
```

### Validation performed in this review

- Read tracked structure, routes, models, engine, persistence, game configuration,
  worker, dependencies, Docker files, and test configuration.
- Initial working tree was clean, using a per-command Git ownership exception.
  No global Git configuration was changed.
- Backend test attempt blocked: `python.exe` resolves to an inaccessible Windows
  Apps alias; no `apps/api/.venv` was present.
- Frontend test attempt blocked: installed pnpm fails with `EPERM` resolving
  `C:\Users\DRESKI~1`; direct Node fallback found no installed Vitest entry point.
  An existing `apps/web/node_modules` directory alone is not a complete test setup.
- Those were baseline-only limits. The later [correction review](REVIEW_CORRECTIONS.md)
  records passing local tests, build, disposable migrations and container smoke
  checks. Live OAuth and external data integration remain unverified.

## Recommended next work

1. Restore a working local runtime and install locked dependencies; run both test
   suites, type checking, a clean build, and Compose health checks.
2. Fix the API health command and establish a migration deployment path.
3. Align README and directory copy with actual game behavior and availability.
4. Validate progress identity handling and the Alembic upgrade against a
   disposable PostgreSQL database; legacy same-date progress stays quarantined.
5. Decide whether live rooms are casual shared play or competitive multiplayer;
   implement authority/persistence appropriate to that choice.
6. Wire notification scheduling and verify offline/account cache behavior if
   these features are part of the intended launch.

## Redesign branch (2026-10-13)

Commits on `redesign/ink-and-signal` after `f55f08f`:

- **Integration:** Codex review corrections and the Sol agents' work (daily snapshots,
  migrations, Anidle v2 rules, AnimeThemes fix, artwork), plus out-of-guesses
  status shown outside the game. Stops tracking `node_modules`/`.next`.
- **UI shell:** persistent sidebar (md+) / mode chips (mobile) with per-game status;
  Today is a grid of equal tiles; `GameShell` is title + "?" rules + status slot.
  Glass/blur styling is removed; colours come from tokens in `globals.css` mapped
  to semantic Tailwind names (`ink`, `panel`, `line`, `paper`, `muted`, `signal`,
  `correct`, `close`, `wrong`); fonts are Bricolage Grotesque + DM Sans.
- **Anidle:** input-first layout, inline redaction bars, comparison tile grid with
  episodes/format/cover, mobile cards, result card.
- **Daily score, Unlimited Anidle, cleanup:** dead components removed; `reset_at`
  is serialised with an explicit `Z`; the daily countdown targets 00:00 UTC.

Validation on the branch head: backend 55 passed / 3 opt-in skipped (disposable
container), frontend 24 files / 119 tests, `tsc --noEmit` clean, and manual browser
checks at 1280 and 390 against live public AniList reads. Still unverified: signed-in
AniList OAuth, real-backup migration adoption, offline/reconnect, screen reader and
tablet widths. Run tests as `node node_modules/vitest/vitest.mjs run` and
`node node_modules/typescript/bin/tsc --noEmit --incremental false` from `apps/web`
if pnpm hits the Windows profile-path `EPERM`.

## Portainer production deployment — 2026-10-13

The `codex/deploy-portainer` branch adds the Git-backed production stack at
`infra/stack.yml`, release instructions and an initial Portainer API deployment
script. Portainer stack 20 in Stache environment 1 runs the web, API, PostgreSQL,
Redis and a daily local backup service on docker-1. Application images are pinned
to `sha-d5b02a4337bd3545fb46ffff46cec417beeff7c4` in GHCR. Public ingress is
`https://guesssenpai.mustache.network`, through the existing Cloudflare Tunnel and
Traefik, with `/api` stripped before API forwarding.

GitHub Actions validates both suites and TypeScript before publishing images.
The release passed backend 58 tests (3 opt-in skipped), frontend 119 tests in
24 files, TypeScript and both production image builds. Next.js was upgraded to
15.5.27 with React 19.3.0 and asynchronous request APIs before public exposure.
Pydantic reads mounted Docker secrets; production session cookies are Secure.
The production entry point waits for PostgreSQL and runs Alembic before serving;
`/health/ready` checks PostgreSQL and Redis. Startup `create_all` remains for
compatibility and is no longer the production migration mechanism.

Observed production checks: all services running, application/data health checks
healthy, migration head `202610120002`, real daily publication with all five
available modes, public HTTPS/readiness 200, real title search, and the AniList
authorization redirect/callback URL. A launch dump was copied off-host and
restored successfully into an isolated local PostgreSQL container with the same
migration revision and one published daily row. Full signed-in OAuth/account sync
still requires user verification. Public browser smoke checks confirmed Today,
the daily Anidle route, practice title suggestions and submitted-guess comparison
feedback. The launch screenshot is kept in ignored local artifacts. Local
scheduled backup dumps share the database host; scheduled off-host
backups and host failover remain incomplete. The initial Portainer Git reference
is the deployment branch and must be switched to main after PR #188 is merged.

See [production operations](../infra/README.md) and Stache Infra's maintained
GuessSenpai topic for deployment evidence and remaining limits. Historical
baseline operational gaps above are superseded only by these explicit checks.

### AniList OAuth hotfix — 2026-10-13

The first human sign-in exposed an integration defect: AniList's token response
contains credentials, while the callback expected an embedded user object.
The hotfix on `codex/fix-anilist-oauth` fetches the authenticated GraphQL Viewer
before issuing a session. Token/profile lookup failures return a retry message
without setting a session cookie; production access logging is disabled to avoid
recording one-time credentials from callback query strings.

PR #189 contains the correction. CI passed 61 backend tests (3 opt-in skipped),
119 frontend tests, TypeScript and both production builds. Portainer stack 20
now uses image tag `sha-03c585bc7688ae652c2d6ad65ecb3a36575828fd`; its manifest
Git reference stays on main. Running-image inspection and public readiness passed.
The human confirmed a fresh AniList sign-in successfully returns to the app
signed in. Account progress synchronization remains separate QA. The earlier
callback code/state cannot be reused. Merge PR #189 to align main's application
code with this hotfix.

### GitOps release PRs — 2026-10-13

`infra/stack.yml` now pins the image tag in Git instead of reading a Portainer
`IMAGE_TAG` variable; it was pinned to the running `sha-03c585b…` build. After
each validated `main` build, the workflow's `release-pr` job updates a rolling
`release/production` PR that re-pins both images. Merging it is the deploy,
picked up by Portainer's Git polling. The repository setting allowing Actions to
create PRs and the Portainer polling switch are one-time manual steps; see
[production operations](../infra/README.md#gitops-releases).

### Rounds v3 game rework — 2026-10-13

Poster Zoomed, Redacted Synopsis, Character Silhouette and Guess the Opening now
play an Easy, Medium and Hard round, each a different anime from the matching
third of the popularity ranking (sequels excluded). Each round takes one
submission and shows a results screen; every round is worth up to 1,000 points
and optional hints are deducted from it. Shared pieces live in
`apps/web/src/components/rounds` (`useRoundGame`, `RoundUI`, `scoring`).
Round progress stores `points`, `hints`, `answers` and `result`; games finished
in the old format show a "finished before the update" note. `/puzzles/verify`
accepts `target_character_id` (the old featured-character lookup called a
function that did not exist). Anidle returned to a one-column-per-attribute
table and limits studios to main animation studios. The profile difficulty
preference no longer changes any game (it used to skip to a later round).

### Daily anime uniqueness follow-up — 2026-10-13

New daily generation never falls back to reusing an excluded anime ID when a
popularity tier or the full pool runs out. The same daily exclusion set covers
Anidle, all poster/synopsis rounds, all twelve character cards, and all opening
rounds: a complete five-mode set uses 22 distinct anime IDs. Character cards
draw from popular shows across all three rounds, with difficulty set by the art
treatment. Each character round requires four different anime; the legacy
single-anime character fallback is no longer used for daily generation.

Insufficient content fails generation before a snapshot is stored. Guess the
Opening remains optional and is omitted when three unused playable anime cannot
be found. Existing published snapshots remain unchanged. This uniqueness rule
applies within a daily set; it does not permanently exclude anime from later
dates or treat every related franchise entry as the same AniList media ID.

Validation: 81 backend tests passed, three opt-in tests skipped in a disposable
container. Regressions cover all 22 selections across five date seeds, pool
exhaustion, missing character imagery with no stored snapshot, and an optional
opening pool with only two unused anime. No production backfill was performed.

## Navigation for future work

- API entry/config/startup: `apps/api/src/app/main.py`, `core/config.py`, `core/database.py`.
- Puzzle contracts/generation: `apps/api/src/app/puzzles/models.py`, `puzzles/engine.py`.
- API surface: `apps/api/src/app/routers`.
- External data, sessions, search and persistence: `apps/api/src/app/services`.
- SQL schema/migrations: `apps/api/src/app/db/models.py`, `apps/api/alembic`.
- Pages: `apps/web/src/app`; game UI: `apps/web/src/components` (Anidle parts in `components/anidle`, nav in `components/nav`).
- Design tokens: `apps/web/src/styles/globals.css` `:root`, mapped in `apps/web/tailwind.config.ts`.
- Product availability/copy: `apps/web/src/config/games.ts` and game slug definitions.
- Account/progress/preferences/live behavior: `apps/web/src/hooks`.
- Worker source: `apps/web/src/service-worker.ts`; Next config emits the public JS.
- Tests: `apps/api/tests`, frontend component and utility `__tests__` directories.
