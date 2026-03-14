#!/bin/bash

# use this script to launch the dev environment

set -euo pipefail

if ! docker network inspect opencodelab-dev >/dev/null 2>&1; then
  docker network create opencodelab-dev >/dev/null
fi

ensure_container () {
  local name="$1"
  shift

  local status
  status=$(docker inspect -f '{{.State.Status}}' "$name" 2>/dev/null || echo "")

  if [[ "$status" == "running" ]]; then
    return 0
  elif [[ -n "$status" ]]; then
    docker start "$name" >/dev/null
  else
    docker run -d --name "$name" "$@" >/dev/null
  fi
}

ensure_container mq-dev --network opencodelab-dev -p 15672:15672 -p 5672:5672 rabbitmq:3.12-management-alpine
ensure_container db-dev --network opencodelab-dev -p 27017:27017 mongo:7.0
ensure_container redis-dev --network opencodelab-dev -p 6379:6379 redis:7.0-alpine3.18

wait_for_port () {
  local name="$1"
  local port="$2"
  echo "Waiting for $name on port $port..."
  until (echo >"/dev/tcp/127.0.0.1/$port") >/dev/null 2>&1; do
    sleep 0.5
  done
}

wait_for_port "RabbitMQ" 5672
wait_for_port "MongoDB" 27017
wait_for_port "Redis" 6379

compute_dependency_hash () {
  if command -v sha256sum >/dev/null 2>&1; then
    if [[ -f package-lock.json ]]; then
      sha256sum package.json package-lock.json | sha256sum | awk '{print $1}'
    else
      sha256sum package.json | awk '{print $1}'
    fi
  else
    if [[ -f package-lock.json ]]; then
      shasum -a 256 package.json package-lock.json | shasum -a 256 | awk '{print $1}'
    else
      shasum -a 256 package.json | awk '{print $1}'
    fi
  fi
}

ensure_node_dependencies () {
  local deps_hash_file=".node_modules.depshash"
  local current_hash
  local previous_hash=""

  current_hash="$(compute_dependency_hash)"

  if [[ -f "$deps_hash_file" ]]; then
    previous_hash="$(cat "$deps_hash_file")"
  fi

  if [[ ! -d node_modules ]] || [[ "$current_hash" != "$previous_hash" ]]; then
    npm install
    current_hash="$(compute_dependency_hash)"
  fi

  printf '%s\n' "$current_hash" > "$deps_hash_file"
}

ensure_node_dependencies

npm run dev
