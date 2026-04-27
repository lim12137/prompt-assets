CREATE TABLE "prompt_version_scores" (
  "id" serial PRIMARY KEY NOT NULL,
  "prompt_version_id" integer NOT NULL,
  "user_id" integer NOT NULL,
  "scene" text NOT NULL,
  "trace_id" text NOT NULL,
  "score" integer NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "prompt_version_scores_score_range_check"
    CHECK ("score" BETWEEN 1 AND 5)
);

CREATE UNIQUE INDEX "prompt_version_scores_prompt_version_id_scene_trace_id_key"
  ON "prompt_version_scores" USING btree ("prompt_version_id", "scene", "trace_id");

CREATE INDEX "prompt_version_scores_prompt_version_id_idx"
  ON "prompt_version_scores" USING btree ("prompt_version_id");

CREATE INDEX "prompt_version_scores_prompt_version_id_scene_idx"
  ON "prompt_version_scores" USING btree ("prompt_version_id", "scene");

ALTER TABLE "prompt_version_scores"
  ADD CONSTRAINT "prompt_version_scores_prompt_version_id_prompt_versions_id_fk"
  FOREIGN KEY ("prompt_version_id")
  REFERENCES "public"."prompt_versions"("id")
  ON DELETE CASCADE
  ON UPDATE NO ACTION;

ALTER TABLE "prompt_version_scores"
  ADD CONSTRAINT "prompt_version_scores_user_id_users_id_fk"
  FOREIGN KEY ("user_id")
  REFERENCES "public"."users"("id")
  ON DELETE CASCADE
  ON UPDATE NO ACTION;
