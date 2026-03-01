# MAILER STUDIO

## Summary
Mailer Studio is the internal operator UI for this platform. It is hosted by the connector service at `/studio` and linked from Twenty using a small Twenty App nav item.

What you get:
- `Mailer Studio` nav item in Twenty (official Twenty apps alpha extension path)
- connector-hosted UI with:
  - connection status (Twenty + listmonk)
  - last contact sync time
  - last list sync time
  - buttons to run contact sync / list sync
  - template preview/send for active vertical email templates
  - link to open listmonk UI
  - recent engagement events feed
  - URL-prefilled mortgage context from CRM links

The public lead-generation website is served separately from the same connector at `http://localhost:4010/`.

## Architecture Choice (Minimal / Isolated)
This repo does **not** vendor or patch Twenty frontend source. To keep diffs small and upgrades simple:
- Twenty UI change is isolated to `twenty-apps/mailer-studio-nav/` (nav item only)
- Public website is hosted in connector at `http://localhost:4010/`
- Mailer Studio is hosted in connector at `http://localhost:4010/studio`

This uses Twenty's official apps mechanism (alpha) for nav integration while avoiding direct edits to the Twenty codebase.

## Files
- Connector UI: `connector/src/ui.ts`
- Connector status endpoint: `GET /studio/status`
- Twenty App nav scaffold: `twenty-apps/mailer-studio-nav/`

## Using Mailer Studio
### Prerequisites
- Stack is running (`Twenty`, `listmonk`, `connector`)
- Connector reachable at `http://localhost:4010/studio`

### Direct access (without Twenty nav app)
Open:
- `http://localhost:4010/studio`

### Via Twenty nav item (preferred)
Install the nav app from `twenty-apps/mailer-studio-nav/` using the current Twenty Apps alpha workflow for your installed Twenty version.

After installation, click the `Mailer Studio` item in the Twenty navigation.

## What the UI does
### Connection status
The UI calls `GET /studio/status` and shows:
- Twenty reachability (best effort check via Twenty API)
- listmonk reachability (listmonk API health/list request)

### Sync buttons
- `Run Contact Sync` -> `POST /sync/contacts`
- `Run List Sync` -> `POST /sync/lists`

### Template Studio
- `GET /templates/email` lists template metadata for the active vertical
- `POST /templates/email/render` renders a chosen template using supplied JSON context
- `POST /campaigns/send-template` creates a listmonk test draft/send using the rendered template
- when `application.applicationId` is present in the context, tracking URLs carry it through as engagement metadata
- query params can prefill the operator UI:
  - `personId`
  - `email`
  - `template`
  - `applicationId`
  - `firstName`
  - `brokerName`
  - `lenderTarget`
  - `pipelineStage`
  - `applicationType`
  - `requiredSummary`

### Public lead capture
- `POST /public/leads` creates a Twenty Person plus a CRM note from the public website enquiry form
- this is generic platform behavior and intentionally reusable for future verticals

### Recent engagement events
The UI reads:
- `GET /events/recent?kind=engagement&limit=20`

## Screenshot Instructions (manual)
This environment does not auto-capture screenshots in docs. To capture screenshots for demos:

1. Start the stack and connector.
2. Open `http://localhost:4010/studio` (or open via Twenty nav item).
3. Ensure connection status is green for Twenty and listmonk.
4. Run `Run Contact Sync` and `Run List Sync`.
5. Use Template Studio to preview or send a vertical-owned email template.
6. Trigger or simulate an engagement event (see `docs/WEBHOOKS.md`).
7. Capture screenshots:
   - Mailer Studio home view (status + buttons)
   - Template Studio with a rendered mortgage template
   - Recent engagement events populated
   - listmonk UI list page (optional)
   - Twenty page showing navigation item (if nav app installed)

Suggested screenshot filenames:
- `docs/screenshots/mailer-studio-home.png`
- `docs/screenshots/mailer-studio-engagement-events.png`
- `docs/screenshots/twenty-mailer-studio-nav.png`

## Notes / Limitations
- Twenty Apps is currently alpha and CLI/install flows may vary by version.
- The nav item links to an external page (connector UI) instead of embedding a custom page inside Twenty. This is intentional for MVP simplicity and upgrade safety.
- If later needed, a richer in-Twenty front component can be added in `twenty-apps/` without changing connector APIs.
