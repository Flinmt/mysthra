#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PROJECT_DIR=$(dirname -- "$SCRIPT_DIR")
COMPOSE_FILE=${MYSTHRA_COMPOSE_FILE:-$PROJECT_DIR/docker-compose.production.yml}
ENV_FILE=${MYSTHRA_ENV_FILE:-$PROJECT_DIR/.env}

if [ ! -f "$ENV_FILE" ]; then
  echo "Environment file not found: $ENV_FILE" >&2
  echo "Create it from .env.example and set MASTER_PASSWORD." >&2
  exit 1
fi

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" pull mysthra
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --no-deps mysthra
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps mysthra
