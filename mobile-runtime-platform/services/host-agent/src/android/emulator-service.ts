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

    const devices = await this.adbService.listDevices();
    const running = devices.find((d) => d.state === "device");
    if (running) {
      return {
        status: "already_running",
        serial: running.serial
      };
    }

    const profile = RUNTIME_PROFILES.find((p) => p.avdName === avdName);
    const memoryMb = profile?.memoryMb ?? 2048;

    const args = [
      "-avd",
      avdName,
      "-no-audio",
      "-no-boot-anim",
      "-no-metrics",
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
    const target = serial || devices.find((d) => d.state === "device")?.serial;
    if (!target) {
      return { status: "not_running" };
    }

    await this.adbService.exec(["-s", target, "emu", "kill"]);
    return { status: "stopping", serial: target };
  }
}