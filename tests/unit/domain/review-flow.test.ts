import test from "node:test";
import assert from "node:assert/strict";

import {
  canTransitionReviewStatus,
  type ReviewStatus,
} from "../../../packages/domain/src/review-flow.ts";

test("pending -> approved / rejected 应为合法流转", () => {
  const from: ReviewStatus = "pending";
  assert.equal(canTransitionReviewStatus(from, "approved"), true);
  assert.equal(canTransitionReviewStatus(from, "rejected"), true);
});

test("approved -> pending 应为非法流转", () => {
  assert.equal(canTransitionReviewStatus("approved", "pending"), false);
});
