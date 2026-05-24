import { HomePageShell } from "./_home/home-page-shell.jsx";
import { listPrompts } from "../lib/api/prompt-repository.ts";
import { parseAppEnv } from "../lib/env.ts";

function shouldRenderHomeFallback(error) {
  const message = error instanceof Error ? error.message : String(error || "");
  return (
    message.includes("requires a readable database in auto mode") ||
    message.includes("ECONNREFUSED") ||
    message.includes("ETIMEDOUT") ||
    message.includes("connect")
  );
}

export default async function HomePage() {
  let prompts = [];
  let loadNotice;

  try {
    prompts = await listPrompts();
  } catch (error) {
    if (!shouldRenderHomeFallback(error)) {
      throw error;
    }
    loadNotice = "首页当前无法读取真实数据库，已切换为空白调试态。";
    console.error(error);
  }

  const { homeAiTools } = parseAppEnv();

  return <HomePageShell prompts={prompts} homeAiTools={homeAiTools} loadNotice={loadNotice} />;
}
