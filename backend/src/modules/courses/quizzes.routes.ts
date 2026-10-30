import { Router } from "express";
import {
  createQuizController,
  getInstructorQuizzesController,
  getStudentCourseQuizzesController,
  startQuizAttemptController,
  getQuizForStudentController,
  submitQuizAttemptController,
  getQuizAttemptResultController,
  updateQuizApprovalController,
} from "./quizzes.controller.js";

import { authenticateToken } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/role.middleware.js";

const router = Router();

// Instructor routes — static routes before dynamic routes
router.get(
  "/instructor",
  authenticateToken,
  requireRole("instructor"),
  getInstructorQuizzesController,
);

router.post(
  "/",
  authenticateToken,
  requireRole("instructor"),
  createQuizController,
);

router.patch(
  "/:id/approval",
  authenticateToken,
  requireRole("instructor"),
  updateQuizApprovalController,
);

// Student routes
router.post(
  "/:id/attempt",
  authenticateToken,
  requireRole("student"),
  startQuizAttemptController,
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

// Dynamic route must come after static routes
router.get(
  "/:id",
  authenticateToken,
  requireRole("student"),
  getQuizForStudentController,
);

router.get(
  "/courses/:courseId",
  authenticateToken,
  requireRole("student"),
  getStudentCourseQuizzesController,
);

export default router;
