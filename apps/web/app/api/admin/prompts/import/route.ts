import { NextResponse } from "next/server.js";

import {
  importPrompts,
  type PromptImportItemInput,
} from "../../../../../lib/api/prompt-repository.ts";

type ImportErrorCode =
  | "admin_role_required"
  | "invalid_import_payload"
  | "invalid_import_item"
  | "prompt_slug_conflict"
  | "category_not_found";

function resolveCreatorRole(request: Request): "admin" | "user" {
  return request.headers.get("x-user-role")?.trim().toLowerCase() === "admin"
    ? "admin"
    : "user";
}

function resolveCreatorEmail(request: Request): string {
  return request.headers.get("x-user-email")?.trim() ?? "";
}

function toNonEmptyString(input: unknown): string {
  return typeof input === "string" ? input.trim() : "";
}

function generateSlugFromTitle(title: string): string {
  const normalized = title
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
  for (const char of title) {
    hash = (hash * 31 + char.charCodeAt(0)) % 1000000007;
  }
  return `prompt-${Math.abs(hash)}`;
}

function validateImportItems(body: unknown): {
  ok: true;
  items: PromptImportItemInput[];
} | {
  ok: false;
  error: string;
  code: ImportErrorCode;
  itemIndex?: number;
  field?: keyof PromptImportItemInput;
} {
  if (!Array.isArray(body) || body.length === 0) {
    return {
      ok: false,
      error: "import payload must be a non-empty array",
      code: "invalid_import_payload",
    };
  }

  const items: PromptImportItemInput[] = [];
  for (let index = 0; index < body.length; index += 1) {
    const raw = body[index];
    if (!raw || typeof raw !== "object") {
      return {
        ok: false,
        error: "import item must be an object",
        code: "invalid_import_item",
        itemIndex: index,
      };
    }

    const item = raw as Record<string, unknown>;
    const title = toNonEmptyString(item.title);
    const slugInput = toNonEmptyString(item.slug);
    const normalizedItem: PromptImportItemInput = {
      title,
      slug: slugInput || generateSlugFromTitle(title),
      summary: toNonEmptyString(item.summary),
      categorySlug: toNonEmptyString(item.categorySlug) || undefined,
      categorySlugs: Array.isArray(item.categorySlugs)
        ? item.categorySlugs
            .map((slug) => (typeof slug === "string" ? slug.trim() : ""))
            .filter((slug) => slug.length > 0)
        : undefined,
      content: toNonEmptyString(item.content),
    };

    const requiredFields: Array<keyof PromptImportItemInput> = [
      "title",
      "summary",
      "content",
    ];
    for (const field of requiredFields) {
      if (!normalizedItem[field]) {
        return {
          ok: false,
          error: `missing required field: ${field}`,
          code: "invalid_import_item",
          itemIndex: index,
          field,
        };
      }
    }

    items.push(normalizedItem);
  }

  return {
    ok: true,
    items,
  };
}

function mapImportErrorCode(
  code: "forbidden" | "conflict" | "not_found" | "bad_request",
): ImportErrorCode {
  if (code === "forbidden") {
    return "admin_role_required";
  }
  if (code === "conflict") {
    return "prompt_slug_conflict";
  }
  if (code === "not_found") {
    return "category_not_found";
  }
  return "invalid_import_payload";
}

export async function POST(request: Request) {
  if (resolveCreatorRole(request) !== "admin") {
    return NextResponse.json(
      {
        error: "admin role is required",
        code: "admin_role_required",
      },
      { status: 403 },
    );
  }

  const body = (await request.json().catch(() => undefined)) as unknown;
  const validated = validateImportItems(body);
  if (validated.ok === false) {
    return NextResponse.json(
      {
        error: validated.error,
        code: validated.code,
        itemIndex: validated.itemIndex,
        field: validated.field,
      },
      { status: 400 },
    );
  }

  const result = await importPrompts({
    creatorEmail: resolveCreatorEmail(request),
    creatorRole: "admin",
    items: validated.items,
  });
  if (result.ok) {
    return NextResponse.json(result.value, { status: 201 });
  }

  const failedResult = result as {
    ok: false;
    code: "forbidden" | "conflict" | "not_found" | "bad_request";
    message: string;
    itemIndex?: number;
    itemSlug?: string;
  };
  const status =
    failedResult.code === "forbidden"
      ? 403
      : failedResult.code === "conflict"
        ? 409
        : failedResult.code === "not_found"
          ? 404
          : 400;
  return NextResponse.json(
    {
      error: failedResult.message,
      code: mapImportErrorCode(failedResult.code),
      itemIndex: failedResult.itemIndex,
      itemSlug: failedResult.itemSlug,
    },
    { status },
  );
}
