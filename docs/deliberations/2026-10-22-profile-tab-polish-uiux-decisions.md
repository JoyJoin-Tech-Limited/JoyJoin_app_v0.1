# Profile Tab Polish — UIUX Design Decisions (Autonomous Sprint)

> Date: 2026-10-22 · Author: UIUX designer (subagent) · Status: LOCKED for implementation
> Plan of record: `.sisyphus/plans/profile-tab-polish-2026-10-22.md`
> Surfaces: `apps/mini-program/src/pages/profile/{index.tsx,index.scss,profileConstants.ts}`
> Format per item: **Decision / Exact values / BEM classes / Risks**. All values verified against the repo at the cited lines. No code edited.

---

## 0. Verified codebase facts (trust these over review prose)

| Fact | Evidence |
|---|---|
| P0-1 needs **zero server work**: `coupons.availableCount` is already in the profile shell the page fetches | `packages/shared/src/apiShell.ts:67-84`; page query `index.tsx:277-282` |
| `joyCoins` + `activityStreak` already on-device via the existing gamification query | `packages/shared/src/api/user.ts:19-29`; page query `index.tsx:296-301` |
| `entitlementMode` (`'subscription' \| 'event_pack' \| 'test' \| null`) on auth user | `packages/shared/src/api/auth.ts:35,43` |
| Bell icon exists, **bundled locally** (status tier is NOT in `CDN_ICON_TIERS`) → instant first paint | `packages/shared/src/iconSystem/emojiToIconMap.ts:211` (`🔔→status-bell`); CDN set at `:352-362` |
| Flame icon: `🔥→chem-fire` (chemistry tier, **CDN-only**) | `emojiToIconMap.ts:95` |
| Duo icon: `👥→icon-people` (ui tier, CDN) | `emojiToIconMap.ts:233` |
| Lock icon: `icon-lock.webp` exists but is mapped from `🛡️` — **no `🔒` entry** | `emojiToIconMap.ts:120`; asset at `src/assets/icons/ui/icon-lock.webp` |
| `icon-coupon.webp` exists but has **no emoji mapping** | `src/assets/icons/ui/` listing vs `emojiToIconMap.ts` |
| Discover bell anatomy to mirror: 72rpx circle, `$color-primary` badge pill, `99+` cap | `pages/discover/index.tsx:145-167`, `index.scss:171-205` |
| Unread count query key `['mini-program','notification-counts']` — reuse, never a second loop | `src/hooks/useNotificationCounts.ts:12` |
| Equipment entitlement rule: 1 draw per **completed blind-box event** (event ended + matched group + feedback completed) | `apps/server/src/repositories/equipmentRepo.ts:426-470` (`reconcileEquipmentEntitlements`) |
| Equipment rarity enum is only `'common' \| 'rare'` | `packages/shared/src/schema/equipment.ts:56` |
| Stage geometry budget: stage 728rpx; rail `bottom: 152rpx` = bar bottom 16 + bar min-height 112 + gap 24 | `index.scss:483-484, 516-517, 1141-1142` — **the bar cannot grow without rebalancing** |
| Growth card interior slack ≈ 29rpx (card ≈189rpx; content ≈160rpx) | `index.scss:556-561` + stage comment `:478-482` |
| Entrance token: `cubic-bezier(0.22, 1, 0.36, 1)` already used for all three current groups | `index.scss:245, 273, 495` |
| Current stagger: stage 0ms → stats 80ms → story 160ms, duration 0.45s (last completes ≈610ms) | `index.tsx:398-405`, `index.scss:245-246, 495-496, 1333-1334` |
| Story artwork is a bundled main-package asset (Ken Burns costs no CDN fetch) | `profileConstants.ts:8` |
| Duo share mode resolution exists — reuse, don't duplicate | `src/lib/duo/duoContext.ts:41-46`; consumer `pages/profile-linked/invite/index.tsx:127-156` |
| No dedicated milestones route exists → accordion is the terminal surface | `index.tsx:983-985` (comment) |

---

## 1. P1-4 Badge wall (5-tier: 1/3/5/10/20)

**Decision.** Keep the P6b collapsed entry row as the section header (it already carries icon + 成就徽章 + 已解锁 X/5 + chevron). Expanding reveals **all 5 badges in one flex row of equal cells** — unlocked in full colour with a gold rim, locked as recognizable silhouettes with a lock corner badge and a progress hint. **No 查看全部 link**: no milestones route exists (`index.tsx:984`); the expanded wall IS the full 图鉴. If a route is added later, 查看全部 goes right of the entry-row summary, vertically centered, `$font-size-sm` semibold `$color-text-link`.

