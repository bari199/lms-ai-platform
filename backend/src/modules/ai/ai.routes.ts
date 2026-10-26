import { Router } from "express";
import { authenticateToken } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/role.middleware.js";
import {
  createAiChatSessionController,
  indexCourseTranscriptsController,
  sendAiChatMessageController,
  updateAiChatModeController,
} from "./ai.controller.js";

const router = Router();

router.post(
  "/courses/:id/index",
  authenticateToken,
  requireRole("instructor"),
  indexCourseTranscriptsController,
);
router.post(
  "/chat/sessions",
  authenticateToken,
  requireRole("student"),
  createAiChatSessionController,
);
router.post(
  "/chat/sessions/:id/messages",
  authenticateToken,
  requireRole("student"),
  sendAiChatMessageController,
);
router.put(
  "/chat/sessions/:id/mode",
  authenticateToken,
  requireRole("student"),
  updateAiChatModeController,
);

export default router;
