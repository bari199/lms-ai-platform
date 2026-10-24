import { Queue } from "bullmq";
import { createQueueRedisConnection } from "../config/redis.js";

export const recommendationQueue = new Queue(
  "recommendation-score-recalculation",
  {
    connection: createQueueRedisConnection(),
  },
);
