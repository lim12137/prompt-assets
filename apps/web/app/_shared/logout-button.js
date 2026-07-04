"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * 顶部退出按钮。
 *
 * 支持两种退出（spec §7.4）：
 * - 本地退出：POST /api/logout，仅清本系统 session。
 * - 退出统一认证（大退）：POST /api/auth/sso/logout-all，清本系统 + 触发 SSO 全局退出。
 *   成功后若返回 ssoLogoutUrl，跳转同域 SSO logout 让浏览器清 HttpOnly Cookie（playbook 13.7）。
 *
 * 是否显示"退出统一认证"由 ssoEnabled prop 控制（由 PersistentAuthStatus 注入）。
 */
export function LogoutButton({ loginHref, ssoEnabled = false }) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [isLoggedOut, setIsLoggedOut] = useState(false);

  async function handleLocalLogout() {
    if (isPending) {
      return;
    }
    setIsPending(true);
    try {
      const response = await fetch("/api/logout", {
        method: "POST",
        credentials: "same-origin",
      });
      if (!response.ok) {
        return;
      }
      setIsLoggedOut(true);
      router.refresh();
    } finally {
      setIsPending(false);
    }
  }

  async function handleSsoLogoutAll() {
    if (isPending) {
      return;
    }
    setIsPending(true);
    try {
      const response = await fetch("/api/auth/sso/logout-all", {
        method: "POST",
        credentials: "same-origin",
      });
      if (!response.ok) {
        // 401 表示已无 session，直接回登录页
        setIsLoggedOut(true);
        router.refresh();
        return;
      }
      const payload = await response.json().catch(() => ({}));
      // 若后端返回同域 SSO logout 路径，跳转让浏览器清 SSO HttpOnly Cookie
      if (typeof payload.ssoLogoutUrl === "string" && payload.ssoLogoutUrl) {
        window.location.href = payload.ssoLogoutUrl;
        return;
      }
      // 否则仅本地退出
      setIsLoggedOut(true);
      router.refresh();
    } finally {
      setIsPending(false);
    }
  }

  if (isLoggedOut) {
    return (
      <a className="pm-auth-link" href={loginHref}>
        登录
      </a>
    );
  }

  // SSO 启用：突出"退出统一认证"（大退）
  if (ssoEnabled) {
    return (
      <span className="pm-auth-user-actions" style={{ display: "inline-flex", gap: "8px", alignItems: "center" }}>
        <button
          type="button"
          className="pm-auth-link pm-auth-logout-button pm-auth-logout-sso"
          onClick={handleSsoLogoutAll}
          disabled={isPending}
          aria-busy={isPending}
          title="退出本系统并清除统一认证登录态"
        >
          {isPending ? "退出中..." : "退出统一认证"}
        </button>
        <button
          type="button"
          className="pm-auth-link pm-auth-logout-button pm-auth-logout-local"
          onClick={handleLocalLogout}
          disabled={isPending}
          aria-busy={isPending}
          title="仅退出本系统，保留统一认证登录态"
        >
          仅退出本系统
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      className="pm-auth-link pm-auth-logout-button"
      onClick={handleLocalLogout}
      disabled={isPending}
      aria-busy={isPending}
    >
      {isPending ? "退出中..." : "退出"}
    </button>
  );
}
