# Profile Tab (「我的」) Polish — Product Decision Memo

- **Date:** 2026-10-22
- **Author:** Product Manager (autonomous sprint decision authority)
- **Source (named):** Three-party Profile V1.7 review (🏦商业化 / 📋PM / 🎨UIUX) as codified in `.sisyphus/plans/profile-tab-polish-2026-10-22.md` sections P0-1 … P2-5; every claim below re-verified against repo files (paths cited inline).
- **Scope:** Decisions only. No code edited. Anything not verifiable in-repo is marked `待验证` with the exact check the implementer must run.
- **Copy governance:** `docs/copy/brand-copy-strategy.md` §2 🔴 + §3/§3.1 terminology table. Visible copy never uses 匹配/社交/灵魂/撮合/AI (WeChat review posture), never 会员/VIP (use 权益), plan display names only 悦聚月卡/悦聚季卡/三连局包/六连局包/单场局票, no emoji in primary copy (JoyJoinIcon only).

---

## 1. P0-1 权益资产条 (entitlement strip)

### 1a. Data-source verdicts (all verified)

| Datum | On-device? | Evidence |
|---|---|---|
| `entitlementMode` (`'subscription'\|'event_pack'\|'test'\|null`) | ✅ Yes | Built in `apps/server/src/lib/buildAuthUserResponse.ts:166,285`; type at `packages/shared/src/api/auth.ts:35`; semantics at `apps/server/src/lib/entitlement.ts:35-50` |
| `coupons.availableCount` | ✅ Yes — **already fetched and discarded today** | `getProfileShellData` returns `coupons` (`apps/server/src/repositories/shellRepository.ts:400-406, 467-475`); DTO `ProfileShellResponseSchema` (`packages/shared/src/apiShell.ts:67-84`); page query at `apps/mini-program/src/pages/profile/index.tsx:277-282` reads only `.stats`. **Zero server work for this pill.** |
| 悦币 `joyCoins` | ✅ Yes | `getUserGamificationInfo` returns `joyCoins` (`apps/server/src/gamificationService.ts:438-448`); client type `UserGamificationSummary.joyCoins` (`packages/shared/src/api/user.ts:21`); page already runs this query (`index.tsx:296-301`). (Also on the auth payload — `users.joy_coins` is not in `SENSITIVE_AUTH_USER_FIELD_NAMES`, `packages/shared/src/api/auth.ts:8-23`.) Canonical term is **悦币**, not 乐币 (`packages/shared/src/schema/_definitions.ts:189`; rewards page copy `pages/profile-linked/rewards/index.tsx:317`). |
| 局票剩余张数 `availableEventCredits` | ❌ **Not on-device** | `resolveEntitlementMode` computes it (`apps/server/src/lib/entitlement.ts:32,45-48`) but only `mode` is exposed; the count surfaces only in the registration-gate 403 body (`apps/server/src/routes/domains/userEventPools.ts:715-723`). **Minimal server field below.** |
| 悦聚卡到期 (planType, daysRemaining) | ✅ Endpoint exists, not fetched by profile | `GET /api/subscription/status` → `{ hasActiveSubscription, subscription, daysRemaining }` (`apps/server/src/subscriptionService.ts:140-161`; route `apps/server/src/routes/domains/payments.ts:467`). **Do not add a 4th profile fetch — fold into the shell (below).** |

**Minimal server change (one, fail-open):** extend the **profile shell** response — not the global auth payload (auth is the cold-start hot path for every surface). In `apps/server/src/repositories/shellRepository.ts` `getProfileShellData`, add:

    entitlement: {
      mode: EntitlementMode,
      eventCredits: number,                       // 0 unless mode==='event_pack'
      subscription: { planType: 'monthly'|'quarterly', daysRemaining: number } | null,
    }

`resolveEntitlementMode` already holds the subscription row in the subscription branch and the credit count in the pack branch — return them instead of discarding (extend `ResolvedEntitlement` in `apps/server/src/lib/entitlement.ts`; zero extra DB round-trips). Add the field as optional in `ProfileShellResponseSchema` (`packages/shared/src/apiShell.ts`) so legacy servers simply omit it → strip renders from whatever data exists.

### 1b. Pills for PAID users (max 3, in this order; render only pills whose datum exists and is > 0)

