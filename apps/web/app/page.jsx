import { HomePageShell } from "./_home/home-page-shell.jsx";
import { resolveHomePagePromptLoadError } from "./home-page-load-state.ts";
import { listPrompts } from "../lib/api/prompt-repository.ts";
import { parseAppEnv } from "../lib/env.ts";

export default async function HomePage() {
  let prompts = [];
  let loadNotice;

  try {
    prompts = await listPrompts();
  } catch (error) {
    const loadState = resolveHomePagePromptLoadError(error);
    if (loadState.shouldRethrow) {
      throw error;
    }
    loadNotice = loadState.loadNotice;
  }

  const { homeAiTools } = parseAppEnv();

  return <HomePageShell prompts={prompts} homeAiTools={homeAiTools} loadNotice={loadNotice} />;
}
