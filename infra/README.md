# GuessSenpai production deployment

Public URL: https://guesssenpai.mustache.network.

Portainer manages the `guesssenpai` Swarm stack in Stache environment 1. The
production definition is `infra/stack.yml`, fetched from this Git repository.
Cloudflare Tunnel forwards its hostname to the existing Traefik VIP; Traefik
strips `/api` before forwarding browser API requests. Portainer stays private.

## Build and release

GitHub Actions tests the API/frontend, type-checks TypeScript, and publishes
`ghcr.io/andruquiroga/guesssenpai-api:sha-<commit>` and the corresponding web image.
Images target amd64. Browser API and canonical site URLs are compiled for this
domain. Do not substitute mutable `latest` tags.

First deployment uses `infra/deploy-portainer.ps1 -ImageTag sha-<validated-commit>`.
It checks the trusted Swarm identity, creates application-specific Docker secrets,
and creates a Git-backed stack through Portainer's API. OAuth credentials come
from the ignored local `.env`; generated database/session secrets never enter Git.
Do not use the generic Stache inline-stack update script on this Git stack.

The initial deployment branch is `codex/deploy-portainer`. After the deployment
PR is merged, change the Portainer Git reference to `refs/heads/main` and verify
the fetched definition before the next release.

## GitOps releases

`infra/stack.yml` pins both application images to one `sha-<commit>` tag; it is
the only record of what production runs. Portainer polls `main` and redeploys
the stack when that file changes. GitHub never connects to Portainer.

1. Merge application changes to `main`. The workflow tests them and publishes
   `sha-<merge commit>` images.
2. Its `release-pr` job then updates one rolling PR on `release/production`
   that re-pins `infra/stack.yml` to that build, listing the commits since the
   current production tag and flagging any `apps/api/alembic` changes.
3. Review it (migrations run automatically when the API starts, so confirm a
   recent backup first when the PR warns about them) and merge. Portainer
   deploys it within its polling interval.
4. Roll back by reverting the release merge, only when the older image is
   compatible with the migrated schema.

Merging a release PR does not rebuild images (`paths-ignore`). A build whose
commit is no longer the newest code on `main` leaves the PR to the newer build.

One-time setup:
- Repository Settings → Actions → General → enable "Allow GitHub Actions to
  create and approve pull requests" so `GITHUB_TOKEN` can open the release PR.
- Portainer stack `guesssenpai` → Git settings: reference `refs/heads/main`,
  enable automatic updates by polling (for example every 5 minutes), keep
  re-pull image off (tags are immutable), then remove the obsolete `IMAGE_TAG`
  stack variable. The stack file no longer reads it.

Do not run a competing `docker stack deploy` or edit the stack's images in
Portainer; change `infra/stack.yml` through a PR instead. The API entry point
waits for PostgreSQL, runs Alembic, and starts a single Uvicorn worker. This is
a fresh-database rollout; an existing unversioned database requires the
separate adoption procedure.

## Archive backfill

Past days are never generated on request. To fill missing archive days (for
example after a fresh database), run inside the API container:

    python -m app.puzzles.backfill --days 14

It only publishes days that have no set, from current popularity data seeded by
each date, and never replaces a published day. All days share one popularity
fetch (four AniList requests), and AniList calls wait out rate limiting rather
than fail.

## Storage and availability

All initial services are constrained to `docker-1`. Dedicated named volumes are
`guesssenpai_postgres-data`, `guesssenpai_redis-data`, and `guesssenpai_backups`.
They are local Docker volumes, not shared storage or `/srv` bind mounts. Changing
placement requires verified data migration. Docker membership supplies the needed
volume/secret management without changing sudo privileges.

The backup service creates a PostgreSQL custom-format dump every 24 hours and
retains about seven days in the local backup volume. These backups share the
database host and do not protect against losing that host/disk. Copy a verified
dump off-host after release; scheduled off-host backup is separate operational
work. Dumps contain account data and must remain private and outside Git.

Live rooms hold state in the API process. Keep one API replica/worker; restart
loses rooms. The stack has bounded memory/logs, container health checks and API
dependency readiness. Additional web replicas require placement/load review.

## Validation and rollback

Check Portainer's saved Git source/tag, service convergence, container health,
Alembic revision, `/api/health/ready`, real daily data, search/evaluation, guest
resume, media, OAuth callback and account synchronization through public HTTPS.
Readiness checks PostgreSQL and Redis without requiring upstream puzzle creation.

Roll back the application tag through Portainer only when the previous image is
compatible with the migrated schema. Never downgrade the production database or
delete its volumes as a routine rollback. Stop public exposure by removing only
the new hostname's Cloudflare route/DNS record; preserve unrelated tunnel routes.

The production API uses `/run/secrets` via Pydantic Settings and enables Secure,
HttpOnly, SameSite=Lax session cookies. Rotate Docker secrets by creating a new
version and updating the Git stack source through Portainer.
