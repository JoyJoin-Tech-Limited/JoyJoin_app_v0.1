ALTER TABLE event_attendance
  ADD COLUMN IF NOT EXISTS attendance_status VARCHAR DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS estimated_late_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS absent_reason VARCHAR,
  ADD COLUMN IF NOT EXISTS attendance_status_updated_at TIMESTAMP;
