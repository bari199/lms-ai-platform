import bcrypt from "bcryptjs";
import { pool } from "../../config/db.js";
import jwt from "jsonwebtoken";
import { createHash, randomBytes } from "node:crypto";

interface RegisterInput {
  fullName: string;
  email: string;
  password: string;
}

export const registerUser = async (input: RegisterInput) => {
  const fullName = input.fullName.trim();
  const email = input.email.trim().toLowerCase();

  if (!fullName || !email || !input.password) {
    throw new Error("Full name, email, and password are required");
  }

  if (input.password.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }

  const existingUser = await pool.query(
    "SELECT id FROM users WHERE email = $1",
    [email],
  );

  if (existingUser.rowCount && existingUser.rowCount > 0) {
    throw new Error("Email is already registered");
  }

  const passwordHash = await bcrypt.hash(input.password, 12);

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const userResult = await client.query(
      `INSERT INTO users (full_name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, full_name, email, created_at`,
      [fullName, email, passwordHash],
    );

    const roleResult = await client.query(
      "SELECT id FROM roles WHERE name = $1",
      ["student"],
    );

    if (roleResult.rowCount !== 1) {
      throw new Error("Default student role is not configured");
    }

    await client.query(
      "INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)",
      [userResult.rows[0].id, roleResult.rows[0].id],
    );

    await client.query("COMMIT");

    return userResult.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const loginUser = async (emailInput: string, password: string) => {
  const email = emailInput.trim().toLowerCase();

  if (!email || !password) {
    throw new Error("Email and password are required");
  }

  const result = await pool.query(
    `SELECT u.id, u.full_name, u.email, u.password_hash,
            ARRAY_AGG(r.name) AS roles
     FROM users u
     JOIN user_roles ur ON ur.user_id = u.id
     JOIN roles r ON r.id = ur.role_id
     WHERE u.email = $1 AND u.is_active = TRUE
     GROUP BY u.id`,
    [email],
  );

  if (result.rowCount !== 1) {
    throw new Error("Invalid email or password");
  }

  const user = result.rows[0];
  const passwordMatches = await bcrypt.compare(password, user.password_hash);

  if (!passwordMatches) {
    throw new Error("Invalid email or password");
  }

  const secret = process.env.JWT_ACCESS_SECRET;

  if (!secret || secret === "replace_with_a_long_random_secret") {
    throw new Error("JWT access secret is not configured");
  }

  const accessToken = jwt.sign(
    {
      sub: user.id,
      roles: user.roles,
    },
    secret,
    {
      expiresIn: (process.env.JWT_ACCESS_EXPIRES_IN ||
        "15m") as jwt.SignOptions["expiresIn"],
    },
  );
  const refreshToken = await createRefreshToken(user.id);

  return {
    user: {
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      roles: user.roles,
    },
    accessToken,
    refreshToken,
  };
};

export const getCurrentUser = async (userId: string) => {
  const result = await pool.query(
    `SELECT u.id, u.full_name, u.email, u.avatar_url, u.created_at,
            ARRAY_AGG(r.name) AS roles
     FROM users u
     JOIN user_roles ur ON ur.user_id = u.id
     JOIN roles r ON r.id = ur.role_id
     WHERE u.id = $1 AND u.is_active = TRUE
     GROUP BY u.id`,
    [userId],
  );

  if (result.rowCount !== 1) {
    return null;
  }

  return result.rows[0];
};

const hashRefreshToken = (token: string): string =>
  createHash("sha256").update(token).digest("hex");

const createRefreshToken = async (userId: string) => {
  const secret = process.env.JWT_REFRESH_SECRET;

  if (!secret || secret === "replace_with_a_different_long_random_secret") {
    throw new Error("JWT refresh secret is not configured");
  }

  const token = randomBytes(48).toString("hex");
  const tokenHash = hashRefreshToken(token);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await pool.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt],
  );

  return token;
};

export const refreshAccessToken = async (token: string) => {
  if (!token || token.length > 256) {
    throw new Error("Invalid refresh token");
  }

  const tokenHash = hashRefreshToken(token);

  const result = await pool.query(
    `SELECT u.id, ARRAY_AGG(r.name) AS roles
     FROM refresh_tokens rt
     JOIN users u ON u.id = rt.user_id
     JOIN user_roles ur ON ur.user_id = u.id
     JOIN roles r ON r.id = ur.role_id
     WHERE rt.token_hash = $1
       AND rt.expires_at > now()
       AND rt.revoked_at IS NULL
       AND u.is_active = TRUE
     GROUP BY u.id`,
    [tokenHash],
  );

  if (result.rowCount !== 1) {
    throw new Error("Invalid or expired refresh token");
  }

  const user = result.rows[0];
  const secret = process.env.JWT_ACCESS_SECRET;

  if (!secret) {
    throw new Error("JWT access secret is not configured");
  }

  const accessToken = jwt.sign(
    {
      sub: user.id,
      roles: user.roles,
    },
    secret,
    {
      expiresIn: (process.env.JWT_ACCESS_EXPIRES_IN ||
        "15m") as jwt.SignOptions["expiresIn"],
    },
  );

  return { accessToken };
};

export const logoutUser = async (token: string) => {
  if (!token || token.length > 256) {
    throw new Error("Refresh token is required");
  }

  const tokenHash = hashRefreshToken(token);

  const result = await pool.query(
    `UPDATE refresh_tokens
     SET revoked_at = now()
     WHERE token_hash = $1
       AND revoked_at IS NULL
     RETURNING id`,
    [tokenHash],
  );

  return (result.rowCount ?? 0) > 0;
};
