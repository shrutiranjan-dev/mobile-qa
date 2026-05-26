export type HostOs = "windows" | "ubuntu" | "unsupported";

export type RuntimeProfile = {
  avdName: string;
  memoryMb: number;
};

export const RUNTIME_PROFILES: RuntimeProfile[] = [
  { avdName: "Android_Small_Clean_API_35", memoryMb: 2048 },
  { avdName: "Android_Small_GApps_API_35", memoryMb: 2048 },
  { avdName: "Android_Standard_Clean_API_35", memoryMb: 3072 },
  { avdName: "Android_Standard_GApps_API_35", memoryMb: 3072 }
];

export type JobStatus = "queued" | "running" | "passed" | "failed" | "blocked";

export type RuntimeJob = {
  id: string;
  createdAt: string;
  status: JobStatus;
  apkPath: string;
  runtimeProfile: string;
  deviceSerial: string;
  reason?: string | null;
  appId?: string;
  reportUrl?: string;
  screenshotUrl?: string;
  logcatUrl?: string;
  reportPath?: string;
  screenshotPath?: string;
  logcatPath?: string;
  error?: string;
};