import { NextResponse } from "next/server.js";

import { getPromptVersionScoreStats } from "../../../../../../../lib/api/prompt-repository.ts";

type RouteParams = {
  slug: string;
  versionNo: string;
};

type RouteContext = {
  params: Promise<RouteParams>;
};

export async function GET(request: Request, context: RouteContext) {
  const params = await context.params;
  const slug = decodeURIComponent(params.slug ?? "").trim();
  const versionNo = decodeURIComponent(params.versionNo ?? "").trim();

  if (!slug) {
    return NextResponse.json({ error: "invalid slug" }, { status: 400 });
  }
  if (!versionNo) {
    return NextResponse.json({ error: "invalid versionNo" }, { status: 400 });
  }

  const sceneRaw = new URL(request.url).searchParams.get("scene");
  const scene = sceneRaw?.trim();
  if (sceneRaw !== null && !scene) {
    return NextResponse.json({ error: "invalid scene" }, { status: 400 });
  }

  const result = await getPromptVersionScoreStats(slug, versionNo, scene);
  if (!result) {
    return NextResponse.json({ error: "prompt version not found" }, { status: 404 });
  }

  return NextResponse.json(result, { status: 200 });
}
