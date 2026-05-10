-- Migration: Add is_ai and source_tag to social_icebreaker_lie_truths
-- Date: 2026-05-07
-- Description: Tracks AI-generated statements (Lie Detective V2) and the user's original tag

ALTER TABLE social_icebreaker_lie_truths
ADD COLUMN IF NOT EXISTS is_ai boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS source_tag text;
