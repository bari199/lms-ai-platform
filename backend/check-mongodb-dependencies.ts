import { pool } from "./src/config/db.js";

const moduleId = "234fb53e-af46-440c-b4c7-1b91da5ec623";
const lectureId = "46106922-a2f1-409d-9b7a-98e870bdbc2d";

async function main() {
  try {
    const checks = [
      {
        label: "Bookmarks linked to lecture",
        sql: "SELECT COUNT(*)::int AS count FROM bookmarks WHERE lecture_id = $1",
        id: lectureId,
      },
      {
        label: "Quizzes linked to lecture",
        sql: "SELECT COUNT(*)::int AS count FROM quizzes WHERE generated_from_lecture_id = $1",
        id: lectureId,
      },
      {
        label: "Quizzes linked to module",
        sql: "SELECT COUNT(*)::int AS count FROM quizzes WHERE module_id = $1",
        id: moduleId,
      },
    ];

    for (const check of checks) {
      const result = await pool.query(check.sql, [check.id]);
      console.log(`${check.label}: ${result.rows[0].count}`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
