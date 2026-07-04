"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * /auth/callback/success?returnTo=<path>
 *
 * SSO 登录成功后端 302 到这里。本页面刷新登录态（/api/me）后跳回 returnTo。
 */
function SuccessCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const startedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (startedRef.current) {
      return;
    }
    startedRef.current = true;

    async function run() {
      try {
        // 刷新登录态（后端已 Set-Cookie，这里确认 session 可读）
        const meResponse = await fetch("/api/me", { credentials: "same-origin" });
        if (!meResponse.ok) {
          setError("登录态恢复失败，请重新登录。");
          return;
        }
        const returnTo = searchParams.get("returnTo") ?? "/admin";
        // returnTo 已在后端 sanitize，这里直接用
        router.replace(returnTo);
        router.refresh();
      } catch {
        setError("登录态恢复失败，请重新登录。");
      }
    }
    void run();
  }, [router, searchParams]);

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
          maxWidth: "420px",
        }}
      >
        {error ? (
          <>
            <div style={{ fontSize: "40px", marginBottom: "12px" }}>⚠️</div>
            <p style={{ margin: "0 0 16px", color: "#c32033", fontSize: "15px" }}>{error}</p>
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
          </>
        ) : (
          <>
            <div
              style={{
                width: "36px",
                height: "36px",
                margin: "0 auto 14px",
                border: "3px solid #e3eaf2",
                borderTopColor: "#1f5f95",
                borderRadius: "50%",
                animation: "pm-sso-spin 0.8s linear infinite",
              }}
            />
            <p style={{ margin: 0, color: "#18212b", fontSize: "15px" }}>登录成功，正在跳转...</p>
          </>
        )}
      </div>
      <style jsx>{`
        @keyframes pm-sso-spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </main>
  );
}

export default function SuccessCallbackPage() {
  return (
    <Suspense fallback={null}>
      <SuccessCallback />
    </Suspense>
  );
}
