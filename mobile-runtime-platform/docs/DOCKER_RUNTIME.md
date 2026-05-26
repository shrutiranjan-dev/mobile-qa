# Docker Runtime Guide (Android Runtime MVP)

## Scope
This Docker setup runs only:
- `redis`
- `backend-api`
- `android-worker`

Host Agent is intentionally **outside Docker**.

## What Runs On Host (Not Docker)
- `host-agent` service (`http://localhost:5050`)
- Android SDK CLI (`adb`, `emulator`, `sdkmanager`, `avdmanager`)
- Android Emulator process
- ADB server (`adb start-server`)

## What Runs In Docker
- Redis (`6379`)
- Backend API (`4000`)
- Android Worker (`6060`)

## Why Emulator Stays Outside Docker
The emulator is intentionally outside Docker to avoid nested virtualization complexity and keep runtime lightweight and stable.

## Compose Files
- Base: `docker/docker-compose.yml`
- Windows override: `docker/docker-compose.windows.yml`
- Ubuntu override: `docker/docker-compose.ubuntu.yml`

## Shared Volumes
Backend and worker share:
- `../uploads` -> `/app/uploads`
- `../artifacts` -> `/app/artifacts`

This ensures uploaded APKs and generated artifacts are visible to both services.

## Windows Run Order
1. Start Host Agent on host:
```bash
npm run start:host-agent
```

2. Start ADB server on host:
```bash
adb start-server
```

3. Start emulator on host (example):
```bash
emulator -avd Android_Small_Clean_API_35 -no-audio -no-boot-anim -no-metrics -gpu swiftshader_indirect -memory 2048 -cores 2
```

4. Verify host runtime:
```bash
adb devices
adb shell getprop sys.boot_completed
```

5. Start Docker runtime stack:
```bash
npm run docker:windows
```

6. Verify health:
```bash
curl http://localhost:4000/health
curl http://localhost:6060/health
curl http://localhost:5050/health
```

## Ubuntu Run Order
1. Start Host Agent on host:
```bash
npm run start:host-agent
```

2. Start ADB server and emulator on host.

3. Verify host runtime:
```bash
adb start-server
adb devices
adb shell getprop sys.boot_completed
```

4. Start Docker runtime stack:
```bash
npm run docker:ubuntu
```

5. Verify health:
```bash
curl http://localhost:4000/health
curl http://localhost:6060/health
curl http://localhost:5050/health
```

## Troubleshooting
### `host.docker.internal` not resolving
- Ubuntu may require host-gateway mapping. This is already provided in `docker-compose.ubuntu.yml` via `extra_hosts`.
- If your Docker engine does not support `host-gateway`, replace `HOST_AGENT_URL` with your host IP (for example `172.17.0.1`).

### ADB not reachable from worker
- Ensure host adb server is running: `adb start-server`.
- Worker is configured with `ADB_SERVER_SOCKET=tcp:host.docker.internal:5037`.
- Confirm host port 5037 is reachable from container networking.

### Emulator not visible
- Emulator must run on host, not container.
- Confirm host sees it with `adb devices`.
- Confirm host-agent can list devices (`GET /android/devices`).

### Permission/path issues for uploads/artifacts
- Confirm `mobile-runtime-platform/uploads` and `mobile-runtime-platform/artifacts` exist.
- Check container logs for file permission errors.

### `aapt` not found in worker
- Worker image installs `aapt` package.
- Verify in container: `docker compose -f docker/docker-compose.yml exec android-worker which aapt`.

### Backend cannot call worker
- Check `ANDROID_WORKER_URL=http://android-worker:6060`.
- Check worker health: `curl http://localhost:6060/health`.

### Backend cannot call host-agent
- Check `HOST_AGENT_URL` in compose override.
- Confirm host-agent is running at `http://localhost:5050/health`.

### Redis connection failed
- Confirm redis container is healthy.
- Check logs:
```bash
docker compose -f docker/docker-compose.yml logs -f redis
```

## Commands
Windows:
```bash
docker compose -f docker/docker-compose.yml -f docker/docker-compose.windows.yml up --build
```

Ubuntu:
```bash
docker compose -f docker/docker-compose.yml -f docker/docker-compose.ubuntu.yml up --build
```

Down:
```bash
docker compose -f docker/docker-compose.yml down
```