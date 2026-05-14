import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("runtime compose 挂载宿主机代码 env 数据并使用 runtime 镜像", async () => {
  const source = await readFile("deploy/docker-compose.runtime.yml", "utf-8");
  assert.match(source, /image:\s*ghcr\.io\//i);
  assert.match(source, /\/srv\/prompt-management\/app:\/workspace\/app/i);
  assert.match(source, /\/srv\/prompt-management\/env\/\.env/i);
  assert.match(source, /\/srv\/prompt-management\/data/i);
  assert.match(source, /restart:\s*unless-stopped/i);
});
