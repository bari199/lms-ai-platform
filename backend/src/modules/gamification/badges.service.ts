import { pool } from "../../config/db.js";

export type BadgeMilestone =
  | "First Course Completed"
  | "7-Day Streak"
  | "Perfect Quiz Score";

export const awardBadge = async (
  userId: string,
  milestone: BadgeMilestone,
): Promise<boolean> => {
  const result = await pool.query(
    `INSERT INTO user_badges (user_id, badge_id)
     SELECT $1, b.id
     FROM badges b
     WHERE b.name = $2
     ON CONFLICT (user_id, badge_id) DO NOTHING
     RETURNING badge_id`,
    [userId, milestone],
  );

  return result.rowCount === 1;
};
