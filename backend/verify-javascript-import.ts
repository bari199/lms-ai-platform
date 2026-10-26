import { pool } from "./src/config/db.js";

async function main() {
  try {
    const result = await pool.query(
      `SELECT
         m.title AS module_title,
         m.order_index AS module_order,
         l.title AS lecture_title,
         l.order_index AS lecture_order,
         l.video_url
       FROM modules m
       LEFT JOIN lectures l ON l.module_id = m.id
       WHERE m.course_id = $1
       ORDER BY m.order_index, l.order_index`,
      ["dbe40501-6693-4530-b973-6b5ed805ff13"]
    );

    console.table(result.rows);

    console.log("Total module-lecture rows:", result.rowCount);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
