import test from "node:test";
import assert from "node:assert/strict";

import {
  buildSubmissionCandidateNo,
  nextVersionNo,
} from "../../../packages/domain/src/versioning.ts";

test("版本号首版应生成 v0001", () => {
  assert.equal(nextVersionNo(), "v0001");
});

test("版本号应从 v0009 递增到 v0010", () => {
  assert.equal(nextVersionNo("v0009"), "v0010");
});

test("候选号应遵循 {baseVersionNo}-cand-{submitter}-{revision}", () => {
  assert.equal(
    buildSubmissionCandidateNo({
      baseVersionNo: "v0001",
      submitter: "alice@example.com",
      revisionIndex: 2,
    }),
    "v0001-cand-alice-2",
  );
});

test("候选号在 revisionIndex 非正整数时抛错", () => {
  assert.throws(
    () =>
      buildSubmissionCandidateNo({
        baseVersionNo: "v0001",
        submitter: "alice@example.com",
        revisionIndex: 0,
      }),
    /revision index/i,
  );
});
