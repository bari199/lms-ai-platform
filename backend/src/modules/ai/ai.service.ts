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

// ============================================

// LECTURE SUMMARIZATION

// ============================================

type LectureSummaryResponse = {
  lecture_id: string;

  lecture_title: string;

  summary: string;
};

export async function summarizeLecture(
  studentId: string,

  lectureId: string,
): Promise<LectureSummaryResponse | null> {
  // 1. Verify student enrollment and lecture access

  const accessResult = await pool.query(
    `SELECT l.id

     FROM lectures l

     JOIN modules m ON m.id = l.module_id

     JOIN courses c ON c.id = m.course_id

     JOIN enrollments e ON e.course_id = c.id

     WHERE l.id = $1

       AND e.student_id = $2

       AND c.status = 'approved'`,

    [lectureId, studentId],
  );

  if (accessResult.rowCount !== 1) {
    return null;
  }

  // 2. Get AI service configuration

  const { baseUrl, internalToken } = getAiServiceConfig();

  // 3. Request summary from FastAPI

  let response: Response;

  try {
    response = await fetch(
      new URL(
        `/internal/lectures/${encodeURIComponent(lectureId)}/summarize`,

        baseUrl,
      ),

      {
        method: "POST",

        headers: {
          "X-Internal-Token": internalToken,
        },

        signal: AbortSignal.timeout(90_000),
      },
    );
  } catch {
    throw new Error("AI_SUMMARIZATION_SERVICE_UNAVAILABLE");
  }

  // 4. Handle FastAPI errors

  if (response.status === 404) {
    throw new Error("LECTURE_TRANSCRIPT_NOT_FOUND");
  }

  if (response.status === 401 || response.status === 503) {
    throw new Error("AI_CONFIGURATION_MISSING");
  }

  if (!response.ok) {
    throw new Error("AI_SUMMARIZATION_SERVICE_FAILED");
  }

  // 5. Validate response

  const data = (await response.json()) as LectureSummaryResponse;

  if (
    typeof data.lecture_id !== "string" ||
    typeof data.lecture_title !== "string" ||
    typeof data.summary !== "string" ||
    !data.summary.trim()
  ) {
    throw new Error("AI_SUMMARIZATION_INVALID_RESPONSE");
  }

  return data;
}

type GeneratedQuizResponse = {
  title: string;

  questions: Array<{
    question_text: string;

    question_type?: string;

    options: Array<{
      option_text: string;

      is_correct: boolean;
    }>;
  }>;
};

