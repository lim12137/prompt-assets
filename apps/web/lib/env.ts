import { parseAppEnv as parseAppEnvImpl } from "./env-core.mjs";

type AppEnvInput = {
  DATABASE_URL?: string;
  APP_BASE_URL?: string;
  AI_TOOLS?: string;
  [key: string]: string | undefined;
};

export type HomeAiTool = {
  slug: string;
  name: string;
  description: string;
  href: string;
  accentColor: string;
  iconBackground: string;
  iconKey: string;
  order: number;
};

export type AppEnv = {
  databaseUrl: string;
  appBaseUrl: URL;
  homeAiTools: HomeAiTool[];
};

export function parseAppEnv(input: AppEnvInput = process.env): AppEnv {
  return parseAppEnvImpl(input as never) as AppEnv;
}
