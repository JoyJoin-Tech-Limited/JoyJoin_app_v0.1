# JoyJoin Developer Quick Reference Guide

**Version:** 2.0  
**Last Updated:** March 2026  
**For:** Tech Team Onboarding & Codebase Navigation

---

## ⚠️ CANONICAL RULE: Always Use Active Flow — Never Reference Legacy

> **This rule applies to ALL contributors: human engineers, AI coding agents, and documentation authors.**

**When writing code, copy, documentation, or making any implementation decision:**

- ✅ Base everything on the **current, active codebase** — routes, components, schemas, and API endpoints that exist and are actively used.
- ✅ Check this file (`DEVELOPER_QUICK_REFERENCE.md`) and `PRODUCT_REQUIREMENTS.md` § *Product Canon & Terminology* for the authoritative active-flow reference.
- ❌ **Never** refer to, reintroduce, or base decisions on **legacy flows, deprecated components, old routes, or removed features** — even if they appear in older git history, archived docs, or comments marked "TODO: restore".
- ❌ **Never** treat `QUICK_REFERENCE.md` (the older file) as authoritative — it is a supplementary reference only and some sections are outdated. `DEVELOPER_QUICK_REFERENCE.md` supersedes it.
- ❌ **Never** use deprecated terminology from §*Product Canon* — see `PRODUCT_REQUIREMENTS.md` for the current canonical terms.

### What counts as "legacy" (do not use)?
- The **14-archetype V1/V2 system** (火花塞, 探索者, 故事家…) — replaced by the **12-archetype V4 system**
- The **`/chats` event-chat/group-chat surface** — replaced by `/connections` (structured mutual connections)
- Any **direct-message (DM) UI or API** — removed; the product does not have in-app private messaging
- The **`圈子`** nav label — replaced by `连接`
- **`会员 / VIP会员`** user-facing copy — replaced by `权益`
- Any reference to the **`shared/` root folder** as the import source — use `packages/shared/src/` instead
- The **`/guide` page** as a core onboarding step — it is deprecated; the active onboarding steps after WeChat login are `/onboarding/setup`, `/onboarding/extended`, and `/onboarding/review`, then directly to `/discover`
- **Demo code `666666`** and `createDemoDataForUser` in production — gated on `NODE_ENV !== 'production'`

### If you are unsure whether something is active or legacy:
1. Check whether the file/route/component is imported and used in `App.tsx` or an active page.
2. Check `PRODUCT_REQUIREMENTS.md` § *Product Canon & Terminology*.
3. If still unsure, flag for human review rather than guessing.

---

## Quick Start

### Prerequisites
```bash
# Ensure Node.js 20+ is installed
node --version

# Install dependencies
npm install

# Push database schema (REQUIRED after pulling changes)
npm run db:push
```

### Development Server
```bash
npm run dev
# Runs on port 5000 - serves both frontend and backend
```

### Key Commands
```bash
npm run db:push          # Sync Drizzle schema to database
npm run db:push --force  # Force sync (use when db:push fails)
npm run db:studio        # Open Drizzle Studio (database GUI)
```

---

## Monorepo Structure

```
joyjoin-monorepo/
├── apps/
│   ├── user-client/          # User-facing React app (mobile-first)
│   │   ├── src/
│   │   │   ├── pages/        # Page components (40+ pages)
│   │   │   ├── components/   # Reusable UI components (90+ components)
│   │   │   ├── hooks/        # Custom React hooks
│   │   │   ├── lib/          # Utilities (queryClient, etc.)
│   │   │   ├── data/         # Static data files
│   │   │   └── App.tsx       # Main app with routing
│   │   └── index.html
│   │
│   ├── admin-client/         # Admin portal React app (desktop-first)
│   │   ├── src/
│   │   │   ├── pages/admin/  # Admin-specific pages
│   │   │   ├── components/   # Admin UI components
│   │   │   └── AdminApp.tsx  # Admin app entry
│   │   └── index.html
│   │
│   └── server/               # Express.js backend
│       └── src/
│           ├── routes.ts             # API endpoints (5000+ lines)
│           ├── storage.ts            # Database storage interface
│           ├── db.ts                 # Drizzle database connection
│           ├── index.ts              # Server entry point
│           ├── wsService.ts          # WebSocket service
│           ├── poolMatchingService.ts       # Group matching logic
│           ├── poolRealtimeMatchingService.ts  # Auto-matching scheduler
│           ├── archetypeChemistry.ts        # Chemistry calculations
│           ├── matchExplanationService.ts   # AI match explanations
│           ├── xiaoyueAnalysisService.ts    # AI personality analysis
│           ├── icebreakerAIService.ts       # AI conversation topics
│           └── ...                          # Other services
│
├── packages/
│   └── shared/               # Shared types, schemas, personality system
│       └── src/
│           ├── schema.ts             # Drizzle ORM database schema
│           ├── wsEvents.ts           # WebSocket event interfaces
│           ├── constants.ts          # Shared constants
│           ├── districts.ts          # Location data (南山区, 福田区)
│           ├── gamification.ts       # XP/Level system
│           └── personality/          # Personality assessment system
│               ├── matcherV2.ts          # MatcherV2 algorithm
│               ├── questionsV4.ts        # V4 adaptive questions (130+)
│               ├── adaptiveEngine.ts     # Question selection engine
│               ├── archetypeRegistry.ts  # 12 archetype definitions
│               ├── archetypeCompatibility.ts  # Chemistry matrix
│               ├── types.ts              # Type definitions
│               └── feedback.ts           # Feedback templates
│
├── migrations/               # Drizzle database migrations
├── scripts/                  # Utility scripts
├── docs/                     # Documentation
└── shared/                   # Legacy shared folder (deprecated, use packages/shared)
```