export async function generateQuizDraft(
  instructorId: string,

  lectureId: string,

  questionCount: number,
) {
  // 1. Verify lecture ownership and transcript.

  const lectureResult = await pool.query(
    `SELECT l.id, l.title, l.module_id

     FROM lectures l

     JOIN modules m ON m.id = l.module_id

     JOIN courses c ON c.id = m.course_id

     WHERE l.id = $1

       AND c.instructor_id = $2

       AND c.status = 'approved'

       AND NULLIF(BTRIM(l.transcript), '') IS NOT NULL`,

    [lectureId, instructorId],
  );

  if (lectureResult.rowCount !== 1) {
    return null;
  }

  const lecture = lectureResult.rows[0];

  // 2. AI service configuration.

  const baseUrl = process.env.AI_SERVICE_URL;

  const internalToken = process.env.AI_SERVICE_INTERNAL_TOKEN;

  if (!baseUrl || !internalToken) {
    throw new Error("AI_CONFIGURATION_MISSING");
  }

  // 3. Request quiz generation from FastAPI.

  let response: Response;

  try {
    response = await fetch(
      new URL(
        `/internal/lectures/${encodeURIComponent(lectureId)}/generate-quiz`,

        baseUrl,
      ),

      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",

          "X-Internal-Token": internalToken,
        },

        body: JSON.stringify({
          instructor_id: instructorId,

          question_count: questionCount,
        }),

        signal: AbortSignal.timeout(120_000),
      },
    );
  } catch (error) {
    console.error("AI Quiz service connection failed:", error);

    throw new Error("AI_QUIZ_SERVICE_UNAVAILABLE");
  }

  // 4. Handle FastAPI errors.

  if (response.status === 404) {
    throw new Error("LECTURE_TRANSCRIPT_NOT_FOUND");
  }

  if (response.status === 401 || response.status === 503) {
    throw new Error("AI_CONFIGURATION_MISSING");
  }

  if (!response.ok) {
    const errorBody = await response.text();

    console.error("FastAPI quiz error:", response.status, errorBody);

    throw new Error("AI_QUIZ_SERVICE_FAILED");
  }

  // 5. Read and parse raw response.

  const rawBody = await response.text();

  console.log("\n========== NODE AI QUIZ RESPONSE ==========");

  console.log("HTTP Status:", response.status);

  console.log("Raw response:", rawBody);

  let parsedData: unknown;

  try {
    parsedData = JSON.parse(rawBody);

    // Handle JSON encoded inside a JSON string.

    for (let i = 0; i < 2 && typeof parsedData === "string"; i++) {
      parsedData = JSON.parse(parsedData);
    }
  } catch (error) {
    console.error("Quiz JSON parsing failed:", error);

    console.error("Raw body received:", rawBody);

    throw new Error("AI_QUIZ_INVALID_RESPONSE");
  }

  console.log("Parsed response type:", typeof parsedData);

  // FastAPI may return the quiz directly or inside { quiz }, { data }, or { result }.
  // Unwrap these known response envelopes before validating the quiz payload.
  let generatedPayload: unknown = parsedData;

  for (let depth = 0; depth < 4; depth += 1) {
    if (typeof generatedPayload === "string") {
      try {
        generatedPayload = JSON.parse(generatedPayload);
      } catch {
        throw new Error("AI_QUIZ_INVALID_RESPONSE");
      }
      continue;
    }

    if (
      typeof generatedPayload !== "object" ||
      generatedPayload === null ||
      Array.isArray(generatedPayload)
    ) {
      break;
    }

    const envelope = generatedPayload as Record<string, unknown>;

    if ("quiz" in envelope) {
      generatedPayload = envelope.quiz;
      continue;
    }

    if ("data" in envelope) {
      generatedPayload = envelope.data;
      continue;
    }

    if ("result" in envelope) {
      generatedPayload = envelope.result;
      continue;
    }

    break;
  }

  console.log("Final quiz payload:", JSON.stringify(generatedPayload, null, 2));

  if (
    typeof generatedPayload !== "object" ||
    generatedPayload === null ||
    Array.isArray(generatedPayload)
  ) {
    console.error("Invalid quiz response: quiz payload is not an object");
    throw new Error("AI_QUIZ_INVALID_RESPONSE");
  }

  const generated = generatedPayload as GeneratedQuizResponse;

  const validationErrors: string[] = [];

  if (typeof generated.title !== "string" || !generated.title.trim()) {
    validationErrors.push("Invalid quiz title");
  }

  if (!Array.isArray(generated.questions)) {
    validationErrors.push("Questions is not an array");
  } else {
    if (generated.questions.length !== questionCount) {
      validationErrors.push(
        `Expected ${questionCount} questions, received ${generated.questions.length}`,
      );
    }

    generated.questions.forEach((question, index) => {
      if (
        typeof question.question_text !== "string" ||
        !question.question_text.trim()
      ) {
        validationErrors.push(`Question ${index + 1}: invalid question text`);
      }

      if (!Array.isArray(question.options) || question.options.length < 2) {
        validationErrors.push(`Question ${index + 1}: invalid options`);

        return;
      }

      question.options.forEach((option, optionIndex) => {
        if (
          typeof option.option_text !== "string" ||
          !option.option_text.trim()
        ) {
          validationErrors.push(
            `Question ${index + 1}, option ${optionIndex + 1}: invalid text`,
          );
        }

        if (typeof option.is_correct !== "boolean") {
          validationErrors.push(
            `Question ${index + 1}, option ${optionIndex + 1}: invalid correct flag`,
          );
        }
      });

      const correctCount = question.options.filter(
        (option) => option && option.is_correct === true,
      ).length;

      if (correctCount !== 1) {
        validationErrors.push(
          `Question ${index + 1}: expected exactly one correct option, received ${correctCount}`,
        );
      }
    });
  }

  if (validationErrors.length > 0) {
    console.error("========== QUIZ VALIDATION FAILED ==========");

    console.error(validationErrors);

    console.error("============================================");

    throw new Error("AI_QUIZ_INVALID_RESPONSE");
  }

  console.log("Quiz validation successful.");

  // 7. Save quiz and questions atomically.

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const quizResult = await client.query(
      `INSERT INTO quizzes

         (module_id, title, is_ai_generated,

          generated_from_lecture_id, approval_status)

       VALUES ($1, $2, TRUE, $3, 'pending')

       RETURNING id, module_id, title, is_ai_generated,

                 generated_from_lecture_id, approval_status`,

      [lecture.module_id, generated.title.trim(), lectureId],
    );

    const quiz = quizResult.rows[0];

    for (const [index, question] of generated.questions.entries()) {
      const questionResult = await client.query(
        `INSERT INTO quiz_questions

           (quiz_id, question_text, question_type, order_index)

         VALUES ($1, $2, 'mcq', $3)

         RETURNING id`,

        [quiz.id, question.question_text.trim(), index + 1],
      );

      const questionId = questionResult.rows[0].id;

      for (const option of question.options) {
        await client.query(
          `INSERT INTO quiz_options

             (question_id, option_text, is_correct)

           VALUES ($1, $2, $3)`,

          [questionId, option.option_text.trim(), option.is_correct],
        );
      }
    }

    await client.query("COMMIT");

    console.log("AI quiz draft saved successfully:", quiz.id);

    return {
      ...quiz,

      question_count: generated.questions.length,
    };
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("Quiz database transaction failed:", error);

    throw error;
  } finally {
    client.release();
  }
}

