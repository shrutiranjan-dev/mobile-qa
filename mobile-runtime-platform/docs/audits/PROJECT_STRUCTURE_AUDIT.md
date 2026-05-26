# PROJECT_STRUCTURE_AUDIT

## 1. Active architecture map
- Electron Desktop (`apps/desktop`): runtime cockpit UI + IPC bridge + optional experimental native embed controls.
- Host Agent (`services/host-agent`): host OS Android SDK/ADB/emulator control plane and stream/input endpoints.
- Backend API (`services/backend-api`): APK upload endpoint, runtime job creation/polling, artifact serving.
- Android Worker (`services/android-worker`): deterministic APK runtime executor and report/artifact generator.
- Redis/Docker (`docker/*`): container orchestration for backend/worker + redis health/dependency flow.
- Android SDK CLI / ADB / Emulator: host-side runtime substrate used by host-agent and worker adb/aapt path resolution.

## 2. Active runtime flow
1. Electron preflight checks host-agent/backend/worker health.
2. Host Agent lists AVD/device state, starts/stops emulator, returns bootCompleted and stream frame.
3. Backend `/apps/upload` stores APK under `uploads/`.
4. Backend `/runtime/android/run` creates queued job and dispatches worker `/run`.
5. Worker installs APK, launches app, checks process, captures screenshot/logcat, builds report.
6. Backend exposes runtime job status via `/runtime/jobs/:jobId`.
7. Backend serves artifact files (`report.json`, `launch.png`, `logcat.txt`).
8. Electron polls job and renders timeline/results/artifacts while showing live embedded stream.

## 3. Active API map

### Host Agent (`services/host-agent/src/main.ts`)
- `GET /health`
- `GET /host/info`
- `GET /android/sdk/status`
- `GET /android/avds`
- `GET /android/devices`
- `POST /android/emulator/start`
- `POST /android/emulator/stop`
- `GET /android/display/frame`
- `GET /android/display/metrics`
- `POST /android/input/tap`
- `POST /android/input/swipe`
- `POST /android/input/text`
- `POST /android/input/keyevent`
- `GET /android/device/:serial/screenshot-now`
- `POST /android/device/:serial/screenshot-now`
- `POST /android/app/restart`
- `POST /android/device/rotate`

### Backend API
- `GET /health`
- `POST /apps/upload`
- `POST /runtime/android/run`
- `GET /runtime/jobs/:jobId`
- `GET /artifacts/jobs/:jobId/report.json`
- `GET /artifacts/jobs/:jobId/screenshots/launch.png`
- `GET /artifacts/jobs/:jobId/logs/logcat.txt`

### Android Worker
- `GET /health`
- `POST /run`

## 4. Active UI flow (`apps/desktop/src/renderer/*`)
- Preflight refresh (service checks + sdk/avd/device checks).
- Emulator status + stream state badges.
- Streaming emulator view inside device frame.
- APK file selection.
- Upload and run trigger (`/apps/upload` + `/runtime/android/run`).
- Job polling (`/runtime/jobs/:jobId`).
- Artifact display/open/copy links.
- Debug panels (service config, raw preflight/job json).

## 5. Active files (must not delete)
- `apps/desktop/src/main.ts`
- `apps/desktop/src/preload.ts`
- `apps/desktop/src/renderer/index.html`
- `apps/desktop/src/renderer/app.js`
- `apps/desktop/src/renderer/style.css`
- `services/host-agent/src/main.ts`
- `services/host-agent/src/android/*`
- `services/backend-api/src/main.ts`
- `services/backend-api/src/routes/*`
- `services/backend-api/src/services/*`
- `services/android-worker/src/main.ts`
- `services/android-worker/src/runtime/*`
- `services/android-worker/src/report/*`
- `packages/shared-types/src/index.ts`
- `scripts/smoke-test-apk.ps1`
- `scripts/smoke-test-apk.sh`
- `docker/docker-compose*.yml`

## 6. Active scripts
### Root scripts (`package.json`)
- `start:host-agent`, `start:backend`, `start:worker`, `start:desktop`
- `desktop:dev`, `desktop:build`, `desktop:build:win`, `desktop:build:linux`, `desktop:pack`, `desktop:dist`
- `dev`
- `docker:windows`, `docker:ubuntu`, `docker:down`, `docker:logs`
- `emu:start:small:clean`, `emu:start:small:gapps`, `emu:start:standard:clean`, `emu:start:standard:gapps`
- `emu:stop`, `emu:list`, `adb:devices`, `adb:start-server`

### Smoke scripts
- `scripts/smoke-test-apk.ps1`
- `scripts/smoke-test-apk.sh`

## 7. Critical paths
- Upload path: `uploads/`
- Artifact path: `artifacts/jobs/<jobId>/...`
- SDK env/path resolution: `ANDROID_SDK_ROOT`, `ANDROID_HOME`, optional `ADB_BIN`, `AAPT_BIN`
- AVD profile names (shared types):
  - `Android_Small_Clean_API_35`
  - `Android_Small_GApps_API_35`
  - `Android_Standard_Clean_API_35`
  - `Android_Standard_GApps_API_35`
- Docker mounted volumes:
  - `../uploads:/app/uploads`
  - `../artifacts:/app/artifacts`

## 8. Must-preserve list
- Worker execution sequence in `services/android-worker/src/runtime/android-runtime-executor.ts`.
- Backend job creation/poll APIs in `services/backend-api/src/routes/runtime.routes.ts`.
- Artifact endpoints in `services/backend-api/src/routes/artifacts.routes.ts`.
- Host-agent device/emulator/status endpoints in `services/host-agent/src/main.ts`.
- Stream display + input forwarding + upload/run flow in `apps/desktop/src/renderer/app.js`.
- Smoke scripts and Docker compose files.
