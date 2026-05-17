import { spawn, spawnSync } from "node:child_process";
import net from "node:net";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadWorkspaceEnv as loadWorkspaceEnvIntoProcess } from "../../../scripts/workspace-env.mjs";
import { runWithTrackedFilesGuard } from "./tracked-files-guard.mjs";

const require = createRequire(import.meta.url);
const envModulePath = new URL("../lib/env-core.mjs", import.meta.url);

function loadWorkspaceEnv() {
  return loadWorkspaceEnvIntoProcess({ cwd: process.cwd(), env: process.env });
}

async function validateAppEnv(env = process.env) {
  const validation = spawnSync(
    process.execPath,
    [
      "--experimental-strip-types",
      "--input-type=module",
      "-e",
      `const { parseAppEnv } = await import(${JSON.stringify(envModulePath.href)}); parseAppEnv(process.env);`,
    ],
    {
      env: {
        ...process.env,
        ...env,
      },
      encoding: "utf8",
    },
  );

  if (validation.error) {
    throw validation.error;
  }
  if (validation.status !== 0) {
    throw new Error(
      validation.stderr?.trim() || validation.stdout?.trim() || "[run-next] env validation failed",
    );
  }
}

export async function validateAppEnvForTest(env) {
  await validateAppEnv(env);
}

function parseArgs(argv) {
  if (argv.length === 0) {
    throw new Error("next command is required");
  }

  const command = argv[0];
  const forwarded = [];
  let distDir;

  for (let index = 1; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dist") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("--dist requires value");
      }
      distDir = value;
      index += 1;
      continue;
    }
    forwarded.push(arg);
  }

  return {
    command,
    forwarded,
    distDir,
  };
}

const defaults = {
  dev: ".next-dev",
  build: ".next-build",
  start: ".next-build",
};

function readCliOption(forwarded, optionName) {
  const prefix = `${optionName}=`;
  for (let index = 0; index < forwarded.length; index += 1) {
    const arg = forwarded[index];
    if (arg === optionName) {
      return forwarded[index + 1];
    }
    if (arg.startsWith(prefix)) {
      return arg.slice(prefix.length);
    }
  }
  return undefined;
}

function resolveBindTarget(command, forwarded) {
  if (command !== "dev" && command !== "start") {
    return undefined;
  }

  const portRaw = readCliOption(forwarded, "--port");
  if (!portRaw) {
    return undefined;
  }

  const port = Number.parseInt(portRaw, 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`[run-next] Invalid --port value: ${portRaw}`);
  }

  const host = readCliOption(forwarded, "--hostname") || "127.0.0.1";
  return { host, port };
}

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function toHealthCheckHost(host) {
  if (!host || host === "0.0.0.0" || host === "::") {
    return "127.0.0.1";
  }
  return host;
}

export function buildStartupHealthTarget(command, forwarded, env = process.env) {
  if (command !== "dev" && command !== "start") {
    return undefined;
  }

  if (env.NEXT_STARTUP_HEALTH_CHECK === "0") {
    return undefined;
  }

  const explicitUrl = env.NEXT_STARTUP_HEALTH_URL?.trim();
  const bindTarget = resolveBindTarget(command, forwarded);
  if (!explicitUrl && !bindTarget) {
    return undefined;
  }

  const url =
    explicitUrl ||
    new URL(
      env.NEXT_STARTUP_HEALTH_PATH?.trim() || "/api/health",
      `http://${toHealthCheckHost(bindTarget.host)}:${bindTarget.port}`,
    ).href;

  return {
    url,
    timeoutMs: parsePositiveInt(env.NEXT_STARTUP_HEALTH_TIMEOUT_MS, 45000),
    requestTimeoutMs: parsePositiveInt(env.NEXT_STARTUP_HEALTH_REQUEST_TIMEOUT_MS, 5000),
    intervalMs: parsePositiveInt(env.NEXT_STARTUP_HEALTH_INTERVAL_MS, 1000),
  };
}

