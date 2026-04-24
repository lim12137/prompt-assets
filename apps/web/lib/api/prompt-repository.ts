import { createHmac, timingSafeEqual } from "node:crypto";
import {
  databaseUrl,
  isPgReachable,
  withPgClient,
} from "../../../../packages/db/src/client.ts";
import {
  buildAuditLogEntry,
  buildSubmissionCandidateNo,
  type AuditLogEntry,
  canTransitionReviewStatus,
  nextVersionNo,
} from "../../../../packages/domain/src/index.ts";
import {
  baseCategories,
  pendingSubmissionFixture,
  promptCatalog,
  type PromptVersionFixture,
  type SubmissionFixture,
} from "../../../../tests/fixtures/prompts.ts";
import { writeAuditLog } from "../audit/write-audit-log.ts";
import {
  mapPromptDetail,
  mapPromptListItem,
  type PromptCategoryDto,
  type PromptDetailDto,
  type PromptDetailRaw,
  type PromptListItemDto,
  type PromptVersionStatus,
  type PromptVersionRaw,
} from "./prompt-mappers.ts";

type SqlClient = {
  query: <T extends Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: T[] }>;
};

type ListPromptsQuery = {
  category?: string;
  keyword?: string;
  sort?: string;
};

export type PendingSubmissionListItem = {
  id: number;
  promptSlug: string;
  promptTitle: string;
  promptSummary: string;
  baseVersionNo: string;
  candidateVersionNo: string;
  candidateNo: string;
  revisionIndex: number;
  submitterEmail: string;
  submittedAt: string;
};

type PromptSort = "latest" | "popular" | "liked";

export type PromptLikeMutationResult = {
  slug: string;
  likesCount: number;
  liked: boolean;
};

export type PromptSubmissionMutationInput = {
  userEmail: string;
  content: string;
  changeNote?: string;
};

export type PromptCreateInput = {
  creatorEmail: string;
  creatorRole: "user" | "admin";
  slug: string;
  title: string;
  summary: string;
  categorySlug: string;
  content: string;
};

export type PromptCreateSuccess = {
  prompt: {
    slug: string;
    title: string;
    summary: string;
    categorySlug: string;
    currentVersion: {
      versionNo: string;
      sourceType: "create";
    };
  };
};

export type PromptCreateResult =
  | {
      ok: true;
      value: PromptCreateSuccess;
    }
  | {
      ok: false;
      code: "forbidden" | "conflict" | "not_found" | "bad_request";
      message: string;
    };

export type PromptImportItemInput = {
  slug: string;
  title: string;
  summary: string;
  categorySlug: string;
  content: string;
};

export type PromptImportInput = {
  creatorEmail: string;
  creatorRole: "user" | "admin";
  items: PromptImportItemInput[];
};

export type PromptImportSuccess = {
  total: number;
  mode: "all_or_nothing";
  prompts: PromptCreateSuccess["prompt"][];
};

export type PromptImportResult =
  | {
      ok: true;
      value: PromptImportSuccess;
    }
  | {
      ok: false;
      code: "forbidden" | "conflict" | "not_found" | "bad_request";
      message: string;
      itemIndex?: number;
      itemSlug?: string;
    };

type SubmissionStatus = "pending" | "approved" | "rejected";

export type PromptSubmissionMutationResult = {
  promptSlug: string;
  baseVersion: {
    versionNo: string;
  };
  candidateVersion: {
    versionNo: string;
    sourceType: "submission";
    candidateNo: string;
  };
  submission: {
    id: number;
    status: SubmissionStatus;
    submitter: string;
    revisionIndex: number;
  };
  currentVersion: {
    versionNo: string;
  };
};

type SubmissionCandidateMetadata = {
  baseVersionNo: string;
  candidateVersionNo: string;
  submitter: string;
  revisionIndex: number;
  candidateNo: string;
};

export type PromptSubmissionReviewAction = "approve" | "reject";

export type PromptSubmissionReviewInput = {
  reviewerEmail: string;
  reviewerRole: "user" | "admin";
  reviewComment?: string;
};

export type PromptSubmissionReviewSuccess = {
  submission: {
    id: number;
    status: SubmissionStatus;
    reviewComment?: string;
    reviewedByEmail: string;
  };
  prompt: {
    slug: string;
    currentVersion: {
      versionNo: string;
    };
  };
  candidateVersion: {
    versionNo: string;
  };
};

export type PromptSubmissionReviewResult =
  | {
      ok: true;
      value: PromptSubmissionReviewSuccess;
    }
  | {
      ok: false;
      code: "forbidden" | "not_found" | "conflict";
      message: string;
    };

export type AdminSubmissionListItem = {
  id: number;
  promptSlug: string;
  promptTitle: string;
  baseVersionNo: string;
  candidateVersionNo: string;
  submitterEmail: string;
  status: SubmissionStatus;
  createdAt: string;
};

type AdminSubmissionListQuery = {
  status?: SubmissionStatus;
};

export type AdminCategoryListItem = {
  slug: string;
  name: string;
  isSystem: boolean;
  isSelectable: boolean;
  isCollapsedByDefault: boolean;
  promptCount: number;
};

export type AdminCategoryCreateInput = {
  creatorEmail: string;
  creatorRole: "user" | "admin";
  name: string;
  slug: string;
};

export type AdminCategoryCreateResult =
  | {
      ok: true;
      value: {
        category: AdminCategoryListItem;
      };
    }
  | {
      ok: false;
      code: "forbidden" | "conflict" | "bad_request";
      reason:
        | "admin_role_required"
        | "category_slug_conflict"
        | "invalid_request";
      message: string;
    };

export type AdminCategoryDeleteInput = {
  reviewerEmail: string;
  reviewerRole: "user" | "admin";
  slug: string;
  confirm: boolean;
  confirmationToken?: string;
};

export type AdminCategoryDeletePreview = {
  dryRun: true;
  slug: string;
  impactedPromptCount: number;
  willBeUncategorizedCount: number;
  autoAssignedUncategorizedCount: number;
  confirmationToken: string;
  confirmationExpiresAt: string;
};

export type AdminCategoryDeleteConfirmed = {
  deleted: true;
  slug: string;
  impactedPromptCount: number;
  willBeUncategorizedCount: number;
  autoAssignedUncategorizedCount: number;
};

export type AdminCategoryDeleteResult =
  | {
      ok: true;
      value: AdminCategoryDeletePreview | AdminCategoryDeleteConfirmed;
    }
  | {
      ok: false;
      code: "forbidden" | "not_found" | "bad_request" | "conflict";
      reason:
        | "admin_role_required"
        | "system_category_forbidden"
        | "category_not_found"
        | "category_delete_confirmation_required"
        | "invalid_confirmation_token"
        | "category_delete_conflict";
      message: string;
    };

type DbPromptListRow = {
  slug: string;
  title: string;
  summary: string;
  likes_count: number | string;
  updated_at: string | Date;
  category_slug: string;
  category_name: string;
  categories_json: unknown;
};

type DbPromptDetailHeadRow = {
  id: number | string;
  slug: string;
  title: string;
  summary: string;
  likes_count: number | string;
  updated_at: string | Date;
  current_version_id: number | string | null;
  category_slug: string;
  category_name: string;
  categories_json: unknown;
  current_version_no: string | null;
  current_source_type: string | null;
  current_submitted_at: string | Date | null;
  current_content: string | null;
};

type DbPromptDetailVersionRow = {
  id: number | string;
  version_no: string;
  content: string;
  source_type: string;
  submitted_at: string | Date;
  submission_status: PromptVersionStatus | null;
  submitted_by: string | null;
};

type DbPromptLookupRow = {
  id: number | string;
};

type DbCategoryLookupRow = {
  id: number | string;
};

type DbCategoryDetailLookupRow = {
  id: number | string;
  slug: string;
  name: string;
  is_system: boolean;
  is_selectable: boolean;
  is_collapsed_by_default: boolean;
};

type DbCategoryListRow = {
  slug: string;
  name: string;
  is_system: boolean;
  is_selectable: boolean;
  is_collapsed_by_default: boolean;
  prompt_count: number | string;
};

type DbUserRow = {
  id: number | string;
};

type DbPromptLikesCountRow = {
  likes_count: number | string;
};

type DbPromptSubmissionHeadRow = {
  id: number | string;
  current_version_id: number | string | null;
  current_version_no: string | null;
};

type DbPromptVersionNoRow = {
  version_no: string;
};

type DbPendingSubmissionRow = {
  id: number | string;
  prompt_slug: string;
  prompt_title: string;
  prompt_summary: string;
  base_version_no: string;
  candidate_version_no: string;
  submitter_email: string | null;
  revision_index: number | string;
  submitted_at: string | Date;
};

type DbPromptVersionInsertRow = {
  id: number | string;
  version_no: string;
};

type DbSubmissionInsertRow = {
  id: number | string;
  status: SubmissionStatus;
};

type DbSubmissionCountRow = {
  count: number | string;
};

type DbSubmissionReviewRow = {
  id: number | string;
  status: SubmissionStatus;
  prompt_id: number | string;
  prompt_slug: string;
  current_version_id: number | string | null;
  current_version_no: string | null;
  candidate_version_id: number | string;
  candidate_version_no: string;
};

type DbAdminSubmissionListRow = {
  id: number | string;
  status: SubmissionStatus;
  prompt_slug: string;
  prompt_title: string;
  base_version_no: string;
  candidate_version_no: string;
  submitter_email: string;
  created_at: string | Date;
};

type FixtureSubmissionRecord = SubmissionFixture & {
  id: number;
  reviewedByEmail?: string;
};

type FixturePromptRecord = {
  slug: string;
  title: string;
  summary: string;
  categorySlug: string;
  createdAt: string;
  createdByEmail: string;
};

type CategoryDeleteTokenPayload = {
  slug: string;
  impactedPromptCount: number;
  willBeUncategorizedCount: number;
  autoAssignedUncategorizedCount: number;
  exp: number;
};

const CATEGORY_MAP = new Map(baseCategories.map((item) => [item.slug, item]));
const CATEGORY_DELETE_TOKEN_SECRET =
  process.env.CATEGORY_DELETE_TOKEN_SECRET ??
  "prompt-management-admin-category-delete-secret";
const CATEGORY_DELETE_TOKEN_TTL_MS = 10 * 60 * 1000;
const REQUIRED_TABLES = [
  "users",
  "categories",
  "prompts",
  "prompt_categories",
  "prompt_versions",
  "submissions",
  "prompt_likes",
  "audit_logs",
];
let cachedDbReadable:
  | {
      at: number;
      value: boolean;
    }
  | undefined;
let fixturePromptLikes = createFixtureLikeState();
let fixturePromptVersions = createFixturePromptVersionState();
let fixtureCurrentVersionNoBySlug = createFixtureCurrentVersionState();
let fixtureSubmissions = createFixtureSubmissionState();
let fixtureSubmissionIdSeed = fixtureSubmissions.length;
let fixtureAuditLogs: AuditLogEntry[] = [];
let fixtureCreatedPrompts = new Map<string, FixturePromptRecord>();

