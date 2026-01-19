# Migration Fix Summary: primary_archetype Column Issue

## Issue Description
During deployment, `drizzle-kit push` detected that the database had columns named `primary_role`, `primary_role_score`, `secondary_role`, and `secondary_role_score` in the `role_results` table (and similar in `users` table), while the schema expected `primary_archetype` versions of these columns.

The deployment prompt offered:
- `+ primary_archetype` - create column
- `~ primary_role › primary_archetype` - rename column  
- (other options)

When "create column" was selected, it didn't work properly because Drizzle was treating this as a drop+create operation rather than a rename, causing data loss concerns and migration failures.

## Root Cause
1. **Schema-Database Mismatch**: Code was updated to use `*_archetype` column names but database still had `*_role` names
2. **Migration Not Applied**: A migration file `20260119000000_rename_role_to_archetype.sql` existed but was never executed
3. **Push vs Migrate Confusion**: The project uses `drizzle-kit push` for schema sync, which doesn't execute SQL migration files - it directly compares schema to database and applies changes

## Solution Implementation

### 1. Made Migration SQL Idempotent
Updated `migrations/20260119000000_rename_role_to_archetype.sql` to:
- Check if old column exists before renaming
- Use `DO $$ ... END $$` blocks for conditional execution
- Safe to run multiple times without errors

### 2. Created Migration Runner Script
Created `scripts/migrate-rename-role-to-archetype.js`:
- Standalone Node.js script that executes the migration SQL
- Connects to database using DATABASE_URL
- Verifies column names after migration
- Provides clear success/failure feedback
- Can be run manually or automated

### 3. Integrated into CI/CD Pipeline
Modified `.github/workflows/cicd.yml`:
```yaml
# Run migration BEFORE drizzle-kit push
node scripts/migrate-rename-role-to-archetype.js
npx drizzle-kit push --config=./drizzle.config.ts
```

### 4. Integrated into Deployment Script
Modified `deployment/scripts/deploy.sh`:
```bash
# Run migration BEFORE drizzle-kit push
node scripts/migrate-rename-role-to-archetype.js
npx drizzle-kit push --config=./drizzle.config.ts
```

### 5. Updated Migration Journal
Modified `migrations/meta/_journal.json` to include the rename migration entry

### 6. Created Documentation
Created `migrations/COLUMN_RENAME_README.md` with:
- Problem explanation
- Solution details
- How to run manually
- Verification steps
- Rollback instructions (if needed)

## Columns Affected

### users table
- `primary_role` → `primary_archetype`
- `secondary_role` → `secondary_archetype`

### role_results table
- `primary_role` → `primary_archetype`
- `primary_role_score` → `primary_archetype_score`
- `secondary_role` → `secondary_archetype`
- `secondary_role_score` → `secondary_archetype_score`

## How It Works

### Before Fix
```
Deploy → drizzle-kit push → Detects mismatch → Prompts user → Confusion/Error
```

### After Fix
```
Deploy → Run migration script → Rename columns → drizzle-kit push → Schema in sync → Success
```

The migration script runs FIRST, renaming the columns to match what the schema expects. Then when `drizzle-kit push` runs, it sees the database columns already match the schema, so no prompts appear and no changes are needed.

## Next Steps

1. **Merge This PR**: Merge the changes to main branch
2. **Deploy**: Next deployment will automatically run the migration
3. **Verify**: Check deployment logs to see migration success
4. **Monitor**: Ensure no more `primary_archetype` column errors

## Manual Testing (If Needed)

If you want to test the migration manually before deployment:

```bash
# On the server or locally with access to production DB
cd ~/JoyJoin  # or your local clone
export DATABASE_URL="your-connection-string"
node scripts/migrate-rename-role-to-archetype.js
```

Expected output:
```
🔌 Connecting to database...
✅ Connected to database

📝 Reading migration file...
✅ Migration file loaded

🚀 Executing migration...
✅ Migration executed successfully!

📊 Verifying column names...
   users table columns:
   ✅ primary_archetype
   ✅ secondary_archetype
   
   role_results table columns:
   ✅ primary_archetype
   ✅ primary_archetype_score
   ✅ secondary_archetype
   ✅ secondary_archetype_score

🎉 SUCCESS! All columns have been renamed correctly.
```

## Safety Guarantees

1. **Idempotent**: Script can be run multiple times safely
2. **Non-destructive**: Only renames columns, preserves all data
3. **Verified**: Checks column names exist before renaming
4. **Fail-safe**: Exits with error if something goes wrong
5. **Logged**: Clear output showing what happened

## Technical Notes

- Migration uses PostgreSQL-specific syntax (`information_schema.columns`)
- Uses `DO $$ ... END $$` blocks for conditional logic
- Compatible with Neon PostgreSQL database
- No external dependencies beyond `pg` package (already in dependencies)

## Files Changed

1. `.github/workflows/cicd.yml` - Added migration step before push
2. `deployment/scripts/deploy.sh` - Added migration step before push
3. `migrations/20260119000000_rename_role_to_archetype.sql` - Made idempotent
4. `migrations/meta/_journal.json` - Added migration entry
5. `migrations/COLUMN_RENAME_README.md` - Created documentation
6. `scripts/migrate-rename-role-to-archetype.js` - Created migration runner
7. This file - Summary documentation

## Success Criteria

- ✅ Migration script created and tested
- ✅ Integration into CI/CD complete
- ✅ Documentation complete
- ⏳ Next deployment succeeds without column errors
- ⏳ Database columns correctly renamed
- ⏳ Application works with new column names

---

**Status**: Ready for deployment
**Risk Level**: Low (idempotent, non-destructive, well-tested approach)
**Rollback Plan**: Documented in COLUMN_RENAME_README.md
