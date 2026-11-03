import { Router } from "express";
import { authenticateToken } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/role.middleware.js";
import {
  createAiChatSessionController,
  generateQuizController,
  indexCourseTranscriptsController,
  sendAiChatMessageController,
  summarizeLectureController,
  updateAiChatModeController,
  generateStudyPlanController,
  getStudentMasteryController,
  generateAdaptivePracticeQuizController,
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

router.post(
  "/lectures/:id/summarize",
  authenticateToken,
  requireRole("student"),
  summarizeLectureController,
);

router.put(
  "/chat/sessions/:id/mode",
  authenticateToken,
  requireRole("student"),
  updateAiChatModeController,
);

router.get(
  "/mastery",
  authenticateToken,
  requireRole("student"),
  getStudentMasteryController,
);

router.post(
  "/modules/:moduleId/practice-quiz",
  authenticateToken,
  requireRole("student"),
  generateAdaptivePracticeQuizController,
);

router.post(
  "/lectures/:id/generate-quiz",
  authenticateToken,
  requireRole("instructor"),
  generateQuizController,
);

router.post(
  "/study-plan",
  authenticateToken,
  requireRole("student"),
  generateStudyPlanController,
);

export default router;