export function buildRuntimeHealthTarget(command, forwarded, env = process.env) {
  if (command !== "dev" && command !== "start") {
    return undefined;
  }

  if (env.NEXT_RUNTIME_HEALTH_CHECK === "0") {
    return undefined;
  }

  const explicitUrl = env.NEXT_RUNTIME_HEALTH_URL?.trim();
  const bindTarget = resolveBindTarget(command, forwarded);
  if (!explicitUrl && !bindTarget) {
    return undefined;
  }

  const url =
    explicitUrl ||
    new URL(
      env.NEXT_RUNTIME_HEALTH_PATH?.trim() || "/api/health",
      `http://${toHealthCheckHost(bindTarget.host)}:${bindTarget.port}`,
    ).href;

  return {
    url,
    intervalMs: parsePositiveInt(env.NEXT_RUNTIME_HEALTH_INTERVAL_MS, 30_000),
    requestTimeoutMs: parsePositiveInt(env.NEXT_RUNTIME_HEALTH_REQUEST_TIMEOUT_MS, 5_000),
    failureThreshold: parsePositiveInt(env.NEXT_RUNTIME_HEALTH_FAILURE_THRESHOLD, 1),
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sleepWithAbort(ms, signal) {
  if (signal?.aborted) {
    throw new Error("aborted");
  }

  await new Promise((resolve, reject) => {
    let timer = null;
    const cleanup = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      signal?.removeEventListener("abort", abort);
    };
    const abort = () => {
      cleanup();
      reject(new Error("aborted"));
    };
    timer = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);
    signal?.addEventListener("abort", abort, { once: true });
  });
}

async function fetchWithTimeout(url, timeoutMs, fetchImpl, signal) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });

  try {
    return await fetchImpl(url, {
      cache: "no-store",
      signal: controller.signal,
    });
  } finally {
    signal?.removeEventListener("abort", abort);
    clearTimeout(timer);
  }
}

export async function checkHttpHealth(target, deps = {}) {
  const fetchImpl = deps.fetch ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    throw new Error("[run-next] fetch is not available for runtime health check");
  }

  const response = await fetchWithTimeout(
    target.url,
    target.requestTimeoutMs,
    fetchImpl,
    deps.signal,
  );
  if (!response?.ok) {
    throw new Error(`HTTP ${response?.status ?? "unknown"}`);
  }
}

export async function waitForHttpHealth(target, deps = {}) {
  const fetchImpl = deps.fetch ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    throw new Error("[run-next] fetch is not available for startup health check");
  }

  const sleepImpl = deps.sleep ?? sleep;
  const startedAt = Date.now();
  let lastError = null;

  while (Date.now() - startedAt < target.timeoutMs) {
    if (deps.signal?.aborted) {
      throw new Error("[run-next] Startup health check aborted");
    }

    try {
      const response = await fetchWithTimeout(
        target.url,
        target.requestTimeoutMs,
        fetchImpl,
        deps.signal,
      );
      if (response?.ok) {
        return;
      }
      lastError = new Error(`HTTP ${response?.status ?? "unknown"}`);
    } catch (error) {
      if (deps.signal?.aborted) {
        throw new Error("[run-next] Startup health check aborted");
      }
      lastError = error;
    }

    const elapsed = Date.now() - startedAt;
    const remaining = target.timeoutMs - elapsed;
    if (remaining <= 0) {
      break;
    }

    if (sleepImpl === sleep) {
      await sleepWithAbort(Math.min(target.intervalMs, remaining), deps.signal);
    } else {
      await sleepImpl(Math.min(target.intervalMs, remaining));
    }
  }

  const reason =
    lastError instanceof Error && lastError.message ? ` Last error: ${lastError.message}` : "";
  throw new Error(
    `[run-next] Startup health check timed out after ${target.timeoutMs}ms: ${target.url}.${reason}`,
  );
}

