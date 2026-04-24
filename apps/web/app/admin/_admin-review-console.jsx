"use client";

import { useState } from "react";

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

export function AdminReviewConsole({ initialSubmissions }) {
  const [submissions, setSubmissions] = useState(initialSubmissions);
  const [activeReview, setActiveReview] = useState(null);
  const [feedback, setFeedback] = useState("待审核列表已加载，可以直接执行通过或拒绝。");

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
