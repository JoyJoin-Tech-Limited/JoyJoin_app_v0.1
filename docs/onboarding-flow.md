# JoyJoin User Onboarding Flow

## Overview (Updated 2026-03-23)

JoyJoin uses a **value-first** onboarding approach:
1. **Show value (personality test) BEFORE asking for signup**
2. Silent WeChat authentication after user is invested
3. Minimal data collection in onboarding
4. Progressive profile enrichment

---

## Complete Flow

```
Landing → Personality Test (Anonymous) → Results → WeChat Login → 
Essential Data → Extended Data → Profile Review → Discover Page
```

**Expected Impact:** +15% signup conversion (based on Soul, 16Personalities benchmarks)

---

## Step-by-Step Flow

### Step 1: Landing Page → Personality Test (Anonymous)

**Route:** `/personality-test`

**User State:** Unauthenticated

**Data Collection:** None (test answers stored in localStorage)

**Duration:** ~2 minutes

**Implementation:**
- Anonymous session ID generated: `crypto.randomUUID()`
- Answers saved to localStorage: `joyjoin_v4_presignup_answers`
- No backend submission until login

**Why This Works:**
- Reduce friction: No upfront commitment required
- Build curiosity: Users want to know their archetype
- Prove value: Show what JoyJoin can do before asking for signup

---

### Step 2: Personality Test Results → WeChat Login

**Route:** `/personality-test/results`

**User State:** Still unauthenticated, but has test results

**CTA:** "微信登录，查看匹配活动"

**Why This Works:**
- User has seen their archetype (value delivered)
- Curiosity triggered: "Who am I compatible with?"
- Clear value exchange: Login = See Matches
- Expected conversion: 60-65% (Soul benchmark)

**Implementation:**
- Show archetype reveal animation (slot machine)
- After 3 seconds, show WeChat login CTA
- On login: Send test results to backend, create user, link results
- Uses endpoint: `POST /api/auth/wechat/login-with-test`

**WeChat Authentication Flow:**
```typescript
// Frontend
const { code } = await wx.login(); // WeChat SDK
await fetch('/api/auth/wechat/login-with-test', {
  method: 'POST',
  body: JSON.stringify({
    code,
    anonymousSessionId,
    testAnswers
  })
});

// Backend
// 1. Exchange code for openid with WeChat API
// 2. Find or create user with WeChat OpenID
// 3. Save personality test results to assessment_sessions
// 4. Mark hasCompletedPersonalityTest = true
// 5. Create session and return user data
```

---

### Step 3: Essential Data Collection

**Route:** `/onboarding/setup`

**User State:** Authenticated, test complete, needs profile data

