"use client";

import { useState } from "react";
import {
  HOME_ACTION_ENTRIES,
  HOME_ACTION_STATUS_TEXT,
} from "./home-actions.ts";

const INTERACTIVE_SELECTOR =
  "a,button,input,textarea,select,summary,label,[role='button'],[data-interactive='true']";

function getPromptCategories(prompt) {
  if (Array.isArray(prompt.categories) && prompt.categories.length > 0) {
    return prompt.categories.filter(
      (item) => item && typeof item.slug === "string" && typeof item.name === "string",
    ).map((item) => ({
      slug: item.slug,
      name: item.name,
      isSystem:
        typeof item.isSystem === "boolean"
          ? item.isSystem
          : item.slug === "uncategorized",
    }));
  }
  if (Array.isArray(prompt.categorySlugs) && prompt.categorySlugs.length > 0) {
    return prompt.categorySlugs.filter((slug) => typeof slug === "string" && slug).map((slug) => ({
      slug,
      name:
        slug === prompt.categorySlug &&
        typeof prompt.categoryName === "string" &&
        prompt.categoryName
          ? prompt.categoryName
          : slug === "uncategorized"
            ? "待分类"
            : slug,
      isSystem: slug === "uncategorized",
    }));
  }
  if (typeof prompt.categorySlug === "string" && prompt.categorySlug) {
    return [
      {
        slug: prompt.categorySlug,
        name: typeof prompt.categoryName === "string" && prompt.categoryName
          ? prompt.categoryName
          : prompt.categorySlug,
        isSystem: prompt.categorySlug === "uncategorized",
      },
    ];
  }
  return [];
}

function collectCategories(prompts) {
  const seen = new Set();
  const categories = [];

  for (const prompt of prompts) {
    for (const category of getPromptCategories(prompt)) {
      if (!seen.has(category.slug)) {
        seen.add(category.slug);
        categories.push(category);
      }
    }
  }

  if (!seen.has("uncategorized")) {
    categories.push({
      slug: "uncategorized",
      name: "待分类",
      isSystem: true,
    });
  }

  return categories;
}

function splitCategories(categories) {
  const manualCategories = [];
  const systemCategories = [];

  for (const category of categories) {
    if (category.isSystem) {
      systemCategories.push(category);
      continue;
    }
    manualCategories.push(category);
  }

  return {
    manualCategories,
    systemCategories,
  };
}

function HomeActionButtons() {
  return (
    <div style={{ display: "grid", gap: "8px", justifyItems: "end" }}>
      <div
        style={{ display: "flex", gap: "10px", alignItems: "center" }}
        aria-label="首页操作"
      >
        {HOME_ACTION_ENTRIES.map((entry) => (
          <a key={entry.label} className={entry.className} href={entry.href}>
            {entry.label}
          </a>
        ))}
      </div>
      <p
        role="status"
        aria-live="polite"
        style={{
          minHeight: "20px",
          margin: 0,
          color: "var(--pm-muted)",
          fontSize: "13px",
        }}
      >
        {HOME_ACTION_STATUS_TEXT}
      </p>
    </div>
  );
}

function ViewToggle({ view, onChange }) {
  return (
    <div
      style={{
        display: "flex",
        gap: "4px",
        border: "1px solid var(--pm-border)",
        borderRadius: "8px",
        padding: "3px",
        backgroundColor: "#f9fafb",
      }}
    >
      <button
        type="button"
        className={`pm-toggle-btn ${view === "card" ? "active" : ""}`}
        onClick={() => onChange("card")}
        aria-label="卡片视图"
        title="卡片视图"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      </button>
      <button
        type="button"
        className={`pm-toggle-btn ${view === "list" ? "active" : ""}`}
        onClick={() => onChange("list")}
        aria-label="列表视图"
        title="列表视图"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>
    </div>
  );
}

function isInteractiveTarget(target) {
  if (!(target instanceof Element)) {
    return false;
  }
  return Boolean(target.closest(INTERACTIVE_SELECTOR));
}

function openPromptDetail(slug) {
  window.location.assign(`/prompts/${slug}`);
}

function createCardClickHandler(slug) {
  return function handleCardClick(event) {
    if (isInteractiveTarget(event.target)) {
      return;
    }
    openPromptDetail(slug);
  };
}

function createCardKeyDownHandler(slug) {
  return function handleCardKeyDown(event) {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }
    if (isInteractiveTarget(event.target)) {
      return;
    }
    event.preventDefault();
    openPromptDetail(slug);
  };
}

function CopyButton({ prompt, copyState, onCopy }) {
  const statusLabel = copyState === "success" ? "已复制" : copyState === "error" ? "复制失败" : "复制";

  return (
    <button
      type="button"
      className="pm-secondary-button"
      data-interactive="true"
      aria-label={`复制${prompt.title}默认版本`}
      onClick={(event) => onCopy(event, prompt)}
      onKeyDown={(event) => {
        event.stopPropagation();
      }}
      style={{
        padding: "4px 10px",
        fontSize: "12px",
        lineHeight: 1.4,
        minWidth: "60px",
        color: copyState === "error" ? "#b91c1c" : undefined,
      }}
    >
      {statusLabel}
    </button>
  );
}