function createFixtureLikeState(): Map<string, Set<string>> {
  return new Map(
    promptCatalog
      .filter((prompt) => prompt.status !== "archived")
      .map((prompt) => [prompt.slug, new Set(prompt.likesByEmails ?? [])]),
  );
}

function createFixturePromptVersionState(): Map<string, PromptVersionFixture[]> {
  return new Map(
    promptCatalog
      .filter((prompt) => prompt.status !== "archived")
      .map((prompt) => [
        prompt.slug,
        prompt.versions.map((version) => ({ ...version })),
      ]),
  );
}

function createFixtureCurrentVersionState(): Map<string, string> {
  return new Map(
    promptCatalog
      .filter((prompt) => prompt.status !== "archived")
      .map((prompt) => [prompt.slug, prompt.currentVersionNo]),
  );
}

function createFixtureSubmissionState(): FixtureSubmissionRecord[] {
  return pendingSubmissionFixture.map((item, index) => ({
    ...item,
    id: index + 1,
  }));
}

function findFixturePromptRecord(
  slug: string,
): {
  slug: string;
  title: string;
  summary: string;
  categorySlug: string;
} | null {
  const fromCatalog = promptCatalog.find(
    (item) => item.slug === slug && item.status === "published",
  );
  if (fromCatalog) {
    return {
      slug: fromCatalog.slug,
      title: fromCatalog.title,
      summary: fromCatalog.summary,
      categorySlug: fromCatalog.categorySlug,
    };
  }

  const fromCreated = fixtureCreatedPrompts.get(slug);
  if (!fromCreated) {
    return null;
  }

  return {
    slug: fromCreated.slug,
    title: fromCreated.title,
    summary: fromCreated.summary,
    categorySlug: fromCreated.categorySlug,
  };
}

function getRepositoryDataSourceMode(): "auto" | "fixture" {
  const raw = process.env.PROMPT_REPOSITORY_DATA_SOURCE?.trim().toLowerCase();
  if (raw === "fixture") {
    return "fixture";
  }
  return "auto";
}

function normalizeSort(sort?: string): PromptSort {
  if (sort === "popular" || sort === "liked") {
    return sort;
  }
  return "latest";
}

function asNumber(value: number | string | null | undefined): number {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    return Number(value);
  }
  return 0;
}

function signCategoryDeleteToken(encodedPayload: string): string {
  return createHmac("sha256", CATEGORY_DELETE_TOKEN_SECRET)
    .update(encodedPayload)
    .digest("base64url");
}

function createCategoryDeleteConfirmationToken(input: {
  slug: string;
  impactedPromptCount: number;
  willBeUncategorizedCount: number;
  autoAssignedUncategorizedCount: number;
}): {
  token: string;
  expiresAt: string;
} {
  const exp = Date.now() + CATEGORY_DELETE_TOKEN_TTL_MS;
  const payload: CategoryDeleteTokenPayload = {
    slug: input.slug,
    impactedPromptCount: input.impactedPromptCount,
    willBeUncategorizedCount: input.willBeUncategorizedCount,
    autoAssignedUncategorizedCount: input.autoAssignedUncategorizedCount,
    exp,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf-8").toString(
    "base64url",
  );
  const signature = signCategoryDeleteToken(encodedPayload);
  return {
    token: `${encodedPayload}.${signature}`,
    expiresAt: new Date(exp).toISOString(),
  };
}

function verifyCategoryDeleteConfirmationToken(
  token: string,
): CategoryDeleteTokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) {
    return null;
  }

  const encodedPayload = parts[0] ?? "";
  const providedSignature = parts[1] ?? "";
  if (!encodedPayload || !providedSignature) {
    return null;
  }

  const expectedSignature = signCategoryDeleteToken(encodedPayload);
  const providedBuffer = Buffer.from(providedSignature, "utf-8");
  const expectedBuffer = Buffer.from(expectedSignature, "utf-8");
  if (providedBuffer.length !== expectedBuffer.length) {
    return null;
  }
  if (!timingSafeEqual(providedBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf-8"),
    ) as Partial<CategoryDeleteTokenPayload>;
    if (
      typeof payload.slug !== "string" ||
      typeof payload.impactedPromptCount !== "number" ||
      typeof payload.willBeUncategorizedCount !== "number" ||
      typeof payload.autoAssignedUncategorizedCount !== "number" ||
      typeof payload.exp !== "number"
    ) {
      return null;
    }
    if (payload.exp < Date.now()) {
      return null;
    }

    return {
      slug: payload.slug,
      impactedPromptCount: payload.impactedPromptCount,
      willBeUncategorizedCount: payload.willBeUncategorizedCount,
      autoAssignedUncategorizedCount: payload.autoAssignedUncategorizedCount,
      exp: payload.exp,
    };
  } catch {
    return null;
  }
}

function normalizePromptCategories(
  categoriesInput: unknown,
  fallback: PromptCategoryDto,
): {
  categories: PromptCategoryDto[];
  categorySlugs: string[];
} {
  const categories: PromptCategoryDto[] = [];

  if (Array.isArray(categoriesInput)) {
    for (const item of categoriesInput) {
      if (!item || typeof item !== "object") {
        continue;
      }
      const record = item as Record<string, unknown>;
      const slug = typeof record.slug === "string" ? record.slug : "";
      const name = typeof record.name === "string" ? record.name : "";
      if (!slug || !name) {
        continue;
      }
      categories.push({ slug, name });
    }
  }

  if (categories.length === 0) {
    categories.push(fallback);
  }

  const deduped = new Map<string, PromptCategoryDto>();
  for (const category of categories) {
    deduped.set(category.slug, category);
  }
  const stableCategories = [...deduped.values()];

  return {
    categories: stableCategories,
    categorySlugs: stableCategories.map((item) => item.slug),
  };
}

function normalizeUserEmail(input: string): string {
  return input.trim().toLowerCase();
}

function submissionCandidateScopeKey(input: {
  promptScope: string;
  baseVersionNo: string;
  submitterEmail: string;
}): string {
  return `${input.promptScope}::${input.baseVersionNo}::${normalizeUserEmail(input.submitterEmail)}`;
}

function deriveSubmissionCandidateMetadata(input: {
  baseVersionNo: string;
  candidateVersionNo: string;
  submitterEmail: string;
  revisionIndex: number;
}): SubmissionCandidateMetadata {
  const submitter = normalizeUserEmail(input.submitterEmail);
  return {
    baseVersionNo: input.baseVersionNo,
    candidateVersionNo: input.candidateVersionNo,
    submitter,
    revisionIndex: input.revisionIndex,
    candidateNo: buildSubmissionCandidateNo({
      baseVersionNo: input.baseVersionNo,
      submitter,
      revisionIndex: input.revisionIndex,
    }),
  };
}

function fixtureActorId(email: string): number {
  const normalizedEmail = normalizeUserEmail(email);
  const knownEmails = [
    "admin@example.com",
    "alice@example.com",
    "bob@example.com",
    "carol@example.com",
  ];
  const existingIndex = knownEmails.indexOf(normalizedEmail);
  if (existingIndex >= 0) {
    return existingIndex + 1;
  }

  let hash = 0;
  for (const char of normalizedEmail) {
    hash = (hash * 31 + char.charCodeAt(0)) % 100000;
  }
  return hash + knownEmails.length + 1;
}

function fixturePromptId(slug: string): number {
  const index = promptCatalog.findIndex((item) => item.slug === slug);
  return index >= 0 ? index + 1 : 0;
}

function toReviewStatus(action: PromptSubmissionReviewAction): SubmissionStatus {
  return action === "approve" ? "approved" : "rejected";
}

function getFixturePromptLikes(slug: string): Set<string> | null {
  const likes = fixturePromptLikes.get(slug);
  return likes ?? null;
}

function getFixtureLikesCount(slug: string): number {
  return getFixturePromptLikes(slug)?.size ?? 0;
}

function getFixturePromptVersions(slug: string): PromptVersionFixture[] | null {
  const versions = fixturePromptVersions.get(slug);
  return versions ?? null;
}

function getFixtureCurrentVersionNo(slug: string): string | null {
  const currentVersionNo = fixtureCurrentVersionNoBySlug.get(slug);
  return currentVersionNo ?? null;
}

function toVersionNoNumber(versionNo: string): number {
  const matched = /^v(\d+)$/i.exec(versionNo.trim());
  if (!matched) {
    return -1;
  }
  return Number(matched[1]);
}

function getLatestVersionNoFromFixtures(versions: PromptVersionFixture[]): string {
  const sorted = [...versions].sort((left, right) =>
    compareVersionNoDesc(left.versionNo, right.versionNo),
  );
  return sorted[0]?.versionNo ?? "v0000";
}

function buildFixtureTimestamp(index: number): string {
  const base = Date.UTC(2026, 0, 1, 0, 0, 0);
  return new Date(base + index * 86_400_000).toISOString();
}

function compareVersionNoDesc(left: string, right: string): number {
  const toInt = (value: string) => Number(value.replace(/^v/i, ""));
  return toInt(right) - toInt(left);
}

async function hasPromptTables(client: SqlClient): Promise<boolean> {
  const result = await client.query<{ name: string }>(
    `
      SELECT unnest($1::text[]) AS name
      EXCEPT
      SELECT tablename AS name
      FROM pg_tables
      WHERE schemaname = 'public';
    `,
    [REQUIRED_TABLES],
  );
  return result.rows.length === 0;
}

async function hasMinimumPromptData(client: SqlClient): Promise<boolean> {
  const result = await client.query<{
    has_category: boolean;
    has_published_prompt: boolean;
    has_prompt_version: boolean;
  }>(
    `
      SELECT
        EXISTS (SELECT 1 FROM categories) AS has_category,
        EXISTS (SELECT 1 FROM prompts WHERE status = 'published') AS has_published_prompt,
        EXISTS (SELECT 1 FROM prompt_versions) AS has_prompt_version;
    `,
  );

  const row = result.rows[0];
  if (!row) {
    return false;
  }

  return Boolean(
    row.has_category &&
      row.has_published_prompt &&
      row.has_prompt_version,
  );
}

async function canReadFromDatabase(): Promise<boolean> {
  if (getRepositoryDataSourceMode() === "fixture") {
    return false;
  }

  const now = Date.now();
  if (cachedDbReadable && now - cachedDbReadable.at < 5000) {
    return cachedDbReadable.value;
  }

  if (!(await isPgReachable(databaseUrl, 400))) {
    cachedDbReadable = { at: now, value: false };
    return false;
  }

  try {
    const hasReadableDataSource = await withPgClient(databaseUrl, async (client) => {
      if (!(await hasPromptTables(client))) {
        return false;
      }
      return hasMinimumPromptData(client);
    });
    cachedDbReadable = {
      at: now,
      value: hasReadableDataSource,
    };
    return hasReadableDataSource;
  } catch {
    cachedDbReadable = { at: now, value: false };
    return false;
  }
}

