import Redis from "ioredis";
import dotenv from "dotenv";

dotenv.config();

export const redis = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: Number(process.env.REDIS_PORT) || 6379,
  lazyConnect: true,
  maxRetriesPerRequest: 1,
});

export const checkRedisConnection = async (): Promise<void> => {
  await redis.connect();

  const result = await redis.ping();

  if (result !== "PONG") {
    throw new Error("Redis health check failed");
  }

  console.log("Redis connected:", result);
};
