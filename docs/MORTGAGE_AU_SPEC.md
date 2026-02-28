# MORTGAGE_AU_SPEC

## Goal
Ship a fork-ready Australia mortgage broking MVP on top of the existing platform without hardcoding mortgage rules into the connector core.

## Personas
- Broker: owns application intake, borrower follow-up, lender submission, and status communication.
- Admin / Processor: collects documents, updates checklist items, validates completeness, chases missing items, and prepares submission packs.

## Product Scope
The vertical covers two loan journeys:
- Retail home loans
- Commercial loans

The MVP adds:
- a Loan Application data model for Twenty
- stage definitions and stage-gate rules
- document checklist definitions per application type
- reminder/task defaults for brokers and admins
- mortgage-specific email templates for intake, document chase, submission, approval, and settlement prep
- template-to-stage mappings so Mailer Studio can generate or send drafts using the active vertical

## Data Model
### Contact / Person
Existing Twenty Person records remain the source contact record for borrower/prospect identity.

Recommended tags for segment sync:
- `mortgage-retail`
- `mortgage-commercial`
- `mortgage-refinance`
- `mortgage-first-home`
- `mortgage-docs-pending`
- `mortgage-submitted`
- `mortgage-approved`

### Loan Application
One application per borrower / borrowing entity per opportunity.

Core fields:
- `applicationId`: readable application reference
- `applicationType`: `retail_home_loan` | `commercial_loan`
- `status`: open lifecycle status
- `pipelineStage`: stage key from retail or commercial pipeline
- `borrowerName`
- `contactPersonId`
- `brokerOwner`
- `loanPurpose`: purchase | refinance | equity_release | construction | working_capital | investment
- `loanAmount`
- `estimatedPropertyValue`
- `lvrBand`
- `targetSettlementDate`
- `lenderTarget`
- `notesSummary`

Retail-only fields:
- `occupancyType`: owner_occupied | investment
- `firstHomeBuyer`: yes | no
- `propertyUsage`
- `livingExpensesBand`
- `existingMortgageBalance`

Commercial-only fields:
- `entityName`
- `entityType`
- `abn`
- `gstRegistered`
- `securityType`
- `annualTurnoverBand`
- `netProfitBand`
- `commercialUseType`

### Application Document
Checklist item records linked to a Loan Application.

Fields:
- `applicationId`
- `documentKey`
- `documentLabel`
- `required`
- `status`: missing | requested | received | accepted | waived
- `notes`
- `receivedAt`
- `validatedAt`
- `ownerRole`: broker | admin

### Broker Task / Reminder
Task records can stay in Twenty Tasks for MVP.

Suggested fields / conventions:
- title includes application id and action
- due date
- owner
- linked person/application reference in note or metadata
- priority

## Pipelines
### Retail pipeline
1. lead_captured
2. discovery_booked
3. fact_find_complete
4. docs_requested
5. docs_complete
6. servicing_assessed
7. submitted
8. conditional_approval
9. formal_approval
10. settled
11. closed_lost

### Commercial pipeline
1. lead_captured
2. discovery_booked
3. deal_structuring
4. docs_requested
5. docs_complete
6. credit_paper_ready
7. submitted
8. indicative_offer
9. conditional_approval
10. formal_approval
11. settled
12. closed_lost

## Stage Gates
Retail `submitted` requires:
- id
- payslips_or_income_proof
- bank_statements
- living_expenses
- privacy_consent

Commercial `submitted` requires:
- id
- entity_financials
- bank_statements
- abn_gst_evidence
- security_details
- privacy_consent

If gate requirements are not met:
- warn in Mailer Studio
- auto-create a broker/admin follow-up task
- do not mark checklist as complete automatically

## Document Checklist Definition
### Retail default checklist
- id
- payslips_or_income_proof
- employment_letter_optional
- bank_statements
- living_expenses
- existing_loan_statements
- contract_of_sale_optional
- privacy_consent

### Commercial default checklist
- id
- entity_financials
- bank_statements
- abn_gst_evidence
- trust_deed_optional
- lease_or_security_docs
- asset_liability_statement
- privacy_consent

## Communication Templates and Triggers
Retail sequence:
- `retail_intake_acknowledgement`: after application created
- `retail_documents_request`: when stage moves to `docs_requested`
- `retail_submission_confirmation`: when stage moves to `submitted`
- `retail_approval_update`: when stage moves to `conditional_approval` or `formal_approval`

Commercial sequence:
- `commercial_intake_acknowledgement`
- `commercial_documents_request`
- `commercial_credit_paper_ready`
- `commercial_submission_confirmation`
- `commercial_approval_update`

Each template should support merge values from:
- contact
- broker
- application
- checklist summary

## Mailer Studio MVP Behaviour
- list available templates for the active vertical
- render a draft from a chosen template + application context JSON
- send a listmonk test send to a nominated recipient
- track open/click events and record them back as engagement events

## What Is MVP vs Later
### MVP
- config-driven retail/commercial segments
- documented Loan Application schema for Twenty custom object setup
- checklist definitions and stage-gate config in vertical files
- listmonk templates for retail/commercial emails
- Mailer Studio template render/send using vertical assets
- engagement metadata can include `applicationId`

### Later
- automated Twenty custom object installation through Twenty Apps SDK
- embedded checklist UI inside Twenty record page
- richer task automation inside Twenty
- lender-specific product matching
- compliance engine / NCCP disclosure workflows
- borrower portal / upload flow
