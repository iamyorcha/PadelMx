# Production Operations & Reliability Runbook (Padel Americano/Mexicano/King)

**App Version:** `1.0.0-beta.2`  
**Build Target:** AI Studio Container / Cloud Run  
**Firebase Project:** `ai-studio-73089c7b-e712-49d6-8d81-a3eb1545fc24`  

---

## 1. Observability & Real-Time Telemetry

The application implements a centralized error handling and event tracking pipeline in `src/utils/telemetry.ts`.

### How errors are tracked:
- **`reportError(error, context)`**: Automatically captures exception name, sanitized error message, stack trace, timestamp, online/offline status, route, tournament format, and build ID.
- **Circular In-Memory Buffer**: Stores the latest 50 events/errors in memory.
- **External Adapter Hook**: Automatically forwards to `window.Sentry` or `window.Datadog` if loaded in production:
  ```ts
  const externalSentry = typeof window !== 'undefined' ? (window as any)?.Sentry : undefined;
  if (externalSentry) externalSentry.captureException(error, { extra: sanitizedContext });
  ```
- **Custom DOM Events**: Emits `app_telemetry_error` and `app_telemetry_event` for automated E2E observability and browser monitoring agents.
- **In-App Developer Diagnostics**: Organizers can tap the **Shield** icon in the Home header or query `padel_ff_*` flags to inspect live diagnostic logs and payload audits directly.

---

## 2. Emergency Contingency & Kill-Switches (Feature Flags)

If an anomaly occurs during a live tournament, features can be disabled instantly without redeploying code via URL parameters or `localStorage`:

| Flag | Default | Description | Emergency URL Disable Override |
| :--- | :--- | :--- | :--- |
| `playoffs` | `true` | Quarter/Semi/Final playoff brackets | `?ff_playoffs=false` |
| `publicViewer` | `true` | Read-only spectator and QR live links | `?ff_publicViewer=false` |
| `tvMode` | `true` | Fullscreen TV / court display mode | `?ff_tvMode=false` |
| `globalRankings` | `true` | Aggregated player leaderboard | `?ff_globalRankings=false` |
| `experimentalFormats` | `false` | Unreleased tournament structures | `?ff_experimentalFormats=false` |
| `audioCelebrations` | `true` | Podiums and match-point audio chimes | `?ff_audioCelebrations=false` |

---

## 3. Data Safety, Undo & Recovery Mechanisms

### 3.1. Accidental Deletion Recovery (Undo)
- When an organizer deletes a tournament, it is temporarily cached in `lastDeletedTournament` and marked with `deletedAt: serverTimestamp()`.
- An **Undo Banner** immediately appears at the top of the interface allowing 1-tap full restoration of the deleted tournament with all players, matches, and scores intact.

### 3.2. Accidental Score Change Rollback
- `src/store.ts` preserves a 5-step rolling snapshot of the tournament state.
- If a score edit fails Firestore write rules, the client **automatically rolls back** to the previous valid snapshot, preventing corrupt or desynchronized local states.
- Organizers can invoke `revertLastTournamentState(tournamentId)` to restore prior match rounds.

### 3.3. Pre-Flight Integrity Guard
- `validateTournamentIntegrity` strictly audits all tournaments before creation, preventing duplicate player IDs, invalid court allocations, or corrupt matches from ever being written to Firestore.

### 3.4. Firestore Disaster Recovery / Backups
- **Automated GCP Scheduled Backups**: Recommended via Google Cloud Console:
  ```bash
  gcloud firestore export gs://[PROJECT_ID]-backups/$(date +%Y-%m-%d) --collection-ids=tournaments,users
  ```
- **Client-Side Export**: Organizers can export tournaments to JSON directly from the diagnostics view.

---

## 4. Rollback Plan & Incident Response

In the event of a critical issue during public beta:

### Frontend Rollback:
1. Switch to previous stable git tag (e.g. `v1.0.0-beta.1`).
2. Run `npm run test` and `npm run build`.
3. Deploy new container or container image revision on Cloud Run / hosting.

### Firestore Rules Rollback:
1. If rule changes cause false `permission-denied` errors:
   ```bash
   firebase deploy --only firestore:rules
   ```
2. Previous rules versions are tracked under `src/security/` and verified using `src/security/firestore.rules.test.ts`.

---

## 5. Beta Exit Criteria & Production Readiness SLOs

To exit Public Beta and declare Full Production Readiness:

1. **Crash-Free Sessions**: > 99.8% crash-free user sessions.
2. **Match Integrity**: Zero corrupted match pairings or invalid tie-break calculations across 1,000 real-world simulated or played matches.
3. **Execution Latency**:
   - Standings calculation under 15ms for 32 players across 15 rounds.
   - Initial tournament match generation under 25ms.
4. **Firestore Availability**:
   - Zero unscheduled data loss incidents.
   - Optimistic rollback successfully restores state during simulated network interruptions.
5. **No Critical Security Vulnerabilities**:
   - All Firestore security rules pass the 100% negative/adversarial permission test matrix.
