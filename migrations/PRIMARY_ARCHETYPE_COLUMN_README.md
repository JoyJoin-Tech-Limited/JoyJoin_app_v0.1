# Migration: Add primary_archetype Column

**Date:** 2026-01-20  
**File:** `20260120054000_add_primary_archetype_column.sql`

## Problem

The `users` table in the database was missing the `primary_archetype` and `secondary_archetype` columns that are defined in the schema (`packages/shared/src/schema.ts`). This was causing login failures when the application tried to query user data.

## Solution

This migration adds the missing columns to the `users` table:

1. **primary_archetype** - VARCHAR(50), nullable
   - Stores the user's primary personality archetype (12 animal-based archetypes)
   - Nullable to allow existing users to have NULL values
   
2. **secondary_archetype** - VARCHAR(50), nullable  
   - Stores the user's secondary archetype (used in matching algorithm)
   - Nullable to allow existing users to have NULL values

## Implementation Details

- The migration is **idempotent** - safe to run multiple times
- Uses `IF NOT EXISTS` checks to avoid errors if columns already exist
- Both columns are nullable to support existing users
- Columns will be automatically populated when users complete their personality assessment

## SQL

```sql
-- Idempotent version (actual migration implementation)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'primary_archetype'
  ) THEN
    ALTER TABLE users ADD COLUMN primary_archetype VARCHAR(50);
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'secondary_archetype'
  ) THEN
    ALTER TABLE users ADD COLUMN secondary_archetype VARCHAR(50);
  END IF;
END $$;
```

## How to Apply

```bash
npm run db:push
```

## Rollback (if needed)

```sql
ALTER TABLE users DROP COLUMN IF EXISTS primary_archetype;
ALTER TABLE users DROP COLUMN IF EXISTS secondary_archetype;
```

## Schema Consistency

This migration ensures the database schema matches the TypeScript schema definition in `packages/shared/src/schema.ts`:

```typescript
primaryArchetype: varchar("primary_archetype"), // Line 157
secondaryArchetype: varchar("secondary_archetype"), // Line 158
```

## Related Files

- Schema definition: `packages/shared/src/schema.ts` (lines 157-158)
- Previous related migration: `20260119000000_rename_role_to_archetype.sql`
