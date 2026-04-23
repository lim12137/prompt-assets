import { spawnSync } from "node:child_process";

import pg from "pg";

const { Client } = pg;

const containerName = process.env.TEST_DB_CONTAINER ?? "prompt-management-test-db";
const image = process.env.TEST_DB_IMAGE ?? "postgres:16-alpine";
const hostPort = process.env.TEST_DB_PORT ?? "55432";
const host = process.env.TEST_DB_HOST ?? "127.0.0.1";
const user = process.env.TEST_DB_USER ?? "postgres";
const password = process.env.TEST_DB_PASSWORD ?? "postgres";
const database = process.env.TEST_DB_ADMIN_DATABASE ?? "postgres";
const readyTimeoutMs = Number(process.env.TEST_DB_READY_TIMEOUT_MS ?? 30000);

function runDocker(args) {
  const result = spawnSync("docker", args, { encoding: "utf-8" });
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || result.stdout.trim() || "docker command failed");
  }
  return result.stdout.trim();
}

function tryRunDocker(args) {
  const result = spawnSync("docker", args, { encoding: "utf-8" });
  return result.status === 0;
}

if (tryRunDocker(["inspect", containerName])) {
  runDocker(["rm", "-f", containerName]);
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
