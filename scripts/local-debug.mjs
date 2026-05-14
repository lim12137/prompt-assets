import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, "..");
const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

const defaultConfig = {
  composeFile: path.resolve(workspaceRoot, "docker-compose.local-debug.yml"),
  containerName: "prompt-assets-local-db",
  databaseHost: "10.45.131.70",
  databasePort: "55432",
  databaseName: "app_db",
  databaseUser: "app_user",
  databasePassword: "ChangeMe_2026_Strong!",
  appBaseUrl: "http://127.0.0.1:3010",
  webHost: "127.0.0.1",
  webPort: "3010",
  postgresHost: "127.0.0.1",
  postgresImage: "ghcr.io/lim12137/prompt-assets-postgres:16-alpine",
  healthTimeoutMs: 30000,
  healthIntervalMs: 1000,
  webHealthPath: "/api/health",
  webHealthTimeoutMs: 45000,
  webHealthIntervalMs: 1000,
  webHealthRequestTimeoutMs: 5000,
  webHealthRestarts: 1,
  webRuntimeHealthIntervalMs: 30000,
  webRuntimeHealthFailureThreshold: 1,
};

function toNonEmptyString(value, fallback) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized || fallback;
}

export function resolveLocalDebugConfig(env = process.env) {
  return {
    composeFile: toNonEmptyString(env.LOCAL_DEBUG_COMPOSE_FILE, defaultConfig.composeFile),
    containerName: toNonEmptyString(env.LOCAL_DB_CONTAINER_NAME, defaultConfig.containerName),
    databaseHost: toNonEmptyString(env.LOCAL_POSTGRES_HOST, defaultConfig.databaseHost),
    databasePort: toNonEmptyString(env.LOCAL_POSTGRES_PORT, defaultConfig.databasePort),
    databaseName: toNonEmptyString(env.LOCAL_POSTGRES_DB, defaultConfig.databaseName),
    databaseUser: toNonEmptyString(env.LOCAL_POSTGRES_USER, defaultConfig.databaseUser),
    databasePassword: toNonEmptyString(
      env.LOCAL_POSTGRES_PASSWORD,
      defaultConfig.databasePassword,
    ),
    appBaseUrl: toNonEmptyString(env.LOCAL_APP_BASE_URL, defaultConfig.appBaseUrl),
    webHost: toNonEmptyString(env.LOCAL_WEB_HOST, defaultConfig.webHost),
    webPort: toNonEmptyString(env.LOCAL_WEB_PORT, defaultConfig.webPort),
    postgresHost: toNonEmptyString(env.POSTGRES_HOST, defaultConfig.postgresHost),
    postgresImage: toNonEmptyString(env.LOCAL_POSTGRES_IMAGE, defaultConfig.postgresImage),
    healthTimeoutMs: Number(
      toNonEmptyString(env.LOCAL_DB_HEALTH_TIMEOUT_MS, String(defaultConfig.healthTimeoutMs)),
    ),
    healthIntervalMs: Number(
      toNonEmptyString(
        env.LOCAL_DB_HEALTH_INTERVAL_MS,
        String(defaultConfig.healthIntervalMs),
      ),
    ),
    webHealthPath: toNonEmptyString(
      env.LOCAL_WEB_HEALTH_PATH,
      defaultConfig.webHealthPath,
    ),
    webHealthTimeoutMs: Number(
      toNonEmptyString(
        env.LOCAL_WEB_HEALTH_TIMEOUT_MS,
        String(defaultConfig.webHealthTimeoutMs),
      ),
    ),
    webHealthIntervalMs: Number(
      toNonEmptyString(
        env.LOCAL_WEB_HEALTH_INTERVAL_MS,
        String(defaultConfig.webHealthIntervalMs),
      ),
    ),
    webHealthRequestTimeoutMs: Number(
      toNonEmptyString(
        env.LOCAL_WEB_HEALTH_REQUEST_TIMEOUT_MS,
        String(defaultConfig.webHealthRequestTimeoutMs),
      ),
    ),
    webHealthRestarts: Number(
      toNonEmptyString(env.LOCAL_WEB_HEALTH_RESTARTS, String(defaultConfig.webHealthRestarts)),
    ),
    webRuntimeHealthIntervalMs: Number(
      toNonEmptyString(
        env.LOCAL_WEB_RUNTIME_HEALTH_INTERVAL_MS,
        String(defaultConfig.webRuntimeHealthIntervalMs),
      ),
    ),
    webRuntimeHealthFailureThreshold: Number(
      toNonEmptyString(
        env.LOCAL_WEB_RUNTIME_HEALTH_FAILURE_THRESHOLD,
        String(defaultConfig.webRuntimeHealthFailureThreshold),
      ),
    ),
  };
}

