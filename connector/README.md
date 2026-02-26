# Connector Service

TypeScript Node/Express microservice that connects Twenty CRM and listmonk.

## Responsibilities
- call listmonk API (lists, subscribers, campaigns)
- call Twenty API (manual person fetch + engagement writeback; workflow webhook fallback supported)
- expose sync endpoints
- receive webhooks (Twenty and placeholder listmonk webhook receiver)
- load vertical configuration from `../verticals/<VERTICAL>/config`

## Source Layout
- `src/config` - env parsing/validation (`zod`)
- `src/clients` - API clients (`listmonkClient`, `twentyClient`)
- `src/services` - sync/webhook/vertical loader services
- `src/routes` - express route registration
- `src/jobs` - optional background jobs hook (placeholder)
- `src/types` - shared types

## Endpoints
- `GET /health`
- `GET /healthz` (compat alias)
- `POST /sync/contacts` (pull sync from Twenty -> listmonk; bounded run)
- `POST /sync/lists` (segment-driven list reconciliation from `verticals/<VERTICAL>/config/segments.json`)
- `POST /webhooks/listmonk`

Existing extra endpoints remain available for local proof/debug (campaign test send, tracking, etc.).

## Vertical Loading
- `VERTICAL` defaults to `generic`
- loader resolves from `verticals/<VERTICAL>/config/*.json` (prefers `pack.json`)
- falls back to `generic`
- legacy fallback to `verticals/<VERTICAL>/vertical.json` is still supported

## Twenty API Notes (preferred + fallback)
Preferred:
- use Twenty API key (`Authorization: Bearer ...`) for manual syncs and direct API writeback when stable for your workspace schema

Fallback (recommended for writeback proof):
- `TWENTY_WRITEBACK_MODE=workflow_webhook`
- configure a Twenty Workflow Webhook Trigger URL and let the workflow create the note/event

## Run Commands
```bash
cd /home/chris/projects/crm-mailer-platform/connector
npm install
npm run dev
npm test
```

## Contact Sync MVP (Twenty -> listmonk)
`POST /sync/contacts` now performs a bounded polling sync from Twenty instead of requiring a posted contacts array.

Behavior:
- skips contacts without an email
- upserts listmonk subscriber by email (safe to re-run)
- stamps subscriber `attribs` with:
  - `twentyId`
  - `phone`
  - `tags` (array)
- persists sync cursor locally in `connector/data/state.json` by default
- supports pagination continuation across runs

### Run manually (curl)
Default bounded run (uses `SYNC_MAX_CONTACTS_PER_RUN`, capped at `500`):
```bash
curl -X POST http://localhost:4010/sync/contacts
```

Override bound for one run (query param):
```bash
curl -X POST "http://localhost:4010/sync/contacts?max=100"
```

Override bound for one run (JSON body):
```bash
curl -X POST http://localhost:4010/sync/contacts \
  -H "Content-Type: application/json" \
  -d '{"max": 250}'
```

### Optional scheduler
Set in `connector/.env`:
```bash
SYNC_INTERVAL_MINUTES=5
SYNC_MAX_CONTACTS_PER_RUN=500
SYNC_STATE_FILE=./data/state.json
```

When set, the connector runs the same bounded sync periodically in the background.

## Segment / List Sync MVP
`POST /sync/lists` reads segment definitions from the active vertical pack and reconciles listmonk list memberships.

Current MVP approach:
- full recompute desired memberships from all Twenty contacts on each run
- apply add/remove changes against listmonk using a local membership snapshot in connector state
- safe and repeatable for local use

Generic example segments are defined in:
- `../verticals/generic/config/segments.json`

## Build / Start
```bash
cd /home/chris/projects/crm-mailer-platform/connector
npm run build
npm start
```
