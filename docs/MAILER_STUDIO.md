# MAILER STUDIO

## Summary
Mailer Studio is a minimal operator UI for this platform. It is hosted by the connector service and linked from Twenty using a small Twenty App nav item.

What you get:
- `Mailer Studio` nav item in Twenty (official Twenty apps alpha extension path)
- connector-hosted UI with:
  - connection status (Twenty + listmonk)
  - last contact sync time
  - last list sync time
  - buttons to run contact sync / list sync
  - link to open listmonk UI
  - recent engagement events feed

## Architecture Choice (Minimal / Isolated)
This repo does **not** vendor or patch Twenty frontend source. To keep diffs small and upgrades simple:
- Twenty UI change is isolated to `twenty-apps/mailer-studio-nav/` (nav item only)
- Mailer Studio page is hosted in connector at `http://localhost:4010/`

This uses Twenty's official apps mechanism (alpha) for nav integration while avoiding direct edits to the Twenty codebase.

## Files
- Connector UI: `connector/src/ui.ts`
- Connector status endpoint: `GET /studio/status`
- Twenty App nav scaffold: `twenty-apps/mailer-studio-nav/`

## Using Mailer Studio
### Prerequisites
- Stack is running (`Twenty`, `listmonk`, `connector`)
- Connector reachable at `http://localhost:4010`

### Direct access (without Twenty nav app)
Open:
- `http://localhost:4010/`

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

### Recent engagement events
The UI reads:
- `GET /events/recent?kind=engagement&limit=20`

## Screenshot Instructions (manual)
This environment does not auto-capture screenshots in docs. To capture screenshots for demos:

1. Start the stack and connector.
2. Open `http://localhost:4010/` (or open via Twenty nav item).
3. Ensure connection status is green for Twenty and listmonk.
4. Run `Run Contact Sync` and `Run List Sync`.
5. Trigger or simulate an engagement event (see `docs/WEBHOOKS.md`).
6. Capture screenshots:
   - Mailer Studio home view (status + buttons)
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
