# JoyJoin Developer Quick Reference Guide

**Version:** 1.1  
**Last Updated:** November 20, 2025  
**For:** Tech Team Onboarding & Codebase Navigation

---

## 🎯 Quick Start

### Database Migration (REQUIRED)
```bash
# Run this FIRST after pulling latest changes
npm run db:push
```

**Why:** New columns added to `eventPoolGroups` table (`energyBalance`, `temperatureLevel`)

### Development Server
```bash
npm run dev
# Runs on port 5000 - both frontend and backend
```

---

## 📂 Codebase Structure

```
joyjoin/
├── client/src/               # Frontend (React + TypeScript)
│   ├── pages/                # Page components
│   │   ├── admin/            # Admin portal pages
│   │   └── *.tsx             # User-facing pages
│   └── components/           # Reusable UI components
│
├── server/                   # Backend (Express + TypeScript)
│   ├── routes.ts             # API endpoints (3400+ lines)
│   ├── *Service.ts           # Business logic services
│   ├── db.ts                 # Database connection
│   └── index.ts              # Server entry point
│
└── shared/                   # Shared types & schemas
    ├── schema.ts             # Drizzle ORM database schema
    └── wsEvents.ts           # WebSocket event interfaces
```

---

## 🔥 Feature 1: Temperature Concept System

**What:** Dual-temperature visualization for match quality (Social Energy + Chemistry Reaction)

### Files to Know

| File | Purpose | Key Functions |
|------|---------|---------------|
| `server/archetypeChemistry.ts` | Core temperature logic | `ARCHETYPE_ENERGY` (energy mappings)<br>`calculateEnergyBalance()` (group energy calculation)<br>`getTemperatureLevel()` (emoji mapping)<br>`generateGroupExplanation()` (user-facing text) |
| `server/poolMatchingService.ts` | Integration into matching | `formOptimalGroups()` - uses energy balance in scoring<br>`saveMatchResults()` - stores energy & temperature to DB |
| `shared/schema.ts` | Database schema | `eventPoolGroups.energyBalance` (integer)<br>`eventPoolGroups.temperatureLevel` (varchar) |
| `shared/wsEvents.ts` | WebSocket interface | `PoolMatchedData.temperatureLevel` (string) |
| `client/src/pages/admin/AdminMatchingLogsPage.tsx` | Admin UI | `getTemperatureEmoji()` helper<br>Displays emoji next to avg score |
| `client/src/pages/EventsPage.tsx` | User notifications | Toast displays temperature emoji |

### Algorithm Formula (UPDATED)

```typescript
// OLD (Flawed): 70/30 split with diversity counted twice
overallScore = avgPairScore × 0.7 + groupDiversity × 0.3

// NEW (Corrected): 60/25/15 split
overallScore = avgPairScore × 0.6 + groupDiversity × 0.25 + energyBalance × 0.15
```

### Energy Levels Reference

```typescript
High Energy (80-95):    社交蝴蝶 (95), 活动策划者 (90), 幽默大师 (85)
Medium Energy (45-60):  知识分享者 (60), 创意思考者 (55), 倾听者 (50)
Low Energy (25-40):     深度对话者 (40), 观察者 (30), 独立思考者 (25)
```

### Temperature Thresholds

```typescript
🔥 炽热 (Fire):   score ≥ 85  // Exceptional compatibility
🌡️ 温暖 (Warm):   score 70-84 // Strong compatibility
🌤️ 适宜 (Mild):   score 55-69 // Moderate compatibility
❄️ 冷淡 (Cold):   score < 55  // Low compatibility
```

### Debugging Tips
- Check `ARCHETYPE_ENERGY` constant for energy value mappings
- Verify `calculateEnergyBalance()` logic if groups feel unbalanced
- Monitor `eventPoolGroups` table for stored energy/temperature values
- Admin Matching Logs page shows temperature emoji for visual verification

---

## 🔧 Feature 2: Matching Algorithm Fix (Diversity Double-Counting)

**What:** Removed critical bug where diversity was counted twice in scoring

### Files Modified

| File | Change | Impact |
|------|--------|--------|
| `server/archetypeChemistry.ts` | Removed diversity from `calculatePairScore()` | Pair score now pure compatibility (chemistry + interest + preference + language) |
| `server/poolMatchingService.ts` | Updated `formOptimalGroups()` formula | Changed from 70/30 to 60/25/15 weighting |

