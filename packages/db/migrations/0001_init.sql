CREATE TYPE "user_role" AS ENUM ('user', 'admin');
CREATE TYPE "category_status" AS ENUM ('active', 'inactive');
CREATE TYPE "prompt_status" AS ENUM ('draft', 'published', 'archived');
CREATE TYPE "version_source_type" AS ENUM ('create', 'edit', 'submission', 'rollback');
CREATE TYPE "submission_status" AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE "users" (
  "id" serial PRIMARY KEY NOT NULL,
  "email" text NOT NULL,
  "role" "user_role" NOT NULL DEFAULT 'user',
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "users_email_unique" UNIQUE ("email")
);

CREATE TABLE "categories" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "status" "category_status" DEFAULT 'active' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "categories_slug_key" ON "categories" USING btree ("slug");

CREATE TABLE "prompts" (
  "id" serial PRIMARY KEY NOT NULL,
  "slug" text NOT NULL,
  "title" text NOT NULL,
  "summary" text NOT NULL,
  "category_id" integer NOT NULL,
  "current_version_id" integer,
  "likes_count" integer DEFAULT 0 NOT NULL,
  "status" "prompt_status" DEFAULT 'draft' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "prompts_slug_key" ON "prompts" USING btree ("slug");

CREATE TABLE "prompt_versions" (
  "id" serial PRIMARY KEY NOT NULL,
  "prompt_id" integer NOT NULL,
  "version_no" text NOT NULL,
  "content" text NOT NULL,
  "change_note" text,
  "source_type" "version_source_type" DEFAULT 'edit' NOT NULL,
  "submitted_by" integer,
  "submitted_at" timestamp DEFAULT now() NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "prompt_versions_prompt_id_version_no_key" ON "prompt_versions" USING btree ("prompt_id", "version_no");

CREATE TABLE "submissions" (
  "id" serial PRIMARY KEY NOT NULL,
  "prompt_id" integer NOT NULL,
  "base_version_id" integer NOT NULL,
  "candidate_version_id" integer NOT NULL,
  "submitter_id" integer NOT NULL,
  "status" "submission_status" DEFAULT 'pending' NOT NULL,
  "reviewed_by" integer,
  "review_comment" text,
  "reviewed_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "submissions_candidate_version_id_key" ON "submissions" USING btree ("candidate_version_id");

CREATE TABLE "prompt_likes" (
  "id" serial PRIMARY KEY NOT NULL,
  "prompt_id" integer NOT NULL,
  "user_id" integer NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "prompt_likes_prompt_id_user_id_key" ON "prompt_likes" USING btree ("prompt_id", "user_id");

CREATE TABLE "audit_logs" (
  "id" serial PRIMARY KEY NOT NULL,
  "actor_id" integer,
  "action" text NOT NULL,
  "target_type" text NOT NULL,
  "target_id" integer NOT NULL,
  "payload_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "prompts"
  ADD CONSTRAINT "prompts_category_id_categories_id_fk"
  FOREIGN KEY ("category_id")
  REFERENCES "public"."categories"("id")
  ON DELETE RESTRICT
  ON UPDATE NO ACTION;

ALTER TABLE "prompt_versions"
  ADD CONSTRAINT "prompt_versions_prompt_id_prompts_id_fk"
  FOREIGN KEY ("prompt_id")
  REFERENCES "public"."prompts"("id")
  ON DELETE CASCADE
  ON UPDATE NO ACTION;

ALTER TABLE "prompt_versions"
  ADD CONSTRAINT "prompt_versions_submitted_by_users_id_fk"
  FOREIGN KEY ("submitted_by")
  REFERENCES "public"."users"("id")
  ON DELETE SET NULL
  ON UPDATE NO ACTION;

ALTER TABLE "submissions"
  ADD CONSTRAINT "submissions_prompt_id_prompts_id_fk"
  FOREIGN KEY ("prompt_id")
  REFERENCES "public"."prompts"("id")
  ON DELETE CASCADE
  ON UPDATE NO ACTION;

ALTER TABLE "submissions"
  ADD CONSTRAINT "submissions_base_version_id_prompt_versions_id_fk"
  FOREIGN KEY ("base_version_id")
  REFERENCES "public"."prompt_versions"("id")
  ON DELETE RESTRICT
  ON UPDATE NO ACTION;

ALTER TABLE "submissions"
  ADD CONSTRAINT "submissions_candidate_version_id_prompt_versions_id_fk"
  FOREIGN KEY ("candidate_version_id")
  REFERENCES "public"."prompt_versions"("id")
  ON DELETE RESTRICT
  ON UPDATE NO ACTION;

ALTER TABLE "submissions"
  ADD CONSTRAINT "submissions_submitter_id_users_id_fk"
  FOREIGN KEY ("submitter_id")
  REFERENCES "public"."users"("id")
  ON DELETE RESTRICT
  ON UPDATE NO ACTION;

ALTER TABLE "submissions"
  ADD CONSTRAINT "submissions_reviewed_by_users_id_fk"
  FOREIGN KEY ("reviewed_by")
  REFERENCES "public"."users"("id")
  ON DELETE SET NULL
  ON UPDATE NO ACTION;

ALTER TABLE "prompt_likes"
  ADD CONSTRAINT "prompt_likes_prompt_id_prompts_id_fk"
  FOREIGN KEY ("prompt_id")
  REFERENCES "public"."prompts"("id")
  ON DELETE CASCADE
  ON UPDATE NO ACTION;

ALTER TABLE "prompt_likes"
  ADD CONSTRAINT "prompt_likes_user_id_users_id_fk"
  FOREIGN KEY ("user_id")
  REFERENCES "public"."users"("id")
  ON DELETE CASCADE
  ON UPDATE NO ACTION;

ALTER TABLE "audit_logs"
  ADD CONSTRAINT "audit_logs_actor_id_users_id_fk"
  FOREIGN KEY ("actor_id")
  REFERENCES "public"."users"("id")
  ON DELETE SET NULL
  ON UPDATE NO ACTION;

ALTER TABLE "prompts"
  ADD CONSTRAINT "prompts_current_version_id_prompt_versions_id_fk"
  FOREIGN KEY ("current_version_id")
  REFERENCES "public"."prompt_versions"("id")
  ON DELETE SET NULL
  ON UPDATE NO ACTION;
