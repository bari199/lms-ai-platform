import { Worker, type Job } from "bullmq";
import { pool } from "../config/db.js";
import { createQueueRedisConnection } from "../config/redis.js";
import type { NotificationJobData } from "./notification.queue.js";

const QUEUE_NAME = "in-app-notifications";
const JOB_NAME = "create-in-app-notification";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const validateNotificationJob = (data: NotificationJobData): void => {
  if (!UUID_REGEX.test(data.userId)) {
    throw new Error("Invalid notification recipient userId");
  }

  if (data.actorId !== null && !UUID_REGEX.test(data.actorId)) {
    throw new Error("Invalid notification actorId");
  }

  if (data.courseId !== null && !UUID_REGEX.test(data.courseId)) {
    throw new Error("Invalid notification courseId");
  }

  if (!data.type || !data.title?.trim() || !data.message?.trim()) {
    throw new Error("Notification type, title and message are required");
  }

  if (
    data.data !== undefined &&
    (typeof data.data !== "object" ||
      data.data === null ||
      Array.isArray(data.data))
  ) {
    throw new Error("Notification data must be a JSON object");
  }
};

const processNotificationJob = async (
  job: Job<NotificationJobData>,
): Promise<void> => {
  if (job.name !== JOB_NAME) {
    throw new Error(`Unsupported notification job: ${job.name}`);
  }

  const notification = job.data;

  validateNotificationJob(notification);

  await pool.query(
    `
      INSERT INTO notifications (
        user_id,
        actor_id,
        course_id,
        type,
        title,
        message,
        data
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
    `,
    [
      notification.userId,
      notification.actorId,
      notification.courseId,
      notification.type,
      notification.title.trim(),
      notification.message.trim(),
      JSON.stringify(notification.data ?? {}),
    ],
  );

  console.log(`Notification saved for user: ${notification.userId}`);
};

export const notificationWorker = new Worker<NotificationJobData>(
  QUEUE_NAME,
  processNotificationJob,
  {
    connection: createQueueRedisConnection(),
    concurrency: 5,
  },
);

notificationWorker.on("completed", (job) => {
  console.log(`Notification job completed: ${job.id}`);
});

notificationWorker.on("failed", (job, error) => {
  console.error(`Notification job failed: ${job?.id}`, error.message);
});

notificationWorker.on("error", (error) => {
  console.error("Notification worker error:", error);
});
