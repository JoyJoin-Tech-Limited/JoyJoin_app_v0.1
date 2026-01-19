-- Migration: Fix Assessment Answer Unique Constraint
-- This migration removes duplicate assessment answers and ensures the unique constraint exists

-- Step 1: Remove duplicate assessment answers, keeping only the most recent one per (session_id, question_id)
-- Using a CTE to identify duplicates and delete older ones
-- Ordering: answered_at DESC NULLS LAST ensures we keep the most recently answered question
-- If answered_at is null (shouldn't happen in practice), we fall back to id DESC to keep the most recent insert
WITH ranked_answers AS (
  SELECT 
    id,
    session_id,
    question_id,
    answered_at,
    ROW_NUMBER() OVER (
      PARTITION BY session_id, question_id 
      ORDER BY answered_at DESC NULLS LAST, id DESC
    ) as rn
  FROM assessment_answers
),
duplicates_to_delete AS (
  SELECT id FROM ranked_answers WHERE rn > 1
)
DELETE FROM assessment_answers
WHERE id IN (SELECT id FROM duplicates_to_delete);

-- Step 2: Add the unique constraint if it doesn't exist
-- Check if constraint exists first to make this migration idempotent
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'assessment_answer_session_question_unique'
  ) THEN
    ALTER TABLE assessment_answers 
    ADD CONSTRAINT assessment_answer_session_question_unique 
    UNIQUE (session_id, question_id);
  END IF;
END $$;
