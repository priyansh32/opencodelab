#!/bin/bash

# use this script to stop the dev environment

set -euo pipefail

containers=$(docker ps -a --filter "network=opencodelab-dev" --format "{{.Names}}" || true)

if [[ -n "$containers" ]]; then
  docker stop $containers >/dev/null 2>&1 || true
  docker rm $containers >/dev/null 2>&1 || true
fi

docker network rm opencodelab-dev >/dev/null 2>&1 || true
