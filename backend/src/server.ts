import express from "express";
import dotenv from "dotenv";
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
import { recommendationWorker } from "./jobs/recommendation.worker.js";
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
app.use("/api/v1/payments", paymentRoutes);

const PORT = Number(process.env.PORT) || 5000;

let isShuttingDown = false;

const startServer = async (): Promise<void> => {
  let server: ReturnType<typeof app.listen> | undefined;

  try {
    await checkDatabaseConnection();
    await checkRedisConnection();

    server = app.listen(PORT, () => {
      console.log(`LMS-AI backend running on port ${PORT}`);
      console.log("Recommendation worker imported");
    });

    const shutdown = async (signal: string): Promise<void> => {
      if (isShuttingDown) {
        return;
      }

      isShuttingDown = true;

      console.log(`${signal} received. Shutting down...`);

      try {
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

        await recommendationWorker.close();
        await pool.end();

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
      await recommendationWorker.close();
    } catch (workerError) {
      console.error("Worker cleanup failed:", workerError);
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
