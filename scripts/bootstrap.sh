#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STACK_DIR="$ROOT_DIR/stack"
CONNECTOR_DIR="$ROOT_DIR/connector"
STACK_ENV="$STACK_DIR/.env"
STACK_ENV_EXAMPLE="$STACK_DIR/.env.example"
CONNECTOR_ENV="$CONNECTOR_DIR/.env"
CONNECTOR_ENV_EXAMPLE="$CONNECTOR_DIR/.env.example"

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Error: '$1' is required but not installed." >&2
    exit 1
  }
}

require_cmd docker

if ! docker compose version >/dev/null 2>&1; then
  echo "Error: docker compose plugin is required (run 'docker compose version')." >&2
  exit 1
fi

if [[ ! -f "$STACK_ENV" ]]; then
  cp "$STACK_ENV_EXAMPLE" "$STACK_ENV"
  echo "Created $STACK_ENV from example"
fi

if [[ ! -f "$CONNECTOR_ENV" ]]; then
  cp "$CONNECTOR_ENV_EXAMPLE" "$CONNECTOR_ENV"
  echo "Created $CONNECTOR_ENV from example"
fi

echo "Starting local stack..."
docker compose --env-file "$STACK_ENV" -f "$STACK_DIR/docker-compose.yml" up -d --build

echo
echo "Stack start requested. Check status with:"
echo "  docker compose --env-file $STACK_ENV -f $STACK_DIR/docker-compose.yml ps"
echo
echo "URLs (localhost-only):"
echo "  Twenty CRM   : http://localhost:3000"
echo "  listmonk     : http://localhost:9000"
echo "  Connector UI : http://localhost:4010"
echo "  Mailpit UI   : http://localhost:8025"
echo
echo "Next steps:"
echo "  1) Open Twenty and complete local setup"
echo "  2) Open listmonk and create admin / configure SMTP to Mailpit (host: mailpit, port: 1025)"
echo "  3) Configure Twenty webhook to http://connector:4010/webhooks/twenty"
echo "  4) Use connector UI to run sync/campaign tests"
