# Onboarding Routing Fix - Implementation Summary

> 📜 **HISTORICAL DOCUMENT — For Reference Only**
>
> This document describes the routing fix implemented on 2026-02-10 that added `extended-data` and `profile-review` steps to the server-side `nextStep` enum and switched to fully server-driven onboarding navigation. The changes described here are **complete and in production**.
>
> For the **current active onboarding architecture**, refer to:
> - `docs/onboarding-flow.md` — full flow documentation
> - `DEVELOPER_QUICK_REFERENCE.md` — developer reference
> - `.github/copilot-instructions.md` → Onboarding Flow Architecture section

---

**Date:** 2026-02-10  
**PR:** copilot/fix-routing-issues-onboarding  
**Status:** ✅ Complete

## Problem Overview

The user onboarding happy path had **three competing routing systems** that didn't agree, causing potential redirect loops, broken transitions, and UX inconsistencies.

### Root Cause

The server's `nextStep` enum only knew 5 steps (`onboarding`, `personality-test`, `essential-data`, `guide`, `discover`) but the actual flow had 7 steps. The missing steps (`extended-data` and `profile-review`) only worked by accident because they were smuggled into the `essential-data` router case in `App.tsx`.

## Issues Fixed

### Issue 1: Server `nextStep` Enum Missing Steps ✅

**Files Changed:**
- `apps/user-client/src/hooks/useAuth.ts`
- `apps/server/src/routes.ts`
- `apps/user-client/src/App.tsx`

**Changes:**
1. Added `EXTENDED_DATA: 'extended-data'` and `PROFILE_REVIEW: 'profile-review'` to `NextStep` constant
2. Updated server-side `nextStep` calculation to properly sequence all 7 steps:
   ```typescript
   // NOTE: hasCompletedRegistration / 'onboarding' step was subsequently removed
   // from the active flow. See docs/onboarding-flow.md for the current sequence.
   if (!user.hasCompletedRegistration) nextStep = 'onboarding';
   else if (!user.hasCompletedPersonalityTest) nextStep = 'personality-test';
   else if (!profileEssentialComplete) nextStep = 'essential-data';
   else if (!user.hasCompletedInterestsCarousel) nextStep = 'extended-data';
   else if (!user.hasSeenProfileReview) nextStep = 'profile-review';
   else if (!user.hasSeenGuide) nextStep = 'guide'; // guide step later deprecated 2026-02-16
   else nextStep = 'discover';
   ```
3. Added dedicated router cases with proper redirect components:
   - `case 'extended-data'` → `RedirectToExtended`
   - `case 'profile-review'` → `RedirectToReview`

### Issue 2: Profile Review Flag Not Server-Persisted ✅

**Files Changed:**
- `packages/shared/src/schema.ts`
- `apps/server/src/routes.ts`
- `apps/user-client/src/pages/FinalProfileReviewPage.tsx`
- `apps/user-client/src/hooks/useOnboardingRoute.ts`
- `migrations/20260210000000_add_profile_review_seen_field.sql`

**Changes:**
1. Added `hasSeenProfileReview: boolean("has_seen_profile_review").default(false)` to users table schema
2. Created new API endpoint:
   ```typescript
   POST /api/profile-review/complete
   // Sets hasSeenProfileReview = true in database
   ```
3. Updated `FinalProfileReviewPage.handleContinue()`:
   ```typescript
   // Old: localStorage.setItem('profile_review_seen', 'true')
   // New: await apiRequest("POST", "/api/profile-review/complete")
   await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
   const updatedUser = await queryClient.fetchQuery({ queryKey: ["/api/auth/user"] });
   // Use updatedUser.nextStep for navigation
   ```
4. Updated `calculateOnboardingRoute()` to prefer server field:
   ```typescript
   const hasSeenProfileReview = user.hasSeenProfileReview ?? 
     localStorage.getItem('profile_review_seen') === 'true';
   ```

### Issue 3: Post-WeChat-Login Hardcoded Navigation ✅

**Files Changed:**
- `apps/user-client/src/pages/PersonalityTestResultPage.tsx`

**Changes:**
Replaced hardcoded `/onboarding/setup` with server-driven navigation:
```typescript
// Old:
setTimeout(() => { setLocation('/onboarding/setup'); }, 500);

// New:
const updatedUser = await queryClient.fetchQuery({ queryKey: ["/api/auth/user"] });
const nextPath = updatedUser?.nextStep === 'discover' ? '/discover' 
  : updatedUser?.nextStep === 'guide' ? '/guide'
  : updatedUser?.nextStep === 'extended-data' ? '/onboarding/extended'
  : updatedUser?.nextStep === 'profile-review' ? '/onboarding/review'
  : '/onboarding/setup';
setTimeout(() => { setLocation(nextPath); }, 500);
```

### Issue 4: Back Button Navigation ✅

**Files Changed:**
- `apps/user-client/src/pages/PersonalityTestPageV4.tsx`

**Changes:**
Made back button contextual based on user path:
```typescript
// Old: onBack={() => setLocation('/profile')}

// New:
onBack={() => {
  const syncedSessionId = localStorage.getItem("joyjoin_synced_session_id");
  if (syncedSessionId) {
    setLocation('/onboarding'); // Registered user
  } else {
    setLocation('/'); // Anonymous user
  }
}}
```

## Database Migration

**File:** `migrations/20260210000000_add_profile_review_seen_field.sql`

