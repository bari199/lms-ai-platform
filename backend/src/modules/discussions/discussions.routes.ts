import { Router } from "express";

import { authenticateToken } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/role.middleware.js";

import {
  getCourseDiscussionsController,
  createDiscussionController,
  updateDiscussionController,
  deleteDiscussionController,
  pinDiscussionController,
} from "./discussions.controller.js";

const router = Router();

// All discussion routes require authentication.
router.use(authenticateToken);

// Student and instructor: List course discussions.
router.get(
  "/courses/:courseId",
  requireRole("student", "instructor"),
  getCourseDiscussionsController,
);

// Student and instructor: Create a post or reply.
router.post(
  "/",
  requireRole("student", "instructor"),
  createDiscussionController,
);

// Author: Update own discussion or reply.
router.patch(
  "/:id",
  requireRole("student", "instructor"),
  updateDiscussionController,
);

// Author or course instructor: Delete discussion.
router.delete(
  "/:id",
  requireRole("student", "instructor"),
  deleteDiscussionController,
);

// Course instructor: Pin or unpin a discussion.
router.patch("/:id/pin", requireRole("instructor"), pinDiscussionController);

export default router;
