import { createHash, createHmac, timingSafeEqual } from "node:crypto";
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
  categories?: string[];
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

export type PromptVersionLikeMutationResult = {
  slug: string;
  versionNo: string;
  likesCount: number;
  liked: boolean;
};

export type PromptVersionLikeTarget = {
  promptId: number;
  promptSlug: string;
  versionId: number;
  versionNo: string;
  likesCount: number;
};

export type PromptVersionScoreMutationInput = {
  scene: string;
  traceId?: string;
  score: number;
};

export type PromptVersionScoreMutationResult = {
  slug: string;
  versionNo: string;
  scene: string;
  traceId: string;
  score: number;
};

export type PromptVersionInteractionAction = "like" | "score";
export type PromptVersionDailyInteractionResult =
  | "ok"
  | "not_found"
  | "limited"
  | "missing_infrastructure";

export type PromptVersionScoreStatsResult = {
  slug: string;
  versionNo: string;
  scene?: string;
  totalScores: number;
  averageScore: number;
  lowScoreRate: number;
  distribution: {
    "1": number;
    "2": number;
    "3": number;
    "4": number;
    "5": number;
  };
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
  categorySlug?: string;
  categorySlugs?: string[];
  content: string;
};

export type PromptCreateSuccess = {
  prompt: {
    slug: string;
    title: string;
    summary: string;
    status: "draft" | "published" | "archived";
    categorySlug: string;
    categories: PromptCategoryDto[];
    categorySlugs: string[];
    currentVersion: {
      versionNo: string;
      sourceType: "create";
    };
  };
  submission?: {
    id: number;
    status: SubmissionStatus;
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
  categorySlug?: string;
  categorySlugs?: string[];
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

export type PromptLifecycleStatus = "draft" | "published" | "archived";

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

export type AdminPromptListItem = {
  slug: string;
  title: string;
  summary: string;
  status: PromptLifecycleStatus;
  updatedAt: string;
  category: PromptCategoryDto;
  categories: PromptCategoryDto[];
  categorySlugs: string[];
};

type AdminPromptListQuery = {
  status?: PromptLifecycleStatus;
  category?: string;
  keyword?: string;
};

export type AdminPromptCategoryUpdateInput = {
  reviewerEmail: string;
  reviewerRole: "user" | "admin";
  slug: string;
  categorySlugs: string[];
  primaryCategorySlug: string;
};

export type AdminPromptCategoryUpdateResult =
  | {
      ok: true;
      value: {
        prompt: AdminPromptListItem;
      };
    }
  | {
      ok: false;
      code: "forbidden" | "not_found" | "bad_request";
      reason:
        | "admin_role_required"
        | "prompt_not_found"
        | "invalid_request"
        | "category_not_found"
        | "primary_category_required"
        | "primary_category_missing_from_categories";
      message: string;
    };

export type AdminPromptBatchCategoryUpdateInput = {
  reviewerEmail: string;
  reviewerRole: "user" | "admin";
  slugs: string[];
  addCategorySlugs: string[];
  removeCategorySlugs: string[];
};

export type AdminPromptBatchCategoryUpdateResult =
  | {
      ok: true;
      value: {
        prompts: AdminPromptListItem[];
      };
    }
  | {
      ok: false;
      code: "forbidden" | "not_found" | "bad_request";
      reason:
        | "admin_role_required"
        | "prompt_not_found"
        | "invalid_request"
        | "category_not_found";
      message: string;
    };

type AdminPromptStatusAction = "archive" | "restore";

export type AdminPromptStatusMutationInput = {
  reviewerEmail: string;
  reviewerRole: "user" | "admin";
  slug: string;
};

export type AdminPromptStatusMutationResult =
  | {
      ok: true;
      value: {
        prompt: AdminPromptListItem;
      };
    }
  | {
      ok: false;
      code: "forbidden" | "not_found" | "conflict";
      reason:
        | "admin_role_required"
        | "prompt_not_found"
        | "prompt_status_transition_not_allowed";
      message: string;
    };

export type AdminPromptDeleteInput = {
  reviewerEmail: string;
  reviewerRole: "user" | "admin";
  slug: string;
  confirm: boolean;
  confirmationToken?: string;
  reason?: string;
};

export type AdminPromptDeletePreview = {
  dryRun: true;
  slug: string;
  title: string;
  status: PromptLifecycleStatus;
  primaryCategory: PromptCategoryDto;
  categories: PromptCategoryDto[];
  relatedCounts: {
    versions: number;
    submissions: number;
    likes: number;
    versionLikes: number;
    versionScores: number;
    dailyInteractions: number;
  };
  confirmationToken: string;
  confirmationExpiresAt: string;
};

export type AdminPromptDeleteConfirmed = {
  deleted: true;
  slug: string;
  deletedCounts: AdminPromptDeletePreview["relatedCounts"];
};

export type AdminPromptDeleteResult =
  | {
      ok: true;
      value: AdminPromptDeletePreview | AdminPromptDeleteConfirmed;
    }
  | {
      ok: false;
      code: "forbidden" | "not_found" | "bad_request";
      reason:
        | "admin_role_required"
        | "prompt_not_found"
        | "prompt_delete_confirmation_required"
        | "invalid_confirmation_token";
      message: string;
    };

export type AdminPromptBatchDeleteInput = {
  reviewerEmail: string;
  reviewerRole: "user" | "admin";
  slugs: string[];
  dryRun: boolean;
  confirm: boolean;
  confirmationToken?: string;
  reason?: string;
};

export type AdminPromptBatchDeletePreview = {
  dryRun: true;
  slugs: string[];
  foundPrompts: Array<{
    slug: string;
    title: string;
    status: PromptLifecycleStatus;
    primaryCategory: PromptCategoryDto;
    categories: PromptCategoryDto[];
    relatedCounts: AdminPromptDeletePreview["relatedCounts"];
  }>;
  summary: AdminPromptDeletePreview["relatedCounts"] & {
    prompts: number;
  };
  confirmationToken: string;
  confirmationExpiresAt: string;
};

export type AdminPromptBatchDeleteConfirmed = {
  deleted: true;
  slugs: string[];
  deletedCounts: AdminPromptBatchDeletePreview["summary"];
};

export type AdminPromptBatchDeleteResult =
  | {
      ok: true;
      value: AdminPromptBatchDeletePreview | AdminPromptBatchDeleteConfirmed;
    }
  | {
      ok: false;
      code: "forbidden" | "not_found" | "bad_request";
      reason:
        | "admin_role_required"
        | "prompt_not_found"
        | "invalid_request"
        | "prompt_delete_confirmation_required"
        | "invalid_confirmation_token";
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
  current_version_content: string | null;
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
  likes_count: number | string;
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

type DbCategoryResolveRow = {
  id: number | string;
  slug: string;
  name: string;
  is_system: boolean;
};

type DbCategoryListRow = {
  slug: string;
  name: string;
  is_system: boolean;
  is_selectable: boolean;
  is_collapsed_by_default: boolean;
  prompt_count: number | string;
};

type DbAdminPromptListRow = {
  slug: string;
  title: string;
  summary: string;
  status: PromptLifecycleStatus;
  updated_at: string | Date;
  category_slug: string;
  category_name: string;
  categories_json: unknown;
};

type DbPromptHeadRow = {
  id: number | string;
  slug: string;
  title: string;
  summary: string;
  status: PromptLifecycleStatus;
  updated_at: string | Date;
  category_slug: string;
  category_name: string;
  categories_json: unknown;
};

type DbPromptDeleteCountsRow = {
  versions: number | string;
  submissions: number | string;
  likes: number | string;
  version_likes: number | string;
  version_scores: number | string;
  daily_interactions: number | string;
};

type DbUserRow = {
  id: number | string;
};

type DbPromptLikesCountRow = {
  likes_count: number | string;
};

type DbPromptVersionLikeTargetRow = {
  prompt_id: number | string;
  prompt_slug: string;
  version_id: number | string;
  version_no: string;
  likes_count: number | string;
};

type DbPromptVersionScoreStatsRow = {
  total_scores: number | string;
  average_score: number | string | null;
  count_1: number | string;
  count_2: number | string;
  count_3: number | string;
  count_4: number | string;
  count_5: number | string;
  low_score_count: number | string;
};

type DbPromptVersionDailyInteractionInsertRow = {
  id: number | string;
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
  categorySlugs: string[];
  status: "draft" | "published" | "archived";
  createdAt: string;
  createdByEmail: string;
};

type FixturePromptVersionScoreRecord = {
  slug: string;
  versionNo: string;
  scene: string;
  traceId: string;
  score: number;
  userEmail: string;
};

type CategoryDeleteTokenPayload = {
  slug: string;
  impactedPromptCount: number;
  willBeUncategorizedCount: number;
  autoAssignedUncategorizedCount: number;
  exp: number;
};

type PromptDeleteTokenPayload = {
  slug: string;
  relatedCounts: AdminPromptDeletePreview["relatedCounts"];
  exp: number;
};

type PromptBatchDeleteTokenPayload = {
  slugs: string[];
  summary: AdminPromptBatchDeletePreview["summary"];
  exp: number;
};

const UNCATEGORIZED_CATEGORY = {
  slug: "uncategorized",
  name: "待分类",
  sortOrder: 0,
  status: "active",
} as const;
const SYSTEM_CATEGORY_SLUGS = new Set<string>([UNCATEGORIZED_CATEGORY.slug]);
const FIXTURE_CATEGORY_BASELINE = [
  ...baseCategories,
  UNCATEGORIZED_CATEGORY,
] as const;
const CATEGORY_MAP = new Map(
  FIXTURE_CATEGORY_BASELINE.map((item) => [item.slug, item]),
);
const CATEGORY_DELETE_TOKEN_SECRET =
  process.env.CATEGORY_DELETE_TOKEN_SECRET ??
  "prompt-management-admin-category-delete-secret";
const CATEGORY_DELETE_TOKEN_TTL_MS = 10 * 60 * 1000;
const PROMPT_DELETE_TOKEN_SECRET =
  process.env.PROMPT_DELETE_TOKEN_SECRET ??
  "prompt-management-admin-prompt-delete-secret";
const PROMPT_DELETE_TOKEN_TTL_MS = 10 * 60 * 1000;
const REQUIRED_TABLES = [
  "users",
  "categories",
  "prompts",
  "prompt_categories",
  "prompt_versions",
  "prompt_version_daily_interactions",
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
let fixturePromptVersionLikes = createFixturePromptVersionLikeState();
let fixturePromptVersionScores = createFixturePromptVersionScoreState();
let fixturePromptVersionDailyInteractions = createFixturePromptVersionDailyInteractionState();
let fixturePromptVersions = createFixturePromptVersionState();
let fixtureCurrentVersionNoBySlug = createFixtureCurrentVersionState();
let fixtureSubmissions = createFixtureSubmissionState();
let fixtureSubmissionIdSeed = fixtureSubmissions.length;
let fixtureAuditLogs: AuditLogEntry[] = [];
let fixtureCreatedPrompts = new Map<string, FixturePromptRecord>();
let fixtureDeletedPrompts = new Set<string>();
let promptVersionLikeTargetLookupCountForTests = 0;
let promptVersionLikesCountReadCountForTests = 0;

function getRuntimeDatabaseUrl(): string {
  const runtime = process.env.DATABASE_URL?.trim();
  return runtime && runtime.length > 0 ? runtime : databaseUrl;
}

function createFixtureLikeState(): Map<string, Set<string>> {
  return new Map(
    promptCatalog
      .filter((prompt) => prompt.status !== "archived")
      .map((prompt) => [prompt.slug, new Set(prompt.likesByEmails ?? [])]),
  );
}

function createFixturePromptVersionLikeState(): Map<string, Set<string>> {
  const state = new Map<string, Set<string>>();

  for (const prompt of promptCatalog.filter((item) => item.status !== "archived")) {
    for (const version of prompt.versions) {
      state.set(buildFixturePromptVersionLikeKey(prompt.slug, version.versionNo), new Set());
    }
  }

  return state;
}

function createFixturePromptVersionScoreState(): Map<string, FixturePromptVersionScoreRecord> {
  return new Map<string, FixturePromptVersionScoreRecord>();
}

function createFixturePromptVersionDailyInteractionState(): Set<string> {
  return new Set<string>();
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
  categorySlugs: string[];
} | null {
  if (fixtureDeletedPrompts.has(slug)) {
    return null;
  }

  const fromCreated = fixtureCreatedPrompts.get(slug);
  if (fromCreated) {
    if (fromCreated.status !== "published") {
      return null;
    }
    return {
      slug: fromCreated.slug,
      title: fromCreated.title,
      summary: fromCreated.summary,
      categorySlug: fromCreated.categorySlug,
      categorySlugs: [...fromCreated.categorySlugs],
    };
  }

  const fromCatalog = promptCatalog.find(
    (item) => item.slug === slug && item.status === "published",
  );
  if (fromCatalog) {
    return {
      slug: fromCatalog.slug,
      title: fromCatalog.title,
      summary: fromCatalog.summary,
      categorySlug: fromCatalog.categorySlug,
      categorySlugs: [fromCatalog.categorySlug],
    };
  }

  return null;
}

function findAnyFixturePromptRecord(
  slug: string,
): FixturePromptRecord | {
  slug: string;
  title: string;
  summary: string;
  categorySlug: string;
  categorySlugs: string[];
  status: PromptLifecycleStatus;
  createdAt: string;
  createdByEmail: string;
} | null {
  const fromCreated = fixtureCreatedPrompts.get(slug);
  if (fromCreated) {
    return fromCreated;
  }

  if (fixtureDeletedPrompts.has(slug)) {
    return null;
  }

  const fromCatalog = promptCatalog.find((item) => item.slug === slug);
  if (!fromCatalog) {
    return null;
  }

  return {
    slug: fromCatalog.slug,
    title: fromCatalog.title,
    summary: fromCatalog.summary,
    categorySlug: fromCatalog.categorySlug,
    categorySlugs: [fromCatalog.categorySlug],
    status: fromCatalog.status ?? "published",
    createdAt: buildFixtureTimestamp(
      Math.max(promptCatalog.findIndex((item) => item.slug === slug), 0),
    ),
    createdByEmail:
      fromCatalog.versions.find((version) => version.versionNo === "v0001")?.submittedByEmail ??
      "admin@example.com",
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

function normalizePromptFilterCategories(query: ListPromptsQuery): string[] {
  const deduped = new Set<string>();

  if (Array.isArray(query.categories)) {
    for (const category of query.categories) {
      const normalized = typeof category === "string" ? category.trim() : "";
      if (normalized) {
        deduped.add(normalized);
      }
    }
  }

  const singleCategory = typeof query.category === "string" ? query.category.trim() : "";
  if (singleCategory) {
    deduped.add(singleCategory);
  }

  return [...deduped];
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

function signPromptDeleteToken(encodedPayload: string): string {
  return createHmac("sha256", PROMPT_DELETE_TOKEN_SECRET)
    .update(encodedPayload)
    .digest("base64url");
}

function createPromptDeleteConfirmationToken(input: {
  slug: string;
  relatedCounts: AdminPromptDeletePreview["relatedCounts"];
}): {
  token: string;
  expiresAt: string;
} {
  const exp = Date.now() + PROMPT_DELETE_TOKEN_TTL_MS;
  const payload: PromptDeleteTokenPayload = {
    slug: input.slug,
    relatedCounts: { ...input.relatedCounts },
    exp,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf-8").toString(
    "base64url",
  );
  const signature = signPromptDeleteToken(encodedPayload);
  return {
    token: `${encodedPayload}.${signature}`,
    expiresAt: new Date(exp).toISOString(),
  };
}

function verifyPromptDeleteConfirmationToken(
  token: string,
): PromptDeleteTokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) {
    return null;
  }

  const encodedPayload = parts[0] ?? "";
  const providedSignature = parts[1] ?? "";
  if (!encodedPayload || !providedSignature) {
    return null;
  }

  const expectedSignature = signPromptDeleteToken(encodedPayload);
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
    ) as Partial<PromptDeleteTokenPayload>;
    const relatedCounts = payload.relatedCounts as
      | AdminPromptDeletePreview["relatedCounts"]
      | undefined;
    if (
      typeof payload.slug !== "string" ||
      typeof payload.exp !== "number" ||
      !relatedCounts ||
      typeof relatedCounts.versions !== "number" ||
      typeof relatedCounts.submissions !== "number" ||
      typeof relatedCounts.likes !== "number" ||
      typeof relatedCounts.versionLikes !== "number" ||
      typeof relatedCounts.versionScores !== "number" ||
      typeof relatedCounts.dailyInteractions !== "number"
    ) {
      return null;
    }
    if (payload.exp < Date.now()) {
      return null;
    }

    return {
      slug: payload.slug,
      relatedCounts: { ...relatedCounts },
      exp: payload.exp,
    };
  } catch {
    return null;
  }
}

function createPromptBatchDeleteConfirmationToken(input: {
  slugs: string[];
  summary: AdminPromptBatchDeletePreview["summary"];
}): {
  token: string;
  expiresAt: string;
} {
  const exp = Date.now() + PROMPT_DELETE_TOKEN_TTL_MS;
  const payload: PromptBatchDeleteTokenPayload = {
    slugs: [...input.slugs],
    summary: { ...input.summary },
    exp,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf-8").toString(
    "base64url",
  );
  const signature = signPromptDeleteToken(encodedPayload);
  return {
    token: `${encodedPayload}.${signature}`,
    expiresAt: new Date(exp).toISOString(),
  };
}

function verifyPromptBatchDeleteConfirmationToken(
  token: string,
): PromptBatchDeleteTokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) {
    return null;
  }

  const encodedPayload = parts[0] ?? "";
  const providedSignature = parts[1] ?? "";
  if (!encodedPayload || !providedSignature) {
    return null;
  }

  const expectedSignature = signPromptDeleteToken(encodedPayload);
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
    ) as Partial<PromptBatchDeleteTokenPayload>;
    const summary = payload.summary as AdminPromptBatchDeletePreview["summary"] | undefined;
    if (!Array.isArray(payload.slugs) || !summary || typeof payload.exp !== "number") {
      return null;
    }
    if (
      payload.slugs.some((item) => typeof item !== "string") ||
      typeof summary.prompts !== "number" ||
      typeof summary.versions !== "number" ||
      typeof summary.submissions !== "number" ||
      typeof summary.likes !== "number" ||
      typeof summary.versionLikes !== "number" ||
      typeof summary.versionScores !== "number" ||
      typeof summary.dailyInteractions !== "number"
    ) {
      return null;
    }
    if (payload.exp < Date.now()) {
      return null;
    }
    return {
      slugs: [...payload.slugs],
      summary: { ...summary },
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

function normalizeAdminPromptStatus(status?: string): PromptLifecycleStatus | undefined {
  if (status === "draft" || status === "published" || status === "archived") {
    return status;
  }
  return undefined;
}

function mapAdminPromptListItem(input: {
  slug: string;
  title: string;
  summary: string;
  status: PromptLifecycleStatus;
  updatedAt: string | Date;
  categorySlug: string;
  categoryName: string;
  categories: PromptCategoryDto[];
  categorySlugs: string[];
}): AdminPromptListItem {
  const categories =
    input.categories.length > 0
      ? input.categories
      : [{ slug: input.categorySlug, name: input.categoryName }];
  return {
    slug: input.slug,
    title: input.title,
    summary: input.summary,
    status: input.status,
    updatedAt:
      input.updatedAt instanceof Date
        ? input.updatedAt.toISOString()
        : new Date(input.updatedAt).toISOString(),
    category: {
      slug: input.categorySlug,
      name: input.categoryName,
    },
    categories,
    categorySlugs:
      input.categorySlugs.length > 0
        ? [...input.categorySlugs]
        : categories.map((item) => item.slug),
  };
}

function finalizeManagedCategorySelection(input: {
  categorySlugs: string[];
  primaryCategorySlug: string;
  isSystemCategory: (slug: string) => boolean;
}): {
  categorySlugs: string[];
  primaryCategorySlug: string;
} | null {
  const deduped: string[] = [];
  const seen = new Set<string>();
  for (const rawSlug of input.categorySlugs) {
    const slug = rawSlug.trim();
    if (!slug || seen.has(slug)) {
      continue;
    }
    seen.add(slug);
    deduped.push(slug);
  }

  const primaryCategorySlug = input.primaryCategorySlug.trim();
  if (!primaryCategorySlug || deduped.length === 0) {
    return null;
  }

  const hasFormalCategory = deduped.some((slug) => !input.isSystemCategory(slug));
  const normalizedCategorySlugs = hasFormalCategory
    ? deduped.filter((slug) => slug !== UNCATEGORIZED_CATEGORY.slug)
    : deduped;

  if (!normalizedCategorySlugs.includes(primaryCategorySlug)) {
    return null;
  }

  return {
    categorySlugs: normalizedCategorySlugs,
    primaryCategorySlug,
  };
}

function normalizeCategorySlugsInput(input: {
  categorySlug?: string;
  categorySlugs?: string[];
}): string[] {
  const deduped = new Set<string>();
  const normalizedFromArray = Array.isArray(input.categorySlugs)
    ? input.categorySlugs
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter((item) => item.length > 0)
    : [];

  for (const slug of normalizedFromArray) {
    if (!deduped.has(slug)) {
      deduped.add(slug);
    }
  }
  if (deduped.size > 0) {
    return [...deduped];
  }

  const singleSlug =
    typeof input.categorySlug === "string" ? input.categorySlug.trim() : "";
  if (singleSlug) {
    return [singleSlug];
  }

  return [UNCATEGORIZED_CATEGORY.slug];
}

function selectPrimaryCategorySlug(
  categorySlugs: string[],
  isSystemCategory: (slug: string) => boolean,
): string {
  const primary =
    categorySlugs.find((slug) => !isSystemCategory(slug)) ??
    categorySlugs[0] ??
    UNCATEGORIZED_CATEGORY.slug;
  return primary;
}

function mapCategoryDtosFromSlugs(categorySlugs: string[]): PromptCategoryDto[] {
  return categorySlugs.map((slug) => ({
    slug,
    name: CATEGORY_MAP.get(slug)?.name ?? slug,
  }));
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

function buildFixturePromptVersionLikeKey(slug: string, versionNo: string): string {
  return `${slug}::${versionNo}`;
}

function buildFixturePromptVersionScoreKey(
  slug: string,
  versionNo: string,
  scene: string,
  traceId: string,
): string {
  return `${slug}::${versionNo}::${scene}::${traceId}`;
}

function normalizeScene(input: string): string {
  return input.trim();
}

function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex");
}

function buildPromptVersionDailyInteractionFixtureKey(input: {
  slug: string;
  versionNo: string;
  action: PromptVersionInteractionAction;
  ipHash: string;
  dateKey: string;
}): string {
  return `${input.slug}::${input.versionNo}::${input.action}::${input.ipHash}::${input.dateKey}`;
}

function normalizeTraceId(input?: string): string {
  const normalized = typeof input === "string" ? input.trim() : "";
  if (normalized.length > 0) {
    return normalized;
  }
  return `generated-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function isValidScore(score: number): boolean {
  return Number.isInteger(score) && score >= 1 && score <= 5;
}

function roundToFourDecimals(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function createEmptyScoreDistribution(): PromptVersionScoreStatsResult["distribution"] {
  return {
    "1": 0,
    "2": 0,
    "3": 0,
    "4": 0,
    "5": 0,
  };
}

function buildScoreStatsResult(input: {
  slug: string;
  versionNo: string;
  scene?: string;
  scores: number[];
}): PromptVersionScoreStatsResult {
  const distribution = createEmptyScoreDistribution();
  let lowScoreCount = 0;

  for (const score of input.scores) {
    if (score === 1 || score === 2 || score === 3 || score === 4 || score === 5) {
      distribution[String(score) as keyof typeof distribution] += 1;
    }
    if (score <= 2) {
      lowScoreCount += 1;
    }
  }

  const totalScores = input.scores.length;
  const scoreSum = input.scores.reduce((acc, score) => acc + score, 0);
  const averageScore = totalScores > 0 ? roundToFourDecimals(scoreSum / totalScores) : 0;
  const lowScoreRate =
    totalScores > 0 ? roundToFourDecimals(lowScoreCount / totalScores) : 0;

  return {
    slug: input.slug,
    versionNo: input.versionNo,
    scene: input.scene,
    totalScores,
    averageScore,
    lowScoreRate,
    distribution,
  };
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

function getFixturePromptVersionLikes(
  slug: string,
  versionNo: string,
): Set<string> | null {
  const likes = fixturePromptVersionLikes.get(
    buildFixturePromptVersionLikeKey(slug, versionNo),
  );
  return likes ?? null;
}

function getFixturePromptVersionLikesCount(slug: string, versionNo: string): number {
  return getFixturePromptVersionLikes(slug, versionNo)?.size ?? 0;
}

function listFixturePromptVersionScores(
  slug: string,
  versionNo: string,
  scene?: string,
): FixturePromptVersionScoreRecord[] {
  const normalizedScene = scene ? normalizeScene(scene) : undefined;
  const list: FixturePromptVersionScoreRecord[] = [];

  for (const record of fixturePromptVersionScores.values()) {
    if (record.slug !== slug || record.versionNo !== versionNo) {
      continue;
    }
    if (normalizedScene && record.scene !== normalizedScene) {
      continue;
    }
    list.push({ ...record });
  }

  return list;
}

function getFixturePromptVersions(slug: string): PromptVersionFixture[] | null {
  const versions = fixturePromptVersions.get(slug);
  return versions ?? null;
}

function getFixtureCurrentVersionNo(slug: string): string | null {
  const currentVersionNo = fixtureCurrentVersionNoBySlug.get(slug);
  return currentVersionNo ?? null;
}

function getFixtureCurrentVersionContent(slug: string): string {
  const currentVersionNo = getFixtureCurrentVersionNo(slug);
  if (!currentVersionNo) {
    return "";
  }

  const versions = getFixturePromptVersions(slug);
  if (!versions || versions.length === 0) {
    return "";
  }

  const matchedVersion = versions.find(
    (version) => version.versionNo === currentVersionNo,
  );
  return matchedVersion?.content ?? "";
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

async function canWriteToDatabase(): Promise<boolean> {
  if (getRepositoryDataSourceMode() === "fixture") {
    return false;
  }

  if (!(await isPgReachable(databaseUrl, 400))) {
    return false;
  }

  try {
    return withPgClient(databaseUrl, async (client) => hasPromptTables(client));
  } catch {
    return false;
  }
}

async function listPromptsFromDb(
  query: ListPromptsQuery,
): Promise<PromptListItemDto[]> {
  const conditions = [`p.status = 'published'`];
  const params: unknown[] = [];
  const sort = normalizeSort(query.sort);
  const filterCategories = normalizePromptFilterCategories(query);

  if (filterCategories.length > 0) {
    params.push(filterCategories);
    conditions.push(`
      (
        EXISTS (
          SELECT 1
          FROM prompt_categories pc_filter
          INNER JOIN categories c_filter ON c_filter.id = pc_filter.category_id
          WHERE pc_filter.prompt_id = p.id
            AND c_filter.slug = ANY($${params.length}::text[])
        )
        OR (
          NOT EXISTS (
            SELECT 1
            FROM prompt_categories pc_any
            WHERE pc_any.prompt_id = p.id
          )
          AND c.slug = ANY($${params.length}::text[])
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
          relation_categories.categories_json,
          cv.content AS current_version_content
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
        LEFT JOIN prompt_versions cv
          ON cv.id = p.current_version_id
          AND cv.prompt_id = p.id
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
        currentVersionContent: row.current_version_content ?? "",
        likesCount: asNumber(row.likes_count),
        updatedAt: row.updated_at,
        categorySlug: row.category_slug,
        categoryName: row.category_name,
        categories: normalizedCategories.categories,
        categorySlugs: normalizedCategories.categorySlugs,
      });
    });
  });
}

