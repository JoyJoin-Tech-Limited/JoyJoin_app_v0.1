-- Add onboarding analytics table for funnel tracking
-- Phase 2: Analytics & Monitoring

BEGIN;

CREATE TABLE IF NOT EXISTS onboarding_analytics (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR REFERENCES users(id) ON DELETE CASCADE,
  session_id VARCHAR,
  
  -- Event details
  step VARCHAR NOT NULL,
  event_type VARCHAR NOT NULL,
  
  -- Timing
  timestamp TIMESTAMP DEFAULT NOW() NOT NULL,
  session_duration INTEGER,
  step_duration INTEGER,
  
  -- Metadata
  metadata JSONB,
  user_agent VARCHAR,
  screen_size VARCHAR,
  
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_onboarding_analytics_user_id ON onboarding_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_analytics_session_id ON onboarding_analytics(session_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_analytics_step ON onboarding_analytics(step);
CREATE INDEX IF NOT EXISTS idx_onboarding_analytics_event_type ON onboarding_analytics(event_type);
CREATE INDEX IF NOT EXISTS idx_onboarding_analytics_timestamp ON onboarding_analytics(timestamp);

-- Comments for documentation
COMMENT ON TABLE onboarding_analytics IS 'Tracks user progression through onboarding flow for funnel analysis';
COMMENT ON COLUMN onboarding_analytics.step IS 'Onboarding step: onboarding, personality-test, essential-data, extended-data, profile-review, guide, discover';
COMMENT ON COLUMN onboarding_analytics.event_type IS 'Event type: step_started, step_completed, step_abandoned, validation_failed, error_occurred';
COMMENT ON COLUMN onboarding_analytics.session_duration IS 'Total time in session since start (milliseconds)';
COMMENT ON COLUMN onboarding_analytics.step_duration IS 'Time spent on this specific step (milliseconds)';

COMMIT;
