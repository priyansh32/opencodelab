#!/bin/bash

# use this script to launch the dev environment

set -euo pipefail

if ! docker network inspect opencodelab-dev >/dev/null 2>&1; then
  docker network create opencodelab-dev >/dev/null
fi

ensure_container () {
  local name="$1"
  shift
  if docker ps --format '{{.Names}}' | grep -Fxq "$name"; then
    return 0
  fi
  if docker ps -a --format '{{.Names}}' | grep -Fxq "$name"; then
    docker start "$name" >/dev/null
    return 0
  fi
  docker run -d --name "$name" "$@" >/dev/null
}

ensure_container mq-dev --network opencodelab-dev -p 15672:15672 -p 5672:5672 rabbitmq:3.12-management-alpine
ensure_container db-dev --network opencodelab-dev -p 27017:27017 mongo:latest
ensure_container redis-dev --network opencodelab-dev -p 6379:6379 redis:7.0-alpine3.18

echo "Waiting for RabbitMQ, MongoDB, and Redis to start..."
sleep 10

npm install

npm run dev
