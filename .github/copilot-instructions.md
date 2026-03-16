# Copilot Instructions

## Copilot Operating Guidelines

### Freshness & Source-of-Truth Priority

When this file conflicts with inline code comments, older documentation in `docs/`, or stale variable names, **this file takes precedence**. Always prefer:

1. Current server-calculated `nextStep` values over client-side flow assumptions.
2. Active database schema and flags over legacy field names.
3. Sections marked ✅ Active over sections marked ⚠️ Legacy.

### Legacy-Handling Rules

- Deprecated flows (e.g., AI Chat Registration (`DuolingoOnboardingPage`)) exist only as **historical context**. Do not describe them as current behavior, route users through them, or add new code that depends on them.
- Tables and fields retained for historical data (e.g., `registration_sessions`, `hasCompletedRegistration`) must not be used in new feature development.
- Legacy components marked ⚠️ must not receive new CTAs, routes, or feature additions.

### Evidence-First Reasoning

- Ground all suggestions in actual file paths and function names referenced in this document.
- Label uncertainty explicitly: *"I believe X, but verify in `<file>`."*
- Do not infer behavior from deprecated code paths or stale comments.

### Minimal Safe Changes

- Prefer the smallest correct change over broad refactoring.
- Do not remove legacy tables or fields without an explicit migration task.
- Do not change onboarding state flags without understanding server-side implications.

### Onboarding State Consistency

- Always use server-driven `nextStep` for navigation; never reconstruct onboarding progress client-side.
- Onboarding flags are server-owned. The client reads state; it writes only through designated API endpoints.
- The authoritative onboarding flow is defined in the **Onboarding Flow Architecture** section of this file.

---

## Tech Stack

**Monorepo structure** (npm workspaces):
- `apps/user-client` — React 18 + TypeScript + Vite (user-facing PWA)
- `apps/admin-client` — React 18 + TypeScript + Vite (admin portal, deployed to admin.yuejuapp.com)
- `apps/server` — Node.js + Express.js + TypeScript (API server)
- `packages/shared` — Shared TypeScript types, schemas, personality engine

**Frontend:** React 18, TypeScript, Vite, Wouter, TanStack Query v5, shadcn/ui, Tailwind CSS, Framer Motion, Recharts  
**Backend:** Node.js, Express.js, TypeScript, Drizzle ORM, PostgreSQL (Neon serverless)  
**Auth:** WeChat OAuth2 (primary), Phone/SMS (legacy fallback), PostgreSQL session store  
**Real-time:** WebSocket (`ws` library), 3–5 second polling fallback  
**Payments:** WeChat Pay JSAPI + webhook

## Build Commands

```bash
npm install          # Install all workspace dependencies
npm run dev          # Start dev server on http://localhost:5000
npm run build        # Build all workspaces for production
npm run db:push      # Sync Drizzle schema to database
npm run db:push --force  # Force sync (use carefully)
```

## Project Structure

```
/
├── apps/
│   ├── user-client/src/
│   │   ├── pages/          # Page components (PersonalityTestPageV4, DiscoverPage, etc.)
│   │   ├── components/     # Shared UI components (BottomNav, AttendeePreviewCard, etc.)
│   │   ├── hooks/          # Custom hooks (useAuth, useWeChatLogin, useSocialIcebreaker)
│   │   └── lib/            # Utilities (archetypes.ts, queryClient.ts, hongKongTime.ts)
│   ├── admin-client/src/   # Admin portal (separate deployment)
│   └── server/src/
│       ├── routes.ts       # All API route registrations
│       ├── wechatAuth.ts   # WeChat auth endpoints
│       ├── poolMatchingService.ts  # 7-dimension matching algorithm
│       └── socialIcebreakerAIService.ts
└── packages/
    └── shared/src/
        ├── schema.ts       # Drizzle DB schema (source of truth)
        └── personality/    # Adaptive engine, V2 matcher, archetype names
```

## Code Conventions

- **TypeScript strict mode** — no `any` without justification
- **Server-driven navigation** — always use `nextStep` from `/api/auth/user`, never reconstruct onboarding state client-side
- **Query keys** — use array format `['/api/endpoint']` matching the URL path
- **File naming** — PascalCase for components/pages, camelCase for hooks/utilities
- **Chinese UI copy** — all user-facing strings in Simplified Chinese; use `权益` not `会员` in user-facing copy
- **Monorepo imports** — use `@/` alias for same-workspace imports; use `packages/shared` imports for cross-workspace types

## Key Systems

