import type { Response } from "express";
import type { AuthenticatedRequest } from "../../middleware/auth.middleware.js";
import {
  answerChatMessage,
  createChatSession,
  indexCourseTranscripts,
  summarizeLecture,
  generateQuizDraft,
  updateChatMode,
  generatePersonalizedStudyPlan,
  getStudentMasteryScores,
  generateAdaptivePracticeQuiz,
} from "./ai.service.js";

const getErrorResponse = (error: unknown) => {
  const code = error instanceof Error ? error.message : "";

  if (code === "LECTURE_TRANSCRIPT_NOT_FOUND") {
    return {
      status: 404,
      message: "Lecture transcript not found",
    };
  }

  if (code === "AI_CONFIGURATION_MISSING") {
    return {
      status: 503,
      message: "AI tutor is not configured",
    };
  }

  if (code === "COURSE_MATERIAL_NOT_INDEXED") {
    return {
      status: 409,
      message: "Course transcripts have not been indexed yet",
    };
  }

  if (code === "COURSE_INDEXING_FORBIDDEN") {
    return {
      status: 403,
      message: "You are not authorized to index this course",
    };
  }

  if (
    code.startsWith("AI_CHAT_SERVICE_") ||
    code.startsWith("AI_INDEXING_SERVICE_") ||
    code.startsWith("AI_SUMMARIZATION_SERVICE_") ||
    code === "AI_SUMMARIZATION_INVALID_RESPONSE"
  ) {
    return {
      status: 502,
      message: "AI service request failed",
    };
  }

  if (code === "INVALID_QUESTION_COUNT") {
    return {
      status: 400,
      message: "Question count must be between 5 and 10",
    };
  }

  if (
    code === "MODULE_NOT_FOUND_OR_ACCESS_DENIED" ||
    code === "MODULE_TRANSCRIPT_NOT_FOUND"
  ) {
    return {
      status: 404,
      message: "Module not found or transcript unavailable",
    };
  }

  if (code === "AI_CONFIGURATION_MISSING") {
    return {
      status: 503,
      message: "AI service is not configured",
    };
  }

  if (code.startsWith("PRACTICE_QUIZ_")) {
    return {
      status: 502,
      message: "Practice quiz generation failed",
    };
  }

  return {
    status: 500,
    message: "AI tutor request failed",
  };
};
export const createAiChatSessionController = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  if (!req.user)
    return res
      .status(401)
      .json({ success: false, message: "Authentication required" });
  const { course_id: courseId, mode = "intermediate" } = req.body ?? {};
  if (
    typeof courseId !== "string" ||
    !["beginner", "intermediate", "advanced"].includes(mode)
  ) {
    return res.status(400).json({
      success: false,
      message: "A valid course_id and mode are required",
    });
  }

  try {
    const session = await createChatSession(req.user.id, courseId, mode);
    if (!session)
      return res
        .status(404)
        .json({ success: false, message: "Enrolled course not found" });
    return res.status(201).json({ success: true, data: session });
  } catch (error) {
    console.error("AI chat session creation failed:", error);
    return res
      .status(500)
      .json({ success: false, message: "Could not create AI chat session" });
  }
};

export const sendAiChatMessageController = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  if (!req.user)
    return res
      .status(401)
      .json({ success: false, message: "Authentication required" });
  const sessionId = Array.isArray(req.params.id)
    ? req.params.id[0]
    : req.params.id;
  const message = req.body?.message;
  if (
    !sessionId ||
    typeof message !== "string" ||
    !message.trim() ||
    message.length > 4000
  ) {
    return res.status(400).json({
      success: false,
      message: "message must contain 1–4000 characters",
    });
  }

  try {
    const result = await answerChatMessage(
      req.user.id,
      sessionId,
      message.trim(),
    );
    if (!result)
      return res
        .status(404)
        .json({ success: false, message: "Chat session not found" });
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    const response = getErrorResponse(error);
    if (response.status >= 500) console.error("AI chat request failed:", error);
    return res
      .status(response.status)
      .json({ success: false, message: response.message });
  }
};

export const updateAiChatModeController = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  if (!req.user)
    return res
      .status(401)
      .json({ success: false, message: "Authentication required" });
  const sessionId = Array.isArray(req.params.id)
    ? req.params.id[0]
    : req.params.id;
  const { mode } = req.body ?? {};
  if (!sessionId || !["beginner", "intermediate", "advanced"].includes(mode)) {
    return res.status(400).json({
      success: false,
      message: "A valid explanation mode is required",
    });
  }

  try {
    const session = await updateChatMode(req.user.id, sessionId, mode);
    if (!session)
      return res
        .status(404)
        .json({ success: false, message: "Chat session not found" });
    return res.status(200).json({ success: true, data: session });
  } catch (error) {
    const response = getErrorResponse(error);
    if (response.status >= 500)
      console.error("AI chat mode update failed:", error);
    return res
      .status(response.status)
      .json({ success: false, message: response.message });
  }
};

