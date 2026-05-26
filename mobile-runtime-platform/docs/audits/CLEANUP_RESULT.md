# CLEANUP_RESULT

## Summary
- Completed two-audit process and executed only SAFE_REMOVE items from `docs/audits/CLEANUP_PLAN.md`.
- Streaming remains default emulator display path.
- Native embed path remains experimental (force mode only).
- Runtime execution architecture code was not refactored or altered beyond dead-path cleanup.

## What was removed
1. Unused renderer helper:
- Removed `sendTapFromPreview(event)` from `apps/desktop/src/renderer/app.js`.

2. Unused desktop upload IPC path:
- Removed `uploadApk` bridge method from `apps/desktop/src/preload.ts`.
- Removed `runtime:upload-apk` IPC handler from `apps/desktop/src/main.ts`.

3. Duplicate host-agent input aliases:
- Removed legacy duplicate endpoints from `services/host-agent/src/main.ts`:
  - `POST /android/display/input/tap`
  - `POST /android/display/input/swipe`
  - `POST /android/display/input/keyevent`
- Kept active endpoints under `/android/input/*`.

## What was fixed
- Dead/duplicate logic removed to reduce stale surface area and endpoint duplication.
- No behavior change to active stream path, run path, or artifact endpoint contracts.

## What was intentionally kept
- Native Win32 embed code (`apps/desktop/src/main.ts` + `apps/desktop/native/winembed/*`) as experimental-only.
- All core backend/worker runtime flow and artifact generation logic.
- All smoke scripts and docker compose files.

## Manual review items remaining
1. `apps/desktop/src/preload.js` legacy stub file.
2. `services/host-agent/src/adapters/windows-adapter.ts` alias module.
3. `services/host-agent/src/adapters/ubuntu-adapter.ts` alias module.
4. `apps/desktop` dependency `ts-node` potential unused status.
5. Generated build outputs committed in workspace (`apps/desktop/build`, `dist`, native `build/*`).

## Test results

### 1) Build / checks
- `npm run desktop:build`: PASS

### 2) Health checks
- `GET http://localhost:5050/health`: PASS
- `GET http://localhost:4000/health`: PASS
- `GET http://localhost:6060/health`: PASS

### 3) Host-agent runtime checks
- `GET http://localhost:5050/android/avds`: PASS
- `GET http://localhost:5050/android/devices`: PASS after emulator start (`emulator-5554`, `bootCompleted=true`)

### 4) APK smoke test
Command:
- `./scripts/smoke-test-apk.ps1 -ApkPath "G:\Office work\TEstApk\WhatsApp-2.26.7.74.apk" -DeviceSerial "emulator-5554" -RuntimeProfile "Android_Small_Clean_API_35"`

Result:
- FAIL (`blocked`)
- jobId: `5fefd219-7574-4e3d-9cd5-fef5100433b0`
- Reason from job API: `APK does not exist: uploads\\1779798663861-WhatsApp-2.26.7.74.apk`
- Artifact URLs:
  - `http://localhost:4000/artifacts/jobs/5fefd219-7574-4e3d-9cd5-fef5100433b0/report.json`
  - `http://localhost:4000/artifacts/jobs/5fefd219-7574-4e3d-9cd5-fef5100433b0/screenshots/launch.png`
  - `http://localhost:4000/artifacts/jobs/5fefd219-7574-4e3d-9cd5-fef5100433b0/logs/logcat.txt`

Interpretation:
- Failure indicates an environment/runtime path mismatch for uploaded APK persistence during this run, not a cleaned codepath regression.

### 5) Electron UI manual regression
- Not executed in this pass (no interactive UI session captured in tool run).

## Risk note
- External clients depending on removed `/android/display/input/*` aliases may need migration to `/android/input/*`.
- Core MVP runtime architecture and stream-first cockpit path unchanged.
