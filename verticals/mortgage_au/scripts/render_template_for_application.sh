#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 || $# -gt 3 ]]; then
  echo "Usage: $0 <application-id> <template-key> [connector-base-url]" >&2
  exit 1
fi

APPLICATION_ID="$1"
TEMPLATE_KEY="$2"
CONNECTOR_BASE_URL="${3:-http://localhost:4010}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTEXT="$("$SCRIPT_DIR/build_template_context.sh" "$APPLICATION_ID")"

jq -n \
  --arg templateKey "$TEMPLATE_KEY" \
  --argjson context "$CONTEXT" \
  '{templateKey: $templateKey, context: $context}' \
| curl -sS -X POST "$CONNECTOR_BASE_URL/templates/email/render" \
    -H 'Content-Type: application/json' \
    -d @-
