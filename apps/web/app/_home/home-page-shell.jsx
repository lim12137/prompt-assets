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
      style={{ display: "flex", gap: "8px", alignItems: "center" }}
      aria-label="首页操作"
    >
      <button type="button">导入</button>
      <button type="button">管理</button>
      <button type="button">创建</button>
    </div>
  );
}

function PromptCard({ prompt }) {
  return (
    <article
      data-testid="prompt-card"
      style={{
        border: "1px solid #d0d7de",
        borderRadius: "8px",
        padding: "12px",
        backgroundColor: "#ffffff",
      }}
    >
      <h3 style={{ margin: "0 0 6px 0" }}>{prompt.title}</h3>
      <p style={{ margin: "0 0 8px 0", color: "#57606a" }}>{prompt.summary}</p>
      <a href={`/prompts/${prompt.slug}`}>查看详情</a>
    </article>
  );
}

export function HomePageShell({ prompts }) {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [keyword, setKeyword] = useState("");
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
    <main style={{ padding: "20px", display: "grid", gap: "16px" }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "12px",
        }}
      >
        <div>
          <h1 style={{ margin: 0 }}>Prompt Library</h1>
          <p style={{ margin: "6px 0 0 0", color: "#57606a" }}>
            首页最小骨架（Task 8）
          </p>
        </div>
        <ActionButtons />
      </header>

      <section
        data-testid="home-section-overview"
        style={{
          border: "1px solid #d0d7de",
          borderRadius: "8px",
          padding: "12px",
          backgroundColor: "#f6f8fa",
        }}
      >
        <h2 style={{ marginTop: 0 }}>概览区</h2>
        <p style={{ marginBottom: 0 }}>收录提示词总数：{prompts.length}</p>
      </section>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "220px 1fr 220px",
          gap: "16px",
          alignItems: "start",
        }}
      >
        <section
          data-testid="home-section-categories"
          style={{
            border: "1px solid #d0d7de",
            borderRadius: "8px",
            padding: "12px",
            backgroundColor: "#ffffff",
          }}
        >
          <h2 style={{ marginTop: 0 }}>分类区</h2>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "8px",
            }}
          >
            <button
              type="button"
              aria-pressed={selectedCategory === "all"}
              onClick={() => setSelectedCategory("all")}
            >
              全部
            </button>
            {categories.map((category) => (
              <button
                key={category.slug}
                type="button"
                aria-pressed={selectedCategory === category.slug}
                onClick={() => setSelectedCategory(category.slug)}
              >
                {category.name}
              </button>
            ))}
          </div>
        </section>

        <section
          data-testid="home-section-list"
          style={{
            border: "1px solid #d0d7de",
            borderRadius: "8px",
            padding: "12px",
            backgroundColor: "#ffffff",
            display: "grid",
            gap: "10px",
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: "4px" }}>列表区</h2>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <label htmlFor="home-keyword-input">关键词搜索</label>
            <input
              id="home-keyword-input"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="输入标题或摘要关键词"
            />
            <button type="button" onClick={() => setKeyword("")}>
              清空搜索
            </button>
          </div>
          {filteredPrompts.length === 0 ? (
            <div
              data-testid="home-empty-state"
              style={{
                border: "1px dashed #d0d7de",
                borderRadius: "8px",
                padding: "14px",
                color: "#57606a",
              }}
            >
              未找到匹配的提示词
            </div>
          ) : (
            filteredPrompts.map((prompt) => (
              <PromptCard key={prompt.slug} prompt={prompt} />
            ))
          )}
        </section>

        <section
          data-testid="home-section-activity"
          style={{
            border: "1px solid #d0d7de",
            borderRadius: "8px",
            padding: "12px",
            backgroundColor: "#ffffff",
          }}
        >
          <h2 style={{ marginTop: 0 }}>动态区</h2>
          <p style={{ marginBottom: 0, color: "#57606a" }}>最近更新占位。</p>
        </section>
      </div>
    </main>
  );
}
