"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * 顶部退出按钮：只清本系统 session（POST /api/logout）。
 * SSO 大退入口已移除；后端 /api/auth/sso/logout-all 保留兼容，前端不再调用。
 */
export function LogoutButton({ loginHref }) {
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

  if (isLoggedOut) {
    return (
      <a className="pm-auth-link" href={loginHref}>
        登录
      </a>
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