**Exact values.**
- Expanded row: `display: flex; gap: $spacing-sm (16rpx); margin-top: $spacing-sm` (extends existing `&__milestones-row`, `index.scss:419-424`). Cell width derives to (670 − 4×16)/5 ≈ **121rpx** on standard screens — `flex: 1; min-width: 0`.
- Cell: `padding: $spacing-sm (16rpx) $spacing-xs (8rpx)`; badge img **72rpx × 72rpx** (down from 80rpx, `index.scss:455-459`, to fit 5-up); label `$font-size-2xs (20rpx)` semibold, centered, `white-space: nowrap` (labels are ≤4 CJK chars at all thresholds: 初次见面/三场连击/五场常客/十场老友/二十场传奇 — final names PM-owned, these are the working copy).
- Unlocked cell: `@include card` (existing) + `border: 1rpx solid rgba($color-landed-gold, 0.55)` (echoes `&__level-plate`, `index.scss:1091-1092`) + badge full opacity.
- Locked cell: flat surface (no shadow), `background: rgba($color-surface, 0.6)`; img `opacity: 0.38` (**not** `filter: grayscale` — WeChat filter reliability is flagged in AGENTS §mixins comments); lock corner badge = 28rpx circle `rgba($color-text-primary, 0.72)` bg with `JoyJoinIcon` lock at 16rpx, positioned `top: 8rpx; right: 8rpx` absolute; hint line 「还差 N 场」 `$font-size-2xs` `var(--profile-text-tertiary)` under the label.
- Lock icon: **add `'🔒' → { assetKey: 'icon-lock', tier: 'ui', size: 24 }`** to `emojiToIconMap.ts` (one additive line; fallback if rejected: reuse `🛡️`).
- Pop-in on expand: per-badge `transform: scale(0.5) → 1.06 → 1` + opacity, 300ms total, **60ms stagger** (5th badge lands at 240+300=540ms), `cubic-bezier(0.22,1,0.36,1)`. Cells occupy final geometry from frame 0 (explicit 72rpx img box) → **zero layout shift during pop**.
- Newly-unlocked on tab return: diff `unlockedMilestones` vs a per-user storage set (`joyjoin_profile_badges_seen:<userId>`); new keys get a one-shot ring overlay (separate div, `transform: scale(1→1.3); opacity: 0.8→0; 900ms once`) + `haptics('success')`; then persist. RM = static gold rim only.
- Threshold test at `profileConstants.test.ts:230` updates to 5 entries; `MILESTONE_BADGES` gains `regular5/veteran10/legend20` (CDN-only per asset policy, Batch-D pipeline).

**BEM classes.** `profile-page__milestones-row--five-up` (modifier, not restructure) · `profile-page__milestone--locked` · `profile-page__milestone--just-unlocked` · `profile-page__milestone-lock` · `profile-page__milestone-hint` · `profile-page__milestone-unlock-ring`.

**Risks.** (a) 5-up on ≤340px screens: cells shrink to ≈105rpx; badge img drops to 64rpx via the existing narrow-device media query block (`index.scss:1547`). (b) CDN badge assets must land BEFORE the code PR (plan §Commit Strategy) — locked cells render silhouettes only after assets exist; order asset PR first. (c) `gap: 16rpx × 4` + padding keeps the row inside `$container-padding` margins — verify in DevTools at 320/375/414px.

---

## 2. P2-1 Three-act restructure (我是谁 / 我有什么 / 我能干嘛)

**Decision.** Pure re-layout of existing modules inside the current `ScrollView` (`index.tsx:568`). **No act labels, no hairline dividers** — act separation is rhythm-only: **24rpx ($spacing-md) intra-act, 40rpx ($spacing-lg) inter-act**. Act labels would add reading noise on a page that already has a large title + section header; the 8rpx-rhythm contrast (24 vs 40) is the premium, iOS-native answer. Only Act 3 keeps a visible section header (the existing 我的故事 heading, `index.tsx:938-947`).

**Vertical order (post-P0/P1 content, pre-P2-5 large title sits above Act 1):**

```
┌ NAV (P0-8 condensing) ─────────────────────────┐
│ [P2-5 large title block — outside ScrollView?  │
│  NO: inside ScrollView so it scrolls away]     │
├ ACT 1 · 我是谁 ────────────────────────────────┤
│  identity-stage (728rpx, unchanged)            │
│   ├ identity copy card (stage-glass, P0-7)     │
│   ├ growth card + streak flame (stage-glass)   │
│   └ equipment bar (stage-glass + 2rpx bottom)  │
├ ~~~ 40rpx act gap ~~~ ─────────────────────────┤
├ ACT 2 · 我有什么 ──────────────────────────────┤
│  entitlement strip (P0-1, 88rpx pills)         │
│  24rpx                                         │
│  compact data band (demoted stats, 96rpx)      │
│  24rpx                                         │
│  badge wall entry row + accordion (P1-4)       │
├ ~~~ 40rpx act gap ~~~ ─────────────────────────┤
├ ACT 3 · 我能干嘛 ──────────────────────────────┤
│  Duo card (P2-4, contextual — only when live)  │
│  24rpx (only when Duo card rendered)           │
│  我的故事 story card (P0-9 Ken Burns)          │
│  24rpx                                         │
│  newbie quest line (P1-5, 0-event users only;  │
│   never co-renders with Duo card — a 0-event   │
│   user has no active registration)             │
│  settings entry row                            │
│  spacer (existing)                             │
└────────────────────────────────────────────────┘
```

