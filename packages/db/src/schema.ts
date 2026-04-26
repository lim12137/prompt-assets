import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const coreTableNames = [
  "users",
  "categories",
  "prompts",
  "prompt_categories",
  "prompt_versions",
  "submissions",
  "prompt_likes",
  "prompt_version_likes",
  "audit_logs",
] as const;

export const coreUniqueConstraints = [
  { table: "prompts", columns: ["slug"] },
  { table: "prompt_categories", columns: ["prompt_id", "category_id"] },
  { table: "prompt_versions", columns: ["prompt_id", "version_no"] },
  { table: "prompt_likes", columns: ["prompt_id", "user_id"] },
  { table: "prompt_version_likes", columns: ["prompt_version_id", "user_id"] },
] as const;

export const userRoleEnum = pgEnum("user_role", ["user", "admin"]);
export const categoryStatusEnum = pgEnum("category_status", ["active", "inactive"]);
export const promptStatusEnum = pgEnum("prompt_status", [
  "draft",
  "published",
  "archived",
]);
export const versionSourceTypeEnum = pgEnum("version_source_type", [
  "create",
  "edit",
  "submission",
  "rollback",
]);
export const submissionStatusEnum = pgEnum("submission_status", [
  "pending",
  "approved",
  "rejected",
]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  role: userRoleEnum("role").notNull().default("user"),
  createdAt: timestamp("created_at", { withTimezone: false }).notNull().defaultNow(),
});

export const categories = pgTable(
  "categories",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    status: categoryStatusEnum("status").notNull().default("active"),
    isSystem: boolean("is_system").notNull().default(false),
    isSelectable: boolean("is_selectable").notNull().default(true),
    isCollapsedByDefault: boolean("is_collapsed_by_default")
      .notNull()
      .default(false),
    createdAt: timestamp("created_at", { withTimezone: false })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: false })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("categories_slug_key").on(table.slug)],
);

export const prompts = pgTable(
  "prompts",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    categoryId: integer("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    currentVersionId: integer("current_version_id"),
    likesCount: integer("likes_count").notNull().default(0),
    status: promptStatusEnum("status").notNull().default("draft"),
    createdAt: timestamp("created_at", { withTimezone: false })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: false })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("prompts_slug_key").on(table.slug)],
);

export const promptCategories = pgTable(
  "prompt_categories",
  {
    id: serial("id").primaryKey(),
    promptId: integer("prompt_id")
      .notNull()
      .references(() => prompts.id, { onDelete: "cascade" }),
    categoryId: integer("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: false })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("prompt_categories_prompt_id_category_id_key").on(
      table.promptId,
      table.categoryId,
    ),
    index("prompt_categories_category_id_prompt_id_idx").on(
      table.categoryId,
      table.promptId,
    ),
  ],
);

export const promptVersions = pgTable(
  "prompt_versions",
  {
    id: serial("id").primaryKey(),
    promptId: integer("prompt_id")
      .notNull()
      .references(() => prompts.id, { onDelete: "cascade" }),
    versionNo: text("version_no").notNull(),
    content: text("content").notNull(),
    likesCount: integer("likes_count").notNull().default(0),
    changeNote: text("change_note"),
    sourceType: versionSourceTypeEnum("source_type").notNull().default("edit"),
    submittedBy: integer("submitted_by").references(() => users.id, {
      onDelete: "set null",
    }),
    submittedAt: timestamp("submitted_at", { withTimezone: false })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: false })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("prompt_versions_prompt_id_version_no_key").on(
      table.promptId,
      table.versionNo,
    ),
  ],
);

export const submissions = pgTable(
  "submissions",
  {
    id: serial("id").primaryKey(),
    promptId: integer("prompt_id")
      .notNull()
      .references(() => prompts.id, { onDelete: "cascade" }),
    baseVersionId: integer("base_version_id")
      .notNull()
      .references(() => promptVersions.id, { onDelete: "restrict" }),
    candidateVersionId: integer("candidate_version_id")
      .notNull()
      .references(() => promptVersions.id, { onDelete: "restrict" }),
    submitterId: integer("submitter_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    status: submissionStatusEnum("status").notNull().default("pending"),
    reviewedBy: integer("reviewed_by").references(() => users.id, {
      onDelete: "set null",
    }),
    reviewComment: text("review_comment"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: false }),
    createdAt: timestamp("created_at", { withTimezone: false })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: false })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("submissions_candidate_version_id_key").on(table.candidateVersionId)],
);

export const promptLikes = pgTable(
  "prompt_likes",
  {
    id: serial("id").primaryKey(),
    promptId: integer("prompt_id")
      .notNull()
      .references(() => prompts.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: false })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("prompt_likes_prompt_id_user_id_key").on(table.promptId, table.userId)],
);

export const promptVersionLikes = pgTable(
  "prompt_version_likes",
  {
    id: serial("id").primaryKey(),
    promptVersionId: integer("prompt_version_id")
      .notNull()
      .references(() => promptVersions.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: false })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("prompt_version_likes_prompt_version_id_user_id_key").on(
      table.promptVersionId,
      table.userId,
    ),
  ],
);

export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  actorId: integer("actor_id").references(() => users.id, {
    onDelete: "set null",
  }),
  action: text("action").notNull(),
  targetType: text("target_type").notNull(),
  targetId: integer("target_id").notNull(),
  payloadJson: jsonb("payload_json")
    .$type<Record<string, unknown>>()
    .notNull()
    .default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: false }).notNull().defaultNow(),
});