export async function monitorRuntimeHealth(target, deps = {}) {
  const sleepImpl = deps.sleep ?? sleep;
  const checkHealth = deps.checkHttpHealth ?? checkHttpHealth;
  const failureThreshold = Number.isFinite(target.failureThreshold)
    ? Math.max(1, target.failureThreshold)
    : 1;
  let consecutiveFailures = 0;

  while (!deps.signal?.aborted) {
    if (sleepImpl === sleep) {
      await sleepWithAbort(target.intervalMs, deps.signal);
    } else {
      await sleepImpl(target.intervalMs);
    }

    if (deps.signal?.aborted) {
      return;
    }

    try {
      await checkHealth(target, deps);
      consecutiveFailures = 0;
    } catch (error) {
      if (deps.signal?.aborted) {
        return;
      }

      consecutiveFailures += 1;
      if (consecutiveFailures < failureThreshold) {
        continue;
      }

      await deps.onFailure?.(error);
      return;
    }
  }
}

async function ensureBindTargetAvailable(bindTarget) {
  if (!bindTarget) {
    return;
  }

  await new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", (error) => {
      const code =
        error && typeof error === "object" && "code" in error
          ? String(error.code)
          : "";
      if (code === "EADDRINUSE") {
        reject(
          new Error(
            `[run-next] Port ${bindTarget.port} on ${bindTarget.host} is already in use (address already in use). Stop the existing process or use another port.`,
          ),
        );
        return;
      }
      reject(error);
    });

    probe.listen(bindTarget.port, bindTarget.host, () => {
      probe.close((closeError) => {
        if (closeError) {
          reject(closeError);
          return;
        }
        resolve();
      });
    });
  });
}

function normalizeCliErrorMessage(error) {
  if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
    const command = "path" in error && typeof error.path === "string" ? error.path : "command";
    return `Command not found in PATH: ${command}`;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return String(error || "Unknown error");
}

function withDefaultNodeOptions(command) {
  const current = process.env.NODE_OPTIONS?.trim() ?? "";
  const hasExplicitHeap = /--max-old-space-size=\d+/u.test(current);
  if (hasExplicitHeap || (command !== "dev" && command !== "build")) {
    return current;
  }

  return current ? `${current} --max-old-space-size=4096` : "--max-old-space-size=4096";
}

function signalToExitCode(signal) {
  if (signal === "SIGINT") {
    return 130;
  }
  if (signal === "SIGTERM") {
    return 143;
  }
  return 1;
}

