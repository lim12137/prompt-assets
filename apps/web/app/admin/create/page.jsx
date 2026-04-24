"use client";

import { useState } from "react";

const ADMIN_EMAIL = "admin@example.com";
const ADMIN_ROLE = "admin";

const INITIAL_FORM = {
  title: "",
  slug: "",
  summary: "",
  categorySlug: "",
  content: "",
};

export default function AdminCreatePromptPage() {
  const [form, setForm] = useState(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState("请填写提示词信息并提交创建。");

  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) {
      return;
    }

    setSubmitting(true);
    setFeedback("创建请求提交中...");

    try {
      const response = await fetch("/api/prompts", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-user-email": ADMIN_EMAIL,
          "x-user-role": ADMIN_ROLE,
        },
        body: JSON.stringify(form),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message =
          typeof payload.error === "string" && payload.error.length > 0
            ? payload.error
            : "请求失败";
        throw new Error(message);
      }

      const prompt = payload.prompt ?? {};
      const slug = typeof prompt.slug === "string" ? prompt.slug : "";
      const versionNo =
        typeof prompt?.currentVersion?.versionNo === "string"
          ? prompt.currentVersion.versionNo
          : "v0001";
      setFeedback(`已创建 ${slug}，当前版本 ${versionNo}。`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "请求失败";
      setFeedback(`创建失败：${message}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main
      style={{
        maxWidth: "960px",
        margin: "0 auto",
        padding: "24px",
        display: "grid",
        gap: "16px",
      }}
    >
      <header className="pm-card" style={{ display: "grid", gap: "8px" }}>
        <h1 className="pm-page-title" style={{ margin: 0 }}>
          创建提示词
        </h1>
        <p style={{ margin: 0, color: "var(--pm-muted)" }}>
          创建全新 Prompt 的首个官方版本（v0001）。
        </p>
        <div style={{ display: "flex", gap: "8px" }}>
          <a className="pm-secondary-button pm-button-link" href="/admin">
            返回管理页
          </a>
          <a className="pm-secondary-button pm-button-link" href="/admin/import">
            去批量导入
          </a>
        </div>
      </header>

      <form className="pm-card" style={{ display: "grid", gap: "12px" }} onSubmit={handleSubmit}>
        <label style={{ display: "grid", gap: "6px" }}>
          <span>标题</span>
          <input
            value={form.title}
            onChange={(event) => updateField("title", event.target.value)}
            required
          />
        </label>

        <label style={{ display: "grid", gap: "6px" }}>
          <span>Slug</span>
          <input
            value={form.slug}
            onChange={(event) => updateField("slug", event.target.value)}
            required
          />
        </label>

        <label style={{ display: "grid", gap: "6px" }}>
          <span>摘要</span>
          <input
            value={form.summary}
            onChange={(event) => updateField("summary", event.target.value)}
            required
          />
        </label>

        <label style={{ display: "grid", gap: "6px" }}>
          <span>分类 Slug</span>
          <input
            value={form.categorySlug}
            onChange={(event) => updateField("categorySlug", event.target.value)}
            required
          />
        </label>

        <label style={{ display: "grid", gap: "6px" }}>
          <span>内容</span>
          <textarea
            value={form.content}
            onChange={(event) => updateField("content", event.target.value)}
            rows={10}
            required
          />
        </label>

        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button type="submit" className="pm-primary-button" disabled={submitting}>
            {submitting ? "提交中..." : "提交创建"}
          </button>
          <p role="status" aria-live="polite" style={{ margin: 0, color: "var(--pm-muted)" }}>
            {feedback}
          </p>
        </div>
      </form>
    </main>
  );
}
