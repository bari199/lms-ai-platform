import { pool } from "../../config/db.js";

export const getCourseRecommendations = async (studentId: string) => {
  const result = await pool.query(
    `
      WITH performance AS (
        SELECT
          LOWER(c.category) AS category,
          LOWER(c.difficulty) AS difficulty,
          AVG(ms.mastery_score)::numeric(5,2) AS average_score
        FROM module_mastery_scores ms
        JOIN modules m ON m.id = ms.module_id
        JOIN courses c ON c.id = m.course_id
        WHERE ms.student_id = $1
          AND ms.scored_attempts > 0
        GROUP BY LOWER(c.category), LOWER(c.difficulty)
      )
      SELECT
        c.id,
        c.title,
        c.description,
        c.category,
        c.difficulty,
        c.thumbnail_url,
        c.price,
        p.average_score AS related_quiz_average,
        CASE
          WHEN p.average_score IS NULL THEN 0
          ELSE 100 - p.average_score
        END AS performance_priority
      FROM courses c
      LEFT JOIN performance p
        ON LOWER(c.category) = p.category
        AND LOWER(c.difficulty) = p.difficulty
      WHERE c.status = 'approved'
        AND NOT EXISTS (
          SELECT 1
          FROM enrollments e
          WHERE e.course_id = c.id
            AND e.student_id = $1
        )
      ORDER BY
        CASE WHEN p.average_score IS NULL THEN 1 ELSE 0 END,
        performance_priority DESC,
        c.created_at DESC
      LIMIT 5
    `,
    [studentId],
  );

  return result.rows;
};
