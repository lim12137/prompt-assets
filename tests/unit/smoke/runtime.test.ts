import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

test("Node 主版本应为 22", () => {
  const major = Number(process.versions.node.split(".")[0]);
  assert.equal(major, 22);
});

test("根 package.json 必须包含 packageManager 字段", () => {
  const packageJsonPath = resolve(process.cwd(), "package.json");
  assert.equal(existsSync(packageJsonPath), true, "根 package.json 不存在");

  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  assert.equal(
    typeof packageJson.packageManager,
    "string",
    "packageManager 字段缺失或不是字符串"
  );
  assert.notEqual(packageJson.packageManager.trim(), "", "packageManager 不能为空");
});
