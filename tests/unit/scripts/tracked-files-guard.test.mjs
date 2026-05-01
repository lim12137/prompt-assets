import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  cleanupTrackedFilesFromLock,
  resolveTrackedFilePaths,
  runWithTrackedFilesGuard,
} from "../../../apps/web/scripts/tracked-files-guard.mjs";

test("resolveTrackedFilePaths 返回 next-env.d.ts 与 tsconfig.json", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "pm-tracked-files-paths-"));
  const files = resolveTrackedFilePaths(root);

  assert.deepEqual(files, [
    path.join(root, "next-env.d.ts"),
    path.join(root, "tsconfig.json"),
  ]);
});

test("runWithTrackedFilesGuard 在执行后恢复被跟踪文件内容", async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "pm-tracked-files-guard-"));
  const nextEnvPath = path.join(root, "next-env.d.ts");
  const tsconfigPath = path.join(root, "tsconfig.json");
  mkdirSync(root, { recursive: true });
  writeFileSync(nextEnvPath, "original-next-env\n", "utf-8");
  writeFileSync(tsconfigPath, "{\n  \"include\": []\n}\n", "utf-8");

  let lockCalled = false;
  await runWithTrackedFilesGuard(
    async () => {
      writeFileSync(nextEnvPath, "mutated-next-env\n", "utf-8");
      writeFileSync(tsconfigPath, "{\n  \"include\": [\".next-e2e/types/**/*.ts\"]\n}\n", "utf-8");
    },
    {
      rootDir: root,
      lockPath: path.join(root, ".tracked.lock"),
      lock: async (run) => {
        lockCalled = true;
        const lockPath = path.join(root, ".tracked.lock");
        writeFileSync(
          lockPath,
          JSON.stringify({
            pid: process.pid,
            createdAt: Date.now(),
            ownerToken: "unit-test-lock",
          }),
          "utf-8",
        );
        try {
          return run();
        } finally {
          await rm(lockPath, { force: true });
        }
      },
    },
  );

  assert.equal(lockCalled, true);
  assert.equal(readFileSync(nextEnvPath, "utf-8"), "original-next-env\n");
  assert.equal(readFileSync(tsconfigPath, "utf-8"), "{\n  \"include\": []\n}\n");

  await rm(root, { recursive: true, force: true });
});

test("runWithTrackedFilesGuard 会把快照写入锁文件供异常退出后恢复", async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "pm-tracked-files-lock-snapshot-"));
  const nextEnvPath = path.join(root, "next-env.d.ts");
  const tsconfigPath = path.join(root, "tsconfig.json");
  const lockPath = path.join(root, ".tracked.lock");

  mkdirSync(root, { recursive: true });
  writeFileSync(nextEnvPath, "original-next-env\n", "utf-8");
  writeFileSync(tsconfigPath, "{\n  \"include\": []\n}\n", "utf-8");

  await runWithTrackedFilesGuard(
    async () => {
      const payload = JSON.parse(readFileSync(lockPath, "utf-8"));
      assert.equal(Array.isArray(payload.snapshot), true);
      assert.equal(payload.snapshot[0].content, "original-next-env\n");
      assert.equal(payload.snapshot[1].content, "{\n  \"include\": []\n}\n");
    },
    {
      rootDir: root,
      lockPath,
    },
  );

  await rm(root, { recursive: true, force: true });
});

test("cleanupTrackedFilesFromLock 会根据遗留锁中的快照恢复被跟踪文件", async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "pm-tracked-files-stale-lock-"));
  const nextEnvPath = path.join(root, "next-env.d.ts");
  const tsconfigPath = path.join(root, "tsconfig.json");
  const lockPath = path.join(root, ".next-tracked-files.lock");

  mkdirSync(root, { recursive: true });
  writeFileSync(nextEnvPath, "mutated-next-env\n", "utf-8");
  writeFileSync(
    tsconfigPath,
    "{\n  \"include\": [\".next-e2e-admin-prompts-fix/types/**/*.ts\"]\n}\n",
    "utf-8",
  );
  writeFileSync(
    lockPath,
    JSON.stringify({
      pid: 999999,
      createdAt: Date.now() - 60_000,
      ownerToken: "stale-owner",
      snapshot: [
        {
          filePath: nextEnvPath,
          exists: true,
          content: "original-next-env\n",
        },
        {
          filePath: tsconfigPath,
          exists: true,
          content: "{\n  \"include\": []\n}\n",
        },
      ],
    }),
    "utf-8",
  );

  const cleaned = cleanupTrackedFilesFromLock(lockPath, { onlyIfStale: true, staleMs: 1_000 });

  assert.equal(cleaned, true);
  assert.equal(readFileSync(nextEnvPath, "utf-8"), "original-next-env\n");
  assert.equal(readFileSync(tsconfigPath, "utf-8"), "{\n  \"include\": []\n}\n");

  await rm(root, { recursive: true, force: true });
});