function PromptCard({ prompt, copyState, onCopy }) {
  const categories = getPromptCategories(prompt);

  return (
    <article
      data-testid="prompt-card"
      className="pm-card"
      role="link"
      tabIndex={0}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        cursor: "pointer",
      }}
      onClick={createCardClickHandler(prompt.slug)}
      onKeyDown={createCardKeyDownHandler(prompt.slug)}
    >
      <div style={{ display: "grid", gap: "8px" }}>
        <h3 style={{ margin: 0, fontSize: "16px", color: "var(--pm-title)" }}>{prompt.title}</h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
          {categories.map((category) => (
            <span
              key={`${prompt.slug}-${category.slug}`}
              data-testid="prompt-category-tag"
              style={{
                fontSize: "12px",
                padding: "2px 8px",
                borderRadius: "12px",
                backgroundColor: "var(--pm-accent-light)",
                color: "var(--pm-accent)",
                fontWeight: 500,
                whiteSpace: "nowrap",
              }}
            >
              {category.name}
            </span>
          ))}
        </div>
      </div>
      <p style={{ margin: 0, color: "var(--pm-muted)", fontSize: "14px", lineHeight: 1.5 }}>
        {prompt.summary}
      </p>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "4px", gap: "10px" }}>
        <a
          href={`/prompts/${prompt.slug}`}
          style={{
            color: "var(--pm-accent)",
            textDecoration: "none",
            fontSize: "14px",
            fontWeight: 500,
          }}
        >
          查看详情 →
        </a>
        <CopyButton prompt={prompt} copyState={copyState} onCopy={onCopy} />
      </div>
    </article>
  );
}

function PromptListItem({ prompt, copyState, onCopy }) {
  const categories = getPromptCategories(prompt);

  return (
    <article
      data-testid="prompt-card"
      role="link"
      tabIndex={0}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "16px",
        padding: "14px 16px",
        borderRadius: "10px",
        border: "1px solid var(--pm-border)",
        backgroundColor: "var(--pm-card-bg)",
        transition: "box-shadow 0.2s ease",
        cursor: "pointer",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = "var(--pm-shadow-hover)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = "none";
      }}
      onClick={createCardClickHandler(prompt.slug)}
      onKeyDown={createCardKeyDownHandler(prompt.slug)}
    >
      <div style={{ flex: 1, minWidth: 0, display: "grid", gap: "6px" }}>
        <h3 style={{ margin: 0, fontSize: "15px", color: "var(--pm-title)" }}>{prompt.title}</h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
          {categories.map((category) => (
            <span
              key={`${prompt.slug}-${category.slug}`}
              data-testid="prompt-category-tag"
              style={{
                fontSize: "12px",
                padding: "2px 8px",
                borderRadius: "12px",
                backgroundColor: "var(--pm-accent-light)",
                color: "var(--pm-accent)",
                fontWeight: 500,
                whiteSpace: "nowrap",
              }}
            >
              {category.name}
            </span>
          ))}
        </div>
        <p style={{ margin: 0, color: "var(--pm-muted)", fontSize: "14px", lineHeight: 1.5 }}>
          {prompt.summary}
        </p>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", whiteSpace: "nowrap" }}>
        <a
          href={`/prompts/${prompt.slug}`}
          style={{
            color: "var(--pm-accent)",
            textDecoration: "none",
            fontSize: "14px",
            fontWeight: 500,
          }}
        >
          查看详情 →
        </a>
        <div style={{ marginLeft: "auto" }}>
          <CopyButton prompt={prompt} copyState={copyState} onCopy={onCopy} />
        </div>
      </div>
    </article>
  );
}

