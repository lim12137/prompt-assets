import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("runtime entrypoint 包含 install build start 链路", async () => {
  const source = await readFile("docker/entrypoint.runtime.sh", "utf-8");
  assert.match(source, /pnpm\s+install\s+--frozen-lockfile/);
  assert.match(source, /pnpm\s+build|pnpm\s+--filter[\s\S]+build/);
  assert.match(source, /pnpm\s+start|pnpm\s+--filter[\s\S]+start/);
});

test("runtime Dockerfile 使用 Node 运行时并复制入口脚本", async () => {
  const source = await readFile("Dockerfile.runtime", "utf-8");
  assert.match(source, /FROM\s+node:20/i);
  assert.match(source, /corepack\s+enable|pnpm/i);
  assert.match(source, /entrypoint\.runtime\.sh/);
  assert.match(source, /WORKDIR\s+\/workspace\/app/i);
});
