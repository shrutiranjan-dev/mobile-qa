import express from "express";
import cors from "cors";
import { executeAndroidRuntime } from "./runtime/android-runtime-executor";

const app = express();
app.use(cors());
app.use(express.json());

const port = Number(process.env.PORT || 6060);
const artifactDir = process.env.ARTIFACT_DIR || "artifacts";

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "android-worker", port });
});

app.post("/run", async (req, res) => {
  const { jobId, apkPath } = req.body ?? {};
  const deviceSerial = String(req.body?.deviceSerial || req.body?.serial || "").trim();
  const runtimeProfile = String(req.body?.runtimeProfile || req.body?.avdName || "Android_Small_Clean_API_35").trim();

  if (!jobId || !apkPath || !deviceSerial) {
    res.status(400).json({ error: "jobId, apkPath, deviceSerial are required" });
    return;
  }

  try {
    const result = await executeAndroidRuntime({
      jobId: String(jobId),
      apkPath: String(apkPath),
      runtimeProfile,
      deviceSerial,
      artifactDir
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Runtime execution failed" });
  }
});

app.listen(port, () => {
  console.log(`[android-worker] listening on http://localhost:${port}`);
});