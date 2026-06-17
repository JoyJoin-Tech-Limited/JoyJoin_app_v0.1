# JoyJoin User Onboarding Flow

> **Status:** Historical reference — user-client (web) was archived to `archived/workspaces/user-client/` on 2026-05-07. Mini-program is the only active user-facing client. The server-driven `nextStep` flow (documented in `GET /api/auth/user` and `packages/shared/src/onboarding.ts`) is the canonical onboarding authority for both surfaces. This doc documents the former user-client onboarding architecture for legacy understanding only.
> **Authority:** Post-auth progression is server-owned via `nextStep` from `GET /api/auth/user`. Historical routing-fix docs in this directory are reference-only.

## Overview (Updated 2026-04-07)

JoyJoin uses a **value-first** onboarding approach:

**Canonical client module boundary (archived — see `archived/workspaces/user-client/`):**
- `archived/workspaces/user-client/src/features/onboarding/active/useOnboardingOrchestrator.ts`
- `archived/workspaces/user-client/src/features/onboarding/active/flow.ts`
- `archived/workspaces/user-client/src/features/onboarding/active/pages/*`
- `archived/workspaces/user-client/src/legacy/onboarding/pages/*`

> The mini-program handles onboarding via server-driven `nextStep` — see `apps/mini-program/src/lib/onboardingRoutes.ts` for route mapping and `apps/mini-program/src/hooks/useAuthGuard.ts` for navigation orchestration.

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

Server `nextStep` and assessment APIs are the same as web; only routes and storage differ. Registration for Taro pages is centralized in [`apps/mini-program/src/lib/onboarding/onboardingRoutes.ts`](../apps/mini-program/src/lib/onboarding/onboardingRoutes.ts) (onboarding flows live in the **`pages/onboarding`** subpackage).

| Phase | Taro location | WeChat / API notes |
|--------|----------------|---------------------|
| Personality test (anonymous) | `pages/onboarding/personality-test/index` | Same `/api/assessment/v4/*` calls as web; anonymous answers via Taro storage (`apps/mini-program/src/lib/auth/anonymousOnboarding.ts`) |
| Results | `pages/onboarding/personality-test/results` | Reveal + share; inline WeChat login imports anonymous answers |
| Inline login (post-result) | Handled on results page | `authenticateMiniProgramUserWithTest()` in [`api.ts`](../apps/mini-program/src/lib/api/api.ts) → `POST /api/auth/wechat/login-with-test` |
| Login only (returning users) | `pages/login/index` | [`useWeChatLogin`](../apps/mini-program/src/hooks/auth/useWeChatLogin.ts) → `POST /api/auth/wechat/login` |
| Post-auth onboarding | `pages/onboarding/onboarding`, `essential-data`, `extended-data`, `profile-review` | Navigate with [`navigateToMiniProgramNextStep`](../apps/mini-program/src/lib/onboarding/onboardingNavigation.ts) per `GET /api/auth/user` |

Blind-box **payment** after onboarding is **not** part of this table; see [`docs/reference/PLATFORM_COORDINATION.md`](./PLATFORM_COORDINATION.md) (mini-program `blind-box-payment` + `payment-verification` pages).

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

**Re-entry safety (2026-06-04 / guest restore 2026-06-08):**
- The mini-program personality test page has an **archetype hard guard**: if `auth.user?.primaryArchetype` is already set, the page immediately redirects to `/pages/discover/index`. This prevents users who have already completed the test from accidentally re-entering the assessment flow.
- The server `/start` endpoint detects **stale incomplete sessions** (sessions where all questions are answered but `completedAt IS NULL`). It marks the stale session completed, calls `markPersonalityTestComplete`, and starts a fresh session. This prevents the client from entering a `completing` phase that would hang on a 500 error.
- If the final submission API fails while the client is in `completing` phase, the page renders a Xiaoyue `actionFailure` visual with warm copy, `role="alert"` + `aria-live="polite"`, and a retry CTA.
- **Guest assessment session restoration:** When a guest user starts the personality test without logging in and backgrounds the app, the assessment session snapshot is persisted to Taro storage (`joyjoin_v4_assessment_session`). On the next cold start, the landing page (`pages/index/index`) detects this snapshot and `reLaunch`es the user back to `/pages/onboarding/personality-test/index` so they can continue where they left off. Completed sessions are not restored (the user stays on the landing page and must log in to see results).

