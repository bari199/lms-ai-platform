import { pool } from "../../config/db.js";
import { createNotification } from "../notifications/notifications.service.js";

type DiscussionRole = "student" | "instructor";

interface CreateDiscussionInput {
  courseId: string;
  userId: string;
  role: DiscussionRole;
  title?: string | null;
  content: string;
  parentId?: string | null;
}

const hasCourseAccess = async (
  courseId: string,
  userId: string,
  role: DiscussionRole,
): Promise<boolean> => {
  const result = await pool.query(
    `
      SELECT c.id
      FROM courses c
      WHERE c.id = $1
        AND (
          (
            $3 = 'instructor'
            AND c.instructor_id = $2
          )
          OR
          (
            $3 = 'student'
            AND c.status = 'approved'
            AND EXISTS (
              SELECT 1
              FROM enrollments e
              WHERE e.course_id = c.id
                AND e.student_id = $2
            )
          )
        )
      LIMIT 1
    `,
    [courseId, userId, role],
  );

  return result.rowCount === 1;
};

export const getCourseDiscussions = async (
  courseId: string,
  userId: string,
  role: DiscussionRole,
) => {
  const allowed = await hasCourseAccess(courseId, userId, role);

  if (!allowed) {
    return null;
  }

  const result = await pool.query(
    `
      SELECT
        d.id,
        d.course_id,
        d.author_id,
        u.full_name AS author_name,
        d.parent_id,
        d.title,
        d.content,
        d.is_pinned,
        d.created_at,
        d.updated_at
      FROM discussions d
      JOIN users u ON u.id = d.author_id
      WHERE d.course_id = $1
        AND d.is_deleted = FALSE
      ORDER BY
        d.is_pinned DESC,
        d.created_at ASC
    `,
    [courseId],
  );

  return result.rows;
};

export const createDiscussion = async (input: CreateDiscussionInput) => {
  const { courseId, userId, role, title, content, parentId } = input;

  const allowed = await hasCourseAccess(courseId, userId, role);

  if (!allowed) {
    return null;
  }

  let parentAuthorId: string | null = null;

  // Validate parent discussion and get its author.
  if (parentId) {
    const parentResult = await pool.query(
      `
        SELECT id, author_id
        FROM discussions
        WHERE id = $1
          AND course_id = $2
          AND is_deleted = FALSE
        LIMIT 1
      `,
      [parentId, courseId],
    );

    if (parentResult.rowCount !== 1) {
      throw new Error("Parent discussion not found");
    }

    parentAuthorId = parentResult.rows[0].author_id;
  } else if (!title?.trim()) {
    throw new Error("Discussion title is required");
  }

  // Create discussion or reply.
  const result = await pool.query(
    `
      INSERT INTO discussions (
        course_id,
        author_id,
        parent_id,
        title,
        content
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `,
    [
      courseId,
      userId,
      parentId ?? null,
      parentId ? null : title!.trim(),
      content.trim(),
    ],
  );

  const discussion = result.rows[0];

  // Notify the parent discussion author.
  // Do not notify when users reply to their own discussion.
  if (parentId && parentAuthorId && parentAuthorId !== userId) {
    try {
      await createNotification({
        userId: parentAuthorId,
        actorId: userId,
        courseId,
        type: "discussion_replied",
        title: "New discussion reply",
        message: "Someone replied to your discussion.",
        data: {
          discussionId: parentId,
          replyId: discussion.id,
        },
      });
    } catch (error) {
      console.error("Failed to queue discussion reply notification:", error);
    }
  }

  return discussion;
};

export const updateDiscussion = async (
  discussionId: string,
  userId: string,
  title: string | null,
  content: string,
) => {
  const result = await pool.query(
    `
      UPDATE discussions d
      SET
        title = CASE
          WHEN d.parent_id IS NULL
          THEN COALESCE($3, d.title)
          ELSE d.title
        END,
        content = $4,
        updated_at = now()
      WHERE d.id = $1
        AND d.author_id = $2
        AND d.is_deleted = FALSE
      RETURNING d.*
    `,
    [discussionId, userId, title, content.trim()],
  );

  return result.rows[0] ?? null;
};

export const deleteDiscussion = async (
  discussionId: string,
  userId: string,
  role: DiscussionRole,
) => {
  const result = await pool.query(
    `
      WITH RECURSIVE discussion_tree AS (
        SELECT d.id
        FROM discussions d
        WHERE d.id = $1
          AND d.is_deleted = FALSE
          AND (
            d.author_id = $2
            OR (
              $3 = 'instructor'
              AND EXISTS (
                SELECT 1
                FROM courses c
                WHERE c.id = d.course_id
                  AND c.instructor_id = $2
              )
            )
          )

        UNION ALL

        SELECT child.id
        FROM discussions child
        INNER JOIN discussion_tree parent
          ON child.parent_id = parent.id
        WHERE child.is_deleted = FALSE
      )
      UPDATE discussions d
      SET
        is_deleted = TRUE,
        updated_at = now()
      WHERE d.id IN (SELECT id FROM discussion_tree)
      RETURNING d.id, d.course_id
    `,
    [discussionId, userId, role],
  );

  return result.rows[0] ?? null;
};

export const pinDiscussion = async (
  discussionId: string,
  instructorId: string,
  isPinned: boolean,
) => {
  const result = await pool.query(
    `
      UPDATE discussions d
      SET
        is_pinned = $3,
        updated_at = now()
      FROM courses c
      WHERE d.id = $1
        AND d.course_id = c.id
        AND c.instructor_id = $2
        AND d.parent_id IS NULL
        AND d.is_deleted = FALSE
      RETURNING d.*
    `,
    [discussionId, instructorId, isPinned],
  );

  return result.rows[0] ?? null;
};
