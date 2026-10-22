import { Router } from "express";
import { authenticateToken } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/role.middleware.js";
import { getMyEnrollmentsController } from "./courses.controller.js";

const router = Router();

router.get(
  "/me",
  authenticateToken,
  requireRole("student"),
  getMyEnrollmentsController,
);

export default router;
