import { pool } from "../../config/db.js";
import { createNotification } from "../notifications/notifications.service.js";

interface CreateAnnouncementInput {
  courseId: string;
  instructorId: string;
  title: string;
  message: string;
}

export const createAnnouncement = async ({
  courseId,
  instructorId,
  title,
  message,
}: CreateAnnouncementInput) => {
  const client = await pool.connect();

  let announcement: Record<string, unknown>;
  let studentIds: string[];

  try {
    await client.query("BEGIN");

    const courseResult = await client.query(
      `SELECT id, instructor_id
       FROM courses
       WHERE id = $1`,
      [courseId],
    );

    if (courseResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return { error: "COURSE_NOT_FOUND" as const };
    }

    if (courseResult.rows[0].instructor_id !== instructorId) {
      await client.query("ROLLBACK");
      return { error: "FORBIDDEN" as const };
    }

    const announcementResult = await client.query(
      `INSERT INTO announcements (
         course_id,
         instructor_id,
         title,
         message
       )
       VALUES ($1, $2, $3, $4)
       RETURNING id, course_id, instructor_id, title, message, created_at`,
      [courseId, instructorId, title.trim(), message.trim()],
    );

    announcement = announcementResult.rows[0];

    const studentsResult = await client.query<{ student_id: string }>(
      `SELECT student_id
       FROM enrollments
       WHERE course_id = $1`,
      [courseId],
    );

    studentIds = studentsResult.rows.map((row) => row.student_id);

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  // Queue notifications after the announcement is committed.
  const notificationResults = await Promise.allSettled(
    studentIds.map((studentId) =>
      createNotification({
        userId: studentId,
        actorId: instructorId,
        courseId,
        type: "course_announcement",
        title: `New announcement: ${title.trim()}`,
        message: message.trim(),
        data: {
          announcementId: announcement.id,
        },
      }),
    ),
  );

  const queuedCount = notificationResults.filter(
    (result) => result.status === "fulfilled",
  ).length;

  const failedCount = notificationResults.length - queuedCount;

  return {
    announcement,
    notificationStats: {
      totalStudents: studentIds.length,
      queued: queuedCount,
      failed: failedCount,
    },
  };
};

export const getCourseAnnouncements = async (
  courseId: string,
  studentId: string,
) => {
  const enrollmentResult = await pool.query(
    `SELECT id
     FROM enrollments
     WHERE course_id = $1
       AND student_id = $2`,
    [courseId, studentId],
  );

  if (enrollmentResult.rows.length === 0) {
    return null;
  }

  const result = await pool.query(
    `SELECT
       id,
       course_id,
       instructor_id,
       title,
       message,
       created_at,
       updated_at
     FROM announcements
     WHERE course_id = $1
     ORDER BY created_at DESC`,
    [courseId],
  );

  return result.rows;
};
