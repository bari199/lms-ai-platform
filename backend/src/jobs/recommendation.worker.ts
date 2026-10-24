import { Worker } from "bullmq";
import { pool } from "../config/db.js";
import { createQueueRedisConnection } from "../config/redis.js";

type RecommendationJobData = {
  studentId?: string;
};

export const recommendationWorker = new Worker<RecommendationJobData>(
  "recommendation-score-recalculation",
  async (job) => {
    if (job.name !== "recalculate-recommendation-scores") {
      throw new Error(`Unsupported recommendation job: ${job.name}`);
    }

    const studentId = job.data?.studentId ?? null;

    if (
      studentId !== null &&
      (typeof studentId !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          studentId,
        ))
    ) {
      throw new Error("Invalid studentId in recommendation job");
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      await client.query(
        `
          WITH latest_quiz_attempts AS (
            SELECT DISTINCT ON (qa.user_id, qa.quiz_id)
              qa.user_id,
              q.module_id,
              qa.quiz_id,
              qa.score
            FROM quiz_attempts qa
            JOIN quizzes q ON q.id = qa.quiz_id
            WHERE qa.submitted_at IS NOT NULL
              AND qa.score IS NOT NULL
              AND ($1::uuid IS NULL OR qa.user_id = $1::uuid)
            ORDER BY
              qa.user_id,
              qa.quiz_id,
              qa.submitted_at DESC
          ),
          module_scores AS (
            SELECT
              user_id AS student_id,
              module_id,
              AVG(score)::numeric(5,2) AS mastery_score,
              COUNT(*)::int AS scored_attempts
            FROM latest_quiz_attempts
            GROUP BY user_id, module_id
          )
          INSERT INTO module_mastery_scores (
            student_id,
            module_id,
            mastery_score,
            scored_attempts,
            updated_at
          )
          SELECT
            student_id,
            module_id,
            mastery_score,
            scored_attempts,
            now()
          FROM module_scores
          ON CONFLICT (student_id, module_id)
          DO UPDATE SET
            mastery_score = EXCLUDED.mastery_score,
            scored_attempts = EXCLUDED.scored_attempts,
            updated_at = now()
        `,
        [studentId],
      );

      await client.query(
        `
          DELETE FROM module_mastery_scores ms
          WHERE ($1::uuid IS NULL OR ms.student_id = $1::uuid)
            AND NOT EXISTS (
              SELECT 1
              FROM quiz_attempts qa
              JOIN quizzes q ON q.id = qa.quiz_id
              WHERE qa.user_id = ms.student_id
                AND q.module_id = ms.module_id
                AND qa.submitted_at IS NOT NULL
                AND qa.score IS NOT NULL
            )
        `,
        [studentId],
      );

      await client.query("COMMIT");

      return {
        processed: true,
        scope: studentId ? "student" : "all-students",
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },
  {
    connection: createQueueRedisConnection(),
  },
);

recommendationWorker.on("completed", (job) => {
  console.log(`Recommendation job completed: ${job.id}`);
});

recommendationWorker.on("failed", (job, error) => {
  console.error(`Recommendation job failed: ${job?.id}`, error);
});
