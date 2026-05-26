# Android Runtime MVP - Project Progress

## Current Status (Verified)
- Host requirements are installed and working.
- Android SDK CLI runtime is operational (no Android Studio GUI).
- AVD profiles exist and are usable:
  - `Android_Small_Clean_API_35`
  - `Android_Small_GApps_API_35`
  - `Android_Standard_Clean_API_35`
  - `Android_Standard_GApps_API_35`
- Host Agent runs on `http://localhost:5050`.
- Backend API runs on `http://localhost:4000`.
- Android Worker runs on `http://localhost:6060`.
- Docker runtime services (backend/worker/redis) are working.
- APK smoke test flow is proven:
  - Upload APK
  - Create job
  - Install + launch app
  - Capture screenshot/logcat
  - Generate `report.json`
- Electron desktop UI is working with runtime controls and APK run workflow.

## Confirmed Runtime Health Checks
```powershell
curl.exe http://localhost:5050/health
curl.exe http://localhost:4000/health
curl.exe http://localhost:6060/health
curl.exe http://localhost:5050/android/devices
```

Expected healthy device state:
- `serial: emulator-5554`
- `state: device`
- `bootCompleted: true`

## Emulator Workspace State
- Emulator workspace supports remote display frame rendering from host-agent.
- Input controls are connected (tap/swipe/navigation buttons).
- If emulator is `offline`, stream cannot render by design (ADB limitation).

## Known Recovery Procedure (ADB Offline)
If `adb devices` shows `emulator-5554 offline`:

```powershell
cd "G:\Office work\new-runtime-android\mobile-runtime-platform"
node tools/android-cli.js adb kill-server
taskkill /F /IM emulator.exe /T
taskkill /F /IM qemu-system-x86_64.exe /T
Remove-Item "$env:USERPROFILE\.android\avd\*.lock" -Recurse -Force -ErrorAction SilentlyContinue
node tools/android-cli.js adb start-server
npm run start:host-agent
```

Then in another terminal:
```powershell
npm run emu:start:small:clean
node tools/android-cli.js adb devices
node tools/android-cli.js adb shell getprop sys.boot_completed
```

## Run Order (Recommended)
1. Start Host Agent:
```powershell
npm run start:host-agent
```
2. Start Docker services (if backend/worker are containerized):
```powershell
npm run docker:windows
```
3. Start emulator:
```powershell
npm run emu:start:small:clean
```
4. Open desktop app:
```powershell
npm run desktop:dev
```

## Scope Guardrails (Still Enforced)
- Do not install Docker from project scripts.
- Do not run emulator inside Docker.
- Do not add Android Studio GUI.
- Do not add Appium/Maestro/AI/iOS to MVP runtime path.