```sql
BEGIN;

ALTER TABLE users ADD COLUMN IF NOT EXISTS has_seen_profile_review BOOLEAN DEFAULT false;

COMMENT ON COLUMN users.has_seen_profile_review IS 
  'Indicates user has viewed the profile review page (server-persisted, replaces localStorage profile_review_seen)';

COMMIT;
```

## Documentation Updates

### `docs/onboarding-flow.md`
- Added `extended-data` and `profile-review` to Server-Driven Navigation table
- Added `hasSeenProfileReview` field documentation
- Added new API endpoint `/api/profile-review/complete`

### `.github/copilot-instructions.md`
- Updated `nextStep` enum to include all 7 steps
- Added `hasSeenProfileReview` to Auth Response Extensions table

## Code Quality Improvements

Based on code review feedback:
1. **Type Safety:** Replaced `as any` casts with proper `AuthUser` type
2. **Variable Naming:** Renamed `hasSyncedSession` → `syncedSessionId` for clarity
3. **Import Organization:** Fixed import from non-existent `@/lib/api` to `@/lib/queryClient`

## Testing & Validation

✅ **Build Tests:**
- User client builds successfully
- Server builds successfully

✅ **Type Safety:**
- TypeScript type checks pass
- No `any` type assertions in critical navigation code

✅ **Security:**
- CodeQL security scan passes (no vulnerabilities)

## Updated Flow Sequence

> ⚠️ **Note:** Step 2 below (AI Chat Registration) was subsequently **removed** from the active onboarding flow. The current active sequence skips that step entirely — see `docs/onboarding-flow.md` for the current flow.

```
1. Login/Landing
2. ~~AI Chat Registration (/onboarding) → hasCompletedRegistration~~ [REMOVED — legacy, no longer active]
3. Personality Test V4 (/personality-test) → hasCompletedPersonalityTest
4. Essential Data (/onboarding/setup) → profileEssentialComplete
5. Extended Data (/onboarding/extended) → hasCompletedInterestsCarousel
6. Profile Review (/onboarding/review) → hasSeenProfileReview [added by this fix]
7. ~~Guide (/guide) → hasSeenGuide~~ [subsequently deprecated 2026-02-16]
8. Discover Page (/discover) → Complete!
```

## API Contract Changes

### New Endpoint
- `POST /api/profile-review/complete` - Mark profile review as seen

### Updated Response
`GET /api/auth/user` now returns:
```typescript
{
  ...user,
  nextStep: 'onboarding' | 'personality-test' | 'essential-data' | 
            'extended-data' | 'profile-review' | 'guide' | 'discover',
  hasSeenProfileReview: boolean, // NEW
  profileEssentialComplete: boolean,
  profileExtendedComplete: boolean,
  hasSeenGuide: boolean,
  activeAssessmentSessionId: string | null
}
```

## Backward Compatibility

✅ **Database Migration:** Uses `DEFAULT false` so existing users are not affected  
✅ **LocalStorage Fallback:** Kept as hint when server field is undefined  
✅ **No Breaking Changes:** All existing routes still work, new cases are additions

## Impact Assessment

### Before Fix
- ❌ Profile review could be skipped or shown out of order
- ❌ WeChat login always navigated to `/onboarding/setup`
- ❌ Back button from personality test navigated to wrong page
- ❌ Server state and client state could diverge

### After Fix
- ✅ All 7 steps properly sequenced on server
- ✅ Navigation fully server-driven and consistent
- ✅ Profile review completion persisted to database
- ✅ WeChat login respects current onboarding progress
- ✅ Back button navigates contextually based on user path

## Files Modified (Summary)

**Core Changes (10 files):**
1. `apps/user-client/src/hooks/useAuth.ts` - NextStep enum
2. `apps/server/src/routes.ts` - Server nextStep logic + API endpoint
3. `apps/user-client/src/App.tsx` - Router cases
4. `packages/shared/src/schema.ts` - Database schema
5. `apps/user-client/src/pages/FinalProfileReviewPage.tsx` - API call
6. `apps/user-client/src/hooks/useOnboardingRoute.ts` - Server field priority
7. `apps/user-client/src/pages/PersonalityTestResultPage.tsx` - Server-driven nav
8. `apps/user-client/src/pages/PersonalityTestPageV4.tsx` - Contextual back button

**Documentation (2 files):**
9. `docs/onboarding-flow.md`
10. `.github/copilot-instructions.md`

**Migration (1 file):**
11. `migrations/20260210000000_add_profile_review_seen_field.sql`

## Deployment Checklist

- [x] Code reviewed and approved
- [x] All builds passing
- [x] TypeScript type checks passing
- [x] Security scan passing
- [ ] Database migration tested locally
- [ ] Migration ready to run on production
- [ ] QA testing on staging environment
- [ ] Deploy to production

## Notes for Future Developers

1. **Server is Source of Truth:** Always use `user.nextStep` from `/api/auth/user` for navigation decisions
2. **LocalStorage is Fallback Only:** Keep localStorage hints for resilience but never trust them over server state
3. **Add New Steps:** To add a new onboarding step:
   - Add to `NextStep` constant in `useAuth.ts`
   - Update server logic in `routes.ts`
   - Add router case in `App.tsx`
   - Update documentation
4. **Checkpoint System:** The `onboardingCheckpoint` field enables cross-device resume - keep it updated when steps complete
