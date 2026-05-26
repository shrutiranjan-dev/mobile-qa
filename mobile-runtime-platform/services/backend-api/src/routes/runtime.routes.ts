import { Router } from "express";
import crypto from "crypto";
import { JobStore } from "../services/job-store";
import { RuntimeJob } from "@mrp/shared-types";
import path from "path";

const workerUrl = process.env.ANDROID_WORKER_URL || "http://localhost:6060";
const hostAgentUrl = process.env.HOST_AGENT_URL || "http://localhost:5050";
const backendPublicBase = process.env.BACKEND_PUBLIC_BASE_URL || "http://localhost:4000";

type WorkerRunResult = {
  status: "passed" | "failed" | "blocked";
  reason: string | null;
  reportPath: string;
  screenshotPath: string;
  logcatPath: string;
};

async function tryRunViaWorker(jobId: string, apkPath: string, runtimeProfile: string, deviceSerial: string) {
  const response = await fetch(`${workerUrl}/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jobId, apkPath, runtimeProfile, deviceSerial })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Worker error: ${body}`);
  }

  return (await response.json()) as WorkerRunResult;
}

function normalizeApiPath(input: string) {
  return input.replace(/\\/g, "/");
}

function resolveWorkerApkPath(apkPath: string) {
  const uploadDir = process.env.UPLOAD_DIR || "uploads";
  const normalizedUploadDir = path.isAbsolute(uploadDir) ? uploadDir : path.resolve(uploadDir);
  const normalizedInput = normalizeApiPath(apkPath.trim());

  if (path.isAbsolute(normalizedInput)) {
    return normalizeApiPath(path.normalize(normalizedInput));
  }

  const fileName = path.posix.basename(normalizedInput);
  return normalizeApiPath(path.join(normalizedUploadDir, fileName));
}

export function runtimeRoutes(jobStore: JobStore) {
  const router = Router();

  router.get("/runtime/host/health", async (_req, res) => {
    try {
      const response = await fetch(`${hostAgentUrl}/health`);
      const body = await response.json();
      res.status(response.status).json(body);
    } catch (error) {
      res.status(502).json({ error: error instanceof Error ? error.message : "host-agent health check failed" });
    }
  });

  router.post("/runtime/android/run", async (req, res) => {
    const apkPathInput = String(req.body?.apkPath || "").trim();
    const deviceSerial = String(req.body?.deviceSerial || req.body?.serial || "").trim();
    const runtimeProfile = String(req.body?.runtimeProfile || req.body?.avdName || "Android_Small_Clean_API_35").trim();
    const apkPath = resolveWorkerApkPath(apkPathInput);

    if (!apkPathInput || !deviceSerial || !runtimeProfile) {
      res.status(400).json({ error: "apkPath, deviceSerial, runtimeProfile are required" });
      return;
    }

    const jobId = crypto.randomUUID();
    const baseJob: RuntimeJob = {
      id: jobId,
      createdAt: new Date().toISOString(),
      status: "queued",
      apkPath,
      runtimeProfile,
      deviceSerial,
      reason: null
    };

    jobStore.create(baseJob);

    void (async () => {
      jobStore.update(jobId, { status: "running" });
      try {
        const result = await tryRunViaWorker(jobId, apkPath, runtimeProfile, deviceSerial);
        jobStore.update(jobId, {
          status: result.status,
          reason: result.reason,
          reportPath: result.reportPath,
          screenshotPath: result.screenshotPath,
          logcatPath: result.logcatPath,
          reportUrl: `${backendPublicBase}/artifacts/jobs/${jobId}/report.json`,
          screenshotUrl: `${backendPublicBase}/artifacts/jobs/${jobId}/screenshots/launch.png`,
          logcatUrl: `${backendPublicBase}/artifacts/jobs/${jobId}/logs/logcat.txt`
        });
      } catch (error) {
        jobStore.update(jobId, {
          status: "failed",
          reason: error instanceof Error ? error.message : "Unknown runtime failure",
          error: error instanceof Error ? error.message : "Unknown runtime failure"
        });
      }
    })();

    res.json({
      jobId,
      status: "queued"
    });
  });

  router.get("/runtime/jobs/:jobId", (req, res) => {
    const job = jobStore.get(req.params.jobId);
    if (!job) {
      res.status(404).json({ error: "job not found" });
      return;
    }

    res.json({
      ...job,
      artifacts: {
        report: job.reportUrl || `${backendPublicBase}/artifacts/jobs/${job.id}/report.json`,
        screenshot: job.screenshotUrl || `${backendPublicBase}/artifacts/jobs/${job.id}/screenshots/launch.png`,
        logcat: job.logcatUrl || `${backendPublicBase}/artifacts/jobs/${job.id}/logs/logcat.txt`
      }
    });
  });

  return router;
}
