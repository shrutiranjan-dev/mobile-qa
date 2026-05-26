#!/usr/bin/env node
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

function getSdkRoot() {
  const fromEnv = process.env.ANDROID_SDK_ROOT || process.env.ANDROID_HOME;
  if (fromEnv) return fromEnv;
  if (process.platform === "win32") return "C:\\Android\\Sdk";
  return "/opt/android-sdk";
}

function resolveTool(tool) {
  const sdkRoot = getSdkRoot();
  const isWin = process.platform === "win32";

  const candidates = [];
  if (tool === "adb") {
    candidates.push(path.join(sdkRoot, "platform-tools", isWin ? "adb.exe" : "adb"));
  } else if (tool === "emulator") {
    candidates.push(path.join(sdkRoot, "emulator", isWin ? "emulator.exe" : "emulator"));
  }

  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }

  return tool;
}

const [, , tool, ...args] = process.argv;
if (!tool || !["adb", "emulator"].includes(tool)) {
  console.error("Usage: node tools/android-cli.js <adb|emulator> [...args]");
  process.exit(1);
}

const command = resolveTool(tool);
const result = spawnSync(command, args, { stdio: "inherit", shell: false });

if (result.error) {
  console.error(`[ERROR] Failed to run ${tool}: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);