# ARCHITECTURE

## Overview
This project runs a local CRM + mailer stack with Twenty as the source CRM, listmonk as the mailer engine, and a custom connector service that performs sync, campaign triggering, and engagement writeback.

The connector is intentionally small and vertical-aware. Industry-specific behavior is isolated behind a vertical pack interface loaded by `VERTICAL` env var.

## ASCII Diagram

```text
                        +----------------------------+
                        |        Browser (User)      |
                        | Twenty UI + Connector UI   |
                        +-------------+--------------+
                                      |
                    localhost         | HTTP
                                      v
+------------------+        +---------+----------+        +------------------+
|   Twenty CRM UI  |<------>|   Twenty Server    |<------>| Twenty Postgres   |
|  (web frontend)  |        |  API + Webhooks    |        +------------------+
+------------------+        +---------+----------+
                                      |
                                      | webhook: person.created
                                      v
                            +---------+----------+
                            |  Connector Service  |
                            |  (TypeScript)       |
                            |---------------------|
                            | - Twenty client     |
                            | - listmonk client   |
                            | - vertical loader   |
                            | - tracking endpoints|
                            | - sidecar UI        |
                            +----+-----------+----+
                                 |           |
                     HTTP API    |           | HTTP API / SMTP config
                                 v           v
                         +-------+---+   +---+----------------+
                         |  listmonk  |   |      Mailpit       |
                         |   API/UI   |   | local SMTP inbox    |
                         +----+---+---+   +---------------------+
                              |   |
                              |   +--------------+
                              |                  |
                              v                  v
                     +--------+-----+     +------+---------+
                     | listmonk PG  |     | Tracking Hit   |
                     | (campaigns,  |     | (open/click)   |
                     | lists, subs) |     | -> connector    |
                     +--------------+     +----------------+
                                                 |
                                                 | writeback note/event
                                                 v
                                          +------+------+
                                          | Twenty API   |
                                          +-------------+
```

## Components

### 1) Twenty CRM (core CRM)
- Source of truth for contacts (phase 1 assumption).
- Emits webhook on person/contact creation/update.
- Receives engagement writebacks from connector (note/event on contact record).

### 2) listmonk (mailer engine)
- Stores subscribers, lists, campaigns.
- Sends email through local Mailpit SMTP for proof/demo.
- API is invoked only by connector (not directly from user workflow in phase 1).

### 3) Connector Service (custom integration layer)
Responsibilities:
- Accept Twenty webhooks and map CRM people -> listmonk subscribers.
- Provide manual sync endpoints for debugging/backfill.
- Trigger listmonk campaign test sends.
- Serve tracking endpoints (`open.gif`, `click`) to capture engagement and write back to Twenty.
- Load vertical pack adapters.
- Expose a minimal sidecar UI for local operations.

### 4) Vertical Packs (`/verticals`)
Contract-based modules loaded by env var.
- `generic`: default behavior, industry-agnostic mapping.
- `mortgage_au`: placeholder-only scaffold for AU mortgage workflows.

Rules:
- Core connector imports vertical through interface only.
- Mortgage-specific tags/fields/templates stay inside `verticals/mortgage_au`.

## Data Flow (Proof)

### A. Contact sync (Twenty -> listmonk)
1. User creates a contact/person in Twenty.
2. Twenty sends webhook to connector.
3. Connector validates/parses payload.
4. Connector resolves target list(s) via vertical pack.
5. Connector upserts subscriber in listmonk by email.
6. Connector records sync result locally (log + in-memory/recent cache).

### B. Send test campaign (connector -> listmonk)
1. User triggers a test send from connector sidecar UI or API.
2. Connector calls listmonk API to create/update campaign and send a test email.
3. Email is delivered to Mailpit (local proof inbox).

### C. Engagement writeback (tracking hit -> connector -> Twenty)
1. Tracking pixel/click URL in email points to connector.
2. Email client/browser requests tracking endpoint.
3. Connector records engagement + invokes Twenty API writeback.
4. Twenty shows note/event on the person timeline.

## Configuration
- `stack/.env`: container ports, image tags, database passwords, compose-level settings.
- `connector/.env`: API URLs/keys, webhook secrets, vertical selection, default list IDs.
- `VERTICAL` controls module loading (`generic` default).

## Security (Local Phase 1)
- Secrets only in `.env` files (not committed).
- `.env.example` contains placeholders.
- Optional webhook shared secret verification for Twenty events.
- Connector writeback endpoints validate required fields and use idempotency keys when available.

## Tradeoffs (Intentional)
- Use sidecar UI instead of deep Twenty frontend fork in phase 1 to keep proof fast and maintainable.
- Use connector-hosted tracking endpoints because listmonk lacks native outbound engagement webhooks for opens/clicks.
- Prefer synchronous API calls first; queue/retries deferred to later phase.
