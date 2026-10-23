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
     FROM assignments AS a
     JOIN enrollments AS e ON e.course_id = a.course_id
     JOIN courses AS c ON c.id = a.course_id
     WHERE a.id = $1
       AND e.student_id = $2
       AND c.status = 'approved'
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
       submitted_at = NOW(),
       grade = NULL,
       feedback = NULL
     RETURNING
       id,
       assignment_id,
       user_id,
       file_url,
       submitted_at,
       grade,
       feedback`,
    [assignmentId, userId, fileUrl],
  );

  return result.rows[0];
}

interface CreateAssignmentInput {
  instructorId: string;
  courseId: string;
  title: string;
  instructions?: string;
  rubric?: Record<string, unknown>;
  dueDate?: string | null;
}

export async function createAssignment({
  instructorId,
  courseId,
  title,
  instructions,
  rubric,
  dueDate,
}: CreateAssignmentInput) {
  if (!title.trim()) {
    throw new Error("Assignment title is required");
  }

  const courseResult = await pool.query(
    `SELECT id
     FROM courses
     WHERE id = $1
       AND instructor_id = $2
       AND status IN ('approved', 'pending')
     LIMIT 1`,
    [courseId, instructorId],
  );

  if (courseResult.rows.length === 0) {
    throw new Error("Course not found or you do not own this course");
  }

  const result = await pool.query(
    `INSERT INTO assignments
       (course_id, title, instructions, rubric, due_date)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING
       id,
       course_id,
       title,
       instructions,
       rubric,
       due_date`,
    [
      courseId,
      title.trim(),
      instructions ?? null,
      rubric === undefined ? null : JSON.stringify(rubric),
      dueDate ?? null,
    ],
  );

  return result.rows[0];
}

export async function getAssignmentsForStudent(studentId: string) {
  const result = await pool.query(
    `SELECT
       a.id,
       a.course_id,
       a.title,
       a.instructions,
       a.rubric,
       a.due_date
     FROM assignments AS a
     JOIN enrollments AS e ON e.course_id = a.course_id
     JOIN courses AS c ON c.id = a.course_id
     WHERE e.student_id = $1
       AND c.status = 'approved'
     ORDER BY a.due_date ASC NULLS LAST`,
    [studentId],
  );

  return result.rows;
}

interface GradeAssignmentInput {
  submissionId: string;
  instructorId: string;
  grade: number;
  feedback?: string;
}

export async function gradeAssignment({
  submissionId,
  instructorId,
  grade,
  feedback,
}: GradeAssignmentInput) {
  if (!Number.isFinite(grade) || grade < 0 || grade > 100) {
    throw new Error("Grade must be between 0 and 100");
  }

  const result = await pool.query(
    `UPDATE assignment_submissions AS s
     SET grade = $1,
         feedback = $2
     FROM assignments AS a
     JOIN courses AS c ON c.id = a.course_id
     WHERE s.id = $3
       AND s.assignment_id = a.id
       AND c.instructor_id = $4
     RETURNING
       s.id,
       s.assignment_id,
       s.user_id,
       s.grade,
       s.feedback,
       s.file_url,
       s.submitted_at`,
    [grade, feedback ?? null, submissionId, instructorId],
  );

  if (result.rows.length === 0) {
    throw new Error("Submission not found or you do not own this course");
  }

  return result.rows[0];
}

export async function getStudentAssignmentResults(studentId: string) {
  const result = await pool.query(
    `SELECT
       s.id,
       s.assignment_id,
       s.user_id,
       s.file_url,
       s.submitted_at,
       s.grade,
       s.feedback,
       a.title AS assignment_title,
       a.due_date
     FROM assignment_submissions AS s
     JOIN assignments AS a ON a.id = s.assignment_id
     JOIN courses AS c ON c.id = a.course_id
     WHERE s.user_id = $1
       AND c.status = 'approved'
     ORDER BY s.submitted_at DESC`,
    [studentId],
  );

  return result.rows;
}
