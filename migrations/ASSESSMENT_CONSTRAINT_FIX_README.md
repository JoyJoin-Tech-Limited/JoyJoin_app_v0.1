# Assessment Answer Constraint Fix

## Problem

The `assessment_answers` table had duplicate rows for the same `(session_id, question_id)` combination, which prevented the unique constraint `assessment_answer_session_question_unique` from being created. This caused the `/api/assessment/v4/presignup-sync` endpoint to fail with error:

```
error: there is no unique or exclusion constraint matching the ON CONFLICT specification
```

## Root Cause

1. The schema defined a unique constraint on `(session_id, question_id)`
2. Existing data in the database had duplicates
3. During deployment, the constraint could not be added due to these duplicates
4. Code using `onConflictDoUpdate` failed because the constraint didn't exist

## Solution

### Files Created/Modified

1. **Migration SQL**: `migrations/20260119205000_fix_assessment_answer_unique_constraint.sql`
   - Removes duplicate assessment answers, keeping only the most recent one
   - Adds the unique constraint idempotently

2. **Migration Script**: `scripts/migrate-fix-assessment-constraint.js`
   - Node.js script to run the migration
   - Includes validation before and after
   - Idempotent - safe to run multiple times

3. **Deployment Scripts**:
   - `deployment/scripts/deploy.sh` - Added migration step
   - `.github/workflows/cicd.yml` - Added migration to CI/CD pipeline

### How It Works

The migration:

1. **Identifies duplicates**: Finds all `(session_id, question_id)` pairs with multiple rows
2. **Removes old duplicates**: Keeps the row with the most recent `answered_at` timestamp
3. **Adds constraint**: Creates the unique constraint if it doesn't exist

### Running the Migration

#### Manual Execution

```bash
# From the project root
DATABASE_URL="your-connection-string" node scripts/migrate-fix-assessment-constraint.js
```

#### Automatic Execution

The migration is automatically run during deployment:

1. **Local deployment**: `deployment/scripts/deploy.sh`
2. **CI/CD pipeline**: `.github/workflows/cicd.yml`

Both run the migration before `drizzle-kit push`.

### Verification

After the migration runs successfully, you should see:

```
✅ No duplicate answers remain
✅ Unique constraint is in place
🎉 SUCCESS! Assessment answer constraint migration completed.
```

### Testing

To verify the fix works:

1. Complete the pre-signup assessment (before login)
2. Log in with phone authentication
3. The `/api/assessment/v4/presignup-sync` endpoint should successfully sync answers
4. No more `ON CONFLICT` errors in server logs

### Idempotency

The migration is safe to run multiple times:

- If duplicates don't exist, the DELETE does nothing
- If constraint already exists, the script detects it and continues
- Re-running the migration will not cause errors or data loss
