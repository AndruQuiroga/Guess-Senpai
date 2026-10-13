# Daily puzzle snapshot schema and migration plan

## Identity and storage

`daily_puzzle_sets` has one row per UTC calendar date. `puzzle_date` is the
publication key; `rules_version` versions scoring semantics; `reset_at` is the
next UTC midnight; `content` is the immutable generated snapshot; and
`available_modes` is the small discovery projection. The response derives a
set ID (`daily:YYYY-MM-DD`) and stable mode IDs (`daily:YYYY-MM-DD:<mode>:v1`).
The JSON snapshot contains the puzzle content and answer material needed by the
current client. Its answer exposure is documented as a remaining anti-cheat
limitation.

The unique date primary key arbitrates concurrent publication. Requests first
read the row, generate only if absent, insert once, and on a uniqueness race
discard their candidate and read the winner. Required generation failure writes
nothing; an optional opening clip can be omitted and represented as unavailable.
An existing row is never regenerated when cache entries expire or upstream data
changes. Past dates without a row are unavailable rather than backfilled from
mutable upstream pools.

## Migration and recovery

For a **fresh empty database**, install API requirements and run `alembic upgrade head`
from `apps/api` before starting the API. Head `202610120002` includes the snapshot
and missing user-profile tables. Fresh upgrade and repeated upgrade have been
verified against disposable PostgreSQL 16 and SQLite during the correction review.
The migration chain also repairs a broken parent revision, a PostgreSQL-invalid
volatile index predicate, and the too-short Alembic revision column.

For an **existing unversioned database created by `create_all`**, do not blindly
run the entire migration chain: earlier revisions will try to create tables that
already exist. Back up, compare the actual schema with the migration baseline,
resolve differences, and stamp only the verified matching revision before
upgrading. A synthetic legacy `create_all` adoption has now been rehearsed on
disposable PostgreSQL 16 with Alembic 1.14.0; adoption of an actual installation
backup still requires the operator checks below. The
snapshot/profile revisions recognize existing tables, but that alone does not
make the earlier chain safe to replay. No user database was migrated in review.

### Rehearsed legacy adoption procedure

The verified legacy baseline is `202411090002`, containing users, sessions,
progress, streaks, recent media, title indexes and character indexes. The
rehearsal deliberately excludes `daily_puzzle_sets` and `user_profiles`, seeds
one synthetic row in every legacy table, checks column types/nullability,
primary keys, foreign keys/cascades and unique keys against an independently
migrated baseline, then stamps and upgrades twice. Every seeded row, including
legacy progress JSON, tokens (synthetic only), dates and streak count, survives
unchanged. Snapshot/profile tables are added empty. This is reproducible coverage,
not permission to stamp a real database based on table names alone.

1. Stop writes and make a restorable backup. Restore it into isolated staging;
   use credentials and hosts that cannot address the live installation. Record
   counts and protected data checksums without printing token values.
2. Create a separate empty reference database and migrate it to `202411090002`.
   Compare restored schema against this reference, including columns, defaults,
   keys/cascades, unique constraints, index definitions and `pg_trgm` availability.
   Use `schema_contract` in `tests/test_postgres_adoption.py` as the starting
   inventory. It normalizes equivalent `CURRENT_TIMESTAMP`/`now()` defaults;
   review sequence ownership and GIN operator classes explicitly as well.
3. The emulated `create_all` baseline had these reviewed differences: absent
   `ix_user_recent_media_recent_window(user_id, seen_at)`; absent SQL `DEFAULT 0`
   on `streaks.count`, `media_title_aliases.priority`, and
   `character_aliases.priority`; extra ORM foreign-key indexes; and differing
   session unique-constraint names. Reconcile the missing index/defaults using
   reviewed additive SQL. Equivalent constraint names and extra indexes need no
   renaming. `users.id` intentionally retains no sequence/default because AniList
   assigns external user IDs; the historical migration's BIGSERIAL default is
   not necessary for this application's explicitly supplied IDs.
4. If the restored schema has any other difference, stop and resolve it before
   stamping. If snapshot/profile tables already exist, compare their full schema
   and preserve their data too: the additive revisions only check table presence.
   Ensure the migration role can install/use `pg_trgm`; managed-role restrictions
   are not covered by the superuser disposable rehearsal.
5. Against the verified staging restore, run `alembic stamp 202411090002`, then
   `alembic upgrade head` twice. Verify head `202610120002`, schema/index/default
   inventory, original row counts/checksums, account progress quarantine and
   snapshot immutability. Only an independently approved rollout may apply the
   same reviewed sequence to the installation. Rollback uses the verified backup.

Run the synthetic rehearsal from `apps/api` with two **empty disposable**
PostgreSQL URLs set as `TEST_ADOPTION_POSTGRES_URL` and
`TEST_ADOPTION_REFERENCE_URL`, then:

```sh
PYTHONPATH=src python -m pytest tests/test_postgres_adoption.py -q
```

The test refuses a nonempty database rather than clearing it. Use new disposable
databases for each invocation. Do not supply installation URLs. See
[Sol release handoff](SOL_RELEASE_HANDOFF.md) for exact runtime evidence and
remaining staging checks.

No migration runs automatically at startup; legacy `create_all` remains. Remove
that bootstrap only after deployed environments have verified migration stamps.
Do not downgrade production: snapshot downgrade drops published history. Restore
a verified backup with matching application code if rollback is necessary.

## Progress compatibility policy

Legacy progress is date-keyed and may represent a personalized AniList puzzle.
It must not be relabeled as shared progress based on date alone. Preserve those
records as legacy history and retain account streak/achievement totals; do not
claim that old guesses solve the newly published daily set. The client stores
local progress under a date/puzzle/rules key and sends identity to the account
endpoint. The account identity is stored in reserved JSON metadata; a mismatched
legacy record is preserved under `_legacy_history` on first shared write. This
compatibility layer is not a normalized relational schema, and the legacy record
does not yet have a separate history view. Frontend regression tests cover account-switch response races; real OAuth
login/logout across multiple browser sessions remains release QA.