1. **Onboarding Flow** — state-driven via `nextStep` from server; see Onboarding Flow Architecture section
2. **Personality Test V4** — 8–16 adaptive questions, anonymous pre-auth; see `PersonalityTestPageV4.tsx`
3. **Pool Matching** — 7-dimension weighted scoring; see `poolMatchingService.ts`
4. **Social Icebreaker** — primary in-event multi-phase session; see `docs/icebreaker-system.md`
5. **WeChat Auth** — Mini Program `wx.login()` + OAuth2 web flow; see `wechatAuth.ts`
6. **BottomNav Smart Routing** — center button dynamically routes based on user's current activity state

## CI/CD Pipeline

- Deployment is via Replit (development) and production server
- `npm run build` produces `dist/` for both client workspaces
- Database migrations: `npm run db:push` (Drizzle schema push, no migration files)
- Admin portal deployed separately to `admin.yuejuapp.com`
- Caddy reverse proxy routes `/api/*` to the backend; all other paths to `user-client`

## Security Guidelines

- Use `requireAdmin` middleware on all `/api/admin/*` routes
- WeChat webhook: always verify signature before processing payment callbacks
- Session cookies: `httpOnly: true`, `secure: true` in production
- Never expose `WECHAT_SECRET` or `SESSION_SECRET` in client-side code
- SQL injection prevention: use Drizzle ORM parameterized queries (never raw string interpolation)
- User-facing copy: never use `会员`/`VIP`/`membership` — use `权益` (see PRD §Product Canon)

## Contribution Guidelines

1. Pull latest code and check recent changes in `replit.md`
2. For onboarding changes: read the full **Onboarding Flow Architecture** section before touching `App.tsx`
3. For matching algorithm changes: test in `/admin/matching-lab` before deploying
4. Update this file (`copilot-instructions.md`) if architectural decisions change
5. Update `PRODUCT_REQUIREMENTS.md` if product behaviour changes
6. Do not add new CTAs to ⚠️ Legacy components (`IcebreakerToolkit`, `GuidePage`)

## Debugging Tips

**WeChat auth not working:**
- In development, `wx.login()` is not available — the server accepts `wechat_test_<uuid>` mock codes automatically
- In staging/production browser, `useWeChatLogin` redirects to `/api/auth/wechat/oauth/start`
- Check `WECHAT_APPID`, `WECHAT_SECRET`, `APP_URL` env vars

**Onboarding stuck in a loop:**
- Check `nextStep` value in `/api/auth/user` response
- Verify the relevant completion flag is being set server-side (not just client-side)
- Check `AuthenticatedRouter` switch cases in `App.tsx`

**Pool matching produces no groups:**
- Verify users pass hard constraints (budget, gender, industry restrictions)
- Check minimum group size (`minGroupSize` default 4)
- Review pair scores — need avgScore ≥ 60 to add to group

**Admin portal not loading:**
- Admin routes in user-client redirect to `admin.yuejuapp.com`
- Start admin-client separately with `npm run dev` in `apps/admin-client`

## Key Documentation

1. **`.github/copilot-instructions.md`** (this file) — Authoritative source of truth for active architecture
2. **`PRODUCT_REQUIREMENTS.md`** — Full PRD (v1.3, last updated March 2026)
3. **`DEVELOPER_QUICK_REFERENCE.md`** — Monorepo-aware developer quick reference
4. **`QUICK_REFERENCE.md`** — ⚠️ Older reference, partially outdated; prefer DEVELOPER_QUICK_REFERENCE for file paths
5. **`docs/onboarding-flow.md`** — Detailed onboarding flow documentation
6. **`docs/icebreaker-system.md`** — Social Icebreaker full technical reference
7. **`replit.md`** — Project architecture + history of recent changes

### Onboarding Flow Architecture

> **⚠️ Important for Copilot**: Onboarding is **state-driven and conditional** — not a single universal linear sequence. Always reason about onboarding using:
> - The server-returned `nextStep` value from `/api/auth/user`
> - Active `switch` cases in `App.tsx` → `AuthenticatedRouter`
> - Persisted completion flags on the `users` table
>
> **Do not** infer the onboarding path from stale documentation, deprecated helpers, or historical code comments. **Do not** assume all users pass through every step, or that login/signup always occurs at the same point for every user type. Prefer active implementation over any prior documented flow.

#### User Entry Contexts (Conditional)

| User Type | Entry Behaviour |
|-----------|-----------------|
| **New / unauthenticated user** | Lands on `LandingPage`; navigates to `/personality-test` and completes `PersonalityTestPageV4` **anonymously**. WeChat 微信授权登入 (account creation / sign-up) happens **after** the personality test during `PersonalityTestResultPage`. After auth, the client calls `/api/auth/user` and uses the server-calculated `nextStep` to decide whether to continue onboarding (e.g. essential data) or send the user to later routes, depending on their stored flags. |
| **Partially completed user** | Re-enters at the step indicated by the server-returned `nextStep` (e.g. `essential-data`, `extended-data`, `profile-review`). Earlier steps are not repeated. |
| **Returning user** | Server returns `nextStep === 'discover'` → navigated directly to `/discover`. No onboarding steps are shown. |

