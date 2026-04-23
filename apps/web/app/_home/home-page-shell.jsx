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
          <p style={{ marginBottom: 0, color: "#57606a" }}>筛选入口占位。</p>
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
          {prompts.map((prompt) => (
            <PromptCard key={prompt.slug} prompt={prompt} />
          ))}
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
