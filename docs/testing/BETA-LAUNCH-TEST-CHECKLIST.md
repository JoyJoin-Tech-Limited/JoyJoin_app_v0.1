# JoyJoin Beta Launch — High-Value Feature Test Checklist

> Handoff-ready action list for tester. Covers 6 feature areas. Expected behavior = pass. Any deviation = file bug.

**Env setup before testing:**
- Ensure `PAYMENTS_ENABLED=true` in server `.env` (Area 4)
- Ensure `PERSONALITY_SHARE_ENABLED=true` in server `.env` (Area 1)
- Ensure `SOCIAL_ICEBREAKER_ENABLE_MINI_SCRIPT=false` in server `.env` (Area 3 — optional; disable to avoid interaction with registration)
- Admin account with `super_admin` role (Area 3 — pool creation)
- Test user with completed onboarding + archetype (Area 1, 3, 4, 5)

---

## Area 1: Personality Test Result Card Sharing

**Feature flag:** `personalityShareEnabled` (env `PERSONALITY_SHARE_ENABLED`, default `true`)
**Location:** Results page after personality test completion (`/pages/onboarding/personality-test/results`)

### Critical Path

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 1.1 | Share button visible | Complete personality test, reach FinalStage (slot machine + collectible card) | Share CTA section visible below collectible card with "分享" or action trigger |
| 1.2 | Generate poster | Tap share CTA | Poster generation begins: 3-phase progress ("准备素材中…" → "正在渲染全息卡面…" → "正在导出高清图片…"). Completion triggers haptic `success`. |
| 1.3 | Share options sheet | Wait for poster generation to complete | Action sheet appears with 3 options: "保存到相册", "分享给朋友", "预览海报" |
| 1.4 | Save to album | Tap "保存到相册" | Triggers `scope.writePhotosAlbum` permission; if granted, poster saved. If denied, shows settings redirect. |
| 1.5 | Share to WeChat | Tap "分享给朋友" | WeChat share image menu opens with poster as shared image |
| 1.6 | Preview poster | Tap "预览海报" | Full-screen poster preview opens with pinch-to-zoom |
| 1.7 | Poster content correctness | Inspect generated poster | Contains: hero archetype image, archetype name (in accent text color), tagline, summary text, top 3 matches with chemistry %s, 6 trait bars, skill cards, energy bar, rank badges, holographic stamp element, JoyJoin attribution |
| 1.8 | Feature flag off | Set `PERSONALITY_SHARE_ENABLED=false`, restart app | Share CTA hidden on results page |

### Edge Cases

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 1.9 | Rapid double-tap share | Tap share button twice quickly before generation completes | Second tap ignored; only one poster generation in progress |
| 1.10 | Poster generation failure | Simulate network failure during image loading | Shows error state with retry CTA; haptic `warning` |
| 1.11 | Save album permission denied | Deny `scope.writePhotosAlbum`, then tap "保存到相册" | Shows settings- redirect dialog; user can go to system settings to enable |
| 1.12 | Dismiss action sheet | After generation, tap outside sheet or "取消" | Sheet dismisses; poster state resets, can regenerate |
| 1.13 | Archetype image CDN failure | Block CDN archetype images | Falls back to accent-color circle with first character of archetype name |

---

## Area 2: Location Selection

**Location:** Discover page filter drawer, event registration
**Current limitation:** Shenzhen-only (南山区 + 福田区), no in-app map UI — purely hardcoded client-side district data. Admin venue picker uses Tencent Maps (<code>TENCENT_MAP_KEY</code> required).

### Critical Path

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 2.1 | Open location filter | On Discover page, tap location pill/button | `LocationFilterDrawer` slides up from bottom with backdrop overlay |
| 2.2 | Drawer layout | Inspect drawer contents | Three cluster sections visible: 南山区 (6 districts), 福田区 (3 districts), 即将开放 (8 districts). District tiles render in a 2-column grid with 28rpx names. Heat shows as compact top-right badges (`热门`/`活跃`/`即将开放`); `normal` has no badge. Pending tiles are at 0.55 opacity. Top bar has Xiaoyue mascot + title + close button. |
| 2.3 | Select a district | Tap a district tile (e.g., 科技园) | Tile shows selected state (`aria-pressed=true`) with filled primary background and white checkmark; haptic fires. Drawer auto-closes; district name shown on discover pill. |
| 2.4 | Apply/clear filter | Tap the selected district tile again, or tap "全部区域" | Selection cleared; discover shows all districts. Tap "全部区域" also clears any active filter. |
| 2.5 | Scroll containment | With drawer open, swipe up/down on the drawer content and on the backdrop | Drawer `ScrollView` scrolls its own content; swiping the backdrop (or at scroll edges) does not scroll the background Discover page. |
| 2.6 | Close drawer via backdrop | With drawer open, tap the backdrop area | Drawer closes without changing selection |
| 2.7 | Close drawer via ✕ | Tap the `✕` close button | Drawer closes without changing selection |

