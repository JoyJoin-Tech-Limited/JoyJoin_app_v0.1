# JoyJoin Quick Reference Guide

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

 

### Test User Flow
1. Go to `/register`
2. Enter any phone (SMS bypassed in dev)
3. Complete profile → Take personality test → Browse events

---

## 📂 Essential Files (Top 10)

| File | Purpose | Lines |
|------|---------|-------|
| `server/routes.ts` | All API endpoints | 3,400+ |
| `shared/schema.ts` | Database schema | 3,000+ |
| `server/userMatchingService.ts` | Matching algorithm | 500+ |
| `client/src/pages/PersonalityTestPage.tsx` | 10-question test | 530 |
| `client/src/pages/admin/AdminDataInsightsPage.tsx` | Analytics dashboard | 800+ |
| `server/paymentService.ts` | WeChat Pay integration | 300 |
| `server/wsService.ts` | WebSocket real-time sync | 250 |
| `client/src/lib/archetypes.ts` | 14 archetype configs | 143 |
| `replit.md` | Project architecture | - |
| `PRODUCT_REQUIREMENTS.md` | Full PRD | 2,000+ |

---

## 🎭 14 Personality Archetypes

### 8 Core (Mapped in Test)
1. 🙌 **火花塞 (Spark Plug)** - Energizer, icebreaker
2. 🧭 **探索者 (Explorer)** - Curious, deep thinker
3. 📖 **故事家 (Storyteller)** - Shares experiences
4. ⚡ **挑战者 (Challenger)** - Critical thinker, debater
5. 🤝 **连接者 (Connector)** - Social bridge
6. 🎯 **协调者 (Coordinator)** - Mediator
7. 🎭 **氛围组 (Vibe Keeper)** - Humor, energy
8. 🌟 **肯定者 (Affirmer)** - Encourager, supporter

### 6 Extended (Configured, Not Mapped)
9. 🦉 智者 (Sage)
10. 🛡️ 守护者 (Guardian)
11. 🌈 梦想家 (Dreamer)
12. 🎨 艺术家 (Artist)
13. 📋 组织者 (Organizer)
14. 🔧 实干家 (Pragmatist)

---

## 🧮 Personality Test Quick Facts

- **Questions:** 10 total
  - 6 single-choice (2 points)
  - 4 dual-choice (2 + 1 points)
- **Max Score:** 24 points distributed
- **Calculation:** Highest score = Primary, 2nd = Secondary
- **6 Dimensions:** Affinity, Openness, Conscientiousness, Emotional Stability, Extraversion, Positivity
- **Blending:** 70% Primary + 30% Secondary

---

## 🔀 5-Dimensional Matching Algorithm

**Default Weights:**
```typescript
{
  personality: 40%,    // Chemistry matrix score
  interests: 25%,      // Jaccard similarity of tags
  background: 15%,     // Education/career alignment
  conversation: 10%,   // Openness + Extraversion
  intent: 10%          // Why they joined
}
```

**File:** `server/userMatchingService.ts`

**Test in Admin:** `/admin/matching-lab`

---

## 💳 Payment & Subscription

### Tiers
- **月度会员:** ¥98/month
- **季度会员:** ¥294/3 months (15% discount)
- **单次票:** ¥148/event

### WeChat Pay Flow
```
User clicks pay → Backend creates payment record
→ WeChat JSAPI → User pays
→ Webhook validates → Update subscription
→ WebSocket notifies user
```

**File:** `server/paymentService.ts`

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
- **in_progress:** Event day (chat enabled)
- **completed:** Feedback unlocked

---

## 💬 Chat System

### Event Group Chat
- **Access:** Payment completed + Event in_progress
- **Real-time:** WebSocket (100ms latency)
- **Features:** Mentions, typing indicators, read receipts
- **File:** `client/src/pages/EventChatDetailPage.tsx`

### Direct Messages
- **Access:** Must have attended same event
- **Schema:** `direct_message_threads` + `direct_messages`

### Moderation
- **Reports:** User-submitted + auto-flagged
- **Actions:** Delete, warn, mute (24h), ban
- **Admin:** `/admin/moderation`

---

## 📈 Admin Portal Pages (18)

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
| Moderation | `/admin/moderation` | Chat reports |
| Reports | `/admin/reports` | User reports |
| Chat Logs | `/admin/chat-logs` | Audit trail |

---

## 🎯 Data Insights Modules (7)

**File:** `client/src/pages/admin/AdminDataInsightsPage.tsx`

1. **User Scale** - Total users, DAU/MAU, acquisition funnel
2. **Business Health** - MRR, ARR, churn rate, LTV
3. **Matching Efficiency** - Match scores, fill rates, algorithm performance
4. **User Retention** - Cohort analysis, engagement, reactivation
5. **Activity Quality** - Atmosphere scores, NPS, connection depth
6. **Revenue Funnel** - Conversion rates, optimization opportunities
7. **Social Role Distribution** - Archetype analytics, pairing success

---

## 🔗 Key API Endpoints

### User Authentication
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

**Full list:** See `server/routes.ts`

---

## 💾 Database Tables (Top 10)

1. **users** - User profiles + personality
2. **events** - Event listings
3. **event_attendance** - User-event registrations
4. **event_feedback** - Post-event feedback
5. **subscriptions** - Subscription records
6. **payments** - Payment transactions
7. **venues** - Partner venues
8. **chat_messages** - Event group chat
9. **event_templates** - Reusable configs
10. **contents** - CMS content

**Full schema:** See `shared/schema.ts`

---

## 🌐 WebSocket Messages

### User App
```typescript
'chat_message'             // Real-time chat
'event_updated'            // Event status change
'new_connection'           // Connection request
'subscription_activated'   // Payment confirmed
```

### Admin
```typescript
'new_user_registered'      // User signed up
'payment_completed'        // Payment received
'chat_report_filed'        // Message reported
'event_filled'             // Event reached capacity
```

**File:** `server/wsService.ts`

---

## 🛠️ Common Dev Tasks

### Add New API Endpoint
1. Edit `server/routes.ts`
2. Add route handler
3. Update storage if needed (`server/storage.ts`)
4. Test with frontend

### Add New Admin Page
1. Create `client/src/pages/admin/AdminXyzPage.tsx`
2. Add route to `client/src/App.tsx`
3. Add to AdminSidebar navigation
4. Protect with `requireAdmin` middleware

### Modify Database Schema
1. Edit `shared/schema.ts`
2. Run `npm run db:push` (or `--force` if needed)
3. Update TypeScript types if needed
4. Test migrations

### Update Matching Algorithm
1. Edit `server/userMatchingService.ts`
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

- [x] Phone auth with SMS verification
- [x] bcrypt password hashing
- [x] Session-based authentication (7-day TTL)
- [x] Admin role checking (`requireAdmin`)
- [x] Payment webhook signature verification
- [x] Chat message reporting system
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
- Chat reports count

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
- Custom components in `client/src/components/`

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
5. Send chat message
6. Submit feedback
7. Check admin portal

---

## 📚 Documentation Hierarchy

1. **This file (QUICK_REFERENCE.md)** - Quick lookups
2. **PRODUCT_REQUIREMENTS.md** - Full detailed PRD (50+ pages)
3. **replit.md** - Project architecture + history
4. **Inline code comments** - Implementation details

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

**Last updated:** November 14, 2025  
**Version:** 1.0  
**Pairs with:** PRODUCT_REQUIREMENTS.md
