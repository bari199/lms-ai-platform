import { Router } from "express";
import { authenticateToken } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/role.middleware.js";
import { createLectureNoteController } from "./courses.controller.js";

const router = Router();

router.post(
  "/:id/notes",
  authenticateToken,
  requireRole("student"),
  createLectureNoteController,
);

export default router;
