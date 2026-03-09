# WEB_LEADS

## Endpoint
`POST /public/leads`

## Payload
```json
{
  "firstName": "Ava",
  "lastName": "Mercer",
  "email": "ava@example.com",
  "phone": "+61411000999",
  "loanType": "Retail home loan",
  "message": "Looking to buy in 90 days",
  "consentMarketing": true,
  "consentTimestamp": "2026-03-09T01:10:00.000Z",
  "consentCopyVersion": "privacy_v1",
  "utm_source": "google",
  "utm_medium": "cpc",
  "utm_campaign": "march-intake",
  "utm_term": "mortgage broker",
  "utm_content": "hero-form",
  "referrer": "https://example.com",
  "landing_path": "/",
  "session_id": "sess_123"
}
```

## Stored mapping (mortgage_au)
- Person upsert by email in Twenty.
- Loan Application create in stage `lead_captured` (`New Lead`) with type derived from `loanType`:
- `Retail*` -> `retail_home_loan`
- `Commercial*` -> `commercial_loan`
- Task create: `Initial contact - website enquiry` due in 24h (best effort).
- Intake note attached with consent + attribution payload.
- Touchpoint draft created: `welcome_onboarding` (draft only, never auto-send).

## Activity events logged
- `WEBSITE_LEAD_RECEIVED`
- `TASK_CREATED` (if task creation succeeds)
- `TOUCHPOINT_DRAFT_CREATED` (welcome onboarding)

## Response shape
```json
{
  "ok": true,
  "data": {
    "personId": "person_x",
    "applicationId": "loan_app_x",
    "taskId": "task_x",
    "noteId": "note_x",
    "draftedTouchpoints": ["welcome_onboarding"]
  }
}
```

## Notes
- Default behavior is draft+confirm only.
- No secrets are accepted in payload.
- Missing consent defaults to `false` with server timestamp and `privacy_v1` copy version.
