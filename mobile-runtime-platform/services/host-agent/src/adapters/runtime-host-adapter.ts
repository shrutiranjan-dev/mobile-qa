import os from "os";
import path from "path";
import { HostOs } from "@mrp/shared-types";

export type RuntimeHostAdapter = {
  getHostOs(): HostOs;
  getSdkRoot(): string | null;
  resolveToolPaths(): {
    sdkRoot: string | null;
    adbPath: string | null;
    emulatorPath: string | null;
    aaptPath: string | null;
    sdkmanagerPath: string | null;
    avdmanagerPath: string | null;
  };
  dockEmulatorWindow(payload: { serial?: string | null; avdName?: string | null; x: number; y: number; width: number; height: number }): Promise<DockResult>;
  undockEmulatorWindow(payload: { serial?: string | null; avdName?: string | null }): Promise<DockResult>;
};

export type DockResult = {
  ok: boolean;
  reason?: string;
  message: string;
  windowTitle?: string;
  bounds?: { x: number; y: number; width: number; height: number };
};

const BUILD_TOOLS_VERSION = "35.0.0";

export class DefaultRuntimeHostAdapter implements RuntimeHostAdapter {
  getHostOs(): HostOs {
    const platform = os.platform();
    if (platform === "win32") return "windows";
    if (platform === "linux") return "ubuntu";
    return "unsupported";
  }

  getSdkRoot(): string | null {
    const fromEnv = process.env.ANDROID_SDK_ROOT || process.env.ANDROID_HOME;
    if (fromEnv) return fromEnv;

    const hostOs = this.getHostOs();
    if (hostOs === "windows") return "C:\\Android\\Sdk";
    if (hostOs === "ubuntu") return "/opt/android-sdk";
    return null;
  }

  resolveToolPaths() {
    const sdkRoot = this.getSdkRoot();
    if (!sdkRoot) {
      return {
        sdkRoot: null,
        adbPath: null,
        emulatorPath: null,
        aaptPath: null,
        sdkmanagerPath: null,
        avdmanagerPath: null
      };
    }

    const isWindows = this.getHostOs() === "windows";
    const ext = isWindows ? ".exe" : "";
    const bat = isWindows ? ".bat" : "";

    return {
      sdkRoot,
      adbPath: path.join(sdkRoot, "platform-tools", `adb${ext}`),
      emulatorPath: path.join(sdkRoot, "emulator", `emulator${ext}`),
      aaptPath: path.join(sdkRoot, "build-tools", BUILD_TOOLS_VERSION, `aapt${ext}`),
      sdkmanagerPath: path.join(sdkRoot, "cmdline-tools", "latest", "bin", `sdkmanager${bat}`),
      avdmanagerPath: path.join(sdkRoot, "cmdline-tools", "latest", "bin", `avdmanager${bat}`)
    };
  }

  async dockEmulatorWindow(_payload: { serial?: string | null; avdName?: string | null; x: number; y: number; width: number; height: number }): Promise<DockResult> {
    return {
      ok: false,
      reason: "native_dock_not_supported_on_this_host",
      message: "Native dock is not supported on this host."
    };
  }

  async undockEmulatorWindow(_payload: { serial?: string | null; avdName?: string | null }): Promise<DockResult> {
    return {
      ok: false,
      reason: "native_dock_not_supported_on_this_host",
      message: "Native undock is not supported on this host."
    };
  }
}
