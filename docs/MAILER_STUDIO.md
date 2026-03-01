# MAILER STUDIO

## Summary
Mailer Studio is the internal operator UI for this platform. It is hosted by the connector service at `/studio` and linked from Twenty using a small Twenty App nav item.

What you get:
- `Mailer Studio` nav item in Twenty (official Twenty apps alpha extension path)
- connector-hosted UI with:
  - live mortgage portfolio dashboard
  - connection status (Twenty + listmonk)
  - last contact sync time
  - last list sync time
  - buttons to run contact sync / list sync
  - template preview/send for active vertical email templates
  - CRM quick-load by Loan Application ID or Person ID
  - recommended-template send for a live application
  - stage-aware workflow actions (`docs chase`, `review sweep`)
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

### Portfolio dashboard
- `GET /studio/dashboard` returns:
  - portfolio metrics
  - pipeline-stage distribution
  - attention queue
  - workflow candidate queues
- the dashboard is mortgage-aware when `VERTICAL=mortgage_au`
- queue items can:
  - load live application context into Template Studio
  - open a prefilled `/studio/open/application/:applicationId` route

### Template Studio
- `GET /templates/email` lists template metadata for the active vertical
- `POST /templates/email/render` renders a chosen template using supplied JSON context
- `POST /campaigns/send-template` creates a listmonk test draft/send using the rendered template
- The mortgage vertical currently ships these templates (plus `mortgage_newsletter` for periodic briefings): `welcome_onboarding`, `fact_find_booking`, `retail_documents_request`, `retail_intake_acknowledgement`, `retail_submission_confirmation`, `commercial_*` variations, `post_settlement_welcome`, `rate_watch_nurture`, `fixed_rate_expiry`, `investor_cross_sell`, `annual_review_invite`, `referral_request`, `winback_reengagement`.
- `GET /studio/context/application/:applicationId` fetches live CRM context for a Loan Application
- `GET /studio/context/person/:personId` fetches live CRM context for a Person
- `GET /studio/open/application/:applicationId` deep-links from CRM into a prefilled Mailer Studio session
- `GET /studio/open/person/:personId` deep-links from CRM into a prefilled Mailer Studio session
- `POST /campaigns/send-for-application` chooses a recommended template and sends from live application context
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

### CRM Quick Load
- Enter a `Loan Application ID` and click `Load Application` to pull live borrower, broker, stage, and checklist data into the compose form.
- Enter a `Person ID` and click `Load Person` to pull the best available application context for that contact.
- Click `Send Recommended` to use the current application stage to choose a suitable template automatically.

Recommended mappings in the current mortgage MVP:
- `docs_requested` -> `retail_documents_request` or `commercial_documents_request`
- `lead_captured` / `discovery_booked` -> intake acknowledgement
- `conditional_approval` / `formal_approval` -> submission confirmation
- `settled` -> post-settlement welcome

### Workflow actions
- `POST /workflows/docs-chase`
  - selects applications with required documents still pending
  - sends documents-request emails
  - creates follow-up tasks in Twenty when no matching open task exists
- `POST /workflows/review-sweep`
  - selects settled applications old enough for a review touchpoint
  - sends `annual_review_invite` for retail files
  - sends `commercial_cross_sell` for commercial files
  - creates review tasks in Twenty
- both workflow actions now support:
  - `dryRun: true` to preview actions without sending email or creating tasks
  - `applicationIds: [...]` to run against selected applications instead of the top queue

Current limitation:
- deep-link routes are in place, but true record-page action buttons inside Twenty still depend on broader Twenty app/runtime support than this self-hosted stack currently exposes

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
