import { NextResponse } from "next/server.js";

import {
  createPrompt,
  listPrompts,
  type PromptCreateInput,
} from "../../../lib/api/prompt-repository.ts";

type CreatePromptBody = {
  title?: unknown;
  slug?: unknown;
  summary?: unknown;
  categorySlug?: unknown;
  content?: unknown;
};

function resolveCreatorRole(request: Request): PromptCreateInput["creatorRole"] {
  return request.headers.get("x-user-role")?.trim().toLowerCase() === "admin"
    ? "admin"
    : "user";
}

function resolveCreatorEmail(request: Request): string {
  return request.headers.get("x-user-email")?.trim() ?? "";
}

function mapCreateErrorCode(
  code: "forbidden" | "conflict" | "not_found" | "bad_request",
): "admin_role_required" | "prompt_slug_conflict" | "category_not_found" | "invalid_request" {
  if (code === "forbidden") {
    return "admin_role_required";
  }
  if (code === "conflict") {
    return "prompt_slug_conflict";
  }
  if (code === "not_found") {
    return "category_not_found";
  }
  return "invalid_request";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category") ?? undefined;
  const keyword = searchParams.get("keyword") ?? undefined;
  const sort = searchParams.get("sort") ?? undefined;

  const data = await listPrompts({ category, keyword, sort });
  return NextResponse.json(data, { status: 200 });
}

export async function POST(request: Request) {
  let body: CreatePromptBody;
  try {
    body = (await request.json()) as CreatePromptBody;
  } catch {
    return NextResponse.json(
      {
        error: "invalid request body",
        code: "invalid_request",
      },
      { status: 400 },
    );
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const slug = typeof body.slug === "string" ? body.slug.trim() : "";
  const summary = typeof body.summary === "string" ? body.summary.trim() : "";
  const categorySlug =
    typeof body.categorySlug === "string" ? body.categorySlug.trim() : "";
  const content = typeof body.content === "string" ? body.content.trim() : "";

  if (!title || !slug || !summary || !categorySlug || !content) {
    return NextResponse.json(
      {
        error: "title/slug/summary/categorySlug/content are required",
        code: "required_fields_missing",
      },
      { status: 400 },
    );
  }

  const result = await createPrompt({
    creatorEmail: resolveCreatorEmail(request),
    creatorRole: resolveCreatorRole(request),
    title,
    slug,
    summary,
    categorySlug,
    content,
  });

  if (!result.ok) {
    const status =
      result.code === "forbidden"
        ? 403
        : result.code === "conflict"
          ? 409
          : result.code === "not_found"
            ? 404
            : 400;
    return NextResponse.json(
      {
        error: result.message,
        code: mapCreateErrorCode(result.code),
      },
      { status },
    );
  }

  return NextResponse.json(result.value, { status: 201 });
}
