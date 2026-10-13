# Agent 3 handoff — stable daily identity

Date: 2026-10-12

## Schema and API changes

- Added `daily_puzzle_sets`, keyed by UTC date, with immutable JSON content,
  answer snapshot, rules version, reset timestamp, available modes, and
  publication time. The unique key lets one concurrent insert win; losers read
  that committed snapshot. Required generation failure writes no row.
- Daily responses now include `puzzle_id`, `rules_version`, `reset_at`,
  `available_modes`, and `mode_puzzle_ids`. Account identity and AniList lists do
  not affect daily generation. Optional opening content can be absent.
- Archive discovery reads published dates only; requesting an unpublished past
  date returns 404. Future date publication is rejected.
- Added `/puzzles/availability` so navigation can render from date/mode metadata
  without loading puzzle clues or opening clips.
- Progress local keys and account sync requests include daily identity and rules.
  Legacy account progress whose embedded identity does not match is not returned
  as current progress. On first shared write, old same-date JSON is retained
  under `_legacy_history`. Existing streak rows are not changed.
- The service worker caches static assets only, not HTML, puzzle, or account data. Date labels and
  reset countdown use UTC/API reset metadata. An open daily remains in place
  after rollover and offers an explicit “Load new daily” action. Sharing includes
  puzzle identity and rules version.

## Migration and recovery

Read [DAILY_PUZZLE_SCHEMA.md](DAILY_PUZZLE_SCHEMA.md) before rollout. Alembic
1.14.0 is pinned in both dependency manifests; the API image copies migration
files and config. Back up first, then from `apps/api` run:

```powershell
alembic current
alembic upgrade head
```

The revision recognizes a table already created by the legacy SQLAlchemy
`create_all` bootstrap and records the migration without recreating it. This
path was not exercised against PostgreSQL in this environment. Downgrade drops
all published snapshots, so only restore via a pre-migration backup or an
explicit snapshot export; do not downgrade against production data. No database
was migrated during this task.

## Legacy history policy

Local browser storage uses an identity/rules-qualified key, so old date-only
personalized records remain in their prior slots. Account rows retain the
previous JSON in `_legacy_history` when the first identity-qualified write
replaces that date. Streak/achievement storage is untouched. Same-date legacy
progress is not merged into shared play. The compatibility wrapper is still one
row per account/date; later schema work should make legacy history a first-class
archive rather than an embedded JSON field.

## Validation evidence and remaining work

- `pnpm -C apps/web test` and TypeScript check were attempted; both stop before
  execution because pnpm cannot `lstat C:\Users\DRESKI~1` (`EPERM`).
- Backend `python -m pytest tests -q` could not start: `python.exe` resolves to
  an inaccessible Windows Apps alias. No Python interpreter is installed per
  the prior handoff.
- Docker Compose database inspection was blocked by access denied to the Docker
  engine pipe. Therefore migration execution, concurrent publication, guest vs
  two-account equality, cache/upstream fixture stability, UTC boundary behavior,
  negative-offset rendering, reload/offline/retry, account switch/conflict, and
  optional-opening behavior were not integration-tested in this turn.
- The product still returns answer/solution fields in browser puzzle payloads;
  storing snapshots does not establish anti-cheat protection. Full
  server-authoritative scoring and leaderboards remain out of scope.
- Backend tests for idempotent publication, migration upgrade/adoption, and
  legacy progress quarantine should be added and run on disposable PostgreSQL;
  frontend tests should cover rollover choice, identity-keyed local progress,
  sync conflict, offline retry, and UTC labels. Run the frontend production build
  after the Windows pnpm path issue is resolved.
