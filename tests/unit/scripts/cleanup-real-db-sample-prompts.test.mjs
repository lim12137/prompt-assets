import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { runCleanupRealDbSamplePrompts } from "../../../scripts/cleanup-real-db-sample-prompts.mjs";

function createMemoryWriter() {
  const chunks = [];

  return {
    write(chunk) {
      chunks.push(String(chunk));
    },
    toString() {
      return chunks.join("");
    },
  };
}

function createWithPgClientStub(records, operationLog) {
  const promptIds = new Map(records.map((record) => [record.slug, record.id ?? record.promptId]));
  let deletedSlugs = [];

  return async (_connectionString, run) =>
    run({
      async query(sql, params = []) {
        const normalizedSql = sql.replace(/\s+/g, " ").trim();
        operationLog.push({
          sql: normalizedSql,
          params,
        });

        if (normalizedSql.startsWith("SELECT p.id")) {
          const requestedSlugs = params[0] ?? [];
          return {
            rows: records.filter((record) => requestedSlugs.includes(record.slug)),
          };
        }

        if (normalizedSql === "BEGIN") {
          return { rows: [] };
        }

        if (normalizedSql.startsWith("DELETE FROM submissions")) {
          return { rows: [] };
        }

        if (normalizedSql.startsWith("UPDATE prompts SET current_version_id = NULL")) {
          return { rows: [] };
        }

        if (normalizedSql.startsWith("DELETE FROM prompts")) {
          const targetIds = params[0] ?? [];
          deletedSlugs = [...promptIds.entries()]
            .filter(([, promptId]) => targetIds.includes(promptId))
            .map(([slug]) => slug);
          return {
            rows: deletedSlugs.map((slug) => ({ slug })),
          };
        }

        if (normalizedSql.startsWith("INSERT INTO audit_logs")) {
          return { rows: [] };
        }

        if (normalizedSql === "COMMIT" || normalizedSql === "ROLLBACK") {
          return { rows: [] };
        }

        throw new Error(`unexpected sql: ${normalizedSql}`);
      },
    });
}

test("cleanup-real-db-sample-prompts: dry-run 输出待删摘要且不执行删除", async () => {
  const stdout = createMemoryWriter();
  const stderr = createMemoryWriter();
  const operationLog = [];
  const records = [
    {
      id: 11,
      slug: "sample-alpha",
      title: "样例 Alpha",
      summary: "alpha summary",
      status: "published",
      primary_category_slug: "writing",
      category_slugs_json: ["writing", "ops"],
      version_count: 2,
      submission_count: 1,
      prompt_like_count: 3,
      version_like_count: 4,
      version_score_count: 5,
      version_daily_interaction_count: 6,
    },
  ];

  const exitCode = await runCleanupRealDbSamplePrompts({
    argv: ["--dry-run", "--slug", "sample-alpha"],
    stdout,
    stderr,
    withPgClientImpl: createWithPgClientStub(records, operationLog),
    connectionString: "postgres://example",
  });

  assert.equal(exitCode, 0);
  assert.equal(stderr.toString(), "");
  assert.equal(
    operationLog.some((entry) => entry.sql.startsWith("DELETE FROM submissions")),
    false,
  );

  const payload = JSON.parse(stdout.toString());
  assert.equal(payload.mode, "dry-run");
  assert.equal(payload.ready, true);
  assert.deepEqual(payload.requestedSlugs, ["sample-alpha"]);
  assert.deepEqual(payload.missingSlugs, []);
  assert.equal(payload.prompts.length, 1);
  assert.deepEqual(payload.prompts[0], {
    slug: "sample-alpha",
    title: "样例 Alpha",
    status: "published",
    summary: "alpha summary",
    primaryCategorySlug: "writing",
    categorySlugs: ["writing", "ops"],
    counts: {
      versions: 2,
      submissions: 1,
      promptLikes: 3,
      versionLikes: 4,
      versionScores: 5,
      versionDailyInteractions: 6,
    },
  });
});

test("cleanup-real-db-sample-prompts: confirm 缺少 operator 或 reason 时失败", async () => {
  const stdout = createMemoryWriter();
  const stderr = createMemoryWriter();
  const operationLog = [];

  const exitCode = await runCleanupRealDbSamplePrompts({
    argv: ["--confirm", "--slug", "sample-alpha"],
    stdout,
    stderr,
    withPgClientImpl: createWithPgClientStub([], operationLog),
    connectionString: "postgres://example",
  });

  assert.equal(exitCode, 1);
  assert.equal(stdout.toString(), "");
  assert.match(stderr.toString(), /--operator 和 --reason/i);
  assert.equal(operationLog.length, 0);
});

