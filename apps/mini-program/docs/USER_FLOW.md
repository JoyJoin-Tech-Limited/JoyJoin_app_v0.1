# JoyJoin Mini Program — User Flow & Feature Cartography

> Complete mapping of all user journeys, screen transitions, prerequisites, and API calls.  
> Generated: 2026-04-22

---

## 1. High-Level User Flow (Mermaid)

```mermaid
flowchart TD
    A[App Launch<br/>pages/index/index] --> B{Auth State?}
    B -->|Unauthenticated| C[LandingPage<br/>Accept Terms]
    B -->|Authenticated| D[Server nextStep Redirect]

    C --> C1[Personality Test<br/>(Anonymous)]
    C --> C2[Login Page<br/>WeChat Auth]
    C1 --> C1a[Test Results<br/>Slot Reveal]
    C1a --> C1b[Auth Gate<br/>Import Results]
    C1b --> C2

    C2 --> D
    D --> E1[personality-test]
    D --> E2[essential-data]
    D --> E3[extended-data]
    D --> E4[profile-review]
    D --> E5[discover]

    E1 --> E2
    E2 --> E3
    E3 --> E4
    E4 --> E5

    E5 --> F[Discover Tab<br/>Event Pools]
    F --> F1[Pool Card Tap]
    F1 --> G[Pool Registration<br/>Budget → Intent → Details]

    G --> H{Has Entitlement?}
    H -->|No| I[Blind Box Payment<br/>Select Plan]
    H -->|Yes| J[Submit Registration]

    I --> K[WeChat Pay Sheet]
    K --> L[Payment Verification<br/>Poll Status]
    L -->|Paid| G
    L -->|Failed| I
    L -->|Pending| M[Return Later]

    J --> N[Matching Status<br/>WS: POOL_MATCHED]
    N -->|Pending| N
    N -->|Matched| O[Squad Unboxing<br/>Blind Box Reveal]
    N -->|No Match| F
    N -->|Cancelled| F

    O --> P[Confirm Attendance]
    P --> Q[Event Detail<br/>BlindBox Event]

    Q --> R[Event Coordination<br/>Support QR]
    Q --> S[Event Feedback]

    Q --> T{Event Started?}
    T -->|Yes| U[Icebreaker Session<br/>Social Icebreaker]

    U --> U1[Waiting]
    U1 --> U2[Warmup]
    U2 --> U3[Micro Challenge]
    U3 --> U4[Lie Detective]
    U4 --> U5[Auction]
    U5 --> U6[Personality Dice]
    U6 --> U7[Mini Script]
    U7 --> U8[Recap]
    U8 --> U9[Ended]

    E5 --> V[Profile Tab]
    V --> V1[Edit Profile]
    V --> V2[Rewards]
    V --> V3[Invite Friends]
    V --> V4[My Events Tab]
    V --> V5[Terms]

    E5 --> W[Events Tab<br/>Upcoming / Completed]
    W --> W1[Event Detail]
    W1 --> S
    W1 --> R
    W1 --> U

    E5 --> X[Connections Tab]

    F --> Y[Open Payment<br/>from Discover]
    Y --> I

    style A fill:#f9f,stroke:#333
    style E5 fill:#bbf,stroke:#333
    style U fill:#bfb,stroke:#333
    style N fill:#fbb,stroke:#333
    style O fill:#ff9,stroke:#333
```

---

## 2. Detailed Screen Table

