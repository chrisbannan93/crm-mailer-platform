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
