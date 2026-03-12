-- Migration: Add budget restriction fields to event_pools table
-- Date: 2026-01-27
-- Description: Adds budget_restrictions and bar_budget_restrictions fields to support hard budget constraints in pool matching

ALTER TABLE "event_pools" 
ADD COLUMN IF NOT EXISTS "budget_restrictions" text[],
ADD COLUMN IF NOT EXISTS "bar_budget_restrictions" text[];

-- Add comments for documentation
COMMENT ON COLUMN "event_pools"."budget_restrictions" IS '饭局预算限制（硬约束）- 例如: ["150以下", "150-200", "200-300", "300-500"]';
COMMENT ON COLUMN "event_pools"."bar_budget_restrictions" IS '酒局预算限制（硬约束）- 每杯酒的价格范围';
