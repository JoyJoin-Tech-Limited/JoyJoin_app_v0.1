CREATE TABLE IF NOT EXISTS "user_semantic_profiles" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "status" varchar DEFAULT 'pending' NOT NULL,
  "profile_document" text NOT NULL,
  "version_vector" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "generator_version" varchar DEFAULT 'semantic-profile-v1' NOT NULL,
  "embedding" jsonb,
  "embedding_model" varchar,
  "embedding_dimension" integer,
  "last_error" text,
  "last_computed_at" timestamp,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_user_semantic_profiles_user"
  ON "user_semantic_profiles" ("user_id");

CREATE INDEX IF NOT EXISTS "idx_user_semantic_profiles_status"
  ON "user_semantic_profiles" ("status");
