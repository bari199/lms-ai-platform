import { pool } from "./src/config/db.js";

async function main() {
  try {
    const result = await pool.query(
      `SELECT
         m.id AS module_id,
         m.title AS module_title,
         l.id AS lecture_id,
         l.title AS lecture_title,
         l.video_url
       FROM modules m
       LEFT JOIN lectures l ON l.module_id = m.id
       WHERE m.course_id = $1
         AND m.title = $2`,
      [
        "dbe40501-6693-4530-b973-6b5ed805ff13",
        "Mongodb Fundamentals"
      ]
    );

    console.table(result.rows);
  } finally {
    await pool.end();
  }
}

main().catch(console.error);