export async function runNextCli(nextCliPath, command, forwarded, env, options = {}) {
  return await new Promise((resolve, reject) => {
    const spawnProcess =
      options.spawnProcess ??
      ((commandPath, args, spawnOptions) => spawn(commandPath, args, spawnOptions));
    let child = null;
    let killTimer = null;
    let healthAbort = null;
    let settled = false;
    let restartRequested = false;
    const runtimeHealthTarget = options.runtimeHealthTarget;
    const maxRuntimeRestarts = Number.isFinite(options.maxRuntimeRestarts)
      ? Math.max(0, options.maxRuntimeRestarts)
      : parsePositiveInt(env.NEXT_RUNTIME_HEALTH_RESTARTS, 1);
    let runtimeRestartCount = 0;
    const cleanupSignalHandlers = () => {
      process.removeListener("SIGINT", handleSigint);
      process.removeListener("SIGTERM", handleSigterm);
      healthAbort?.abort();
      if (killTimer) {
        clearTimeout(killTimer);
        killTimer = null;
      }
    };

    const forwardSignal = (signal) => {
      if (!child) {
        return;
      }
      if (child.exitCode !== null || child.signalCode !== null) {
        return;
      }
      try {
        child.kill(signal);
      } catch {
        return;
      }
      killTimer = setTimeout(() => {
        if (child.exitCode === null && child.signalCode === null) {
          try {
            child.kill("SIGKILL");
          } catch {}
        }
      }, 5_000);
      if (typeof killTimer.unref === "function") {
        killTimer.unref();
      }
    };

    const handleSigint = () => forwardSignal("SIGINT");
    const handleSigterm = () => forwardSignal("SIGTERM");
    process.once("SIGINT", handleSigint);
    process.once("SIGTERM", handleSigterm);

    const waitForHealth = options.waitForHttpHealth ?? waitForHttpHealth;
    const startRuntimeMonitor = options.monitorRuntimeHealth ?? monitorRuntimeHealth;
    const logError = options.logError ?? ((message) => console.error(message));

    const launchChild = () => {
      restartRequested = false;
      healthAbort = new AbortController();
      child = spawnProcess(process.execPath, [nextCliPath, command, ...forwarded], {
        stdio: "inherit",
        shell: false,
        env,
      });

      child.once("error", (error) => {
        cleanupSignalHandlers();
        reject(error);
      });
      child.once("exit", (code, signal) => {
        if (settled) {
          return;
        }

        const shouldRestart =
          restartRequested && runtimeRestartCount < maxRuntimeRestarts && signal === "SIGTERM";
        healthAbort?.abort();
        if (killTimer) {
          clearTimeout(killTimer);
          killTimer = null;
        }

        if (shouldRestart) {
          runtimeRestartCount += 1;
          launchChild();
          return;
        }

        settled = true;
        cleanupSignalHandlers();
        resolve({
          status: typeof code === "number" ? code : signal ? signalToExitCode(signal) : 1,
          signal: signal ?? null,
        });
      });

      if (options.healthTarget) {
        Promise.resolve(waitForHealth(options.healthTarget, { signal: healthAbort.signal })).catch(
          (error) => {
            if (settled || healthAbort.signal.aborted) {
              return;
            }
            const message = error instanceof Error ? error.message : String(error);
            logError(message);
            forwardSignal("SIGTERM");
          },
        );
      }

      if (runtimeHealthTarget) {
        Promise.resolve(
          startRuntimeMonitor(runtimeHealthTarget, {
            signal: healthAbort.signal,
            onFailure: async (error) => {
              if (settled || healthAbort.signal.aborted) {
                return;
              }

              const message = error instanceof Error ? error.message : String(error);
              logError(message);
              restartRequested = runtimeRestartCount < maxRuntimeRestarts;
              forwardSignal("SIGTERM");
            },
          }),
        ).catch((error) => {
          if (settled || healthAbort.signal.aborted) {
            return;
          }
          const message = error instanceof Error ? error.message : String(error);
          logError(message);
          forwardSignal("SIGTERM");
        });
      }
    };

    launchChild();
  });
}

async function main() {
  loadWorkspaceEnv();
  await validateAppEnv(process.env);

  const { command, forwarded, distDir } = parseArgs(process.argv.slice(2));
  const bindTarget = resolveBindTarget(command, forwarded);
  await ensureBindTargetAvailable(bindTarget);
  const healthTarget = buildStartupHealthTarget(command, forwarded, process.env);
  const runtimeHealthTarget = buildRuntimeHealthTarget(command, forwarded, process.env);

  const resolvedDistDir =
    distDir?.trim() ||
    process.env.NEXT_DIST_DIR_OVERRIDE?.trim() ||
    defaults[command] ||
    ".next";

  const nextCliPath = require.resolve("next/dist/bin/next");
  const result = await runWithTrackedFilesGuard(
    async () =>
      runNextCli(nextCliPath, command, forwarded, {
        ...process.env,
        NEXT_DIST_DIR: resolvedDistDir,
        NODE_OPTIONS: withDefaultNodeOptions(command),
      },
      { healthTarget, runtimeHealthTarget },
    ),
    {
      rootDir: process.cwd(),
      installSignalHandlers: false,
    },
  );

  process.exit(result.status ?? 1);
}

const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await main();
  } catch (error) {
    console.error(normalizeCliErrorMessage(error));
    process.exit(1);
  }
}
