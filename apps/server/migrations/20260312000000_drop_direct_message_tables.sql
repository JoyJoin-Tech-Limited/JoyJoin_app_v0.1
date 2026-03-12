-- Drop legacy direct-message tables (PR 3 of 3: finalize connection-first social model)
-- The product no longer supports in-app private/direct chat.
-- Structured connections are tracked via the `connections` table (post-event mutual selection + WeChat reveal).

-- Step 1: Drop FK constraints from chat_reports and chat_logs that reference direct_message_threads
ALTER TABLE "chat_reports" DROP CONSTRAINT IF EXISTS "chat_reports_thread_id_direct_message_threads_id_fk";--> statement-breakpoint
ALTER TABLE "chat_logs" DROP CONSTRAINT IF EXISTS "chat_logs_thread_id_direct_message_threads_id_fk";--> statement-breakpoint

-- Step 2: Drop direct_messages first (has FK to direct_message_threads)
DROP TABLE IF EXISTS "direct_messages";--> statement-breakpoint

-- Step 3: Drop direct_message_threads
DROP TABLE IF EXISTS "direct_message_threads";--> statement-breakpoint
