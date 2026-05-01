"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BackHomeLink } from "../../_shared/back-home-link.jsx";

function adminHeaders() {
  return {
    "content-type": "application/json",
  };
}

function buildAdminPromptsUrl(filters) {
  const params = new URLSearchParams();
  if (filters.status) {
    params.set("status", filters.status);
  }
  if (filters.category) {
    params.set("category", filters.category);
  }
  if (filters.keyword.trim()) {
    params.set("keyword", filters.keyword.trim());
  }
  return `/api/admin/prompts?${params.toString()}`;
}

function normalizeCategories(payload) {
  return Array.isArray(payload?.categories) ? payload.categories : [];
}

function normalizePrompts(payload) {
  return Array.isArray(payload?.prompts) ? payload.prompts : [];
}

async function fetchAdminCategories() {
  const response = await fetch("/api/admin/categories", {
    method: "GET",
    credentials: "same-origin",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      typeof payload.error === "string" && payload.error.length > 0
        ? payload.error
        : "加载分类失败",
    );
  }
  return normalizeCategories(payload);
}

async function fetchAdminPromptBySlug(slug) {
  const response = await fetch(
    buildAdminPromptsUrl({
      status: "",
      category: "",
      keyword: slug,
    }),
    {
      method: "GET",
      credentials: "same-origin",
    },
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      typeof payload.error === "string" && payload.error.length > 0
        ? payload.error
        : "加载提示词失败",
    );
  }

  const prompts = normalizePrompts(payload);
  return prompts.find((item) => item.slug === slug) ?? null;
}

async function savePromptCategories(slug, input) {
  const response = await fetch(`/api/admin/prompts/${slug}`, {
    method: "PATCH",
    headers: adminHeaders(),
    body: JSON.stringify(input),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      typeof payload.error === "string" && payload.error.length > 0
        ? payload.error
        : "保存分类失败",
    );
  }
  return payload?.prompt ?? null;
}

