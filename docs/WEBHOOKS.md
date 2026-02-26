# WEBHOOKS

## Purpose
This document covers webhook ingestion into the connector, with a focus on listmonk event webhooks (`open`, `click`, `bounce`, `unsubscribe`) and how they are mapped into Twenty engagement activities.

## Endpoints
- Twenty CRM webhook intake: `POST /webhooks/twenty`
- listmonk event webhook intake: `POST /webhooks/listmonk`

Local connector base URL:
- `http://localhost:4010`

## listmonk Webhook Auth (MVP)
The connector supports shared-header-token verification for listmonk webhooks.

Configure in `connector/.env`:

```bash
LISTMONK_WEBHOOK_SECRET=change_me
LISTMONK_WEBHOOK_HEADER=X-Webhook-Token
LISTMONK_WEBHOOK_DEDUP_TTL_SECONDS=3600
```

Behavior:
- If `LISTMONK_WEBHOOK_SECRET` is set (or fallback `WEBHOOK_SHARED_SECRET`), requests to `/webhooks/listmonk` must include the matching header token.
- If not set, the endpoint accepts requests without auth (local development only).

## Payloads (MVP accepted shapes)
The connector accepts a flexible JSON payload and normalizes it.

Supported event types (string matching, case-insensitive):
- values containing `open`
- values containing `click`
- values containing `bounce`
- values containing `unsub`

Common fields the connector will read (best effort):
- event type: `event`, `type`, `eventType`, or nested `data.event` / `data.type`
- timestamp: `timestamp`, `ts`, or `data.timestamp`
- subscriber email: `email`, `subscriber.email`, `data.email`, `data.subscriber.email`
- subscriber attribs (for `twentyId`): `subscriber.attribs`, `attribs`, `data.subscriber.attribs`, `data.attribs`
- campaign: `campaign.id`, `campaign_id`, `campaignId`, `data.campaign.id`
- campaign name: `campaign.name`, `campaign_name`, `campaignName`
- click URL: `url`, `link`
- reason: `reason`

## Event Mapping To Twenty
Incoming listmonk events are normalized and mapped to engagement activities:

- `open` -> `EMAIL_OPEN`
- `click` -> `EMAIL_CLICK`
- `bounce` -> `EMAIL_BOUNCE`
- `unsubscribe` -> `EMAIL_UNSUB`

Contact identification order:
1. `subscriber.attribs.twentyId` (or `twentyPersonId`)
2. Fallback to Twenty lookup by subscriber email (`getContactByEmail`)

The connector writes an engagement payload to Twenty with:
- timestamp
- person ID (if resolved)
- email
- campaign ID / name (if present)
- URL (for clicks)
- reason (for bounces/unsubs, if present)
- `crmActivityType` metadata (`EMAIL_OPEN`, `EMAIL_CLICK`, etc.)

## Dedup (TTL)
To avoid repeated spam and retries from creating duplicate activities:
- the connector hashes normalized webhook event fields into a dedup key
- keys are held in an in-memory TTL store
- default TTL: `3600` seconds (`LISTMONK_WEBHOOK_DEDUP_TTL_SECONDS`)

Note:
- dedup cache is runtime-memory only (resets on connector restart)
- suitable for local MVP

## Configuring listmonk To Send Webhooks
listmonk’s webhook/event callback capabilities may vary by version/setup. If native event callbacks are unavailable for the specific event you need, use an automation bridge or local test simulation.

When configuring callbacks, point to:
- `http://host.docker.internal:4010/webhooks/listmonk` (if sender runs in a container and your Docker setup supports it)
- or `http://<your-host-ip>:4010/webhooks/listmonk`
- or `http://localhost:4010/webhooks/listmonk` (when sending from host tools)

Required header (if secret enabled):
- `X-Webhook-Token: <LISTMONK_WEBHOOK_SECRET>`

## Sample Payloads
### Open
```json
{
  "event": "email.open",
  "timestamp": "2026-02-26T10:00:00Z",
  "email": "alice@example.com",
  "campaign_id": 101,
  "campaign_name": "Welcome Series",
  "subscriber": {
    "attribs": {
      "twentyId": "person_123"
    }
  }
}
```

### Click
```json
{
  "type": "email.click",
  "timestamp": "2026-02-26T10:05:00Z",
  "email": "alice@example.com",
  "campaignId": 101,
  "url": "https://example.com/pricing",
  "subscriber": {
    "attribs": {
      "twentyId": "person_123"
    }
  }
}
```

### Bounce
```json
{
  "eventType": "email.bounce",
  "timestamp": "2026-02-26T10:08:00Z",
  "email": "bob@example.com",
  "campaign_id": 101,
  "reason": "mailbox unavailable"
}
```

### Unsubscribe
```json
{
  "event": "email.unsubscribe",
  "timestamp": "2026-02-26T10:10:00Z",
  "email": "carol@example.com",
  "campaign_id": 101
}
```

## Curl Simulation (Local)
Assuming:
- connector running at `http://localhost:4010`
- `LISTMONK_WEBHOOK_SECRET=change_me`

### Open
```bash
curl -X POST http://localhost:4010/webhooks/listmonk \
  -H 'Content-Type: application/json' \
  -H 'X-Webhook-Token: change_me' \
  -d '{
    "event":"email.open",
    "timestamp":"2026-02-26T10:00:00Z",
    "email":"alice@example.com",
    "campaign_id":101,
    "campaign_name":"Welcome Series",
    "subscriber":{"attribs":{"twentyId":"person_123"}}
  }'
```

### Click
```bash
curl -X POST http://localhost:4010/webhooks/listmonk \
  -H 'Content-Type: application/json' \
  -H 'X-Webhook-Token: change_me' \
  -d '{
    "event":"email.click",
    "timestamp":"2026-02-26T10:05:00Z",
    "email":"alice@example.com",
    "campaign_id":101,
    "url":"https://example.com/offer",
    "subscriber":{"attribs":{"twentyId":"person_123"}}
  }'
```

### Bounce
```bash
curl -X POST http://localhost:4010/webhooks/listmonk \
  -H 'Content-Type: application/json' \
  -H 'X-Webhook-Token: change_me' \
  -d '{
    "event":"email.bounce",
    "timestamp":"2026-02-26T10:08:00Z",
    "email":"bob@example.com",
    "campaign_id":101,
    "reason":"mailbox unavailable"
  }'
```

### Unsubscribe
```bash
curl -X POST http://localhost:4010/webhooks/listmonk \
  -H 'Content-Type: application/json' \
  -H 'X-Webhook-Token: change_me' \
  -d '{
    "event":"email.unsubscribe",
    "timestamp":"2026-02-26T10:10:00Z",
    "email":"carol@example.com",
    "campaign_id":101
  }'
```

## Local Verification Steps
1. Start the connector and ensure Twenty auth/writeback mode is configured (`log`, `workflow_webhook`, or `rest_note`).
2. Send a sample curl request above.
3. Check connector logs for webhook acceptance and writeback status.
4. Check `GET /events/recent` for recorded engagement events.
5. In `workflow_webhook` or `rest_note` mode, verify the activity/note appears in Twenty.
