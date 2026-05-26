# DEAD_CODE_AUDIT

## Findings

| File | Symbol/Section | Reason | Reference Status | Classification | Suggested Action |
|---|---|---|---|---|---|
| `apps/desktop/src/renderer/app.js` | `sendTapFromPreview(event)` | Declared but never called; pointer flow uses `previewToDevicePoint` + direct tap/swipe posts. | No in-repo callers (`rg` only declaration). | SAFE_REMOVE | Remove function to reduce dead code. |
| `apps/desktop/src/preload.ts` + `apps/desktop/src/main.ts` | `uploadApk` IPC (`runtime:upload-apk`) | Renderer currently uploads with direct fetch in `uploadApkToBackend`; bridge method is unused. | No renderer callsites. | SAFE_REMOVE | Remove unused IPC handler and bridge exposure. |
| `services/host-agent/src/main.ts` | `/android/display/input/tap|swipe|keyevent` endpoints | Duplicates of active `/android/input/*` API; no in-repo callers. | No references outside main.ts. | SAFE_REMOVE | Remove duplicate legacy alias endpoints; keep `/android/input/*`. |
| `apps/desktop/src/preload.js` | legacy static bridge stub | Not used by runtime build path (tsc emits `build/preload.js` from `preload.ts`). | Not imported by source app path. | NEEDS_MANUAL_REVIEW | Keep for now; verify any external tooling reliance before deletion. |
| `apps/desktop/src/main.ts`, `apps/desktop/native/winembed/*` | Win32 SetParent native embed path | Intentionally retained behind `EMBED_MODE=force`; still referenced for experimental mode only. | Actively referenced in desktop main/renderer. | KEEP_EXPERIMENTAL | Keep, but preserve stream default and experimental labeling. |
| `services/host-agent/src/adapters/windows-adapter.ts` | alias re-export | Thin alias wrappers; currently no direct imports. | No direct imports found. | NEEDS_MANUAL_REVIEW | Keep pending platform abstraction roadmap decision. |
| `services/host-agent/src/adapters/ubuntu-adapter.ts` | alias re-export | Same as above. | No direct imports found. | NEEDS_MANUAL_REVIEW | Keep pending platform abstraction roadmap decision. |
| `apps/desktop/build/*`, `dist/*`, native `build/*` artifacts | generated build outputs checked in workspace | Generated files, but may be expected by local packaging workflow. | Not source of truth; generated. | NEEDS_MANUAL_REVIEW | Do not touch in this cleanup pass. |

## Legacy runtime profile references
- Search results: no stale references found for `Android_Clean_API_35` or `Android_GApps_API_35`.
- Status: KEEP_ACTIVE current profile names only.

## Dead backend/worker candidates
- No confirmed dead runtime execution paths found in active source.
- `JobStore` is in-memory by design (MVP); not dead code.
- Worker `reportPath/screenshotPath/logcatPath` repeated string construction appears intentional for each terminal branch.
- Classification: DANGEROUS_TO_REMOVE for core execution/report code.

## Dead scripts/docs candidates
- No obsolete smoke scripts found; both shell + powershell map to current endpoints.
- Docs largely consistent with stream-first path and current profile names.
- Classification: KEEP_ACTIVE.

## Dependency audit (conservative)
- No package removals performed in this pass.
- Potentially unused dev dep in desktop (`ts-node`) requires manual confirmation against local workflows.
- Classification: NEEDS_MANUAL_REVIEW.