async function listPromptsFromDb(
  query: ListPromptsQuery,
): Promise<PromptListItemDto[]> {
  const conditions = [`p.status = 'published'`];
  const params: unknown[] = [];
  const sort = normalizeSort(query.sort);

  if (query.category) {
    params.push(query.category);
    conditions.push(`
      (
        EXISTS (
          SELECT 1
          FROM prompt_categories pc_filter
          INNER JOIN categories c_filter ON c_filter.id = pc_filter.category_id
          WHERE pc_filter.prompt_id = p.id
            AND c_filter.slug = $${params.length}
        )
        OR (
          NOT EXISTS (
            SELECT 1
            FROM prompt_categories pc_any
            WHERE pc_any.prompt_id = p.id
          )
          AND c.slug = $${params.length}
        )
      )
    `);
  }

  if (query.keyword) {
    params.push(`%${query.keyword}%`);
    conditions.push(
      `(p.title ILIKE $${params.length} OR p.summary ILIKE $${params.length})`,
    );
  }

  const orderBy =
    sort === "latest"
      ? `p.updated_at DESC, p.id DESC`
      : `p.likes_count DESC, p.updated_at DESC, p.id DESC`;

  return withPgClient(databaseUrl, async (client) => {
    const result = await client.query<DbPromptListRow>(
      `
        SELECT
          p.slug,
          p.title,
          p.summary,
          p.likes_count,
          p.updated_at,
          c.slug AS category_slug,
          c.name AS category_name,
          relation_categories.categories_json
        FROM prompts p
        INNER JOIN categories c ON c.id = p.category_id
        LEFT JOIN LATERAL (
          SELECT json_agg(
            json_build_object(
              'slug', c_rel.slug,
              'name', c_rel.name
            )
            ORDER BY c_rel.is_system ASC, c_rel.sort_order ASC, c_rel.id ASC
          ) AS categories_json
          FROM prompt_categories pc_rel
          INNER JOIN categories c_rel ON c_rel.id = pc_rel.category_id
          WHERE pc_rel.prompt_id = p.id
        ) relation_categories ON TRUE
        WHERE ${conditions.join(" AND ")}
        ORDER BY ${orderBy};
      `,
      params,
    );

    return result.rows.map((row) => {
      const normalizedCategories = normalizePromptCategories(row.categories_json, {
        slug: row.category_slug,
        name: row.category_name,
      });
      return mapPromptListItem({
        slug: row.slug,
        title: row.title,
        summary: row.summary,
        likesCount: asNumber(row.likes_count),
        updatedAt: row.updated_at,
        categorySlug: normalizedCategories.categories[0]?.slug ?? row.category_slug,
        categoryName: normalizedCategories.categories[0]?.name ?? row.category_name,
        categories: normalizedCategories.categories,
        categorySlugs: normalizedCategories.categorySlugs,
      });
    });
  });
}

function listPromptsFromFixtures(query: ListPromptsQuery): PromptListItemDto[] {
  const sort = normalizeSort(query.sort);
  const keyword = query.keyword?.trim().toLowerCase();

  const seededRows = promptCatalog
    .filter((prompt) => prompt.status !== "archived")
    .map((prompt, index) =>
      mapPromptListItem({
        slug: prompt.slug,
        title: prompt.title,
        summary: prompt.summary,
        likesCount: getFixtureLikesCount(prompt.slug),
        updatedAt: buildFixtureTimestamp(index),
        categorySlug: prompt.categorySlug,
        categoryName: CATEGORY_MAP.get(prompt.categorySlug)?.name ?? "",
      }),
    )
    .filter((item) => !fixtureCreatedPrompts.has(item.slug));
  const createdRows = [...fixtureCreatedPrompts.values()].map((prompt, index) =>
    mapPromptListItem({
      slug: prompt.slug,
      title: prompt.title,
      summary: prompt.summary,
      likesCount: getFixtureLikesCount(prompt.slug),
      updatedAt: buildFixtureTimestamp(promptCatalog.length + index),
      categorySlug: prompt.categorySlug,
      categoryName: CATEGORY_MAP.get(prompt.categorySlug)?.name ?? "",
    }),
  );
  const rows = [...seededRows, ...createdRows]
    .filter((item) => {
      if (query.category && item.categorySlug !== query.category) {
        return false;
      }
      if (!keyword) {
        return true;
      }
      return (
        item.title.toLowerCase().includes(keyword) ||
        item.summary.toLowerCase().includes(keyword)
      );
    });

  if (sort === "latest") {
    rows.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  } else {
    rows.sort((left, right) => {
      if (right.likesCount !== left.likesCount) {
        return right.likesCount - left.likesCount;
      }
      return right.updatedAt.localeCompare(left.updatedAt);
    });
  }

  return rows;
}

function getFixtureVersionStatus(
  promptSlug: string,
  versionNo: string,
  currentVersionNo: string,
): PromptVersionStatus {
  if (versionNo === currentVersionNo) {
    return "approved";
  }

  const linkedSubmission = fixtureSubmissions.find(
    (item) =>
      item.promptSlug === promptSlug && item.candidateVersionNo === versionNo,
  );

  if (!linkedSubmission) {
    return "approved";
  }

  if (linkedSubmission.status === "rejected") {
    return "rejected";
  }

  if (linkedSubmission.status === "pending") {
    return "pending";
  }

  return "approved";
}

function getPromptDetailFromFixtures(slug: string): PromptDetailDto | null {
  const prompt = findFixturePromptRecord(slug);
  if (!prompt) {
    return null;
  }

  const versionsInState = getFixturePromptVersions(prompt.slug);
  const currentVersionNo = getFixtureCurrentVersionNo(prompt.slug);
  if (!versionsInState || !currentVersionNo) {
    return null;
  }

  const currentVersion = versionsInState.find(
    (version) => version.versionNo === currentVersionNo,
  );
  if (!currentVersion) {
    return null;
  }

  const versions: PromptVersionRaw[] = [...versionsInState]
    .sort((left, right) => compareVersionNoDesc(left.versionNo, right.versionNo))
    .map((version, index) => ({
      versionNo: version.versionNo,
      sourceType: version.sourceType ?? "edit",
      status: getFixtureVersionStatus(
        prompt.slug,
        version.versionNo,
        currentVersionNo,
      ),
      submittedAt: buildFixtureTimestamp(index),
      submittedBy: version.submittedByEmail,
      content: version.content,
    }));

  const raw: PromptDetailRaw = {
    slug: prompt.slug,
    title: prompt.title,
    summary: prompt.summary,
    likesCount: getFixtureLikesCount(prompt.slug),
    updatedAt:
      fixtureCreatedPrompts.get(prompt.slug)?.createdAt ??
      buildFixtureTimestamp(Math.max(promptCatalog.findIndex((item) => item.slug === prompt.slug), 0)),
    categorySlug: prompt.categorySlug,
    categoryName: CATEGORY_MAP.get(prompt.categorySlug)?.name ?? "",
    currentVersionNo: currentVersion.versionNo,
    currentVersionSourceType: currentVersion.sourceType ?? "edit",
    currentVersionSubmittedAt: buildFixtureTimestamp(0),
    currentVersionContent: currentVersion.content,
    versions,
  };

  return mapPromptDetail(raw);
}

async function getPromptDetailFromDb(slug: string): Promise<PromptDetailDto | null> {
  return withPgClient(databaseUrl, async (client) => {
    const headResult = await client.query<DbPromptDetailHeadRow>(
      `
        SELECT
          p.id,
          p.slug,
          p.title,
          p.summary,
          p.likes_count,
          p.updated_at,
          p.current_version_id,
          c.slug AS category_slug,
          c.name AS category_name,
          relation_categories.categories_json,
          cv.version_no AS current_version_no,
          cv.source_type AS current_source_type,
          cv.submitted_at AS current_submitted_at,
          cv.content AS current_content
        FROM prompts p
        INNER JOIN categories c ON c.id = p.category_id
        LEFT JOIN LATERAL (
          SELECT json_agg(
            json_build_object(
              'slug', c_rel.slug,
              'name', c_rel.name
            )
            ORDER BY c_rel.is_system ASC, c_rel.sort_order ASC, c_rel.id ASC
          ) AS categories_json
          FROM prompt_categories pc_rel
          INNER JOIN categories c_rel ON c_rel.id = pc_rel.category_id
          WHERE pc_rel.prompt_id = p.id
        ) relation_categories ON TRUE
        LEFT JOIN prompt_versions cv ON cv.id = p.current_version_id
        WHERE p.slug = $1 AND p.status = 'published'
        LIMIT 1;
      `,
      [slug],
    );

    const head = headResult.rows[0];
    if (!head) {
      return null;
    }

    const versionsResult = await client.query<DbPromptDetailVersionRow>(
      `
        SELECT
          v.id,
          v.version_no,
          v.content,
          v.source_type,
          v.submitted_at,
          s.status AS submission_status,
          COALESCE(submitter.email, v_submitter.email) AS submitted_by
        FROM prompt_versions v
        LEFT JOIN submissions s ON s.candidate_version_id = v.id
        LEFT JOIN users submitter ON submitter.id = s.submitter_id
        LEFT JOIN users v_submitter ON v_submitter.id = v.submitted_by
        WHERE v.prompt_id = $1
        ORDER BY v.created_at DESC, v.id DESC;
      `,
      [head.id],
    );

    const currentVersionId = asNumber(head.current_version_id);
    const versions: PromptVersionRaw[] = versionsResult.rows.map((row) => {
      const versionId = asNumber(row.id);
      let status: PromptVersionStatus = "approved";

      if (versionId === currentVersionId && currentVersionId > 0) {
        status = "approved";
      } else if (row.submission_status === "pending") {
        status = "pending";
      } else if (row.submission_status === "rejected") {
        status = "rejected";
      }

      return {
        versionNo: row.version_no,
        sourceType: row.source_type,
        status,
        submittedAt: row.submitted_at,
        submittedBy: row.submitted_by ?? undefined,
        content: row.content,
      };
    });

    const currentFallback = versions.find((item) => item.status === "approved");
    const currentVersionNo =
      head.current_version_no ?? currentFallback?.versionNo ?? "v0001";
    const currentVersionSourceType =
      head.current_source_type ?? currentFallback?.sourceType ?? "edit";
    const currentVersionSubmittedAt =
      head.current_submitted_at ?? currentFallback?.submittedAt ?? new Date(0);
    const currentVersionContent =
      head.current_content ?? currentFallback?.content ?? "";
    const normalizedCategories = normalizePromptCategories(head.categories_json, {
      slug: head.category_slug,
      name: head.category_name,
    });

    return mapPromptDetail({
      slug: head.slug,
      title: head.title,
      summary: head.summary,
      likesCount: asNumber(head.likes_count),
      updatedAt: head.updated_at,
      categorySlug: normalizedCategories.categories[0]?.slug ?? head.category_slug,
      categoryName: normalizedCategories.categories[0]?.name ?? head.category_name,
      categories: normalizedCategories.categories,
      currentVersionNo,
      currentVersionSourceType,
      currentVersionSubmittedAt,
      currentVersionContent,
      versions,
    });
  });
}

