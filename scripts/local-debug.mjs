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
  databaseHost: "127.0.0.1",
  databasePort: "55432",
  databaseName: "prompt_management",
  databaseUser: "postgres",
  databasePassword: "postgres",
  appBaseUrl: "http://127.0.0.1:3010",
  webHost: "127.0.0.1",
  webPort: "3010",
  postgresHost: "127.0.0.1",
  postgresImage: "ghcr.io/lim12137/prompt-assets-postgres:16-alpine",
  healthTimeoutMs: 30000,
  healthIntervalMs: 1000,
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

function buildRuntimeEnv(config) {
  const databaseUrl = buildDatabaseUrl(config);
  return {
    ...process.env,
    DATABASE_URL: databaseUrl,
    APP_BASE_URL: config.appBaseUrl,
    POSTGRES_HOST: config.databaseHost,
    POSTGRES_PORT: config.databasePort,
    POSTGRES_DB: config.databaseName,
    POSTGRES_USER: config.databaseUser,
    POSTGRES_PASSWORD: config.databasePassword,
    LOCAL_WEB_HOST: config.webHost,
    LOCAL_WEB_PORT: config.webPort,
    LOCAL_POSTGRES_IMAGE: config.postgresImage,
  };
}

function runDockerCompose(config, args) {
  runCommand("docker", ["compose", "-f", config.composeFile, ...args]);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

function startPersistentWeb(config) {
  const child = spawn(pnpmCommand, buildWebDevArgs(config), {
    stdio: "inherit",
    env: buildRuntimeEnv(config),
    cwd: workspaceRoot,
    shell: process.platform === "win32",
  });

  const stopChild = (signal) => {
    if (!child.killed) {
      child.kill(signal);
    }
  };

  process.on("SIGINT", () => stopChild("SIGINT"));
  process.on("SIGTERM", () => stopChild("SIGTERM"));

  child.on("error", (error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[local-debug] Failed to launch web process: ${message}`);
    process.exit(1);
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 0);
  });
}

function findListeningProcessIds(port) {
  if (process.platform === "win32") {
    const output = runCommandCapture("powershell", [
      "-NoProfile",
      "-Command",
      `(Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique) -join "\\n"`,
    ]);
    return output
      .split(/\r?\n/)
      .map((value) => value.trim())
      .filter(Boolean);
  }

  const output = runCommandCapture("lsof", ["-ti", `tcp:${port}`]);
  return output
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function stopWebProcess(config) {
  let processIds = [];

  try {
    processIds = findListeningProcessIds(config.webPort);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message) {
      throw error;
    }

    const normalizedMessage = message.toLowerCase();
    if (
      normalizedMessage.includes("cannot find path") ||
      normalizedMessage.includes("no such file") ||
      normalizedMessage.includes("not recognized") ||
      normalizedMessage.includes("not found")
    ) {
      processIds = [];
    } else {
      throw error;
    }
  }

  if (processIds.length === 0) {
    return;
  }

  const uniqueProcessIds = [...new Set(processIds)];
  for (const processId of uniqueProcessIds) {
    runCommand(
      process.platform === "win32" ? "taskkill" : "kill",
      process.platform === "win32" ? ["/PID", processId, "/F"] : ["-TERM", processId],
    );
  }
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
      stopWebProcess(config);
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
      startPersistentWeb(config);
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