**Compact data band (stat demotion).** One row card, `height: 96rpx`, `background: rgba($color-surface, 0.94)`, `border: 1rpx solid var(--profile-divider)`, `border-radius: $card-radius-sm`, `$shadow-card` — the settings-entry chrome family (`index.scss:67-87`). Three equal cells (`flex: 1`) separated by 1rpx `var(--profile-divider)` vertical hairlines; per cell: value `$font-size-md (28rpx)` `$font-en-brand` bold `$color-primary-dark` + label `$font-size-2xs (20rpx)` tertiary, stacked, centered. Tints and icons are dropped (demotion = quieter). Tap targets preserved per cell (events → switchTab footprint; connections → switchTab; completion → edit-profile). Zero data loss: every former card keeps its destination; the completion mini-bar moves INTO the third cell as a 48rpx × 6rpx track under the value.

**Stage-glass per act.** Act 1: full P0-7 material on the three on-stage surfaces. Act 2: off-stage chrome family (no blur — plain page bg behind), strip pills + band + entry row all share `rgba($color-surface,0.94)` + divider border + `$shadow-card`. Act 3: story card keeps its art-card material; Duo card uses stage-glass BASE (see §5); quest line uses tint-cream surface.

**Entrance choreography (replaces P0-6 grouping once P2-1 lands).** 5 groups, hero keeps 0.45s, all later groups 0.35s (keeps ≤600ms budget):