### What Changed

**Old Logic (FLAWED):**
```typescript
// calculatePairScore() included 10% diversity
pairScore = chemistry × 0.4 + interest × 0.3 + preference × 0.2 + diversity × 0.1

// Then diversity counted AGAIN at group level
overallScore = avgPairScore × 0.7 + groupDiversity × 0.3
// Result: Diversity weighted at ~37% total! 😱
```

**New Logic (CORRECTED):**
```typescript
// Pair Compatibility Score - 100% pure compatibility (NO diversity)
pairScore = chemistry × 0.375 + interest × 0.3125 + preference × 0.25 + language × 0.1875

// Diversity only counted ONCE at group level
overallScore = avgPairScore × 0.6 + groupDiversity × 0.25 + energyBalance × 0.15
```

### Variable Renames for Clarity

| Old Name | New Name | Reason |
|----------|----------|--------|
| `avgChemistry` | `avgPairScore` | More accurate - it's average of all pair compatibility scores |
| `calculateGroupChemistry()` | `calculateGroupPairScore()` | Clarifies it's calculating pairwise compatibility |

### Testing Impact
- Groups should now have better balance between similarity (60%) and diversity (25%)
- Energy balance (15%) prevents extreme energy groups
- Monitor feedback: Are users happier with matches?

---

## ⚡ Feature 3: Real-time Dynamic Matching System

**What:** Automated continuous matching with adaptive thresholds (no manual admin intervention)

### Files to Know

| File | Purpose | Key Functions |
|------|---------|---------------|
| `server/poolRealtimeMatchingService.ts` | Core matching engine | `scanAllPools()` - Main scheduler function<br>`scanPoolForMatching()` - Single pool scan<br>`calculateTimeDecayThreshold()` - Adaptive thresholds<br>`logMatchingDecision()` - Audit trail |
| `server/poolMatchingService.ts` | Group formation logic | `matchEventPool()` - Creates optimal groups<br>`saveMatchResults()` - Persists to database |
| `shared/schema.ts` | Database tables | `matchingThresholds` - Configurable parameters<br>`poolMatchingLogs` - Decision history |
| `client/src/pages/admin/AdminMatchingConfigPage.tsx` | Admin configuration UI | Threshold tuning interface |
| `client/src/pages/admin/AdminMatchingLogsPage.tsx` | Decision history viewer | Visualizes scan results |
| `server/routes.ts` | API endpoints | `GET /api/admin/matching-thresholds`<br>`PUT /api/admin/matching-thresholds/:poolId`<br>`POST /api/admin/trigger-matching/:poolId`<br>`GET /api/admin/matching-logs` |

### Three-Tier Threshold System

```typescript
const DEFAULT_THRESHOLDS = {
  highQualityThreshold: 85,    // Instant match (exceptional compatibility)
  mediumQualityThreshold: 70,  // Wait for better options
  lowQualityThreshold: 55,     // Wait until deadline
  // < 55: Reject (insufficient compatibility)
};
```

### Time Decay Algorithm

```typescript
function calculateTimeDecayThreshold(hoursUntilEvent, baseThreshold) {
  if (hoursUntilEvent > 72) return baseThreshold;         // Full threshold
  if (hoursUntilEvent > 48) return baseThreshold - 5;     // -5 points
  if (hoursUntilEvent > 24) return baseThreshold - 10;    // -10 points
  if (hoursUntilEvent > 12) return baseThreshold - 15;    // -15 points
  return Math.max(50, baseThreshold - 20);                // -20 points (min 50)
}
```

**Why:** Ensures users get matched even as deadline approaches (prevents last-minute unmatched users)

### Matching Triggers

1. **Instant Scan:** When user registers for event pool → `scanPoolForMatching(poolId)`
2. **Hourly Scan:** Cron job every 60 minutes → `scanAllPools()`
3. **Final 24h Scan:** Every 30 minutes in last 24 hours
4. **Manual Trigger:** Admin clicks "Trigger Matching" → API call

### Database Tables

**matchingThresholds:**
```sql
CREATE TABLE matching_thresholds (
  pool_id VARCHAR PRIMARY KEY REFERENCES event_pools(id),
  high_quality_threshold INTEGER DEFAULT 85,
  medium_quality_threshold INTEGER DEFAULT 70,
  low_quality_threshold INTEGER DEFAULT 55,
  updated_at TIMESTAMP
);
```

