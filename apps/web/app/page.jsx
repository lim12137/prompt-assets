import { HomePageShell } from "./_home/home-page-shell.jsx";
import { listPrompts } from "../lib/api/prompt-repository.ts";
import { parseAppEnv } from "../lib/env.ts";

export default async function HomePage() {
  const prompts = await listPrompts();
  const { homeAiTools } = parseAppEnv();

  return <HomePageShell prompts={prompts} homeAiTools={homeAiTools} />;
}
