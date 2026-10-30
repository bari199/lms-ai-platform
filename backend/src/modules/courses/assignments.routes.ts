import { Router } from "express";

import { authenticateToken } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/role.middleware.js";
import { assignmentUpload } from "../../middleware/assignment.upload.middleware.js";

import {
  getAssignmentsController,
  createAssignmentController,
  submitAssignmentController,
  gradeAssignmentController,
  getStudentAssignmentResultsController,
  getInstructorAssignmentsController,
  getInstructorAssignmentSubmissionsController,
} from "./assignments.controller.js";

const router = Router();

// Student: List assignments for enrolled courses
router.get(
  "/",
  authenticateToken,
  requireRole("student"),
  getAssignmentsController,
);

// Instructor: Create an assignment for an owned course
router.post(
  "/courses/:id",
  authenticateToken,
  requireRole("instructor"),
  createAssignmentController,
);

// Student: Upload an assignment submission
router.post(
  "/:id/submit",
  authenticateToken,
  requireRole("student"),
  assignmentUpload.single("file"),
  submitAssignmentController,
);

// Instructor: Grade a submission
router.patch(
  "/submissions/:id/grade",
  authenticateToken,
  requireRole("instructor"),
  gradeAssignmentController,
);

router.get(
  "/results/me",
  authenticateToken,
  requireRole("student"),
  getStudentAssignmentResultsController,
);

// Instructor: List assignments for an owned course
router.get(
  "/courses/:id",
  authenticateToken,
  requireRole("instructor"),
  getInstructorAssignmentsController,
);

// Instructor: List submissions for an owned assignment
router.get(
  "/:id/submissions",
  authenticateToken,
  requireRole("instructor"),
  getInstructorAssignmentSubmissionsController,
);

export default router;
