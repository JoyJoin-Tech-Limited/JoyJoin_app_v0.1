# JoyJoin User Onboarding Flow

## Overview (Updated 2026-02-04)

JoyJoin uses a **value-first** onboarding approach:
1. **Show value (personality test) BEFORE asking for signup**
2. Silent WeChat authentication after user is invested
3. Minimal data collection in onboarding
4. Progressive profile enrichment

---

## Complete Flow

```
Landing → Personality Test (Anonymous) → Results → WeChat Login → 
Essential Data → Extended Data → Guide (3 steps) → Discover Page
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

**Required Fields (7 steps):**
1. Display Name
2. Gender + Birth Year
3. Relationship Status
4. Education Level
5. Industry (3-tier) + Occupation + Work Mode
6. Hometown + Current City
7. Intent (multi-select)

**After Completion:**
- `profileEssentialComplete = true`
- Redirect to `/onboarding/extended` or `/guide`

---

### Step 4: Extended Data Collection (Optional)

**Route:** `/onboarding/extended`

**User State:** Can skip entirely

**What's Collected:**
- **ONLY Interest Carousel**
  - 56 topics across 8 categories
  - Multi-tap heat level (0/5/15/25)
  - Includes topic avoidances

**After Completion/Skip:**
- `hasCompletedExtendedData = true`
- Redirect to `/guide`

---

### Step 5: Guide (3 Steps)

**Route:** `/guide`

**User State:** Ready to discover events

**Content:**
1. **User Portrait**: Archetype badge, overview, match reasons
2. **Event Flow**: Explains pool → match → check-in → feedback
3. **Xiaoyue AI**: Introduces AI assistant, encourages profile completion

**Data Contract:**
- Server field: `user.hasSeenGuide` (persisted to database)
- Local storage: `joyjoin_guide_seen` (hint only, server state takes priority)
- API: `POST /api/guide/mark-seen` to mark as seen

**User can skip at any time**

---

### Step 6: Discover Page

**Route:** `/` or `/discover`

**User State:** Onboarding complete

---

## Server-Driven Navigation (Scope B1)

> **New Addition**: `/api/auth/user` now returns server-calculated navigation state.

### Response Fields

| Field | Type | Description |
|------|------|-------------|
| `nextStep` | `string` | Server-calculated next route: `onboarding`, `personality-test`, `essential-data`, `extended-data`, `profile-review`, `guide`, `discover` |
| `profileEssentialComplete` | `boolean` | Essential data complete (displayName, gender, currentCity) |
| `profileExtendedComplete` | `boolean` | Extended data complete (interests) |
| `hasSeenGuide` | `boolean` | Guide viewed (server-persisted) |
| `hasSeenProfileReview` | `boolean` | Profile review viewed (server-persisted) |
| `activeAssessmentSessionId` | `string \| null` | Active V4 session ID |

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
- `hasCompletedExtendedData`: Set after interest carousel (or skip)

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