async function listPendingSubmissionsFromDb(): Promise<PendingSubmissionListItem[]> {
  return withPgClient(databaseUrl, async (client) => {
    const result = await client.query<DbPendingSubmissionRow>(
      `
        WITH ranked_submissions AS (
          SELECT
            s.id,
            s.status,
            p.slug AS prompt_slug,
            p.title AS prompt_title,
            p.summary AS prompt_summary,
            base_v.version_no AS base_version_no,
            candidate_v.version_no AS candidate_version_no,
            u.email AS submitter_email,
            candidate_v.submitted_at AS submitted_at,
            ROW_NUMBER() OVER (
              PARTITION BY s.prompt_id, s.base_version_id, s.submitter_id
              ORDER BY s.created_at ASC, s.id ASC
            )::text AS revision_index
          FROM submissions s
          INNER JOIN prompts p ON p.id = s.prompt_id
          INNER JOIN prompt_versions base_v ON base_v.id = s.base_version_id
          INNER JOIN prompt_versions candidate_v ON candidate_v.id = s.candidate_version_id
          LEFT JOIN users u ON u.id = s.submitter_id
        )
        SELECT
          id,
          prompt_slug,
          prompt_title,
          prompt_summary,
          base_version_no,
          candidate_version_no,
          submitter_email,
          revision_index,
          submitted_at
        FROM ranked_submissions
        WHERE status = 'pending'
        ORDER BY submitted_at ASC, id ASC;
      `,
    );

    return result.rows.map((row) => {
      const metadata = deriveSubmissionCandidateMetadata({
        baseVersionNo: row.base_version_no,
        candidateVersionNo: row.candidate_version_no,
        submitterEmail: row.submitter_email ?? "",
        revisionIndex: asNumber(row.revision_index),
      });

      return {
        id: asNumber(row.id),
        promptSlug: row.prompt_slug,
        promptTitle: row.prompt_title,
        promptSummary: row.prompt_summary,
        baseVersionNo: metadata.baseVersionNo,
        candidateVersionNo: metadata.candidateVersionNo,
        candidateNo: metadata.candidateNo,
        revisionIndex: metadata.revisionIndex,
        submitterEmail: metadata.submitter,
        submittedAt: new Date(row.submitted_at).toISOString(),
      };
    });
  });
}

async function findPublishedPromptId(
  client: SqlClient,
  slug: string,
): Promise<number | null> {
  const result = await client.query<DbPromptLookupRow>(
    `
      SELECT id
      FROM prompts
      WHERE slug = $1 AND status = 'published'
      LIMIT 1;
    `,
    [slug],
  );

  const row = result.rows[0];
  if (!row) {
    return null;
  }
  return asNumber(row.id);
}

async function findAnyPromptId(client: SqlClient, slug: string): Promise<number | null> {
  const result = await client.query<DbPromptLookupRow>(
    `
      SELECT id
      FROM prompts
      WHERE slug = $1
      LIMIT 1;
    `,
    [slug],
  );
  const row = result.rows[0];
  if (!row) {
    return null;
  }
  return asNumber(row.id);
}

async function findCategoryId(client: SqlClient, categorySlug: string): Promise<number | null> {
  const result = await client.query<DbCategoryLookupRow>(
    `
      SELECT id
      FROM categories
      WHERE slug = $1
      LIMIT 1;
    `,
    [categorySlug],
  );
  const row = result.rows[0];
  if (!row) {
    return null;
  }
  return asNumber(row.id);
}

async function insertPromptCategoryRelation(
  client: SqlClient,
  promptId: number,
  categoryId: number,
): Promise<void> {
  await client.query(
    `
      INSERT INTO prompt_categories (prompt_id, category_id)
      VALUES ($1, $2)
      ON CONFLICT (prompt_id, category_id) DO NOTHING;
    `,
    [promptId, categoryId],
  );
}

function mapAdminCategoryListItem(row: DbCategoryListRow): AdminCategoryListItem {
  return {
    slug: row.slug,
    name: row.name,
    isSystem: Boolean(row.is_system),
    isSelectable: Boolean(row.is_selectable),
    isCollapsedByDefault: Boolean(row.is_collapsed_by_default),
    promptCount: asNumber(row.prompt_count),
  };
}

async function findCategoryDetailBySlug(
  client: SqlClient,
  slug: string,
  options: { forUpdate?: boolean } = {},
): Promise<DbCategoryDetailLookupRow | null> {
  const lockClause = options.forUpdate ? "FOR UPDATE" : "";
  const result = await client.query<DbCategoryDetailLookupRow>(
    `
      SELECT
        id,
        slug,
        name,
        is_system,
        is_selectable,
        is_collapsed_by_default
      FROM categories
      WHERE slug = $1
      LIMIT 1
      ${lockClause};
    `,
    [slug],
  );
  return result.rows[0] ?? null;
}

async function findUncategorizedCategoryId(client: SqlClient): Promise<number | null> {
  const row = await findCategoryDetailBySlug(client, "uncategorized", {
    forUpdate: true,
  });
  if (!row) {
    return null;
  }
  return asNumber(row.id);
}

async function readCategoryDeleteImpact(
  client: SqlClient,
  categoryId: number,
): Promise<{
  impactedPromptIds: number[];
  willBeUncategorizedPromptIds: number[];
  impactedPromptCount: number;
  willBeUncategorizedCount: number;
  autoAssignedUncategorizedCount: number;
}> {
  const impactedResult = await client.query<{ prompt_id: number | string }>(
    `
      WITH impacted AS (
        SELECT id AS prompt_id
        FROM prompts
        WHERE category_id = $1
        UNION
        SELECT prompt_id
        FROM prompt_categories
        WHERE category_id = $1
      )
      SELECT prompt_id
      FROM impacted
      ORDER BY prompt_id ASC;
    `,
    [categoryId],
  );
  const impactedPromptIds = impactedResult.rows
    .map((row) => asNumber(row.prompt_id))
    .filter((value) => value > 0);

  if (impactedPromptIds.length === 0) {
    return {
      impactedPromptIds: [],
      willBeUncategorizedPromptIds: [],
      impactedPromptCount: 0,
      willBeUncategorizedCount: 0,
      autoAssignedUncategorizedCount: 0,
    };
  }

  const willBeResult = await client.query<{ prompt_id: number | string }>(
    `
      SELECT i.prompt_id
      FROM unnest($1::int[]) AS i(prompt_id)
      WHERE NOT EXISTS (
        SELECT 1
        FROM prompt_categories pc
        WHERE pc.prompt_id = i.prompt_id
          AND pc.category_id <> $2
      )
      ORDER BY i.prompt_id ASC;
    `,
    [impactedPromptIds, categoryId],
  );
  const willBeUncategorizedPromptIds = willBeResult.rows
    .map((row) => asNumber(row.prompt_id))
    .filter((value) => value > 0);

  const impactedPromptCount = impactedPromptIds.length;
  const willBeUncategorizedCount = willBeUncategorizedPromptIds.length;
  return {
    impactedPromptIds,
    willBeUncategorizedPromptIds,
    impactedPromptCount,
    willBeUncategorizedCount,
    autoAssignedUncategorizedCount: willBeUncategorizedCount,
  };
}

function isCategoryDeleteTokenValid(input: {
  token: string;
  slug: string;
  impactedPromptCount: number;
  willBeUncategorizedCount: number;
  autoAssignedUncategorizedCount: number;
}): boolean {
  const payload = verifyCategoryDeleteConfirmationToken(input.token);
  if (!payload) {
    return false;
  }
  return (
    payload.slug === input.slug &&
    payload.impactedPromptCount === input.impactedPromptCount &&
    payload.willBeUncategorizedCount === input.willBeUncategorizedCount &&
    payload.autoAssignedUncategorizedCount === input.autoAssignedUncategorizedCount
  );
}

async function listAdminCategoriesFromDb(): Promise<AdminCategoryListItem[]> {
  return withPgClient(databaseUrl, async (client) => {
    const result = await client.query<DbCategoryListRow>(
      `
        SELECT
          c.slug,
          c.name,
          c.is_system,
          c.is_selectable,
          c.is_collapsed_by_default,
          COALESCE(category_stats.prompt_count, '0') AS prompt_count
        FROM categories c
        LEFT JOIN LATERAL (
          SELECT COUNT(*)::text AS prompt_count
          FROM (
            SELECT p.id AS prompt_id
            FROM prompts p
            WHERE p.category_id = c.id
            UNION
            SELECT pc.prompt_id
            FROM prompt_categories pc
            WHERE pc.category_id = c.id
          ) category_prompts
        ) category_stats ON TRUE
        ORDER BY c.is_system ASC, c.sort_order ASC, c.id ASC;
      `,
    );

    return result.rows.map(mapAdminCategoryListItem);
  });
}

async function createAdminCategoryInDb(
  input: AdminCategoryCreateInput,
): Promise<AdminCategoryCreateResult> {
  if (input.creatorRole !== "admin") {
    return {
      ok: false,
      code: "forbidden",
      reason: "admin_role_required",
      message: "admin role is required",
    };
  }

  const name = input.name.trim();
  const slug = input.slug.trim();
  if (!name || !slug) {
    return {
      ok: false,
      code: "bad_request",
      reason: "invalid_request",
      message: "name and slug are required",
    };
  }

  return withPgClient(databaseUrl, async (client) => {
    await client.query("BEGIN;");
    try {
      const existed = await findCategoryId(client, slug);
      if (existed) {
        await client.query("ROLLBACK;");
        return {
          ok: false,
          code: "conflict",
          reason: "category_slug_conflict",
          message: "category slug already exists",
        };
      }

      const sortOrderResult = await client.query<{ next_sort_order: number | string }>(
        `
          SELECT COALESCE(MAX(sort_order), 0) + 10 AS next_sort_order
          FROM categories;
        `,
      );
      const nextSortOrder = asNumber(sortOrderResult.rows[0]?.next_sort_order);

      const inserted = await client.query<DbCategoryListRow>(
        `
          INSERT INTO categories (
            name,
            slug,
            sort_order,
            status,
            is_system,
            is_selectable,
            is_collapsed_by_default,
            updated_at
          )
          VALUES ($1, $2, $3, 'active', false, true, false, NOW())
          RETURNING
            slug,
            name,
            is_system,
            is_selectable,
            is_collapsed_by_default,
            0::text AS prompt_count;
        `,
        [name, slug, nextSortOrder],
      );

      await client.query("COMMIT;");
      return {
        ok: true,
        value: {
          category: mapAdminCategoryListItem(inserted.rows[0] as DbCategoryListRow),
        },
      };
    } catch (error) {
      await client.query("ROLLBACK;");
      throw error;
    }
  });
}

