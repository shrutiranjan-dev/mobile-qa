import fs from "fs";
import path from "path";

export class ArtifactService {
  constructor(private readonly artifactDir: string) {}

  resolveJobArtifact(jobId: string, relativePath: string) {
    const abs = path.join(this.artifactDir, "jobs", jobId, relativePath);
    return fs.existsSync(abs) ? abs : null;
  }
}