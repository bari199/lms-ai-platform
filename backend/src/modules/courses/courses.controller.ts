import type { Request, Response } from "express";
import {
  getPublishedCourses,
  createCourse,
  createCourseModule,
  getCourseById,
  updateCourse,
  createModuleLecture,
  reviewCourse,
} from "./courses.service.js";
import { updateStreak } from "../gamification/streaks.service.js";
import { awardBadge } from "../gamification/badges.service.js";
import { createLectureNote } from "./notes.service.js";
import { updateLectureProgress } from "./progress.service.js";
import { createLectureBookmark } from "./bookmarks.service.js";
import { enrollStudent, getMyEnrollments } from "./enrollment.service.js";
import { uploadLectureVideo } from "./courses.storage.js";
import { pool } from "../../config/db.js";
import type { AuthenticatedRequest } from "../../middleware/auth.middleware.js";
import { getCourseRecommendations } from "./recommendations.service.js";

export const listCourses = async (req: Request, res: Response) => {
  try {
    const result = await getPublishedCourses({
      category:
        typeof req.query.category === "string" ? req.query.category : undefined,
      difficulty:
        typeof req.query.difficulty === "string"
          ? req.query.difficulty
          : undefined,
      q: typeof req.query.q === "string" ? req.query.q : undefined,
      page: typeof req.query.page === "string" ? req.query.page : undefined,
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Course catalog error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch courses",
    });
  }
};

export const createCourseController = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const course = await createCourse(req.user.id, req.body ?? {});

    return res.status(201).json({
      success: true,
      message: "Course submitted for approval",
      data: course,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Course creation failed";

    return res.status(400).json({
      success: false,
      message,
    });
  }
};

export const getCourseDetails = async (req: Request, res: Response) => {
  try {
    const courseId = Array.isArray(req.params.id)
      ? req.params.id[0]
      : req.params.id;

    if (!courseId) {
      return res.status(400).json({
        success: false,
        message: "Course ID is required",
      });
    }

    const course = await getCourseById(courseId);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: course,
    });
  } catch (error) {
    console.error("Course details error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch course details",
    });
  }
};

export const updateCourseController = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const courseId = Array.isArray(req.params.id)
      ? req.params.id[0]
      : req.params.id;

    if (!courseId) {
      return res.status(400).json({
        success: false,
        message: "Course ID is required",
      });
    }

    const course = await updateCourse(courseId, req.user.id, req.body ?? {});

    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found or you are not the owner",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Course updated successfully",
      data: course,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Course update failed";

    return res.status(400).json({
      success: false,
      message,
    });
  }
};

export const createModuleController = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const { title, order_index } = req.body ?? {};

    const courseId = Array.isArray(req.params.id)
      ? req.params.id[0]
      : req.params.id;

    if (!courseId) {
      return res.status(400).json({
        success: false,
        message: "Course ID is required",
      });
    }

    const module = await createCourseModule(courseId, req.user.id, {
      title,
      order_index,
    });

    if (!module) {
      return res.status(404).json({
        success: false,
        message: "Course not found or you are not the owner",
      });
    }

    return res.status(201).json({
      success: true,
      message: "Module created successfully",
      data: module,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Module creation failed";

    return res.status(400).json({
      success: false,
      message,
    });
  }
};

export const createLectureController = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const {
      title,
      video_url,
      transcript,
      duration_seconds,
      order_index,
      resource_urls,
    } = req.body ?? {};

    const moduleId = Array.isArray(req.params.id)
      ? req.params.id[0]
      : req.params.id;

    if (!moduleId) {
      return res.status(400).json({
        success: false,
        message: "Module ID is required",
      });
    }

    const lecture = await createModuleLecture(moduleId, req.user.id, {
      title,
      video_url,
      transcript,
      duration_seconds,
      order_index,
      resource_urls,
    });

    if (!lecture) {
      return res.status(404).json({
        success: false,
        message: "Module not found or you are not the course owner",
      });
    }

    return res.status(201).json({
      success: true,
      message: "Lecture created successfully",
      data: lecture,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Lecture creation failed";

    return res.status(400).json({
      success: false,
      message,
    });
  }
};

export const uploadLectureVideoController = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const moduleId = Array.isArray(req.params.id)
      ? req.params.id[0]
      : req.params.id;

    const file = req.file;

    if (!moduleId || !file) {
      return res.status(400).json({
        success: false,
        message: "Module ID and video file are required",
      });
    }

    const { title, transcript, duration_seconds, order_index, resource_urls } =
      req.body ?? {};

    if (
      typeof title !== "string" ||
      !title.trim() ||
      !Number.isInteger(Number(order_index)) ||
      Number(order_index) < 1
    ) {
      return res.status(400).json({
        success: false,
        message: "A lecture title and positive order_index are required",
      });
    }

    const lecture = await createModuleLecture(moduleId, req.user.id, {
      title: title.trim(),
      order_index: Number(order_index),
      transcript,
      duration_seconds:
        duration_seconds === undefined || duration_seconds === ""
          ? undefined
          : Number(duration_seconds),
      resource_urls:
        typeof resource_urls === "string"
          ? JSON.parse(resource_urls)
          : resource_urls,
    });

    if (!lecture) {
      return res.status(404).json({
        success: false,
        message: "Module not found or you are not the course owner",
      });
    }

    const videoKey = await uploadLectureVideo(lecture.id, file);

    const result = await pool.query(
      `UPDATE lectures
       SET video_url = $1
       WHERE id = $2 AND module_id = $3
       RETURNING id, module_id, title, video_url,
                 duration_seconds, order_index, resource_urls`,
      [videoKey, lecture.id, moduleId],
    );

    return res.status(201).json({
      success: true,
      message: "Lecture created and video uploaded successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Lecture video upload error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create lecture or upload video",
    });
  }
};

