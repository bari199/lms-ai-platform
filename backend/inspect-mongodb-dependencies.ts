import { pool } from "./src/config/db.js";

async function main() {
  try {
    console.log("\n--- Bookmark linked to MongoDB lecture ---");
    const bookmarks = await pool.query(
      "SELECT * FROM bookmarks WHERE lecture_id = $1",
      ["46106922-a2f1-409d-9b7a-98e870bdbc2d"]
    );
    console.dir(bookmarks.rows, { depth: 3 });

    console.log("\n--- Quizzes linked to MongoDB module ---");
    const quizzes = await pool.query(
      "SELECT * FROM quizzes WHERE module_id = $1",
      ["234fb53e-af46-440c-b4c7-1b91da5ec623"]
    );
    console.dir(
      quizzes.rows.map(({ id, title, module_id, generated_from_lecture_id }) => ({
        id,
        title,
        module_id,
        generated_from_lecture_id,
      })),
      { depth: 3 }
    );
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
