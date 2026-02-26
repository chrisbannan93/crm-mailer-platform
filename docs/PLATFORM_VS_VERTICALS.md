# PLATFORM VS VERTICALS

## Purpose
This document defines what belongs in the core platform versus what belongs in a vertical pack.

## Core Platform (industry-agnostic)
Keep these in the platform:
- Docker stack wiring (`stack/`)
- Connector runtime, APIs, sync orchestration, tracking endpoints
- Shared data contracts and base mapping logic
- Generic docs, operations, and scripts
- CI/testing scaffolding

Rule: Core code must not contain business-specific field names, compliance rules, or workflow assumptions.

## Vertical Packs (industry-specific)
Keep these inside `verticals/<name>/`:
- list names/tags and campaign templates
- workflow payload mappings (if specific to a business domain)
- schema extensions / field dictionaries
- compliance placeholders and future business rules
- industry-specific docs/examples

Current packs:
- `generic` (default)
- `mortgage_au` (placeholder scaffold)

## Vertical Pack Layout
Recommended structure per vertical:
- `config/` - mapping configs, env overlays, defaults
- `templates/` - email templates, snippets, campaign bodies
- `workflows/` - automation payloads / examples
- `schema/` - field dictionaries / mapping docs / SQL snippets

## How a Vertical Is Selected
Use env var:
```env
VERTICAL=generic
```
The connector loads the named vertical pack. If the pack is missing, fallback behavior should default to `generic`.

## How To Create a New Vertical
1. Copy `verticals/generic/` to `verticals/<new_vertical>/`
2. Rename identifiers, list names, and tags in the config files
3. Add templates/workflow examples specific to the business
4. Keep secrets out of the vertical folder (use `.env` files)
5. Document assumptions and compliance constraints in that vertical's README
6. Test with `VERTICAL=<new_vertical>` locally

## When To Fork Instead of Extending
Prefer extending with a new vertical pack unless one of these becomes true:
- connector logic diverges significantly (different sync lifecycle, data model, or auth flow)
- operational requirements differ (separate infra topology, storage, background jobs)
- regulatory/compliance requirements demand stricter isolation
- UI/UX becomes vertical-native rather than generic admin controls

## Fork Strategy (later)
If a fork becomes necessary:
1. Fork from a stable core tag/commit
2. Preserve platform docs and decision log
3. Keep vertical-specific changes isolated by directory and commit history as long as possible
4. Continue backporting core fixes (security, dependency, infra) from upstream core repo

## Guardrails
- Do not hardcode secrets in vertical configs.
- Do not add mortgage-specific logic to core connector files.
- Add TODOs for future rules rather than speculative implementations.
