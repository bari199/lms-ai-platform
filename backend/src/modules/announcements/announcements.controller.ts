import type { Response } from "express";
import type { AuthenticatedRequest } from "../../middleware/auth.middleware.js";
import {
  createAnnouncement,
  getCourseAnnouncements,
} from "./announcements.service.js";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const createAnnouncementController = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const user = req.user;
    const courseId = req.params.courseId;

    if (!user) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    if (typeof courseId !== "string" || !UUID_REGEX.test(courseId)) {
      res.status(400).json({
        success: false,
        message: "Invalid course ID",
      });
      return;
    }

    const { title, message } = req.body ?? {};

    if (
      typeof title !== "string" ||
      !title.trim() ||
      title.trim().length > 200 ||
      typeof message !== "string" ||
      !message.trim()
    ) {
      res.status(400).json({
        success: false,
        message: "Valid title and message are required",
      });
      return;
    }

    const result = await createAnnouncement({
      courseId,
      instructorId: user.id,
      title: title.trim(),
      message: message.trim(),
    });

    if ("error" in result) {
      const status = result.error === "COURSE_NOT_FOUND" ? 404 : 403;

      res.status(status).json({
        success: false,
        message:
          result.error === "COURSE_NOT_FOUND"
            ? "Course not found"
            : "You are not authorized to announce in this course",
      });
      return;
    }

    res.status(201).json({
      success: true,
      message: "Announcement published",
      data: result,
    });
  } catch (error) {
    console.error("Create announcement error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to create announcement",
    });
  }
};

export const getCourseAnnouncementsController = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const user = req.user;
    const courseId = req.params.courseId;

    if (!user) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    if (typeof courseId !== "string" || !UUID_REGEX.test(courseId)) {
      res.status(400).json({
        success: false,
        message: "Invalid course ID",
      });
      return;
    }

    const announcements = await getCourseAnnouncements(courseId, user.id);

    if (announcements === null) {
      res.status(403).json({
        success: false,
        message: "You are not enrolled in this course",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: announcements,
    });
  } catch (error) {
    console.error("Get course announcements error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch announcements",
    });
  }
};
