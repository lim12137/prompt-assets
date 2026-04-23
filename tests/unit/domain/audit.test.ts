import test from "node:test";
import assert from "node:assert/strict";

import { buildAuditLogEntry } from "../../../packages/domain/src/audit.ts";

test("buildAuditLogEntry 规范化审计日志最小字段", () => {
  const entry = buildAuditLogEntry({
    actorId: 42,
    action: "submission.created",
    targetType: "submission",
    targetId: 7,
    payload: {
      promptSlug: "api-debug-assistant",
      candidateVersionNo: "v0003",
      ignored: undefined,
    },
  });

  assert.deepEqual(entry, {
    actorId: 42,
    action: "submission.created",
    targetType: "submission",
    targetId: 7,
    payloadJson: {
      promptSlug: "api-debug-assistant",
      candidateVersionNo: "v0003",
    },
  });
});

test("buildAuditLogEntry 支持点赞动作的必要上下文", () => {
  const entry = buildAuditLogEntry({
    actorId: 5,
    action: "prompt.liked",
    targetType: "prompt",
    targetId: 11,
    payload: {
      promptSlug: "api-debug-assistant",
      liked: true,
      likesCount: 3,
    },
  });

  assert.equal(entry.action, "prompt.liked");
  assert.equal(entry.targetType, "prompt");
  assert.deepEqual(entry.payloadJson, {
    promptSlug: "api-debug-assistant",
    liked: true,
    likesCount: 3,
  });
});
