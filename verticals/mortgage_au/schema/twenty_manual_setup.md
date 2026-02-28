# Twenty Manual Setup For Mortgage AU MVP

This repo does not yet automate Twenty custom-object installation. Use these manual steps to get a working Loan Application MVP in a local Twenty workspace.

## 1. Create Loan Application object
1. Open Twenty.
2. Go to `Settings -> Data model`.
3. Create a custom object named `Loan Application`.
4. Add fields from `loan_application.json`.
5. Create views filtered by `applicationType`:
   - Retail home loans
   - Commercial loans
6. Create the first example record using `sample_records/retail_application_example.json` or `sample_records/commercial_application_example.json`.

## 2. Create Application Document object
1. In the same area create a custom object named `Application Document`.
2. Add fields from `application_document.json`.
3. Add a relation back to `Loan Application`.
4. Create a grouped view by `status` for checklist management.
5. Seed checklist rows from:
   - `sample_records/retail_checklist_seed.json`
   - `sample_records/commercial_checklist_seed.json`

## 3. Stage management
- Use `pipelineStage` as the primary stage field.
- Reference `workflows/pipelines.json` for allowed stage values.
- Reference `workflows/stage_gates.json` for submission requirements and auto-task expectations.
- Before moving a record to `submitted`, confirm all `requiredDocuments` are `received` or `accepted`.

## 4. Tasks / reminders
- Use the native Twenty Task object.
- Prefix tasks with the application id, for example `APP-001 Chase missing retail documents`.
- Assign owner and due date based on `workflows/task_defaults.json`.
- Recommended MVP task fields:
  - title
  - assignee
  - due date
  - priority
  - description linking back to the application id and missing checklist items

## 5. Tags for segment sync
Add one or more of these tags on the related Person record so the connector can drive list sync:
- `mortgage-retail`
- `mortgage-commercial`
- `mortgage-docs-pending`
- `mortgage-submitted`

## 6. Mailer Studio usage
Use the active mortgage template set in Mailer Studio. Paste a JSON context matching the selected application to preview or send a template test.

Recommended retail context:
```json
{
  "contact": { "firstName": "Chris" },
  "broker": { "name": "Broker Name", "signature": "Broker Name" },
  "application": {
    "applicationId": "APP-001",
    "applicationType": "retail_home_loan",
    "pipelineStage": "docs_requested",
    "lenderTarget": "Example Lender"
  },
  "checklist": { "requiredSummary": "ID, bank statements, privacy consent" }
}
```

## 7. CRM-visible engagement proof
- Set `TWENTY_WRITEBACK_MODE=workflow_webhook` in `connector/.env`.
- Configure a Twenty workflow webhook target that creates a note/log/task on the related Person or Loan Application.
- Open the delivered email in Mailpit to trigger the tracking pixel.
- Confirm the event appears in Mailer Studio and the workflow target creates the CRM-visible record.
