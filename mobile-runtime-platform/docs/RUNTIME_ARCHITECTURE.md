# Runtime Architecture (Android MVP)

## Overview
This MVP uses a host-controlled Android runtime architecture with a strong path to containerized backend scaling.

- Electron desktop app = control panel UX
- Host Agent = OS runtime control (Android SDK CLI + emulator + adb)
- Backend API = upload/job/artifact API
- Android Worker = deterministic APK install/launch executor
- Android SDK CLI = actual Android runtime layer
- Docker (future) = backend/worker/redis isolation

Docker is intentionally not installed by this task.

## Services and Ports
- Desktop app: Electron shell (local UI)
- Host Agent: `http://localhost:5050`
- Backend API: `http://localhost:4000`
- Android Worker: `http://localhost:6060`

## Runtime Control Model
The emulator runs on host OS (Windows/Ubuntu), not inside Docker.

Host Agent responsibilities:
- Detect host OS (`windows`, `ubuntu`, `unsupported`)
- Read `ANDROID_SDK_ROOT`/`ANDROID_HOME`
- Resolve `adb`, `emulator`, `aapt`, `sdkmanager`, `avdmanager`
- List AVDs and devices
- Start emulator with lightweight deterministic args
- Stop emulator with `adb -s <serial> emu kill`
- Check boot completion using `adb shell getprop sys.boot_completed`

Guardrail:
- Do not start the same AVD twice. If emulator already running, return:
  - `{ "status": "already_running", "serial": "emulator-5554" }`

## Runtime Profiles
- `Android_Small_Clean_API_35` (2048 MB)
- `Android_Small_GApps_API_35` (2048 MB)
- `Android_Standard_Clean_API_35` (3072 MB)
- `Android_Standard_GApps_API_35` (3072 MB)

## Deterministic Worker Flow
For each runtime job:
1. Validate APK exists
2. Extract package name: `aapt dump badging`
3. Clear logcat
4. Install APK
5. Launch app with monkey launcher intent
6. Wait 5 seconds
7. Check process using `pidof`
8. Capture screenshot artifact
9. Capture logcat artifact
10. Detect crash signals and write `report.json`

Artifacts:
- `artifacts/jobs/<jobId>/report.json`
- `artifacts/jobs/<jobId>/screenshots/launch.png`
- `artifacts/jobs/<jobId>/logs/logcat.txt`

## Verified Host Commands
- `adb devices`
- `adb shell getprop sys.boot_completed`
- `adb exec-out screencap -p > test-launch.png`
- `adb -s emulator-5554 emu kill`

## Redis/BullMQ Readiness
Current MVP runs with in-memory job state and direct worker boundary.
Design is prepared to swap to Redis/BullMQ queue processing later.

## Out of Scope
- Appium/Maestro/AI/iOS
- Android Studio GUI
- BlueStacks/Nox/LDPlayer/Genymotion
- Docker installation