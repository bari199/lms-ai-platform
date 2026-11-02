import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import jwt from "jsonwebtoken";
import { pool } from "./db.js";
import { createQueueRedisConnection } from "./redis.js";

interface SocketUser {
  id: string;
  roles: string[];
}

declare module "socket.io" {
  interface SocketData {
    user: SocketUser;
  }
}

let io: Server | null = null;

let pubClient: ReturnType<typeof createQueueRedisConnection> | null = null;

let subClient: ReturnType<typeof createQueueRedisConnection> | null = null;

export const initializeSocket = async (
  httpServer: import("node:http").Server,
): Promise<Server> => {
  if (io) return io;

  pubClient = createQueueRedisConnection();
  subClient = pubClient.duplicate();

  try {
    // ioredis automatically connects.
    // Use ping() instead of calling connect() again.
    await Promise.all([pubClient.ping(), subClient.ping()]);

    io = new Server(httpServer, {
      cors: {
        origin: "http://localhost:5173",
        credentials: true,
      },
    });

    io.adapter(createAdapter(pubClient, subClient));

    // JWT authentication
    io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth?.token;
        const secret = process.env.JWT_ACCESS_SECRET;

        if (!token || !secret) {
          return next(new Error("Authentication required"));
        }

        const payload = jwt.verify(token, secret);

        if (
          typeof payload === "string" ||
          typeof payload.sub !== "string" ||
          !Array.isArray(payload.roles) ||
          !payload.roles.every((role) => typeof role === "string")
        ) {
          return next(new Error("Invalid access token"));
        }

        const userResult = await pool.query(
          "SELECT is_active FROM users WHERE id = $1",
          [payload.sub],
        );

        if (userResult.rowCount !== 1 || !userResult.rows[0].is_active) {
          return next(new Error("Account unavailable"));
        }

        socket.data.user = {
          id: payload.sub,
          roles: payload.roles,
        };

        next();
      } catch {
        next(new Error("Invalid or expired access token"));
      }
    });

    io.on("connection", (socket) => {
      console.log("Socket connected:", socket.id);

      // Leave a course discussion room
      socket.on(
        "discussion:leave",
        async (
          courseId: string,
          callback?: (result: { success: boolean; message?: string }) => void,
        ) => {
          try {
            if (
              typeof courseId !== "string" ||
              !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
                courseId,
              )
            ) {
              callback?.({
                success: false,
                message: "Invalid course ID",
              });
              return;
            }

            await socket.leave(`discussion:${courseId}`);

            callback?.({ success: true });
          } catch (error) {
            console.error("Discussion room leave failed:", error);

            callback?.({
              success: false,
              message: "Unable to leave discussion room",
            });
          }
        },
      );

      // Join an authorized course discussion room
      socket.on(
        "discussion:join",
        async (
          courseId: string,
          callback?: (result: { success: boolean; message?: string }) => void,
        ) => {
          try {
            if (
              typeof courseId !== "string" ||
              !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
                courseId,
              )
            ) {
              callback?.({
                success: false,
                message: "Invalid course ID",
              });
              return;
            }

            const { id, roles } = socket.data.user;

            const isInstructor = roles.includes("instructor");
            const isStudent = roles.includes("student");

            const accessResult = await pool.query(
              `
                SELECT c.id
                FROM courses c
                WHERE c.id = $1
                  AND (
                    (
                      $3::boolean = TRUE
                      AND c.instructor_id = $2
                    )
                    OR
                    (
                      $4::boolean = TRUE
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
              [courseId, id, isInstructor, isStudent],
            );

            if (accessResult.rowCount !== 1) {
              callback?.({
                success: false,
                message: "Course access denied",
              });
              return;
            }

            await socket.join(`discussion:${courseId}`);

            callback?.({ success: true });
          } catch (error) {
            console.error("Discussion room join failed:", error);

            callback?.({
              success: false,
              message: "Unable to join discussion room",
            });
          }
        },
      );

      socket.on("disconnect", () => {
        console.log("Socket disconnected:", socket.id);
      });
    });

    console.log("Socket.IO initialized with Redis adapter");

    return io;
  } catch (error) {
    await Promise.allSettled([pubClient.quit(), subClient.quit()]);

    pubClient = null;
    subClient = null;
    io = null;

    throw error;
  }
};

export const shutdownSocket = async (): Promise<void> => {
  if (io) {
    io.disconnectSockets(true);
    io = null;
  }

  await Promise.allSettled([pubClient?.quit(), subClient?.quit()]);

  pubClient = null;
  subClient = null;
};

export const getIO = (): Server => {
  if (!io) {
    throw new Error("Socket.IO has not been initialized");
  }

  return io;
};