async function deleteAdminCategoryInDb(
  input: AdminCategoryDeleteInput,
): Promise<AdminCategoryDeleteResult> {
  if (input.reviewerRole !== "admin") {
    return {
      ok: false,
      code: "forbidden",
      reason: "admin_role_required",
      message: "admin role is required",
    };
  }

  const slug = input.slug.trim();
  if (!slug) {
    return {
      ok: false,
      code: "bad_request",
      reason: "invalid_confirmation_token",
      message: "category slug is required",
    };
  }

  return withPgClient(databaseUrl, async (client) => {
    if (!input.confirm) {
      const targetCategory = await findCategoryDetailBySlug(client, slug);
      if (!targetCategory) {
        return {
          ok: false,
          code: "not_found",
          reason: "category_not_found",
          message: "category not found",
        };
      }
      if (targetCategory.is_system) {
        return {
          ok: false,
          code: "forbidden",
          reason: "system_category_forbidden",
          message: "system category cannot be deleted",
        };
      }

      const impact = await readCategoryDeleteImpact(
        client,
        asNumber(targetCategory.id),
      );
      const token = createCategoryDeleteConfirmationToken({
        slug,
        impactedPromptCount: impact.impactedPromptCount,
        willBeUncategorizedCount: impact.willBeUncategorizedCount,
        autoAssignedUncategorizedCount: impact.autoAssignedUncategorizedCount,
      });

      return {
        ok: true,
        value: {
          dryRun: true,
          slug,
          impactedPromptCount: impact.impactedPromptCount,
          willBeUncategorizedCount: impact.willBeUncategorizedCount,
          autoAssignedUncategorizedCount: impact.autoAssignedUncategorizedCount,
          confirmationToken: token.token,
          confirmationExpiresAt: token.expiresAt,
        },
      };
    }

    const confirmationToken = input.confirmationToken?.trim() ?? "";
    if (!confirmationToken) {
      return {
        ok: false,
        code: "bad_request",
        reason: "category_delete_confirmation_required",
        message: "confirmation token is required",
      };
    }

    await client.query("BEGIN;");
    try {
      const targetCategory = await findCategoryDetailBySlug(client, slug, {
        forUpdate: true,
      });
      if (!targetCategory) {
        await client.query("ROLLBACK;");
        return {
          ok: false,
          code: "not_found",
          reason: "category_not_found",
          message: "category not found",
        };
      }
      if (targetCategory.is_system) {
        await client.query("ROLLBACK;");
        return {
          ok: false,
          code: "forbidden",
          reason: "system_category_forbidden",
          message: "system category cannot be deleted",
        };
      }

      const targetCategoryId = asNumber(targetCategory.id);
      const uncategorizedId = await findUncategorizedCategoryId(client);
      if (!uncategorizedId) {
        await client.query("ROLLBACK;");
        return {
          ok: false,
          code: "conflict",
          reason: "category_delete_conflict",
          message: "uncategorized category is missing",
        };
      }

      const impact = await readCategoryDeleteImpact(client, targetCategoryId);
      if (
        !isCategoryDeleteTokenValid({
          token: confirmationToken,
          slug,
          impactedPromptCount: impact.impactedPromptCount,
          willBeUncategorizedCount: impact.willBeUncategorizedCount,
          autoAssignedUncategorizedCount: impact.autoAssignedUncategorizedCount,
        })
      ) {
        await client.query("ROLLBACK;");
        return {
          ok: false,
          code: "bad_request",
          reason: "invalid_confirmation_token",
          message: "invalid confirmation token",
        };
      }

      await client.query(
        `
          DELETE FROM prompt_categories
          WHERE category_id = $1;
        `,
        [targetCategoryId],
      );

      const autoAssignedResult = await client.query<{ prompt_id: number | string }>(
        `
          INSERT INTO prompt_categories (prompt_id, category_id)
          SELECT i.prompt_id, $2
          FROM unnest($1::int[]) AS i(prompt_id)
          WHERE NOT EXISTS (
            SELECT 1
            FROM prompt_categories pc
            WHERE pc.prompt_id = i.prompt_id
          )
          ON CONFLICT (prompt_id, category_id) DO NOTHING
          RETURNING prompt_id;
        `,
        [impact.impactedPromptIds, uncategorizedId],
      );
      const autoAssignedUncategorizedCount = autoAssignedResult.rows.length;

      await client.query(
        `
          UPDATE prompts p
          SET
            category_id = COALESCE(
              (
                SELECT c2.id
                FROM prompt_categories pc2
                INNER JOIN categories c2 ON c2.id = pc2.category_id
                WHERE pc2.prompt_id = p.id
                ORDER BY c2.is_system ASC, c2.sort_order ASC, c2.id ASC
                LIMIT 1
              ),
              $2
            ),
            updated_at = NOW()
          WHERE p.id = ANY($1::int[]);
        `,
        [impact.impactedPromptIds, uncategorizedId],
      );

      const deletedCategoryResult = await client.query<DbCategoryLookupRow>(
        `
          DELETE FROM categories
          WHERE id = $1
          RETURNING id;
        `,
        [targetCategoryId],
      );
      if (deletedCategoryResult.rows.length === 0) {
        await client.query("ROLLBACK;");
        return {
          ok: false,
          code: "conflict",
          reason: "category_delete_conflict",
          message: "category delete conflict",
        };
      }

      await client.query("COMMIT;");
      return {
        ok: true,
        value: {
          deleted: true,
          slug,
          impactedPromptCount: impact.impactedPromptCount,
          willBeUncategorizedCount: impact.willBeUncategorizedCount,
          autoAssignedUncategorizedCount,
        },
      };
    } catch (error) {
      await client.query("ROLLBACK;");
      throw error;
    }
  });
}

async function upsertUserId(client: SqlClient, email: string): Promise<number> {
  const result = await client.query<DbUserRow>(
    `
      INSERT INTO users (email, role)
      VALUES ($1, 'user')
      ON CONFLICT (email)
      DO UPDATE SET email = EXCLUDED.email
      RETURNING id;
    `,
    [email],
  );

  return asNumber(result.rows[0]?.id);
}

async function upsertAdminReviewerId(
  client: SqlClient,
  email: string,
): Promise<number> {
  const result = await client.query<DbUserRow>(
    `
      INSERT INTO users (email, role)
      VALUES ($1, 'admin')
      ON CONFLICT (email)
      DO UPDATE SET email = EXCLUDED.email
      RETURNING id;
    `,
    [email],
  );

  return asNumber(result.rows[0]?.id);
}

async function createPromptInDb(
  input: PromptCreateInput,
): Promise<PromptCreateResult> {
  if (input.creatorRole !== "admin") {
    return {
      ok: false,
      code: "forbidden",
      message: "admin role is required",
    };
  }

  return withPgClient(databaseUrl, async (client) => {
    await client.query("BEGIN;");
    try {
      const existedPromptId = await findAnyPromptId(client, input.slug);
      if (existedPromptId) {
        await client.query("ROLLBACK;");
        return {
          ok: false,
          code: "conflict",
          message: "prompt slug already exists",
        };
      }

      const categoryId = await findCategoryId(client, input.categorySlug);
      if (!categoryId) {
        await client.query("ROLLBACK;");
        return {
          ok: false,
          code: "not_found",
          message: "category not found",
        };
      }

      const creatorId = await upsertAdminReviewerId(client, input.creatorEmail);
      const insertedPrompt = await client.query<DbPromptLookupRow>(
        `
          INSERT INTO prompts
            (slug, title, summary, category_id, status, likes_count, updated_at)
          VALUES ($1, $2, $3, $4, 'published', 0, NOW())
          RETURNING id;
        `,
        [input.slug, input.title, input.summary, categoryId],
      );
      const promptId = asNumber(insertedPrompt.rows[0]?.id);
      await insertPromptCategoryRelation(client, promptId, categoryId);

      const insertedVersion = await client.query<DbPromptVersionInsertRow>(
        `
          INSERT INTO prompt_versions
            (prompt_id, version_no, content, source_type, submitted_by, submitted_at)
          VALUES ($1, 'v0001', $2, 'create', $3, NOW())
          RETURNING id, version_no;
        `,
        [promptId, input.content, creatorId],
      );
      const versionId = asNumber(insertedVersion.rows[0]?.id);
      const versionNo = insertedVersion.rows[0]?.version_no ?? "v0001";

      await client.query(
        `
          UPDATE prompts
          SET current_version_id = $2, updated_at = NOW()
          WHERE id = $1;
        `,
        [promptId, versionId],
      );

      await writeAuditLog(client, {
        actorId: creatorId,
        action: "prompt.created",
        targetType: "prompt",
        targetId: promptId,
        payload: {
          promptSlug: input.slug,
          categorySlug: input.categorySlug,
          versionNo,
        },
      });

      await client.query("COMMIT;");
      return {
        ok: true,
        value: {
          prompt: {
            slug: input.slug,
            title: input.title,
            summary: input.summary,
            categorySlug: input.categorySlug,
            currentVersion: {
              versionNo,
              sourceType: "create",
            },
          },
        },
      };
    } catch (error) {
      await client.query("ROLLBACK;");
      throw error;
    }
  });
}

async function importPromptsInDb(
  input: PromptImportInput,
): Promise<PromptImportResult> {
  if (input.creatorRole !== "admin") {
    return {
      ok: false,
      code: "forbidden",
      message: "admin role is required",
    };
  }

  if (!Array.isArray(input.items) || input.items.length === 0) {
    return {
      ok: false,
      code: "bad_request",
      message: "import items must be a non-empty array",
    };
  }

  const payloadSlugSet = new Set<string>();
  for (let index = 0; index < input.items.length; index += 1) {
    const item = input.items[index];
    if (payloadSlugSet.has(item.slug)) {
      return {
        ok: false,
        code: "bad_request",
        message: "duplicated slug in import payload",
        itemIndex: index,
        itemSlug: item.slug,
      };
    }
    payloadSlugSet.add(item.slug);
  }

  return withPgClient(databaseUrl, async (client) => {
    await client.query("BEGIN;");
    try {
      const validatedItems: Array<
        PromptImportItemInput & {
          categoryId: number;
          itemIndex: number;
        }
      > = [];
      const categoryIdCache = new Map<string, number>();

      for (let index = 0; index < input.items.length; index += 1) {
        const item = input.items[index];
        const existedPromptId = await findAnyPromptId(client, item.slug);
        if (existedPromptId) {
          await client.query("ROLLBACK;");
          return {
            ok: false,
            code: "conflict",
            message: "prompt slug already exists",
            itemIndex: index,
            itemSlug: item.slug,
          };
        }

        let categoryId = categoryIdCache.get(item.categorySlug);
        if (!categoryId) {
          const foundCategoryId = await findCategoryId(client, item.categorySlug);
          if (!foundCategoryId) {
            await client.query("ROLLBACK;");
            return {
              ok: false,
              code: "not_found",
              message: "category not found",
              itemIndex: index,
              itemSlug: item.slug,
            };
          }
          categoryId = foundCategoryId;
          categoryIdCache.set(item.categorySlug, categoryId);
        }

        validatedItems.push({
          ...item,
          categoryId,
          itemIndex: index,
        });
      }

      const creatorId = await upsertAdminReviewerId(client, input.creatorEmail);
      const importedPrompts: PromptCreateSuccess["prompt"][] = [];

      for (const item of validatedItems) {
        const insertedPrompt = await client.query<DbPromptLookupRow>(
          `
            INSERT INTO prompts
              (slug, title, summary, category_id, status, likes_count, updated_at)
            VALUES ($1, $2, $3, $4, 'published', 0, NOW())
            RETURNING id;
          `,
          [item.slug, item.title, item.summary, item.categoryId],
        );
        const promptId = asNumber(insertedPrompt.rows[0]?.id);
        await insertPromptCategoryRelation(client, promptId, item.categoryId);

        const insertedVersion = await client.query<DbPromptVersionInsertRow>(
          `
            INSERT INTO prompt_versions
              (prompt_id, version_no, content, source_type, submitted_by, submitted_at)
            VALUES ($1, 'v0001', $2, 'create', $3, NOW())
            RETURNING id, version_no;
          `,
          [promptId, item.content, creatorId],
        );
        const versionId = asNumber(insertedVersion.rows[0]?.id);
        const versionNo = insertedVersion.rows[0]?.version_no ?? "v0001";

        await client.query(
          `
            UPDATE prompts
            SET current_version_id = $2, updated_at = NOW()
            WHERE id = $1;
          `,
          [promptId, versionId],
        );

        await writeAuditLog(client, {
          actorId: creatorId,
          action: "prompt.created",
          targetType: "prompt",
          targetId: promptId,
          payload: {
            promptSlug: item.slug,
            categorySlug: item.categorySlug,
            versionNo,
          },
        });

        importedPrompts.push({
          slug: item.slug,
          title: item.title,
          summary: item.summary,
          categorySlug: item.categorySlug,
          currentVersion: {
            versionNo,
            sourceType: "create",
          },
        });
      }

      await client.query("COMMIT;");
      return {
        ok: true,
        value: {
          total: importedPrompts.length,
          mode: "all_or_nothing",
          prompts: importedPrompts,
        },
      };
    } catch (error) {
      await client.query("ROLLBACK;");
      throw error;
    }
  });
}