**Why This Works:**
- Reduce friction: No upfront commitment required
- Build curiosity: Users want to know their archetype
- Prove value: Show what JoyJoin can do before asking for signup

---

### Step 2: Personality Test Results → WeChat Login

**Route:** `/personality-test/results` → inline WeChat login

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

**Inline login flow (current behaviour):**
- The unauthenticated claim CTA on the results page triggers **inline WeChat login** (`authenticateMiniProgramUserWithTest`) directly on the results page. Anonymous answers are imported automatically after successful auth. No separate auth-gate page exists.
- On the results page there is a **DEV-only WeChat bypass button** labeled **`⚡ 测试账号登录`** with `data-testid="button-dev-wechat-bypass"`. It logs in using a mock WeChat code for local testing, is hidden in production, and is not a user-facing CTA.
- The floating **`你的专属匹配已生成！` login card** (a redundant secondary login prompt that appeared over the results page) has been **removed**. The primary WeChat login CTA is sufficient.
- The standalone **`/personality-test/auth-gate`** page was removed in 2026-05. All post-result login logic lives inline on the results page.

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

### Step 2b: Welcome Back Screen (Returning Users with Partial Onboarding)

**Route:** `/onboarding/welcome-back`

**User State:** Authenticated, `nextStep !== 'discover'`, `restartsRemaining > 0`, feature flag enabled

**When Shown:**
- After successful WeChat login (returning users) or auto-login redirect
- Only when `RESTART_ONBOARDING_ENABLED=true` and `nextStep !== 'discover'`
- Only when `restartsRemaining > 0` (capped at 5 restarts per user)
- Only once per reinstall (`jj_welcome_back_seen` in Taro storage)
- **Not shown** for brand-new users who have never completed personality test

**Content:**
- Friendly greeting: "欢迎回来！"
- Current onboarding step name (e.g., "基础资料填写", "兴趣选择", "个人资料预览")
- Two CTAs:
  - **"继续当前进度"** — proceeds to `nextStep` (default, primary)
  - **"重新开始"** — opens confirmation modal, then calls restart endpoint
- Restart button displays remaining count: "重新开始 (还剩 3 次)"

**Confirmation Modal:**
- Title: "确定要重新开始吗？"
- Content explains that restart will clear all onboarding data and return to personality test
- Destructive red confirm button (`confirmColor: '#EF4444'`)
- Cancel dismisses modal

**Data Boundaries on Restart:**
- **Preserved:** WeChat openid, phone number, `hasCompletedRegistration`, identity columns, `createdAt`
- **Cleared:** All onboarding-derived fields (display name, gender, birthday, city, education, work, interests, archetype results, social tags, semantic profile)
- **Related table deletions:** `testResponses`, `roleResults`, `userInterests`, `userSocialTagGenerations`, `userSemanticProfiles`, `assessmentSessions` (+ `assessmentAnswers` batched via `inArray`)
- **Always returns to:** `personality-test` step (re-test required)

**Client-Side Storage Gate:**
```typescript
const WELCOME_BACK_SEEN_KEY = 'jj_welcome_back_seen';
// Set after user sees the screen once; survives until Taro storage cleared (reinstall)
```

**Analytics Events:**
- `welcome_back_screen_shown` — screen viewed
- `welcome_back_continue_clicked` — user taps continue
- `welcome_back_restart_clicked` — user taps restart
- `welcome_back_restart_confirmed` — user confirms restart in modal
- `welcome_back_restart_cancelled` — user cancels restart in modal

---

### Step 3: Essential Data Collection

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

