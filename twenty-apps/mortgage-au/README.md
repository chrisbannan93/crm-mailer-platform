# Mortgage AU (Twenty App)

Twenty app package for managing the Australia mortgage vertical as code.

Scope for the first slice:
- `Loan Application` custom object
- `Application Document` custom object
- default list views for both objects
- no Twenty front components yet

## Toolchain
- Node `24.14.0` (see `.nvmrc`)
- Yarn `4.9.2`

## Local workflow
1. `source ~/.nvm/nvm.sh && nvm use`
2. `yarn install`
3. `yarn twenty auth:status`
4. `yarn twenty app:typecheck .`
5. `yarn twenty app:dev .`

## Notes
- This package is mortgage-specific and intentionally separate from `mailer-studio-nav`.
- The existing connector and Mailer Studio remain separate; this package only handles Twenty-side object automation.
- On the local self-hosted Twenty stack, `yarn twenty app:dev .` currently reaches manifest sync and then fails because the runtime cannot resolve built-in system flat entities such as `timelineActivity` for custom-object sync.
- Until that runtime gap is removed, the manual Twenty setup in `verticals/mortgage_au/schema/` remains the active MVP path.
