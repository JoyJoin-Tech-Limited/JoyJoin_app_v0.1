# Onboarding Routing Fix - Visual Summary

> 📜 **HISTORICAL VISUAL SUMMARY — For Reference Only**
>
> This diagram explains the 2026-02-10 routing fix, but it predates later cleanup of the legacy `onboarding` step and deprecation of `guide` as a blocking onboarding destination.
>
> For the **current active onboarding authority**, use:
> - `docs/systems/systems/onboarding-flow.md`
> - `docs/architecture/current-state.md`
> - `DEVELOPER_QUICK_REFERENCE.md`

## Before Fix (Broken State)

```
┌─────────────────────────────────────────────────────────────┐
│ Server nextStep Enum (5 steps)                              │
├─────────────────────────────────────────────────────────────┤
│ onboarding → personality-test → essential-data → guide →    │
│ discover                                                     │
│                                                              │
│ ❌ Missing: extended-data, profile-review                   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Actual Client Flow (7 steps)                                │
├─────────────────────────────────────────────────────────────┤
│ onboarding → personality-test → essential-data →            │
│ extended-data → profile-review → guide → discover           │
│                                                              │
│ ⚠️  Steps 5-6 smuggled into essential-data router case     │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Problems                                                     │
├─────────────────────────────────────────────────────────────┤
│ 1. Server returns nextStep='guide' when user should see     │
│    extended-data or profile-review                          │
│                                                              │
│ 2. Profile review completion only stored in localStorage    │
│    → Cross-device inconsistency                             │
│                                                              │
│ 3. WeChat login hardcoded to /onboarding/setup              │
│    → Ignores actual user progress                           │
│                                                              │
│ 4. Back button from personality test goes to /profile       │
│    → Wrong for both anonymous and registered users          │
└─────────────────────────────────────────────────────────────┘
```

## After Fix (Correct State)

```
┌─────────────────────────────────────────────────────────────┐
│ Server nextStep Enum (7 steps - COMPLETE)                   │
├─────────────────────────────────────────────────────────────┤
│ onboarding → personality-test → essential-data →            │
│ extended-data → profile-review → guide → discover           │
│                                                              │
│ ✅ All steps properly defined                               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Router Cases (Aligned with Server)                          │
├─────────────────────────────────────────────────────────────┤
│ switch (nextStep) {                                         │
│   case 'onboarding':        → /onboarding                   │
│   case 'personality-test':  → /personality-test             │
│   case 'essential-data':    → /onboarding/setup             │
│   case 'extended-data':     → /onboarding/extended ✨ NEW   │
│   case 'profile-review':    → /onboarding/review   ✨ NEW   │
│   case 'guide':             → /guide                        │
│   case 'discover':          → /discover                     │
│ }                                                            │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Server-Driven Navigation Logic                              │
├─────────────────────────────────────────────────────────────┤
│ if (!hasCompletedRegistration)                              │
│   → nextStep = 'onboarding'                                 │
│                                                              │
│ else if (!hasCompletedPersonalityTest)                      │
│   → nextStep = 'personality-test'                           │
│                                                              │
│ else if (!profileEssentialComplete)                         │
│   → nextStep = 'essential-data'                             │
│                                                              │
│ else if (!hasCompletedInterestsCarousel)                    │
│   → nextStep = 'extended-data'                    ✨ NEW    │
│                                                              │
│ else if (!hasSeenProfileReview)                             │
│   → nextStep = 'profile-review'                   ✨ NEW    │
│                                                              │
│ else if (!hasSeenGuide)                                     │
│   → nextStep = 'guide'                                      │
│                                                              │
│ else                                                         │
│   → nextStep = 'discover'                                   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Profile Review Completion Flow                              │
├─────────────────────────────────────────────────────────────┤
│ User clicks "Continue" on profile review page               │
│          ↓                                                   │
│ POST /api/profile-review/complete        ✨ NEW API         │
│          ↓                                                   │
│ Database: hasSeenProfileReview = true    ✨ SERVER PERSIST  │
│          ↓                                                   │
│ localStorage: profile_review_seen=true   (fallback hint)    │
│          ↓                                                   │
│ Refetch user state → nextStep = 'guide'                     │
│          ↓                                                   │
│ Navigate to /guide                                          │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ WeChat Login Flow (Server-Driven)                           │
├─────────────────────────────────────────────────────────────┤
│ User completes personality test anonymously                 │
│          ↓                                                   │
│ User clicks WeChat login                                    │
│          ↓                                                   │
│ POST /api/auth/wechat/login-with-test                       │
│          ↓                                                   │
│ Fetch user state → nextStep calculated by server            │
│          ↓                                                   │
│ Navigate based on nextStep:                   ✨ DYNAMIC    │
│   - 'essential-data'  → /onboarding/setup                   │
│   - 'extended-data'   → /onboarding/extended                │
│   - 'profile-review'  → /onboarding/review                  │
│   - 'guide'           → /guide                              │
│   - 'discover'        → /discover                           │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Back Button Behavior (Contextual)                           │
├─────────────────────────────────────────────────────────────┤
│ Personality Test Page                                       │
│          ↓                                                   │
│ User clicks Back button                                     │
│          ↓                                                   │
│ Check: localStorage.getItem("joyjoin_synced_session_id")    │
│          ↓                                                   │
│ IF session exists:                              ✨ CONTEXT  │
│   → Navigate to /onboarding (registered user)               │
│ ELSE:                                                        │
│   → Navigate to / (anonymous user)                          │
└─────────────────────────────────────────────────────────────┘
```

