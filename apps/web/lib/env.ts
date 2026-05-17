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

const DEFAULT_HOME_AI_TOOLS: HomeAiTool[] = [
  {
    slug: "ceic-chat",
    name: "CEIC Chat",
    description: "企业内对话入口",
    href: "https://chat.ceic.com",
    accentColor: "#d92d20",
    iconBackground: "#fde8e7",
    iconKey: "ceic",
    order: 10,
  },
  {
    slug: "chatgpt",
    name: "ChatGPT",
    description: "通用问答与写作",
    href: "https://chatgpt.com",
    accentColor: "#f97316",
    iconBackground: "#fff4e8",
    iconKey: "chatgpt",
    order: 20,
  },
  {
    slug: "claude",
    name: "Claude",
    description: "长文本与分析辅助",
    href: "https://claude.ai",
    accentColor: "#7c4a2d",
    iconBackground: "#f5efe9",
    iconKey: "claude",
    order: 30,
  },
];

const DEFAULT_HOME_AI_TOOLS_BY_SLUG = new Map(
  DEFAULT_HOME_AI_TOOLS.map((tool) => [tool.slug, tool] as const),
);

function readTrimmedString(value: string | undefined): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized ? normalized : undefined;
}

function normalizeSlug(slug: string): string {
  return slug.trim().toLowerCase();
}

function slugToEnvSuffix(slug: string): string {
  return slug.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").toUpperCase();
}

function requireField(
  value: string | undefined,
  fieldName: string,
  fallback?: string,
): string {
  const normalized = readTrimmedString(value) ?? readTrimmedString(fallback);

  if (!normalized) {
    throw new Error(`${fieldName} is required`);
  }

  return normalized;
}

function parseOrder(
  value: string | undefined,
  fieldName: string,
  fallback: number,
): number {
  const normalized = readTrimmedString(value);
  if (!normalized) {
    return fallback;
  }

  const parsed = Number(normalized);
  if (!Number.isInteger(parsed)) {
    throw new Error(`${fieldName} must be an integer`);
  }

  return parsed;
}

function parseHomeAiTools(input: AppEnvInput): HomeAiTool[] {
  const rawSlugs = readTrimmedString(input.AI_TOOLS);
  const slugs = rawSlugs
    ? rawSlugs.split(",").map((item) => normalizeSlug(item)).filter(Boolean)
    : DEFAULT_HOME_AI_TOOLS.map((tool) => tool.slug);

  if (slugs.length !== 3) {
    throw new Error(`AI_TOOLS expected 3 tools, received ${slugs.length}`);
  }

  const seen = new Set<string>();
  const tools = slugs.map((slug, index) => {
    if (seen.has(slug)) {
      throw new Error(`AI_TOOLS contains duplicate slug: ${slug}`);
    }
    seen.add(slug);

    const envSuffix = slugToEnvSuffix(slug);
    const defaults = DEFAULT_HOME_AI_TOOLS_BY_SLUG.get(slug);
    const nameField = `AI_TOOL_${envSuffix}_NAME`;
    const descField = `AI_TOOL_${envSuffix}_DESC`;
    const urlField = `AI_TOOL_${envSuffix}_URL`;
    const iconField = `AI_TOOL_${envSuffix}_ICON`;
    const orderField = `AI_TOOL_${envSuffix}_ORDER`;
    const accentField = `AI_TOOL_${envSuffix}_ACCENT_COLOR`;
    const backgroundField = `AI_TOOL_${envSuffix}_ICON_BACKGROUND`;

    return {
      slug,
      name: requireField(input[nameField], nameField, defaults?.name),
      description: requireField(input[descField], descField, defaults?.description),
      href: requireField(input[urlField], urlField, defaults?.href),
      iconKey: requireField(input[iconField], iconField, defaults?.iconKey),
      accentColor: requireField(
        input[accentField],
        accentField,
        defaults?.accentColor,
      ),
      iconBackground: requireField(
        input[backgroundField],
        backgroundField,
        defaults?.iconBackground,
      ),
      order: parseOrder(input[orderField], orderField, defaults?.order ?? (index + 1) * 10),
    };
  });

  return tools.slice().sort((left, right) => left.order - right.order);
}

export function parseAppEnv(input: AppEnvInput = process.env): AppEnv {
  const databaseUrl = input.DATABASE_URL?.trim();

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  const appBaseUrlRaw = input.APP_BASE_URL ?? "http://localhost:3010";
  const appBaseUrl = new URL(appBaseUrlRaw);

  return {
    databaseUrl,
    appBaseUrl,
    homeAiTools: parseHomeAiTools(input),
  };
}