### Edge Cases

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 2.8 | Single-select behavior | Try selecting districts from different clusters | Only one district (or "全部区域") can be active at a time; previous selection is replaced. |
| 2.9 | No pools in selected district | Select a district with no active pools | Discover shows empty state (StatusCard with "去发现活动" or "清除筛选") |
| 2.10 | Scroll within drawer | If many districts, scroll the list | `ScrollView` scrolls smoothly with no layout jump at flex bounds |
| 2.11 | Verify heat indicators | Compare district heat data vs `packages/shared/src/districts.ts` | `hot` districts show a pink/coral top-right badge "热门"; `active` shows a gold badge "活跃"; `normal` has no badge; `pending` shows a grey badge "即将开放" at 0.55 opacity |

---

## Area 3: Event Registration + Admin Pool Creation

**Location:** Admin portal → Event Pools; Mini-program → Pool detail → Register
**Admin API:** `POST /api/admin/event-pools` (create), `PATCH /api/admin/event-pools/:id` (update)
**User API:** `POST /api/event-pools/:id/register`

### Admin — Pool Creation

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 3.1 | Admin login | Open admin portal, login with `super_admin` | Redirected to dashboard with sidebar |
| 3.2 | Navigate to Event Pools | Click "Event Pools" in sidebar | Lists existing pools with status, dates, registration count |
| 3.3 | Create new pool | Click "Create Pool" / `+` | Form opens with fields: name, description, city, start/end registration dates, event date, max participants, gender ratio, age range, pricing |
| 3.4 | Fill required fields | Fill all required fields + submit | Pool created with status `draft` or `open`. Confirmation toast. |
| 3.5 | Verify pool appears on Discover | Switch to mini-program account | New pool visible on Discover page (if `status=open` and within registration window) |
| 3.6 | Update pool | Admin: edit pool fields + save | Changes reflected in pool detail on next page reload |
| 3.7 | Close registration | Admin: set pool status to `closed` | Pool disappears from Discover. Registered users see "报名已截止" if they try to access. |

### User — Registration Flow

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 3.8 | View pool detail | On Discover, tap a pool card | Pool detail page opens with hero image, description, date/time, location, pricing tier, register CTA |
| 3.9 | Ensure user is eligible | User has completed onboarding (has `primaryArchetype`, profile essentials done) | Register CTA is active |
| 3.10 | Tap Register | Tap "立即报名" / register CTA | Navigates to registration form or payment page (depends on pricing tier) |
| 3.11 | Verify registration persisted | After successful registration, visit pool detail again | Shows "已报名" status. Check API: `GET /api/event-pools/:id` returns registration data for this user. |

### Edge Cases

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 3.12 | Pool at max capacity | Fill pool to `maxParticipants`. Try to register. | Registration rejected with clear message ("名额已满"). |
| 3.13 | Register before registration window opens | Try to register before `registrationStartDate` | Registration blocked. Clear message about when registration opens. |
| 3.14 | Register after deadline | Try to register after `registrationEndDate` | Registration blocked. "报名已截止" message. |
| 3.15 | Incomplete onboarding | User without archetype tries to register | Redirected to complete personality test or essential data. |
| 3.16 | Double registration | User who already registered tries to register again | Rejected with "你已经报名了该活动" |
| 3.17 | No admin Delete endpoint | Check admin pool management | ⚠️ Known: No DELETE endpoint exists. Pool lifecycle uses status transitions only. Soft-cancel by moving to `cancelled` status. |

---

## Area 4: WeChat Payment During Event Registration

**Feature flag:** `PAYMENTS_ENABLED` env var (default `false` — **must set to `true` before testing**)
**Location:** Pool registration flow when pool has a price > 0
**Payment types:** `event`, `event_pack`, `subscription`

### Critical Path

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 4.1 | Payment entry | Register for a paid pool | Navigated to payment flow (order review → payment method selection → WeChat Pay) |
| 4.2 | Order summary | Before payment | Shows correct plan name, price, applicable coupon (if any), total |
| 4.3 | Create payment intent | Tap "确认支付" / confirm | `POST /api/payments/create` called. Returns WeChat Pay parameters. |
| 4.4 | WeChat Pay sheet | After intent created | WeChat Pay sheet opens with `Taro.requestPayment` (timeStamp, nonceStr, package, signType, paySign). Shows correct amount. |
| 4.5 | Successful payment | Complete payment in WeChat Pay sheet | Sheet closes. Redirected to payment verification page. Mascot shows success expression. |
| 4.6 | Verify registration after payment | After payment success, check pool detail | Registration marked complete. User confirmed in pool. |
| 4.7 | Payment status polling | On verification page | `GET /api/payments/status/:wechatOrderId` polls until status = `success`. Shows progress/animation while pending. |
| 4.8 | Payments-disabled state | Set `PAYMENTS_ENABLED=false`, restart server | Paid pool registration: returns 503 with `PAYMENTS_DISABLED`. **Falls back** — confirm behavior (maybe free registration allowed? Or blocked?). |
| 4.9 | Free pool (price = ¥0) | Register for a ¥0 pool | Payment flow skipped entirely; user registered directly. |

