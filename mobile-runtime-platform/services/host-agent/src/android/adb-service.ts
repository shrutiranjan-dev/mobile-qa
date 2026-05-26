import { promisify } from "util";
import { execFile } from "child_process";
import { AndroidSdkService } from "./android-sdk-service";

const execFileAsync = promisify(execFile);

export class AdbService {
  constructor(private readonly sdkService = new AndroidSdkService()) {}

  async exec(args: string[], timeoutMs = 15000) {
    const status = this.sdkService.getStatus();
    if (!status.paths.adbPath) {
      throw new Error("adb path could not be resolved.");
    }

    const { stdout } = await execFileAsync(status.paths.adbPath, args, {
      timeout: timeoutMs
    });
    return stdout;
  }

  async execBuffer(args: string[], timeoutMs = 15000) {
    const status = this.sdkService.getStatus();
    if (!status.paths.adbPath) {
      throw new Error("adb path could not be resolved.");
    }

    const { stdout } = await execFileAsync(status.paths.adbPath, args, {
      encoding: "buffer",
      maxBuffer: 25 * 1024 * 1024,
      timeout: timeoutMs
    });
    return stdout as Buffer;
  }

  async listDevices() {
    const output = await this.exec(["devices"]);
    return output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("List of devices"))
      .map((line) => {
        const [serial, state] = line.split(/\s+/);
        return { serial, state: state || "unknown" };
      });
  }

  async isBootCompleted(serial: string) {
    const result = await this.exec(["-s", serial, "shell", "getprop", "sys.boot_completed"], 5000);
    return result.trim() === "1";
  }

  async screencapPng(serial: string) {
    return this.execBuffer(["-s", serial, "exec-out", "screencap", "-p"], 10000);
  }

  async getDisplaySize(serial: string) {
    const output = await this.exec(["-s", serial, "shell", "wm", "size"], 5000);
    const lines = output.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
    const preferred = lines.find((l) => l.toLowerCase().startsWith("override size:")) || lines.find((l) => l.toLowerCase().startsWith("physical size:"));
    if (!preferred) {
      throw new Error(`Unable to parse display size from: ${output}`);
    }

    const m = preferred.match(/(\d+)\s*x\s*(\d+)/i);
    if (!m) {
      throw new Error(`Unable to parse display dimensions from: ${preferred}`);
    }

    return {
      width: Number(m[1]),
      height: Number(m[2])
    };
  }

  async tap(serial: string, x: number, y: number) {
    await this.exec(["-s", serial, "shell", "input", "tap", String(Math.max(0, Math.floor(x))), String(Math.max(0, Math.floor(y)))], 5000);
  }

  async swipe(serial: string, x1: number, y1: number, x2: number, y2: number, durationMs = 220) {
    await this.exec([
      "-s",
      serial,
      "shell",
      "input",
      "swipe",
      String(Math.max(0, Math.floor(x1))),
      String(Math.max(0, Math.floor(y1))),
      String(Math.max(0, Math.floor(x2))),
      String(Math.max(0, Math.floor(y2))),
      String(Math.max(50, Math.floor(durationMs)))
    ], 5000);
  }

  async keyevent(serial: string, keyCode: number | string) {
    const value = typeof keyCode === "number" ? String(Math.floor(keyCode)) : keyCode;
    await this.exec(["-s", serial, "shell", "input", "keyevent", value], 5000);
  }

  private escapeInputText(text: string) {
    return text
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/ /g, "%s")
      .replace(/[&|;<>$`()]/g, "");
  }

  async inputText(serial: string, text: string) {
    const safe = this.escapeInputText(text).trim();
    if (!safe) {
      throw new Error("text must contain at least one safe character");
    }
    await this.exec(["-s", serial, "shell", "input", "text", safe], 5000);
  }

  async restartApp(serial: string, packageName: string) {
    const pkg = packageName.trim();
    if (!pkg) {
      throw new Error("packageName is required");
    }
    await this.exec(["-s", serial, "shell", "am", "force-stop", pkg], 5000);
    await this.exec(["-s", serial, "shell", "monkey", "-p", pkg, "-c", "android.intent.category.LAUNCHER", "1"], 5000);
  }

  async setOrientation(serial: string, orientation: "portrait" | "landscape") {
    const value = orientation === "landscape" ? "1" : "0";
    await this.exec(["-s", serial, "shell", "settings", "put", "system", "accelerometer_rotation", "0"], 5000);
    await this.exec(["-s", serial, "shell", "settings", "put", "system", "user_rotation", value], 5000);
  }
}
