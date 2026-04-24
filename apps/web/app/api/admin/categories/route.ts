import { NextResponse } from "next/server.js";

import {
  createAdminCategory,
  listAdminCategories,
  type AdminCategoryCreateInput,
} from "../../../../lib/api/prompt-repository.ts";

type CreateCategoryBody = {
  name?: unknown;
  slug?: unknown;
};

function resolveAdminRole(request: Request): AdminCategoryCreateInput["creatorRole"] {
  return request.headers.get("x-user-role")?.trim().toLowerCase() === "admin"
    ? "admin"
    : "user";
}

function resolveCreatorEmail(request: Request): string {
  return request.headers.get("x-user-email")?.trim() ?? "";
}

function generateSlugFromName(name: string): string {
  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\p{Letter}\p{Number}-]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (normalized) {
    return normalized;
  }

  let hash = 0;
  for (const char of name) {
    hash = (hash * 31 + char.charCodeAt(0)) % 1000000007;
  }
  return `category-${Math.abs(hash)}`;
}

export async function GET(request: Request) {
  if (resolveAdminRole(request) !== "admin") {
    return NextResponse.json(
      {
        error: "admin role is required",
        code: "admin_role_required",
      },
      { status: 403 },
    );
  }

  const categories = await listAdminCategories();
  return NextResponse.json({ categories }, { status: 200 });
}

export async function POST(request: Request) {
  if (resolveAdminRole(request) !== "admin") {
    return NextResponse.json(
      {
        error: "admin role is required",
        code: "admin_role_required",
      },
      { status: 403 },
    );
  }

  let body: CreateCategoryBody;
  try {
    body = (await request.json()) as CreateCategoryBody;
  } catch {
    return NextResponse.json(
      {
        error: "invalid request body",
        code: "invalid_request",
      },
      { status: 400 },
    );
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const slugInput = typeof body.slug === "string" ? body.slug.trim() : "";
  if (!name) {
    return NextResponse.json(
      {
        error: "name is required",
        code: "invalid_request",
      },
      { status: 400 },
    );
  }
  const slug = slugInput || generateSlugFromName(name);

  const result = await createAdminCategory({
    creatorEmail: resolveCreatorEmail(request),
    creatorRole: "admin",
    name,
    slug,
  });

  if (result.ok) {
    return NextResponse.json(result.value, { status: 201 });
  }

  const failedResult = result as {
    ok: false;
    code: "forbidden" | "conflict" | "bad_request";
    reason: "admin_role_required" | "category_slug_conflict" | "invalid_request";
    message: string;
  };
  const status =
    failedResult.code === "forbidden"
      ? 403
      : failedResult.code === "conflict"
        ? 409
        : 400;
  return NextResponse.json(
    {
      error: failedResult.message,
      code: failedResult.reason,
    },
    { status },
  );
}
