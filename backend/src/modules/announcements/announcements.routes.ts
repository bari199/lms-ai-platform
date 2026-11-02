import { Router } from "express";
import { authenticateToken } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/role.middleware.js";
import {
  createAnnouncementController,
  getCourseAnnouncementsController,
} from "./announcements.controller.js";

const router = Router({ mergeParams: true });

router.post(
  "/",
  authenticateToken,
  requireRole("instructor"),
  createAnnouncementController,
);

router.get(
  "/",
  authenticateToken,
  requireRole("student"),
  getCourseAnnouncementsController,
);

export default router;
