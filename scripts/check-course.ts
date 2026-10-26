import dotenv from "dotenv";
import path from "node:path";
import { pool } from "../backend/src/config/db.js";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

async function main() {
  const courseId = "dbe40501-6693-4530-b973-6b5ed805ff13";

  try {
    const result = await pool.query(
      `SELECT id, title, instructor_id, status
       FROM courses
       WHERE id = $1`,
      [courseId],
    );

    if (result.rows.length === 0) {
      console.log("Course not found. Check the course ID and database.");
    } else {
      console.table(result.rows);
    }
  } catch (error) {
    console.error(
      "Course lookup failed:",
      error instanceof Error ? error.message : error,
    );
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
