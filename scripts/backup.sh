#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STACK_DIR="$ROOT_DIR/stack"
STACK_ENV="$STACK_DIR/.env"
BACKUPS_DIR="$ROOT_DIR/backups"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_DIR="$BACKUPS_DIR/$TS"
TMP_DIR="$OUT_DIR/tmp"

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Error: '$1' is required but not installed." >&2
    exit 1
  }
}

require_cmd docker
require_cmd tar

if [[ ! -f "$STACK_ENV" ]]; then
  echo "Error: missing $STACK_ENV (copy stack/.env.example first)" >&2
  exit 1
fi

# Load non-secret operational values (DB credentials are used only for docker exec env interpolation and are NOT written to backup files)
set -a
# shellcheck disable=SC1090
source "$STACK_ENV"
set +a

PROJECT_NAME="${PROJECT_NAME:-crm_mailer_local}"
TWENTY_DB_SERVICE="twenty-db"
LISTMONK_DB_SERVICE="listmonk-db"
TWENTY_DB_NAME="${TWENTY_PG_DB:-default}"
TWENTY_DB_USER="${TWENTY_PG_USER:-postgres}"
LISTMONK_DB_NAME="${LISTMONK_DB_NAME:-listmonk}"
LISTMONK_DB_USER="${LISTMONK_DB_USER:-listmonk}"
UPLOADS_DIR="$STACK_DIR/uploads"

mkdir -p "$TMP_DIR"

compose() {
  docker compose --env-file "$STACK_ENV" -f "$STACK_DIR/docker-compose.yml" "$@"
}

container_id() {
  compose ps -q "$1"
}

TWENTY_DB_CID="$(container_id "$TWENTY_DB_SERVICE")"
LISTMONK_DB_CID="$(container_id "$LISTMONK_DB_SERVICE")"

if [[ -z "$TWENTY_DB_CID" || -z "$LISTMONK_DB_CID" ]]; then
  echo "Error: database containers are not running. Start the stack first (make up)." >&2
  exit 1
fi

echo "Creating backup in $OUT_DIR"

# Plain SQL dumps for simple restore. Passwords are not embedded in dump files.
docker exec -i "$TWENTY_DB_CID" pg_dump -U "$TWENTY_DB_USER" -d "$TWENTY_DB_NAME" --no-owner --no-privileges > "$TMP_DIR/twenty.sql"
docker exec -i "$LISTMONK_DB_CID" pg_dump -U "$LISTMONK_DB_USER" -d "$LISTMONK_DB_NAME" --no-owner --no-privileges > "$TMP_DIR/listmonk.sql"

gzip -9 "$TMP_DIR/twenty.sql"
gzip -9 "$TMP_DIR/listmonk.sql"

if [[ -d "$UPLOADS_DIR" ]]; then
  tar -C "$STACK_DIR" -czf "$OUT_DIR/listmonk-uploads.tar.gz" uploads
fi

cat > "$OUT_DIR/manifest.txt" <<EOF
backup_created_at_utc=$TS
project_name=$PROJECT_NAME
twenty_db_service=$TWENTY_DB_SERVICE
twenty_db_name=$TWENTY_DB_NAME
listmonk_db_service=$LISTMONK_DB_SERVICE
listmonk_db_name=$LISTMONK_DB_NAME
includes_listmonk_uploads=$( [[ -d "$UPLOADS_DIR" ]] && echo yes || echo no )
notes=No .env files or secrets are included in this backup.
EOF

mv "$TMP_DIR"/* "$OUT_DIR/"
rmdir "$TMP_DIR"

echo "Backup complete"
echo "  Directory: $OUT_DIR"
echo "  Files:"
ls -1 "$OUT_DIR" | sed 's/^/    - /'
