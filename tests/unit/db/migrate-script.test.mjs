import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { runMigrations } from "../../../packages/db/scripts/migrate.mjs";

function createMockClient({ appliedFilenames = [], hasLegacySchema = false } = {}) {
  const calls = [];

  return {
    calls,
    async query(sql, params) {
      calls.push({ sql, params });

      if (typeof sql === "string" && sql.includes("SELECT filename FROM")) {
        return {
          rows: appliedFilenames.map((filename) => ({ filename })),
          rowCount: appliedFilenames.length,
        };
      }

      if (
        typeof sql === "string" &&
        sql.includes("information_schema.tables")
      ) {
        return {
          rows: [{ has_tables: hasLegacySchema }],
          rowCount: 1,
        };
      }

      return { rows: [], rowCount: 1 };
    },
  };
}

test("runMigrations 只执行未记录的 pending SQL 文件", async () => {
  const readDir = () => ["0001_init.sql", "0002_feature.sql"];
  const readFile = (filePath) => `-- SQL ${path.basename(filePath)}`;
  const client = createMockClient({ appliedFilenames: ["0001_init.sql"] });
  const logs = [];

  const result = await runMigrations(client, {
    migrationsDir: "/virtual/migrations",
    readDir,
    readFile,
    logger: (message) => logs.push(message),
  });

  assert.deepEqual(result.applied, ["0002_feature.sql"]);
  assert.deepEqual(result.skipped, ["0001_init.sql"]);

  const executedSqlTexts = client.calls.map((call) => call.sql);
  assert.equal(executedSqlTexts.includes("-- SQL 0001_init.sql"), false);
  assert.equal(executedSqlTexts.includes("-- SQL 0002_feature.sql"), true);

  const insertCall = client.calls.find(
    (call) =>
      typeof call.sql === "string" &&
      call.sql.includes("INSERT INTO") &&
      Array.isArray(call.params) &&
      call.params[0] === "0002_feature.sql",
  );
  assert.ok(insertCall);
  assert.equal(logs.some((line) => line.includes("Applied migration: 0002_feature.sql")), true);
});

test("runMigrations 在没有 SQL 文件时直接返回", async () => {
  const client = createMockClient();
  const logs = [];

  const result = await runMigrations(client, {
    migrationsDir: "/virtual/migrations",
    readDir: () => [],
    readFile: () => {
      throw new Error("should not read any files");
    },
    logger: (message) => logs.push(message),
  });

  assert.deepEqual(result.applied, []);
  assert.deepEqual(result.skipped, []);
  assert.equal(logs.includes("No SQL migrations found."), true);
  assert.equal(client.calls.length, 0);
});

test("runMigrations 对旧库首次升级应回填迁移记录并跳过全量 SQL", async () => {
  const readDir = () => ["0001_init.sql", "0002_feature.sql"];
  const readFile = (filePath) => `-- SQL ${path.basename(filePath)}`;
  const client = createMockClient({
    appliedFilenames: [],
    hasLegacySchema: true,
  });
  const logs = [];

  const result = await runMigrations(client, {
    migrationsDir: "/virtual/migrations",
    readDir,
    readFile,
    logger: (message) => logs.push(message),
  });

  assert.deepEqual(result.applied, []);
  assert.deepEqual(result.skipped, ["0001_init.sql", "0002_feature.sql"]);

  const executedSqlTexts = client.calls.map((call) => call.sql);
  assert.equal(executedSqlTexts.includes("-- SQL 0001_init.sql"), false);
  assert.equal(executedSqlTexts.includes("-- SQL 0002_feature.sql"), false);

  const backfillInsertCalls = client.calls.filter(
    (call) =>
      typeof call.sql === "string" &&
      call.sql.includes("INSERT INTO") &&
      Array.isArray(call.params),
  );
  assert.equal(backfillInsertCalls.length, 2);
  assert.deepEqual(
    backfillInsertCalls.map((call) => call.params[0]).sort(),
    ["0001_init.sql", "0002_feature.sql"],
  );
  assert.equal(
    logs.some((line) => line.includes("Backfilled migration records for legacy schema")),
    true,
  );
});
