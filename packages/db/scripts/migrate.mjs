import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import pg from "pg";

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsDir = path.resolve(__dirname, "../migrations");
const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://postgres:postgres@127.0.0.1:5432/prompt_management";

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