---

## User Journey & Authentication Flow

**Updated:** 2026-02-04 (Post-Test Signup Flow - Option B)

### Authentication States

The app uses progressive authentication with server-driven navigation:

```typescript
// From useAuth hook (extended for post-test signup)
interface AuthState {
  isAuthenticated: boolean;       // Has valid session
  nextStep: string;               // Server-calculated next route
  profileEssentialComplete: boolean;  // Essential data complete
  profileExtendedComplete: boolean;   // Extended data complete
  activeAssessmentSessionId: string | null;  // Active test session
  
  // Legacy computed fields (still available)
  needsRegistration: boolean;     // Phone verified, no profile
  needsPersonalityTest: boolean;  // Profile exists, no test results
  needsProfileSetup: boolean;     // Test done, profile incomplete
}
```

### Complete User Flow Diagram (Option B: Post-Test Signup)

```
┌─────────────────────────────────────────────────────────────────────┐
│                         UNAUTHENTICATED                             │
├─────────────────────────────────────────────────────────────────────┤
│  /                   → LandingPage (redirects to /personality-test) │
│  /personality-test   → PersonalityTestPageV4 (Anonymous)            │
│  /personality-test/results → PersonalityTestResultPage (+ Login CTA)│
│  /login              → LoginPage (fallback for non-WeChat)          │
│  /invite/:code       → InviteLandingRouter (public)                 │
│  /icebreaker-demo    → IcebreakerDemoPage (public demo)             │
│  /admin/login        → AdminLoginPage                               │
│  *                   → Redirects to LandingPage                     │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                    ▼ (After WeChat Login with test results)
┌─────────────────────────────────────────────────────────────────────┐
│                    Authenticated - Needs Essential Data             │
├─────────────────────────────────────────────────────────────────────┤
│  /onboarding/setup   → EssentialDataPage (7 steps)                  │
│  *                   → Redirects to /onboarding/setup               │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                    ▼ (After Essential Data)
┌─────────────────────────────────────────────────────────────────────┐
│                    Authenticated - Optional Extended Data           │
├─────────────────────────────────────────────────────────────────────┤
│  /onboarding/extended → ExtendedDataPage (Interest Carousel only)   │
│  *                   → Redirects to /onboarding/extended           │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                    ▼ (After Extended Data)
┌─────────────────────────────────────────────────────────────────────┐
│                    Authenticated - Profile Review                   │
├─────────────────────────────────────────────────────────────────────┤
│  /onboarding/review  → FinalProfileReviewPage                       │
│  *                   → Redirects to /onboarding/review             │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                    ▼ (hasSeenProfileReview = true)
┌─────────────────────────────────────────────────────────────────────┐
│                         FULL ACCESS                                 │
├─────────────────────────────────────────────────────────────────────┤
│  /discover           → Event recommendations                        │
│  /events             → My events                                    │
│  /connections        → Post-event connections hub                   │
│  /profile            → Profile & settings                           │
│  See "Main App Routes" section below                                │
└─────────────────────────────────────────────────────────────────────┘
```

### Key Changes (2026-02-04)

1. **Signup Timing:** Now AFTER personality test (was before)
2. **Anonymous Testing:** Test results stored locally until login
3. **WeChat Authentication:** Silent login with test result linking via `POST /api/auth/wechat/login-with-test`
4. **Simplified Extended Data:** Only Interest Carousel (removed 5 deprecated fields)
5. **Value-First Approach:** Users see their archetype before committing to signup
6. **Profile Review Step:** New `/onboarding/review` (`FinalProfileReviewPage`) inserted between Extended Data and Discover; gated by `hasSeenProfileReview` (server-persisted); marked complete via `POST /api/profile-review/complete`
7. **Guide Deprecated (2026-02-16):** `/guide` page removed from active onboarding; `hasSeenGuide` retained for backward compat

### Deprecated Fields

The following fields are **NO LONGER** collected in onboarding (2026-02-04):
- ❌ `languagesComfort` - Moved to profile edit only
- ❌ `activityTimePreference` - Removed entirely
- ❌ `socialFrequency` - Removed entirely  
- ❌ `groupSizeComfort` - Removed entirely
- ❌ `hometownCountry` - Removed entirely

These are commented out in schema but kept for backward compatibility.

### Main App Routes (Fully Authenticated)

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | DiscoverPage | Home - event pool discovery |
| `/discover` | DiscoverPage | Same as home |
| `/events` | EventsPage | My events (pending/matched/completed tabs) |
| `/connections` | ConnectionsPage | Post-event connections hub (legacy alias: `/chats`) |
| `/connections/:eventId` | EventCoordinationPage | Event coordination space (legacy alias: `/chats/:eventId`) |
| `/profile` | ProfilePage | User profile |
| `/rewards` | RewardsPage | XP, levels, coupons |
| `/invite` | InvitePage | Invite friends |

### Event Flow Routes

