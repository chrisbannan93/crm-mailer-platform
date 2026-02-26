# PLAN

## Goal
Build a local, free, open-source CRM + mailer platform on Linux Mint using Twenty CRM + listmonk + a custom connector, with an industry-agnostic core and pluggable vertical packs.

## Non-Goals (Phase 1)
- Deep modifications to Twenty frontend source code.
- Production hardening (HA, SSO, TLS termination, backups, monitoring).
- Multi-tenant support.

## Constraints
- Local Linux Mint, Docker + Docker Compose.
- Free / open-source components only.
- Secrets in `.env` files only.
- Start minimal, iterate.

## Milestones

### M1. Repo & Docs (this commit)
- Create project skeleton.
- Write architecture and plan docs.
- Define vertical pack boundaries and extension points.

### M2. Local Stack (`/stack`)
- Docker Compose for:
  - Twenty (server/worker + Postgres + Redis)
  - listmonk + Postgres
  - connector service (Node/TypeScript)
  - Mailpit (local SMTP inbox for testing)
- `.env.example` files for stack and connector.
- One-command local boot and health checks.

### M3. Connector (`/connector`)
- TypeScript service with:
  - `POST /webhooks/twenty` (contact/person-created events)
  - `POST /sync/person/:id` and `POST /sync/contacts` (manual sync)
  - `POST /campaigns/send-test` (trigger listmonk test send)
  - `GET /track/open.gif` and `GET /track/click` (engagement tracking endpoints)
  - `POST /webhooks/engagement` (manual/test event injection)
  - `GET /healthz`
- Clients:
  - Twenty API client (REST/GraphQL wrapper + notes/events writeback)
  - listmonk API client (lists/subscribers/campaigns/templates)
- Vertical loader via `VERTICAL=generic|mortgage_au|...`
- Unit tests for payload mapping, idempotency, and webhook verification.

### M4. Vertical Packs (`/verticals`)
- `generic` default pack:
  - base contact mapping
  - neutral tags/list naming
- `mortgage_au` scaffold:
  - placeholder fields/tags only
  - no core leakage
- Explicit interface contract and TODO markers.

### M5. Minimal CRM UI Additions (Phase 1 compromise)
- Lightweight connector admin UI (sidecar web page) for:
  - manual sync by contact ID / batch sync
  - create list / send test campaign
  - view recent engagement writebacks
- Document how to link/open it alongside Twenty.
- TODO for deeper Twenty-native UI embedding when extension mechanism is stable.

### M6. Proof Flow
Document and script the proof steps:
1. Create contact in Twenty.
2. Connector receives Twenty webhook (or manual sync fallback).
3. Contact appears in listmonk list.
4. Send test campaign via connector UI/API.
5. Trigger engagement tracking URL (open/click) and verify note/event in Twenty.

## Implementation Order
1. Docs
2. Stack compose + envs
3. Connector scaffold + tests
4. Vertical packs
5. Sidecar UI
6. README + proof scripts
7. Smoke validation

## Risks / Unknowns
- Twenty self-hosted API auth and object writeback schemas may vary across versions.
- Twenty webhook event names/payloads may differ; connector will support a tolerant parser.
- listmonk does not expose native outbound engagement webhooks for opens/clicks; Phase 1 uses connector-hosted tracking endpoints embedded in campaign content.

## Simplest Robust Defaults
- Default vertical: `generic`
- Contact identity key: email
- Engagement writeback target in Twenty: note/comment attached to person (fallback to generic event endpoint if configured)
- Local SMTP: Mailpit

## TODO (post-proof)
- Bidirectional list membership sync
- Campaign templates per vertical
- OAuth/API-key rotation UI
- Retry queue + durable jobs
- Rich engagement model (opens/clicks/bounces/unsubscribes)