#### State-Driven Navigation

All post-authentication routing is controlled by `nextStep` from the `/api/auth/user` response. The `AuthenticatedRouter` in `App.tsx` switches on this value to present only the routes appropriate for the user's current state. The active onboarding steps for a first-time user follow the sequence below, but any step may be the entry point for a partially-completed user:

| Step | Route | Component | Completion Flag |
|------|-------|-----------|-----------------|
| Personality Test | `/personality-test` | `PersonalityTestPageV4` | `hasCompletedPersonalityTest` |
| Essential Data | `/onboarding/setup` | `EssentialDataPage` | `profileEssentialComplete` |
| Extended Data | `/onboarding/extended` | `ExtendedDataPage` | `hasCompletedInterestsCarousel` |
| Final Profile Review | `/onboarding/review` | `FinalProfileReviewPage` | `hasSeenProfileReview` (server) |
| Guide *(conditional)* | `/guide` | `GuidePage` | `hasSeenGuide` (server) |

> **Note on the Guide step**: The `nextStep === 'guide'` case in `AuthenticatedRouter` currently renders `DiscoverPage` directly (inline coach marks replaced the dedicated guide flow). The `/guide` route and `GuidePage` are kept for backward compatibility. Do not treat the guide as a mandatory blocking step in new code unless the active `App.tsx` switch confirms otherwise.

> **Note on Registration**: The legacy AI Chat Registration step (`DuolingoOnboardingPage`) has been removed from the active onboarding flow. The `/onboarding` path now aliases/renders the V4 personality test (`PersonalityTestPageV4`) directly at `/onboarding` rather than redirecting to `/personality-test`. Any reference to this step in older code or documentation is legacy and should be treated as such.

> **Additional `nextStep` values** handled by `AuthenticatedRouter` in `App.tsx` but **not listed in the table above** (because they are legacy/fallback, not active onboarding steps):
>
> | `nextStep` value | Behaviour in `AuthenticatedRouter` |
> |-----------------|-------------------------------------|
> | `'onboarding'` | ⚠️ Legacy fallback — redirects to `/personality-test` |
> | `'personality-test'` | Allows personality test + setup routes to render (used during post-auth pre-essential-data state) |
>
> These values are returned by the server for edge-case user states. They are not distinct steps in the first-time user onboarding sequence.

#### Server-Driven Navigation (Scope B1)

**Prefer `nextStep` over client-side onboarding calculations:**

```typescript
const { nextStep } = useAuth();
// Returns: 'onboarding' | 'personality-test' | 'essential-data' |
//          'extended-data' | 'profile-review' | 'guide' | 'discover'
// Note: 'onboarding' is a legacy/fallback value — the server may return it
// for users whose registration is incomplete; AuthenticatedRouter redirects
// this case to /personality-test. It is not a distinct step in new flows.

// Redirect logic
if (nextStep !== 'discover') {
  setLocation(getStepRoute(nextStep));
}
```

**Helper hook for detailed progress:**
```typescript
const { currentStep, progress, isComplete, steps } = useOnboardingProgress();
```

#### Auth Response Extensions

The `/api/auth/user` endpoint returns:

| Field | Type | Description |
|-------|------|-------------|
| `nextStep` | `string` | Server-calculated next route: `'onboarding' \| 'personality-test' \| 'essential-data' \| 'extended-data' \| 'profile-review' \| 'guide' \| 'discover'` (`'onboarding'` is a legacy/fallback value; routes to `/personality-test`) |
| `profileEssentialComplete` | `boolean` | Essential data complete (displayName, gender, currentCity) |
| `profileExtendedComplete` | `boolean` | Profile enrichment flag based on `educationLevel` + `industryNicheLabel\|industryCategoryLabel` + `hometownRegionCity` (not the interests carousel / `/onboarding/extended` step) |
| `hasSeenGuide` | `boolean` | Guide viewed (server-persisted) |

> **Note on `profileExtendedComplete` vs `hasCompletedInterestsCarousel`:** These are two different things.
> - `hasCompletedInterestsCarousel` (`boolean`, `users` table DB column) — set to `true` when the user completes the `/onboarding/extended` interests carousel step.
> - `profileExtendedComplete` (computed, returned by `/api/auth/user`) — server-validates that `educationLevel` + `industryNicheLabel|industryCategoryLabel` + `hometownRegionCity` are present. This is **not** the same as `hasCompletedInterestsCarousel`. A user can have `hasCompletedInterestsCarousel = true` but `profileExtendedComplete = false` if they skipped education/industry fields.
| `hasSeenProfileReview` | `boolean` | Profile review viewed (server-persisted) |
| `activeAssessmentSessionId` | `string \| null` | Active V4 session ID |

