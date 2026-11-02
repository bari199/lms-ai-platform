import { pool } from "../../config/db.js";
import { notificationQueue } from "../../jobs/notification.queue.js";
import type { NotificationJobData } from "../../jobs/notification.queue.js";

// Create notification through BullMQ.
export const createNotification = async (notification: NotificationJobData) => {
  const job = await notificationQueue.add(
    "create-in-app-notification",
    notification,
  );

  return {
    jobId: job.id,
  };
};

// Get logged-in user's notifications.
export const getNotifications = async (
  userId: string,
  limit: number,
  offset: number,
) => {
  const result = await pool.query(
    `
      SELECT
        id,
        user_id,
        actor_id,
        course_id,
        type,
        title,
        message,
        data,
        is_read,
        read_at,
        created_at
      FROM notifications
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2
      OFFSET $3
    `,
    [userId, limit, offset],
  );

  return result.rows;
};

// Get unread notification count.
export const getUnreadNotificationCount = async (userId: string) => {
  const result = await pool.query<{ count: number }>(
    `
      SELECT COUNT(*)::int AS count
      FROM notifications
      WHERE user_id = $1
        AND is_read = FALSE
    `,
    [userId],
  );

  return result.rows[0]?.count ?? 0;
};

// Mark one notification as read.
export const markNotificationAsRead = async (
  notificationId: string,
  userId: string,
) => {
  const result = await pool.query(
    `
      UPDATE notifications
      SET
        is_read = TRUE,
        read_at = now()
      WHERE id = $1
        AND user_id = $2
        AND is_read = FALSE
      RETURNING *
    `,
    [notificationId, userId],
  );

  return result.rows[0] ?? null;
};

// Mark all notifications as read.
export const markAllNotificationsAsRead = async (userId: string) => {
  const result = await pool.query(
    `
      UPDATE notifications
      SET
        is_read = TRUE,
        read_at = now()
      WHERE user_id = $1
        AND is_read = FALSE
    `,
    [userId],
  );

  return result.rowCount ?? 0;
};
