import test from "node:test";
import assert from "node:assert/strict";

import {
  loadSsoConfig,
  ssoEnabled,
  legacyLoginVisible,
  buildClientBasicAuth,
  type SsoConfig,
} from "../../../../apps/web/lib/auth/sso/sso-config.ts";
import { AuthConfigurationError } from "../../../../apps/web/lib/auth/session.ts";

// SSO 相关 env 键，测试间清理避免相互污染
const SSO_ENV_KEYS = [
  "AGENT_UI_SSO_ENABLED",
  "AGENT_UI_SSO_CLIENT_ID",
  "AGENT_UI_SSO_CLIENT_SECRET",
  "AGENT_UI_SSO_REDIRECT_URI",
  "AGENT_UI_SSO_SSO_ORIGIN",
  "AGENT_UI_SSO_AUTHORIZE_URL",
  "AGENT_UI_SSO_TOKEN_URL",
  "AGENT_UI_SSO_PROFILE_URL",
  "AGENT_UI_SSO_JWKS_URL",
  "AGENT_UI_SSO_ISSUER",
  "AGENT_UI_SSO_LOGOUT_URL",
  "AGENT_UI_SSO_SCOPE",
  "AGENT_UI_SSO_STATE_TTL_SECONDS",
  "AGENT_UI_FRONTEND_BASE_URL",
  "AGENT_UI_LEGACY_LOGIN_VISIBLE",
];

function clearSsoEnv(): void {
  for (const key of SSO_ENV_KEYS) {
    delete process.env[key];
  }
}

function fullEnabledEnv(): Record<string, string> {
  return {
    AGENT_UI_SSO_ENABLED: "true",
    AGENT_UI_SSO_CLIENT_ID: "test-client-id",
    AGENT_UI_SSO_CLIENT_SECRET: "test-secret-do-not-use-in-prod",
    AGENT_UI_SSO_REDIRECT_URI: "http://app-host:3010/api/auth/sso/callback",
    AGENT_UI_SSO_SSO_ORIGIN: "http://sso-host:19210",
    AGENT_UI_SSO_AUTHORIZE_URL: "http://sso-host:19210/auth/oauth2/authorize",
    AGENT_UI_SSO_TOKEN_URL: "http://sso-host:19210/auth/oauth2/token",
    AGENT_UI_SSO_PROFILE_URL: "http://sso-host:19210/system/user/getInfo",
    AGENT_UI_SSO_JWKS_URL: "http://sso-host:19210/auth/oauth2/jwks",
    AGENT_UI_SSO_ISSUER: "http://sso-host:19210/auth",
    AGENT_UI_SSO_LOGOUT_URL: "http://sso-host:19210/auth/oauth2/session/logout/all",
    AGENT_UI_FRONTEND_BASE_URL: "http://app-host:3010",
  };
}

test.afterEach(() => {
  clearSsoEnv();
});

// ---- disabled 分支 ----

test("loadSsoConfig: AGENT_UI_SSO_ENABLED 非 true 时返回 enabled=false 且不抛错", () => {
  clearSsoEnv();
  const config = loadSsoConfig({ env: { AGENT_UI_SSO_ENABLED: "false" } as NodeJS.ProcessEnv });
  assert.equal(config.enabled, false);
  assert.equal(config.clientId, "");
  assert.equal(config.clientSecret, "");
});

test("loadSsoConfig: 未设置 AGENT_UI_SSO_ENABLED 时默认 disabled", () => {
  clearSsoEnv();
  const config = loadSsoConfig({ env: {} as NodeJS.ProcessEnv });
  assert.equal(config.enabled, false);
});

test("ssoEnabled: 便捷方法与 config.enabled 一致", () => {
  assert.equal(ssoEnabled({ AGENT_UI_SSO_ENABLED: "true" } as NodeJS.ProcessEnv), true);
  assert.equal(ssoEnabled({ AGENT_UI_SSO_ENABLED: "false" } as NodeJS.ProcessEnv), false);
  assert.equal(ssoEnabled({} as NodeJS.ProcessEnv), false);
});

// ---- enabled + 配置齐全 ----

