import { Router } from "express";
import { ArtifactService } from "../services/artifact-service";

export function artifactsRoutes(artifactService: ArtifactService) {
  const router = Router();

  router.get("/artifacts/jobs/:jobId/report.json", (req, res) => {
    const file = artifactService.resolveJobArtifact(req.params.jobId, "report.json");
    if (!file) {
      res.status(404).json({ error: "report.json not found" });
      return;
    }
    res.sendFile(file);
  });

  router.get("/artifacts/jobs/:jobId/screenshots/launch.png", (req, res) => {
    const file = artifactService.resolveJobArtifact(req.params.jobId, "screenshots/launch.png");
    if (!file) {
      res.status(404).json({ error: "launch.png not found" });
      return;
    }
    res.sendFile(file);
  });

  router.get("/artifacts/jobs/:jobId/logs/logcat.txt", (req, res) => {
    const file = artifactService.resolveJobArtifact(req.params.jobId, "logs/logcat.txt");
    if (!file) {
      res.status(404).json({ error: "logcat.txt not found" });
      return;
    }
    res.sendFile(file);
  });

  return router;
}