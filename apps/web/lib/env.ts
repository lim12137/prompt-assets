type AppEnvInput = Partial<Record<"DATABASE_URL" | "APP_BASE_URL", string>>;

export type AppEnv = {
  databaseUrl: string;
  appBaseUrl: URL;
};

export function parseAppEnv(input: AppEnvInput = process.env): AppEnv {
  const databaseUrl = input.DATABASE_URL;

  if (!databaseUrl || databaseUrl.trim() === "") {
    throw new Error("DATABASE_URL is required");
  }

  const appBaseUrlRaw = input.APP_BASE_URL ?? "http://localhost:3000";
  const appBaseUrl = new URL(appBaseUrlRaw);

  return {
    databaseUrl,
    appBaseUrl,
  };
}
