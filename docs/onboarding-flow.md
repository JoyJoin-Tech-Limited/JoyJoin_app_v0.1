# JoyJoin User Onboarding Flow

> **Status:** Active onboarding reference — last verified 2026-04-19 against `apps/server/src/routes/domains/auth.ts`, `packages/shared/src/onboarding.ts`, `apps/user-client/src/hooks/useAuth.ts`, `apps/user-client/src/features/onboarding/active/`, and mini-program onboarding routes under `apps/mini-program/src/pages/onboarding/` + `apps/mini-program/src/lib/onboardingRoutes.ts` / `api.ts`.
> **Authority:** Post-auth progression is server-owned via `nextStep` from `GET /api/auth/user`. Historical routing-fix docs in this directory are reference-only.

## Overview (Updated 2026-04-07)

JoyJoin uses a **value-first** onboarding approach:

**Canonical client module boundary (active flow):**
- `apps/user-client/src/features/onboarding/active/useOnboardingOrchestrator.ts` — single onboarding navigation/progress hook
- `apps/user-client/src/features/onboarding/active/flow.ts` — `nextStep` → step/route mapping (source of truth on client)
- `apps/user-client/src/features/onboarding/active/pages/*` — active onboarding pages
- `apps/user-client/src/legacy/onboarding/pages/*` — quarantined legacy onboarding surfaces

