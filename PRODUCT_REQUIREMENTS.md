# JoyJoin (悦聚·Joy) - Product Requirements Document

**Version:** 1.2  
**Last Updated:** March 6, 2026  
**Platform:** WeChat H5 Mini-App  
**Target Market:** Hong Kong & Shenzhen  

---

## 📋 Table of Contents

1. [Executive Summary](#executive-summary)
2. [Product Vision](#product-vision)
3. [User App Features](#user-app-features)
4. [Admin Portal Features](#admin-portal-features)
5. [Technical Architecture](#technical-architecture)
6. [Data Models](#data-models)
7. [API Reference](#api-reference)
8. [Implementation Status](#implementation-status)

---

## 🆕 Recent Updates (Nov 18-20, 2025)

### Major Feature Releases

**1. Temperature Concept System** 🌡️
- Dual-temperature visualization: Social Energy (社交能量) + Chemistry Reaction (化学反应温度)
- 14 archetypes mapped to 0-100 energy scale
- Visual emoji indicators: 🔥 炽热 (≥85) | 🌡️ 温暖 (70-84) | 🌤️ 适宜 (55-69) | ❄️ 冷淡 (<55)
- Prevents unbalanced groups (all high-energy or all low-energy)

**2. Matching Algorithm Fix** 🔧
- Corrected critical diversity double-counting bug
- Updated scoring formula: **60% pair compatibility + 25% diversity + 15% energy balance**
- Clarified pair score components: chemistry (37.5%) + interest (31.25%) + preference (25%) + language (18.75%)

**3. Real-time Dynamic Matching System** ⚡
- Three-tier threshold system with time decay algorithm
- Automated continuous matching (instant + hourly + final 24h scans)
- Admin configuration UI and decision history logs
- Database-driven parameters (no code changes needed for tuning)

**4. Invitation & Viral Growth System** 🎁
- Auto-issue ¥50 INVITE_REWARD coupon when invited users match together
- Invitation badges: Purple "已邀请" for inviters, Blue "[name] 邀请的" for invitees
- Database tracking: `user_coupons` and `invitation_uses` tables

**5. Event Pool User Flow** 🎭
- Complete two-stage matching model UI
- User registration with soft preferences (budget, cuisine, social goals, dietary restrictions)
- Pool registration status display in EventsPage
- New components: `EventPoolRegistrationPage`, `PoolRegistrationCard`

**6. WebSocket Real-time Notifications** 🔔
- POOL_MATCHED event with instant user notifications
- Toast notifications with temperature emoji and match details
- Auto-cache invalidation and tab switching on match
- Complete bidirectional sync: Admin → Backend → Users

**7. Event Pool Discovery Fix** 🔍
- Fixed `/api/event-pools` endpoint to display admin-created blind box events
- Unified status to `active` (replaced `published`/`recruiting`)
- Schema synchronized across all required fields

---

## 🎯 Executive Summary

JoyJoin is an AI-powered social networking platform that connects individuals locally through small, curated micro-events (5-10 attendees). The platform uses sophisticated personality-based matching algorithms to create meaningful connections while emphasizing psychological safety and inclusivity.

### Key Value Propositions

- **AI-Driven Matching:** 14 personality archetypes with 5-dimensional compatibility scoring
- **Micro-Event Format:** Small group sizes (5-10 people) for meaningful interactions
- **Blind Box Experience:** Gamified event discovery with surprise reveals
- **In-Event Social Experience:** Social Icebreaker multi-phase group facilitation (热身 → 挑战 → 侦探 → 回顾) as the core in-event engagement tool
- **Data-Driven Insights:** Comprehensive feedback system to refine matching algorithms
- **Subscription Model:** ¥98/month or ¥294/3-month with WeChat Pay integration

---

## 🌟 Product Vision

### Mission Statement
Foster meaningful local connections through AI-powered matching that understands personality, interests, and social compatibility.

### Target Users

**Primary Audience:**
- Urban professionals aged 22-35 in Hong Kong/Shenzhen
- Seeking authentic local friendships and social experiences
- Value quality over quantity in social interactions
- Comfortable with digital-first experiences

**User Personas:**

> **Note:** Persona archetypes updated to V4 system (2026-02-04)

1. **沉思猫头鹰 Lisa (Contemplative Owl)** - 28, Marketing Manager
   - Moved to Shenzhen 6 months ago
   - Wants to meet like-minded professionals
   - Values deep conversations over small talk

2. **开心柯基 David (Happy Corgi)** - 26, Startup Founder
   - Naturally outgoing, energizes groups
   - Looking to expand professional network
   - Enjoys facilitating connections

3. **暖心熊 Amy (Warm Bear)** - 30, HR Director
   - Observant and empathetic
   - Enjoys helping others meet
   - Values harmony and inclusion

---

## 📱 User App Features

### 1. User Onboarding & Registration

**File Location:** `client/src/pages/RegistrationPage.tsx`, `client/src/pages/ProfileSetupPage.tsx`

#### 1.1 Phone Authentication
- **Method:** SMS verification (6-digit code)
- **Session:** 7-day persistent login
- **Database:** PostgreSQL session store
- **Security:** Bcrypt password hashing

**User Journey:**
```
Landing Page → Phone Number Entry → SMS Code Verification → Profile Setup
```

**API Endpoints:**
- `POST /api/phone/register` - Send SMS code
- `POST /api/phone/verify` - Verify code and create session
- `POST /api/phone/login` - Existing user login

#### 1.2 Multi-Step Profile Setup

**Step 1: Basic Information**
- Full Name (Chinese/English)
- Gender (Male/Female/Non-binary/Prefer not to say)
- Birth Year (Age calculation)
- Location (Hong Kong/Shenzhen districts)

**Step 2: Interests & Topics** (`InterestsTopicsPage.tsx`)
- 40+ interest tags across 8 categories:
  - 🎨 Arts & Culture
  - 💼 Career & Business
  - 🏃 Sports & Fitness
  - 🎮 Entertainment
  - 🍜 Food & Dining
  - ✈️ Travel & Adventure
  - 📚 Learning & Growth
  - 💡 Lifestyle & Values

**Step 3: Personality Test** (See Section 1.3)

**Step 4: Optional Background**
- Education (school, degree, major)
- Work (company, role, industry)
- Personal description (bio)

---

### 1.3 Personality Test System ⭐

> **Note**: The user-client now uses V4 adaptive assessment (`PersonalityTestPageV4.tsx`). V2 has been deprecated.

**File Location:** `apps/user-client/src/pages/PersonalityTestPageV4.tsx`, `apps/user-client/src/pages/PersonalityTestResultPage.tsx`

#### Architecture Overview

**Last Updated:** 2026-02-04 (V4 System)

**12 Personality Archetypes** (Production):

1. 🐕 **开心柯基 (Happy Corgi)** - High energy socializer (X=95, P=85)
2. 🐓 **太阳鸡 (Sun Chicken)** - Optimistic motivator (P=92, X=78)
3. 🐬 **夸夸豚 (Praise Dolphin)** - Warmhearted encourager (A=95, X=82)
4. 🦊 **机智狐 (Clever Fox)** - Creative problem-solver (O=92, X=78)
5. 🐬 **淡定海豚 (Calm Dolphin)** - Balanced mediator (E=85, C=70)
6. 🕷️ **织网蛛 (Weaver Spider)** - Detail-oriented planner (C=85, E=65)
7. 🐻 **暖心熊 (Warm Bear)** - Empathetic supporter (A=90, E=80)
8. 🐙 **灵感章鱼 (Inspiration Octopus)** - Innovative ideator (O=95, P=70)
9. 🦉 **沉思猫头鹰 (Contemplative Owl)** - Analytical thinker (O=88, C=80)
10. 🐘 **定心大象 (Grounded Elephant)** - Stable anchor (C=90, E=86)
11. 🐢 **稳如龟 (Steady Turtle)** - Reliable introvert (E=85, C=80)
12. 🐱 **隐身猫 (Invisible Cat)** - Reserved observer (E=80, X=20)

*See `packages/shared/src/personality/archetypeNames.ts` for canonical source*

#### Test Structure - V4 Adaptive Assessment (8-16 Questions)

**Adaptive System:**
- 60-question bank divided into 3 levels (L1 Anchor, L2 Adaptive, L3 Disambiguation)
- V4 engine selects 8-16 questions based on real-time confidence tracking
- Stops when all trait confidences ≥ 0.7 OR 16 questions reached

**Question Flow:**
```
Phase 1: Ask 8 anchor questions (L1) → Establish baseline
Phase 2: Check confidences → If low, ask adaptive questions (L2)
Phase 3: Check confusion → If top-2 close, ask disambiguation (L3)
Phase 4: V2 Matcher → Calculate final archetype
```

**Example Adaptive Question:**
```
Q18: 周末计划被朋友邀请打断
A. 立刻调整计划加入 → { X: 4, P: 2, C: -1 }
B. 明确拒绝，坚守计划 → { E: 3, C: 2, X: -1 }
C. 尝试拉朋友进计划 → { A: 2, C: 1, E: 1 }
D. 纠结但最终参加 → { A: 1, X: 1, C: -2 }
```

#### Scoring Algorithm - V4 + V2 Matcher

**Backend Files:** 
- `packages/shared/src/personality/adaptiveEngine.ts`
- `packages/shared/src/personality/matcherV2.ts`

**Step 1: Real-time Trait Accumulation**
```typescript
// Each answer updates 6 trait scores (ACOEXP)
for each answer:
  traitScores.A += option.traitScores.A
  traitScores.C += option.traitScores.C
  traitScores.E += option.traitScores.E
  traitScores.O += option.traitScores.O
  traitScores.X += option.traitScores.X
  traitScores.P += option.traitScores.P
```

**Step 2: V2 Matcher Execution**
```typescript
// Weighted Manhattan distance with asymmetric penalties
userZ = (userTraits - 50) / 15  // Z-score normalization
for archetype in prototypes:
  distance = sum(|userZ - prototypeZ| × weight)
  penalty = asymmetricPenalty(avoidTraits)
  score = gaussian_kernel(distance + penalty)
return topArchetype with confidence score
```

**Step 3: Calculate 6-Dimensional Trait Scores**

Current archetype trait profiles (0-100 scale):

| Archetype | A | C | E | O | X | P |
|-----------|---|---|---|---|---|---|
| 开心柯基 | 60 | 50 | 60 | 65 | 95 | 85 |
| 太阳鸡 | 70 | 78 | 88 | 55 | 78 | 92 |
| 夸夸豚 | 95 | 50 | 65 | 62 | 82 | 88 |
| 机智狐 | 40 | 50 | 60 | 92 | 78 | 58 |
| 淡定海豚 | 70 | 70 | 85 | 65 | 65 | 68 |
| 织网蛛 | 70 | 85 | 65 | 70 | 60 | 60 |
| 暖心熊 | 90 | 65 | 80 | 60 | 48 | 70 |
| 灵感章鱼 | 50 | 28 | 55 | 95 | 52 | 70 |
| 沉思猫头鹰 | 45 | 80 | 75 | 88 | 40 | 50 |
| 定心大象 | 70 | 90 | 86 | 50 | 40 | 60 |
| 稳如龟 | 45 | 80 | 85 | 65 | 30 | 45 |
| 隐身猫 | 50 | 50 | 80 | 45 | 20 | 45 |

**Step 4: Generate Personalized Insights**

For each archetype, system provides:
- **Strengths:** Key capabilities and natural talents
- **Growth Areas:** Potential challenges and blind spots  
- **Compatible Archetypes:** Top 3 from chemistry matrix (see `archetypeChemistry.ts`)

*Note: Blending formula and subtypes removed in V4 - single decisive archetype match*

#### UI/UX Features

**Last Updated:** 2026-02-04 (Personality Test System V4)

**During Test:**
- ✨ **Progress Indicator:** Visual progress bar + question counter (1/8 to 1/16, adaptive)
- 📊 **Mini Radar Chart:** Real-time progress visualization showing 6 traits (ACOEXP)
- 🎉 **Milestone Animation:** Appears dynamically based on trait confidence levels
- 🎁 **Blind Box Reveal:** 3-second rotating gift box animation on submission
- 🔄 **Adaptive Flow:** Questions adjust based on confidence - may finish in 8-12 questions if decisive

**Results Page Components:**

1. **Hero Section (70vh)**
   - Gradient background (archetype-specific color)
   - Large emoji avatar (🐕 for 开心柯基, 🐓 for 太阳鸡, etc.)
   - Primary archetype name + description
   - Secondary archetype avatar (if match is not decisive)
   - Confidence indicator (🎯 Decisive Match if confidence ≥ 70%)

2. **Six-Dimensional Radar Chart (ACOEXP)**
   - Interactive Recharts visualization
   - 6 axes: 
     - **A** - Affinity/Agreeableness (亲和力)
     - **C** - Conscientiousness (责任心)
     - **O** - Openness (开放性)
     - **E** - Emotional Stability (情绪稳定)
     - **X** - Extraversion (外向性)
     - **P** - Positivity (积极性)
   - Normalized 0-100 scale for each trait
   - Archetype-specific strengths text
   - Challenges/growth areas
   - Compatible archetype badges (top 3 from chemistry matrix)

3. **Social Distribution Card**
   - "你在人群中的位置" (Your position in the crowd)
   - Percentage of users with same archetype (from 12-archetype distribution)
   - Top 4 archetype distribution preview
   - Energy level indicator (0-100 scale)

4. **Chemistry Matching Prediction**
   - Top 3 compatible archetypes based on chemistry matrix
   - Compatibility percentage (60-100 range)
   - Animated progress bars
   - V2 Matcher algorithm explanation
   - Match reason display (e.g., "High X+P synergy" for 开心柯基×太阳鸡)

5. **Action Buttons**
   - 📤 Share Results (Native Web Share API)
   - 🚀 Start Exploring Events
   - 🔄 Retake Test

**Data Storage:**
```sql
-- V4 Assessment Session (stored in assessment_sessions table)
INSERT INTO assessment_sessions (
  user_id,
  phase,
  current_question_index,
  trait_scores,  -- { A: 60, C: 50, E: 60, O: 65, X: 95, P: 85 }
  trait_confidences,  -- { A: { score: 60, confidence: 0.85, sampleCount: 8 }, ... }
  top_archetypes,  -- [{ archetype: '开心柯基', score: 85, confidence: 0.82 }, ...]
  algorithm_version,  -- 'v2'
  match_details_json,  -- V2 Matcher results with trait deltas
  primary_archetype,  -- '开心柯基'
  is_decisive,  -- true if confidence ≥ 0.7
  completed_at
) VALUES (...);

-- User profile update
UPDATE users SET
  primary_archetype = '开心柯基',
  has_completed_personality_test = true,
  -- Trait scores stored in assessment_sessions, not users table
  -- Old fields (primary_role, secondary_role) deprecated
WHERE id = user_id;
```

---

### 1.4 Event Discovery & Blind Box System

**File Location:** `client/src/pages/DiscoverPage.tsx`, `client/src/pages/BlindBoxEventDetailPage.tsx`

#### Event Types

**1. Blind Box Events (盲盒活动)** - Primary Focus
- **Mystery Format:** Title + theme revealed, attendees hidden
- **AI-Matched Groups:** 5-10 participants selected by algorithm
- **Tiered Reveal System:**
  - Before Payment: Event theme, venue, time
  - After Payment: 2-part match score (你们/气氛 + 你/个体)
  - 72h Before: Attendee preview cards with personality insights
  - Event Day: Full attendee list + chat access

**2. Regular Events (普通活动)**
- Traditional RSVP format
- Visible attendee list
- First-come-first-served

#### Blind Box Event Lifecycle

**Phase 1: Discovery (Matching Phase)**
```
Event Status: "matching"
User Sees: 
  - Event theme (e.g., "深夜食堂：街边美食探险")
  - Venue type (e.g., "尖沙咀特色茶餐厅")
  - Date & time
  - Price (¥98 members / ¥148 non-members)
  - "AI正在为你匹配最合适的伙伴..."
```

**Phase 2: Registration Open**
```
Event Status: "registration_open"
User Action: Click "立即加入盲盒" → Payment Page
```

**Phase 3: Post-Payment Reveal**
```
After Payment:
  1. Match Score Reveal (2-Part System):
     - 🎭 Group Chemistry (你们/气氛): 89%
       "根据性格互补性，预测整体氛围和谐度"
     - 💫 Personal Fit (你/个体): 92%
       "根据兴趣、背景、意图，预测你与他人的连接深度"
  
  2. StackedAttendeeCards Preview:
     - Attendee count: "5人已加入"
     - Stacked avatar placeholders
     - "72小时后解锁参与者预览"
```

**Phase 4: 72-Hour Pre-Event Window**
```
Event Status: "confirmed"
Unlocked Features:
  1. AttendeePreviewCard for each participant:
     - Emoji avatar + name
     - Primary archetype badge
     - Shared interests (top 3)
     - Match chemistry with you (e.g., "与你有 88% 化学反应")
  
  2. Group Summary:
     - Archetype distribution pie chart
     - "Meet Your Table" personality breakdown
     - Conversation topic suggestions
```

**Phase 5: Event Day**
```
Event Status: "in_progress" (day of event)
Full Access:
  - Event chat room enabled
  - Full attendee profiles visible
  - Venue address + map
  - Check-in functionality
  - In-Event Icebreaker: Social Icebreaker session available via `/icebreaker/:sessionId`
    — multi-phase group experience (热身 → 挑战 → 侦探 → 回顾)
```

**Phase 6: Post-Event**
```
Event Status: "completed"
User Actions:
  - Leave feedback (氛围温度计 + Connection Radar)
  - Optional deep feedback
  - Rate individual connections
```

#### Two-Part Match Scoring System

**Frontend Component:** `client/src/components/MatchScoreDisplay.tsx`

**Group Chemistry Score (群体化学反应):**
```typescript
Calculation:
  - Average compatibility across all N×(N-1) pairs
  - Weighted by personality chemistry matrix
  - Range: 70-95%
  
Visual:
  - 🎭 Icon
  - Circular progress indicator
  - "整体氛围和谐度" label
```

**Personal Fit Score (个人契合度):**
```typescript
Calculation:
  - User's average match with all other attendees
  - 5-dimensional scoring:
    * Personality (40%): Based on 14×14 chemistry matrix
    * Interests (25%): Jaccard similarity of interest tags
    * Background (15%): Education/career alignment
    * Conversation (10%): Openness + Extraversion scores
    * Intent (10%): Event participation motivation
  - Range: 75-98%

Visual:
  - 💫 Icon
  - Circular progress indicator
  - "你的个人契合度" label
```

#### AttendeePreviewCard Component

**File:** `client/src/components/AttendeePreviewCard.tsx`

```typescript
Display:
  - Avatar: Gradient circle + archetype emoji
  - Name: "张小明"
  - Archetype Badge: "🧭 探索者"
  - Bio Snippet: First 50 chars
  - Shared Interests: Top 3 overlapping tags
  - Chemistry Bar: "与你有 88% 化学反应"
  - Hover Effect: Expand to show full traits
```

---

### 1.5 Subscription & Payment System

**File Location:** `client/src/pages/BlindBoxPaymentPage.tsx`

#### Subscription Tiers

| Plan | Price | Duration | Benefits |
|------|-------|----------|----------|
| **月度会员** | ¥98 | 30 days | Unlimited blind box events, priority matching |
| **季度会员** | ¥294 | 90 days | 15% discount, exclusive quarterly events |
| **单次票** | ¥148 | Per event | No commitment, higher price |

#### Payment Integration - WeChat Pay

**Service File:** `server/paymentService.ts`

**Payment Flow:**
```
1. User selects subscription tier
   ↓
2. Frontend POST /api/payments/create
   {
     amount: 9800, // cents
     type: "subscription",
     subscriptionTier: "monthly"
   }
   ↓
3. Backend creates payment record (status: "pending")
   ↓
4. WeChat Pay JSAPI called
   {
     appId, timeStamp, nonceStr, package, signType, paySign
   }
   ↓
5. User completes payment in WeChat
   ↓
6. WeChat webhook POST /api/payments/webhook
   ↓
7. Backend verifies signature & updates:
   - payment.status = "completed"
   - subscription.status = "active"
   - subscription.startDate = now
   - subscription.endDate = now + 30 days
   ↓
8. WebSocket notification to user
   "支付成功！会员已激活"
```

**Database Schema:**
```sql
-- Payments table
CREATE TABLE payments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  amount INTEGER NOT NULL, -- in cents
  currency VARCHAR(3) DEFAULT 'CNY',
  payment_method VARCHAR(50), -- 'wechat_pay'
  status VARCHAR(20), -- pending/completed/failed/refunded
  external_transaction_id VARCHAR(255), -- WeChat transaction ID
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Subscriptions table
CREATE TABLE subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  tier VARCHAR(50), -- monthly/quarterly
  status VARCHAR(20), -- active/expired/cancelled
  start_date TIMESTAMP,
  end_date TIMESTAMP,
  auto_renew BOOLEAN DEFAULT false,
  payment_id INTEGER REFERENCES payments(id)
);
```

**Auto-Expiry System:**

**File:** `server/subscriptionService.ts`
```typescript
// Cron job runs daily at 2 AM
async function checkExpiredSubscriptions() {
  const expired = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.status, 'active'),
        lt(subscriptions.endDate, new Date())
      )
    );
  
  for (const sub of expired) {
    await db.update(subscriptions)
      .set({ status: 'expired' })
      .where(eq(subscriptions.id, sub.id));
    
    // Send notification
    await notifyUser(sub.userId, '您的会员已过期');
  }
}
```

#### Coupon System

**File:** `client/src/pages/admin/AdminCouponsPage.tsx`

**Coupon Types:**
- **Percentage Discount:** 20% off
- **Fixed Amount:** ¥30 off
- **Free Trial:** 7-day free membership

**Coupon Properties:**
```typescript
interface Coupon {
  code: string;              // "WELCOME2025"
  type: 'percentage' | 'fixed_amount' | 'free_trial';
  value: number;             // 20 (for 20%) or 3000 (¥30 in cents)
  maxUses: number | null;    // null = unlimited
  usedCount: number;
  expiryDate: Date | null;
  minimumPurchase: number | null; // Minimum order amount
  applicableTiers: string[]; // ["monthly", "quarterly"]
  isActive: boolean;
}
```

**Application Logic:**
```typescript
// Apply coupon at checkout
POST /api/coupons/validate
{
  code: "WELCOME2025",
  subscriptionTier: "monthly"
}

Response:
{
  valid: true,
  discount: 1960, // ¥19.60 off
  finalAmount: 7840 // ¥78.40
}
```

---

### 1.6 Chat System

**File Location:** `client/src/pages/EventChatDetailPage.tsx`, `client/src/pages/DirectChatPage.tsx`

#### Event Group Chat

**Access Control:**
```typescript
// User can access chat if:
1. User has registered for the event (payment completed)
2. Event status is "in_progress" (day of event)
3. User is not banned from chat
```

**Features:**
- ✅ Real-time messaging (100ms latency via WebSocket)
- ✅ Message history (stored in PostgreSQL)
- ✅ User mentions (@张小明)
- ✅ Read receipts
- ✅ "Someone is typing..." indicator
- ✅ Image/emoji support
- ✅ Message reporting system

**Message Schema:**
```sql
CREATE TABLE chat_messages (
  id SERIAL PRIMARY KEY,
  event_id INTEGER REFERENCES events(id),
  sender_id INTEGER REFERENCES users(id),
  content TEXT NOT NULL,
  message_type VARCHAR(20) DEFAULT 'text', -- text/image/system
  mentioned_user_ids INTEGER[],
  created_at TIMESTAMP DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT false
);
```

**Real-Time Protocol:**
```typescript
// WebSocket message format
{
  type: "chat_message",
  payload: {
    eventId: 123,
    senderId: 456,
    content: "大家好！很期待今天的聚会 😊",
    timestamp: "2025-11-14T10:30:00Z"
  }
}

// Server broadcasts to all event attendees
wsService.broadcastToEvent(eventId, message);
```

#### Direct Messages (Removed)

> **⚠️ Removed (PR 3 of 3):** In-app private/direct messaging has been removed.
> The canonical continuation model is:
> - Post-event mutual selection (via event feedback)
> - Structured `connections` record with WeChat contact reveal
> - No in-app private chat

#### Chat Moderation System

**File:** `client/src/pages/admin/AdminModerationPage.tsx`

**User Reporting:**
```typescript
// Users can report messages
POST /api/chat/report
{
  messageId: 789,
  reportType: "inappropriate_content" | "harassment" | "spam",
  description: "用户发送了不当言论"
}

// Creates chat_reports record
CREATE TABLE chat_reports (
  id SERIAL PRIMARY KEY,
  reporter_id INTEGER REFERENCES users(id),
  reported_message_id INTEGER REFERENCES chat_messages(id),
  reported_user_id INTEGER REFERENCES users(id),
  report_type VARCHAR(50),
  description TEXT,
  status VARCHAR(20) DEFAULT 'pending', -- pending/reviewed/resolved
  admin_notes TEXT,
  reviewed_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Admin Moderation Actions:**
1. **Review Reports:** See all pending reports in queue
2. **View Context:** Read surrounding messages
3. **Take Action:**
   - Delete message
   - Warn user
   - Temporarily mute (24h)
   - Ban from future chats
   - Dismiss report (no action)
4. **Log Actions:** All moderation actions logged

**Chat Logging System:**

**File:** `client/src/pages/admin/AdminChatLogsPage.tsx`

```sql
CREATE TABLE chat_logs (
  id SERIAL PRIMARY KEY,
  event_id INTEGER REFERENCES events(id),
  user_id INTEGER REFERENCES users(id),
  action_type VARCHAR(50), -- 'message_sent' | 'message_deleted' | 'user_muted'
  details JSONB,
  ip_address VARCHAR(50),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Admin Query Interface:**
- Search by event, user, date range
- Filter by action type
- Export logs as CSV
- Audit trail for compliance

---

### 1.7 In-Event Social Experience (Social Icebreaker)

**Route:** `/icebreaker/:sessionId`  
**Component:** `IcebreakerSessionPage`  
**Status:** ✅ Primary in-event flow

The Social Icebreaker is the **core in-event facilitation tool** for matched JoyJoin groups. It replaces any standalone game browsers as the primary icebreaking experience.

#### Phases (MVP)

| Phase | CN Name | Duration | Mechanic |
|-------|---------|----------|----------|
| `warmup` | 🌅 热身 | 20 min | Mood-filtered conversation topics |
| `micro_challenge` | ⚡ 挑战 | 15 min | Group challenge, tap "done" |
| `lie_detective` | 🕵️ 侦探 | 25 min | Two Truths One Lie — AI-generated |
| `recap` | ✨ 回顾 | 5 min | AI-generated session summary |

#### Entry
- Available on event day when event status is `in_progress`
- Accessible via BottomNav "去参与" button or from `PoolGroupDetailPage`
- First user to open becomes HOST and drives phase progression

#### Supporting Layers (Optional)
- **AI Card Game** (`/icebreaker-game`): Optional deep-dive card experience accessible from within the warmup phase
- **Toolkit** (legacy): Pre-event game browser — retained for backward compatibility, not featured as primary CTA

#### Technical Reference
Full system documentation: `docs/icebreaker-system.md`

---

### 1.8 Feedback System (氛围温度计)

> **Note:** Previously numbered 1.7. Renumbered to 1.8 to accommodate the new §1.7 In-Event Social Experience section.

**File Location:** `client/src/pages/EventFeedbackFlow.tsx`, `client/src/pages/DeepFeedbackFlow.tsx`

#### Two-Tier Feedback Architecture

**Tier 1: Basic Feedback (Required)**

Appears immediately after event ends (status: "completed")

**Step 1: Atmosphere Score (氛围温度计)**
```typescript
// Visual: Thermometer with 5 levels
1 ❄️  冰点 - 气氛冷淡，难以展开对话
2 🌥️  微凉 - 对话有些拘谨，需要破冰
3 ☀️  温暖 - 气氛和谐，交流顺畅
4 🔥  热烈 - 互动频繁，氛围活跃
5 🌈  完美 - 化学反应爆棚，意犹未尽
```

**Step 2: Connection Radar (连接雷达图)**

**Component:** `client/src/components/feedback/ConnectionRadar.tsx`

4-dimensional assessment (0-10 scale):
```typescript
1. 话题深度 (Topic Depth)
   - "肤浅闲聊" → "深度探讨"
   
2. 情感共鸣 (Emotional Resonance)
   - "无感" → "强烈共鸣"
   
3. 价值观契合 (Value Alignment)
   - "观念冲突" → "惺惺相惜"
   
4. 后续意愿 (Future Intent)
   - "礼貌告别" → "期待下次"
```

**Visual:** Recharts RadarChart with custom styling

**Step 3: Select Meaningful Connections**

**Component:** `client/src/components/feedback/SelectConnectionsStep.tsx`

```typescript
// User selects attendees they connected with
Interface:
  - Grid of attendee cards
  - Multi-select checkboxes
  - "至少选择1位你感觉连接较深的伙伴"
  
Data Stored:
  connected_user_ids: [123, 456, 789]
```

**Step 4: Attendee Trait Tags (参与者印象标签)**

**Component:** `client/src/components/feedback/TraitTagsWall.tsx`

For EACH selected connection:
```typescript
// 20+ pre-defined trait tags
Positive Traits:
  - 🎯 深度思考者
  - 😊 幽默风趣
  - 🤝 善于倾听
  - 💡 观点独特
  - 🌟 积极乐观
  - 📚 博学多识
  
Neutral/Constructive:
  - 🤔 话题主导者
  - 😌 相对安静
  - 🎭 善于调节
  
User Action:
  - Tap tags to apply to attendee
  - Can select multiple per person
  - Minimum 2 tags per person
```

**Step 5: Improvement Suggestions**

Free-text input:
```typescript
Prompt: "有什么可以改进活动体验的建议吗？（可选）"

Examples:
  - "时间可以延长30分钟"
  - "希望有更多话题引导"
  - "餐厅有点吵，适合更安静的场地"
```

**Tier 2: Deep Feedback (Optional, Anonymous)**

**Trigger:** After basic feedback submission
```
Prompt: "愿意花2分钟帮助我们优化匹配算法吗？
        您的反馈将匿名处理，用于改进未来的匹配质量。"
```

**Deep Feedback Questions:**

1. **匹配准确度评分 (Match Accuracy)**
   ```
   Q: "这次活动的参与者与你的期待匹配度如何？"
   Scale: 1-10
   1 = 完全不符合期待
   10 = 超出期待
   ```

2. **理想群体画像 (Ideal Group Profile)**
   ```
   Q: "你理想中的聚会伙伴是什么样的？"
   Multi-select:
   - 年龄段偏好 (22-25, 26-30, 31-35)
   - 职业类型 (科技, 金融, 创意, 服务业, 自由职业)
   - 性格倾向 (外向活泼, 内敛深沉, 平衡型)
   - 对话风格 (轻松闲聊, 深度探讨, 灵活切换)
   ```

3. **不匹配因素 (Mismatch Factors)**
   ```
   Q: "如果有感到不太合适的地方，主要是因为："
   Options:
   - 年龄差距较大
   - 兴趣重叠较少
   - 性格差异明显
   - 对话风格不合
   - 活动形式不适合
   - 其他 (请说明)
   ```

4. **算法建议 (Algorithm Suggestions)**
   ```
   Free text:
   "对我们的匹配算法有什么建议？"
   ```

**Data Storage:**
```sql
CREATE TABLE event_feedback (
  id SERIAL PRIMARY KEY,
  event_id INTEGER REFERENCES events(id),
  user_id INTEGER REFERENCES users(id),
  
  -- Basic Feedback
  atmosphere_score INTEGER CHECK (atmosphere_score BETWEEN 1 AND 5),
  topic_depth INTEGER,
  emotional_resonance INTEGER,
  value_alignment INTEGER,
  future_intent INTEGER,
  connected_user_ids INTEGER[],
  attendee_traits JSONB, -- { "123": ["深度思考者", "幽默风趣"], ... }
  improvement_suggestions TEXT,
  
  -- Deep Feedback (nullable)
  match_accuracy_score INTEGER,
  ideal_age_ranges TEXT[],
  ideal_professions TEXT[],
  ideal_personalities TEXT[],
  ideal_conversation_styles TEXT[],
  mismatch_factors TEXT[],
  algorithm_suggestions TEXT,
  
  is_anonymous BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### Feedback Analytics Integration

**Admin Portal Usage:**

1. **AdminFeedbackPage.tsx:**
   - View all feedback submissions
   - Filter by event, date, atmosphere score
   - Read improvement suggestions
   - Export feedback data

2. **AdminDataInsightsPage.tsx:**
   - Aggregate atmosphere scores → "Event Quality Index"
   - Trending improvement themes
   - Match accuracy over time
   - Connection depth distributions

3. **AdminMatchingLabPage.tsx:**
   - Use deep feedback to tune algorithm weights
   - A/B test different matching strategies
   - Validate chemistry matrix accuracy

---

### 1.8 User Profile Management

**File Location:** `client/src/pages/ProfilePage.tsx`, `client/src/pages/Edit*.tsx`

#### Profile Sections

**1. Basic Info** (`EditBasicInfoPage.tsx`)
- Name
- Gender
- Birth year
- Location (district)
- Profile photo upload

**2. Interests & Topics** (`EditInterestsPage.tsx`)
- 40+ interest tags
- Top 5 highlighted in profile

**3. Personality** (`EditPersonalPage.tsx`)
- View personality test results
- 6-dimensional radar chart
- Retake test option
- Primary/secondary archetype display

**4. Education** (`EditEducationPage.tsx`)
- School/University
- Degree level
- Major/Field of study
- Graduation year

**5. Work** (`EditWorkPage.tsx`)
- Company
- Job title
- Industry
- Years of experience

**6. Intent** (`EditIntentPage.tsx`)
```typescript
// Why user joined JoyJoin
Options:
  - 扩展朋友圈 (Expand friend circle)
  - 寻找兴趣伙伴 (Find hobby partners)
  - 行业交流 (Professional networking)
  - 探索城市生活 (Explore city life)
  - 脱单交友 (Dating - not primary focus)
```

#### Privacy Settings

**Visibility Controls:**
```typescript
interface PrivacySettings {
  profileVisibility: 'public' | 'events_only' | 'private';
  showAge: boolean;
  showEducation: boolean;
  showWorkplace: boolean;
  allowDirectMessages: 'everyone' | 'connections_only' | 'none';
}
```

---

### 1.9 Navigation & User Flow

**File:** `client/src/App.tsx`

#### Bottom Navigation Bar (5 Tabs)

```typescript
1. 🏠 首页 (Home) → /
   - Upcoming events
   - Quick actions
   
2. 🎯 发现 (Discover) → /discover
   - Browse blind box events
   - Filter by theme, date, location
   
3. 📅 我的活动 (My Events) → /events
   - Registered events
   - Past events
   - Event history
   
4. 💬 消息 (Messages) → /chats
   - Event group chats
   - Unread badge
   
5. 👤 我的 (Profile) → /profile
   - User profile
   - Settings
   - Subscription status
```

#### Protected Routes

```typescript
// Requires authentication
Middleware: isPhoneAuthenticated

Protected Routes:
  - /discover
  - /events
  - /events/:id
  - /blind-box/:id
  - /blind-box/:id/payment
  - /chats
  - /chats/event/:id
  - /chats/direct/:threadId
  - /profile
  - /personality-test/results
  - /feedback/:eventId
  
Public Routes:
  - /
  - /login
  - /register
  - /personality-test (can be taken before full registration)
```

---

## 🛡️ Admin Portal Features

**Access:** `https://joyjoin.app/admin` (Desktop-optimized)

**Authentication:** 
- Admin users have `is_admin: true` in database
- Middleware: `requireAdmin` on all `/api/admin/*` routes
- Test account: Phone `19896500978` / Password `Lasalle11`

---

### 2.1 Admin Dashboard

**File:** `client/src/pages/admin/AdminDashboard.tsx`

#### Key Metrics (Top Cards)

```typescript
1. 总用户数 (Total Users)
   - Count + 7-day growth %
   - Icon: Users
   
2. 活跃订阅 (Active Subscriptions)
   - Current active count
   - MRR (Monthly Recurring Revenue)
   - Icon: CreditCard
   
3. 本月活动 (Events This Month)
   - Scheduled + completed
   - Average attendance rate
   - Icon: Calendar
   
4. 平均满意度 (Avg Satisfaction)
   - Mean atmosphere score (1-5)
   - Trend arrow
   - Icon: Sparkles
```

#### Recent Activity Feed

Real-time stream of:
- 🆕 New user registrations
- 💳 Payment completions
- 🎉 Event confirmations
- 💬 Chat reports (flagged)
- ⭐ High-quality feedback submissions

**WebSocket Integration:**
```typescript
// Admin receives real-time notifications
useWebSocket((message) => {
  if (message.type === 'admin_notification') {
    addToActivityFeed(message.payload);
    showToast(message.payload.summary);
  }
});
```

#### Quick Actions

```typescript
Buttons:
  - 创建新活动 → /admin/events (new event form)
  - 查看待处理举报 → /admin/moderation
  - 生成本周报表 → Download CSV
  - 发送系统通知 → /admin/notifications
```

---

### 2.2 User Management

**File:** `client/src/pages/admin/AdminUsersPage.tsx`

#### User List View

**Table Columns:**
- ID
- Name
- Phone (masked: 198****0978)
- Primary Archetype badge
- Registration Date
- Subscription Status badge
- Last Active
- Actions dropdown

**Filters:**
```typescript
- Subscription Status: All | Active | Expired | Never
- Archetype: All | 开心柯基 | 太阳鸡 | 夸夸豚 | ... (12 total)
- Registration Date Range
- Search: Name, phone, email
```

**Sorting:**
- Registration date (newest/oldest)
- Last active (most/least recent)
- Subscription end date

#### User Detail View

**Tabs:**

**1. 基本信息 (Basic Info)**
- Full profile data
- Edit capabilities (admin override)
- Account status toggle (active/suspended)

**2. 订阅历史 (Subscription History)**
- All subscription records
- Payment history table
- Manual subscription grant button
- Refund issuance

**3. 活动记录 (Event History)**
- All registered events
- Attendance status
- Feedback submissions
- No-show rate

**4. 行为日志 (Activity Logs)**
- Login history
- Chat messages sent
- Reports filed
- Reports received

**Admin Actions:**
```typescript
Actions Dropdown:
  - 🔒 Suspend Account (temporary ban)
  - ✉️ Send Direct Message
  - 🎁 Grant Free Subscription
  - 💰 Issue Refund
  - 🗑️ Delete Account (requires confirmation)
  - 📊 View Full Analytics
```

---

### 2.3 Subscription & Payment Management

**File:** `client/src/pages/admin/AdminSubscriptionsPage.tsx`

#### Subscription Overview

**Metrics:**
```typescript
Top Cards:
  1. Active Subscriptions Count
  2. MRR (Monthly Recurring Revenue): ¥45,680
  3. Churn Rate: 12% this month
  4. Average Lifetime Value: ¥586
```

**Subscription Table:**

Columns:
- User Name + ID
- Tier (月度/季度)
- Start Date
- End Date
- Status (active/expired/cancelled)
- Auto-Renew toggle
- Actions

**Filters:**
- Status: Active | Expiring Soon (< 7 days) | Expired
- Tier: All | Monthly | Quarterly
- Auto-Renew: Yes | No

**Bulk Actions:**
```typescript
- Export subscribers list (CSV)
- Send renewal reminder emails
- Apply bulk discount (e.g., 20% off renewal)
```

#### Payment History

**File:** `client/src/pages/admin/AdminFinancePage.tsx`

**Revenue Dashboard:**

**Charts:**
1. **Daily Revenue Line Chart** (Last 30 days)
2. **Revenue by Tier** (Pie chart: Monthly vs Quarterly vs Single)
3. **Payment Method Distribution** (WeChat Pay 98%, Alipay 2%)

**Payment Records Table:**

Columns:
- Transaction ID (WeChat external ID)
- User
- Amount
- Type (subscription/event_ticket/refund)
- Payment Method
- Status
- Created At
- Actions (View Receipt, Refund)

**Filters:**
- Date range picker
- Payment status
- Payment method
- Amount range (¥0 - ¥500)

**Refund Management:**
```typescript
POST /api/admin/payments/refund
{
  paymentId: 123,
  amount: 9800, // Full or partial
  reason: "用户要求退款 - 活动取消",
  notifyUser: true
}

Process:
1. Create refund record in database
2. Call WeChat Pay refund API
3. Update payment status to "refunded"
4. Update subscription status to "cancelled"
5. Send notification to user
6. Log admin action
```

---

### 2.4 Venue Management

**File:** `client/src/pages/admin/AdminVenuesPage.tsx`

#### Venue Database

**Purpose:** Maintain partnerships with local restaurants, cafes, bars for hosting events

**Venue Schema:**
```sql
CREATE TABLE venues (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  name_en VARCHAR(255),
  category VARCHAR(50), -- restaurant/cafe/bar/coworking/outdoor
  address TEXT NOT NULL,
  district VARCHAR(50), -- 尖沙咀, 中环, 南山, 福田
  city VARCHAR(50), -- Hong Kong/Shenzhen
  google_maps_url TEXT,
  
  -- Capacity
  min_capacity INTEGER DEFAULT 5,
  max_capacity INTEGER DEFAULT 15,
  
  -- Availability
  available_days TEXT[], -- ['monday', 'tuesday', ...]
  available_time_slots JSONB, -- {"18:00-20:00": true, ...}
  
  -- Pricing
  price_per_person INTEGER, -- in cents
  minimum_spend INTEGER,
  
  -- Ratings
  ambiance_score INTEGER, -- 1-10
  noise_level VARCHAR(20), -- quiet/moderate/lively
  
  -- Features
  has_wifi BOOLEAN DEFAULT false,
  has_projector BOOLEAN DEFAULT false,
  accessibility_friendly BOOLEAN DEFAULT false,
  
  -- Partnership
  partnership_status VARCHAR(20), -- active/inactive/pending
  commission_rate DECIMAL(5,2), -- 15% = 15.00
  contact_person VARCHAR(100),
  contact_phone VARCHAR(20),
  contact_email VARCHAR(100),
  
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Admin Interface:**

**List View:**
- Cards with venue photo, name, district, capacity
- Filter by city, category, availability
- Search by name or address
- Status badges (active/inactive)

**Detail View:**
```typescript
Tabs:
  1. 基本信息 (Basic Info)
     - Edit all venue details
     - Upload photos
     - Set availability schedule
  
  2. 活动历史 (Event History)
     - All events hosted at this venue
     - Average attendance
     - Average satisfaction score
     - Revenue generated
  
  3. 可用时段 (Availability)
     - Calendar view
     - Block specific dates
     - Recurring availability patterns
```

**Venue Matching Algorithm:**

**File:** `server/venueMatchingService.ts`

```typescript
function scoreVenue(venue, event, attendees) {
  let score = 0;
  
  // Capacity match
  if (attendees.length >= venue.minCapacity && 
      attendees.length <= venue.maxCapacity) {
    score += 30;
  }
  
  // Location preference
  const attendeeDistricts = attendees.map(a => a.district);
  const mostCommonDistrict = mode(attendeeDistricts);
  if (venue.district === mostCommonDistrict) {
    score += 20;
  }
  
  // Ambiance match (based on event theme + attendee personalities)
  const avgExtroversion = mean(attendees.map(a => a.extraversionScore));
  if (avgExtroversion > 7 && venue.noiseLevel === 'lively') {
    score += 15;
  } else if (avgExtroversion < 5 && venue.noiseLevel === 'quiet') {
    score += 15;
  }
  
  // Historical performance
  if (venue.averageSatisfaction > 4.0) {
    score += 10;
  }
  
  // Availability
  if (isAvailable(venue, event.datetime)) {
    score += 25;
  } else {
    score = 0; // Hard constraint
  }
  
  return score;
}

// Return top 3 venue recommendations
function matchVenue(event, attendees) {
  const venues = await db.select().from(venues)
    .where(eq(venues.partnershipStatus, 'active'));
  
  const scored = venues.map(v => ({
    venue: v,
    score: scoreVenue(v, event, attendees)
  }));
  
  return scored.sort((a, b) => b.score - a.score).slice(0, 3);
}
```

**Booking System:**

```typescript
// When admin confirms event with venue
POST /api/admin/events/book-venue
{
  eventId: 123,
  venueId: 456,
  confirmedDateTime: "2025-11-20T19:00:00Z",
  expectedAttendees: 8,
  specialRequests: "需要投影仪"
}

Process:
1. Check venue availability (with transaction lock)
   BEGIN TRANSACTION;
   SELECT * FROM venue_bookings 
   WHERE venue_id = 456 
   AND datetime = '2025-11-20 19:00:00'
   FOR UPDATE; -- Row-level lock
   
2. If available, create booking:
   INSERT INTO venue_bookings (
     venue_id, event_id, datetime, status
   ) VALUES (456, 123, '2025-11-20 19:00:00', 'confirmed');
   
3. Update event with venue details
   COMMIT;
   
4. Send confirmation to venue contact
5. Broadcast to attendees via WebSocket
```

---

### 2.5 Event Template System

**File:** `client/src/pages/admin/AdminEventTemplatesPage.tsx`

#### Purpose

Create reusable event templates for recurring themes to streamline event creation.

**Template Schema:**
```sql
CREATE TABLE event_templates (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  title_en VARCHAR(255),
  category VARCHAR(50), -- dining/outdoor/creative/learning/sports
  description TEXT,
  
  -- Default Settings
  default_max_attendees INTEGER DEFAULT 8,
  default_price_member INTEGER, -- in cents
  default_price_non_member INTEGER,
  default_duration_minutes INTEGER DEFAULT 120,
  
  -- Matching Preferences
  preferred_archetypes TEXT[], -- Ideal personality mix
  min_diversity_score INTEGER, -- Minimum personality diversity
  
  -- Venue Requirements
  preferred_venue_categories TEXT[],
  required_venue_features TEXT[], -- ['wifi', 'projector']
  
  -- Images
  cover_image_url TEXT,
  gallery_images TEXT[],
  
  is_active BOOLEAN DEFAULT true,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Example Templates:**

1. **深夜食堂：街边美食探险**
   ```typescript
   {
     category: "dining",
     description: "探索本地特色小吃，从大排档到深夜甜品",
     defaultMaxAttendees: 6,
     priceMember: 9800,
     priceNonMember: 14800,
     preferredArchetypes: ["探索者", "故事家", "氛围组"],
     preferredVenueCategories: ["restaurant"],
     requiredVenueFeatures: []
   }
   ```

2. **周末徒步：城市边缘的绿野**
   ```typescript
   {
     category: "outdoor",
     description: "逃离城市喧嚣，在自然中深度对话",
     defaultMaxAttendees: 10,
     priceMember: 6800,
     priceNonMember: 9800,
     preferredArchetypes: ["探索者", "连接者", "肯定者"],
     preferredVenueCategories: ["outdoor"],
     requiredVenueFeatures: []
   }
   ```

3. **读书会：非虚构作品分享**
   ```typescript
   {
     category: "learning",
     description: "围绕一本书展开深度讨论，分享观点与启发",
     defaultMaxAttendees: 8,
     priceMember: 8800,
     priceNonMember: 12800,
     preferredArchetypes: ["探索者", "挑战者", "智者"],
     preferredVenueCategories: ["cafe", "coworking"],
     requiredVenueFeatures: ["wifi", "quiet"]
   }
   ```

**Admin Interface:**

**Create Event from Template:**
```typescript
Flow:
1. Admin selects template
2. Pre-filled form appears with template defaults
3. Admin can override:
   - Date & time
   - Venue (choose from recommendations)
   - Max attendees
   - Price
   - Description
4. Click "发布活动"
5. Event created with status "matching"
```

---

### 2.6 Event Management

**File:** `client/src/pages/admin/AdminEventsPage.tsx`

#### Event Lifecycle Management

**Event Status States:**
```typescript
type EventStatus = 
  | "draft"              // Admin creating
  | "matching"           // AI finding participants
  | "registration_open"  // Accepting sign-ups
  | "confirmed"          // Min attendees met, venue booked
  | "in_progress"        // Day of event
  | "completed"          // Event finished
  | "cancelled";         // Admin cancelled

Status Transitions:
draft → matching → registration_open → confirmed → in_progress → completed
   ↓         ↓              ↓              ↓
cancelled  cancelled    cancelled     cancelled
```

**Admin Event Dashboard:**

**Views:**

1. **Calendar View**
   - Full calendar grid (month view)
   - Color-coded by status
   - Click date to create new event
   - Drag-and-drop to reschedule

2. **List View (Default)**
   
   **Tabs:**
   - 即将举行 (Upcoming) - confirmed + in_progress
   - 招募中 (Recruiting) - matching + registration_open
   - 已完成 (Completed)
   - 已取消 (Cancelled)
   - 全部 (All)
   
   **Table Columns:**
   - Event Title
   - Template badge (if from template)
   - Date & Time
   - Venue
   - Attendees (X/Y)
   - Status badge
   - Avg Match Score
   - Actions

**Event Detail Page:**

**Tabs:**

**1. 活动信息 (Event Info)**
```typescript
Editable Fields:
  - Title (Chinese + English)
  - Description
  - Category
  - Date & Time
  - Duration
  - Max attendees
  - Price (member/non-member)
  - Cover image
  - Status (admin override)
```

**2. 参与者 (Attendees)**
```typescript
Display:
  - Attendee list with profile cards
  - Archetype distribution pie chart
  - Average group chemistry score
  - Individual match scores
  
Actions:
  - Manually add/remove attendees
  - Send group message
  - Export attendee list
```

**3. 匹配分析 (Matching Analysis)**
```typescript
Show:
  - 5-dimensional match scores breakdown
  - Personality distribution chart
  - Interest overlap matrix
  - Predicted conversation topics
  - Warning flags:
    ⚠️ "群体过于同质化，建议增加多样性"
    ⚠️ "检测到潜在性格冲突（挑战者×3）"
```

**4. 场地预订 (Venue Booking)**
```typescript
Display:
  - Selected venue details
  - Booking confirmation status
  - Venue contact info
  - Special requests
  
Actions:
  - Change venue (shows recommendations)
  - Confirm/Cancel booking
  - Add special requests
```

**5. 聊天监控 (Chat Monitoring)**
```typescript
Live Feed:
  - Real-time event group chat messages
  - Flagged messages highlighted
  - User reports appear inline
  
Admin Actions:
  - Delete message
  - Mute user
  - Join chat as admin (visible to all)
```

**6. 反馈总结 (Feedback Summary)**
```typescript
After event completion:
  - Atmosphere score distribution
  - Connection radar averages
  - Attendee trait word cloud
  - Improvement suggestions list
  - Export feedback report
```

#### Bulk Event Operations

**Filters:**
- Date range
- Status
- Category
- Venue
- Min/Max attendees
- Match score range

**Bulk Actions:**
```typescript
Select multiple events → Actions:
  - Send notification to all attendees
  - Cancel events (with refund)
  - Export event data (CSV)
  - Duplicate events (create copies)
  - Change category
```

#### Event Cancellation Flow

```typescript
When admin cancels event:

1. Confirmation dialog:
   "确定要取消活动吗？这将影响 X 位已注册用户"
   
2. Cancellation reason (required):
   - 人数不足
   - 场地问题
   - 不可抗力
   - 其他

3. Refund options:
   - 全额退款 (Full refund)
   - 退款至钱包 (Refund to wallet credit)
   - 转换为下次活动抵用券 (Convert to event voucher)

4. Process:
   a) Update event status to "cancelled"
   b) Process refunds via WeChat Pay
   c) Send push notification to all attendees
   d) Send apology email with reason
   e) Log admin action
   f) Release venue booking

5. Follow-up (optional):
   "为受影响用户推荐类似活动"
   → System suggests 3 similar upcoming events
```

---

### 2.7 Matching Lab (算法调优实验室)

**File:** `client/src/pages/admin/AdminMatchingLabPage.tsx`

#### Purpose

Interactive tool for admins to:
- Tune matching algorithm weights
- Test matching outcomes with real user data
- A/B test different matching strategies
- Validate chemistry matrix accuracy

#### Interface Components

**1. Weight Adjustment Panel**

```typescript
interface MatchingWeights {
  personality: number;      // 40% default
  interests: number;        // 25% default
  background: number;       // 15% default
  conversation: number;     // 10% default
  intent: number;          // 10% default
}

UI:
  - 5 sliders (0-100%)
  - Auto-normalizes to 100% total
  - "Reset to Default" button
  - "Save as Preset" button
  
Validation:
  - Sum must equal 100%
  - Each weight >= 5% (prevent over-optimization)
```

**2. Test Matching Simulator**

```typescript
Workflow:
1. Admin selects event template
2. System randomly samples N users from database
   - Filters: City, age range, subscription status
   - Sample size: 20-50 users

3. Run matching algorithm with current weights
   - Forms groups of 5-10
   - Calculates match scores

4. Display results:
   a) Group Formation Table
      - Group A: [User1, User2, ...]
      - Avg Chemistry: 87%
      - Archetype Mix: 🙌 🧭 📖 🤝 🎯
      - Interest Overlap: 6 shared tags
   
   b) Score Distribution Chart
      - Histogram of individual match scores
      - Mean, median, std deviation
   
   c) Warnings/Insights
      - "Group C 同质化程度过高 (92% 都是探索者)"
      - "Group A 预测对话深度: 8.2/10"

5. Admin can:
   - Adjust weights → Re-run
   - Manually swap users between groups
   - Export results for analysis
```

**3. A/B Testing Dashboard**

```typescript
Create Test:
  - Control: Current production weights
  - Variant: New experimental weights
  - Split: 50/50
  - Duration: 2 weeks
  - Success Metrics:
    * Atmosphere score > 4.0
    * Connection radar avg > 7.0
    * User retention rate

Monitor Results:
  - Live stats table comparing Control vs Variant
  - Statistical significance calculator
  - Feedback quality comparison
  - User satisfaction NPS

Decision:
  - "Roll out to 100%" button
  - "Discard variant" button
  - "Run another week" button
```

**4. Chemistry Matrix Editor**

**12×12 Compatibility Matrix:**

> **Note:** Production matrix uses current 12 archetypes.
> See `apps/server/src/archetypeChemistry.ts` for actual implementation.

```typescript
// Example structure (using current archetypes)
const chemistryMatrix = {
  "开心柯基": {
    "开心柯基": 70, "太阳鸡": 88, "夸夸豚": 90, "机智狐": 85,
    "淡定海豚": 82, "织网蛛": 83, "暖心熊": 92, "灵感章鱼": 86,
    ...
  },
  ...
};

UI:
  - Heatmap visualization (green = high, red = low)
  - Click cell to edit value (0-100)
  - "Import from CSV" button
  - "Validate symmetry" button (ensure A→B = B→A if desired)
  - "Reset to research-based defaults" button

Validation:
  - Values between 0-100
  - Warn if any pair < 50 (potential mismatch)
  - Show impact simulation after edits
```

**5. Historical Performance Analytics**

```typescript
Charts:
  1. Match Score vs Atmosphere Score (Scatter plot)
     - X-axis: Predicted match score
     - Y-axis: Actual atmosphere score
     - Regression line
     - R² correlation coefficient
  
  2. Weight Impact Over Time (Line chart)
     - Track how weight changes affect outcomes
     - Compare periods before/after adjustments
  
  3. Archetype Pairing Success Rate (Heatmap)
     - Which archetype pairs get highest feedback?
     - Which pairs underperform?

Insights:
  - "探索者 + 挑战者 pairings consistently score 4.5+ atmosphere"
  - "Increasing background weight from 15% → 20% improved connection depth by 12%"
```

---

### 2.8 Content Management System

**File:** `client/src/pages/admin/AdminContentPage.tsx`

#### Purpose

Manage platform-wide content:
- Announcements
- FAQs
- Community Guidelines
- Terms of Service
- Privacy Policy

**Content Schema:**
```sql
CREATE TABLE contents (
  id SERIAL PRIMARY KEY,
  type VARCHAR(50), -- announcement/faq/guideline/terms/policy
  title VARCHAR(255) NOT NULL,
  title_en VARCHAR(255),
  body TEXT NOT NULL,
  body_en TEXT,
  
  -- Publishing
  status VARCHAR(20) DEFAULT 'draft', -- draft/published/archived
  publish_date TIMESTAMP,
  expiry_date TIMESTAMP,
  
  -- Targeting
  target_audience VARCHAR(50), -- all/new_users/subscribers/specific_city
  city VARCHAR(50), -- Hong Kong/Shenzhen/All
  
  -- Display
  priority INTEGER DEFAULT 0, -- Higher = shown first
  show_in_app BOOLEAN DEFAULT true,
  show_on_website BOOLEAN DEFAULT true,
  
  -- Metadata
  author_id INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Admin Interface

**Content List View:**

**Tabs by Type:**
- 📢 Announcements
- ❓ FAQs
- 📋 Guidelines
- 📄 Legal (Terms/Privacy)

**Table Columns:**
- Title
- Type badge
- Status badge
- Target Audience
- Publish Date
- Views count
- Actions

**Create/Edit Content:**

```typescript
Rich Text Editor:
  - Markdown support
  - Image upload
  - Link insertion
  - Preview mode
  
Fields:
  - Title (中文)
  - Title (English)
  - Body (中文) - Rich text
  - Body (English) - Rich text
  - Type dropdown
  - Status: Draft/Published/Archived
  - Publish date picker (schedule publishing)
  - Expiry date (auto-archive)
  - Target audience dropdown
  - City filter
  - Priority (0-10)
  - Display toggles: App / Website
  
Actions:
  - Save as Draft
  - Publish Now
  - Schedule Publish
  - Preview
```

**Announcement Publishing Flow:**

```typescript
When admin publishes announcement:

1. Content status → "published"
2. If "show_in_app" = true:
   - Push notification to targeted users
   - Show banner in app home page
   - Add to notification center
3. If "show_on_website" = true:
   - Display on website homepage
4. Log publication event

Auto-Archive:
  - Daily cron job checks expiry_date
  - If past expiry, status → "archived"
  - Remove from active displays
```

---

### 2.9 Notification Push System

**File:** `client/src/pages/admin/AdminNotificationsPage.tsx`

#### Notification Types

**System Notifications:**
1. **Event Reminders**
   - 72h before: "您的活动即将开始，参与者信息已解锁"
   - 24h before: "明天的活动别忘了！"
   - 2h before: "活动即将在2小时后开始"

2. **Subscription Alerts**
   - 7 days before expiry: "您的会员即将到期"
   - On expiry: "会员已过期，续费享85折优惠"

3. **Social Updates**
   - New direct message
   - Event chat mention
   - New connection request

**Admin Broadcast Notifications:**

**Interface:**

```typescript
Create Notification:

1. Select Audience:
   - 全部用户 (All users)
   - 活跃会员 (Active subscribers)
   - 新用户 (Registered < 30 days)
   - 流失用户 (Inactive > 60 days)
   - 特定城市 (Hong Kong / Shenzhen)
   - 特定性格 (By archetype)
   - 自定义筛选 (Custom filters)

2. Compose Message:
   - Title (Chinese + English)
   - Body (Chinese + English)
   - Action button:
     * 查看详情 → Deep link URL
     * 立即报名 → Event ID
     * 立即续费 → Subscription page
     * None
   - Image (optional)

3. Delivery Settings:
   - Send immediately
   - Schedule send (date + time)
   - Send as test (to admin only)

4. Preview:
   - See how notification appears
   - iOS vs Android preview
   - In-app banner preview

5. Send:
   - Confirm audience size
   - Click "发送通知"
   - Show delivery progress
   - View delivery report (opened/clicked rates)
```

**Delivery Logs:**

**Table:**
- Notification Title
- Audience Size
- Sent At
- Delivery Rate (98.5%)
- Open Rate (45.2%)
- Click Rate (12.3%)
- Actions (View Details, Resend)

---

### 2.10 Moderation System (Content & User Reports)

**File:** `client/src/pages/admin/AdminModerationPage.tsx`, `client/src/pages/admin/AdminReportsPage.tsx`

#### Chat Moderation Queue

**Report Sources:**
1. User-submitted reports (via "举报" button in chat)
2. Auto-flagged messages (keyword detection)
3. Multiple user blocks (same person blocked by 3+ users)

**Moderation Dashboard:**

**Tabs:**
- 待处理 (Pending) - New reports
- 处理中 (In Review) - Admin reviewing
- 已解决 (Resolved) - Action taken
- 已驳回 (Dismissed) - No action needed

**Report Card:**

```typescript
Display:
  - Reporter: User A (ID: 123)
  - Reported User: User B (ID: 456)
  - Report Type: 不当言论 / 骚扰 / 垃圾信息
  - Reported Message: "..." (with context - 3 messages before/after)
  - Event: 深夜食堂活动 #789
  - Timestamp: 2025-11-14 20:35:12
  - Report Description: "用户使用不尊重的语言"
  
Context Panel:
  - User B's profile summary
  - User B's past reports (received + filed)
  - Event chat history (full conversation)
  
Admin Actions:
  1. 删除消息 (Delete message)
     - Remove from database
     - Notify reported user
  
  2. 警告用户 (Warn user)
     - Send warning notification
     - Log warning count
     - No immediate penalty
  
  3. 临时禁言 (Mute - 24/48/72 hours)
     - User can read but not send messages
     - Applies to all chats
  
  4. 永久禁言 (Permanent chat ban)
     - User cannot access any chat features
     - Can still attend events
  
  5. 封禁账号 (Suspend account)
     - User cannot login
     - All future events cancelled with refund
     - Lasts: 7/30/90 days or permanent
  
  6. 驳回举报 (Dismiss report)
     - No action taken
     - Add admin notes explaining why

Admin Notes:
  - Text field for moderation decision rationale
  - Required for all actions
  - Logged for audit trail
```

**Automated Flagging System:**

```typescript
// Keyword detection
const flaggedKeywords = {
  harassment: ["傻逼", "滚蛋", "去死", ...],
  spam: ["加微信", "买卖", "投资", ...],
  inappropriate: ["色情", "赌博", ...],
};

// Message processing
onNewMessage((message) => {
  for (const [category, keywords] of Object.entries(flaggedKeywords)) {
    if (keywords.some(kw => message.content.includes(kw))) {
      createAutoReport({
        messageId: message.id,
        category: category,
        confidence: 0.8,
        requiresHumanReview: true
      });
    }
  }
});
```

#### User Report Management

**File:** `client/src/pages/admin/AdminReportsPage.tsx`

**Report Types:**
- 🚫 不当行为 (Inappropriate behavior) - At events
- 💬 聊天违规 (Chat violation)
- 📸 不当头像/资料 (Inappropriate profile)
- 💰 支付纠纷 (Payment dispute)
- 🐛 系统问题 (Bug report)
- 💡 功能建议 (Feature suggestion)

**Report Workflow:**

**User submits report:**
```typescript
POST /api/reports/submit
{
  reportType: "inappropriate_behavior",
  targetUserId: 456,
  eventId: 789,
  description: "用户在活动中有冒犯性言论",
  evidence: ["screenshot_url_1.jpg"]
}
```

**Admin reviews:**
1. View full context (event, chat logs, user history)
2. Contact reporter for more details (optional)
3. Contact reported user for their side (optional)
4. Make decision
5. Take action (warn/suspend/ban)
6. Notify both parties of outcome
7. Close report with resolution notes

**Report Analytics:**
```typescript
Metrics:
  - Reports by type (pie chart)
  - Reports over time (line chart)
  - Repeat offenders list
  - Average resolution time
  - Admin response time
```

---

### 2.11 Data Insights Dashboard (运营决策指挥中心)

**File:** `client/src/pages/admin/AdminDataInsightsPage.tsx`

#### Purpose

Comprehensive analytics dashboard for data-driven decision making.

#### Module 1: User Scale Metrics (用户规模指标)

**Metrics:**

1. **Total Registered Users**
   ```typescript
   Count: 2,458
   7-day growth: +12.3%
   30-day growth: +45.6%
   ```

2. **Active Users (定义：30天内有活动)**
   ```typescript
   DAU (Daily Active): 245
   WAU (Weekly Active): 856
   MAU (Monthly Active): 1,823
   
   Chart: DAU/MAU trend (last 90 days)
   ```

3. **User Acquisition Funnel**
   ```mermaid
   Landing Page Views: 10,000
         ↓ 45%
   Started Registration: 4,500
         ↓ 68%
   Completed Profile: 3,060
         ↓ 55%
   Took Personality Test: 1,683
         ↓ 48%
   Attended First Event: 808
   ```

4. **User Distribution**
   - By City: Hong Kong 62% | Shenzhen 38%
   - By Age: 22-25 (28%) | 26-30 (45%) | 31-35 (27%)
   - By Gender: F 58% | M 39% | Other 3%

#### Module 2: Business Health (业务健康度)

**Revenue Metrics:**

```typescript
1. MRR (Monthly Recurring Revenue)
   Current: ¥45,680
   Growth: +8.2% MoM
   
2. ARR (Annual Run Rate)
   Projection: ¥548,160

3. Revenue Breakdown
   - Subscriptions: 78%
   - Single Event Tickets: 22%
   
4. Subscription Distribution
   - Monthly: 65%
   - Quarterly: 35%

5. ARPU (Average Revenue Per User)
   - All users: ¥18.60
   - Subscribers only: ¥98.50
   
6. LTV (Customer Lifetime Value)
   - Average: ¥586
   - By cohort chart (first-month cohort retention)
```

**Health Indicators:**

```typescript
1. Churn Rate
   Monthly: 12.3%
   Target: < 15%
   Status: ✅ Healthy
   
2. Subscription Renewal Rate
   Auto-renew enabled: 68%
   Manual renewal: 23%
   
3. Payment Success Rate
   WeChat Pay: 98.7%
   
4. Refund Rate
   Current month: 2.1%
   Target: < 5%
   Status: ✅ Healthy
```

#### Module 3: Matching Efficiency (匹配效率)

**Algorithm Performance:**

```typescript
1. Average Match Score
   Group Chemistry: 87.3%
   Personal Fit: 89.1%
   
2. Match Score Distribution
   Histogram:
   - 90-100%: 35% of events
   - 80-89%: 52% of events
   - 70-79%: 11% of events
   - < 70%: 2% of events
   
3. Match Accuracy (预测 vs 实际)
   Correlation Analysis:
   - Predicted Match Score vs Actual Atmosphere Score
   - R² = 0.73 (strong correlation)
   - Scatter plot with regression line
```

**Matching Success Metrics:**

```typescript
1. Event Fill Rate
   - Events reaching min capacity: 94%
   - Events reaching max capacity: 67%
   
2. Average Time to Fill
   - From "matching" to "confirmed": 3.2 days
   
3. Archetype Distribution in Events
   - Stacked bar chart showing mix across events
   - Highlight: Most diverse events score higher
   
4. Interest Overlap Quality
   - Average shared interests per event: 4.8
   - Sweet spot: 4-6 shared interests = best outcomes
```

#### Module 4: User Retention (用户留存)

**Cohort Analysis:**

```typescript
// Retention table by registration month
Month 0: 100% (baseline)
Month 1: 45%  ← Critical drop-off point
Month 2: 32%
Month 3: 28%
Month 6: 22%
Month 12: 18%

Visualization: Retention curve by cohort
```

**Engagement Metrics:**

```typescript
1. Events per User
   - 0 events: 35% (未激活)
   - 1 event: 28% (体验用户)
   - 2-5 events: 25% (活跃用户)
   - 6+ events: 12% (超级用户)
   
2. Repeat Event Rate
   - Users who attend 2+ events: 37%
   - Target: > 40%
   
3. Social Graph Density
   - Average connections per user: 3.2
   - Users with 5+ connections: 18%
   - Connection → Retention correlation: +0.65
```

**Reactivation Metrics:**

```typescript
1. Dormant Users (60+ days inactive)
   Count: 423
   Reactivation attempts: 120
   Reactivated: 28 (23% success rate)
   
2. Churn Prevention
   - Users flagged as at-risk: 87
   - Intervention: Personalized event recommendations
   - Saved: 34 (39% save rate)
```

#### Module 5: Activity Quality (活动质量)

**Event Satisfaction:**

```typescript
1. Atmosphere Score Distribution
   Average: 4.2 / 5.0
   
   5 stars (🌈 完美): 38%
   4 stars (🔥 热烈): 45%
   3 stars (☀️ 温暖): 14%
   2 stars (🌥️ 微凉): 2.5%
   1 star (❄️ 冰点): 0.5%
   
2. Connection Depth (Radar Metrics)
   - 话题深度: 7.8 / 10
   - 情感共鸣: 7.5 / 10
   - 价值观契合: 7.2 / 10
   - 后续意愿: 8.1 / 10
   
3. Event NPS (Net Promoter Score)
   - Promoters (9-10): 52%
   - Passives (7-8): 38%
   - Detractors (0-6): 10%
   - NPS: +42 (Excellent)
```

**Quality Trends:**

```typescript
1. Satisfaction by Event Type
   - Dining: 4.3 ⭐
   - Outdoor: 4.5 ⭐
   - Learning: 4.0 ⭐
   - Creative: 4.2 ⭐
   
2. Satisfaction by Group Size
   - 5-6 people: 4.4 ⭐
   - 7-8 people: 4.2 ⭐
   - 9-10 people: 3.9 ⭐
   Insight: Smaller = better
   
3. Venue Performance
   - Top 5 venues by avg satisfaction
   - Bottom 5 venues needing improvement
```

#### Module 6: Revenue Conversion Funnel

```typescript
Stage 1: Landing Page Visit
  ↓ 45% conversion
Stage 2: Started Registration
  ↓ 68% completion
Stage 3: Completed Profile
  ↓ 35% take personality test
Stage 4: Completed Personality Test
  ↓ 25% browse events
Stage 5: Clicked Event
  ↓ 40% initiated payment
Stage 6: Completed Payment
  (FIRST REVENUE)
  
Revenue Conversion Rate: 2.7%
Average Time to First Payment: 5.2 days

Optimization Opportunities:
  - Biggest drop: Profile → Personality Test (65% drop)
  - Action: Gamify test, show example results
```

#### Module 7: Social Role Distribution (社交角色分布)

**Archetype Analytics:**

> **Note:** Example data below uses legacy archetype names from V1/V2 system.
> Production system uses current 12 archetypes (开心柯基, 太阳鸡, 夸夸豚, etc.)

```typescript
1. Overall Distribution
   Pie Chart (example data - legacy names):
   - 连接者: 18.5%
   - 探索者: 16.2%
   - 故事家: 14.8%
   - 火花塞: 13.1%
   - 肯定者: 12.3%
   - 氛围组: 10.7%
   - 协调者: 9.4%
   - 挑战者: 5.0%
   
2. Archetype Engagement
   - Highest retention: 连接者 (28% at 6 months)
   - Most active: 火花塞 (avg 4.8 events)
   - Best feedback givers: 探索者 (85% provide deep feedback)
   
3. Archetype Pairing Success
   Heatmap: 12x12 matrix
   - Best pairs: 探索者 × 火花塞 (4.6 avg atmosphere)
   - Challenging pairs: 挑战者 × 挑战者 (3.8 avg)
   
4. Archetype Trends Over Time
   - Are certain archetypes growing?
   - Seasonality in archetype registrations?
   Line chart: Monthly archetype sign-ups
```

**Strategic Insights:**

```typescript
Auto-Generated Insights (example format):
  ✅ "High retention archetype detected - recruit more!"
  ⚠️ "Underrepresented archetype (5%) - adjust marketing"
  💡 "Events with 2+ high-energy archetypes show 15% higher satisfaction"
  📊 "Certain archetypes prefer specific event types (data-driven)"
```

---

### 2.12 Feedback Management

**File:** `client/src/pages/admin/AdminFeedbackPage.tsx`

#### Interface

**Filters:**
```typescript
- Event: Dropdown (all events)
- Date Range: Picker
- Atmosphere Score: 1-5 stars filter
- Has Deep Feedback: Yes/No
- Search: By user name or event title
```

**Feedback List View:**

**Card Display:**
```typescript
For each feedback:
  - Event title + date
  - User name + archetype badge
  - 氛围温度计: ⭐⭐⭐⭐⭐ (5/5)
  - Connection Radar mini-chart (spark line)
  - Connected with: 3 attendees
  - Deep feedback badge (if exists)
  - Click to expand
```

**Expanded Feedback Detail:**

```typescript
Modal/Panel showing:

1. Basic Feedback Section:
   - Atmosphere Score: Large thermometer visual
   - Connection Radar: Full-size chart
   - Connected Users: Avatars + names
   - Attendee Traits Applied:
     User A: 🎯 深度思考者, 😊 幽默风趣
     User B: 🤝 善于倾听, 💡 观点独特
   - Improvement Suggestions: Full text

2. Deep Feedback Section (if exists):
   - Match Accuracy: 8/10
   - Ideal Group Profile: Age 26-30, Tech/Creative, 深度探讨
   - Mismatch Factors: "性格差异明显"
   - Algorithm Suggestions: User's text feedback

3. Admin Notes:
   - Text area to add internal notes
   - Not visible to user
   - Saved to database

4. Actions:
   - Export this feedback
   - Flag for review
   - Mark as addressed
```

**Feedback Statistics Panel:**

```typescript
Top Summary Cards:
  - Total Feedbacks: 1,234
  - Avg Atmosphere: 4.2 / 5.0
  - Deep Feedback Rate: 34%
  - Response Rate: 78%

Charts:
  1. Atmosphere Distribution (Bar chart)
  2. Connection Depth Trends (Line chart over time)
  3. Top Improvement Themes (Word cloud)
     - "延长时间"
     - "更安静场地"
     - "话题引导"
  4. Match Accuracy Distribution (Histogram)
```

**Export Options:**
```typescript
- Export filtered feedbacks as CSV
- Export aggregate statistics as PDF report
- Export deep feedback insights for matching lab
```

---

### 2.13 Real-Time WebSocket Integration

**File:** `server/wsService.ts`, `client/src/hooks/useWebSocket.ts`

#### Architecture

**Backend WebSocket Service:**

```typescript
// server/wsService.ts
class WebSocketService {
  private wss: WebSocketServer;
  private userConnections: Map<userId, WebSocket>;
  
  // Broadcast to specific user
  sendToUser(userId: number, message: any) {
    const ws = this.userConnections.get(userId);
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }
  
  // Broadcast to all event attendees
  broadcastToEvent(eventId: number, message: any) {
    const attendees = await getEventAttendees(eventId);
    for (const attendee of attendees) {
      this.sendToUser(attendee.userId, message);
    }
  }
  
  // Broadcast to all admins
  broadcastToAdmins(message: any) {
    const admins = await getAdminUsers();
    for (const admin of admins) {
      this.sendToUser(admin.id, message);
    }
  }
}
```

**Message Types:**

```typescript
// User app messages
type WSMessage = 
  | { type: 'chat_message'; payload: ChatMessage }
  | { type: 'event_updated'; payload: { eventId, status } }
  | { type: 'new_connection'; payload: { fromUser } }
  | { type: 'typing_indicator'; payload: { userId, isTyping } }
  | { type: 'subscription_activated'; payload: { tier, endDate } }

// Admin messages
type AdminWSMessage =
  | { type: 'new_user_registered'; payload: User }
  | { type: 'payment_completed'; payload: Payment }
  | { type: 'chat_report_filed'; payload: ChatReport }
  | { type: 'event_filled'; payload: Event }
  | { type: 'high_quality_feedback'; payload: Feedback }
```

**Frontend Hook:**

```typescript
// client/src/hooks/useWebSocket.ts
export function useWebSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const ws = useRef<WebSocket>();
  
  useEffect(() => {
    // Connect with auth token
    ws.current = new WebSocket(
      `wss://${window.location.host}/ws?token=${getAuthToken()}`
    );
    
    ws.current.onopen = () => setIsConnected(true);
    ws.current.onclose = () => setIsConnected(false);
    
    ws.current.onmessage = (event) => {
      const message = JSON.parse(event.data);
      handleMessage(message);
    };
    
    return () => ws.current?.close();
  }, []);
  
  const handleMessage = (message: WSMessage) => {
    switch (message.type) {
      case 'chat_message':
        queryClient.invalidateQueries(['/api/chats', message.payload.eventId]);
        break;
      case 'event_updated':
        queryClient.invalidateQueries(['/api/events', message.payload.eventId]);
        showToast('活动信息已更新');
        break;
      // ... other handlers
    }
  };
  
  return { isConnected, send: (msg) => ws.current?.send(JSON.stringify(msg)) };
}
```

**Use Cases:**

1. **Event Status Changes**
   ```typescript
   // Admin confirms event
   await updateEventStatus(eventId, 'confirmed');
   broadcastToEvent(eventId, {
     type: 'event_updated',
     payload: { eventId, status: 'confirmed' }
   });
   // All attendees' UI updates instantly
   ```

2. **Chat Messages**
   ```typescript
   // User sends message
   const message = await createChatMessage({ eventId, content });
   broadcastToEvent(eventId, {
     type: 'chat_message',
     payload: message
   });
   // All participants see message in real-time
   ```

3. **Payment Confirmation**
   ```typescript
   // WeChat webhook confirms payment
   await markPaymentCompleted(paymentId);
   sendToUser(userId, {
     type: 'subscription_activated',
     payload: { tier: 'monthly', endDate: ... }
   });
   // User sees confirmation instantly
   ```

4. **Admin Notifications**
   ```typescript
   // New user registers
   const user = await createUser(userData);
   broadcastToAdmins({
     type: 'new_user_registered',
     payload: user
   });
   // Admin dashboard updates in real-time
   ```

---

## 🏗️ Technical Architecture

### 3.1 Technology Stack

**Frontend:**
- React 18 + TypeScript
- Vite (build tool)
- Wouter (routing)
- TanStack Query v5 (server state)
- Radix UI + shadcn/ui (components)
- Tailwind CSS (styling)
- Recharts (data visualization)
- Framer Motion (animations)

**Backend:**
- Node.js + Express.js
- TypeScript
- PostgreSQL (Neon serverless)
- Drizzle ORM
- WebSocket (ws library)
- Express Session (authentication)

**Authentication:**
- Phone number + SMS verification
- bcrypt password hashing
- PostgreSQL session store (7-day persistence)

**Payment:**
- WeChat Pay JSAPI integration
- Webhook signature verification
- Idempotency handling

**Real-Time:**
- WebSocket connections
- Event-based message broadcasting
- Auto-reconnection on disconnect

---

### 3.2 Database Schema Summary

**Core Tables:**

1. **users** - User profiles + personality data
2. **subscriptions** - Subscription records
3. **payments** - Payment transactions
4. **coupons** - Discount codes
5. **events** - Event listings
6. **event_templates** - Reusable event templates
7. **event_attendance** - User-event registrations
8. **event_feedback** - Post-event feedback
9. **venues** - Partner venue database
10. **venue_bookings** - Event-venue reservations
11. **chat_messages** - Event group chat
12. ~~**direct_message_threads**~~ - Removed (PR 3 of 3; connection-first model)
13. ~~**direct_messages**~~ - Removed (PR 3 of 3; connection-first model)
14. **chat_reports** - User-reported messages
15. **chat_logs** - Technical chat audit logs
16. **contents** - CMS content (announcements, FAQs)
17. **notifications** - Push notification records
18. **event_pools** - Admin-created blind box event pools
19. **event_pool_registrations** - User registrations with soft preferences
20. **event_pool_groups** - Matched groups (v1.1: added `energyBalance`, `temperatureLevel`)
21. **matching_thresholds** - Configurable matching parameters (NEW v1.1)
22. **pool_matching_logs** - Matching decision history (NEW v1.1)
23. **invitations** - User invitation records
24. **invitation_uses** - Invitation reward tracking (NEW v1.1)
25. **user_coupons** - User coupon assignments (NEW v1.1)

**Full schema:** See `shared/schema.ts` (3000+ lines)

---

### 3.3 API Endpoints Summary

**Public Routes:**
- `POST /api/phone/register` - Send SMS verification
- `POST /api/phone/verify` - Verify code + create session
- `POST /api/phone/login` - Existing user login

**User Routes** (requires authentication):
- `GET /api/auth/user` - Get current user
- `POST /api/personality-test/submit` - Submit test answers
- `GET /api/personality-test/results` - Get test results
- `GET /api/personality-test/stats` - Get archetype distribution
- `GET /api/events` - List events
- `GET /api/events/:id` - Event details
- `POST /api/events/:id/register` - Register for event
- `POST /api/payments/create` - Create payment
- `POST /api/coupons/validate` - Validate coupon code
- `GET /api/chats/:eventId` - Get event chat messages
- `POST /api/chats/:eventId/message` - Send message
- `POST /api/chat/report` - Report message
- `POST /api/feedback/submit` - Submit event feedback
- `PATCH /api/profile` - Update profile

**Admin Routes** (requires admin role):
- `GET /api/admin/stats` - Dashboard metrics
- `GET /api/admin/users` - List users
- `GET /api/admin/users/:id` - User details
- `PATCH /api/admin/users/:id` - Update user
- `DELETE /api/admin/users/:id` - Delete user
- `GET /api/admin/subscriptions` - List subscriptions
- `POST /api/admin/subscriptions/grant` - Grant free subscription
- `GET /api/admin/payments` - Payment history
- `POST /api/admin/payments/refund` - Issue refund
- `GET /api/admin/venues` - List venues
- `POST /api/admin/venues` - Create venue
- `GET /api/admin/event-templates` - List templates
- `POST /api/admin/event-templates` - Create template
- `GET /api/admin/events` - List all events (admin view)
- `POST /api/admin/events` - Create event
- `PATCH /api/admin/events/:id` - Update event
- `DELETE /api/admin/events/:id` - Cancel event
- `POST /api/admin/events/book-venue` - Book venue
- `GET /api/admin/feedbacks` - List feedbacks
- `GET /api/admin/feedbacks/:id` - Feedback details
- `GET /api/admin/feedbacks/stats` - Aggregate stats
- `GET /api/admin/moderation/reports` - Chat reports
- `PATCH /api/admin/moderation/reports/:id` - Take action
- `GET /api/admin/chat-logs` - Query chat logs
- `GET /api/admin/contents` - CMS content list
- `POST /api/admin/contents` - Create content
- `POST /api/admin/notifications/broadcast` - Send notification
- `GET /api/admin/data-insights` - Analytics data
- `POST /api/admin/matching/test` - Test matching algorithm
- `PATCH /api/admin/matching/weights` - Update weights
- `GET /api/admin/matching-thresholds` - Get pool matching thresholds (NEW v1.1)
- `PUT /api/admin/matching-thresholds/:poolId` - Update thresholds (NEW v1.1)
- `POST /api/admin/trigger-matching/:poolId` - Manually trigger matching (NEW v1.1)
- `GET /api/admin/matching-logs` - Get matching decision history (NEW v1.1)

**Full API documentation:** See `server/routes.ts` (3400+ lines)

---

### 3.4 Matching Algorithm Deep Dive

#### Traditional Event Matching (1-on-1 Compatibility)

**File:** `server/userMatchingService.ts`

**5-Dimensional Scoring System:**

```typescript
function calculateUserMatchScore(user1, user2, weights) {
  // 1. Personality Compatibility (40% default)
  const personalityScore = chemistryMatrix[user1.primaryArchetype][user2.primaryArchetype];
  
  // 2. Interest Overlap (25% default)
  const sharedInterests = intersection(user1.interests, user2.interests);
  const interestScore = (sharedInterests.length / 
    union(user1.interests, user2.interests).length) * 100;
  
  // 3. Background Alignment (15% default)
  const educationMatch = user1.educationLevel === user2.educationLevel ? 80 : 50;
  const industryMatch = user1.industry === user2.industry ? 90 : 60;
  const backgroundScore = (educationMatch + industryMatch) / 2;
  
  // 4. Conversation Compatibility (10% default)
  const opennessGap = Math.abs(user1.opennessScore - user2.opennessScore);
  const extraversionGap = Math.abs(user1.extraversionScore - user2.extraversionScore);
  const conversationScore = 100 - ((opennessGap + extraversionGap) / 20 * 100);
  
  // 5. Intent Alignment (10% default)
  const intentMatch = user1.intent === user2.intent ? 100 : 70;
  
  // Weighted sum
  return (
    personalityScore * weights.personality +
    interestScore * weights.interests +
    backgroundScore * weights.background +
    conversationScore * weights.conversation +
    intentMatch * weights.intent
  );
}
```

**Group Formation Algorithm:**

```typescript
function matchUsersToGroups(users, eventMaxAttendees, weights) {
  // 1. Calculate all pairwise match scores
  const scores = {};
  for (const u1 of users) {
    for (const u2 of users) {
      if (u1.id < u2.id) {
        scores[`${u1.id}-${u2.id}`] = calculateUserMatchScore(u1, u2, weights);
      }
    }
  }
  
  // 2. Greedy clustering algorithm
  const groups = [];
  const assigned = new Set();
  
  while (assigned.size < users.length) {
    const group = [];
    
    // Start with highest-scoring unassigned user
    const seed = users
      .filter(u => !assigned.has(u.id))
      .sort((a, b) => b.totalConnectionScore - a.totalConnectionScore)[0];
    
    group.push(seed);
    assigned.add(seed.id);
    
    // Add users with best average match to group
    while (group.length < eventMaxAttendees) {
      const candidates = users.filter(u => !assigned.has(u.id));
      if (candidates.length === 0) break;
      
      const bestCandidate = candidates.map(candidate => {
        const avgScore = mean(group.map(member => 
          scores[`${Math.min(member.id, candidate.id)}-${Math.max(member.id, candidate.id)}`]
        ));
        return { user: candidate, score: avgScore };
      }).sort((a, b) => b.score - a.score)[0];
      
      group.push(bestCandidate.user);
      assigned.add(bestCandidate.user.id);
    }
    
    groups.push(group);
  }
  
  return groups;
}
```

**Chemistry Matrix (12×12):**

> **Note:** Production matrix uses current 12 archetypes.
> See `apps/server/src/archetypeChemistry.ts` for actual implementation.

Stored in: `apps/server/src/archetypeChemistry.ts`

Sample structure:
```typescript
const chemistryMatrix = {
  "开心柯基": {
    "开心柯基": 70, "太阳鸡": 88, "夸夸豚": 90, "机智狐": 85,
    "淡定海豚": 82, "织网蛛": 83, "暖心熊": 92, "灵感章鱼": 86, ...
  },
  "太阳鸡": {
    "开心柯基": 88, "太阳鸡": 75, "夸夸豚": 85, "机智狐": 80,
    "淡定海豚": 88, "织网蛛": 82, "暖心熊": 87, "灵感章鱼": 83, ...
  },
  // ... 12×12 = 144 unique compatibility scores (0-100 range)
};
```

---

#### Event Pool Matching (Blind Box Group Formation)

**Files:** `server/poolMatchingService.ts`, `server/archetypeChemistry.ts`

**Two-Stage Matching Model:**

**Stage 1:** Admin creates event pools with hard constraints
- Time, location, gender/industry/seniority restrictions
- Pool capacity (e.g., 50 users → 5 groups of 10)

**Stage 2:** Users register with soft preferences, AI matches within pool
- Combines permanent user profiles with temporary event preferences
- Forms optimal groups balancing compatibility, diversity, and energy

**Corrected Scoring Formula (Nov 20, 2025):**

**CRITICAL FIX:** Removed diversity double-counting bug

```typescript
// Pair Compatibility Score (配对兼容性) - 100%
function calculatePairScore(user1, user2, reg1, reg2) {
  // 1. Chemistry (37.5%) - Personality archetype compatibility
  const chemistry = CHEMISTRY_MATRIX[user1.primaryArchetype][user2.primaryArchetype];
  
  // 2. Interest Overlap (31.25%) - Shared topics
  const sharedInterests = intersection(user1.interests, user2.interests);
  const interest = (sharedInterests.length / 
    union(user1.interests, user2.interests).length) * 100;
  
  // 3. Event Preferences (25%) - Budget, cuisine, goals alignment
  const budgetMatch = budgetsOverlap(reg1.budgetRange, reg2.budgetRange) ? 90 : 50;
  const cuisineMatch = overlap(reg1.cuisinePreferences, reg2.cuisinePreferences);
  const goalMatch = overlap(reg1.socialGoals, reg2.socialGoals);
  const preference = (budgetMatch + cuisineMatch + goalMatch) / 3;
  
  // 4. Language Compatibility (18.75%) - Communication ability
  const language = overlap(reg1.languages, reg2.languages);
  
  // Pure compatibility score (NO diversity counted here)
  return chemistry * 0.375 + interest * 0.3125 + preference * 0.25 + language * 0.1875;
}

// Group Diversity Score (群体多样性) - Separate calculation
function calculateGroupDiversity(group) {
  // Diversity metrics (only counted ONCE at group level)
  const uniqueIndustries = new Set(group.map(u => u.industry)).size;
  const uniqueEducation = new Set(group.map(u => u.educationLevel)).size;
  const uniqueArchetypes = new Set(group.map(u => u.primaryArchetype)).size;
  
  const industryDiversity = (uniqueIndustries / group.length) * 100;
  const educationDiversity = (uniqueEducation / group.length) * 100;
  const archetypeDiversity = (uniqueArchetypes / group.length) * 100;
  
  return (industryDiversity + educationDiversity + archetypeDiversity) / 3;
}

// Energy Balance Score (能量平衡度) - NEW in v1.1
function calculateEnergyBalance(group) {
  // Map each archetype to energy level (0-100 scale)
  const energyLevels = group.map(u => ARCHETYPE_ENERGY[u.primaryArchetype]);
  const avgEnergy = mean(energyLevels);
  const stdDev = standardDeviation(energyLevels);
  
  // Ideal: average energy 50-70, low standard deviation
  const avgScore = avgEnergy >= 50 && avgEnergy <= 70 ? 100 : 
                   Math.max(0, 100 - Math.abs(avgEnergy - 60) * 2);
  const harmonyScore = Math.max(0, 100 - stdDev * 3);
  
  return (avgScore + harmonyScore) / 2;
}

// Overall Group Score (综合分数) - UPDATED FORMULA
function formOptimalGroups(pool) {
  // For each candidate group:
  const avgPairScore = mean(allPairScores); // Average compatibility
  const groupDiversity = calculateGroupDiversity(group); // Background richness
  const energyBalance = calculateEnergyBalance(group); // Energy harmony
  
  // New weighted formula (changed from 70/30 to 60/25/15)
  const overallScore = 
    avgPairScore * 0.6 +      // Pair compatibility (similarity)
    groupDiversity * 0.25 +   // Group diversity (richness)
    energyBalance * 0.15;     // Energy balance (harmony)
  
  return overallScore;
}
```

**Conceptual Clarity:**
- **Pair Compatibility** (60%): Do members get along? (similarity)
- **Group Diversity** (25%): Is the group interesting? (richness)
- **Energy Balance** (15%): Is the energy level balanced? (harmony)

**Anti-Repetition System:**

```typescript
// Prevent users from being matched together repeatedly
const matchHistory = await db
  .select()
  .from(matchHistory)
  .where(and(
    eq(matchHistory.userId1, user1.id),
    eq(matchHistory.userId2, user2.id)
  ));

if (matchHistory.length > 0) {
  pairScore *= 0.7; // 30% penalty for repeat matching
}
```

---

### 3.5 Temperature Concept System 🌡️

**NEW in v1.1** (Nov 20, 2025)

**Files:** `server/archetypeChemistry.ts`, `shared/schema.ts`, `shared/wsEvents.ts`

**Purpose:** Provide intuitive visual feedback on match quality using dual-temperature metaphor

#### Dual-Temperature System

**1. Social Energy Temperature (社交能量温度)**

Maps 14 personality archetypes to energy levels (0-100 scale) to prevent unbalanced groups.

```typescript
const ARCHETYPE_ENERGY = {
  // High Energy (80-95)
  社交蝴蝶: 95,        // Social Butterfly - Highest energy
  活动策划者: 90,      // Event Planner
  幽默大师: 85,        // Humor Master
  氛围营造者: 82,      // Atmosphere Creator
  
  // Medium-High Energy (60-75)
  知识分享者: 60,      // Knowledge Sharer
  创意思考者: 55,      // Creative Thinker
  
  // Medium Energy (45-55)
  倾听者: 50,          // Listener
  平衡协调者: 52,      // Balanced Coordinator
  
  // Low Energy (25-40)
  深度对话者: 40,      // Deep Conversationalist
  观察者: 30,          // Observer
  独立思考者: 25,      // Independent Thinker - Lowest energy
  
  // ... all 14 archetypes mapped
};
```

**Energy Balance Calculation:**

```typescript
function calculateEnergyBalance(group) {
  const energyLevels = group.map(user => ARCHETYPE_ENERGY[user.primaryArchetype]);
  const avgEnergy = mean(energyLevels);
  const stdDev = standardDeviation(energyLevels);
  
  // Ideal: Average energy 50-70 (balanced, not too high or too low)
  const avgScore = (avgEnergy >= 50 && avgEnergy <= 70) ? 100 : 
                   Math.max(0, 100 - Math.abs(avgEnergy - 60) * 2);
  
  // Ideal: Low standard deviation (harmony, not too much variance)
  const harmonyScore = Math.max(0, 100 - stdDev * 3);
  
  return (avgScore + harmonyScore) / 2;
}
```

**Why This Matters:**
- Prevents all-高能量 groups (exhausting, chaotic)
- Prevents all-低能量 groups (awkward silences, low engagement)
- Creates balanced social dynamics with natural conversation flow

**2. Chemistry Reaction Temperature (化学反应温度)**

Visual emoji indicators for overall match quality, displayed to users and admins.

```typescript
function getTemperatureLevel(score) {
  if (score >= 85) return "🔥 炽热"; // Fire - Exceptional compatibility
  if (score >= 70) return "🌡️ 温暖"; // Warm - Strong compatibility
  if (score >= 55) return "🌤️ 适宜"; // Mild - Moderate compatibility
  return "❄️ 冷淡";                  // Cold - Low compatibility
}
```

| Emoji | Chinese | English | Score | Meaning |
|-------|---------|---------|-------|---------|
| 🔥 | 炽热 | Fire | ≥85 | Exceptional match - Instant chemistry |
| 🌡️ | 温暖 | Warm | 70-84 | Strong match - Good compatibility |
| 🌤️ | 适宜 | Mild | 55-69 | Moderate match - Acceptable fit |
| ❄️ | 冷淡 | Cold | <55 | Low match - Poor compatibility |

#### UI Integration

**Admin Matching Logs Page:**
```tsx
// Display temperature emoji next to average score
<div className="text-2xl font-bold text-green-600">
  {getTemperatureEmoji(log.avgGroupScore)} {log.avgGroupScore}分
</div>
```

**User WebSocket Notifications:**
```typescript
// POOL_MATCHED event includes temperatureLevel
interface PoolMatchedData {
  poolId: string;
  poolTitle: string;
  groupId: string;
  groupNumber: number;
  matchScore: number;
  memberCount: number;
  temperatureLevel: string; // "🔥 炽热", "🌡️ 温暖", etc.
}

// Toast notification displays temperature
toast({
  title: `🎉 匹配成功！`,
  description: `${data.temperatureLevel} · 小组 ${data.groupNumber} · 匹配度 ${data.matchScore}分`,
});
```

**Group Explanation Text:**
```typescript
function generateGroupExplanation(group, scores) {
  const energyDesc = scores.energyBalance >= 70 ? 
    "小组能量分布均衡，既有活跃的引导者，也有善于倾听的成员" :
    "小组能量较为集中，建议适当调整互动节奏";
    
  const tempDesc = scores.temperatureLevel === "🔥 炽热" ?
    "这是一个化学反应极强的小组！" :
    scores.temperatureLevel === "🌡️ 温暖" ?
    "这个小组有很好的匹配度" :
    "这个小组有一定的匹配度";
    
  return `${tempDesc} ${energyDesc}`;
}
```

#### Database Schema

**eventPoolGroups table (updated):**
```sql
CREATE TABLE event_pool_groups (
  id VARCHAR PRIMARY KEY,
  pool_id VARCHAR REFERENCES event_pools(id),
  group_number INTEGER,
  
  -- Existing scores
  avg_pair_score INTEGER,      -- Average pairwise compatibility
  diversity_score INTEGER,      -- Group background diversity
  overall_score INTEGER,        -- Final weighted score
  
  -- NEW in v1.1
  energy_balance INTEGER,       -- Social energy harmony score (0-100)
  temperature_level VARCHAR,    -- Visual indicator: "🔥 炽热", "🌡️ 温暖", etc.
  
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### Impact & Benefits

**For Users:**
- Intuitive understanding of match quality (emoji > number)
- Transparent expectations before event
- Reduces anxiety about "will I fit in?"

**For Admins:**
- Quick visual scan of matching quality in logs
- Easier to spot problematic groups
- Data-driven insights for algorithm tuning

**For Algorithm:**
- Prevents edge cases (all introverts or all extroverts)
- Balances similarity (pair score) with diversity and energy
- More nuanced group formation

---

## 📊 Implementation Status

### Feature Completion Matrix

| Module | Status | Files | Notes |
|--------|--------|-------|-------|
| **User Registration** | ✅ Complete | `RegistrationPage.tsx`, `phoneAuth.ts` | SMS + bcrypt |
| **Personality Test** | ✅ Complete | `PersonalityTestPage.tsx`, 10 questions | 14 archetypes |
| **Event Discovery** | ✅ Complete | `DiscoverPage.tsx`, `BlindBoxEventDetailPage.tsx` | Blind box system |
| **Match Scoring** | ✅ Complete | `userMatchingService.ts` | 5-dimensional |
| **Payment Integration** | ✅ Complete | `paymentService.ts`, WeChat Pay | Webhook handling |
| **Subscription Management** | ✅ Complete | `subscriptionService.ts` | Auto-expiry |
| **Chat System** | ✅ Complete | `EventChatDetailPage.tsx`, WebSocket | Real-time |
| **Feedback System** | ✅ Complete | `EventFeedbackFlow.tsx`, 2-tier | Basic + Deep |
| **Admin Dashboard** | ✅ Complete | `AdminDashboard.tsx` | 5 key metrics |
| **User Management** | ✅ Complete | `AdminUsersPage.tsx` | CRUD + analytics |
| **Venue Management** | ✅ Complete | `AdminVenuesPage.tsx`, `venueMatchingService.ts` | Auto-matching |
| **Event Templates** | ✅ Complete | `AdminEventTemplatesPage.tsx` | Reusable configs |
| **Matching Lab** | ✅ Complete | `AdminMatchingLabPage.tsx` | Weight tuning |
| **Content Management** | ✅ Complete | `AdminContentPage.tsx` | CMS for announcements |
| **Notification System** | ✅ Complete | `AdminNotificationsPage.tsx` | Broadcast |
| **Moderation System** | ✅ Complete | `AdminModerationPage.tsx`, `AdminReportsPage.tsx` | Report handling |
| **Chat Logs** | ✅ Complete | `AdminChatLogsPage.tsx` | Audit trail |
| **Data Insights** | ✅ Complete | `AdminDataInsightsPage.tsx` | 7 analytics modules |
| **Feedback Management** | ✅ Complete | `AdminFeedbackPage.tsx` | Review interface |
| **WebSocket Sync** | ✅ Complete | `wsService.ts`, `useWebSocket.ts` | Bidirectional |
| **Temperature Concept** | ✅ Complete (v1.1) | `archetypeChemistry.ts`, `poolMatchingService.ts` | Dual-temperature system |
| **Real-time Dynamic Matching** | ✅ Complete (v1.1) | `poolRealtimeMatchingService.ts`, `AdminMatchingConfigPage.tsx` | Three-tier threshold system |
| **Invitation & Viral Growth** | ✅ Complete (v1.1) | `poolMatchingService.ts`, `user_coupons` table | Auto-coupon issuance |
| **Event Pool User Flow** | ✅ Complete (v1.1) | `EventPoolRegistrationPage.tsx`, `PoolRegistrationCard.tsx` | Two-stage matching UI |

---

## 🔐 Security & Privacy

**Authentication:**
- Session-based with 7-day TTL
- HTTP-only cookies
- CSRF protection

**Data Privacy:**
- Phone numbers masked in admin UI (198****0978)
- Deep feedback is anonymous (user_id nullable)
- Chat logs encrypted at rest

**Payment Security:**
- PCI DSS compliant (via WeChat Pay)
- Webhook signature verification
- Idempotency keys for duplicate prevention

**Moderation:**
- Automated keyword flagging
- Manual admin review required for bans
- All moderation actions logged for audit

---

## 🚀 Deployment & Environment

**Production Environment:**
- Database: PostgreSQL (Neon serverless)
- Session Store: PostgreSQL
- File Storage: (TBD - planned: Replit Object Storage)
- Real-time: WebSocket over WSS

**Environment Variables:**
```bash
DATABASE_URL=postgresql://...
SESSION_SECRET=...
WECHAT_PAY_APP_ID=...
WECHAT_PAY_MCH_ID=...
WECHAT_PAY_API_KEY=...
NODE_ENV=production
```

**Build Command:**
```bash
npm run build
```

**Start Command:**
```bash
npm run dev
```

---

## 📁 File Structure Reference

```
joyjoin/
├── client/src/
│   ├── pages/
│   │   ├── admin/                    # 18 admin pages
│   │   │   ├── AdminDashboard.tsx
│   │   │   ├── AdminUsersPage.tsx
│   │   │   ├── AdminSubscriptionsPage.tsx
│   │   │   ├── AdminCouponsPage.tsx
│   │   │   ├── AdminVenuesPage.tsx
│   │   │   ├── AdminEventTemplatesPage.tsx
│   │   │   ├── AdminEventsPage.tsx
│   │   │   ├── AdminFinancePage.tsx
│   │   │   ├── AdminDataInsightsPage.tsx
│   │   │   ├── AdminFeedbackPage.tsx
│   │   │   ├── AdminMatchingLabPage.tsx
│   │   │   ├── AdminContentPage.tsx
│   │   │   ├── AdminNotificationsPage.tsx
│   │   │   ├── AdminModerationPage.tsx
│   │   │   ├── AdminReportsPage.tsx
│   │   │   └── AdminChatLogsPage.tsx
│   │   ├── RegistrationPage.tsx      # Phone auth
│   │   ├── PersonalityTestPage.tsx   # 10 questions
│   │   ├── PersonalityTestResultPage.tsx
│   │   ├── DiscoverPage.tsx          # Event browsing
│   │   ├── BlindBoxEventDetailPage.tsx
│   │   ├── BlindBoxPaymentPage.tsx
│   │   ├── EventChatDetailPage.tsx
│   │   ├── EventFeedbackFlow.tsx
│   │   ├── DeepFeedbackFlow.tsx
│   │   └── ... (30+ pages total)
│   ├── components/
│   │   ├── ui/                       # shadcn components
│   │   ├── PersonalityRadarChart.tsx
│   │   ├── AttendeePreviewCard.tsx
│   │   ├── StackedAttendeeCards.tsx
│   │   └── feedback/
│   │       ├── ConnectionRadar.tsx
│   │       ├── TraitTagsWall.tsx
│   │       └── SelectConnectionsStep.tsx
│   ├── lib/
│   │   ├── archetypes.ts            # 14 archetype configs
│   │   ├── archetypeAvatars.ts      # Gradients + emojis
│   │   ├── matchExplanation.ts
│   │   └── queryClient.ts
│   └── hooks/
│       ├── useAuth.ts
│       └── useWebSocket.ts
├── server/
│   ├── routes.ts                    # 3400+ lines, all API routes
│   ├── storage.ts                   # Database layer
│   ├── phoneAuth.ts                 # SMS verification
│   ├── paymentService.ts            # WeChat Pay
│   ├── subscriptionService.ts       # Auto-expiry
│   ├── venueMatchingService.ts      # Venue algorithm
│   ├── userMatchingService.ts       # User matching (5D)
│   ├── wsService.ts                 # WebSocket server
│   └── eventBroadcast.ts            # Real-time sync
├── shared/
│   └── schema.ts                    # 3000+ lines, full DB schema
└── db/
    └── index.ts                     # Drizzle connection
```

---

## 🎓 Onboarding Quick Start

**For New Developers:**

1. **Setup:**
   ```bash
   git clone <repo>
   npm install
   npm run db:push  # Sync database schema
   npm run dev      # Start development server
   ```

2. **Admin Login:**
   - Phone: `19896500978`
   - Password: `Lasalle11`
   - Navigate to `/admin`

3. **Key Files to Read First:**
   - `replit.md` - Project overview
   - `shared/schema.ts` - Database structure
   - `server/routes.ts` - API endpoints
   - `client/src/App.tsx` - Routing

4. **Common Tasks:**
   - Add new API endpoint → `server/routes.ts`
   - Add new admin page → `client/src/pages/admin/`
   - Modify matching → `server/userMatchingService.ts`
   - Update schema → `shared/schema.ts` + `npm run db:push`

**For Product Managers:**

- User flows: See Section 1 (User App Features)
- Admin capabilities: See Section 2 (Admin Portal Features)
- Analytics: AdminDataInsightsPage provides all metrics
- Feedback: AdminFeedbackPage shows user sentiment

**For Designers:**

- Design system: shadcn/ui components in `client/src/components/ui/`
- Color palette: Defined in `client/src/index.css`
- Personality archetype branding: `client/src/lib/archetypeAvatars.ts`
- Dark mode: Fully supported via Tailwind classes

---

## 📝 Changelog & Version History

**v1.0 (Current) - November 14, 2025**
- ✅ Complete user app with blind box events
- ✅ 14 personality archetype system
- ✅ 5-dimensional matching algorithm
- ✅ WeChat Pay integration
- ✅ Comprehensive admin portal (18 pages)
- ✅ Real-time WebSocket sync
- ✅ Two-tier feedback system
- ✅ Data insights dashboard
- ✅ Chat moderation system

**Planned for v1.1:**
- [ ] Mobile app (React Native)
- [ ] AI-generated conversation starters
- [ ] Video introduction profiles
- [ ] Advanced A/B testing framework
- [ ] Multi-language support (English full launch)

---

## 📞 Support & Resources

**Documentation:**
- This PRD
- `replit.md` - Project architecture
- API docs: See `server/routes.ts` inline comments
- Component docs: See component prop interfaces

**Developer Resources:**
- Database tool: Use `/api/admin` routes or execute_sql_tool
- Testing: Use run_test tool for playwright tests
- Logs: Check workflow logs in Replit

**Contact:**
- Technical lead: [TBD]
- Product owner: [TBD]
- Design lead: [TBD]

---

**End of Product Requirements Document**

*Last updated: November 14, 2025*  
*Document version: 1.0*  
*Total pages: ~50 (Markdown equivalent)*
