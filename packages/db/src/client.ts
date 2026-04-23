import { drizzle } from "drizzle-orm/node-postgres";
import { Client } from "pg";

import * as schema from "./schema.ts";

export const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://postgres:postgres@127.0.0.1:5432/prompt_management";

export const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ??
  "postgres://postgres:postgres@127.0.0.1:55432/prompt_management_test";

export function createPgClient(connectionString: string = databaseUrl): Client {
  return new Client({ connectionString });
}

export async function isPgReachable(
  connectionString: string,
  timeoutMs: number = 1500,
): Promise<boolean> {
  const client = new Client({
    connectionString,
    connectionTimeoutMillis: timeoutMs,
  });

  try {
    await client.connect();
    await client.query("select 1;");
    return true;
  } catch {
    return false;
  } finally {
    await client.end().catch(() => undefined);
  }
}

export async function withPgClient<T>(
  connectionString: string,
  run: (client: Client) => Promise<T>,
): Promise<T> {
  const client = createPgClient(connectionString);
  await client.connect();

  try {
    return await run(client);
  } finally {
    await client.end();
  }
}

export function createDb(client: Client) {
  return drizzle(client, { schema });
}
