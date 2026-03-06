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
- List the technologies used in the project.

## Build Commands
- Provide the commands needed to build the project.

## Project Structure
- Describe the structure of the project, including key directories.

## Code Conventions
- Outline the coding standards and conventions followed in the project.

## Key Systems
- Detail the key systems in the application.

## CI/CD Pipeline
- Explain how the continuous integration and deployment processes are structured.

## Security Guidelines
- List the security measures and best practices to follow.

## Contribution Guidelines
- Provide guidelines for contributing to the project.

## Debugging Tips
- Offer tips for debugging issues within the application.

## Key Documentation
- Reference essential documentation related to the project.

### Onboarding Flow Architecture

**Overview:**
JoyJoin uses a 4-step guided onboarding flow with **server-driven progress tracking**.

#### Flow Sequence
```
Login → Personality Test V4 → Essential Data → Extended Data → Guide → Discover
```
> **Note:** `Discover` is the post-onboarding destination, not a formal step. The 4 active onboarding steps are listed in the table below.

#### Step Details

| Step | Route | Component | Required Fields | Completion Flag |
|------|-------|-----------|-----------------|-----------------|
| 1. Personality Test | `/personality-test` | `PersonalityTestPageV4` | Adaptive assessment | `hasCompletedPersonalityTest` |
| 2. Essential Data | `/onboarding/setup` | `EssentialDataPage` | Nickname, gender, city, etc. | `profileEssentialComplete` |
| 3. Extended Data | `/onboarding/extended` | `ExtendedDataPage` | Interests carousel | `hasCompletedInterestsCarousel` |
| 4. Guide | `/guide` | Guide components | 3-step tutorial | `hasSeenGuide` (server) |

#### Server-Driven Navigation (Scope B1)

**Use server-driven `nextStep` instead of client-side calculations:**

```typescript
const { nextStep } = useAuth(); 
// Returns: 'personality-test' | 'essential-data' | 
//          'extended-data' | 'profile-review' | 'guide' | 'discover'

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

The `/api/auth/user` endpoint now returns:

| Field | Type | Description |
|-------|------|-------------|
| `nextStep` | `string` | Server-calculated next route |
| `profileEssentialComplete` | `boolean` | Essential data complete |
| `profileExtendedComplete` | `boolean` | Extended data complete |
| `hasSeenGuide` | `boolean` | Guide viewed (server-persisted) |
| `hasSeenProfileReview` | `boolean` | Profile review viewed (server-persisted) |
| `activeAssessmentSessionId` | `string \| null` | Active V4 session ID |

#### Guide System (Scope B2)

The 3-step guide is now **server-persisted**:

1. **User Portrait**: Archetype badge, overview, match reasons
2. **Event Flow**: Explains pool → match → check-in → feedback
3. **Xiaoyue AI**: Introduces AI assistant, encourages profile completion

**Data Contract:**
- Server field: `user.hasSeenGuide` (persisted to database)
- Local storage: `joyjoin_guide_seen` (hint only, server state takes priority)
- API: `POST /api/guide/mark-seen` to mark as seen
- Trigger: After essential data completion
- User can skip at any time

#### Key Files
- `apps/user-client/src/hooks/useOnboardingProgress.ts` — Progress tracking
- `apps/user-client/src/hooks/useGuideFlow.ts` — Guide state management
- `apps/user-client/src/hooks/useAuth.ts` — Returns `nextStep` from server
- `docs/onboarding-flow.md` — Full flow documentation
- `apps/user-client/src/pages/PersonalityTestPageV4.tsx` — V4 adaptive assessment
- `apps/user-client/src/pages/EssentialDataPage.tsx` — 7-step essential data
- `apps/user-client/src/pages/ExtendedDataPage.tsx` — Interests carousel

## Onboarding Data Model

### User Table Onboarding Fields

**Progress Flags** (`users` table):
```typescript
hasCompletedPersonalityTest: boolean;  // V4 adaptive assessment complete
hasSeenGuide: boolean;                 // 3-step guide viewed (server-persisted)
hasCompletedInterestsCarousel: boolean; // Carousel-based interest selection
```

**Server-Calculated Navigation Fields** (returned by `/api/auth/user`):
```typescript
nextStep: string;  
// 'personality-test' | 'essential-data' | 
// 'extended-data' | 'guide' | 'discover'

profileEssentialComplete: boolean;  
// Server-validates: displayName, gender, currentCity present

profileExtendedComplete: boolean;   
// Server-validates: interests, intent filled

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
1. User takes V4 personality test
   ├─> Create assessment_session (phase: 'post_signup')
   ├─> For each answer: insert assessment_answer
   ├─> Update assessment_session.traitScores (real-time)
   └─> On completion: hasCompletedPersonalityTest = true

2. User completes essential data
   ├─> Update users (displayName, gender, currentCity)
   └─> Server sets profileEssentialComplete = true

3. User completes interests carousel
   ├─> Insert/Update user_interests
   └─> hasCompletedInterestsCarousel = true

4. User views guide
   ├─> POST /api/guide/mark-seen
   └─> hasSeenGuide = true

5. Server calculates nextStep
   └─> Return 'discover' when all flags true
```

### Migration Notes

- **AI Chat Registration Removed**: `DuolingoOnboardingPage` and the `/onboarding` route are deprecated. The onboarding flow now begins directly at the V4 Personality Test.
- **`hasCompletedRegistration` Deprecated**: This flag is no longer part of the active flow. Do not gate new features on it.
- **V2 Test Deprecated**: Old `personality_questions`, `test_responses`, `role_results` tables are legacy (kept for historical data, not used in new code).
- **Interest Fields Removed**: `interestsTop`, `primaryInterests`, `topicsHappy`, `topicsAvoid` moved to `user_interests` table (old fields deprecated but not dropped).
- **Language Selection**: No longer collected in onboarding (moved to event pool registration).
- **Guide State**: Now server-persisted in `hasSeenGuide` (replaces localStorage-only approach).

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
- Social Icebreaker established as the primary in-event flow (2026-03-06); IcebreakerToolkit demoted to legacy.
- AI Chat Registration (`DuolingoOnboardingPage`) removed from active onboarding flow; flow now starts at Personality Test V4.
- Interests carousel introduced for extended data collection.
- Guide step server-persisted via `hasSeenGuide` (replaces localStorage-only approach).
- Pool matching algorithm updated to 7-dimension weighted scoring.

**Note**: Ensure to follow the existing formatting style and professional tone throughout the document.