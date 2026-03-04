ALTER TABLE event_attendance
  ADD COLUMN IF NOT EXISTS blind_box_event_id VARCHAR,
  ADD COLUMN IF NOT EXISTS attendance_status VARCHAR DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS estimated_late_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS absent_reason VARCHAR,
  ADD COLUMN IF NOT EXISTS attendance_status_updated_at TIMESTAMP;

ALTER TABLE event_attendance
  ALTER COLUMN event_id DROP NOT NULL;

-- Partial unique index so UPSERT works for blind box events while ignoring legacy rows where blind_box_event_id IS NULL
CREATE UNIQUE INDEX IF NOT EXISTS idx_event_attendance_blind_box_user
  ON event_attendance(blind_box_event_id, user_id)
  WHERE blind_box_event_id IS NOT NULL;
