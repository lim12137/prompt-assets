import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("runtime entrypoint 包含 install build start 链路", async () => {
  const source = await readFile("docker/entrypoint.runtime.sh", "utf-8");
  assert.match(source, /pnpm\s+install\s+--frozen-lockfile/);
  assert.match(source, /pnpm\s+build|pnpm\s+--filter[\s\S]+build/);
  assert.match(source, /pnpm\s+start|pnpm\s+--filter[\s\S]+start/);
});
