import { pool } from "../../config/db.js";

interface CreateLectureNoteInput {
  studentId: string;
  lectureId: string;
  timestampSeconds: number;
  content: string;
}

export async function createLectureNote({
  studentId,
  lectureId,
  timestampSeconds,
  content,
}: CreateLectureNoteInput) {
  if (!content.trim()) {
    throw new Error("Note content is required");
  }

  if (!Number.isInteger(timestampSeconds) || timestampSeconds < 0) {
    throw new Error("Timestamp must be a non-negative integer");
  }

  const lectureResult = await pool.query(
    `SELECT l.id
     FROM lectures l
     JOIN modules m ON m.id = l.module_id
     JOIN courses c ON c.id = m.course_id
     JOIN enrollments e ON e.course_id = c.id
     WHERE l.id = $1
       AND e.student_id = $2
       AND c.status = 'approved'
     LIMIT 1`,
    [lectureId, studentId],
  );

  if (lectureResult.rows.length === 0) {
    throw new Error("Lecture not found or you are not enrolled in this course");
  }

  const result = await pool.query(
    `INSERT INTO lecture_notes
       (student_id, lecture_id, timestamp_seconds, content)
     VALUES ($1, $2, $3, $4)
     RETURNING id, student_id, lecture_id,
               timestamp_seconds, content,
               created_at, updated_at`,
    [studentId, lectureId, timestampSeconds, content.trim()],
  );

  return result.rows[0];
}

export async function getLectureNotes(studentId: string, lectureId: string) {
  const result = await pool.query(
    `SELECT
       n.id,
       n.student_id,
       n.lecture_id,
       n.timestamp_seconds,
       n.content,
       n.created_at,
       n.updated_at
     FROM lecture_notes n
     JOIN lectures l ON l.id = n.lecture_id
     JOIN modules m ON m.id = l.module_id
     JOIN courses c ON c.id = m.course_id
     JOIN enrollments e ON e.course_id = c.id
     WHERE n.student_id = $1
       AND n.lecture_id = $2
       AND e.student_id = $1
       AND c.status = 'approved'
     ORDER BY n.timestamp_seconds ASC, n.created_at ASC`,
    [studentId, lectureId],
  );

  return result.rows;
}
