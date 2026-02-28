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

## Current Limitation
The repo does not yet contain a verified, runnable Twenty App install flow for automatically creating the Loan Application custom object and checklist UI. The required schema is documented in `schema/` and `docs/MORTGAGE_AU_SPEC.md`.

## Files To Review First
- `config/segments.json`
- `workflows/pipelines.json`
- `workflows/stage_gates.json`
- `schema/loan_application.json`
- `templates/email/`
