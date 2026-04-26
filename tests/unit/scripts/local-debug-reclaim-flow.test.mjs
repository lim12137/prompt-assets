import test from "node:test";
import assert from "node:assert/strict";

import {
  reclaimWebPortIfNeeded,
  resolveLocalDebugConfig,
} from "../../../scripts/local-debug.mjs";

const config = resolveLocalDebugConfig({});

test("reclaimWebPortIfNeeded kills old project web and continues", async () => {
  const calls = [];
  await reclaimWebPortIfNeeded(config, {
    listListeners: () => [{ pid: "1200", commandLine: "...@prompt-management/web dev --port 3010" }],
    killPid: (pid) => calls.push(pid),
  });

  assert.deepEqual(calls, ["1200"]);
});

test("reclaimWebPortIfNeeded kills repository next listener without explicit --port", async () => {
  const calls = [];
  await reclaimWebPortIfNeeded(config, {
    listListeners: () => [
      {
        pid: "1300",
        commandLine:
          "\"C:\\Program Files\\nodejs\\node.exe\" \"D:\\1work\\提示词管理\\apps\\web\\node_modules\\next\\dist\\bin\\next\" dev",
      },
    ],
    killPid: (pid) => calls.push(pid),
  });

  assert.deepEqual(calls, ["1300"]);
});

test("reclaimWebPortIfNeeded kills repository next start-server listener", async () => {
  const calls = [];
  await reclaimWebPortIfNeeded(config, {
    listListeners: () => [
      {
        pid: "1400",
        commandLine:
          "D:\\node\\node.exe D:\\1work\\提示词管理\\node_modules\\.pnpm\\next@15.5.15\\node_modules\\next\\dist\\server\\lib\\start-server.js",
      },
    ],
    killPid: (pid) => calls.push(pid),
  });

  assert.deepEqual(calls, ["1400"]);
});

test("reclaimWebPortIfNeeded kills repo start-server listener recognized from parent next dev chain", async () => {
  const calls = [];
  await reclaimWebPortIfNeeded(config, {
    listListeners: () => [
      {
        pid: "1500",
        commandLine:
          "D:\\node\\node.exe D:\\1work\\提示词管理\\.next\\standalone\\node_modules\\next\\dist\\server\\lib\\start-server.js",
        parentCommandLine:
          "D:\\node\\node.exe D:\\1work\\提示词管理\\node_modules\\.pnpm\\next@15.5.15\\node_modules\\next\\dist\\bin\\next dev --hostname 127.0.0.1 --port 3010",
      },
    ],
    killPid: (pid) => calls.push(pid),
  });

  assert.deepEqual(calls, ["1500"]);
});

test("reclaimWebPortIfNeeded kills repo start-server listener and matched repo next-dev parent", async () => {
  const calls = [];
  await reclaimWebPortIfNeeded(config, {
    listListeners: () => [
      {
        pid: "1600",
        commandLine:
          "D:\\node\\node.exe D:\\1work\\提示词管理\\node_modules\\.pnpm\\next@15.5.15\\node_modules\\next\\dist\\server\\lib\\start-server.js",
        parentPid: "1599",
        parentCommandLine:
          "D:\\node\\node.exe D:\\1work\\提示词管理\\node_modules\\.pnpm\\next@15.5.15\\node_modules\\next\\dist\\bin\\next dev --hostname 127.0.0.1 --port 3010",
        parentExecutablePath: "D:\\node\\node.exe",
      },
    ],
    killPid: (pid) => calls.push(pid),
  });

  assert.deepEqual(calls, ["1600", "1599"]);
});

test("reclaimWebPortIfNeeded throws when unknown listener exists", async () => {
  await assert.rejects(
    () =>
      reclaimWebPortIfNeeded(config, {
        listListeners: () => [{ pid: "7777", commandLine: "python -m http.server 3010" }],
        killPid: () => assert.fail("must not kill unknown process"),
      }),
    /Refusing to stop unknown process/i,
  );
});

test("reclaimWebPortIfNeeded ignores already-exited parent process during kill", async () => {
  const calls = [];
  await assert.doesNotReject(() =>
    reclaimWebPortIfNeeded(config, {
      listListeners: () => [
        {
          pid: "1700",
          commandLine:
            "D:\\node\\node.exe D:\\1work\\提示词管理\\node_modules\\.pnpm\\next@15.5.15\\node_modules\\next\\dist\\server\\lib\\start-server.js",
          parentPid: "1699",
          parentCommandLine:
            "D:\\node\\node.exe D:\\1work\\提示词管理\\node_modules\\.pnpm\\next@15.5.15\\node_modules\\next\\dist\\bin\\next dev --hostname 127.0.0.1 --port 3010",
        },
      ],
      killPid: (pid) => {
        calls.push(pid);
        if (pid === "1699") {
          throw new Error("ERROR: The process with PID 1699 could not be terminated. Reason: There is no running instance of the task.");
        }
      },
    }),
  );

  assert.deepEqual(calls, ["1700", "1699"]);
});