function listPromptsFromFixtures(query: ListPromptsQuery): PromptListItemDto[] {
  const sort = normalizeSort(query.sort);
  const keyword = query.keyword?.trim().toLowerCase();
  const filterCategories = normalizePromptFilterCategories(query);

  const seededRows = promptCatalog
    .filter((prompt) => prompt.status !== "archived")
    .filter((prompt) => !fixtureDeletedPrompts.has(prompt.slug))
    .map((prompt, index) =>
      mapPromptListItem({
        slug: prompt.slug,
        title: prompt.title,
        summary: prompt.summary,
        currentVersionContent: getFixtureCurrentVersionContent(prompt.slug),
        likesCount: getFixtureLikesCount(prompt.slug),
        updatedAt: buildFixtureTimestamp(index),
        categorySlug: prompt.categorySlug,
        categoryName: CATEGORY_MAP.get(prompt.categorySlug)?.name ?? "",
        categories: mapCategoryDtosFromSlugs([prompt.categorySlug]),
        categorySlugs: [prompt.categorySlug],
      }),
    )
    .filter((item) => !fixtureCreatedPrompts.has(item.slug));
  const createdRows = [...fixtureCreatedPrompts.values()]
    .filter((prompt) => prompt.status === "published")
    .map((prompt, index) =>
      mapPromptListItem({
        slug: prompt.slug,
        title: prompt.title,
        summary: prompt.summary,
        currentVersionContent: getFixtureCurrentVersionContent(prompt.slug),
        likesCount: getFixtureLikesCount(prompt.slug),
        updatedAt: buildFixtureTimestamp(promptCatalog.length + index),
        categorySlug: prompt.categorySlug,
        categoryName: CATEGORY_MAP.get(prompt.categorySlug)?.name ?? "",
        categories: mapCategoryDtosFromSlugs(prompt.categorySlugs),
        categorySlugs: [...prompt.categorySlugs],
      }),
    );
  const rows = [...seededRows, ...createdRows]
    .filter((item) => {
      if (
        filterCategories.length > 0 &&
        !filterCategories.some((category) => item.categorySlugs.includes(category))
      ) {
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

function withPromptDetailVersionLikes(
  detail: PromptDetailDto,
  likesCountByVersionNo: Map<string, number>,
): PromptDetailDto {
  const currentVersionLikesCount =
    likesCountByVersionNo.get(detail.currentVersion.versionNo) ?? 0;
  (detail.currentVersion as Record<string, unknown>).likesCount =
    currentVersionLikesCount;

  for (const version of detail.versions) {
    const likesCount = likesCountByVersionNo.get(version.versionNo) ?? 0;
    (version as Record<string, unknown>).likesCount = likesCount;
  }

  return detail;
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

  const likesCountByVersionNo = new Map<string, number>(
    versionsInState.map((version) => [
      version.versionNo,
      getFixturePromptVersionLikesCount(prompt.slug, version.versionNo),
    ]),
  );

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
    categories: mapCategoryDtosFromSlugs(prompt.categorySlugs),
    categorySlugs: [...prompt.categorySlugs],
    currentVersionNo: currentVersion.versionNo,
    currentVersionSourceType: currentVersion.sourceType ?? "edit",
    currentVersionSubmittedAt: buildFixtureTimestamp(0),
    currentVersionContent: currentVersion.content,
    versions,
  };

  return withPromptDetailVersionLikes(mapPromptDetail(raw), likesCountByVersionNo);
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
          v.likes_count,
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
    const likesCountByVersionNo = new Map<string, number>();
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

      likesCountByVersionNo.set(row.version_no, asNumber(row.likes_count));

      return {
        versionNo: row.version_no,
        sourceType: row.source_type,
        status,
        submittedAt: row.submitted_at,
        submittedBy: row.submitted_by ?? undefined,
        content: row.content,
      };
    });

    const currentFromVersions = versions.find(
      (item) => item.versionNo === head.current_version_no,
    );
    const currentFallback =
      currentFromVersions ?? versions.find((item) => item.status === "approved") ?? versions[0];
    const currentVersionNo =
      currentFallback?.versionNo ?? head.current_version_no ?? "v0001";
    const currentVersionSourceType =
      currentFallback?.sourceType ?? head.current_source_type ?? "edit";
    const currentVersionSubmittedAt =
      currentFallback?.submittedAt ?? head.current_submitted_at ?? new Date(0);
    const currentVersionContent =
      currentFallback?.content ?? head.current_content ?? "";
    const normalizedCategories = normalizePromptCategories(head.categories_json, {
      slug: head.category_slug,
      name: head.category_name,
    });

    return withPromptDetailVersionLikes(
      mapPromptDetail({
        slug: head.slug,
        title: head.title,
        summary: head.summary,
        likesCount: asNumber(head.likes_count),
        updatedAt: head.updated_at,
        categorySlug: head.category_slug,
        categoryName: head.category_name,
        categories: normalizedCategories.categories,
        categorySlugs: normalizedCategories.categorySlugs,
        currentVersionNo,
        currentVersionSourceType,
        currentVersionSubmittedAt,
        currentVersionContent,
        versions,
      }),
      likesCountByVersionNo,
    );
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

async function findCategoriesBySlugs(
  client: SqlClient,
  categorySlugs: string[],
): Promise<
  Array<{
    id: number;
    slug: string;
    name: string;
    isSystem: boolean;
  }>
> {
  if (categorySlugs.length === 0) {
    return [];
  }

  const result = await client.query<DbCategoryResolveRow>(
    `
      SELECT
        id,
        slug,
        name,
        is_system
      FROM categories
      WHERE slug = ANY($1::text[]);
    `,
    [categorySlugs],
  );
  const bySlug = new Map(
    result.rows.map((row) => [
      row.slug,
      {
        id: asNumber(row.id),
        slug: row.slug,
        name: row.name,
        isSystem: Boolean(row.is_system),
      },
    ]),
  );

  const resolved: Array<{
    id: number;
    slug: string;
    name: string;
    isSystem: boolean;
  }> = [];
  for (const slug of categorySlugs) {
    const row = bySlug.get(slug);
    if (!row) {
      continue;
    }
    resolved.push(row);
  }
  return resolved;
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

function createAdminCategoryInFixtures(
  input: AdminCategoryCreateInput,
): AdminCategoryCreateResult {
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

  if (CATEGORY_MAP.has(slug)) {
    return {
      ok: false,
      code: "conflict",
      reason: "category_slug_conflict",
      message: "category slug already exists",
    };
  }

  const nextSortOrder =
    Math.max(...[...CATEGORY_MAP.values()].map((item) => item.sortOrder), 0) + 10;
  CATEGORY_MAP.set(slug, {
    name,
    slug,
    sortOrder: nextSortOrder,
    status: "active",
  });

  return {
    ok: true,
    value: {
      category: {
        slug,
        name,
        isSystem: false,
        isSelectable: true,
        isCollapsedByDefault: false,
        promptCount: 0,
      },
    },
  };
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

async function findPromptHeadBySlug(
  client: SqlClient,
  slug: string,
  options: { forUpdate?: boolean } = {},
): Promise<DbPromptHeadRow | null> {
  const lockClause = options.forUpdate ? "FOR UPDATE OF p" : "";
  const result = await client.query<DbPromptHeadRow>(
    `
      SELECT
        p.id,
        p.slug,
        p.title,
        p.summary,
        p.status,
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
      WHERE p.slug = $1
      LIMIT 1
      ${lockClause};
    `,
    [slug],
  );
  return result.rows[0] ?? null;
}

function mapAdminPromptHeadRow(row: DbPromptHeadRow): AdminPromptListItem {
  const normalizedCategories = normalizePromptCategories(row.categories_json, {
    slug: row.category_slug,
    name: row.category_name,
  });
  return mapAdminPromptListItem({
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    status: row.status,
    updatedAt: row.updated_at,
    categorySlug: row.category_slug,
    categoryName: row.category_name,
    categories: normalizedCategories.categories,
    categorySlugs: normalizedCategories.categorySlugs,
  });
}

async function listAdminPromptsFromDb(
  query: AdminPromptListQuery = {},
): Promise<AdminPromptListItem[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (query.status) {
    params.push(query.status);
    conditions.push(`p.status = $${params.length}`);
  }

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
    conditions.push(`
      (
        p.slug ILIKE $${params.length}
        OR p.title ILIKE $${params.length}
        OR p.summary ILIKE $${params.length}
      )
    `);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  return withPgClient(databaseUrl, async (client) => {
    const result = await client.query<DbAdminPromptListRow>(
      `
        SELECT
          p.slug,
          p.title,
          p.summary,
          p.status,
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
        ${whereClause}
        ORDER BY p.updated_at DESC, p.id DESC;
      `,
      params,
    );

    return result.rows.map((row) => {
      const normalizedCategories = normalizePromptCategories(row.categories_json, {
        slug: row.category_slug,
        name: row.category_name,
      });
      return mapAdminPromptListItem({
        slug: row.slug,
        title: row.title,
        summary: row.summary,
        status: row.status,
        updatedAt: row.updated_at,
        categorySlug: row.category_slug,
        categoryName: row.category_name,
        categories: normalizedCategories.categories,
        categorySlugs: normalizedCategories.categorySlugs,
      });
    });
  });
}

function listAdminPromptsFromFixtures(
  query: AdminPromptListQuery = {},
): AdminPromptListItem[] {
  const keyword = query.keyword?.trim().toLowerCase();

  const seededRows = promptCatalog
    .filter((prompt) => !fixtureCreatedPrompts.has(prompt.slug))
    .filter((prompt) => !fixtureDeletedPrompts.has(prompt.slug))
    .map((prompt, index) =>
      mapAdminPromptListItem({
        slug: prompt.slug,
        title: prompt.title,
        summary: prompt.summary,
        status: prompt.status ?? "published",
        updatedAt: buildFixtureTimestamp(index),
        categorySlug: prompt.categorySlug,
        categoryName: CATEGORY_MAP.get(prompt.categorySlug)?.name ?? prompt.categorySlug,
        categories: mapCategoryDtosFromSlugs([prompt.categorySlug]),
        categorySlugs: [prompt.categorySlug],
      }),
    );

  const createdRows = [...fixtureCreatedPrompts.values()].map((prompt, index) =>
    mapAdminPromptListItem({
      slug: prompt.slug,
      title: prompt.title,
      summary: prompt.summary,
      status: prompt.status,
      updatedAt: prompt.createdAt || buildFixtureTimestamp(promptCatalog.length + index),
      categorySlug: prompt.categorySlug,
      categoryName: CATEGORY_MAP.get(prompt.categorySlug)?.name ?? prompt.categorySlug,
      categories: mapCategoryDtosFromSlugs(prompt.categorySlugs),
      categorySlugs: [...prompt.categorySlugs],
    }),
  );

  return [...seededRows, ...createdRows]
    .filter((item) => (query.status ? item.status === query.status : true))
    .filter((item) =>
      query.category ? item.categorySlugs.includes(query.category) : true,
    )
    .filter((item) => {
      if (!keyword) {
        return true;
      }
      return (
        item.slug.toLowerCase().includes(keyword) ||
        item.title.toLowerCase().includes(keyword) ||
        item.summary.toLowerCase().includes(keyword)
      );
    })
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

async function updateAdminPromptCategoriesInDb(
  input: AdminPromptCategoryUpdateInput,
): Promise<AdminPromptCategoryUpdateResult> {
  if (input.reviewerRole !== "admin") {
    return {
      ok: false,
      code: "forbidden",
      reason: "admin_role_required",
      message: "admin role is required",
    };
  }

  const normalized = finalizeManagedCategorySelection({
    categorySlugs: input.categorySlugs,
    primaryCategorySlug: input.primaryCategorySlug,
    isSystemCategory: (slug) => SYSTEM_CATEGORY_SLUGS.has(slug),
  });
  if (!normalized) {
    return {
      ok: false,
      code: "bad_request",
      reason: input.primaryCategorySlug.trim()
        ? "primary_category_missing_from_categories"
        : "primary_category_required",
      message: "primary category must exist in categorySlugs",
    };
  }

  return withPgClient(databaseUrl, async (client) => {
    await client.query("BEGIN;");
    try {
      const prompt = await findPromptHeadBySlug(client, input.slug, { forUpdate: true });
      if (!prompt) {
        await client.query("ROLLBACK;");
        return {
          ok: false,
          code: "not_found",
          reason: "prompt_not_found",
          message: "prompt not found",
        };
      }

      const resolvedCategories = await findCategoriesBySlugs(client, normalized.categorySlugs);
      if (resolvedCategories.length !== normalized.categorySlugs.length) {
        await client.query("ROLLBACK;");
        return {
          ok: false,
          code: "bad_request",
          reason: "category_not_found",
          message: "category not found",
        };
      }

      const primaryCategory = resolvedCategories.find(
        (item) => item.slug === normalized.primaryCategorySlug,
      );
      if (!primaryCategory) {
        await client.query("ROLLBACK;");
        return {
          ok: false,
          code: "bad_request",
          reason: "primary_category_missing_from_categories",
          message: "primary category must exist in categorySlugs",
        };
      }

      const promptId = asNumber(prompt.id);
      const categoryIds = resolvedCategories.map((item) => item.id);
      await client.query(
        `
          DELETE FROM prompt_categories
          WHERE prompt_id = $1
            AND NOT (category_id = ANY($2::int[]));
        `,
        [promptId, categoryIds],
      );
      for (const category of resolvedCategories) {
        await insertPromptCategoryRelation(client, promptId, category.id);
      }

      await client.query(
        `
          UPDATE prompts
          SET category_id = $2, updated_at = NOW()
          WHERE id = $1;
        `,
        [promptId, primaryCategory.id],
      );

      const reviewerId = await upsertAdminReviewerId(client, input.reviewerEmail);
      await writeAuditLog(client, {
        actorId: reviewerId,
        action: "prompt.categories.updated",
        targetType: "prompt",
        targetId: promptId,
        payload: {
          promptSlug: prompt.slug,
          categorySlugs: normalized.categorySlugs,
          primaryCategorySlug: normalized.primaryCategorySlug,
        },
      });

      const updated = await findPromptHeadBySlug(client, input.slug);
      await client.query("COMMIT;");
      return {
        ok: true,
        value: {
          prompt: mapAdminPromptHeadRow(updated as DbPromptHeadRow),
        },
      };
    } catch (error) {
      await client.query("ROLLBACK;");
      throw error;
    }
  });
}

async function updateAdminPromptsBatchCategoriesInDb(
  input: AdminPromptBatchCategoryUpdateInput,
): Promise<AdminPromptBatchCategoryUpdateResult> {
  if (input.reviewerRole !== "admin") {
    return {
      ok: false,
      code: "forbidden",
      reason: "admin_role_required",
      message: "admin role is required",
    };
  }

  if (
    input.slugs.length === 0 ||
    (input.addCategorySlugs.length === 0 && input.removeCategorySlugs.length === 0)
  ) {
    return {
      ok: false,
      code: "bad_request",
      reason: "invalid_request",
      message: "slugs and at least one category mutation are required",
    };
  }

  return withPgClient(databaseUrl, async (client) => {
    await client.query("BEGIN;");
    try {
      const lockedPromptResult = await client.query<{ id: number; slug: string }>(
        `
          SELECT p.id, p.slug
          FROM prompts p
          WHERE p.slug = ANY($1::text[])
          FOR UPDATE;
        `,
        [input.slugs],
      );
      const lockedPromptSlugSet = new Set(
        lockedPromptResult.rows.map((row) => row.slug),
      );
      for (const slug of input.slugs) {
        if (!lockedPromptSlugSet.has(slug)) {
          await client.query("ROLLBACK;");
          return {
            ok: false,
            code: "not_found",
            reason: "prompt_not_found",
            message: "prompt not found",
          };
        }
      }

      const promptResult = await client.query<DbPromptHeadRow>(
        `
          SELECT
            p.id,
            p.slug,
            p.title,
            p.summary,
            p.status,
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
          WHERE p.slug = ANY($1::text[])
          ;
        `,
        [input.slugs],
      );
      const promptBySlug = new Map(
        promptResult.rows.map((row) => [row.slug, row]),
      );
      for (const slug of input.slugs) {
        if (!promptBySlug.has(slug)) {
          await client.query("ROLLBACK;");
          return {
            ok: false,
            code: "not_found",
            reason: "prompt_not_found",
            message: "prompt not found",
          };
        }
      }

      const categoryResolveSet = new Set<string>();
      for (const slug of input.addCategorySlugs) {
        categoryResolveSet.add(slug);
      }
      for (const row of promptResult.rows) {
        const normalizedCategories = normalizePromptCategories(row.categories_json, {
          slug: row.category_slug,
          name: row.category_name,
        });
        for (const category of normalizedCategories.categorySlugs) {
          categoryResolveSet.add(category);
        }
      }
      categoryResolveSet.add(UNCATEGORIZED_CATEGORY.slug);

      const resolvedCategories = await findCategoriesBySlugs(client, [
        ...categoryResolveSet,
      ]);
      const resolvedCategoryBySlug = new Map(
        resolvedCategories.map((item) => [item.slug, item]),
      );
      for (const slug of input.addCategorySlugs) {
        if (!resolvedCategoryBySlug.has(slug)) {
          await client.query("ROLLBACK;");
          return {
            ok: false,
            code: "bad_request",
            reason: "category_not_found",
            message: "category not found",
          };
        }
      }

      const addSet = new Set(input.addCategorySlugs);
      const removeSet = new Set(input.removeCategorySlugs);
      const reviewerId = await upsertAdminReviewerId(client, input.reviewerEmail);
      const updatedSlugs: string[] = [];

      for (const promptSlug of input.slugs) {
        const prompt = promptBySlug.get(promptSlug) as DbPromptHeadRow;
        const normalizedCategories = normalizePromptCategories(prompt.categories_json, {
          slug: prompt.category_slug,
          name: prompt.category_name,
        });
        const nextSet = new Set(normalizedCategories.categorySlugs);
        for (const slug of removeSet) {
          nextSet.delete(slug);
        }
        for (const slug of addSet) {
          nextSet.add(slug);
        }
        if (nextSet.size === 0) {
          nextSet.add(UNCATEGORIZED_CATEGORY.slug);
        }

        const nextCategorySlugs = [...nextSet];
        const hasFormalCategory = nextCategorySlugs.some(
          (slug) => !SYSTEM_CATEGORY_SLUGS.has(slug),
        );
        const sanitizedCategorySlugs = hasFormalCategory
          ? nextCategorySlugs.filter((slug) => slug !== UNCATEGORIZED_CATEGORY.slug)
          : nextCategorySlugs;
        const compatibilityCategorySlug =
          normalizedCategories.categorySlugs.find((slug) =>
            sanitizedCategorySlugs.includes(slug),
          ) ??
          sanitizedCategorySlugs.find((slug) => !SYSTEM_CATEGORY_SLUGS.has(slug)) ??
          sanitizedCategorySlugs[0] ??
          UNCATEGORIZED_CATEGORY.slug;
        const compatibilityCategory = resolvedCategoryBySlug.get(compatibilityCategorySlug);
        if (!compatibilityCategory) {
          await client.query("ROLLBACK;");
          return {
            ok: false,
            code: "bad_request",
            reason: "category_not_found",
            message: "category not found",
          };
        }

        const promptId = asNumber(prompt.id);
        const categoryIds = sanitizedCategorySlugs
          .map((slug) => resolvedCategoryBySlug.get(slug)?.id ?? 0)
          .filter((id) => id > 0);
        await client.query(
          `
            DELETE FROM prompt_categories
            WHERE prompt_id = $1
              AND NOT (category_id = ANY($2::int[]));
          `,
          [promptId, categoryIds],
        );
        for (const categoryId of categoryIds) {
          await insertPromptCategoryRelation(client, promptId, categoryId);
        }

        await client.query(
          `
            UPDATE prompts
            SET category_id = $2, updated_at = NOW()
            WHERE id = $1;
          `,
          [promptId, compatibilityCategory.id],
        );

        await writeAuditLog(client, {
          actorId: reviewerId,
          action: "prompt.categories.updated",
          targetType: "prompt",
          targetId: promptId,
          payload: {
            promptSlug,
            categorySlugs: sanitizedCategorySlugs,
            categoryIdSyncSlug: compatibilityCategorySlug,
          },
        });
        updatedSlugs.push(promptSlug);
      }

      const updated = await client.query<DbPromptHeadRow>(
        `
          SELECT
            p.id,
            p.slug,
            p.title,
            p.summary,
            p.status,
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
          WHERE p.slug = ANY($1::text[]);
        `,
        [updatedSlugs],
      );
      const updatedBySlug = new Map(
        updated.rows.map((row) => [row.slug, row]),
      );

      await client.query("COMMIT;");
      return {
        ok: true,
        value: {
          prompts: input.slugs
            .map((slug) => updatedBySlug.get(slug))
            .filter((item): item is DbPromptHeadRow => Boolean(item))
            .map((row) => mapAdminPromptHeadRow(row)),
        },
      };
    } catch (error) {
      await client.query("ROLLBACK;");
      throw error;
    }
  });
}

function updateAdminPromptCategoriesInFixtures(
  input: AdminPromptCategoryUpdateInput,
): AdminPromptCategoryUpdateResult {
  if (input.reviewerRole !== "admin") {
    return {
      ok: false,
      code: "forbidden",
      reason: "admin_role_required",
      message: "admin role is required",
    };
  }

  const prompt = findAnyFixturePromptRecord(input.slug);
  if (!prompt) {
    return {
      ok: false,
      code: "not_found",
      reason: "prompt_not_found",
      message: "prompt not found",
    };
  }

  const normalized = finalizeManagedCategorySelection({
    categorySlugs: input.categorySlugs,
    primaryCategorySlug: input.primaryCategorySlug,
    isSystemCategory: (slug) => SYSTEM_CATEGORY_SLUGS.has(slug),
  });
  if (!normalized) {
    return {
      ok: false,
      code: "bad_request",
      reason: input.primaryCategorySlug.trim()
        ? "primary_category_missing_from_categories"
        : "primary_category_required",
      message: "primary category must exist in categorySlugs",
    };
  }

  const missingCategorySlug = normalized.categorySlugs.find((slug) => !CATEGORY_MAP.has(slug));
  if (missingCategorySlug) {
    return {
      ok: false,
      code: "bad_request",
      reason: "category_not_found",
      message: "category not found",
    };
  }

  const updatedPrompt: FixturePromptRecord = {
    slug: prompt.slug,
    title: prompt.title,
    summary: prompt.summary,
    categorySlug: normalized.primaryCategorySlug,
    categorySlugs: [...normalized.categorySlugs],
    status: prompt.status,
    createdAt: prompt.createdAt,
    createdByEmail: prompt.createdByEmail,
  };
  fixtureCreatedPrompts.set(prompt.slug, updatedPrompt);

  fixtureAuditLogs.push(
    buildAuditLogEntry({
      actorId: fixtureActorId(input.reviewerEmail),
      action: "prompt.categories.updated",
      targetType: "prompt",
      targetId: fixturePromptId(prompt.slug),
      payload: {
        promptSlug: prompt.slug,
        categorySlugs: normalized.categorySlugs,
        primaryCategorySlug: normalized.primaryCategorySlug,
      },
    }),
  );

  return {
    ok: true,
    value: {
      prompt: mapAdminPromptListItem({
        slug: updatedPrompt.slug,
        title: updatedPrompt.title,
        summary: updatedPrompt.summary,
        status: updatedPrompt.status,
        updatedAt: new Date().toISOString(),
        categorySlug: updatedPrompt.categorySlug,
        categoryName: CATEGORY_MAP.get(updatedPrompt.categorySlug)?.name ?? updatedPrompt.categorySlug,
        categories: mapCategoryDtosFromSlugs(updatedPrompt.categorySlugs),
        categorySlugs: updatedPrompt.categorySlugs,
      }),
    },
  };
}

function updateAdminPromptsBatchCategoriesInFixtures(
  input: AdminPromptBatchCategoryUpdateInput,
): AdminPromptBatchCategoryUpdateResult {
  if (input.reviewerRole !== "admin") {
    return {
      ok: false,
      code: "forbidden",
      reason: "admin_role_required",
      message: "admin role is required",
    };
  }

  if (
    input.slugs.length === 0 ||
    (input.addCategorySlugs.length === 0 && input.removeCategorySlugs.length === 0)
  ) {
    return {
      ok: false,
      code: "bad_request",
      reason: "invalid_request",
      message: "slugs and at least one category mutation are required",
    };
  }

  const addSet = new Set(input.addCategorySlugs);
  const removeSet = new Set(input.removeCategorySlugs);
  const updates = new Map<string, FixturePromptRecord>();
  for (const slug of input.slugs) {
    const prompt = findAnyFixturePromptRecord(slug);
    if (!prompt) {
      return {
        ok: false,
        code: "not_found",
        reason: "prompt_not_found",
        message: "prompt not found",
      };
    }
    const nextSet = new Set(prompt.categorySlugs);
    for (const removeSlug of removeSet) {
      nextSet.delete(removeSlug);
    }
    for (const addSlug of addSet) {
      nextSet.add(addSlug);
    }
    if (nextSet.size === 0) {
      nextSet.add(UNCATEGORIZED_CATEGORY.slug);
    }
    const nextCategorySlugs = [...nextSet];
    const hasFormalCategory = nextCategorySlugs.some(
      (item) => !SYSTEM_CATEGORY_SLUGS.has(item),
    );
    const sanitizedCategorySlugs = hasFormalCategory
      ? nextCategorySlugs.filter((item) => item !== UNCATEGORIZED_CATEGORY.slug)
      : nextCategorySlugs;
    const compatibilityCategorySlug =
      prompt.categorySlugs.find((item) => sanitizedCategorySlugs.includes(item)) ??
      sanitizedCategorySlugs.find((item) => !SYSTEM_CATEGORY_SLUGS.has(item)) ??
      sanitizedCategorySlugs[0] ??
      UNCATEGORIZED_CATEGORY.slug;
    updates.set(slug, {
      slug: prompt.slug,
      title: prompt.title,
      summary: prompt.summary,
      categorySlug: compatibilityCategorySlug,
      categorySlugs: sanitizedCategorySlugs,
      status: prompt.status,
      createdAt: prompt.createdAt,
      createdByEmail: prompt.createdByEmail,
    });
  }

  for (const slug of input.addCategorySlugs) {
    if (!CATEGORY_MAP.has(slug)) {
      return {
        ok: false,
        code: "bad_request",
        reason: "category_not_found",
        message: "category not found",
      };
    }
  }
  for (const prompt of updates.values()) {
    const missingCategorySlug = prompt.categorySlugs.find(
      (slug) => !CATEGORY_MAP.has(slug),
    );
    if (missingCategorySlug) {
      return {
        ok: false,
        code: "bad_request",
        reason: "category_not_found",
        message: "category not found",
      };
    }
  }

  const updatedPrompts: AdminPromptListItem[] = [];
  for (const slug of input.slugs) {
    const updatedPrompt = updates.get(slug) as FixturePromptRecord;
    fixtureCreatedPrompts.set(slug, updatedPrompt);
    fixtureAuditLogs.push(
      buildAuditLogEntry({
        actorId: fixtureActorId(input.reviewerEmail),
        action: "prompt.categories.updated",
        targetType: "prompt",
        targetId: fixturePromptId(slug),
        payload: {
          promptSlug: slug,
          categorySlugs: updatedPrompt.categorySlugs,
          categoryIdSyncSlug: updatedPrompt.categorySlug,
        },
      }),
    );
    updatedPrompts.push(
      mapAdminPromptListItem({
        slug: updatedPrompt.slug,
        title: updatedPrompt.title,
        summary: updatedPrompt.summary,
        status: updatedPrompt.status,
        updatedAt: new Date().toISOString(),
        categorySlug: updatedPrompt.categorySlug,
        categoryName: CATEGORY_MAP.get(updatedPrompt.categorySlug)?.name ?? updatedPrompt.categorySlug,
        categories: mapCategoryDtosFromSlugs(updatedPrompt.categorySlugs),
        categorySlugs: updatedPrompt.categorySlugs,
      }),
    );
  }

  return {
    ok: true,
    value: {
      prompts: updatedPrompts,
    },
  };
}

async function mutateAdminPromptStatusInDb(
  action: AdminPromptStatusAction,
  input: AdminPromptStatusMutationInput,
): Promise<AdminPromptStatusMutationResult> {
  if (input.reviewerRole !== "admin") {
    return {
      ok: false,
      code: "forbidden",
      reason: "admin_role_required",
      message: "admin role is required",
    };
  }

  return withPgClient(databaseUrl, async (client) => {
    await client.query("BEGIN;");
    try {
      const prompt = await findPromptHeadBySlug(client, input.slug, { forUpdate: true });
      if (!prompt) {
        await client.query("ROLLBACK;");
        return {
          ok: false,
          code: "not_found",
          reason: "prompt_not_found",
          message: "prompt not found",
        };
      }

      const fromStatus = prompt.status;
      const toStatus = action === "archive" ? "archived" : "published";
      const validTransition =
        (action === "archive" && fromStatus === "published") ||
        (action === "restore" && fromStatus === "archived");
      if (!validTransition) {
        await client.query("ROLLBACK;");
        return {
          ok: false,
          code: "conflict",
          reason: "prompt_status_transition_not_allowed",
          message: "prompt status transition not allowed",
        };
      }

      await client.query(
        `
          UPDATE prompts
          SET status = $2, updated_at = NOW()
          WHERE id = $1;
        `,
        [asNumber(prompt.id), toStatus],
      );

      const reviewerId = await upsertAdminReviewerId(client, input.reviewerEmail);
      await writeAuditLog(client, {
        actorId: reviewerId,
        action: action === "archive" ? "prompt.archived" : "prompt.restored",
        targetType: "prompt",
        targetId: asNumber(prompt.id),
        payload: {
          promptSlug: prompt.slug,
          fromStatus,
          toStatus,
        },
      });

      const updated = await findPromptHeadBySlug(client, input.slug);
      await client.query("COMMIT;");
      return {
        ok: true,
        value: {
          prompt: mapAdminPromptHeadRow(updated as DbPromptHeadRow),
        },
      };
    } catch (error) {
      await client.query("ROLLBACK;");
      throw error;
    }
  });
}

function mutateAdminPromptStatusInFixtures(
  action: AdminPromptStatusAction,
  input: AdminPromptStatusMutationInput,
): AdminPromptStatusMutationResult {
  if (input.reviewerRole !== "admin") {
    return {
      ok: false,
      code: "forbidden",
      reason: "admin_role_required",
      message: "admin role is required",
    };
  }

  const prompt = findAnyFixturePromptRecord(input.slug);
  if (!prompt) {
    return {
      ok: false,
      code: "not_found",
      reason: "prompt_not_found",
      message: "prompt not found",
    };
  }

  const fromStatus = prompt.status;
  const toStatus = action === "archive" ? "archived" : "published";
  const validTransition =
    (action === "archive" && fromStatus === "published") ||
    (action === "restore" && fromStatus === "archived");
  if (!validTransition) {
    return {
      ok: false,
      code: "conflict",
      reason: "prompt_status_transition_not_allowed",
      message: "prompt status transition not allowed",
    };
  }

  const updatedPrompt: FixturePromptRecord = {
    slug: prompt.slug,
    title: prompt.title,
    summary: prompt.summary,
    categorySlug: prompt.categorySlug,
    categorySlugs: [...prompt.categorySlugs],
    status: toStatus,
    createdAt: prompt.createdAt,
    createdByEmail: prompt.createdByEmail,
  };
  fixtureCreatedPrompts.set(prompt.slug, updatedPrompt);
  fixtureAuditLogs.push(
    buildAuditLogEntry({
      actorId: fixtureActorId(input.reviewerEmail),
      action: action === "archive" ? "prompt.archived" : "prompt.restored",
      targetType: "prompt",
      targetId: fixturePromptId(prompt.slug),
      payload: {
        promptSlug: prompt.slug,
        fromStatus,
        toStatus,
      },
    }),
  );

  return {
    ok: true,
    value: {
      prompt: mapAdminPromptListItem({
        slug: updatedPrompt.slug,
        title: updatedPrompt.title,
        summary: updatedPrompt.summary,
        status: updatedPrompt.status,
        updatedAt: new Date().toISOString(),
        categorySlug: updatedPrompt.categorySlug,
        categoryName: CATEGORY_MAP.get(updatedPrompt.categorySlug)?.name ?? updatedPrompt.categorySlug,
        categories: mapCategoryDtosFromSlugs(updatedPrompt.categorySlugs),
        categorySlugs: updatedPrompt.categorySlugs,
      }),
    },
  };
}

async function readPromptDeleteCounts(
  client: SqlClient,
  promptId: number,
): Promise<AdminPromptDeletePreview["relatedCounts"]> {
  const result = await client.query<DbPromptDeleteCountsRow>(
    `
      WITH target_versions AS (
        SELECT id
        FROM prompt_versions
        WHERE prompt_id = $1
      )
      SELECT
        (SELECT COUNT(*)::text FROM prompt_versions WHERE prompt_id = $1) AS versions,
        (SELECT COUNT(*)::text FROM submissions WHERE prompt_id = $1) AS submissions,
        (SELECT COUNT(*)::text FROM prompt_likes WHERE prompt_id = $1) AS likes,
        (SELECT COUNT(*)::text FROM prompt_version_likes WHERE prompt_version_id IN (SELECT id FROM target_versions)) AS version_likes,
        (SELECT COUNT(*)::text FROM prompt_version_scores WHERE prompt_version_id IN (SELECT id FROM target_versions)) AS version_scores,
        (SELECT COUNT(*)::text FROM prompt_version_daily_interactions WHERE prompt_version_id IN (SELECT id FROM target_versions)) AS daily_interactions;
    `,
    [promptId],
  );
  const row = result.rows[0];
  return {
    versions: asNumber(row?.versions),
    submissions: asNumber(row?.submissions),
    likes: asNumber(row?.likes),
    versionLikes: asNumber(row?.version_likes),
    versionScores: asNumber(row?.version_scores),
    dailyInteractions: asNumber(row?.daily_interactions),
  };
}

function readPromptDeleteCountsFromFixtures(
  promptSlug: string,
): AdminPromptDeletePreview["relatedCounts"] {
  const versions = getFixturePromptVersions(promptSlug) ?? [];
  const versionKeys = new Set(versions.map((item) => item.versionNo));
  let versionLikes = 0;
  let versionScores = 0;
  let dailyInteractions = 0;

  for (const [key, likes] of fixturePromptVersionLikes.entries()) {
    const [slug, versionNo] = key.split("::");
    if (slug === promptSlug && versionKeys.has(versionNo ?? "")) {
      versionLikes += likes.size;
    }
  }
  for (const record of fixturePromptVersionScores.values()) {
    if (record.slug === promptSlug && versionKeys.has(record.versionNo)) {
      versionScores += 1;
    }
  }
  for (const key of fixturePromptVersionDailyInteractions.values()) {
    if (key.startsWith(`${promptSlug}::`)) {
      dailyInteractions += 1;
    }
  }

  return {
    versions: versions.length,
    submissions: fixtureSubmissions.filter((item) => item.promptSlug === promptSlug).length,
    likes: getFixturePromptLikes(promptSlug)?.size ?? 0,
    versionLikes,
    versionScores,
    dailyInteractions,
  };
}

function isPromptDeleteTokenValid(input: {
  token: string;
  slug: string;
  relatedCounts: AdminPromptDeletePreview["relatedCounts"];
}): boolean {
  const payload = verifyPromptDeleteConfirmationToken(input.token);
  if (!payload) {
    return false;
  }

  return (
    payload.slug === input.slug &&
    payload.relatedCounts.versions === input.relatedCounts.versions &&
    payload.relatedCounts.submissions === input.relatedCounts.submissions &&
    payload.relatedCounts.likes === input.relatedCounts.likes &&
    payload.relatedCounts.versionLikes === input.relatedCounts.versionLikes &&
    payload.relatedCounts.versionScores === input.relatedCounts.versionScores &&
    payload.relatedCounts.dailyInteractions === input.relatedCounts.dailyInteractions
  );
}

function summarizePromptDeleteCounts(
  countsList: AdminPromptDeletePreview["relatedCounts"][],
): AdminPromptBatchDeletePreview["summary"] {
  return countsList.reduce<AdminPromptBatchDeletePreview["summary"]>(
    (acc, item) => ({
      prompts: acc.prompts + 1,
      versions: acc.versions + item.versions,
      submissions: acc.submissions + item.submissions,
      likes: acc.likes + item.likes,
      versionLikes: acc.versionLikes + item.versionLikes,
      versionScores: acc.versionScores + item.versionScores,
      dailyInteractions: acc.dailyInteractions + item.dailyInteractions,
    }),
    {
      prompts: 0,
      versions: 0,
      submissions: 0,
      likes: 0,
      versionLikes: 0,
      versionScores: 0,
      dailyInteractions: 0,
    },
  );
}

function isPromptBatchDeleteTokenValid(input: {
  token: string;
  slugs: string[];
  summary: AdminPromptBatchDeletePreview["summary"];
}): boolean {
  const payload = verifyPromptBatchDeleteConfirmationToken(input.token);
  if (!payload) {
    return false;
  }
  if (payload.slugs.length !== input.slugs.length) {
    return false;
  }
  for (let index = 0; index < payload.slugs.length; index += 1) {
    if (payload.slugs[index] !== input.slugs[index]) {
      return false;
    }
  }
  return (
    payload.summary.prompts === input.summary.prompts &&
    payload.summary.versions === input.summary.versions &&
    payload.summary.submissions === input.summary.submissions &&
    payload.summary.likes === input.summary.likes &&
    payload.summary.versionLikes === input.summary.versionLikes &&
    payload.summary.versionScores === input.summary.versionScores &&
    payload.summary.dailyInteractions === input.summary.dailyInteractions
  );
}

async function deletePromptBusinessDataById(client: SqlClient, promptId: number): Promise<void> {
  await client.query(`DELETE FROM submissions WHERE prompt_id = $1;`, [promptId]);
  await client.query(`DELETE FROM prompt_likes WHERE prompt_id = $1;`, [promptId]);
  await client.query(
    `
      DELETE FROM prompt_version_likes
      WHERE prompt_version_id IN (
        SELECT id FROM prompt_versions WHERE prompt_id = $1
      );
    `,
    [promptId],
  );
  await client.query(
    `
      DELETE FROM prompt_version_scores
      WHERE prompt_version_id IN (
        SELECT id FROM prompt_versions WHERE prompt_id = $1
      );
    `,
    [promptId],
  );
  await client.query(
    `
      DELETE FROM prompt_version_daily_interactions
      WHERE prompt_version_id IN (
        SELECT id FROM prompt_versions WHERE prompt_id = $1
      );
    `,
    [promptId],
  );
  await client.query(`DELETE FROM prompt_versions WHERE prompt_id = $1;`, [promptId]);
  await client.query(`DELETE FROM prompt_categories WHERE prompt_id = $1;`, [promptId]);
  await client.query(`DELETE FROM prompts WHERE id = $1;`, [promptId]);
}

async function deleteAdminPromptInDb(
  input: AdminPromptDeleteInput,
): Promise<AdminPromptDeleteResult> {
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
      code: "not_found",
      reason: "prompt_not_found",
      message: "prompt not found",
    };
  }

  return withPgClient(databaseUrl, async (client) => {
    if (!input.confirm) {
      const prompt = await findPromptHeadBySlug(client, slug);
      if (!prompt) {
        return {
          ok: false,
          code: "not_found",
          reason: "prompt_not_found",
          message: "prompt not found",
        };
      }

      const relatedCounts = await readPromptDeleteCounts(client, asNumber(prompt.id));
      const token = createPromptDeleteConfirmationToken({
        slug,
        relatedCounts,
      });

      return {
        ok: true,
        value: {
          dryRun: true,
          slug,
          title: prompt.title,
          status: prompt.status,
          primaryCategory: {
            slug: prompt.category_slug,
            name: prompt.category_name,
          },
          categories: normalizePromptCategories(prompt.categories_json, {
            slug: prompt.category_slug,
            name: prompt.category_name,
          }).categories,
          relatedCounts,
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
        reason: "prompt_delete_confirmation_required",
        message: "confirmation token is required",
      };
    }

    await client.query("BEGIN;");
    try {
      const prompt = await findPromptHeadBySlug(client, slug, { forUpdate: true });
      if (!prompt) {
        await client.query("ROLLBACK;");
        return {
          ok: false,
          code: "not_found",
          reason: "prompt_not_found",
          message: "prompt not found",
        };
      }

      const promptId = asNumber(prompt.id);
      const relatedCounts = await readPromptDeleteCounts(client, promptId);
      if (!isPromptDeleteTokenValid({ token: confirmationToken, slug, relatedCounts })) {
        await client.query("ROLLBACK;");
        return {
          ok: false,
          code: "bad_request",
          reason: "invalid_confirmation_token",
          message: "invalid confirmation token",
        };
      }

      const reviewerId = await upsertAdminReviewerId(client, input.reviewerEmail);
      const categories = normalizePromptCategories(prompt.categories_json, {
        slug: prompt.category_slug,
        name: prompt.category_name,
      });
      await writeAuditLog(client, {
        actorId: reviewerId,
        action: "prompt.deleted",
        targetType: "prompt",
        targetId: promptId,
        payload: {
          promptSlug: prompt.slug,
          title: prompt.title,
          status: prompt.status,
          primaryCategorySlug: prompt.category_slug,
          categorySlugs: categories.categorySlugs,
          relatedCounts,
          reason: input.reason?.trim() || undefined,
        },
      });

      await deletePromptBusinessDataById(client, promptId);

      await client.query("COMMIT;");
      return {
        ok: true,
        value: {
          deleted: true,
          slug,
          deletedCounts: relatedCounts,
        },
      };
    } catch (error) {
      await client.query("ROLLBACK;");
      throw error;
    }
  });
}

function deleteAdminPromptInFixtures(
  input: AdminPromptDeleteInput,
): AdminPromptDeleteResult {
  if (input.reviewerRole !== "admin") {
    return {
      ok: false,
      code: "forbidden",
      reason: "admin_role_required",
      message: "admin role is required",
    };
  }

  const prompt = findAnyFixturePromptRecord(input.slug);
  if (!prompt) {
    return {
      ok: false,
      code: "not_found",
      reason: "prompt_not_found",
      message: "prompt not found",
    };
  }

  const relatedCounts = readPromptDeleteCountsFromFixtures(prompt.slug);
  if (!input.confirm) {
    const token = createPromptDeleteConfirmationToken({
      slug: prompt.slug,
      relatedCounts,
    });
    return {
      ok: true,
      value: {
        dryRun: true,
        slug: prompt.slug,
        title: prompt.title,
        status: prompt.status,
        primaryCategory: {
          slug: prompt.categorySlug,
          name: CATEGORY_MAP.get(prompt.categorySlug)?.name ?? prompt.categorySlug,
        },
        categories: mapCategoryDtosFromSlugs(prompt.categorySlugs),
        relatedCounts,
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
      reason: "prompt_delete_confirmation_required",
      message: "confirmation token is required",
    };
  }
  if (!isPromptDeleteTokenValid({ token: confirmationToken, slug: prompt.slug, relatedCounts })) {
    return {
      ok: false,
      code: "bad_request",
      reason: "invalid_confirmation_token",
      message: "invalid confirmation token",
    };
  }

  fixtureAuditLogs.push(
    buildAuditLogEntry({
      actorId: fixtureActorId(input.reviewerEmail),
      action: "prompt.deleted",
      targetType: "prompt",
      targetId: fixturePromptId(prompt.slug),
      payload: {
        promptSlug: prompt.slug,
        title: prompt.title,
        status: prompt.status,
        primaryCategorySlug: prompt.categorySlug,
        categorySlugs: prompt.categorySlugs,
        relatedCounts,
        reason: input.reason?.trim() || undefined,
      },
    }),
  );

  fixtureDeletedPrompts.add(prompt.slug);
  fixtureCreatedPrompts.delete(prompt.slug);
  fixturePromptLikes.delete(prompt.slug);
  fixtureCurrentVersionNoBySlug.delete(prompt.slug);
  fixturePromptVersions.delete(prompt.slug);
  fixtureSubmissions = fixtureSubmissions.filter((item) => item.promptSlug !== prompt.slug);

  for (const key of [...fixturePromptVersionLikes.keys()]) {
    if (key.startsWith(`${prompt.slug}::`)) {
      fixturePromptVersionLikes.delete(key);
    }
  }
  for (const key of [...fixturePromptVersionScores.keys()]) {
    if (key.startsWith(`${prompt.slug}::`)) {
      fixturePromptVersionScores.delete(key);
    }
  }
  for (const key of [...fixturePromptVersionDailyInteractions]) {
    if (key.startsWith(`${prompt.slug}::`)) {
      fixturePromptVersionDailyInteractions.delete(key);
    }
  }

  return {
    ok: true,
    value: {
      deleted: true,
      slug: prompt.slug,
      deletedCounts: relatedCounts,
    },
  };
}

async function deleteAdminPromptsBatchInDb(
  input: AdminPromptBatchDeleteInput,
): Promise<AdminPromptBatchDeleteResult> {
  if (input.reviewerRole !== "admin") {
    return {
      ok: false,
      code: "forbidden",
      reason: "admin_role_required",
      message: "admin role is required",
    };
  }
  if (input.slugs.length === 0) {
    return {
      ok: false,
      code: "bad_request",
      reason: "invalid_request",
      message: "slugs must be a non-empty array",
    };
  }
  if (input.dryRun === input.confirm) {
    return {
      ok: false,
      code: "bad_request",
      reason: "invalid_request",
      message: "exactly one of dryRun=true or confirm=true is required",
    };
  }

  return withPgClient(databaseUrl, async (client) => {
    await client.query("BEGIN;");
    try {
      const promptResult = await client.query<DbPromptHeadRow>(
        `
          SELECT
            p.id,
            p.slug,
            p.title,
            p.status,
            c.slug AS category_slug,
            c.name AS category_name,
            COALESCE(
              (
                SELECT jsonb_agg(
                  jsonb_build_object('slug', c2.slug, 'name', c2.name)
                  ORDER BY c2.slug
                )
                FROM prompt_categories pc2
                INNER JOIN categories c2 ON c2.id = pc2.category_id
                WHERE pc2.prompt_id = p.id
              ),
              '[]'::jsonb
            ) AS categories_json
          FROM prompts p
          INNER JOIN categories c ON c.id = p.category_id
          WHERE p.slug = ANY($1::text[])
          FOR UPDATE;
        `,
        [input.slugs],
      );
      const promptBySlug = new Map(promptResult.rows.map((row) => [row.slug, row]));
      for (const slug of input.slugs) {
        if (!promptBySlug.has(slug)) {
          await client.query("ROLLBACK;");
          return {
            ok: false,
            code: "not_found",
            reason: "prompt_not_found",
            message: "prompt not found",
          };
        }
      }

      const promptRows = input.slugs.map((slug) => promptBySlug.get(slug) as DbPromptHeadRow);
      const promptWithCounts = await Promise.all(
        promptRows.map(async (row) => {
          const relatedCounts = await readPromptDeleteCounts(client, asNumber(row.id));
          return { row, relatedCounts };
        }),
      );
      const summary = summarizePromptDeleteCounts(promptWithCounts.map((item) => item.relatedCounts));

      if (input.dryRun) {
        const token = createPromptBatchDeleteConfirmationToken({
          slugs: input.slugs,
          summary,
        });
        await client.query("COMMIT;");
        return {
          ok: true,
          value: {
            dryRun: true,
            slugs: [...input.slugs],
            foundPrompts: promptWithCounts.map(({ row, relatedCounts }) => ({
              slug: row.slug,
              title: row.title,
              status: normalizeAdminPromptStatus(row.status) ?? "published",
              primaryCategory: {
                slug: row.category_slug,
                name: row.category_name,
              },
              categories: normalizePromptCategories(row.categories_json, {
                slug: row.category_slug,
                name: row.category_name,
              }).categories,
              relatedCounts,
            })),
            summary,
            confirmationToken: token.token,
            confirmationExpiresAt: token.expiresAt,
          },
        };
      }

      const confirmationToken = input.confirmationToken?.trim() ?? "";
      if (!confirmationToken) {
        await client.query("ROLLBACK;");
        return {
          ok: false,
          code: "bad_request",
          reason: "prompt_delete_confirmation_required",
          message: "confirmation token is required",
        };
      }
      if (!isPromptBatchDeleteTokenValid({ token: confirmationToken, slugs: input.slugs, summary })) {
        await client.query("ROLLBACK;");
        return {
          ok: false,
          code: "bad_request",
          reason: "invalid_confirmation_token",
          message: "invalid confirmation token",
        };
      }

      const reviewerId = await upsertAdminReviewerId(client, input.reviewerEmail);
      for (const { row, relatedCounts } of promptWithCounts) {
        const promptId = asNumber(row.id);
        const categories = normalizePromptCategories(row.categories_json, {
          slug: row.category_slug,
          name: row.category_name,
        });
        await writeAuditLog(client, {
          actorId: reviewerId,
          action: "prompt.deleted",
          targetType: "prompt",
          targetId: promptId,
          payload: {
            promptSlug: row.slug,
            title: row.title,
            status: normalizeAdminPromptStatus(row.status) ?? "published",
            primaryCategorySlug: row.category_slug,
            categorySlugs: categories.categorySlugs,
            relatedCounts,
            reason: input.reason?.trim() || undefined,
          },
        });
        await deletePromptBusinessDataById(client, promptId);
      }

      await client.query("COMMIT;");
      return {
        ok: true,
        value: {
          deleted: true,
          slugs: [...input.slugs],
          deletedCounts: summary,
        },
      };
    } catch (error) {
      await client.query("ROLLBACK;");
      throw error;
    }
  });
}

function deleteAdminPromptsBatchInFixtures(
  input: AdminPromptBatchDeleteInput,
): AdminPromptBatchDeleteResult {
  if (input.reviewerRole !== "admin") {
    return {
      ok: false,
      code: "forbidden",
      reason: "admin_role_required",
      message: "admin role is required",
    };
  }
  if (input.slugs.length === 0) {
    return {
      ok: false,
      code: "bad_request",
      reason: "invalid_request",
      message: "slugs must be a non-empty array",
    };
  }
  if (input.dryRun === input.confirm) {
    return {
      ok: false,
      code: "bad_request",
      reason: "invalid_request",
      message: "exactly one of dryRun=true or confirm=true is required",
    };
  }

  const foundPrompts: AdminPromptBatchDeletePreview["foundPrompts"] = [];
  for (const slug of input.slugs) {
    const prompt = findAnyFixturePromptRecord(slug);
    if (!prompt) {
      return {
        ok: false,
        code: "not_found",
        reason: "prompt_not_found",
        message: "prompt not found",
      };
    }
    foundPrompts.push({
      slug: prompt.slug,
      title: prompt.title,
      status: prompt.status,
      primaryCategory: {
        slug: prompt.categorySlug,
        name: CATEGORY_MAP.get(prompt.categorySlug)?.name ?? prompt.categorySlug,
      },
      categories: mapCategoryDtosFromSlugs(prompt.categorySlugs),
      relatedCounts: readPromptDeleteCountsFromFixtures(prompt.slug),
    });
  }

  const summary = summarizePromptDeleteCounts(foundPrompts.map((item) => item.relatedCounts));
  if (input.dryRun) {
    const token = createPromptBatchDeleteConfirmationToken({
      slugs: input.slugs,
      summary,
    });
    return {
      ok: true,
      value: {
        dryRun: true,
        slugs: [...input.slugs],
        foundPrompts,
        summary,
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
      reason: "prompt_delete_confirmation_required",
      message: "confirmation token is required",
    };
  }
  if (!isPromptBatchDeleteTokenValid({ token: confirmationToken, slugs: input.slugs, summary })) {
    return {
      ok: false,
      code: "bad_request",
      reason: "invalid_confirmation_token",
      message: "invalid confirmation token",
    };
  }

  for (const item of foundPrompts) {
    fixtureAuditLogs.push(
      buildAuditLogEntry({
        actorId: fixtureActorId(input.reviewerEmail),
        action: "prompt.deleted",
        targetType: "prompt",
        targetId: fixturePromptId(item.slug),
        payload: {
          promptSlug: item.slug,
          title: item.title,
          status: item.status,
          primaryCategorySlug: item.primaryCategory.slug,
          categorySlugs: item.categories.map((category) => category.slug),
          relatedCounts: item.relatedCounts,
          reason: input.reason?.trim() || undefined,
        },
      }),
    );

    fixtureDeletedPrompts.add(item.slug);
    fixtureCreatedPrompts.delete(item.slug);
    fixturePromptLikes.delete(item.slug);
    fixtureCurrentVersionNoBySlug.delete(item.slug);
    fixturePromptVersions.delete(item.slug);
    fixtureSubmissions = fixtureSubmissions.filter((submission) => submission.promptSlug !== item.slug);

    for (const key of [...fixturePromptVersionLikes.keys()]) {
      if (key.startsWith(`${item.slug}::`)) {
        fixturePromptVersionLikes.delete(key);
      }
    }
    for (const key of [...fixturePromptVersionScores.keys()]) {
      if (key.startsWith(`${item.slug}::`)) {
        fixturePromptVersionScores.delete(key);
      }
    }
    for (const key of [...fixturePromptVersionDailyInteractions]) {
      if (key.startsWith(`${item.slug}::`)) {
        fixturePromptVersionDailyInteractions.delete(key);
      }
    }
  }

  return {
    ok: true,
    value: {
      deleted: true,
      slugs: [...input.slugs],
      deletedCounts: summary,
    },
  };
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

      const categorySlugs = normalizeCategorySlugsInput(input);
      const resolvedCategories = await findCategoriesBySlugs(client, categorySlugs);
      if (resolvedCategories.length !== categorySlugs.length) {
        await client.query("ROLLBACK;");
        return {
          ok: false,
          code: "not_found",
          message: "category not found",
        };
      }
      const primaryCategorySlug = selectPrimaryCategorySlug(
        categorySlugs,
        (slug) => resolvedCategories.find((item) => item.slug === slug)?.isSystem ?? false,
      );
      const primaryCategory = resolvedCategories.find(
        (item) => item.slug === primaryCategorySlug,
      );
      if (!primaryCategory) {
        await client.query("ROLLBACK;");
        return {
          ok: false,
          code: "not_found",
          message: "category not found",
        };
      }

      const creatorId =
        input.creatorRole === "admin"
          ? await upsertAdminReviewerId(client, input.creatorEmail)
          : await upsertUserId(client, input.creatorEmail);
      const promptStatus = input.creatorRole === "admin" ? "published" : "draft";
      const insertedPrompt = await client.query<DbPromptLookupRow>(
        `
          INSERT INTO prompts
            (slug, title, summary, category_id, status, likes_count, updated_at)
          VALUES ($1, $2, $3, $4, $5, 0, NOW())
          RETURNING id;
        `,
        [input.slug, input.title, input.summary, primaryCategory.id, promptStatus],
      );
      const promptId = asNumber(insertedPrompt.rows[0]?.id);
      for (const category of resolvedCategories) {
        await insertPromptCategoryRelation(client, promptId, category.id);
      }

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

      let pendingSubmission:
        | {
            id: number;
            status: SubmissionStatus;
          }
        | undefined;
      if (input.creatorRole !== "admin") {
        const insertedSubmission = await client.query<DbSubmissionInsertRow>(
          `
            INSERT INTO submissions
              (prompt_id, base_version_id, candidate_version_id, submitter_id, status)
            VALUES ($1, $2, $3, $4, 'pending')
            RETURNING id, status;
          `,
          [promptId, versionId, versionId, creatorId],
        );
        pendingSubmission = {
          id: asNumber(insertedSubmission.rows[0]?.id),
          status: insertedSubmission.rows[0]?.status ?? "pending",
        };
      }

      await writeAuditLog(client, {
        actorId: creatorId,
        action: input.creatorRole === "admin" ? "prompt.created" : "submission.created",
        targetType: input.creatorRole === "admin" ? "prompt" : "submission",
        targetId: pendingSubmission?.id ?? promptId,
        payload: {
          promptSlug: input.slug,
          categorySlug: primaryCategory.slug,
          categorySlugs,
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
            status: promptStatus,
            categorySlug: primaryCategory.slug,
            categories: resolvedCategories.map((item) => ({
              slug: item.slug,
              name: item.name,
            })),
            categorySlugs,
            currentVersion: {
              versionNo,
              sourceType: "create",
            },
          },
          submission: pendingSubmission,
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
          categorySlugs: string[];
          categories: Array<{
            id: number;
            slug: string;
            name: string;
            isSystem: boolean;
          }>;
          primaryCategory: {
            id: number;
            slug: string;
            name: string;
            isSystem: boolean;
          };
          itemIndex: number;
        }
      > = [];
      const categoryCache = new Map<
        string,
        {
          id: number;
          slug: string;
          name: string;
          isSystem: boolean;
        }
      >();

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

        const categorySlugs = normalizeCategorySlugsInput(item);
        const missingSlugs: string[] = [];
        for (const slug of categorySlugs) {
          if (!categoryCache.has(slug)) {
            missingSlugs.push(slug);
          }
        }
        if (missingSlugs.length > 0) {
          const fetched = await findCategoriesBySlugs(client, missingSlugs);
          for (const category of fetched) {
            categoryCache.set(category.slug, category);
          }
          for (const slug of missingSlugs) {
            if (!categoryCache.has(slug)) {
              await client.query("ROLLBACK;");
              return {
                ok: false,
                code: "not_found",
                message: "category not found",
                itemIndex: index,
                itemSlug: item.slug,
              };
            }
          }
        }

        const categories = categorySlugs
          .map((slug) => categoryCache.get(slug))
          .filter(
            (
              category,
            ): category is {
              id: number;
              slug: string;
              name: string;
              isSystem: boolean;
            } => Boolean(category),
          );
        if (categories.length !== categorySlugs.length) {
          await client.query("ROLLBACK;");
          return {
            ok: false,
            code: "not_found",
            message: "category not found",
            itemIndex: index,
            itemSlug: item.slug,
          };
        }

        const primaryCategorySlug = selectPrimaryCategorySlug(
          categorySlugs,
          (slug) => categories.find((item2) => item2.slug === slug)?.isSystem ?? false,
        );
        const primaryCategory = categories.find(
          (category) => category.slug === primaryCategorySlug,
        );
        if (!primaryCategory) {
          await client.query("ROLLBACK;");
          return {
            ok: false,
            code: "not_found",
            message: "category not found",
            itemIndex: index,
            itemSlug: item.slug,
          };
        }

        validatedItems.push({
          ...item,
          categorySlugs,
          categories,
          primaryCategory,
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
          [item.slug, item.title, item.summary, item.primaryCategory.id],
        );
        const promptId = asNumber(insertedPrompt.rows[0]?.id);
        for (const category of item.categories) {
          await insertPromptCategoryRelation(client, promptId, category.id);
        }

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
            categorySlug: item.primaryCategory.slug,
            categorySlugs: item.categorySlugs,
            versionNo,
          },
        });

        importedPrompts.push({
          slug: item.slug,
          title: item.title,
          summary: item.summary,
          status: "published",
          categorySlug: item.primaryCategory.slug,
          categories: item.categories.map((category) => ({
            slug: category.slug,
            name: category.name,
          })),
          categorySlugs: item.categorySlugs,
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

async function hasPromptVersionLikeInfrastructure(
  client: SqlClient,
): Promise<boolean> {
  const tableResult = await client.query<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM pg_tables
        WHERE schemaname = 'public' AND tablename = 'prompt_version_likes'
      ) AS exists;
    `,
  );
  if (!tableResult.rows[0]?.exists) {
    return false;
  }

  const columnResult = await client.query<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'prompt_versions'
          AND column_name = 'likes_count'
      ) AS exists;
    `,
  );

  return Boolean(columnResult.rows[0]?.exists);
}

async function hasPromptVersionDailyInteractionInfrastructure(
  client: SqlClient,
): Promise<boolean> {
  const tableResult = await client.query<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM pg_tables
        WHERE schemaname = 'public'
          AND tablename = 'prompt_version_daily_interactions'
      ) AS exists;
    `,
  );
  if (!tableResult.rows[0]?.exists) {
    return false;
  }

  const columnsResult = await client.query<{ count: number | string }>(
    `
      SELECT COUNT(*)::text AS count
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'prompt_version_daily_interactions'
        AND column_name = ANY($1::text[]);
    `,
    [["prompt_version_id", "action", "ip_hash", "date_key"]],
  );
  return asNumber(columnsResult.rows[0]?.count) >= 4;
}

async function markPromptVersionDailyInteractionInDb(input: {
  slug: string;
  versionNo: string;
  action: PromptVersionInteractionAction;
  ip: string;
  dateKey: string;
}): Promise<{
  result: PromptVersionDailyInteractionResult;
  target?: PromptVersionLikeTarget;
}> {
  return withPgClient(getRuntimeDatabaseUrl(), async (client) => {
    if (!(await hasPromptVersionDailyInteractionInfrastructure(client))) {
      return { result: "missing_infrastructure" };
    }
    const target = await findPublishedPromptVersionLikeTarget(
      client,
      input.slug,
      input.versionNo,
    );
    if (!target) {
      return { result: "not_found" };
    }
    const ipHash = hashIp(input.ip);
    const inserted = await client.query<DbPromptVersionDailyInteractionInsertRow>(
      `
        INSERT INTO prompt_version_daily_interactions
          (prompt_version_id, action, ip_hash, date_key)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (prompt_version_id, action, ip_hash, date_key)
        DO NOTHING
        RETURNING id;
      `,
      [target.versionId, input.action, ipHash, input.dateKey],
    );
    return {
      result: inserted.rows.length > 0 ? "ok" : "limited",
      target,
    };
  });
}

async function findPublishedPromptVersionLikeTarget(
  client: SqlClient,
  slug: string,
  versionNo: string,
): Promise<PromptVersionLikeTarget | null> {
  promptVersionLikeTargetLookupCountForTests += 1;
  const result = await client.query<DbPromptVersionLikeTargetRow>(
    `
      SELECT
        p.id AS prompt_id,
        p.slug AS prompt_slug,
        v.id AS version_id,
        v.version_no,
        v.likes_count
      FROM prompts p
      INNER JOIN prompt_versions v ON v.prompt_id = p.id
      WHERE p.slug = $1
        AND p.status = 'published'
        AND v.version_no = $2
      LIMIT 1;
    `,
    [slug, versionNo],
  );

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  return {
    promptId: asNumber(row.prompt_id),
    promptSlug: row.prompt_slug,
    versionId: asNumber(row.version_id),
    versionNo: row.version_no,
    likesCount: asNumber(row.likes_count),
  };
}

async function readPromptVersionLikesCount(
  client: SqlClient,
  promptVersionId: number,
): Promise<number> {
  promptVersionLikesCountReadCountForTests += 1;
  const result = await client.query<DbPromptLikesCountRow>(
    `
      SELECT likes_count
      FROM prompt_versions
      WHERE id = $1
      LIMIT 1;
    `,
    [promptVersionId],
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

async function likePromptVersionInDb(
  slug: string,
  versionNo: string,
  userEmail: string,
  existingTarget?: PromptVersionLikeTarget,
): Promise<PromptVersionLikeMutationResult | null> {
  return withPgClient(databaseUrl, async (client) => {
    if (!(await hasPromptVersionLikeInfrastructure(client))) {
      return likePromptVersionInFixtures(slug, versionNo, userEmail);
    }

    const target =
      existingTarget ??
      (await findPublishedPromptVersionLikeTarget(client, slug, versionNo));
    if (!target) {
      return null;
    }
    const userId = await upsertUserId(client, userEmail);

    const inserted = await client.query<DbPromptLookupRow>(
      `
        INSERT INTO prompt_version_likes (prompt_version_id, user_id)
        VALUES ($1, $2)
        ON CONFLICT (prompt_version_id, user_id) DO NOTHING
        RETURNING id;
      `,
      [target.versionId, userId],
    );

    let likesCount = target.likesCount;
    if (inserted.rows.length > 0) {
      const updated = await client.query<DbPromptLikesCountRow>(
        `
          UPDATE prompt_versions
          SET likes_count = likes_count + 1
          WHERE id = $1
          RETURNING likes_count;
        `,
        [target.versionId],
      );
      likesCount = asNumber(updated.rows[0]?.likes_count);
    }
    await writeAuditLog(client, {
      actorId: userId,
      action: "prompt.version.liked",
      targetType: "prompt_version",
      targetId: target.versionId,
      payload: {
        promptSlug: target.promptSlug,
        versionNo: target.versionNo,
        liked: true,
        likesCount,
      },
    });

    return {
      slug: target.promptSlug,
      versionNo: target.versionNo,
      likesCount,
      liked: true,
    };
  });
}

async function unlikePromptVersionInDb(
  slug: string,
  versionNo: string,
  userEmail: string,
): Promise<PromptVersionLikeMutationResult | null> {
  return withPgClient(databaseUrl, async (client) => {
    if (!(await hasPromptVersionLikeInfrastructure(client))) {
      return unlikePromptVersionInFixtures(slug, versionNo, userEmail);
    }

    const target = await findPublishedPromptVersionLikeTarget(client, slug, versionNo);
    if (!target) {
      return null;
    }
    const userId = await upsertUserId(client, userEmail);

    const deleted = await client.query<DbPromptLookupRow>(
      `
        DELETE FROM prompt_version_likes
        WHERE prompt_version_id = $1 AND user_id = $2
        RETURNING id;
      `,
      [target.versionId, userId],
    );

    let likesCount = target.likesCount;
    if (deleted.rows.length > 0) {
      const updated = await client.query<DbPromptLikesCountRow>(
        `
          UPDATE prompt_versions
          SET likes_count = GREATEST(likes_count - 1, 0)
          WHERE id = $1
          RETURNING likes_count;
        `,
        [target.versionId],
      );
      likesCount = asNumber(updated.rows[0]?.likes_count);
    }
    await writeAuditLog(client, {
      actorId: userId,
      action: "prompt.version.unliked",
      targetType: "prompt_version",
      targetId: target.versionId,
      payload: {
        promptSlug: target.promptSlug,
        versionNo: target.versionNo,
        liked: false,
        likesCount,
      },
    });

    return {
      slug: target.promptSlug,
      versionNo: target.versionNo,
      likesCount,
      liked: false,
    };
  });
}

async function hasPromptVersionScoreInfrastructure(
  client: SqlClient,
): Promise<boolean> {
  const tableResult = await client.query<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM pg_tables
        WHERE schemaname = 'public' AND tablename = 'prompt_version_scores'
      ) AS exists;
    `,
  );
  if (!tableResult.rows[0]?.exists) {
    return false;
  }

  const columnsResult = await client.query<{ count: number | string }>(
    `
      SELECT COUNT(*)::text AS count
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'prompt_version_scores'
        AND column_name = ANY($1::text[]);
    `,
    [["prompt_version_id", "user_id", "scene", "trace_id", "score"]],
  );
  return asNumber(columnsResult.rows[0]?.count) >= 5;
}

async function scorePromptVersionInDb(
  slug: string,
  versionNo: string,
  userEmail: string,
  input: PromptVersionScoreMutationInput,
): Promise<PromptVersionScoreMutationResult | null> {
  return withPgClient(databaseUrl, async (client) => {
    if (!(await hasPromptVersionScoreInfrastructure(client))) {
      return scorePromptVersionInFixtures(slug, versionNo, userEmail, input);
    }

    const target = await findPublishedPromptVersionLikeTarget(client, slug, versionNo);
    if (!target) {
      return null;
    }
    const userId = await upsertUserId(client, userEmail);
    const scene = normalizeScene(input.scene);
    const traceId = normalizeTraceId(input.traceId);

    await client.query(
      `
        INSERT INTO prompt_version_scores (
          prompt_version_id,
          user_id,
          scene,
          trace_id,
          score
        )
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (prompt_version_id, scene, trace_id)
        DO UPDATE
        SET
          user_id = EXCLUDED.user_id,
          score = EXCLUDED.score,
          created_at = NOW();
      `,
      [target.versionId, userId, scene, traceId, input.score],
    );

    await writeAuditLog(client, {
      actorId: userId,
      action: "prompt.version.scored",
      targetType: "prompt_version",
      targetId: target.versionId,
      payload: {
        promptSlug: target.promptSlug,
        versionNo: target.versionNo,
        scene,
        traceId,
        score: input.score,
      },
    });

    return {
      slug: target.promptSlug,
      versionNo: target.versionNo,
      scene,
      traceId,
      score: input.score,
    };
  });
}

async function getPromptVersionScoreStatsFromDb(
  slug: string,
  versionNo: string,
  scene?: string,
): Promise<PromptVersionScoreStatsResult | null> {
  return withPgClient(databaseUrl, async (client) => {
    if (!(await hasPromptVersionScoreInfrastructure(client))) {
      return getPromptVersionScoreStatsFromFixtures(slug, versionNo, scene);
    }

    const target = await findPublishedPromptVersionLikeTarget(client, slug, versionNo);
    if (!target) {
      return null;
    }

    const normalizedScene = scene ? normalizeScene(scene) : undefined;
    const params: unknown[] = [target.versionId];
    let whereClause = "WHERE prompt_version_id = $1";
    if (normalizedScene) {
      params.push(normalizedScene);
      whereClause = `${whereClause} AND scene = $2`;
    }

    const result = await client.query<DbPromptVersionScoreStatsRow>(
      `
        SELECT
          COUNT(*)::text AS total_scores,
          AVG(score)::numeric(10,4) AS average_score,
          COUNT(*) FILTER (WHERE score = 1)::text AS count_1,
          COUNT(*) FILTER (WHERE score = 2)::text AS count_2,
          COUNT(*) FILTER (WHERE score = 3)::text AS count_3,
          COUNT(*) FILTER (WHERE score = 4)::text AS count_4,
          COUNT(*) FILTER (WHERE score = 5)::text AS count_5,
          COUNT(*) FILTER (WHERE score <= 2)::text AS low_score_count
        FROM prompt_version_scores
        ${whereClause};
      `,
      params,
    );
    const row = result.rows[0];
    const totalScores = asNumber(row?.total_scores);
    const lowScoreCount = asNumber(row?.low_score_count);
    const averageFromDb =
      row?.average_score === null || row?.average_score === undefined
        ? 0
        : Number(row.average_score);

    return {
      slug: target.promptSlug,
      versionNo: target.versionNo,
      scene: normalizedScene,
      totalScores,
      averageScore: totalScores > 0 ? roundToFourDecimals(averageFromDb) : 0,
      lowScoreRate:
        totalScores > 0 ? roundToFourDecimals(lowScoreCount / totalScores) : 0,
      distribution: {
        "1": asNumber(row?.count_1),
        "2": asNumber(row?.count_2),
        "3": asNumber(row?.count_3),
        "4": asNumber(row?.count_4),
        "5": asNumber(row?.count_5),
      },
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
          LIMIT 1
          FOR UPDATE OF p;
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
            SET current_version_id = $2, status = 'published', updated_at = NOW()
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
  fixturePromptVersionLikes.set(
    buildFixturePromptVersionLikeKey(slug, candidateVersionNo),
    new Set<string>(),
  );

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
      const seededPrompt = promptCatalog.find((entry) => entry.slug === item.promptSlug);
      const createdPrompt = fixtureCreatedPrompts.get(item.promptSlug);
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
        promptTitle: seededPrompt?.title ?? createdPrompt?.title ?? item.promptSlug,
        promptSummary: seededPrompt?.summary ?? createdPrompt?.summary ?? "",
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
    const createdPrompt = fixtureCreatedPrompts.get(submission.promptSlug);
    if (createdPrompt) {
      createdPrompt.status = "published";
    }
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
  const existed =
    promptCatalog.some((item) => item.slug === input.slug && item.status !== "archived") ||
    fixtureCreatedPrompts.has(input.slug);
  if (existed) {
    return {
      ok: false,
      code: "conflict",
      message: "prompt slug already exists",
    };
  }

  const categorySlugs = normalizeCategorySlugsInput(input);
  const missingCategorySlug = categorySlugs.find((slug) => !CATEGORY_MAP.has(slug));
  if (missingCategorySlug) {
    return {
      ok: false,
      code: "not_found",
      message: "category not found",
    };
  }
  const primaryCategorySlug = selectPrimaryCategorySlug(
    categorySlugs,
    (slug) => SYSTEM_CATEGORY_SLUGS.has(slug),
  );
  const promptStatus = input.creatorRole === "admin" ? "published" : "draft";

  const createdAt = new Date().toISOString();
  fixtureCreatedPrompts.set(input.slug, {
    slug: input.slug,
    title: input.title,
    summary: input.summary,
    categorySlug: primaryCategorySlug,
    categorySlugs: [...categorySlugs],
    status: promptStatus,
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
  fixturePromptVersionLikes.set(
    buildFixturePromptVersionLikeKey(input.slug, "v0001"),
    new Set<string>(),
  );

  const promptId = fixturePromptId(input.slug) || promptCatalog.length + fixtureCreatedPrompts.size;
  let pendingSubmission:
    | {
        id: number;
        status: SubmissionStatus;
      }
    | undefined;
  if (input.creatorRole !== "admin") {
    const submissionId = fixtureSubmissionIdSeed + 1;
    fixtureSubmissionIdSeed = submissionId;
    fixtureSubmissions.push({
      id: submissionId,
      promptSlug: input.slug,
      baseVersionNo: "v0001",
      candidateVersionNo: "v0001",
      submitterEmail: input.creatorEmail,
      status: "pending",
    });
    pendingSubmission = {
      id: submissionId,
      status: "pending",
    };
  }
  fixtureAuditLogs.push(
    buildAuditLogEntry({
      actorId: fixtureActorId(input.creatorEmail),
      action: input.creatorRole === "admin" ? "prompt.created" : "submission.created",
      targetType: input.creatorRole === "admin" ? "prompt" : "submission",
      targetId: pendingSubmission?.id ?? promptId,
      payload: {
        promptSlug: input.slug,
        categorySlug: primaryCategorySlug,
        categorySlugs,
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
        status: promptStatus,
        categorySlug: primaryCategorySlug,
        categories: mapCategoryDtosFromSlugs(categorySlugs),
        categorySlugs,
        currentVersion: {
          versionNo: "v0001",
          sourceType: "create",
        },
      },
      submission: pendingSubmission,
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

    const categorySlugs = normalizeCategorySlugsInput(item);
    const missingCategorySlug = categorySlugs.find((slug) => !CATEGORY_MAP.has(slug));
    if (missingCategorySlug) {
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
      categorySlugs: item.categorySlugs,
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
      const createdPrompt = fixtureCreatedPrompts.get(item.promptSlug);
      return {
        id: item.id,
        status: item.status,
        promptSlug: item.promptSlug,
        promptTitle: prompt?.title ?? createdPrompt?.title ?? item.promptSlug,
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

function likePromptVersionInFixtures(
  slug: string,
  versionNo: string,
  userEmail: string,
): PromptVersionLikeMutationResult | null {
  const prompt = findFixturePromptRecord(slug);
  const versions = getFixturePromptVersions(slug);
  if (!prompt || !versions?.some((version) => version.versionNo === versionNo)) {
    return null;
  }

  const normalizedEmail = normalizeUserEmail(userEmail);
  const likeKey = buildFixturePromptVersionLikeKey(slug, versionNo);
  const likes = fixturePromptVersionLikes.get(likeKey) ?? new Set<string>();
  likes.add(normalizedEmail);
  fixturePromptVersionLikes.set(likeKey, likes);

  fixtureAuditLogs.push(
    buildAuditLogEntry({
      actorId: fixtureActorId(normalizedEmail),
      action: "prompt.version.liked",
      targetType: "prompt_version",
      targetId: versions.findIndex((version) => version.versionNo === versionNo) + 1,
      payload: {
        promptSlug: slug,
        versionNo,
        liked: true,
        likesCount: likes.size,
      },
    }),
  );

  return {
    slug,
    versionNo,
    likesCount: likes.size,
    liked: true,
  };
}

function markPromptVersionDailyInteractionInFixtures(input: {
  slug: string;
  versionNo: string;
  action: PromptVersionInteractionAction;
  ip: string;
  dateKey: string;
}): "ok" | "not_found" | "limited" {
  const prompt = findFixturePromptRecord(input.slug);
  const versions = getFixturePromptVersions(input.slug);
  if (!prompt || !versions?.some((version) => version.versionNo === input.versionNo)) {
    return "not_found";
  }

  const key = buildPromptVersionDailyInteractionFixtureKey({
    slug: input.slug,
    versionNo: input.versionNo,
    action: input.action,
    ipHash: hashIp(input.ip),
    dateKey: input.dateKey,
  });
  if (fixturePromptVersionDailyInteractions.has(key)) {
    return "limited";
  }
  fixturePromptVersionDailyInteractions.add(key);
  return "ok";
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

function unlikePromptVersionInFixtures(
  slug: string,
  versionNo: string,
  userEmail: string,
): PromptVersionLikeMutationResult | null {
  const prompt = findFixturePromptRecord(slug);
  const versions = getFixturePromptVersions(slug);
  if (!prompt || !versions?.some((version) => version.versionNo === versionNo)) {
    return null;
  }

  const normalizedEmail = normalizeUserEmail(userEmail);
  const likeKey = buildFixturePromptVersionLikeKey(slug, versionNo);
  const likes = fixturePromptVersionLikes.get(likeKey) ?? new Set<string>();
  likes.delete(normalizedEmail);
  fixturePromptVersionLikes.set(likeKey, likes);

  fixtureAuditLogs.push(
    buildAuditLogEntry({
      actorId: fixtureActorId(normalizedEmail),
      action: "prompt.version.unliked",
      targetType: "prompt_version",
      targetId: versions.findIndex((version) => version.versionNo === versionNo) + 1,
      payload: {
        promptSlug: slug,
        versionNo,
        liked: false,
        likesCount: likes.size,
      },
    }),
  );

  return {
    slug,
    versionNo,
    likesCount: likes.size,
    liked: false,
  };
}

function scorePromptVersionInFixtures(
  slug: string,
  versionNo: string,
  userEmail: string,
  input: PromptVersionScoreMutationInput,
): PromptVersionScoreMutationResult | null {
  const prompt = findFixturePromptRecord(slug);
  const versions = getFixturePromptVersions(slug);
  if (!prompt || !versions?.some((version) => version.versionNo === versionNo)) {
    return null;
  }

  const scene = normalizeScene(input.scene);
  const traceId = normalizeTraceId(input.traceId);
  const normalizedEmail = normalizeUserEmail(userEmail);
  const key = buildFixturePromptVersionScoreKey(slug, versionNo, scene, traceId);
  fixturePromptVersionScores.set(key, {
    slug,
    versionNo,
    scene,
    traceId,
    score: input.score,
    userEmail: normalizedEmail,
  });

  fixtureAuditLogs.push(
    buildAuditLogEntry({
      actorId: fixtureActorId(normalizedEmail),
      action: "prompt.version.scored",
      targetType: "prompt_version",
      targetId: versions.findIndex((version) => version.versionNo === versionNo) + 1,
      payload: {
        promptSlug: slug,
        versionNo,
        scene,
        traceId,
        score: input.score,
      },
    }),
  );

  return {
    slug,
    versionNo,
    scene,
    traceId,
    score: input.score,
  };
}

function getPromptVersionScoreStatsFromFixtures(
  slug: string,
  versionNo: string,
  scene?: string,
): PromptVersionScoreStatsResult | null {
  const prompt = findFixturePromptRecord(slug);
  const versions = getFixturePromptVersions(slug);
  if (!prompt || !versions?.some((version) => version.versionNo === versionNo)) {
    return null;
  }

  const normalizedScene = scene ? normalizeScene(scene) : undefined;
  const records = listFixturePromptVersionScores(slug, versionNo, normalizedScene);
  return buildScoreStatsResult({
    slug,
    versionNo,
    scene: normalizedScene,
    scores: records.map((record) => record.score),
  });
}

export function __resetPromptLikeFixtureStateForTests(): void {
  fixturePromptLikes = createFixtureLikeState();
  fixturePromptVersionLikes = createFixturePromptVersionLikeState();
  fixturePromptVersionScores = createFixturePromptVersionScoreState();
  fixturePromptVersionDailyInteractions = createFixturePromptVersionDailyInteractionState();
  fixturePromptVersions = createFixturePromptVersionState();
  fixtureCurrentVersionNoBySlug = createFixtureCurrentVersionState();
  fixtureSubmissions = createFixtureSubmissionState();
  fixtureSubmissionIdSeed = fixtureSubmissions.length;
  fixtureAuditLogs = [];
  fixtureCreatedPrompts = new Map<string, FixturePromptRecord>();
  fixtureDeletedPrompts = new Set<string>();
  CATEGORY_MAP.clear();
  for (const category of FIXTURE_CATEGORY_BASELINE) {
    CATEGORY_MAP.set(category.slug, category);
  }
  cachedDbReadable = undefined;
}

export function __getAuditLogFixtureStateForTests(): AuditLogEntry[] {
  return fixtureAuditLogs.map((entry) => ({
    ...entry,
    payloadJson: { ...entry.payloadJson },
  }));
}

export function __resetPromptVersionLikeTargetLookupCountForTests(): void {
  promptVersionLikeTargetLookupCountForTests = 0;
}

export function __getPromptVersionLikeTargetLookupCountForTests(): number {
  return promptVersionLikeTargetLookupCountForTests;
}

export function __resetPromptVersionLikesCountReadCountForTests(): void {
  promptVersionLikesCountReadCountForTests = 0;
}

export function __getPromptVersionLikesCountReadCountForTests(): number {
  return promptVersionLikesCountReadCountForTests;
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

export async function likePromptVersion(
  slug: string,
  versionNo: string,
  userEmail: string,
  existingTarget?: PromptVersionLikeTarget,
): Promise<PromptVersionLikeMutationResult | null> {
  const normalizedEmail = normalizeUserEmail(userEmail);
  const normalizedVersionNo = versionNo.trim();
  if (!normalizedEmail || !normalizedVersionNo) {
    return null;
  }

  if (await canReadFromDatabase()) {
    return likePromptVersionInDb(
      slug,
      normalizedVersionNo,
      normalizedEmail,
      existingTarget,
    );
  }

  return likePromptVersionInFixtures(slug, normalizedVersionNo, normalizedEmail);
}

export async function markPromptVersionDailyInteraction(input: {
  slug: string;
  versionNo: string;
  action: PromptVersionInteractionAction;
  ip: string;
  dateKey: string;
}): Promise<{
  result: PromptVersionDailyInteractionResult;
  target?: PromptVersionLikeTarget;
}> {
  const normalizedSlug = input.slug.trim();
  const normalizedVersionNo = input.versionNo.trim();
  const normalizedIp = input.ip.trim() || "unknown";
  const normalizedDateKey = input.dateKey.trim();
  if (!normalizedSlug || !normalizedVersionNo || !normalizedDateKey) {
    return { result: "not_found" };
  }

  // Fail-closed: when DB is reachable in auto mode, always evaluate infra in DB path.
  // Do not fallback to fixtures on missing interaction table/columns.
  if (
    getRepositoryDataSourceMode() !== "fixture" &&
    (await isPgReachable(getRuntimeDatabaseUrl(), 400))
  ) {
    return markPromptVersionDailyInteractionInDb({
      slug: normalizedSlug,
      versionNo: normalizedVersionNo,
      action: input.action,
      ip: normalizedIp,
      dateKey: normalizedDateKey,
    });
  }

  return {
    result: markPromptVersionDailyInteractionInFixtures({
      slug: normalizedSlug,
      versionNo: normalizedVersionNo,
      action: input.action,
      ip: normalizedIp,
      dateKey: normalizedDateKey,
    }),
  };
}

export async function unlikePromptVersion(
  slug: string,
  versionNo: string,
  userEmail: string,
): Promise<PromptVersionLikeMutationResult | null> {
  const normalizedEmail = normalizeUserEmail(userEmail);
  const normalizedVersionNo = versionNo.trim();
  if (!normalizedEmail || !normalizedVersionNo) {
    return null;
  }

  if (await canReadFromDatabase()) {
    return unlikePromptVersionInDb(slug, normalizedVersionNo, normalizedEmail);
  }

  return unlikePromptVersionInFixtures(slug, normalizedVersionNo, normalizedEmail);
}

export async function scorePromptVersion(
  slug: string,
  versionNo: string,
  userEmail: string,
  input: PromptVersionScoreMutationInput,
): Promise<PromptVersionScoreMutationResult | null> {
  const normalizedEmail = normalizeUserEmail(userEmail);
  const normalizedVersionNo = versionNo.trim();
  const normalizedScene = normalizeScene(input.scene);
  if (!normalizedEmail || !normalizedVersionNo || !normalizedScene || !isValidScore(input.score)) {
    return null;
  }

  const normalizedInput: PromptVersionScoreMutationInput = {
    score: input.score,
    scene: normalizedScene,
    traceId: normalizeTraceId(input.traceId),
  };

  if (await canReadFromDatabase()) {
    return scorePromptVersionInDb(slug, normalizedVersionNo, normalizedEmail, normalizedInput);
  }

  return scorePromptVersionInFixtures(
    slug,
    normalizedVersionNo,
    normalizedEmail,
    normalizedInput,
  );
}

export async function getPromptVersionScoreStats(
  slug: string,
  versionNo: string,
  scene?: string,
): Promise<PromptVersionScoreStatsResult | null> {
  const normalizedVersionNo = versionNo.trim();
  if (!normalizedVersionNo) {
    return null;
  }

  const normalizedScene = typeof scene === "string" ? normalizeScene(scene) : undefined;

  if (await canReadFromDatabase()) {
    return getPromptVersionScoreStatsFromDb(slug, normalizedVersionNo, normalizedScene);
  }

  return getPromptVersionScoreStatsFromFixtures(slug, normalizedVersionNo, normalizedScene);
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
    categorySlug:
      typeof input.categorySlug === "string" ? input.categorySlug.trim() : undefined,
    categorySlugs: Array.isArray(input.categorySlugs)
      ? input.categorySlugs
          .map((item) => (typeof item === "string" ? item.trim() : ""))
          .filter((item) => item.length > 0)
      : undefined,
  };

  if ((await canReadFromDatabase()) || (await canWriteToDatabase())) {
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
        categorySlug:
          typeof item.categorySlug === "string" ? item.categorySlug.trim() : undefined,
        categorySlugs: Array.isArray(item.categorySlugs)
          ? item.categorySlugs
              .map((slug) => (typeof slug === "string" ? slug.trim() : ""))
              .filter((slug) => slug.length > 0)
          : undefined,
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

export async function listAdminPrompts(
  query: AdminPromptListQuery = {},
): Promise<AdminPromptListItem[]> {
  const normalizedQuery: AdminPromptListQuery = {
    status: normalizeAdminPromptStatus(query.status),
    category: typeof query.category === "string" ? query.category.trim() : undefined,
    keyword: typeof query.keyword === "string" ? query.keyword.trim() : undefined,
  };
  if (await canWriteToDatabase()) {
    return listAdminPromptsFromDb(normalizedQuery);
  }
  return listAdminPromptsFromFixtures(normalizedQuery);
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
  if ((await canReadFromDatabase()) || (await canWriteToDatabase())) {
    return createAdminCategoryInDb(normalizedInput);
  }
  return createAdminCategoryInFixtures(normalizedInput);
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

export async function updateAdminPromptCategories(
  input: AdminPromptCategoryUpdateInput,
): Promise<AdminPromptCategoryUpdateResult> {
  const normalizedInput: AdminPromptCategoryUpdateInput = {
    reviewerEmail: normalizeUserEmail(input.reviewerEmail),
    reviewerRole: input.reviewerRole,
    slug: input.slug.trim(),
    categorySlugs: input.categorySlugs.map((item) => item.trim()).filter(Boolean),
    primaryCategorySlug: input.primaryCategorySlug.trim(),
  };
  if (await canWriteToDatabase()) {
    return updateAdminPromptCategoriesInDb(normalizedInput);
  }
  return updateAdminPromptCategoriesInFixtures(normalizedInput);
}

export async function updateAdminPromptsBatchCategories(
  input: AdminPromptBatchCategoryUpdateInput,
): Promise<AdminPromptBatchCategoryUpdateResult> {
  const dedupePreserveOrder = (items: string[]): string[] => {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const item of items) {
      if (seen.has(item)) {
        continue;
      }
      seen.add(item);
      result.push(item);
    }
    return result;
  };
  const normalizedInput: AdminPromptBatchCategoryUpdateInput = {
    reviewerEmail: normalizeUserEmail(input.reviewerEmail),
    reviewerRole: input.reviewerRole,
    slugs: dedupePreserveOrder(
      input.slugs.map((item) => item.trim()).filter(Boolean),
    ),
    addCategorySlugs: dedupePreserveOrder(
      input.addCategorySlugs.map((item) => item.trim()).filter(Boolean),
    ),
    removeCategorySlugs: dedupePreserveOrder(
      input.removeCategorySlugs.map((item) => item.trim()).filter(Boolean),
    ),
  };
  if (await canWriteToDatabase()) {
    return updateAdminPromptsBatchCategoriesInDb(normalizedInput);
  }
  return updateAdminPromptsBatchCategoriesInFixtures(normalizedInput);
}

export async function archiveAdminPrompt(
  input: AdminPromptStatusMutationInput,
): Promise<AdminPromptStatusMutationResult> {
  const normalizedInput: AdminPromptStatusMutationInput = {
    reviewerEmail: normalizeUserEmail(input.reviewerEmail),
    reviewerRole: input.reviewerRole,
    slug: input.slug.trim(),
  };
  if (await canWriteToDatabase()) {
    return mutateAdminPromptStatusInDb("archive", normalizedInput);
  }
  return mutateAdminPromptStatusInFixtures("archive", normalizedInput);
}

export async function restoreAdminPrompt(
  input: AdminPromptStatusMutationInput,
): Promise<AdminPromptStatusMutationResult> {
  const normalizedInput: AdminPromptStatusMutationInput = {
    reviewerEmail: normalizeUserEmail(input.reviewerEmail),
    reviewerRole: input.reviewerRole,
    slug: input.slug.trim(),
  };
  if (await canWriteToDatabase()) {
    return mutateAdminPromptStatusInDb("restore", normalizedInput);
  }
  return mutateAdminPromptStatusInFixtures("restore", normalizedInput);
}

export async function deleteAdminPrompt(
  input: AdminPromptDeleteInput,
): Promise<AdminPromptDeleteResult> {
  const normalizedInput: AdminPromptDeleteInput = {
    reviewerEmail: normalizeUserEmail(input.reviewerEmail),
    reviewerRole: input.reviewerRole,
    slug: input.slug.trim(),
    confirm: input.confirm,
    confirmationToken: input.confirmationToken?.trim(),
    reason: input.reason?.trim(),
  };
  if (await canWriteToDatabase()) {
    return deleteAdminPromptInDb(normalizedInput);
  }
  return deleteAdminPromptInFixtures(normalizedInput);
}

export async function deleteAdminPromptsBatch(
  input: AdminPromptBatchDeleteInput,
): Promise<AdminPromptBatchDeleteResult> {
  const dedupedSlugs = [...new Set(input.slugs.map((item) => item.trim()).filter(Boolean))];
  const normalizedInput: AdminPromptBatchDeleteInput = {
    reviewerEmail: normalizeUserEmail(input.reviewerEmail),
    reviewerRole: input.reviewerRole,
    slugs: dedupedSlugs,
    dryRun: input.dryRun === true,
    confirm: input.confirm,
    confirmationToken: input.confirmationToken?.trim(),
    reason: input.reason?.trim(),
  };
  if (await canWriteToDatabase()) {
    return deleteAdminPromptsBatchInDb(normalizedInput);
  }
  return deleteAdminPromptsBatchInFixtures(normalizedInput);
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