#### Guide System

The guide is **server-persisted** but **currently conditional** in routing: `AuthenticatedRouter` treats `nextStep === 'guide'` the same as `nextStep === 'discover'`, routing users directly to `DiscoverPage` with inline coach marks. The dedicated `GuidePage` is retained for backward compatibility only.

- Server field: `user.hasSeenGuide` (persisted to database; single source of truth for guide completion)
- Client: Inline coach marks/state should use their own storage keys as needed; do **not** introduce or rely on a `joyjoin_guide_seen` localStorage flag.
- API: `POST /api/guide/mark-seen` or `POST /api/guide/complete` to mark the guide as seen/completed

#### Key Files
- `apps/user-client/src/App.tsx` — `AuthenticatedRouter` switch on `nextStep` (authoritative routing source)
- `apps/user-client/src/hooks/useAuth.ts` — Returns `nextStep` from server
- `apps/user-client/src/hooks/useOnboardingRoute.ts` — Client-side route calculation helper
- `apps/user-client/src/hooks/useOnboardingProgress.ts` — Progress tracking
- `apps/user-client/src/pages/PersonalityTestPageV4.tsx` — V4 adaptive assessment (runs unauthenticated)
- `apps/user-client/src/pages/PersonalityTestResultPage.tsx` — Shows result; hosts WeChat 微信授权登入 for new users
- `apps/user-client/src/pages/EssentialDataPage.tsx` — 7-step essential data
- `apps/user-client/src/pages/ExtendedDataPage.tsx` — Interests carousel
- `apps/user-client/src/pages/FinalProfileReviewPage.tsx` — Profile preview and review
- `apps/user-client/src/pages/LoginPage.tsx` — WeChat 微信授权登入
- `apps/user-client/src/pages/GuidePage.tsx` — ⚠️ **Deprecated** (2026-02-16). Replaced by inline coach marks. The `/guide` route still renders this page for backward compatibility but `nextStep === 'guide'` routes directly to `DiscoverPage`. Do not add new features here.
- `apps/user-client/src/pages/ProfileSetupPage.tsx` — ⚠️ **Unused** — imported in `App.tsx` but not routed. Candidate for removal.

#### Admin Portal Deployment Note

The admin portal (`apps/admin-client`) is deployed as a **separate application** at `https://admin.yuejuapp.com`. All `/admin/*` routes in `apps/user-client/src/App.tsx` unconditionally redirect to that subdomain. Admin pages are **not** served by the user client build. This means:
- Admin routes from `PRODUCT_REQUIREMENTS.md §2.*` refer to `admin.yuejuapp.com/*` routes
- The `apps/admin-client` workspace must be built and deployed separately
- In local development, run `apps/admin-client` on a separate port

## Onboarding Data Model

### User Table Onboarding Fields

**Progress Flags** (`users` table):
```typescript
hasCompletedRegistration: boolean;     // LEGACY — registration/essential profile completion gate (set after displayName/gender/currentCity, not at WeChat auth)
hasCompletedPersonalityTest: boolean;  // V4 adaptive assessment complete
hasSeenProfileReview: boolean;         // Final Profile Review viewed (server-persisted)
hasSeenGuide: boolean;                 // Guide viewed (server-persisted)
hasCompletedInterestsCarousel: boolean; // Carousel-based interest selection
```

**Server-Calculated Navigation Fields** (returned by `/api/auth/user`):
```typescript
nextStep: string;
// 'onboarding' | 'personality-test' | 'essential-data' |
// 'extended-data' | 'profile-review' | 'guide' | 'discover'
// ('onboarding' is a legacy/fallback value; routes to /personality-test)

profileEssentialComplete: boolean;
// Server-validates: displayName, gender, currentCity present

profileExtendedComplete: boolean;
// Server-validates: education + industry labels + hometown present

activeAssessmentSessionId: string | null;
// Current V4 assessment session if in progress
```

### Assessment Sessions Table

**Structure** (`assessment_sessions`):
```typescript
{
  id: string;
  userId: string;
  phase: 'pre_signup' | 'post_signup' | 'completed';
  
  // V4 Adaptive Engine State
  currentQuestionIndex: number;
  traitScores: { A: number, C: number, E: number, O: number, X: number, P: number };
  traitConfidences: { [trait: string]: { score: number; confidence: number; sampleCount: number } };
  topArchetypes: Array<{ archetype: string; score: number; confidence: number }>;
  
  // MatcherV2 Results
  algorithmVersion: 'v1' | 'v2';
  matchDetailsJson: {
    primaryArchetype: string;
    secondaryArchetype: string;
    traitDeltas: { [trait: string]: number };
    decisiveReason: string;
    score: number;
  };
  
  // Completion
  primaryArchetype: string;  // Final result
  isDecisive: boolean;       // High confidence match
  completedAt: timestamp;
}
```

