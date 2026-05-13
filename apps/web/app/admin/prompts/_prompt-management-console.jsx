"use client";

import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { BackHomeLink } from "../../_shared/back-home-link.jsx";
import { notifyNavigationStart } from "../../_shared/navigation-feedback.js";

const INTERACTIVE_SELECTOR =
  "a,button,input,textarea,select,summary,label,[role='button'],[data-interactive='true']";

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

function doesPromptMatchFilters(prompt, filters) {
  if (filters.status && prompt.status !== filters.status) {
    return false;
  }
  if (filters.category && !prompt.categorySlugs.includes(filters.category)) {
    return false;
  }
  const keyword = filters.keyword.trim().toLowerCase();
  if (!keyword) {
    return true;
  }
  return (
    prompt.slug.toLowerCase().includes(keyword) ||
    prompt.title.toLowerCase().includes(keyword) ||
    prompt.summary.toLowerCase().includes(keyword)
  );
}

function mergeUpdatedPromptsIntoList(currentPrompts, updatedPrompts, filters) {
  const updatedBySlug = new Map(updatedPrompts.map((prompt) => [prompt.slug, prompt]));
  return currentPrompts.flatMap((prompt) => {
    const updatedPrompt = updatedBySlug.get(prompt.slug);
    if (!updatedPrompt) {
      return [prompt];
    }
    return doesPromptMatchFilters(updatedPrompt, filters) ? [updatedPrompt] : [];
  });
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

async function mutatePromptsBatchCategories({
  slugs,
  addCategorySlugs = [],
  removeCategorySlugs = [],
}) {
  const response = await fetch("/api/admin/prompts/batch-categories", {
    method: "PATCH",
    headers: adminHeaders(),
    body: JSON.stringify({
      slugs,
      addCategorySlugs,
      removeCategorySlugs,
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      typeof payload.error === "string" && payload.error.length > 0
        ? payload.error
        : "批量分类更新失败",
    );
  }
  return Array.isArray(payload?.prompts) ? payload.prompts : [];
}

async function previewDeletePromptsBatch(slugs) {
  const response = await fetch("/api/admin/prompts/batch-delete", {
    method: "DELETE",
    headers: adminHeaders(),
    body: JSON.stringify({
      slugs,
      dryRun: true,
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      typeof payload.error === "string" && payload.error.length > 0
        ? payload.error
        : "批量删除预检查失败",
    );
  }
  return payload;
}

async function confirmDeletePromptsBatch(slugs, confirmationToken) {
  const response = await fetch("/api/admin/prompts/batch-delete", {
    method: "DELETE",
    headers: adminHeaders(),
    body: JSON.stringify({
      slugs,
      confirm: true,
      confirmationToken,
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      typeof payload.error === "string" && payload.error.length > 0
        ? payload.error
        : "批量删除提示词失败",
    );
  }
  return payload;
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

function isInteractiveTarget(target) {
  if (!(target instanceof Element)) {
    return false;
  }
  return Boolean(target.closest(INTERACTIVE_SELECTOR));
}

function createRowClickHandler(slug, router) {
  return function handleRowClick(event) {
    if (isInteractiveTarget(event.target)) {
      return;
    }
    notifyNavigationStart();
    router.push(`/admin/prompts/${slug}`);
  };
}

function createRowKeyDownHandler(slug, router) {
  return function handleRowKeyDown(event) {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }
    if (isInteractiveTarget(event.target)) {
      return;
    }
    event.preventDefault();
    notifyNavigationStart();
    router.push(`/admin/prompts/${slug}`);
  };
}

export function AdminPromptManagementConsole() {
  const router = useRouter();
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [categories, setCategories] = useState([]);
  const [prompts, setPrompts] = useState([]);
  const [selectedPromptSlugs, setSelectedPromptSlugs] = useState([]);
  const [bulkActionBarHeight, setBulkActionBarHeight] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busySlug, setBusySlug] = useState("");
  const [bulkActionType, setBulkActionType] = useState("");
  const [bulkCategorySlugs, setBulkCategorySlugs] = useState([]);
  const [bulkDeletePreview, setBulkDeletePreview] = useState(null);
  const [bulkMutating, setBulkMutating] = useState(false);
  const [feedback, setFeedback] = useState("可在这里管理已发布/已归档提示词，并进入详情页重分类。");
  const filtersRef = useRef(filters);
  const bulkActionBarRef = useRef(null);
  const latestPromptsRequestIdRef = useRef(0);
  const latestBulkDeletePreviewRequestIdRef = useRef(0);

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
  const visiblePromptSlugs = useMemo(() => prompts.map((prompt) => prompt.slug), [prompts]);
  const selectedCount = selectedPromptSlugs.length;

  useLayoutEffect(() => {
    if (selectedCount === 0) {
      setBulkActionBarHeight(0);
      return undefined;
    }

    const element = bulkActionBarRef.current;
    if (!(element instanceof HTMLElement)) {
      return undefined;
    }

    const measure = () => {
      setBulkActionBarHeight(Math.ceil(element.getBoundingClientRect().height));
    };

    measure();

    if (typeof ResizeObserver === "undefined") {
      return undefined;
    }

    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [selectedCount]);

  useEffect(() => {
    setSelectedPromptSlugs((current) =>
      current.filter((slug) => prompts.some((prompt) => prompt.slug === slug)),
    );
  }, [prompts]);

  function handleTogglePromptSelection(slug, checked) {
    setSelectedPromptSlugs((current) => {
      if (checked) {
        if (current.includes(slug)) {
          return current;
        }
        return [...current, slug];
      }
      return current.filter((item) => item !== slug);
    });
  }

  function handleOpenBulkAction(type) {
    if (bulkMutating) {
      return;
    }
    setBulkActionType(type);
    setBulkCategorySlugs([]);
    setBulkDeletePreview(null);
  }

  async function handleOpenBulkDeletePrompt() {
    if (bulkMutating || selectedPromptSlugs.length === 0) {
      return;
    }
    const selectedSlugsAtSubmit = [...selectedPromptSlugs];
    const requestId = latestBulkDeletePreviewRequestIdRef.current + 1;
    latestBulkDeletePreviewRequestIdRef.current = requestId;
    setBulkActionType("delete-prompts");
    setBulkDeletePreview(null);
    setBulkMutating(true);
    setFeedback(`正在批量删除预检查（${selectedSlugsAtSubmit.length} 项）...`);
    try {
      const preview = await previewDeletePromptsBatch(selectedSlugsAtSubmit);
      if (requestId !== latestBulkDeletePreviewRequestIdRef.current) {
        return;
      }
      setBulkDeletePreview(preview);
      setFeedback(`批量删除预检查完成（${selectedSlugsAtSubmit.length} 项）`);
    } catch (error) {
      if (requestId !== latestBulkDeletePreviewRequestIdRef.current) {
        return;
      }
      const message = error instanceof Error ? error.message : "请求失败";
      setBulkActionType("");
      setBulkDeletePreview(null);
      setFeedback(`批量删除预检查失败：${message}`);
    } finally {
      if (requestId === latestBulkDeletePreviewRequestIdRef.current) {
        setBulkMutating(false);
      }
    }
  }

  function handleSelectAllVisiblePrompts() {
    setSelectedPromptSlugs(visiblePromptSlugs);
  }

  function handleInvertVisiblePrompts() {
    setSelectedPromptSlugs((current) => {
      const currentSet = new Set(current);
      return visiblePromptSlugs.filter((slug) => !currentSet.has(slug));
    });
  }

  function handleToggleBulkCategory(slug, checked) {
    setBulkCategorySlugs((current) => {
      if (checked) {
        if (current.includes(slug)) {
          return current;
        }
        return [...current, slug];
      }
      return current.filter((item) => item !== slug);
    });
  }

  async function handleSubmitBulkAction() {
    if (
      bulkMutating ||
      !bulkActionType ||
      bulkCategorySlugs.length === 0 ||
      selectedPromptSlugs.length === 0
    ) {
      return;
    }
    const requestIdAtSubmit = latestPromptsRequestIdRef.current;
    const filtersAtSubmit = filtersRef.current;
    setBulkMutating(true);
    setFeedback(
      bulkActionType === "add"
        ? `正在批量增加分类（${selectedPromptSlugs.length} 项）...`
        : `正在批量删除分类（${selectedPromptSlugs.length} 项）...`,
    );
    try {
      const updatedPrompts = await mutatePromptsBatchCategories({
        slugs: selectedPromptSlugs,
        addCategorySlugs: bulkActionType === "add" ? bulkCategorySlugs : [],
        removeCategorySlugs: bulkActionType === "remove" ? bulkCategorySlugs : [],
      });
      if (requestIdAtSubmit === latestPromptsRequestIdRef.current) {
        setPrompts((current) =>
          mergeUpdatedPromptsIntoList(current, updatedPrompts, filtersAtSubmit),
        );
      }
      setFeedback(
        bulkActionType === "add"
          ? `已批量增加分类（${updatedPrompts.length} 项）`
          : `已批量删除分类（${updatedPrompts.length} 项）`,
      );
      setSelectedPromptSlugs([]);
      setBulkActionType("");
      setBulkCategorySlugs([]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "请求失败";
      setFeedback(
        bulkActionType === "add"
          ? `批量增加分类失败：${message}`
          : `批量删除分类失败：${message}`,
      );
    } finally {
      setBulkMutating(false);
    }
  }

  async function handleConfirmDeletePromptsBatch() {
    if (
      bulkMutating ||
      bulkActionType !== "delete-prompts" ||
      !bulkDeletePreview?.confirmationToken ||
      selectedPromptSlugs.length === 0
    ) {
      return;
    }

    const selectedSlugsAtSubmit = [...selectedPromptSlugs];
    setBulkMutating(true);
    setFeedback(`正在批量删除提示词（${selectedSlugsAtSubmit.length} 项）...`);
    try {
      await confirmDeletePromptsBatch(selectedSlugsAtSubmit, bulkDeletePreview.confirmationToken);
      setPrompts((current) =>
        current.filter((prompt) => !selectedSlugsAtSubmit.includes(prompt.slug)),
      );
      setSelectedPromptSlugs([]);
      setBulkActionType("");
      setBulkCategorySlugs([]);
      setBulkDeletePreview(null);
      setFeedback(`已批量删除提示词（${selectedSlugsAtSubmit.length} 项）`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "请求失败";
      setFeedback(`批量删除提示词失败：${message}`);
    } finally {
      setBulkMutating(false);
    }
  }

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
      className="pm-prompt-management-page"
      style={{
        maxWidth: "1180px",
        margin: "0 auto",
        padding: "24px",
        paddingBottom:
          selectedCount > 0
            ? "calc(var(--pm-floating-action-bar-height, 0px) + var(--pm-floating-action-bar-bottom-gap, 20px) + 24px)"
            : "24px",
        ["--pm-floating-action-bar-height"]: `${bulkActionBarHeight}px`,
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

        {!loading && visiblePromptSlugs.length > 0 ? (
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button
              type="button"
              className="pm-secondary-button"
              onClick={handleSelectAllVisiblePrompts}
            >
              全选
            </button>
            <button
              type="button"
              className="pm-secondary-button"
              onClick={handleInvertVisiblePrompts}
            >
              反选
            </button>
          </div>
        ) : null}
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
            const isSelected = selectedPromptSlugs.includes(prompt.slug);

            return (
              <article
                key={prompt.slug}
                data-testid={`admin-prompts-row-${prompt.slug}`}
                className="pm-card"
                role="link"
                tabIndex={0}
                style={{ display: "grid", gap: "12px", cursor: "pointer" }}
                onClick={createRowClickHandler(prompt.slug, router)}
                onKeyDown={createRowKeyDownHandler(prompt.slug, router)}
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
                    <label
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        width: "fit-content",
                        fontSize: "13px",
                        color: "var(--pm-muted)",
                      }}
                    >
                      <input
                        type="checkbox"
                        aria-label={`选择提示词 ${prompt.title}`}
                        checked={isSelected}
                        onChange={(event) =>
                          handleTogglePromptSelection(prompt.slug, event.target.checked)
                        }
                      />
                      选择
                    </label>
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

      {selectedCount > 0 ? (
        <section
          ref={bulkActionBarRef}
          className="pm-floating-action-bar"
          data-testid="admin-prompts-bulk-action-bar"
        >
          <div style={{ display: "grid", gap: "4px" }}>
            <p style={{ margin: 0, color: "var(--pm-title)", fontWeight: 500 }}>
              已选 {selectedCount} 项
            </p>
            <p
              id="admin-prompts-bulk-action-note"
              style={{ margin: 0, color: "var(--pm-muted)", fontSize: "13px" }}
            >
              批量更新所选提示词的分类标签，不会刷新整页。
            </p>
          </div>

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button
              type="button"
              className="pm-secondary-button"
              aria-describedby="admin-prompts-bulk-action-note"
              disabled={bulkMutating}
              onClick={() => handleOpenBulkAction("add")}
            >
              批量增加分类
            </button>
            <button
              type="button"
              className="pm-secondary-button"
              aria-describedby="admin-prompts-bulk-action-note"
              disabled={bulkMutating}
              onClick={() => handleOpenBulkAction("remove")}
            >
              批量删除分类
            </button>
            <button
              type="button"
              className="pm-secondary-button"
              aria-describedby="admin-prompts-bulk-action-note"
              disabled={bulkMutating}
              onClick={() => void handleOpenBulkDeletePrompt()}
            >
              批量删除提示词
            </button>
            <button
              type="button"
              className="pm-primary-button"
              disabled={bulkMutating}
              onClick={() => setSelectedPromptSlugs([])}
            >
              清空选择
            </button>
          </div>

          {bulkActionType === "add" || bulkActionType === "remove" ? (
            <div
              style={{
                marginTop: "8px",
                borderTop: "1px solid var(--pm-border)",
                paddingTop: "10px",
                display: "grid",
                gap: "10px",
              }}
            >
              <p style={{ margin: 0, color: "var(--pm-title)", fontSize: "14px" }}>
                {bulkActionType === "add" ? "选择要增加的分类" : "选择要删除的分类"}
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 14px" }}>
                {selectableCategories.map((category) => (
                  <label
                    key={`bulk-category-${category.slug}`}
                    style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                  >
                    <input
                      type="checkbox"
                      checked={bulkCategorySlugs.includes(category.slug)}
                      onChange={(event) =>
                        handleToggleBulkCategory(category.slug, event.target.checked)
                      }
                    />
                    {category.name}
                  </label>
                ))}
              </div>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="pm-primary-button"
                  disabled={bulkMutating || bulkCategorySlugs.length === 0}
                  onClick={() => void handleSubmitBulkAction()}
                >
                  {bulkMutating
                    ? bulkActionType === "add"
                      ? "增加中..."
                      : "删除中..."
                    : bulkActionType === "add"
                      ? "确认增加分类"
                      : "确认删除分类"}
                </button>
                <button
                  type="button"
                  className="pm-secondary-button"
                  disabled={bulkMutating}
                  onClick={() => {
                    setBulkActionType("");
                    setBulkCategorySlugs([]);
                    setBulkDeletePreview(null);
                  }}
                >
                  取消
                </button>
              </div>
            </div>
          ) : null}

          {bulkActionType === "delete-prompts" ? (
            <div
              className="pm-bulk-delete-risk-panel"
              style={{
                marginTop: "8px",
                borderTop: "1px solid var(--pm-border)",
                paddingTop: "10px",
                display: "grid",
                gap: "10px",
              }}
            >
              <p style={{ margin: 0, color: "var(--pm-title)", fontSize: "14px", fontWeight: 600 }}>
                删除后不可恢复，请确认预检查结果
              </p>
              {bulkDeletePreview ? (
                <>
                  <p style={{ margin: 0, color: "var(--pm-muted)", fontSize: "13px" }}>
                    将删除 {bulkDeletePreview?.foundPrompts?.length ?? selectedCount} 条提示词，关联数据也会被移除。
                  </p>
                  <p style={{ margin: 0, color: "var(--pm-muted)", fontSize: "13px" }}>
                    关联汇总：版本 {bulkDeletePreview?.summary?.versions ?? 0} · 投稿{" "}
                    {bulkDeletePreview?.summary?.submissions ?? 0} · 收藏{" "}
                    {bulkDeletePreview?.summary?.likes ?? 0}
                  </p>
                </>
              ) : (
                <p style={{ margin: 0, color: "var(--pm-muted)", fontSize: "13px" }}>
                  正在加载预检查结果...
                </p>
              )}
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="pm-primary-button"
                  disabled={bulkMutating || !bulkDeletePreview?.confirmationToken}
                  onClick={() => void handleConfirmDeletePromptsBatch()}
                >
                  {bulkMutating ? "删除中..." : "确认删除提示词"}
                </button>
                <button
                  type="button"
                  className="pm-secondary-button"
                  disabled={bulkMutating}
                  onClick={() => {
                    setBulkActionType("");
                    setBulkDeletePreview(null);
                  }}
                >
                  取消
                </button>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
