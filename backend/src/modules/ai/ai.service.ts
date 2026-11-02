import { pool } from "../../config/db.js";

type ChatMode = "beginner" | "intermediate" | "advanced";

type AiChatServiceResponse = {
  answer: string;
  sources: Array<{
    citation: string;
    lecture_id: string;
    lecture_title: string;
    excerpt: string;
    similarity: number;
  }>;
};

type IndexingResponse = {
  course_id: string;
  lectures_found: number;
  chunks_created: number;
  status: "indexed" | "no_transcripts";
};

const getAiServiceConfig = () => {
  const baseUrl = process.env.AI_SERVICE_URL;
  const internalToken = process.env.AI_SERVICE_INTERNAL_TOKEN;

  if (!baseUrl || !internalToken) {
    throw new Error("AI_CONFIGURATION_MISSING");
  }

  return { baseUrl, internalToken };
};

// ============================================
// COURSE TRANSCRIPT INDEXING
// ============================================

export async function indexCourseTranscripts(
  courseId: string,
  instructorId: string,
): Promise<IndexingResponse> {
  const { baseUrl, internalToken } = getAiServiceConfig();

  const url = new URL(
    `/internal/courses/${encodeURIComponent(courseId)}/index`,
    baseUrl,
  );

  url.searchParams.set("instructor_id", instructorId);

  let response: Response;

  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "X-Internal-Token": internalToken,
      },
      signal: AbortSignal.timeout(120_000),
    });
  } catch {
    throw new Error("AI_INDEXING_SERVICE_UNAVAILABLE");
  }

  if (response.status === 403) {
    throw new Error("COURSE_INDEXING_FORBIDDEN");
  }

  if (response.status === 503) {
    throw new Error("AI_CONFIGURATION_MISSING");
  }

  if (!response.ok) {
    throw new Error("AI_INDEXING_SERVICE_FAILED");
  }

  return (await response.json()) as IndexingResponse;
}

// ============================================
// CREATE AI CHAT SESSION
// ============================================

export async function createChatSession(
  studentId: string,
  courseId: string,
  mode: ChatMode,
) {
  const enrolled = await pool.query(
    `SELECT 1
     FROM enrollments e
     JOIN courses c ON c.id = e.course_id
     WHERE e.student_id = $1
       AND e.course_id = $2
       AND c.status = 'approved'`,
    [studentId, courseId],
  );

  if (enrolled.rowCount !== 1) {
    return null;
  }

  const result = await pool.query(
    `INSERT INTO ai_chat_sessions
       (user_id, course_id, mode)
     VALUES ($1, $2, $3)
     RETURNING id, course_id, mode, created_at`,
    [studentId, courseId, mode],
  );

  return result.rows[0];
}

// ============================================
// UPDATE CHAT EXPLANATION MODE
// ============================================

export async function updateChatMode(
  studentId: string,
  sessionId: string,
  mode: ChatMode,
) {
  const result = await pool.query(
    `UPDATE ai_chat_sessions s
     SET mode = $3
     WHERE s.id = $1
       AND s.user_id = $2
       AND EXISTS (
         SELECT 1
         FROM enrollments e
         JOIN courses c ON c.id = e.course_id
         WHERE e.course_id = s.course_id
           AND e.student_id = s.user_id
           AND c.status = 'approved'
       )
     RETURNING s.id, s.course_id, s.mode`,
    [sessionId, studentId, mode],
  );

  return result.rows[0] ?? null;
}

// ============================================
// SEND AI CHAT MESSAGE
// ============================================

export async function answerChatMessage(
  studentId: string,
  sessionId: string,
  question: string,
) {
  // 1. Verify session ownership and enrollment

  const sessionResult = await pool.query<{
    id: string;
    course_id: string;
    mode: ChatMode;
  }>(
    `SELECT s.id, s.course_id, s.mode
     FROM ai_chat_sessions s
     JOIN enrollments e
       ON e.course_id = s.course_id
       AND e.student_id = s.user_id
     JOIN courses c ON c.id = s.course_id
     WHERE s.id = $1
       AND s.user_id = $2
       AND c.status = 'approved'`,
    [sessionId, studentId],
  );

  const session = sessionResult.rows[0];

  if (!session) {
    return null;
  }

  // 2. Retrieve previous chat history

  const historyResult = await pool.query<{
    sender: "user" | "ai";
    content: string;
  }>(
    `SELECT sender, content
     FROM ai_chat_messages
     WHERE session_id = $1
     ORDER BY created_at DESC
     LIMIT 10`,
    [sessionId],
  );

  const history = historyResult.rows.reverse();

  // 3. Get FastAPI configuration

  const { baseUrl, internalToken } = getAiServiceConfig();

  // 4. Send question to FastAPI AI service

  let response: Response;

  try {
    response = await fetch(new URL("/internal/chat/answer", baseUrl), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Token": internalToken,
      },
      body: JSON.stringify({
        course_id: session.course_id,
        question,
        mode: session.mode,
        history,
      }),
      signal: AbortSignal.timeout(90_000),
    });
  } catch {
    throw new Error("AI_CHAT_SERVICE_UNAVAILABLE");
  }

  // 5. Handle FastAPI response errors

  if (response.status === 404) {
    throw new Error("COURSE_MATERIAL_NOT_INDEXED");
  }

  if (response.status === 401 || response.status === 503) {
    throw new Error("AI_CONFIGURATION_MISSING");
  }

  if (!response.ok) {
    throw new Error("AI_CHAT_SERVICE_FAILED");
  }

  // 6. Validate AI response

  const data = (await response.json()) as AiChatServiceResponse;

  if (
    typeof data.answer !== "string" ||
    !data.answer.trim() ||
    !Array.isArray(data.sources)
  ) {
    throw new Error("AI_CHAT_SERVICE_INVALID_RESPONSE");
  }

  // 7. Save conversation in PostgreSQL

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Save learner message

    await client.query(
      `INSERT INTO ai_chat_messages
         (session_id, sender, content)
       VALUES ($1, 'user', $2)`,
      [sessionId, question],
    );

    // Collect source lecture IDs

    const lectureIds = [
      ...new Set(data.sources.map((source) => source.lecture_id)),
    ];

    // Save AI response and source references

    const saved = await client.query(
      `INSERT INTO ai_chat_messages
         (session_id, sender, content, source_lecture_ids)
       VALUES ($1, 'ai', $2, $3)
       RETURNING id, content, created_at`,
      [sessionId, data.answer, lectureIds],
    );

    await client.query("COMMIT");

    // 8. Return response to controller

    return {
      message: saved.rows[0],
      sources: data.sources,
      mode: session.mode,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
