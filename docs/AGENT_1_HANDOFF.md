# Agent 1 handoff — reliability foundation

Date: 2026-10-12

## Changes

- Fixed the mobile navigation open/close lifecycle, hid closed controls from the focus tree,
  and retained focus restoration on Escape and pathname change.
- Updated `TitleGuessField` to use input focus with active-descendant options.
  Mouse/touch/assistive click and Arrow/Enter selection fill the controlled field;
  explicit form submission or Enter after selection submits. Updated affected
  mode regressions and added evaluation-failure coverage.
- Availability now validates `guess_the_opening_enabled`, tracks pending/ready/error
  (ready plus false means disabled), ignores stale requests, and recovers correctly
  in React Strict Mode. An opening-mode lookup failure leaves other game actions
  available.
- Changed the API Docker health check from missing `wget` to Python's built-in
  `urllib.request`. Fixed the web image context to exclude nested dependency
  folders and copied the filtered workspace package links into the builder.
- Corrected `.env.example` `CORS_ORIGINS` to JSON list syntax expected by
  Pydantic Settings. A local ignored `.env` was copied from the example for
  Compose validation and smoke testing.
- Corrected Anidle discovery/help/preview copy; derive Play/Resume/Results from
  completed state and actual guesses; removed nested interactions from home tiles
  and made Play navigate into a game. Removed unsupported reward/leaderboard and
  scheduled-reminder promises, and qualified archive/availability copy.
- The account server fetch now prefers `API_BASE_URL`; HTTP 401 still means logged
  out, while connection/server failures show a retry message. The daily route has
  loading and unexpected-error UI, and its normal failed-fetch state has Retry.
- Added regression tests for fresh/partial/completed game actions, field select vs
  submit, API evaluation failure, malformed availability, disabled optional mode,
  and navigation focus behavior. Updated existing tests that encoded immediate
  suggestion submission.

## Validation evidence

- `pnpm install --frozen-lockfile` — succeeded after allowing Node access to its
  configured Windows profile path; existing root `pnpm-lock.yaml` remained the
  only lockfile.
- `pnpm -C apps/web test` — passed after final formatting: 11 files, 26 tests.
- TypeScript check from `apps/web` using installed TypeScript 5.6.2 with
  `--noEmit --incremental false` — passed after final changes.
- `pnpm -C apps/web build` — optimized compilation, Next's type check, and page
  generation passed; final standalone trace packaging failed because Windows
  denied required symlink creation in `.next/standalone`. It is not a successful
  full build.
- Browser at 390×844: mobile navigation opened and stayed open, Escape closed it
  and restored focus to the toggle. `/games/daily` showed its unavailable state
  and Retry; clicking Retry reloaded the route. There was no API server, so a
  successful keyboard guess, successful failed-request retry, or data-backed
  reload/resume could not be browser-verified. Component tests cover guessing and
  evaluation failure.
- `py -0p` — no Python interpreters installed; `python.exe` resolves to the
  Windows Apps alias. Backend pytest and local API configuration could not run.
- `docker build -t guesssenpai-api-validation -f apps/api/Dockerfile apps/api` —
  passed once Docker Desktop was running; the API image built successfully.
- `docker compose config --quiet` — passed using a local `.env` copied from
  `.env.example` after correcting its CORS list syntax.
- `docker compose up --build -d` — both API and web images built and containers
  were created. The API remains unhealthy and never finishes FastAPI startup;
  `/health/live` refuses connections. Postgres reports ready, while API logs
  stop at `Waiting for application startup`. The full stack smoke test is
  therefore incomplete and the startup hang needs diagnosis. The web root
  returned HTTP 200 from the host, although Compose's web health state showed
  unhealthy during this check.
- `.env` and external AniList credentials were not created or guessed.
- `git diff --check` — passed. Prettier 3.3.3 formatted touched TS/TSX, JSON,
  YAML, and Markdown files.
- Cleanup of tracked files changed by local dependency installation/build was
  attempted only for paths clean at the start, but automatic approval review
  rejected the combined restore because its scope included the API Dockerfile.
  Do not treat these generated validation artifacts as product changes; they
  need a reviewed cleanup before handoff/commit. The initial user modifications
  in `AGENTS.md`, `README.md`, and existing untracked docs were preserved.

## Remaining blockers and deployment notes

- Install Python 3.11, then from `apps/api` create/activate a venv and run:

  ```powershell
  py -3.11 -m venv .venv
  .\.venv\Scripts\Activate.ps1
  python -m pip install -e ".[dev]"
  python -m pytest tests -q
  python -m uvicorn app.main:app --app-dir src --reload --port 8000
  ```

- For the web workspace, install using `pnpm install --frozen-lockfile`; run
  `pnpm -C apps/web test`, `pnpm -C apps/web exec tsc --noEmit`, and
  `pnpm -C apps/web build`. This host's Next standalone output needs filesystem
  symlink permission. After restoring that capability, rerun the clean build.
- API schema upgrade/deployment remains blocked: runtime startup calls
  `metadata.create_all`, while migration files exist but Alembic is absent from
  runtime/dev dependencies and the API image does not copy migrations. No schema
  migration or deployment was attempted.
- Local `.env` uses example development values. Real AniList OAuth and VAPID
  credentials remain necessary only for those integrations, not basic Compose
  parsing. The current API startup hang prevents end-to-end validation.
- Browser QA still needs backend-backed tests for keyboard guessing, failed
  evaluation retry, reload/resume, account fetch distinctions, opening-mode
  failure isolation, and touch/assistive suggestion activation.

## Agent 2 coordination

- Keep the existing FastAPI response contract: opening availability remains
  `guess_the_opening_enabled` on `/puzzles/today`. A lightweight endpoint/schema
  redesign was intentionally left to Agent 3.
- Preserve the `TitleGuessField` contract: `onValueChange` selects/fills; field
  `onSubmit` runs on Enter after selection (or Enter with a free-typed value);
  explicit callers use the exposed `submit()` handle or form submit button.
- Availability status lives in `useDailyAvailability`; only the opening mode
  depends on its result. Do not gate Anidle, Poster, Synopsis, or Silhouette on
  an opening-mode request failure.
- Recheck current source and this handoff's validation statuses before relying on
  them. Web tests and TypeScript checking were rerun after the final source
  refinements; see the validation evidence above.
