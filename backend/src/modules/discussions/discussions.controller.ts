import type { Response } from "express";
import type { AuthenticatedRequest } from "../../middleware/auth.middleware.js";

import {
  getCourseDiscussions,
  createDiscussion,
  updateDiscussion,
  deleteDiscussion,
  pinDiscussion,
} from "./discussions.service.js";

import { getIO } from "../../config/socket.js";

const getRole = (roles: string[]): "student" | "instructor" | null => {
  if (roles.includes("instructor")) return "instructor";
  if (roles.includes("student")) return "student";
  return null;
};

export const getCourseDiscussionsController = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const courseId = req.params.courseId;
    const user = req.user;
    const role = user ? getRole(user.roles) : null;

    if (!user || !role) {
      res.status(403).json({
        success: false,
        message: "Access denied",
      });
      return;
    }

    const discussions = await getCourseDiscussions(
      String(courseId),
      user.id,
      role,
    );

    if (discussions === null) {
      res.status(403).json({
        success: false,
        message: "You do not have access to this course",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: discussions,
    });
  } catch (error) {
    console.error("Get discussions error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch discussions",
    });
  }
};

export const createDiscussionController = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const user = req.user;
    const role = user ? getRole(user.roles) : null;
    const { courseId, title, content, parentId } = req.body;

    if (!user || !role) {
      res.status(403).json({
        success: false,
        message: "Access denied",
      });
      return;
    }

    if (
      typeof courseId !== "string" ||
      typeof content !== "string" ||
      !content.trim()
    ) {
      res.status(400).json({
        success: false,
        message: "Course ID and content are required",
      });
      return;
    }

    if (
      parentId !== undefined &&
      parentId !== null &&
      typeof parentId !== "string"
    ) {
      res.status(400).json({
        success: false,
        message: "Invalid parent discussion ID",
      });
      return;
    }

    if (parentId == null && (typeof title !== "string" || !title.trim())) {
      res.status(400).json({
        success: false,
        message: "Discussion title is required",
      });
      return;
    }

    const discussion = await createDiscussion({
      courseId,
      userId: user.id,
      role,
      title: typeof title === "string" ? title : null,
      content,
      parentId: parentId ?? null,
    });

    if (!discussion) {
      res.status(403).json({
        success: false,
        message: "You do not have access to this course",
      });
      return;
    }

    // Broadcast only after successful database insertion.
    const eventName = parentId ? "discussion:replied" : "discussion:created";

    getIO().to(`discussion:${courseId}`).emit(eventName, discussion);

    res.status(201).json({
      success: true,
      message: "Discussion created successfully",
      data: discussion,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";

    if (message === "Parent discussion not found") {
      res.status(404).json({
        success: false,
        message,
      });
      return;
    }

    console.error("Create discussion error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create discussion",
    });
  }
};

export const updateDiscussionController = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const user = req.user;
    const { id } = req.params;
    const { title, content } = req.body;

    if (
      !user ||
      typeof id !== "string" ||
      typeof content !== "string" ||
      !content.trim()
    ) {
      res.status(400).json({
        success: false,
        message: "Valid discussion ID and content are required",
      });
      return;
    }

    if (title !== undefined && title !== null && typeof title !== "string") {
      res.status(400).json({
        success: false,
        message: "Invalid discussion title",
      });
      return;
    }

    const discussion = await updateDiscussion(
      id,
      user.id,
      title ?? null,
      content,
    );

    if (!discussion) {
      res.status(404).json({
        success: false,
        message: "Discussion not found or permission denied",
      });
      return;
    }

    getIO()
      .to(`discussion:${discussion.course_id}`)
      .emit("discussion:updated", discussion);

    res.status(200).json({
      success: true,
      message: "Discussion updated successfully",
      data: discussion,
    });
  } catch (error) {
    console.error("Update discussion error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update discussion",
    });
  }
};

export const deleteDiscussionController = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const user = req.user;
    const role = user ? getRole(user.roles) : null;

    if (!user || !role) {
      res.status(403).json({
        success: false,
        message: "Access denied",
      });
      return;
    }

    const discussionId = req.params.id;
    if (typeof discussionId !== "string") {
      res.status(400).json({
        success: false,
        message: "Invalid discussion ID",
      });
      return;
    }

    const deleted = await deleteDiscussion(discussionId, user.id, role);

    if (!deleted) {
      res.status(404).json({
        success: false,
        message: "Discussion not found or permission denied",
      });
      return;
    }

    getIO()
      .to(`discussion:${deleted.course_id}`)
      .emit("discussion:deleted", { id: discussionId });

    res.status(200).json({
      success: true,
      message: "Discussion deleted successfully",
    });
  } catch (error) {
    console.error("Delete discussion error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete discussion",
    });
  }
};

export const pinDiscussionController = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const user = req.user;
    const { isPinned } = req.body;

    if (!user || typeof isPinned !== "boolean") {
      res.status(400).json({
        success: false,
        message: "isPinned must be a boolean",
      });
      return;
    }

    const discussionId = req.params.id;
    if (typeof discussionId !== "string") {
      res.status(400).json({
        success: false,
        message: "Invalid discussion ID",
      });
      return;
    }

    const discussion = await pinDiscussion(discussionId, user.id, isPinned);

    if (!discussion) {
      res.status(404).json({
        success: false,
        message: "Discussion not found or permission denied",
      });
      return;
    }

    getIO()
      .to(`discussion:${discussion.course_id}`)
      .emit("discussion:pinned", discussion);

    res.status(200).json({
      success: true,
      message: "Discussion pin status updated",
      data: discussion,
    });
  } catch (error) {
    console.error("Pin discussion error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update pin status",
    });
  }
};
