import { Router } from "express";
import crypto from "crypto";
import { Multer } from "multer";
import path from "path";

function normalizeApiPath(input: string) {
  return input.replace(/\\/g, "/");
}

export function appsRoutes(upload: Multer, uploadDir: string) {
  const router = Router();

  router.post("/apps/upload", upload.single("apk"), (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: "apk file is required (multipart/form-data, field name: apk)" });
      return;
    }

    const appId = crypto.randomUUID();
    const uploadBase = path.isAbsolute(uploadDir) ? uploadDir : path.resolve(uploadDir);
    const workerReadableApkPath = normalizeApiPath(path.join(uploadBase, req.file.filename));

    res.json({
      appId,
      apkPath: workerReadableApkPath,
      fileName: req.file.filename
    });
  });

  return router;
}