### Registration Sessions Table

> ⚠️ **Legacy telemetry table.** Retained for historical data only. Do not use in new feature development.

**Structure** (`registration_sessions`):
```typescript
{
  id: string;
  userId: string;
  sessionMode: 'ai_chat' | 'form' | 'hybrid';
  
  // Lifecycle Timestamps
  startedAt: timestamp;
  l1CompletedAt: timestamp;  // Essential data complete
  l2EnrichedAt: timestamp;   // Optional data first fill
  completedAt: timestamp;    // Registration done
  abandonedAt: timestamp;    // If abandoned
  
  // Quality Metrics
  completionQuality: number;  // 0-1
  l3Confidence: number;       // AI inference confidence
  messageCount: number;       // Chat rounds
  
  // AI Evolution Tracking
  triggersUsedInSession: string[];  // Trigger IDs
  aiResponseQuality: number;        // 0-1
}
```

### User Interests Table

**Structure** (`user_interests`):
```typescript
{
  id: string;
  userId: string;
  
  // Aggregated Metrics
  totalHeat: number;        // Sum of all heat values
  totalSelections: number;  // Count of selected topics
  
  // Category-level heat
  categoryHeat: {
    "career": number,
    "philosophy": number,
    "lifestyle": number,
    "culture": number,
    "city": number
  };
  
  // Individual selections
  selections: Array<{
    topicId: string;
    emoji: string;
    label: string;
    fullName: string;
    category: string;
    categoryId: string;
    level: number;
    heat: number;
  }>;
  
  // Top priorities (level 3 items)
  topPriorities: Array<{ topicId: string; label: string; heat: number }>;
}
```

### Key Tables Reference

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `users` | User profiles | `hasSeenGuide`, `hasCompletedPersonalityTest`, `hasCompletedInterestsCarousel` |
| `assessment_sessions` | V4 personality tests | `phase`, `traitScores`, `primaryArchetype`, `matchDetailsJson` |
| `assessment_answers` | V4 test responses | `sessionId`, `questionId`, `selectedOption`, `traitScores` |
| `registration_sessions` | ⚠️ Legacy telemetry | `sessionMode`, `l1CompletedAt`, `completionQuality` |
| `user_interests` | Interest selections | `totalHeat`, `categoryHeat`, `selections`, `topPriorities` |
| `user_social_tag_generations` | Social tags | `tags` (JSONB array), `selectedTag`, `selectedAt` |

### Data Flow

```
1. Unauthenticated user takes Personality Test (/personality-test)
   ├─> Create assessment_session (phase: 'pre_signup')
   ├─> For each answer: insert assessment_answer
   ├─> Update assessment_session.traitScores (real-time)
   └─> On completion: user is prompted for WeChat 微信授权登入

2. User authenticates via WeChat 微信授权登入
   ├─> POST /api/auth/wechat/login-with-test (authenticates user and returns auth/user state, including server-calculated nextStep)
   ├─> If there is an existing anonymous assessment_session: client calls POST /api/assessment/v4/:sessionId/link-user (post-auth) to associate it with the user
   └─> This auth endpoint does not itself mutate onboarding flags (e.g. hasCompletedRegistration, hasCompletedPersonalityTest, profileEssentialComplete)

3. User completes essential data (/onboarding/setup)
   ├─> Update users (displayName, gender, currentCity)
   └─> Server sets profileEssentialComplete = true → nextStep = 'extended-data'

4. User completes interests carousel (/onboarding/extended)
   ├─> Insert/Update user_interests
   └─> hasCompletedInterestsCarousel = true → nextStep = 'profile-review'

5. User views Final Profile Review (/onboarding/review)
   ├─> POST /api/profile-review/complete
   └─> hasSeenProfileReview = true → nextStep = 'guide' or 'discover'

6. Server calculates nextStep
   └─> Returns 'discover' when all flags true
       (nextStep === 'guide' also routes to /discover in current implementation)
```

### Migration Notes

