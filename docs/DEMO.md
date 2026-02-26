# DEMO CHECKLIST

## Goal
Demonstrate the local CRM + mailer platform with Mailer Studio controls and engagement writeback.

## Prerequisites
- Stack running (`stack/docker-compose.yml`)
- Twenty reachable at `http://localhost:3000`
- listmonk reachable at `http://localhost:9000`
- connector reachable at `http://localhost:4010`
- Twenty auth token configured in `connector/.env`
- listmonk API credentials configured in `connector/.env`

## Optional (recommended)
- Install the Twenty nav app from `twenty-apps/mailer-studio-nav/` so `Mailer Studio` appears in Twenty navigation

## Demo Steps
1. Open Twenty and create/update a contact with an email address.
2. Add tags on the contact (example: `lead`, `vip`, or `customer`) for segment sync demo.
3. Open Mailer Studio (`http://localhost:4010/` or via Twenty nav item).
4. Confirm connection status shows Twenty and listmonk reachable.
5. Click `Run Contact Sync`.
6. Click `Run List Sync`.
7. Open listmonk UI and verify:
   - subscriber exists
   - segment lists (`Customers`, `Leads`, `VIP`) exist
   - membership reflects tags
8. Trigger an engagement event (recommended: webhook curl simulation from `docs/WEBHOOKS.md`).
9. Return to Mailer Studio and confirm recent engagement event appears.
10. Verify engagement writeback in Twenty (depending on `TWENTY_WRITEBACK_MODE`):
    - `workflow_webhook` flow target
    - or direct `rest_note`/activity record if configured

## Demo Talking Points
- Core platform remains industry-agnostic.
- Vertical packs drive segment/list behavior (`verticals/<VERTICAL>/config/segments.json`).
- Contact sync is bounded and cursor-based.
- List sync uses full recompute + diff application for simple, safe reconciliation.
- Mailer Studio UI is isolated from Twenty core code via the official Twenty apps nav mechanism.

## Quick Commands
Run contact sync:
```bash
curl -X POST http://localhost:4010/sync/contacts
```

Run list sync:
```bash
curl -X POST http://localhost:4010/sync/lists
```

Check studio status:
```bash
curl http://localhost:4010/studio/status
```

Show recent engagement events:
```bash
curl "http://localhost:4010/events/recent?kind=engagement&limit=10"
```