| Route | Component | Description |
|-------|-----------|-------------|
| `/event-pool/:id/register` | EventPoolRegistrationPage | Register for blind box event |
| `/pool-groups/:groupId` | PoolGroupDetailPage | View matched group details |
| `/blind-box-events/:eventId` | BlindBoxEventDetailPage | Event details |
| `/blindbox/payment` | BlindBoxPaymentPage | Payment flow |
| `/blindbox/confirmation` | BlindBoxConfirmationPage | Payment confirmation |
| `/events/:eventId/feedback` | EventFeedbackFlow | Post-event feedback |
| `/events/:eventId/deep-feedback` | DeepFeedbackFlow | Anonymous deep feedback |
| `/icebreaker/:sessionId` | IcebreakerSessionPage | Social Icebreaker — **PRIMARY in-event icebreaking flow (use this)** |
| `/icebreaker-recap/:sessionId` | SocialIcebreakerRecapPage | Social icebreaker recap/summary |
| `/icebreaker-game` | IcebreakerGamePage | AI card game — **supporting deep-dive layer** (not the primary flow) |

### Profile Edit Routes

| Route | Component | Description |
|-------|-----------|-------------|
| `/profile/edit` | EditProfilePage | Profile edit hub |
| `/profile/edit/basic` | EditBasicInfoPage | Name, avatar |
| `/profile/edit/education` | EditEducationPage | Education info |
| `/profile/edit/work` | EditWorkPage | Work info |
| `/profile/edit/personal` | EditPersonalPage | Personal details |
| `/profile/edit/intent` | EditIntentPage | Social intentions |
| `/profile/edit/interests` | EditInterestsPage | Interests/hobbies |
| `/profile/edit/social` | EditSocialPage | Social preferences |

### Admin Routes

| Route | Component | Description |
|-------|-----------|-------------|
| `/admin` | AdminDashboard | Admin home |
| `/admin/users` | AdminUsersPage | User management |
| `/admin/event-pools` | AdminEventPoolsPage | Create/manage event pools |
| `/admin/events` | AdminEventsPage | Event management |
| `/admin/matching` | AdminMatchingLabPage | Real-time matching lab |
| `/admin/matching-config` | AdminMatchingConfigPage | Threshold tuning |
| `/admin/matching-logs` | AdminMatchingLogsPage | Match history |
| `/admin/feedback` | AdminFeedbackPage | User feedback |
| `/admin/subscriptions` | AdminSubscriptionsPage | Subscription management |
| `/admin/coupons` | AdminCouponsPage | Coupon management |
| `/admin/venues` | AdminVenuesPage | Venue partners |
| `/admin/evolution` | AdminEvolutionPage | AI evolution dashboard |
| `/admin/accounts` | AdminAccountsPage | Admin account management (super_admin only) |

### Admin Authentication

Admin portal login uses **username/password** credentials stored in the `admin_accounts` table.

**Login endpoint:** `POST /api/admin/login` – accepts `{ username, password }`

**Roles:**
| Role | Access |
|------|--------|
| `super_admin` | Full access including admin account management |
| `operator` | General admin operations; cannot manage admin accounts |
| `viewer` | Read-only access to dashboards and reports |

**Creating the first admin account (CLI):**
```bash
# Set ADMIN_CREATE_SECRET_KEY in .env first
npm run admin:create <username> <password> <secretKey> [role] [displayName]

# Examples:
npm run admin:create admin MySecretPass99 BYPASSSECRET12345678
npm run admin:create ops_user OpPass99 BYPASSSECRET12345678 operator "运营小王"
```

> **Transitional note:** Existing admins with `users.isAdmin = true` (phone-based) still work via the `/api/auth/admin-login` fallback. Migrate them by creating a new `admin_accounts` entry using the CLI.

---

### In-Event Icebreaker — Primary Flow

The PRIMARY icebreaking experience for matched groups is the **Social Icebreaker**:
- Route: `/icebreaker/:sessionId`
- Component: `IcebreakerSessionPage`
- Hook: `useSocialIcebreaker`
- Phases: warmup → micro_challenge → lie_detective → recap
- Full reference: `docs/icebreaker-system.md`

Do NOT direct users to `/icebreaker-game` (AI Card Game) as the first/default experience.
The Card Game is an optional deep-dive accessible from within the Social Icebreaker.

The IcebreakerToolkit (pre-event game browser) is a LEGACY tool. Do not add new Toolkit CTAs.

---

## Matching-State UI Architecture

> **Guardrail:** Full-screen matching-status pages must use the shared `MatchingStateLayout` abstraction. Do not create bespoke dark-background layouts for new screen-level matching states.

### Shared Layout — `MatchingStateLayout`

**File:** `apps/user-client/src/components/matching/MatchingStateLayout.tsx`

Provides:
- Canonical dark background from `apps/user-client/src/assets/matching/shared/matching-bg.svg`
- Safe-area header (optional back button + title)
- Composition slots: `hero`, `copy`, `cta`, `footer`

```tsx
<MatchingStateLayout
  hero={<img src={heroSvg} />}
  copy={<StatusCopy />}
  cta={<ActionButtons />}
/>
```

#### Full-Screen Matching-State Screens *(must use `MatchingStateLayout`)*

| Component | Screen state | File |
|-----------|-------------|------|
| `MatchingWaitingScreen` | Blind-pool waiting (fill states: waiting / can_form / full) | `components/MatchingWaitingScreen.tsx` |
| `NoMatchScreen` | No match found | `components/matching/NoMatchScreen.tsx` |

#### Join-Sheet Interstitial Screens *(used inside `JoinEventPoolSheet`, no direct `MatchingStateLayout`)*