- **AI Chat Registration Removed**: The `DuolingoOnboardingPage` / AI Chat Registration step is no longer part of the active onboarding flow. The `/onboarding` path now aliases/renders `PersonalityTestPageV4` directly. Any code or documentation referencing this step is legacy.
- **Personality Test Now Pre-Auth**: Users can complete the V4 personality test anonymously before creating an account. WeChat 微信授权登入 occurs after the test. If an anonymous `assessment_session` exists, the client links it via `POST /api/assessment/v4/:sessionId/link-user` after auth.
- **Guide Step Now Conditional**: `nextStep === 'guide'` currently renders `DiscoverPage` directly (inline coach marks). The `GuidePage` is kept for backward compatibility only.
- **Final Profile Review Added**: `FinalProfileReviewPage` (`/onboarding/review`) is an active onboarding step between Extended Data and the main app. Tracked by `hasSeenProfileReview` (server-persisted).
- **V2 Test Deprecated**: Old `personality_questions`, `test_responses`, `role_results` tables are legacy (kept for historical data, not used in new code).
- **Interest Fields Removed**: `interestsTop`, `primaryInterests`, `topicsHappy`, `topicsAvoid` moved to `user_interests` table (old fields deprecated but not dropped).
- **Language Selection**: No longer collected in onboarding (moved to event pool registration).

## Updated Pool Matching Algorithm (7-Dimension Weighted Scoring)

### Algorithm Overview

**Location**: `apps/server/src/poolMatchingService.ts`

The matching algorithm calculates compatibility between users using **7 weighted dimensions**:

```typescript
// 7-Dimension Matching Weights (when hometown enabled)
{
  chemistry: 0.30,      // Personality compatibility (30%)
  interest: 0.30,       // Interest overlap (30%)
  language: 0.15,       // Language communication (15%)
  preference: 0.15,     // Event preferences (15%)
  hometown: 0.05,       // Hometown affinity (5%)
  background: 0.05,     // Background diversity (5%)
}

// When hometown disabled, weights rebalance:
{
  chemistry: 0.35,      // +5%
  interest: 0.35,       // +5%
  language: 0.15,       // unchanged
  preference: 0.15,     // unchanged
  hometown: 0,          // disabled
  background: 0,        // disabled
}
```

### Dimension Details

#### 1. Chemistry Score (30%) - `calculateChemistryScore()`

Based on archetype compatibility matrix from `archetypeChemistry.ts`:

```typescript
// Primary archetype (70%) + Cross chemistry (30%)
chemistry = 
  (primary1 × primary2) * 0.70 +
  (primary1 × secondary2) * 0.15 +
  (secondary1 × primary2) * 0.15
```

**Chemistry Matrix**: 12×12 matrix with scores 0-100
- **90-100**: Perfect match, sparks fly (🔥炽热)
- **75-89**: Highly compatible (🌡️温暖)
- **60-74**: Good interaction (🌤️适宜)
- **45-59**: Medium compatibility (❄️冷淡)

#### 2. Interest Score (30%) - `calculateInterestScoreAsync()`

Uses `user_interests` table with **heat-weighted matching**:

```typescript
// Base Jaccard similarity
baseScore = (commonTopics / unionTopics) * 85 + 15

// Heat bonus (max +20)
if (both level 3): +15
if (both level 2): +8
if (one level 3, one level 2): +10
else: +3

finalScore = min(100, baseScore + heatBonus)
```

#### 3. Language Score (15%) - `calculateLanguageScore()`

```typescript
if (commonLanguages > 0): 100
else: 30  // No common language penalty
```

#### 4. Preference Score (15%) - `calculatePreferenceScore()`

For **饭局** (dinner):
- Event intent overlap

For **酒局** (bar):
- Bar themes overlap
- Alcohol comfort overlap
- Event intent overlap

**Note**: Budget is now a **hard constraint** (L1 filter), not scored here.

#### 5. Hometown Score (5%) - `calculateHometownAffinityScore()`

Only applies if **both users opted in**:

```typescript
if (sameCity): 100      // 老乡！(epic)
if (sameProvince): 70   // Same province (rare)
else: 0                 // No bonus
```

#### 6. Background Diversity (5%) - `calculateDiversityScore()`

Encourages diverse groups:

```typescript
diversityPoints = 
  (differentIndustry ? 40 : 0) +
  (differentEducation ? 30 : 0) +
  (differentGender ? 30 : 0)

score = min(100, diversityPoints)
```

### Group Formation Algorithm

**Location**: `matchEventPool()` function

```
1. Hard Constraint Filtering
   ├─> Gender restriction
   ├─> Industry restrictions
   ├─> Education restrictions
   ├─> Age range (min/max)
   └─> Budget (L1 hard constraint)

2. Pair Scoring (all eligible users)
   ├─> Calculate pairScore for all combinations
   ├─> Invitation bonus: +20 points if invited pair
   └─> Sort by score (descending)

3. Greedy Group Formation
   ├─> Start with highest-scoring pair
   ├─> Add members with avgScore ≥ 60
   ├─> Stop at targetGroupSize (default 6)
   └─> Require minGroupSize (default 4)

4. Group Scoring
   ├─> avgPairScore (60%)
   ├─> diversityScore (25%)
   ├─> energyBalance (15%)
   └─> overallScore = weighted sum

5. Temperature Classification
   ├─> 85+: 🔥 Fire (炽热)
   ├─> 70-84: 🌡️ Warm (温暖)
   ├─> 55-69: 🌤️ Mild (适宜)
   └─> <55: ❄️ Cold (冷淡)
```

