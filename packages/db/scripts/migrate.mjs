import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import pg from "pg";

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsDir = path.resolve(__dirname, "../migrations");
const migrationsTable = "__prompt_management_migrations";
const driftRepairs = [
  {
    migrationFile: "0003_prompt_version_likes.sql",
    checkSql: `SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'prompt_versions'
        AND column_name = 'likes_count'
    ) AS has_column`,
    repairSql: `ALTER TABLE "prompt_versions"
      ADD COLUMN IF NOT EXISTS "likes_count" integer DEFAULT 0 NOT NULL`,
    description: "prompt_versions.likes_count",
  },
];

export function toNonEmptyString(value) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized || undefined;
}

export function resolveDatabaseUrl(env = process.env) {
  const explicitUrl = toNonEmptyString(env.DATABASE_URL);
  if (explicitUrl) {
    return explicitUrl;
  }

  const host = toNonEmptyString(env.POSTGRES_HOST) ?? "127.0.0.1";
  const port = toNonEmptyString(env.POSTGRES_PORT) ?? "5432";
  const database = toNonEmptyString(env.POSTGRES_DB) ?? "prompt_management";
  const user = toNonEmptyString(env.POSTGRES_USER) ?? "postgres";
  const password = toNonEmptyString(env.POSTGRES_PASSWORD) ?? "postgres";

  return `postgres://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
}

export function listMigrationFiles(targetDir = migrationsDir, readDir = readdirSync) {
  return readDir(targetDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();
}

async function repairMigrationDrift(client, appliedSet, logger = console.log) {
  const repaired = [];

  for (const candidate of driftRepairs) {
    if (!appliedSet.has(candidate.migrationFile)) {
      continue;
    }

    const checkResult = await client.query(candidate.checkSql);
    const hasColumn = Boolean(checkResult.rows?.[0]?.has_column);
    if (hasColumn) {
      continue;
    }

    await client.query(candidate.repairSql);
    repaired.push(candidate.migrationFile);
    logger(`Repaired migration drift: ${candidate.migrationFile} (${candidate.description}).`);
  }

  return repaired;
}

export async function runMigrations(
  client,
  {
    migrationsDir: targetDir = migrationsDir,
    readDir = readdirSync,
    readFile = readFileSync,
    logger = console.log,
  } = {},
) {
  const migrationFiles = listMigrationFiles(targetDir, readDir);

  if (migrationFiles.length === 0) {
    logger("No SQL migrations found.");
    return { applied: [], skipped: [] };
  }

  await client.query(
    `CREATE TABLE IF NOT EXISTS "${migrationsTable}" (
      "filename" text PRIMARY KEY,
      "applied_at" timestamp with time zone NOT NULL DEFAULT now()
    )`,
  );

  const existing = await client.query(`SELECT filename FROM "${migrationsTable}"`);
  const appliedSet = new Set(
    (existing.rows ?? [])
      .map((row) => toNonEmptyString(row?.filename))
      .filter(Boolean),
  );

  const applied = [];
  const skipped = [];
  const repaired = await repairMigrationDrift(client, appliedSet, logger);

  if (appliedSet.size === 0) {
    const legacySchemaCheck = await client.query(
      `SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_type = 'BASE TABLE'
          AND table_name <> $1
      ) AS has_tables`,
      [migrationsTable],
    );
    const hasLegacySchema = Boolean(legacySchemaCheck.rows?.[0]?.has_tables);

    if (hasLegacySchema) {
      for (const migrationFile of migrationFiles) {
        await client.query(
          `INSERT INTO "${migrationsTable}" ("filename") VALUES ($1)
           ON CONFLICT ("filename") DO NOTHING`,
          [migrationFile],
        );
        skipped.push(migrationFile);
      }
      logger(`Backfilled migration records for legacy schema (${migrationFiles.length} files).`);
      return { applied, skipped };
    }
  }

  for (const migrationFile of migrationFiles) {
    if (appliedSet.has(migrationFile)) {
      skipped.push(migrationFile);
      continue;
    }

    const sql = readFile(path.join(targetDir, migrationFile), "utf-8");
    await client.query(sql);
    await client.query(
      `INSERT INTO "${migrationsTable}" ("filename") VALUES ($1)
       ON CONFLICT ("filename") DO NOTHING`,
      [migrationFile],
    );
    applied.push(migrationFile);
    logger(`Applied migration: ${migrationFile}`);
  }

  if (applied.length === 0 && repaired.length === 0) {
    logger("No pending migrations.");
  }

  return { applied, skipped, repaired };
}

export async function main({
  env = process.env,
  clientFactory = (databaseUrl) => new Client({ connectionString: databaseUrl }),
  logger = console.log,
} = {}) {
  const databaseUrl = resolveDatabaseUrl(env);
  const client = clientFactory(databaseUrl);
  await client.connect();

  try {
    return await runMigrations(client, { logger });
  } finally {
    await client.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
