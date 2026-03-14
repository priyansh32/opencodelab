#!/bin/bash

# use this script to stop the dev environment

set -euo pipefail

docker rm -f mq-dev db-dev redis-dev >/dev/null 2>&1 || true

docker network rm opencodelab-dev >/dev/null 2>&1 || true
