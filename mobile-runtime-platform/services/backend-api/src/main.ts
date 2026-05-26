import express from "express";
import cors from "cors";
import { healthRoutes } from "./routes/health.routes";
import { appsRoutes } from "./routes/apps.routes";
import { runtimeRoutes } from "./routes/runtime.routes";
import { artifactsRoutes } from "./routes/artifacts.routes";
import { createUploadService } from "./services/upload-service";
import { ArtifactService } from "./services/artifact-service";
import { JobStore } from "./services/job-store";

const app = express();
app.use(cors());
app.use(express.json());

const port = Number(process.env.PORT || 4000);
const uploadDir = process.env.UPLOAD_DIR || "uploads";
const artifactDir = process.env.ARTIFACT_DIR || "artifacts";

const upload = createUploadService(uploadDir);
const artifactService = new ArtifactService(artifactDir);
const jobStore = new JobStore();

app.use(healthRoutes());
app.use(appsRoutes(upload, uploadDir));
app.use(runtimeRoutes(jobStore));
app.use(artifactsRoutes(artifactService));

app.listen(port, () => {
  console.log(`[backend-api] listening on http://localhost:${port}`);
});
