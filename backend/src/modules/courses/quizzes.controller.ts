import type { Request, Response } from "express";
import { pool } from "../../config/db.js";
import type { AuthenticatedRequest } from "../../middleware/auth.middleware.js";
import {
  startQuizAttempt,
  getQuizForStudent,
  submitQuizAttempt,
  getQuizAttemptResult,
} from "./quizzes.service.js";
import { awardBadge } from "../gamification/badges.service.js";
import { recommendationQueue } from "../../jobs/recommendation.queue.js";

export const createQuizController = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const authenticatedReq = req as AuthenticatedRequest;
  const instructorId = authenticatedReq.user?.id;

  if (!instructorId) {
    res.status(401).json({
      success: false,
      message: "Authentication required",
    });
    return;
  }

  const { module_id, title, questions } = req.body as {
    module_id?: string;
    title?: string;
    questions?: Array<{
      question_text?: string;
      question_type?: string;
      order_index?: number;
      options?: Array<{
        option_text?: string;
        is_correct?: boolean;
      }>;
    }>;
  };

  if (
    typeof module_id !== "string" ||
    typeof title !== "string" ||
    !title.trim() ||
    !Array.isArray(questions) ||
    questions.length === 0
  ) {
    res.status(400).json({
      success: false,
      message: "module_id, title and at least one question are required",
    });
    return;
  }

  for (const question of questions) {
    if (
      typeof question.question_text !== "string" ||
      !question.question_text.trim() ||
      !["mcq", "multi_select", "short_answer"].includes(
        question.question_type ?? "",
      ) ||
      !Number.isInteger(question.order_index) ||
      (question.question_type !== "short_answer" &&
        (!Array.isArray(question.options) ||
          question.options.length < 2 ||
          !question.options.every(
            (option) =>
              typeof option.option_text === "string" &&
              option.option_text.trim() &&
              typeof option.is_correct === "boolean",
          ) ||
          !question.options.some((option) => option.is_correct)))
    ) {
      res.status(400).json({
        success: false,
        message: "Invalid question or options",
      });
      return;
    }
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const moduleResult = await client.query(
      `SELECT m.id
       FROM modules m
       JOIN courses c ON c.id = m.course_id
       WHERE m.id = $1 AND c.instructor_id = $2`,
      [module_id, instructorId],
    );

    if (moduleResult.rowCount !== 1) {
      await client.query("ROLLBACK");

      res.status(404).json({
        success: false,
        message: "Module not found or not owned by this instructor",
      });
      return;
    }

    const quizResult = await client.query(
      `INSERT INTO quizzes (module_id, title, is_ai_generated)
       VALUES ($1, $2, FALSE)
       RETURNING id, module_id, title, is_ai_generated`,
      [module_id, title.trim()],
    );

    const quiz = quizResult.rows[0];

    for (const question of questions) {
      const questionResult = await client.query(
        `INSERT INTO quiz_questions
           (quiz_id, question_text, question_type, order_index)
         VALUES ($1, $2, $3, $4)
         RETURNING id, question_text, question_type, order_index`,
        [
          quiz.id,
          question.question_text!.trim(),
          question.question_type,
          question.order_index,
        ],
      );

      const savedQuestion = questionResult.rows[0];

      if (question.question_type !== "short_answer") {
        for (const option of question.options!) {
          await client.query(
            `INSERT INTO quiz_options
               (question_id, option_text, is_correct)
             VALUES ($1, $2, $3)`,
            [savedQuestion.id, option.option_text!.trim(), option.is_correct],
          );
        }
      }
    }

    await client.query("COMMIT");

    res.status(201).json({
      success: true,
      message: "Quiz created successfully",
      data: quiz,
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("Create quiz failed:", error);

    res.status(500).json({
      success: false,
      message: "Failed to create quiz",
    });
  } finally {
    client.release();
  }
};

export const startQuizAttemptController = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const authenticatedReq = req as AuthenticatedRequest;
  const studentId = authenticatedReq.user?.id;
  const quizId = req.params.id;

  if (!studentId) {
    res.status(401).json({
      success: false,
      message: "Authentication required",
    });
    return;
  }

  if (typeof quizId !== "string") {
    res.status(400).json({
      success: false,
      message: "Invalid quiz ID",
    });
    return;
  }

  try {
    const attempt = await startQuizAttempt(quizId, studentId);

    if (!attempt) {
      res.status(404).json({
        success: false,
        message: "Quiz not found or you are not enrolled in this course",
      });
      return;
    }

    res.status(201).json({
      success: true,
      message: "Quiz attempt started successfully",
      data: attempt,
    });
  } catch (error) {
    console.error("Start quiz attempt failed:", error);

    res.status(500).json({
      success: false,
      message: "Failed to start quiz attempt",
    });
  }
};

export const getQuizForStudentController = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const quizId = req.params.id;

  if (typeof quizId !== "string") {
    res.status(400).json({
      success: false,
      message: "Invalid quiz ID",
    });
    return;
  }

  try {
    const quiz = await getQuizForStudent(quizId);

    if (!quiz) {
      res.status(404).json({
        success: false,
        message: "Quiz not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: quiz,
    });
  } catch (error) {
    console.error("Get quiz failed:", error);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve quiz",
    });
  }
};

