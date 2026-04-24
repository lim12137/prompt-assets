"use client";

import { useEffect, useState } from "react";

const ADMIN_EMAIL = "admin@example.com";
const ADMIN_ROLE = "admin";

const INITIAL_FORM = {
  title: "",
  summary: "",
  content: "",
};

export default function AdminCreatePromptPage() {
  const [form, setForm] = useState(INITIAL_FORM);
  const [categories, setCategories] = useState([]);
  const [selectedCategorySlugs, setSelectedCategorySlugs] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState("请填写提示词信息并提交创建。");

  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  useEffect(() => {
    async function loadCategories() {
      setCategoriesLoading(true);
      try {
        const response = await fetch("/api/admin/categories", {
          headers: {
            "x-user-email": ADMIN_EMAIL,
            "x-user-role": ADMIN_ROLE,
          },
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(
            typeof payload.error === "string" && payload.error.length > 0
              ? payload.error
              : "分类加载失败",
          );
        }

        const items = Array.isArray(payload.categories) ? payload.categories : [];
        setCategories(items);
      } catch (error) {
        const message = error instanceof Error ? error.message : "分类加载失败";
        setFeedback(`分类加载失败：${message}`);
      } finally {
        setCategoriesLoading(false);
      }
    }

    void loadCategories();
  }, []);

  function toggleCategory(categorySlug) {
    setSelectedCategorySlugs((current) => {
      if (current.includes(categorySlug)) {
        return current.filter((item) => item !== categorySlug);
      }
      return [...current, categorySlug];
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) {
      return;
    }

    if (selectedCategorySlugs.length === 0) {
      setFeedback("创建失败：请至少选择一个分类。");
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
        body: JSON.stringify({
          ...form,
          categorySlugs: selectedCategorySlugs,
        }),
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
      const title = typeof prompt.title === "string" ? prompt.title : form.title;
      const versionNo =
        typeof prompt?.currentVersion?.versionNo === "string"
          ? prompt.currentVersion.versionNo
          : "v0001";
      setFeedback(`已创建《${title}》，当前版本 ${versionNo}。`);
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
          <span>摘要</span>
          <input
            value={form.summary}
            onChange={(event) => updateField("summary", event.target.value)}
            required
          />
        </label>

        <fieldset
          aria-label="分类（可多选）"
          style={{
            border: "1px solid var(--pm-border)",
            borderRadius: "8px",
            padding: "10px 12px",
            display: "grid",
            gap: "8px",
          }}
        >
          <legend style={{ padding: "0 6px" }}>分类（可多选）</legend>
          {categoriesLoading ? (
            <p style={{ margin: 0, color: "var(--pm-muted)" }}>分类加载中...</p>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 14px" }}>
              {categories.map((category) => {
                const disabled = category.isSystem || category.isSelectable === false;
                return (
                  <label
                    key={category.slug}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      color: disabled ? "var(--pm-muted)" : "inherit",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedCategorySlugs.includes(category.slug)}
                      disabled={disabled}
                      onChange={() => toggleCategory(category.slug)}
                    />
                    <span>{category.name}</span>
                  </label>
                );
              })}
            </div>
          )}
        </fieldset>

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
