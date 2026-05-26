import fs from "fs";
import path from "path";

export function resolveAndroidSdkRoot() {
  return process.env.ANDROID_SDK_ROOT || process.env.ANDROID_HOME || "";
}

export function resolveAdbPath() {
  const explicit = process.env.ADB_BIN;
  if (explicit && fs.existsSync(explicit)) return explicit;

  const sdkRoot = resolveAndroidSdkRoot();
  if (sdkRoot) {
    const ext = process.platform === "win32" ? ".exe" : "";
    const adbPath = path.join(sdkRoot, "platform-tools", `adb${ext}`);
    if (fs.existsSync(adbPath)) return adbPath;
  }

  return "adb";
}

export function resolveAaptPath() {
  const explicit = process.env.AAPT_BIN;
  if (explicit && fs.existsSync(explicit)) return explicit;

  const sdkRoot = resolveAndroidSdkRoot();
  if (sdkRoot) {
    const ext = process.platform === "win32" ? ".exe" : "";
    const aaptPath = path.join(sdkRoot, "build-tools", "35.0.0", `aapt${ext}`);
    if (fs.existsSync(aaptPath)) return aaptPath;
  }

  return "aapt";
}