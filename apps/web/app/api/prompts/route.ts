import { NextResponse } from "next/server.js";

import { listPrompts } from "../../../lib/api/prompt-repository.ts";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category") ?? undefined;
  const keyword = searchParams.get("keyword") ?? undefined;
  const sort = searchParams.get("sort") ?? undefined;

  const data = await listPrompts({ category, keyword, sort });
  return NextResponse.json(data, { status: 200 });
}
