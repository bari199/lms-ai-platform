import { pool } from "../../config/db.js";

export const startQuizAttempt = async (quizId: string, studentId: string) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const quizResult = await client.query(
      `SELECT q.id
       FROM quizzes q
       JOIN modules m ON m.id = q.module_id
       JOIN courses c ON c.id = m.course_id
       JOIN enrollments e ON e.course_id = c.id
       WHERE q.id = $1
         AND e.student_id = $2
         AND q.approval_status = 'approved'`,
      [quizId, studentId],
    );

    if (quizResult.rowCount !== 1) {
      await client.query("ROLLBACK");
      return null;
    }

    const attemptResult = await client.query(
      `INSERT INTO quiz_attempts (quiz_id, user_id)
       VALUES ($1, $2)
       RETURNING id, quiz_id, user_id, score, started_at, submitted_at`,
      [quizId, studentId],
    );

    await client.query("COMMIT");

    return attemptResult.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const getQuizForStudent = async (quizId: string) => {
  const quizResult = await pool.query(
    `SELECT id, title, module_id
     FROM quizzes
     WHERE id = $1
      AND approval_status = 'approved'`,
    [quizId],
  );

  if (quizResult.rowCount !== 1) {
    return null;
  }

  const questionsResult = await pool.query(
    `SELECT id, question_text, question_type, order_index
     FROM quiz_questions
     WHERE quiz_id = $1
     ORDER BY order_index ASC`,
    [quizId],
  );

  const questions = await Promise.all(
    questionsResult.rows.map(async (question) => {
      const optionsResult = await pool.query(
        `SELECT id, option_text
         FROM quiz_options
         WHERE question_id = $1
         ORDER BY id ASC`,
        [question.id],
      );

      return {
        ...question,
        options:
          question.question_type === "short_answer" ? [] : optionsResult.rows,
      };
    }),
  );

  return {
    ...quizResult.rows[0],
    questions,
  };
};

export const submitQuizAttempt = async (
  attemptId: string,
  studentId: string,
  answers: Array<{
    question_id: string;
    selected_option_ids?: string[];
    text_answer?: string;
  }>,
) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const attemptResult = await client.query(
      `SELECT id, quiz_id
       FROM quiz_attempts
       WHERE id = $1
         AND user_id = $2
         AND submitted_at IS NULL
       FOR UPDATE`,
      [attemptId, studentId],
    );

    if (attemptResult.rowCount !== 1) {
      await client.query("ROLLBACK");
      return null;
    }

    const { quiz_id: quizId } = attemptResult.rows[0];

    const questionsResult = await client.query(
      `SELECT id, question_type
       FROM quiz_questions
       WHERE quiz_id = $1`,
      [quizId],
    );

    const questions = questionsResult.rows;

    // Every question must have exactly one answer object.
    if (!Array.isArray(answers) || answers.length !== questions.length) {
      throw new Error("Exactly one answer is required for each question");
    }

    const questionMap = new Map(
      questions.map((question) => [question.id, question]),
    );

    const correctAnswers = new Map<string, string[]>();

    const optionsResult = await client.query(
      `SELECT qo.question_id, qo.id
       FROM quiz_options qo
       JOIN quiz_questions qq ON qq.id = qo.question_id
       WHERE qq.quiz_id = $1
         AND qo.is_correct = TRUE`,
      [quizId],
    );

    for (const option of optionsResult.rows) {
      const existing = correctAnswers.get(option.question_id) ?? [];

      existing.push(option.id);
      correctAnswers.set(option.question_id, existing);
    }

    const answerMap = new Map<string, (typeof answers)[number]>();

    for (const answer of answers) {
      if (
        !answer ||
        typeof answer.question_id !== "string" ||
        answerMap.has(answer.question_id) ||
        !questionMap.has(answer.question_id) ||
        (answer.selected_option_ids !== undefined &&
          (!Array.isArray(answer.selected_option_ids) ||
            !answer.selected_option_ids.every(
              (id) => typeof id === "string",
            ))) ||
        (answer.text_answer !== undefined &&
          typeof answer.text_answer !== "string")
      ) {
        throw new Error("Invalid quiz answer");
      }

      answerMap.set(answer.question_id, answer);
    }

    // Defensive check: reject missing or duplicate question answers.
    if (answerMap.size !== questions.length) {
      throw new Error("Exactly one answer is required for each question");
    }

    let correctCount = 0;

    for (const question of questions) {
      const answer = answerMap.get(question.id);

      // The checks above guarantee that each question has an answer.
      if (!answer) {
        throw new Error("Exactly one answer is required for each question");
      }

      const selected = answer.selected_option_ids ?? [];

      if (question.question_type === "short_answer" && selected.length > 0) {
        throw new Error("Short-answer questions cannot have selected options");
      }

      if (
        question.question_type !== "short_answer" &&
        answer.text_answer !== undefined
      ) {
        throw new Error("Objective questions cannot have text answers");
      }

      const uniqueSelected = new Set(selected);

      if (uniqueSelected.size !== selected.length) {
        throw new Error("Duplicate selected option IDs");
      }

      if (selected.length > 0) {
        const validOptions = await client.query(
          `SELECT id
           FROM quiz_options
           WHERE question_id = $1
             AND id = ANY($2::uuid[])`,
          [question.id, selected],
        );

        if (validOptions.rowCount !== selected.length) {
          throw new Error("Selected option does not belong to question");
        }
      }

      let isCorrect: boolean | null = null;

      if (question.question_type !== "short_answer") {
        const expected = correctAnswers.get(question.id) ?? [];

        const expectedSet = new Set(expected);

        isCorrect =
          selected.length === expected.length &&
          selected.every((id) => expectedSet.has(id));

        if (isCorrect) {
          correctCount++;
        }
      }

      await client.query(
        `INSERT INTO quiz_answers
           (attempt_id, question_id, selected_option_ids, text_answer, is_correct)
         VALUES ($1, $2, $3::uuid[], $4, $5)`,
        [
          attemptId,
          question.id,
          selected,
          answer.text_answer ?? null,
          isCorrect,
        ],
      );
    }

    const objectiveQuestions = questions.filter(
      (question) => question.question_type !== "short_answer",
    ).length;

    const score =
      objectiveQuestions === 0
        ? null
        : Number(((correctCount / objectiveQuestions) * 100).toFixed(2));

    const updatedAttempt = await client.query(
      `UPDATE quiz_attempts
       SET score = $2, submitted_at = NOW()
       WHERE id = $1
       RETURNING id, quiz_id, user_id, score, started_at, submitted_at`,
      [attemptId, score],
    );

    await client.query("COMMIT");

    return {
      attempt: updatedAttempt.rows[0],
      total_questions: questions.length,
      objective_questions: objectiveQuestions,
      correct_answers: correctCount,
    };
  } catch (error) {
    // All thrown validation errors roll back the transaction here.
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const getQuizAttemptResult = async (
  attemptId: string,
  studentId: string,
) => {
  const result = await pool.query(
    `SELECT
       qa.id AS attempt_id,
       qa.quiz_id,
       q.title AS quiz_title,
       qa.score,
       qa.started_at,
       qa.submitted_at
     FROM quiz_attempts qa
     JOIN quizzes q ON q.id = qa.quiz_id
     WHERE qa.id = $1
       AND qa.user_id = $2
       AND qa.submitted_at IS NOT NULL`,
    [attemptId, studentId],
  );

  return result.rows[0] ?? null;
};
