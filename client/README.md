# OpenCodeLab Client

Production-ready web client for the OpenCodeLab remote code executor.

## Stack

- Vite + React 19 + TypeScript
- Monaco Editor (`@monaco-editor/react`)
- Typed API integration with backend executor (`/producer`, `/consumer`, `/consumer/stream`)

## Features

- Full code execution flow with language selection (`javascript`, `python`, `c`, `cpp`, `c++`)
- Real-time execution updates via SSE with automatic polling fallback
- Detailed execution states: queued, completed, failed, timeout, backend unavailable, disconnected
- Failure classification for compile/runtime timeout paths
- Recent runs history persisted in browser storage
- Keyboard flow support (`Ctrl/Cmd + Enter` to run)
- Responsive light/dark themes and accessible form controls

## Requirements

- Node.js `>=24`

## Environment

Copy from `.env.example` if needed:

```bash
cp .env.example .env
```

Available variables:

- `VITE_EXECUTOR_BASE_URL` (optional absolute backend URL)
- `VITE_ACCEPT_VERSION` (`1` by default)
- `VITE_MAX_CODE_LENGTH` (frontend validation guardrail)
- `VITE_PROXY_TARGET` (dev proxy target, defaults to `http://localhost`)

## Local development

```bash
npm install
npm run dev
```

Default local URL: `http://localhost:5173`

The dev server proxies executor calls to `VITE_PROXY_TARGET`.

## Build and checks

```bash
npm run lint
npm run typecheck
npm run build
npm run preview
```

Preview URL: `http://localhost:4173`

## Container

Build and run standalone client container:

```bash
docker build -t opencodelab-client .
docker run --rm -p 4173:4173 opencodelab-client
```

This image uses Node.js 24 for both build and runtime stages.