| Component | Screen state | File |
|-----------|-------------|------|
| `JoinErrorScreen` | Join / registration error | `components/matching/JoinErrorScreen.tsx` |
| `ExtendedDataEmptyScreen` | Profile data insufficient | `components/matching/ExtendedDataEmptyScreen.tsx` |
| `TestIncompleteScreen` | Personality test not done | `components/matching/TestIncompleteScreen.tsx` |

#### Post-Match Reveal Components

| Component | Role | File |
|-----------|------|------|
| `SurpriseMatchReveal` | Cinematic reveal overlay | `components/matching/SurpriseMatchReveal.tsx` |
| `MatchPointsDisplay` | Match points renderer | `components/matching/MatchPointsDisplay.tsx` |

### Key Rules

1. **State must be trigger-driven.** `MatchingStatusPage.tsx` maps real app state (registration status, fill count, WebSocket events) to the correct screen. No placeholder timers or mocked transitions.
2. **Recovery must be correct.** A user returning to the matching-status page after a forced refresh should land in the right state.
3. **For full-screen matching-status screens, never duplicate `matching-bg.svg`.** Import the shared background only via `MatchingStateLayout`. Join-sheet interstitials inherit their presentation context from `JoinEventPoolSheet` and should not wrap themselves in `MatchingStateLayout`.
4. **Asset locations:** `apps/user-client/src/assets/matching/{shared,waiting,no-match,join-error,extended-data-empty,test-incomplete}/`

Full reference: `docs/ui-matching-reveal-improvements.md`, `docs/matching-reveal-implementation-summary.md`

---

## Post-Profile-Review Limited Browse Mode *(Scoped Experiment)*

After `FinalProfileReviewPage`, a secondary CTA "先浏览 →" lets users enter read-only event discovery (Discover page) before committing to pool registration.

- Controlled by `ENABLE_LIMITED_BROWSE_MODE` constant in `FinalProfileReviewPage.tsx` (currently `true`)
- Per-session opt-out via `?exp=no_limited_browse`; per-session opt-in via `?exp=limited_browse`
- Session flag set by `enterLimitedBrowseMode()` from `LimitedBrowseBanner`
- **Do not generalise** this pattern or add permanent browse-mode routing without confirming the experiment is complete and the gating logic has been reviewed

---

## Performance Guardrails

> Full reference: `docs/perf.md`

| Guardrail | Rule |
|-----------|------|
| Non-critical routes | **Must** use `React.lazy()` in `App.tsx` — no static imports for non-critical pages |
| Admin code | Must **not** be imported into `apps/user-client` — keep admin-only code in `apps/admin-client` |
| Matching background | Reuse `matching/shared/matching-bg.svg` via `MatchingStateLayout` — never duplicate |
| Hero images | Prefer WebP + `decoding="async"` over PNG for hero/above-fold images |
| Archetype assets | Defer/gate — do not preload all 12 archetype PNGs in the critical path |
| Asset prefetching | Gate on real activity state — do not prefetch for no-activity users |

---

### Overview

JoyJoin uses 12 unique Chinese social archetypes based on the ACOEXP 6-trait model:

| Trait | Chinese | Description | Range |
|-------|---------|-------------|-------|
| A | 亲和力 (Affinity) | Warmth, cooperation, trust | 0-100 |
| C | 责任心 (Conscientiousness) | Organization, reliability | 0-100 |
| O | 开放性 (Openness) | Creativity, curiosity | 0-100 |
| E | 情绪稳定 (Emotional Stability) | Calm under pressure | 0-100 |
| X | 外向性 (Extraversion) | Social energy, talkative | 0-100 |
| P | 积极性 (Positivity) | Optimism, enthusiasm | 0-100 |

### The 12 Archetypes

| Archetype | Nickname | Key Traits | Energy |
|-----------|----------|------------|--------|
| **开心柯基** | 摇尾点火官 | X:95, P:85 | 95 (Very High) |
| **太阳鸡** | 咯咯小太阳 | P:92, E:88 | 90 (Very High) |
| **夸夸豚** | 彩虹播撒机 | A:85, P:88 | 88 (High) |
| **机智狐** | 场域操控师 | O:82, X:75 | 78 (High) |
| **灵感章鱼** | 创意万花筒 | O:95, A:68 | 65 (Medium) |
| **暖心熊** | 温柔守护者 | A:92, E:85 | 55 (Medium) |
| **淡定海豚** | 和谐调频员 | E:90, A:75 | 52 (Medium) |
| **织网蛛** | 人脉编织机 | C:80, A:72 | 48 (Medium) |
| **沉思猫头鹰** | 智慧瞭望塔 | O:88, C:82 | 42 (Low) |
| **定心大象** | 沉稳压舱石 | E:92, C:85 | 38 (Low) |
| **隐身猫** | 安静观察者 | E:78, C:72 | 28 (Very Low) |
| **稳如龟** | 踏实推进器 | C:88, E:85 | 25 (Very Low) |

### Cohort Categories

Archetypes are grouped into cohorts for question targeting:

```typescript
type CohortType = 
  | 'creative_explorer'     // 灵感章鱼, 机智狐, 沉思猫头鹰 (high O)
  | 'quiet_anchor'          // 隐身猫, 稳如龟, 定心大象 (low X + high C)
  | 'social_catalyst'       // 开心柯基, 太阳鸡, 夸夸豚 (high X + high P)
  | 'steady_harmonizer'     // 暖心熊, 淡定海豚, 织网蛛 (high A + mid-high E)
  | 'reflective_stabilizer' // 沉思猫头鹰, 稳如龟 (high C + differentiated O/E)
  | 'universal';            // Works for all cohorts
```

