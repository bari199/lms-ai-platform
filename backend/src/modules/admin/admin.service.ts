import { pool } from "../../config/db.js";

export interface AdminUser {
  id: string;
  full_name: string;
  email: string;
  is_active: boolean;
  created_at: Date;
  roles: string[];
}

export const getAdminUsers = async (search?: string): Promise<AdminUser[]> => {
  const query = `
    SELECT
      u.id,
      u.full_name,
      u.email,
      u.is_active,
      u.created_at,
      COALESCE(
        ARRAY_AGG(r.name) FILTER (WHERE r.name IS NOT NULL),
        ARRAY[]::VARCHAR[]
      ) AS roles
    FROM users u
    LEFT JOIN user_roles ur ON ur.user_id = u.id
    LEFT JOIN roles r ON r.id = ur.role_id
    WHERE (
      $1::TEXT IS NULL
      OR u.full_name ILIKE '%' || $1 || '%'
      OR u.email ILIKE '%' || $1 || '%'
    )
    GROUP BY u.id
    ORDER BY u.created_at DESC;
  `;

  const result = await pool.query(query, [search?.trim() || null]);

  return result.rows as AdminUser[];
};

export type AdminRole = "student" | "instructor" | "admin";
export type RoleAction = "assign" | "revoke";

export const updateUserRole = async (
  userId: string,
  role: AdminRole,
  action: RoleAction,
): Promise<void> => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const userResult = await client.query(
      "SELECT id FROM users WHERE id = $1 FOR UPDATE",
      [userId],
    );

    if (userResult.rowCount === 0) {
      throw new Error("USER_NOT_FOUND");
    }

    const roleResult = await client.query(
      "SELECT id FROM roles WHERE name = $1",
      [role],
    );

    if (roleResult.rowCount === 0) {
      throw new Error("ROLE_NOT_FOUND");
    }

    const roleId = roleResult.rows[0].id;

    if (action === "assign") {
      await client.query(
        `INSERT INTO user_roles (user_id, role_id)
         VALUES ($1, $2)
         ON CONFLICT (user_id, role_id) DO NOTHING`,
        [userId, roleId],
      );
    } else {
      if (role === "admin") {
        const adminCountResult = await client.query(
          `SELECT COUNT(*)::int AS count
           FROM user_roles ur
           JOIN roles r ON r.id = ur.role_id
           WHERE r.name = 'admin'`,
        );

        if (adminCountResult.rows[0].count <= 1) {
          throw new Error("CANNOT_REVOKE_LAST_ADMIN");
        }
      }

      await client.query(
        "DELETE FROM user_roles WHERE user_id = $1 AND role_id = $2",
        [userId, roleId],
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const suspendUser = async (userId: string): Promise<boolean> => {
  const result = await pool.query(
    `UPDATE users
     SET is_active = FALSE,
         updated_at = NOW()
     WHERE id = $1
     RETURNING id`,
    [userId],
  );

  return (result.rowCount ?? 0) > 0;
};

export const getPendingCourses = async () => {
  const result = await pool.query(
    `SELECT *
     FROM courses
     WHERE status = $1
     ORDER BY created_at ASC`,
    ["pending"],
  );

  return result.rows;
};

export const getAdminAnalytics = async () => {
  const result = await pool.query(`
    SELECT
      COUNT(*)::int AS total_enrollments,
      COUNT(*) FILTER (
        WHERE completed_at IS NOT NULL
      )::int AS completed_enrollments,
      COALESCE(
        ROUND(
          COUNT(*) FILTER (
            WHERE completed_at IS NOT NULL
          )::numeric * 100
          / NULLIF(COUNT(*), 0),
          2
        ),
        0
      ) AS completion_rate
    FROM enrollments
  `);

  return result.rows[0];
};
