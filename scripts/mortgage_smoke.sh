#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:4010}"

printf '\n[1/6] health\n'
curl -fsS "$BASE_URL/health" | jq .

printf '\n[2/6] command center\n'
curl -fsS "$BASE_URL/mortgage-au/command-center" | jq '.data.queues | map({key, count: (.items|length)})'

printf '\n[3/6] touchpoints catalog\n'
curl -fsS "$BASE_URL/mortgage-au/touchpoints" | jq '.data | map({key, eligibleCount, lastConfirmedAt})'

printf '\n[4/6] create website lead\n'
EMAIL="smoke.$(date +%s)@example.com"
curl -fsS -X POST "$BASE_URL/public/leads" \
  -H 'Content-Type: application/json' \
  -d "{\"firstName\":\"Smoke\",\"lastName\":\"Test\",\"email\":\"$EMAIL\",\"loanType\":\"Retail home loan\",\"consentMarketing\":true,\"consentCopyVersion\":\"privacy_v1\"}" | jq .

printf '\n[5/6] touchpoint audit summary\n'
curl -fsS "$BASE_URL/mortgage-au/audit-summary" | jq .

printf '\n[6/6] recent events\n'
curl -fsS "$BASE_URL/events/recent?limit=10" | jq '.data | map({kind, status, message})'

printf '\nSmoke run complete.\n'
