import { Pool } from "pg";
import dotenv from "dotenv";
import path from "node:path";

dotenv.config({
  path: path.resolve(process.cwd(), "../.env"),
});

export const pool = new Pool({
  host: process.env.POSTGRES_HOST || "localhost",
  port: Number(process.env.POSTGRES_PORT) || 5433,
  database: process.env.POSTGRES_DB || "postgres",
  user: process.env.POSTGRES_USER || "lms_ai_user",
  password: process.env.POSTGRES_PASSWORD,
});

export const checkDatabaseConnection = async (): Promise<void> => {
  const client = await pool.connect();

  try {
    const result = await client.query("SELECT current_database() AS database");

    console.log("PostgreSQL connected:", result.rows[0].database);
  } finally {
    client.release();
  }
};