**poolMatchingLogs:**
```sql
CREATE TABLE pool_matching_logs (
  id VARCHAR PRIMARY KEY,
  pool_id VARCHAR REFERENCES event_pools(id),
  scan_type VARCHAR,                  -- "realtime" | "scheduled" | "manual"
  pending_users_count INTEGER,
  current_threshold INTEGER,
  time_until_event INTEGER,
  groups_formed INTEGER,
  users_matched INTEGER,
  avg_group_score INTEGER,
  decision VARCHAR,                   -- "matched" | "waiting" | "insufficient"
  reason TEXT,
  triggered_by VARCHAR,               -- "user_registration" | "cron_job" | "admin_manual"
  created_at TIMESTAMP
);
```

### Debugging Tips
- Check `poolMatchingLogs` table for decision history
- Monitor `scanType` to see trigger source
- Review `reason` field for why matching succeeded/failed
- Admin Matching Logs page shows visual history
- Use Admin Matching Config to tune thresholds per pool

---

## 🎁 Feature 4: Invitation & Viral Growth System

**What:** Auto-issue ¥50 INVITE_REWARD coupon when invited users match together

### Files to Know

| File | Purpose | Key Logic |
|------|---------|-----------|
| `server/poolMatchingService.ts` | Auto-coupon issuance | `saveMatchResults()` - Checks invitation relationships<br>Issues coupon to inviter when invitees match |
| `shared/schema.ts` | Database tables | `invitations` - Tracks who invited whom<br>`invitation_uses` - Tracks coupon rewards<br>`user_coupons` - Coupon assignments |
| Frontend UI components | Badge display | Purple "已邀请 [name]" for inviters<br>Blue "[name] 邀请的" for invitees |

### Invitation Flow

```typescript
// 1. User A invites User B (creates invitation record)
INSERT INTO invitations (inviter_id, invitee_id, invitation_code);

// 2. User B registers using invitation code
UPDATE invitations SET status = 'accepted' WHERE invitation_code = code;

// 3. User B gets matched in an event pool
// saveMatchResults() checks: "Is User B an invitee?"
const invitation = await db.select().from(invitations)
  .where(and(
    eq(invitations.inviteeId, userB.id),
    eq(invitations.status, 'accepted')
  ));

// 4. If yes, issue ¥50 coupon to User A (inviter)
INSERT INTO user_coupons (user_id, coupon_type, amount, source)
VALUES (invitationRecord.inviterId, 'INVITE_REWARD', 50, 'invitation_reward');

// 5. Log the reward
INSERT INTO invitation_uses (invitation_id, event_pool_id, rewarded_at);
```

### Database Tables

**invitations:**
```sql
CREATE TABLE invitations (
  id VARCHAR PRIMARY KEY,
  inviter_id VARCHAR REFERENCES users(id),
  invitee_id VARCHAR REFERENCES users(id),
  invitation_code VARCHAR UNIQUE,
  status VARCHAR,  -- "pending" | "accepted" | "expired"
  created_at TIMESTAMP
);
```

**invitation_uses:**
```sql
CREATE TABLE invitation_uses (
  id VARCHAR PRIMARY KEY,
  invitation_id VARCHAR REFERENCES invitations(id),
  event_pool_id VARCHAR REFERENCES event_pools(id),
  rewarded_at TIMESTAMP
);
```

**user_coupons:**
```sql
CREATE TABLE user_coupons (
  id VARCHAR PRIMARY KEY,
  user_id VARCHAR REFERENCES users(id),
  coupon_type VARCHAR,
  amount INTEGER,
  source VARCHAR,  -- "invitation_reward" | "admin_grant" | etc.
  status VARCHAR,  -- "available" | "used" | "expired"
  created_at TIMESTAMP
);
```

### Debugging Tips
- Check `invitation_uses` table to see if coupons were issued
- Verify `invitations.status = 'accepted'` before expecting rewards
- Monitor `user_coupons` for coupon assignments
- Test with 2 test users: one invites, one accepts and gets matched

---

## 🎭 Feature 5: Event Pool User Flow

**What:** Complete two-stage matching model UI (users register for pools with soft preferences)

### Files to Know

