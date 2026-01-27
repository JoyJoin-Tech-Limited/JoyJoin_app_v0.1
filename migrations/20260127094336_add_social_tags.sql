-- Add social tag system to users table
-- Migration: 20260127094336_add_social_tags.sql

-- Add social tag columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS social_tag TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS social_tag_selected_at TIMESTAMP;

-- Create table for tracking tag generation history and user selections
CREATE TABLE IF NOT EXISTS user_social_tag_generations (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR NOT NULL,
  
  -- Generated tags stored as JSONB array
  -- Example structure:
  -- [
  --   {
  --     "descriptor": "数据拓荒人",
  --     "archetypeNickname": "巷口密探", 
  --     "fullTag": "数据拓荒人·巷口密探",
  --     "reasoning": "结合数据分析师职业和探索精神"
  --   },
  --   {...}, {...}
  -- ]
  tags JSONB NOT NULL,
  
  -- Metadata
  generation_version TEXT DEFAULT 'v1.0',
  generated_at TIMESTAMP DEFAULT NOW(),
  
  -- User selection tracking
  selected_index INTEGER,
  selected_tag TEXT,
  selected_at TIMESTAMP,
  
  -- Context used for generation (for debugging/improvement)
  -- Example: {
  --   "archetype": "机智狐",
  --   "profession": {"occupationId": "data_analyst", "industry": "互联网"},
  --   "hobbies": [{"name": "攀岩", "heat": 85}]
  -- }
  generation_context JSONB,
  
  -- Foreign key to users table
  CONSTRAINT fk_user_social_tags_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  
  -- Ensure one latest generation per user (can be updated)
  CONSTRAINT unique_user_latest_tag UNIQUE(user_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_social_tags_user ON user_social_tag_generations(user_id);
CREATE INDEX IF NOT EXISTS idx_social_tags_selected ON user_social_tag_generations(selected_at) WHERE selected_at IS NOT NULL;
