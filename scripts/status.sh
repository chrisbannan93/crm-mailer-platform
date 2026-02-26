#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STACK_DIR="$ROOT_DIR/stack"
STACK_ENV="$STACK_DIR/.env"

if [[ ! -f "$STACK_ENV" ]]; then
  echo "Error: missing $STACK_ENV (copy stack/.env.example first)" >&2
  exit 1
fi

command -v docker >/dev/null 2>&1 || { echo "Error: docker is required" >&2; exit 1; }
command -v curl >/dev/null 2>&1 || { echo "Error: curl is required" >&2; exit 1; }

set -a
# shellcheck disable=SC1090
source "$STACK_ENV"
set +a

TWENTY_PORT="${TWENTY_PORT:-3000}"
LISTMONK_PORT="${LISTMONK_PORT:-9000}"
CONNECTOR_PORT="${CONNECTOR_PORT:-4010}"
MAILPIT_UI_PORT="${MAILPIT_UI_PORT:-8025}"

compose() {
  docker compose --env-file "$STACK_ENV" -f "$STACK_DIR/docker-compose.yml" "$@"
}

check_http() {
  local name="$1"
  local url="$2"
  local code
  code="$(curl -sS -o /dev/null -w '%{http_code}' "$url" || true)"
  if [[ "$code" =~ ^[23] ]]; then
    printf '  %-16s OK   %s (%s)\n' "$name" "$url" "$code"
  else
    printf '  %-16s FAIL %s (%s)\n' "$name" "$url" "${code:-ERR}"
  fi
}

echo "Compose services"
compose ps || true

echo
echo "HTTP health checks"
check_http "Twenty" "http://localhost:${TWENTY_PORT}/healthz"
check_http "listmonk" "http://localhost:${LISTMONK_PORT}/"
check_http "Connector" "http://localhost:${CONNECTOR_PORT}/health"
check_http "Mailer Studio" "http://localhost:${CONNECTOR_PORT}/studio/status"
check_http "Mailpit" "http://localhost:${MAILPIT_UI_PORT}/"

echo
echo "Useful URLs"
echo "  Twenty      : http://localhost:${TWENTY_PORT}"
echo "  listmonk    : http://localhost:${LISTMONK_PORT}"
echo "  Connector   : http://localhost:${CONNECTOR_PORT}"
echo "  MailerStudio: http://localhost:${CONNECTOR_PORT}/"
echo "  Mailpit     : http://localhost:${MAILPIT_UI_PORT}"
