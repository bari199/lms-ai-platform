import express from "express";
import dotenv from "dotenv";
import { createServer } from "node:http";
import { initializeSocket, shutdownSocket } from "./config/socket.js";
import { checkDatabaseConnection, pool } from "./config/db.js";
import { checkRedisConnection, redis } from "./config/redis.js";

import authRoutes from "./modules/auth/auth.routes.js";
import courseRoutes from "./modules/courses/courses.routes.js";
import enrollmentRoutes from "./modules/courses/enrollment.routes.js";
import progressRoutes from "./modules/courses/progress.routes.js";
import notesRoutes from "./modules/courses/notes.routes.js";
import bookmarksRoutes from "./modules/courses/bookmarks.routes.js";
import assignmentsRoutes from "./modules/courses/assignments.routes.js";
import quizRoutes from "./modules/courses/quizzes.routes.js";
import gamificationRoutes from "./modules/gamification/gamification.routes.js";
import aiRoutes from "./modules/ai/ai.routes.js";
import adminRoutes from "./modules/admin/admin.routes.js";
import paymentRoutes from "./modules/payments/payments.routes.js";
import { handleStripeWebhook } from "./modules/payments/payments.webhook.js";
import discussionsRoutes from "./modules/discussions/discussions.routes.js";
import notificationsRoutes from "./modules/notifications/notifications.routes.js";
import announcementsRoutes from "./modules/announcements/announcements.routes.js";

import { recommendationWorker } from "./jobs/recommendation.worker.js";
import { notificationWorker } from "./jobs/notification.worker.js";
import { notificationQueue } from "./jobs/notification.queue.js";

import cookieParser from "cookie-parser";
import cors from "cors";

dotenv.config({ path: "../.env" });

const app = express();

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(cookieParser());

// Stripe webhook must be registered before express.json()
app.post(
  "/api/v1/payments/webhook",
  express.raw({ type: "application/json" }),
  handleStripeWebhook,
);

app.use(express.json());

app.get("/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "LMS-AI backend is running",
  });
});

// API routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/admin", adminRoutes);
app.use("/api/v1/courses", courseRoutes);
app.use("/api/v1/enrollments", enrollmentRoutes);
app.use("/api/v1/lectures", progressRoutes);
app.use("/api/v1/lectures", notesRoutes);
app.use("/api/v1/lectures", bookmarksRoutes);
app.use("/api/v1/assignments", assignmentsRoutes);
app.use("/api/v1/quizzes", quizRoutes);
app.use("/api/v1/gamification", gamificationRoutes);
app.use("/api/v1/ai", aiRoutes);
app.use("/api/v1/discussions", discussionsRoutes);
app.use("/api/v1/payments", paymentRoutes);
app.use("/api/v1/notifications", notificationsRoutes);
app.use("/api/v1/courses/:courseId/announcements", announcementsRoutes);

const PORT = Number(process.env.PORT) || 5000;

let isShuttingDown = false;

const startServer = async (): Promise<void> => {
  let server: ReturnType<typeof app.listen> | undefined;

  try {
    await checkDatabaseConnection();
    await checkRedisConnection();

    await notificationWorker.waitUntilReady();
    await notificationQueue.waitUntilReady();

    console.log("Notification worker ready");

    const httpServer = createServer(app);

    await initializeSocket(httpServer);

    server = httpServer.listen(PORT, () => {
      console.log(`LMS-AI backend running on port ${PORT}`);
      console.log("Recommendation worker imported");
      console.log("Socket.IO server ready");
    });

    const shutdown = async (signal: string): Promise<void> => {
      if (isShuttingDown) {
        return;
      }

      isShuttingDown = true;

      console.log(`${signal} received. Shutting down...`);

      try {
        // Stop accepting new HTTP requests
        if (server) {
          await new Promise<void>((resolve, reject) => {
            server!.close((error) => {
              if (error) {
                reject(error);
              } else {
                resolve();
              }
            });
          });
        }

        // Close Socket.IO
        await shutdownSocket();

        // Close notification worker and queue
        await notificationWorker.close();
        await notificationQueue.close();

        // Close recommendation worker
        await recommendationWorker.close();

        // Close database connection pool
        await pool.end();

        // Close shared Redis connection
        if (redis.status !== "end") {
          await redis.quit();
        }

        console.log("Backend shutdown completed.");
        process.exitCode = 0;
      } catch (error) {
        console.error("Shutdown failed:", error);
        process.exitCode = 1;
      }
    };

    process.once("SIGINT", () => {
      void shutdown("SIGINT");
    });

    process.once("SIGTERM", () => {
      void shutdown("SIGTERM");
    });
  } catch (error) {
    console.error("Backend startup failed:", error);

    try {
      await shutdownSocket();
    } catch (socketError) {
      console.error("Socket cleanup failed:", socketError);
    }

    try {
      await notificationWorker.close();
    } catch (workerError) {
      console.error("Notification worker cleanup failed:", workerError);
    }

    try {
      await notificationQueue.close();
    } catch (queueError) {
      console.error("Notification queue cleanup failed:", queueError);
    }

    try {
      await recommendationWorker.close();
    } catch (recommendationError) {
      console.error(
        "Recommendation worker cleanup failed:",
        recommendationError,
      );
    }

    try {
      await pool.end();
    } catch (dbError) {
      console.error("Database cleanup failed:", dbError);
    }

    try {
      if (redis.status !== "end") {
        await redis.quit();
      }
    } catch (redisError) {
      console.error("Redis cleanup failed:", redisError);
    }

    process.exitCode = 1;
  }
};

void startServer();
