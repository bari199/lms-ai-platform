import dotenv from "dotenv";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createReadStream, existsSync, statSync } from "node:fs";
import { basename, extname, join } from "node:path";
import {
  DeleteObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { pool } from "../src/config/db.js";

dotenv.config({ path: path.resolve(process.cwd(), "../.env") });

const courseId = "dbe40501-6693-4530-b973-6b5ed805ff13";
const videoDir = "E:\\lms-ai-platform\\Javascript-tutorial";

const files = [
  { file: "Introduction.mp4", module: "Introduction", order: 1 },
  { file: "Module-2.mp4", module: "Module 2", order: 2 },
  { file: "Module-3.mp4", module: "Module 3", order: 3 },
  { file: "Module-4.mp4", module: "Module 4", order: 4 },
  { file: "Module-5.mp4", module: "Module 5", order: 5 },
  { file: "module-6.mp4", module: "Module 6", order: 6 },
  { file: "Module-7.mp4", module: "Module 7", order: 7 },
  { file: "Module-8.mp4", module: "Module 8", order: 8 },
  { file: "module-9.mp4", module: "Module 9", order: 9 },
  { file: "module-10.mp4", module: "Module 10", order: 10 },
];

async function main() {
  const apply = process.argv.includes("--apply");
  let s3Client: any;
  let videoBucket: string | undefined;
  const uploadedKeys: string[] = [];

  try {
    const { s3Client: client, videoBucket: bucket } =
      await import("../src/config/storage.js");
    s3Client = client;
    videoBucket = bucket;

    const course = await pool.query(
      `SELECT id, title, instructor_id
       FROM courses WHERE id = $1`,
      [courseId],
    );

    if (course.rows.length !== 1) throw new Error("Course not found.");

    console.log("Course:", course.rows[0].title);
    console.log("Bucket:", videoBucket);
    console.log("Mode:", apply ? "APPLY" : "PREVIEW ONLY");

    let totalBytes = 0;
    const seen = new Set<string>();

    for (const item of files) {
      const fullPath = join(videoDir, item.file);
      if (!existsSync(fullPath)) throw new Error(`Missing file: ${fullPath}`);
      if (extname(item.file).toLowerCase() !== ".mp4") {
        throw new Error(`Unsupported file: ${item.file}`);
      }

      const size = statSync(fullPath).size;
      if (size <= 0) throw new Error(`Empty file: ${item.file}`);

      seen.add(item.file.toLowerCase());
      totalBytes += size;
      console.log(
        `${String(item.order).padStart(2, "0")}. ${item.module} | ${item.file} | ${(size / 1024 ** 2).toFixed(2)} MB`,
      );
    }

    if (files.length !== 10 || seen.size !== 10) {
      throw new Error("Expected exactly 10 unique MP4 files.");
    }

    const existing = await pool.query(
      `SELECT title FROM modules WHERE course_id = $1`,
      [courseId],
    );
    const existingTitles = new Set(
      existing.rows.map((row) => String(row.title).toLowerCase()),
    );
    const conflicts = files.filter((item) =>
      existingTitles.has(item.module.toLowerCase()),
    );

    if (conflicts.length) {
      throw new Error(
        `Module title(s) already exist: ${conflicts.map((item) => item.module).join(", ")}`,
      );
    }

    console.log("Total files:", files.length);
    console.log("Total size (GB):", (totalBytes / 1024 ** 3).toFixed(2));
    console.log("Existing MongoDB module will be preserved.");
    console.log("Preview validation: PASS");

    if (!apply) {
      console.log("No changes made.");
      return;
    }

    const dbClient = await pool.connect();
    const createdKeys: string[] = [];

    try {
      const uploaded: Array<{
        item: (typeof files)[number];
        moduleId: string;
        lectureId: string;
        key: string;
      }> = [];

      for (const item of files) {
        const fullPath = join(videoDir, item.file);
        const moduleId = randomUUID();
        const lectureId = randomUUID();
        const key = `lectures/${lectureId}/${randomUUID()}.mp4`;

        await s3Client.send(
          new PutObjectCommand({
            Bucket: videoBucket,
            Key: key,
            Body: createReadStream(fullPath),
            ContentLength: statSync(fullPath).size,
            ContentType: "video/mp4",
          }),
        );

        uploadedKeys.push(key);
        createdKeys.push(key);
        uploaded.push({ item, moduleId, lectureId, key });
        console.log("Uploaded:", item.file);
      }

      await dbClient.query("BEGIN");
      try {
        for (const entry of uploaded) {
          await dbClient.query(
            `INSERT INTO modules (id, course_id, title, order_index)
             VALUES ($1, $2, $3, $4)`,
            [entry.moduleId, courseId, entry.item.module, entry.item.order],
          );

          await dbClient.query(
            `INSERT INTO lectures (id, module_id, title, video_url, order_index)
             VALUES ($1, $2, $3, $4, $5)`,
            [
              entry.lectureId,
              entry.moduleId,
              basename(entry.item.file, extname(entry.item.file)),
              entry.key,
              1,
            ],
          );
        }

        await dbClient.query("COMMIT");
        console.log("Import successful: 10 modules and 10 lectures created.");
      } catch (error) {
        await dbClient.query("ROLLBACK");
        throw error;
      }
    } catch (error) {
      for (const key of createdKeys) {
        try {
          await s3Client.send(
            new DeleteObjectCommand({ Bucket: videoBucket, Key: key }),
          );
        } catch (cleanupError) {
          console.error("Cleanup failed for", key, cleanupError);
        }
      }
      throw error;
    } finally {
      dbClient.release();
    }
  } catch (error) {
    console.error(
      "Import stopped:",
      error instanceof Error ? error.message : error,
    );
    process.exitCode = 1;
  } finally {
    await pool.end();
    if (s3Client) s3Client.destroy();
  }
}

main();

