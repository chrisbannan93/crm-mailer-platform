# Mailer Studio Nav (Twenty App)

Minimal Twenty App (official apps alpha mechanism) that adds mortgage operator navigation items in Twenty and links to the connector-hosted Mailer Studio UI.

## Navigation items created
- `Mailer Studio`
- `Mortgage Command Center`
- `Mortgage Ops Dashboard`

## Why external link?
This repo does not vendor or patch Twenty's frontend source. To keep changes minimal and isolated, the UI is hosted in the connector (`http://localhost:4010/`) and this app adds a nav entry in Twenty.

## Connector URL
Default link:
- `http://localhost:4010`

Override at build/install time (if supported in your Twenty app workflow):
- `MAILER_STUDIO_CONNECTOR_URL`

## Install (Twenty Apps alpha)
Follow the current Twenty apps documentation for local app development/install.

Typical flow (subject to Twenty version changes):
1. `cd twenty-apps/mailer-studio-nav`
2. `yarn install`
3. Use the Twenty CLI (`yarn twenty ...`) to build/install/link the app into your local Twenty workspace.

See `docs/MAILER_STUDIO.md` for end-to-end setup and demo steps.
