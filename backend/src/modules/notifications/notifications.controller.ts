import type { Response } from "express";
import type { AuthenticatedRequest } from "../../middleware/auth.middleware.js";

import {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from "./notifications.service.js";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const getNotificationsController = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const user = req.user;

    if (!user) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const limitValue = Number(req.query.limit ?? 20);
    const offsetValue = Number(req.query.offset ?? 0);

    if (
      !Number.isInteger(limitValue) ||
      limitValue < 1 ||
      limitValue > 100 ||
      !Number.isInteger(offsetValue) ||
      offsetValue < 0
    ) {
      res.status(400).json({
        success: false,
        message: "Invalid pagination parameters",
      });
      return;
    }

    const notifications = await getNotifications(
      user.id,
      limitValue,
      offsetValue,
    );

    res.status(200).json({
      success: true,
      data: notifications,
      pagination: {
        limit: limitValue,
        offset: offsetValue,
      },
    });
  } catch (error) {
    console.error("Get notifications error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch notifications",
    });
  }
};

export const getUnreadNotificationCountController = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const user = req.user;

    if (!user) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const count = await getUnreadNotificationCount(user.id);

    res.status(200).json({
      success: true,
      data: { count },
    });
  } catch (error) {
    console.error("Get unread notification count error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch unread notification count",
    });
  }
};

export const markNotificationAsReadController = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const user = req.user;
    const { id } = req.params;

    if (!user) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    if (typeof id !== "string" || !UUID_REGEX.test(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid notification ID",
      });
      return;
    }

    const notification = await markNotificationAsRead(id, user.id);

    if (!notification) {
      res.status(404).json({
        success: false,
        message: "Notification not found or already read",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Notification marked as read",
      data: notification,
    });
  } catch (error) {
    console.error("Mark notification as read error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to mark notification as read",
    });
  }
};

export const markAllNotificationsAsReadController = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const user = req.user;

    if (!user) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const updatedCount = await markAllNotificationsAsRead(user.id);

    res.status(200).json({
      success: true,
      message: "All notifications marked as read",
      data: { updatedCount },
    });
  } catch (error) {
    console.error("Mark all notifications as read error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to mark all notifications as read",
    });
  }
};
