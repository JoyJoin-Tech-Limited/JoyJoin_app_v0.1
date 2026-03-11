# Budget Restrictions Migration

## Overview
This migration adds budget restriction fields to the `event_pools` table to support hard budget constraints in the pool matching service.

## Changes
- Added `budget_restrictions` column (text array) for 饭局 (dining) events
- Added `bar_budget_restrictions` column (text array) for 酒局 (bar) events

## Fields

### budget_restrictions
- **Type**: text[]
- **Nullable**: Yes
- **Purpose**: Hard constraint for meal budget ranges
- **Example values**: ["150以下", "150-200", "200-300", "300-500"]
- **Usage**: Used in `poolMatchingService.ts` to filter users based on budget compatibility

### bar_budget_restrictions
- **Type**: text[]
- **Nullable**: Yes
- **Purpose**: Hard constraint for bar/drink budget ranges
- **Example values**: Per-drink price ranges for bar events
- **Usage**: Used in `poolMatchingService.ts` for 酒局 event type

## Impact
- **Backward Compatible**: Yes (nullable fields)
- **Requires Data Migration**: No
- **Breaking Changes**: None

## Related Files
- `packages/shared/src/schema.ts` - Schema definition updated
- `apps/server/src/poolMatchingService.ts` - Uses these fields for hard constraint filtering

## Notes
- These fields are optional and only used when event organizers want to enforce budget restrictions
- When set, the matching algorithm will only include users whose budget preferences overlap with the pool restrictions
- Empty/null arrays mean no budget restrictions (all users eligible)
