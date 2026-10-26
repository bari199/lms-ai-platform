import { pool } from "./src/config/db.js";

async function main() {
  try {
    const result = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'quizzes'
      ORDER BY ordinal_position
    `);

    console.log("Quiz table columns:");
    console.table(result.rows);

    const quizzes = await pool.query(`
      SELECT *
      FROM quizzes
      WHERE id IN (
        '2ec1bd09-98e8-46ce-832f-e419b2b526c6',
        '3746978b-e1a6-4937-85c9-0d9a3104651c'
      )
    `);

    console.log("Quiz details:");
    console.dir(quizzes.rows, { depth: 4 });
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