| Screen Name | Path | Trigger From | Navigates To | API Calls | Prerequisites | Conditional Features |
|---|---|---|---|---|---|---|
| **Index (Entry)** | `pages/index/index` | App launch | LandingPage (if unauth) or server `nextStep` redirect | `GET /api/auth/user` | None | Shows LoadingScreen while auth resolves |
| **LandingPage** | `pages/index/LandingPage` | Index when unauth | Personality Test (anonymous) or Login | None | Must accept legal terms | Hero cards, legal checkbox, terms links |
| **Login** | `pages/login/index` | LandingPage CTA, logout | Server-driven `nextStep` redirect | `POST /api/auth/wechat/login`, `GET /api/auth/user` | WeChat runtime | `useWeChatLogin` hook |
| **Onboarding Hub** | `pages/onboarding/onboarding/index` | Server `nextStep=onboarding` | Redirects to actual onboarding step | `GET /api/auth/user` | Auth required | Pure redirect page |
| **Personality Test** | `pages/onboarding/personality-test/index` | LandingPage, onboarding hub | Test Results (if anon complete) or next onboarding step | `POST /api/assessment/v4/start`, `POST /api/assessment/v4/{id}/answer` | None (supports anonymous) | Adaptive V4 assessment, slider/emoji/choice questions, anonymous session storage |
| **Test Results** | `pages/onboarding/personality-test/results/index` | Personality Test completion | Inline WeChat login + answer import (if anon) or next step (if auth) | `GET /api/assessment/v4/{id}/result`, `POST /api/auth/wechat/login-with-test` | Completed test session | Slot machine reveal, share poster generation, archetype display, inline auth |
| ~~Auth Gate~~ | ~~`pages/onboarding/personality-test/auth-gate/index`~~ | ~~Test Results (anonymous)~~ | ~~Login import flow or restart~~ | ~~`POST /api/auth/wechat/login-with-test`~~ | ~~Removed 2026-05~~ | ~~Replaced by inline login on results page~~ |
| **Essential Data** | `pages/onboarding/essential-data/index` | Onboarding flow | Extended Data | `POST /api/onboarding/essential-data` | Auth required | 5-step form: name, gender/birth, profession, location, intent. Local cache |
| **Extended Data** | `pages/onboarding/extended-data/index` | Essential Data | Profile Review | `POST /api/onboarding/interests` | Auth required | Interest heat map (3 levels), category selection, min 3 interests |
| **Profile Review** | `pages/onboarding/profile-review/index` | Extended Data | Discover Tab | `POST /api/profile-review/complete`, `GET /api/profile/tagline`, `GET /api/user/interests` | Auth required | AI-generated tagline, readiness checklist, archetype card |
| **Discover** | `pages/discover/index` | Onboarding complete, tab bar, various returns | Pool Registration, Events tab, Connections tab, Payment | `GET /api/event-pools`, `GET /api/my-pool-registrations` | Auth required | Cluster/district filters, pool momentum cards, registered status badges |
| **Pool Registration** | `pages/pool-registration/index` | Discover pool tap, Matching Status (rejoin) | Events tab (on success), Payment (if no entitlement) | `GET /api/event-pools/{id}`, `GET /api/pre-join-vibe-brief`, `POST /api/pool-registrations` | Auth, pool ID | 4-step: brief, budget, intent, details. Resume context after payment |
| **Blind Box Payment** | `pages/blind-box-payment/index` | Pool Registration (entitlement error), Discover CTA, Profile | Payment Verification | `GET /api/pricing`, `GET /api/coupons`, `POST /api/payments/intent`, `POST /api/coupons/validate`, `GET /api/payments/ritual-context`, `POST /api/analytics/payment` | Auth required | Plan selection, coupon validation, pending order resume, payments-disabled state. **Payment Ritual V2** (feature-flagged): fetches real DB-backed community context (`ritual-context`) and emits analytics to dedicated `analytics/payment` endpoint |
| **Payment Verification** | `pages/payment-verification/index` | Payment page, app resume (pending order) | Pool Registration (return context), Events tab, Profile tab | `GET /api/payments/status/{orderId}` | Auth, order ID | Polling loop (10 attempts), paid/pending/failed states, cache invalidation |
| **Events Tab** | `pages/events/index` | Tab bar, Discover, Profile, various returns | Event Detail | `GET /api/events/joined` | Auth required | Upcoming/Completed tabs, auto-switch if empty |
| **Event Detail** | `pages/event-detail/index` | Events tab, Squad Unboxing (confirm), Event Coordination | Event Feedback, Event Coordination, **Icebreaker Session** (when active) | `GET /api/blind-box-events/{id}` | Auth, event ID | Support QR preview, icebreaker CTA when `status === 'started'/'active'/'ongoing'` |
| **Matching Status** | `pages/matching-status/index` | Events tab (tap registered pool), push/WS | Squad Unboxing (if matched), Pool Registration (rejoin), Discover | `GET /api/my-pool-registrations`, `GET /api/pool-group-fill`, `GET /api/pool-group-details`, `GET /api/pool-group-analysis` | Auth, registration ID | WebSocket: POOL_MATCHED, POOL_REGISTRATION_ADDED, EVENT_THEME_TITLE_REVEALED. Live reveal overlay |
| **Squad Unboxing** | `pages/squad-unboxing/index` | Matching Status | Event Detail (on confirm), Pool Group Detail | `GET /api/pool-group-details`, `GET /api/pool-group-analysis`, `POST /api/pool-groups/{id}/confirm-attendance` | Auth, group ID | Blind box open animation, member reveal, pair analysis, chemistry tokens, analysis stages |
| **Pool Group Detail** | `pages/pool-group-detail/index` | Squad Unboxing, Matching Status | **Icebreaker Session**, Events tab | `GET /api/pool-group-details`, `GET /api/pool-group-analysis` | Auth, group ID | Member list, venue info (copy/map), rules, countdown, icebreaker CTA |
| **Event Coordination** | `pages/event-coordination/index` | Event Detail | Event Detail, Events tab | `GET /api/events/joined` | Auth, event ID | Support QR, "group chat closed" notice, official客服 |
| **Event Feedback** | `pages/event-feedback/index` | Event Detail | Back navigation | `POST /api/events/{id}/feedback` | Auth, event ID | 5-star rating, comment textarea |
| **Icebreaker Session** | `pages/icebreaker-session/index` | Event Detail / Group Detail | Back/Events tab | `GET /api/events/{id}/session`, `POST /api/social-icebreaker/start`, `POST /api/social-icebreaker/{id}/*` | Auth, event/session ID | Phase machine: waiting→warmup→micro→lie_detective→auction→dice→mini_script→recap→ended. Host controls |
| **Profile Tab** | `pages/profile/index` | Tab bar | Edit Profile, Rewards, Invite, Payment, Events tab, Terms | `GET /api/auth/user`, `GET /api/coupons` | Auth required | Stats cards, onboarding status, logout |
| **Edit Profile** | `pages/edit-profile/index` | Profile | Back/Profile tab | `POST /api/onboarding/essential-data`, `POST /api/onboarding/interests`, `GET /api/user/interests` | Auth required | Name, gender, birth year, city, hometown, interests with levels |
| **Rewards** | `pages/rewards/index` | Profile | Invite | `GET /api/coupons`, `GET /api/gamification`, `GET /api/gamification/history`, `GET /api/redeemable-items`, `POST /api/gamification/redeem` | Auth required | Coupons, joy coins, XP, level, redeemable items, history |
| **Invite** | `pages/invite/index` | Profile, Rewards | None (copy actions) | `GET /api/referral-stats` | Auth required | Referral code, invite link, reward tiers |
| **Connections** | `pages/connections/index` | Tab bar | None | `GET /api/my-connections` | Auth required | Post-event connections list, peer archetype display |
| **Terms** | `pages/terms/index` | LandingPage (legal links), Profile | None | None | None | Terms & Privacy policy sections, scroll-to-anchor |
| **Center Tab Empty** | `pages/center-tab-empty/index` | Custom tab bar center | Discover | None | None | Empty state when no activities |
| **My Events (Legacy)** | `pages/my-events/index` | Deep links | Events tab (redirect) | None | None | Legacy redirect stub |
| **Journey (Legacy)** | `pages/journey/index` | Deep links | Events tab (redirect) | None | None | Legacy redirect stub |

