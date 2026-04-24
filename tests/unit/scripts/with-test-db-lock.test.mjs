import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { withTestDbLock } from "../../../scripts/with-test-db-lock.mjs";

test("withTestDbLock: 同一锁文件下并发调用会串行执行", async () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "pm-db-lock-test-"));
  const lockPath = path.join(tempDir, "db.lock");
  const tracePath = path.join(tempDir, "trace.log");

  const run = async (name, delayMs) =>
    withTestDbLock(
      async () => {
        await writeFile(tracePath, `${name}:start\n`, { flag: "a" });
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        await writeFile(tracePath, `${name}:end\n`, { flag: "a" });
      },
      {
        lockPath,
        pollIntervalMs: 20,
        timeoutMs: 5_000,
      },
    );

  await Promise.all([run("A", 200), run("B", 50)]);

  const trace = (await import("node:fs/promises")).readFile(tracePath, "utf-8");
  const lines = (await trace).trim().split(/\r?\n/);

  assert.equal(lines.length, 4);
  assert.ok(
    (lines[0] === "A:start" && lines[1] === "A:end") ||
      (lines[0] === "B:start" && lines[1] === "B:end"),
    `首个任务应完整执行后第二个任务才开始，实际: ${lines.join(",")}`,
  );
  assert.ok(
    (lines[2] === "A:start" && lines[3] === "A:end") ||
      (lines[2] === "B:start" && lines[3] === "B:end"),
    `第二个任务应在首个任务结束后执行，实际: ${lines.join(",")}`,
  );

  await rm(tempDir, { recursive: true, force: true });
});

test("withTestDbLock: staleMs 大于 timeoutMs 时仍可在超时前回收锁", async () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "pm-db-lock-timeout-test-"));
  const lockPath = path.join(tempDir, "db.lock");

  await writeFile(
    lockPath,
    JSON.stringify({
      pid: process.pid,
      createdAt: Date.now(),
      ownerToken: "stale-holder",
    }),
    "utf-8",
  );

  let executed = false;
  await withTestDbLock(
    async () => {
      executed = true;
    },
    {
      lockPath,
      pollIntervalMs: 20,
      timeoutMs: 300,
      staleMs: 10_000,
    },
  );

  assert.equal(executed, true);
  await rm(tempDir, { recursive: true, force: true });
});