export function buildDatabaseUrl(config) {
  return `postgres://${encodeURIComponent(config.databaseUser)}:${encodeURIComponent(config.databasePassword)}@${config.databaseHost}:${config.databasePort}/${config.databaseName}`;
}

export function buildExecutionPlan(action) {
  switch (action) {
    case "dev":
      return ["db-up", "db-migrate", "db-seed", "web"];
    case "prepare":
      return ["db-up", "db-migrate", "db-seed"];
    case "restart-web":
      return ["stop-web", "web"];
    case "web":
      return ["web"];
    case "stop-web":
    case "db-up":
    case "db-down":
    case "db-status":
    case "db-logs":
      return [action];
    default:
      throw new Error(`Unsupported action: ${action}`);
  }
}

function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: options.env ?? process.env,
    cwd: options.cwd ?? workspaceRoot,
    shell: options.shell ?? false,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status ?? 1}`);
  }
}

function runCommandCapture(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf-8",
    env: options.env ?? process.env,
    cwd: options.cwd ?? workspaceRoot,
    shell: options.shell ?? false,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const output = result.stderr?.trim() || result.stdout?.trim();
    throw new Error(output || `${command} ${args.join(" ")} failed`);
  }

  return result.stdout.trim();
}

export function buildWebDevArgs(config) {
  return [
    "--filter",
    "@prompt-management/web",
    "dev",
    "--hostname",
    config.webHost,
    "--port",
    config.webPort,
  ];
}

export function buildPostgresImageRef(config) {
  return config.postgresImage;
}

function isDockerNoSuchImageError(message) {
  const normalized = String(message || "").toLowerCase();
  return normalized.includes("no such image");
}

function isDockerNoSuchContainerError(message) {
  const normalized = String(message || "").toLowerCase();
  return normalized.includes("no such object");
}

function hasExplicitImageTagOrDigest(imageRef) {
  if (imageRef.includes("@")) {
    return true;
  }

  const lastSegment = imageRef.split("/").pop() ?? imageRef;
  return lastSegment.includes(":");
}

function inspectLocalDockerRepositoryHasAnyTaggedImage(imageRef) {
  const result = spawnSync(
    "docker",
    ["image", "ls", "--format", "{{.Repository}}\t{{.Tag}}", "--filter", `reference=${imageRef}:*`],
    {
      encoding: "utf-8",
      cwd: workspaceRoot,
      shell: false,
    },
  );

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const output = `${result.stderr || ""}\n${result.stdout || ""}`.trim();
    throw new Error(
      output || `docker image ls reference=${imageRef}:* failed with exit code ${result.status ?? 1}`,
    );
  }

  const lines = (result.stdout || "")
    .trim()
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    const [repository = "", tag = ""] = line.split("\t").map((item) => item.trim());
    if (repository === imageRef && tag && tag !== "<none>") {
      return true;
    }
  }

  return false;
}

function inspectDbContainerState(containerName) {
  const result = spawnSync(
    "docker",
    [
      "inspect",
      "--format",
      "{{.State.Status}}\t{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}",
      containerName,
    ],
    {
      encoding: "utf-8",
      cwd: workspaceRoot,
      shell: false,
    },
  );

  if (result.error) {
    throw result.error;
  }

  if (result.status === 0) {
    const [status = "unknown", health = "none"] = (result.stdout || "")
      .trim()
      .split("\t")
      .map((item) => item.trim());
    return {
      exists: true,
      status,
      health,
    };
  }

  const output = `${result.stderr || ""}\n${result.stdout || ""}`.trim();
  if (isDockerNoSuchContainerError(output)) {
    return {
      exists: false,
      status: "missing",
      health: "none",
    };
  }

  throw new Error(output || `docker inspect ${containerName} failed with exit code ${result.status ?? 1}`);
}

function inspectLocalDockerImageExists(imageRef) {
  const result = spawnSync("docker", ["image", "inspect", imageRef], {
    encoding: "utf-8",
    cwd: workspaceRoot,
    shell: false,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status === 0) {
    return true;
  }

  const output = `${result.stderr || ""}\n${result.stdout || ""}`.trim();
  if (isDockerNoSuchImageError(output)) {
    if (!hasExplicitImageTagOrDigest(imageRef)) {
      return inspectLocalDockerRepositoryHasAnyTaggedImage(imageRef);
    }
    return false;
  }

  throw new Error(output || `docker image inspect ${imageRef} failed with exit code ${result.status ?? 1}`);
}

export function ensureLocalPostgresImageAvailable(config, inspectImage = inspectLocalDockerImageExists) {
  const imageRef = buildPostgresImageRef(config);
  const exists = inspectImage(imageRef);

  if (exists) {
    return;
  }

  throw new Error(
    `Local PostgreSQL image is missing: ${imageRef}. Refusing to auto-pull in local debug mode. Please run: docker pull ${imageRef}`,
  );
}

export function resolveDbUpMode(
  config,
  inspectContainer = inspectDbContainerState,
  inspectImage = inspectLocalDockerImageExists,
) {
  const containerState = inspectContainer(config.containerName);
  if (containerState.exists) {
    return containerState.status === "running" ? "reuse-running-container" : "start-existing-container";
  }

  ensureLocalPostgresImageAvailable(config, inspectImage);
  return "compose-up-new-container";
}

export function buildRuntimeEnv(config) {
  const databaseUrl = buildDatabaseUrl(config);
  return {
    ...process.env,
    DATABASE_URL: databaseUrl,
    PROMPT_REPOSITORY_DATA_SOURCE: "auto",
    APP_BASE_URL: config.appBaseUrl,
    POSTGRES_HOST: config.databaseHost,
    POSTGRES_PORT: config.databasePort,
    POSTGRES_DB: config.databaseName,
    POSTGRES_USER: config.databaseUser,
    POSTGRES_PASSWORD: config.databasePassword,
    LOCAL_WEB_HOST: config.webHost,
    LOCAL_WEB_PORT: config.webPort,
    LOCAL_POSTGRES_IMAGE: config.postgresImage,
    NEXT_STARTUP_HEALTH_CHECK: "0",
    NEXT_RUNTIME_HEALTH_CHECK: "0",
  };
}

function runDockerCompose(config, args) {
  runCommand("docker", ["compose", "-f", config.composeFile, ...args]);
}

function sleep(ms, options = {}) {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    if (options.unref && typeof timer.unref === "function") {
      timer.unref();
    }
  });
}

export function buildWebHealthUrl(config) {
  return new URL(config.webHealthPath || defaultConfig.webHealthPath, config.appBaseUrl).href;
}

async function fetchWithTimeout(url, timeoutMs, fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== "function") {
    throw new Error("fetch is not available for web health check");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, {
      cache: "no-store",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function waitForWebHealthy(config, deps = {}) {
  const url = buildWebHealthUrl(config);
  const timeoutMs = Number.isFinite(config.webHealthTimeoutMs)
    ? config.webHealthTimeoutMs
    : defaultConfig.webHealthTimeoutMs;
  const intervalMs = Number.isFinite(config.webHealthIntervalMs)
    ? config.webHealthIntervalMs
    : defaultConfig.webHealthIntervalMs;
  const requestTimeoutMs = Number.isFinite(config.webHealthRequestTimeoutMs)
    ? config.webHealthRequestTimeoutMs
    : defaultConfig.webHealthRequestTimeoutMs;
  const sleepImpl = deps.sleep ?? sleep;
  const fetchImpl = deps.fetch ?? globalThis.fetch;
  const startedAt = Date.now();
  let lastError = null;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetchWithTimeout(url, requestTimeoutMs, fetchImpl);
      if (response?.ok) {
        return;
      }
      lastError = new Error(`HTTP ${response?.status ?? "unknown"}`);
    } catch (error) {
      lastError = error;
    }

    const elapsed = Date.now() - startedAt;
    const remaining = timeoutMs - elapsed;
    if (remaining <= 0) {
      break;
    }
    await sleepImpl(Math.min(intervalMs, remaining));
  }

  const reason =
    lastError instanceof Error && lastError.message ? ` Last error: ${lastError.message}` : "";
  throw new Error(`Web health check timed out after ${timeoutMs}ms: ${url}.${reason}`);
}

async function waitForDatabaseHealthy(config) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < config.healthTimeoutMs) {
    try {
      const status = runCommandCapture("docker", [
        "inspect",
        "--format",
        "{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}",
        config.containerName,
      ]);

      if (status === "healthy" || status === "running") {
        return;
      }
    } catch {
      // Container may not be created yet.
    }

    await sleep(config.healthIntervalMs);
  }

  throw new Error(
    `Local database did not become healthy within ${config.healthTimeoutMs}ms: ${config.containerName}`,
  );
}

function runPnpm(args, config) {
  runCommand(pnpmCommand, args, {
    env: buildRuntimeEnv(config),
    cwd: workspaceRoot,
    shell: process.platform === "win32",
  });
}

function spawnWebProcess(config) {
  return spawn(pnpmCommand, buildWebDevArgs(config), {
    stdio: "inherit",
    env: buildRuntimeEnv(config),
    cwd: workspaceRoot,
    shell: process.platform === "win32",
  });
}

function attachPersistentWebLifecycle(state) {
  const stopChild = (signal) => {
    const child = state.currentChild;
    state.terminating = true;
    if (child && !child.killed) {
      child.kill(signal);
    }
  };

  const handleSigint = () => stopChild("SIGINT");
  const handleSigterm = () => stopChild("SIGTERM");
  process.on("SIGINT", handleSigint);
  process.on("SIGTERM", handleSigterm);

  state.detachLifecycle = () => {
    process.removeListener("SIGINT", handleSigint);
    process.removeListener("SIGTERM", handleSigterm);
  };
}

function attachPersistentWebExit(child, state) {
  child.once("exit", (code, signal) => {
    if (state.restarting) {
      return;
    }

    if (state.detachLifecycle) {
      state.detachLifecycle();
    }

    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 0);
  });
}

async function waitForChildWebHealthy(child, config, waitForHealthy) {
  return await new Promise((resolve, reject) => {
    const handleExit = (code, signal) => {
      reject(
        new Error(
          `Web process exited before health check passed: code=${code ?? "null"} signal=${signal ?? "null"}`,
        ),
      );
    };

    child.once("exit", handleExit);
    Promise.resolve(waitForHealthy(config)).then(
      () => {
        child.removeListener("exit", handleExit);
        resolve();
      },
      (error) => {
        child.removeListener("exit", handleExit);
        reject(error);
      },
    );
  });
}

async function stopChildForRestart(child, deps = {}) {
  if (!child) {
    return;
  }

  const waitMs = deps.waitMs ?? 2000;
  await new Promise((resolve) => {
    let settled = false;
    let exited = false;
    const finish = () => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      resolve();
    };

    const timer = setTimeout(() => {
      try {
        if (!exited) {
          child.kill("SIGKILL");
        }
      } catch {}
      finish();
    }, waitMs);

    child.once("exit", () => {
      exited = true;
      finish();
    });
    try {
      child.kill("SIGTERM");
    } catch {
      finish();
    }
  });
}

async function startWebWithStartupHealth(config, deps = {}) {
  const spawnProcess = deps.spawnWebProcess ?? spawnWebProcess;
  const waitForHealthy = deps.waitForWebHealthy ?? waitForWebHealthy;
  const reclaimWebPort = deps.reclaimWebPort ?? (() => reclaimWebPortIfNeeded(config));
  const log = deps.log ?? ((message) => console.warn(message));
  const maxRestarts = Number.isFinite(config.webHealthRestarts)
    ? Math.max(0, config.webHealthRestarts)
    : defaultConfig.webHealthRestarts;
  let lastError = null;

  for (let attempt = 0; attempt <= maxRestarts; attempt += 1) {
    const child = spawnProcess(config);

    child.on("error", (error) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[local-debug] Failed to launch web process: ${message}`);
      process.exit(1);
    });

    try {
      await waitForChildWebHealthy(child, config, waitForHealthy);
      return child;
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      log(`[local-debug] Web startup health check failed: ${message}`);
      await stopChildForRestart(child, deps);
      await reclaimWebPort();
      if (attempt < maxRestarts) {
        log(
          `[local-debug] Restarting web process after failed health check (${attempt + 1}/${maxRestarts}).`,
        );
      }
    }
  }

  const reason = lastError instanceof Error && lastError.message ? ` ${lastError.message}` : "";
  throw new Error(`Web did not become healthy after ${maxRestarts + 1} attempt(s).${reason}`);
}

