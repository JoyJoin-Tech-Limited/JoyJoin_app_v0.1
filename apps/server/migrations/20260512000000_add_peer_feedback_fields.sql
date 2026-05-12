-- Add peer feedback fields to event_group_outcomes
ALTER TABLE "event_group_outcomes" ADD COLUMN "member_scores" jsonb;
ALTER TABLE "event_group_outcomes" ADD COLUMN "member_tags" jsonb;
ALTER TABLE "event_group_outcomes" ADD COLUMN "member_comments" jsonb;

-- Add Step 1 quick chip fields to event_feedback
ALTER TABLE "event_feedback" ADD COLUMN "venue_experience" varchar;
ALTER TABLE "event_feedback" ADD COLUMN "icebreaker_experience" varchar;
ALTER TABLE "event_feedback" ADD COLUMN "value_experience" varchar;
