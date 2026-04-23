import { HomePageShell } from "./_home/home-page-shell.jsx";
import { listPrompts } from "../lib/api/prompt-repository.ts";

export default async function HomePage() {
  const prompts = await listPrompts();
  return <HomePageShell prompts={prompts} />;
}
