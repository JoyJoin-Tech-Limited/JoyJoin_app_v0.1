# JoyJoin Quick Reference Guide

> ⚠️ **SUPPLEMENTARY REFERENCE ONLY** — Some sections of this file are outdated.  
> For active development, always use **`DEVELOPER_QUICK_REFERENCE.md`** (canonical, up-to-date) and **`PRODUCT_REQUIREMENTS.md`** (authoritative PRD).  
> **Never base code or copy decisions solely on this file.** Sections marked ⚠️ are known to be outdated.

**For rapid onboarding and daily development reference**

---

## 🚀 Getting Started (5 Minutes)

### Local Setup
```bash
git clone <repo>
npm install
npm run db:push          # Sync database schema
npm run dev              # Start on http://localhost:5000
```

 

### Test User Flow (WeChat-first, V4 personality system)
1. Go to `/` — lands on `LandingPage`
2. Navigate to `/personality-test` — complete V4 adaptive test **anonymously** (8–16 questions)
3. On the results page, tap "微信一键登录" — WeChat auth creates your account
4. Complete onboarding: Essential Data → Extended Data → Profile Review → Discover

> **Dev shortcut**: `LoginPage` at `/login` includes a "Quick Tester Bypass" panel (visible only when `NODE_ENV=development`) that lets you log in as pre-seeded test users without WeChat.

---

## 📂 Essential Files (Top 10)

| File | Purpose | Lines |
|------|---------|-------|
| `apps/server/src/routes.ts` | All API endpoints | 3,400+ |
| `packages/shared/src/schema.ts` | Database schema | 3,000+ |
| `apps/server/src/poolMatchingService.ts` | Pool matching algorithm (7-dimension) | 500+ |
| `apps/user-client/src/pages/PersonalityTestPageV4.tsx` | V4 adaptive test | 500+ |
| `apps/admin-client/src/pages/admin/AdminDataInsightsPage.tsx` | Analytics dashboard | 800+ |
| `apps/server/src/paymentService.ts` | WeChat Pay integration | 300 |
| `apps/server/src/wsService.ts` | WebSocket real-time sync | 250 |
| `apps/user-client/src/lib/archetypes.ts` | 12 archetype configs | 200+ |
| `PRODUCT_REQUIREMENTS.md` | Full PRD | 2,000+ |
| `DEVELOPER_QUICK_REFERENCE.md` | Dev-focused quick reference | - |

---

## 🎭 12 Personality Archetypes (V4 System)

> ⚠️ **The 14-archetype list (火花塞, 探索者, 故事家…) is LEGACY (V1/V2 system)**. Do not use it in new code, copy, or documentation.

**Current production archetypes** (`packages/shared/src/personality/archetypeNames.ts`):

| # | Emoji | Name | Trait Highlights |
|---|-------|------|-----------------|
| 1 | 🐕 | 开心柯基 (Happy Corgi) | X=95, P=85 — High energy socializer |
| 2 | 🐓 | 太阳鸡 (Sun Chicken) | P=92, X=78 — Optimistic motivator |
| 3 | 🐬 | 夸夸豚 (Praise Dolphin) | A=95, X=82 — Warmhearted encourager |
| 4 | 🦊 | 机智狐 (Clever Fox) | O=92, X=78 — Creative problem-solver |
| 5 | 🐬 | 淡定海豚 (Calm Dolphin) | E=85, C=70 — Balanced mediator |
| 6 | 🕷️ | 织网蛛 (Weaver Spider) | C=85, E=65 — Detail-oriented planner |
| 7 | 🐻 | 暖心熊 (Warm Bear) | A=90, E=80 — Empathetic supporter |
| 8 | 🐙 | 灵感章鱼 (Inspiration Octopus) | O=95, P=70 — Innovative ideator |
| 9 | 🦉 | 沉思猫头鹰 (Contemplative Owl) | O=88, C=80 — Analytical thinker |
| 10 | 🐘 | 定心大象 (Grounded Elephant) | C=90, E=86 — Stable anchor |
| 11 | 🐢 | 稳如龟 (Steady Turtle) | E=85, C=80 — Reliable introvert |
| 12 | 🐱 | 隐身猫 (Invisible Cat) | E=80, X=20 — Reserved observer |

