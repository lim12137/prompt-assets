import fs from "node:fs";
import path from "node:path";

export function parseDotEnv(content) {
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

export function findNearestEnvPath(startDir = process.cwd()) {
  let currentDir = path.resolve(startDir);
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

export function loadWorkspaceEnv(options = {}) {
  const targetEnv = options.env ?? process.env;
  const envPath = findNearestEnvPath(options.cwd ?? process.cwd());
  if (!envPath) {
    return {};
  }

  const parsed = parseDotEnv(fs.readFileSync(envPath, "utf8"));
  for (const [key, value] of Object.entries(parsed)) {
    if (targetEnv[key] === undefined) {
      targetEnv[key] = value;
    }
  }
  return parsed;
}

export function readWorkspaceEnvValue(key, options = {}) {
  const targetEnv = options.env ?? process.env;
  const fromEnv = targetEnv[key];
  if (typeof fromEnv === "string" && fromEnv.trim().length > 0) {
    return fromEnv.trim();
  }

  const envPath = findNearestEnvPath(options.cwd ?? process.cwd());
  if (!envPath) {
    return "";
  }

  const parsed = parseDotEnv(fs.readFileSync(envPath, "utf8"));
  const value = parsed[key];
  return typeof value === "string" ? value.trim() : "";
}

export function requireWorkspaceEnvValue(key, options = {}) {
  const value = readWorkspaceEnvValue(key, options);
  if (!value) {
    throw new Error(`${key} is required`);
  }
  return value;
}