| Group | Content | Delay | Distance | Duration |
|---|---|---|---|---|
| A | identity stage | 0ms | 16rpx | 450ms |
| B | entitlement strip | 60ms | 12rpx | 350ms |
| C | data band | 120ms | 12rpx | 350ms |
| D | badge entry | 180ms | 8rpx | 350ms |
| E | story + Duo (Duo inherits E's slot when present) | 240ms | 8rpx | 350ms |

Settings row = chrome, **no entrance motion** (static). Last completion: 240+350 = **590ms ≤ 600ms** ✓. All delays pure CSS on `--entered` modifiers (existing `hasEntered` driver, `index.tsx:401-405`).

**BEM classes.** `profile-page__data-band` · `__data-band-cell` (+ `--events/--connections/--completion` modifiers for aria) · `__data-band-value` · `__data-band-label` · `__data-band-divider` · `__data-band-mini-progress` · acts need no wrapper classes (rhythm via `margin-bottom` tokens on existing section roots; add `profile-page__act-gap` utility spacer only if margin collapsing misbehaves in WXSS flex — default: use margins).

**Risks.** (a) First-viewport budget: nav 88 + stage 728 + 40 + strip 88+24 + band 96 = ~1064rpx vs ~1234rpx usable (iPhone standard) → badge entry row partially visible, story below fold; **the three questions are still answered in-viewport** (acceptance met). On short devices (≤667pt) story card scrolls — acceptable, P0-9's Ken Burns makes the scroll rewarding. (b) Removing the three tinted stat cards deletes the per-card stagger P0-6 ships first — fine, P0-6's per-card delays simply never run post-P2-1. (c) Compact band cells at ≤340px: label drops to 18rpx? NO — 20rpx floor; instead value drops to 24rpx inside the media query.

---

## 3. P2-5 iOS large title

**Decision.** Large title block lives **inside the ScrollView** as the first child (it must scroll away under the condensing nav). The P0-8 nav `--scrolled` threshold and the large-title collapse are **one state machine** in `useProfileScroll` with a **hysteresis band** (enter ≥96rpx, exit <64rpx) — the plan's "one threshold, no jitter loop" is implemented as two edges around one nominal 88rpx line (nav height), which is the standard iOS behavior and kills the toggle loop.

**Exact values.**
- Block: `padding: 16rpx $container-padding 8rpx` (top gap 16rpx; bottom 8rpx optical — stage margin-top already 24rpx).
- Title 「我的」: `@include type-title` → `$font-cn-display`, **48rpx ($font-size-2xl)**, bold, `line-height: 1.18` (`_mixins.scss:96-102`). (Plan says 48rpx ✓ = 2XL tier, "Greetings/hero statements" role — correct tier for a page-owning title.)
- Sub-line: **22rpx ($font-size-xs)**, `$font-ui`, normal weight, `var(--profile-text-tertiary)`, `line-height: 1.4`. Content = date line 「10月22日 周四」; **greeting merge decision**: the P0-3 daily greeting appears here ONLY when the identity-card bio slot is occupied by a real user bio (format 「10月22日 周四 · {greeting}」); when bio is empty the greeting stays in the identity card (P0-3 fallback) and the sub-line is date-only. Greeting never renders twice.
- Collapse: large title `opacity 1→0; translateY 0→-8rpx; 180ms ease` on page-root `--scrolled`; nav title `我的` (existing 36rpx, `index.scss:59-65`) fades `opacity 0→1` same window. Both transform/opacity only.
- `useProfileScroll` contract: `onScroll` throttled via rAF-or-33ms floor on the existing ScrollView; returns `{ scrolled: boolean }`; class toggled at crossings only (no per-frame re-render — plan Must NOT).

**BEM classes.** `profile-page__large-title` · `profile-page__large-title-text` · `profile-page__large-title-sub` · page modifier `profile-page--scrolled` (shared by P0-8 + P2-5).

**Risks.** (a) ScrollView `onScroll` fires per frame — the hook must not `setState` per frame (threshold-crossing latch only). (b) `env(safe-area-inset-top)` is already inside nav height — the 96rpx enter threshold is measured from `scrollTop`, safe-area-independent. (c) Sub-line with greeting can overflow 1 line → `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` (mirrors `&__identity-bio`, `index.scss:649-659`).

---

## 4. P2-4 Duo card (双人同行情境卡)

**Decision.** Placement: **Act 3 first item** (directly above 我的故事) — it is the most actionable 能干嘛 surface while live, and collapses cleanly when absent. Renders only when `activeRegistration && !boundDuo` (plan gates). Material: **stage-glass BASE without the animation** — the 165° `rgba(255,255,255,0.72)→rgba(255,255,255,0.56)` gradient + 1rpx `rgba(255,255,255,0.65)` border + dual shadow are applied; the `::after` lighting band is **omitted** (drift is reserved for permanent on-stage surfaces; a contextual card gets the material family, not the motion). `backdrop-filter` is a no-op over the flat page bg — harmless, kept for spec fidelity. Tap → reuse `resolveInviteShareMode` path (navigate to `pages/profile-linked/invite`; never duplicate duo-code logic, `duoContext.ts:41-46`).

**Exact values.**
- Card: `margin: 0 $container-padding $spacing-md`; `padding: $spacing-md (24rpx)`; `border-radius: $card-radius (32rpx)`; `min-height: 128rpx`; flex row, `gap: $spacing-sm`.
- Icon: 64rpx circle, `background: $color-primary-light`, `JoyJoinIcon emoji='👥' tier='ui' size={40}` (`icon-people`, CDN tier — lazy-load default fine, circle bg covers the decode gap).
- Text stack (`flex: 1; min-width: 0`): headline **28rpx ($font-size-base)** semibold `$font-ui` `var(--profile-text-primary)` — 「你报名的那场局，还差一位同桌」(copy-ban clean: 排桌 vocabulary, no 匹配/社交/灵魂/AI); sub **22rpx ($font-size-xs)** secondary — 「邀请好友同行，排进同一桌」; `margin-top: 4rpx`.
- CTA: solid `$color-primary` pill, `height: 64rpx; padding: 0 24rpx; border-radius: $radius-pill`, label 「去邀请」 24rpx semibold white, `haptics('medium')`, pressed `scale(0.97)` (mixin `tap-feedback`).
- Dismiss ×: **88rpx × 88rpx hit area** (= 44pt at 750rpx/375pt canvas ✓) absolute `top: 0; right: 0`; glyph = CSS-drawn × reusing the `&__identity-nudge-dismiss-icon` two-bar technique (`index.scss:751-775`) at 20rpx, `var(--profile-text-tertiary)`; `stopPropagation`; `haptics('light')`. Dismissal persistence: **session-only** (module-level flag, NOT storage) — conservative default pending PM sign-off; card reappears next cold start while conditions hold.
- Entrance: inherits Act-E stagger slot (240ms, §2 table) with `scale(0.98)→1` + opacity; exit on dismiss = `opacity→0; scale→0.98; 160ms`, then unmount (height collapse is acceptable post-fade — user-initiated).

**BEM classes.** `profile-page__duo-card` · `__duo-card-icon` · `__duo-card-text` · `__duo-card-headline` · `__duo-card-sub` · `__duo-card-cta` · `__duo-card-dismiss` (+ `--pressed` modifiers).

**Risks.** (a) Stage-glass alpha 0.72 over the warm page gradient is subtle — if visual audit finds it indistinct from chrome-family cards, escalate border to `rgba($color-primary, 0.14)` (documented exception, ≤1px-equivalent). (b) Session-only dismissal can read as "ignoring me" if PM expected forever — flagged for sign-off; switching to storage is a one-line change. (c) Duo query adds one fetch (`createDuoInvite` is POST-as-read on invite page — profile should use the lighter `GET /api/pools/:id/duo-status` + lazy code creation on tap; **do not** mint codes from a tab page render).

---

## 5. P1-6 Equipment progress teaser + rarity rings

**Decision.** The equipment bar's geometry is **frozen at 112rpx** (`index.scss:1141-1142` — the rail's 152rpx reservation leaves zero growth room). Therefore the teaser does NOT add a line: it is a **mode swap of the 4-slot preview cluster**, shown only when (a) no claim pending AND (b) `equippedCount === 0` (the slots are empty marks anyway — swapping them for the next-draw hook is pure gain). Users with equipment keep slots; their claim signal stays the existing W3 dot+chip.

**Honest progress, zero fabrication.** Server rule is 1 draw per completed blind-box event (ended + matched + feedback done — `equipmentRepo.ts:426-470`). The teaser is a **3-segment stepper**, not a percentage bar: 报名 → 赴约 → 反馈. Segment state derives from real data only: active registration exists (registrations/shell), event `dateTime` passed, feedback `completedAt` — each lights one segment. Copy by furthest stage: none → 「报名一场局，结束后可抽一件」; registered → 「赴约并完成反馈，即可抽一件」; attended → 「写下反馈，抽取你的第一件装备」. If per-event feedback state is not available client-side, degrade to stage-1-only rendering from registrations (fail-open, no invented progress).

