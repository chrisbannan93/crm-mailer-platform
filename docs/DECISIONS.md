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
