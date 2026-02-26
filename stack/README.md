# Stack (Twenty + listmonk + connector)

This directory contains the local Docker Compose stack for:
- Twenty CRM (official `twentycrm/twenty` image, server + worker)
- Postgres + Redis for Twenty
- listmonk (official `listmonk/listmonk` image)
- dedicated Postgres for listmonk
- connector service container (wired to Twenty + listmonk by Docker service name)
- Mailpit (local SMTP inbox/UI for testing)

## Notes on "official/recommended" setup
- Twenty service layout is based on Twenty's official self-host Docker Compose pattern (`server` + `worker` + Postgres + Redis).
- listmonk uses the official Docker image and the recommended idempotent install/upgrade startup command:
  - `--install --idempotent`
  - `--upgrade`

## Files
- `docker-compose.yml` - stack definition
- `.env.example` - stack config template (no secrets)
- `uploads/` - local listmonk uploads mount

## Quick Start (exact commands)

### 1) Create env files (first run)
```bash
cd /home/chris/projects/crm-mailer-platform
cp stack/.env.example stack/.env
cp connector/.env.example connector/.env
```

### 2) Start the stack
```bash
cd /home/chris/projects/crm-mailer-platform/stack
docker compose --env-file .env up -d --build
```

### 3) Check status
```bash
cd /home/chris/projects/crm-mailer-platform/stack
docker compose --env-file .env ps
```

## URLs (localhost-only)
- Twenty CRM: `http://localhost:3000`
- listmonk: `http://localhost:9000`
- Connector: `http://localhost:4010`
- Mailpit UI: `http://localhost:8025`
- Mailpit SMTP: `localhost:1025`

## Connector-to-service networking (inside Docker)
The connector reaches services by Docker service name on the shared network:
- Twenty: `http://twenty-server:3000`
- listmonk: `http://listmonk:9000`
- Mailpit: `http://mailpit:8025`

## Common Commands (exact)

### Start (foreground)
```bash
cd /home/chris/projects/crm-mailer-platform/stack
docker compose --env-file .env up --build
```

### Start (detached)
```bash
cd /home/chris/projects/crm-mailer-platform/stack
docker compose --env-file .env up -d --build
```

### Stop
```bash
cd /home/chris/projects/crm-mailer-platform/stack
docker compose --env-file .env down
```

### Stop and delete volumes (destructive local reset)
```bash
cd /home/chris/projects/crm-mailer-platform/stack
docker compose --env-file .env down -v
```

### Logs (all services)
```bash
cd /home/chris/projects/crm-mailer-platform/stack
docker compose --env-file .env logs -f
```

### Logs (specific services)
```bash
cd /home/chris/projects/crm-mailer-platform/stack
docker compose --env-file .env logs -f twenty-server
cd /home/chris/projects/crm-mailer-platform/stack
docker compose --env-file .env logs -f listmonk
cd /home/chris/projects/crm-mailer-platform/stack
docker compose --env-file .env logs -f connector
```

## Initialization Notes
- Twenty migrations run in the `twenty-server` container on startup (worker has migrations disabled).
- listmonk DB installation and migration are automated on container start using the official idempotent install/upgrade command.
- The connector depends on `connector/.env` and will fail to start if that file is missing.

## Healthchecks
Configured healthchecks:
- `twenty-server`
- `twenty-db`
- `twenty-redis`
- `listmonk-db`
- `connector`

## Troubleshooting

### 1) `connector/.env` missing
Symptom:
- `docker compose config` or `up` fails with `../connector/.env not found`

Fix:
```bash
cd /home/chris/projects/crm-mailer-platform
cp connector/.env.example connector/.env
```

### 2) Twenty server stuck unhealthy
Check logs:
```bash
cd /home/chris/projects/crm-mailer-platform/stack
docker compose --env-file .env logs -f twenty-server twenty-db twenty-redis
```

Common causes:
- invalid `TWENTY_APP_SECRET`
- Postgres startup delay
- port `3000` already in use locally

### 3) listmonk not starting or DB install errors
Check logs:
```bash
cd /home/chris/projects/crm-mailer-platform/stack
docker compose --env-file .env logs -f listmonk listmonk-db
```

Common causes:
- reused volume with mismatched DB credentials in `.env`
- port `9000` / `5434` already in use

### 4) Ports already in use on localhost
Examples: 3000, 9000, 4010, 8025, 1025

Fix:
- change the port values in `stack/.env`
- restart the stack

### 5) Rebuild connector after local code changes
```bash
cd /home/chris/projects/crm-mailer-platform/stack
docker compose --env-file .env up -d --build connector
```