test("cleanupTrackedFilesFromLock 不会仅因超时清理仍存活进程持有的活锁", async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "pm-tracked-files-live-lock-"));
  const nextEnvPath = path.join(root, "next-env.d.ts");
  const tsconfigPath = path.join(root, "tsconfig.json");
  const lockPath = path.join(root, ".next-tracked-files.lock");

  mkdirSync(root, { recursive: true });
  writeFileSync(nextEnvPath, "mutated-next-env\n", "utf-8");
  writeFileSync(tsconfigPath, "{\n  \"include\": [\".next-e2e-live/types/**/*.ts\"]\n}\n", "utf-8");
  writeFileSync(
    lockPath,
    JSON.stringify({
      pid: process.pid,
      createdAt: Date.now() - 60_000,
      ownerToken: "live-lock-owner",
      trackedFilesOwnerToken: "live-run-next",
      snapshot: [
        {
          filePath: nextEnvPath,
          exists: true,
          content: "original-next-env\n",
        },
        {
          filePath: tsconfigPath,
          exists: true,
          content: "{\n  \"include\": []\n}\n",
        },
      ],
    }),
    "utf-8",
  );

  const cleaned = cleanupTrackedFilesFromLock(lockPath, { onlyIfStale: true, staleMs: 1_000 });

  assert.equal(cleaned, false);
  assert.equal(readFileSync(nextEnvPath, "utf-8"), "mutated-next-env\n");
  assert.equal(
    readFileSync(tsconfigPath, "utf-8"),
    "{\n  \"include\": [\".next-e2e-live/types/**/*.ts\"]\n}\n",
  );
  assert.equal(existsSync(lockPath), true);

  await rm(root, { recursive: true, force: true });
});

test("cleanupTrackedFilesFromLock 在 owner 不匹配时不会删除别人的活锁", async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "pm-tracked-files-owner-mismatch-"));
  const nextEnvPath = path.join(root, "next-env.d.ts");
  const tsconfigPath = path.join(root, "tsconfig.json");
  const lockPath = path.join(root, ".next-tracked-files.lock");

  mkdirSync(root, { recursive: true });
  writeFileSync(nextEnvPath, "mutated-next-env\n", "utf-8");
  writeFileSync(tsconfigPath, "{\n  \"include\": [\".next-e2e-owner/types/**/*.ts\"]\n}\n", "utf-8");
  writeFileSync(
    lockPath,
    JSON.stringify({
      pid: process.pid,
      createdAt: Date.now(),
      ownerToken: "active-lock-owner",
      trackedFilesOwnerToken: "run-next-owner-a",
      snapshot: [
        {
          filePath: nextEnvPath,
          exists: true,
          content: "original-next-env\n",
        },
        {
          filePath: tsconfigPath,
          exists: true,
          content: "{\n  \"include\": []\n}\n",
        },
      ],
    }),
    "utf-8",
  );

  const cleaned = cleanupTrackedFilesFromLock(lockPath, {
    expectedTrackedFilesOwnerToken: "run-next-owner-b",
  });

  assert.equal(cleaned, false);
  assert.equal(readFileSync(nextEnvPath, "utf-8"), "mutated-next-env\n");
  assert.equal(
    readFileSync(tsconfigPath, "utf-8"),
    "{\n  \"include\": [\".next-e2e-owner/types/**/*.ts\"]\n}\n",
  );
  assert.equal(existsSync(lockPath), true);

  await rm(root, { recursive: true, force: true });
});