## Key Improvements

### 1. Single Source of Truth ✅
- **Before:** Client calculated next step independently
- **After:** Server calculates `nextStep`, client follows

### 2. Server Persistence ✅
- **Before:** Profile review flag only in localStorage
- **After:** `hasSeenProfileReview` persisted to database

### 3. Complete Step Coverage ✅
- **Before:** 5 server steps, 7 actual steps → mismatch
- **After:** 7 server steps = 7 actual steps → aligned

### 4. Type Safety ✅
- **Before:** Used `as any` for type assertions
- **After:** Proper `AuthUser` type throughout

## Database Schema Addition

```sql
-- New column in users table
ALTER TABLE users ADD COLUMN 
  has_seen_profile_review BOOLEAN DEFAULT false;
```

## API Contract Changes

```typescript
// GET /api/auth/user response
{
  ...user,
  nextStep: 'onboarding' | 'personality-test' | 'essential-data' | 
            'extended-data' | 'profile-review' | 'guide' | 'discover',
  hasSeenProfileReview: boolean,  // ✨ NEW
  // ... other fields
}

// POST /api/profile-review/complete  ✨ NEW ENDPOINT
// Sets hasSeenProfileReview = true
// Returns: { success: true, hasSeenProfileReview: true }
```

## Backward Compatibility

✅ **No Breaking Changes**
- Database migration uses `DEFAULT false`
- localStorage still used as fallback hint
- All existing routes still functional
- New router cases are additions, not replacements

## Testing Validation

```
✅ TypeScript type checks pass
✅ User client builds successfully
✅ Server builds successfully
✅ CodeQL security scan passes
✅ No type safety warnings
✅ All imports resolved correctly
```

## Files Changed Summary

```
apps/user-client/src/
  ├── hooks/
  │   ├── useAuth.ts                    (NextStep enum)
  │   └── useOnboardingRoute.ts         (Server field priority)
  ├── pages/
  │   ├── FinalProfileReviewPage.tsx    (API call)
  │   ├── PersonalityTestPageV4.tsx     (Back button)
  │   └── PersonalityTestResultPage.tsx (Server-driven nav)
  └── App.tsx                           (Router cases)

apps/server/src/
  └── routes.ts                         (nextStep logic + API)

packages/shared/src/
  └── schema.ts                         (Database schema)

migrations/
  └── 20260210000000_add_profile_review_seen_field.sql

docs/
  ├── systems/onboarding-flow.md                (Documentation)
  ├── ONBOARDING_ROUTING_FIX_2026-02-10.md (Summary)
  └── .github/copilot-instructions.md   (Instructions)
```

---

**Result:** Onboarding routing is now fully server-driven, type-safe, and properly sequenced! 🎉
