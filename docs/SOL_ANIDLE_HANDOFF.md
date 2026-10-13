# Sol Anidle handoff — 2026-10-12

Implemented review correction 4 as a finite daily rule loop. New publications
use daily rules version `2` and carry explicit Anidle rules: one anime, eight
accepted guesses, automatic synopsis hints after two, four, and six incorrect
guesses. This is a product hypothesis for a short daily session, not a claim of
validated retention or competitive scoring. The last guess can win. Otherwise
the answer is revealed and entry closes.

Hints use successive existing redacted synopsis levels. If synopsis content is
missing, metadata reveals genres after two misses, year after four, and tags
after six (when those fields exist). Missing content never blocks completion.

Empty input, API-rejected/failed evaluations, repeated case/whitespace-normalized
titles, repeated selected media IDs, and canonical aliases of an earlier answer
do not consume attempts. A synchronous submission lock prevents double submits.
Input remains available after evaluation failure.

## Compatibility and outcome

- Missing/null Anidle rules means legacy behavior: unlimited accepted guesses,
  three round stages, synopsis after ten incorrect guesses and every two after.
- Published snapshots are read under their stored daily rules version; no
  publication rewrite or migration occurs. Legacy daily and mode identities
  remain v1, preserving their progress storage keys and saved evaluations.
- A solve alone writes `completed=true`. Exhaustion is derived from v2 rules
  and accepted guess count, and keeps `completed=false`; it cannot itself award
  a solved-game streak. Reload restores both exhausted and solved states.
- Both outcomes reveal the answer with truthful spoiler-free share copy.
  Discovery/result navigation for exhaustion is coordinated with the parent.

## Files and validation

Changes are localized to Anidle.tsx/tests, the optional Anidle rules frontend and
backend models, new generation/daily version in engine.py, and backend engine and
snapshot regressions. Existing uncommitted work was preserved.

- Anidle Vitest: 14 tests pass, including hint cadence/resume, metadata fallback,
  accepted eighth miss, exhaustion reload, final-attempt solve, invalid/empty and
  repeated/alias guesses, failed requests, legacy unlimited history, and share
  cancellation.
- TypeScript `--noEmit --incremental false`: passes.
- Backend targeted engine/snapshot suite: 16 tests pass in a disposable Docker
  container, read-only source mount, in-memory SQLite; test packages installed
  only within that removed container. Tests prove v2 generation and legacy raw
  snapshot retention with regeneration prohibited.
- Prettier 3.3.3 formats touched frontend files. pnpm initially failed its Windows
  profile-path permission check; the approved escalated runtime worked.

## Concrete remaining release work

Real AniList title search/evaluation and a mobile browser session still require
staging checks. Component tests are not live upstream or touch-keyboard evidence.
The broader release integration/build checks belong to the parent handoff.

The browser still receives answer/solution data, and evaluations/progress are not
trusted competitive authority. Before rankings: evaluate against the immutable
snapshot answer server-side, store accepted canonical media IDs and outcomes
transactionally per puzzle/account, enforce attempt/hint rules and duplicate
handling on that server record, expose only permitted clues before reveal, and
derive streak/scoring from those records. No rankings, deployment, real database
changes, credential reads, or commits were performed.
