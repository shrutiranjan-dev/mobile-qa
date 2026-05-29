import path from "path";
import fs from "fs";
import { spawn } from "child_process";
import { DefaultRuntimeHostAdapter, DockResult } from "./runtime-host-adapter";

let loggedHelperPath = false;

function resolveDockHelperPath() {
  const cwd = process.cwd();
  const candidateFromRepoRoot = path.resolve(cwd, "services", "host-agent", "native", "windows", "window-dock.ps1");
  const candidateFromHostAgentRoot = path.resolve(cwd, "native", "windows", "window-dock.ps1");
  if (fs.existsSync(candidateFromRepoRoot)) return candidateFromRepoRoot;
  if (fs.existsSync(candidateFromHostAgentRoot)) return candidateFromHostAgentRoot;
  return candidateFromRepoRoot;
}

function runDockHelper(args: string[]) {
  return new Promise<DockResult>((resolve) => {
    const helperPath = resolveDockHelperPath();
    if (!loggedHelperPath) {
      console.log(`[host-agent][native-dock] helperPath=${helperPath}`);
      loggedHelperPath = true;
    }
    if (!fs.existsSync(helperPath)) {
      resolve({
        ok: false,
        reason: "windows_dock_helper_missing",
        message: "Windows dock helper script not found.",
        expectedPath: helperPath
      } as DockResult & { expectedPath: string });
      return;
    }

    const psArgs = ["-ExecutionPolicy", "Bypass", "-File", helperPath, ...args];
    const child = spawn("powershell.exe", psArgs, { windowsHide: true });
    let out = "";
    let err = "";
    child.stdout.on("data", (chunk) => { out += chunk.toString(); });
    child.stderr.on("data", (chunk) => { err += chunk.toString(); });
    child.on("close", (code) => {
      try {
        const parsed = JSON.parse((out || "").trim() || "{}");
        resolve(parsed);
      } catch {
        resolve({
          ok: false,
          reason: "windows_dock_helper_failed",
          message: err || `window-dock helper exited with code ${code}`
        });
      }
    });
  });
}

export class WindowsAdapter extends DefaultRuntimeHostAdapter {
  async listEmulatorWindowCandidates(all = false): Promise<unknown> {
    return runDockHelper(["-Mode", "List", "-All", all ? "$true" : "$false"]);
  }

  async dockEmulatorWindow(payload: { serial?: string | null; avdName?: string | null; x: number; y: number; width: number; height: number }): Promise<DockResult> {
    return runDockHelper([
      "-Mode", "Dock",
      "-Serial", payload.serial || "",
      "-AvdName", payload.avdName || "",
      "-X", String(payload.x),
      "-Y", String(payload.y),
      "-Width", String(payload.width),
      "-Height", String(payload.height)
    ]);
  }

  async undockEmulatorWindow(payload: { serial?: string | null; avdName?: string | null }): Promise<DockResult> {
    return runDockHelper([
      "-Mode", "Undock",
      "-Serial", payload.serial || "",
      "-AvdName", payload.avdName || "",
      "-X", String(Number(process.env.NATIVE_DOCK_UNDOCK_X || 1200)),
      "-Y", String(Number(process.env.NATIVE_DOCK_UNDOCK_Y || 120)),
      "-Width", String(Number(process.env.NATIVE_DOCK_UNDOCK_WIDTH || 430)),
      "-Height", String(Number(process.env.NATIVE_DOCK_UNDOCK_HEIGHT || 760))
    ]);
  }
}
