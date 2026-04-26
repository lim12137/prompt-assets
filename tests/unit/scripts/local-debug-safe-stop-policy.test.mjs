import test from "node:test";
import assert from "node:assert/strict";

import {
  planSafeStop,
  resolveLocalDebugConfig,
} from "../../../scripts/local-debug.mjs";

const config = resolveLocalDebugConfig({});
const workspaceRoot = "D:\\1work\\提示词管理";

test("planSafeStop returns kill list when all listeners are project web", () => {
  const listeners = [{ pid: "101", commandLine: "...@prompt-management/web dev --port 3010" }];
  const plan = planSafeStop(listeners, config, workspaceRoot);

  assert.deepEqual(plan.killPids, ["101"]);
  assert.deepEqual(plan.blocked, []);
});

test("planSafeStop blocks unknown listener by default", () => {
  const listeners = [{ pid: "999", commandLine: "python -m http.server 3010" }];
  const plan = planSafeStop(listeners, config, workspaceRoot);

  assert.deepEqual(plan.killPids, []);
  assert.equal(plan.blocked[0].pid, "999");
});
