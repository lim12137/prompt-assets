"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

/**
 * /auth/callback/failure?error=<code>
 *
 * SSO 登录失败时后端 302 到这里。展示中文错误说明 + 返回登录按钮。
 */
const ERROR_MESSAGES: Record<string, string> = {
  invalid_request: "登录请求参数错误，请重试。",
  invalid_state: "登录状态已过期，请重新登录。",
  exchange_failed: "登录服务暂不可用，请稍后重试或联系管理员。",
  invalid_id_token: "登录凭证校验失败，请重试。",
  missing_user_account: "未识别到用户身份，请联系管理员。",
  profile_failed: "获取用户信息失败，请稍后重试。",
  auth_configuration_error: "登录服务配置异常，请联系管理员。",
  sso_disabled: "统一认证登录未启用。",
};

function FailureCallback() {
  const searchParams = useSearchParams();
  const code = searchParams.get("error") ?? "unknown";
  const message = ERROR_MESSAGES[code] ?? "登录失败，请重试。";

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "linear-gradient(180deg, #f4f7fb 0%, #eef3f8 100%)",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <div
        style={{
          padding: "32px 40px",
          borderRadius: "18px",
          background: "#ffffff",
          boxShadow: "0 12px 36px rgba(22, 36, 56, 0.08)",
          textAlign: "center",
          maxWidth: "440px",
        }}
      >
        <div style={{ fontSize: "40px", marginBottom: "12px" }}>🔒</div>
        <h1 style={{ margin: "0 0 8px", fontSize: "20px", color: "#18212b" }}>登录失败</h1>
        <p style={{ margin: "0 0 18px", color: "#5f6b7a", fontSize: "14px", lineHeight: 1.6 }}>
          {message}
        </p>
        {code !== "unknown" && code !== "sso_disabled" ? (
          <p style={{ margin: "0 0 18px", color: "#9aa6b2", fontSize: "12px" }}>
            错误码：<code>{code}</code>
          </p>
        ) : null}
        <a
          href="/login"
          style={{
            display: "inline-block",
            padding: "10px 20px",
            borderRadius: "10px",
            background: "#18212b",
            color: "#ffffff",
            textDecoration: "none",
            fontSize: "14px",
          }}
        >
          返回登录
        </a>
      </div>
    </main>
  );
}

export default function FailureCallbackPage() {
  return (
    <Suspense fallback={null}>
      <FailureCallback />
    </Suspense>
  );
}
