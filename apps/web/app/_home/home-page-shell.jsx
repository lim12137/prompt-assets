"use client";

import { useState } from "react";

function collectCategories(prompts) {
  const seen = new Set();
  const categories = [];

  for (const prompt of prompts) {
    if (!seen.has(prompt.categorySlug)) {
      seen.add(prompt.categorySlug);
      categories.push({
        slug: prompt.categorySlug,
        name: prompt.categoryName,
      });
    }
  }

  return categories;
}

function ActionButtons() {
  return (
    <div
      style={{ display: "flex", gap: "10px", alignItems: "center" }}
      aria-label="首页操作"
    >
      <button className="pm-secondary-button" type="button">
        导入
      </button>
      <button className="pm-secondary-button" type="button">
        管理
      </button>
      <button className="pm-primary-button" type="button">
        创建
      </button>
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

function PromptCard({ prompt }) {
  return (
    <article
      data-testid="prompt-card"
      className="pm-card"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        cursor: "pointer",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <h3 style={{ margin: 0, fontSize: "16px", color: "var(--pm-title)" }}>{prompt.title}</h3>
        <span
          style={{
            fontSize: "12px",
            padding: "2px 8px",
            borderRadius: "12px",
            backgroundColor: "var(--pm-accent-light)",
            color: "var(--pm-accent)",
            fontWeight: 500,
            whiteSpace: "nowrap",
            marginLeft: "8px",
          }}
        >
          {prompt.categoryName}
        </span>
      </div>
      <p style={{ margin: 0, color: "var(--pm-muted)", fontSize: "14px", lineHeight: 1.5 }}>
        {prompt.summary}
      </p>
      <a
        href={`/prompts/${prompt.slug}`}
        style={{
          color: "var(--pm-accent)",
          textDecoration: "none",
          fontSize: "14px",
          fontWeight: 500,
          marginTop: "4px",
        }}
      >
        查看详情 →
      </a>
    </article>
  );
}

function PromptListItem({ prompt }) {
  return (
    <article
      data-testid="prompt-card"
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
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
          <h3 style={{ margin: 0, fontSize: "15px", color: "var(--pm-title)" }}>{prompt.title}</h3>
          <span
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
            {prompt.categoryName}
          </span>
        </div>
        <p style={{ margin: 0, color: "var(--pm-muted)", fontSize: "14px", lineHeight: 1.5 }}>
          {prompt.summary}
        </p>
      </div>
      <a
        href={`/prompts/${prompt.slug}`}
        style={{
          color: "var(--pm-accent)",
          textDecoration: "none",
          fontSize: "14px",
          fontWeight: 500,
          whiteSpace: "nowrap",
        }}
      >
        查看详情 →
      </a>
    </article>
  );
}

export function HomePageShell({ prompts }) {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [keyword, setKeyword] = useState("");
  const [viewMode, setViewMode] = useState("card");
  const categories = collectCategories(prompts);
  const normalizedKeyword = keyword.trim().toLowerCase();

  const filteredPrompts = prompts.filter((prompt) => {
    if (selectedCategory !== "all" && prompt.categorySlug !== selectedCategory) {
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
            Prompt Library
          </h1>
          <p style={{ margin: "6px 0 0 0", color: "var(--pm-muted)", fontSize: "14px" }}>
            收录提示词总数：{prompts.length}
          </p>
        </div>
        <ActionButtons />
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
          style={{ padding: "16px" }}
        >
          <h2 style={{ margin: "0 0 12px 0", fontSize: "16px", color: "var(--pm-title)" }}>分类</h2>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "6px",
            }}
          >
            <button
              type="button"
              className={`pm-tag ${selectedCategory === "all" ? "active" : ""}`}
              style={{ justifyContent: "flex-start" }}
              onClick={() => setSelectedCategory("all")}
            >
              全部
            </button>
            {categories.map((category) => (
              <button
                key={category.slug}
                type="button"
                className={`pm-tag ${selectedCategory === category.slug ? "active" : ""}`}
                style={{ justifyContent: "flex-start" }}
                onClick={() => setSelectedCategory(category.slug)}
              >
                {category.name}
              </button>
            ))}
          </div>
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
                <PromptCard key={prompt.slug} prompt={prompt} />
              ))}
            </div>
          ) : (
            <div style={{ display: "grid", gap: "10px" }}>
              {filteredPrompts.map((prompt) => (
                <PromptListItem key={prompt.slug} prompt={prompt} />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
