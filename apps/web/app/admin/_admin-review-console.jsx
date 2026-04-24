"use client";

import { useEffect, useState } from "react";

const REVIEWER_EMAIL = "admin@example.com";
const REVIEWER_ROLE = "admin";

function formatSubmittedAt(input) {
  const value = new Date(input);
  if (Number.isNaN(value.getTime())) {
    return "时间未知";
  }

  return value.toLocaleString("zh-CN", {
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function adminHeaders() {
  return {
    "content-type": "application/json",
    "x-user-email": REVIEWER_EMAIL,
    "x-user-role": REVIEWER_ROLE,
  };
}

async function submitReview(submissionId, action) {
  const response = await fetch(`/api/admin/submissions/${submissionId}/${action}`, {
    method: "POST",
    headers: {
      "x-user-email": REVIEWER_EMAIL,
      "x-user-role": REVIEWER_ROLE,
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      typeof payload.error === "string" && payload.error.length > 0
        ? payload.error
        : "请求失败",
    );
  }

  return payload;
}

async function fetchAdminCategories() {
  const response = await fetch("/api/admin/categories", {
    method: "GET",
    headers: {
      "x-user-email": REVIEWER_EMAIL,
      "x-user-role": REVIEWER_ROLE,
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      typeof payload.error === "string" && payload.error.length > 0
        ? payload.error
        : "加载分类失败",
    );
  }
  return Array.isArray(payload.categories) ? payload.categories : [];
}

export function AdminReviewConsole({ initialSubmissions }) {
  const [submissions, setSubmissions] = useState(initialSubmissions);
  const [activeReview, setActiveReview] = useState(null);
  const [feedback, setFeedback] = useState("待审核列表已加载，可以直接执行通过或拒绝。");

  const [categories, setCategories] = useState([]);
  const [categoryLoading, setCategoryLoading] = useState(true);
  const [categorySubmitting, setCategorySubmitting] = useState(false);
  const [categoryDeleteSubmitting, setCategoryDeleteSubmitting] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategorySlug, setNewCategorySlug] = useState("");
  const [deletePreview, setDeletePreview] = useState(null);

  async function loadCategories() {
    setCategoryLoading(true);
    try {
      const items = await fetchAdminCategories();
      setCategories(items);
    } catch (error) {
      const message = error instanceof Error ? error.message : "加载分类失败";
      setFeedback(`分类加载失败：${message}`);
    } finally {
      setCategoryLoading(false);
    }
  }

  useEffect(() => {
    void loadCategories();
  }, []);

  async function handleReview(submission, action) {
    setActiveReview({ id: submission.id, action });
    setFeedback(
      `正在处理 ${submission.promptTitle} 的${action === "approve" ? "通过" : "拒绝"}请求...`,
    );

    try {
      await submitReview(submission.id, action);
      setSubmissions((current) =>
        current.filter((item) => item.id !== submission.id),
      );
      setFeedback(
        `已${action === "approve" ? "通过" : "拒绝"} ${submission.promptTitle}，候选版本 ${submission.candidateVersionNo} 已完成处理。`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "请求失败";
      setFeedback(`${submission.promptTitle} 审核失败：${message}`);
    } finally {
      setActiveReview(null);
    }
  }

  async function handleCreateCategory(event) {
    event.preventDefault();
    if (categorySubmitting) {
      return;
    }

    const name = newCategoryName.trim();
    const slug = newCategorySlug.trim();
    if (!name) {
      setFeedback("新增分类失败：分类名称不能为空");
      return;
    }

    setCategorySubmitting(true);
    try {
      const response = await fetch("/api/admin/categories", {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify({
          name,
          slug: slug || undefined,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          typeof payload.error === "string" && payload.error.length > 0
            ? payload.error
            : "新增分类失败",
        );
      }

      setFeedback(`新增分类成功：${payload?.category?.name ?? name}`);
      setNewCategoryName("");
      setNewCategorySlug("");
      await loadCategories();
    } catch (error) {
      const message = error instanceof Error ? error.message : "新增分类失败";
      setFeedback(`新增分类失败：${message}`);
    } finally {
      setCategorySubmitting(false);
    }
  }

  async function handlePrepareDeleteCategory(category) {
    setCategoryDeleteSubmitting(true);
    try {
      const response = await fetch(`/api/admin/categories/${category.slug}`, {
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

      setDeletePreview({
        slug: category.slug,
        name: category.name,
        impactedPromptCount: payload.impactedPromptCount ?? 0,
        willBeUncategorizedCount: payload.willBeUncategorizedCount ?? 0,
        confirmationToken: payload.confirmationToken ?? "",
      });
      setFeedback(`已加载删除预检查：${category.name}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "删除预检查失败";
      setFeedback(`删除预检查失败：${message}`);
    } finally {
      setCategoryDeleteSubmitting(false);
    }
  }

  async function handleConfirmDeleteCategory() {
    if (!deletePreview?.slug || !deletePreview?.confirmationToken) {
      setFeedback("删除失败：确认信息缺失");
      return;
    }

    setCategoryDeleteSubmitting(true);
    try {
      const response = await fetch(`/api/admin/categories/${deletePreview.slug}`, {
        method: "DELETE",
        headers: adminHeaders(),
        body: JSON.stringify({
          confirm: true,
          confirmationToken: deletePreview.confirmationToken,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          typeof payload.error === "string" && payload.error.length > 0
            ? payload.error
            : "删除失败",
        );
      }

      setFeedback(
        `已删除分类：${deletePreview.name}（受影响 ${payload.impactedPromptCount ?? 0}，归入待分类 ${payload.willBeUncategorizedCount ?? 0}）`,
      );
      setDeletePreview(null);
      await loadCategories();
    } catch (error) {
      const message = error instanceof Error ? error.message : "删除失败";
      setFeedback(`删除失败：${message}`);
    } finally {
      setCategoryDeleteSubmitting(false);
    }
  }

  return (
    <main
      style={{
        maxWidth: "1100px",
        margin: "0 auto",
        padding: "24px",
        display: "grid",
        gap: "20px",
      }}
    >
      <header className="pm-card" style={{ display: "grid", gap: "8px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <div>
            <h1 className="pm-page-title" style={{ margin: 0 }}>
              待审核管理
            </h1>
            <p style={{ margin: "6px 0 0 0", color: "var(--pm-muted)" }}>
              待处理投稿：{submissions.length}
            </p>
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <a className="pm-primary-button pm-button-link" href="/admin/create">
              创建提示词
            </a>
            <a className="pm-secondary-button pm-button-link" href="/admin/import">
              批量导入
            </a>
            <a className="pm-secondary-button pm-button-link" href="/">
              返回首页
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
        <h2 style={{ margin: 0, fontSize: "18px" }}>分类管理</h2>

        <form
          style={{
            display: "grid",
            gap: "8px",
            gridTemplateColumns: "1fr 1fr auto",
            alignItems: "end",
          }}
          onSubmit={handleCreateCategory}
        >
          <label style={{ display: "grid", gap: "4px" }}>
            <span style={{ fontSize: "13px", color: "var(--pm-muted)" }}>新增分类名称</span>
            <input
              aria-label="新增分类名称"
              value={newCategoryName}
              onChange={(event) => setNewCategoryName(event.target.value)}
              placeholder="例如：运营"
            />
          </label>
          <label style={{ display: "grid", gap: "4px" }}>
            <span style={{ fontSize: "13px", color: "var(--pm-muted)" }}>新增分类Slug</span>
            <input
              aria-label="新增分类Slug"
              value={newCategorySlug}
              onChange={(event) => setNewCategorySlug(event.target.value)}
              placeholder="例如：operations（可留空自动生成）"
            />
          </label>
          <button
            type="submit"
            className="pm-primary-button"
            disabled={categorySubmitting}
          >
            {categorySubmitting ? "新增中..." : "新增分类"}
          </button>
        </form>

        {categoryLoading ? (
          <p style={{ margin: 0, color: "var(--pm-muted)" }}>分类加载中...</p>
        ) : (
          <div style={{ display: "grid", gap: "8px" }}>
            {categories.map((category) => (
              <article
                key={category.slug}
                data-testid={`admin-category-row-${category.slug}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "12px",
                  border: "1px solid var(--pm-border)",
                  borderRadius: "8px",
                  padding: "10px 12px",
                }}
              >
                <div style={{ display: "grid", gap: "4px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <strong>{category.name}</strong>
                    {category.isSystem ? <span className="pm-pill">系统</span> : null}
                  </div>
                  <span style={{ color: "var(--pm-muted)", fontSize: "13px" }}>
                    slug: {category.slug} · 关联提示词：{category.promptCount}
                  </span>
                </div>
                <button
                  type="button"
                  className="pm-secondary-button"
                  disabled={categoryDeleteSubmitting || category.isSystem}
                  onClick={() => handlePrepareDeleteCategory(category)}
                >
                  删除
                </button>
              </article>
            ))}
          </div>
        )}

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
            <h3 style={{ margin: 0, fontSize: "16px" }}>删除确认：{deletePreview.name}</h3>
            <p style={{ margin: 0, color: "var(--pm-muted)" }}>
              受影响提示词：{deletePreview.impactedPromptCount}
            </p>
            <p style={{ margin: 0, color: "var(--pm-muted)" }}>
              将归入待分类：{deletePreview.willBeUncategorizedCount}
            </p>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                className="pm-primary-button"
                disabled={categoryDeleteSubmitting}
                onClick={handleConfirmDeleteCategory}
              >
                {categoryDeleteSubmitting ? "删除中..." : "确认删除分类"}
              </button>
              <button
                type="button"
                className="pm-secondary-button"
                disabled={categoryDeleteSubmitting}
                onClick={() => setDeletePreview(null)}
              >
                取消
              </button>
            </div>
          </section>
        ) : null}
      </section>

      {submissions.length === 0 ? (
        <section className="pm-card">
          <h2 style={{ marginTop: 0, fontSize: "18px" }}>当前没有待审核项</h2>
          <p style={{ marginBottom: 0, color: "var(--pm-muted)" }}>
            所有待审核投稿都已处理。后续新增投稿会继续出现在这里。
          </p>
        </section>
      ) : (
        <section style={{ display: "grid", gap: "12px" }}>
          {submissions.map((submission) => {
            const isActive = activeReview?.id === submission.id;
            const activeAction = isActive ? activeReview.action : null;

            return (
              <article
                key={submission.id}
                data-testid={`submission-row-${submission.id}`}
                className="pm-card"
                style={{ display: "grid", gap: "12px" }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: "16px",
                  }}
                >
                  <div style={{ display: "grid", gap: "6px" }}>
                    <h2 style={{ margin: 0, fontSize: "18px", color: "var(--pm-title)" }}>
                      {submission.promptTitle}
                    </h2>
                    <p style={{ margin: 0, color: "var(--pm-muted)" }}>
                      {submission.promptSummary}
                    </p>
                  </div>
                  <span className="pm-pill">待审核</span>
                </div>

                <dl
                  style={{
                    margin: 0,
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: "8px 16px",
                  }}
                >
                  <div>
                    <dt className="pm-meta-term">版本变更</dt>
                    <dd className="pm-meta-value">
                      {submission.baseVersionNo} → {submission.candidateVersionNo}
                    </dd>
                  </div>
                  <div>
                    <dt className="pm-meta-term">投稿人</dt>
                    <dd className="pm-meta-value">{submission.submitterEmail}</dd>
                  </div>
                  <div>
                    <dt className="pm-meta-term">提交时间</dt>
                    <dd className="pm-meta-value">
                      {formatSubmittedAt(submission.submittedAt)}
                    </dd>
                  </div>
                </dl>

                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    type="button"
                    className="pm-primary-button"
                    disabled={isActive}
                    onClick={() => handleReview(submission, "approve")}
                  >
                    {activeAction === "approve" ? "处理中..." : "通过"}
                  </button>
                  <button
                    type="button"
                    className="pm-secondary-button"
                    disabled={isActive}
                    onClick={() => handleReview(submission, "reject")}
                  >
                    {activeAction === "reject" ? "处理中..." : "拒绝"}
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}
