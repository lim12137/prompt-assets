function HomeAiToolIcon({ iconKey, accentColor }) {
  if (iconKey === "ceic") {
    return (
      <svg
        width="18"
        height="18"
        viewBox="0 0 18 18"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M3 5.5H10.5C11.6046 5.5 12.5 6.39543 12.5 7.5V11C12.5 12.1046 11.6046 13 10.5 13H3C1.89543 13 1 12.1046 1 11V7.5C1 6.39543 1.89543 5.5 3 5.5Z"
          stroke={accentColor}
          strokeWidth="1.4"
        />
        <path
          d="M5.5 8.5H9.5M5.5 10.8H8"
          stroke={accentColor}
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        <path
          d="M10.8 6.9L14.5 3.2M11.8 3.2H14.5V5.9"
          stroke={accentColor}
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (iconKey === "chatgpt") {
    return (
      <svg
        width="18"
        height="18"
        viewBox="0 0 18 18"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M2 8C2 5.79086 3.79086 4 6 4H8.5C11.5376 4 14 6.46243 14 9.5C14 12.5376 11.5376 15 8.5 15H6C3.79086 15 2 13.2091 2 11V8Z"
          stroke={accentColor}
          strokeWidth="1.4"
        />
        <path
          d="M5.4 7.1H10.2M5.4 10.4H8.1"
          stroke={accentColor}
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M9 2.5L13 4.5V8.6C13 11.5452 11.2091 14.2079 9 14.8C6.79086 14.2079 5 11.5452 5 8.6V4.5L9 2.5Z"
        stroke={accentColor}
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M7.4 8.8L8.6 10L11 7.6"
        stroke={accentColor}
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function HomeAiToolsSection({ tools }) {
  return (
    <section
      data-testid="home-ai-tools-section"
      className="pm-home-ai-tools"
      aria-label="AI工具"
    >
      <div className="pm-home-ai-tools__header">
        <h3 className="pm-home-ai-tools__title">AI工具</h3>
        <p className="pm-home-ai-tools__hint">
          作为分类区下方的补充入口，保持低干扰。
        </p>
      </div>

      <div className="pm-home-ai-tools__list">
        {tools.map((tool) => (
          <a
            key={tool.name}
            data-testid="home-ai-tool-card"
            className="pm-home-ai-tool-card"
            href={tool.href}
            target="_blank"
            rel="noreferrer"
          >
            <span
              className="pm-home-ai-tool-card__icon"
              style={{
                backgroundColor: tool.iconBackground,
                color: tool.accentColor,
              }}
            >
              <HomeAiToolIcon
                iconKey={tool.iconKey}
                accentColor={tool.accentColor}
              />
            </span>
            <span className="pm-home-ai-tool-card__content">
              <span className="pm-home-ai-tool-card__topline">
                <span className="pm-home-ai-tool-card__name">{tool.name}</span>
                <span
                  className="pm-home-ai-tool-card__link"
                  style={{ color: tool.accentColor }}
                >
                  ↗ 外链
                </span>
              </span>
              <span className="pm-home-ai-tool-card__description">
                {tool.description}
              </span>
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}
