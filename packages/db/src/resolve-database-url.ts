type DatabaseEnvInput = {
  [key: string]: string | undefined;
  DATABASE_URL?: string;
  POSTGRES_USER?: string;
  POSTGRES_PASSWORD?: string;
  POSTGRES_HOST?: string;
  POSTGRES_PORT?: string;
  POSTGRES_DB?: string;
};

function toNonEmptyString(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

export function resolveDatabaseUrl(
  input: DatabaseEnvInput = process.env,
): string {
  const explicitUrl = toNonEmptyString(input.DATABASE_URL);
  if (explicitUrl) {
    return explicitUrl;
  }

  const host = toNonEmptyString(input.POSTGRES_HOST) ?? "127.0.0.1";
  const port = toNonEmptyString(input.POSTGRES_PORT) ?? "5432";
  const database = toNonEmptyString(input.POSTGRES_DB) ?? "prompt_management";
  const user = toNonEmptyString(input.POSTGRES_USER) ?? "postgres";
  const password = toNonEmptyString(input.POSTGRES_PASSWORD) ?? "postgres";

  return `postgres://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
}