export const submitQuizAttemptController = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const authenticatedReq = req as AuthenticatedRequest;
  const studentId = authenticatedReq.user?.id;

  const attemptId = Array.isArray(req.params.id)
    ? (req.params.id[0] ?? "")
    : (req.params.id ?? "");

  if (!studentId) {
    res.status(401).json({
      success: false,
      message: "Authentication required",
    });
    return;
  }

  if (typeof attemptId !== "string" || !attemptId) {
    res.status(400).json({
      success: false,
      message: "Invalid attempt ID",
    });
    return;
  }

  const { answers } = req.body as {
    answers?: Array<{
      question_id: string;
      selected_option_ids?: string[];
      text_answer?: string;
    }>;
  };

  if (!Array.isArray(answers)) {
    res.status(400).json({
      success: false,
      message: "answers must be an array",
    });
    return;
  }

  try {
    const result = await submitQuizAttempt(attemptId, studentId, answers);

    if (!result) {
      res.status(404).json({
        success: false,
        message: "Open quiz attempt not found",
      });
      return;
    }

    if (result.attempt.score === 100) {
      await awardBadge(studentId, "Perfect Quiz Score");
    }

    try {
      await recommendationQueue.add(
        "recalculate-recommendation-scores",
        { studentId },
        {
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 1000,
          },
          removeOnComplete: true,
          removeOnFail: false,
        },
      );
    } catch (error) {
      console.error("Failed to enqueue recommendation recalculation:", error);
    }

    res.status(200).json({
      success: true,
      message: "Quiz submitted successfully",
      data: result,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Invalid quiz answer") {
      res.status(400).json({
        success: false,
        message: error.message,
      });
      return;
    }

    if (
      error instanceof Error &&
      [
        "Short-answer questions cannot have selected options",
        "Objective questions cannot have text answers",
        "Duplicate selected option IDs",
        "Selected option does not belong to question",
      ].includes(error.message)
    ) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
      return;
    }

    console.error("Submit quiz attempt failed:", error);

    res.status(500).json({
      success: false,
      message: "Failed to submit quiz",
    });
  }
};

export const getQuizAttemptResultController = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const authenticatedReq = req as AuthenticatedRequest;
  const studentId = authenticatedReq.user?.id;

  const attemptId = Array.isArray(req.params.id)
    ? (req.params.id[0] ?? "")
    : req.params.id;

  if (!studentId) {
    res.status(401).json({
      success: false,
      message: "Authentication required",
    });
    return;
  }

  if (typeof attemptId !== "string" || !attemptId) {
    res.status(400).json({
      success: false,
      message: "Invalid attempt ID",
    });
    return;
  }

  try {
    const result = await getQuizAttemptResult(attemptId, studentId);

    if (!result) {
      res.status(404).json({
        success: false,
        message: "Submitted quiz result not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Get quiz result failed:", error);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve quiz result",
    });
  }
};

export const getInstructorQuizzesController = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const authenticatedReq = req as AuthenticatedRequest;
  const instructorId = authenticatedReq.user?.id;

  if (!instructorId) {
    res.status(401).json({
      success: false,
      message: "Authentication required",
    });
    return;
  }

  try {
    const result = await pool.query(
      `SELECT
         q.id,
         q.title,
         q.module_id,
         q.is_ai_generated,
         q.approval_status,
         q.generated_from_lecture_id
       FROM quizzes q
       JOIN modules m ON m.id = q.module_id
       JOIN courses c ON c.id = m.course_id
       WHERE c.instructor_id = $1
       ORDER BY q.id DESC`,
      [instructorId],
    );

    res.status(200).json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error("Get instructor quizzes failed:", error);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve instructor quizzes",
    });
  }
};

export const updateQuizApprovalController = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const authenticatedReq = req as AuthenticatedRequest;
  const instructorId = authenticatedReq.user?.id;
  const quizId = req.params.id;

  if (!instructorId) {
    res.status(401).json({
      success: false,
      message: "Authentication required",
    });
    return;
  }

  if (typeof quizId !== "string" || !quizId) {
    res.status(400).json({
      success: false,
      message: "Invalid quiz ID",
    });
    return;
  }

  const { approval_status } = req.body as {
    approval_status?: string;
  };

  if (!["approved", "rejected"].includes(approval_status ?? "")) {
    res.status(400).json({
      success: false,
      message: "approval_status must be approved or rejected",
    });
    return;
  }

  try {
    const result = await pool.query(
      `UPDATE quizzes q
       SET approval_status = $3
       FROM modules m
       JOIN courses c ON c.id = m.course_id
       WHERE q.module_id = m.id
         AND q.id = $1
         AND c.instructor_id = $2
       RETURNING q.id, q.title, q.approval_status`,
      [quizId, instructorId, approval_status],
    );

    if (result.rowCount !== 1) {
      res.status(404).json({
        success: false,
        message: "Quiz not found or not owned by this instructor",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: `Quiz ${approval_status} successfully`,
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Update quiz approval failed:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update quiz approval",
    });
  }
};

export const getStudentCourseQuizzesController = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const authenticatedReq = req as AuthenticatedRequest;
  const studentId = authenticatedReq.user?.id;
  const courseId = req.params.courseId;

  if (!studentId) {
    res.status(401).json({
      success: false,
      message: "Authentication required",
    });
    return;
  }

  if (typeof courseId !== "string" || !courseId) {
    res.status(400).json({
      success: false,
      message: "Invalid course ID",
    });
    return;
  }

  try {
    const result = await pool.query(
      `SELECT
         q.id,
         q.title,
         q.module_id,
         q.is_ai_generated,
         q.approval_status
       FROM quizzes q
       JOIN modules m ON m.id = q.module_id
       JOIN courses c ON c.id = m.course_id
       JOIN enrollments e ON e.course_id = c.id
       WHERE c.id = $1
         AND e.student_id = $2
         AND c.status = 'approved'
         AND q.approval_status = 'approved'
       ORDER BY q.id DESC`,
      [courseId, studentId],
    );

    res.status(200).json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error("Get student course quizzes failed:", error);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve course quizzes",
    });
  }
};
