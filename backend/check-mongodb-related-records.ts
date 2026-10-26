import { pool } from "./src/config/db.js";

async function main() {
  try {
    const checks = [
      ["module_mastery_scores", "module_id", "234fb53e-af46-440c-b4c7-1b91da5ec623"],
      ["document_chunks", "lecture_id", "46106922-a2f1-409d-9b7a-98e870bdbc2d"],
      ["lecture_notes", "lecture_id", "46106922-a2f1-409d-9b7a-98e870bdbc2d"],
      ["lecture_progress", "lecture_id", "46106922-a2f1-409d-9b7a-98e870bdbc2d"],
      ["quiz_questions", "quiz_id", "2ec1bd09-98e8-46ce-832f-e419b2b526c6"],
      ["quiz_questions", "quiz_id", "3746978b-e1a6-4937-85c9-0d9a3104651c"],
      ["quiz_attempts", "quiz_id", "2ec1bd09-98e8-46ce-832f-e419b2b526c6"],
      ["quiz_attempts", "quiz_id", "3746978b-e1a6-4937-85c9-0d9a3104651c"],
    ];

    for (const [table, column, id] of checks) {
      const result = await pool.query(
        `SELECT COUNT(*)::int AS count FROM "${table}" WHERE "${column}" = $1`,
        [id]
      );
      console.log(`${table}.${column} (${id}): ${result.rows[0].count}`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
