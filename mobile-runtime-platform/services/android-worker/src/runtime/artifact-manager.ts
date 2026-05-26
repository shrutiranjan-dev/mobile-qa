import fs from "fs";
import path from "path";

export function ensureJobArtifactDirs(artifactDir: string, jobId: string) {
  const baseDir = path.join(artifactDir, "jobs", jobId);
  const screenshotDir = path.join(baseDir, "screenshots");
  const logsDir = path.join(baseDir, "logs");

  fs.mkdirSync(screenshotDir, { recursive: true });
  fs.mkdirSync(logsDir, { recursive: true });

  return {
    baseDir,
    screenshotPath: path.join(screenshotDir, "launch.png"),
    logcatPath: path.join(logsDir, "logcat.txt"),
    reportPath: path.join(baseDir, "report.json")
  };
}