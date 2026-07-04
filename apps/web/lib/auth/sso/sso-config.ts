import { AuthConfigurationError } from "../session.ts";

/**
 * SSO 统一认证配置（方案 A：Authorization Code + PKCE + 机密客户端）。
 *
 * 配置全部来自环境变量（本项目无 config/oa-auth.json，沿用 env 驱动）。
 * 优先级：环境变量 > 无默认值（缺失抛 AuthConfigurationError）。
 *
 * 关键规则（playbook 坑 2/3/5）：
 * - client_secret 只在后端读取，绝不返回给前端或写入日志。
 * - AGENT_UI_SSO_ENABLED=true 时，缺失必要配置（CLIENT_ID/CLIENT_SECRET/REDIRECT_URI/SSO_ORIGIN/各端点）
 *   会在 loadSsoConfig() 抛 AuthConfigurationError，start 接口返回 500 + auth_configuration_error。
 * - AGENT_UI_SSO_ENABLED!=true 时，ssoDisabled() 为 true，start 接口返回 404。
 */

export type SsoConfig = {
  enabled: boolean;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  ssoOrigin: string;
  authorizeUrl: string;
  tokenUrl: string;
  profileUrl: string;
  jwksUrl: string;
  issuer: string;
  logoutUrl: string;
  scope: string[];
  stateTtlSeconds: number;
  frontendBaseUrl: string;
  legacyLoginVisible: boolean;
};

type LoadOptions = {
  /** 注入 env，便于测试；默认 process.env */
  env?: NodeJS.ProcessEnv;
  /** 是否抛错；测试里可传 false 拿到原始字段用于断言缺失项 */
  throwOnMissing?: boolean;
};

function isTrue(raw: string | undefined): boolean {
  return (raw ?? "").trim().toLowerCase() === "true";
}

function requireString(
  env: NodeJS.ProcessEnv,
  key: string,
  throwOnMissing: boolean,
): string {
  const value = env[key]?.trim() ?? "";
  if (!value && throwOnMissing) {
    throw new AuthConfigurationError(`${key} is required when AGENT_UI_SSO_ENABLED=true`);
  }
  return value;
}

/**
 * 解析 scope（空格或逗号分隔），默认 ["openid", "profile"]。
 * 缺少 openid 通常拿不到 id_token，因此默认带上。
 */
function parseScope(raw: string | undefined): string[] {
  const value = (raw ?? "").trim();
  if (!value) {
    return ["openid", "profile"];
  }
  const parts = value
    .split(/[\s,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : ["openid", "profile"];
}

function parseStateTtl(raw: string | undefined): number {
  const value = Number(raw ?? "300");
  if (!Number.isFinite(value) || value <= 0) {
    return 300;
  }
  return Math.floor(value);
}

/**
 * 加载 SSO 配置。
 *
 * @param options.env 注入 env（测试用）
 * @param options.throwOnMissing 缺失时是否抛 AuthConfigurationError（默认 true）
 *
 * 行为：
 * - enabled=false：返回 { enabled: false, ... }（其余字段为空串），不抛错。
 * - enabled=true + 配置齐全：返回完整 config。
 * - enabled=true + 缺配置：抛 AuthConfigurationError（throwOnMissing=true 时）或返回带空字段的 config。
 */
export function loadSsoConfig(options: LoadOptions = {}): SsoConfig {
  const env = options.env ?? process.env;
  const throwOnMissing = options.throwOnMissing ?? true;
  const enabled = isTrue(env.AGENT_UI_SSO_ENABLED);

  if (!enabled) {
    return {
      enabled: false,
      clientId: "",
      clientSecret: "",
      redirectUri: "",
      ssoOrigin: "",
      authorizeUrl: "",
      tokenUrl: "",
      profileUrl: "",
      jwksUrl: "",
      issuer: "",
      logoutUrl: "",
      scope: ["openid", "profile"],
      stateTtlSeconds: 300,
      frontendBaseUrl: "",
      legacyLoginVisible: isTrue(env.AGENT_UI_LEGACY_LOGIN_VISIBLE),
    };
  }

  return {
    enabled: true,
    clientId: requireString(env, "AGENT_UI_SSO_CLIENT_ID", throwOnMissing),
    clientSecret: requireString(env, "AGENT_UI_SSO_CLIENT_SECRET", throwOnMissing),
    redirectUri: requireString(env, "AGENT_UI_SSO_REDIRECT_URI", throwOnMissing),
    ssoOrigin: requireString(env, "AGENT_UI_SSO_SSO_ORIGIN", throwOnMissing),
    authorizeUrl: requireString(env, "AGENT_UI_SSO_AUTHORIZE_URL", throwOnMissing),
    tokenUrl: requireString(env, "AGENT_UI_SSO_TOKEN_URL", throwOnMissing),
    profileUrl: requireString(env, "AGENT_UI_SSO_PROFILE_URL", throwOnMissing),
    jwksUrl: requireString(env, "AGENT_UI_SSO_JWKS_URL", throwOnMissing),
    issuer: requireString(env, "AGENT_UI_SSO_ISSUER", throwOnMissing),
    logoutUrl: requireString(env, "AGENT_UI_SSO_LOGOUT_URL", throwOnMissing),
    scope: parseScope(env.AGENT_UI_SSO_SCOPE),
    stateTtlSeconds: parseStateTtl(env.AGENT_UI_SSO_STATE_TTL_SECONDS),
    frontendBaseUrl: requireString(env, "AGENT_UI_FRONTEND_BASE_URL", throwOnMissing),
    legacyLoginVisible: isTrue(env.AGENT_UI_LEGACY_LOGIN_VISIBLE),
  };
}

/**
 * SSO 是否启用（便捷方法）。disabled 时 start 接口应返回 404。
 */
export function ssoEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return isTrue(env.AGENT_UI_SSO_ENABLED);
}

/**
 * 旧账号密码登录入口是否在登录页可见。
 */
export function legacyLoginVisible(env: NodeJS.ProcessEnv = process.env): boolean {
  return isTrue(env.AGENT_UI_LEGACY_LOGIN_VISIBLE);
}

/**
 * 生成 HTTP Basic Auth header 值：`Basic base64(client_id:client_secret)`。
 * 机密客户端 token 交换时使用（playbook 5.3）。
 */
export function buildClientBasicAuth(config: SsoConfig): string {
  const credentials = `${config.clientId}:${config.clientSecret}`;
  const encoded = Buffer.from(credentials, "utf8").toString("base64");
  return `Basic ${encoded}`;
}
