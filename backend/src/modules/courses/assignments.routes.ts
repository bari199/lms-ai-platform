import { Router } from "express";
import { authenticateToken } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/role.middleware.js";
import { submitAssignmentController } from "./assignments.controller.js";
import { assignmentUpload } from "../../middleware/assignment.upload.middleware.js";
const router = Router();

router.post(
  "/:id/submit",
  authenticateToken,
  requireRole("student"),
  assignmentUpload.single("file"),
  submitAssignmentController,
);

export default router;
