import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workflowPath = ".github/workflows/publish-images.yml";

test("publish-images workflow 为 web 发布 amd64 与 arm64 多架构镜像", async () => {
  const source = await readFile(workflowPath, "utf-8");

  assert.match(source, /docker\/setup-qemu-action@v3/i);
  assert.match(source, /docker\/setup-buildx-action@v3/i);
  assert.match(source, /Build and push web image[\s\S]*platforms:\s*linux\/amd64,\s*linux\/arm64/i);
  assert.match(
    source,
    /Build and push web image[\s\S]*tags:\s*ghcr\.io\/\$\{\{\s*steps\.vars\.outputs\.owner_lc\s*\}\}\/prompt-assets-web:latest/i,
  );
});

test("publish-images workflow 通过 manifest copy 发布 postgres 多架构镜像", async () => {
  const source = await readFile(workflowPath, "utf-8");

  assert.doesNotMatch(source, /docker pull postgres:16-alpine/i);
  assert.doesNotMatch(
    source,
    /docker tag postgres:16-alpine ghcr\.io\/\$\{\{\s*steps\.vars\.outputs\.owner_lc\s*\}\}\/prompt-assets-postgres:16-alpine/i,
  );
  assert.doesNotMatch(
    source,
    /docker push ghcr\.io\/\$\{\{\s*steps\.vars\.outputs\.owner_lc\s*\}\}\/prompt-assets-postgres:16-alpine/i,
  );
  assert.match(
    source,
    /docker buildx imagetools create[\s\\]+--tag\s+ghcr\.io\/\$\{\{\s*steps\.vars\.outputs\.owner_lc\s*\}\}\/prompt-assets-postgres:16-alpine[\s\\]+docker\.io\/library\/postgres:16-alpine/i,
  );
});
