# Repository Guidelines

## Repository Context
- Read `docs/REPOSITORY_STATE.md` for the reviewed architecture, implemented versus planned features, setup gaps, and validation limits (reviewed 2026-10-12).
- Read `docs/UX_UI_AUDIT.md` before changing navigation, game discovery, dialogs, or shared UI patterns; it records known interaction defects and outstanding visual QA.
- Recheck the source before relying on that snapshot, and update it when material architecture or feature boundaries change.

## Project Structure & Module Organization
- `apps/api`: FastAPI backend with domain packages under `src/app` (`routers`, `services`, `puzzles`, `core`).
- `apps/web`: Next.js frontend; routes live in `src/app`, shared UI in `src/components`, global styles in `src/styles`.
- `agent_actions`: design briefs and integration notes—review the relevant doc before implementing large changes.
- `.env.example`: baseline config; duplicate to `.env` when running locally and for compose.

## Coding Style & Naming Conventions
- Python 3.11, 4-space indents, snake_case modules and functions; keep FastAPI routers thin and delegate to `services/`.
- Prefer explicit type hints on public functions and dataclasses (`RoundSpec`, `PuzzleSpec`).
- Frontend uses TypeScript, functional components, and Tailwind utility classes; name components with PascalCase and colocate per feature.
- Run Prettier (`npx prettier --write`) before commits; adopt `ruff`/`black` for Python if added—otherwise match existing style manually.