test("cleanup-real-db-sample-prompts: confirm 按顺序删除并写出执行摘要", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "cleanup-real-db-script-"));
  const stdout = createMemoryWriter();
  const stderr = createMemoryWriter();
  const operationLog = [];
  const inputPath = path.join(tempDir, "slugs.json");
  const records = [
    {
      id: 21,
      slug: "sample-alpha",
      title: "样例 Alpha",
      summary: "alpha summary",
      status: "published",
      primary_category_slug: "writing",
      category_slugs_json: ["writing"],
      version_count: 2,
      submission_count: 1,
      prompt_like_count: 2,
      version_like_count: 3,
      version_score_count: 4,
      version_daily_interaction_count: 5,
    },
    {
      id: 22,
      slug: "sample-beta",
      title: "样例 Beta",
      summary: "beta summary",
      status: "archived",
      primary_category_slug: "research",
      category_slugs_json: ["research", "ops"],
      version_count: 1,
      submission_count: 0,
      prompt_like_count: 0,
      version_like_count: 1,
      version_score_count: 1,
      version_daily_interaction_count: 2,
    },
  ];

  await writeFile(inputPath, JSON.stringify({ slugs: ["sample-alpha", "sample-beta"] }), "utf-8");

  try {
    const exitCode = await runCleanupRealDbSamplePrompts({
      argv: [
        "--confirm",
        "--input",
        inputPath,
        "--operator",
        "admin@example.com",
        "--reason",
        "首批样例清理",
      ],
      stdout,
      stderr,
      withPgClientImpl: createWithPgClientStub(records, operationLog),
      connectionString: "postgres://example",
      now: () => new Date("2026-05-01T10:20:30.000Z"),
    });

    assert.equal(exitCode, 0);
    assert.equal(stderr.toString(), "");

    const deleteSequence = operationLog
      .map((entry) => entry.sql)
      .filter(
        (sql) =>
          sql === "BEGIN" ||
          sql.startsWith("DELETE FROM submissions") ||
          sql.startsWith("UPDATE prompts SET current_version_id = NULL") ||
          sql.startsWith("DELETE FROM prompts") ||
          sql.startsWith("INSERT INTO audit_logs") ||
          sql === "COMMIT",
      );
    assert.deepEqual(deleteSequence, [
      "BEGIN",
      "DELETE FROM submissions WHERE prompt_id = ANY($1::int[]);",
      "UPDATE prompts SET current_version_id = NULL WHERE id = ANY($1::int[]);",
      "DELETE FROM prompts WHERE id = ANY($1::int[]) RETURNING slug;",
      "INSERT INTO audit_logs (actor_id, action, target_type, target_id, payload_json) VALUES ($1, $2, $3, $4, $5::jsonb);",
      "COMMIT",
    ]);

    const payload = JSON.parse(stdout.toString());
    assert.equal(payload.mode, "confirm");
    assert.equal(payload.deleted, true);
    assert.equal(payload.operator, "admin@example.com");
    assert.equal(payload.reason, "首批样例清理");
    assert.equal(payload.executedAt, "2026-05-01T10:20:30.000Z");
    assert.deepEqual(payload.deletedSlugs, ["sample-alpha", "sample-beta"]);
    assert.equal(payload.summary.promptCount, 2);
    assert.equal(payload.summary.versionCount, 3);
    assert.equal(payload.summary.submissionCount, 1);
    assert.equal(payload.summary.versionDailyInteractionCount, 7);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("cleanup-real-db-sample-prompts: 只接受显式 slug 清单输入", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "cleanup-real-db-input-"));
  const stdout = createMemoryWriter();
  const stderr = createMemoryWriter();
  const inputPath = path.join(tempDir, "invalid.json");

  await writeFile(inputPath, JSON.stringify({ keyword: "sample" }), "utf-8");

  try {
    const exitCode = await runCleanupRealDbSamplePrompts({
      argv: ["--dry-run", "--input", inputPath],
      stdout,
      stderr,
      withPgClientImpl: createWithPgClientStub([], []),
      connectionString: "postgres://example",
    });

    assert.equal(exitCode, 1);
    assert.equal(stdout.toString(), "");
    assert.match(stderr.toString(), /slug 清单/i);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
