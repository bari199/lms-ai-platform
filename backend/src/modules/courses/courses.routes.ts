import { Router } from "express";
import {
  listCourses,
  createCourseController,
  getCourseDetails,
  updateCourseController,
  createModuleController,
  createLectureController,
  uploadLectureVideoController,
  enrollInCourseController,
  reviewCourseController,
  getMyEnrollmentsController,
  getCourseRecommendationsController,
  getInstructorCourseDetails,
  getInstructorCoursesController,
  updateModuleController,
  deleteModuleController,
} from "./courses.controller.js";

import { createAssignmentController } from "./assignments.controller.js";
import { videoUpload } from "../../middleware/upload.middleware.js";
import { authenticateToken } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/role.middleware.js";
import { thumbnailUpload } from "../../middleware/upload.middleware.js";

const router = Router();

// Public course listing
router.get("/", listCourses);

// Student routes — static paths before /:id
router.get(
  "/recommendations",
  authenticateToken,
  requireRole("student"),
  getCourseRecommendationsController,
);

router.get(
  "/enrollments/me",
  authenticateToken,
  requireRole("student"),
  getMyEnrollmentsController,
);

// Course creation
router.post(
  "/",
  authenticateToken,
  requireRole("instructor"),
  thumbnailUpload.single("thumbnail"),
  createCourseController,
);

// Module and lecture routes
router.post(
  "/:id/modules",
  authenticateToken,
  requireRole("instructor"),
  createModuleController,
);

router.post(
  "/modules/:id/lectures",
  authenticateToken,
  requireRole("instructor"),
  createLectureController,
);

router.post(
  "/modules/:id/video",
  authenticateToken,
  requireRole("instructor"),
  videoUpload.single("video"),
  uploadLectureVideoController,
);

// Assignment creation
router.post(
  "/:id/assignments",
  authenticateToken,
  requireRole("instructor"),
  createAssignmentController,
);

// Enrollment
router.post(
  "/:id/enroll",
  authenticateToken,
  requireRole("student"),
  enrollInCourseController,
);

// Course approval
router.post(
  "/:id/approve",
  authenticateToken,
  requireRole("admin"),
  reviewCourseController,
);

// Course details — keep after static GET routes
router.get("/:id", getCourseDetails);

// Course update
router.put(
  "/:id",
  authenticateToken,
  requireRole("instructor"),
  updateCourseController,
);

router.get(
  "/:id/manage",
  authenticateToken,
  requireRole("instructor"),
  getInstructorCourseDetails,
);

router.get(
  "/instructor/me",
  authenticateToken,
  requireRole("instructor"),
  getInstructorCoursesController,
);

router.put(
  "/modules/:id",
  authenticateToken,
  requireRole("instructor"),
  updateModuleController,
);

router.delete(
  "/modules/:id",
  authenticateToken,
  requireRole("instructor"),
  deleteModuleController,
);

export default router;
