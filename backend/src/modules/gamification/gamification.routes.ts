import { Router } from "express";
import { authenticateToken } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/role.middleware.js";
import {
  getGamificationSummary,
  recordLearningActivity,
  downloadCertificateController,
} from "./gamification.controller.js";

const router = Router();

router.get(
  "/",
  authenticateToken,
  requireRole("student"),
  getGamificationSummary,
);

router.post(
  "/activity",
  authenticateToken,
  requireRole("student"),
  recordLearningActivity,
);

router.get(
  "/certificates/:id/download",
  authenticateToken,
  requireRole("student"),
  downloadCertificateController,
);

export default router;
