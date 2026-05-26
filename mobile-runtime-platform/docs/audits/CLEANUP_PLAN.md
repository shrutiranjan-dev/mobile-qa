# CLEANUP_PLAN

## 1. Items to remove now (SAFE_REMOVE)
1. Remove unused `sendTapFromPreview` in renderer.
2. Remove unused `runtime:upload-apk` IPC handler and preload bridge method.
3. Remove duplicate host-agent legacy alias endpoints:
   - `POST /android/display/input/tap`
   - `POST /android/display/input/swipe`
   - `POST /android/display/input/keyevent`

## 2. Items to keep
1. All runtime execution paths in backend/worker.
2. All stream display/input endpoints under `/android/input/*`, `/android/display/frame`, `/android/display/metrics`.
3. APK upload/run flow and artifact serving endpoints.
4. Smoke scripts, Docker files, shared runtime profiles.

## 3. Items to keep experimental
1. Native Win32 embed bridge and SetParent path in desktop main/native addon.
2. Runtime UI mode switching logic gated by `EMBED_MODE=force`.

## 4. Items needing manual review
1. `apps/desktop/src/preload.js` legacy stub file.
2. `services/host-agent/src/adapters/windows-adapter.ts` alias.
3. `services/host-agent/src/adapters/ubuntu-adapter.ts` alias.
4. Desktop dev dependency `ts-node` potential unused status.
5. Checked-in generated artifacts under `apps/desktop/build`, `dist`, native `build`.

## 5. Files to modify
- `apps/desktop/src/renderer/app.js`
- `apps/desktop/src/preload.ts`
- `apps/desktop/src/main.ts`
- `services/host-agent/src/main.ts`
- `docs/audits/CLEANUP_RESULT.md` (post-run)

## 6. Tests to run after cleanup batches
1. `npm run desktop:build`
2. Service health checks:
   - `http://localhost:5050/health`
   - `http://localhost:4000/health`
   - `http://localhost:6060/health`
3. Host-agent runtime checks:
   - `GET /android/avds`
   - `GET /android/devices`
4. Smoke test:
   - `./scripts/smoke-test-apk.ps1 -ApkPath "G:\Office work\TEstApk\WhatsApp-2.26.7.74.apk" -DeviceSerial "emulator-5554" -RuntimeProfile "Android_Small_Clean_API_35"`

## 7. Rollback risk
- Low to moderate.
- Main risk: external callers relying on removed alias endpoints or upload IPC.
- Mitigation: keep all primary endpoints and runtime flow unchanged; run build + smoke test; rollback by restoring deleted blocks if regression appears.
