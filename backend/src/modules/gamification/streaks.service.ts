import { pool } from "../../config/db.js";

export interface Streak {
  user_id: string;
  current_streak: number;
  longest_streak: number;
  last_active_date: string | null;
}

export const updateStreak = async (userId: string): Promise<Streak> => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query<Streak>(
      `SELECT
         user_id,
         current_streak,
         longest_streak,
         last_active_date::text AS last_active_date
       FROM streaks
       WHERE user_id = $1
       FOR UPDATE`,
      [userId],
    );

    if (result.rows.length === 0) {
      const created = await client.query<Streak>(
        `INSERT INTO streaks (
           user_id,
           current_streak,
           longest_streak,
           last_active_date
         )
         VALUES ($1, 1, 1, CURRENT_DATE)
         RETURNING
           user_id,
           current_streak,
           longest_streak,
           last_active_date::text AS last_active_date`,
        [userId],
      );

      await client.query("COMMIT");
      return created.rows[0];
    }

    const streak = result.rows[0];

    const updated = await client.query<Streak>(
      `UPDATE streaks
       SET
         current_streak = CASE
           WHEN last_active_date = CURRENT_DATE
             THEN current_streak
           WHEN last_active_date = CURRENT_DATE - 1
             THEN current_streak + 1
           ELSE 1
         END,
         longest_streak = GREATEST(
           longest_streak,
           CASE
             WHEN last_active_date = CURRENT_DATE
               THEN current_streak
             WHEN last_active_date = CURRENT_DATE - 1
               THEN current_streak + 1
             ELSE 1
           END
         ),
         last_active_date = CURRENT_DATE
       WHERE user_id = $1
       RETURNING
         user_id,
         current_streak,
         longest_streak,
         last_active_date::text AS last_active_date`,
      [userId],
    );

    await client.query("COMMIT");
    return updated.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};
