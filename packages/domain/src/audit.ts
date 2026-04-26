export type AuditAction =
  | "prompt.created"
  | "prompt.liked"
  | "prompt.unliked"
  | "prompt.version.liked"
  | "prompt.version.unliked"
  | "submission.created"
  | "submission.approved"
  | "submission.rejected";

export type AuditTargetType = "prompt" | "prompt_version" | "submission";

export type AuditPayload = Record<string, unknown>;

export type AuditLogInput = {
  actorId: number | null;
  action: AuditAction;
  targetType: AuditTargetType;
  targetId: number;
  payload?: AuditPayload;
};

export type AuditLogEntry = {
  actorId: number | null;
  action: AuditAction;
  targetType: AuditTargetType;
  targetId: number;
  payloadJson: AuditPayload;
};

function compactPayload(payload: AuditPayload = {}): AuditPayload {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined),
  );
}

export function buildAuditLogEntry(input: AuditLogInput): AuditLogEntry {
  return {
    actorId: input.actorId,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    payloadJson: compactPayload(input.payload),
  };
}