---

## 3. Narrative Walkthrough of Key Flows

### 3.1 Cold Start Flow

```
App Launch → Index → LandingPage → [Accept Terms] → Personality Test (anonymous)
    ↓
[Complete 3-5 min adaptive V4 assessment] → Results Page (slot machine reveal)
    ↓
[If anonymous] → Auth Gate → WeChat Login → Import anonymous results
    ↓
[Server nextStep redirect] → Essential Data → Extended Data → Profile Review
    ↓
Discover Tab
```

**Key mechanics:**
- The `Index` page is a thin redirect shell. If `auth.isAuthenticated`, it immediately calls `navigateToMiniProgramNextStep(auth.nextStep, { mode: 'root' })`.
- The `LandingPage` gates everything behind `hasAcceptedLegal`. Two CTAs: "看看我会遇见谁" (go to personality test anonymously) and "已有账号？登录".
- Personality Test supports **anonymous mode** using `anonymousOnboarding` local storage. Answers are cached and imported later via `authenticateMiniProgramUserWithTest`.
- Onboarding is strictly **server-driven** via `nextStep` from `/api/auth/user`. The client never computes its own position.

---

### 3.2 Event Discovery → Registration → Payment Flow

```
Discover Tab → [Tap Pool Card] → Pool Registration
    ↓
Step 0: Pre-join vibe brief (AI-generated)
Step 1: Budget selection (dinner vs bar budgets)
Step 2: Intent selection (social goals)
Step 3: Details (language, cuisine/dietary, taste/bar theme, alcohol comfort)
    ↓
[Submit] → {Has entitlement?}
    ├─ YES → Registration Success → Events Tab
    └─ NO → Entitlement modal → Blind Box Payment
                ↓
        Select plan / Apply coupon → WeChat Pay Sheet
                ↓
        Payment Verification (polls /api/payments/status/{orderId})
                ↓
        {Paid?} → Return to Pool Registration (with resume context)
        {Failed?} → Retry payment
        {Pending?} → "先回报名页" or "继续查询"
```

