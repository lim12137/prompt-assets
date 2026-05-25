const HOME_PROMPT_LOAD_NOTICE = "首页当前无法读取真实数据库，已切换为空白调试态。";

function shouldRenderHomeFallback(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || "");
  return (
    message.includes("requires a readable database in auto mode") ||
    message.includes("ECONNREFUSED") ||
    message.includes("ETIMEDOUT") ||
    message.includes("connect")
  );
}

export function resolveHomePagePromptLoadError(error: unknown): {
  shouldRethrow: boolean;
  loadNotice?: string;
  logToConsole: boolean;
} {
  if (!shouldRenderHomeFallback(error)) {
    return {
      shouldRethrow: true,
      logToConsole: false,
    };
  }

  return {
    shouldRethrow: false,
    loadNotice: HOME_PROMPT_LOAD_NOTICE,
    logToConsole: false,
  };
}
