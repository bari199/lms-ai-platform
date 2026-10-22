import { Router } from "express";
import { authenticateToken } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/role.middleware.js";
import { createLectureBookmarkController } from "./courses.controller.js";

const router = Router();

router.post(
  "/:id/bookmarks",
  authenticateToken,
  requireRole("student"),
  createLectureBookmarkController,
);

export default router;
