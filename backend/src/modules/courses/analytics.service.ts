import { pool } from "../../config/db.js";

export const getInstructorCourseAnalytics = async (
  courseId: string,
  instructorId: string,
) => {
  // Verify course ownership
  const courseResult = await pool.query(
    `SELECT id, title
     FROM courses
     WHERE id = $1
       AND instructor_id = $2`,
    [courseId, instructorId],
  );

  if (courseResult.rows.length === 0) {
    return null;
  }

  // Course enrollment count
  const enrollmentResult = await pool.query(
    `SELECT COUNT(*)::int AS enrolled_students
     FROM enrollments
     WHERE course_id = $1`,
    [courseId],
  );

  // Per-lecture progress and drop-off
  const lectureResult = await pool.query(
    `SELECT
       l.id AS lecture_id,
       l.title AS lecture_title,
       l.duration_seconds,
       COUNT(DISTINCT lp.student_id)::int AS started_students,
       COUNT(DISTINCT lp.student_id)
         FILTER (WHERE lp.is_completed = TRUE)::int
         AS completed_students
     FROM lectures l
     JOIN modules m ON m.id = l.module_id
     LEFT JOIN lecture_progress lp
       ON lp.lecture_id = l.id
     WHERE m.course_id = $1
     GROUP BY
        l.id,
        l.title,
        l.duration_seconds,
        l.order_index,
        m.order_index
        ORDER BY
        m.order_index,
        l.order_index`,
    [courseId],
  );

  // Average submitted quiz score and completion duration
  const quizResult = await pool.query(
    `SELECT
       ROUND(AVG(qa.score), 2) AS average_quiz_score,
       ROUND(
         AVG(
           EXTRACT(EPOCH FROM (qa.submitted_at - qa.started_at))
         )
       )::int AS average_quiz_duration_seconds,
       COUNT(qa.id)::int AS submitted_attempts
     FROM quiz_attempts qa
     JOIN quizzes q ON q.id = qa.quiz_id
     JOIN modules m ON m.id = q.module_id
     WHERE m.course_id = $1
       AND qa.submitted_at IS NOT NULL
       AND qa.submitted_at >= qa.started_at`,
    [courseId],
  );

  const lectureAnalytics = lectureResult.rows.map((lecture) => {
    const started = lecture.started_students;
    const completed = lecture.completed_students;

    return {
      ...lecture,
      drop_off_rate:
        started > 0
          ? Number((((started - completed) / started) * 100).toFixed(2))
          : null,
    };
  });

  return {
    course: courseResult.rows[0],
    overview: {
      enrolled_students: enrollmentResult.rows[0].enrolled_students,
      average_quiz_score: quizResult.rows[0].average_quiz_score,
      average_quiz_duration_seconds:
        quizResult.rows[0].average_quiz_duration_seconds,
      submitted_attempts: quizResult.rows[0].submitted_attempts,
    },
    lecture_analytics: lectureAnalytics,
  };
};