### Energy Balance Score

**Purpose**: Ensure groups have balanced social energy (not all high or all low)

```typescript
// Ideal average energy: 50-70
// Ideal stdDev: <15

energyBalance = 
  avgEnergyScore * 0.6 +
  stdDevScore * 0.4
```

**Archetype Energy Values** (from `ARCHETYPE_ENERGY`):
- 开心柯基: 95 (Very High)
- 太阳鸡: 90 (Very High)
- 隐身猫: 30 (Very Low)
- 稳如龟: 38 (Low)

### Key Changes from Previous Version

1. ✅ **Budget moved to L1 hard constraint** (was soft constraint)
2. ✅ **Removed food preferences from scoring** (cuisine, dietary, taste) — still collected for restaurant matching but not used in compatibility scoring
3. ✅ **Increased interest weight** from 20% → 30%
4. ✅ **Decreased hometown weight** from 10% → 5%
5. ✅ **Added heat-weighted interest matching** (level 2/3 bonus)
6. ✅ **Removed emotional score** (was hardcoded 70, not used)
7. ✅ **Interests now from `user_interests` table** (not `interestsTop` field)

### Debugging Tips

**Poor match scores:**
- Check `CHEMISTRY_MATRIX` values in `archetypeChemistry.ts`
- Verify `user_interests` table has data (not empty `selections`)
- Check if hometown affinity is enabled for both users

**No matches formed:**
- Verify users pass hard constraints (budget, gender, industry)
- Check minimum group size (`minGroupSize` default 4)
- Review pair scores (need avgScore ≥ 60 to add to group)

**Energy imbalance:**
- Check archetype distribution (avoid all high-energy or all low-energy)
- Review `ARCHETYPE_ENERGY` values
- Target groups with avgEnergy 50-70, stdDev <15

## Attendee Card System

### Component Overview

**Location**: `apps/user-client/src/components/AttendeePreviewCard.tsx`

The attendee card is a **flip card** displaying profile information with privacy controls.

### Card Structure

```typescript
interface AttendeePreviewCardProps {
  attendee: AttendeeData;
  userInterests?: string[];
  userArchetype?: string;
  userHometownRegionCity?: string;
  userHometownAffinityOptin?: boolean;
  // ... other user context for connection points
}
```

### Front Side (Default View)

Displays **180px × 320px** card with:

1. **Avatar/Archetype Image** (top)
   - Archetype animal image if available
   - Fallback: Sparkles icon

2. **Name & Archetype** (center)
   - `displayName` (bold, large)
   - Archetype name + nickname

3. **Age** (optional, based on `ageVisibility`)
   - `hide_all`: No age shown
   - `show_age_range`: "25-30岁"

4. **Education** (optional, based on `educationVisibility`)
   - `hide_all`: No education shown
   - `show_level_only`: "硕士"
   - `show_level_and_field`: "硕士 - 计算机"

5. **Work** (optional, based on `workVisibility`)
   - `hide_all`: No work shown
   - `show_industry_only`: "科技"
   - Full: "科技 - 产品经理"

6. **Hometown** (if provided)
   - MapPin icon + city name

7. **Top Interests** (up to 3)
   - Badge chips at bottom

### Back Side (Flip View)

Shows **connection points (契合点)** with current user:

```typescript
const connectionPoints = generateSparkPredictions(
  userContext,
  attendee
);
```

Displays:
- Up to 10 connection points
- Sorted by rarity (epic > rare > common)
- Color-coded badges
- Scroll for overflow

### Privacy System

Users control visibility via profile settings:

| Field | Setting | Values |
|-------|---------|--------|
| Age | `ageVisibility` | `hide_all`, `show_age_range` |
| Education | `educationVisibility` | `hide_all`, `show_level_only`, `show_level_and_field` |
| Work | `workVisibility` | `hide_all`, `show_industry_only` |

### Flip Animation

```typescript
const [isFlipped, setIsFlipped] = useState(false);

const cardStyle = {
  transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
  transition: "transform 0.5s",
};
```

### Key Files

- `apps/user-client/src/components/AttendeePreviewCard.tsx` — Main card component
- `apps/user-client/src/components/UserConnectionCard.tsx` — Connection-focused variant
- `apps/user-client/src/components/StackedAttendeeCards.tsx` — Stack display
- `apps/user-client/src/lib/attendeeAnalytics.ts` — Connection point generation

