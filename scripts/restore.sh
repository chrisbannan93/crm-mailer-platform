#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STACK_DIR="$ROOT_DIR/stack"
STACK_ENV="$STACK_DIR/.env"
BACKUPS_DIR="$ROOT_DIR/backups"

usage() {
  cat <<EOF
Usage: $0 [--backup <path-to-backup-dir>]

Examples:
  $0                         # restore latest backup from ./backups
  $0 --backup backups/20260226T120000Z
EOF
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Error: '$1' is required but not installed." >&2
    exit 1
  }
}

require_cmd docker
require_cmd gzip
require_cmd tar

if [[ ! -f "$STACK_ENV" ]]; then
  echo "Error: missing $STACK_ENV (copy stack/.env.example first)" >&2
  exit 1
fi

BACKUP_PATH=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --backup)
      BACKUP_PATH="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ -z "$BACKUP_PATH" ]]; then
  if [[ ! -d "$BACKUPS_DIR" ]]; then
    echo "Error: backups directory not found: $BACKUPS_DIR" >&2
    exit 1
  fi
  BACKUP_PATH="$(find "$BACKUPS_DIR" -mindepth 1 -maxdepth 1 -type d | sort | tail -n 1)"
fi

if [[ -z "$BACKUP_PATH" || ! -d "$BACKUP_PATH" ]]; then
  echo "Error: backup directory not found: $BACKUP_PATH" >&2
  exit 1
fi

TWENTY_SQL_GZ="$BACKUP_PATH/twenty.sql.gz"
LISTMONK_SQL_GZ="$BACKUP_PATH/listmonk.sql.gz"
UPLOADS_TAR="$BACKUP_PATH/listmonk-uploads.tar.gz"

if [[ ! -f "$TWENTY_SQL_GZ" || ! -f "$LISTMONK_SQL_GZ" ]]; then
  echo "Error: required dump files not found in $BACKUP_PATH" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$STACK_ENV"
set +a

TWENTY_DB_NAME="${TWENTY_PG_DB:-default}"
TWENTY_DB_USER="${TWENTY_PG_USER:-postgres}"
LISTMONK_DB_NAME="${LISTMONK_DB_NAME:-listmonk}"
LISTMONK_DB_USER="${LISTMONK_DB_USER:-listmonk}"

compose() {
  docker compose --env-file "$STACK_ENV" -f "$STACK_DIR/docker-compose.yml" "$@"
}

echo "Ensuring database services are running..."
compose up -d twenty-db listmonk-db
echo "Stopping app services during restore..."
compose stop twenty-server twenty-worker listmonk connector >/dev/null || true

TWENTY_DB_CID="$(compose ps -q twenty-db)"
LISTMONK_DB_CID="$(compose ps -q listmonk-db)"

if [[ -z "$TWENTY_DB_CID" || -z "$LISTMONK_DB_CID" ]]; then
  echo "Error: database containers are unavailable" >&2
  exit 1
fi

# Wait briefly for readiness.
for i in {1..20}; do
  if docker exec "$TWENTY_DB_CID" pg_isready -U "$TWENTY_DB_USER" -d "$TWENTY_DB_NAME" >/dev/null 2>&1 \
    && docker exec "$LISTMONK_DB_CID" pg_isready -U "$LISTMONK_DB_USER" -d "$LISTMONK_DB_NAME" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

echo "Restoring Twenty DB ($TWENTY_DB_NAME) from $(basename "$TWENTY_SQL_GZ")"
docker exec -i "$TWENTY_DB_CID" psql -v ON_ERROR_STOP=1 -U "$TWENTY_DB_USER" -d "$TWENTY_DB_NAME" <<'SQL'
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO PUBLIC;
SQL
gzip -dc "$TWENTY_SQL_GZ" | docker exec -i "$TWENTY_DB_CID" psql -v ON_ERROR_STOP=1 -U "$TWENTY_DB_USER" -d "$TWENTY_DB_NAME"

echo "Restoring listmonk DB ($LISTMONK_DB_NAME) from $(basename "$LISTMONK_SQL_GZ")"
docker exec -i "$LISTMONK_DB_CID" psql -v ON_ERROR_STOP=1 -U "$LISTMONK_DB_USER" -d "$LISTMONK_DB_NAME" <<'SQL'
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO PUBLIC;
SQL
gzip -dc "$LISTMONK_SQL_GZ" | docker exec -i "$LISTMONK_DB_CID" psql -v ON_ERROR_STOP=1 -U "$LISTMONK_DB_USER" -d "$LISTMONK_DB_NAME"

if [[ -f "$UPLOADS_TAR" ]]; then
  mkdir -p "$STACK_DIR/uploads"
  tar -C "$STACK_DIR" -xzf "$UPLOADS_TAR"
  echo "Restored listmonk uploads"
fi

echo "Restore complete from $BACKUP_PATH"
echo "Recommended next steps:"
echo "  1) docker compose --env-file $STACK_ENV -f $STACK_DIR/docker-compose.yml up -d"
echo "  2) ./scripts/status.sh"
