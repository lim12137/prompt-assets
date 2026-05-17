import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

const repositoryModuleUrl = pathToFileURL(
  path.resolve("apps/web/lib/api/prompt-repository.ts"),
).href;

async function importRepositoryModule(cacheKey: string) {
  return import(`${repositoryModuleUrl}?mode-test=${cacheKey}`);
}

test("prompt repository 显式 fixture 模式仍返回 fixture 数据", async () => {
  const previousDatabaseUrl = process.env.DATABASE_URL;
  const previousDataSource = process.env.PROMPT_REPOSITORY_DATA_SOURCE;

  process.env.DATABASE_URL = "postgres://postgres:postgres@127.0.0.1:1/prompt_management_test";
  process.env.PROMPT_REPOSITORY_DATA_SOURCE = "fixture";

  try {
    const repository = await importRepositoryModule("fixture");
    repository.__resetPromptLikeFixtureStateForTests();

    const prompts = await repository.listPrompts({});

    assert.ok(prompts.length > 0, "显式 fixture 模式应返回 fixture 列表");
    assert.equal(typeof prompts[0]?.slug, "string");
  } finally {
    if (previousDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = previousDatabaseUrl;
    }

    if (previousDataSource === undefined) {
      delete process.env.PROMPT_REPOSITORY_DATA_SOURCE;
    } else {
      process.env.PROMPT_REPOSITORY_DATA_SOURCE = previousDataSource;
    }
  }
});

test("prompt repository 在 auto 模式下拒绝静默回退到 fixture", async () => {
  const previousDatabaseUrl = process.env.DATABASE_URL;
  const previousDataSource = process.env.PROMPT_REPOSITORY_DATA_SOURCE;

  process.env.DATABASE_URL = "postgres://postgres:postgres@127.0.0.1:1/prompt_management_test";
  delete process.env.PROMPT_REPOSITORY_DATA_SOURCE;

  try {
    const repository = await importRepositoryModule("auto");
    repository.__resetPromptLikeFixtureStateForTests();

    await assert.rejects(
      repository.listPrompts({}),
      /listPrompts requires a readable database in auto mode/i,
    );
  } finally {
    if (previousDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = previousDatabaseUrl;
    }

    if (previousDataSource === undefined) {
      delete process.env.PROMPT_REPOSITORY_DATA_SOURCE;
    } else {
      process.env.PROMPT_REPOSITORY_DATA_SOURCE = previousDataSource;
    }
  }
});
