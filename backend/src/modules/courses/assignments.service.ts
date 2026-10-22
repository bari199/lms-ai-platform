import { pool } from "../../config/db.js";

interface SubmitAssignmentInput {
  assignmentId: string;
  userId: string;
  fileUrl: string;
}

export async function submitAssignment({
  assignmentId,
  userId,
  fileUrl,
}: SubmitAssignmentInput) {
  if (!fileUrl.trim()) {
    throw new Error("Assignment file is required");
  }

  const assignmentResult = await pool.query(
    `SELECT a.id, a.due_date
     FROM assignments a
     JOIN enrollments e ON e.course_id = a.course_id
     WHERE a.id = $1
       AND e.student_id = $2
       AND EXISTS (
         SELECT 1
         FROM courses c
         WHERE c.id = a.course_id
           AND c.status = 'approved'
       )
     LIMIT 1`,
    [assignmentId, userId],
  );

  if (assignmentResult.rows.length === 0) {
    throw new Error(
      "Assignment not found or you are not enrolled in this course",
    );
  }

  const assignment = assignmentResult.rows[0];

  if (
    assignment.due_date &&
    new Date(assignment.due_date).getTime() < Date.now()
  ) {
    throw new Error("Assignment deadline has passed");
  }

  const result = await pool.query(
    `INSERT INTO assignment_submissions
       (assignment_id, user_id, file_url)
     VALUES ($1, $2, $3)
     ON CONFLICT (assignment_id, user_id)
     DO UPDATE SET
       file_url = EXCLUDED.file_url,
       submitted_at = now()
     RETURNING id, assignment_id, user_id,
               file_url, submitted_at`,
    [assignmentId, userId, fileUrl],
  );

  return result.rows[0];
}
