import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { PoolClient } from "pg";
import { pool } from "../config/db.js";

const migrationsDir = path.resolve(process.cwd(), "src", "db", "migrations");

const LOCK_ID = 824_2026;

const BASELINE_FILES = [
  "001_create_core_tables.sql",
  "002_create_refresh_tokens.sql",
  "003_create_enrollments.sql",
  "004_create_lecture_progress.sql",
  "005_create_lecture_notes.sql",
  "006_create_bookmarks.sql",
  "007_create_assignments.sql",
  "008_create_assignment_submissions.sql",
  "009_add_assignment_grading.sql",
  "010_create_quizzes.sql",
  "011_create_gamification.sql",
] as const;

const REQUIRED_BASELINE_TABLES = [
  "users",
  "roles",
  "user_roles",
  "courses",
  "modules",
  "lectures",
  "refresh_tokens",
  "enrollments",
  "lecture_progress",
  "lecture_notes",
  "bookmarks",
  "assignments",
  "assignment_submissions",
  "quizzes",
  "quiz_questions",
  "quiz_options",
  "quiz_attempts",
  "quiz_answers",
  "streaks",
  "badges",
  "user_badges",
  "certificates",
] as const;

type MigrationFile = {
  filename: string;
  sql: string;
  checksum: string;
};

type AppliedMigrationRow = {
  filename: string;
  checksum: string;
};

type TableRow = {
  table_name: string;
};

const checksum = (content: string): string =>
  createHash("sha256").update(content).digest("hex");

const loadMigrations = async (): Promise<MigrationFile[]> => {
  const files = (await readdir(migrationsDir))
    .filter((name) => /^\d{3}_.+\.sql$/.test(name))
    .sort();

  const migrations: MigrationFile[] = [];

  for (const filename of files) {
    const sql = await readFile(path.join(migrationsDir, filename), "utf8");

    migrations.push({
      filename,
      sql,
      checksum: checksum(sql),
    });
  }

  return migrations;
};

const ensureTrackingTable = async (client: PoolClient): Promise<void> => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      checksum TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
};

const verifyBaselineSchema = async (client: PoolClient): Promise<void> => {
  const result = await client.query<TableRow>(
    `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        AND table_name = ANY($1::text[])
    `,
    [REQUIRED_BASELINE_TABLES],
  );

  const found = new Set(result.rows.map((row) => row.table_name));

  const missing = REQUIRED_BASELINE_TABLES.filter((table) => !found.has(table));

  if (missing.length > 0) {
    throw new Error(
      `Baseline stopped. Missing required tables: ${missing.join(", ")}`,
    );
  }
};

const baseline = async (
  client: PoolClient,
  migrations: MigrationFile[],
): Promise<void> => {
  const existing = await client.query<{ count: number }>(
    "SELECT COUNT(*)::int AS count FROM schema_migrations",
  );

  if (existing.rows[0].count > 0) {
    throw new Error(
      "Baseline stopped: schema_migrations already contains records.",
    );
  }

  await verifyBaselineSchema(client);

  const byName = new Map(
    migrations.map((migration) => [migration.filename, migration]),
  );

  for (const filename of BASELINE_FILES) {
    const migration = byName.get(filename);

    if (!migration) {
      throw new Error(`Baseline stopped: missing file ${filename}`);
    }

    await client.query(
      `
        INSERT INTO schema_migrations (filename, checksum)
        VALUES ($1, $2)
      `,
      [migration.filename, migration.checksum],
    );
  }

  console.log(`Baseline recorded ${BASELINE_FILES.length} migrations.`);

  console.log(
    "Existing database schema was verified. Migration SQL was not executed.",
  );
};

const migrate = async (
  client: PoolClient,
  migrations: MigrationFile[],
): Promise<void> => {
  const appliedResult = await client.query<AppliedMigrationRow>(
    "SELECT filename, checksum FROM schema_migrations",
  );

  const applied = new Map<string, string>(
    appliedResult.rows.map((row) => [row.filename, row.checksum]),
  );

  for (const migration of migrations) {
    const previousChecksum = applied.get(migration.filename);

    if (previousChecksum !== undefined) {
      if (previousChecksum !== migration.checksum) {
        throw new Error(
          `Checksum mismatch for ${migration.filename}. ` +
            "Do not edit an applied migration; create a new migration.",
        );
      }

      continue;
    }

    await client.query("BEGIN");

    try {
      await client.query(migration.sql);

      await client.query(
        `
          INSERT INTO schema_migrations (filename, checksum)
          VALUES ($1, $2)
        `,
        [migration.filename, migration.checksum],
      );

      await client.query("COMMIT");

      applied.set(migration.filename, migration.checksum);

      console.log(`Applied: ${migration.filename}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }

  console.log("Migration run completed.");
};

const main = async (): Promise<void> => {
  const command = process.argv[2];

  if (command !== "baseline" && command !== "up") {
    throw new Error("Usage: npm run db:baseline OR npm run db:migrate");
  }

  const client = await pool.connect();
  let lockAcquired = false;

  try {
    await client.query("SELECT pg_advisory_lock($1)", [LOCK_ID]);

    lockAcquired = true;

    await ensureTrackingTable(client);

    const migrations = await loadMigrations();

    if (command === "baseline") {
      await client.query("BEGIN");

      try {
        await baseline(client, migrations);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    } else {
      await migrate(client, migrations);
    }
  } finally {
    try {
      if (lockAcquired) {
        await client.query("SELECT pg_advisory_unlock($1)", [LOCK_ID]);
      }
    } finally {
      client.release();
      await pool.end();
    }
  }
};

main().catch((error: unknown) => {
  console.error("Migration command failed:", error);
  process.exitCode = 1;
});
