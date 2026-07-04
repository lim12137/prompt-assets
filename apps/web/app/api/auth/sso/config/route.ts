import { NextResponse } from "next/server.js";

import { AuthConfigurationError } from "../../../../../lib/auth/session.ts";
import { loadSsoConfig } from "../../../../../lib/auth/sso/sso-config.ts";

/**
 * GET /api/auth/sso/config
 *
 * 给前端提供 SSO 入口可见性配置（spec §5.4）：
 * - ssoEnabled: 是否启用 SSO（决定是否显示"统一认证登录"按钮）
 * - legacyLoginVisible: 是否显示旧账号密码表单（默认隐藏，开发可开）
 *
 * 不返回任何密钥。
 */
export async function GET() {
  let config;
  try {
    config = loadSsoConfig();
  } catch (error) {
    if (error instanceof AuthConfigurationError) {
      // 配置缺失时，前端隐藏 SSO 入口，避免点了报错
      return NextResponse.json(
        { ssoEnabled: false, legacyLoginVisible: false },
        { status: 200 },
      );
    }
    throw error;
  }

  return NextResponse.json(
    {
      ssoEnabled: config.enabled,
      legacyLoginVisible: config.legacyLoginVisible,
    },
    { status: 200 },
  );
}
