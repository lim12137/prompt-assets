import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

const scriptPath = path.resolve(
  process.cwd(),
  "apps/web/scripts/prebuild-clean.mjs",
);

test("prebuild-clean 会删除 .next 与 tsconfig.tsbuildinfo", () => {
  const root = mkdtempSync(path.join(tmpdir(), "web-prebuild-clean-"));
  const nextTypesPage = path.join(
    root,
    ".next",
    "types",
    "app",
    "admin",
    "create",
    "page.ts",
  );
  const nextCacheTsbuildinfo = path.join(root, ".next", "cache", ".tsbuildinfo");
  const devDistMarker = path.join(root, ".next-dev", "server", "middleware-manifest.json");
  const tsbuildinfo = path.join(root, "tsconfig.tsbuildinfo");

  mkdirSync(path.dirname(nextTypesPage), { recursive: true });
  mkdirSync(path.dirname(nextCacheTsbuildinfo), { recursive: true });
  mkdirSync(path.dirname(devDistMarker), { recursive: true });
  writeFileSync(nextTypesPage, "stale page type file\n", "utf-8");
  writeFileSync(nextCacheTsbuildinfo, "stale cache\n", "utf-8");
  writeFileSync(devDistMarker, "{\"version\":1}\n", "utf-8");
  writeFileSync(tsbuildinfo, "stale tsc\n", "utf-8");

  const result = spawnSync(process.execPath, [scriptPath], {
    env: {
      ...process.env,
      PREBUILD_CLEAN_ROOT: root,
    },
    encoding: "utf-8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(existsSync(path.join(root, ".next")), false);
  assert.equal(existsSync(path.join(root, ".next-dev")), false);
  assert.equal(existsSync(tsbuildinfo), false);
});
