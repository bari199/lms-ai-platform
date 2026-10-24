import { pool } from "../../config/db.js";
import { issueCourseCertificate } from "../gamification/certificates.service.js";
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const s3Client = new S3Client({
  region: process.env.AWS_REGION ?? "us-east-1",
});
const videoBucket = process.env.S3_BUCKET_NAME ?? process.env.AWS_S3_BUCKET;

interface UpdateLectureProgressInput {
  watched_seconds: number;
  is_completed: boolean;
}

export async function updateLectureProgress(
  studentId: string,
  lectureId: string,
  input: UpdateLectureProgressInput,
) {
  // Validate watched seconds
  if (!Number.isInteger(input.watched_seconds) || input.watched_seconds < 0) {
    throw new Error("watched_seconds must be a non-negative integer");
  }

  // Validate completion status
  if (typeof input.is_completed !== "boolean") {
    throw new Error("is_completed must be a boolean");
  }

  // Verify lecture access and course enrollment
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

  // Insert or update lecture progress
  const result = await pool.query(
    `INSERT INTO lecture_progress (
       student_id,
       lecture_id,
       watched_seconds,
       is_completed
     )
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
     RETURNING
       id,
       student_id,
       lecture_id,
       watched_seconds,
       is_completed,
       updated_at`,
    [studentId, lectureId, input.watched_seconds, input.is_completed],
  );

  // Calculate overall course progress
  const courseProgressResult = await pool.query(
    `SELECT
       m.course_id,
       COUNT(l.id)::int AS total_lectures,
       COUNT(l.id) FILTER (
         WHERE lp.is_completed = TRUE
       )::int AS completed_lectures
     FROM lectures l
     JOIN modules m ON m.id = l.module_id
     LEFT JOIN lecture_progress lp
       ON lp.lecture_id = l.id
       AND lp.student_id = $1
     WHERE m.course_id = (
       SELECT m2.course_id
       FROM lectures l2
       JOIN modules m2 ON m2.id = l2.module_id
       WHERE l2.id = $2
     )
     GROUP BY m.course_id`,
    [studentId, lectureId],
  );

  const courseProgress = courseProgressResult.rows[0];

  if (courseProgress && courseProgress.total_lectures > 0) {
    const progressPercentage = Number(
      (
        (courseProgress.completed_lectures / courseProgress.total_lectures) *
        100
      ).toFixed(2),
    );

    // Update enrollment progress
    await pool.query(
      `UPDATE enrollments
       SET progress_percentage = $3,
           completed_at = CASE
              WHEN $3::numeric = 100
                THEN COALESCE(completed_at, now())
               ELSE NULL
            END
       WHERE student_id = $1
         AND course_id = $2`,
      [studentId, courseProgress.course_id, progressPercentage],
    );

    // Issue certificate when the course is completed
    if (progressPercentage === 100) {
      await issueCourseCertificate(studentId, courseProgress.course_id);
    }
  }

  return result.rows[0];
}

export async function getCertificatePdf(
  userId: string,
  certificateId: string,
): Promise<{ buffer: Buffer; filename: string } | null> {
  const result = await pool.query<{ certificate_url: string }>(
    `SELECT certificate_url
     FROM certificates
     WHERE id = $1 AND user_id = $2`,
    [certificateId, userId],
  );

  const objectKey = result.rows[0]?.certificate_url;

  if (!objectKey) {
    return null;
  }

  const response = await s3Client.send(
    new GetObjectCommand({
      Bucket: videoBucket,
      Key: objectKey,
    }),
  );

  if (!response.Body) {
    throw new Error("Certificate PDF not found in storage");
  }

  const bytes = await response.Body.transformToByteArray();

  return {
    buffer: Buffer.from(bytes),
    filename: `certificate-${certificateId}.pdf`,
  };
}

