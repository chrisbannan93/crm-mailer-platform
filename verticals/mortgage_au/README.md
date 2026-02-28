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

## Twenty App Automation Status
- `twenty-apps/mortgage-au/` now contains a code-managed Twenty app slice for `Loan Application` and `Application Document`.
- The package typechecks on Node 24 + Yarn 4.
- Local install is currently blocked by the running Twenty server rejecting app creation with `This endpoint is only available in development or test environments`.
- Until the local Twenty server is started with app-dev support, the documented manual setup in `schema/` remains the active MVP path.

## Terminal Helper
Build Mailer Studio template context directly from a live Loan Application record:

```bash
verticals/mortgage_au/scripts/build_template_context.sh APP-001 | jq .
```

Use the output as the JSON body for `/templates/email/render` or `/campaigns/send-template`.

## Files To Review First
- `config/segments.json`
- `workflows/pipelines.json`
- `workflows/stage_gates.json`
- `schema/loan_application.json`
- `templates/email/`