### Edge Cases

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 4.10 | Payment cancelled | In WeChat Pay sheet, cancel/press back | Returns to order review. User can retry or cancel registration. |
| 4.11 | Payment timeout | Create intent but never complete in WeChat Pay sheet | Pending order state persists. On re-entry, offer to retry or cancel. |
| 4.12 | Webhook delivery | After successful payment | WeChat sends webhook to `POST /api/payments/webhook`. Server updates order status. Verify in DB. |
| 4.13 | Coupon validation | Apply a coupon code `POST /api/coupons/validate` | Coupon discount reflected in total. Invalid/expired coupon shows error. |
| 4.14 | Admin refund | Admin initiates refund via `POST /api/admin/payments/:id/refund` | Refund processed. User notified. Admin audit log entry created. |
| 4.15 | Rate limiting | Rapidly create payment intents | `paymentEndpointLimiter` blocks excessive requests with 429 |
| 4.16 | Welcome coupon banner impression | Complete personality test → navigate to blind-box payment with available `WELCOME50` coupon | Banner renders above coupon list with counter animation (0→50). Analytics event `welcome_coupon_banner_impression` fires. |
| 4.17 | Welcome coupon banner tap | Tap the welcome coupon banner | Confetti burst animates. Coupon auto-selected. Toast "已选择优惠券" shows. Analytics event `welcome_coupon_banner_tap` fires. Banner hidden after selection. |

---

## Area 5: Event Matching Flow

**Feature flag:** None for core matching; `MATCH_COMPASS_STRICTNESS_ENABLED` for compass tuning
**Trigger:** Admin-initiated via `POST /api/admin/event-pools/:id/match`
**Location:** Mini-program matching-status page (`/pages/matching-status/index`)

### Critical Path

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 5.1 | Trigger matching (admin) | Admin: open pool detail → "Run Matching" | Server executes poolMatchingService. Pairs scored on 6 dimensions. Groups formed. Venue assigned. |
| 5.2 | Matching state — pending | Before matching runs, user with completed registration visits matching page | "pending" state: shows "正在编织你的缘分线…" with hero image and 30s polling |
| 5.3 | Matching state — matched | After matching completes, user visits matching page | "matched" state: reveal card animates in. Shows group info, assigned venue, chemistry tokens. |
| 5.4 | Match reveal UI | Inspect reveal card | Contains: partner archetype, chemistry score, group members list, venue name/time, event theme |
| 5.5 | Venue assignment | After matching, check group detail | Venue assigned with name, address, time slot, seating capacity compatible with group size |
| 5.6 | Group fill status | On matching page or pool detail | Shows how many slots filled / total in group |
| 5.7 | Real-time broadcast | Run matching while user is on matching-status page | WebSocket `pool_matched` event received; page transitions from `pending` to `matched` without manual refresh |
| 5.8 | No-match state | Create pool with unmatched users | `no-match` state: shows mascot comfort animation + "没有找到合适的匹配" + similar pool suggestions |

### Edge Cases

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 5.9 | Not-found state | Unregistered user visits matching-status page with invalid pool ID | `not-found` state: StatusCard "没有找到报名记录" |
| 5.10 | Cancelled pool | Admin cancels pool after user registered | `cancelled` state: "这场活动已取消" + browse other pools CTA |
| 5.11 | Matching with < min group size | Pool has too few participants to form groups | Matching completes but some users unmatched. Server logs warning. Unmatched users see comfort state. |
| 5.12 | Gender ratio hard constraint | Matching respects gender ratio filters | Groups maintain configured gender balance |
| 5.13 | Match compass strictness tuning | User adjusts compass before reg lock time | Match compass strictness affects group formation (not pair scores) |
| 5.14 | Re-match | Admin runs matching again after first run | ⚠️ Verify idempotency — second match run does not create duplicate groups or orphan users |

---

## Area 6: Tab Switching Logic (5 Tabs)

**Location:** All mini-program pages
**Tab config:** 0=Discover, 1=Events, 2=Connections, 3=Profile, 4=CenterHub (center button)

