CREATE TABLE IF NOT EXISTS social_icebreaker_ai_feedback (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  social_session_id varchar NOT NULL REFERENCES social_icebreaker_sessions(id) ON DELETE CASCADE,
  submitted_by varchar NOT NULL REFERENCES users(id),
  phase varchar NOT NULL,
  prompt_version varchar NOT NULL,
  ai_correlation_id varchar(36) NOT NULL,
  rating varchar(16) NOT NULL CHECK (rating IN ('helpful', 'neutral', 'awkward')),
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_social_icebreaker_ai_feedback_session ON social_icebreaker_ai_feedback(social_session_id);
CREATE INDEX IF NOT EXISTS idx_social_icebreaker_ai_feedback_phase_prompt ON social_icebreaker_ai_feedback(phase, prompt_version);
CREATE INDEX IF NOT EXISTS idx_social_icebreaker_ai_feedback_created ON social_icebreaker_ai_feedback(created_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_social_icebreaker_ai_feedback_dedupe
  ON social_icebreaker_ai_feedback(submitted_by, social_session_id, phase, ai_correlation_id);
