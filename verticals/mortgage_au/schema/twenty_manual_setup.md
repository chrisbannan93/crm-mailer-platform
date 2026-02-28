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

## 2. Create Application Document object
1. In the same area create a custom object named `Application Document`.
2. Add fields from `application_document.json`.
3. Add a relation back to `Loan Application`.
4. Create a grouped view by `status` for checklist management.

## 3. Stage management
- Use `pipelineStage` as the primary stage field.
- Reference `workflows/pipelines.json` for allowed stage values.
- Reference `workflows/stage_gates.json` for submission requirements and auto-task expectations.

## 4. Tasks / reminders
- Use the native Twenty Task object.
- Prefix tasks with the application id, for example `APP-001 Chase missing retail documents`.
- Assign owner and due date based on the relevant stage gate config.

## 5. Tags for segment sync
Add one or more of these tags on the related Person record so the connector can drive list sync:
- `mortgage-retail`
- `mortgage-commercial`
- `mortgage-docs-pending`
- `mortgage-submitted`

## 6. Mailer Studio usage
Use the active mortgage template set in Mailer Studio. Paste a JSON context matching the selected application to preview or send a template test.