**Key mechanics:**
- `PoolRegistrationPage` uses `paymentReturnContext` to resume state after payment interruption. The context is stored in `paymentPendingOrderStorage`.
- If `paymentsEnabled === false`, the payment page shows a maintenance state but still allows resuming pending orders.
- `PaymentVerificationPage` uses `useMiniProgramPaymentFlowController` which polls up to 10 times. On success, it invalidates auth, coupons, registrations, and events queries.
- **Payment Ritual V2** (behind `PAYMENT_RITUAL_V2_ENABLED` flag): The payment page fetches real community stats via `GET /api/payments/ritual-context` (city-scoped member counts, weekly new users, upcoming events, recent activity). Analytics emit to `POST /api/analytics/payment` (dedicated endpoint, not discover). No fabricated social-proof metrics — all numbers are DB-backed. A/B variant assigned deterministically via `assignRitualVariant(userId)`.

---

### 3.3 Matching → Unboxing → Attendance Flow

```
Events Tab → [Tap Registered Pool] → Matching Status
    ↓
[WebSocket POOL_MATCHED] → Live reveal overlay triggers
    ↓
[User taps "查看活动详情"] OR [auto after live journey]
    ↓
Squad Unboxing (blind box animation)
    ↓
[Open Box] → Shaking → Revealed (staged analysis: chemistry → dynamics → pairs → topics)
    ↓
[Confirm Attendance] → POST /api/pool-group-attendance
    ↓
{Has blindBoxEventId?} → Event Detail : Pool Group Detail
```

**Key mechanics:**
- `MatchingStatusPage` has a sophisticated screen state machine: `loading → error → not-found → cancelled → no-match → ready`.
- WebSocket events (`POOL_REGISTRATION_ADDED`, `POOL_MATCHED`, `EVENT_THEME_TITLE_REVEALED`) drive real-time UI updates.
- `SquadUnboxingPage` uses a 4-stage analysis reveal with timed haptics and animations. `analysisStage` progresses 1→4 via `useEffect` timers.
- Attendance confirmation creates a `blindBoxEventId` which redirects to the formal event detail page.

---

### 3.4 Social Icebreaker Flow

```
Event Detail / Pool Group Detail → [Enter Icebreaker] → Icebreaker Session
    ↓
[Auto: GET /api/events/{id}/session → POST /api/social-icebreaker/start]
    ↓
waiting → host clicks "开始破冰" → warmup
    ↓
warmup → [Generate topics by mood] → [Toggle ready] → [Next topic] → host advances
    ↓
micro_challenge → [Complete challenge] → host advances
    ↓
lie_detective → [Generate statements] → [Cast votes] → [Reveal] → [Next player] → host advances
    ↓
auction → [Generate lots] → [Place bids] → [Close lots] → host advances
    ↓
personality_dice → [Generate challenges] → [Complete] → host advances
    ↓
mini_script → [Host configures style/genre] → [Generate script] → host advances
    ↓
recap → [View medals/summary] → Leave
    ↓
ended
```

**Key mechanics:**
- The page accepts either `sessionId` or `eventId` query params. If `eventId` is provided, it discovers/creates the session automatically.
- `performSocialAction` is a generic action dispatcher with pending-action locking to prevent double-submits.
- Host authority is determined by `isHost = currentUserId === hostUserId`. Only the host can advance phases (except `auction` and `mini_script` which have special rules).
- The `recap` phase fetches from `/recap` endpoint and displays medals.

---

### 3.5 Profile Management Flow

