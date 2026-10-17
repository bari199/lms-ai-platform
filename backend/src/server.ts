import express from "express";
import dotenv from "dotenv";
import { checkDatabaseConnection, pool } from "./config/db.js";
import { checkRedisConnection, redis } from "./config/redis.js";
import authRoutes from "./modules/auth/auth.routes.js";
dotenv.config();

const app = express();

app.use(express.json());

app.get("/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "LMS-AI backend is running",
  });
});

app.use("/api/v1/auth", authRoutes);

const PORT = Number(process.env.PORT) || 5000;

const startServer = async (): Promise<void> => {
  try {
    await checkDatabaseConnection();
    await checkRedisConnection();

    const server = app.listen(PORT, () => {
      console.log(`LMS-AI backend running on port ${PORT}`);
    });

    const shutdown = async (signal: string): Promise<void> => {
      console.log(`${signal} received. Shutting down...`);

      server.close(async () => {
        try {
          await pool.end();
          if (redis.status !== "end") {
            await redis.quit();
          }
          process.exit(0);
        } catch (error) {
          console.error("Shutdown failed:", error);
          process.exit(1);
        }
      });
    };

    process.once("SIGINT", () => void shutdown("SIGINT"));
    process.once("SIGTERM", () => void shutdown("SIGTERM"));
  } catch (error) {
    console.error("Backend startup failed:", error);

    try {
      await pool.end();
    } catch {
      // Ignore database cleanup errors.
    }

    try {
      if (redis.status !== "end") {
        await redis.quit();
      }
    } catch {
      // Ignore Redis cleanup errors.
    }

    process.exitCode = 1;
  }
};

void startServer();