export async function enrollInCourseController(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const studentId = req.user?.id;

    const courseId = Array.isArray(req.params.id)
      ? req.params.id[0]
      : req.params.id;

    if (!studentId) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    if (!courseId) {
      return res.status(400).json({
        message: "Course ID is required",
      });
    }

    const result = await enrollStudent(studentId, courseId);

    if ("error" in result) {
      if (result.error === "COURSE_NOT_FOUND") {
        return res.status(404).json({
          message: "Course not found",
        });
      }

      return res.status(400).json({
        message: "Course is not available for enrollment",
      });
    }

    return res.status(200).json({
      message: result.alreadyEnrolled
        ? "You are already enrolled in this course"
        : "Successfully enrolled in course",
      ...result,
    });
  } catch (error) {
    console.error("Course enrollment error:", error);

    return res.status(500).json({
      message: "Failed to enroll in course",
    });
  }
}

export async function reviewCourseController(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const courseId = Array.isArray(req.params.id)
      ? req.params.id[0]
      : req.params.id;

    const decision = req.body?.decision;

    if (!courseId) {
      return res.status(400).json({
        message: "Course ID is required",
      });
    }

    if (decision !== "approved" && decision !== "rejected") {
      return res.status(400).json({
        message: 'Decision must be "approved" or "rejected"',
      });
    }

    const course = await reviewCourse(courseId, decision);

    if (!course) {
      return res.status(404).json({
        message: "Pending course not found",
      });
    }

    return res.status(200).json({
      message: `Course ${decision} successfully`,
      course,
    });
  } catch (error) {
    console.error("Course review error:", error);

    return res.status(500).json({
      message: "Failed to review course",
    });
  }
}

export async function getMyEnrollmentsController(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const studentId = req.user?.id;

    if (!studentId) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    const enrollments = await getMyEnrollments(studentId);

    return res.status(200).json({
      count: enrollments.length,
      enrollments,
    });
  } catch (error) {
    console.error("Get my enrollments error:", error);

    return res.status(500).json({
      message: "Failed to fetch enrollments",
    });
  }
}

export async function updateLectureProgressController(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const studentId = req.user?.id;

    const lectureId = Array.isArray(req.params.id)
      ? req.params.id[0]
      : req.params.id;

    const { watched_seconds, is_completed } = req.body ?? {};

    if (!studentId) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    if (!lectureId) {
      return res.status(400).json({
        message: "Lecture ID is required",
      });
    }

    if (
      !Number.isInteger(watched_seconds) ||
      watched_seconds < 0 ||
      typeof is_completed !== "boolean"
    ) {
      return res.status(400).json({
        message:
          "watched_seconds must be a non-negative integer and is_completed must be a boolean",
      });
    }

    const progress = await updateLectureProgress(studentId, lectureId, {
      watched_seconds,
      is_completed,
    });

    if (!progress) {
      return res.status(404).json({
        message: "Lecture not found or course enrollment required",
      });
    }

    // Step 20: Update the student's learning streak.
    const streak = await updateStreak(studentId);

    // Award the badge when the student reaches a 7-day streak.
    if (streak.current_streak >= 7) {
      await awardBadge(studentId, "7-Day Streak");
    }

    return res.status(200).json({
      message: "Lecture progress updated successfully",
      progress,
    });
  } catch (error) {
    console.error("Update lecture progress error:", error);

    return res.status(500).json({
      message: "Failed to update lecture progress",
    });
  }
}

export async function createLectureNoteController(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const studentId = req.user?.id;
    const lectureId = req.params.id;
    const { timestamp_seconds, content } = req.body;

    if (!studentId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (
      typeof lectureId !== "string" ||
      typeof content !== "string" ||
      !Number.isInteger(timestamp_seconds) ||
      timestamp_seconds < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid lecture ID, timestamp_seconds and content are required",
      });
    }

    const note = await createLectureNote({
      studentId,
      lectureId,
      timestampSeconds: timestamp_seconds,
      content,
    });

    return res.status(201).json({
      success: true,
      message: "Lecture note created successfully",
      data: note,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create lecture note";

    if (
      message === "Note content is required" ||
      message === "Timestamp must be a non-negative integer"
    ) {
      return res.status(400).json({
        success: false,
        message,
      });
    }

    if (
      message === "Lecture not found or you are not enrolled in this course"
    ) {
      return res.status(403).json({
        success: false,
        message,
      });
    }

    console.error("Create lecture note error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}

export async function createLectureBookmarkController(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const userId = req.user?.id;
    const lectureId = req.params.id;
    const { timestamp_seconds } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (
      typeof lectureId !== "string" ||
      !Number.isInteger(timestamp_seconds) ||
      timestamp_seconds < 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "A valid lecture ID and non-negative timestamp_seconds are required",
      });
    }

    const bookmark = await createLectureBookmark({
      userId,
      lectureId,
      timestampSeconds: timestamp_seconds,
    });

    return res.status(201).json({
      success: true,
      message: "Lecture bookmark created successfully",
      data: bookmark,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create bookmark";

    if (
      message === "Lecture not found or you are not enrolled in this course"
    ) {
      return res.status(403).json({
        success: false,
        message,
      });
    }

    console.error("Create lecture bookmark error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}

export const getCourseRecommendationsController = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const studentId = req.user?.id;

    if (!studentId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const recommendations = await getCourseRecommendations(studentId);

    return res.status(200).json({
      success: true,
      count: recommendations.length,
      data: recommendations,
    });
  } catch (error) {
    console.error("Course recommendations error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch course recommendations",
    });
  }
};
