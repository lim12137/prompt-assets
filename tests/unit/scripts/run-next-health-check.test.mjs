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
