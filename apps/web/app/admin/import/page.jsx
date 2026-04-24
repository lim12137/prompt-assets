"use client";

import { useState } from "react";

const ADMIN_EMAIL = "admin@example.com";
const ADMIN_ROLE = "admin";

const DEFAULT_IMPORT_SAMPLE = JSON.stringify(
  [
    {
      title: "导入示例标题",
      slug: "import-sample-slug",
      summary: "导入示例摘要",
      categorySlug: "programming",
      content: "你是助手，请输出结构化结果。",
    },
  ],
  null,
  2,
);

export default function AdminImportPromptPage() {
  const [jsonText, setJsonText] = useState(DEFAULT_IMPORT_SAMPLE);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState("请粘贴待导入的 JSON 数组。");

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) {
      return;
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonText);
    } catch (error) {
      const message = error instanceof Error ? error.message : "invalid json";
      setFeedback(`JSON 解析失败：${message}`);
      return;
    }

    setSubmitting(true);
    setFeedback("导入请求提交中...");

    try {
      const response = await fetch("/api/admin/prompts/import", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-user-email": ADMIN_EMAIL,
          "x-user-role": ADMIN_ROLE,
        },
        body: JSON.stringify(parsed),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message =
          typeof payload.error === "string" && payload.error.length > 0
            ? payload.error
            : "请求失败";
        throw new Error(message);
      }

      const total = typeof payload.total === "number" ? payload.total : 0;
      const slugs = Array.isArray(payload.prompts)
        ? payload.prompts
            .map((item) => (typeof item?.slug === "string" ? item.slug : ""))
            .filter(Boolean)
            .join(", ")
        : "";
      setFeedback(`导入成功：共 ${total} 条。${slugs ? `已导入 ${slugs}` : ""}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "请求失败";
      setFeedback(`导入失败：${message}`);
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
          批量导入提示词
        </h1>
        <p style={{ margin: 0, color: "var(--pm-muted)" }}>
          使用 JSON 数组批量创建首版 Prompt（全有或全无）。
        </p>
        <div style={{ display: "flex", gap: "8px" }}>
          <a className="pm-secondary-button pm-button-link" href="/admin">
            返回管理页
          </a>
          <a className="pm-secondary-button pm-button-link" href="/admin/create">
            去创建提示词
          </a>
        </div>
      </header>

      <form className="pm-card" style={{ display: "grid", gap: "12px" }} onSubmit={handleSubmit}>
        <label style={{ display: "grid", gap: "6px" }}>
          <span>JSON 内容</span>
          <textarea
            value={jsonText}
            onChange={(event) => setJsonText(event.target.value)}
            rows={16}
            required
          />
        </label>

        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button type="submit" className="pm-primary-button" disabled={submitting}>
            {submitting ? "提交中..." : "提交导入"}
          </button>
          <p role="status" aria-live="polite" style={{ margin: 0, color: "var(--pm-muted)" }}>
            {feedback}
          </p>
        </div>
      </form>
    </main>
  );
}
