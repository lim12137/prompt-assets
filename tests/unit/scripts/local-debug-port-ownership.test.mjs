import test from "node:test";
import assert from "node:assert/strict";

import {
  isProjectWebProcess,
  resolveLocalDebugConfig,
} from "../../../scripts/local-debug.mjs";

const config = resolveLocalDebugConfig({});
const workspaceRoot = "D:\\1work\\提示词管理";

test("isProjectWebProcess returns true for workspace pnpm web command", () => {
  const info = {
    pid: "1234",
    name: "node.exe",
    commandLine:
      "node ... pnpm --filter @prompt-management/web dev --hostname 127.0.0.1 --port 3010",
    executablePath: "D:\\1work\\提示词管理\\node.exe",
  };

  assert.equal(isProjectWebProcess(info, config, workspaceRoot), true);
});

test("isProjectWebProcess returns false for unknown command", () => {
  const info = {
    pid: "8888",
    name: "python.exe",
    commandLine: "python -m http.server 3010",
  };

  assert.equal(isProjectWebProcess(info, config, workspaceRoot), false);
});
