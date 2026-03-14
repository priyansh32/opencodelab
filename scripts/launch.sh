#!/bin/bash

# use this script to launch the containerized dev environment

set -euo pipefail

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required but not installed."
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "Docker daemon is not running or not accessible."
  exit 1
fi

# WSL shells can inherit Docker config that references a helper binary
# not present in PATH. Fall back to anonymous pulls for public images.
default_docker_config="${HOME}/.docker/config.json"
temp_docker_config=""
if [[ -f "$default_docker_config" ]]; then
  creds_store="$(sed -nE 's/.*"credsStore"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/p' "$default_docker_config" | head -n1)"
  if [[ -n "${creds_store}" ]]; then
    helper_binary="docker-credential-${creds_store}"
    if ! command -v "$helper_binary" >/dev/null 2>&1; then
      export DOCKER_CONFIG
      DOCKER_CONFIG="$(mktemp -d)"
      temp_docker_config="$DOCKER_CONFIG"
      printf '{\"auths\":{}}\n' > "${DOCKER_CONFIG}/config.json"
      echo "Docker credential helper ${helper_binary} not found; using temporary anonymous Docker config for this run."
    fi
  fi
fi

cleanup() {
  if [[ -n "$temp_docker_config" ]] && [[ -d "$temp_docker_config" ]]; then
    rm -rf "$temp_docker_config"
  fi
}
trap cleanup EXIT

service_running() {
  local service="$1"
  local cid
  cid="$(docker compose ps -q "$service" 2>/dev/null || true)"
  if [[ -z "$cid" ]]; then
    return 1
  fi

  [[ "$(docker inspect -f '{{.State.Status}}' "$cid")" == "running" ]]
}

service_healthy() {
  local service="$1"
  local cid
  cid="$(docker compose ps -q "$service" 2>/dev/null || true)"
  if [[ -z "$cid" ]]; then
    return 1
  fi

  [[ "$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$cid")" == "healthy" ]]
}

echo "Starting full stack with Docker Compose..."
DOCKER_BUILDKIT=0 COMPOSE_DOCKER_CLI_BUILD=0 docker compose up --build -d

echo "Waiting for services to become ready ..."
for _ in $(seq 1 120); do
  if service_running nginx \
    && service_running app-server \
    && service_running polling-server \
    && service_running node-sandbox \
    && service_running python-sandbox \
    && service_healthy redis-server \
    && service_healthy rabbitmq-server \
    && service_healthy database; then
    echo "Stack is up."
    echo "API:        http://localhost/"
    echo "Polling:    http://localhost/consumer?correlationID=<id>"
    echo "Status UI:  http://localhost/status-ui"
    exit 0
  fi
  sleep 1
done

echo "Gateway did not become ready in time."
echo "Recent compose status:"
docker compose ps

echo "Recent app-server logs:"
docker compose logs --tail=100 app-server || true

exit 1