| # | Condition | Copy (exact) | Icon | Tap target |
|---|---|---|---|---|
| 1 | `mode==='subscription'` | `悦聚月卡 · 剩 {d} 天` / `悦聚季卡 · 剩 {d} 天`; when `d===0` → `悦聚月卡 · 今天到期` | `JoyJoinIcon emoji='🎫' tier='ui'` (`icon-ticket`, `packages/shared/src/iconSystem/emojiToIconMap.ts:234`) | `openMiniProgramPaymentPage({ currentUserId })` (`apps/mini-program/src/lib/payment/paymentEntry.ts:38`; same target as settings 「我的权益」 row, `pages/profile-linked/settings/index.tsx:113-115`) |
| 1 | `mode==='event_pack'` | `局票 · 剩 {n} 张` | same 🎫 | same payment page |
| 2 | `coupons.availableCount > 0` | `优惠券 · {n} 张可用` | `JoyJoinIcon emoji='🎁' tier='ui'` (`icon-gift`, emojiToIconMap.ts:225) | `Taro.navigateTo` → `MINI_PROGRAM_ROUTES.rewards` (`pages/profile-linked/rewards/index` lists coupons + 悦币余额: `rewards/index.tsx:7,17,315-317`) |
| 3 | `joyCoins > 0` | `悦币 · {n}` | 16rpx gold CSS dot — **no JoyJoinIcon** (🪙 has no mapping; 💰 exists only at `reaction` tier/size 56, emojiToIconMap.ts:164 — wrong tier; do not misuse) | `MINI_PROGRAM_ROUTES.rewards` |

- `mode==='test'` (dev-only single-test): hide pill 1; pills 2–3 render on data.
- No scarcity/urgency copy anywhere (plan red line). Pills are factual readouts.
- Observability: `profileAnalytics.track('profile_entitlement_pill_tap', { pill: 'pass'|'coupon'|'coins' })`.

### 1c. FREE users see: **nothing — the strip is hidden**

Decision: **DELETE the "single CTA pill" alternative.** When `mode===null && availableCount===0 && joyCoins===0`, render no strip (plan acceptance: "zero-asset state hides strip"). Rationale (five-step, one line): question — no observed free-user pain asking for an entitlement dashboard on 我的; delete — a zero-count strip is an empty-wallet anti-pattern and a permanent CTA pill duplicates the settings 「我的权益」 row (`settings/index.tsx:58-63`) and reads as an ad on a personal screen. Conversion surfaces already exist at checkout upsell (`checkoutSubscriptionUpsellEnabled`) and the Duo card (§7).

---

## 2. P1-5 新手启程任务线 (4 steps)

**Plan amendment (with evidence):** the plan's 3-step model gated on `joinedEventsCount === 0` is internally inconsistent — shell `eventsJoined` counts **attendance + pending/matched registrations** (`shellRepository.ts:449-464`), so the moment a user completes step「报名」the gate flips false and the later steps can never render checked. The quest must live **until first 成行**, not until first 报名.

### 2a. Steps, signals, copy, targets

| # | Title | Done-signal (verified) | CTA copy | CTA target |
|---|---|---|---|---|
| 1 | 完成人格测评 | `(authUser.archetype ?? authUser.primaryArchetype) != null` (`index.tsx:338`) | 去测评 | `MINI_PROGRAM_ROUTES.personalityTest` |
| 2 | 写一句聚会签名 | `authUser.bio` non-empty after trim (`index.tsx:341`; same signal as the existing bio nudge, `index.tsx:494-497`) | 去写一句 | `MINI_PROGRAM_ROUTES.editProfile` |
| 3 | 报名第一场局 | `registrations.length > 0` — `REGISTRATIONS_QUERY_KEY` / `getMyPoolRegistrations`, already fetched app-wide by `useTabBarStateBridge` (`apps/mini-program/src/hooks/navigation/useTabBarStateBridge.ts:40-45`); profile reads the same cache key, **no new endpoint** | 去挑一场 | `Taro.switchTab` → `MINI_PROGRAM_ROUTES.discover` |
| 4 | 首场成行 | `registrations.some(r => r.matchStatus === 'matched' \|\| 'completed')` — `PoolMatchStatus = 'pending'\|'matched'\|'completed'\|'unmatched'` (`packages/shared/src/api/eventPools.ts:82`); 成行 = 排桌完成 per canonical vocabulary | 查看进度 (only while step 3 done & step 4 pending) | `Taro.switchTab` → `MINI_PROGRAM_ROUTES.events` |