test("loadSsoConfig: enabled=true + 配置齐全时返回完整 config", () => {
  const config = loadSsoConfig({ env: fullEnabledEnv() as NodeJS.ProcessEnv });
  assert.equal(config.enabled, true);
  assert.equal(config.clientId, "test-client-id");
  assert.equal(config.clientSecret, "test-secret-do-not-use-in-prod");
  assert.equal(config.redirectUri, "http://app-host:3010/api/auth/sso/callback");
  assert.equal(config.ssoOrigin, "http://sso-host:19210");
  assert.equal(config.authorizeUrl, "http://sso-host:19210/auth/oauth2/authorize");
  assert.equal(config.tokenUrl, "http://sso-host:19210/auth/oauth2/token");
  assert.equal(config.profileUrl, "http://sso-host:19210/system/user/getInfo");
  assert.equal(config.jwksUrl, "http://sso-host:19210/auth/oauth2/jwks");
  assert.equal(config.issuer, "http://sso-host:19210/auth");
  assert.equal(config.logoutUrl, "http://sso-host:19210/auth/oauth2/session/logout/all");
});

test("loadSsoConfig: scope 默认 openid profile", () => {
  const { scope } = loadSsoConfig({ env: fullEnabledEnv() as NodeJS.ProcessEnv });
  assert.deepEqual(scope, ["openid", "profile"]);
});

test("loadSsoConfig: scope 空格分隔解析正确", () => {
  const env = { ...fullEnabledEnv(), AGENT_UI_SSO_SCOPE: "openid profile email" };
  const { scope } = loadSsoConfig({ env: env as NodeJS.ProcessEnv });
  assert.deepEqual(scope, ["openid", "profile", "email"]);
});

test("loadSsoConfig: scope 逗号分隔解析正确", () => {
  const env = { ...fullEnabledEnv(), AGENT_UI_SSO_SCOPE: "openid,profile" };
  const { scope } = loadSsoConfig({ env: env as NodeJS.ProcessEnv });
  assert.deepEqual(scope, ["openid", "profile"]);
});

test("loadSsoConfig: stateTtlSeconds 默认 300", () => {
  const { stateTtlSeconds } = loadSsoConfig({ env: fullEnabledEnv() as NodeJS.ProcessEnv });
  assert.equal(stateTtlSeconds, 300);
});

test("loadSsoConfig: stateTtlSeconds 非法值回退 300", () => {
  const env = { ...fullEnabledEnv(), AGENT_UI_SSO_STATE_TTL_SECONDS: "abc" };
  const { stateTtlSeconds } = loadSsoConfig({ env: env as NodeJS.ProcessEnv });
  assert.equal(stateTtlSeconds, 300);
});

test("loadSsoConfig: stateTtlSeconds 负值回退 300", () => {
  const env = { ...fullEnabledEnv(), AGENT_UI_SSO_STATE_TTL_SECONDS: "-10" };
  const { stateTtlSeconds } = loadSsoConfig({ env: env as NodeJS.ProcessEnv });
  assert.equal(stateTtlSeconds, 300);
});

// ---- enabled + 配置缺失 ----

test("loadSsoConfig: enabled=true 但缺 CLIENT_ID 抛 AuthConfigurationError", () => {
  const env = fullEnabledEnv();
  delete env.AGENT_UI_SSO_CLIENT_ID;
  assert.throws(
    () => loadSsoConfig({ env: env as NodeJS.ProcessEnv }),
    (err: unknown) => err instanceof AuthConfigurationError && /CLIENT_ID/.test(err.message),
  );
});

test("loadSsoConfig: enabled=true 但缺 CLIENT_SECRET 抛 AuthConfigurationError", () => {
  const env = fullEnabledEnv();
  delete env.AGENT_UI_SSO_CLIENT_SECRET;
  assert.throws(
    () => loadSsoConfig({ env: env as NodeJS.ProcessEnv }),
    (err: unknown) => err instanceof AuthConfigurationError && /CLIENT_SECRET/.test(err.message),
  );
});

