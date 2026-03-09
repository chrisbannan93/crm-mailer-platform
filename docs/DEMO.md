# DEMO CHECKLIST

## 2-Minute Script (v0.3)
1. Open `http://localhost:4010/studio` (VERTICAL=`mortgage_au`) and show:
- `Mortgage Command Center` queues.
- each row has `Recommended: <touchpoint>`.
2. Open `http://localhost:4010/`, submit the lead form, then return to studio log and show:
- `WEBSITE_LEAD_RECEIVED`
- `TASK_CREATED`
- `TOUCHPOINT_DRAFT_CREATED welcome_onboarding`.
3. In `Mortgage Command Center`, open a `Docs Outstanding` row:
- click `Preview` for `retail_documents_request` or `commercial_documents_request`.
- confirm missing docs are in preview payload.
- click `Confirm Draft`.
4. Open `Touchpoints` panel:
- show lifecycle-grouped keys with `eligibleCount` and `Last confirmed`.
- set `Application ID` and run `Preview` / `Confirm Draft`.
- confirm cooldown by running the same confirm twice (blocked unless override API flag used).
5. Show newsletter helper tile:
- use `Open listmonk` to create weekly `mortgage_newsletter` campaign draft.
- reminder warns when last newsletter draft is older than 7 days.

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
5. Confirm the dashboard shows:
   - `27` loan applications
   - `18` active files
   - `9` settled
   - populated attention/workflow queues
6. Optionally confirm `make status` reports all HTTP services healthy.

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
3. Open listmonk and confirm the subscriber exists in:
   - `CRM Contacts`
   - the correct mortgage application-type segment list
   - any stage-derived lists such as `Docs Pending`

### F. Launch Mailer Studio from CRM context
1. From a browser or CRM nav action, open:
   - `/studio/open/application/APP-001`
2. Confirm Mailer Studio opens with:
   - recipient email prefilled
   - context JSON prefilled
   - the recommended template selected

### G. Generate and send mortgage template draft
1. Stay in Mailer Studio.
2. Use `Loan Application ID = APP-001` in the `CRM Quick Load` panel and click `Load Application`.
3. Confirm the compose form is prefilled from Twenty.
4. Click `Preview Template`.
5. Click `Send Recommended`.
6. Open Mailpit and verify the email arrives.

### H. Prove engagement logging
1. Open the delivered email in Mailpit.
2. Load the message body so the tracking pixel fires.
3. Return to Mailer Studio and refresh engagement events.
4. Confirm a new `engagement` event appears.
5. Open Twenty and confirm a new `Email engagement` note exists.
6. Confirm the note body includes `applicationId: APP-001`.

### I. Run workflows
1. In Mailer Studio click `Run Docs Chase`.
2. Confirm:
   - doc-request emails are sent for queue candidates
   - duplicate open tasks are not recreated
3. Click `Run Review Sweep`.
4. Confirm:
   - review emails are sent
   - follow-up tasks are created in Twenty
5. Open Twenty Tasks and confirm new review tasks exist for settled files.

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

### Pull live CRM context
```bash
curl http://localhost:4010/studio/context/application/APP-001 | jq .
curl http://localhost:4010/studio/context/person/<twenty-person-id> | jq .
curl -I http://localhost:4010/studio/open/application/APP-001
```

### Dashboard snapshot
```bash
curl http://localhost:4010/studio/dashboard | jq .
```

### Send recommended template for an application
```bash
curl -X POST http://localhost:4010/campaigns/send-for-application \
  -H 'Content-Type: application/json' \
  -d '{
    "applicationId":"APP-001"
  }'
```

### Run workflows
```bash
curl -X POST http://localhost:4010/workflows/docs-chase \
  -H 'Content-Type: application/json' \
  -d '{"limit":2}' | jq .

curl -X POST http://localhost:4010/workflows/review-sweep \
  -H 'Content-Type: application/json' \
  -d '{"limit":2}' | jq .

curl -X POST http://localhost:4010/workflows/docs-chase \
  -H 'Content-Type: application/json' \
  -d '{"applicationIds":["APP-001","APP-004"],"dryRun":true}' | jq .
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

### Newsletter
```bash
curl -X POST http://localhost:4010/campaigns/send-template \
  -H 'Content-Type: application/json' \
  -d '{
    "templateKey":"mortgage_newsletter",
    "to":"ava.mercer@harbourlane-demo.test",
    "personId":"d68822d7-5562-4be0-a0fb-536a1decca40",
    "context":{
      "contact":{"firstName":"Ava"},
      "broker":{"name":"Harbour Lane","signature":"Harbour Lane"},
      "application":{"applicationId":"APP-001","applicationType":"retail_home_loan","pipelineStage":"docs_requested","lenderTarget":"CBA"},
      "checklist":{"requiredSummary":"ID, bank statements"}
    }
  }' | jq .
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
- CRM users can jump straight from a loan file or person into a prefilled Mailer Studio session instead of hand-building context JSON.
- Segment-list sync is now derived from live mortgage application state and preserves multiple memberships per subscriber.
- Mailer Studio now doubles as an operator dashboard with workflow queues, not just a send screen.
- Lifecycle cohorts such as `settled_last_90_days`, `annual_review_due`, and `fixed_rate_expiry` are now derived from loan state for list sync and campaign targeting.
- The current MVP still relies on manual Twenty custom-object setup because the self-hosted Twenty runtime rejects built-in system flat entities needed for app-managed custom-object sync.
- The stable local CRM writeback path for MVP is `rest_note`; `workflow_webhook` remains available but depends on correct workflow configuration inside Twenty.