### Key Files

| File | Purpose |
|------|---------|
| `packages/shared/src/personality/archetypeRegistry.ts` | Single source of truth for all archetype data |
| `packages/shared/src/personality/archetypeCompatibility.ts` | Chemistry matrix between archetypes |
| `apps/user-client/src/components/StyleSpectrum.tsx` | Archetype result visualization |
| `apps/user-client/src/components/TraitSpectrum.tsx` | Bipolar trait slider display |

---

## MatcherV2 Algorithm

### Overview

MatcherV2 is the personality matching algorithm that assigns users to archetypes based on their trait scores.

### Scoring Formula

```typescript
// Final score calculation (0-100 range)
finalScore = (
  baseScore * 0.35 +           // Euclidean distance to archetype profile
  bonusPoints * 0.25 +         // Bonus for matching key traits
  vetoAdjustment * 0.20 +      // Penalty for mismatched traits
  disambiguationBonus * 0.20   // Bonus for confusable pair differentiation
);
```

### VETO System

Critical trait thresholds that can disqualify an archetype:

```typescript
// Example VETO rules for 暖心熊
"暖心熊": (traits) => {
  if (traits.A < 65) return { vetoed: true, reason: "A<65: 亲和力过低" };
  if (traits.X > 75) return { vetoed: true, reason: "X>75: 外向性过高" };
  return { vetoed: false };
}
```

### Disambiguation Rules

Handle confusable archetype pairs:

```typescript
const DISAMBIGUATION_RULES = [
  {
    trueArchetype: "沉思猫头鹰",
    rivalArchetype: "稳如龟",
    condition: (t) => t.O >= 70,  // High openness → Owl
    bonusMultiplier: 1.15
  },
  // ... more rules
];
```

### Key Files

| File | Purpose |
|------|---------|
| `packages/shared/src/personality/matcherV2.ts` | Main matching algorithm |
| `packages/shared/src/personality/prototypes.ts` | Archetype trait profiles |
| `packages/shared/src/personality/traitCorrection.ts` | Score calibration |

---

## V4 Adaptive Personality Assessment

> **Note**: V4 is the current and only supported personality assessment flow for user-client.
> V2 has been deprecated and removed from user-client. Admin-client retains V2 for legacy purposes only.

### Overview

The V4 assessment dynamically selects 8-16 questions based on real-time confidence levels.

### Question Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  Phase 1: Anchor Questions (Q1-Q8)                              │
│  - Core trait coverage                                           │
│  - Establish baseline scores                                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Phase 2: Adaptive Questions (Q9-Q12+)                          │
│  - Based on current archetype predictions                        │
│  - Target confusable pairs                                       │
│  - Stop when confidence threshold reached                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Phase 3: Differentiation Questions (if needed)                 │
│  - Forced-choice tradeoff questions                              │
│  - Target top confusion pairs                                    │
│  - Maximum 16 questions total                                    │
└─────────────────────────────────────────────────────────────────┘
```

### Assessment Configuration

```typescript
const DEFAULT_ASSESSMENT_CONFIG = {
  minQuestions: 10,
  softMaxQuestions: 12,
  hardMaxQuestions: 16,
  defaultConfidenceThreshold: 0.65,
  confusablePairThreshold: 0.70,
  anchorQuestionCount: 8,
  useV2Matcher: true,  // Use MatcherV2 algorithm
};
```

### Question Types

| Type | Count | Purpose |
|------|-------|---------|
| Anchor (L1) | 15 | Core trait measurement with high discrimination |
| Adaptive (L2) | 30 | Target weak confidence areas dynamically |
| Disambiguation (L3) | 15 | Target specific archetype confusion pairs |
| Total Bank | 60 | V4 adaptive selection (8-16 asked per session) |

### Key Files

| File | Purpose |
|------|---------|
| `packages/shared/src/personality/archetypeNames.ts` | Canonical 12-archetype ordering |
| `packages/shared/src/personality/questionsV4.ts` | 60-question bank with trait vectors |
| `packages/shared/src/personality/adaptiveEngine.ts` | Question selection & confidence tracking |
| `packages/shared/src/personality/matcherV2.ts` | V2 weighted Manhattan distance matcher with asymmetric penalties and VETO filters |
| `packages/shared/src/personality/prototypes.ts` | 12 archetype trait profiles |
| `packages/shared/src/personality/types.ts` | Type definitions (TraitKey, ArchetypeMatch, etc.) |
| `apps/user-client/src/pages/PersonalityTestPageV4.tsx` | Adaptive test UI |
| `apps/user-client/src/pages/PersonalityTestResultPage.tsx` | Results display |

### V2 Matcher Algorithm

**Core Formula:**
```typescript
// 1. Z-score normalization for all traits
userZ = (userScore - 50) / 15  // μ=50, σ=15

// 2. Weighted Manhattan distance
distance = Σ |userZ[trait] - prototypeZ[trait]| × weight[trait]

// 3. Soul trait weights
primary_traits: 1.6-1.8    // Core defining traits
secondary_traits: 1.2-1.3  // Supporting traits
avoid_traits: 0.4-0.8      // Traits to minimize

// 4. Asymmetric penalty for avoid traits
if (user[trait] > prototype[trait] && trait in avoid_traits):
  penalty = λ × (gap - threshold)²  // λ=2.0, threshold=0.5σ

// 5. VETO filters (disqualify extreme mismatches)
// Example: User with X=95 → cannot be 隐身猫 (X=20)

