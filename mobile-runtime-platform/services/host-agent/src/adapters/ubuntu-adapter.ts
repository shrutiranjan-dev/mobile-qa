import { spawnSync } from "child_process";
import { DefaultRuntimeHostAdapter, DockResult } from "./runtime-host-adapter";

function hasTool(name: string) {
  const result = spawnSync("bash", ["-lc", `command -v ${name}`], { encoding: "utf8" });
  return result.status === 0;
}

export class UbuntuAdapter extends DefaultRuntimeHostAdapter {
  async dockEmulatorWindow(payload: { serial?: string | null; avdName?: string | null; x: number; y: number; width: number; height: number }): Promise<DockResult> {
    if (!hasTool("wmctrl") && !hasTool("xdotool")) {
      return {
        ok: false,
        reason: "native_dock_requires_wmctrl_or_xdotool_on_ubuntu",
        message: "Install wmctrl/xdotool and use X11. Wayland may block window positioning."
      };
    }
    if (hasTool("wmctrl")) {
      const cmd = `wmctrl -r "Android Emulator" -e 0,${payload.x},${payload.y},${payload.width},${payload.height}`;
      const result = spawnSync("bash", ["-lc", cmd], { encoding: "utf8" });
      return result.status === 0
        ? { ok: true, message: "Emulator window docked", bounds: payload }
        : { ok: false, reason: "emulator_window_not_found", message: result.stderr || "wmctrl could not move emulator window." };
    }
    const result = spawnSync("bash", ["-lc", `xdotool search --name "Android Emulator" | head -n 1`], { encoding: "utf8" });
    const id = (result.stdout || "").trim();
    if (!id) return { ok: false, reason: "emulator_window_not_found", message: "Could not find Android Emulator window." };
    const move = spawnSync("bash", ["-lc", `xdotool windowmove ${id} ${payload.x} ${payload.y}; xdotool windowsize ${id} ${payload.width} ${payload.height}`], { encoding: "utf8" });
    return move.status === 0
      ? { ok: true, message: "Emulator window docked", bounds: payload }
      : { ok: false, reason: "emulator_window_not_found", message: move.stderr || "xdotool could not move emulator window." };
  }

  async undockEmulatorWindow(payload: { serial?: string | null; avdName?: string | null }): Promise<DockResult> {
    return this.dockEmulatorWindow({
      serial: payload.serial,
      avdName: payload.avdName,
      x: Number(process.env.NATIVE_DOCK_UNDOCK_X || 1200),
      y: Number(process.env.NATIVE_DOCK_UNDOCK_Y || 120),
      width: Number(process.env.NATIVE_DOCK_UNDOCK_WIDTH || 430),
      height: Number(process.env.NATIVE_DOCK_UNDOCK_HEIGHT || 760)
    });
  }
}
