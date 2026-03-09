# Mortgage AU Touchpoint Rules

This file describes the runtime behavior configured in `touchpoints.json`.

## Global behavior
- `requiredConfirm=true` on all touchpoints.
- Confirm actions always create email drafts only (never auto-send).
- Dedupe key is `(touchpointKey + applicationId/contactId)`.
- Confirm is blocked during `cooldownHours` unless `override=true` is supplied.

## Queue mapping
- `new_web_leads`: `welcome_onboarding`, `retail_intake_acknowledgement`, `commercial_intake_acknowledgement`
- `awaiting_first_contact`: `fact_find_booking`
- `docs_outstanding`: `retail_documents_request`, `commercial_documents_request`
- `lender_response_pending`: `retail_submission_confirmation`, `commercial_submission_confirmation`
- `upcoming_settlements`: `post_settlement_welcome`
- `manual`: `rate_watch_nurture`, `fixed_rate_expiry`, `investor_cross_sell`, `annual_review_invite`, `referral_request`, `winback_reengagement`, `commercial_cross_sell`
- `marketing`: `mortgage_newsletter`

## Eligibility signals used
- `stages`: Loan Application pipeline stage values.
- `applicationTypes`: `retail_home_loan` or `commercial_loan`.
- `requiresMissingDocs`: any required checklist item is not received/accepted/waived.
- `settlementWithinDays`: target settlement date within N days.
- `monthsSinceSettlementMin`: months elapsed since target settlement date.
- `inactivityDaysMin`: days since application `updatedAt`.
- `tagsAny`: optional contact/application tag hints.
- `manualOnly`: hidden from automated queue actions; still available in Touchpoints panel.
- `consentRequired`: requires explicit marketing consent.

## Notes
- `fixed_rate_expiry` currently uses `targetSettlementDate` as proxy until a dedicated fixed-expiry field exists.
- `mortgage_newsletter` remains an operator flow with listmonk handoff and recency reminder.