| File | Purpose | Key Components |
|------|---------|----------------|
| `client/src/pages/DiscoverPage.tsx` | Event pool discovery | Fetches `/api/event-pools`<br>Displays blind box event cards |
| `client/src/pages/EventPoolRegistrationPage.tsx` | User registration | Soft preference selection form<br>Budget, cuisine, social goals, dietary restrictions |
| `client/src/pages/EventsPage.tsx` | Registration status | Displays pool registrations alongside events<br>Status-based filtering (pending/matched/completed) |
| `client/src/components/PoolRegistrationCard.tsx` | Status display card | Shows registration status and match scores |
| `client/src/components/BlindBoxEventCard.tsx` | Event pool card | Navigates to registration page on click |
| `server/routes.ts` | API endpoints | `GET /api/event-pools` - List active pools<br>`POST /api/event-pools/:id/register` - Register with preferences |
| `shared/schema.ts` | Database tables | `eventPools` - Admin-created pools<br>`eventPoolRegistrations` - User signups + preferences<br>`eventPoolGroups` - Matched groups |

### User Journey

```
DiscoverPage 
  ↓ (Click blind box event)
EventPoolRegistrationPage 
  ↓ (Submit preferences)
EventsPage → "待匹配" tab
  ↓ (Matching happens in background)
EventsPage → "已匹配" tab (auto-switch via WebSocket)
  ↓
PoolRegistrationCard shows match score & temperature
```

### Registration Preferences (Soft Constraints)

```typescript
interface EventPoolRegistration {
  userId: string;
  poolId: string;
  
  // Soft preferences (used in matching algorithm)
  budgetRange: string[];          // ["50-100", "100-200"]
  languages: string[];            // ["粤语", "英语", "普通话"]
  socialGoals: string[];          // ["认识新朋友", "扩展人脉", "深度交流"]
  cuisinePreferences: string[];   // ["粤菜", "西餐", "日料"]
  dietaryRestrictions: string[];  // ["素食", "清真", "无"]
  tasteIntensity: string;         // "清淡" | "适中" | "重口味"
  
  status: string;                 // "pending" | "matched" | "completed" | "cancelled"
  matchedGroupId: string | null;
  matchScore: number | null;
}
```

### Database Tables

**eventPools:**
```sql
CREATE TABLE event_pools (
  id VARCHAR PRIMARY KEY,
  title VARCHAR,
  description TEXT,
  event_type VARCHAR,
  event_date_time TIMESTAMP,
  location VARCHAR,
  
  -- Hard constraints (admin-set)
  gender_restrictions VARCHAR[],
  industry_restrictions VARCHAR[],
  seniority_restrictions VARCHAR[],
  education_level_restrictions VARCHAR[],
  
  status VARCHAR,  -- "active" | "matching" | "completed" | "cancelled"
  created_at TIMESTAMP
);
```

**eventPoolRegistrations:**
```sql
CREATE TABLE event_pool_registrations (
  id VARCHAR PRIMARY KEY,
  user_id VARCHAR REFERENCES users(id),
  pool_id VARCHAR REFERENCES event_pools(id),
  
  -- Soft preferences
  budget_range VARCHAR[],
  languages VARCHAR[],
  social_goals VARCHAR[],
  cuisine_preferences VARCHAR[],
  dietary_restrictions VARCHAR[],
  taste_intensity VARCHAR,
  
  status VARCHAR,
  matched_group_id VARCHAR REFERENCES event_pool_groups(id),
  match_score INTEGER,
  created_at TIMESTAMP
);
```

**eventPoolGroups:**
```sql
CREATE TABLE event_pool_groups (
  id VARCHAR PRIMARY KEY,
  pool_id VARCHAR REFERENCES event_pools(id),
  group_number INTEGER,
  
  -- Scoring
  avg_pair_score INTEGER,
  diversity_score INTEGER,
  energy_balance INTEGER,        -- NEW in v1.1
  overall_score INTEGER,
  temperature_level VARCHAR,     -- NEW in v1.1
  
  explanation TEXT,
  created_at TIMESTAMP
);
```

### API Endpoints

```typescript
// List active event pools
GET /api/event-pools
Response: EventPool[]

// Register for event pool
POST /api/event-pools/:poolId/register
Body: {
  budgetRange: string[],
  languages: string[],
  socialGoals: string[],
  cuisinePreferences: string[],
  dietaryRestrictions: string[],
  tasteIntensity: string
}
Response: { registrationId: string }

// Get user's pool registrations
GET /api/event-pool-registrations
Response: EventPoolRegistration[]
```

