export type StepStatus = "passed" | "failed" | "blocked";

export type RuntimeStep = {
  name:
    | "apk_validate"
    | "package_extract"
    | "apk_install"
    | "app_launch"
    | "process_check"
    | "screenshot_capture"
    | "logcat_capture"
    | "crash_detection";
  status: StepStatus;
};

export type RuntimeReport = {
  jobId: string;
  platform: "android";
  runtimeProfile: string;
  status: StepStatus;
  reason: string | null;
  device: {
    serial: string;
  };
  app: {
    packageName: string;
  };
  steps: RuntimeStep[];
  artifacts: {
    report: string;
    screenshot: string;
    logcat: string;
  };
  warnings: string[];
  startedAt: string;
  finishedAt: string;
};

export function buildReport(input: RuntimeReport) {
  return input;
}