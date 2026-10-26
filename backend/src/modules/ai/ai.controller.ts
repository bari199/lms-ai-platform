import type { Response } from "express";
import type { AuthenticatedRequest } from "../../middleware/auth.middleware.js";
import {
  answerChatMessage,
  createChatSession,
  indexCourseTranscripts,
  updateChatMode,
} from "./ai.service.js";

const getErrorResponse = (error: unknown) => {
  const code = error instanceof Error ? error.message : "";
  if (code === "AI_CONFIGURATION_MISSING") {
    return { status: 503, message: "AI tutor is not configured" };
  }
  if (code === "COURSE_MATERIAL_NOT_INDEXED") {
    return { status: 409, message: "Course transcripts have not been indexed yet" };
  }
  if (code.startsWith("EMBEDDING_PROVIDER") || code === "LLM_PROVIDER_FAILED" || code === "LLM_PROVIDER_INVALID_RESPONSE") {
    return { status: 502, message: "AI provider request failed" };
  }
  return { status: 500, message: "AI tutor request failed" };
};

export const createAiChatSessionController = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  if (!req.user) return res.status(401).json({ success: false, message: "Authentication required" });
  const { course_id: courseId, mode = "intermediate" } = req.body ?? {};
  if (typeof courseId !== "string" || !["beginner", "intermediate", "advanced"].includes(mode)) {
    return res.status(400).json({ success: false, message: "A valid course_id and mode are required" });
  }

  try {
    const session = await createChatSession(req.user.id, courseId, mode);
    if (!session) return res.status(404).json({ success: false, message: "Enrolled course not found" });
    return res.status(201).json({ success: true, data: session });
  } catch (error) {
    console.error("AI chat session creation failed:", error);
    return res.status(500).json({ success: false, message: "Could not create AI chat session" });
  }
};

export const sendAiChatMessageController = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  if (!req.user) return res.status(401).json({ success: false, message: "Authentication required" });
  const sessionId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const message = req.body?.message;
  if (!sessionId || typeof message !== "string" || !message.trim() || message.length > 4000) {
    return res.status(400).json({ success: false, message: "message must contain 1–4000 characters" });
  }

  try {
    const result = await answerChatMessage(req.user.id, sessionId, message.trim());
    if (!result) return res.status(404).json({ success: false, message: "Chat session not found" });
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    const response = getErrorResponse(error);
    if (response.status >= 500) console.error("AI chat request failed:", error);
    return res.status(response.status).json({ success: false, message: response.message });
  }
};

export const updateAiChatModeController = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  if (!req.user) return res.status(401).json({ success: false, message: "Authentication required" });
  const sessionId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { mode } = req.body ?? {};
  if (!sessionId || !["beginner", "intermediate", "advanced"].includes(mode)) {
    return res.status(400).json({ success: false, message: "A valid explanation mode is required" });
  }

  try {
    const session = await updateChatMode(req.user.id, sessionId, mode);
    if (!session) return res.status(404).json({ success: false, message: "Chat session not found" });
    return res.status(200).json({ success: true, data: session });
  } catch (error) {
    console.error("AI chat mode update failed:", error);
    return res.status(500).json({ success: false, message: "Could not update AI chat mode" });
  }
};

export const indexCourseTranscriptsController = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  if (!req.user) return res.status(401).json({ success: false, message: "Authentication required" });
  const courseId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (!courseId) return res.status(400).json({ success: false, message: "Course ID is required" });

  try {
    const result = await indexCourseTranscripts(courseId, req.user.id);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    if (error instanceof Error && error.message === "AI_CONFIGURATION_MISSING") {
      return res.status(503).json({ success: false, message: "AI tutor is not configured" });
    }
    console.error("Course transcript indexing failed:", error);
    return res.status(500).json({ success: false, message: "Could not index course transcripts" });
  }
};