- **「设置头像」from the proposal is DELETED** — there is no user-settable avatar signal: `users.wechatAvatarUrl` (`schema/_definitions.ts:104`) comes from WeChat auth, and pixel-avatar outfit is flag-gated equipment, not an avatar. Replaced with the bio step (real, and it feeds the existing bio-nudge loop).
- Step 4 unchecked sub-line (no CTA needed while waiting): `排桌完成后，这里自动打勾`.
- Card copy: title `启程任务`; subtitle `走完 4 步，迎来你的第一场局`.

### 2b. Show / hide

- Show while step 4 is **not** done. Steps 1–3 render checked/unchecked live.
- Hide **forever** once any registration is `matched` or `completed` — computed from data, **no dismissal storage, no × button** (all four steps are completable; a dismiss adds state for zero user pain).
- Legacy edge: a user with attendance-only history (`eventsJoined > 0`, zero registrations) still sees the card with steps 3–4 open — that is the correct next action for them in the pool world. Accepted.
- Placement: pre-P2-1 it renders between the stats band and the story card; post-P2-1 it is the top module of 我能干嘛 (§5).

---

## 3. P1-4 徽章图鉴墙 5 枚阶梯

Thresholds **1 / 3 / 5 / 10 / 20 场**, progress source unchanged: `joinedEventsCount` (shell stats; consistent with the 「已参加活动」 stat card semantics — no new endpoint per plan constraint).

| 场 | Name (exact) | Status |
|---|---|---|
| 1 | 初次见面 | existing (`profileConstants.ts:96-111`), keep |
| 3 | 三场连击 | existing, keep |
| 5 | 渐入佳境 | **new** |
| 10 | 悦聚常客 | **new** |
| 20 | 城市传说 | **new** |

- Locked state: grey silhouette + lock corner badge + `还差 {n} 场` (plan copy approved).
- Section header: `成就徽章` (keep) + summary `已点亮 {u}/5 枚` (replaces `已解锁 u/2`).
- Accordion expand shows **all 5** (unlocked color, locked silhouette); pop-in stagger per plan; newly-unlocked on tab return → `haptics('success')`.
- Registry keys to add in `apps/mini-program/src/lib/milestoneBadges.ts`: `streak5` / `streak10` / `streak20`, CDN-only via `scripts/optimize-badges-batch-d.mjs` + manifest (asset policy, plan P1-4).
- **Cap = 20, kept.** Rationale: badges are aspiration targets on a collectible wall, not promises; 20 场 ≈ 5 months of weekly attendance, giving the wall a visible horizon. `待验证` **before the Lovart batch is produced**: pull the live `eventsJoined` distribution (same counting SQL as `shellRepository.ts:434-464`) — if p95 < 12, change tier 5 to 15 场 (name `城市传说` unchanged) before asset generation, because assets are the irreversible cost.

---

## 4. P1-6 装备「下一抽进度」

### 4a. What honestly exists (verified)

- `EquipmentMeResponse.wallet.pityMisses` (0–3) + `pityTarget` (=4) — **a pity counter EXISTS** (`packages/shared/src/schema/equipment.ts:275-279`; `EQUIPMENT_PITY_TARGET = 4`, `apps/server/src/repositories/equipmentRepo.ts:37`).
- Rule (`equipmentRepo.ts:259-289`): three consecutive **duplicate** draws → the 4th draw is guaranteed a **NEW** item (`guaranteed = pityMisses >= 3`, pick from unowned pool, still weight-random within it). A new-item draw resets the counter; a full pool freezes it.
- Rarity enum is **only** `'common' | 'rare'` (`schema/equipment.ts:56` check constraint).
- Earning rule for a draw: event ended + matched group + feedback completed (`reconcileEquipmentEntitlements`, `equipmentRepo.ts:427-469`).
- `pendingEntitlements` already drives the claim chip (`index.tsx:371-379`).

### 4b. Teaser states (exact copy)

| State | Copy |
|---|---|
| Claimable (`pendingEntitlements > 0`) | unchanged — existing `N 份装备待领` chip |
| No pending, `pityMisses === 0` | `已收集 {inventory.length} 件` + guidance line `完成活动反馈，即可再抽一件` |
| No pending, `pityMisses` 1–2 | `已收集 {n} 件` + slim bar `pityMisses/3` + `新装备保底 {pityMisses}/3` |
| No pending, `pityMisses === 3` | `下一抽必得新装备` (gold emphasis) |

