import fs from "fs";
import path from "path";
import { extractPackageName } from "./apk";
import { resolveAdbPath } from "./adb";
import { runShellBuffer, runShellText } from "./shell";
import { ensureJobArtifactDirs } from "./artifact-manager";
import { buildReport, RuntimeStep } from "../report/report-builder";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type ExecuteRuntimeInput = {
  jobId: string;
  apkPath: string;
  runtimeProfile: string;
  deviceSerial: string;
  artifactDir: string;
};

export async function executeAndroidRuntime(input: ExecuteRuntimeInput) {
  const steps: RuntimeStep[] = [];
  const warnings: string[] = [];
  const startedAt = new Date().toISOString();
  const artifacts = ensureJobArtifactDirs(input.artifactDir, input.jobId);
  const adbPath = resolveAdbPath();

  if (!fs.existsSync(input.apkPath)) {
    console.error(`[android-worker] [${input.jobId}] missing apk path: ${input.apkPath}`);
    steps.push({ name: "apk_validate", status: "failed" });
    const report = buildReport({
      jobId: input.jobId,
      platform: "android",
      runtimeProfile: input.runtimeProfile,
      status: "blocked",
      reason: `APK does not exist: ${input.apkPath}`,
      device: { serial: input.deviceSerial },
      app: { packageName: "unknown" },
      steps,
      artifacts: {
        report: `artifacts/jobs/${input.jobId}/report.json`,
        screenshot: `artifacts/jobs/${input.jobId}/screenshots/launch.png`,
        logcat: `artifacts/jobs/${input.jobId}/logs/logcat.txt`
      },
      warnings,
      startedAt,
      finishedAt: new Date().toISOString()
    });
    fs.writeFileSync(artifacts.reportPath, JSON.stringify(report, null, 2), "utf8");
    return {
      status: "blocked" as const,
      reason: report.reason,
      reportPath: `jobs/${input.jobId}/report.json`,
      screenshotPath: `jobs/${input.jobId}/screenshots/launch.png`,
      logcatPath: `jobs/${input.jobId}/logs/logcat.txt`
    };
  }

  steps.push({ name: "apk_validate", status: "passed" });

  let packageName = "unknown";
  try {
    packageName = await extractPackageName(input.apkPath);
    steps.push({ name: "package_extract", status: "passed" });
  } catch (error) {
    steps.push({ name: "package_extract", status: "failed" });
    const reason = error instanceof Error ? error.message : "package extract failed";
    const report = buildReport({
      jobId: input.jobId,
      platform: "android",
      runtimeProfile: input.runtimeProfile,
      status: "blocked",
      reason,
      device: { serial: input.deviceSerial },
      app: { packageName },
      steps,
      artifacts: {
        report: `artifacts/jobs/${input.jobId}/report.json`,
        screenshot: `artifacts/jobs/${input.jobId}/screenshots/launch.png`,
        logcat: `artifacts/jobs/${input.jobId}/logs/logcat.txt`
      },
      warnings,
      startedAt,
      finishedAt: new Date().toISOString()
    });
    fs.writeFileSync(artifacts.reportPath, JSON.stringify(report, null, 2), "utf8");
    return {
      status: "blocked" as const,
      reason,
      reportPath: `jobs/${input.jobId}/report.json`,
      screenshotPath: `jobs/${input.jobId}/screenshots/launch.png`,
      logcatPath: `jobs/${input.jobId}/logs/logcat.txt`
    };
  }

  try {
    console.log(`[android-worker] [${input.jobId}] starting runtime for ${input.apkPath} on ${input.deviceSerial} (${input.runtimeProfile})`);
    await runShellText(adbPath, ["-s", input.deviceSerial, "logcat", "-c"]);

    console.log(`[android-worker] [${input.jobId}] installing apk`);
    await runShellText(adbPath, ["-s", input.deviceSerial, "install", "-r", input.apkPath]);
    steps.push({ name: "apk_install", status: "passed" });

    console.log(`[android-worker] [${input.jobId}] launching package ${packageName}`);
    await runShellText(adbPath, ["-s", input.deviceSerial, "shell", "monkey", "-p", packageName, "-c", "android.intent.category.LAUNCHER", "1"]);
    steps.push({ name: "app_launch", status: "passed" });

    await sleep(5000);

    const pidResult = await runShellText(adbPath, ["-s", input.deviceSerial, "shell", "pidof", packageName]);
    const processRunning = pidResult.stdout.trim().length > 0;
    steps.push({ name: "process_check", status: processRunning ? "passed" : "failed" });

    const screenshotResult = await runShellBuffer(adbPath, ["-s", input.deviceSerial, "exec-out", "screencap", "-p"]);
    fs.writeFileSync(artifacts.screenshotPath, screenshotResult.stdout);
    steps.push({ name: "screenshot_capture", status: "passed" });

    const logcatResult = await runShellText(adbPath, ["-s", input.deviceSerial, "logcat", "-d"]);
    fs.writeFileSync(artifacts.logcatPath, logcatResult.stdout, "utf8");
    steps.push({ name: "logcat_capture", status: "passed" });

    const crashSignals = [
      `FATAL EXCEPTION`,
      `ANR in ${packageName}`,
      `Force finishing activity ${packageName}`
    ].filter((signal) => logcatResult.stdout.includes(signal));

    const crashDetected = crashSignals.length > 0;
    steps.push({ name: "crash_detection", status: crashDetected ? "failed" : "passed" });

    const status = !processRunning ? "failed" : crashDetected ? "failed" : "passed";
    const reason = !processRunning
      ? `Process not running for package ${packageName}`
      : crashDetected
        ? `Crash signals detected: ${crashSignals.join(", ")}`
        : null;

    if (crashDetected) warnings.push(...crashSignals);

    const report = buildReport({
      jobId: input.jobId,
      platform: "android",
      runtimeProfile: input.runtimeProfile,
      status,
      reason,
      device: { serial: input.deviceSerial },
      app: { packageName },
      steps,
      artifacts: {
        report: `artifacts/jobs/${input.jobId}/report.json`,
        screenshot: `artifacts/jobs/${input.jobId}/screenshots/launch.png`,
        logcat: `artifacts/jobs/${input.jobId}/logs/logcat.txt`
      },
      warnings,
      startedAt,
      finishedAt: new Date().toISOString()
    });

    fs.writeFileSync(artifacts.reportPath, JSON.stringify(report, null, 2), "utf8");
    console.log(`[android-worker] [${input.jobId}] completed with status=${status}`);

    return {
      status,
      reason,
      reportPath: `jobs/${input.jobId}/report.json`,
      screenshotPath: `jobs/${input.jobId}/screenshots/launch.png`,
      logcatPath: `jobs/${input.jobId}/logs/logcat.txt`
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Runtime execution failed";
    console.error(`[android-worker] [${input.jobId}] failed: ${reason}`);

    const failedNames = ["apk_install", "app_launch", "process_check", "screenshot_capture", "logcat_capture", "crash_detection"];
    for (const name of failedNames) {
      if (!steps.find((s) => s.name === name)) {
        steps.push({ name: name as RuntimeStep["name"], status: "blocked" });
      }
    }

    const report = buildReport({
      jobId: input.jobId,
      platform: "android",
      runtimeProfile: input.runtimeProfile,
      status: "blocked",
      reason,
      device: { serial: input.deviceSerial },
      app: { packageName },
      steps,
      artifacts: {
        report: `artifacts/jobs/${input.jobId}/report.json`,
        screenshot: `artifacts/jobs/${input.jobId}/screenshots/launch.png`,
        logcat: `artifacts/jobs/${input.jobId}/logs/logcat.txt`
      },
      warnings,
      startedAt,
      finishedAt: new Date().toISOString()
    });

    fs.writeFileSync(artifacts.reportPath, JSON.stringify(report, null, 2), "utf8");

    return {
      status: "blocked" as const,
      reason,
      reportPath: `jobs/${input.jobId}/report.json`,
      screenshotPath: `jobs/${input.jobId}/screenshots/launch.png`,
      logcatPath: `jobs/${input.jobId}/logs/logcat.txt`
    };
  }
}
