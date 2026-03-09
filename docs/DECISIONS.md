# DECISIONS

## Decision Log

### 2026-02-26 - Use Twenty + listmonk + custom connector
- Status: Accepted
- Why: Free/open-source local-first stack with clear separation between CRM and mailer.

### 2026-02-26 - Keep core platform industry-agnostic; add vertical packs
- Status: Accepted
- Why: Reduces fork pressure and keeps business-specific logic isolated.

### 2026-02-26 - Default vertical is `generic`
- Status: Accepted
- Why: Safe base behavior for new installs and local testing.

### 2026-02-26 - Start with Docker Compose local stack on Linux Mint
- Status: Accepted
- Why: Fastest path to a reproducible local proof without paid dependencies.

### 2026-02-26 - Phase 1 uses minimal connector sidecar UI instead of deep Twenty UI fork
- Status: Accepted
- Why: Simpler to ship and maintain while proving sync + campaign + writeback flow.

### 2026-02-26 - Secrets only in `.env` files
- Status: Accepted
- Why: Avoid hardcoding secrets and keep repo safe to share.

## Template For Future Decisions
```md
### YYYY-MM-DD - <decision title>
- Status: Proposed | Accepted | Superseded
- Why: <reason>
- Impact: <what changes>
- Supersedes: <optional>
```

### 2026-02-28 - Add generic vertical email-template loading and Mailer Studio template actions
- Status: Accepted
- Why: Future verticals need a shared way to render and send vertical-owned listmonk templates without embedding business logic in connector core.
- Alternatives: Keep templates as docs-only assets, or hardcode mortgage templates into the connector UI.
- Impact: Core connector now loads `verticals/<VERTICAL>/templates/email/*.json`, renders them with merge context, and exposes generic preview/send endpoints used by Mailer Studio.

### 2026-02-28 - Use manual Twenty custom-object setup for Mortgage AU MVP
- Status: Accepted
- Why: The current repo has a working connector/template path but not a verified Twenty Apps custom-object install flow for local automation.
- Alternatives: Block the MVP on Twenty Apps alpha tooling, or move mortgage applications out of Twenty and into the connector UI.
- Impact: Loan Application and Application Document records are documented as manual Twenty setup for v0.2, while mortgage logic and assets remain isolated in the vertical folder.

### 2026-02-28 - Make `rest_note` writeback create valid Twenty notes plus note targets
- Status: Accepted
- Why: Twenty's Notes API accepts `bodyV2`, not legacy `body` or `content`, and CRM-visible engagement logs need to appear on the linked Person timeline without depending on a manually configured workflow.
- Alternatives: Keep workflow-webhook-only writeback, or write connector-only events without creating CRM artifacts.
- Impact: Generic `rest_note` mode now creates a valid Note payload and links it to the Person via `NoteTarget`, which benefits every future vertical.

### 2026-02-28 - Add optional `TWENTY_NODE_ENV` to the local stack
- Status: Accepted
- Why: Twenty Apps install/sync endpoints are gated behind `NODE_ENV=development|test`, and local platform work should be able to enable that mode without patching the repo each time.
- Alternatives: Maintain a separate contributor checkout of Twenty, or keep manual custom-object setup as the only supported local path.
- Impact: The Dockerized local stack still defaults to production behavior, but developers can opt into Twenty app-development endpoints by setting `TWENTY_NODE_ENV=development` in local stack env.

### 2026-03-01 - Split the connector surface into a public website and internal Mailer Studio
- Status: Accepted
- Why: The public-facing site and the operator tool serve different users, and mixing them on the same landing page makes both weaker.
- Alternatives: Keep the connector root as the operator UI, or build a separate public site app with duplicated deployment/runtime concerns.
- Impact: `GET /` now serves vertical-owned public-site content when available, while `GET /studio` remains the business-member workflow UI linked from Twenty.

### 2026-03-01 - Add generic public lead capture into Twenty
- Status: Accepted
- Why: A public site should create real CRM leads instead of acting as brochureware, and that behavior is useful for every future vertical.
- Alternatives: Route public enquiries to email only, or hardcode mortgage-specific lead handling outside the connector.
- Impact: The connector now exposes `POST /public/leads`, which creates a Twenty Person and attaches a CRM note describing the enquiry.

### 2026-03-01 - Add generic CRM-to-Mailer Studio context launch endpoints
- Status: Accepted
- Why: Operators should be able to jump from CRM records into a prefilled mailer workflow without hand-copying IDs or rebuilding JSON context.
- Alternatives: Keep Mailer Studio as a manual JSON tool, or implement a mortgage-only shortcut outside the connector.
- Impact: The connector now exposes generic context lookup, deep-link, and recommended-send endpoints that any future vertical can reuse once it can map CRM records into template context.

### 2026-03-01 - Upsert each subscriber once before segment-list reconciliation
- Status: Accepted
- Why: Repeated per-segment subscriber upserts were resetting list memberships in listmonk, leaving contacts subscribed only to the last processed segment.
- Alternatives: Accept last-segment-only behavior, or duplicate vertical-specific listmonk logic outside the generic sync path.
- Impact: The generic list sync now upserts each subscriber once, then adds all desired segment lists and reconciles removals separately, preserving multi-segment memberships for every vertical.

### 2026-03-01 - Add generic Studio dashboard and workflow endpoints
- Status: Accepted
- Why: Operators need a live portfolio view and stage-aware actions without leaving the connector UI or hand-querying Twenty.
- Alternatives: Keep Mailer Studio as a thin send-only tool, or build mortgage-only workflow logic outside the connector.
- Impact: The connector now exposes a generic dashboard shape plus workflow action endpoints; the mortgage vertical supplies the application-derived context that powers `docs chase` and `review sweep`.

### 2026-03-01 - Derive mortgage lifecycle cohorts from application state
- Status: Accepted
- Why: Mortgage audience lists should follow the actual application book, not hand-maintained contact tags.
- Alternatives: Maintain tags manually in Twenty, or keep only coarse retail/commercial segment lists.
- Impact: The mortgage vertical now derives additional segment keys such as `settled_last_90_days`, `annual_review_due`, and `fixed_rate_expiry` from live Loan Application state and checklist status.

### 2026-03-09 - Add generic connector hooks for vertical touchpoint orchestration (mortgage-first)
- Status: Accepted
- Why: The mortgage demo needed a configurable touchpoint registry, command-center queueing, and confirm-time draft/audit behavior without hardcoding business rules in connector core.
- Alternatives: Keep all touchpoint orchestration inside a mortgage-only script, or duplicate queue logic in the UI.
- Impact: Connector now exposes reusable touchpoint/command-center endpoint patterns while keeping mortgage rules/config under `verticals/mortgage_au/config/*`; this unblocks future verticals from reusing the same API surface by supplying their own rules.

### 2026-03-09 - Add mortgage ops dashboard + workflow runners in connector API
- Status: Accepted
- Why: Operators need a single action-oriented surface for SLA breaches and low-hanging follow-up workflows, and this requires server-side queue compilation plus guarded workflow execution.
- Alternatives: Keep workflow logic entirely client-side, or trigger manual touchpoints record-by-record only.
- Impact: Added `GET /mortgage-au/ops-dashboard` and new mortgage workflow endpoints for first-contact SLA, submission stale follow-up, post-settlement nurture, consent-gap tasks, and newsletter cadence guardrail; all actions still default to draft/task with confirm gates and audit logging.