// 6. Gaussian similarity conversion
similarity = exp(-distance² / (2σ²))  // σ=1.2
```

**Trait Scoring Formula:**
```typescript
// Each question option has trait score vector
// Example: { A: 0, C: 2, E: 1, O: 0, X: -1, P: 0 }

// Cumulative scoring across 8-16 questions
finalScore[trait] = rawScore[trait] × normalizationFactor
// Normalized to 0-100 scale for display
```

---

## Key UI Components

### StyleSpectrum

Displays archetype results with orbital visualization.

```typescript
interface StyleSpectrumProps {
  primary: string;                    // Primary archetype name
  adjacentStyles: Array<{
    archetype: string;
    score: number;
  }>;
  spectrumPosition: number;           // 0-100 position on spectrum
  isDecisive?: boolean;               // High confidence match
  traitScores?: TraitScores;          // ACOEXP scores
  uniqueTraits?: string[];            // Archetype-specific traits
  epicDescription?: string;           // Long narrative description
  styleQuote?: string;                // Archetype quote
  counterIntuitiveInsight?: {         // Hidden insight
    text: string;
    rarityPercentage: number;
  };
}
```

**Location:** `apps/user-client/src/components/StyleSpectrum.tsx`

### TraitSpectrum

Bipolar trait slider visualization with animated dots.

```typescript
interface TraitSpectrumProps {
  traitScores: {
    A?: number;  // Affinity
    O?: number;  // Openness
    C?: number;  // Conscientiousness
    E?: number;  // Emotional Stability
    X?: number;  // Extraversion
    P?: number;  // Positivity
  };
}
```

**Location:** `apps/user-client/src/components/TraitSpectrum.tsx`

### XiaoyueChatBubble

AI mascot guidance bubble with multiple poses.

```typescript
interface XiaoyueChatBubbleProps {
  content: string;           // Guidance content
  pose?: 'default' | 'thinking' | 'casual' | 'excited';
  isLoading?: boolean;       // Show loading state
  loadingText?: string;      // Loading message
  animate?: boolean;         // Enable animations
}
```

**Location:** `apps/user-client/src/components/XiaoyueChatBubble.tsx`

### Other Important Components

| Component | Purpose |
|-----------|---------|
| `BlindBoxEventCard.tsx` | Event pool discovery cards |
| `PoolRegistrationCard.tsx` | Registration status display |
| `ProfileSpotlight.tsx` | Tablemate profile drawer |
| `JoyOrbit.tsx` | Full-screen group member orbital |
| `ConversationTopicsCard.tsx` | AI-generated icebreaker prompts for in-event engagement |
| `MatchCelebrationOverlay.tsx` | Match reveal animation |

---

## Event Pool Matching System

### Two-Stage Model

```
Stage 1: Pool Registration
├── User discovers event pool on DiscoverPage
├── Submits soft preferences (budget, cuisine, social goals)
└── Status: "pending"

Stage 2: AI Matching
├── Scheduler scans pool periodically
├── Forms optimal groups based on chemistry
├── Assigns venue and time
└── Status: "matched"
```

### Matching Algorithm Formula

#### Pair Compatibility Score (6 Dimensions)

```typescript
// ✅ ACTIVE weights (poolMatchingService.ts)
pairScore =
  chemistry           × 0.28 +   // 性格化学反应 — archetype chemistry matrix
  interest            × 0.28 +   // 兴趣重叠度  — heat-weighted Jaccard (user_interests table)
  socialAffinity      × 0.20 +   // 社交同频度  — life stage + education affinity + hometown (opt-in)
  backgroundDiversity × 0.15 +   // 背景多样性  — industry + gender diversity
  preference          × 0.05 +   // 活动偏好    — event intent / bar preferences (light signal)
  language            × 0.04;    // 语言沟通    — common languages (light signal)
```

**Note — Language (4%):** 普通话覆盖率高，区分力有限，保留为轻量兼容信号。  
**Note — Preference (5%):** 目前酒吧/饭店场景分化有限，保留为轻量场景适配信号。

#### Social Affinity (社交同频度) — same-frequency signals
- **Life stage affinity** (`workMode` / `LIFE_STAGE_AFFINITY` matrix — asymmetric 7×7, averaged both directions)
- **Education affinity** (学历同频度 — ordinal-distance-based; same/nearby levels score higher, NOT a diversity reward)
- **Hometown affinity** (同乡亲和力 — only when both users opted in)

#### Background Diversity (背景多样性) — diversity signals
- **Industry diversity** (行业多样性 — different niche = higher score)
- **Gender diversity** (性别多样性 — different gender = higher score)
- Education is NOT included here; it is an affinity signal.

#### Matrix Distinction
- **Chemistry Matrix** (`archetypeChemistry.ts`): 12×12 archetype compatibility, scores 0–100
- **Life Stage Affinity Matrix** (`LIFE_STAGE_AFFINITY`, `poolMatchingService.ts`): 7×7 workMode affinity, asymmetric, averaged forward + reverse for pair score

#### Group Overall Score

```typescript
overallScore = 
  avgPairScore × 0.60 +      // Average pairwise compatibility
  groupDiversity × 0.25 +    // Group diversity (industries, genders, archetypes, life stages)
  energyBalance × 0.15;      // Communication/energy balance
