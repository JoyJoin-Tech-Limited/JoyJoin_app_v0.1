# JoyJoin Developer Quick Reference Guide

**Version:** 2.0  
**Last Updated:** January 2026  
**For:** Tech Team Onboarding & Codebase Navigation

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

### Authentication States

The app uses progressive authentication with 4 distinct states:

```typescript
// From useAuth hook
interface AuthState {
  isAuthenticated: boolean;      // Has valid session
  needsRegistration: boolean;    // Phone verified, no profile
  needsPersonalityTest: boolean; // Profile exists, no test results
  needsProfileSetup: boolean;    // Test done, profile incomplete
}
```

### Complete User Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         UNAUTHENTICATED                             │
├─────────────────────────────────────────────────────────────────────┤
│  /login              → LoginPage (SMS verification)                 │
│  /registration       → ChatRegistrationPage (AI chat onboarding)   │
│  /register           → ChatRegistrationPage                         │
│  /invite/:code       → InviteLandingRouter (public invite links)   │
│  /icebreaker-demo    → IcebreakerDemoPage (public demo)            │
│  /admin/login        → AdminLoginPage                               │
│  *                   → Redirects to LoginPage                       │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼ (After SMS verification)
┌─────────────────────────────────────────────────────────────────────┐
│                      needsRegistration = true                       │
├─────────────────────────────────────────────────────────────────────┤
│  /onboarding         → DuolingoOnboardingPage (9-screen flow)      │
│  /personality-test   → PersonalityTestPageV4                        │
│  /personality-test/complete → PersonalityTestResultPage             │
│  *                   → Redirects to /onboarding                     │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼ (After onboarding complete)
┌─────────────────────────────────────────────────────────────────────┐
│                    needsPersonalityTest = true                      │
├─────────────────────────────────────────────────────────────────────┤
│  /personality-test   → PersonalityTestPageV4 (V4 adaptive)          │
│  /personality-test/complete → PersonalityTestResultPage             │
│  *                   → Redirects to /personality-test               │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼ (After test complete)
┌─────────────────────────────────────────────────────────────────────┐
│                     needsProfileSetup = true                        │
├─────────────────────────────────────────────────────────────────────┤
│  /onboarding/setup   → EssentialDataPage (name, gender, etc.)      │
│  /onboarding/extended → ExtendedDataPage (work, education)         │
│  /personality-test/results → PersonalityTestResultPage (viewable)  │
│  *                   → Redirects to /onboarding/setup               │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼ (After profile complete)
┌─────────────────────────────────────────────────────────────────────┐
│                      FULLY AUTHENTICATED                            │
├─────────────────────────────────────────────────────────────────────┤
│  See "Main App Routes" section below                                │
└─────────────────────────────────────────────────────────────────────┘
```

### Main App Routes (Fully Authenticated)

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | DiscoverPage | Home - event pool discovery |
| `/discover` | DiscoverPage | Same as home |
| `/events` | EventsPage | My events (pending/matched/completed tabs) |
| `/chats` | ChatsPage | Chat list |
| `/chats/:eventId` | EventChatDetailPage | Group chat |
| `/direct-chat/:threadId` | DirectChatPage | 1-on-1 chat |
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
| `/icebreaker/:sessionId` | IcebreakerSessionPage | Icebreaker games |

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

---

## 12-Archetype Animal Social Vibe System

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
| Anchor | 8 | Core trait measurement |
| Adaptive | Variable | Target weak confidence areas |
| Forced-Choice | 6 | Tradeoff between competing traits |
| Differentiation | 16 | Target specific archetype confusion pairs |
| Attention Check | 2 | Validity verification |

### Key Files

| File | Purpose |
|------|---------|
| `packages/shared/src/personality/questionsV4.ts` | 130+ question bank |
| `packages/shared/src/personality/adaptiveEngine.ts` | Question selection logic |
| `packages/shared/src/personality/types.ts` | Type definitions |
| `apps/user-client/src/pages/PersonalityTestPageV4.tsx` | Test UI |
| `apps/user-client/src/pages/PersonalityTestResultPage.tsx` | Results display |

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

AI mascot chat bubble with multiple poses.

```typescript
interface XiaoyueChatBubbleProps {
  content: string;           // Message content
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
| `ConversationTopicsCard.tsx` | AI-generated icebreakers |
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

```typescript
overallScore = 
  avgPairScore × 0.60 +      // Average pairwise compatibility
  groupDiversity × 0.25 +    // Archetype diversity bonus
  energyBalance × 0.15;      // Energy level balance
```

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
type WebSocketEventType = 
  | 'POOL_MATCHED'           // User matched to group
  | 'EVENT_STATUS_CHANGED'   // Event status update
  | 'NEW_MESSAGE'            // Chat message received
  | 'TYPING_INDICATOR'       // User typing in chat
  | 'PAYMENT_STATUS';        // Payment confirmation
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
| `chatMessages` | Group and direct messages |
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
| `icebreakerAIService.ts` | Conversation topics |
| `conversationTopicsService.ts` | Group icebreakers |

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

| Resource | Location |
|----------|----------|
| Product Requirements | `PRODUCT_REQUIREMENTS.md` |
| Design Guidelines | `design_guidelines.md` |
| API Routes | `apps/server/src/routes.ts` |
| Database Schema | `packages/shared/src/schema.ts` |
| Archetype Data | `packages/shared/src/personality/archetypeRegistry.ts` |
| Changelog | `CHANGELOG_24H.md` |
