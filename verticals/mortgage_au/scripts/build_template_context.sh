#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 || $# -gt 2 ]]; then
  echo "Usage: $0 <application-id> [connector-env-path]" >&2
  exit 1
fi

APPLICATION_ID="$1"
ENV_FILE="${2:-/home/chris/projects/crm-mailer-platform/connector/.env}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Connector env file not found: $ENV_FILE" >&2
  exit 1
fi

TWENTY_BASE_URL="$(awk -F= '/^TWENTY_BASE_URL=/{print substr($0,index($0,"=")+1)}' "$ENV_FILE")"
TWENTY_API_KEY="$(awk -F= '/^TWENTY_API_KEY=/{print substr($0,index($0,"=")+1)}' "$ENV_FILE")"

if [[ -z "$TWENTY_BASE_URL" || -z "$TWENTY_API_KEY" ]]; then
  echo "TWENTY_BASE_URL and TWENTY_API_KEY must be set in $ENV_FILE" >&2
  exit 1
fi

read -r -d '' QUERY <<'EOF' || true
query MortgageApplicationsForContext {
  loanApplications {
    edges {
      node {
        id
        applicationid
        applicationtype
        pipelinestage
        borrowername
        brokerowner
        loanpurpose
        loanamount {
          amountMicros
          currencyCode
        }
        estimatedpropertyvalue {
          amountMicros
          currencyCode
        }
        lvrband
        targetsettlementdate
        lendertarget
        occupancytype
        firsthomebuyer
        entityname
        entitytype
        abn
        securitytype
        notessummary
        contactperson {
          edges {
            node {
              id
              name {
                firstName
                lastName
              }
              emails {
                primaryEmail
              }
            }
          }
        }
        documents {
          edges {
            node {
              id
              documentLabel
              required
              status
              ownerrole
              notes
              recievedat
              validatedat
            }
          }
        }
      }
    }
  }
}
EOF

PAYLOAD="$(jq -cn --arg query "$QUERY" '{query: $query}')"
RESPONSE="$(curl -sS -H "Authorization: Bearer $TWENTY_API_KEY" -H 'Content-Type: application/json' "$TWENTY_BASE_URL/graphql" -d "$PAYLOAD")"

jq --arg app "$APPLICATION_ID" '
  def micros_to_amount:
    if . == null then null else ((. / 1000000) | floor) end;
  def normalize_enum:
    if . == null or . == "" then null else ascii_downcase end;
  .data.loanApplications.edges
  | map(.node)
  | map(select(.applicationid == $app))
  | if length == 0 then
      error("Loan Application not found: " + $app)
    else .[0] end
  | . as $application
  | ($application.contactperson.edges[0].node // {}) as $contact
  | ($application.documents.edges | map(.node)) as $documents
  | {
      contact: {
        firstName: ($contact.name.firstName // ""),
        lastName: ($contact.name.lastName // ""),
        email: ($contact.emails.primaryEmail // "")
      },
      broker: {
        name: ($application.brokerowner // ""),
        signature: ($application.brokerowner // "")
      },
      application: {
        id: $application.id,
        applicationId: $application.applicationid,
        applicationType: ($application.applicationtype | normalize_enum),
        pipelineStage: ($application.pipelinestage | normalize_enum),
        borrowerName: ($application.borrowername // ""),
        loanPurpose: ($application.loanpurpose | normalize_enum),
        lenderTarget: ($application.lendertarget // ""),
        lvrBand: ($application.lvrband | normalize_enum),
        targetSettlementDate: ($application.targetsettlementdate // null),
        occupancyType: ($application.occupancytype | normalize_enum),
        firstHomeBuyer: ($application.firsthomebuyer // false),
        entityName: ($application.entityname // ""),
        entityType: ($application.entitytype | normalize_enum),
        abn: ($application.abn // ""),
        securityType: ($application.securitytype | normalize_enum),
        notesSummary: ($application.notessummary // ""),
        loanAmount: ($application.loanamount.amountMicros | micros_to_amount),
        estimatedPropertyValue: ($application.estimatedpropertyvalue.amountMicros | micros_to_amount),
        currencyCode: ($application.loanamount.currencyCode // $application.estimatedpropertyvalue.currencyCode // "AUD")
      },
      checklist: {
        requiredSummary: (
          $documents
          | map(select(.required == true and ((.status | ascii_downcase) | IN("received", "accepted", "waived") | not)))
          | map(.documentLabel)
          | join(", ")
        ),
        items: (
          $documents
          | map({
              label: .documentLabel,
              required: .required,
              status: (.status | ascii_downcase),
              ownerRole: (.ownerrole | ascii_downcase),
              notes: (.notes // ""),
              receivedAt: (.recievedat // null),
              validatedAt: (.validatedat // null)
            })
        )
      }
    }
' <<<"$RESPONSE"