```

> Note: The `energyBalance` dimension is also referred to as "沟通平衡" (communication balance) in product copy, as it measures social tempo rather than raw archetype energy.

> **Note:** There are two separate matrix concepts in the codebase:
> - **Archetype chemistry matrix** (`archetypeChemistry.ts`) — 12×12 personality compatibility
> - **Life stage affinity matrix** (`LIFE_STAGE_AFFINITY` in `poolMatchingService.ts`) — 7×7 asymmetric `workMode` / 人生阶段 compatibility, introduced PR #312

### Temperature Levels

```typescript
🔥 炽热 (Fire):   score ≥ 85  // Exceptional compatibility
🌡️ 温暖 (Warm):   score 70-84 // Strong compatibility
🌤️ 适宜 (Mild):   score 55-69 // Moderate compatibility
❄️ 冷淡 (Cold):   score < 55  // Low compatibility
```

### Key Files

| File | Purpose |
|------|---------|
| `apps/server/src/poolMatchingService.ts` | Group formation logic |
| `apps/server/src/poolRealtimeMatchingService.ts` | Auto-matching scheduler |
| `apps/server/src/archetypeChemistry.ts` | Chemistry calculations |
| `packages/shared/src/personality/archetypeCompatibility.ts` | Compatibility matrix |

---

## WebSocket Events

### Event Types

```typescript
// Actual WSEventType values (packages/shared/src/wsEvents.ts)
type WSEventType =
  | 'POOL_MATCHED'               // User matched to event group
  | 'EVENT_STATUS_CHANGED'       // Event status update
  | 'EVENT_THEME_TITLE_REVEALED' // Blind box theme revealed
  | 'POOL_REGISTRATION_ADDED'    // New pool registration
  | 'ATTENDANCE_STATUS_UPDATED'  // Attendee confirmed/late/absent
  | 'ICEBREAKER_PHASE_CHANGE'    // Icebreaker session phase
  | 'SOCIAL_PHASE_CHANGED'       // Social icebreaker phase
  // ... and all ICEBREAKER_*, KING_GAME_*, SOCIAL_* event subtypes
```

### POOL_MATCHED Payload

```typescript
interface PoolMatchedData {
  poolId: string;
  poolTitle: string;
  groupId: string;
  groupNumber: number;
  matchScore: number;
  memberCount: number;
  temperatureLevel: string;  // "🔥 炽热", "🌡️ 温暖", etc.
}
```

### Key Files

| File | Purpose |
|------|---------|
| `packages/shared/src/wsEvents.ts` | Event type definitions |
| `apps/server/src/wsService.ts` | WebSocket server |
| `apps/user-client/src/hooks/useWebSocket.ts` | Client hook |

---

## Database Schema

### Key Tables

| Table | Purpose |
|-------|---------|
| `users` | User profiles and authentication |
| `personalityTestResults` | Test scores and archetype |
| `eventPools` | Admin-created event pools |
| `eventPoolRegistrations` | User pool signups with preferences |
| `eventPoolGroups` | Matched groups |
| `events` | Confirmed events |
| `eventAttendees` | Event participants |
| `chatMessages` | Event coordination message records |
| `invitations` | Referral tracking |
| `userCoupons` | Discount coupons |
| `subscriptions` | Premium subscriptions |
| `matchingThresholds` | Per-pool matching config |
| `poolMatchingLogs` | Matching decision history |

### Schema Location

`packages/shared/src/schema.ts`

### Database Commands

```bash
npm run db:push        # Sync schema to database
npm run db:push --force # Force sync (destructive)
npm run db:studio      # Open Drizzle Studio GUI
```

---

## AI Services

### DeepSeek Integration

| Service | Purpose |
|---------|---------|
| `xiaoyueAnalysisService.ts` | Personality analysis |
| `matchExplanationService.ts` | Match explanations |
| `icebreakerAIService.ts` | Icebreaker prompt generation |
| `conversationTopicsService.ts` | Group engagement prompts |
| `eventThemeTitleGenerator.ts` | AI-powered event theme title generation for pool groups |

### Event Theme Title Generation Flow

1. **Pool Matching Completes** → `POOL_MATCHED` WebSocket event sent (fast)
2. **Async Generation** → `eventThemeTitleGenerator.ts` generates creative event theme title (1–3 s)
3. **Theme Title Revealed** → `EVENT_THEME_TITLE_REVEALED` WebSocket event sent
4. **Fallback Protection** → Template-based titles if AI fails/times out

**Configuration:**
- `ENABLE_EVENT_THEME_TITLE_GENERATION` - Enable/disable feature (default: true)
- `DEEPSEEK_TIMEOUT_MS` - AI request timeout (default: 5000ms)
- Content safety filtering blocks inappropriate content

### Rate Limiting

All AI endpoints are rate-limited and auth-gated to prevent abuse.

---

## Environment Variables

### Required Secrets

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | Express session encryption |
| `AMAP_API_KEY` | Gaode Maps API |
| `AMAP_SECURITY_KEY` | Gaode Maps security |
| `DEEPSEEK_API_KEY` | AI service (via integration) |

### Auto-Populated (via Replit)

| Variable | Purpose |
|----------|---------|
| `REPL_ID` | Replit instance ID |
| `REPLIT_DB_URL` | Replit KV store |

---

## Common Debugging Tips

### Frontend Issues

1. **Component not updating:** Check TanStack Query cache invalidation
2. **Route not working:** Verify auth state in `useAuth` hook
3. **Styles broken:** Check Tailwind class conflicts, dark mode variants

### Backend Issues

1. **API returning 401:** Check session middleware, auth state
2. **Database errors:** Run `npm run db:push --force` to sync schema
3. **WebSocket disconnects:** Check `wsService.ts` connection handling

### Personality System Issues

1. **Wrong archetype:** Check VETO thresholds in `matcherV2.ts`
2. **Scores too high/low:** Verify no double multiplication in scoring
3. **Missing adjacent styles:** Check `≥70%` threshold filter

### Matching Issues

1. **No matches formed:** Check `matchingThresholds` values
2. **Poor match quality:** Review `archetypeChemistry.ts` formulas
3. **Missing notifications:** Verify WebSocket `broadcastToUser` calls

---

## Code Conventions

### Standardized Button Component (required for all new UI)

> **Rule:** Always use the shared `<Button>` component for interactive buttons. Do **not** add raw `<button>` elements with ad-hoc styling.

```tsx
// ✅ Correct — uses the shared premium component
import { Button } from "@/components/ui/button";