### Critical Path

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 6.1 | Discover tab | Launch app | Discover tab selected by default. Tab icon for Discover highlighted with brand pink tint. |
| 6.2 | Navigate side tabs | Tab Discover → Events → Connections → Profile | Shared active pill translates to the selected tab (GPU transform, 220ms). Optimistic highlight → `wx.switchTab` → page loads. 180ms double-tap debounce. Haptic `light` vibration on each tap. |
| 6.3 | Center button | Tap center CTA button | Navigates to CenterHub (`/pages/center-hub/index`). Button shows JoyJoin logo. |
| 6.4 | Tab sync across pages | Navigate from Discover → pool detail (non-tab page) → tab back | Tab bar state preserved; correct tab highlighted on return |
| 6.5 | Tab bar layout | Inspect tab bar layout | 4 side tabs (2 left + 2 right) + center floating CTA. Surface height 128rpx, root footprint 182rpx. Center button 148rpx, solid `#FFF4F8` fill. |
| 6.6 | Swipe-back safety | Navigate to a non-tab page, swipe back | Tab bar resets to last confirmed selection (not optimistic state) after 100ms |

### Badge & State

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 6.7 | Badge display | Trigger a notification that results in badge count (e.g., match complete) | Badge appears on Events or Connections tab. Shows unread count. Badge animates with pop-in spring. |
| 6.8 | Badge update | Read new content | Badge count decrements or disappears |
| 6.9 | Center button badge | ⚠️ Check if center button supports badge | Verify if badge appears on center button when event is in progress |

### Edge Cases

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 6.10 | Rapid tab switching | Quickly tap multiple tabs in succession | Tab tap handlers debounced 180ms; sync state debounced 50ms. Rollback handles overwritten optimistic states gracefully. |
| 6.11 | Tab tap failure | Simulate `wx.switchTab` failure | Tab rolls back to previous confirmed selection. `console.warn` logged. |
| 6.12 | Low-end device | Test on device with `benchmarkLevel <= 15` | Tab bar animations disabled via `.joy-custom-tab-bar--low-end` class. Still functional. |
| 6.13 | Reduced motion | System accessibility: `prefers-reduced-motion: reduce` | All tab bar animations suppressed (spring, pulse, fade-in). |
| 6.14 | Haptic on unsupported device | Device without vibration support | `wx.vibrateShort` fails silently; tab switching still works |
| 6.15 | All 5 tabs + center button | Verify `centerHub` is in `tabBar.list` in `app.config.ts` | ⚠️ Required for `wx.switchTab` validation. Without it, `switchTab:fail can not switch to no-tabBar page` |
| 6.16 | Deep page → tab switch | Navigate to a deep page (e.g., icebreaker session), then switch tabs via center button | Center button still navigates to CenterHub, not affected by page stack depth |

---

## Summary: What's Testable vs. Known Gaps

| Area | Testable | Known Limitation | Action Needed Before Beta |
|------|----------|------------------|--------------------------|
| 1. Share Poster | ✅ Fully | None blocker-level | Ensure `PERSONALITY_SHARE_ENABLED=true` in production .env |
| 2. Location Selection | ⚠️ Partial | Shenzhen-only; no in-app map integration; hardcoded district data | **Document as v0.1 limitation** — only Shenzhen pools will show correct districts. Admin venue picker uses Tencent Maps (TENCENT_MAP_KEY). |
| 3. Event Registration | ✅ Fully | No admin DELETE endpoint (use status transitions); `projectedGroups` TODO | Document for admin: use status transitions, not delete |
| 4. WeChat Payment | ✅ Fully | Gated by `PAYMENTS_ENABLED` | Ensure `PAYMENTS_ENABLED=true` in production .env + WeChat Pay merchant credentials configured |
| 5. Matching Flow | ✅ Fully | Admin-triggered (no auto-schedule); hardcoded path comment in source | Auto-schedule is post-beta feature; path comment cosmetic only |
| 6. Tab Switching | ✅ Fully | Two competing tabBarConfig files exist (legacy vs active) | Clean up legacy `lib/tabBarConfig.ts` before beta — or verify it's dead code |

---

## QA Environment Checklist

- [ ] `PAYMENTS_ENABLED=true` in server `.env`
- [ ] `PERSONALITY_SHARE_ENABLED=true` in server `.env`
- [ ] `DATABASE_URL` pointing to test DB (not production)
- [ ] WeChat Pay merchant credentials configured for test environment
- [ ] At least 1 event pool created with `status=open` + registration window covering today
- [ ] At least 2 test users with completed onboarding + distinct archetypes + different pools registered
- [ ] Admin account with `super_admin` role
- [ ] `TENCENT_MAP_KEY` configured for admin venue geocoding (optional — venue picker shows degraded fallback without it)
- [ ] WebSocket server reachable for matching broadcast test (Area 5.7)