### Usage Example

```typescript
<AttendeePreviewCard
  attendee={attendeeData}
  userInterests={currentUser.interests}
  userArchetype={currentUser.archetype}
  userHometownRegionCity={currentUser.hometownCity}
  userHometownAffinityOptin={currentUser.hometownOptin}
  onClick={() => setSelectedAttendee(attendeeData)}
/>
```

## Connection Points System (契合点系统)
This system utilizes rarity-based scoring:
- **Rarity**: Categories include common, rare, and epic.
- **Quality Tiers**: Different quality levels based on user data and matching.
- **generateSparkPredictions**: Function to generate predictions based on user matches.

## Social Icebreaker System

> **The Social Icebreaker is the PRIMARY and MANDATORY in-event icebreaking flow. All other icebreaker components are supporting layers. New icebreaker features MUST integrate with Social Icebreaker.**

> **Architecture principle:** The **Social Icebreaker** (`shared/socialIcebreaker.ts` + `apps/server/src/routes/socialIcebreaker.ts` + `apps/server/src/socialIcebreakerAIService.ts`) is the **central icebreaking flow**. All other icebreaker components are supporting layers.

### Component Hierarchy

| Component | Role | Status | Files |
|-----------|------|--------|-------|
| **Social Icebreaker** | ⭐ PRIMARY — central multi-phase in-event session | ✅ Active — use this | `shared/socialIcebreaker.ts`, `apps/server/src/routes/socialIcebreaker.ts`, `apps/server/src/socialIcebreakerAIService.ts`, `apps/user-client/src/hooks/useSocialIcebreaker.ts` |
| **IcebreakerToolkit** | 🗂️ LEGACY — pre-event host prep, 13 curated games | ⚠️ Legacy — do not extend | `apps/user-client/src/components/icebreaker/IcebreakerToolkit.tsx`, `shared/icebreakerGames.ts` |
| **IcebreakerCardGame** | 🎴 SUPPORTING — AI card deep-dive, runs within warmup | ✅ Active — supporting layer | `apps/user-client/src/components/icebreaker/IcebreakerCardGame.tsx`, `apps/server/src/icebreakerCardGenerationService.ts` |
| **IcebreakerTool Widget** | 🔗 ENTRY POINT — teaser widget on Discover page | ✅ Active — entry point only | `apps/user-client/src/components/IcebreakerTool.tsx` |

> **Legacy Toolkit Notice:** The IcebreakerToolkit must **not** be featured as the main CTA during events. It is a legacy pre-event game browser retained for backward compatibility. Do not add new Toolkit CTAs or direct users to the Toolkit as the primary in-event icebreaking experience.

### Social Icebreaker Phases (MVP)

```
warmup → micro_challenge → lie_detective → recap
```

`MVP_PHASES = ['warmup', 'micro_challenge', 'lie_detective']`

`AtmosphereMood = 'relaxed' | 'funny' | 'life' | 'emotional'`

### Key API Routes

- `POST /api/social-icebreaker/start` — join/create session (first caller = host)
- `GET /api/social-icebreaker/:socialSessionId` — poll state every 3s
- `POST /api/social-icebreaker/:socialSessionId/advance` — host advances phase
- `POST /api/social-icebreaker/:socialSessionId/topics` — host generates warmup topics
- `POST /api/social-icebreaker/:socialSessionId/lie-detective/generate` — per-user AI statements
- `POST /api/social-icebreaker/:socialSessionId/lie-detective/vote` — vote on the lie
- `GET /api/social-icebreaker/:socialSessionId/recap` — AI session summary

### Frontend Hook

```typescript
const { state, isHost, startSession, fetchTopics, advancePhase,
        submitPulseCheck, generateMyStatements, castVote, completeChallenge }
  = useSocialIcebreaker({ sessionId, userId, displayName });
```

**Full reference:** `docs/icebreaker-system.md`

## Recent Major Changes
- Documentation gaps fixed (2026-03-16): QUICK_REFERENCE.md updated to V4 archetypes + WeChat-first auth + monorepo paths; PRD §1.1 updated to WeChat-first primary flow; Copilot Instructions stub sections filled in; admin subdomain deployment documented.
- Social Icebreaker established as the primary in-event flow (2026-03-06); IcebreakerToolkit demoted to legacy.
- Onboarding flow updated to state-driven, conditional architecture: personality test runs anonymously before WeChat sign-up; `FinalProfileReviewPage` added as active step; AI Chat Registration removed; guide step now conditional (renders Discover directly).
- Interests carousel for enhanced user engagement.
- Guide persistence to maintain user orientation.
- Updates to the matching algorithm for improved accuracy.

**Note**: Ensure to follow the existing formatting style and professional tone throughout the document.