- **DO NOT BUILD 「距下一稀有」** — the guarantee is NEW, not rare; rarity weights are server-only and must never leak (plan Must NOT). Only 2 rarities exist, so a rarity-progress teaser would be fabricated.
- **Plan copy fix:** the plan's `再参加 1 场局，可抽一件` is inaccurate — the locked rule requires completed feedback. Decided copy: `完成活动反馈，即可再抽一件`.
- Rare slots get the gold-flow rim (rarity is on the item DTO — fine); breathing = opacity pulse only.

---

## 5. P2-1 首屏三段论 — final module order

V1.7 surface only (legacy `profile-page__fallback-hero` untouched, `index.tsx:850-883`). Top → bottom:

**我是谁**
1. Nav: `我的` + bell (P0-2)
2. Identity stage — identity copy card (displayName, archetype tag, family pill + daily greeting per P0-3, bio/nudge), growth card (潮流值 + streak flame per P0-4), partner visual + equipment entry strip (with §4 teaser states)

**我有什么**
3. Entitlement strip (§1; hidden when empty)
4. Compact data band — one tappable row: `已参加 {a} 场 · 连接 {b} 位 · 资料 {c}%` + chevron → **inline accordion** expands the three original stat cards (zero data loss; same accordion precedent as milestones, `index.tsx:985-1040`; no new route)
5. 成就徽章 row (5-tier accordion, §3)

**我能干嘛**
6. 启程任务线 (§2; only pre-first-成行 users)
7. 我的故事 card (§6 serialization)
8. Duo 同桌卡 (§7; conditional)
9. 存下这张卡 poster entry (§8)
10. 设置与服务 entry (existing)

- **Merge, not delete:** the 3 full-width stat cards collapse INTO the data band (all three values preserved, one tap away). Nothing else is removed. The guidance dock stays a fixed overlay (not in flow). 查看全部 = the two inline accordions; no dedicated routes are created.
- First viewport must answer all three questions without scroll — modules 1–5 fit above the fold by demoting stats; acceptance per plan.

---

## 6. P2-2 故事入口连载化

- **`pendingExperienceCount` semantics (locked):** eligible-but-unwritten experiences = `listMissingPersonalStoryExperiences(userId, novel.id).length` (`apps/server/src/repositories/personalStoryRepo.ts:415-443`; eligible sources = alang + flash + blind_box snapshots, `personalStoryRepo.ts:404-413`). **Server change:** add optional `pendingExperienceCount?: number` to `PersonalStoryResponse` (`packages/shared/src/schema/personalStory.ts:204-209`), computed inside `loadPersonalStoryContext` (`apps/server/src/routes/domains/personalStory.ts:58-77`). Fail-open: absent field → no badge. Already behind `personalStoryEnabled`.
- **Chapter display:** the profile teaser query already fetches the full response (`index.tsx:322-331`). Title line: chapters > 0 → `第 {chapters.length} 章 · {latestChapter.title}`; date = latest chapter `occurredAt` formatted `M月D日` (ChapterView carries `title` + `occurredAt`, `personalStory.ts:171-180`; `chapterNumber` is DB-only — index+1 is the display number).
- **Badge:** `pendingExperienceCount > 0` → warm-gold pill `{n} 段新经历待写成`; else when chapters ≥ 1 → quiet pill `连载中`; 0 chapters → no badge, title stays `开始你的第一章`.
- **Empty state:** unchanged (artwork + `开始你的第一章` + the two privacy lines); card still navigates to `MINI_PROGRAM_ROUTES.personalStory`.
- Navigation unchanged for all states.

---

## 7. P2-4 Duo 同桌卡

- **Show conditions (all required):** `features.duoRegistrationEnabled === true` (`buildAuthUserResponse.ts:218`) AND ≥1 registration with `matchStatus === 'pending'` (REGISTRATIONS_QUERY_KEY cache) AND that pool's duo state ≠ `bound` — `GET /api/pools/:id/duo-status` returns the `none | waiting | bound` machine (`apps/server/src/routes/domains/duo.ts:154-278`). Fetch duo-status lazily for the earliest pending pool only; `bound` → hide. No pending registration → no card (plan rule).
- **Copy (exact; zero inducement — INVITE_REWARD ¥50 is never mentioned, `PRODUCT_REQUIREMENTS.md:564-567`):**
  - Headline: `你报名的那场局，还差一位同桌`
  - Sub: `邀个朋友一起报名，就能排进同一桌`
  - CTA: `邀请同桌`
