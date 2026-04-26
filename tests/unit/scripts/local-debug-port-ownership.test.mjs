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

test("isProjectWebProcess returns true for workspace next dev command without explicit --port", () => {
  const info = {
    pid: "2233",
    name: "node.exe",
    commandLine:
      "\"C:\\Program Files\\nodejs\\node.exe\" \"D:\\1work\\提示词管理\\apps\\web\\node_modules\\next\\dist\\bin\\next\" dev",
    executablePath: "C:\\Program Files\\nodejs\\node.exe",
  };

  assert.equal(isProjectWebProcess(info, config, workspaceRoot), true);
});

test("isProjectWebProcess returns true for workspace next start-server process", () => {
  const info = {
    pid: "3344",
    name: "node.exe",
    commandLine:
      "D:\\node\\node.exe D:\\1work\\提示词管理\\node_modules\\.pnpm\\next@15.5.15\\node_modules\\next\\dist\\server\\lib\\start-server.js",
    executablePath: "D:\\node\\node.exe",
  };

  assert.equal(isProjectWebProcess(info, config, workspaceRoot), true);
});

test("isProjectWebProcess returns true for repo next dev command from workspace node_modules chain", () => {
  const info = {
    pid: "3399",
    name: "node.exe",
    commandLine:
      "D:\\node\\node.exe D:\\1work\\提示词管理\\node_modules\\.pnpm\\next@15.5.15\\node_modules\\next\\dist\\bin\\next dev --hostname 127.0.0.1 --port 3010",
    executablePath: "D:\\node\\node.exe",
  };

  assert.equal(isProjectWebProcess(info, config, workspaceRoot), true);
});

test("isProjectWebProcess returns true for repo start-server when parent is repo next dev chain", () => {
  const info = {
    pid: "4455",
    name: "node.exe",
    commandLine:
      "D:\\node\\node.exe D:\\1work\\提示词管理\\.next\\standalone\\node_modules\\next\\dist\\server\\lib\\start-server.js",
    executablePath: "D:\\node\\node.exe",
    parentCommandLine:
      "D:\\node\\node.exe D:\\1work\\提示词管理\\node_modules\\.pnpm\\next@15.5.15\\node_modules\\next\\dist\\bin\\next dev --hostname 127.0.0.1 --port 3010",
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
