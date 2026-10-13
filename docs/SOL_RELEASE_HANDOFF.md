# Sol release validation handoff

Reviewed 2026-10-12 (America/Phoenix; execution crossed 2026-10-13 UTC).
No deployment, commit, user database migration, existing container mutation,
secret inspection or authenticated external action was performed.

## Changes

- Added `tests/test_postgres_adoption.py`: opt-in PostgreSQL rehearsal with two
  separate empty databases, independently migrated reference schema, complete
  legacy table fixtures, explicit default/index reconciliation, checked stamp,
  repeated upgrade and original-row preservation assertions.
- Updated `DAILY_PUZZLE_SCHEMA.md` with the observed differences and operator
  restore/compare/adopt procedure. Real installation backup adoption remains a gate.
- Repaired AnimeThemes integration after anonymous live requests showed its
  current response is nested `search.anime` / `anime`, while the existing adapter
  assumed JSON:API `data` / `included`. Search and extraction now accept both;
  current includes request nested song/artists, entries, videos and audio. Nested
  spoiler/NSFW entries are excluded. Three tests cover current lookup, missing/
  filtered entries and historical JSON:API extraction.
- Added three auth failure tests: missing OAuth configuration, invalid state
  preventing token exchange, missing session refresh, and backend failure during
  `/me`/logout producing failure rather than fabricated logout success.
- Added explicit opt-in live API smoke and `tools/release_public_probe.py`, an
  anonymous read-only public-service probe that prints counts/status only and
  never saves remote media. The normal test suite does not call public services.

## Validation evidence

Disposable PostgreSQL 16 ran as `sol-review-adoption-postgres`; source was mounted
read-only in disposable `guess-senpai-api` runners. Alembic was pinned to repository
version 1.14.0 for final checks. No root `.env` is mounted or read: runner working
directory is `/work` (API source, which has no `.env`), and database URLs are
explicit synthetic disposable credentials. All new containers were removed after
validation; existing Compose containers were left alone.

- Full backend suite: **44 passed, 3 skipped**, in 3.71 seconds. Skips are the
  opt-in fresh PostgreSQL, adoption and public network checks. FastAPI lifecycle
  and old httpx test shortcut deprecation warnings remain.
- Final adoption rehearsal: **1 passed**, 1.50 seconds. Baseline comparison checks
  types/nullability, primary/foreign/unique keys and expected indexes/defaults.
  All nine legacy tables retain their entire seeded rows after stamp and two
  upgrades; profile/snapshot tables are added empty. Test refuses nonempty input.
  PostgreSQL role was the disposable superuser; restricted migration-role
  extension privileges are not proven.
- New auth/AnimeThemes regressions: **6 passed**, 0.66 seconds.
- `RUN_PUBLIC_UPSTREAM_SMOKE=1 pytest tests/test_public_upstream_smoke.py -q`:
  **1 passed**, 2.01 seconds. Actual ASGI routes returned HTTP 200 for title
  search (Cowboy Bebop, AniList ID 1), self-match Anidle evaluation with
  `correct=true`, and processed poster bytes. Only pytest's in-memory SQLite
  fixture stores the fetched public index data; no deployed DB is used.
- `PYTHONPATH=src python tools/release_public_probe.py`: public title search
  returned 3 matches; media ID 1 had 4 genres, year and description; poster and
  character images returned HTTP 206 `image/png`; repaired opening lookup found
  a clip whose audio returned HTTP 206 `audio/ogg`, with 1024 bytes sampled.
  These establish current endpoint delivery, not every daily candidate's media
  quality, browser codecs/autoplay/CORS behavior or future upstream availability.

## Remaining staging checklist

1. Restore an actual installation backup into isolated staging, compare the
   entire schema/data and rehearse adoption using `DAILY_PUZZLE_SCHEMA.md`.
   Synthetic emulation cannot certify an unknown installation's schema drift.
2. With operator-provided OAuth credentials and a dedicated test account, verify
   AniList login callback, secure cookie behavior over HTTPS, refresh, logout,
   expiry/rejected grants, two-account switching and persisted progress. No live
   OAuth success is claimed. Auth failure tests are local controlled checks.
3. In a browser staging session, disconnect/reconnect the API during a partial
   puzzle and account sync; ensure saved progress remains, retry succeeds,
   stale account data never appears and connection failure is not logged-out
   success. Inspect opening audio playback and failure recovery, poster crop
   quality and character silhouette images. ASGI delivery is not browser QA.
4. Confirm new daily publication from live pools and several candidates across
   modes, missing optional clips, archive/reload, UTC rollover and appropriate
   availability projection. Sample public requests do not prove daily generation.

## Server-authoritative follow-on scope

Browser payloads still expose answer/solution material, Anidle evaluation accepts
client-supplied target media IDs, and account progress remains client-reported.
This release work does not establish authoritative scoring or anti-cheat.

Before competitive rankings, split private snapshots from public clue projections;
remove answer IDs/titles/solutions and answer-derived indexes from unsolved payloads;
evaluate guesses by server-held puzzle/mode/rules identity; record accepted attempts,
hints and completion transactionally with idempotency keys; reveal answers only at
an allowed terminal state; and derive scores/streak eligibility from those records.
Preserve published legacy rules versions and historical progress separately.
Add tests for tampered target IDs, repeated/concurrent guesses, hint-budget bypass,
clock manipulation, replayed completion, account ownership and response answer
leaks. Rankings should follow this authority boundary, not precede it.
