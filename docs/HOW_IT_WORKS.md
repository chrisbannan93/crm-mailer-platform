# HOW IT WORKS

## Runtime Roles

### Twenty CRM (core CRM)
- User creates/updates People in Twenty.
- Twenty sends `person.created` / `person.updated` webhooks to the connector.
- Connector can optionally call Twenty API for manual person sync and direct note writeback.

### listmonk (mailer engine)
- Connector creates or reuses a list (from the active vertical pack).
- Connector upserts subscribers by email.
- Connector creates campaigns and triggers test sends through the listmonk API.

### Connector (integration + sidecar UI)
- Receives Twenty webhooks.
- Maps a person payload into a listmonk subscriber.
- Serves tracked URLs for opens/clicks.
- Writes engagement back to Twenty (mode-dependent).
- Provides a minimal local UI for manual operations.

## Connector Endpoints

### Health and sidecar UI
- `GET /healthz` - liveness + active vertical.
- `GET /` - sidecar UI for manual sync, test campaign send, recent events.
- `GET /events/recent` - in-memory recent event feed.
- `GET /lists` - listmonk lists (for debugging).

### Sync
- `POST /webhooks/twenty` - accepts Twenty webhooks (`person.*`), verifies signature (optional), syncs subscriber to listmonk.
- `POST /sync/person/:id` - manual sync by Twenty person ID (requires `TWENTY_API_KEY`).
- `POST /sync/contacts` - bounded polling sync from Twenty contacts into listmonk (cursor-based, repeat-safe).

### Campaigns
- `POST /campaigns/send-test` - creates a listmonk campaign and sends a test email to the provided address.

### Engagement tracking / writeback
- `GET /track/open.gif` - tracking pixel endpoint; records an open and writes back.
- `GET /track/click` - tracked redirect endpoint; records a click and redirects.
- `POST /webhooks/engagement` - manual/debug engagement injection endpoint.

## Vertical Pack System

The active vertical is selected by `VERTICAL` (default: `generic`).

Each pack currently contains a `vertical.json` contract with:
- default list definition (`name`, `type`, `optin`, tags)
- static subscriber attributes to stamp into listmonk
- whether to include `twentyPersonId` in listmonk subscriber attributes

This keeps the core connector industry-agnostic while allowing vertical-specific list names, tags, and later rules.

## Writeback Modes

`TWENTY_WRITEBACK_MODE` controls how engagement events are written back:

- `log` (default): No external writeback. Connector stores events in `/events/recent` only.
- `rest_note`: Connector calls a Twenty REST endpoint (default `/rest/notes`) with a best-effort note payload.
- `workflow_webhook`: Connector POSTs engagement payloads to a Twenty Workflow Webhook Trigger URL. This is the most version-stable way to prove writeback without depending on a specific REST note schema.

## Proof Flow (What happens internally)

1. You create a contact/person in Twenty.
2. Twenty sends `person.created` webhook to `connector`.
3. Connector deduplicates the webhook (`event + recordId + timestamp`).
4. Connector ensures the vertical’s list exists in listmonk.
5. Connector upserts the person as a listmonk subscriber (by email).
6. You trigger `POST /campaigns/send-test` (via sidecar UI or curl).
7. listmonk sends the test email (SMTP configured to Mailpit).
8. Opening/clicking tracked content hits connector tracking endpoints.
9. Connector records engagement and writes it back to Twenty (mode-dependent).

## Notes / Limitations (Phase 1)
- listmonk does not provide a native outbound webhook for opens/clicks. The connector solves this by hosting tracking endpoints used inside campaign HTML.
- Twenty REST object schemas are workspace/version dependent. `workflow_webhook` mode is recommended first for a stable proof.
- Recent event feed is in-memory only (intentionally simple for local proof), but contact sync cursor state is persisted locally in `connector/data/state.json` by default.
