import {
  buildAuditLogEntry,
  type AuditLogInput,
} from "../../../../packages/domain/src/audit.ts";

type SqlClient = {
  query: <T extends Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: T[] }>;
};

export async function writeAuditLog(
  client: SqlClient,
  input: AuditLogInput,
): Promise<void> {
  const entry = buildAuditLogEntry(input);

  await client.query(
    `
      INSERT INTO audit_logs
        (actor_id, action, target_type, target_id, payload_json)
      VALUES ($1, $2, $3, $4, $5::jsonb);
    `,
    [
      entry.actorId,
      entry.action,
      entry.targetType,
      entry.targetId,
      JSON.stringify(entry.payloadJson),
    ],
  );
}
