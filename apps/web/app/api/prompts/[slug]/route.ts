import { NextResponse } from "next/server.js";

import { getPromptDetail } from "../../../../lib/api/prompt-repository.ts";

type RouteParams = {
  slug: string;
};

type RouteContext = {
  params: Promise<RouteParams>;
};

export async function GET(_request: Request, context: RouteContext) {
  const params = await context.params;
  const slug = decodeURIComponent(params.slug ?? "").trim();

  if (!slug) {
    return NextResponse.json({ error: "invalid slug" }, { status: 400 });
  }

  const detail = await getPromptDetail(slug);
  if (!detail) {
    return NextResponse.json({ error: "prompt not found" }, { status: 404 });
  }

  return NextResponse.json(detail, { status: 200 });
}
