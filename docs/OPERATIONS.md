# OPERATIONS

## Runbook (Local Linux / Docker)

This project is designed to be operated from the repo root with `make` targets and helper scripts.

## Primary Commands

### Start / bootstrap
```bash
make up
```
What it does:
- copies missing `stack/.env` and `connector/.env` from examples
- starts the Docker Compose stack (`up -d --build`)

### Stop stack
```bash
make down
```

### Follow logs
```bash
make logs
```

### Status (compose + HTTP health checks)
```bash
make status
```
This runs `scripts/status.sh` and checks:
- Compose service status
- Twenty health endpoint
- listmonk HTTP endpoint
- connector health endpoint
- Mailer Studio status endpoint
- Mailpit UI endpoint

### Connector tests
```bash
make test
```

## URLs (default local ports)
- Twenty: `http://localhost:3000`
- listmonk: `http://localhost:9000`
- Connector API: `http://localhost:4010`
- Mailer Studio UI: `http://localhost:4010/`
- Mailpit UI: `http://localhost:8025`

## Backup / Restore

### Backup
Create a timestamped backup under `./backups/<UTC timestamp>/`:
```bash
make backup
```

What is included:
- `twenty.sql.gz` (Twenty Postgres dump)
- `listmonk.sql.gz` (listmonk Postgres dump)
- `listmonk-uploads.tar.gz` (if `stack/uploads/` exists)
- `manifest.txt` (non-secret metadata only)

What is NOT included (by design):
- `stack/.env`
- `connector/.env`
- any API tokens, passwords, or secrets

### Restore (latest backup)
```bash
make restore
```

### Restore (specific backup)
```bash
make restore BACKUP=backups/20260226T120000Z
```

Restore behavior:
- ensures DB services are running
- stops app services during restore (`twenty-server`, `twenty-worker`, `listmonk`, `connector`)
- resets `public` schema in both DBs before importing dumps
- restores listmonk uploads if present

## Direct Scripts (if you prefer)
- `./scripts/bootstrap.sh`
- `./scripts/status.sh`
- `./scripts/backup.sh`
- `./scripts/restore.sh [--backup backups/<timestamp>]`

## Sync Operations (MVP)

### Contact sync (Twenty -> listmonk)
```bash
curl -X POST http://localhost:4010/sync/contacts
```

With bound override (max `500`):
```bash
curl -X POST "http://localhost:4010/sync/contacts?max=100"
```

Expected behavior:
- skips contacts without email
- upserts subscribers by email (idempotent)
- stores sync cursor locally (`connector/data/state.json` by default)

### Segment/list reconciliation
```bash
curl -X POST http://localhost:4010/sync/lists
```

Expected behavior:
- reads `verticals/<VERTICAL>/config/segments.json`
- ensures listmonk lists exist
- computes desired memberships from Twenty contacts
- applies add/remove membership diffs in listmonk

## Webhook Operations (MVP)
- listmonk webhook endpoint: `POST /webhooks/listmonk`
- docs + sample payloads: `docs/WEBHOOKS.md`

## Mailer Studio Operations
- Connector-hosted UI: `http://localhost:4010/`
- Twenty nav integration (official apps alpha): `twenty-apps/mailer-studio-nav/`
- docs: `docs/MAILER_STUDIO.md`

### Vertical email templates
Mailer Studio now exposes generic template operations backed by `verticals/<VERTICAL>/templates/email/*.json`.

List templates:
```bash
curl http://localhost:4010/templates/email
```

Render a template with application context:
```bash
curl -X POST http://localhost:4010/templates/email/render \
  -H 'Content-Type: application/json' \
  -d '{
    "templateKey":"retail_documents_request",
    "context":{
      "contact":{"firstName":"Chris"},
      "broker":{"name":"Broker Name","signature":"Broker Name"},
      "application":{"applicationId":"APP-001","applicationType":"retail_home_loan","pipelineStage":"docs_requested","lenderTarget":"Example Lender"},
      "checklist":{"requiredSummary":"ID, bank statements, privacy consent"}
    }
  }'
```

Send a template test via listmonk:
```bash
curl -X POST http://localhost:4010/campaigns/send-template \
  -H 'Content-Type: application/json' \
  -d '{
    "templateKey":"retail_documents_request",
    "to":"proof@example.com",
    "personId":"<twenty-person-id>",
    "context":{
      "contact":{"firstName":"Chris"},
      "broker":{"name":"Broker Name","signature":"Broker Name"},
      "application":{"applicationId":"APP-001","applicationType":"retail_home_loan","pipelineStage":"docs_requested","lenderTarget":"Example Lender"},
      "checklist":{"requiredSummary":"ID, bank statements, privacy consent"}
    }
  }'
```

