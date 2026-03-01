# mortgage_au vertical

Australia mortgage broking vertical pack for retail home loans and commercial loans.

## Enable
Set the active vertical in `stack/.env`:

```env
VERTICAL=mortgage_au
```

Restart connector after changing vertical.

## What Lives Here
- `config/pack.json`: vertical identity, default list, static subscriber attribs
- `config/segments.json`: retail/commercial borrower list rules
- `workflows/pipelines.json`: retail and commercial stage sequences
- `workflows/stage_gates.json`: required-doc rules and reminder defaults
- `schema/`: Loan Application + checklist definitions for Twenty setup
- `templates/email/`: mortgage-specific listmonk templates

## MVP Behaviour
- Syncs people into the mortgage AU default list and segment lists.
- Exposes mortgage-specific email templates for rendering/sending from Mailer Studio.
- Carries `applicationId`, `applicationType`, and stage metadata through template rendering and engagement events when provided in context.
- Derives segment membership from live Loan Application state instead of contact tags.

Public/internal split:
- public mortgage website: `http://localhost:4010/`
- internal Mailer Studio: `http://localhost:4010/studio`

CRM launch helpers:
- `GET /studio/open/application/:applicationId`
- `GET /studio/open/person/:personId`
- `POST /campaigns/send-for-application`
- `GET /studio/dashboard`
- `POST /workflows/docs-chase`
- `POST /workflows/review-sweep`

Derived lifecycle cohorts now include:
- `retail_home_loans`
- `commercial_loans`
- `docs_pending`
- `submitted`
- `settled_last_90_days`
- `annual_review_due`
- `fixed_rate_expiry`

## Twenty App Automation Status
- `twenty-apps/mortgage-au/` now contains a code-managed Twenty app slice for `Loan Application` and `Application Document`.
- The package typechecks on Node 24 + Yarn 4.
- The local stack now exposes app-dev endpoints when `TWENTY_NODE_ENV=development`, but the self-hosted runtime still rejects app-managed custom-object sync because built-in system flat entities like `timelineActivity` are missing.
- Until the local Twenty runtime supports that sync path, the documented manual setup in `schema/` remains the active MVP path.

## Terminal Helper
Build Mailer Studio template context directly from a live Loan Application record:

```bash
verticals/mortgage_au/scripts/build_template_context.sh APP-001 | jq .
```

Render a template directly from a live application:

```bash
verticals/mortgage_au/scripts/render_template_for_application.sh APP-001 retail_documents_request | jq .
```

Send a template directly from a live application:

```bash
verticals/mortgage_au/scripts/send_template_for_application.sh \
  APP-001 \
  retail_documents_request \
  proof@example.com \
  <twenty-person-id> | jq .
```

Use these helpers to avoid hand-writing JSON for `/templates/email/render` or `/campaigns/send-template`.

Or use the connector endpoint directly:

```bash
curl -X POST http://localhost:4010/campaigns/send-for-application \
  -H 'Content-Type: application/json' \
  -d '{"applicationId":"APP-001"}' | jq .
```

Run the mortgage workflow helpers from the connector:

```bash
curl -X POST http://localhost:4010/workflows/docs-chase \
  -H 'Content-Type: application/json' \
  -d '{"limit":3}' | jq .

curl -X POST http://localhost:4010/workflows/review-sweep \
  -H 'Content-Type: application/json' \
  -d '{"limit":3}' | jq .

curl -X POST http://localhost:4010/workflows/docs-chase \
  -H 'Content-Type: application/json' \
  -d '{"applicationIds":["APP-001"],"dryRun":true}' | jq .
```

## Demo Workspace Seeder

Create a realistic six-month mortgage book for pitches or local demos:

```bash
node verticals/mortgage_au/scripts/seed_demo_workspace.mjs
```

This resets the current mortgage demo workspace data and recreates:
- people
- loan applications
- application documents
- tasks
- notes and timeline targets

## Files To Review First
- `config/segments.json`
- `workflows/pipelines.json`
- `workflows/stage_gates.json`
- `schema/loan_application.json`
- `templates/email/`
