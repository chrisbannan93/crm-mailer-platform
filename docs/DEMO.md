# DEMO CHECKLIST

## Goal
Demonstrate the local platform plus the Mortgage AU MVP using Twenty, listmonk, connector, Mailpit, and the mortgage vertical assets.

## Preconditions
- stack is running
- `VERTICAL=mortgage_au` in `stack/.env`
- `VERTICAL=mortgage_au` in `connector/.env` when running connector locally
- `TWENTY_WRITEBACK_MODE=rest_note` in `connector/.env`
- connector restarted after changing vertical or writeback mode
- Twenty reachable at `http://localhost:3000`
- listmonk reachable at `http://localhost:9000`
- Public website reachable at `http://localhost:4010`
- Mailer Studio reachable at `http://localhost:4010/studio`
- Mailpit reachable at `http://localhost:8025`
- Twenty auth configured in `connector/.env`
- listmonk auth configured in `connector/.env`
- listmonk SMTP configured to Mailpit (`mailpit:1025`, auth none, TLS off)

## Mortgage AU setup
### Twenty custom objects (manual for MVP)
1. Open Twenty.
2. Go to `Settings -> Data model`.
3. Create custom object `Loan Application` using `verticals/mortgage_au/schema/loan_application.json`.
4. Create custom object `Application Document` using `verticals/mortgage_au/schema/application_document.json`.
5. Create relation from `Application Document.applicationId` to `Loan Application`.
6. Create list views for:
   - Retail home loans
   - Commercial loans
   - Application documents grouped by `status`

## Click-by-click demo
### A. Verify platform health
1. Open the public website at `http://localhost:4010/`.
2. Confirm the portfolio proof section and strategy-call lead form load.
3. Open Mailer Studio at `http://localhost:4010/studio`.
4. Confirm Twenty and listmonk indicators are green.
5. Optionally confirm `make status` reports all HTTP services healthy.

### A1. Capture a public lead
1. Submit the strategy-call form on `http://localhost:4010/`.
2. In Twenty, confirm a new Person exists.
3. Open the Person record and confirm a `Website enquiry` note is attached.

### B. Create mortgage contact in Twenty
1. Open Twenty at `http://localhost:3000`.
2. Create a Person with email address, or use the seeded demo workspace.
3. Save.

### C. Create Loan Application record in Twenty
1. Open the `Loan Application` custom object.
2. Create a record with:
   - `applicationId`: `APP-001`
   - `applicationType`: `retail_home_loan` or `commercial_loan`
   - `pipelineStage`: `docs_requested`
   - `borrowerName`: matching the Person
   - `lenderTarget`: `Example Lender`
3. Save.

### D. Create checklist items in Twenty
1. Open `Application Document`.
2. Create checklist records for the application using `verticals/mortgage_au/schema/document_checklists.json`.
3. Mark a few required items as `requested`.
4. Leave at least one required item incomplete so the stage-gate story is visible.

### E. Sync to listmonk
1. In Mailer Studio click `Run Contact Sync`.
2. In Mailer Studio click `Run List Sync`.
3. Open listmonk and confirm the subscriber exists in the default mortgage list.

### F. Generate and send mortgage template draft
1. Stay in Mailer Studio.
2. In `Template Studio`, choose a mortgage template, for example `Retail documents request`.
3. Set `Recipient email` to the synced borrower email.
4. Paste context JSON similar to:
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
5. Click `Preview Template`.
6. Click `Send Template Test`.
7. Open Mailpit and verify the email arrives.

### G. Prove engagement logging
1. Open the delivered email in Mailpit.
2. Load the message body so the tracking pixel fires.
3. Return to Mailer Studio and refresh engagement events.
4. Confirm a new `engagement` event appears.
5. Open Twenty and confirm a new `Email engagement` note exists.
6. Confirm the note body includes `applicationId: APP-001`.

## Curl commands
### Health
```bash
curl http://localhost:4010/health
curl http://localhost:4010/studio/status
```

### Public lead capture
```bash
curl -X POST http://localhost:4010/public/leads \
  -H 'Content-Type: application/json' \
  -d '{
    "firstName":"Ava",
    "lastName":"Mercer",
    "email":"ava.mercer@example.com",
    "phone":"+61411000999",
    "loanType":"Retail home loan",
    "message":"Looking to buy in the next 90 days and want to understand borrowing capacity."
  }'
```

### Sync
```bash
curl -X POST http://localhost:4010/sync/contacts
curl -X POST http://localhost:4010/sync/lists
```

### List templates
```bash
curl http://localhost:4010/templates/email
```

### Render template
```bash
curl -X POST http://localhost:4010/templates/email/render \
  -H 'Content-Type: application/json' \
  -d '{
    "templateKey":"retail_documents_request",
    "context":{
      "contact":{"firstName":"Chris"},
      "broker":{"name":"Broker Name","signature":"Broker Name"},
      "application":{"applicationId":"APP-001","applicationType":"retail_home_loan","pipelineStage":"docs_requested","lenderTarget":"Example Lender"},
      "checklist":{"requiredSummary":"ID, bank statements, privacy consent"}
    }
  }'
```

### Send template test
```bash
curl -X POST http://localhost:4010/campaigns/send-template \
  -H 'Content-Type: application/json' \
  -d '{
    "templateKey":"retail_documents_request",
    "to":"proof@example.com",
    "personId":"<twenty-person-id>",
    "context":{
      "contact":{"firstName":"Chris"},
      "broker":{"name":"Broker Name","signature":"Broker Name"},
      "application":{"applicationId":"APP-001","applicationType":"retail_home_loan","pipelineStage":"docs_requested","lenderTarget":"Example Lender"},
      "checklist":{"requiredSummary":"ID, bank statements, privacy consent"}
    }
  }'
```

### Application-aware template shortcuts
```bash
verticals/mortgage_au/scripts/render_template_for_application.sh APP-001 retail_documents_request | jq .

verticals/mortgage_au/scripts/send_template_for_application.sh \
  APP-001 \
  retail_documents_request \
  proof@example.com \
  <twenty-person-id> | jq .
```

### Seed a realistic mortgage workspace
```bash
node verticals/mortgage_au/scripts/seed_demo_workspace.mjs
```

### Recent events
```bash
curl 'http://localhost:4010/events/recent?limit=20'
```

### CRM-visible note proof
```bash
TOKEN=$(awk -F= '/^TWENTY_API_KEY=/{print substr($0,index($0,"=")+1)}' connector/.env)
curl -sS -H "Authorization: Bearer $TOKEN" -H 'Accept: application/json' http://localhost:3000/rest/notes | jq .
curl -sS -H "Authorization: Bearer $TOKEN" -H 'Accept: application/json' http://localhost:3000/rest/noteTargets | jq .
```

## Talking points
- Mortgage-specific assets remain isolated under `verticals/mortgage_au/`.
- The connector core only gained a generic template loader/render/send path that future verticals can reuse.
- The current MVP still relies on manual Twenty custom-object setup because the self-hosted Twenty runtime rejects built-in system flat entities needed for app-managed custom-object sync.
- The stable local CRM writeback path for MVP is `rest_note`; `workflow_webhook` remains available but depends on correct workflow configuration inside Twenty.
