"use client";

import { useState } from "react";

const ADMIN_EMAIL = "admin@example.com";
const ADMIN_ROLE = "admin";

const DEFAULT_IMPORT_SAMPLE = JSON.stringify(
  [
    {
      title: "导入示例标题",
      summary: "导入示例摘要",
      categorySlugs: ["programming", "design"],
      content: "你是助手，请输出结构化结果。",
    },
  ],
  null,
  2,
);

function validateImportItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return "导入内容必须为非空数组。";
  }

  for (const item of items) {
    if (!item || typeof item !== "object") {
      return "每个导入项都必须是对象。";
    }
    const record = item;
    if (
      !Array.isArray(record.categorySlugs) ||
      record.categorySlugs.length === 0 ||
      record.categorySlugs.some((slug) => typeof slug !== "string" || !slug.trim())
    ) {
      return "categorySlugs 必须为非空数组。";
    }

    const normalized = record.categorySlugs.map((slug) => slug.trim().toLowerCase());
    if (normalized.includes("uncategorized")) {
      return "待分类不能手动选择。";
    }
  }

  return null;
}

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

    const validationError = validateImportItems(parsed);
    if (validationError) {
      setFeedback(`导入失败：${validationError}`);
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
      const titles = Array.isArray(payload.prompts)
        ? payload.prompts
            .map((item) => (typeof item?.title === "string" ? item.title : ""))
            .filter(Boolean)
            .join("、")
        : "";
      setFeedback(`导入成功：共 ${total} 条。${titles ? `已导入 ${titles}` : ""}`);
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
