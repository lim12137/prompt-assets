import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";

import * as runNext from "../../../apps/web/scripts/run-next.mjs";

function createChild(killSignals) {
  const child = new EventEmitter();
  child.exitCode = null;
  child.signalCode = null;
  child.kill = (signal) => {
    killSignals.push(signal);
    child.signalCode = signal;
    child.emit("exit", null, signal);
    return true;
  };
  return child;
}

function createAutoExitChild(killSignals, code = 0) {
  const child = createChild(killSignals);
  queueMicrotask(() => {
    if (child.signalCode === null) {
      child.exitCode = code;
      child.emit("exit", code, null);
    }
  });
  return child;
}

test("buildStartupHealthTarget uses forwarded hostname and port instead of port-only readiness", () => {
  assert.equal(typeof runNext.buildStartupHealthTarget, "function");

  const target = runNext.buildStartupHealthTarget("dev", ["--hostname", "127.0.0.1", "--port", "3010"], {
    NEXT_STARTUP_HEALTH_TIMEOUT_MS: "1234",
    NEXT_STARTUP_HEALTH_REQUEST_TIMEOUT_MS: "234",
    NEXT_STARTUP_HEALTH_INTERVAL_MS: "12",
  });

  assert.deepEqual(target, {
    url: "http://127.0.0.1:3010/api/health",
    timeoutMs: 1234,
    requestTimeoutMs: 234,
    intervalMs: 12,
  });
});

test("runNextCli terminates next when startup health times out after the port is alive", async () => {
  assert.equal(typeof runNext.runNextCli, "function");

  const killSignals = [];
  const child = createChild(killSignals);

  const result = await runNext.runNextCli("next-cli.js", "dev", ["--hostname", "127.0.0.1", "--port", "3010"], {}, {
    spawnProcess: () => child,
    healthTarget: {
      url: "http://127.0.0.1:3010/api/health",
      timeoutMs: 1,
      requestTimeoutMs: 1,
      intervalMs: 1,
    },
    waitForHttpHealth: async () => {
      throw new Error("[run-next] Startup health check timed out");
    },
    logError: () => {},
  });

  assert.deepEqual(killSignals, ["SIGTERM"]);
  assert.equal(result.status, 143);
});

test("buildRuntimeHealthTarget uses forwarded hostname and port for runtime watchdog", () => {
  assert.equal(typeof runNext.buildRuntimeHealthTarget, "function");

  const target = runNext.buildRuntimeHealthTarget(
    "dev",
    ["--hostname", "127.0.0.1", "--port", "3010"],
    {
      NEXT_RUNTIME_HEALTH_INTERVAL_MS: "2222",
      NEXT_RUNTIME_HEALTH_REQUEST_TIMEOUT_MS: "333",
      NEXT_RUNTIME_HEALTH_FAILURE_THRESHOLD: "4",
    },
  );

  assert.deepEqual(target, {
    url: "http://127.0.0.1:3010/api/health",
    intervalMs: 2222,
    requestTimeoutMs: 333,
    failureThreshold: 4,
  });
});

test("runNextCli restarts next when runtime health check starts timing out", async () => {
  assert.equal(typeof runNext.runNextCli, "function");

  const killSignals = [];
  let spawnCount = 0;
  let runtimeMonitorCount = 0;

  const result = await runNext.runNextCli("next-cli.js", "dev", ["--hostname", "127.0.0.1", "--port", "3010"], {}, {
    spawnProcess: () => {
      spawnCount += 1;
      if (spawnCount === 1) {
        return createChild(killSignals);
      }
      return createAutoExitChild(killSignals, 0);
    },
    runtimeHealthTarget: {
      url: "http://127.0.0.1:3010/api/health",
      intervalMs: 1,
      requestTimeoutMs: 1,
      failureThreshold: 1,
    },
    monitorRuntimeHealth: async (_target, deps) => {
      runtimeMonitorCount += 1;
      if (runtimeMonitorCount === 1) {
        await deps.onFailure(new Error("[run-next] Runtime health check timed out"));
      }
    },
    logError: () => {},
  });

  assert.equal(spawnCount, 2);
  assert.equal(runtimeMonitorCount, 2);
  assert.deepEqual(killSignals, ["SIGTERM"]);
  assert.equal(result.status, 0);
});
