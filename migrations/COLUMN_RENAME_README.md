# Column Rename Migration: primary_role → primary_archetype

## Problem
The database schema was using outdated column names (`primary_role`, `secondary_role`, etc.) while the application code was updated to use new names (`primary_archetype`, `secondary_archetype`, etc.). This caused errors when `drizzle-kit push` tried to sync the schema.

## Solution
A dedicated migration script (`scripts/migrate-rename-role-to-archetype.js`) has been created to rename these columns. The script is **idempotent** and safe to run multiple times.

## What Gets Renamed

### users table
- `primary_role` → `primary_archetype`
- `secondary_role` → `secondary_archetype`

### role_results table
- `primary_role` → `primary_archetype`
- `primary_role_score` → `primary_archetype_score`
- `secondary_role` → `secondary_archetype`
- `secondary_role_score` → `secondary_archetype_score`

## Running the Migration

### Automatic (via deployment)
The migration is now integrated into:
1. GitHub Actions workflow (`.github/workflows/cicd.yml`)
2. Deployment script (`deployment/scripts/deploy.sh`)

Both will run the migration before executing `drizzle-kit push`.

### Manual Execution
If you need to run the migration manually:

```bash
# Make sure DATABASE_URL is set
export DATABASE_URL="your-connection-string"

# Run the migration script
node scripts/migrate-rename-role-to-archetype.js
```

The script will:
1. ✅ Connect to the database
2. ✅ Read the migration SQL
3. ✅ Execute the column renames (only if old columns exist)
4. ✅ Verify the changes
5. ✅ Report success or failure

## Safety Features
- **Idempotent**: Can be run multiple times safely
- **Non-destructive**: Only renames columns, preserves all data
- **Conditional**: Only renames if old column names exist
- **Verification**: Checks column names after migration

## Technical Details

### Migration SQL
The actual SQL migration is in: `migrations/20260119000000_rename_role_to_archetype.sql`

### Why This Was Needed
`drizzle-kit push` compares the schema with the database state and tries to sync them. When it detected:
- Database has: `primary_role`
- Schema expects: `primary_archetype`

It prompted for action but didn't understand this was a rename (just saw it as drop + create). This caused the deployment to fail or behave unexpectedly.

By running the rename migration BEFORE the push, we ensure the database columns match the schema expectations, allowing push to succeed without prompts.

## Post-Migration
After successful migration:
- Database columns are renamed
- `drizzle-kit push` will see the schema is in sync
- No more prompts about `primary_archetype` column

## Verification
To verify the migration was successful:

```bash
# Check users table
psql $DATABASE_URL -c "\d users" | grep -E "(primary|secondary).*(role|archetype)"

# Check role_results table
psql $DATABASE_URL -c "\d role_results" | grep -E "(primary|secondary).*(role|archetype)"
```

You should only see `*_archetype` columns, no `*_role` columns.

## Rollback
If you need to rollback (NOT RECOMMENDED as it would break the application):

```sql
-- users table
ALTER TABLE users RENAME COLUMN primary_archetype TO primary_role;
ALTER TABLE users RENAME COLUMN secondary_archetype TO secondary_role;

-- role_results table
ALTER TABLE role_results RENAME COLUMN primary_archetype TO primary_role;
ALTER TABLE role_results RENAME COLUMN primary_archetype_score TO primary_role_score;
ALTER TABLE role_results RENAME COLUMN secondary_archetype TO secondary_role;
ALTER TABLE role_results RENAME COLUMN secondary_archetype_score TO secondary_role_score;
```

However, this would break the application since the code expects `*_archetype` column names.
