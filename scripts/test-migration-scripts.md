# Migration Script Testing Plan

## Fixed Scripts
- `migrate-fix-assessment-constraint.js`
- `migrate-rename-role-to-archetype.js`

## Test Scenarios

### Scenario 1: Fresh Database (No Tables)
**Expected Behavior:**
- Both migration scripts should detect that required tables don't exist
- Both should exit successfully with informational messages
- No errors should be thrown
- Exit code should be 0

**Output Expected:**
```
🔍 Checking current state...
   ℹ️  Table "assessment_answers" does not exist yet
   ✅ Migration skipped - table will be created by schema push
   This is expected for new databases or before drizzle-kit push runs
```

### Scenario 2: Tables Exist, Migrations Needed
**Expected Behavior:**
- Scripts should detect tables exist
- Run migrations normally
- Apply changes successfully

### Scenario 3: Tables Exist, Migrations Already Applied
**Expected Behavior:**
- Scripts should detect tables exist
- Check for existing constraints/columns
- Skip changes that are already applied (idempotent behavior)
- Exit successfully

## Key Improvements Made

1. **Table Existence Check**: Both scripts now check if required tables exist before attempting any operations
2. **Graceful Skipping**: If tables don't exist, scripts exit cleanly with success status
3. **Clear Messaging**: Users understand why migration was skipped
4. **No Breaking Changes**: Scripts remain backward compatible with existing deployments

## Deployment Flow Order

The current deployment flow is:
1. Build applications
2. Run `migrate-rename-role-to-archetype.js` (now safe if tables don't exist)
3. Run `migrate-fix-assessment-constraint.js` (now safe if tables don't exist)
4. Run `drizzle-kit push` (creates/updates schema)

This flow now works correctly whether:
- Database is fresh (no tables yet)
- Database has old schema (needs migrations)
- Database is up-to-date (migrations already applied)
