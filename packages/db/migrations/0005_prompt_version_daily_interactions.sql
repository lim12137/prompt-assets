CREATE TABLE "prompt_version_daily_interactions" (
  "id" serial PRIMARY KEY NOT NULL,
  "prompt_version_id" integer NOT NULL,
  "action" text NOT NULL,
  "ip_hash" text NOT NULL,
  "date_key" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "prompt_version_daily_interactions_unique_key"
  ON "prompt_version_daily_interactions" USING btree ("prompt_version_id", "action", "ip_hash", "date_key");

CREATE INDEX "prompt_version_daily_interactions_prompt_version_id_idx"
  ON "prompt_version_daily_interactions" USING btree ("prompt_version_id");

ALTER TABLE "prompt_version_daily_interactions"
  ADD CONSTRAINT "prompt_version_daily_interactions_prompt_version_id_prompt_versions_id_fk"
  FOREIGN KEY ("prompt_version_id")
  REFERENCES "public"."prompt_versions"("id")
  ON DELETE CASCADE
  ON UPDATE NO ACTION;

