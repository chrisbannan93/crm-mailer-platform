#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 3 || $# -gt 5 ]]; then
  echo "Usage: $0 <application-id> <template-key> <recipient-email> [person-id] [connector-base-url]" >&2
  exit 1
fi

APPLICATION_ID="$1"
TEMPLATE_KEY="$2"
RECIPIENT_EMAIL="$3"
PERSON_ID="${4:-}"
CONNECTOR_BASE_URL="${5:-http://localhost:4010}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTEXT="$("$SCRIPT_DIR/build_template_context.sh" "$APPLICATION_ID")"

jq -n \
  --arg templateKey "$TEMPLATE_KEY" \
  --arg to "$RECIPIENT_EMAIL" \
  --arg personId "$PERSON_ID" \
  --argjson context "$CONTEXT" \
  '{
    templateKey: $templateKey,
    to: $to,
    context: $context
  } + (if $personId == "" then {} else {personId: $personId} end)' \
| curl -sS -X POST "$CONNECTOR_BASE_URL/campaigns/send-template" \
    -H 'Content-Type: application/json' \
    -d @-