**Inline login flow (current behaviour):**
- The unauthenticated claim CTA on the results page triggers **inline WeChat login** (`authenticateMiniProgramUserWithTest`) directly on the results page. Anonymous answers are imported automatically after successful auth. No separate auth-gate page exists.
- On the results page there is a **DEV-only WeChat bypass button** labeled **`⚡ 测试账号登录`** with `data-testid="button-dev-wechat-bypass"`. It logs in using a mock WeChat code for local testing, is hidden in production, and is not a user-facing CTA.
- The floating **`你的专属匹配已生成！` login card** (a redundant secondary login prompt that appeared over the results page) has been **removed**. The primary WeChat login CTA is sufficient.
- The standalone **`/personality-test/auth-gate`** page was removed in 2026-05. All post-result login logic lives inline on the results page.

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
5. Intent / Social Goals (multi-select — sourced from shared constants in `packages/shared/src/constants.ts` via `INTENT_OPTIONS` / `INTENT_FLEXIBLE_OPTION` / `getIntentLabel` / `toggleIntentValue`, see PR #299). Renders with the shared `IntentCard` component and `JoyJoinIcon tier='intent'`; `usePreloadIntentIcons` pre-warms the bundled intent icons before the grid renders.

> Intent options and selection logic are defined as a **single source of truth** in `packages/shared/src/constants.ts` (`INTENT_OPTIONS`, `INTENT_FLEXIBLE_OPTION`, `getIntentLabel`, `toggleIntentValue`). Use `toggleIntentValue(selected, value, { maxExplicit: 3 })` to enforce the explicit-intent cap while letting `随缘`/flexible coexist; it returns `null` when the cap is exceeded. Do **not** hardcode intent option arrays or cap logic in individual components — import from these shared constants.

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
  - 46 active topics across **5 macro categories** (`food`, `entertainment`, `lifestyle`, `culture`, `social`)
  - Multi-tap heat level: tap cycles 0 → 1 → 2 → 3 → off
    - Level 1 = 感兴趣 (heat 3)
    - Level 2 = 很热衷 (heat 10)
    - Level 3 = 必聊项 (heat 25)
  - **3–10 selections required** (enforced on both client and server: `POST /api/user/interests` returns 400 if `totalSelections < 3`)
- **Archetype-aware coaching:** Xiaoyue guidance and the footer "heat story" pill personalize around the user's archetype result from Step 1.
- **Milestone feedback:** Centered celebration toasts fire when the user crosses ≥3 selections, sets the first L3 / 必聊项, or selects topics from all 5 macro categories.
- **Category icons:** `JoyJoinIcon tier="category"` renders bundled proprietary icons (`src/assets/icons/category-icons/`); `usePreloadCategoryIcons` pre-warms them before the grid renders.

**After Completion:**
- `hasCompletedInterestsCarousel = true` (server-persisted; this is the canonical step-completion signal)
- Redirect to `/onboarding/review`

> ⚠️ Do **not** use `profileExtendedComplete` as the step-completion gate — it is computed server-side from education/industry/hometown fields and can be `true` before the carousel is completed. Use `hasCompletedInterestsCarousel` for onboarding-step logic only.

---

### Step 5: Profile Review

**Route:** `/onboarding/review`

**Page:** `apps/mini-program/src/pages/onboarding/profile-review/index.tsx`

**User State:** Has completed essential and extended data

**Content:**
- **Analyzing interstitial** — `AnalyzingAnimation` with Xiaoyue mascot shows `正在生成你的专属画像…` for a minimum **1200 ms**; reduced-motion users see a simplified, low-motion state. The interstitial is presentation-only and does not block submission.
- **Admission poster card** — a single vertically scrolling "Pokémon-card" profile poster (`profile-review__poster`) with archetype-themed gradient border, holographic shimmer (suppressed via `prefers-reduced-motion`), and rarity stamp.
  - Header: display name, archetype badge, and compact tags for gender, age, city, and relationship status.
  - **AI social tagline** — short warm insight line fetched from `GET /api/onboarding/profile-tagline` (service: `apps/server/src/profileTaglineService.ts`; contract: `ProfileTaglineResponse` in `packages/shared/src/ai/onboarding.ts`). Rendered as a centered quote block (`✨ 悦仔的观察`) with shimmer skeleton and retry on error. This is a presentation-only enhancement and does not block navigation.
  - **Archetype summary** — one-line description of the user's V4 archetype result.
  - **Profile mini-cards** —家乡、关系状态、学历、职业、行业 rendered with brand-colored dot indicators.
  - **Intent chips** — top social intents labeled with `JoyJoinIcon` (`tier='intent'`) and Chinese text. Intent icons are pre-warmed by `usePreloadIntentIcons` before grids render.
  - **Interest heat map** — `InterestHeatMap` stats + `InterestChipCloud` dominant-category chips.
- **Floating CTA** — pill-shaped "确认并进入发现" button anchored above the safe area; gains elevation when the page is scrolled.
- **Motion gating** — all entrance animations, shimmer, and CTA transitions respect `@media (prefers-reduced-motion: reduce)`; the JS `useMiniRevealMotion().shouldReduceMotion` flag suppresses the poster shimmer at runtime.

**What is NOT included (legacy / deprecated):**
- Match Power preview before Discover.
- Limited browse mode CTA.
- Archetype-personalized CTA copy variants.

**Downstream onboarding data reuse:** The user's interest selections made in Step 4 (Extended Data) are automatically reused downstream — they seed the optional **Interest Signal Boost** pre-match calibration tool (surfaced after pool registration), and pre-select the user's highest-heat interest for the boost UX. No re-asking of onboarding data is needed.

**Data Contract:**
- Server field: `user.hasSeenProfileReview` (persisted to database)
- API: `POST /api/onboarding/profile-review/complete` to mark as seen

**After Completion:**
- `hasSeenProfileReview = true`
- The page shows a brief "入场卡已确认" Xiaoyue celebration toast.
- Navigate via **server-computed `nextStep`** using the route map:
  ```ts
  const NEXT_STEP_TO_PATH: Record<string, string> = {
    'discover':        '/discover',
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

> **Note:** The 3-step guide (`/guide`) was **removed** (2026-05-07). Its content was replaced by inline coach marks (`CoachMarkBanner`, `XiaoyueFAB`, `ProfileCompletionNudge`) on the Discover page.

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
| `nextStep` | `string` | Server-calculated next route. Active values: `onboarding`, `personality-test`, `essential-data`, `extended-data`, `profile-review`, `discover`. |
| `profileEssentialComplete` | `boolean` | Essential data complete (displayName, gender, currentCity) |
| `profileExtendedComplete` | `boolean` | Server-computed profile enrichment flag: `true` when education + industry labels + hometown are present. Note: this is **separate** from the interests carousel completion flag (`hasCompletedInterestsCarousel`). |
| – (removed) | – | `hasSeenGuide` column removed from `users` table (2026-05-07). Guide step no longer exists. |
| `hasSeenProfileReview` | `boolean` | Profile review viewed (server-persisted) |
| `activeAssessmentSessionId` | `string \| null` | Active V4 session ID |
| `hasCompletedInterestsCarousel` | `boolean` | Set to `true` when the user completes or skips the interests carousel step (`/onboarding/extended`). This is the canonical completion gate for the extended-data onboarding step. |
| `tableVibePreference` | `string \| null` | Post-onboarding dining/social vibe preference collected via the Discover-page enrichment card. `null` until the user completes the enrichment step. |
| `restartsRemaining` | `number` | Onboarding restart quota remaining (0–5). Decrements on each successful restart. |
| `features` | `object` | DB-backed feature flags from server. `restartOnboarding` gates the welcome-back screen + restart flow. See `apps/server/src/lib/featureFlags.ts`. |

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/user` | GET | Get current user and nextStep |
| `/api/auth/onboarding/restart` | POST | Restart onboarding (clears derived data, returns to personality-test). Returns `400` with `code: 'ONBOARDING_ALREADY_COMPLETE'` if user is already at `discover`. Idempotent. |
| `/api/profile-review/complete` | POST | Mark profile review as seen |
| (removed) | – | `/api/guide/mark-seen` and `/api/guide/complete` removed (2026-05-07) |

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
