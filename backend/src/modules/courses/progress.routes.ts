import { Router } from "express";
import { authenticateToken } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/role.middleware.js";
import { updateLectureProgressController } from "./courses.controller.js";

const router = Router();

router.post(
  "/:id/progress",
  authenticateToken,
  requireRole("student"),
  updateLectureProgressController,
);

export default router;