async function launchHealthyWeb(config, deps = {}) {
  return await startWebWithStartupHealth(config, {
    ...deps,
    startRuntimeHealthMonitor: false,
  });
}

export async function startRuntimeWebHealthMonitor(config, state, deps = {}) {
  const waitForHealthy = deps.waitForWebHealthy ?? waitForWebHealthy;
  const reclaimWebPort = deps.reclaimWebPort ?? (() => reclaimWebPortIfNeeded(config));
  const launch = deps.launchHealthyWeb ?? ((launchConfig) => launchHealthyWeb(launchConfig, deps));
  const sleepImpl = deps.sleep ?? ((ms) => sleep(ms, { unref: true }));
  const log = deps.log ?? ((message) => console.warn(message));
  const intervalMs = Number.isFinite(config.webRuntimeHealthIntervalMs)
    ? Math.max(1, config.webRuntimeHealthIntervalMs)
    : defaultConfig.webRuntimeHealthIntervalMs;
  const failureThreshold = Number.isFinite(config.webRuntimeHealthFailureThreshold)
    ? Math.max(1, config.webRuntimeHealthFailureThreshold)
    : defaultConfig.webRuntimeHealthFailureThreshold;
  let consecutiveFailures = 0;

  while (!state.terminating) {
    await sleepImpl(intervalMs);
    if (state.terminating) {
      return;
    }

    try {
      await waitForHealthy(config);
      consecutiveFailures = 0;
      continue;
    } catch (error) {
      consecutiveFailures += 1;
      if (consecutiveFailures < failureThreshold) {
        continue;
      }

      const message = error instanceof Error ? error.message : String(error);
      log(`[local-debug] Web runtime health check failed: ${message}`);
    }

    state.restarting = true;
    try {
      await stopChildForRestart(state.currentChild, deps);
      await reclaimWebPort();
      log("[local-debug] Restarting web process after runtime health check failure.");
      const child = await launch(config);
      state.currentChild = child;
      consecutiveFailures = 0;
      if (!deps.attachLifecycle) {
        attachPersistentWebExit(child, state);
      }

      const shouldContinue = await deps.onRuntimeRestart?.(child);
      if (shouldContinue === false) {
        return;
      }
    } finally {
      state.restarting = false;
    }
  }
}

