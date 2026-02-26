# TWENTY_API_NOTES

## API approach used in this project

This connector uses Twenty's **official Core REST API** on self-hosted instances:
- Base path: `/rest`
- Contacts/people path (common generated endpoint): `/rest/people`

Why REST for now:
- simplest official method for a connector wrapper
- easy Bearer token auth
- easier incremental rollout for polling/sync than generated GraphQL schemas

## Important limitation (Twenty APIs are generated per workspace)

Twenty generates APIs from your workspace data model. That means:
- endpoint shapes and filters can vary by workspace/version
- list pagination field names may differ (`nextCursor`, `next_cursor`, etc.)
- server-side filtering (including updated-since filters) may differ

### Safe fallback implemented
If a server-side filter/query shape is unavailable or inconsistent, the connector uses a **safe client-side fallback**:
- fetch contacts page(s) from `/rest/people`
- filter locally by email or `updatedAt`

No direct DB reads/writes are used for this fallback.

## Authentication

Use an API key with Bearer auth:

```http
Authorization: Bearer <TOKEN>
```

### Env vars supported by connector
Preferred names:
- `TWENTY_BASE_URL`
- `TWENTY_AUTH_MODE` (`bearer`)
- `TWENTY_AUTH_TOKEN`

Legacy alias (still supported):
- `TWENTY_API_KEY`

## How to get a token (API key) in Twenty

In Twenty UI:
1. Go to **Settings -> APIs & Webhooks**
2. Click **+ Create key**
3. Give it a name (and expiration if desired)
4. Save
5. Copy the key immediately (shown once)

Optional but recommended:
- Assign the API key a role with the minimum permissions needed.

## Self-hosted base URL examples

Local stack:
- External (from your browser/host): `http://localhost:3000`
- Internal (from connector container): `http://twenty-server:3000`

## Methods implemented in connector wrapper

`connector/src/clients/twentyClient.ts`
- `listContacts(updatedSince, pageCursor)`
- `getContactByEmail(email)`
- `fetchPersonById(id)`
- `writeEngagement(event)` (existing, modes vary)

## Notes on engagement writeback (later)

Direct writeback through Twenty REST may require workspace-specific payload tuning (because record schemas vary).

Safer option already supported by connector:
- `TWENTY_WRITEBACK_MODE=workflow_webhook`
- Use a Twenty Workflow Webhook Trigger and let Twenty-side workflow logic create notes/events.

## Troubleshooting

### 401 / 403 from Twenty API
- Confirm `TWENTY_AUTH_TOKEN` (or `TWENTY_API_KEY`) is set
- Confirm the key has permissions for People read access
- Confirm `TWENTY_BASE_URL` points to the correct self-hosted instance

### Contacts list endpoint shape differs
If `/rest/people` returns a different shape than expected, update the response parsing in:
- `connector/src/clients/twentyClient.ts`

The current implementation already tolerates several common response shapes and falls back to local filtering.