<Button size="lg" fullWidth onClick={handleSubmit}>提交</Button>
<Button variant="secondary" onClick={onCancel}>取消</Button>
<Button variant="ghost" size="icon" aria-label="返回"><ChevronLeft /></Button>
<Button loading={mutation.isPending}>保存</Button>

// ❌ Avoid — ad-hoc gradient / radius overrides on Button
<Button className="bg-gradient-to-r from-violet-600 to-purple-600 rounded-2xl">…</Button>

// ❌ Avoid — raw button with hard-coded styles
<button className="px-4 py-2 bg-purple-600 rounded-lg text-white">…</button>
```

**Selectable option chips** (radio/checkbox-style lists) are an exception to the raw-button prohibition. Use the CSS tokens directly to stay aligned:
```tsx
<button
  className={`rounded-xl border-2 transition-all duration-150 px-4 py-3 text-sm
    ${selected
      ? '[background:var(--btn-primary-gradient)] text-primary-foreground border-primary font-semibold shadow-[var(--btn-shadow-primary)]'
      : 'border-border hover-elevate active-elevate-2'
    }`}
>…</button>
```

**Source of truth:** `packages/shared/src/ui/buttonVariants.ts`  
**Full design reference:** `docs/button-design.md`

### Import Aliases

```typescript
// User client
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import logo from "@assets/logo.png";

// Shared package
import { users, events } from "@shared/schema";
import { TraitKey } from "@shared/personality/types";
```

### API Patterns

```typescript
// TanStack Query - fetching
const { data, isLoading } = useQuery({
  queryKey: ['/api/users', userId],
});

// TanStack Query - mutations
const mutation = useMutation({
  mutationFn: (data) => apiRequest('/api/users', 'POST', data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['/api/users'] });
  },
});
```

### File Naming

- Components: `PascalCase.tsx` (e.g., `StyleSpectrum.tsx`)
- Pages: `PascalCasePage.tsx` (e.g., `ProfilePage.tsx`)
- Hooks: `use*.ts` (e.g., `useAuth.ts`)
- Services: `*Service.ts` (e.g., `poolMatchingService.ts`)

---

## Quick Links

| Resource | Location | Notes |
|----------|----------|-------|
| Product Canon & Active Terminology | `PRODUCT_REQUIREMENTS.md` § Product Canon | **Authoritative — always use this** |
| Active Flow Reference | `DEVELOPER_QUICK_REFERENCE.md` (this file) | **Primary dev reference** |
| Product Requirements | `PRODUCT_REQUIREMENTS.md` | Full PRD |
| Design Guidelines | `design_guidelines.md` | - |
| API Routes | `apps/server/src/routes.ts` | - |
| Database Schema | `packages/shared/src/schema.ts` | - |
| Archetype Data | `packages/shared/src/personality/archetypeRegistry.ts` | - |
| Changelog | `CHANGELOG_24H.md` | - |
| Supplementary (outdated sections) | `QUICK_REFERENCE.md` | ⚠️ Supplementary only — not authoritative |
| **Admin RBAC Matrix** | `docs/admin-rbac-matrix.md` | Admin endpoint → role requirements |
| **Admin Incident Runbook** | `docs/runbooks/admin-incident-handling.md` | Ops tasks, triage, daily checklist |
| **Internal Beta Launch Risks** | `docs/launch-risks.md` | MVP caveats + risk acceptance sign-off |

---

## Admin Portal Operational Readiness

### Running the RBAC Coverage Audit Test

The RBAC coverage test introspects the live Express route stack and asserts that every
`/api/admin/*` route (except the public login endpoint) is protected by the appropriate
middleware.

```bash
npm test -w @joyjoin/server -- src/__tests__/adminRbacCoverage.test.ts
```

Expected output: 5 tests passing. The snapshot test also prints the full route/middleware
table to the CI log for audit purposes.

### Audit Logging

Sensitive admin actions emit structured `[AdminAudit]` JSON lines to stdout:

```bash
grep '\[AdminAudit\]' <logfile>
```

The audit logger is at `apps/server/src/lib/adminAuditLogger.ts`. Instrumented actions:
- Admin login (`ADMIN_LOGIN`)
- Account create/update/password-reset (`ADMIN_ACCOUNT_CREATED`, `ADMIN_ACCOUNT_UPDATED`, `ADMIN_PASSWORD_RESET`)
- User ban/unban (`USER_BANNED`, `USER_UNBANNED`)
- Attendance override (`ATTENDANCE_OVERRIDE`)
- Payment refund (`PAYMENT_REFUND_INITIATED`)
- Points adjustment (`ADMIN_POINTS_ADJUSTED`)
