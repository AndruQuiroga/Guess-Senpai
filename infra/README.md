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

For updates, build/test first, then use Portainer's Git redeploy operation with
the new `IMAGE_TAG`, preserving all other stack variables and registry settings.
Do not run a competing `docker stack deploy`. Review migrations and database
backups before changing the API tag. The API entry point waits for PostgreSQL,
runs Alembic, and starts a single Uvicorn worker. This is a fresh-database rollout;
an existing unversioned database requires the separate adoption procedure.

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
