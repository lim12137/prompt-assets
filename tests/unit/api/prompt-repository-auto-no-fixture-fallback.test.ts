import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

const repositoryModulePath = path.resolve(
  "apps/web/lib/api/prompt-repository.ts",
);

test("auto 模式下数据库不可读时 listPrompts 不会静默回退 fixture", async () => {
  const previousDatabaseUrl = process.env.DATABASE_URL;
  const previousSourceMode = process.env.PROMPT_REPOSITORY_DATA_SOURCE;

  process.env.DATABASE_URL = "postgres://invalid:invalid@127.0.0.1:1/unreachable_db";
  delete process.env.PROMPT_REPOSITORY_DATA_SOURCE;

  try {
    const moduleUrl = pathToFileURL(repositoryModulePath);
    moduleUrl.searchParams.set("t", `${Date.now()}`);
    const repositoryModule = await import(moduleUrl.href);

    await assert.rejects(
      () => repositoryModule.listPrompts(),
      /listPrompts requires a readable database in auto mode\.\s+Refusing to fallback to fixture prompts/i,
    );
  } finally {
    if (typeof previousDatabaseUrl === "string") {
      process.env.DATABASE_URL = previousDatabaseUrl;
    } else {
      delete process.env.DATABASE_URL;
    }

    if (typeof previousSourceMode === "string") {
      process.env.PROMPT_REPOSITORY_DATA_SOURCE = previousSourceMode;
    } else {
      delete process.env.PROMPT_REPOSITORY_DATA_SOURCE;
    }
  }
});
