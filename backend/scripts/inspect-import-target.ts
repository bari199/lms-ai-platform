import { pool } from "../src/config/db.js";

async function main() {
  const courseId = "dbe40501-6693-4530-b973-6b5ed805ff13";

  try {
    console.log("\n--- Existing modules ---");

    const modules = await pool.query(
      `SELECT m.id, m.title, m.order_index,
              COUNT(l.id)::int AS lecture_count
       FROM modules m
       LEFT JOIN lectures l ON l.module_id = m.id
       WHERE m.course_id = $1
       GROUP BY m.id, m.title, m.order_index
       ORDER BY m.order_index`,
      [courseId],
    );

    console.table(modules.rows);

    console.log("\n--- Relevant database columns ---");

    const columns = await pool.query(
      `SELECT table_name, column_name, data_type, is_nullable
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name IN ('courses', 'modules', 'lectures')
       ORDER BY table_name, ordinal_position`,
    );

    console.table(columns.rows);
  } catch (error) {
    console.error(
      "Database inspection failed:",
      error instanceof Error ? error.message : error,
    );
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