---

## 🧮 Personality Test Quick Facts (V4)

- **Questions:** 8–16 adaptive (not fixed at 10)
- **Question bank:** 60 questions across 3 levels (L1 Anchor, L2 Adaptive, L3 Disambiguation)
- **Stops when:** All 6 trait confidences ≥ 0.7 OR 16 questions reached
- **6 Dimensions (ACOEXP):** Affinity (A), Conscientiousness (C), Openness (O), Emotional Stability (E), Extraversion (X), Positivity (P)
- **Algorithm:** V2 Matcher — weighted Manhattan distance with asymmetric penalties
- **Result:** Single decisive archetype match (no blending formula — blending was removed in V4)
- **File:** `apps/user-client/src/pages/PersonalityTestPageV4.tsx`

---

## 🔀 Pool Matching Algorithm

**Pair Scoring** (5 dimensions, always active):
```
├── Chemistry (archetype):          28%   // archetypeChemistry.ts
├── Interest (topics + heat):       28%   // user_interests table, heat-weighted Jaccard
├── Language:                       12%   // common languages
├── Preference (intent + bar):      15%   // dining/bar event preferences
└── Background (unified):           17%   // explicit fixed-weight sub-score
    ├── Industry diversity:         ~30%
    ├── Life stage affinity:        ~30%  (workMode / 人生阶段, PR #312)
    ├── Hometown affinity:          ~20%  (when both opted in)
    └── Education diversity:        ~20%
```

