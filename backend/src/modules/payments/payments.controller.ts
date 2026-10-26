import type { Response } from "express";
import type { AuthenticatedRequest } from "../../middleware/auth.middleware.js";
import { createCheckoutSession } from "./payments.service.js";

export async function createCheckoutSessionController(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const userId = req.user?.id;
    const courseId = req.body?.courseId;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    if (typeof courseId !== "string" || !courseId.trim()) {
      res.status(400).json({
        success: false,
        message: "A valid courseId is required",
      });
      return;
    }

    const checkout = await createCheckoutSession({
      userId,
      courseId: courseId.trim(),
    });

    res.status(200).json({
      success: true,
      message: "Checkout session created successfully",
      data: checkout,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "APPROVED_COURSE_NOT_FOUND") {
        res.status(404).json({
          success: false,
          message: "Approved course not found",
        });
        return;
      }

      if (error.message === "INVALID_COURSE_PRICE") {
        res.status(400).json({
          success: false,
          message: "Course price must be greater than zero",
        });
        return;
      }

      if (error.message === "ALREADY_ENROLLED") {
        res.status(409).json({
          success: false,
          message: "You are already enrolled in this course",
        });
        return;
      }
    }

    console.error("Create checkout session error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to create checkout session",
    });
  }
}
