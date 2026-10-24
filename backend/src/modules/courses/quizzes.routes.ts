import { Router } from "express";
import {
  createQuizController,
  startQuizAttemptController,
  getQuizForStudentController,
  submitQuizAttemptController,
  getQuizAttemptResultController,
} from "./quizzes.controller.js";
import { authenticateToken } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/role.middleware.js";

const router = Router();

router.post(
  "/",
  authenticateToken,
  requireRole("instructor"),
  createQuizController,
);

router.post(
  "/:id/attempt",
  authenticateToken,
  requireRole("student"),
  startQuizAttemptController,
);

router.get(
  "/:id",
  authenticateToken,
  requireRole("student"),
  getQuizForStudentController,
);

router.post(
  "/attempts/:id/submit",
  authenticateToken,
  requireRole("student"),
  submitQuizAttemptController,
);

router.get(
  "/attempts/:id/results",
  authenticateToken,
  requireRole("student"),
  getQuizAttemptResultController,
);

export default router;