async function readPromptLikesCount(client: SqlClient, promptId: number): Promise<number> {
  const result = await client.query<DbPromptLikesCountRow>(
    `
      SELECT likes_count
      FROM prompts
      WHERE id = $1
      LIMIT 1;
    `,
    [promptId],
  );
  return asNumber(result.rows[0]?.likes_count);
}

async function likePromptInDb(
  slug: string,
  userEmail: string,
): Promise<PromptLikeMutationResult | null> {
  return withPgClient(databaseUrl, async (client) => {
    const promptId = await findPublishedPromptId(client, slug);
    if (!promptId) {
      return null;
    }
    const userId = await upsertUserId(client, userEmail);

    const inserted = await client.query<DbPromptLookupRow>(
      `
        INSERT INTO prompt_likes (prompt_id, user_id)
        VALUES ($1, $2)
        ON CONFLICT (prompt_id, user_id) DO NOTHING
        RETURNING id;
      `,
      [promptId, userId],
    );

    if (inserted.rows.length > 0) {
      await client.query(
        `
          UPDATE prompts
          SET likes_count = likes_count + 1, updated_at = NOW()
          WHERE id = $1;
        `,
        [promptId],
      );
    }

    const likesCount = await readPromptLikesCount(client, promptId);
    await writeAuditLog(client, {
      actorId: userId,
      action: "prompt.liked",
      targetType: "prompt",
      targetId: promptId,
      payload: {
        promptSlug: slug,
        liked: true,
        likesCount,
      },
    });

    return {
      slug,
      likesCount,
      liked: true,
    };
  });
}

async function unlikePromptInDb(
  slug: string,
  userEmail: string,
): Promise<PromptLikeMutationResult | null> {
  return withPgClient(databaseUrl, async (client) => {
    const promptId = await findPublishedPromptId(client, slug);
    if (!promptId) {
      return null;
    }
    const userId = await upsertUserId(client, userEmail);

    const deleted = await client.query<DbPromptLookupRow>(
      `
        DELETE FROM prompt_likes
        WHERE prompt_id = $1 AND user_id = $2
        RETURNING id;
      `,
      [promptId, userId],
    );

    if (deleted.rows.length > 0) {
      await client.query(
        `
          UPDATE prompts
          SET likes_count = GREATEST(likes_count - 1, 0), updated_at = NOW()
          WHERE id = $1;
        `,
        [promptId],
      );
    }

    const likesCount = await readPromptLikesCount(client, promptId);
    await writeAuditLog(client, {
      actorId: userId,
      action: "prompt.unliked",
      targetType: "prompt",
      targetId: promptId,
      payload: {
        promptSlug: slug,
        liked: false,
        likesCount,
      },
    });

    return {
      slug,
      likesCount,
      liked: false,
    };
  });
}

async function createPromptSubmissionInDb(
  slug: string,
  input: PromptSubmissionMutationInput,
): Promise<PromptSubmissionMutationResult | null> {
  return withPgClient(databaseUrl, async (client) => {
    await client.query("BEGIN;");

    try {
      const headResult = await client.query<DbPromptSubmissionHeadRow>(
        `
          SELECT
            p.id,
            p.current_version_id,
            cv.version_no AS current_version_no
          FROM prompts p
          LEFT JOIN prompt_versions cv ON cv.id = p.current_version_id
          WHERE p.slug = $1 AND p.status = 'published'
          LIMIT 1;
        `,
        [slug],
      );

      const head = headResult.rows[0];
      if (!head || !head.current_version_id || !head.current_version_no) {
        await client.query("ROLLBACK;");
        return null;
      }

      const promptId = asNumber(head.id);
      const baseVersionId = asNumber(head.current_version_id);
      const baseVersionNo = head.current_version_no;

      const latestVersionResult = await client.query<DbPromptVersionNoRow>(
        `
          SELECT version_no
          FROM prompt_versions
          WHERE prompt_id = $1
          ORDER BY CAST(REGEXP_REPLACE(version_no, '^v', '') AS integer) DESC, id DESC
          LIMIT 1;
        `,
        [promptId],
      );
      const latestVersionNo = latestVersionResult.rows[0]?.version_no ?? baseVersionNo;
      const candidateVersionNo = nextVersionNo(latestVersionNo);
      const userId = await upsertUserId(client, input.userEmail);
      const revisionCountResult = await client.query<DbSubmissionCountRow>(
        `
          SELECT COUNT(*)::text AS count
          FROM submissions
          WHERE prompt_id = $1 AND base_version_id = $2 AND submitter_id = $3;
        `,
        [promptId, baseVersionId, userId],
      );
      const revisionIndex = asNumber(revisionCountResult.rows[0]?.count) + 1;
      const metadata = deriveSubmissionCandidateMetadata({
        baseVersionNo,
        candidateVersionNo,
        submitterEmail: input.userEmail,
        revisionIndex,
      });

      const insertedVersion = await client.query<DbPromptVersionInsertRow>(
        `
          INSERT INTO prompt_versions
            (prompt_id, version_no, content, change_note, source_type, submitted_by)
          VALUES ($1, $2, $3, $4, 'submission', $5)
          RETURNING id, version_no;
        `,
        [promptId, candidateVersionNo, input.content, input.changeNote ?? null, userId],
      );
      const candidateVersionId = asNumber(insertedVersion.rows[0]?.id);

      const insertedSubmission = await client.query<DbSubmissionInsertRow>(
        `
          INSERT INTO submissions
            (prompt_id, base_version_id, candidate_version_id, submitter_id, status)
          VALUES ($1, $2, $3, $4, 'pending')
          RETURNING id, status;
        `,
        [promptId, baseVersionId, candidateVersionId, userId],
      );
      const submissionId = asNumber(insertedSubmission.rows[0]?.id);
      const submissionStatus = insertedSubmission.rows[0]?.status ?? "pending";

      await writeAuditLog(client, {
        actorId: userId,
        action: "submission.created",
        targetType: "submission",
        targetId: submissionId,
        payload: {
          promptSlug: slug,
          baseVersionNo,
          candidateVersionNo,
        },
      });

      await client.query("COMMIT;");
      return {
        promptSlug: slug,
        baseVersion: {
          versionNo: baseVersionNo,
        },
        candidateVersion: {
          versionNo: metadata.candidateVersionNo,
          sourceType: "submission",
          candidateNo: metadata.candidateNo,
        },
        submission: {
          id: submissionId,
          status: submissionStatus,
          submitter: metadata.submitter,
          revisionIndex: metadata.revisionIndex,
        },
        currentVersion: {
          versionNo: baseVersionNo,
        },
      };
    } catch (error) {
      await client.query("ROLLBACK;");
      throw error;
    }
  });
}

async function reviewPromptSubmissionInDb(
  submissionId: number,
  action: PromptSubmissionReviewAction,
  input: PromptSubmissionReviewInput,
): Promise<PromptSubmissionReviewResult> {
  if (input.reviewerRole !== "admin") {
    return {
      ok: false,
      code: "forbidden",
      message: "admin role is required",
    };
  }

  const targetStatus = toReviewStatus(action);

  return withPgClient(databaseUrl, async (client) => {
    await client.query("BEGIN;");

    try {
      const submissionResult = await client.query<DbSubmissionReviewRow>(
        `
          SELECT
            s.id,
            s.status,
            s.prompt_id,
            p.slug AS prompt_slug,
            p.current_version_id,
            current_v.version_no AS current_version_no,
            s.candidate_version_id,
            cv.version_no AS candidate_version_no
          FROM submissions s
          INNER JOIN prompts p ON p.id = s.prompt_id
          INNER JOIN prompt_versions cv ON cv.id = s.candidate_version_id
          LEFT JOIN prompt_versions current_v ON current_v.id = p.current_version_id
          WHERE s.id = $1
          FOR UPDATE OF s;
        `,
        [submissionId],
      );

      const submission = submissionResult.rows[0];
      if (!submission) {
        await client.query("ROLLBACK;");
        return {
          ok: false,
          code: "not_found",
          message: "submission not found",
        };
      }

      if (!canTransitionReviewStatus(submission.status, targetStatus)) {
        await client.query("ROLLBACK;");
        return {
          ok: false,
          code: "conflict",
          message: "submission is not pending",
        };
      }

      const reviewerId = await upsertAdminReviewerId(client, input.reviewerEmail);
      await client.query(
        `
          UPDATE submissions
          SET
            status = $2,
            reviewed_by = $3,
            review_comment = $4,
            reviewed_at = NOW(),
            updated_at = NOW()
          WHERE id = $1;
        `,
        [
          submissionId,
          targetStatus,
          reviewerId,
          input.reviewComment ?? null,
        ],
      );

      if (targetStatus === "approved") {
        await client.query(
          `
            UPDATE prompts
            SET current_version_id = $2, updated_at = NOW()
            WHERE id = $1;
          `,
          [asNumber(submission.prompt_id), asNumber(submission.candidate_version_id)],
        );
      }

      await writeAuditLog(client, {
        actorId: reviewerId,
        action:
          targetStatus === "approved"
            ? "submission.approved"
            : "submission.rejected",
        targetType: "submission",
        targetId: submissionId,
        payload: {
          promptSlug: submission.prompt_slug,
          candidateVersionNo: submission.candidate_version_no,
          reviewComment: input.reviewComment ?? null,
        },
      });

      await client.query("COMMIT;");
      return {
        ok: true,
        value: {
          submission: {
            id: submissionId,
            status: targetStatus,
            reviewComment: input.reviewComment,
            reviewedByEmail: input.reviewerEmail,
          },
          prompt: {
            slug: submission.prompt_slug,
            currentVersion: {
              versionNo:
                targetStatus === "approved"
                  ? submission.candidate_version_no
                  : submission.current_version_no ?? submission.candidate_version_no,
            },
          },
          candidateVersion: {
            versionNo: submission.candidate_version_no,
          },
        },
      };
    } catch (error) {
      await client.query("ROLLBACK;");
      throw error;
    }
  });
}

