#!/bin/bash

# use this script to stop the containerized dev environment

set -euo pipefail

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required but not installed."
  exit 1
fi

echo "Stopping full stack..."
docker compose down --remove-orphans