async function previewDeletePrompt(slug) {
  const response = await fetch(`/api/admin/prompts/${slug}/delete`, {
    method: "DELETE",
    headers: adminHeaders(),
    body: JSON.stringify({ confirm: false }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      typeof payload.error === "string" && payload.error.length > 0
        ? payload.error
        : "删除预检查失败",
    );
  }
  return payload;
}

async function confirmDeletePrompt(slug, confirmationToken) {
  const response = await fetch(`/api/admin/prompts/${slug}/delete`, {
    method: "DELETE",
    headers: adminHeaders(),
    body: JSON.stringify({
      confirm: true,
      confirmationToken,
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      typeof payload.error === "string" && payload.error.length > 0
        ? payload.error
        : "删除提示词失败",
    );
  }
  return payload;
}

function toManualSelection(prompt) {
  if (!prompt || !Array.isArray(prompt.categorySlugs)) {
    return [];
  }
  return prompt.categorySlugs.filter((slug) => slug !== "uncategorized");
}

function getPromptStatusLabel(status) {
  if (status === "archived") {
    return "已归档";
  }
  if (status === "draft") {
    return "草稿";
  }
  return "已发布";
}

function getPromptStatusClassName(status) {
  if (status === "archived") {
    return "archived";
  }
  if (status === "draft") {
    return "draft";
  }
  return "published";
}

export function AdminPromptManagementDetail({ slug }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [prompt, setPrompt] = useState(null);
  const [categories, setCategories] = useState([]);
  const [selectedCategorySlugs, setSelectedCategorySlugs] = useState([]);
  const [primaryCategorySlug, setPrimaryCategorySlug] = useState("");
  const [deletePreview, setDeletePreview] = useState(null);
  const [feedback, setFeedback] = useState("可在这里调整分类，并在删除前查看影响范围。");

  useEffect(() => {
    let disposed = false;

    async function loadData() {
      setLoading(true);
      try {
        const [nextCategories, nextPrompt] = await Promise.all([
          fetchAdminCategories(),
          fetchAdminPromptBySlug(slug),
        ]);
        if (disposed) {
          return;
        }

        setCategories(nextCategories);
        setPrompt(nextPrompt);
        const nextSelectedCategorySlugs = toManualSelection(nextPrompt);
        setSelectedCategorySlugs(nextSelectedCategorySlugs);
        setPrimaryCategorySlug(
          nextSelectedCategorySlugs.includes(nextPrompt?.category?.slug)
            ? nextPrompt.category.slug
            : nextSelectedCategorySlugs[0] ?? "",
        );
      } catch (error) {
        if (disposed) {
          return;
        }
        const message = error instanceof Error ? error.message : "加载失败";
        setFeedback(`加载失败：${message}`);
      } finally {
        if (!disposed) {
          setLoading(false);
        }
      }
    }

    void loadData();
    return () => {
      disposed = true;
    };
  }, [slug]);

  const selectableCategories = useMemo(
    () => categories.filter((item) => item.isSelectable !== false && !item.isSystem),
    [categories],
  );

  function toggleCategory(categorySlug) {
    setSelectedCategorySlugs((current) => {
      if (current.includes(categorySlug)) {
        const next = current.filter((item) => item !== categorySlug);
        if (!next.includes(primaryCategorySlug)) {
          setPrimaryCategorySlug(next[0] ?? "");
        }
        return next;
      }

      const next = [...current, categorySlug];
      if (!primaryCategorySlug) {
        setPrimaryCategorySlug(categorySlug);
      }
      return next;
    });
  }

  async function handleSaveCategories(event) {
    event.preventDefault();
    if (saving) {
      return;
    }

    if (selectedCategorySlugs.length === 0 || !primaryCategorySlug) {
      setFeedback("保存失败：请至少选择一个正式分类，并指定主分类。");
      return;
    }

    setSaving(true);
    setFeedback(`正在更新 ${prompt?.title ?? slug} 的分类...`);
    try {
      const updatedPrompt = await savePromptCategories(slug, {
        categorySlugs: selectedCategorySlugs,
        primaryCategorySlug,
      });
      setPrompt(updatedPrompt);
      const nextSelectedCategorySlugs = toManualSelection(updatedPrompt);
      setSelectedCategorySlugs(nextSelectedCategorySlugs);
      setPrimaryCategorySlug(updatedPrompt?.category?.slug ?? nextSelectedCategorySlugs[0] ?? "");
      setDeletePreview(null);
      setFeedback(`已更新 ${updatedPrompt?.title ?? slug} 的分类`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "保存分类失败";
      setFeedback(`保存分类失败：${message}`);
    } finally {
      setSaving(false);
    }
  }

  async function handlePreviewDelete() {
    if (deleteSubmitting) {
      return;
    }

    setDeleteSubmitting(true);
    setFeedback(`正在加载 ${prompt?.title ?? slug} 的删除预检查...`);
    try {
      const preview = await previewDeletePrompt(slug);
      setDeletePreview(preview);
      setFeedback(`已加载 ${prompt?.title ?? slug} 的删除预检查`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "删除预检查失败";
      setFeedback(`删除预检查失败：${message}`);
    } finally {
      setDeleteSubmitting(false);
    }
  }

  async function handleConfirmDelete() {
    if (!deletePreview?.confirmationToken || deleteSubmitting) {
      return;
    }

    setDeleteSubmitting(true);
    setFeedback(`正在删除 ${prompt?.title ?? slug}...`);
    try {
      await confirmDeletePrompt(slug, deletePreview.confirmationToken);
      setFeedback(`已删除提示词 ${prompt?.title ?? slug}`);
      router.push("/admin/prompts");
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "删除提示词失败";
      setFeedback(`删除提示词失败：${message}`);
    } finally {
      setDeleteSubmitting(false);
    }
  }

  return (
    <main
      style={{
        maxWidth: "980px",
        margin: "0 auto",
        padding: "24px",
        display: "grid",
        gap: "16px",
      }}
    >
      <BackHomeLink />

      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <a className="pm-secondary-button pm-button-link" href="/admin">
          返回审核台
        </a>
        <a className="pm-secondary-button pm-button-link" href="/admin/prompts">
          返回提示词管理
        </a>
      </div>

      <header className="pm-card" style={{ display: "grid", gap: "10px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "grid", gap: "6px" }}>
            <h1 className="pm-page-title" style={{ margin: 0 }}>
              管理提示词
            </h1>
            {prompt ? (
              <>
                <h2 style={{ margin: 0, fontSize: "20px", color: "var(--pm-title)" }}>
                  {prompt.title}
                </h2>
                <p style={{ margin: 0, color: "var(--pm-muted)" }}>{prompt.summary}</p>
              </>
            ) : (
              <p style={{ margin: 0, color: "var(--pm-muted)" }}>slug: {slug}</p>
            )}
          </div>

          {prompt ? (
            <span className={`pm-status-chip ${getPromptStatusClassName(prompt.status)}`}>
              {getPromptStatusLabel(prompt.status)}
            </span>
          ) : null}
        </div>

        <p
          role="status"
          aria-live="polite"
          style={{ margin: 0, color: "var(--pm-muted)", fontSize: "14px" }}
        >
          {feedback}
        </p>
      </header>

      {loading ? (
        <section className="pm-card">
          <p style={{ margin: 0, color: "var(--pm-muted)" }}>提示词加载中...</p>
        </section>
      ) : !prompt ? (
        <section className="pm-card">
          <h2 style={{ margin: 0, fontSize: "18px" }}>未找到提示词</h2>
          <p style={{ margin: "8px 0 0 0", color: "var(--pm-muted)" }}>
            当前 slug 没有匹配结果，可能已被删除或不存在。
          </p>
        </section>
      ) : (
        <>
          <section className="pm-card" style={{ display: "grid", gap: "12px" }}>
            <div style={{ display: "grid", gap: "6px" }}>
              <strong>当前分类</strong>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {prompt.categories.map((category) => (
                  <span
                    key={category.slug}
                    data-testid={`prompt-category-pill-${category.slug}`}
                    className="pm-category-pill"
                  >
                    {category.name}
                  </span>
                ))}
              </div>
            </div>

            <form style={{ display: "grid", gap: "14px" }} onSubmit={handleSaveCategories}>
              <fieldset
                style={{
                  border: "1px solid var(--pm-border)",
                  borderRadius: "8px",
                  padding: "12px",
                  display: "grid",
                  gap: "10px",
                }}
              >
                <legend style={{ padding: "0 6px" }}>补正式分类</legend>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 14px" }}>
                  {selectableCategories.map((category) => (
                    <label
                      key={category.slug}
                      style={{ display: "flex", alignItems: "center", gap: "6px" }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedCategorySlugs.includes(category.slug)}
                        onChange={() => toggleCategory(category.slug)}
                      />
                      <span>{category.name}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <label style={{ display: "grid", gap: "6px", maxWidth: "320px" }}>
                <span>主分类</span>
                <select
                  aria-label="主分类"
                  value={primaryCategorySlug}
                  onChange={(event) => setPrimaryCategorySlug(event.target.value)}
                >
                  <option value="">请选择主分类</option>
                  {selectableCategories
                    .filter((category) => selectedCategorySlugs.includes(category.slug))
                    .map((category) => (
                      <option key={category.slug} value={category.slug}>
                        {category.name}
                      </option>
                    ))}
                </select>
              </label>

              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <button type="submit" className="pm-primary-button" disabled={saving}>
                  {saving ? "保存中..." : "保存分类"}
                </button>
                <button
                  type="button"
                  className="pm-secondary-button"
                  disabled={deleteSubmitting}
                  onClick={handlePreviewDelete}
                >
                  {deleteSubmitting ? "预检查中..." : "删除预检查"}
                </button>
              </div>
            </form>
          </section>

          {deletePreview ? (
            <section
              className="pm-card"
              style={{
                border: "1px solid #f59e0b",
                backgroundColor: "#fffbeb",
                display: "grid",
                gap: "8px",
              }}
            >
              <h2 style={{ margin: 0, fontSize: "18px" }}>删除影响预检查</h2>
              <p style={{ margin: 0, color: "var(--pm-muted)" }}>
                关联版本：{deletePreview.relatedCounts?.versions ?? 0}
              </p>
              <p style={{ margin: 0, color: "var(--pm-muted)" }}>
                投稿记录：{deletePreview.relatedCounts?.submissions ?? 0}
              </p>
              <p style={{ margin: 0, color: "var(--pm-muted)" }}>
                Prompt 收藏：{deletePreview.relatedCounts?.likes ?? 0}
              </p>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="pm-primary-button"
                  disabled={deleteSubmitting}
                  onClick={handleConfirmDelete}
                >
                  {deleteSubmitting ? "删除中..." : "确认删除提示词"}
                </button>
                <button
                  type="button"
                  className="pm-secondary-button"
                  disabled={deleteSubmitting}
                  onClick={() => setDeletePreview(null)}
                >
                  取消
                </button>
              </div>
            </section>
          ) : null}
        </>
      )}
    </main>
  );
}