function createPromptSubmissionInFixtures(
  slug: string,
  input: PromptSubmissionMutationInput,
): PromptSubmissionMutationResult | null {
  const prompt = findFixturePromptRecord(slug);
  if (!prompt) {
    return null;
  }

  const versions = getFixturePromptVersions(slug);
  const currentVersionNo = getFixtureCurrentVersionNo(slug);
  if (!versions || !currentVersionNo) {
    return null;
  }

  const latestVersionNo = getLatestVersionNoFromFixtures(versions);
  if (toVersionNoNumber(latestVersionNo) < 0) {
    return null;
  }

  const revisionIndex =
    fixtureSubmissions.filter((item) => {
      const leftKey = submissionCandidateScopeKey({
        promptScope: item.promptSlug,
        baseVersionNo: item.baseVersionNo,
        submitterEmail: item.submitterEmail,
      });
      const rightKey = submissionCandidateScopeKey({
        promptScope: slug,
        baseVersionNo: currentVersionNo,
        submitterEmail: input.userEmail,
      });
      return leftKey === rightKey;
    }).length + 1;
  const candidateVersionNo = nextVersionNo(latestVersionNo);
  const resolvedMetadata = deriveSubmissionCandidateMetadata({
    baseVersionNo: currentVersionNo,
    candidateVersionNo,
    submitterEmail: input.userEmail,
    revisionIndex,
  });
  versions.push({
    versionNo: candidateVersionNo,
    content: input.content,
    changeNote: input.changeNote,
    sourceType: "submission",
    submittedByEmail: input.userEmail,
  });
  fixturePromptVersions.set(slug, versions);

  fixtureSubmissionIdSeed += 1;
  fixtureSubmissions.push({
    id: fixtureSubmissionIdSeed,
    promptSlug: slug,
    baseVersionNo: currentVersionNo,
    candidateVersionNo,
    submitterEmail: input.userEmail,
    status: "pending",
    reviewComment: undefined,
  });

  fixtureAuditLogs.push(
    buildAuditLogEntry({
      actorId: fixtureActorId(input.userEmail),
      action: "submission.created",
      targetType: "submission",
      targetId: fixtureSubmissionIdSeed,
      payload: {
        promptSlug: slug,
        baseVersionNo: currentVersionNo,
        candidateVersionNo,
      },
    }),
  );

  return {
    promptSlug: slug,
    baseVersion: {
      versionNo: currentVersionNo,
    },
    candidateVersion: {
      versionNo: resolvedMetadata.candidateVersionNo,
      sourceType: "submission",
      candidateNo: resolvedMetadata.candidateNo,
    },
    submission: {
      id: fixtureSubmissionIdSeed,
      status: "pending",
      submitter: resolvedMetadata.submitter,
      revisionIndex: resolvedMetadata.revisionIndex,
    },
    currentVersion: {
      versionNo: currentVersionNo,
    },
  };
}

function listPendingSubmissionsFromFixtures(): PendingSubmissionListItem[] {
  const revisionBySubmissionId = new Map<number, number>();
  const revisionCounter = new Map<string, number>();

  for (const submission of [...fixtureSubmissions].sort((left, right) => left.id - right.id)) {
    const scopeKey = submissionCandidateScopeKey({
      promptScope: submission.promptSlug,
      baseVersionNo: submission.baseVersionNo,
      submitterEmail: submission.submitterEmail,
    });
    const nextRevision = (revisionCounter.get(scopeKey) ?? 0) + 1;
    revisionCounter.set(scopeKey, nextRevision);
    revisionBySubmissionId.set(submission.id, nextRevision);
  }

  return fixtureSubmissions
    .filter((item) => item.status === "pending")
    .map((item, index) => {
      const prompt = promptCatalog.find((entry) => entry.slug === item.promptSlug);
      const revisionIndex = revisionBySubmissionId.get(item.id) ?? 1;
      const metadata = deriveSubmissionCandidateMetadata({
        baseVersionNo: item.baseVersionNo,
        candidateVersionNo: item.candidateVersionNo,
        submitterEmail: item.submitterEmail,
        revisionIndex,
      });

      return {
        id: item.id,
        promptSlug: item.promptSlug,
        promptTitle: prompt?.title ?? item.promptSlug,
        promptSummary: prompt?.summary ?? "",
        baseVersionNo: metadata.baseVersionNo,
        candidateVersionNo: metadata.candidateVersionNo,
        candidateNo: metadata.candidateNo,
        revisionIndex: metadata.revisionIndex,
        submitterEmail: metadata.submitter,
        submittedAt: buildFixtureTimestamp(index),
      };
    });
}

function reviewPromptSubmissionInFixtures(
  submissionId: number,
  action: PromptSubmissionReviewAction,
  input: PromptSubmissionReviewInput,
): PromptSubmissionReviewResult {
  if (input.reviewerRole !== "admin") {
    return {
      ok: false,
      code: "forbidden",
      message: "admin role is required",
    };
  }

  const submission = fixtureSubmissions.find((item) => item.id === submissionId);
  if (!submission) {
    return {
      ok: false,
      code: "not_found",
      message: "submission not found",
    };
  }

  const targetStatus = toReviewStatus(action);
  if (!canTransitionReviewStatus(submission.status, targetStatus)) {
    return {
      ok: false,
      code: "conflict",
      message: "submission is not pending",
    };
  }

  submission.status = targetStatus;
  submission.reviewComment = input.reviewComment;
  submission.reviewedByEmail = input.reviewerEmail;

  if (targetStatus === "approved") {
    fixtureCurrentVersionNoBySlug.set(
      submission.promptSlug,
      submission.candidateVersionNo,
    );
  }

  fixtureAuditLogs.push(
    buildAuditLogEntry({
      actorId: fixtureActorId(input.reviewerEmail),
      action:
        targetStatus === "approved"
          ? "submission.approved"
          : "submission.rejected",
      targetType: "submission",
      targetId: submission.id,
      payload: {
        promptSlug: submission.promptSlug,
        candidateVersionNo: submission.candidateVersionNo,
        reviewComment: input.reviewComment ?? null,
      },
    }),
  );

  const currentVersionNo =
    getFixtureCurrentVersionNo(submission.promptSlug) ??
    submission.baseVersionNo;

  return {
    ok: true,
    value: {
      submission: {
        id: submission.id,
        status: submission.status,
        reviewComment: submission.reviewComment,
        reviewedByEmail: input.reviewerEmail,
      },
      prompt: {
        slug: submission.promptSlug,
        currentVersion: {
          versionNo: currentVersionNo,
        },
      },
      candidateVersion: {
        versionNo: submission.candidateVersionNo,
      },
    },
  };
}

function createPromptInFixtures(input: PromptCreateInput): PromptCreateResult {
  if (input.creatorRole !== "admin") {
    return {
      ok: false,
      code: "forbidden",
      message: "admin role is required",
    };
  }

  const existed = findFixturePromptRecord(input.slug);
  if (existed) {
    return {
      ok: false,
      code: "conflict",
      message: "prompt slug already exists",
    };
  }

  if (!CATEGORY_MAP.has(input.categorySlug)) {
    return {
      ok: false,
      code: "not_found",
      message: "category not found",
    };
  }

  const createdAt = new Date().toISOString();
  fixtureCreatedPrompts.set(input.slug, {
    slug: input.slug,
    title: input.title,
    summary: input.summary,
    categorySlug: input.categorySlug,
    createdAt,
    createdByEmail: input.creatorEmail,
  });
  fixturePromptVersions.set(input.slug, [
    {
      versionNo: "v0001",
      content: input.content,
      sourceType: "create",
      submittedByEmail: input.creatorEmail,
    },
  ]);
  fixtureCurrentVersionNoBySlug.set(input.slug, "v0001");
  fixturePromptLikes.set(input.slug, new Set<string>());

  const promptId = fixturePromptId(input.slug) || promptCatalog.length + fixtureCreatedPrompts.size;
  fixtureAuditLogs.push(
    buildAuditLogEntry({
      actorId: fixtureActorId(input.creatorEmail),
      action: "prompt.created",
      targetType: "prompt",
      targetId: promptId,
      payload: {
        promptSlug: input.slug,
        categorySlug: input.categorySlug,
        versionNo: "v0001",
      },
    }),
  );

  return {
    ok: true,
    value: {
      prompt: {
        slug: input.slug,
        title: input.title,
        summary: input.summary,
        categorySlug: input.categorySlug,
        currentVersion: {
          versionNo: "v0001",
          sourceType: "create",
        },
      },
    },
  };
}

function importPromptsInFixtures(
  input: PromptImportInput,
): PromptImportResult {
  if (input.creatorRole !== "admin") {
    return {
      ok: false,
      code: "forbidden",
      message: "admin role is required",
    };
  }

  if (!Array.isArray(input.items) || input.items.length === 0) {
    return {
      ok: false,
      code: "bad_request",
      message: "import items must be a non-empty array",
    };
  }

  const payloadSlugSet = new Set<string>();
  for (let index = 0; index < input.items.length; index += 1) {
    const item = input.items[index];
    if (payloadSlugSet.has(item.slug)) {
      return {
        ok: false,
        code: "bad_request",
        message: "duplicated slug in import payload",
        itemIndex: index,
        itemSlug: item.slug,
      };
    }
    payloadSlugSet.add(item.slug);

    if (findFixturePromptRecord(item.slug)) {
      return {
        ok: false,
        code: "conflict",
        message: "prompt slug already exists",
        itemIndex: index,
        itemSlug: item.slug,
      };
    }

    if (!CATEGORY_MAP.has(item.categorySlug)) {
      return {
        ok: false,
        code: "not_found",
        message: "category not found",
        itemIndex: index,
        itemSlug: item.slug,
      };
    }
  }

  const importedPrompts: PromptCreateSuccess["prompt"][] = [];
  for (const item of input.items) {
    const created = createPromptInFixtures({
      creatorEmail: input.creatorEmail,
      creatorRole: "admin",
      slug: item.slug,
      title: item.title,
      summary: item.summary,
      categorySlug: item.categorySlug,
      content: item.content,
    });
    if (!created.ok) {
      const failedCreate = created as {
        ok: false;
        code: "forbidden" | "conflict" | "not_found" | "bad_request";
        message: string;
      };
      return {
        ok: false,
        code: failedCreate.code,
        message: failedCreate.message,
      };
    }
    importedPrompts.push(created.value.prompt);
  }

  return {
    ok: true,
    value: {
      total: importedPrompts.length,
      mode: "all_or_nothing",
      prompts: importedPrompts,
    },
  };
}

