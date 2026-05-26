# APK Smoke Test (Android Runtime MVP)

## Purpose
Validate end-to-end Android runtime flow:
Upload APK -> create runtime job -> install -> launch -> process check -> screenshot -> logcat -> crash detection -> report + artifact serving.

## Required Services
- Host Agent: `http://localhost:5050`
- Backend API: `http://localhost:4000`
- Android Worker: `http://localhost:6060`
- Redis + Docker services (if using Docker mode)
- Host emulator running (`emulator-5554`)

## Verify Before Smoke Test (PowerShell)
```powershell
curl.exe http://localhost:5050/health
curl.exe http://localhost:4000/health
curl.exe http://localhost:6060/health
curl.exe http://localhost:5050/android/devices
```

## Run Smoke Test (PowerShell)
```powershell
.\scripts\smoke-test-apk.ps1 -ApkPath "G:\path\to\sample.apk"
```

Optional args:
```powershell
.\scripts\smoke-test-apk.ps1 -ApkPath "G:\path\to\sample.apk" -DeviceSerial "emulator-5554" -RuntimeProfile "Android_Small_Clean_API_35"
```

## Run Smoke Test (Ubuntu)
```bash
chmod +x scripts/smoke-test-apk.sh
./scripts/smoke-test-apk.sh /path/to/sample.apk emulator-5554 Android_Small_Clean_API_35
```

## Regression Checks
Use these to verify `/apps/upload` always returns a worker-readable absolute `apkPath` and to prevent the old `uploads\\...` regression.

### PowerShell
```powershell
.\scripts\check-upload-path.ps1 -ApkPath "G:\path\to\sample.apk"
```

Docker-mode assertion (`apkPath` must start with `/app/uploads/`):
```powershell
.\scripts\check-upload-path.ps1 -ApkPath "G:\path\to\sample.apk" -DockerMode
```

### Ubuntu
```bash
chmod +x scripts/check-upload-path.sh
./scripts/check-upload-path.sh /path/to/sample.apk emulator-5554 Android_Small_Clean_API_35 false
```

Docker-mode assertion:
```bash
./scripts/check-upload-path.sh /path/to/sample.apk emulator-5554 Android_Small_Clean_API_35 true
```

## Run From Electron UI
1. Open desktop app (`npm run start:desktop`).
2. Click `Refresh Status`.
3. Confirm runtime profile list and device presence.
4. Choose APK file with file picker.
5. Click `Upload & Run`.
6. Wait for status polling to reach `passed`/`failed`/`blocked`.
7. Open artifact links shown in UI:
- report.json
- launch.png
- logcat.txt

## Expected Artifacts
- `artifacts/jobs/<jobId>/report.json`
- `artifacts/jobs/<jobId>/screenshots/launch.png`
- `artifacts/jobs/<jobId>/logs/logcat.txt`

Served through backend:
- `GET /artifacts/jobs/:jobId/report.json`
- `GET /artifacts/jobs/:jobId/screenshots/launch.png`
- `GET /artifacts/jobs/:jobId/logs/logcat.txt`

## Common Failures
- no device:
  - `GET /android/devices` missing `emulator-5554`.
- bootCompleted false:
  - wait for emulator boot to finish.
- apk install failed:
  - verify APK compatibility and logcat details.
- package name not found:
  - `aapt dump badging` failed; ensure valid APK.
- app process not running:
  - app may crash on launch, check logcat.
- screenshot failed:
  - confirm `adb exec-out screencap -p` works manually.
- logcat failed:
  - check adb connectivity.
- worker cannot reach adb:
  - verify host adb server and Docker host mapping.
- aapt missing:
  - ensure worker image has `aapt` installed.
- artifact 404:
  - check artifact path, worker write permissions, and job status.