export function HomePageShell({ prompts }) {
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [keyword, setKeyword] = useState("");
  const [viewMode, setViewMode] = useState("card");
  const [copyFeedbackBySlug, setCopyFeedbackBySlug] = useState({});
  const categories = collectCategories(prompts);
  const { manualCategories, systemCategories } = splitCategories(categories);
  const normalizedKeyword = keyword.trim().toLowerCase();

  function toggleCategory(categorySlug) {
    setSelectedCategories((prev) => {
      if (prev.includes(categorySlug)) {
        return prev.filter((item) => item !== categorySlug);
      }
      return [...prev, categorySlug];
    });
  }

  function setCopyFeedback(slug, status) {
    setCopyFeedbackBySlug((prev) => ({ ...prev, [slug]: status }));
    setTimeout(() => {
      setCopyFeedbackBySlug((prev) => {
        if (!prev[slug]) {
          return prev;
        }
        const next = { ...prev };
        delete next[slug];
        return next;
      });
    }, 1400);
  }

  async function copyPromptContent(event, prompt) {
    event.preventDefault();
    event.stopPropagation();

    const text = typeof prompt.currentVersionContent === "string"
      ? prompt.currentVersionContent
      : "";
    if (!text) {
      setCopyFeedback(prompt.slug, "error");
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      setCopyFeedback(prompt.slug, "success");
    } catch {
      setCopyFeedback(prompt.slug, "error");
    }
  }

  const filteredPrompts = prompts.filter((prompt) => {
    const promptCategorySlugs = Array.isArray(prompt.categorySlugs) && prompt.categorySlugs.length > 0
      ? prompt.categorySlugs
      : getPromptCategories(prompt).map((item) => item.slug);

    if (
      selectedCategories.length > 0 &&
      !selectedCategories.some((category) => promptCategorySlugs.includes(category))
    ) {
      return false;
    }

    if (!normalizedKeyword) {
      return true;
    }

    return (
      prompt.title.toLowerCase().includes(normalizedKeyword) ||
      prompt.summary.toLowerCase().includes(normalizedKeyword)
    );
  });

  return (
    <main style={{ padding: "24px", display: "grid", gap: "20px", maxWidth: "1400px", margin: "0 auto" }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "12px",
        }}
      >
        <div>
          <h1 className="pm-page-title" style={{ margin: 0, fontSize: "24px" }}>
            公司提示词库
          </h1>
          <p style={{ margin: "6px 0 0 0", color: "var(--pm-muted)", fontSize: "14px" }}>
            收录提示词总数：{prompts.length}
          </p>
        </div>
        <HomeActionButtons />
      </header>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "260px 1fr",
          gap: "20px",
          alignItems: "start",
        }}
      >
        <aside
          data-testid="home-section-categories"
          className="pm-card"
          style={{ padding: "16px", display: "grid", gap: "10px" }}
        >
          <h2 style={{ margin: 0, fontSize: "16px", color: "var(--pm-title)" }}>分类</h2>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "6px",
            }}
          >
            <button
              type="button"
              className={`pm-tag ${selectedCategories.length === 0 ? "active" : ""}`}
              style={{ justifyContent: "flex-start" }}
              onClick={() => setSelectedCategories([])}
            >
              全部
            </button>
            {manualCategories.map((category) => (
              <button
                key={category.slug}
                type="button"
                className={`pm-tag ${selectedCategories.includes(category.slug) ? "active" : ""}`}
                style={{ justifyContent: "flex-start" }}
                onClick={() => toggleCategory(category.slug)}
              >
                {category.name}
              </button>
            ))}
          </div>

          {systemCategories.length > 0 ? (
            <details data-testid="system-categories-panel">
              <summary
                data-testid="system-categories-toggle"
                style={{
                  cursor: "pointer",
                  color: "var(--pm-muted)",
                  fontSize: "13px",
                  userSelect: "none",
                }}
              >
                系统分类
              </summary>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                  marginTop: "8px",
                }}
              >
                {systemCategories.map((category) => (
                  <button
                    key={category.slug}
                    type="button"
                    disabled
                    aria-disabled="true"
                    className={`pm-tag ${selectedCategories.includes(category.slug) ? "active" : ""}`}
                    style={{ justifyContent: "flex-start" }}
                  >
                    {category.name}
                  </button>
                ))}
              </div>
            </details>
          ) : null}
        </aside>

        <section
          data-testid="home-section-list"
          className="pm-card"
          style={{
            display: "grid",
            gap: "14px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
            <h2 style={{ margin: 0, fontSize: "16px", color: "var(--pm-title)" }}>提示词列表</h2>
            <ViewToggle view={viewMode} onChange={setViewMode} />
          </div>

          <div style={{ position: "relative" }}>
            <svg
              style={{
                position: "absolute",
                left: "14px",
                top: "50%",
                transform: "translateY(-50%)",
                color: "#9ca3af",
                pointerEvents: "none",
              }}
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              id="home-keyword-input"
              aria-label="关键词搜索"
              className="pm-search-input"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="搜索标题或摘要关键词..."
            />
            {keyword && (
              <button
                type="button"
                onClick={() => setKeyword("")}
                style={{
                  position: "absolute",
                  right: "10px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  color: "#9ca3af",
                  cursor: "pointer",
                  padding: "4px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                aria-label="清空搜索"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>

          {filteredPrompts.length === 0 ? (
            <div
              data-testid="home-empty-state"
              style={{
                border: "1px dashed var(--pm-border)",
                borderRadius: "10px",
                padding: "40px 20px",
                color: "var(--pm-muted)",
                textAlign: "center",
                fontSize: "14px",
              }}
            >
              未找到匹配的提示词，试试其他关键词？
            </div>
          ) : viewMode === "card" ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                gap: "14px",
              }}
            >
              {filteredPrompts.map((prompt) => (
                <PromptCard
                  key={prompt.slug}
                  prompt={prompt}
                  copyState={copyFeedbackBySlug[prompt.slug]}
                  onCopy={copyPromptContent}
                />
              ))}
            </div>
          ) : (
            <div style={{ display: "grid", gap: "10px" }}>
              {filteredPrompts.map((prompt) => (
                <PromptListItem
                  key={prompt.slug}
                  prompt={prompt}
                  copyState={copyFeedbackBySlug[prompt.slug]}
                  onCopy={copyPromptContent}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