```
Profile Tab → [Edit Profile] → Edit Profile Page
    ↓
[Save] → invalidateAuth → navigateBack/fallback to Profile tab

Profile Tab → [Rewards] → Rewards Page
    ↓
[Redeem item] → confirm modal → redeem mutation → invalidate queries
    ↓
[Invite CTA] → Invite Page

Profile Tab → [Invite] → Invite Page
    ↓
[Copy code/link/text] → clipboard

Profile Tab → [My 权益] → Blind Box Payment
Profile Tab → [我的足迹] → Events Tab
Profile Tab → [服务条款] → Terms
Profile Tab → [退出登录] → POST /api/auth/logout → clear session → reLaunch to Login
```

---

### 3.6 Connections Flow

```
Connections Tab → [Load] → GET /api/my-connections
    ↓
[List of connections with peerName, peerArchetype, eventTitle, wechatId]
```

**Note:** This is currently a read-only list. There is no navigation to a connection detail page.

---

## 4. Ambiguous or Dead-End Flows Discovered

### 4.1 Legacy Redirect Stubs
- **`pages/my-events/index`**: Immediately redirects to `/pages/events/index` via `redirectLegacyEventsEntryToTab`. This is a dead-end stub for old deep links.
- **`pages/journey/index`**: Same pattern — redirects to Events tab. Legacy path.

### 4.2 Center Tab Empty State
- **`pages/center-tab-empty/index`**: The custom tab bar center button defaults to "去参与" → Discover. But if the user somehow lands on `center-tab-empty`, the only CTA is "去发现活动" which switches to Discover. This page appears to be a fallback that may not be actively reachable in normal flow.

### 4.3 Event Coordination — Chat Removed
- **`pages/event-coordination/index`** explicitly states: "小程序内自由群聊已关闭". The page is now a **support hub** with a customer service QR code. There is no actual coordination functionality. Users expecting group chat will hit a dead end. Navigation from here only goes to Event Detail or Events tab.

### 4.4 Matching Status "No Match" Path
- When a pool expires without matching (`isNoMatchState`), the user sees similar pools and can "重新报名这场" (rejoin). However, the original registration is left in a terminal state. There's no explicit "refund" or "credit return" UI flow visible in the mini-program — this may be server-side only.

### 4.5 ~~Icebreaker Session Entry Ambiguity~~ ✅ RESOLVED
- ~~The icebreaker session is entered from Event Detail, but the Event Detail page did not have a visible CTA.~~
- **Fixed:** Added conditional "进入破冰" CTA to `EventDetailPage` when `event.status` is `'started'`, `'active'`, or `'ongoing'`.
- **Fixed:** Added "开始破冰" primary CTA to `PoolGroupDetailPage` alongside the "返回活动" button.

### 4.6 ~~Blind Box Payment — Navigate Back Ambiguity~~ ✅ RESOLVED
- ~~The payment page used Profile tab as a hardcoded back fallback.~~
- **Fixed:** `openMiniProgramPaymentPage()` now accepts a `returnTab` parameter. Callers from Discover pass `'discover'`, from Pool Registration pass `'events'`, and from Profile pass `'profile'`. The payment page reads this param and uses it as the `navigateBack` fallback.

### 4.7 Onboarding Auth Guard Edge Case
- `useAuthGuard` redirects unauthenticated users to login with `Taro.reLaunch`. However, for onboarding pages, if `auth.nextStep` is `discover` or `guide`, it switches to Discover tab. But if the user is on an onboarding page and `nextStep` is missing (`undefined`), the guard does nothing — potentially leaving the user stranded on a stale onboarding page.

### 4.8 ~~Pool Group Detail — No Icebreaker CTA~~ ✅ RESOLVED
- See 4.5 above. Both Event Detail and Pool Group Detail now have explicit icebreaker entry points.

---

## 5. Development Conventions

### 5.1 Dev-Only Mock Pool Data
- **Location:** `apps/mini-program/src/lib/dev/devPoolMocks.ts`
- **Export:** `getDevMockPools(): EventPoolSummary[]`
- **Purpose:** Last-resort fallback for the discover feed when both the composite `/api/shell/discover` endpoint and the legacy `getEventPools` request fail in development. Lets local dev iterate on UI without a live backend.
- **Guard:** Consumer in `pages/discover/index.tsx` is wrapped in a `NODE_ENV === 'development'` check. Production builds never reach this code path.
- **Pattern:** When a page needs dev-mode fallback data, extract the mock into `apps/mini-program/src/lib/dev/<page>Mocks.ts` (one file per surface) so the page file stays focused on composition and the mock surface is easy to audit/expand.
