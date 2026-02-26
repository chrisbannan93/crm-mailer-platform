# LISTMONK_SETUP

## Access listmonk UI (local)

When the stack is running, open:
- listmonk UI: `http://localhost:9000`

Start the stack if needed:

```bash
cd /home/chris/projects/crm-mailer-platform/stack
docker compose --env-file .env up -d --build
```

Check status:

```bash
cd /home/chris/projects/crm-mailer-platform/stack
docker compose --env-file .env ps
```

## First-time login / admin setup

You can either:
- use admin credentials provided in `stack/.env` (`LISTMONK_ADMIN_USER`, `LISTMONK_ADMIN_PASSWORD`) on first boot, or
- complete the UI setup flow if credentials were not pre-seeded.

## Local test SMTP (Mailpit)

For local testing, configure listmonk SMTP to Mailpit (same Docker network):
- Host: `mailpit`
- Port: `1025`
- TLS/SSL: disabled
- Username/password: blank

Mailpit UI:
- `http://localhost:8025`

## Webhooks (later)

### Current state
This repo includes a placeholder connector endpoint:
- `POST /webhooks/listmonk`

This endpoint is reserved for future listmonk-related webhook/event ingestion.

### Important note
listmonk is API-first, but it may not expose all outbound webhook events needed for engagement tracking (opens/clicks) like a full ESP platform.

For this project, engagement tracking is currently handled by connector-hosted tracking URLs (open/click endpoints) embedded in campaign content.

### Future webhook configuration approach
When implemented later, configure the webhook target to the connector (or an adapter that forwards to it):
- Local/dev target (inside Docker network): `http://connector:4010/webhooks/listmonk`
- External/public target (future): `https://<your-domain>/webhooks/listmonk`

Planned additions for this doc later:
- webhook auth/signature secret
- payload schema examples
- retries/idempotency behavior
- local `curl` test examples
- mapping from listmonk events to CRM writeback actions

## Campaign sending note
The connector already supports listmonk campaign API usage for test sends where available. For manual operation, you can also create/send campaigns directly from the listmonk UI (`http://localhost:9000`).
