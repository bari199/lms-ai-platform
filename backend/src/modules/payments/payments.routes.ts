import { Router } from "express";
import { authenticateToken } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/role.middleware.js";
import { createCheckoutSessionController } from "./payments.controller.js";

const router = Router();

router.post(
  "/checkout-session",
  authenticateToken,
  requireRole("student"),
  createCheckoutSessionController,
);

export default router;
