import { spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);

function parseDotEnv(content) {
  const env = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }
    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function loadWorkspaceEnv() {
  const envPath = findNearestEnvPath();
  if (!envPath) {
    return;
  }

  const parsed = parseDotEnv(fs.readFileSync(envPath, "utf8"));
  for (const [key, value] of Object.entries(parsed)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function findNearestEnvPath() {
  let currentDir = process.cwd();
  while (true) {
    const candidate = path.join(currentDir, ".env");
    if (fs.existsSync(candidate)) {
      return candidate;
    }
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      return undefined;
    }
    currentDir = parentDir;
  }
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

async function main() {
  loadWorkspaceEnv();

  const { command, forwarded, distDir } = parseArgs(process.argv.slice(2));
  const bindTarget = resolveBindTarget(command, forwarded);
  await ensureBindTargetAvailable(bindTarget);

  const resolvedDistDir =
    distDir?.trim() ||
    process.env.NEXT_DIST_DIR_OVERRIDE?.trim() ||
    defaults[command] ||
    ".next";

  const nextCliPath = require.resolve("next/dist/bin/next");
  const result = spawnSync(process.execPath, [nextCliPath, command, ...forwarded], {
    stdio: "inherit",
    shell: false,
    env: {
      ...process.env,
      NEXT_DIST_DIR: resolvedDistDir,
    },
  });

  if (result.error) {
    throw result.error;
  }

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
