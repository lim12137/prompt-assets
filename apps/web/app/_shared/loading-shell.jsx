export function LoadingShell({ title = "页面加载中...", description = "正在准备内容，请稍候。" }) {
  return (
    <main className="pm-loading-shell" aria-busy="true">
      <section className="pm-loading-card" role="status" aria-label="页面加载状态">
        <div className="pm-loading-heading">
          <span className="pm-loading-spinner" aria-hidden="true" />
          <div>
            <h1>{title}</h1>
            <p>{description}</p>
          </div>
        </div>
        <div className="pm-skeleton-block wide" />
        <div className="pm-skeleton-grid">
          <div className="pm-skeleton-block tall" />
          <div className="pm-skeleton-block tall" />
        </div>
      </section>
    </main>
  );
}