## Troubleshooting

### `make up` fails because env files are missing
Run:
```bash
./scripts/bootstrap.sh
```
This creates missing `.env` files from examples.

### Connector health is failing
Check connector logs:
```bash
docker compose --env-file stack/.env -f stack/docker-compose.yml logs -f connector
```
Common causes:
- invalid Twenty token in `connector/.env`
- invalid listmonk credentials in `connector/.env`
- connector port conflict (`4010`)

### Twenty is up but contact sync fails
Check:
- `TWENTY_BASE_URL` in `connector/.env`
- `TWENTY_AUTH_TOKEN` (or legacy `TWENTY_API_KEY`)
- API path settings (`TWENTY_REST_PATH`)
- Connector logs for response status and error details

### CRM-visible writeback for local MVP
Recommended setting in `connector/.env`:
```bash
TWENTY_WRITEBACK_MODE=rest_note
```

Why:
- writes a real Twenty Note for each engagement
- links that note to the target Person through `NoteTarget`
- avoids depending on a manually configured Twenty workflow

Verify:
```bash
curl 'http://localhost:4010/track/open.gif?email=test@example.com&personId=<twenty-person-id>&applicationId=APP-001' >/dev/null
TOKEN=$(awk -F= '/^TWENTY_API_KEY=/{print substr($0,index($0,"=")+1)}' connector/.env)
curl -sS -H "Authorization: Bearer $TOKEN" -H 'Accept: application/json' http://localhost:3000/rest/notes | jq .
curl -sS -H "Authorization: Bearer $TOKEN" -H 'Accept: application/json' http://localhost:3000/rest/noteTargets | jq .
```

`workflow_webhook` is still supported, but it is only reliable when the target workflow inside Twenty is configured correctly.

### listmonk sync fails or lists are not created
Check:
- `LISTMONK_BASE_URL` in `connector/.env`
- `LISTMONK_AUTH_*` credentials
- listmonk service logs:
```bash
docker compose --env-file stack/.env -f stack/docker-compose.yml logs -f listmonk
```

### Backups fail (`pg_dump` / container not running)
- Start stack first: `make up`
- Confirm DB services exist: `make status`
- Re-run backup: `make backup`

### Restore fails due to import conflicts
`restore.sh` resets the `public` schema before restore. If it still fails:
- inspect dump file integrity (`gzip -t backups/<ts>/twenty.sql.gz`)
- check DB/container logs
- ensure compatible PostgreSQL major versions (current stack uses Postgres 16 for Twenty, 17 for listmonk)

### Port conflicts
Default ports:
- `3000` (Twenty)
- `9000` (listmonk)
- `4010` (connector)
- `8025` / `1025` (Mailpit)
- `5433` / `5434` (host DB access)

Change host ports in `stack/.env`, then restart:
```bash
make down
make up
```

## Upgrade Strategy (Minimal / Safe)

### Principles
- upgrade one subsystem at a time
- take a backup first
- verify with `make status` and a small sync test before moving on
- keep connector API compatibility stable for the Mailer Studio UI and Twenty nav app

### Recommended sequence
1. `make backup`
2. Upgrade image tags in `stack/.env` / `stack/docker-compose.yml` (one service family at a time)
3. `make down`
4. `make up`
5. `make status`
6. Run smoke checks:
   - `POST /sync/contacts`
   - `POST /sync/lists`
   - webhook simulation from `docs/WEBHOOKS.md`
7. If regression appears, restore from backup:
   - `make down`
   - `make restore BACKUP=...`
   - `make up`

### Twenty upgrades
- Twenty APIs can vary by version/workspace schema.
- After upgrade, validate:
  - `GET /studio/status`
  - contact sync (`/sync/contacts`)
  - engagement writeback mode (`rest_note` is the simplest reliable local default)

### listmonk upgrades
- listmonk runs `--install --idempotent` and `--upgrade --yes` on startup in this stack.
- After upgrade, verify:
  - list UI loads
  - API auth still works via connector
  - `POST /sync/lists` succeeds

### Connector upgrades
- run tests before restart:
```bash
make test
cd connector && npm run build
```
- then restart stack: `make up`

## Security / Secrets Handling
- Secrets live in `.env` files only (`stack/.env`, `connector/.env`)
- Backups intentionally exclude `.env` files and tokens
- Do not commit populated `.env` files