### Debugging Tips
- Check `/api/event-pools` endpoint returns active pools
- Verify `eventPools.status = 'active'` for discoverable pools
- Monitor `eventPoolRegistrations` table for user signups
- Check `EventsPage` properly filters by status (pending/matched/completed)
- WebSocket `POOL_MATCHED` event should trigger auto-switch to "已匹配" tab

---

## 🔔 Feature 6: WebSocket Real-time Notifications

**What:** Instant user notifications when matched (POOL_MATCHED event)

### Files to Know

| File | Purpose | Key Logic |
|------|---------|-----------|
| `server/poolMatchingService.ts` | Broadcasts match event | `saveMatchResults()` calls `wsService.broadcastToUser()`<br>Sends `POOL_MATCHED` event to all matched users |
| `shared/wsEvents.ts` | Event interface | `PoolMatchedData` interface with all match details |
| `client/src/pages/EventsPage.tsx` | Event subscription | Subscribes to `POOL_MATCHED` via WebSocket<br>Displays toast notification<br>Invalidates cache + auto-switches to "已匹配" tab |
| `server/wsService.ts` | WebSocket server | Manages connections and broadcasts |

### WebSocket Event Flow

```typescript
// 1. Admin completes matching (or auto-matching triggers)
await matchEventPool(poolId);

// 2. Backend saves results and broadcasts
for (const userId of matchedUserIds) {
  wsService.broadcastToUser(userId, {
    type: 'POOL_MATCHED',
    data: {
      poolId: pool.id,
      poolTitle: pool.title,
      groupId: group.id,
      groupNumber: group.groupNumber,
      matchScore: group.overallScore,
      memberCount: group.members.length,
      temperatureLevel: group.temperatureLevel  // NEW in v1.1
    }
  });
}

// 3. Frontend receives event
useEffect(() => {
  const ws = new WebSocket('/ws');
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.type === 'POOL_MATCHED') {
      // Show toast notification
      toast({
        title: "🎉 匹配成功！",
        description: `${message.data.temperatureLevel} · 小组 ${message.data.groupNumber} · 匹配度 ${message.data.matchScore}分`
      });
      
      // Invalidate cache
      queryClient.invalidateQueries(['/api/event-pool-registrations']);
      
      // Auto-switch to matched tab
      setActiveTab('matched');
    }
  };
}, []);
```

### WebSocket Event Interface

```typescript
// shared/wsEvents.ts
export interface PoolMatchedData {
  poolId: string;
  poolTitle: string;
  groupId: string;
  groupNumber: number;
  matchScore: number;
  memberCount: number;
  temperatureLevel: string;  // "🔥 炽热", "🌡️ 温暖", etc. (NEW in v1.1)
}

export interface WebSocketMessage {
  type: 'POOL_MATCHED' | 'EVENT_STATUS_CHANGED' | ...;
  data: PoolMatchedData | ...;
}
```

### Debugging Tips
- Check WebSocket connection in browser DevTools (Network tab → WS)
- Monitor `ws.readyState` to verify connection status
- Log `ws.onmessage` events to see incoming messages
- Verify `wsService.broadcastToUser()` is called in `saveMatchResults()`
- Check toast notifications appear when `POOL_MATCHED` received
- Confirm cache invalidation triggers re-fetch of registrations

---

## 🔍 Feature 7: Event Pool Discovery Fix

**What:** Fixed `/api/event-pools` endpoint to display admin-created blind box events

### Files Modified

| File | Change | Impact |
|------|--------|--------|
| `server/routes.ts` | Fixed `/api/event-pools` endpoint | Now returns active pools correctly |
| `shared/schema.ts` | Schema synchronization | Added missing columns: `description`, `eventType`, `educationLevelRestrictions` |
| `client/src/pages/DiscoverPage.tsx` | Data fetching | Successfully fetches and displays event pools |

### What Was Broken

**Before:**
- `/api/event-pools` returned empty array even with active pools
- Status was inconsistent (`published` vs `recruiting` vs `active`)
- Missing required columns in database schema

**After:**
- Unified status to `active` for all discoverable pools
- Schema synchronized with all required fields
- DiscoverPage successfully displays event pools

### Database Schema Sync

