-- Add venue assignment tracking columns to event_pool_groups
ALTER TABLE event_pool_groups 
ADD COLUMN IF NOT EXISTS venue_assignment_status VARCHAR DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS venue_assignment_reason TEXT;
