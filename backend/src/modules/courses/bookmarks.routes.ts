import { Router } from "express";
import { authenticateToken } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/role.middleware.js";
import {
  createLectureBookmarkController,
  getLectureBookmarksController,
} from "./courses.controller.js";

const router = Router();

router.get(
  "/:id/bookmarks",
  authenticateToken,
  requireRole("student"),
  getLectureBookmarksController,
);

router.post(
  "/:id/bookmarks",
  authenticateToken,
  requireRole("student"),
  createLectureBookmarkController,
);

export default router;
