import { spawn } from "child_process";
import { promisify } from "util";
import { execFile } from "child_process";
import { RUNTIME_PROFILES } from "@mrp/shared-types";
import { AdbService } from "./adb-service";
import { AndroidSdkService } from "./android-sdk-service";

const execFileAsync = promisify(execFile);

export class EmulatorService {
  constructor(
    private readonly sdkService = new AndroidSdkService(),
    private readonly adbService = new AdbService()
  ) {}

  async listAvds(): Promise<string[]> {
    const status = this.sdkService.getStatus();
    if (!status.paths.emulatorPath) return [];

    try {
      const { stdout } = await execFileAsync(status.paths.emulatorPath, ["-list-avds"]);
      return stdout
        .split(/\r?\n/)
        .map((x) => x.trim())
        .filter(Boolean);
    } catch {
      return [];
    }
  }

  async startEmulator(avdName: string) {
    const status = this.sdkService.getStatus();
    if (!status.paths.emulatorPath) {
      throw new Error("Emulator path could not be resolved.");
    }

    await this.adbService.reconnectOffline().catch(() => undefined);
    let devices = await this.adbService.listDevices();
    let running = devices.find((d) => d.state === "device");
    if (running) {
      return {
        status: "already_running",
        serial: running.serial
      };
    }

    const staleOffline = devices.find((d) => d.serial.startsWith("emulator-") && d.state === "offline");
    if (staleOffline) {
      await this.adbService.reconnectOffline().catch(() => undefined);
      await this.adbService.restartServer().catch(() => undefined);
      devices = await this.adbService.listDevices();
      running = devices.find((d) => d.state === "device");
      if (running) {
        return {
          status: "already_running",
          serial: running.serial
        };
      }
      // Best-effort cleanup for stale offline emulator entry before spawning a new instance.
      await this.adbService.exec(["-s", staleOffline.serial, "emu", "kill"]).catch(() => undefined);
      await this.adbService.waitForDeviceGone(staleOffline.serial, 8000).catch(() => undefined);
    }

    const profile = RUNTIME_PROFILES.find((p) => p.avdName === avdName);
    const memoryMb = profile?.memoryMb ?? 2048;

    const args = [
      "-avd",
      avdName,
      "-no-audio",
      "-no-boot-anim",
      "-no-metrics",
      "-no-snapshot-load",
      "-no-snapshot-save",
      "-gpu",
      "swiftshader_indirect",
      "-memory",
      String(memoryMb),
      "-cores",
      "2"
    ];

    const proc = spawn(status.paths.emulatorPath, args, {
      detached: true,
      stdio: "ignore"
    });
    proc.unref();

    return {
      status: "starting",
      avdName,
      pid: proc.pid
    };
  }

  async stopEmulator(serial?: string) {
    const devices = await this.adbService.listDevices();
    const target = serial || devices.find((d) => d.state === "device")?.serial || devices.find((d) => d.serial.startsWith("emulator-"))?.serial;
    if (!target) {
      return { status: "not_running" };
    }

    await this.adbService.exec(["-s", target, "emu", "kill"]).catch(() => undefined);
    await this.adbService.waitForDeviceGone(target, 12000).catch(() => undefined);
    await this.adbService.reconnectOffline().catch(() => undefined);
    return { status: "stopping", serial: target };
  }
}
