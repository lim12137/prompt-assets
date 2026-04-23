import test from "node:test";
import assert from "node:assert/strict";

import { nextVersionNo } from "../../../packages/domain/src/versioning.ts";

test("版本号首版应生成 v0001", () => {
  assert.equal(nextVersionNo(), "v0001");
});

test("版本号应从 v0009 递增到 v0010", () => {
  assert.equal(nextVersionNo("v0009"), "v0010");
});
