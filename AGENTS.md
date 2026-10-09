# Base44 Dev Environment

## Project Overview
Padel tournament management app (Vite + React 19 + TypeScript + Tailwind v4) with an
Express dev server (`server.ts`) that runs Vite in middleware mode on port 3000.
Backend integrations: Firebase (Auth, Firestore, Storage) and Google Gemini AI.

## Startup
- Dev command: `tsx server.ts` (run via `npm run dev`).
- The Express server binds `0.0.0.0:3000` and serves Vite's middleware (SPA mode).
- Dependencies install on container startup via `npm ci` (uses `package-lock.json`).
- `node_modules` lives in a named Docker volume (not bind-mounted to the host).

## Environment / Secrets
- `GEMINI_API_KEY` — needed only for the `/api/tournament-summary` AI endpoint
  (lazy-loaded). The server boots without it. Delivered via `/run/base44/app.env`.
- `.env.base44-defaults` holds development placeholders; real secrets in
  `/run/base44/app.env` override them (listed last in `env_file:`).

## Vite Host Allowlist
- `__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS` (set by the platform to `.e2b.app`) is
  passed through to the container so Vite accepts the preview proxy's Host header.
  No config edit was needed — Vite >= 6.1 reads this env var automatically.

## Verification
- `npm run lint` (tsc --noEmit) — passes with no errors.
- `npm run build` (vite build + esbuild server bundle) — passes.
- `npm test` — 18 domain tests pass.
- Preview renders the login screen; guest login ("Continuar como Invitado") enters
  the app's home screen. Google popup auth won't work inside the preview iframe;
  use guest mode or `?guest=1` / `?viewer=<id>` URL params.

## Known Runtime Notes
- Firebase realtime WebSocket connections may emit "WebSocket closed without opened"
  errors in the sandbox (outbound WebSocket restrictions). These are environmental
  and do not prevent the app from working in guest/local mode — Firestore listeners
  are only attached when a real Firebase user is authenticated.
