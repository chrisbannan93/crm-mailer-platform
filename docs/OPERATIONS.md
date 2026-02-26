# OPERATIONS

## Running The Platform (local)

### Start
```bash
cd stack
cp .env.example .env   # first run only
cd ../connector
cp .env.example .env   # first run only
cd ../stack
docker compose --env-file .env up -d --build
```

### Stop
```bash
cd stack
docker compose --env-file .env down
```

### Reset (destructive local reset)
```bash
cd stack
docker compose --env-file .env down -v
```

## Logs

### All services
```bash
cd stack
docker compose --env-file .env logs -f
```

### Specific services
```bash
cd stack
docker compose --env-file .env logs -f twenty-server
docker compose --env-file .env logs -f listmonk
docker compose --env-file .env logs -f connector
```

## Health / URLs
- Twenty: `http://localhost:3000`
- listmonk: `http://localhost:9000`
- Connector: `http://localhost:4010`
- Mailpit: `http://localhost:8025`
- Connector health: `http://localhost:4010/healthz`

## Contact Sync Operations (MVP)

Manual bounded sync run (Twenty -> listmonk):
```bash
curl -X POST http://localhost:4010/sync/contacts
```

Manual bounded sync run with limit override (max `500`):
```bash
curl -X POST "http://localhost:4010/sync/contacts?max=100"
```

Expected behavior:
- contacts without email are skipped
- listmonk subscribers are upserted by email (idempotent)
- subscriber `attribs` include `twentyId`, `phone`, `tags[]`
- sync cursor (`updatedSince` + pagination cursor) is stored in local connector state file

Segment/list reconciliation run:
```bash
curl -X POST http://localhost:4010/sync/lists
```

Expected behavior for `/sync/lists`:
- reads `segments.json` from the active vertical pack config directory
- ensures matching listmonk lists exist
- computes desired memberships from Twenty contacts using segment rules (tags/fields)
- applies add/remove membership changes in listmonk
- repeats safely; next run re-evaluates from current Twenty contact data

Scheduler (optional):
- set `SYNC_INTERVAL_MINUTES` in `connector/.env`
- connector will run the same bounded sync periodically

State file defaults:
- `connector/data/state.json` (local dev)
- path configurable via `SYNC_STATE_FILE`

## Backups (initial guidance)
Phase 1 uses Docker volumes. Backup strategy starts simple:
- export Postgres DB dumps for Twenty and listmonk
- copy important env files (`stack/.env`, `connector/.env`)
- optionally archive `stack/uploads/`

### Example placeholder backup locations (ignored by git)
- `backups/`
- `*.dump`
- `*.sql`
- `*.tar.gz`

## Restore (placeholder)
1. Recreate stack containers
2. Restore DB dumps into the respective Postgres services
3. Restore env files
4. Restart services and validate health endpoints

## Operational TODOs
- Add scripted backups in `scripts/backup.sh`
- Add restore walkthrough
- Add smoke-check script for proof flow
- Add retention policy for local backups
