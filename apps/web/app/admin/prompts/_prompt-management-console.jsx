"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

async function fetchAdminPrompts(filters) {
  const response = await fetch(buildAdminPromptsUrl(filters), {
    method: "GET",
    credentials: "same-origin",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      typeof payload.error === "string" && payload.error.length > 0
        ? payload.error
        : "加载提示词失败",
    );
  }
  return normalizePrompts(payload);
}

async function mutatePromptStatus(slug, action) {
  const response = await fetch(`/api/admin/prompts/${slug}/${action}`, {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify({}),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      typeof payload.error === "string" && payload.error.length > 0
        ? payload.error
        : action === "archive"
          ? "归档失败"
          : "恢复失败",
    );
  }
  return payload?.prompt ?? null;
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

function formatUpdatedAt(input) {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    return "时间未知";
  }

  return date.toLocaleString("zh-CN", {
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const INITIAL_FILTERS = {
  status: "",
  category: "",
  keyword: "",
};

export function AdminPromptManagementConsole() {
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [categories, setCategories] = useState([]);
  const [prompts, setPrompts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busySlug, setBusySlug] = useState("");
  const [feedback, setFeedback] = useState("可在这里管理已发布/已归档提示词，并进入详情页重分类。");
  const filtersRef = useRef(filters);
  const latestPromptsRequestIdRef = useRef(0);

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  useEffect(() => {
    let disposed = false;
    const requestId = latestPromptsRequestIdRef.current + 1;
    latestPromptsRequestIdRef.current = requestId;

    async function loadData() {
      setLoading(true);
      try {
        const [nextCategories, nextPrompts] = await Promise.all([
          fetchAdminCategories(),
          fetchAdminPrompts(filters),
        ]);
        if (disposed || requestId !== latestPromptsRequestIdRef.current) {
          return;
        }
        setCategories(nextCategories);
        setPrompts(nextPrompts);
      } catch (error) {
        if (disposed || requestId !== latestPromptsRequestIdRef.current) {
          return;
        }
        const message = error instanceof Error ? error.message : "加载失败";
        setFeedback(`加载失败：${message}`);
      } finally {
        if (!disposed && requestId === latestPromptsRequestIdRef.current) {
          setLoading(false);
        }
      }
    }

    void loadData();
    return () => {
      disposed = true;
    };
  }, [filters]);

  const selectableCategories = useMemo(
    () => categories.filter((item) => item.isSelectable !== false && !item.isSystem),
    [categories],
  );

  async function handleStatusAction(prompt, action) {
    if (busySlug) {
      return;
    }

    setBusySlug(prompt.slug);
    setFeedback(
      action === "archive"
        ? `正在归档 ${prompt.title}...`
        : `正在恢复发布 ${prompt.title}...`,
    );

    try {
      await mutatePromptStatus(prompt.slug, action);
      const requestId = latestPromptsRequestIdRef.current + 1;
      latestPromptsRequestIdRef.current = requestId;
      const nextPrompts = await fetchAdminPrompts(filtersRef.current);
      if (requestId !== latestPromptsRequestIdRef.current) {
        return;
      }
      setPrompts(nextPrompts);
      setFeedback(
        action === "archive"
          ? `已归档 ${prompt.title}`
          : `已恢复发布 ${prompt.title}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "请求失败";
      setFeedback(
        action === "archive"
          ? `${prompt.title} 归档失败：${message}`
          : `${prompt.title} 恢复失败：${message}`,
      );
    } finally {
      setBusySlug("");
    }
  }

  return (
    <main
      style={{
        maxWidth: "1180px",
        margin: "0 auto",
        padding: "24px",
        display: "grid",
        gap: "16px",
      }}
    >
      <BackHomeLink />

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
              提示词管理
            </h1>
            <p style={{ margin: 0, color: "var(--pm-muted)" }}>
              当前结果：{prompts.length} 条
            </p>
          </div>

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <a className="pm-secondary-button pm-button-link" href="/admin">
              返回审核台
            </a>
            <a className="pm-primary-button pm-button-link" href="/admin/create">
              创建提示词
            </a>
          </div>
        </div>

        <p
          role="status"
          aria-live="polite"
          style={{ margin: 0, color: "var(--pm-muted)", fontSize: "14px" }}
        >
          {feedback}
        </p>
      </header>

      <section className="pm-card" style={{ display: "grid", gap: "12px" }}>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button
            type="button"
            className={`pm-secondary-button ${filters.status === "" ? "pm-filter-button-active" : ""}`}
            onClick={() => setFilters((current) => ({ ...current, status: "" }))}
          >
            全部状态
          </button>
          <button
            type="button"
            className={`pm-secondary-button ${filters.status === "published" ? "pm-filter-button-active" : ""}`}
            onClick={() => setFilters((current) => ({ ...current, status: "published" }))}
          >
            仅看已发布
          </button>
          <button
            type="button"
            className={`pm-secondary-button ${filters.status === "archived" ? "pm-filter-button-active" : ""}`}
            onClick={() => setFilters((current) => ({ ...current, status: "archived" }))}
          >
            仅看已归档
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)",
            gap: "10px",
          }}
        >
          <label style={{ display: "grid", gap: "6px" }}>
            <span style={{ fontSize: "13px", color: "var(--pm-muted)" }}>关键词</span>
            <input
              aria-label="关键词"
              value={filters.keyword}
              onChange={(event) =>
                setFilters((current) => ({ ...current, keyword: event.target.value }))
              }
              placeholder="按标题、slug、摘要搜索"
            />
          </label>

          <label style={{ display: "grid", gap: "6px" }}>
            <span style={{ fontSize: "13px", color: "var(--pm-muted)" }}>分类</span>
            <select
              aria-label="分类"
              value={filters.category}
              onChange={(event) =>
                setFilters((current) => ({ ...current, category: event.target.value }))
              }
            >
              <option value="">全部分类</option>
              {selectableCategories.map((category) => (
                <option key={category.slug} value={category.slug}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {loading ? (
        <section className="pm-card">
          <p style={{ margin: 0, color: "var(--pm-muted)" }}>提示词加载中...</p>
        </section>
      ) : prompts.length === 0 ? (
        <section className="pm-card">
          <h2 style={{ margin: 0, fontSize: "18px" }}>当前筛选下没有提示词</h2>
          <p style={{ margin: "8px 0 0 0", color: "var(--pm-muted)" }}>
            可以切换状态、分类或关键词继续查看。
          </p>
        </section>
      ) : (
        <section style={{ display: "grid", gap: "12px" }}>
          {prompts.map((prompt) => {
            const actionLabel =
              prompt.status === "archived" ? "恢复发布" : prompt.status === "published" ? "归档" : "";
            const isBusy = busySlug === prompt.slug;

            return (
              <article
                key={prompt.slug}
                data-testid={`admin-prompts-row-${prompt.slug}`}
                className="pm-card"
                style={{ display: "grid", gap: "12px" }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: "12px",
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ display: "grid", gap: "6px", minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        flexWrap: "wrap",
                      }}
                    >
                      <h2 style={{ margin: 0, fontSize: "18px", color: "var(--pm-title)" }}>
                        {prompt.title}
                      </h2>
                      <span className={`pm-status-chip ${getPromptStatusClassName(prompt.status)}`}>
                        {getPromptStatusLabel(prompt.status)}
                      </span>
                    </div>
                    <p style={{ margin: 0, color: "var(--pm-muted)" }}>{prompt.summary}</p>
                    <p style={{ margin: 0, fontSize: "13px", color: "var(--pm-muted)" }}>
                      slug: {prompt.slug} · 最近更新：{formatUpdatedAt(prompt.updatedAt)}
                    </p>
                  </div>

                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    <a
                      className="pm-secondary-button pm-button-link"
                      href={`/admin/prompts/${prompt.slug}`}
                    >
                      管理
                    </a>
                    {actionLabel ? (
                      <button
                        type="button"
                        className={prompt.status === "archived" ? "pm-primary-button" : "pm-secondary-button"}
                        disabled={isBusy}
                        onClick={() =>
                          handleStatusAction(
                            prompt,
                            prompt.status === "archived" ? "restore" : "archive",
                          )
                        }
                      >
                        {isBusy
                          ? prompt.status === "archived"
                            ? "恢复中..."
                            : "归档中..."
                          : actionLabel}
                      </button>
                    ) : null}
                  </div>
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {prompt.categories.map((category) => (
                    <span
                      key={`${prompt.slug}-${category.slug}`}
                      className="pm-category-pill"
                    >
                      {category.name}
                    </span>
                  ))}
                </div>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}