> **Note:** There are two distinct matrix concepts:
> - **Archetype chemistry matrix** (`archetypeChemistry.ts`) — 12×12 archetype ↔ archetype compatibility
> - **Life stage affinity matrix** (`LIFE_STAGE_AFFINITY` in `poolMatchingService.ts`) — 7×7 asymmetric `workMode` / 人生阶段 matrix (added PR #312)

**Group Scoring:**
```typescript
overallScore =
  avgPairScore         × 0.60 +
  groupDiversityScore  × 0.25 +   // Industry + Gender + Archetype + Life Stage (25% each)
  communicationBalance × 0.15;    // Avg pairwise language score
```

**File:** `apps/server/src/poolMatchingService.ts`

**Test in Admin:** `/admin/matching-lab`

---

## 💳 Payment & Activity Bundles

### Tiers (displayed as one-time product purchases, NOT subscriptions)
- **月度活动礼包:** ¥99/次购买，本月内有效
- **季度活动礼包:** ¥294/次购买，3个月内有效（省15%）
- **单次活动票:** ¥148/场

### Compliance Note
Bundles are sold as one-time goods (商品), not recurring subscriptions.
paymentType = "event_bundle" for bundle purchases.

### WeChat Pay Flow
```
User clicks pay → Backend creates payment record
→ WeChat JSAPI → User pays
→ Webhook validates → Update subscription
→ WebSocket notifies user
```

**File:** `apps/server/src/paymentService.ts`

---

## 📊 Event Lifecycle

```
draft → matching → registration_open → confirmed 
→ in_progress → completed
     ↓ (can cancel at any stage)
  cancelled
```

### Status Actions
- **matching:** AI finding participants
- **registration_open:** Accepting sign-ups
- **confirmed:** Min attendees met, venue booked
- **in_progress:** Event day (event coordination enabled)
- **completed:** Feedback unlocked

---

## 💬 Event Coordination & Connections

### Event Coordination Thread
- **Access:** Payment completed + Event in_progress
- **Polling:** 5-second refresh interval
- **Features:** Participant updates, reporting
- **File:** `apps/user-client/src/pages/EventCoordinationPage.tsx`

### Connections (Post-Event)
- Mutual selection: Both users must indicate interest
- Triggered: Post-event interest matching
- Access: Via `/connections` page

### Moderation
- **Reports:** User-submitted interaction reports
- **Actions:** Delete, warn, mute (24h), ban
- **Admin:** `/admin/moderation`

---

## 📈 Admin Portal Pages (18)

> **Deployment note:** The admin portal is a **separate deployment** at `https://admin.yuejuapp.com` (the `apps/admin-client` workspace). Routes in `apps/user-client/src/App.tsx` redirect all `/admin/*` paths to that subdomain. Admin pages listed below are served by the admin client, not the user client.

| Page | Route | Purpose |
|------|-------|---------|
| Dashboard | `/admin` | Key metrics + activity feed |
| Users | `/admin/users` | User management |
| Subscriptions | `/admin/subscriptions` | Subscription records |
| Coupons | `/admin/coupons` | Discount codes |
| Venues | `/admin/venues` | Partner venues |
| Templates | `/admin/event-templates` | Reusable event configs |
| Events | `/admin/events` | Event oversight |
| Finance | `/admin/finance` | Revenue + payments |
| **Data Insights** | `/admin/data-insights` | **7 analytics modules** |
| Feedback | `/admin/feedback` | User feedback review |
| Matching Lab | `/admin/matching-lab` | Algorithm tuning |
| Content | `/admin/content` | CMS (announcements) |
| Notifications | `/admin/notifications` | Push broadcasts |
| Moderation | `/admin/moderation` | Interaction reports |
| Reports | `/admin/reports` | User reports |
| Interaction Logs | `/admin/interaction-logs` | Audit trail |

---

## 🎯 Data Insights Modules (7)

**File:** `apps/admin-client/src/pages/admin/AdminDataInsightsPage.tsx`

1. **User Scale** - Total users, DAU/MAU, acquisition funnel
2. **Business Health** - MRR, ARR, churn rate, LTV
3. **Matching Efficiency** - Match scores, fill rates, algorithm performance
4. **User Retention** - Cohort analysis, engagement, reactivation
5. **Activity Quality** - Atmosphere scores, NPS, connection depth
6. **Revenue Funnel** - Conversion rates, optimization opportunities
7. **Social Role Distribution** - Archetype analytics, pairing success

---

## 🔗 Key API Endpoints

### User Authentication (Primary — WeChat)
```
POST /api/auth/wechat/login-with-test   # WeChat login (new users with personality test answers)
POST /api/auth/wechat/login             # WeChat login (returning users, no test answers)
GET  /api/auth/wechat/oauth/start       # WeChat OAuth2 web flow start (browser/staging)
GET  /api/auth/wechat/oauth/callback    # WeChat OAuth2 web flow callback
```

### User Authentication (Legacy — Phone/SMS)
> ⚠️ Legacy fallback. Phone auth is available on `LoginPage` but is not the primary flow.
```
POST /api/phone/register        # Send SMS
POST /api/phone/verify          # Verify code
POST /api/phone/login           # Login
```

### Personality Test
```
POST /api/personality-test/submit       # Submit answers
GET  /api/personality-test/results      # Get results
GET  /api/personality-test/stats        # Archetype distribution
```

### Events
```
GET  /api/events                # List events
GET  /api/events/:id            # Event details
POST /api/events/:id/register   # Register for event
```

### Payments
```
POST /api/payments/create       # Create payment
POST /api/coupons/validate      # Validate coupon
```

### Admin
```
GET  /api/admin/stats                      # Dashboard metrics
GET  /api/admin/users                      # List users
POST /api/admin/events                     # Create event
GET  /api/admin/feedbacks                  # List feedbacks
GET  /api/admin/data-insights              # Analytics data
POST /api/admin/matching/test              # Test matching
POST /api/admin/notifications/broadcast    # Send notification
```

**Full list:** See `apps/server/src/routes.ts`

---

## 💾 Database Tables (Top 10)

1. **users** - User profiles + personality
2. **events** - Event listings
3. **event_attendance** - User-event registrations
4. **event_feedback** - Post-event feedback
5. **subscriptions** - Subscription records
6. **payments** - Payment transactions
7. **venues** - Partner venues
8. **chat_messages** - Event coordination records
9. **event_templates** - Reusable configs
10. **contents** - CMS content

**Full schema:** See `packages/shared/src/schema.ts`

---

## 🌐 WebSocket Messages

### User App
```typescript
// Actual WSEventType values from packages/shared/src/wsEvents.ts
'POOL_MATCHED'               // Matched to event group
'EVENT_STATUS_CHANGED'       // Event status update
'EVENT_THEME_TITLE_REVEALED' // Blind box theme revealed
'ATTENDANCE_STATUS_UPDATED'  // Attendee status change
```

### Admin
```typescript
'POOL_REGISTRATION_ADDED'    // New pool registration
'EVENT_STATUS_CHANGED'       // Event status update
'ADMIN_ACTION'               // Admin action broadcast
'POOL_MATCHED'               // Group match completed
```

**File:** `apps/server/src/wsService.ts`

---

## 🛠️ Common Dev Tasks

### Add New API Endpoint
1. Edit `apps/server/src/routes.ts`
2. Add route handler
3. Update storage if needed (`apps/server/src/storage.ts`)
4. Test with frontend

### Add New Admin Page
1. Create `apps/admin-client/src/pages/admin/AdminXyzPage.tsx`
2. Add route to `apps/admin-client/src/App.tsx`
3. Add to AdminSidebar navigation
4. Protect with `requireAdmin` middleware

### Modify Database Schema
1. Edit `packages/shared/src/schema.ts`
2. Run `npm run db:push` (or `--force` if needed)
3. Update TypeScript types if needed
4. Test migrations

### Update Matching Algorithm
1. Edit `apps/server/src/poolMatchingService.ts`
2. Adjust weights or chemistry matrix
3. Test in Matching Lab (`/admin/matching-lab`)
4. Deploy gradually (A/B test)

---

## 🐛 Debugging Tips

### Common Issues

**"Port 5000 already in use"**
```bash
pkill -f node
npm run dev
```

**"Session not persisting"**
- Check `DATABASE_URL` is set
- Verify session table exists
- Check cookie settings

**"Payment webhook failing"**
- Verify WeChat Pay signature
- Check `WECHAT_PAY_API_KEY`
- Test with WeChat sandbox

**"WebSocket not connecting"**
- Check firewall rules
- Verify WSS (not WS) in production
- Check auth token in connection

### Debug Tools
- **Database:** Use `execute_sql_tool` or `/api/admin` routes
- **Logs:** Check Replit workflow logs
- **Network:** Browser DevTools → Network tab
- **State:** React Query DevTools

---

## 📱 Frontend Tech Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Wouter** - Routing (lightweight)
- **TanStack Query v5** - Server state
- **shadcn/ui** - Component library
- **Tailwind CSS** - Styling
- **Recharts** - Charts
- **Framer Motion** - Animations

**Config:** `vite.config.ts`, `tailwind.config.ts`

---

## 🔐 Security Checklist

- [x] WeChat OAuth2 authentication (primary — Mini Program wx.login() + OAuth2 web flow)
- [x] Phone auth with SMS verification (legacy fallback)
- [x] bcrypt password hashing
- [x] Session-based authentication (7-day TTL)
- [x] Admin role checking (`requireAdmin`)
- [x] Payment webhook signature verification
- [x] Interaction reporting system
- [x] All moderation actions logged
- [x] WebSocket auth via token
- [x] SQL injection prevention (Drizzle ORM)

---

## 📦 Environment Variables

```bash
# Database
DATABASE_URL=postgresql://...

# Session
SESSION_SECRET=random_secret_here

# WeChat Auth (primary auth method)
WECHAT_APPID=wx...
WECHAT_SECRET=...
APP_URL=https://yuejuapp.com   # Public-facing origin for OAuth2 redirect_uri

# WeChat Pay
WECHAT_PAY_APP_ID=wx...
WECHAT_PAY_MCH_ID=...
WECHAT_PAY_API_KEY=...

# Node
NODE_ENV=production
```

---

## 🚢 Deployment

**Build:**
```bash
npm run build
```

**Start:**
```bash
npm run dev  # Development
npm start    # Production
```

**Database Migration:**
```bash
npm run db:push        # Sync schema
npm run db:push --force # Force sync (use carefully)
```

---

## 📊 Key Metrics to Monitor

### Daily
- DAU (Daily Active Users)
- Payment completion rate
- Event fill rate
- Average atmosphere score

### Weekly
- WAU (Weekly Active Users)
- Subscription conversions
- Churn rate
- Interaction reports count

### Monthly
- MAU (Monthly Active Users)
- MRR (Monthly Recurring Revenue)
- User retention cohorts
- NPS (Net Promoter Score)

**Dashboard:** `/admin/data-insights`

---

## 🎨 Design System

**Colors:**
- Primary: Purple tones (warmth + energy)
- Gradients: Per archetype (see `archetypeAvatars.ts`)
- Dark mode: Fully supported

**Components:**
- Radix UI primitives
- shadcn/ui prebuilt components
- Custom components in `apps/user-client/src/components/`

**Icons:**
- lucide-react (UI icons)
- Emoji (archetype avatars)

---

## 🧪 Testing

**E2E Tests:**
```bash
# Use run_test tool for playwright tests
```

**Manual Testing:**
1. Create test user
2. Complete personality test
3. Register for event
4. Make payment
5. Send coordination update
6. Submit feedback
7. Check admin portal

---

## 📚 Documentation Hierarchy

1. **DEVELOPER_QUICK_REFERENCE.md** — Current, monorepo-aware quick reference (use this for active dev)
2. **This file (QUICK_REFERENCE.md)** ⚠️ — Older reference; some sections may be outdated. See ⚠️ markers.
3. **PRODUCT_REQUIREMENTS.md** — Full detailed PRD (50+ pages)
4. **Inline code comments** — Implementation details

---

## 🔄 Development Workflow

1. **Pull latest code**
2. **Check `replit.md` for recent changes**
3. **Create feature branch**
4. **Make changes**
5. **Test locally**
6. **Test in admin portal if applicable**
7. **Update `replit.md` if architecture changed**
8. **Commit & push**

---

## 🎯 Roadmap Preview (v1.1)

- [ ] Mobile app (React Native)
- [ ] AI conversation starters
- [ ] Video profiles
- [ ] Advanced A/B testing
- [ ] English full launch
- [ ] Group event types (workshops)
- [ ] Recurring subscription auto-pay

---

## 📞 Quick Help

**Stuck?** Check in order:
1. This quick reference
2. `PRODUCT_REQUIREMENTS.md`
3. `replit.md`
4. Inline code comments
5. Ask team lead

**Bug?** 
1. Check logs (workflow + browser console)
2. Reproduce in dev environment
3. Check recent `replit.md` changes
4. Debug with DevTools

**New feature?**
1. Review similar existing features
2. Check admin portal for management needs
3. Update matching algorithm if affects events
4. Add to Data Insights if metrics needed
5. Update this quick reference

---

**Last updated:** March 16, 2026  
**Version:** 2.0 (updated to reflect monorepo + V4 personality + WeChat-first auth)  
**Pairs with:** PRODUCT_REQUIREMENTS.md, DEVELOPER_QUICK_REFERENCE.md
