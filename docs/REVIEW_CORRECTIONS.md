# Review corrections — 2026-10-12

Reviewed the three agent handoffs against current source, tests, a clean Linux
production build, and the rendered application. The matte direction and simpler
Today page are useful progress, but the handoffs overstated functional readiness.

## Corrections applied

- Guest hydration no longer replaces saved play with an empty server response.
  Account progress is partitioned by user and puzzle/rules identity. Delayed
  responses cannot overwrite another account or newer local play; pending sync
  is cancelled on unmount and resumed from local state at the next hydration.
- Local/server merge preserves the more advanced complete game record. PostgreSQL
  account writes merge under a transaction/advisory lock, preserving concurrent
  mode updates. API requests reject mismatched owners and puzzle versions.
- Failed account/streak/logout requests now expose errors rather than fabricated
  logout/zero-streak success. Failed progress synchronization offers retry.
- Today uses API identity metadata, truthful Play/Resume/Results labels and guest
  copy. Error states provide recovery actions. UTC rollover offers explicit
  reload on Today and individual game routes, retaining the open puzzle.
- Real game routes now use the matte styling too. Mobile Anidle has a compact
  header and expandable rules, keeping its guess field and button visible at
  390 × 844. Both game routes explicitly render dynamically: caught Next.js
  static-generation signals previously risked publishing the error fallback.
- Service worker no longer precaches the homepage; cache version is bumped.
  Docker supports build-time public API configuration and binds to 0.0.0.0 for
  working localhost health checks. API readiness no longer waits on upstream
  puzzle generation; publication remains lazy.
- Fixed migration parent identity, historical revision-column length, invalid
  PostgreSQL volatile index predicate, and missing user_profiles migration.
  SQLite no longer attempts PostgreSQL extension creation.
- Poster selection excludes the Anidle answer where the pool permits.
  Updated stale engine tests and added snapshot, migration, concurrency,
  account isolation, progress hydration, and UTC rollover regression coverage.

## Validation

- Frontend: 34 tests in 14 files pass; TypeScript passes.
- Backend: 36 tests pass, opt-in PostgreSQL test skipped in normal suite.
- Separate disposable PostgreSQL 16 integration: passes fresh/repeated Alembic
  upgrade, concurrent daily publication, and concurrent account mode writes.
- Production Docker build passes, with both game routes marked dynamic. Runtime
  smoke: Anidle HTTP 200 includes the published identity, omits the failure
  fallback, and sends private/no-store headers. Container localhost health passes.
- Browser: Today at desktop width; real Anidle at mobile width; error/retry UI
  inspected against an isolated API. Puzzle content was synthetic local test
  data, not a claim that live AniList or AnimeThemes delivery is validated.
- Pre-existing dependency/build-output changes were not reset. No deployment,
  commit, user-database migration, or authenticated external action performed.

## Remaining release gates and next work

1. Exercise real AniList login/logout, upstream title search/evaluation, image
   delivery, optional opening clips, and offline/reconnect in a release staging
   environment. Automated progress races do not replace those end-to-end checks.
2. Rehearse adoption of a backup of the existing unversioned database. Fresh
   migrations pass; earlier migrations cannot blindly replay over create_all
   tables. Follow DAILY_PUZZLE_SCHEMA.md before rollout.
3. Replace generic game illustrations with art that communicates each mechanic;
   finish matte treatment and mobile QA of Poster, archive and remaining modes.
   Today/Anidle are a foundation, not a completed site-wide visual redesign.
4. Improve the core Anidle rule loop: current three-round/attempt model and late
   synopsis hints remain hard to explain. Decide a coherent attempt budget and
   hint cadence before adding more modes; version scoring changes explicitly.
5. Move answers and scoring authority server-side before competitive rankings.
   Current client payloads still expose solutions and progress is client-reported.

Historical agent handoffs describe their own validation limits; this document
supersedes those limits only for checks explicitly recorded here.
