import { notFound } from "next/navigation";

import { getPromptDetail } from "../../../lib/api/prompt-repository.ts";
import { PromptDetailContent } from "./_detail-content.js";

export default async function PromptDetailPage({ params }) {
  const resolvedParams = await Promise.resolve(params);
  const slug = decodeURIComponent(resolvedParams?.slug ?? "").trim();

  if (!slug) {
    notFound();
  }

  const detail = await getPromptDetail(slug);
  if (!detail) {
    notFound();
  }

  return <PromptDetailContent detail={detail} />;
}
