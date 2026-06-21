# JoyJoin Beta — Pre-Launch Test Checklist

> **Purpose:** Functional test handoff for 6 high-value features before beta launch.
> **Tester role:** Execute each scenario, mark PASS / FAIL / BLOCKED, note device + WeChat version.

---

## How to Read This Document

Each section is one feature area. Within each:
- **Core flows** — happy path, must pass
- **Edge cases** — specific boundary conditions
- **Known gaps** — documented limitations (won't fix for v0.1)
- **Feature flags to check** — toggle these to verify gating works

---

## 1. Personality Test Result — Share Poster

> **Feature-flagged:** `personalityShareEnabled` (DB-backed, env `PERSONALITY_SHARE_ENABLED`, default `true`)

### Core Flows

| # | Scenario | Expected Result |
|---|----------|----------------|
| 1.1 | Complete personality test → results page → tap share button | Share action sheet appears with "保存到相册" and "分享到朋友圈" options |
| 1.2 | Tap "保存到相册" (portrait poster) | 1080×1920 poster generated and saved to device album |
| 1.3 | Verify poster content | Shows: archetype name (colored accent), hero image, trait scores, blend line if non-decisive |
| 1.4 | Poster image quality | WebP primary; if save fails → PNG fallback from CDN |
| 1.5 | "分享到朋友圈" (square poster) | 750×750 square poster generated → opens WeChat Moments share sheet |
| 1.6 | Feature flag OFF: set `personalityShareEnabled=false` | Share button hidden on results page |
| 1.7 | Offline / poor network on share tap | Graceful error toast, no crash |

### Edge Cases

| # | Scenario | Expected Result |
|---|----------|----------------|
| 1.8 | Archetype image CDN unreachable during poster generation | Falls back to CDN PNG (`visual.asset` → `ASSET_BASE_PNG`); no blank poster |
| 1.9 | Canvas `drawImage` fails on WebP | PNG fallback fetches from CDN on-demand |
| 1.10 | Rapid double-tap on share button | Only one poster generation triggered |
| 1.11 | User navigates away mid-generation | Poster generation cancels; no orphan canvas |

### Known Gaps
- Square poster generation exists (`momentsPosterFactory.ts`) but **not wired** to results page — only portrait flows active
- Server endpoint `GET /api/personality-test/share-card-data` is **orphaned** (unused by client)

---

## 2. Location Selection

> Surface coverage: Discovery filter, Onboarding step 2, Edit-profile, Profile review, Match Compass, Pool group detail

### Core Flows

| # | Scenario | Expected Result |
|---|----------|----------------|
| 2.1 | Discover page → tap location pill | `LocationFilterDrawer` opens from bottom |
| 2.2 | Select a district from drawer | District highlighted; `aria-pressed="true"`; heat-dot shown |
| 2.3 | Clear district selection ("不限") | All districts deselected; discover feed resets |
| 2.4 | City picker: tap city name → select | Sheet closes; selected city reflects in UI |
| 2.5 | Onboarding step 2: tap city field | 7-option city picker appears; selection persists on return |
| 2.6 | Edit-profile: change city | City updates, persists on save |

### Edge Cases

| # | Scenario | Expected Result |
|---|----------|----------------|
| 2.7 | Drawer open → tap backdrop | Drawer closes (no selection change) |
| 2.8 | City picker: search by pinyin (e.g. "shen") | "深圳" (深圳市) matched |
| 2.9 | City picker: search by Chinese (e.g. "北京") | "北京" matched |
| 2.10 | Scroll through 40-city list | Smooth scroll, no jank |
| 2.11 | District drawer with `overflow: hidden` parent | ScrollView scrolls correctly (known WeChat flex bug) |

### Known Gaps
- **Shenzhen-only district data** — `packages/shared/src/districts.ts` covers only 南山 (6 districts) + 福田 (3 districts). City unlock system is how other cities get added.
- **No mini-program map SDK** — in-app map picker not available; relies on server-side geocoding REST API (Tencent Maps)
- **City normalization differs** — onboarding uses 7-option picker; edit-profile uses free-text with no canonical normalization

---

## 3. Event Registration + Admin Pool Management

### 3A. User-Facing Registration (mini-program)

#### Core Flows

| # | Scenario | Expected Result |
|---|----------|----------------|
| 3.1 | Discover → tap pool card → "立即报名" | Navigates to 4-step registration wizard |
| 3.2 | Step 1 (Brief): view pool info | Pool name, date, price, venue shown correctly |
| 3.3 | Step 2 (Budget): select budget tier | Selection highlights; "下一步" enables |
| 3.4 | Step 3 (Intent): toggle intent tags | Multi-select works; at least 1 required |
| 3.5 | Step 4 (Details): fill preferences | All fields accept input, validation shows on error |
| 3.6 | Submit registration → success | Redirects to matching-status page |
| 3.7 | Submit registration → needs payment | Redirects to payment page (see Section 4) |

#### Edge Cases

| # | Scenario | Expected Result |
|---|----------|----------------|
| 3.8 | Submit same pool twice | 400 "already registered" error displayed |
| 3.9 | Pool full (capacity reached) | Registration blocked with message |
| 3.10 | Pool registration closed (past deadline) | Registration blocked with message |

### 3B. Admin Pool Management (admin portal)

#### Core Flows

| # | Scenario | Expected Result |
|---|----------|----------------|
| 3.11 | Admin login → navigate to Event Pools | Pool list loads with filters, sort, detail view |
| 3.12 | Create new pool via "Create Event Pool" | Dialog opens with all fields (name, date, capacity, price, venue, description) |
| 3.13 | Fill creation form → submit | Pool appears in list with status "draft" |
| 3.14 | Edit existing pool | Changes saved; list refreshes |
| 3.15 | Copy existing pool | Duplicate created with "(copy)" suffix |
| 3.16 | Delete pool | Confirmation dialog → pool removed from list |
| 3.17 | View pool detail (registrations, groups, scores) | All tabs load data correctly |

#### Edge Cases

| # | Scenario | Expected Result |
|---|----------|----------------|
| 3.18 | Create pool with past date | Validation error |
| 3.19 | Create pool with 0 capacity | Validation error |
| 3.20 | Edit pool that already has registrations | Allowed; changes reflected for registrants |
| 3.21 | Delete pool with active registrations | Blocked with warning about existing registrations |

---

## 4. WeChat Payment During Event Registration

> **Feature-flagged:** `PAYMENTS_ENABLED` env var (default `false` in dev; must be `true` in beta)

### Core Flows

| # | Scenario | Expected Result |
|---|----------|----------------|
| 4.1 | Register for paid pool → payment page | Plan selection screen shows pricing options |
| 4.2 | Select plan → tap "确认支付" | `Taro.requestPayment` triggers WeChat Pay sheet |
| 4.3 | Complete payment in WeChat Pay | Polling begins; on success → redirect to result page |
| 4.4 | Payment verification: successful poll | Credits granted / subscription activated / registration confirmed |
| 4.5 | Payment verification: webhook arrives | Same fulfillment path; idempotent (webhook + poll don't double-credit) |
| 4.6 | Cancel payment in WeChat Pay sheet | Returns to plan selection; no charge |

### Edge Cases

| # | Scenario | Expected Result |
|---|----------|----------------|
| 4.7 | Poll timeout (20s) — WeChat slow | Shows "暂时无法确认支付结果，请返回查看" with manual check option |
| 4.8 | Payment success but fulfillment transaction fails | WeChat retries webhook; user sees pending state; manual retry available |
| 4.9 | Double-tap "确认支付" | Only one payment intent created |
| 4.10 | `PAYMENTS_ENABLED=false` | Payment routes return 503; registration flow skips payment step |
| 4.11 | Network drops during `requestPayment` | Error toast; no charge |
| 4.12 | Payment page → app backgrounded → return | Page state preserved; polling resumes |

### Known Gaps
- No webhook dead-letter queue — repeated webhook failures have no alerting
- Client poll timeout is fixed at 20s (10 attempts × 2s) — if WeChat is unusually slow, user must manually navigate back
- Plan prices have hardcoded client-side fallbacks (server is authority; mismatch would be confusing)

---

## 5. Event Matching Flow

> **Feature flags:** `matchingLiveReveal` (slot-machine reveal), `matchCompassEnabled` (preference dashboard), `MATCH_COMPASS_STRICTNESS_ENABLED`

### Core Flows

| # | Scenario | Expected Result |
|---|----------|----------------|
| 5.1 | Register for pool → matching-status page | Page shows "匹配中" state with poll for results |
| 5.2 | Match completes → group formed | Matching-status transitions to "matched" with group details |
| 5.3 | View matched group | Group members shown; venue assigned (or "地点待定") |
| 5.4 | Admin triggers match run on pool | Matching engine runs; groups created; users notified |
| 5.5 | No match found (no compatible partners) | Matching-status shows "no match" state with Xiaoyue comfort copy |
| 5.6 | Pool cancelled after registration | Matching-status shows "cancelled" state |

### Match Quality

| # | Scenario | Expected Result |
|---|----------|----------------|
| 5.7 | Match scores visible | Pair scores shown for each dimension (chemistry, interest, social affinity, background, preference, language) |
| 5.8 | Venue assignment: optimal venue found | Venue name, address, time slot shown in group detail |
| 5.9 | Venue assignment: no suitable venue | Group shows amber "地点待定" card |

### Edge Cases

| # | Scenario | Expected Result |
|---|----------|----------------|
| 5.10 | User drops out after match | Pool matching handles updated roster gracefully |
| 5.11 | New user registers just before match deadline | Included in next match run (realtime scan) |
| 5.12 | 2 users in pool (below minimum group size) | Shows "等待更多小伙伴" state |
| 5.13 | Match run on pool with 0 registrations | No-op; no error |
| 5.14 | `matchingLiveReveal=false` | Group forms silently; no slot-machine animation |

### Known Gaps
- **No cross-group swap optimization** — greedy algorithm assigns members to groups without post-processing swaps (e.g., swapping member A between groups X and Y to improve both is not done)
- **Location proximity not scored** — all areas get default 10 points; no geographic distance logic (documented future work)
- **Capacity is hard constraint** — if `seatingCapacity < groupSize`, score=0 with no "try next venue" fallback
- **3-pass redistribution only activates** when `ENABLE_ADAPTIVE_WEIGHTS=true` or strictness ≤ 0

---

## 6. 5-Tab Switching (Custom Tab Bar)

> **Tabs:** 发现 | 足迹 | [中心按钮] | 连接 | 我的

### Core Flows

| # | Scenario | Expected Result |
|---|----------|----------------|
| 6.1 | Tap "发现" tab | Switches to discover page; tab pill highlighted in pink |
| 6.2 | Tap "足迹" tab | Switches to events page; tab pill highlighted |
| 6.3 | Tap center logo button | Switches to center-hub (进行中) page; no tab highlighting on sides |
| 6.4 | Tap "连接" tab | Switches to connections page; tab pill highlighted |
| 6.5 | Tap "我的" tab | Switches to profile page; tab pill highlighted |
| 6.6 | Rapid tab switching (tap 3 tabs in <1s) | Correct final tab shown; rollback safety mechanism works |
| 6.7 | Haptic feedback on tab tap | `wx.vibrateShort({ type: 'light' })` on side tabs |

### State Sync & Resilience

| # | Scenario | Expected Result |
|---|----------|----------------|
| 6.8 | Swipe-back gesture from inner page | Tab bar selection resets to confirmed state via `pageLifetimes.show` safety net |
| 6.9 | Badge update on center hub | Badge count syncs via path syntax (`leftTabs[idx].badgeCount`) — no full array reconstruction |
| 6.10 | Center button appearance on all pages | Floating logo button rendered above tab bar surface on all tab pages |
| 6.11 | Low-end device (benchmarkLevel ≤ 15) | All animations disabled via `.joy-custom-tab-bar--low-end` class |
| 6.12 | `switchTab` fails (rare WeChat error) | Selection rolls back; `console.warn` logged; no broken UI state |

### Edge Cases

| # | Scenario | Expected Result |
|---|----------|----------------|
| 6.13 | Tab bar on pages with `safe-area-inset-bottom` | Center CTA properly offset above safe area |
| 6.14 | Very narrow screen (iPhone SE / small Android) | Center button (148rpx) does not overlap adjacent tabs |
| 6.15 | `switchTab` to center hub from non-tab page | Works (centerHub is in `tabBar.list` for WeChat validation) |
| 6.16 | Detached lifecycle cleanup | `_syncTimer` and `_showTimer` cleared; no memory leak |

---

## Pre-Test Environment Checklist

| Item | Value |
|------|-------|
| Mini-program build | `npm run dev:weapp --workspace=mini-program` |
| Server running | `npm run dev:server` |
| Test devices | At least: iPhone 15 / iPhone SE / Android (Xiaomi or similar) |
| WeChat version | ≥ 8.0.48 |
| Admin portal | `http://localhost:5002` |
| `PAYMENTS_ENABLED` | Set to `false` for non-payment tests; `true` only for payment flow tests |
| Test users | Create via `npm run user:create` or use WeChat dev login |

### Feature Flags to Verify

| Flag | Location | Default | Test |
|------|----------|---------|------|
| `personalityShareEnabled` | DB-backed, env fallback `PERSONALITY_SHARE_ENABLED` | `true` | Toggle ON → share button visible; OFF → hidden |
| `PAYMENTS_ENABLED` | Env var only | `false` | Toggle ON → payment flows active; OFF → 503 |
| `matchingLiveReveal` | DB-backed, env `MATCHING_LIVE_REVEAL_ENABLED` | `false` | Toggle ON → slot-machine animation; OFF → silent reveal |
| `matchCompassEnabled` | Env var | `true` | Toggle OFF → Compass dashboard hidden |
| `MATCH_COMPASS_STRICTNESS_ENABLED` | Env var | `true` | Toggle OFF → strictness slider hidden |

---

## Regression Smoke Test (Post-Fix)

After any bug fix, run:

1. Onboarding → personality test → share poster → save to album
2. Discover → location filter → select district → verify filtered results
3. Pool card → register → complete wizard → matching-status page loads
4. All 5 tabs → switch rapidly → verify correct page + haptic
5. Admin portal → create pool → edit → delete → verify list updates
6. Payment flow (if `PAYMENTS_ENABLED=true`): register → pay → verify fulfillment

---

## Bug Report Template

```
## Environment
- Device: [iPhone 15 / Xiaomi 14 / etc.]
- WeChat version: [e.g. 8.0.50]
- WeChat base lib: [e.g. 3.7.5]

## Feature Area: [1–6]

## Scenario: [# from checklist]

## Actual Result
[What happened]

## Expected Result
[What should have happened]

## Steps to Reproduce
1. Go to...
2. Tap...
3. ...

## Screenshots / Screen Recording
[Attach if applicable]
```
