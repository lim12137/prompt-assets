import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";

import * as localDebug from "../../../scripts/local-debug.mjs";

function createChild(label, calls) {
  const child = new EventEmitter();
  child.label = label;
  child.killed = false;
  child.kill = (signal) => {
    child.killed = true;
    calls.push(`kill:${label}:${signal}`);
    child.emit("exit", null, signal);
    return true;
  };
  return child;
}

test("startPersistentWebWithHealth restarts project web when port listens but health times out", async () => {
  assert.equal(typeof localDebug.startPersistentWebWithHealth, "function");

  const config = localDebug.resolveLocalDebugConfig({
    LOCAL_WEB_HEALTH_TIMEOUT_MS: "20",
    LOCAL_WEB_HEALTH_INTERVAL_MS: "1",
    LOCAL_WEB_HEALTH_RESTARTS: "1",
  });
  const calls = [];
  let spawnCount = 0;
  let healthChecks = 0;

  const child = await localDebug.startPersistentWebWithHealth(config, {
    spawnWebProcess: () => {
      spawnCount += 1;
      const current = createChild(`web-${spawnCount}`, calls);
      calls.push(`spawn:${current.label}`);
      return current;
    },
    waitForWebHealthy: async () => {
      healthChecks += 1;
      calls.push(`health:${healthChecks}`);
      if (healthChecks === 1) {
        throw new Error("Web health check timed out");
      }
    },
    reclaimWebPort: async () => {
      calls.push("reclaim");
    },
    attachLifecycle: () => {},
    log: () => {},
  });

  assert.equal(child.label, "web-2");
  assert.deepEqual(calls, [
    "spawn:web-1",
    "health:1",
    "kill:web-1:SIGTERM",
    "reclaim",
    "spawn:web-2",
    "health:2",
  ]);
});
