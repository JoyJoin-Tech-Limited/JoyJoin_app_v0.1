-- Add composite index to support AI-content report queue listing
-- Filter: category = 'ai_content' [+ optional status]; order by createdAt desc
DROP INDEX IF EXISTS idx_reports_category_status_created_at;
CREATE INDEX idx_reports_category_status_created_at ON reports (category, status, created_at);