> **Module consolidation (PRs #401, #403, #423):** The `features/onboarding/active/` module is the single owner of all new onboarding navigation and page logic. Do not add new onboarding routes to `apps/user-client/src/pages/` directly — route-to-step mapping lives in `flow.ts`, and orchestration lives in `useOnboardingOrchestrator.ts`. Legacy surfaces under `legacy/onboarding/` are quarantined and must not be referenced by active code.

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

### Mini Program (Taro) path mirror

Server `nextStep` and assessment APIs are the same as web; only routes and storage differ. Registration for Taro pages is centralized in [`apps/mini-program/src/lib/onboardingRoutes.ts`](../apps/mini-program/src/lib/onboardingRoutes.ts) (onboarding flows live in the **`pages/onboarding`** subpackage).

| Phase | Taro location | WeChat / API notes |
|--------|----------------|---------------------|
| Personality test (anonymous) | `pages/onboarding/personality-test/index` | Same `/api/assessment/v4/*` calls as web; anonymous answers via Taro storage (`apps/mini-program/src/lib/anonymousOnboarding.ts`) |
| Results | `pages/onboarding/personality-test/results` | Reveal + share; primary claim routes to auth-gate |
| Auth gate (post-result login) | `pages/onboarding/personality-test/auth-gate` | `authenticateMiniProgramUserWithTest()` in [`api.ts`](../apps/mini-program/src/lib/api.ts) → `POST /api/auth/wechat/login-with-test` |
| Login only (returning users) | `pages/login/index` | [`useWeChatLogin`](../apps/mini-program/src/hooks/useWeChatLogin.ts) → `POST /api/auth/wechat/login` |
| Post-auth onboarding | `pages/onboarding/onboarding`, `essential-data`, `extended-data`, `profile-review` | Navigate with [`navigateToMiniProgramNextStep`](../apps/mini-program/src/lib/onboardingNavigation.ts) per `GET /api/auth/user` |

Blind-box **payment** after onboarding is **not** part of this table; see [`docs/PLATFORM_COORDINATION.md`](./PLATFORM_COORDINATION.md) (mini-program `blind-box-payment` + `payment-verification` pages).

**Original planning target:** +15% signup conversion (based on Soul, 16Personalities benchmarks). Treat this as historical planning context, not a live KPI report.

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
- **Back button stays available** — it rewinds through the local answered-question history for read-only review, and only exits to the landing page when the user is at the start with no earlier answers to review
- The question range is server-configured (`minQuestions`, `softMaxQuestions`, `hardMaxQuestions`) and termination is determined by `shouldTerminate()` in `packages/shared/src/personality/adaptiveEngine.ts`. After the adaptive phase terminates, **`Q_PLAYFUL_SLIDER` and `Q_PLAYFUL_EMOJI` are always presented to every user** as universal closing questions (served by `isAssessmentComplete()` in `adaptiveEngine.ts`). The full assessment is complete — and the final result is generated — only after both questions have been answered.

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

**Mini-program results experience (current behaviour):**
- The Taro results page preserves a replayable reveal state so users can rewatch the card reveal locally without regenerating backend results.
- Native sharing is enabled on the page (`ShareAppMessage` and `ShareTimeline`), and the visible share CTA can generate a local poster before invoking the platform share sheet.
- These share affordances sit alongside the same primary claim flow; they do not replace the auth gate or the backend result-linking step.

**Auth-gate flow (current behaviour):**
- The unauthenticated claim CTA on the results page routes to **`/personality-test/auth-gate`** rather than showing a loading spinner. This ensures users are not trapped in a spinner state if WeChat auth is not yet ready.
- On the **`/personality-test/auth-gate`** page there is a **non-production-only testing quick-pass** text link labeled **`测试快速通过`**. It immediately continues the flow without triggering WeChat OAuth. This link is only rendered in development / staging builds, has **no `data-testid`**, and must never be exposed in production.
- On the results page there is a **DEV-only WeChat bypass button** labeled **`⚡ 测试账号登录`** with `data-testid="button-dev-wechat-bypass"`. It logs in using a mock WeChat code for local testing, is hidden in production, and is not a user-facing CTA.
- The floating **`你的专属匹配已生成！` login card** (a redundant secondary login prompt that appeared over the results page) has been **removed**. The primary WeChat login CTA is sufficient.

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
2. Gender + Birthday (Birth Year)
3. Professional Profile: Education Level + Industry (3-tier) + Occupation + Work Mode
4. Location: Current City (required) + Hometown (optional)
5. Intent / Social Goals (multi-select — sourced from shared constants in `packages/shared/src/constants.ts` via `INTENT_OPTIONS` / `INTENT_FLEXIBLE_OPTION` / `getIntentLabel`, see PR #299)

> Intent options are defined as a **single source of truth** in `packages/shared/src/constants.ts` (`INTENT_OPTIONS`, `INTENT_FLEXIBLE_OPTION`, `getIntentLabel`). Do **not** hardcode intent option arrays in individual components — import from these shared constants.

> Valid `workMode` enum values (from `packages/shared/src/constants.ts`) are: `founder`, `self_employed`, `employed`, `student`, `transitioning`, `caregiver_retired`, `successor`（家族企业接班场景）. UI 文案可以对应为：创业者（founder）、自雇 / 自由职业（self_employed）、受薪上班族（employed）、学生（student）、职业过渡中（transitioning）、全职照护 / 退休（caregiver_retired）、家族企业接班人（successor）。

> All copy uses a conversational **Xiaoyue dialogue tone** (not form labels). See PR #301/#302 for the overhaul.

**After Completion:**
- `profileEssentialComplete = true`
- Redirect to `/onboarding/extended` or `/onboarding/review`

---

### Step 4: Extended Data Collection

**Route:** `/onboarding/extended`

**User State:** Must complete (no skip path)

**What's Collected:**
- **ONLY Interest Carousel**
  - 56 topics across 8 categories
  - Multi-tap heat level (0/5/15/25)
  - Includes topic avoidances
  - Minimum 3 selections required (enforced on both client and server: `POST /api/user/interests` returns 400 if `totalSelections < 3`)
- **Archetype-based recommendation hints** are shown alongside interest topics — the carousel displays personalised suggestions based on the user's archetype result from Step 1 (PR #309).

**After Completion:**
- `hasCompletedInterestsCarousel = true` (server-persisted; this is the canonical step-completion signal)
- Redirect to `/onboarding/review`

> ⚠️ Do **not** use `profileExtendedComplete` as the step-completion gate — it is computed server-side from education/industry/hometown fields and can be `true` before the carousel is completed. Use `hasCompletedInterestsCarousel` for onboarding-step logic only.

---

### Step 5: Profile Review

**Route:** `/onboarding/review`

**User State:** Has completed essential and extended data

**Content:**
- Animated "analyzing" phase (minimum **1200 ms** for standard motion; **500 ms** for reduced-motion users). After 600 ms a tap/click anywhere skips straight to the reveal — preventing artificial waiting when data is already ready. (Prior to PR #383 this was a fixed 2500 ms wait with no skip path.)
- Profile portrait card reveal with archetype, interests, and stats
- **AI insight tagline** — a short personalised `insightLine` fetched from `GET /api/onboarding/profile-tagline` (service: `apps/server/src/profileTaglineService.ts`; contract: `ProfileTaglineResponse` in `packages/shared/src/ai/onboarding.ts`). Displayed inside `ProfilePortraitCard`. Rendered as a presentation-only enhancement; does not block navigation.
- **Match Power preview** — displays the user's computed match score before they enter the Discover pool
- **Archetype-personalized CTA** — the call-to-action copy is tailored to the user's archetype result (e.g., different messaging for each archetype type)
- **Limited browse mode CTA** *(scoped experiment)* — a secondary "先浏览 →" CTA that lets the user enter read-only event discovery without committing to registration. Controlled by `ENABLE_LIMITED_BROWSE_MODE` constant in `FinalProfileReviewPage.tsx` (currently `true`). Can be disabled per-session via `?exp=no_limited_browse` in the URL. Do **not** generalize this pattern or add permanent browse-mode routing without verifying the gating logic and confirming it is no longer an experiment. See `LimitedBrowseBanner` component for the session flag.

**Downstream onboarding data reuse:** The user's interest selections made in Step 4 (Extended Data) are automatically reused downstream — they seed the optional **Interest Signal Boost** pre-match calibration tool (surfaced after pool registration), and pre-select the user's highest-heat interest for the boost UX. No re-asking of onboarding data is needed.

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
  nextStep,                  // Server-calculated next route
  profileEssentialComplete,  // Essential-data completion signal
  profileExtendedComplete,   // Profile-enrichment completeness signal
  activeAssessmentSessionId, // Active assessment session
} = useAuth();
```

Use `nextStep` as the only routing authority. Do not add or depend on legacy `needs*` onboarding helpers.

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
- `profileEssentialComplete`: Server-computed completion signal returned by `/api/auth/user`; there is no canonical persisted `hasCompletedEssentialData` flag in the active flow
- `hasCompletedInterestsCarousel`: Set after interests carousel (`/onboarding/extended`) is completed or skipped
- `hasSeenProfileReview`: Set after `POST /api/profile-review/complete`; the client then re-fetches `/api/auth/user` and follows the updated `nextStep`

---

## Conversion Targets

The active docs do not maintain a measured conversion benchmark table for this flow. Treat the values below as planning targets only, not live observed conversion metrics.

| Metric | Planning target | Current measurement status |
|--------|-----------------|----------------------------|
| Landing → Start Test | 70% | Not formalized in active docs |
| Complete Test | 85% | Not formalized in active docs |
| Test → Login | 65% | Not formalized in active docs |
| Login → Essential Data | 80% | Not formalized in active docs |
| **Overall Conversion** | **38%** | **Not formalized in active docs** |

*Targets were originally derived from Soul (60%), 16Personalities (55%), and internal planning assumptions.*

---

## Development Commands

```bash
npm run dev:user   # Start user client dev server
npm run check      # TypeScript type check
```
