import { spawnSync } from "node:child_process";

const containerName = process.env.TEST_DB_CONTAINER ?? "prompt-management-test-db";

const result = spawnSync("docker", ["rm", "-f", containerName], { encoding: "utf-8" });

if (result.status !== 0) {
  const message = result.stderr.trim() || result.stdout.trim();
  if (message.includes("No such container")) {
    console.log(`Container not found: ${containerName}`);
    process.exit(0);
  }
  throw new Error(message || "Failed to remove test DB container.");
}

console.log(`Removed container: ${containerName}`);
