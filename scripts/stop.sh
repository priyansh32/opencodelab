#!/bin/bash

# use this script to stop the dev environment

set -euo pipefail

managed_containers=("mq-dev" "db-dev" "redis-dev")
containers_to_remove=()

for container in "${managed_containers[@]}"; do
  if docker inspect "$container" >/dev/null 2>&1; then
    containers_to_remove+=("$container")
  fi
done

if [[ "${#containers_to_remove[@]}" -gt 0 ]]; then
  docker stop "${containers_to_remove[@]}" >/dev/null 2>&1 || true
  docker rm "${containers_to_remove[@]}" >/dev/null 2>&1 || true
fi

docker network rm opencodelab-dev >/dev/null 2>&1 || true
