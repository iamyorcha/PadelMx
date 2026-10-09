# Base44 Setup Notes — Machos Padel App

## Stack
- **React 19 + Vite 6 + Tailwind 4** SPA served through an **Express** server (`server.ts`) using Vite middleware mode.
- **Firebase** (Firestore, Auth, Storage) — config is embedded in `firebase-applet-config.json`; no local Firebase instance needed. The app connects client-side to a real Firebase project.
- **Google Gemini AI** (`@google/genai`) — used server-side in `server.ts` for the `/api/tournament-summary` endpoint. Requires `GEMINI_API_KEY`.

## Dev command
- `npm run dev` → runs `tsx server.ts`, which starts Express on port 3000 with Vite middleware (dev mode).
- Node 22 is required (`@types/node: ^22`).
- npm with `package-lock.json` (bun.lock also exists but npm is the primary manager).

## Environment
- `GEMINI_API_KEY` — needed for the AI tournament summary feature. The app **boots without it** (lazy-initialized on the API endpoint). Placeholder lives in `.env.base44-defaults`; real value delivered via `/run/base44/app.env`.
- `APP_URL` is listed in `.env.example` but not used in code.

## Auth
- Google sign-in (popup) via Firebase Auth, OR guest mode ("Continuar como Invitado") which works locally without credentials.
- Guest mode can be triggered via URL param `?guest=true` or the guest button on the login screen.

## Verification
- Health check: `GET /api/health` → `{ status: "ok" }`
- Frontend: `GET /` → serves `index.html` through Vite middleware.
- The app shows a login/landing screen first; use "Continuar como Invitado" to enter without Google auth.

## Docker
- `docker-compose.base44.yml` runs `node:22-slim` with the repo bind-mounted at `/app`.
- Dependencies installed via `npm ci` on container startup (anonymous volume for `node_modules`).
