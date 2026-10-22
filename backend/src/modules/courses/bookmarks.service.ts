import { pool } from "../../config/db.js";

interface CreateBookmarkInput {
  userId: string;
  lectureId: string;
  timestampSeconds: number;
}

export async function createLectureBookmark({
  userId,
  lectureId,
  timestampSeconds,
}: CreateBookmarkInput) {
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
    [lectureId, userId],
  );

  if (lectureResult.rows.length === 0) {
    throw new Error("Lecture not found or you are not enrolled in this course");
  }

  const result = await pool.query(
    `INSERT INTO bookmarks
       (user_id, lecture_id, timestamp_seconds)
     VALUES ($1, $2, $3)
     RETURNING id, user_id, lecture_id,
               timestamp_seconds, created_at`,
    [userId, lectureId, timestampSeconds],
  );

  return result.rows[0];
}