- **Tap:** `Taro.navigateTo` → `MINI_PROGRAM_ROUTES.invite + '?poolId=' + poolId` — the invite page duo lane scopes by query poolId (`pages/profile-linked/invite/index.test.tsx` cases ①–③; `resolveInviteShareMode` in `apps/mini-program/src/lib/duo/duoContext.ts:41-46`). Reuse, never duplicate.
- **Dismissal: 72-hour per-pool snooze.** Mechanism: `Taro.setStorageSync('jj_profile_duo_card_dismissed:' + poolId, Date.now())`; hidden while `now - ts < 72h` and registration still pending. (Picked over session-only — nags across one sitting — and over permanent — kills the highest-intent invite surface; registration windows are short, pools lock 24h before the event.)
- **Placement:** act 3, between the story card and the poster entry. Conditional render only (no skeleton, no placeholder).

---

## 8. P2-3 形象名片海报「存下这张卡」

- **Dead-pipeline audit verdict: DELETE, do not resurrect.** `profilePoster.ts` bakes `city / age / interests / referralCode` into the canvas (`ProfilePosterInput`, `apps/mini-program/src/pages/profile/profilePoster.ts:24-55`) — structurally violating the privacy-exclusion rule. Delete `profilePoster.ts`, `useProfileShareCard.ts`, `ShareCardShimmer.tsx/.scss` (C-1/C-2) and rebuild on the compliant pipeline: `InsightShareEntry` + `lib/onboarding/insightPoster.ts` + `useInsightPosterShare` (1080×1560 canvas, QR fail-closed via `fetchShareQrCodeImage`, privacy fields structurally excluded with spy-test, temp-file `unlinkSync`, action-sheet 保存相册/分享/预览).
- **Poster content (locked):** pixel-avatar composite (archetype art fallback when pixel flag off) + displayName + 家族名 (from P0-3's `ARCHETYPE_FAMILY_NAME`) + `潮流值 {n}` + 小程序码 + QR caption `微信扫一扫，来悦聚认识我`. **Never on the poster:** city, age, interests, bio, referral code, real-name fields, any incentive wording (WeChat 诱导分享 ban).
- **Entry point:** quiet text-pill in act 3, directly under the story card: `存下这张卡` (same copy/pattern as `InsightShareEntry.tsx:53`). Visible when an archetype exists; generating state `正在生成…`.
- AIGC label: not required — no LLM content on the poster (fail-closed rule n/a).

---

## 9. P2-5 iOS 大标题

- **Title (exact):** `我的` — fixed string, **not** displayName-based (displayName already heads the identity card; duplicating it in the chrome is noise).
- **Sub-line (exact):** date + weekday only, e.g. `10月22日 星期四`. **The daily greeting is NOT repeated here** — dedupe decision: the greeting lives exactly once, in the identity card (P0-3).
- Collapse/expand consumes the `useProfileScroll` threshold from P0-8 (single scroll state machine, per plan).

---

## 10. DELETE / SIMPLIFY register (five-step, one line each)

1. **Free-user entitlement CTA pill — DELETE.** Question: no observed pain/source asking for it → delete: duplicates settings 「我的权益」 row; an ad pill on 我的 damages the personal-screen trust.
2. **「设置头像」quest step — DELETE.** Question: no avatar-set signal exists (`wechatAvatarUrl` is auth-sourced, `schema/_definitions.ts:104`) → delete: unrewardable step; simplify: replaced by the bio step which feeds the existing nudge loop.
3. **Plan P1-5's 3-step 0-event gate — REDESIGN (simplify).** Question: fails on evidence (shell mixes registration+attendance, `shellRepository.ts:449-464`) → simplify: 4 data-driven steps gated on first 成行.
4. **「距下一稀有」teaser — DO NOT BUILD.** Question: pity guarantees NEW not rare (`equipmentRepo.ts:273-274`), rarity is binary → delete: would fabricate odds; simplify: honest `新装备保底 n/3`.
5. **Dead poster pipeline — DELETE.** Question: zero imports (plan evidence table) + privacy-noncompliant inputs (`profilePoster.ts:24-40`) → delete: three files removed; simplify: rebuild on the already-compliant insight poster canvas.
6. **displayName large title — SIMPLIFY to `我的`.** Question: no user problem (name is already the hero) → simplify: fixed title + date sub-line, one greeting per screen.
7. **`users.eventsAttended` as any quest/stats signal — DO NOT USE.** It is never incremented anywhere in app code (only read: `gamificationService.ts:424,447`; `adminUsers.ts:201`) — permanently 0. Any feature needing attendance counts uses shell `eventsJoined` or `matchStatus`.

---

## 待验证 checklist (implementer must run these checks)

1. **P1-4 tier cap:** before Lovart production, query prod `eventsJoined` distribution (counting SQL = `shellRepository.ts:434-464`); if p95 < 12 → tier 5 becomes 15 场.
2. **P2-4 duo-status payload:** read `resolveDuoStatus` return shape in `apps/server/src/routes/domains/duo.ts:268-278` and confirm the client field name for `bound` before wiring the hide rule.
3. **P0-1 shell field:** after the server change, assert `GET /api/shell/profile` includes `entitlement` and that legacy responses without it render the strip from coupons/coins alone (fail-open).
4. **P1-5 step-4 signal in cache:** confirm `getMyPoolRegistrations` response items expose `matchStatus` as typed (`eventPools.ts:128`) — a type-vs-runtime mismatch hides the quest forever.
5. **P2-2 chapter ordering:** confirm `listPersonalStoryChapters` returns chapters in ascending `chapterNumber` order so `chapters[chapters.length-1]` is the latest (read `personalStoryRepo.ts` `listPersonalStoryChapters` ORDER BY before relying on it).
6. **P0-1 悦币 icon:** confirm no 🪙/coin mapping exists in `packages/shared/src/iconSystem/emojiToIconMap.ts` at `ui` tier at implementation time; if one has been added, prefer it over the CSS dot.

---

## Appendix — key files verified for this memo

- Plan: `.sisyphus/plans/profile-tab-polish-2026-10-22.md`
- Page: `apps/mini-program/src/pages/profile/index.tsx` (1106 lines, read in full), `profileConstants.ts`
- Auth payload: `apps/server/src/lib/buildAuthUserResponse.ts`, `packages/shared/src/api/auth.ts`, `apps/server/src/auth/sanitizeAuthUser.ts`, `apps/server/src/lib/entitlement.ts`
- Shell: `apps/server/src/repositories/shellRepository.ts`, `packages/shared/src/apiShell.ts`
- Gamification: `apps/server/src/gamificationService.ts:330-453`, `packages/shared/src/api/user.ts:19-29`
- Equipment: `packages/shared/src/schema/equipment.ts:233-295`, `apps/server/src/repositories/equipmentRepo.ts:37,259-289,427-469`, `apps/mini-program/src/lib/profile/equipmentApi.ts`
- Story: `apps/server/src/routes/domains/personalStory.ts`, `apps/server/src/repositories/personalStoryRepo.ts:404-443`, `packages/shared/src/schema/personalStory.ts:171-216`
- Duo: `apps/mini-program/src/lib/duo/duoContext.ts`, `apps/server/src/routes/domains/duo.ts`, `pages/profile-linked/invite/index.test.tsx`
- Poster: `apps/mini-program/src/pages/profile/profilePoster.ts`, `useProfileShareCard.ts`, `components/onboarding/InsightShareEntry.tsx`
- Payment entry: `apps/mini-program/src/lib/payment/paymentEntry.ts`; subscription: `apps/server/src/subscriptionService.ts:140-161`
- Notifications: `apps/mini-program/src/hooks/useNotificationCounts.ts`, `hooks/navigation/useTabBarStateBridge.ts`
- Icons: `apps/mini-program/src/components/ui/JoyJoinIcon.tsx`, `packages/shared/src/iconSystem/emojiToIconMap.ts`
- Routes: `apps/mini-program/src/lib/onboarding/onboardingRoutes.ts:6-50`
- Copy law: `docs/copy/brand-copy-strategy.md` §2/§3/§3.1; canon: `PRODUCT_REQUIREMENTS.md:563-567`
