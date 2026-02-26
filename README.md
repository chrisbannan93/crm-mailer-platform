# Local CRM + Mailer Platform (Twenty + listmonk)

Local, free, open-source CRM + mailer platform for Linux Mint using:
- Twenty CRM (core CRM)
- listmonk (mailer engine)
- custom TypeScript connector (sync + campaign trigger + engagement writeback)
- vertical packs (`generic`, `mortgage_au` placeholder)

## Deliverables Included
- `stack/` Docker Compose stack (Twenty + listmonk + connector + Mailpit)
- `connector/` runnable TypeScript service + tests
- `verticals/` pack system (`generic`, `mortgage_au`)
- `docs/PLAN.md`, `docs/ARCHITECTURE.md`, `docs/HOW_IT_WORKS.md`

## Prerequisites
- Linux Mint (or other Linux)
- Docker Engine + Docker Compose plugin (`docker compose`)
- Node.js 20+ (for local connector tests/dev only)

## 1. Configure env files

### Stack env
```bash
cd /home/chris/projects/crm-mailer-platform/stack
cp .env.example .env
```

### Connector env
```bash
cd /home/chris/projects/crm-mailer-platform/connector
cp .env.example .env
```

## 2. (Optional) Run connector tests locally
```bash
cd /home/chris/projects/crm-mailer-platform/connector
npm install
npm test
npm run build
```

## 3. Start the full local stack
```bash
cd /home/chris/projects/crm-mailer-platform/stack
docker compose --env-file .env up -d --build
```

Check status:
```bash
docker compose --env-file .env ps
```

## 4. Open the apps
- Twenty CRM: `http://localhost:3000`
- listmonk: `http://localhost:9000`
- Connector sidecar UI: `http://localhost:4010`
- Mailpit (SMTP inbox UI): `http://localhost:8025`

## 5. Configure listmonk for local test sends (Mailpit)
In listmonk UI (`http://localhost:9000`):
1. Create/sign in as admin (or use the admin creds from `stack/.env` on first boot).
2. Go to **Settings** and configure the email messenger/SMTP to Mailpit:
   - Host: `mailpit`
   - Port: `1025`
   - TLS/SSL: disabled
   - Username/password: blank
3. Save settings.

Notes:
- listmonk runs in Docker, so use `mailpit` (container hostname), not `localhost`.

## 6. Configure Twenty webhook (contact sync)
In Twenty UI (`http://localhost:3000`):
1. Go to **Settings -> APIs & Webhooks -> Webhooks**
2. Create a webhook with URL:
   - `http://connector:4010/webhooks/twenty`
3. Save.

Why `connector` instead of `localhost`:
- Webhook delivery is performed from inside the Twenty container, where the connector is reachable by Docker service name.

## 7. Configure Twenty API key (for manual person sync and optional direct REST writeback)
In Twenty UI:
1. Go to **Settings -> APIs & Webhooks**
2. Create an API key
3. Copy it immediately
4. Put it in `connector/.env` as `TWENTY_API_KEY=...`

Then restart only the connector:
```bash
cd /home/chris/projects/crm-mailer-platform/stack
docker compose --env-file .env up -d --build connector
```

## 8. Choose a writeback mode (recommended: workflow webhook)
Default is `TWENTY_WRITEBACK_MODE=log` (safe, no external writeback).

### Recommended proof mode: `workflow_webhook`
This avoids depending on a specific Twenty REST note schema.

In Twenty:
1. Create a Workflow with a **Webhook Trigger** (incoming webhook)
2. Copy the generated trigger URL
3. Add actions to create/update a record (for example, create a note/event or log record tied to the person)

In `connector/.env`, set:
```env
TWENTY_WRITEBACK_MODE=workflow_webhook
TWENTY_WORKFLOW_WEBHOOK_URL=<your Twenty workflow trigger URL>
```

Restart connector:
```bash
cd /home/chris/projects/crm-mailer-platform/stack
docker compose --env-file .env up -d --build connector
```

### Optional direct API mode: `rest_note`
If you confirm your workspace note endpoint/payload in Twenty’s API playground, set:
```env
TWENTY_WRITEBACK_MODE=rest_note
TWENTY_ENGAGEMENT_NOTE_ENDPOINT=/rest/notes
```
The connector sends a best-effort note payload; adjust endpoint/body contract as needed for your workspace.

## 9. Set the active vertical pack
In `stack/.env`:
```env
VERTICAL=generic
```
Available now:
- `generic` (default)
- `mortgage_au` (placeholder scaffold)

Restart connector after changing vertical:
```bash
cd /home/chris/projects/crm-mailer-platform/stack
docker compose --env-file .env up -d --build connector
```

## 10. Working Proof (end-to-end)

### Step A: Create a contact in Twenty
- Create a new **Person** in Twenty with an email address (for example `proof@example.com`).

### Step B: Confirm it synced to listmonk
Check connector recent events:
- Open `http://localhost:4010` and click **Refresh** under Recent Events.
- You should see a `sync` event for the new email.

Check listmonk subscriber list:
- In listmonk, open Subscribers and confirm the email exists in the vertical’s list.

### Step C: Send a test campaign
Use the connector sidecar UI:
- Open `http://localhost:4010`
- Enter recipient email and (optionally) Twenty person ID
- Click **Send Test Campaign**

Or via curl:
```bash
curl -X POST http://localhost:4010/campaigns/send-test \
  -H 'Content-Type: application/json' \
  -d '{"to":"proof@example.com","subject":"Connector proof","personId":"<twenty-person-id>"}'
```

### Step D: Open the test email in Mailpit
- Open `http://localhost:8025`
- Open the test email
- Click the tracked link in the email (this hits `/track/click`)

(Optional) Simulate an open pixel manually:
```bash
curl "http://localhost:4010/track/open.gif?email=proof@example.com&personId=<twenty-person-id>"
```

### Step E: Verify engagement writeback
- Connector sidecar UI (`http://localhost:4010`) should show an `engagement` event.
- In Twenty, verify the workflow-triggered writeback result (or note/event if using `rest_note` mode).

## Useful API Commands

### Manual sync a person by Twenty ID
```bash
curl -X POST http://localhost:4010/sync/person/<twenty-person-id>
```

### Manual batch sync contacts
```bash
curl -X POST http://localhost:4010/sync/contacts \
  -H 'Content-Type: application/json' \
  -d '{"contacts":[{"crmId":"p1","email":"a@example.com","firstName":"A"}]}'
```

### Manual engagement injection (debug)
```bash
curl -X POST http://localhost:4010/webhooks/engagement \
  -H 'Content-Type: application/json' \
  -d '{"type":"manual","email":"proof@example.com","personId":"<twenty-person-id>","source":"curl"}'
```

## Project Structure
- `stack/` compose stack and infra envs
- `connector/` TypeScript connector service
- `verticals/` vertical packs (config-only in phase 1)
- `docs/` design and implementation docs

## Known Phase 1 Tradeoffs
- Connector uses in-memory event storage (no durable queue/db yet).
- listmonk engagement is captured via connector tracking endpoints (not native listmonk outbound webhooks).
- Twenty direct REST note writeback may require workspace-specific payload tuning.

## Stop / Reset
Stop stack:
```bash
cd /home/chris/projects/crm-mailer-platform/stack
docker compose --env-file .env down
```

Stop and delete volumes (destructive local reset):
```bash
cd /home/chris/projects/crm-mailer-platform/stack
docker compose --env-file .env down -v
```