export type StudyPlanResponse = {
  student_id: string;
  performance: {
    average_score: number;
    total_attempts: number;
  };
  study_plan: {
    summary: string;
    strengths: string[];
    focus_areas: Array<{
      topic: string;
      reason: string;
      recommended_action: string;
    }>;
    weekly_plan: Array<{
      day: string;
      topic: string;
      activity: string;
      duration_minutes: number;
    }>;
    weekly_goal: string;
  };
};

export async function generatePersonalizedStudyPlan(
  studentId: string,
): Promise<StudyPlanResponse> {
  const { baseUrl, internalToken } = getAiServiceConfig();

  let response: Response;

  try {
    response = await fetch(new URL("/internal/study-plan", baseUrl), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Token": internalToken,
      },
      body: JSON.stringify({
        student_id: studentId,
      }),
      signal: AbortSignal.timeout(120_000),
    });
  } catch {
    throw new Error("AI_STUDY_PLAN_SERVICE_UNAVAILABLE");
  }

  if (response.status === 404) {
    throw new Error("QUIZ_HISTORY_NOT_FOUND");
  }

  if (response.status === 401 || response.status === 503) {
    throw new Error("AI_CONFIGURATION_MISSING");
  }

  if (!response.ok) {
    console.error(
      "FastAPI study plan error:",
      response.status,
      await response.text(),
    );

    throw new Error("AI_STUDY_PLAN_SERVICE_FAILED");
  }

  const data = (await response.json()) as StudyPlanResponse;

  if (
    typeof data.student_id !== "string" ||
    typeof data.performance?.average_score !== "number" ||
    typeof data.performance?.total_attempts !== "number" ||
    typeof data.study_plan?.summary !== "string" ||
    !Array.isArray(data.study_plan?.weekly_plan) ||
    data.study_plan.weekly_plan.length !== 7
  ) {
    throw new Error("AI_STUDY_PLAN_INVALID_RESPONSE");
  }

  return data;
}


export type StudentMasteryResponse = {
  student_id: string;
  overall_mastery_score: number;
  total_attempts: number;
  modules: Array<{
    module_id: string;
    module_title: string;
    total_attempts: number;
    mastery_score: number;
    mastery_level: "beginner" | "developing" | "proficient" | "mastered";
    recommended_difficulty:
      | "beginner"
      | "intermediate"
      | "advanced"
      | "advanced_challenge";
  }>;
  strengths: string[];
  focus_areas: string[];
};

