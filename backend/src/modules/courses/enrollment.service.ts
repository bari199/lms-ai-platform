import { pool } from "../../config/db.js";

export async function enrollStudent(studentId: string, courseId: string) {
  const courseResult = await pool.query(
    `SELECT id, title, status
     FROM courses
     WHERE id = $1`,
    [courseId],
  );

  if (courseResult.rows.length === 0) {
    return { error: "COURSE_NOT_FOUND" as const };
  }

  if (courseResult.rows[0].status !== "approved") {
    return { error: "COURSE_NOT_AVAILABLE" as const };
  }

  const enrollmentResult = await pool.query(
    `INSERT INTO enrollments (student_id, course_id)
     VALUES ($1, $2)
     ON CONFLICT (student_id, course_id) DO NOTHING
     RETURNING id, student_id, course_id, enrolled_at,
               progress_percentage, completed_at`,
    [studentId, courseId],
  );

  if (enrollmentResult.rows.length === 0) {
    const existingResult = await pool.query(
      `SELECT id, student_id, course_id, enrolled_at,
              progress_percentage, completed_at
       FROM enrollments
       WHERE student_id = $1 AND course_id = $2`,
      [studentId, courseId],
    );

    return {
      alreadyEnrolled: true,
      enrollment: existingResult.rows[0],
    };
  }

  return {
    alreadyEnrolled: false,
    enrollment: enrollmentResult.rows[0],
  };
}

export async function getMyEnrollments(studentId: string) {
  const result = await pool.query(
    `SELECT
       e.id AS enrollment_id,
       e.student_id,
       e.course_id,
       e.enrolled_at,
       e.progress_percentage,
       e.completed_at,
       c.title,
       c.description,
       c.category,
       c.difficulty,
       c.thumbnail_url,
       c.price
     FROM enrollments e
     JOIN courses c ON c.id = e.course_id
     WHERE e.student_id = $1
     ORDER BY e.enrolled_at DESC`,
    [studentId],
  );

  return result.rows;
}
