import multer from "multer";
import { extname } from "node:path";

const allowedExtensions = new Set([
  ".pdf",
  ".zip",
  ".js",
  ".ts",
  ".py",
  ".txt",
]);

export const assignmentUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB
    files: 1,
  },
  fileFilter: (_req, file, callback) => {
    const extension = extname(file.originalname).toLowerCase();

    if (!allowedExtensions.has(extension)) {
      return callback(
        new Error("Only PDF, ZIP, JS, TS, PY and TXT files are allowed"),
      );
    }

    callback(null, true);
  },
});