export const indexCourseTranscriptsController = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
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

  try {
    const result = await indexCourseTranscripts(courseId, req.user.id);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";

    if (code === "AI_CONFIGURATION_MISSING") {
      return res.status(503).json({
        success: false,
        message: "AI tutor is not configured",
      });
    }

    if (code === "COURSE_INDEXING_FORBIDDEN") {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to index this course",
      });
    }

    console.error("Course transcript indexing failed:", error);

    return res.status(502).json({
      success: false,
      message: "AI indexing service request failed",
    });
  }
};

// ============================================
// LECTURE SUMMARIZATION
// ============================================

export const summarizeLectureController = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  const lectureId = Array.isArray(req.params.id)
    ? req.params.id[0]
    : req.params.id;

  if (!lectureId) {
    return res.status(400).json({
      success: false,
      message: "Lecture ID is required",
    });
  }

  try {
    const result = await summarizeLecture(req.user.id, lectureId);

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Enrolled lecture not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const response = getErrorResponse(error);

    if (response.status >= 500) {
      console.error("Lecture summarization failed:", error);
    }

    return res.status(response.status).json({
      success: false,
      message: response.message,
    });
  }
};

export async function generateQuizController(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const lectureId = Array.isArray(req.params.id)
      ? req.params.id[0]
      : req.params.id;
    if (!lectureId) {
      return res.status(400).json({
        success: false,
        message: "Lecture ID is required",
      });
    }
    const questionCount = Number(req.body.question_count ?? 5);

    if (
      !Number.isInteger(questionCount) ||
      questionCount < 5 ||
      questionCount > 10
    ) {
      return res.status(400).json({
        success: false,
        message: "Question count must be between 5 and 10",
      });
    }

    const result = await generateQuizDraft(
      req.user.id,
      lectureId,
      questionCount,
    );

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Lecture not found or access denied",
      });
    }

    return res.status(201).json({
      success: true,
      message: "AI quiz draft generated. Instructor approval required.",
      data: result,
    });
  } catch (error) {
    const response = getErrorResponse(error);
    if (response.status >= 500) {
      console.error("Quiz draft generation failed:", error);
    }
    return res.status(response.status).json({
      success: false,
      message: response.message,
    });
  }
}

export const generateStudyPlanController = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  try {
    const result = await generatePersonalizedStudyPlan(req.user.id);

    return res.status(200).json({
      success: true,
      message: "Personalized study plan generated successfully",
      data: result,
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";

    if (code === "QUIZ_HISTORY_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "No submitted quiz history found",
      });
    }

    if (code === "AI_CONFIGURATION_MISSING") {
      return res.status(503).json({
        success: false,
        message: "AI service is not configured",
      });
    }

    console.error("Study plan generation failed:", error);

    return res.status(502).json({
      success: false,
      message: "Could not generate study plan",
    });
  }
};

export const getStudentMasteryController = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  try {
    const result = await getStudentMasteryScores(req.user.id);

    return res.status(200).json({
      success: true,
      message: "Student mastery scores retrieved successfully",
      data: result,
    });
  } catch (error) {
    console.error("Student mastery retrieval failed:", error);

    return res.status(500).json({
      success: false,
      message: "Could not retrieve student mastery scores",
    });
  }
};

export const generateAdaptivePracticeQuizController = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  const moduleId = Array.isArray(req.params.moduleId)
    ? req.params.moduleId[0]
    : req.params.moduleId;

  const questionCount = Number(req.body?.question_count ?? 5);

  if (!moduleId) {
    return res.status(400).json({
      success: false,
      message: "Module ID is required",
    });
  }

  if (
    !Number.isInteger(questionCount) ||
    questionCount < 5 ||
    questionCount > 10
  ) {
    return res.status(400).json({
      success: false,
      message: "Question count must be between 5 and 10",
    });
  }

  try {
    const result = await generateAdaptivePracticeQuiz(
      req.user.id,
      moduleId,
      questionCount,
    );

    return res.status(201).json({
      success: true,
      message: "Adaptive practice quiz generated successfully",
      data: result,
    });
  } catch (error) {
    const response = getErrorResponse(error);

    if (response.status >= 500) {
      console.error("Adaptive practice quiz generation failed:", error);
    }

    return res.status(response.status).json({
      success: false,
      message: response.message,
    });
  }
};
