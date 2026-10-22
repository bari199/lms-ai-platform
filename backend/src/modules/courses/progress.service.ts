import { pool } from "../../config/db.js";

interface UpdateLectureProgressInput {
  watched_seconds: number;
  is_completed: boolean;
}

export async function updateLectureProgress(
  studentId: string,
  lectureId: string,
  input: UpdateLectureProgressInput,
) {
  if (!Number.isInteger(input.watched_seconds) || input.watched_seconds < 0) {
    throw new Error("watched_seconds must be a non-negative integer");
  }

  if (typeof input.is_completed !== "boolean") {
    throw new Error("is_completed must be a boolean");
  }

  const lectureResult = await pool.query(
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

  if (lectureResult.rows.length === 0) {
    return null;
  }

  const result = await pool.query(
    `INSERT INTO lecture_progress
       (student_id, lecture_id, watched_seconds, is_completed)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (student_id, lecture_id)
     DO UPDATE SET
       watched_seconds = GREATEST(
         lecture_progress.watched_seconds,
         EXCLUDED.watched_seconds
       ),
       is_completed =
         lecture_progress.is_completed OR EXCLUDED.is_completed,
       updated_at = now()
     RETURNING id, student_id, lecture_id, watched_seconds,
               is_completed, updated_at`,
    [studentId, lectureId, input.watched_seconds, input.is_completed],
  );

  return result.rows[0];
}
