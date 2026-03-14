# OpenCodeLab

OpenCodeLab is a multi-service code-execution platform that accepts source code, runs it in language-specific sandbox workers, and exposes execution status over polling and server-sent events (SSE).

This repository contains the full stack:
- Node.js API server (TypeScript + Express)
- RabbitMQ-backed execution queue
- Go sandbox workers (Node.js and Python runtimes)
- Redis-backed status store
- Go polling/streaming API
- Nginx entrypoint and routing
- Lightweight execution status UI

## Table of Contents

- [Overview](#overview)
- [System Design](#system-design)
- [Execution Flow](#execution-flow)
- [Architecture Deep Dive](#architecture-deep-dive)
- [API Reference](#api-reference)
- [Data Contracts](#data-contracts)
- [Configuration](#configuration)
- [Local Development](#local-development)
- [Container Deployment](#container-deployment)
- [Testing and Verification](#testing-and-verification)
- [Observability](#observability)
- [Security Model](#security-model)
- [Failure Modes and Recovery](#failure-modes-and-recovery)
- [Scalability Notes](#scalability-notes)
- [Repository Layout](#repository-layout)
- [Known Limitations](#known-limitations)

## Overview

### Core problem solved

- Accept user-submitted code (`javascript` or `python`)
- Execute asynchronously with bounded runtime
- Return a stable `executionID` immediately
- Provide live and pull-based status APIs
- Surface execution output when available

### Why async execution

Execution is decoupled from request/response latency. This keeps the API responsive while code runs in dedicated workers with runtime limits.

## System Design

### High-level component diagram

```mermaid
flowchart LR
    Client[Client / Browser / CLI]
    Nginx[Nginx Gateway]
    API[Node API Server\nExpress + TypeScript]
    Mongo[(MongoDB)]
    MQ[(RabbitMQ)]
    NodeWorker[Node Sandbox Worker\nGo runner + node -e]
    PyWorker[Python Sandbox Worker\nGo runner + python3.10 -c]
    Redis[(Redis)]
    Polling[Polling Server\nGo + Gin]
    UI[Status UI\n/public/status-ui.html]

    Client -->|HTTP| Nginx
    Nginx -->|/| API
    Nginx -->|/consumer*| Polling
    API -->|Mongoose| Mongo
    API -->|publish code job| MQ
    MQ --> NodeWorker
    MQ --> PyWorker
    NodeWorker -->|persist status/output| Redis
    PyWorker -->|persist status/output| Redis
    Polling -->|read status| Redis
    API -->|serves static| UI
    UI -->|SSE /consumer/stream| Nginx
```

### Runtime boundaries

- Public entrypoint: Nginx (`:80` in Docker Compose)
- Internal services on Docker network: API, polling-server, Redis, RabbitMQ, MongoDB, sandboxes
- API and polling are separate processes and codebases

## Execution Flow

### Sequence diagram: submit code and stream status

```mermaid
sequenceDiagram
    participant C as Client
    participant N as Nginx
    participant A as API Server
    participant Q as RabbitMQ
    participant W as Sandbox Worker
    participant R as Redis
    participant P as Polling Server

    C->>N: POST /producer { language, code }
    N->>A: Proxy request
    A->>A: Validate payload (Joi)
    A->>Q: Publish message with correlationId
    A-->>C: 202 Accepted + executionID

    C->>N: GET /consumer/stream?correlationID=...
    N->>P: Proxy SSE request

    Q->>W: Deliver execution job
    W->>W: Execute code with 2s timeout
    W->>R: SET correlationID => execution record (TTL 10m)

    loop every 1s until terminal status
        P->>R: GET correlationID
        P-->>C: event: status + JSON payload
    end
```

### Detailed state lifecycle

Current statuses emitted by polling-server:
- `queued` (key not found yet)
- `completed`
- `failed`
- `timeout`
- `invalid_request` (missing correlation ID)
- `backend_unavailable` (Redis lookup failed)

Terminal statuses currently treated as stream-ending:
- `completed`
- `failed`
- `timeout`

## Architecture Deep Dive

### 1) API server (`src/`)

Main responsibilities:
- API version extraction via `accept-version` header
- Input validation for `/producer`
- Queue publishing through RabbitMQ client
- Static hosting of status UI (`/status-ui`)

Version routing:
- Supported versions: `1`, `2`
- Missing/invalid version defaults to `1`

Notable behavior:
- `helmet()` enabled globally
- RabbitMQ client is initialized on startup and lazily initialized on first produce call when required
- Error handler normalizes API and runtime errors

### 2) RabbitMQ integration (`src/services/rabbitmq`)

- `Producer` maps language to queue:
  - `javascript` -> `node18_16`
  - `python` -> `python310`
- Message properties include:
  - `correlationId` (UUID)
  - `replyTo` (ephemeral exclusive queue)
  - `expiration` = `30000` ms

### 3) Sandbox workers (`sandboxes/`)

Each worker is a Go service that:
- Consumes jobs from a language queue
- Unmarshals code payload
- Executes code in language runtime with timeout (`2s`)
- Persists normalized result into Redis

Execution commands:
- Node worker: `node -e <code>`
- Python worker: `python3.10 -c <code>`

Result normalization:
- `completed`
- `failed`
- `timeout`

Redis write format includes schema marker:
- `schema: opencodelab.execution.v1`

### 4) Polling server (`polling-server/`)

Responsibilities:
- Query status by correlation ID (`/consumer`)
- Stream status events (`/consumer/stream`) via SSE
- Parse both structured and legacy Redis records

Compatibility logic:
- If Redis value is JSON with matching schema, treat as structured record
- Otherwise treat value as legacy raw output string

### 5) Nginx (`nginx.conf`)

Routing policy:
- `/consumer*` -> polling-server
- everything else (`/`) -> API server

CORS policy:
- Allows origin `http://localhost:3000`
- Handles `OPTIONS` preflight with `204`

## API Reference

### Versioning

Use header `accept-version`.

Rules:
- `accept-version: 1` -> v1 router
- `accept-version: 2` -> v2 router
- missing/unsupported -> defaults to v1

### `GET /`

Returns version-specific health-style payload.

Example (v1 default):

```json
{
  "success": true,
  "message": "Hello, world 1!",
  "data": {
    "apiVersion": "1"
  }
}
```

### `GET /` with `accept-version: 2`

Returns v2 payload unless `ENABLE_V2_FAULT_TEST=true`, in which case it returns an error.

### `POST /producer`

Submit code for async execution.

Request body:

```json
{
  "language": "javascript",
  "code": "console.log('hello')"
}
```

Validation:
- `language` required, one of supported languages
- `code` required, min length `1`
- max code length controlled by `MAX_CODE_LENGTH` (default `10000`)

Success response (`202 Accepted`):

```json
{
  "success": true,
  "message": "Request accepted for processing",
  "data": {
    "executionID": "<uuid>",
    "statusEndpoint": "/consumer?correlationID=<uuid>",
    "streamEndpoint": "/consumer/stream?correlationID=<uuid>",
    "statusUI": "/status-ui?executionID=<uuid>"
  }
}
```

### `GET /consumer?correlationID=<id>`

Response examples:

Queued / not yet available:

```json
{
  "correlationID": "<id>",
  "exists": false,
  "status": "queued",
  "updatedAt": "2026-03-14T00:00:00Z"
}
```

Completed:

```json
{
  "correlationID": "<id>",
  "exists": true,
  "status": "completed",
  "body": "program output\n",
  "updatedAt": "2026-03-14T00:00:00Z"
}
```

Redis unavailable (`503`):

```json
{
  "correlationID": "<id>",
  "exists": false,
  "status": "backend_unavailable",
  "error": "polling backend unavailable",
  "updatedAt": "2026-03-14T00:00:00Z"
}
```

### `GET /consumer/stream?correlationID=<id>`

- SSE endpoint
- Event name: `status`
- Emits JSON payload each second
- Ends on terminal statuses (`completed`, `failed`, `timeout`) or non-200 lookup status

### `GET /status-ui`

Serves static HTML UI for live execution tracking.

## Data Contracts

### Queue message (producer -> sandbox)

```json
{
  "language": "javascript",
  "code": "console.log(1)"
}
```

### Redis execution record (sandbox -> polling)

```json
{
  "schema": "opencodelab.execution.v1",
  "status": "completed",
  "body": "1\n"
}
```

Key properties:
- Redis key: `correlationID`
- TTL: `10 minutes`

## Configuration

### Environment variables

| Variable | Default | Used by | Notes |
|---|---|---|---|
| `PORT` | `3000` | API server | API listen port |
| `NODE_ENV` | runtime dependent | API server | `development` enables stack traces in error payload |
| `DB_URL` | `mongodb://localhost:27017` | API server | Mongo connection string |
| `RABBITMQ_URL` | `amqp://localhost` (API fallback) | API server + sandboxes | RabbitMQ connection string |
| `REDIS_URL` | none | polling-server + sandboxes | Required for status lookup/persistence |
| `MAX_CODE_LENGTH` | `10000` | API server | Maximum request body `code` length |
| `ENABLE_V2_FAULT_TEST` | `false` | API server v2 | Enables forced v2 error path |

### Example local env (`.env.dev`)

Current repo includes:

```bash
NODE_ENV=development
PORT=3000
DB_URL=mongodb://localhost:27017/opencodelab-test
RABBITMQ_URL=amqp://guest:guest@localhost:5672
REDIS_URL=localhost:6379
```

## Local Development

### Prerequisites

- Node.js 18+
- npm
- Docker (for local infra services)
- Go 1.20+ (for polling-server tests/build)

### Option A: API dev with local infra helper script

```bash
./scripts/launch.sh
```

This script:
- creates `opencodelab-dev` network
- starts `mq-dev`, `db-dev`, `redis-dev`
- waits for service ports
- installs Node dependencies if needed
- runs `npm run dev`

Stop infra:

```bash
./scripts/stop.sh
```

### Option B: Full container stack

```bash
docker compose up --build
```

Entry point:
- `http://localhost` via Nginx

Teardown:

```bash
docker compose down
```

Remove volumes too:

```bash
docker compose down -v
```

## Container Deployment

Services in `docker-compose.yml`:
- `nginx`
- `app-server`
- `polling-server`
- `rabbitmq-server`
- `redis-server`
- `database`
- `python-sandbox`
- `node-sandbox`

Sandbox defaults applied through compose anchor:
- read-only filesystem
- tmpfs for `/tmp`
- `no-new-privileges`
- `cap_drop: ALL`
- resource limits (`pids`, `cpu`, `memory`)

## Testing and Verification

### Node tests

```bash
npm test
```

Covers:
- API version extraction middleware
- producer language validation and queue-target behavior

### Go tests (polling-server)

```bash
cd polling-server
go test ./...
```

Covers:
- missing key semantics
- legacy response compatibility
- schema-scoped metadata parsing
- backend outage handling

## Observability

### Logging

API uses Winston logger:
- Dev: console + `logs/dev.log` (if writable)
- Prod: `logs/error.log` + `logs/combined.log` (fallback to console if directory creation fails)

Polling-server and sandboxes currently log via standard output.

### UI observability

`/status-ui` provides:
- execution ID input
- live status chip (`queued`, `completed`, `failed`, `timeout`)
- updated timestamp
- execution output/error pane

## Security Model

Implemented controls:
- `helmet()` on API routes
- Nginx CORS with explicit allowed origin and preflight handling
- sandbox containers run with reduced privileges in compose
- payload validation and length checks on `/producer`

Important note:
- This project executes untrusted code. Treat sandbox hardening as a critical, ongoing responsibility.

## Failure Modes and Recovery

### API-side failures

- Invalid payload -> `400`
- unsupported language -> `400`
- RabbitMQ unavailable during init -> API-level `503` error path from client wrapper

### Polling failures

- missing key -> `200` + `queued`
- Redis outage -> `503` + `backend_unavailable`

### Sandbox failures

- malformed queue payload -> `Nack(false, false)`
- runtime timeout -> `timeout` status
- runtime non-zero exit -> `failed` status

## Scalability Notes

Current scaling knobs:
- Horizontal scaling via additional workers (queue consumers)
- Nginx as stable single entrypoint
- Redis-based shared status storage

Potential next steps:
- Explicit worker autoscaling by queue depth
- Backpressure/rate limiting at API boundary
- stronger reconnect/resiliency strategy for long-running MQ operations

## Repository Layout

```text
.
├── src/                       # Node API server
│   ├── middlewares/
│   ├── routes/
│   ├── services/rabbitmq/
│   └── utils/
├── polling-server/            # Go polling + SSE service
├── sandboxes/                 # Go workers + runtime-specific executors
│   ├── client/
│   ├── node/
│   ├── python/
│   └── utils/
├── public/                    # Static status UI
├── scripts/                   # Dev and GitHub helper scripts
├── docker-compose.yml
├── nginx.conf
├── Dockerfile
├── Dockerfile._node
└── Dockerfile._python
```

## Known Limitations

Open tracked issues:
- Sandbox network isolation hardening: https://github.com/priyansh32/opencodelab/issues/2
- Ack-before-persist result loss risk: https://github.com/priyansh32/opencodelab/issues/25
- Unbounded SSE stream lifetime for missing IDs: https://github.com/priyansh32/opencodelab/issues/26
- RabbitMQ runtime reconnect handling: https://github.com/priyansh32/opencodelab/issues/27

These should be addressed before positioning the system as production-ready for hostile workloads.
