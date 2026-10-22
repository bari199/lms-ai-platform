import type { Response } from "express";
import type { AuthenticatedRequest } from "../../middleware/auth.middleware.js";
import { randomUUID } from "node:crypto";
import { extname } from "node:path";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { s3Client, videoBucket } from "../../config/storage.js";
import { submitAssignment } from "./assignments.service.js";

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

    const objectKey = `assignments/${assignmentId}/${userId}/${randomUUID()}${extension}`;

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
      return res.status(400).json({ success: false, message });
    }

    if (
      message === "Assignment not found or you are not enrolled in this course"
    ) {
      return res.status(403).json({ success: false, message });
    }

    console.error("Assignment submission error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}
