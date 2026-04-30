"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton({ loginHref }) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [isLoggedOut, setIsLoggedOut] = useState(false);

  async function handleLogout() {
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
      onClick={handleLogout}
      disabled={isPending}
      aria-busy={isPending}
    >
      {isPending ? "退出中..." : "退出"}
    </button>
  );
}
