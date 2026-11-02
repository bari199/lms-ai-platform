import { Queue } from "bullmq";
import { createQueueRedisConnection } from "../config/redis.js";

export interface NotificationJobData {
  userId: string;
  actorId: string | null;
  courseId: string | null;
  type:
    | "assignment_submitted"
    | "assignment_graded"
    | "discussion_replied"
    | "course_announcement";
  title: string;
  message: string;
  data?: Record<string, unknown>;
}

export const notificationQueue = new Queue<NotificationJobData>(
  "in-app-notifications",
  {
    connection: createQueueRedisConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 1000,
      },
      removeOnComplete: 1000,
      removeOnFail: 5000,
    },
  },
);