export async function startPersistentWebWithHealth(config, deps = {}) {
  const child = await startWebWithStartupHealth(config, {
    ...deps,
    startRuntimeHealthMonitor: false,
  });
  const state = {
    currentChild: child,
    restarting: false,
    terminating: false,
    detachLifecycle: null,
  };

  if (deps.attachLifecycle) {
    deps.attachLifecycle(child);
  } else {
    attachPersistentWebLifecycle(state);
    attachPersistentWebExit(child, state);
  }

  const monitor = deps.startRuntimeHealthMonitor ?? startRuntimeWebHealthMonitor;
  if (monitor !== false) {
    Promise.resolve(monitor(config, state, deps)).catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[local-debug] Web runtime health monitor failed: ${message}`);
      process.exit(1);
    });
  }

  return child;
}

function parseWindowsProcessInfoOutput(output) {
  const trimmed = String(output || "").trim();
  if (!trimmed) {
    return [];
  }

  const parsed = JSON.parse(trimmed);
  const items = Array.isArray(parsed) ? parsed : [parsed];

  return items
    .map((item) => ({
      pid: String(item?.ProcessId ?? item?.pid ?? "").trim(),
      name: String(item?.Name ?? item?.name ?? "").trim(),
      commandLine: String(item?.CommandLine ?? item?.commandLine ?? "").trim(),
      executablePath: String(item?.ExecutablePath ?? item?.executablePath ?? "").trim(),
      parentPid: String(item?.ParentProcessId ?? item?.parentPid ?? "").trim(),
      parentName: String(item?.ParentName ?? item?.parentName ?? "").trim(),
      parentCommandLine: String(item?.ParentCommandLine ?? item?.parentCommandLine ?? "").trim(),
      parentExecutablePath: String(
        item?.ParentExecutablePath ?? item?.parentExecutablePath ?? "",
      ).trim(),
    }))
    .filter((item) => item.pid);
}

function isLookupCommandUnavailable(message) {
  const normalizedMessage = String(message || "").toLowerCase();
  return (
    normalizedMessage.includes("cannot find path") ||
    normalizedMessage.includes("no such file") ||
    normalizedMessage.includes("not recognized") ||
    normalizedMessage.includes("not found")
  );
}

function isProcessAlreadyStoppedError(message) {
  const normalizedMessage = String(message || "").toLowerCase();
  return (
    normalizedMessage.includes("no running instance of the task") ||
    normalizedMessage.includes("no such process") ||
    normalizedMessage.includes("not found") ||
    normalizedMessage.includes("esrch")
  );
}

export function listListeningProcesses(port) {
  if (process.platform === "win32") {
    const lookupCommand =
      `[Console]::OutputEncoding=[System.Text.Encoding]::UTF8; $OutputEncoding=[System.Text.Encoding]::UTF8; ` +
      `$pids = @(Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique); if (-not $pids -or $pids.Count -eq 0) { return }; ` +
      `$procs = @(Get-CimInstance Win32_Process | Where-Object { $pids -contains $_.ProcessId }); ` +
      `$parentPids = @($procs | Select-Object -ExpandProperty ParentProcessId -Unique); ` +
      `$parentMap = @{}; ` +
      `if ($parentPids -and $parentPids.Count -gt 0) { @(Get-CimInstance Win32_Process | Where-Object { $parentPids -contains $_.ProcessId }) | ForEach-Object { $parentMap[$_.ProcessId] = $_ } }; ` +
      `$procs | ForEach-Object { $parent = $parentMap[$_.ParentProcessId]; [PSCustomObject]@{ ProcessId = $_.ProcessId; Name = $_.Name; CommandLine = $_.CommandLine; ExecutablePath = $_.ExecutablePath; ParentProcessId = $_.ParentProcessId; ParentName = if ($parent) { $parent.Name } else { $null }; ParentCommandLine = if ($parent) { $parent.CommandLine } else { $null }; ParentExecutablePath = if ($parent) { $parent.ExecutablePath } else { $null } } } | ConvertTo-Json -Compress`;
    const output = runCommandCapture("powershell", [
      "-NoProfile",
      "-Command",
      lookupCommand,
    ]);
    return parseWindowsProcessInfoOutput(output);
  }

  const output = runCommandCapture("lsof", ["-iTCP:" + String(port), "-sTCP:LISTEN", "-n", "-P", "-F", "pc"]);
  const lines = output
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean);
  const listeners = [];
  let currentPid = "";

  for (const line of lines) {
    if (line.startsWith("p")) {
      if (currentPid) {
        listeners.push({ pid: currentPid, name: "", commandLine: "", executablePath: "" });
      }
      currentPid = line.slice(1);
      continue;
    }

    if (line.startsWith("c") && currentPid) {
      listeners.push({
        pid: currentPid,
        name: "",
        commandLine: line.slice(1),
        executablePath: "",
      });
      currentPid = "";
    }
  }

  if (currentPid) {
    listeners.push({ pid: currentPid, name: "", commandLine: "", executablePath: "" });
  }

  return listeners;
}

export function isProjectWebProcess(processInfo, config, root = workspaceRoot) {
  const cmd = String(processInfo?.commandLine || "")
    .replaceAll("/", "\\")
    .toLowerCase();
  const executablePath = String(processInfo?.executablePath || "")
    .replaceAll("/", "\\")
    .toLowerCase();
  const parentCmd = String(processInfo?.parentCommandLine || "")
    .replaceAll("/", "\\")
    .toLowerCase();
  const normalizedRoot = String(root || workspaceRoot).replaceAll("/", "\\").toLowerCase();
  const normalizedPort = String(config?.webPort || "");

  const hasWorkspaceWebPath = cmd.includes(`${normalizedRoot}\\apps\\web`);
  const hasPnpmWebMarker =
    cmd.includes("@prompt-management\\web") || cmd.includes("@prompt-management/web");
  const hasWebMarker = hasPnpmWebMarker || hasWorkspaceWebPath;
  const hasNextMarker =
    cmd.includes("\\next\\dist\\bin\\next") || cmd.includes("\\apps\\web\\scripts\\run-next.mjs");
  const isRepoNextProcess = hasWorkspaceWebPath && hasNextMarker;
  const isRepoNextDevProcess =
    cmd.includes(`${normalizedRoot}\\`) &&
    cmd.includes("\\next\\dist\\bin\\next") &&
    /\sdev(\s|$)/.test(cmd) &&
    (!normalizedPort || !cmd.includes("--port") || cmd.includes(`--port ${normalizedPort}`));
  const isRepoNextStartServerProcess =
    cmd.includes(`${normalizedRoot}\\node_modules\\`) &&
    cmd.includes("\\next\\dist\\server\\lib\\start-server.js");
  const isRepoStartServerWithRepoNextDevParent =
    cmd.includes(`${normalizedRoot}\\`) &&
    cmd.includes("\\next\\dist\\server\\lib\\start-server.js") &&
    parentCmd.includes(`${normalizedRoot}\\`) &&
    parentCmd.includes("\\next\\dist\\bin\\next") &&
    /\sdev(\s|$)/.test(parentCmd) &&
    (!normalizedPort || parentCmd.includes(`--port ${normalizedPort}`));
  const isWorkspaceLaunchedWebProcess =
    executablePath.startsWith(normalizedRoot + "\\") && hasWebMarker;

  return (
    hasWebMarker ||
    isRepoNextProcess ||
    isRepoNextDevProcess ||
    isRepoNextStartServerProcess ||
    isRepoStartServerWithRepoNextDevParent ||
    isWorkspaceLaunchedWebProcess
  );
}

function buildParentProcessInfo(processInfo) {
  const parentPid = String(processInfo?.parentPid ?? "").trim();
  if (!parentPid) {
    return null;
  }

  return {
    pid: parentPid,
    name: String(processInfo?.parentName ?? "").trim(),
    commandLine: String(processInfo?.parentCommandLine ?? "").trim(),
    executablePath: String(processInfo?.parentExecutablePath ?? "").trim(),
  };
}

export function planSafeStop(listeners, config, root = workspaceRoot) {
  const killPids = [];
  const blocked = [];

  for (const item of listeners || []) {
    const normalizedItem = {
      ...item,
      pid: String(item?.pid ?? "").trim(),
    };

    if (!normalizedItem.pid) {
      blocked.push(normalizedItem);
      continue;
    }

    if (isProjectWebProcess(normalizedItem, config, root)) {
      killPids.push(normalizedItem.pid);
      const parentProcessInfo = buildParentProcessInfo(normalizedItem);
      if (parentProcessInfo && isProjectWebProcess(parentProcessInfo, config, root)) {
        killPids.push(parentProcessInfo.pid);
      }
    } else {
      blocked.push(normalizedItem);
    }
  }

  return { killPids: [...new Set(killPids)], blocked };
}

const defaultReclaimDeps = {
  listListeners: (port) => listListeningProcesses(port),
  killPid: (pid) =>
    runCommandCapture(
      process.platform === "win32" ? "taskkill" : "kill",
      process.platform === "win32" ? ["/PID", String(pid), "/F"] : ["-TERM", String(pid)],
    ),
};

export async function reclaimWebPortIfNeeded(config, deps = defaultReclaimDeps) {
  let listeners = [];

  try {
    listeners = deps.listListeners(config.webPort) || [];
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message || !isLookupCommandUnavailable(message)) {
      throw error;
    }
    listeners = [];
  }

  if (listeners.length === 0) {
    return;
  }

  const plan = planSafeStop(listeners, config, workspaceRoot);
  if (plan.blocked.length > 0) {
    const blockedPid = plan.blocked[0]?.pid ? `PID ${plan.blocked[0].pid}` : "PID unknown";
    throw new Error(
      `Refusing to stop unknown process on port ${config.webPort}: ${blockedPid}. Only repository web/Next process can be stopped automatically.`,
    );
  }

  for (const pid of plan.killPids) {
    try {
      await Promise.resolve(deps.killPid(pid));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!isProcessAlreadyStoppedError(message)) {
        throw error;
      }
    }
  }
}

async function stopWebProcess(config) {
  await reclaimWebPortIfNeeded(config);
}

async function executePlan(plan, config) {
  for (const step of plan) {
    if (step === "db-up") {
      const dbUpMode = resolveDbUpMode(config);
      if (dbUpMode === "compose-up-new-container") {
        runDockerCompose(config, ["up", "-d", "postgres"]);
      } else if (dbUpMode === "start-existing-container") {
        runCommand("docker", ["start", config.containerName]);
      }
      await waitForDatabaseHealthy(config);
      continue;
    }

    if (step === "db-down") {
      runDockerCompose(config, ["down"]);
      continue;
    }

    if (step === "db-status") {
      runDockerCompose(config, ["ps"]);
      continue;
    }

    if (step === "db-logs") {
      runDockerCompose(config, ["logs", "--tail", "200", "postgres"]);
      continue;
    }

    if (step === "stop-web") {
      await stopWebProcess(config);
      continue;
    }

    if (step === "db-migrate") {
      runPnpm(["db:migrate"], config);
      continue;
    }

    if (step === "db-seed") {
      runPnpm(["db:seed"], config);
      continue;
    }

    if (step === "web") {
      await reclaimWebPortIfNeeded(config);
      await startPersistentWebWithHealth(config);
      return;
    }
  }
}

async function main() {
  const action = process.argv[2] ?? "dev";
  const config = resolveLocalDebugConfig();
  const plan = buildExecutionPlan(action);
  await executePlan(plan, config);
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

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await main();
  } catch (error) {
    console.error(`[local-debug] ${normalizeCliErrorMessage(error)}`);
    process.exit(1);
  }
}
