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

if [ ! -d "node_modules" ] || [ -z "$(ls -A node_modules 2>/dev/null)" ]; then
  npm install
fi

npm run dev
