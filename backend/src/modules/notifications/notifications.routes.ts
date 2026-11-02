import { Router } from "express";

import { authenticateToken } from "../../middleware/auth.middleware.js";

import {
  getNotificationsController,
  getUnreadNotificationCountController,
  markNotificationAsReadController,
  markAllNotificationsAsReadController,
} from "./notifications.controller.js";

const router = Router();

// All notification routes require authentication.
router.use(authenticateToken);

// Get logged-in user's notifications.
router.get("/", getNotificationsController);

// Get unread notification count.
router.get("/unread-count", getUnreadNotificationCountController);

// Mark all notifications as read.
router.patch("/read-all", markAllNotificationsAsReadController);

// Mark one notification as read.
router.patch("/:id/read", markNotificationAsReadController);

export default router;
