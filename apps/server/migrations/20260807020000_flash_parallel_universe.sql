-- Additive rollout for Street Blind Box parallel universes.
-- Apply manually after inspecting the live PostgreSQL schema. Safe to re-run.

CREATE TABLE IF NOT EXISTS flash_story_release_snapshots (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id varchar NOT NULL REFERENCES flash_story_seasons(id),
  revision integer NOT NULL CHECK (revision > 0),
  manifest_hash varchar(64) NOT NULL,
  manifest jsonb NOT NULL,
  status varchar(24) NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'superseded')),
  published_by varchar(120),
  published_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(season_id, revision)
);
CREATE INDEX IF NOT EXISTS idx_flash_story_release_current
  ON flash_story_release_snapshots(status, published_at);
CREATE INDEX IF NOT EXISTS idx_flash_story_release_hash
  ON flash_story_release_snapshots(manifest_hash);
CREATE UNIQUE INDEX IF NOT EXISTS uq_flash_story_one_current
  ON flash_story_release_snapshots(status) WHERE status = 'published';

CREATE TABLE IF NOT EXISTS flash_story_universe_runs (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  release_snapshot_id varchar NOT NULL REFERENCES flash_story_release_snapshots(id),
  mode varchar(24) NOT NULL CHECK (mode IN ('standard', 'personalized')),
  universe_vector jsonb NOT NULL DEFAULT '{"trust":0,"attachment":0,"intervention":0,"truth":0}'::jsonb,
  flags text[] NOT NULL DEFAULT ARRAY[]::text[],
  echo_queue jsonb NOT NULL DEFAULT '[]'::jsonb,
  ending_code varchar(40),
  status varchar(24) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  state_version integer NOT NULL DEFAULT 1 CHECK (state_version > 0),
  consent_version varchar(40),
  consented_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, release_snapshot_id),
  CHECK (
    (mode = 'standard' AND consent_version IS NULL AND consented_at IS NULL)
    OR (mode = 'personalized' AND consent_version IS NOT NULL AND consented_at IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS idx_flash_story_universe_resume
  ON flash_story_universe_runs(user_id, status, updated_at);

ALTER TABLE flash_user_story_progress
  ADD COLUMN IF NOT EXISTS universe_run_id varchar REFERENCES flash_story_universe_runs(id);
ALTER TABLE flash_user_story_episodes
  ADD COLUMN IF NOT EXISTS universe_run_id varchar REFERENCES flash_story_universe_runs(id);
ALTER TABLE flash_user_story_episodes
  ADD COLUMN IF NOT EXISTS effect_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE flash_user_story_episodes
  ADD COLUMN IF NOT EXISTS echo_snapshot text;
ALTER TABLE flash_user_story_episodes
  ADD COLUMN IF NOT EXISTS response_snapshot text;
ALTER TABLE flash_user_story_episodes
  ADD COLUMN IF NOT EXISTS render_kind varchar(24) NOT NULL DEFAULT 'template';
ALTER TABLE flash_user_story_episodes
  ADD COLUMN IF NOT EXISTS prompt_version varchar(80);
ALTER TABLE flash_user_story_fragments
  ADD COLUMN IF NOT EXISTS fragment_snapshot jsonb;

DO $$ BEGIN
  ALTER TABLE flash_user_story_episodes
    ADD CONSTRAINT ck_flash_user_story_render_kind
    CHECK (render_kind IN ('template', 'ai', 'fallback'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_flash_user_story_episode_run
  ON flash_user_story_episodes(universe_run_id, completed_at);

CREATE TABLE IF NOT EXISTS flash_story_choice_intents (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  encounter_id varchar NOT NULL REFERENCES flash_encounters(id) ON DELETE CASCADE,
  episode_id varchar NOT NULL REFERENCES flash_story_episodes(id) ON DELETE CASCADE,
  question_id varchar(80) NOT NULL,
  option_id varchar(80) NOT NULL,
  status varchar(24) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'completed')),
  lease_token varchar(80),
  lease_expires_at timestamptz,
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  response_snapshot text,
  render_kind varchar(24) CHECK (render_kind IS NULL OR render_kind IN ('template', 'ai', 'fallback')),
  prompt_version varchar(80),
  last_error_code varchar(80),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(encounter_id)
);
CREATE INDEX IF NOT EXISTS idx_flash_story_choice_intent_recovery
  ON flash_story_choice_intents(status, lease_expires_at);
CREATE UNIQUE INDEX IF NOT EXISTS uq_flash_story_choice_intent_episode
  ON flash_story_choice_intents(user_id, episode_id);

-- Existing users are intentionally not backfilled here. After this migration, an
-- operator must review and republish the active season once; publishing creates the
-- immutable release snapshot. The next story entry then binds the user to that release.
