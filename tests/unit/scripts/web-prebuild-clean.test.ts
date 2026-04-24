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
  const buildDistMarker = path.join(root, ".next-build", "build-manifest.json");
  const devDistMarker = path.join(root, ".next-dev", "server", "middleware-manifest.json");
  const tsbuildinfo = path.join(root, "tsconfig.tsbuildinfo");

  mkdirSync(path.dirname(nextTypesPage), { recursive: true });
  mkdirSync(path.dirname(nextCacheTsbuildinfo), { recursive: true });
  mkdirSync(path.dirname(buildDistMarker), { recursive: true });
  mkdirSync(path.dirname(devDistMarker), { recursive: true });
  writeFileSync(nextTypesPage, "stale page type file\n", "utf-8");
  writeFileSync(nextCacheTsbuildinfo, "stale cache\n", "utf-8");
  writeFileSync(buildDistMarker, "{\"buildId\":\"old\"}\n", "utf-8");
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
  assert.equal(existsSync(path.join(root, ".next-build")), false);
  assert.equal(existsSync(path.join(root, ".next-dev")), false);
  assert.equal(existsSync(tsbuildinfo), false);
});

test("prebuild-clean 指定 target 时仅清理对应目录", () => {
  const root = mkdtempSync(path.join(tmpdir(), "web-prebuild-clean-targets-"));
  const e2eDistMarker = path.join(root, ".next-e2e", "build-manifest.json");
  const buildDistMarker = path.join(root, ".next-build", "build-manifest.json");
  const devDistMarker = path.join(root, ".next-dev", "server", "middleware-manifest.json");

  mkdirSync(path.dirname(e2eDistMarker), { recursive: true });
  mkdirSync(path.dirname(buildDistMarker), { recursive: true });
  mkdirSync(path.dirname(devDistMarker), { recursive: true });

  writeFileSync(e2eDistMarker, "{\"buildId\":\"e2e\"}\n", "utf-8");
  writeFileSync(buildDistMarker, "{\"buildId\":\"build\"}\n", "utf-8");
  writeFileSync(devDistMarker, "{\"version\":1}\n", "utf-8");

  const result = spawnSync(
    process.execPath,
    [scriptPath, "--target", ".next-e2e"],
    {
      env: {
        ...process.env,
        PREBUILD_CLEAN_ROOT: root,
      },
      encoding: "utf-8",
    },
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(existsSync(path.join(root, ".next-e2e")), false);
  assert.equal(existsSync(path.join(root, ".next-build")), true);
  assert.equal(existsSync(path.join(root, ".next-dev")), true);
});
