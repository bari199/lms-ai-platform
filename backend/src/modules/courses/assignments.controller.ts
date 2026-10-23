import type { Response } from "express";
import type { AuthenticatedRequest } from "../../middleware/auth.middleware.js";

import { randomUUID } from "node:crypto";
import { extname } from "node:path";
import { PutObjectCommand } from "@aws-sdk/client-s3";

import { s3Client, videoBucket } from "../../config/storage.js";

import {
  submitAssignment,
  createAssignment,
  getAssignmentsForStudent,
  gradeAssignment,
  getStudentAssignmentResults,
} from "./assignments.service.js";

export async function getAssignmentsController(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const studentId = req.user?.id;

    if (!studentId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const assignments = await getAssignmentsForStudent(studentId);

    return res.status(200).json({
      success: true,
      message: "Assignments retrieved successfully",
      data: assignments,
    });
  } catch (error) {
    console.error("Get assignments error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}

export async function submitAssignmentController(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const userId = req.user?.id;
    const assignmentId = req.params.id;
    const file = req.file;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (!file) {
      return res.status(400).json({
        success: false,
        message: "Assignment file is required",
      });
    }

    if (typeof assignmentId !== "string") {
      return res.status(400).json({
        success: false,
        message: "Valid assignment ID is required",
      });
    }

    const allowedExtensions = [".pdf", ".zip", ".js", ".ts", ".py", ".txt"];

    const extension = extname(file.originalname).toLowerCase();

    if (!allowedExtensions.includes(extension)) {
      return res.status(400).json({
        success: false,
        message:
          "Only PDF, ZIP, JavaScript, TypeScript, Python and TXT files are allowed",
      });
    }

    const objectKey =
      `assignments/${assignmentId}/${userId}/` + `${randomUUID()}${extension}`;

    await s3Client.send(
      new PutObjectCommand({
        Bucket: videoBucket,
        Key: objectKey,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );

    const submission = await submitAssignment({
      assignmentId,
      userId,
      fileUrl: objectKey,
    });

    return res.status(201).json({
      success: true,
      message: "Assignment submitted successfully",
      data: submission,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Assignment submission failed";

    if (message === "Assignment deadline has passed") {
      return res.status(400).json({
        success: false,
        message,
      });
    }

    if (
      message === "Assignment not found or you are not enrolled in this course"
    ) {
      return res.status(403).json({
        success: false,
        message,
      });
    }

    console.error("Assignment submission error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}

export async function createAssignmentController(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const instructorId = req.user?.id;
    const courseId = req.params.id;

    const { title, instructions, rubric, due_date } = req.body;

    if (!instructorId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (
      typeof courseId !== "string" ||
      typeof title !== "string" ||
      !title.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Course ID and assignment title are required",
      });
    }

    if (
      instructions !== undefined &&
      instructions !== null &&
      typeof instructions !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Instructions must be a string",
      });
    }

    if (
      due_date !== undefined &&
      due_date !== null &&
      (typeof due_date !== "string" || !Number.isFinite(Date.parse(due_date)))
    ) {
      return res.status(400).json({
        success: false,
        message: "due_date must be a valid date string",
      });
    }

    if (
      rubric !== undefined &&
      (typeof rubric !== "object" || rubric === null || Array.isArray(rubric))
    ) {
      return res.status(400).json({
        success: false,
        message: "rubric must be a JSON object",
      });
    }

    const assignment = await createAssignment({
      instructorId,
      courseId,
      title,
      instructions,
      rubric: rubric as Record<string, unknown> | undefined,
      dueDate: due_date ?? null,
    });

    return res.status(201).json({
      success: true,
      message: "Assignment created successfully",
      data: assignment,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create assignment";

    if (message === "Assignment title is required") {
      return res.status(400).json({
        success: false,
        message,
      });
    }

    if (message === "Course not found or you do not own this course") {
      return res.status(403).json({
        success: false,
        message,
      });
    }

    console.error("Create assignment error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}

export async function gradeAssignmentController(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const instructorId = req.user?.id;
    const submissionId = req.params.id;

    const { grade, feedback } = req.body;

    if (!instructorId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (
      typeof submissionId !== "string" ||
      typeof grade !== "number" ||
      !Number.isFinite(grade) ||
      grade < 0 ||
      grade > 100
    ) {
      return res.status(400).json({
        success: false,
        message:
          "A valid submission ID and grade between 0 and 100 are required",
      });
    }

    if (
      feedback !== undefined &&
      feedback !== null &&
      typeof feedback !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Feedback must be a string",
      });
    }

    const submission = await gradeAssignment({
      submissionId,
      instructorId,
      grade,
      feedback: feedback ?? undefined,
    });

    return res.status(200).json({
      success: true,
      message: "Assignment graded successfully",
      data: submission,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to grade assignment";

    if (message === "Grade must be between 0 and 100") {
      return res.status(400).json({
        success: false,
        message,
      });
    }

    if (message === "Submission not found or you do not own this course") {
      return res.status(403).json({
        success: false,
        message,
      });
    }

    console.error("Grade assignment error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}

export async function getStudentAssignmentResultsController(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const studentId = req.user?.id;

    if (!studentId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const results = await getStudentAssignmentResults(studentId);

    return res.status(200).json({
      success: true,
      message: "Assignment results fetched successfully",
      data: results,
    });
  } catch (error) {
    console.error("Get assignment results error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}
