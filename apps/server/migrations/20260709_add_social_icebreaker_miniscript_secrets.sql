-- Add social_icebreaker_miniscript_secrets table for server-side MiniScript secrets
CREATE TABLE IF NOT EXISTS social_icebreaker_miniscript_secrets (
  social_session_id varchar(64) PRIMARY KEY REFERENCES social_icebreaker_sessions(id) ON DELETE CASCADE,
  secrets_json text NOT NULL,
  created_at timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_miniscript_secrets_session ON social_icebreaker_miniscript_secrets(social_session_id);