async function listAdminSubmissionsFromDb(
  query: AdminSubmissionListQuery,
): Promise<AdminSubmissionListItem[]> {
  return withPgClient(databaseUrl, async (client) => {
    const params: unknown[] = [];
    const conditions: string[] = [];
    if (query.status) {
      params.push(query.status);
      conditions.push(`s.status = $${params.length}`);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const result = await client.query<DbAdminSubmissionListRow>(
      `
        SELECT
          s.id,
          s.status,
          p.slug AS prompt_slug,
          p.title AS prompt_title,
          base_v.version_no AS base_version_no,
          candidate_v.version_no AS candidate_version_no,
          submitter.email AS submitter_email,
          s.created_at
        FROM submissions s
        INNER JOIN prompts p ON p.id = s.prompt_id
        INNER JOIN prompt_versions base_v ON base_v.id = s.base_version_id
        INNER JOIN prompt_versions candidate_v ON candidate_v.id = s.candidate_version_id
        INNER JOIN users submitter ON submitter.id = s.submitter_id
        ${whereClause}
        ORDER BY s.created_at ASC, s.id ASC;
      `,
      params,
    );

    return result.rows.map((row) => ({
      id: asNumber(row.id),
      status: row.status,
      promptSlug: row.prompt_slug,
      promptTitle: row.prompt_title,
      baseVersionNo: row.base_version_no,
      candidateVersionNo: row.candidate_version_no,
      submitterEmail: row.submitter_email,
      createdAt: new Date(row.created_at).toISOString(),
    }));
  });
}

function listAdminSubmissionsFromFixtures(
  query: AdminSubmissionListQuery,
): AdminSubmissionListItem[] {
  const status = query.status;

  return fixtureSubmissions
    .filter((item) => (status ? item.status === status : true))
    .sort((left, right) => left.id - right.id)
    .map((item, index) => {
      const prompt = promptCatalog.find((promptItem) => promptItem.slug === item.promptSlug);
      return {
        id: item.id,
        status: item.status,
        promptSlug: item.promptSlug,
        promptTitle: prompt?.title ?? item.promptSlug,
        baseVersionNo: item.baseVersionNo,
        candidateVersionNo: item.candidateVersionNo,
        submitterEmail: item.submitterEmail,
        createdAt: buildFixtureTimestamp(index),
      };
    });
}

function likePromptInFixtures(
  slug: string,
  userEmail: string,
): PromptLikeMutationResult | null {
  const prompt = promptCatalog.find(
    (item) => item.slug === slug && item.status !== "archived",
  );
  if (!prompt) {
    return null;
  }

  const normalizedEmail = normalizeUserEmail(userEmail);
  const likes = getFixturePromptLikes(slug) ?? new Set<string>();
  likes.add(normalizedEmail);
  fixturePromptLikes.set(slug, likes);

  fixtureAuditLogs.push(
    buildAuditLogEntry({
      actorId: fixtureActorId(normalizedEmail),
      action: "prompt.liked",
      targetType: "prompt",
      targetId: fixturePromptId(slug),
      payload: {
        promptSlug: slug,
        liked: true,
        likesCount: likes.size,
      },
    }),
  );

  return {
    slug,
    likesCount: likes.size,
    liked: true,
  };
}

function unlikePromptInFixtures(
  slug: string,
  userEmail: string,
): PromptLikeMutationResult | null {
  const prompt = promptCatalog.find(
    (item) => item.slug === slug && item.status !== "archived",
  );
  if (!prompt) {
    return null;
  }

  const normalizedEmail = normalizeUserEmail(userEmail);
  const likes = getFixturePromptLikes(slug) ?? new Set<string>();
  likes.delete(normalizedEmail);
  fixturePromptLikes.set(slug, likes);

  fixtureAuditLogs.push(
    buildAuditLogEntry({
      actorId: fixtureActorId(normalizedEmail),
      action: "prompt.unliked",
      targetType: "prompt",
      targetId: fixturePromptId(slug),
      payload: {
        promptSlug: slug,
        liked: false,
        likesCount: likes.size,
      },
    }),
  );

  return {
    slug,
    likesCount: likes.size,
    liked: false,
  };
}

export function __resetPromptLikeFixtureStateForTests(): void {
  fixturePromptLikes = createFixtureLikeState();
  fixturePromptVersions = createFixturePromptVersionState();
  fixtureCurrentVersionNoBySlug = createFixtureCurrentVersionState();
  fixtureSubmissions = createFixtureSubmissionState();
  fixtureSubmissionIdSeed = fixtureSubmissions.length;
  fixtureAuditLogs = [];
  fixtureCreatedPrompts = new Map<string, FixturePromptRecord>();
  cachedDbReadable = undefined;
}

export function __getAuditLogFixtureStateForTests(): AuditLogEntry[] {
  return fixtureAuditLogs.map((entry) => ({
    ...entry,
    payloadJson: { ...entry.payloadJson },
  }));
}

export async function likePrompt(
  slug: string,
  userEmail: string,
): Promise<PromptLikeMutationResult | null> {
  const normalizedEmail = normalizeUserEmail(userEmail);
  if (!normalizedEmail) {
    return null;
  }

  if (await canReadFromDatabase()) {
    return likePromptInDb(slug, normalizedEmail);
  }

  return likePromptInFixtures(slug, normalizedEmail);
}

export async function unlikePrompt(
  slug: string,
  userEmail: string,
): Promise<PromptLikeMutationResult | null> {
  const normalizedEmail = normalizeUserEmail(userEmail);
  if (!normalizedEmail) {
    return null;
  }

  if (await canReadFromDatabase()) {
    return unlikePromptInDb(slug, normalizedEmail);
  }

  return unlikePromptInFixtures(slug, normalizedEmail);
}

export async function createPromptSubmission(
  slug: string,
  input: PromptSubmissionMutationInput,
): Promise<PromptSubmissionMutationResult | null> {
  const normalizedEmail = normalizeUserEmail(input.userEmail);
  if (!normalizedEmail) {
    return null;
  }

  const normalizedInput: PromptSubmissionMutationInput = {
    userEmail: normalizedEmail,
    content: input.content,
    changeNote: input.changeNote,
  };

  if (await canReadFromDatabase()) {
    return createPromptSubmissionInDb(slug, normalizedInput);
  }
  return createPromptSubmissionInFixtures(slug, normalizedInput);
}

export async function createPrompt(
  input: PromptCreateInput,
): Promise<PromptCreateResult> {
  const normalizedEmail = normalizeUserEmail(input.creatorEmail);
  if (!normalizedEmail) {
    return {
      ok: false,
      code: "bad_request",
      message: "creator email is required",
    };
  }

  const normalizedInput: PromptCreateInput = {
    ...input,
    creatorEmail: normalizedEmail,
  };

  if (await canReadFromDatabase()) {
    return createPromptInDb(normalizedInput);
  }
  return createPromptInFixtures(normalizedInput);
}

export async function importPrompts(
  input: PromptImportInput,
): Promise<PromptImportResult> {
  const normalizedEmail = normalizeUserEmail(input.creatorEmail);
  if (!normalizedEmail) {
    return {
      ok: false,
      code: "bad_request",
      message: "creator email is required",
    };
  }

  const normalizedItems = Array.isArray(input.items)
    ? input.items.map((item) => ({
        slug: item.slug.trim(),
        title: item.title.trim(),
        summary: item.summary.trim(),
        categorySlug: item.categorySlug.trim(),
        content: item.content.trim(),
      }))
    : [];

  const normalizedInput: PromptImportInput = {
    creatorEmail: normalizedEmail,
    creatorRole: input.creatorRole,
    items: normalizedItems,
  };

  if (await canReadFromDatabase()) {
    return importPromptsInDb(normalizedInput);
  }
  return importPromptsInFixtures(normalizedInput);
}

export async function listAdminCategories(): Promise<AdminCategoryListItem[]> {
  return listAdminCategoriesFromDb();
}

export async function createAdminCategory(
  input: AdminCategoryCreateInput,
): Promise<AdminCategoryCreateResult> {
  const normalizedEmail = normalizeUserEmail(input.creatorEmail);
  const normalizedInput: AdminCategoryCreateInput = {
    creatorEmail: normalizedEmail,
    creatorRole: input.creatorRole,
    name: input.name.trim(),
    slug: input.slug.trim(),
  };
  return createAdminCategoryInDb(normalizedInput);
}

export async function deleteAdminCategory(
  input: AdminCategoryDeleteInput,
): Promise<AdminCategoryDeleteResult> {
  const normalizedEmail = normalizeUserEmail(input.reviewerEmail);
  const normalizedInput: AdminCategoryDeleteInput = {
    reviewerEmail: normalizedEmail,
    reviewerRole: input.reviewerRole,
    slug: input.slug.trim(),
    confirm: input.confirm,
    confirmationToken: input.confirmationToken?.trim(),
  };
  return deleteAdminCategoryInDb(normalizedInput);
}

export async function reviewPromptSubmission(
  submissionId: number,
  action: PromptSubmissionReviewAction,
  input: PromptSubmissionReviewInput,
): Promise<PromptSubmissionReviewResult> {
  const normalizedEmail = normalizeUserEmail(input.reviewerEmail);
  if (!normalizedEmail) {
    return {
      ok: false,
      code: "forbidden",
      message: "reviewer email is required",
    };
  }

  const normalizedInput: PromptSubmissionReviewInput = {
    reviewerEmail: normalizedEmail,
    reviewerRole: input.reviewerRole,
    reviewComment: input.reviewComment,
  };

  if (await canReadFromDatabase()) {
    return reviewPromptSubmissionInDb(submissionId, action, normalizedInput);
  }
  return reviewPromptSubmissionInFixtures(submissionId, action, normalizedInput);
}

export async function listPrompts(
  query: ListPromptsQuery = {},
): Promise<PromptListItemDto[]> {
  if (await canReadFromDatabase()) {
    return listPromptsFromDb(query);
  }
  return listPromptsFromFixtures(query);
}

export async function listAdminSubmissions(
  query: AdminSubmissionListQuery = {},
): Promise<AdminSubmissionListItem[]> {
  if (await canReadFromDatabase()) {
    return listAdminSubmissionsFromDb(query);
  }
  return listAdminSubmissionsFromFixtures(query);
}

export async function getPromptDetail(slug: string): Promise<PromptDetailDto | null> {
  if (await canReadFromDatabase()) {
    return getPromptDetailFromDb(slug);
  }
  return getPromptDetailFromFixtures(slug);
}

export async function listPendingSubmissions(): Promise<PendingSubmissionListItem[]> {
  if (await canReadFromDatabase()) {
    return listPendingSubmissionsFromDb();
  }
  return listPendingSubmissionsFromFixtures();
}