**Required Fields (5 steps):**
1. Display Name
2. Gender + Birth Year + Relationship Status
3. Education Level + Industry (3-tier) + Occupation + Work Mode
4. Hometown + Current City
5. Intent / Social Goals (multi-select — sourced from shared constants in `packages/shared/src/constants/intentOptions.ts`, see PR #299)

> Intent options are defined as a **single source of truth** in `packages/shared/src/constants/intentOptions.ts`. Do **not** hardcode intent option arrays in individual components — import from shared constants.

> Valid work modes include: `employee`, `freelancer`, `entrepreneur`, `student`, `successor` (added 2026-03-18 for family business succession contexts).

> All copy uses a conversational **Xiaoyue dialogue tone** (not form labels). See PR #301/#302 for the overhaul.

**After Completion:**
- `profileEssentialComplete = true`
- Redirect to `/onboarding/extended` or `/onboarding/review`

---

### Step 4: Extended Data Collection (Optional)

**Route:** `/onboarding/extended`

**User State:** Can skip entirely

**What's Collected:**
- **ONLY Interest Carousel**
  - 56 topics across 8 categories
  - Multi-tap heat level (0/5/15/25)
  - Includes topic avoidances
- **Archetype-based recommendation hints** are shown alongside interest topics — the carousel displays personalised suggestions based on the user's archetype result from Step 1 (PR #309).

**After Completion/Skip:**
- `hasCompletedInterestsCarousel = true` (server-persisted; this is the canonical step-completion signal)
- Redirect to `/onboarding/review`

> ⚠️ Do **not** use `profileExtendedComplete` as the step-completion gate — it is computed server-side from education/industry/hometown fields and can be `true` before the carousel is completed. Use `hasCompletedInterestsCarousel` for onboarding-step logic only.

---

### Step 5: Profile Review

**Route:** `/onboarding/review`

**User State:** Has completed essential and extended data

**Content:**
- Animated "analyzing" phase (minimum 2.5 seconds)
- Profile portrait card reveal with archetype, interests, and stats
- **Match Power preview** — displays the user's computed match score before they enter the Discover pool
- **Archetype-personalized CTA** — the call-to-action copy is tailored to the user's archetype result (e.g., different messaging for each archetype type)

**Data Contract:**
- Server field: `user.hasSeenProfileReview` (persisted to database)
- API: `POST /api/profile-review/complete` to mark as seen

**After Completion:**
- `hasSeenProfileReview = true`
- Navigate via **server-computed `nextStep`** using the route map:
  ```ts
  const NEXT_STEP_TO_PATH: Record<string, string> = {
    'discover':        '/discover',
    'guide':           '/discover',        // deprecated step alias
    'profile-review':  '/onboarding/review',
    'extended-data':   '/onboarding/extended',
    'essential-data':  '/onboarding/setup',
    'personality-test': '/personality-test',
  };
  const destination = (nextStep && NEXT_STEP_TO_PATH[nextStep]) ?? '/discover';
  ```
- Fallback to `/discover` if `nextStep` is absent or unrecognised.

---

### Step 6: Discover Page

**Route:** `/` or `/discover`

**User State:** Onboarding complete

> **Note:** The 3-step guide (`/guide`) that previously preceded the Discover page was deprecated on 2026-02-16. Its content has been replaced by inline coach marks (`CoachMarkBanner`, `XiaoyueFAB`, `ProfileCompletionNudge`) on the Discover page itself.

**Post-Onboarding Profile Enrichment (Progressive)**

After the user lands on Discover for the first time, a profile enrichment card is shown to collect additional signals that improve match quality. This is non-blocking and dismissible.

Current enrichment fields collected post-onboarding:
- `tableVibePreference` — dining/social vibe preference (two-layer UX: primary style → specific preferences). Added in PR #324.

The enrichment card is shown via the `ProfileEnrichmentCard` component on the Discover page. It does **not** block access to the event pool.

---

## Server-Driven Navigation (Scope B1)

> All post-authentication routing uses server-calculated `nextStep` from `/api/auth/user`. Do not reconstruct onboarding progress client-side.

### Response Fields

| Field | Type | Description |
|------|------|-------------|
| `nextStep` | `string` | Server-calculated next route. Active values: `personality-test`, `essential-data`, `extended-data`, `profile-review`, `discover`. Legacy/fallback values: `onboarding` (routes to `/personality-test`), `guide` (legacy; in `AuthenticatedRouter` this falls through to the `discover` case; the `/guide` route and `GuidePage` are kept for backward compatibility). |
| `profileEssentialComplete` | `boolean` | Essential data complete (displayName, gender, currentCity) |
| `profileExtendedComplete` | `boolean` | Server-computed profile enrichment flag: `true` when education + industry labels + hometown are present. Note: this is **separate** from the interests carousel completion flag (`hasCompletedInterestsCarousel`). |
| `hasSeenGuide` | `boolean` | Legacy field — guide step removed from onboarding flow (2026-02-16); retained on server for backward compatibility |
| `hasSeenProfileReview` | `boolean` | Profile review viewed (server-persisted) |
| `activeAssessmentSessionId` | `string \| null` | Active V4 session ID |
| `hasCompletedInterestsCarousel` | `boolean` | Set to `true` when the user completes or skips the interests carousel step (`/onboarding/extended`). This is the canonical completion gate for the extended-data onboarding step. |
| `tableVibePreference` | `string \| null` | Post-onboarding dining/social vibe preference collected via the Discover-page enrichment card. `null` until the user completes the enrichment step. |

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/user` | GET | Get current user and nextStep |
| `/api/profile-review/complete` | POST | Mark profile review as seen |
| `/api/guide/complete` | POST | Mark guide as seen |

### useAuth Hook Extension

```typescript
const { 
  // Server-driven navigation (recommended)
  nextStep,                    // Next route
  profileEssentialComplete,    // Essential data complete
  profileExtendedComplete,     // Extended data complete
  activeAssessmentSessionId,   // Active assessment session
  
  // Legacy computed fields (still available)
  needsRegistration,       
  needsPersonalityTest,    
  needsProfileSetup,       
} = useAuth();
```

---

## Deprecated Fields (Removed 2026-02-04)

The following fields are **NO LONGER** collected in onboarding:

- ❌ `languagesComfort` - Available in profile edit only
- ❌ `activityTimePreference` - Removed
- ❌ `socialFrequency` - Removed
- ❌ `groupSizeComfort` - Removed
- ❌ `hometownCountry` - Removed

These fields remain in the database schema for backward compatibility but are not actively used.

---

## Technical Architecture

### Anonymous Test Session
- Session ID: `crypto.randomUUID()`
- Storage: `localStorage.getItem('joyjoin_v4_presignup_answers')`
- Expiry: Cleared after successful login

### WeChat Authentication
- Endpoint: `POST /api/auth/wechat/login-with-test`
- Payload: `{ code, anonymousSessionId, testAnswers }`
- Response: `{ success, user }`

### State Management
- `hasCompletedPersonalityTest`: Set after WeChat login with test results
- `hasCompletedEssentialData`: Set after essential data submission
- `hasCompletedInterestsCarousel`: Set after interests carousel (`/onboarding/extended`) is completed or skipped

---

## Performance Benchmarks

| Metric | Target | Current |
|--------|--------|---------|
| Landing → Start Test | 70% | TBD |
| Complete Test | 85% | TBD |
| Test → Login | 65% | TBD |
| Login → Essential Data | 80% | TBD |
| **Overall Conversion** | **38%** | **TBD** |

*Benchmarks based on Soul (60%), 16Personalities (55%), industry averages*

---

## Development Commands

```bash
npm run dev:user   # Start user client dev server
npm run check      # TypeScript type check
```
