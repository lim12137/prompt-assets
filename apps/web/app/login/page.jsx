"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState("请输入 OA 账号和密码。");

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) {
      return;
    }

    setSubmitting(true);
    setFeedback("登录中...");
    try {
      const redirect = searchParams.get("redirect") ?? "/admin";
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password, redirect }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          typeof payload.error === "string" && payload.error
            ? payload.error
            : "登录失败",
        );
      }
      router.replace(typeof payload.redirect === "string" ? payload.redirect : "/admin");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "登录失败");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main style={{ maxWidth: "420px", margin: "48px auto", padding: "16px" }}>
      <h1 style={{ marginTop: 0 }}>登录</h1>
      <form onSubmit={handleSubmit} style={{ display: "grid", gap: "10px" }}>
        <input
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="用户名"
          autoComplete="username"
          required
        />
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="密码"
          autoComplete="current-password"
          required
        />
        <button type="submit" className="pm-primary-button" disabled={submitting}>
          {submitting ? "登录中..." : "登录"}
        </button>
      </form>
      <p role="status" style={{ color: "var(--pm-muted)" }}>
        {feedback}
      </p>
    </main>
  );
}
