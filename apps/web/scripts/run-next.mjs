import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

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

loadWorkspaceEnv();

const { command, forwarded, distDir } = parseArgs(process.argv.slice(2));
const nextBin = process.platform === "win32" ? "next.cmd" : "next";
const resolvedDistDir =
  distDir?.trim() ||
  process.env.NEXT_DIST_DIR_OVERRIDE?.trim() ||
  defaults[command] ||
  ".next";

const result = spawnSync(nextBin, [command, ...forwarded], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: {
    ...process.env,
    NEXT_DIST_DIR: resolvedDistDir,
  },
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