**Exact values.**
- Teaser cluster (replaces `&__equipment-slots` in the same flex slot): copy **20rpx ($font-size-2xs)** `var(--profile-text-secondary)` single line + ellipsis; stepper track = 3 segments, each **56rpx × 8rpx**, `gap: 8rpx`, `border-radius: 4rpx`; lit = `$color-primary`, unlit = `var(--profile-primary-08)`; lit-segment fill snaps (no tween — state truth, not decoration).
- Rarity ring: `profile-page__equipment-slot--rare` — static `border: 2rpx solid rgba($color-landed-gold, 0.72)` + `box-shadow: 0 0 12rpx rgba($color-landed-gold, 0.25)` (static, not animated); the "flow" is an `::after` inset ring `opacity 0.5→1 pulse, 2.4s` — **opacity only**, off under RM and `deviceTier.isDegradation` (mirrors `--no-pulse` pattern, `index.scss:853-855`). Never reveals drop rates (plan Must NOT): no pity numbers anywhere (`wallet.pityMisses/pityTarget` stays server-side).
- Claim state whole-strip signal: `profile-page__partner-entry--claimable` — `border-color: rgba($color-landed-gold, 0.72)` + `::after` edge ring opacity breathe **1.5s** (same period as `profile-equipment-wait-breathe`, `index.scss:1284-1287`, so dot and strip share one calm rate). RM = static gold edge.

**BEM classes.** `profile-page__equipment-teaser` · `__equipment-teaser-copy` · `__equipment-teaser-track` · `__equipment-teaser-segment` (+ `--lit`) · `profile-page__equipment-slot--rare` · `profile-page__partner-entry--claimable`.

**Risks.** (a) 20rpx teaser copy + 56rpx segments must fit the preview flex slot beside 「当前装备」 label (~90rpx) and action cluster (≤188rpx): available ≈ 320rpx → copy truncates at ~12 CJK chars; copy above is ≤13 — add ellipsis and verify at 320px. (b) Feedback-state source unverified — implementer must confirm the events shell carries per-event feedback status; otherwise ship stage-1-only fallback (specified above). (c) Mode swap means first-equipment users never see empty slot marks — acceptable: the teaser IS the empty state.

---

## 6. P0-1 Entitlement strip

