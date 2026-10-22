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
} from "./courses.controller.js";

import { videoUpload } from "../../middleware/upload.middleware.js";

import { authenticateToken } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/role.middleware.js";

const router = Router();

router.get("/", listCourses);
router.post(
  "/",
  authenticateToken,
  requireRole("instructor"),
  createCourseController,
);
router.get("/:id", getCourseDetails);

router.put(
  "/:id",
  authenticateToken,
  requireRole("instructor"),
  updateCourseController,
);

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

router.post(
  "/:id/enroll",
  authenticateToken,
  requireRole("student"),
  enrollInCourseController,
);

router.post(
  "/:id/approve",
  authenticateToken,
  requireRole("admin"),
  reviewCourseController,
);

router.get(
  "/enrollments/me",
  authenticateToken,
  requireRole("student"),
  getMyEnrollmentsController,
);

export default router;
