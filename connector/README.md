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
- `POST /sync/contacts`
- `POST /sync/lists`
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

## Build / Start
```bash
cd /home/chris/projects/crm-mailer-platform/connector
npm run build
npm start
```
