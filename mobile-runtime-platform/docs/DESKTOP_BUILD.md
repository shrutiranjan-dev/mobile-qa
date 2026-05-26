# Desktop Build and Packaging (Electron)

## Scope
Electron desktop app is a control panel only.

## What The Electron Package Includes
- Electron main process
- Electron preload bridge
- Renderer UI (status, runtime controls, upload/run, artifacts preview)

## What The Electron Package Does NOT Include
- Android SDK
- Android Emulator / AVDs
- Docker engine
- Redis, backend-api, android-worker, host-agent binaries

## External Runtime Dependencies (Required)
- host-agent
- backend-api
- android-worker
- redis
- Android SDK CLI on host
- Android emulator on host

## Service URL Configuration
Default URLs used by desktop app:
- `HOST_AGENT_URL=http://localhost:5050`
- `BACKEND_API_URL=http://localhost:4000`
- `WORKER_URL=http://localhost:6060`

Override them with environment variables before launching desktop app.

## Commands
From `mobile-runtime-platform`:

Development app:
```bash
npm run desktop:dev
```

TypeScript desktop build:
```bash
npm run desktop:build
```

Windows package build (NSIS + portable):
```bash
npm run desktop:build:win
```

Ubuntu/Linux package build (AppImage + deb):
```bash
npm run desktop:build:linux
```

Optional unpacked build:
```bash
npm run desktop:pack
```

## Runtime Run Order
1. Start host-agent.
2. Start Docker services (backend-api, android-worker, redis).
3. Start emulator on host.
4. Open Electron app.
5. Upload and run APK from UI.

## Output Folder
Packaged artifacts are written to:
- `mobile-runtime-platform/dist/desktop/`

## Troubleshooting
### Host Agent offline
- Check `http://localhost:5050/health`.

### Backend offline
- Check `http://localhost:4000/health`.

### Worker offline
- Check `http://localhost:6060/health`.

### No emulator device
- Verify with `adb devices` and host-agent `/android/devices`.

### Artifact links not opening
- Ensure backend artifacts endpoints return 200.

### Windows unsigned installer warning
- Expected for unsigned local build. Continue after trust prompt.

### Linux AppImage permission issue
- Run: `chmod +x <AppImage>` then execute.

### Missing Linux dependencies
- Install desktop runtime libs required by Electron on Ubuntu if launch fails.