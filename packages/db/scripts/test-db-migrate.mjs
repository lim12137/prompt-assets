import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import pg from "pg";

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsDir = path.resolve(__dirname, "../migrations");

const host = process.env.TEST_DB_HOST ?? "127.0.0.1";
const port = process.env.TEST_DB_PORT ?? "55432";
const user = process.env.TEST_DB_USER ?? "postgres";
const password = process.env.TEST_DB_PASSWORD ?? "postgres";
const adminDatabase = process.env.TEST_DB_ADMIN_DATABASE ?? "postgres";
const testDatabase = process.env.TEST_DB_DATABASE ?? "prompt_management_test";

const adminUrl =
  process.env.TEST_DB_ADMIN_URL ??
  `postgres://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${adminDatabase}`;
const testUrl =
  process.env.TEST_DATABASE_URL ??
  `postgres://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${testDatabase}`;

const migrationFiles = readdirSync(migrationsDir)
  .filter((file) => file.endsWith(".sql"))
  .sort();

const adminClient = new Client({ connectionString: adminUrl });
await adminClient.connect();

try {
  const escapedDbName = testDatabase.replaceAll("'", "''");
  const existsResult = await adminClient.query(
    `SELECT 1 FROM pg_database WHERE datname = '${escapedDbName}'`,
  );

  if (existsResult.rowCount === 0) {
    await adminClient.query(`CREATE DATABASE "${testDatabase.replaceAll('"', '""')}"`);
  }
} finally {
  await adminClient.end();
}

const testClient = new Client({ connectionString: testUrl });
await testClient.connect();

try {
  await testClient.query("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;");

  for (const migrationFile of migrationFiles) {
    const sql = readFileSync(path.join(migrationsDir, migrationFile), "utf-8");
    await testClient.query(sql);
    console.log(`Applied test migration: ${migrationFile}`);
  }
} finally {
  await testClient.end();
}