```sql
-- Ensure these columns exist
ALTER TABLE event_pools 
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS event_type VARCHAR,
ADD COLUMN IF NOT EXISTS education_level_restrictions VARCHAR[];

-- Unified status values
UPDATE event_pools SET status = 'active' WHERE status IN ('published', 'recruiting');
```

### API Endpoint

```typescript
// GET /api/event-pools
app.get("/api/event-pools", async (req, res) => {
  const pools = await db
    .select()
    .from(eventPools)
    .where(eq(eventPools.status, 'active'))  // Unified to 'active'
    .orderBy(desc(eventPools.createdAt));
  
  res.json(pools);
});
```

### Debugging Tips
- Verify `eventPools.status = 'active'` in database
- Check schema has all required columns (description, eventType, etc.)
- Test `/api/event-pools` endpoint directly (should return array)
- Confirm DiscoverPage fetches and renders event pools

---

## 🗄️ Database Schema Updates (v1.1)

### New Columns

**eventPoolGroups:**
```sql
ALTER TABLE event_pool_groups 
ADD COLUMN energy_balance INTEGER,
ADD COLUMN temperature_level VARCHAR;
```

### New Tables

**matchingThresholds:**
```sql
CREATE TABLE matching_thresholds (
  pool_id VARCHAR PRIMARY KEY REFERENCES event_pools(id),
  high_quality_threshold INTEGER DEFAULT 85,
  medium_quality_threshold INTEGER DEFAULT 70,
  low_quality_threshold INTEGER DEFAULT 55,
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**poolMatchingLogs:**
```sql
CREATE TABLE pool_matching_logs (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id VARCHAR REFERENCES event_pools(id),
  scan_type VARCHAR,
  pending_users_count INTEGER DEFAULT 0,
  current_threshold INTEGER,
  time_until_event INTEGER,
  groups_formed INTEGER DEFAULT 0,
  users_matched INTEGER DEFAULT 0,
  avg_group_score INTEGER,
  decision VARCHAR,
  reason TEXT,
  triggered_by VARCHAR,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 🔌 New API Endpoints (v1.1)

### Admin Matching Configuration

```typescript
// Get matching thresholds for a pool
GET /api/admin/matching-thresholds?poolId={poolId}
Response: MatchingThreshold

// Update matching thresholds
PUT /api/admin/matching-thresholds/:poolId
Body: {
  highQualityThreshold: number,
  mediumQualityThreshold: number,
  lowQualityThreshold: number
}
Response: MatchingThreshold

// Manually trigger matching scan
POST /api/admin/trigger-matching/:poolId
Response: { message: string, scanResult: MatchingScanResult }

// Get matching decision history
GET /api/admin/matching-logs?poolId={poolId}&scanType={type}&decision={decision}&limit={limit}
Response: PoolMatchingLog[]
```

---

## 🧪 Testing Checklist

### Temperature Concept
- [ ] Verify `ARCHETYPE_ENERGY` mappings are correct
- [ ] Test `calculateEnergyBalance()` with different group compositions
- [ ] Check temperature emoji displays in Admin Matching Logs
- [ ] Confirm WebSocket notifications include `temperatureLevel`
- [ ] Validate toast notifications show correct temperature

### Matching Algorithm
- [ ] Verify diversity is only counted once (not twice)
- [ ] Test scoring formula: 60% pair + 25% diversity + 15% energy
- [ ] Check `avgPairScore` calculation excludes diversity
- [ ] Monitor match quality feedback from users

### Real-time Matching
- [ ] Test instant scan on user registration
- [ ] Verify hourly scheduled scans run correctly
- [ ] Check time decay algorithm lowers thresholds near deadline
- [ ] Confirm manual trigger works from Admin UI
- [ ] Review `poolMatchingLogs` for decision history

### Invitation System
- [ ] Test invitation creation and acceptance flow
- [ ] Verify ¥50 coupon auto-issued when invitee matches
- [ ] Check `invitation_uses` table records rewards
- [ ] Confirm badges display correctly (purple/blue)

### Event Pool User Flow
- [ ] Test user registration with soft preferences
- [ ] Verify status filtering (pending/matched/completed)
- [ ] Check `PoolRegistrationCard` displays correctly
- [ ] Confirm navigation from DiscoverPage to RegistrationPage

### WebSocket Notifications
- [ ] Verify WebSocket connection establishes successfully
- [ ] Test `POOL_MATCHED` event broadcasts to all matched users
- [ ] Check toast notifications display with correct data
- [ ] Confirm cache invalidation triggers re-fetch
- [ ] Verify auto-switch to "已匹配" tab

### Event Pool Discovery
- [ ] Test `/api/event-pools` returns active pools
- [ ] Verify DiscoverPage displays event pools
- [ ] Check all required schema columns exist
- [ ] Confirm status unified to `active`

---

## 🚨 Common Issues & Solutions

### Issue: "Column does not exist: energy_balance"
**Solution:** Run `npm run db:push` to sync schema

### Issue: Diversity still counted twice
**Solution:** Check `calculatePairScore()` in `server/archetypeChemistry.ts` - should NOT include diversity parameter

### Issue: WebSocket notifications not received
**Solution:** 
1. Check WebSocket connection in browser DevTools
2. Verify `wsService.broadcastToUser()` is called in `saveMatchResults()`
3. Confirm user ID matches WebSocket connection

### Issue: Temperature emoji not showing
**Solution:**
1. Check `getTemperatureLevel()` function returns correct emoji string
2. Verify `temperatureLevel` stored in `eventPoolGroups` table
3. Confirm frontend displays `{temperatureLevel}` not just `{score}`

### Issue: Event pools not showing in DiscoverPage
**Solution:**
1. Check `eventPools.status = 'active'` in database
2. Verify schema has all required columns
3. Test `/api/event-pools` endpoint directly

### Issue: Matching not triggering automatically
**Solution:**
1. Check `server/index.ts` starts realtime matching scheduler
2. Verify cron job interval (default: 60 minutes)
3. Monitor `poolMatchingLogs` for scan records

---

## 📚 Key Concepts for Tech Team

### Pair Score vs Group Diversity
- **Pair Score:** Measures compatibility between two individuals (similarity)
- **Group Diversity:** Measures richness of backgrounds in the group (variety)
- These are orthogonal dimensions - both contribute to group quality

### Energy Balance
- **High Energy Groups:** All extroverts → exhausting, chaotic
- **Low Energy Groups:** All introverts → awkward silences, low engagement
- **Balanced Groups:** Mix of energy levels → natural conversation flow

### Hard Constraints vs Soft Preferences
- **Hard Constraints:** Admin-set restrictions (gender, industry, seniority) - must match
- **Soft Preferences:** User preferences (budget, cuisine, goals) - used in scoring, not filtering

### Real-time vs Scheduled Matching
- **Real-time:** Triggered immediately on user registration (instant scan)
- **Scheduled:** Cron job runs every 60 minutes (batch scan)
- **Final 24h:** Every 30 minutes in last 24 hours (intensive scan)

---

## 🛠️ Development Workflow

### Making Changes to Matching Algorithm

1. **Update algorithm logic:** `server/poolMatchingService.ts` or `server/archetypeChemistry.ts`
2. **Update PRD documentation:** `PRODUCT_REQUIREMENTS.md` Section 3.4/3.5
3. **Test with real data:** Use Admin Matching Lab to test changes
4. **Monitor feedback:** Check `poolMatchingLogs` and user feedback
5. **Iterate:** Adjust weights/thresholds based on data

### Adding New Features

1. **Update database schema:** `shared/schema.ts`
2. **Run migration:** `npm run db:push`
3. **Add backend logic:** `server/routes.ts` + `server/*Service.ts`
4. **Add frontend UI:** `client/src/pages/*.tsx`
5. **Update PRD:** `PRODUCT_REQUIREMENTS.md`
6. **Update this guide:** `DEVELOPER_QUICK_REFERENCE.md`

### Debugging Production Issues

1. **Check logs:** `refresh_all_logs` in Replit
2. **Query database:** Use `execute_sql_tool` to inspect data
3. **Monitor WebSocket:** Browser DevTools → Network → WS
4. **Review matching logs:** Admin Matching Logs page
5. **Test locally:** Replicate issue in development environment

---

## 📞 Need Help?

- **Algorithm Questions:** Review `server/poolMatchingService.ts` and `server/archetypeChemistry.ts`
- **Database Questions:** Check `shared/schema.ts` for schema definitions
- **API Questions:** See `server/routes.ts` for endpoint implementations
- **UI Questions:** Explore `client/src/pages/` for page components

**Remember:** This is a living codebase. When in doubt, read the code!

---

**Last Updated:** November 20, 2025  
**Maintainer:** JoyJoin Development Team