**Decision.** **Fixed row of 3 equal pills** (not horizontal scroll — 3 items fit; scroll hints at hidden content we don't have). Placement between identity stage and stats band (plan). Data — **all three sources already on-device, zero server work**: 悦聚卡 = `entitlementMode` (auth), 券 = `profileShell.coupons.availableCount` (`apiShell.ts:67-84`), 悦币 = `gamification.joyCoins` (`user.ts:21`). Render rule: strip renders only when ≥1 pill has a real datum; zero-asset state (null mode + 0券 + 0币) hides the whole strip (plan Must NOT: degrade silently). Tap → `openMiniProgramPaymentPage` (`src/lib/payment/paymentEntry.ts:38`), `haptics('light')`.

**Exact values.**
- Strip: `display: flex; gap: 8rpx; padding: 0 $container-padding; margin-bottom: $spacing-md (24rpx)`. Pill: `flex: 1; min-width: 0; height: 88rpx (= $cta-min-tap)`, `padding: 0 $spacing-sm`, `border-radius: $card-radius-sm (24rpx)`, `background: rgba($color-surface, 0.94)`, `border: 1rpx solid var(--profile-divider)`, `$shadow-card` — settings-entry chrome family.
- Pill anatomy: icon slot **40rpx** (JoyJoinIcon size 36) + text stack: label **20rpx ($font-size-2xs)** `var(--profile-text-tertiary)`; value **24rpx ($font-size-sm)** semibold `$color-primary-dark`, `$font-en-brand` for the numeral; `gap: 2rpx` (optical).
- Icons: 悦聚卡 → `🎫 icon-ticket` (ui/CDN, mapped `:234`); 券 → **add `'🎟️' → icon-coupon` mapping** (asset exists unmapped; one additive line; fallback: 🎫 reuse is BANNED — two identical icons on one strip reads broken; if mapping blocked, use CSS ticket notch on the pill edge instead); 悦币 → `💰 reaction-money-bag` (reaction/CDN, `:164`).
- **Paid vs free:** paid (`subscription`/`event_pack`) → 卡 pill gains gold rim `border-color: rgba($color-landed-gold, 0.55)` + tint `rgba($color-landed-gold, 0.10)` bg (level-plate family) + value 「生效中」; free → neutral pill, label-only value 「悦聚卡」 (no 「未开通」 shame copy, no urgency). `test` mode renders as free.
- Pressed: `hoverClass` → `transform: scale(0.985); background: var(--profile-primary-06)` (consistent with entry rows, `index.scss:365-368`).

**BEM classes.** `profile-page__entitlements` · `__entitlement-pill` (+ `--paid`) · `__entitlement-pill-icon` · `__entitlement-pill-text` · `__entitlement-pill-label` · `__entitlement-pill-value`.

**Risks.** (a) Two CDN icons decode async — pill text renders first, icons fade in (JoyJoinIcon's built-in opacity/scale entrance) — acceptable; do NOT bump to local bundling (package budget). (b) Strip adds ~112rpx to first viewport — recovered later by P2-1's band compaction; pre-P2-1 short-device fold check required in DevTools. (c) `availableCount` vs `count`: use `availableCount` (usable now), never total.

---

## 7. P0-2 Notification bell

**Decision.** Bell enters the **nav bar** (`index.tsx:565-567`), absolute-positioned right; the centered title is untouched. Anatomy **mirrors the shipping Discover bell exactly** (72rpx circle, primary badge pill — `discover/index.scss:171-205`) for cross-surface consistency. Unread source = the existing `useNotificationCounts()` query (key `['mini-program','notification-counts']`, `useNotificationCounts.ts:12`) — profile simply subscribes; TanStack dedupes, **no second polling loop**. Navigation via `MINI_PROGRAM_ROUTES.notifications` (`onboardingRoutes.ts:80`), `haptics('light')`.

**Exact values.**
- Wrapper: `position: absolute; right: $container-padding (40rpx); top: calc(env(safe-area-inset-top) + 8rpx)` inside the nav (nav height = safe-area + 88rpx, so the circle centers in the 88rpx band); circle **72rpx** (Discover parity; within-nav density beats the 88rpx standalone guideline — documented exception, Discover precedent).
- Icon: `JoyJoinIcon emoji='🔔' size={44}` — resolves `status-bell` (status tier is **bundled locally**, not in `CDN_ICON_TIERS:352-362`) → instant paint, emoji-free, zero CDN dependency. Do NOT pass `tier='semantic'` (Discover's prop falls through to the same mapping anyway; omitting is cleaner).
- Badge: **count pill** (not dot): `min-width: 32rpx; height: 32rpx; padding: 0 6rpx; border-radius: 999rpx; background: $color-primary; color: $color-text-white; font-size: 20rpx`, positioned `top: -4rpx; right: -8rpx` of the circle. Cap: **「9+」** at >9 — deliberate divergence from Discover's 99+ (the 88rpx nav band is denser than Discover's header; a 3-glyph badge is 48rpx wide and crowds the title on 320px screens). Hidden at 0. Follow-up note: aligning Discover to 9+ later is a one-line change if PM wants strict parity.
- Pressed: `hoverClass` → `background: var(--profile-primary-08)` (Discover `--active` parity).
- aria: `aria-label={unread > 0 ? `通知，${unread} 条未读` : '通知'}` (Discover parity).

**BEM classes.** `profile-page__nav-bell` (+ `--pressed`) · `profile-page__nav-bell-badge` · `profile-page__nav-bell-badge-text`.

**Risks.** (a) Nav `--scrolled` (P0-8) adds a hairline/shadow — bell sits above it via nav's existing `z-index: 20` context; no new stacking work. (b) `refetchInterval` from the hook already pauses on app-hide — subscribing from profile inherits that ✓. (c) 9+ vs 99+ divergence is the only deliberate inconsistency — flagged here so it isn't "fixed" back by accident.

---

## 8. P0-4 Streak flame (连续在局)

**Decision.** The flame capsule joins the **level-plate row** inside the growth card: the row becomes `justify-content: space-between` — left = `Lv.X` plate (unchanged), right = flame capsule. This adds **+8rpx** of card height in the common case (48rpx capsule vs 40rpx plate), inside the card's ~29rpx interior slack — **the 728rpx stage geometry and 152rpx rail reservation are untouched**. Hidden at streak 0 (plan: no shaming copy). Data: `gamificationQuery.data.activityStreak` (field exists, `user.ts:25` — assert it on the client type per plan).

**Exact values.**
- Row: wrap existing `&__level-plate` + new capsule in `profile-page__growth-foot` (`display: flex; align-items: center; justify-content: space-between; margin-top: $spacing-xs`).
- Capsule: `min-height: 48rpx; padding: 4rpx 16rpx; border-radius: $radius-pill; background: rgba($color-brand-gold, 0.12)` (equipment-wait-chip family, `index.scss:1246-1256`); contents: flame `JoyJoinIcon emoji='🔥' tier='chemistry' size={28}` (`chem-fire`, CDN — text renders regardless) + 「连续 N 周」 **20rpx ($font-size-2xs)** semibold `$color-primary-dark`, `gap: 6rpx`.
- Next-milestone hint (when `3 - (N % 3) === 1`, per the 3/6/12-week ladder in `gamificationService.ts:330-444`): capsule gains a **second line** 「再坚持 1 周领 +200」 20rpx `var(--profile-text-tertiary)` → capsule ≈ 68rpx; row grows +28rpx → card content ≈ 188rpx vs ≈189rpx budget — **fits by ~1rpx; DevTools verification mandatory** (worst-case long level names like `Lv.12 传奇` were measured into the 280rpx card width: plate ≈ 130rpx + capsule ≈ 132rpx ≤ 232rpx interior ✓).
- Entrance: capsule fades up with the stage's own entrance (no separate stagger — it's inside Act A); value changes snap (P1-3 count-up does NOT cover the streak number).
- RM: static capsule, no entrance.

**BEM classes.** `profile-page__growth-foot` · `profile-page__streak-capsule` (+ `--near-milestone`) · `profile-page__streak-icon` · `profile-page__streak-text` · `profile-page__streak-hint`.

**Risks.** (a) The +28rpx near-milestone case is the tightest fit on the page — if DevTools shows the growth card kissing the identity card at ≤340px, drop the hint line to `position: absolute` tooltip? NO — fallback: hint replaces capsule's count line separator… simpler: at ≤340px the hint line is hidden (media query), capsule stays one line. Locked as the documented degradation. (b) Flame is CDN — offline first paint shows count text alone; acceptable (chip family behaves the same today). (c) Ladder math must be unit-tested against the server thresholds (plan acceptance).

---

## 9. P1-3 Count-up instrumentation

**Decision.** Animate **four numbers only**: 潮流值 value (`&__growth-value`), 已参加活动, 我的连接, 资料完成度% (`&__stat-value`). **Never** the streak count, entitlement pill values, badge counts, or `/nextTarget` denominator. First-settle-only: animate 0→N on first data arrival, snap on any refetch (per plan). New hook `src/hooks/useCountUp.ts` (+ unit test).

**Exact values.**
- Duration **600ms**, easing = **brand token cubic-bezier(0.22, 1, 0.36, 1)** sampled in JS (`t' = 1 - Math.pow(1 - t, 3)` is NOT the same curve — use a cubic-bezier solver or precomputed 16-step LUT; the LUT is fine at this duration).
- Cadence: **rAF with a 33ms floor** (~18 updates over 600ms) — halves setData churn vs 60fps with no perceptible step. No rAF in the JSCore runtime → `setTimeout(33)` fallback inside the hook.
- Sync: count-up start is triggered by the same data-arrival effect that flips the progress bars' `scaleX` (index.tsx:693-700, 925-929) → numbers and bars land together (plan acceptance).
- Anti-jitter: `$font-en-brand` (Quicksand — tabular numerals, `_variables.scss:159`) is already on both value classes; add `min-width` reservations: `&__stat-value { min-width: 104rpx; text-align: center }` (3 glyphs at 40rpx); `&__growth-value { min-width: 160rpx }` (4 digits at 48rpx). 资料完成度's `%` glyph lives OUTSIDE the animated span so width stays numeric.
- RM = instant final value (hook checks `getSystemReducedMotionCompat()` once, same source as JoyJoinIcon).
- Loading placeholders (`—`, index.tsx:686/895/909) never animate; first numeric value is the animation start.

**BEM classes.** No new classes; min-width additions land on existing `&__stat-value` / `&__growth-value`.

**Risks.** (a) setData storms: 4 concurrent counters × 18 ticks is trivially safe, but NEVER extend count-up to high-frequency sources. (b) `useCountUp` must cancel on unmount and on value change mid-flight (snap to latest). (c) Tabular-numeral assumption holds only while Quicksand loads — before font load, system numerals shift width slightly; the min-width reservation absorbs it.

---

## 10. P0-9 Story Ken Burns + photo-develop

**Decision — reconciliation:** the plan pins a 20s loop; my brief asked to confirm 1.0→1.06 over 12s. Locked spec: **ping-pong cycle — 10s out + 10s back = 20s period, `ease-in-out`, `alternate`**, scale **1.0 → 1.06** with `translateX 0 → -1.5%` (drift, echoing `identity-stage-drift`, `IdentityStageScene.scss:141-150`). Seamless (no snap-back reset a pure 20s one-way push would need) and transform-only → GPU-composited. The story image is `aspectFill` inside a fixed 280rpx `overflow: hidden` card (`index.scss:1391-1416`), so the 6% zoom + 1.5% drift never exposes an edge.

**Exact values.**
- `@keyframes profile-story-kenburns { from { transform: scale(1) translateX(0) } to { transform: scale(1.06) translateX(-1.5%) } }` on `&__story-image`; `animation: profile-story-kenburns 10s ease-in-out infinite alternate; will-change: transform`.
- Pause gating: `useDidShow`/`useDidHide` toggle a `--paused` modifier (`animation-play-state: paused`) — matches the plan's playState requirement (CDN playState gating listed in the P0-7 spec applies to this loop too).
- Photo-develop entrance: existing `&__story-wash` (`index.scss:1418-1420`) gains `opacity 0→1, 600ms, 200ms delay` inside the archive's `--entered` cascade (archive enters at 160ms → wash develops 40ms later, reads as the photo surfacing).
- Round-button pulse ring: **separate ring div** (plan: NOT animated box-shadow) — `&__story-action-ring`, absolute-centered on the 72rpx `&__story-action` (`index.scss:1482-1495`), 88rpx circle, `border: 2rpx solid rgba($color-surface, 0.9)`, `transform: scale(1→1.35); opacity: 0.7→0; 2.4s ease-out infinite`; off under RM + `deviceTier.isDegradation` (same gate as `&__partner-platform--no-pulse`).
- RM fallback: image static at `scale(1.02)` (keeps a whisper of overscan crop so the composition matches the animated frame's midpoint), wash opacity 1, no ring.

**BEM classes.** `profile-page__story-image--kenburns` (modifier on existing class) · `profile-page__story-action-ring` · page-level `--paused` modifier pattern.

**Risks.** (a) WeChat native `<Image>` transform animations composite reliably, but verify in DevTools' layer panel per plan acceptance; if paint storms appear, drop `translateX` and keep scale-only. (b) `alternate` on `infinite` is WXSS-safe (standard CSS animation). (c) The wash entrance must not fight the archive's 160ms group fade — both are opacity on different elements; total added motion budget ≈ 0.

---

## 11. Validation of the pre-specced four (P0-7, P0-6, P1-2, P1-1)

### P0-7 stage-glass — **ACCEPT with one mandated fallback**
Values (165° gradient `rgba(255,255,255,0.72)→rgba(255,255,255,0.56)`, `backdrop-filter: blur(28rpx) saturate(140%)`, 1rpx `rgba(255,255,255,0.65)` border, `::after` 45° band opacity 0.10→0 over 8s) are WXSS-legal (rgba, linear-gradient with rgba stops, transform/opacity-only drift ✓; no min/max/clamp/hsla ✓). **Conflict flagged:** current on-stage cards run 0.94/0.90 alphas with NO blur (`index.scss:533-541`) because WeChat Android `backdrop-filter` support is partial; at 0.72 alpha over the scene's darker street regions, text contrast depends on the blur actually applying. **Mandate:** a `--no-blur` fallback modifier (gradient alphas raised to 0.92/0.84, border `rgba(255,255,255,0.5)`) applied when `useDeviceTier().isDegradation` OR a one-time runtime probe (`Taro.getSystemInfoSync()` iOS vs Android — iOS WKWebView honors backdrop-filter, Android XWeb is the risk). Drift `::after` gated by page-visibility playState + RM static ✓ as specced. Equipment bar 2rpx bottom edge: `border-bottom: 2rpx solid rgba($color-primary, 0.22)` — pressable affordance ✓.

### P0-6 entrance choreography — **ACCEPT, one budget note**
Easing `cubic-bezier(0.22,1,0.36,1)` matches existing tokens ✓; pure-CSS delays on `--entered` ✓; translate decay 16→12→8rpx by weight ✓. Note: with duration 0.45s, any group starting after ~150ms busts the ≤600ms total (existing story already ends at 610ms). Resolution: post-P0-6 groups (collections 180ms, services 220ms) use **0.35s** duration → last completion 570ms ✓. P2-1 later re-groups per §2. Per-stat-card 0/70/140ms via `:nth-child` transition-delay in SCSS — no JS timers ✓.

### P1-2 foil sweep — **ACCEPT**
-45° band at 20% width via `::after` `linear-gradient(-45deg, rgba(255,255,255,0) → rgba(hue,0.5) → rgba(255,255,255,0))`, `transform: translateX(-150%→350%)` over 1.6s, `pointer-events: none`, once-per-page-instance ref lock (per cold start — NOT storage once-ever, per plan recommendation), RM skips, hue inline via `formatHSLAsRGBA` (mirrors `identityStageFoilStyle`, `index.tsx:409-416`) ✓. The ≥6s interval spec is moot under once-per-instance; keep it as a safety re-arm guard only if the ref lock is ever relaxed.

### P1-1 avatar touch — **ACCEPT with duration correction**
Plan's squash&stretch (scaleY 1→0.93→1.04→1) on a **wrapper around `&__partner-breath`** so the breathing loop keeps its own transform layer ✓ (composition rule honored). One bounce per tap, ref-locked, no queue ✓; `haptics('medium')` ✓; RM = haptic only ✓. **Correction:** 120ms is too fast for a 3-keyframe bounce to read — bounce duration **360ms** (0.93@30%, 1.04@65%, 1@100%). The brief's "scale 0.96 / 120ms" is retained as the reduced-scope fallback (simple press) if squash&stretch review fails. Halo = separate radial-gradient div, opacity+scale pulse, behind the avatar (rim-light family, `IdentityStageScene.scss:83-92`). Contact shadow under feet: extend `&__partner-platform` — one static ellipse is already there; the tap variant deepens `opacity` once, transform-only.

---

## 12. Cross-cutting locks

1. **Copy audit (all items above):** no 匹配/社交/灵魂/AI; all new strings use 排桌/局/装备/故事 vocabulary. AIGC 角标: nothing here is AI-generated — no labels needed.
2. **Haptics:** bell/strip/pills `light`; Duo CTA `medium`; badge just-unlocked + (P1-1) avatar tap `success`/`medium` as specced.
3. **RM matrix:** every new loop (Ken Burns, pulse ring, claim breathe, rarity flow, foil sweep, stage-glass drift) has a static end-state under `prefers-reduced-motion`; entrance choreography collapses to instant.
4. **Shared-map additions needed (2 one-liners, additive):** `🔒→icon-lock` (P1-4), `🎟️→icon-coupon` (P0-1). Both assets exist; run the iconSystem tests + guardrails.
5. **Geometry invariants (do not break):** stage 728rpx; rail `bottom: 152rpx`; equipment bar min-height 112rpx; growth card max-width 280rpx. P0-4 fits inside existing slack; P1-6 swaps content instead of growing the bar. Any PR changing these numbers must re-derive the 24+333+16+189+152=714 formula at `index.scss:478-482`.
6. **DevTools verification matrix (per wave):** 320/375/414px widths × {0-event, multi-event, claim-pending, streak-near-milestone, RM on, degradation tier} — the P0-4 near-milestone growth-card fit and the P2-1 first-viewport fold are the two highest-risk renders.