export async function getStudentMasteryScores(
  studentId: string,
): Promise<StudentMasteryResponse> {
  const result = await pool.query<{
    module_id: string;
    module_title: string;
    total_attempts: string;
    mastery_score: string;
  }>(
    `
    SELECT
      m.id AS module_id,
      m.title AS module_title,
      COUNT(qa.id)::text AS total_attempts,
      ROUND(AVG(qa.score), 2)::text AS mastery_score
    FROM quiz_attempts qa
    JOIN quizzes q ON q.id = qa.quiz_id
    JOIN modules m ON m.id = q.module_id
    JOIN courses c ON c.id = m.course_id
    JOIN enrollments e
      ON e.course_id = c.id
      AND e.student_id = qa.user_id
    WHERE qa.user_id = $1
      AND qa.submitted_at IS NOT NULL
      AND qa.score IS NOT NULL
      AND q.approval_status = 'approved'
      AND c.status = 'approved'
    GROUP BY m.id, m.title
    ORDER BY AVG(qa.score) DESC
    `,
    [studentId],
  );

  const modules = result.rows.map((row) => {
    const masteryScore = Number(row.mastery_score);

    let masteryLevel: StudentMasteryResponse["modules"][number]["mastery_level"];
    let recommendedDifficulty: StudentMasteryResponse["modules"][number]["recommended_difficulty"];

    if (masteryScore < 40) {
      masteryLevel = "beginner";
      recommendedDifficulty = "beginner";
    } else if (masteryScore < 70) {
      masteryLevel = "developing";
      recommendedDifficulty = "intermediate";
    } else if (masteryScore < 85) {
      masteryLevel = "proficient";
      recommendedDifficulty = "advanced";
    } else {
      masteryLevel = "mastered";
      recommendedDifficulty = "advanced_challenge";
    }

    return {
      module_id: row.module_id,
      module_title: row.module_title,
      total_attempts: Number(row.total_attempts),
      mastery_score: masteryScore,
      mastery_level: masteryLevel,
      recommended_difficulty: recommendedDifficulty,
    };
  });

  const totalAttempts = modules.reduce(
    (total, module) => total + module.total_attempts,
    0,
  );

  const overallMasteryScore =
    totalAttempts > 0
      ? Number(
          (
            modules.reduce(
              (total, module) =>
                total + module.mastery_score * module.total_attempts,
              0,
            ) / totalAttempts
          ).toFixed(2),
        )
      : 0;

  return {
    student_id: studentId,
    overall_mastery_score: overallMasteryScore,
    total_attempts: totalAttempts,
    modules,
    strengths: modules
      .filter((module) => module.mastery_score >= 70)
      .map((module) => module.module_title),
    focus_areas: modules
      .filter((module) => module.mastery_score < 70)
      .map((module) => module.module_title),
  };
}



