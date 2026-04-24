import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import pg from "pg";

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const containerName = process.env.TEST_DB_CONTAINER ?? "prompt-management-test-db";
const hostPort = process.env.TEST_DB_PORT ?? "55432";
const host = process.env.TEST_DB_HOST ?? "127.0.0.1";
const user = process.env.TEST_DB_USER ?? "postgres";
const password = process.env.TEST_DB_PASSWORD ?? "postgres";
const database = process.env.TEST_DB_ADMIN_DATABASE ?? "postgres";
const readyTimeoutMs = Number(process.env.TEST_DB_READY_TIMEOUT_MS ?? 30000);

function readWorkspaceEnv() {
  const envPath = path.resolve(__dirname, "../../../.env");
  if (!existsSync(envPath)) {
    return new Map();
  }

  const lines = readFileSync(envPath, "utf-8").split(/\r?\n/);
  const values = new Map();

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const index = trimmed.indexOf("=");
    if (index <= 0) {
      continue;
    }

    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();
    values.set(key, value);
  }

  return values;
}

function runDocker(args) {
  const result = spawnSync("docker", args, { encoding: "utf-8" });
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || result.stdout.trim() || "docker command failed");
  }
  return result.stdout.trim();
}

function tryRunDocker(args) {
  const result = spawnSync("docker", args, { encoding: "utf-8" });
  return {
    ok: result.status === 0,
    output: result.stderr.trim() || result.stdout.trim(),
  };
}

function resolveTestDbImage() {
  const workspaceEnv = readWorkspaceEnv();
  const ghcrOwner = process.env.GHCR_OWNER ?? workspaceEnv.get("GHCR_OWNER");
  const imageTag = process.env.POSTGRES_IMAGE_TAG ?? workspaceEnv.get("POSTGRES_IMAGE_TAG") ?? "16-alpine";
  const candidates = [
    process.env.TEST_DB_IMAGE,
    ghcrOwner ? `ghcr.io/${ghcrOwner}/prompt-assets-postgres:${imageTag}` : null,
    "postgres:16-alpine",
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (tryRunDocker(["image", "inspect", candidate]).ok) {
      return candidate;
    }
  }

  return candidates[0];
}

const image = resolveTestDbImage();

const removeExisting = tryRunDocker(["rm", "-f", containerName]);
if (!removeExisting.ok && !removeExisting.output.includes("No such container")) {
  throw new Error(removeExisting.output || `failed to remove container ${containerName}`);
}

runDocker([
  "run",
  "--name",
  containerName,
  "-e",
  `POSTGRES_USER=${user}`,
  "-e",
  `POSTGRES_PASSWORD=${password}`,
  "-e",
  `POSTGRES_DB=${database}`,
  "-p",
  `${hostPort}:5432`,
  "-d",
  image,
]);

console.log(`Started test DB container with image: ${image}`);

const connectionString = `postgres://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${hostPort}/${database}`;
const start = Date.now();

while (Date.now() - start < readyTimeoutMs) {
  const client = new Client({ connectionString });

  try {
    await client.connect();
    await client.query("select 1;");
    await client.end();
    console.log(`Test DB is ready: ${connectionString}`);
    process.exit(0);
  } catch {
    await client.end().catch(() => undefined);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

throw new Error(`Test DB did not become ready within ${readyTimeoutMs}ms`);
