import fs from "fs";
import { resolveAaptPath } from "./adb";
import { runShellText } from "./shell";

export async function extractPackageName(apkPath: string): Promise<string> {
  if (!fs.existsSync(apkPath)) {
    throw new Error(`APK not found: ${apkPath}`);
  }

  const aaptPath = resolveAaptPath();
  const { stdout } = await runShellText(aaptPath, ["dump", "badging", apkPath]);
  const match = stdout.match(/package: name='([^']+)'/);
  if (!match) {
    throw new Error("Could not extract package name from APK using aapt dump badging.");
  }

  return match[1];
}