export async function generateAdaptivePracticeQuiz(
  studentId: string,
  moduleId: string,
  questionCount: number,
) {
  if (
    !Number.isInteger(questionCount) ||
    questionCount < 5 ||
    questionCount > 10
  ) {
    throw new Error("INVALID_QUESTION_COUNT");
  }

  // 1. Verify module access and enrollment.
  const moduleResult = await pool.query<{
    id: string;
    title: string;
  }>(
    `
    SELECT m.id, m.title
    FROM modules m
    JOIN courses c ON c.id = m.course_id
    JOIN enrollments e ON e.course_id = c.id
    WHERE m.id = $1
      AND e.student_id = $2
      AND c.status = 'approved'
      AND EXISTS (
        SELECT 1
        FROM lectures l
        WHERE l.module_id = m.id
          AND NULLIF(BTRIM(l.transcript), '') IS NOT NULL
      )
    `,
    [moduleId, studentId],
  );

  const module = moduleResult.rows[0];

  if (!module) {
    throw new Error("MODULE_NOT_FOUND_OR_ACCESS_DENIED");
  }

  // 2. Determine adaptive difficulty from mastery scores.
  const mastery = await getStudentMasteryScores(studentId);

  const moduleMastery = mastery.modules.find(
    (item) => item.module_id === moduleId,
  );

  const difficulty = moduleMastery?.recommended_difficulty ?? "beginner";

  const masteryScore = moduleMastery?.mastery_score ?? 0;

  // 3. Get AI service configuration.
  const { baseUrl, internalToken } = getAiServiceConfig();

  // 4. Request adaptive quiz from FastAPI.
  let response: Response;

  try {
    response = await fetch(
      new URL(
        `/internal/modules/${encodeURIComponent(moduleId)}/generate-practice-quiz`,
        baseUrl,
      ),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Internal-Token": internalToken,
        },
        body: JSON.stringify({
          student_id: studentId,
          difficulty,
          question_count: questionCount,
        }),
        signal: AbortSignal.timeout(120_000),
      },
    );
  } catch {
    throw new Error("PRACTICE_QUIZ_SERVICE_UNAVAILABLE");
  }

  if (response.status === 404) {
    throw new Error("MODULE_TRANSCRIPT_NOT_FOUND");
  }

  if (response.status === 401 || response.status === 503) {
    throw new Error("AI_CONFIGURATION_MISSING");
  }

  if (!response.ok) {
    throw new Error("PRACTICE_QUIZ_SERVICE_FAILED");
  }

  // 5. Validate generated quiz response.
  const data = (await response.json()) as {
    module_id?: string;
    student_id?: string;
    difficulty?: string;
    quiz?: GeneratedQuizResponse;
  };

  const generated = data.quiz;

  if (
    data.module_id !== moduleId ||
    data.student_id !== studentId ||
    data.difficulty !== difficulty ||
    !generated ||
    typeof generated.title !== "string" ||
    !generated.title.trim() ||
    !Array.isArray(generated.questions) ||
    generated.questions.length !== questionCount
  ) {
    throw new Error("PRACTICE_QUIZ_INVALID_RESPONSE");
  }

  for (const question of generated.questions) {
    if (
      typeof question.question_text !== "string" ||
      !question.question_text.trim() ||
      !Array.isArray(question.options) ||
      question.options.length !== 4 ||
      question.options.filter((option) => option.is_correct === true).length !==
        1 ||
      question.options.some(
        (option) =>
          typeof option.option_text !== "string" ||
          !option.option_text.trim() ||
          typeof option.is_correct !== "boolean",
      )
    ) {
      throw new Error("PRACTICE_QUIZ_INVALID_RESPONSE");
    }
  }

  // 6. Save student-specific practice quiz atomically.
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const quizResult = await client.query(
      `
      INSERT INTO quizzes (
        module_id,
        title,
        is_ai_generated,
        approval_status,
        is_adaptive_practice,
        created_for_student_id,
        difficulty_level
      )
      VALUES ($1, $2, TRUE, 'approved', TRUE, $3, $4)
      RETURNING
        id,
        module_id,
        title,
        is_adaptive_practice,
        difficulty_level
      `,
      [moduleId, generated.title.trim(), studentId, difficulty],
    );

    const quiz = quizResult.rows[0];

    for (const [index, question] of generated.questions.entries()) {
      const questionResult = await client.query(
        `
        INSERT INTO quiz_questions (
          quiz_id,
          question_text,
          question_type,
          order_index
        )
        VALUES ($1, $2, 'mcq', $3)
        RETURNING id
        `,
        [quiz.id, question.question_text.trim(), index + 1],
      );

      const questionId = questionResult.rows[0].id;

      for (const option of question.options) {
        await client.query(
          `
          INSERT INTO quiz_options (
            question_id,
            option_text,
            is_correct
          )
          VALUES ($1, $2, $3)
          `,
          [questionId, option.option_text.trim(), option.is_correct],
        );
      }
    }

    await client.query("COMMIT");

    return {
      ...quiz,
      question_count: generated.questions.length,
      mastery_score: masteryScore,
      recommended_difficulty: difficulty,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
