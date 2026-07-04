import test from "node:test";
import assert from "node:assert/strict";

import { GET as ssoConfigGet } from "../../apps/web/app/api/auth/sso/config/route.ts";

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
  "AGENT_UI_FRONTEND_BASE_URL",
  "AGENT_UI_LEGACY_LOGIN_VISIBLE",
];

function clearEnv(): void {
  for (const key of SSO_ENV_KEYS) {
    delete process.env[key];
  }
}

test.afterEach(() => {
  clearEnv();
});

test("sso config route: 未启用时返回 ssoEnabled=false", async () => {
  clearEnv();
  const response = await ssoConfigGet();
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body, {
    ssoEnabled: false,
    legacyLoginVisible: false,
  });
});

test("sso config route: 启用且 legacy 显示时返回对应开关", async () => {
  process.env.AGENT_UI_SSO_ENABLED = "true";
  process.env.AGENT_UI_SSO_CLIENT_ID = "cid";
  process.env.AGENT_UI_SSO_CLIENT_SECRET = "secret";
  process.env.AGENT_UI_SSO_REDIRECT_URI = "http://app/api/auth/sso/callback";
  process.env.AGENT_UI_SSO_SSO_ORIGIN = "http://sso:19210";
  process.env.AGENT_UI_SSO_AUTHORIZE_URL = "http://sso:19210/auth/oauth2/authorize";
  process.env.AGENT_UI_SSO_TOKEN_URL = "http://sso:19210/auth/oauth2/token";
  process.env.AGENT_UI_SSO_PROFILE_URL = "http://sso:19210/system/user/getInfo";
  process.env.AGENT_UI_SSO_JWKS_URL = "http://sso:19210/auth/oauth2/jwks";
  process.env.AGENT_UI_SSO_ISSUER = "http://sso:19210/auth";
  process.env.AGENT_UI_SSO_LOGOUT_URL = "http://sso:19210/auth/oauth2/session/logout/all";
  process.env.AGENT_UI_FRONTEND_BASE_URL = "http://app";
  process.env.AGENT_UI_LEGACY_LOGIN_VISIBLE = "true";

  const response = await ssoConfigGet();
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body, {
    ssoEnabled: true,
    legacyLoginVisible: true,
  });
});

test("sso config route: 启用但缺配置时降级返回 false/false，避免前端按钮误显示", async () => {
  process.env.AGENT_UI_SSO_ENABLED = "true";
  const response = await ssoConfigGet();
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body, {
    ssoEnabled: false,
    legacyLoginVisible: false,
  });
});