test("loadSsoConfig: enabled=true 但缺 REDIRECT_URI 抛 AuthConfigurationError", () => {
  const env = fullEnabledEnv();
  delete env.AGENT_UI_SSO_REDIRECT_URI;
  assert.throws(
    () => loadSsoConfig({ env: env as NodeJS.ProcessEnv }),
    (err: unknown) => err instanceof AuthConfigurationError && /REDIRECT_URI/.test(err.message),
  );
});

test("loadSsoConfig: enabled=true 但缺 SSO_ORIGIN 抛 AuthConfigurationError", () => {
  const env = fullEnabledEnv();
  delete env.AGENT_UI_SSO_SSO_ORIGIN;
  assert.throws(
    () => loadSsoConfig({ env: env as NodeJS.ProcessEnv }),
    (err: unknown) => err instanceof AuthConfigurationError && /SSO_ORIGIN/.test(err.message),
  );
});

test("loadSsoConfig: enabled=true 但缺 FRONTEND_BASE_URL 抛 AuthConfigurationError", () => {
  const env = fullEnabledEnv();
  delete env.AGENT_UI_FRONTEND_BASE_URL;
  assert.throws(
    () => loadSsoConfig({ env: env as NodeJS.ProcessEnv }),
    (err: unknown) => err instanceof AuthConfigurationError && /FRONTEND_BASE_URL/.test(err.message),
  );
});

test("loadSsoConfig: throwOnMissing=false 时缺失不抛错，返回空字段（便于断言缺失项）", () => {
  const env = fullEnabledEnv();
  delete env.AGENT_UI_SSO_CLIENT_ID;
  const config = loadSsoConfig({
    env: env as NodeJS.ProcessEnv,
    throwOnMissing: false,
  });
  assert.equal(config.enabled, true);
  assert.equal(config.clientId, "");
  assert.equal(config.clientSecret, "test-secret-do-not-use-in-prod");
});

test("loadSsoConfig: 空白字符串视为缺失（trim）", () => {
  const env = { ...fullEnabledEnv(), AGENT_UI_SSO_CLIENT_ID: "   " };
  assert.throws(
    () => loadSsoConfig({ env: env as NodeJS.ProcessEnv }),
    (err: unknown) => err instanceof AuthConfigurationError && /CLIENT_ID/.test(err.message),
  );
});

// ---- legacyLoginVisible ----

test("legacyLoginVisible: 默认 false（旧登录隐藏）", () => {
  assert.equal(legacyLoginVisible({} as NodeJS.ProcessEnv), false);
});

test("legacyLoginVisible: true 时旧登录入口可见", () => {
  assert.equal(
    legacyLoginVisible({ AGENT_UI_LEGACY_LOGIN_VISIBLE: "true" } as NodeJS.ProcessEnv),
    true,
  );
});

// ---- buildClientBasicAuth ----

test("buildClientBasicAuth: 生成 Basic base64(client_id:client_secret)", () => {
  const config: SsoConfig = {
    enabled: true,
    clientId: "test-client-id",
    clientSecret: "test-secret-do-not-use-in-prod",
    redirectUri: "http://app/api/auth/sso/callback",
    ssoOrigin: "http://sso",
    authorizeUrl: "http://sso/auth/oauth2/authorize",
    tokenUrl: "http://sso/auth/oauth2/token",
    profileUrl: "http://sso/system/user/getInfo",
    jwksUrl: "http://sso/auth/oauth2/jwks",
    issuer: "http://sso/auth",
    logoutUrl: "http://sso/auth/oauth2/session/logout/all",
    scope: ["openid", "profile"],
    stateTtlSeconds: 300,
    frontendBaseUrl: "http://app",
    legacyLoginVisible: false,
  };
  const header = buildClientBasicAuth(config);
  const expected = `Basic ${Buffer.from("test-client-id:test-secret-do-not-use-in-prod", "utf8").toString("base64")}`;
  assert.equal(header, expected);
  // 解码验证内容
  const decoded = Buffer.from(header.slice("Basic ".length), "base64").toString("utf8");
  assert.equal(decoded, "test-client-id:test-secret-do-not-use-in-prod");
});
