import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import pg from "pg";

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsDir = path.resolve(__dirname, "../migrations");

function toNonEmptyString(value) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized || undefined;
}

function resolveDatabaseUrl() {
  const explicitUrl = toNonEmptyString(process.env.DATABASE_URL);
  if (explicitUrl) {
    return explicitUrl;
  }

  const host = toNonEmptyString(process.env.POSTGRES_HOST) ?? "127.0.0.1";
  const port = toNonEmptyString(process.env.POSTGRES_PORT) ?? "5432";
  const database = toNonEmptyString(process.env.POSTGRES_DB) ?? "prompt_management";
  const user = toNonEmptyString(process.env.POSTGRES_USER) ?? "postgres";
  const password = toNonEmptyString(process.env.POSTGRES_PASSWORD) ?? "postgres";

  return `postgres://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
}

const databaseUrl = resolveDatabaseUrl();

const migrationFiles = readdirSync(migrationsDir)
  .filter((file) => file.endsWith(".sql"))
  .sort();

if (migrationFiles.length === 0) {
  console.log("No SQL migrations found.");
  process.exit(0);
}

const client = new Client({ connectionString: databaseUrl });
await client.connect();

try {
  for (const migrationFile of migrationFiles) {
    const sql = readFileSync(path.join(migrationsDir, migrationFile), "utf-8");
    await client.query(sql);
    console.log(`Applied migration: ${migrationFile}`);
  }
} finally {
  await client.end();
}
