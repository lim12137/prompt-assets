import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  parseDotEnv,
  readWorkspaceEnvValue,
  requireWorkspaceEnvValue,
} from "../../../scripts/workspace-env.mjs";

test("parseDotEnv 支持带等号与引号的值", () => {
  const parsed = parseDotEnv(
    [
      "LOGIN_TOKEN_SECRET=\"abc=def==\"",
      "EMPTY_VALUE=",
      "PLAIN_SECRET=plain-secret",
    ].join("\n"),
  );

  assert.equal(parsed.LOGIN_TOKEN_SECRET, "abc=def==");
  assert.equal(parsed.EMPTY_VALUE, "");
  assert.equal(parsed.PLAIN_SECRET, "plain-secret");
});

test("readWorkspaceEnvValue 会读取最近 .env 中的完整 secret", async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "pm-workspace-env-"));
  const nested = path.join(root, "a", "b");

  await import("node:fs/promises").then(({ mkdir }) => mkdir(nested, { recursive: true }));
  writeFileSync(
    path.join(root, ".env"),
    'LOGIN_TOKEN_SECRET="secret=with=equals"\nOTHER_KEY=test\n',
    "utf-8",
  );

  assert.equal(
    readWorkspaceEnvValue("LOGIN_TOKEN_SECRET", { cwd: nested, env: {} }),
    "secret=with=equals",
  );

  await rm(root, { recursive: true, force: true });
});

test("requireWorkspaceEnvValue 在缺失时抛出明确错误", () => {
  assert.throws(
    () => requireWorkspaceEnvValue("LOGIN_TOKEN_SECRET", { cwd: os.tmpdir(), env: {} }),
    /LOGIN_TOKEN_SECRET is required/i,
  );
});
