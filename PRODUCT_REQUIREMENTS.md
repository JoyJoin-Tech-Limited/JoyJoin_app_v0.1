# JoyJoin (悦聚·Joy) - Product Requirements Document

**Version:** 1.6  
**Last Updated:** 2026-06-15  
**Platform:** WeChat Mini Program (Taro) — launch-primary  
**Reference Surface:** Web (React + Vite) — development sandbox / parity reference only, not shipping  
**Target Market:** Hong Kong & Shenzhen  

---

## 🗺️ Product Canon & Terminology

> ### ⚠️ MANDATORY RULE FOR ALL CONTRIBUTORS
>
> **All code, copy, documentation, and implementation decisions MUST be based on the active, current flow described in this document.**
>
> - ❌ Never reference, reintroduce, or copy-paste from legacy flows, removed features, old routes, or deprecated components — even if they appear in git history, archived docs (`archived/`), or inline `TODO` comments.
> - ❌ Never treat `QUICK_REFERENCE.md` as authoritative — it is a legacy redirect-only stub. Use `DEVELOPER_QUICK_REFERENCE.md`, this document, and `docs/README.md` instead.
> - ✅ Coordinated refreshes that touch product/architecture docs **and** repo AI workflow surfaces (`.github/skills/`, `.github/agents/`, orchestration) must follow `docs/ai/ai-workflow-documentation-refresh.md` so scope, lanes, and validation stay aligned.
> - ✅ When in doubt about whether a pattern/term/route is active, check the canonical nav table below and §*Product Canon* before implementing.
>
> This rule applies to human engineers **and** AI coding agents.

> **This section is authoritative.** When any older content in this document conflicts with the definitions below, the definitions below take precedence. Legacy wording in older sections is marked ⚠️ Legacy and must not be used in new copy, code, or communications.

### Current Bottom Navigation (Canonical)

| Position | Label | Route | Purpose |
|----------|-------|-------|---------|
| 1 | **发现** | `/` (Discover) | Discovery / recommendations |
| 2 | **足迹** | `/my-journey` | Personal social journey & event history |
| 3 | *(core action icon)* | smart-routed | Primary app action — join / track / engage |
| 4 | **连接** | `/chats` | Structured connections and relationship meaning |
| 5 | **我的** | `/profile` | Profile, account, settings |

> **`圈子` is legacy wording** for the main nav tab 4. Use **`连接`** in all current and new copy.  
> The center icon tab has no user-facing text label; helper copy should reference "core action" intent, not a generic page name.

### Terminology: 权益 replaces 会员 / membership

User-facing product copy must use the following compliant terms. Internal technical names (`subscription`, `subscriptions` table) may remain unchanged if a schema rename would be disproportionate.

| ❌ Deprecated (user-facing) | ✅ Compliant (user-facing) |
|-----------------------------|---------------------------|
| 会员 / VIP会员 / 会员方案 | 权益 / 权益方案 |
| 会员状态 | 权益状态 |
| 开通会员 | 开通权益 |
| 会员续费 | 续期 |
| 月度会员 / 季度会员 | 月度权益方案 / 季度权益方案 |
| 会员价 | 权益价 / 专享价 |
| membership | 权益方案 (in user-facing text) |

> New docs, UI copy, and notifications must not reintroduce `会员` or `membership` as user-facing product terms.

### Connection Model (Canonical)

Direct messaging is **not** the canonical continuation model for JoyJoin. The structured connection system is:

1. **Post-event flow** → selects **who** (multi-select attendees, no per-person reasons required)
2. **连接 tab** → captures **why** (structured reasons, optional) + **next-step preference** (optional)
3. Optional lightweight event-level reason capture may appear immediately after the connection selection only if non-blocking

See §1.10 Connection Feedback Flow for full documentation.

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

## 🆕 Recent Updates (Last updated: 2026-06-25)

### 2026 Milestones (June 2026)

**44. End-of-June Docs + Backend Hardening Sync** 🔧 *(2026-06-24 to 2026-06-25)*
- **Profile-review bio capture:** `pages/onboarding/profile-review/index.tsx` now exposes an optional 1–100 character bio textarea (`一句你的社交签名`). The bio is validated for length, trimmed, and run through `validateContentSafe()` on `POST /api/profile-review/complete`; a non-empty bio contributes +10% to the profile completion score.
- **Match Compass preference DNA:** Default strictness, dealbreakers, and nice-to-haves are now seeded from the user's primary archetype via `buildDefaultPreferencesFromArchetype()` in `apps/server/src/lib/matchCompass.ts`. Existing persisted preferences still take precedence.
- **WeChat profile + geolocation capture:** Server-side support for storing `wechatNickname`, `wechatAvatarUrl`, and IP-based location snapshots on login, onboarding completion, and pool registration. New admin geolocation endpoints (`GET /api/admin/geolocation/heatmap`, `POST /api/admin/geolocation/rollup`) provide ops-level location analytics. Location snapshots are written through `apps/server/src/lib/captureLocationSnapshot.ts` and aggregated via `apps/server/src/repositories/userLocationRepo.ts` / `apps/server/src/services/ipGeolocationService.ts`. **Note:** As of 2026-06-25, the mini-program login flow sends only the WeChat `code`; `wechatNickname`/`wechatAvatarUrl` capture on the client side is not yet wired end-to-end.
- **Life stage signal boundary:** Social-affinity scoring now reads `users.lifeStage` (canonical values: `学生党`, `职场新人`, `职场老手`, `创业中`, `自由职业`) instead of `workMode`. `workMode` is retained as a read-only fallback during the migration period; a backfill script maps legacy values.
- **Matching-Test Mode:** Added end-to-end matching validation with one real tester + 5 full-profile bots through the production matching engine. Gated by `ENABLE_SINGLE_TEST_MODE` + `ENABLE_MATCHING_TEST_MODE`; blocked in `APP_MODE=production`; DB markers `users.is_test_bot` and `event_pools.is_test_pool`; startup sentinel crashes if test-bot rows exist in production. Cleanup deletes test pools, groups, registrations, icebreaker data, and bot users while preserving payment records.
- **Social Icebreaker tier selector a11y + assets:** Preset/custom cards now use bundled Lovart WebP backgrounds; added `JoyJoinIcon` checkmarks, CSS chevrons, haptics, and full `aria-label`/`aria-pressed`/`role="button"` coverage; simplified tier-row fallback renders when `runPlanTemplatesEnabled` is false.
- **Misc mini-program hardening:** Center participation hub unblocked, native custom tab bar selection syncs from the current route on `useDidShow`, Discover activity list stability fallback, profile page layout fixes, assessment persistence fixes.

**40. Interest-Heat Picker Full-Marks Push** 🎯 *(2026-06-15)*
- **Scope:** Mini-program onboarding step 4 (`pages/onboarding/extended-data/index`) — interest selection and heat signaling.
- **Category icon wiring fix:** Removed `category` from `CDN_ICON_TIERS` (`packages/shared/src/iconSystem/emojiToIconMap.ts`) so `JoyJoinIcon tier="category"` resolves bundled `src/assets/icons/category-icons/` via `require()` instead of a broken CDN path. Replaced the `category-social` (`话题`) asset through the Lovart pipeline.
- **Preloader:** Added `usePreloadCategoryIcons` to warm the five bundled category icons before the heat picker appears; skipped on 2G and guarded to run once.
- **UX redesign:** Tap-to-cycle each topic 0 → 1 (感兴趣) → 2 (很热衷) → 3 (必聊项) → off, with a 3-segment vertical tier indicator and a three-step heat guide.
- **Milestone celebrations:** Centered toasts for unlock (≥3 selections), first L3 / 必聊项, and all five macro categories selected.
- **Emotional-value polish:** Archetype-aware Xiaoyue coach copy and footer "heat story" pill; CTA unlock pulse; active category icon scale feedback; first-selection hint toast; offline submit guard.
- **Accessibility & performance:** `role="button"`, `aria-pressed`, dynamic `aria-label` per card; `aria-live="polite"` on toasts; `@media (prefers-reduced-motion: reduce)` disables animations; transform-only interactions; timeout-ref cleanup on unmount.
- **Audit scores:** 情绪价值 24/24, Frontend Design Audit 20/20, Completeness Audit 44/44, Performance Audit PASS (50/60).

**41. Profile / “我的” Social-Passport Redesign + Wow Polish** 🪪 *(2026-06-16)*
- **Scope:** Mini-program profile tab (`pages/profile/index`) — the logged-in "我的" surface.
- **Feature flag:** Gated by `features.profileRedesignEnabled` (DB-backed, env `PROFILE_REDESIGN_ENABLED`, default `true`). When disabled, the page falls back to a simplified legacy-style layout.
- **Social-passport hero:** Gradient-ring archetype avatar (`ArchetypeHead`), Xiaoyue greeting bubble, name/archetype/identity chip, optional age/city/bio chips, and share/edit CTAs. When `bio` is empty, a dashed CTA invites the user to write a 1–100 character social signature; tapping it fires `profile_edit_tap { field: 'bio', source: 'profile_cta' }`.
- **Three stat cards:** `已参加活动`, `我的连接数`, `资料完成度`; count-up animation via shared `useCountUp` hook; empty-state CTAs (`去遇见`, `活动后解锁`, `去完善`); archetype-tinted completion progress bar (40% essential + 30% extended + 30% archetype). A non-empty bio contributes a +10% completion bonus (capped at 100%).
- **100% completion ceremony:** When `资料完成度` first reaches 100%, a one-time confetti-seal celebration plays and `profile_completion { hasBio }` is tracked. The ceremony is gated by `profileRedesignEnabled`, reduced-motion preference, and a client-side storage flag so it fires once per user.
- **Milestone badges:** `firstEvent` and `streak3` achievements rendered under the hero when the redesign is enabled. Locked badges show the real badge asset in grayscale rather than a generic lock icon; the celebration toasts the highest crossed milestone when multiple thresholds are crossed at once.
- **Menu grid:** Two-column grid with rewards, invite, entitlements, events, terms, city unlock; 88rpx touch targets; haptics; reduced-motion/degradation fallbacks.
- **Profile-card share (P1):** A "分享我的社交名片" menu row (gated by `features.personalityShareEnabled` and requiring an archetype) generates a 750×750 profile-card poster with the user's archetype image, name/family/tagline, stat chips, and referral code. Native share hooks (`useShareAppMessage`/`useShareTimeline`) pass the user's `referralCode` as `invitationCode` so shares land on the landing page with attribution.
- **Connections preview enrichment:** The shared `ProfileArchetypeHero` component is reused on the Connections tab, showing each peer's age range, city, bio, and a mutual-context line (e.g., shared city/archetype/chemistry score). The legacy connection-card fallback remains for edge cases.
- **Day-0 nudge (P1):** When both joined events and connections are zero, Xiaoyue surfaces a warm day-0 nudge under the stats.
- **Interactions & wow:** Pull-to-refresh; spring avatar entrance; staggered stats/menu reveal; stat-tap Xiaoyue mascot reaction; logout with busy guard and 401 handling; skeleton + branded error states; text chevrons use bundled SVG instead of raw glyphs.
- **Offline resilience (P2):** Profile reads its cached `PROFILE_SHELL_QUERY_KEY` before rendering the error card (`profileShell = shell ?? cachedShell`). `useQuery` uses `networkMode: 'offlineFirst'`, exponential `retryDelay`, and an offline-aware `retry` predicate. `Taro.onNetworkStatusChange` auto-refetches when connectivity returns.
- **Predictive prefetch (P2):** After Profile shell data stabilizes, `PrefetchEngine` warms the Events and Connections shells so adjacent tabs load instantly.
- **Data contract:** Consumes `GET /api/shell/profile` via `getProfileShell()` from `packages/shared/src/api.ts` with 60s stale time; refetched on `useDidShow`.
- **Analytics:** `POST /api/analytics/profile` accepts whitelisted profile events (`profile_stat_tap`, `profile_archetype_cta_tap`, `profile_menu_tap`, `profile_logout_tap`, `profile_shell_retry`, `profile_share_app_message`, `profile_share_timeline`, `profile_milestone_impression`, `profile_milestone_tap`, `profile_pull_refresh`, `profile_share_card_generated`, `profile_share_card_error`, `profile_view`, `profile_edit_tap`, `profile_completion`, `connection_card_view`) stored in `discoverAnalyticsEvents`; rate-limited 120 req/min; client Zod validation in `profileAnalytics.ts`.
- **Code organization:** Logic extracted into `pages/profile/profileConstants.ts`, `pages/profile/profilePoster.ts`, and `pages/profile/useProfileShareCard.ts`; regression tests in `profileConstants.test.ts`.
- **Audit scores:** Frontend Design Audit 20/20, Completeness Audit 44/44, Performance Audit PASS (48/60). The Profile page is no longer flagged by the Harness Completion Gate; the repository-wide gate reports CONCERN (85/100) due to pre-existing maintainability issues in unrelated files.

**42. Lovart 5×5 Status/UI Icon Integration** 🎨 *(2026-06-18)*
- **Scope:** Mini-program proprietary icon system (`packages/shared/src/iconSystem/emojiToIconMap.ts`, `apps/mini-program/src/components/ui/JoyJoinIcon.tsx`).
- **New assets:** Cropped a single 2048×2048 Lovart grid into 25 WebP icons with @2x/@3x variants: `status-icons` (⏰📣📊⚠️🚫🪞🔓🌟✕✓🔔), `ui` (🎁🔍📝), `info-labels` (✈️🌆🌏🌐🗺️), and six `reaction-icons` (💰😏😎💜😅😈).
- **Registry:** Added the 25 new emoji→icon mappings to `INFO_LABEL_MAP`, `REACTION_MAP`, `STATUS_ICON_MAP`, and `UI_ICON_MAP`; `IconTier` now covers `expression`, `semantic`, `mood`, `chemistry`, `phase`, `status`, `reaction`, `category`, `intent`, `reveal`, `achievement`, `ui`.
- **Fallback behavior:** Implemented unambiguous tier-specific fallback in `getIconMapping()`: when no explicit `tier` prop is passed and the emoji exists in exactly one tier map, that tier's asset is used automatically. `StatusCard` now passes appropriate default tiers for empty/error/info icons.
- **Hosting:** `status`/`ui`/`semantic` tiers are bundled locally; `reaction` remains CDN-primary with the same `reaction-icons/` folder mirrored locally for `cdnAsset()` fallback when `TARO_APP_CDN_BASE_URL` is unset. Six new reaction icon sets were pushed to the production CDN via the `icon-cdn-asset-upload` branch and verified HTTP 200.
- **Validation:** Shared tests (292 passed), mini-program tests (393 passed), typecheck, guardrails, and icon transparency validation all pass. Main package size remains over the 2 MB WeChat guideline due to pre-existing local assets; the new icon sets are small relative to the existing footprint.

**43. Interest Taxonomy v2.0 + Illustrated Assets + Package-Size Recovery** 🏷️ *(2026-06-18)*
- **Scope:** Canonical interest taxonomy (`packages/shared/src/interests.ts`) and mini-program asset pipeline.
- **Taxonomy v2.0.0:** Restructured around meeting scenes — 48 active interests across 6 macro categories: 美食小酌 (`food`), 聚会玩乐 (`play`), 运动户外 (`sports`), 文艺现场 (`culture`), 生活美学 (`life`), 思想成长 (`growth`). Added RIASEC mapping to every interest.
- **Illustrations:** Generated 48 proprietary `.webp` interest illustrations (≤ ~20 KB each) and 4 refreshed category icon sets; uploaded to the production CDN (`https://joyjoinapp.com/static/images/interests/` and `…/images/icons/category-icons/`). All live assets verified HTTP 200 via `validate:assets`.
- **Frontend wiring:** `getInterestAssetUrl()` resolves the canonical `imageUrl` through `cdnAsset()`; `InterestChipCloud` renders interest icons with level visualization; `pages/onboarding/profile-review/index.tsx` passes top-interest IDs to the chip cloud.
- **Build-time CDN URL guarantee:** `apps/mini-program/config/index.ts` now defaults `TARO_APP_CDN_BASE_URL` to `https://joyjoinapp.com/static` in production, and `.github/workflows/taro-weapp-build.yml` also falls back to the same value, preventing undefined CDN hostnames in release builds.
- **Package-size recovery:** Reduced the compressed main package from ~2.55 MB peak back down to ~1.88 MB by:
  - Bundling only 6 core Xiaoyue mascot sprite states (`welcome`, `idle`, `coach`, `loading`, `listening`, `thinking`) locally; the remaining 14 states are CDN-primary with local `.webp` fallback.
  - Stripping `@3x` variants from bundled `status-icons`, `info-labels` (semantic), and `ui` tiers at build time via `clean:cdn-assets`; 3x devices scale the `@2x` assets.
- **Guardrails cleanup:** Removed stray inline emojis and ad-hoc `font-size` literals from `StatusCard.tsx`, `HalfwayMilestone.tsx`, `emptyStates.ts`, `packages/shared/src/api.ts`, `extended-data/index.tsx`, `UndercoverWordPhaseView.tsx`, and `event-ticket-payment/index.scss`.
- **Validation:** Typecheck, build, package-size check, guardrails, shared tests (292), server tests (1784), and mini-program tests (393) all pass.

### 2026 Milestones (May 2026)

**29. Social Icebreaker Phase Quality Sprints** 🧊 *(2026-05-05 to 2026-05-07)*
- **Sprint C — Warmup Boost:** Archetype mix badge ("今晚气氛组"), mood selection animations with scale/glow/dim states, CardFlip topic card entrance animation, ParticleBurst all-ready celebration. Shared infra: `ParticleBurst`, `CardFlip`.
- **Sprint D — Auction Enhancement:** Server-synced timer (`auctionLotStartedAt`), persistent bid history (`auctionBidHistory`), outbid toast notifications, archetype-aware lot generation via `buildArchetypeContext` → prompt injection, lot emoji categorization fallback, CardFlip lot reveal, ParticleBurst win celebration, IdentityReveal high-bidder spotlight. Negative balance guards preserved.
- **Sprint B — Recap Redesign:** IdentityReveal hero headline with dramatic reveal sequencing, CardFlip dynamic share card (front=summary, back=session data), ParticleBurst mount celebration, staggered CSS medal grid entrance, all V2 data fields rendered (lieDetective stats, personalityDice highlights, undercoverWord result). Removed inline styles and non-token hex colors.
- **Shared infra established:** `ParticleBurst`, `CardFlip`, `IdentityReveal` in `apps/mini-program/src/components/reveal/` — reused across warmup (2), auction (3), and recap (3).

**30. Q2 Pilot — Moment Card, Bonus Gate, Phase Metrics, Admin Tooling** 🚀 *(2026-05-11 to 2026-05-13)*
- **Moment Card server render:** `GET /api/social-icebreaker/:id/moment-card.png` produces a 640×1040 PNG share card via `@napi-rs/canvas`, replicating the client Canvas layout server-side. Feature-flagged: `SOCIAL_ICEBREAKER_ENABLE_MOMENT_CARD_SERVER_RENDER`.
- **Mini-script bonus gate:** When `mini_script` would be the next phase and `SOCIAL_ICEBREAKER_ENABLE_MINI_SCRIPT=true`, the server pauses at a `bonusGateOffered` state. Host sees accept/decline CTAs; players vote `want`/`pass`. Live sentiment tally: "X/Y 小伙伴想玩". If accepted → `mini_script`; if declined → skip to `recap`. Mini-program overlay: `BonusGateOverlay.tsx` with Xiaoyue branding.
- **Phase metrics instrumentation:** New `social_icebreaker_phase_metrics` table (migration `0040_late_black_knight.sql`) records `dwellTimeMs`, `startedAt`, `endedAt`, and `participantCount` per phase on every advance. Fire-and-forget insert from `socialIcebreakerExtended.ts`.
- **Admin refund CSV export:** `GET /api/admin/refund-attempts/export` returns `text/csv` with BOM, optional `?since`/`?until` date filters, and formula-injection escape. Admin UI export button added.
- **Admin social AI benchmark:** `GET /api/admin/benchmarks/social-ai` exposes `runSocialAIBenchmark()` with iteration cap (max 10), model whitelist validation, and 503 if API keys missing. Returns `{ generatedAt, report, iterations, modelsTested }`.
- **Shared CSV utility:** `packages/shared/src/csvExport.ts` — `escapeCsv()` and `buildCsvContent()` used by server and admin client.

**31. Predictive Shell Generalization** 🐚 *(2026-05-17)*
- **Composite tab endpoints:** `GET /api/shell/discover`, `/api/shell/profile`, `/api/shell/events`, `/api/shell/connections` bundle auth user + tab data into single responses, eliminating cold-start round-trips on tab switch.
- **Shared server infrastructure:** `shellCache.ts` (NodeCache singleton, 30s TTL, cross-shell invalidation), `buildAuthUserResponse.ts` (shared auth builder), `shellRepository.ts` (N+1-free composite assembly). Prerequisite repos: `joinedEventsRepo.ts` and `connectionsRepo.ts`.
- **Client prefetch engine:** Landing page stages all 4 shells after entry animation via `PrefetchEngine` (`apps/mini-program/src/lib/prefetchEngine.ts`), injecting composite data into existing TanStack Query keys. Auth injection is gated for pruned shells; Profile shell injects unconditionally. **2026-06-05 fix:** `PrefetchEngine` intentionally omits `paymentsEnabled` from pruned auth fragments so the live `/api/auth/user` response remains the sole source of truth for kill-switch state.
- **Cache invalidation:** `shellCache.invalidateUser(userId)` triggered on payment/coupon use, pool registration, connection creation, assessment completion, and event-feedback submission (so the Connections tab transitions out of `feedback-pending`).
- **Graceful fallback:** Events and Connections pages fall back to legacy endpoints (`/api/events/joined`, `/api/my-connections`) if composite 500s. Discover shell already had fallback from pilot.
- **Profile page deduplication:** Removed duplicate `auth-user-profile` fetch; Profile page now reads directly from `AUTH_QUERY_KEY`.

**34. Payment Ritual V2 Backend Infrastructure** 💳 *(2026-06-08)*
- **Real ritual context API:** `GET /api/payments/ritual-context` returns user archetype, active pricing plans, user coupons, and real DB-backed community stats (city-scoped total members, weekly new members, monthly events, recent activity via `discoverAnalyticsEvents` inner join). Parallelized queries for low latency. No fabricated social-proof metrics.
- **Dedicated analytics endpoint:** `POST /api/analytics/payment` accepts 15 ritual event types (`ritual_enter`, `ritual_act1_complete`, `ritual_act2_reveal`, `ritual_archetype_shown`, `ritual_plan_hover`, `ritual_plan_select`, `ritual_plan_reselect`, `ritual_cta_tap`, `ritual_cta_hesitation`, `ritual_payment_start`, `ritual_payment_success`, `ritual_payment_error`, `ritual_verification_enter`, `ritual_achievement_shown`, `ritual_emotional_score`). Stored in `paymentRitualEvents` table. Rate-limited at 120 req/min.
- **Client analytics fix:** `paymentRitualAnalytics.ts` now sends directly to `/api/analytics/payment` instead of routing through `discoverAnalytics.track()` (which silently dropped events with `invalid eventType`). A/B variant (`control`/`ritual_v2`) included in `ritual_enter` metadata for segmentation.
- **Feature flag:** `PAYMENT_RITUAL_V2_ENABLED` (hardcoded client-side, with auth-response `user.features.paymentRitualV2` kill switch). Currently `false`; ready to flip when frontend polish is complete.

**33. Admin Feature Flags + Mini-Program Perfect-Level Polish** 🎯 *(2026-05-24)*
- **DB-backed feature flags:** New `feature_flags` table with migration `0047_special_jackal.sql`. `apps/server/src/lib/featureFlags.ts` resolves flags from DB with 5s LRU cache, falling back to env vars. Five kill switches migrated: `restartOnboarding`, `smartProfession`, `onboardingForceSkip`, `matchingLiveReveal`, `socialIcebreakerClientForceEnd`.
- **Admin feature flags UI:** New `/admin/feature-flags` page (super_admin only) with toggle switches, source badges (`db` vs `env_fallback`), batch save, and `updatedBy` audit trail. Endpoints: `GET /api/admin/feature-flags`, `PUT /api/admin/feature-flags/:key`.
- **Personality test polish:** Success toast after poster generation ("氛围卡已生成") and after inline WeChat login ("登录成功，正在为你准备匹配…").
- **Verifier quick wins:** Safe-area padding on Matching Reveal bottom actions; force-end confirmation dialog in Icebreaker; success toasts on onboarding submit; retry buttons on icebreaker/pool-reg error states.
- **Harness Completion Gate:** All 5 mini-program journeys scored 完美 (40–44/44): Onboarding, Pool Registration, Matching Reveal, Icebreaker, Personality Test.

**34. Profile Tab + Edit-Profile Identity-First Redesign** 🪪 *(2026-05-24)*
- **Cognitive continuity:** Profile tab and edit-profile redesigned so users recognize edit-profile as "tuning up" existing data, not starting from zero. Uses same visual language as onboarding (archetype hero, Xiaoyue greeting, interest chips).
- **New shared profile components:** `ProfileArchetypeHero` (gradient archetype card), `InterestChipCloud` (read-only interest chips with L1/L2/L3 levels), `ProfessionDisplayField` (raw text + AI-classified tags).
- **Profile tab:** Identity-first hierarchy — archetype hero → Xiaoyue greeting → social identity preview (interest chips with level visualization, intent labels, AI tagline) → action rows → logout. Fade-in animation, error states, reduced-motion support.
- **Edit-profile:** 2-step continuous scroll (Step 1 "基础档案" + Step 2 "社交画像"). Field-level validation, scroll-to-error via `ScrollView scrollIntoView`, unsaved-changes guard, skeleton loading, haptics, floating CTA bar. Completeness audit: 44/44.
- **Profile-review backport:** Adopted `InterestChipCloud` for interest + category chips.
- **Analytics:** Lightweight `logInfo` events for `edit_profile_enter`, `edit_profile_save` (with `fieldsChanged`), `edit_profile_abandon` (with `secondsOnPage`).

**39. Intent Icon Wiring + Shared Selection Logic** 🎯 *(2026-06-17)*
- **Icon wiring:** Pool registration, onboarding `essential-data`, profile-review, and edit-profile now render intent options through `JoyJoinIcon tier="intent"`. `intent` remains out of `CDN_ICON_TIERS` so assets resolve from the bundled `src/assets/icons/intent-icons/` (no runtime `require()` in subpackages). `usePreloadIntentIcons` pre-warms the bundled set before the grid renders.
- **Shared selection logic:** New `toggleIntentValue(selected, value, { maxExplicit })` helper in `packages/shared/src/constants.ts` centralizes the `MAX_INTENTS=3` cap and `随缘`/flexible coexistence rules. It returns `null` when the cap would be exceeded, letting callers surface haptic + toast feedback. Covered by 8 unit tests in `packages/shared/src/__tests__/intents.test.ts`. Used by pool-registration, onboarding `essential-data`, and edit-profile.
- **Reusable component:** `apps/mini-program/src/components/intent/IntentCard.tsx` is the single component for intent selection cards. It renders the Lovart icon, label/subtitle, selected checkmark, disabled/dimmed states, `haptics('light')`, and accessible `aria-pressed`/`aria-disabled`/`aria-label` attributes. Token-based muted colors replace opacity-only dimming for accessible contrast.
- **Copy update:** Edit-profile intent field label changed from「社交意图」to「社交期待」; each option shows a 36rpx `JoyJoinIcon` left of the label with disabled/dimmed states.
- **Completion feedback:** Pool-registration shows a muted completion pill "已经选满 3 个期待，先聚焦这些方向" when the explicit-intent cap is reached.
- **Profile review:** Intent chips on the review page render with `JoyJoinIcon tier='intent' size={24}`.
- **Pool-registration refactor:** Extracted terminal states (loading stale, empty, already-joined, success) into `apps/mini-program/src/pages/pool-registration/components/PoolRegistrationTerminalStates.tsx` and added reusable `useReactionTimer` hook in `apps/mini-program/src/hooks/`. Removed the unfinished `PoolRegistrationFlowSteps.tsx` split file.
- **Tooling / quality:** Restored `min-height: 100vh` fallback before `100dvh` in `pool-registration/index.scss` per `AGENTS.md §4` WeChat WKWebView guidance; fixed `scripts/devtools/design-audit.mjs` regex so `min-height: 100vh` is no longer flagged; removed the registration `logInfo` PII payload and deduplicated reaction timer logic.
- **Scope:** Affects onboarding `essential-data` Step 5 intent grid, pool-registration intent grid, edit-profile, and profile-review. No API or schema changes.

**40. App-Launch Onboarding Preloader + Archetype Asset Registry Refactor** 🚀 *(2026-06-18)*
- **Staggered app-launch preloader:** `apps/mini-program/src/lib/utils/onboardingPreload.ts` replaces the previous heavy app-launch preload. It warms onboarding-critical raster assets in three tiers (immediate intro/welcome art; ~400ms test expressions + personality emoji + intent icons + milestone badge + welcome-back hero; ~1200ms curated core mascot sprite sheets). It skips entirely on 2G/offline and defers the heavy tier on low-end devices (`benchmarkLevel <= 15`), removing all 12 archetype CDN images and the full mascot sprite set from the app-launch critical path.
- **Concurrency-limited batch preloading:** `preloadImages` in `apps/mini-program/src/lib/utils/imagePreload.ts` now accepts an optional `concurrency` cap to avoid decoder saturation on heavy bundles.
- **Canonical archetype asset registry:** Moved `ARCHETYPE_ASSET_MAP`, spritesheet helpers, and bulk-preload utilities from `pages/onboarding/personality-test/visuals.ts` to `apps/mini-program/src/lib/utils/archetypeAssets.ts`. `visuals.ts` re-exports them for existing consumers; new code should import from the lib utility.
- **Intent icon pre-warming:** `usePreloadIntentIcons` now skips on offline networks in addition to 2G, ensuring subpackage intent grids render proprietary icons reliably.
- **Pool-registration intent card reuse:** The pool-registration intent grid now uses the shared `IntentCard` component (already used in onboarding essential-data and edit-profile), fixing invisible selection feedback from missing pool-registration SCSS classes and removing dead styles.
- **Tests:** Added `onboardingPreload.test.ts` and `imagePreload.test.ts` covering tier gating, network/device skip logic, timer cleanup, and concurrency.
- **Docs synced:** `apps/mini-program/README.md`, `apps/mini-program/docs/ASSET_STRATEGY.md`, `docs/mini-program/mini-program-product-reference.md`, `docs/reference/perf.md`, `AGENTS.md`.

**38. Mini-Program Landing & Profession Overlay Polish** 🧹 *(2026-06-13)*
- **Landing continue-mode CTA:** context-aware labels replace the generic "继续创建账户" — `进入发现页` when the returning user's `nextStep` is `discover` (routed to the Discover tab), `继续完善档案` for authenticated users still in onboarding, and `继续完成测试` for guests with an incomplete anonymous assessment session. The CTA sets `isPageExiting` before navigation and resets it via `useResetOnShow` on swipe-back/foreground so the button never stays stuck on the ellipsis spinner.
- **Profession overlay accessibility & performance:** `ProfessionChatOverlay` detects `prefers-reduced-motion` via `Taro.getSystemInfoSync` and applies a `profession-overlay--reduce-motion` class that suppresses entrance/exit animations, typing-dot bounce, sparkle bursts, and keyboard-slide transitions. The keyboard-aware input bar uses `transform: translateY(-keyboardHeight)` to stay on the compositor and avoid layout thrashing.
- **Brand-token cleanup:** Landing page exit animations use explicit `transition: opacity, transform` instead of `transition: all`; the phase-carousel icon fallback gradient uses brand tokens (`$color-bg-tint-purple` → `$color-primary-light`) instead of a hard-coded hex pair.

**37. Squad Unboxing Drag-to-Reveal Ribbon** 🎁 *(2026-06-08)*
- **Touch-driven blind-box unboxing:** `DragRevealRibbon` component on `pages/squad-unboxing/index` replaces the static "揭晓桌友" button with a draggable slider that physically lifts the blind-box lid in real time. Drag progress (0–1) drives lid translation/rotation, interior fade, body bounce, aura pulse, and shadow shrink via inline `transform`/`opacity` styles for 1:1 finger tracking.
- **Snap threshold:** At ≥50% progress, the ribbon auto-snaps to full reveal with a 280ms ease-out, haptic feedback (`Taro.vibrateShort`), and analytics fire. Below 50%, it elastic-snaps back to 0.
- **Fallback hierarchy:** (1) `prefers-reduced-motion: reduce` → tap-only; (2) degradation-tier device (`useDeviceTier().isDegradation`, i.e. `benchmarkLevel <= 15` on Android or an old iPhone / old iOS model heuristic) → tap-only; (3) server kill switch `squadUnboxingDragRevealEnabled=false` → tap-only. Tap fallback shows "点击拆盒" and triggers the existing `shaking` → `revealed` flow.
- **Performance:** RAF-throttled progress updates (`requestAnimationFrame` batching) prevent re-render thrashing. `transform` + `opacity` only — no layout-triggering properties. `catchMove` on the track prevents parent `ScrollView` interference during horizontal drag. `+0.23kB` gzipped.
- **Accessibility:** `role="slider"`, `aria-valuenow` (0–100), `aria-live="polite"`, and dynamic `aria-label` ("向右滑动，拆开惊喜" / "点击拆盒"). Touch target is full track width at 88rpx height.
- **Feature flag:** `squadUnboxingDragRevealEnabled` is DB-backed (env `SQUAD_UNBOXING_DRAG_REVEAL_ENABLED`, default `true`) wired server→client via `/api/auth/user` `features`. Admin portal exposes toggle. No app-store update needed — falls back on next auth refresh.
- **Analytics:** `POST /api/analytics/squad-unboxing` endpoint (120 req/min rate limit) tracks `squad_unboxing_reveal_drag` (with `progress` %) and `squad_unboxing_reveal_tap` (with `fallbackReason`). Fire-and-forget, silent fail.
- **Completeness audit:** 44/44 — perfect score across all 11 dimensions.

**36. Personality Test Answer-Echo Loading State** 🧠 *(2026-06-08)*
- **"Soft Echo + Whisper Pulse"** replaces the generic skeleton loading state on the personality test page. When a user taps an answer, the UI immediately echoes their exact choice in a ghost card (58% opacity), shows a single thin brand-colored shimmer line (2.4s gradient sweep), and displays a Xiaoyue icon + warm caption ("悦仔收到了，正在分析…").
- **Flow integrity:** A 220ms exit animation plays before the next question atomically appears, preventing the "new question header + old echo" visual mismatch. The pending question data is held in `pendingQuestionUpdateRef` until echo exit completes.
- **Performance:** Reduced from 5 concurrent skeleton shimmer animations to 1 thin line. Low-end devices suppress shimmer entirely; `prefers-reduced-motion: reduce` disables all echo animations with readable static fallback.
- **Accessibility:** `aria-live="polite"` + `role="status"` + dynamic `aria-label` announces the specific selected option (e.g., "已选择：XX，正在提交"). Touch targets maintain ≥88rpx.
- **Kill switch:** `personalityTestEchoEnabled` is a DB-backed feature flag (env `PERSONALITY_TEST_ECHO_ENABLED`, default `true`) wired server→client via `/api/auth/user` `features`. Admin portal exposes toggle. Graceful degradation: when disabled, echo unmounts and normal answer area renders.
- **Analytics:** `personality_test_echo_shown` tracks `optionText` and `hasCommentary` once per submission.
- **Completeness audit:** 44/44 — perfect score across all 11 dimensions.

**35. Mini-Program Bug-Fix & Polish Sprint** 🐛 *(2026-06-05)*
- **Discover empty state restored:** Replaced regressed empty state with `StatusCard` using Lovart `lovart-generic-empty.webp` hero illustration, warm title/description, and a primary action CTA (`去发现活动` or `清除筛选` when filters are active).
- **Events empty/error states:** Empty state now uses the same `StatusCard` + Lovart pattern; fetch failures render `XiaoyueEmptyState` with `emotion='sad'` and a retry CTA.
- **Connections empty/loading/error states:** Context-aware empty states driven by server-side `connectionsContext` (`no-events`, `upcoming-event`, `feedback-pending`, `feedback-complete`). Loading uses `XiaoyueEmptyState` `emotion='waiting'`; `feedback-complete` adds a celebration check-badge + success haptic; CTA busy state shows a spinner + "跳转中…". Fetch failures render `XiaoyueEmptyState` `emotion='reassure'` with retry. Empty-state height is computed from `Taro.getSystemInfoSync()` instead of `100vh/100dvh`. Auth gate uses `useMiniPageGate` with a 4s force-release timeout to prevent stuck loading after app resume.
- **`HeroPromoBanner` hardening:** CTA always receives `onCtaTap` so it never silently disables; added `margin-bottom: 8rpx` to prevent boundary clipping; static copy stripped of fabricated social-proof metrics.
- **`LocationFilterDrawer` scroll fix:** Removed conflicting inline `height: 100%`; added WeChat `enableFlex` prop to `<ScrollView>`; drawer sheet now renders at `z-index: $z-modal` (`200`); district tiles have `role='button'`, `aria-pressed`, descriptive `aria-label`, and SCSS-token-driven heat-dot colours.
- **`XiaoyueSpriteAnimator` crossfade gating:** Exit-frame animation respects `prefers-reduced-motion` and `useDeviceTier` degradation tier to prevent jank on low-end devices.
- **Auth loading gate fix:** `authState.ts` now only blocks when `user === undefined`, so background refetches no longer flash a full-page loading shell.
- **`PrefetchEngine` kill-switch hygiene:** Removed hardcoded `paymentsEnabled: false` from all shell injections so the real auth fetch owns the kill-switch state (fixes stale "权益维护中" toasts).

**32. Bug & Polish Sprint — Mini-Program UX Hardening** 🐛 *(2026-05-22)*
- **Auto-login for returning users:** `AutoLoginBridge` in `app.ts` silently authenticates returning users on cold start, eliminating the manual login tap for already-authorized sessions.
- **Personality test archetype mismatch fixed:** `processTestAnswers` now reuses the anonymous session's pre-computed `finalResult` instead of re-computing after auth import, preventing archetype drift between anonymous and authenticated states.
- **WeChat login prompt on results:** Results page now shows a native `Taro.showModal` prompt before triggering the inline WeChat login sheet, reducing accidental auth triggers.
- **Support email corrected:** Legal terms copy updated from `hello@joyjoin.cn` to `support@joyjoinapp.com`.
- **Dynamic event count:** Profile page replaced hardcoded "3" with live `joinedEvents.length` from the composite shell.
- **Birth year range fix:** Edit-profile birth year picker now starts from `currentYear - 18` descending to 1950, and correctly reads from `birthdate` fallback.
- **Industry English input:** Switched from server embedding search to local `searchOccupations` with pinyin/English/keyword support for instant, offline-friendly industry selection.
- **Intent multi-select + 随缘:** 随缘 ("go with the flow") now coexists with other intent selections; unselected options use token-based muted colors for clear visual hierarchy. Cards are disabled when the explicit-intent cap (`MAX_INTENTS=3`) is reached, with `aria-disabled` and focus-ring treatment.
- **我的足迹 back button + alignment:** Conditional back button via `getCurrentPages().length > 1`; title centered.
- **Android logo fix:** `BrandLogo.tsx` uses local `/assets/joyjoin-logo.webp`; native tab bar uses optimized `joyjoin-logo-tab.png` (19KB vs 596KB) to stay within the 2MB package budget.
- **Interest intensity in settings:** Edit-profile now shows 3-tier level badges (已加入/升温中/高热) with tap-to-cycle `1→2→3→off` intensity control, protected behind a loading guard.
- **Text overflow + icon resilience:** Shortened coach copy texts, added `numberOfLines={2}`, changed `word-break: keep-all` to `overflow-wrap: break-word`, and added `onError` fallback to `Image` components.
- **Export image fixed:** Poster canvas CSS resized to 1080×1920 matching drawing coordinates; image centering corrected with `+20` Y offset. Canvas DPR capped at 2 universally to prevent ~74MB OOM on mid-range devices.
- **Interest heat hierarchy unified:** Monotonic purple opacity ramp (0.35→0.55→0.80 background) with unified copy across onboarding and edit-profile.
- **Bubble standardization:** `XiaoyueChatBubble` gained a `tail` prop; Edit Profile, Extended Data, and Profile Review refactored to use the shared component.
- **Tag/Chip revamp:** New shared `Chip` component with checkmark animation, shimmer wow-effect, and 3-tier level modifiers. Replaces ad-hoc tag styling in edit-profile.
- **Navbar floating polish:** Tab bar uses `border-radius: 40rpx`, `bottom: calc(12rpx + env(safe-area-inset-bottom))`, and stronger shadow for a premium floating feel.
- **Essential Data onboarding UI revamp:** `FormStepper` mechanical segmented progress bar (back-left, centered status, brand-gradient fill with active glow). Purple CTA pickers for birthday (`必填` badge) and relationship status with contextual mascot reactions (e.g., "单身贵族！悦仔记住了~"). Selection pills with GPU-safe `chip-glow-burst` tap effect and morph-on-select checkmark pop.
- **Education options reorder/rename:** `职业培训` → `中专`; canonical order now 博士→硕士→本科→大专→中专→高中及以下 in `EDUCATION_LEVEL_OPTIONS`. Matching algorithm `EDUCATION_ORDINAL` updated (中专/大专 share tier 1). Inference synonym bug fixed (`研究生` → `硕士`).
- **Matching algorithm docs synced:** `PRODUCT_REQUIREMENTS.md` §3.4 stale 5D/4D pseudocode replaced with canonical 6D/7D reference table; `docs/systems/MATCHING_ALGORITHM_REFERENCE.md` education scoring corrected to piecewise formula.

**33. Personality Test Split-Brain Fix & Accessibility Sprint** 🧠 *(2026-05-27)*
- **Split-brain root cause fixed:** The slot machine animation and result page were showing different archetypes due to (1) CDN spritesheet loading instead of the local bundle, and (2) `completeAnonymousAssessment` discarding the server's `finalResult`. Both paths now use identical resolution logic (`resolvedResult.result.primaryArchetype → sessionSnapshot.result.primaryArchetype → topMatches[0].archetype → 'corgi'`).
- **Local spritesheet enforcement:** `getArchetypeSpritesheetLocalPath()` returns the local onboarding-subpackage path (`/pages/onboarding/assets/archetypes/archetype-spritesheet.webp`) instead of a CDN URL, eliminating CDN staleness as a mismatch source.
- **Server result validation:** `validateFinalResult()` in `assessmentV4.ts` validates `primaryArchetype` exists and is a known archetype ID before persisting; falls back to `'corgi'` and logs an error if invalid. GET `/api/assessment/v4/result` returns `500` with "Result data is incomplete" when `finalResult` is null/malformed.
- **Client hard validation:** `isValidFinalResult()` blocks transition to results with an error toast if the server result is missing or contains an invalid `primaryArchetype`.
- **Telemetry:** Both client (`SPLIT_BRAIN_DETECTED` log) and server (divergence log with top-3 scores) emit telemetry when `currentMatches[0]` diverges from `finalResult.primaryArchetype`.
- **MatcherV2 confusion classifiers added:** Dedicated `classifyElephantVsTurtle` (A/P/X differentiators) and `classifyDolphinVsSpider` (E/C/X differentiators) methods added to `applyConfusionAwareClassifier`. Veto rules hardened: turtle penalizes high-A (≥70 → 0.5×) and high-P (≥58 → 0.6×); elephant penalizes very-low-X (<32 → 0.5×) and very-low-P (<38 → 0.6×); spider penalizes high-E (≥78 → 0.5×). Elephant gate threshold corrected from `A≥72` (above elephant's actual A=70) to `A≥68`.
- **Accessibility — reduced motion:** The results page reads `Taro.getSystemInfoSync().reduceMotion` and skips the slot animation entirely when enabled. CSS `@media (prefers-reduced-motion: reduce)` and a JS-driven `.personality-results--reduce-motion` class suppress shimmer, stagger, and tilt animations.
- **Accessibility — error announcement:** `ErrorStage` adds `aria-live="polite"` and `role="alert"` so screen readers announce sync failures.
- **UX — retry tooltip:** Error-state retry button shows helper text "网络波动时可能需要多试一次" to reduce user uncertainty.

### 2026 Milestones (Mar–Apr 2026)

**14. Matching-State UI System** 🎨 *(PRs #387–#391, 2026-03-27 to 2026-04-01)*
- Shared `MatchingStateLayout` abstraction provides a canonical dark background and slot-based composition (hero / copy / CTA / footer) for all matching-state screens
- `MatchingWaitingScreen` — premium dark-mode blind-pool waiting UI with real fill-state transitions (`waiting` → `can_form` → `full`)
- Full matching-state screen family: `NoMatchScreen`, `JoinErrorScreen`, `ExtendedDataEmptyScreen`, `MatchRevealSequenceV2`, `SurpriseMatchReveal` (legacy), `MatchPointsDisplay`; `TestIncompleteScreen` is now a Discover-page pre-entry gate rather than a join-sheet state
- All screens wired to real trigger conditions and app state — no placeholder timers or mocked transitions
- Canonical background centralised in `apps/user-client/src/assets/matching/shared/matching-bg.svg`; state-specific hero assets in sibling subdirectories

**15. Blind Pool Join Flow Enhancements** 🎰 *(PRs #376, #381, #382, 2026-03-23 to 2026-03-27)*
- `BlindPoolTrustExplainer` — in-flow trust explainer card explaining how the blind pool works (rendered in `JoinEventPoolSheet.tsx`)
- `PreJoinVibeBriefSheet` — pre-join vibe brief surfacing pool atmosphere and intent signals before a user commits
- `WhyThisFitsCard` — personalised "Why this fits you" card with AI-generated reasons (`PreJoinVibeBrief.reasons`) shown before joining

**16. Onboarding Flow Sync** 🧭 *(2026-04-07)*
- Active value-first entry flow is `/personality-test` → `/personality-test/results` → `/personality-test/auth-gate` before authenticated onboarding begins
- After auth, onboarding remains server-driven via `nextStep` for `/onboarding/setup` → `/onboarding/extended` → `/onboarding/review` → `/discover`
- `profileExtendedComplete` is not the onboarding-step gate for extended data; `hasCompletedInterestsCarousel` remains the canonical completion signal

**17. Personality Test Flow Sync** 🧠 *(2026-04-07)*
- V4 question count is config-driven (`minQuestions`, `softMaxQuestions`, `hardMaxQuestions`) rather than a fixed 10-question or fixed 8–16-question flow
- `Q_PLAYFUL_SLIDER` and `Q_PLAYFUL_EMOJI` are universal closing questions that must both be answered before the assessment is complete
- The active test page keeps back navigation for local question-history review; when the user is already at the start with no earlier answers, the exit path returns to `/`

**18. Post-Match Group Theme & Companion** 🎭 *(PR #377)*
- Group theme tags and a companion summary line in squad reveal (`SquadUnboxingFlow.tsx`)

**19. AI Onboarding — Profile Tagline** 🤖 *(PR #375)*
- AI insight tagline (`insightLine`) displayed inside `ProfilePortraitCard` on the Profile Review page
- Served by `GET /api/onboarding/profile-tagline`; contract: `ProfileTaglineResponse` in `packages/shared/src/ai/onboarding.ts`
- Presentation-only; does not affect onboarding state or `nextStep`

**20. AI Observability — Trace Logger** 📊 *(PR #380)*
- Structured AI call trace logger: `apps/server/src/lib/aiTraceLogger.ts` (`logAITrace()`)
- Emits single-line `[AITrace] {json}` logs to stdout for every AI call
- `matchExplanationService` and `socialIcebreakerAIService` instrumented

**21. AIResponseMeta Normalization** 🔧 *(PR #378)*
- `packages/shared/src/types/aiMeta.ts` — shared `AIResponseMeta` contract with `fromCache`, `generatedAt`, `provider`, `fallbackUsed`, `promptVersion`
- Builder helpers: `buildLiveAIMeta()`, `buildCachedAIMeta()`, `buildFallbackAIMeta()`
- Foundation for consistent observability across all AI surfaces; ongoing per-service migration

**22. Interest Signal Boundary Enforcement** 🔒 *(PR #379)*
- `user_interest_signals` removed from deterministic pair scoring
- `calculateSignalAlignmentBonus()` and `loadInterestSignalLookup()` deleted from `poolMatchingService.ts`
- Signals now feed AI enrichment only (match explanation connection points, icebreaker topics)
- Invariant verified by `apps/server/src/__tests__/interestSignalBoundary.test.ts`

**23. Interest Signal Boost Refinement** ✨ *(PR #372)*
- Onboarding interest data reused to pre-select the boost interest and derive enthusiasm level server-side (no re-asking)
- UX simplified to 2 steps (was 3); surfaced after pool registration in `SuccessCelebration` screen

**24. Onboarding Clarity & Reduced Artificial Waits** ⚡ *(PR #383)*
- Profile review "analyzing" phase reduced from 2500 ms to 1200 ms default (500 ms for reduced-motion users)
- Skippable after 600 ms — no artificial waiting when data is already ready

**25. Limited Browse Mode Experiment** 🔬 *(PR #384)*
- Scoped experiment: a secondary "先浏览 →" CTA on the Profile Review page lets users enter read-only event discovery before registering
- Controlled by `ENABLE_LIMITED_BROWSE_MODE` constant in `FinalProfileReviewPage.tsx`; per-session opt-out via `?exp=no_limited_browse`
- Not a permanent product pattern — do not generalize without verifying gating logic

**26. Frontend Performance Improvements** 🚀 *(PRs #385, #386, #388)*
- Route-level lazy loading for all non-critical pages in `App.tsx`
- Dead admin code removed from user-client bundle
- Landing page hero images converted to WebP with `decoding="async"`
- Deferred archetype asset loading; gated background prefetch for no-activity users (PR #363)
- Vite chunk optimisation and empty-state SVG optimisation (PR #362)

**27. Social Icebreaker v2 Phase Rollout** 🧊 *(PR #370)*
- Server-driven phase rollout configuration for Social Icebreaker v2
- Beta phase scaffolding added for future phases beyond MVP (warmup → micro_challenge → lie_detective → recap)

**28. Center-Tab Empty-State Page** 📭 *(PRs #359, #362, #363)*
- `CenterTabEmptyStatePage` — dedicated transition page for no-activity users accessed via the centre nav tab
- Hybrid layout with optimised SVG assets; background asset prefetch gated on activity state

### 2026 Milestones (Jan–Mar 2026)

**8. Value-First Onboarding Flow** 🚀 *(2026-02-04)*
- WeChat-first, post-test signup replaces phone-first registration
- Anonymous personality test before login; test answers linked on WeChat auth via `POST /api/auth/wechat/login-with-test`
- Deprecated onboarding fields: `languagesComfort`, `activityTimePreference`, `socialFrequency`, `groupSizeComfort`, `hometownCountry`

**9. Server-Driven Navigation (Scope B1)** 🧭 *(2026-02-04)*
- All post-auth routing uses `nextStep` from `GET /api/auth/user`; no client-side onboarding progress reconstruction
- New `useAuth` fields: `nextStep`, `profileEssentialComplete`, `profileExtendedComplete`, `activeAssessmentSessionId`

**10. Profile Review Step** 🪞 *(2026-02-04)*
- New onboarding step: `/onboarding/review` (`FinalProfileReviewPage`) between Extended Data and Discover
- Server field `hasSeenProfileReview`; marked complete via `POST /api/profile-review/complete`

**11. Guide Page Deprecated** 🗑️ *(2026-02-16)*
- `/guide` step removed from onboarding; `hasSeenGuide` column dropped from users table (2026-05)
- Guide content replaced by inline coach marks (`CoachMarkBanner`, `XiaoyueFAB`, `ProfileCompletionNudge`) on Discover page

**12. Life Stage Affinity Matrix** 🤝 *(PR #312)*
- Added `LIFE_STAGE_AFFINITY` (7×7 asymmetric `workMode` matrix) to `poolMatchingService.ts`
- Clarified distinction: affinity signals (education, hometown, life stage) vs. diversity signals (industry, gender)

**13. Social Icebreaker — Primary In-Event Flow** 🧊 *(added §1.7)*
- `/icebreaker/:sessionId` (`IcebreakerSessionPage`) is now the canonical in-event experience
- Phases: 话题卡 → 挑战 → 侦探 → 回顾; full reference in `docs/icebreaker-system.md`

### 2025 Milestones (Nov 18-20, 2025)

**1. Temperature Concept System** 🌡️
- Dual-temperature visualization: Social Energy (社交能量) + Chemistry Reaction (化学反应温度)
- 12 archetypes mapped to 0-100 energy scale
- Visual emoji indicators: 🔥 炽热 (≥85) | 🌡️ 温暖 (70-84) | 🌤️ 适宜 (55-69) | ❄️ 冷淡 (<55)
- Prevents unbalanced groups (all high-energy or all low-energy)

**2. Matching Algorithm Fix** 🔧
- Corrected critical diversity double-counting bug
- Updated group scoring formula: **60% pair compatibility + 25% diversity + 15% energy balance**
- Current pair score uses 6-dimension weighted model (Chemistry 28%, Interest 28%, Social Affinity 20%, Background Diversity 15%, Preference 5%, Language 4%); see `apps/server/src/poolMatchingService.ts` for active implementation

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

JoyJoin is an AI-powered social networking platform that connects individuals locally through small, curated micro-events (4-6 attendees per group). The platform uses sophisticated personality-based matching algorithms to create meaningful connections while emphasizing psychological safety and inclusivity.

### Key Value Propositions

- **AI-Driven Matching:** 12 personality archetypes (V4 animal system) with 7-dimensional pool compatibility scoring
- **Micro-Event Format:** Small group sizes (4-6 people) for meaningful interactions
- **Blind Box Experience:** Gamified event discovery with surprise reveals
- **In-Event Social Experience:** Social Icebreaker multi-phase group facilitation (话题卡 → 挑战 → 侦探 → 回顾) as the core in-event engagement tool
- **Data-Driven Insights:** Comprehensive feedback system to refine matching algorithms
- **权益 (Membership Benefits) System:** ¥98/month or ¥294/3-month 权益方案 with WeChat Pay integration (user-facing copy must use `权益`, not `会员`)

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

1. **好奇猫头鹰 Lisa (Contemplative Owl)** - 28, Marketing Manager
   - Moved to Shenzhen 6 months ago
   - Wants to meet like-minded professionals
   - Values deep conversations over small talk

2. **社牛柯基 David (Happy Corgi)** - 26, Startup Founder
   - Naturally outgoing, energizes groups
   - Looking to expand professional network
   - Enjoys facilitating connections

3. **树洞考拉 Amy (Koala)** - 30, HR Director
   - Observant and empathetic
   - Enjoys helping others meet
   - Values harmony and inclusion

---

## 📱 User App Features

### 1. User Onboarding & Registration

**Canonical (Mini-Program):** `apps/mini-program/src/pages/onboarding/personality-test/index.tsx` (primary), `apps/mini-program/src/pages/login/index.tsx`

**Web Reference:** `apps/user-client/src/features/onboarding/active/pages/PersonalityTestPage.tsx`, `apps/user-client/src/pages/LoginPage.tsx`

#### 1.1 Authentication — WeChat-First (Current)

> **⚠️ Legacy section below:** The Phone Authentication flow (SMS verification → Profile Setup) was the original registration method. It has been superseded by the WeChat-first pre-test-signup flow (implemented 2026-02-04). The phone auth endpoints remain available as a fallback on `LoginPage`.

**Current Primary User Journey:**
```
LandingPage → /personality-test (anonymous V4 test) 
→ PersonalityTestResultPage (archetype reveal) 
→ 微信一键登录 (WeChat login CTA, shown after 3 seconds)
→ POST /api/auth/wechat/login-with-test (creates account + saves test results)
→ /onboarding/setup (EssentialDataPage — new users only)
→ /onboarding/extended (ExtendedDataPage)
→ /onboarding/review (FinalProfileReviewPage)
→ /discover
```

**WeChat Auth Endpoints:**
- `POST /api/auth/wechat/login-with-test` — New user sign-up with personality test answers
- `POST /api/auth/wechat/login` — Returning user login (no test answers)
- `GET /api/auth/wechat/oauth/start` — Browser OAuth2 web flow (staging/production browser)
- `GET /api/auth/wechat/oauth/callback` — OAuth2 callback handler

**Session:** 7-day persistent login via PostgreSQL session store

---

#### 1.1b Phone Authentication ⚠️ Legacy Fallback

- **Method:** SMS verification (6-digit code)
- **Status:** Available as a fallback on `/login` (`LoginPage.tsx`), not shown in new-user onboarding
- **API Endpoints:**
  - `POST /api/phone/register` - Send SMS code
  - `POST /api/phone/verify` - Verify code and create session
  - `POST /api/phone/login` - Existing user login

#### 1.2 Multi-Step Profile Setup

> ⚠️ **Legacy reference:** This section documents the original multi-step profile setup flow. The current onboarding flow is described in §1.1 (WeChat-first post-test signup). The current onboarding sequence is: anonymous personality test → WeChat login → Essential Data (`/onboarding/setup`) → Extended Data (`/onboarding/extended`) → Profile Review (`/onboarding/review`) → Discover.

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

**Step 5: Profile Review**
- Presents a read-only "admission poster" summary of archetype, profile cards, intent chips, and interest heat map.
- Captures an optional 1–100 character personal description (bio, `一句你的社交签名`) before completing onboarding; persisted via `POST /api/profile-review/complete` and contributes +10% to profile completion.

---

### 1.3 Personality Test System ⭐

> **Note**: The active onboarding route uses the V4 adaptive assessment page at `apps/mini-program/src/pages/onboarding/personality-test/index.tsx` (mini-program) and `apps/user-client/src/features/onboarding/active/pages/PersonalityTestPage.tsx` (web reference). `apps/user-client/src/pages/PersonalityTestPageV4.tsx` is a compatibility re-export. V2 has been deprecated.

**Canonical (Mini-Program):** `apps/mini-program/src/pages/onboarding/personality-test/index.tsx` (test), `apps/mini-program/src/pages/onboarding/personality-test/results` (results)

**Web Reference:** `apps/user-client/src/features/onboarding/active/pages/PersonalityTestPage.tsx`, `apps/user-client/src/pages/PersonalityTestResultPage.tsx`

#### Architecture Overview

**Last Updated:** 2026-03-23 (V4 System)

**12 Personality Archetypes** (Production):

1. 🐕 **社牛柯基 (Happy Corgi)** - High energy socializer (X=95, P=85)
2. 🐓 **小太阳鸡 (Rooster)** - Optimistic motivator (P=92, X=78)
3. 🐬 **夸夸仓鼠 (Hamster)** - Warmhearted encourager (A=95, X=82)
4. 🦊 **寻宝狐 (Clever Fox)** - Creative problem-solver (O=92, X=78)
5. 🐬 **机灵海豚 (Dolphin)** - Balanced mediator (E=85, C=70)
6. 🕷️ **人脉蛛 (Weaver Spider)** - Detail-oriented planner (C=85, E=65)
7. 🐻 **树洞考拉 (Koala)** - Empathetic supporter (A=90, E=80)
8. 🐙 **脑洞章鱼 (Inspiration Octopus)** - Innovative ideator (O=95, P=70)
9. 🦉 **好奇猫头鹰 (Contemplative Owl)** - Analytical thinker (O=88, C=80)
10. 🐘 **靠谱大象 (Grounded Elephant)** - Stable anchor (C=90, E=86)
11. 🐢 **慢热龟 (Steady Turtle)** - Reliable introvert (E=85, C=80)
12. 🐱 **小透明猫 (Invisible Cat)** - Reserved observer (E=80, X=20)

*See `packages/shared/src/personality/archetypeNames.ts` for canonical source*

#### Test Structure - V4 Adaptive Assessment (Server-Configured Range)

**Adaptive System:**
- 60-question bank divided into 3 levels (L1 Anchor, L2 Adaptive, L3 Disambiguation)
- Question count is controlled by `AssessmentConfig` in `packages/shared/src/personality/types.ts` and evaluated by `shouldTerminate()` in `adaptiveEngine.ts`
- Default config (`DEFAULT_ASSESSMENT_CONFIG`): `minQuestions=10`, `softMaxQuestions=12`, `hardMaxQuestions=16`
- V2/tiered config (`V2_ASSESSMENT_CONFIG`, used when the matcher-v2 path is enabled): `minQuestions=12`, `softMaxQuestions=16`, `hardMaxQuestions=20`
- Completion is not based on a fixed number of standard questions; the adaptive engine terminates when `shouldTerminate()` decides enough confidence has been reached after the configured minimum, or when `hardMaxQuestions` is reached
- After the adaptive phase terminates, **`Q_PLAYFUL_SLIDER` and `Q_PLAYFUL_EMOJI` are always presented to every user** as universal closing questions (in that order). The full assessment is complete only after both have been answered.

**Question Flow:**
```
Phase 1: Ask 8 anchor questions (L1) → Establish baseline
Phase 2: Check confidences → If low, ask adaptive questions (L2)
Phase 3: Check confusion → If top-2 close, ask disambiguation (L3)
Phase 4: `shouldTerminate()` evaluates confidence / confusion / configured bounds
Phase 5: Universal closing — Q_PLAYFUL_SLIDER (slider) then Q_PLAYFUL_EMOJI (emoji_tap)
Phase 6: V2 Matcher → Calculate final archetype (with conflictPosture from closing questions)
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
| 社牛柯基 | 60 | 50 | 60 | 65 | 95 | 85 |
| 小太阳鸡 | 70 | 78 | 88 | 55 | 78 | 92 |
| 夸夸仓鼠 | 95 | 50 | 65 | 62 | 82 | 88 |
| 寻宝狐 | 40 | 50 | 60 | 92 | 78 | 58 |
| 机灵海豚 | 70 | 70 | 85 | 65 | 65 | 68 |
| 人脉蛛 | 70 | 85 | 65 | 70 | 60 | 60 |
| 树洞考拉 | 90 | 65 | 80 | 60 | 48 | 70 |
| 脑洞章鱼 | 50 | 28 | 55 | 95 | 52 | 70 |
| 好奇猫头鹰 | 45 | 80 | 75 | 88 | 40 | 50 |
| 靠谱大象 | 70 | 90 | 86 | 50 | 40 | 60 |
| 慢热龟 | 45 | 80 | 85 | 65 | 30 | 45 |
| 小透明猫 | 50 | 50 | 80 | 45 | 20 | 45 |

**Step 4: Generate Personalized Insights**

For each archetype, system provides:
- **Strengths:** Key capabilities and natural talents
- **Growth Areas:** Potential challenges and blind spots  
- **Compatible Archetypes:** Top 3 from chemistry matrix (see `archetypeChemistry.ts`)

*Note: Blending formula and subtypes removed in V4. Archetype assignment produces a single primary match. For non-decisive matches (confidence gap < 15%), the hero card surfaces the runner-up as a subtle personality note using Xiaoyue's blend-aware copy ("隐约有[secondary]的影子") — this is a display concern, not a blending formula. The matching system uses continuous 6D trait vectors, not archetype labels.*

#### UI/UX Features

**Last Updated:** 2026-02-04 (Personality Test System V4)

**During Test:**
- ✨ **Progress Indicator:** Visual progress bar + question counter derived from server `progress.minQuestions`, `progress.softMaxQuestions`, and `progress.hardMaxQuestions`
- 📊 **Mini Radar Chart:** Real-time progress visualization showing 6 traits (ACOEXP)
- 🎉 **Milestone Animation:** Appears dynamically based on trait confidence levels
- 🎁 **Blind Box Reveal:** 3-second rotating gift box animation on submission
- 🔄 **Adaptive Flow:** Questions adjust based on server-configured bounds and current confidence; the client shows an estimated total rather than a fixed question count

**Results Page Components:**

1. **Hero Section (70vh)**
   - Gradient background (archetype-specific color)
   - Large emoji avatar (🐕 for 社牛柯基, 🐓 for 小太阳鸡, etc.)
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
   - Match reason display (e.g., "High X+P synergy" for 社牛柯基×小太阳鸡)

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
  top_archetypes,  -- [{ archetype: '社牛柯基', score: 85, confidence: 0.82 }, ...]
  algorithm_version,  -- 'v2'
  match_details_json,  -- V2 Matcher results with trait deltas
  primary_archetype,  -- '社牛柯基'
  is_decisive,  -- true if confidence ≥ 0.7
  completed_at
) VALUES (...);

-- User profile update
UPDATE users SET
  primary_archetype = '社牛柯基',
  has_completed_personality_test = true,
  -- Trait scores stored in assessment_sessions, not users table
  -- Old fields (primary_role, secondary_role) deprecated
WHERE id = user_id;
```

---

### 1.4 Event Discovery & Blind Box System

**Canonical (Mini-Program):** `apps/mini-program/src/pages/discover/index.tsx`, `apps/mini-program/src/pages/event-detail/index.tsx`

**Web Reference:** `apps/user-client/src/pages/DiscoverPage.tsx`, `apps/user-client/src/pages/BlindBoxEventDetailPage.tsx`

> **Updated 2026-04-07** — the active blind-box system is pool-first, not payment-first. Discovery cards expose pool momentum, time + area, and trust framing; the join flow confirms pool entry first, while waiting / reveal states are owned by `MatchingStatusPage`.

#### Event Types

**1. Blind Box Events (盲盒活动)** - Primary Focus
- **Pool-First Discovery:** Title + theme + time + area + type are revealed; exact location and tablemates stay hidden until a group is formed
- **AI-Matched Groups:** Pool registrations are matched into small groups once server-side conditions are met
- **Discovery-Layer Guidance:** `BlindBoxEventCard` can show threshold progress and the deterministic `PoolForecastStrip`, but these are atmospheric cues only — they do not guarantee a formed table

**2. Regular Events (普通活动)**
- Traditional RSVP format
- Visible attendee list
- First-come-first-served

#### Discover Hero Promo Banner (top-of-page)

- **Component:** `HeroPromoBanner` (`apps/mini-program/src/components/HeroPromoBanner.tsx`) — single hero surface, not a carousel
- **Visual:** Full-bleed Lovart illustration. The banner is bundled locally (`banner-hero-lovart-v1.webp` under `assets/promo-local/`) for instant first paint and falls back to the CDN copy on `onError`; PNG fallback is available via CDN if the runtime rejects WebP. Copy-side purple/pink wash, glass copy panel (eyebrow + title + subtitle + CTA), breathing CTA pill with circular arrow, 5 sparkles drifting on negative-delay loop
- **Variant selection:**
  - No archetype → variant C ("先测再玩" — nudges personality test)
  - Has archetype → variant A ("本周推荐" — this weekend) by default
  - `?promo=A|B|C` URL param forces a specific variant (staff / QA)
- **Accessibility:** `role="region"` + `aria-label` + `aria-roledescription="活动推荐横幅"` + `aria-live="polite"`; CTA 88rpx tap target; `env(safe-area-inset-bottom)` for iPhone home indicator; `@supports` fallback for `backdrop-filter`
- **Performance:** Animations gated by `useDeviceTier` (degradation tier kills idle loops) and `IntersectionObserver` (pauses off-screen); sparkles use `transform`/`opacity` only with `will-change` for GPU promotion
- **Kill switch:** `user.features.promoBannerEnabled` (server-driven, DB-backed via `featureFlags.FLAG_ENV_MAP`; admin-toggleable at `/admin/feature-flags`; env fallback `PROMO_BANNER_ENABLED`, default `true`)
- **Copy trust rule (2026-06-05):** Static promo variants must not fabricate social-proof metrics (e.g., fake user counts, popularity percentages, "已有 10,000+ 人加入"). Use real query-backed numbers or omit the metric.
- **Analytics:** `promo_banner_impression` (mount), `promo_banner_cta_tap` (CTA), `promo_banner_image_error` (local or CDN load failure), `promo_banner_image_retry` (manual recovery, bounded at 2 attempts)

#### Blind Box Event Lifecycle

**Phase 1: Discovery (Pool Layer)**
```
Surface: DiscoverPage / BlindBoxEventCard
User Sees: 
  - Event theme + type
  - Date & time
  - Area / district (not exact venue)
  - Pool threshold progress ("活动池即可触发匹配")
  - PoolForecastStrip atmosphere copy
  - CTA uses pool-join language, not formed-table language
   - Smart Regional Discovery: silent GPS detection → cluster-level proximity sorting
     (same cluster first, adjacent cluster next, then chronology). On first GPS success,
     auto-selects the detected district as the active filter silently (one-time per session).
     Manual filter override via LocationFilterDrawer with 7-day TTL. Auto-relaxation to all-Shenzhen
     view with banner when manual filter is empty. Geo-hint chip shows detected cluster.
  - Drawer accessibility: role="dialog", district tiles are role="button" with
    aria-pressed and descriptive aria-label (includes district name + heat level),
    heat-dot colours driven by SCSS tokens.
  - Empty state (no matching pools): StatusCard with Lovart illustration,
    warm title/description, and a primary action CTA ("去发现活动" or "清除筛选"
    when manual filters are active).
  - Error state (fetch failure): StatusCard with tone='error', Lovart error
    illustration, and a retry CTA.
```

**Phase 2: Pre-Entry Gating**
```
User Action: Tap discovery CTA
If personality test incomplete:
  - DiscoverPage shows TestIncompleteScreen
  - User is routed to /personality-test before join is available
```

**Phase 3: Pre-Join Context + Join Sheet**
```
Entry path:
  DiscoverPage → PreJoinVibeBriefSheet → JoinEventPoolSheet

JoinEventPoolSheet stages:
  1. WhyThisFitsCard + budget / atmosphere step
  2. SocialGoalsStep or PrimaryGoalStep experiment
  3. Smart defaults + optional dinner/bar preferences + BlindPoolTrustExplainer

Optional intercept:
  - ExtendedDataEmptyScreen can appear inside JoinEventPoolSheet when
    user.profileExtendedComplete === false
  - User may skip or go to /profile/edit
```

**Phase 4: Pool Joined / Waiting**
```
Success state:
  - SuccessCelebration says "已成功加入活动池"
  - Copy sets expectation that matching happens later when conditions are met
  - Matching waiting / no-match / reveal ownership lives in MatchingStatusPage
```

**Phase 5: Match Formed**
```
Server ownership:
  - poolRealtimeMatchingService can match on registration or later scheduled scans
  - MatchingStatusPage renders MatchRevealSequenceV2 when a group forms
  - MatchCelebrationOverlay / group-detail follow-up surfaces continue after reveal
```

**Phase 6: Event Day**
```
Event Status: "in_progress" (day of event)
Full Access:
  - Event chat room enabled
  - Full attendee profiles visible
  - Venue address + map
  - Check-in functionality
  - In-Event Icebreaker: Social Icebreaker session available via `/icebreaker/:sessionId`
    — multi-phase group experience (话题卡 → 挑战 → 侦探 → 回顾)
```

**Phase 7: Post-Event**
```
Event Status: "completed"
User Actions:
  - Leave feedback (氛围温度计 + Connection Radar)
  - Optional deep feedback
  - Rate individual connections
```

#### Two-Part Match Scoring System

**Mini-Program Component:** `apps/mini-program/src/pages/matching-status/index.tsx`

**Web Reference:** `apps/user-client/src/components/MatchScoreDisplay.tsx`

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
  - 6-dimensional scoring (active model):
    * Chemistry (28%): Archetype chemistry matrix
    * Interest (28%): Heat-weighted Jaccard similarity (user_interests table)
    * Social Affinity (20%): Life stage + education affinity + hometown (opt-in)
    * Background Diversity (15%): Industry + gender diversity
    * Preference (5%): Event intent / bar preferences (light signal)
    * Language (4%): Common languages (light signal)
  - Range: 75-98%

Visual:
  - 💫 Icon
  - Circular progress indicator
  - "你的个人契合度" label
```

#### AttendeePreviewCard Component *(not part of the active blind-pool entry flow)*

**Mini-Program Component:** `apps/mini-program/src/pages/pool-group-detail/index.tsx`

**Web Reference:** `apps/user-client/src/components/AttendeePreviewCard.tsx`

```typescript
Status:
  - Component file still exists in the repo
  - It should not be documented as a 72-hour blind-pool unlock step
  - Active blind-pool join / waiting / reveal ownership is the pool-first flow above
```

#### Blind Pool Join Flow Enhancements *(PRs #376, #381, #382, #511, #512)*

The active join path now combines a pre-join vibe brief with the join sheet, and the join sheet itself uses the current pool-entry semantics:

| Component | File | Purpose |
|-----------|------|---------|
| `BlindPoolTrustExplainer` | `apps/user-client/src/components/event-pool-registration/BlindPoolTrustExplainer.tsx` | Inline explainer card — explains how the blind pool works and what to expect |
| `PreJoinVibeBriefSheet` | `apps/user-client/src/components/PreJoinVibeBriefSheet.tsx` | Bottom-sheet surfacing pool atmosphere signals and intent context before commit |
| `WhyThisFitsCard` | `apps/user-client/src/components/event-pool-registration/WhyThisFitsCard.tsx` | Personalised "Why this fits you" card with AI-generated reasons (`PreJoinVibeBrief.reasons`) — shown after vibe brief, before join confirmation |
| `PoolForecastStrip` | `apps/user-client/src/components/PoolForecastStrip.tsx` | Deterministic pool-level atmosphere teaser on the discovery card before the user taps in |

Current behavior:
- `TestIncompleteScreen` is a Discover-page pre-entry intercept, not a join-sheet step
- `ExtendedDataEmptyScreen` is a soft in-sheet nudge, not a hard gate
- Join success means **joined the pool**; it does not imply an immediate formed match
- Active CTA copy uses pool-join language such as `确认加入活动池`

#### Matching-State Screen Family *(PRs #387–#391)*

A shared `MatchingStateLayout` abstraction provides a canonical dark-background, slot-based composition (`hero / copy / CTA / footer`) for all matching-state screens. These screens are wired to real trigger conditions and app state — no placeholder timers or mocked transitions.

| Screen | Trigger |
|--------|---------|
| `MatchingWaitingScreen` | Pool is open and fill is in progress (`waiting` → `can_form` → `full` fill-state transitions) |
| `NoMatchScreen` | Pool closed without a match for this user |
| `JoinErrorScreen` | Join attempt failed (network or server error) |
| `TestIncompleteScreen` | User has not completed personality test — shown as a Discover-page pre-entry gate before join is available |
| `ExtendedDataEmptyScreen` | Optional extended-profile nudge shown when `user.profileExtendedComplete === false`; user can skip; primary CTA routes to `/profile/edit` |
| `MatchRevealSequenceV2` | Match formed — active cinematic reveal orchestrator |
| `SurpriseMatchReveal` | Legacy rarity-first reveal overlay preserved in the repo but superseded in the active flow |
| `MatchPointsDisplay` | Post-reveal match score breakdown |

##### Unified Connection Reveal *(Mini-Program, 2026-04-29)*

**Mini-Program Component:** `apps/mini-program/src/pages/matching-status/index.tsx` with `UnifiedRevealCard`

**Web Reference:** Not yet implemented — mini-program is launch-primary

Fuses **group-level chemistry narrative** (`chemistryPayoff`) with **pair-level connection point evidence** (`connectionPointsWithRarity`) into a single emotionally resonant reveal card.

**Data flow:**
```
PoolGroupDetailsResponse (members, interests, archetypes)
  ↓
generateChemistryPayoff() → { headline, chemistryLine, tags }
  ↓
GroupAnalysisResponse (pairExplanations, connectionPointsWithRarity)
  ↓
composeUnifiedReveal() → UnifiedRevealTokens
  ↓
UnifiedRevealCard renders fused narrative
```

**Key behaviors:**
- **Priority rule:** Spotlight pair's `explanation` overrides the generic group `chemistryLine` for the card body. The group line falls back to `subtitle` so the group narrative is not lost.
- **Rarity visualization:** Connection points render as tiered pills (common = grey, rare = purple, epic = gold) using server-provided `connectionPointsWithRarity`.
- **Legacy normalization:** If only `connectionPoints: string[]` is present (cached older data), each entry is normalized to `{ text, rarity: 'common' }`.
- **hasRevealed flag:** Per-group Taro storage (`jj_revealed_${groupId}`) skips overlay stagger animation on revisit.
- **Reduced motion:** `shouldReduceMotion` (from device benchmark + query param + storage) disables all reveal animations; content is shown instantly.

**Source files:**
- `apps/mini-program/src/pages/matching-status/matchingStatusViewModels.ts` — `composeUnifiedReveal()`
- `apps/mini-program/src/pages/matching-status/UnifiedRevealCard.tsx` — presentational component
- `apps/mini-program/src/pages/matching-status/useMatchingStatusController.ts` — `hasRevealed` + timer lifecycle
- `apps/mini-program/src/pages/matching-status/matchingStatusViewModels.test.ts` — 12 regression tests

**Non-goals:**
- No server/API changes — purely client-side view-model fusion
- No new dependencies or animation libraries
- No Canvas-based rendering

**Shared asset:** Canonical background SVG at `apps/user-client/src/assets/matching/shared/matching-bg.svg`; state-specific hero assets in sibling subdirectories.

#### Center-Tab Empty-State Page *(PRs #359, #362, #363)*

`CenterTabEmptyStatePage` — dedicated page for users with no active activity, accessed via the centre nav tab. Background asset prefetch is gated on activity state to avoid unnecessary loading.

#### City Unlock System *(City Unlock v0.1, 2026-05-19)*

**Purpose:** Enable organic, data-driven city expansion by letting users express interest in cities where JoyJoin is not yet live. When a city reaches a threshold of interested users, operations receives a notification to begin venue research.

**User Flow:**
```
Discover page (no city interest) → feed-card CTA (bottom of pool list, with Xiaoyue mascot)
                               ↓
                          CityPickerSheet (search + hot-city grid + confirm)
                               ↓
                          POST /api/cities/interest → Toast success
                               ↓
                          pages/city-unlock/index (progress + share + other cities)
```
Note: The gentle banner (CityUnlockBanner) was removed in 2026-06-10. GPS auto-filter handles Shenzhen district detection silently, and the feed-card CTA is the sole entry point for city interest.

**Threshold & State Machine:**
| Status | Meaning | Transition |
|---|---|---|
| `collecting` | Gathering interest | Default; auto-transition at threshold |
| `researching` | Venue research triggered | At 50 interested users → WeCom ops notification |
| `launching` | Event planning in progress | Manual ops decision |
| `live` | Events available in city | Manual ops decision |

**Key Pages/Components:**
- `pages/city-unlock/index` — Progress page with Xiaoyue mascot, threshold bar, share CTA, activity feed, other-city tease
- `components/discover/CityUnlockFeedCard` — Bottom-of-feed CTA card with Xiaoyue mascot (sole entry point for city interest, 2026-06-10)
- `components/discover/CityPickerSheet` — Bottom sheet with Xiaoyue mascot header, search + hot-city grid + full city list, scroll-to-selected, analytics-instrumented, confirm
- ~~`components/discover/CityUnlockBanner`~~ — Removed 2026-06-10; replaced by GPS auto-filter for Shenzhen + CityUnlockFeedCard for other cities

**API Endpoints:**
- `POST /api/cities/interest` — Register interest (atomic increment)
- `GET /api/cities/progress` — Per-city progress list
- `GET /api/cities/my-interests` — Current user's city interests
- `DELETE /api/cities/interest/:city` — Remove interest (atomic decrement)
- `GET /api/admin/cities/unlock-report` — Admin ops report with 7-day signup stats

**Ops Integration:** WeCom group bot notification (`notifyCityUnlockThreshold`) fires when `collecting` → `researching` transition occurs. Silent degradation if `WECOM_BOT_KEY` is unset.

**Data Model:** `user_city_interests` (user+city unique, source-tracked) + `city_unlock_progress` (per-city counters + status machine).

---

### 1.5 权益方案 & Payment System

**Canonical (Mini-Program):** `apps/mini-program/src/pages/blind-box-payment/index.tsx`

**Web Reference:** `apps/user-client/src/pages/BlindBoxPaymentPage.tsx`

> **Note on terminology:** User-facing copy uses `权益` / `权益方案`. Internal technical names (`subscription`, `subscriptions` table) remain unchanged. See §Product Canon for the full compliance terminology table.

#### 权益方案 Tiers

| 方案 | Price | Duration | Benefits |
|------|-------|----------|----------|
| **月度权益方案** | ¥98 | 30 days | Unlimited blind box events, priority matching |
| **季度权益方案** | ¥294 | 90 days | 15% discount, exclusive quarterly events |
| **单次票** | ¥148 | Per event | No commitment, standard price |

#### Payment Integration - WeChat Pay (v3 Signed API)

**Service Files:**
- `apps/server/src/routes/domains/payments.ts` — payment route handler (domain router)
- `apps/server/src/paymentService.ts` — WeChat Pay v3 JSAPI (primary) + H5 (reference), verified webhook handling, kill switch

> **Payment Kill Switch:** The server exposes a `paymentsEnabled` feature flag. When disabled (e.g., during incident mitigation or pre-launch hold), all payment creation requests are rejected with a clear error before any WeChat API call is made. This is the primary launch-safety lever for payment flows.

**Payment Flow:**
```
1. User selects 权益方案
   ↓
2. Frontend POST /api/payments/create
   {
     amount: 9800, // cents
     type: "subscription",
     subscriptionTier: "monthly"
   }
   ↓
3. Server checks paymentsEnabled flag (kill switch) — rejects if disabled
   ↓
4. Backend creates payment record (status: "pending")
   ↓
5. Server calls WeChat Pay v3 API:
   - **Mini-Program (primary):** `POST /api/payments/miniprogram/create` → JSAPI (`/v3/pay/transactions/jsapi`) → returns `prepay_id` → client calls `Taro.requestPayment`
   - **Web (reference):** `POST /api/payments/create` → H5 (`/v3/pay/transactions/h5`) → returns `h5_url` → browser redirect
   - Request is signed with `WECHATPAY2-SHA256-RSA2048` using the merchant RSA private key
   - The API v3 key is used for webhook resource decryption (AES-GCM), not HMAC request signing
   ↓
6. User completes payment in WeChat
   ↓
7. WeChat webhook POST /api/webhooks/wechat-pay
   ↓
8. Server verifies v3 webhook signature before processing
   (rejects requests with invalid or missing signatures)
   ↓
9. Backend updates:
   - payment.status = "completed"
   - subscription.status = "active"
   - subscription.startDate = now
   - subscription.endDate = now + 30 days
   ↓
10. WebSocket notification to user
    "支付成功！权益已激活"
```

> **Webhook security:** The server performs cryptographic signature verification on every incoming WeChat Pay webhook notification using the v3 protocol, then decrypts the resource payload with the API v3 key (AES-GCM). Notifications that fail verification are rejected before any state change occurs. Success handling is idempotent, so duplicate notifications are safe.

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
    await notifyUser(sub.userId, '您的权益已过期');
  }
}
```

#### Coupon System

**File:** `apps/admin-client/src/pages/admin/AdminCouponsPage.tsx`

**Coupon Types:**
- **Percentage Discount:** 20% off
- **Fixed Amount:** ¥30 off
- **Free Trial:** 7-day free 权益体验

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

**Canonical (Mini-Program):** `apps/mini-program/src/pages/event-coordination/index.tsx`

**Web Reference:** `apps/user-client/src/pages/EventCoordinationPage.tsx`

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

**File:** `apps/admin-client/src/pages/admin/AdminModerationPage.tsx`

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

**File:** `apps/admin-client/src/pages/admin/AdminInteractionLogsPage.tsx`

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

**Route:** `/icebreaker/:sessionId` (mini-program), `/icebreaker/:sessionId` (web reference)  
**Canonical Component:** `apps/mini-program/src/pages/icebreaker-session/index.tsx`  
**Web Reference:** `apps/user-client/src/pages/IcebreakerSessionPage.tsx` (if exists)  
**Status:** ✅ Primary in-event flow

The Social Icebreaker is the **core in-event facilitation tool** for matched JoyJoin groups. It replaces any standalone game browsers as the primary icebreaking experience.

#### Server-Driven Phase Ownership

Phase progression is **server-authoritative**. The server determines the current phase for each session and pushes phase transitions to all participants in real time. Clients do not compute or advance phases locally — they render whatever the server declares as the current state. This means:
- All participants see the same phase simultaneously
- The HOST triggers phase advances via server calls; the server then broadcasts the update
- Phase configuration (e.g., which phases are active, their duration) is controlled server-side via `apps/server/src/socialIcebreakerPhaseConfig.ts`

#### Phases (MVP)

| Phase | CN Name | Duration | Mechanic |
|-------|---------|----------|----------|
| `warmup` | 🌅 话题卡 | 20 min | Mood-filtered conversation topics |
| `micro_challenge` | ⚡ 挑战 | 15 min | Group challenge, tap "done" |
| `lie_detective` | 🕵️ 侦探 | 25 min | Two Truths One Lie — AI-generated |
| `recap` | ✨ 回顾 | 5 min | AI-generated session summary |

> **Lie Detective secrecy:** The `isLie` truth-marker is stored server-side only and is never included in any client session payload (persisted or broadcast). When a target is revealed, the server fetches the ground-truth from its separate store and returns only a derived `lieIndex` from the vote endpoint. See `apps/server/src/routes/socialIcebreaker.ts` for the sanitization boundary.

#### Entry
- Available on event day when event status is `in_progress`
- Accessible via BottomNav "去参与" button or from `PoolGroupDetailPage`
- First user to open becomes HOST and drives phase progression

#### Persistence / Recovery / Expiry

- **Session persistence:** All session state (phase, participants, lie-truths) is stored in PostgreSQL via `apps/server/src/lib/socialIcebreakerStore.ts`. Sessions survive server restarts.
- **Rejoin:** A participant who closes and reopens the session is restored to the current live state without data loss. The server rehydrates their view from the persisted record.
- **Session expiry:** Sessions are not retained indefinitely — they are scoped to the event lifecycle. Expired sessions return a terminal state that prevents further interaction.

#### v2 Phase Rollout *(PR #370)*

Server-driven phase rollout configuration was added for Social Icebreaker v2. Beta phase scaffolding exists for future phases beyond MVP (the four current phases remain the active set). New phases can be toggled via server configuration without a client deployment.

#### Supporting Layers (Optional)
- **AI Card Game** (`/icebreaker-game`): Optional deep-dive card experience accessible from within the warmup phase
- **Toolkit** (legacy): Pre-event game browser — retained for backward compatibility, not featured as primary CTA

#### Technical Reference
Full system documentation: `docs/icebreaker-system.md`

Active server files:
- `apps/server/src/routes/socialIcebreaker.ts` — route handlers
- `apps/server/src/socialIcebreakerAIService.ts` — AI-generated content
- `apps/server/src/lib/socialIcebreakerStore.ts` — PostgreSQL session persistence
- `apps/server/src/socialIcebreakerPhaseConfig.ts` — phase configuration

---

### 1.8 Feedback System (氛围温度计)

> **Note:** Previously numbered 1.7. Renumbered to 1.8 to accommodate the new §1.7 In-Event Social Experience section.

**Canonical (Mini-Program):** `apps/mini-program/src/pages/event-feedback/index.tsx`

**Web Reference:** `apps/user-client/src/pages/EventFeedbackFlow.tsx`, `apps/user-client/src/pages/DeepFeedbackFlow.tsx`

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

**Mini-Program Component:** `apps/mini-program/src/pages/connections/index.tsx`

**Web Reference:** `apps/user-client/src/components/feedback/ConnectionRadar.tsx`

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

**Mini-Program Component:** `apps/mini-program/src/pages/event-feedback/index.tsx`

**Web Reference:** `apps/user-client/src/components/feedback/SelectConnectionsStep.tsx`

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

**Mini-Program Component:** `apps/mini-program/src/pages/event-feedback/index.tsx`

**Web Reference:** `apps/user-client/src/components/feedback/TraitTagsWall.tsx`

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

**Canonical (Mini-Program):** `apps/mini-program/src/pages/profile/index.tsx`, `apps/mini-program/src/pages/profile-linked/edit-profile/index.tsx`

**Web Reference:** `apps/user-client/src/pages/ProfilePage.tsx`, `apps/user-client/src/pages/Edit*.tsx`

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

**Canonical (Mini-Program):** `apps/mini-program/src/app.ts` (app bootstrap + tab-bar config), `apps/mini-program/src/native-custom-tab-bar/` (custom tab bar)

**Web Reference:** `apps/user-client/src/App.tsx`, `apps/user-client/src/components/BottomNav.tsx`

#### Bottom Navigation Bar (5 Tabs)

> **Current canonical navigation** (see §Product Canon for authoritative tab names).

```
1. 🧭 发现 (Discover) → /
   - Recommended events and pool registrations
   - Browse blind box events

2. 👣 足迹 (My Journey) → /my-journey
   - Attended events and social timeline
   - Personal social journey and memories

3. ⭕ [Core Action Icon] (smart-routed)
   - Primary action: routes contextually to today's event,
     venue reveal, match-in-progress, or discover
   - No static text label; dynamic label reflects current state

4. 🔗 连接 (Connections) → /chats
   - ⚠️ Old label was 圈子 — do not use 圈子 for this tab
   - Structured mutual connections after post-event selection
   - Optional per-connection feedback (reasons + next-step)

5. 👤 我的 (Profile) → /profile
   - User profile, settings, 权益状态
```

- Tab-switch performance: native custom tab bar uses a shared translating active pill (GPU `transform`, 180ms tap debounce) and auth hydration from local storage so returning users do not see a loading flash on every tab switch.

> ⚠️ **Legacy reference**: The old PRD documented a different nav (`首页 / 发现 / 我的活动 / 消息 / 我的`). That structure is deprecated. The tab formerly labelled `圈子` is now `连接`.

#### Protected Routes

```typescript
// Requires authentication (WeChat session)
// Auth policy: apps/server/src/auth/policy.ts

Protected Routes:
  - /discover
  - /events
  - /events/:id
  - /blind-box/:id
  - /blind-box/:id/payment
  - /chats
  - /chats/event/:id
  - /profile
  - /personality-test/results
  - /feedback/:eventId
  
Public Routes:
  - /
  - /login
  - /personality-test (anonymous — taken before registration)
  - /personality-test/auth-gate (WeChat auth handoff page)
  
Dev-only Routes (non-production only):
  - ⚠️ Testing quick-pass and mock-login surfaces on the auth-gate and results pages are only rendered in non-production builds. See §1.1 auth-gate notes and `apps/server/src/auth/policy.ts`.
```

> **Note:** `/register` (phone registration) is a legacy fallback on `/login`. The primary new-user path is the personality-test → WeChat-login flow. `/chats/direct/:threadId` has been removed (DM system removed). The `连接` tab at `/connections` shows structured post-event connections. Event coordination is at `/event-coordination/:groupId`.

> **Note on admin routes:** All `/admin/*` routes in the user client redirect to `https://admin.joyjoinapp.com`. The admin portal is a separate deployment (`apps/admin-client`).

---

### 1.10 Connection Feedback Flow

> **This section documents the chosen product decision for the structured-connection model.**

#### Design Philosophy

JoyJoin uses a **two-phase connection model** that separates commitment (who) from meaning (why):

| Phase | Location | What it captures | Required? |
|-------|----------|-----------------|-----------|
| **Post-event flow** | `EventFeedbackFlow.tsx` → `SelectConnectionsStep` | **Who** the user wants to continue with (multi-select) | Optional (skippable) |
| **连接 tab** | `ChatsPage.tsx` per-connection card | **Why** the connection stood out + preferred next step | Optional enrichment |

#### Post-Event Flow (SelectConnectionsStep)

- Multi-select attendees — no per-person reasons required at this stage
- Privacy-protected: peer doesn't know unless they reciprocate
- Mutual match → WeChat ID exchanged

#### 连接 Tab — Enrichment Feedback

After a mutual connection is formed, the `连接` tab shows connection cards. Each card has an optional expandable panel for:

**Connection Reasons** (multi-select, max 3):
- `聊天很自然`
- `价值观有共鸣`
- `兴趣很投缘`
- `幽默感很合拍`
- `相处节奏很舒服`
- `有被理解的感觉`
- `当下状态很合适`
- `想继续了解 Ta`
- `想再一起参加活动`
- `其他（可补充）` — triggers optional free text

**Next-Step Preference** (single-select):
- `微信聊聊`
- `约喝咖啡`
- `下次一起参加活动`
- `保持关注，随缘`

#### Storage

Feedback is stored per-user-per-connection in the `connections` table:
- `userAConnectionReasons` / `userBConnectionReasons` (text array)
- `userANextStepPreference` / `userBNextStepPreference` (varchar)

This is **enrichment data**, not gating. Connections work without feedback; feedback adds product intelligence and helps the user reflect on the connection.

#### API

- `GET /api/my-connections` — list user's mutual connections with peer info and saved feedback
- `PATCH /api/connections/:id/feedback` — save optional reasons + next-step preference

---

## 🖥️ Admin Portal Features

> **File path note:** All admin page source files live under `apps/admin-client/src/pages/admin/`. References in this section to `client/src/pages/admin/` are legacy path style and should be treated as `apps/admin-client/src/pages/admin/` in the current monorepo.

**Access:** `https://joyjoin.app/admin` (Desktop-optimized)

**Authentication:** 
- Admin users have `is_admin: true` in database
- Middleware: `requireAdmin` on all `/api/admin/*` routes
- Admin access provisioned via `npm run set-admin` CLI (see `DEVELOPER_QUICK_REFERENCE.md`)

---

### 2.1 Admin Dashboard

**File:** `apps/admin-client/src/pages/admin/AdminDashboard.tsx`

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

**File:** `apps/admin-client/src/pages/admin/AdminUsersPage.tsx`

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
- Archetype: All | 社牛柯基 | 小太阳鸡 | 夸夸仓鼠 | ... (12 total)
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

**File:** `apps/admin-client/src/pages/admin/AdminSubscriptionsPage.tsx`

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

**File:** `apps/admin-client/src/pages/admin/AdminFinancePage.tsx`

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

**Admin UI:** `apps/admin-client/src/pages/admin/AdminVenuesPage.tsx`  
**Assignment Service:** `apps/server/src/venueAssignmentService.ts`  
**Matching Service:** `apps/server/src/venueMatchingService.ts`  
**Repository:** `apps/server/src/repositories/venuesRepo.ts`

#### Venue Database

**Purpose:** Admin-curated catalog of restaurants, bars, cafes, and homebars for automatic group-to-venue assignment after pool matching.

**Venue Types:** `restaurant`, `bar`, `homebar`, `cafe`

**Key Schema Fields:**
```sql
venues
  id UUID PRIMARY KEY
  name TEXT NOT NULL                -- internal identifier / fallback display name
  brand_name TEXT                   -- actual restaurant/bar brand name shown to users and admins
  venue_type TEXT NOT NULL          -- restaurant | bar | homebar | cafe
  address TEXT NOT NULL
  city TEXT NOT NULL                -- 深圳, 香港
  area TEXT NOT NULL                -- district: 南山区, 中环, etc.
  
  -- Matching fields
  tags TEXT[]                       -- atmosphere: cozy, lively, upscale
  cuisines TEXT[]                   -- 中餐, 川菜, 粤菜, 火锅, 西餐, 日料
  price_range TEXT                  -- "150以下", "150-200", "200-300"
  budget_categories TEXT[]          -- standardized ranges for matching
  decor_style TEXT[]                -- 轻奢现代风, 绿植花园风, etc.
  taste_intensity TEXT[]            -- 爱吃辣, 不辣/清淡为主
  bar_themes TEXT[]                 -- 精酿, 清吧, 私密调酒·Homebar
  alcohol_options TEXT[]            -- 可以喝酒, 微醺就好, 无酒精饮品
  vibe_descriptor TEXT              -- editorial atmosphere description
  
  -- Capacity
  capacity INTEGER DEFAULT 1        -- max concurrent events at same time
  seating_capacity INTEGER DEFAULT 1 -- max people per event
  
  -- Partnership
  partner_status TEXT DEFAULT 'active'  -- active | paused | ended
  commission_rate INTEGER DEFAULT 20    -- percentage
  contact_person TEXT
  contact_phone TEXT
  is_active BOOLEAN DEFAULT true
```

**Related Tables:**
- `venue_time_slots` — weekly recurring or specific-date availability windows
- `venue_time_slot_bookings` — confirmed/cancelled bookings per slot per date
- `venue_deals` — partner discount offers (percentage, fixed, gift)

#### Admin Interface

**List View:**
- Cards with venue brand name (or internal name as fallback), city/district, type, partner status
- Filter by city, type, partner status
- Search by name or address
- Data quality summary (missing fields, duplicates)

**Create / Edit:**
- Basic info: name (internal identifier), brandName (user-facing brand), type, address, city, district, coordinates (Tencent Maps picker)
- Matching tags: cuisines, atmosphere tags, decor style, taste intensity
- Budget categories: multi-select price ranges per venue type
- Capacity: `seatingCapacity` (people per event) + `maxConcurrentEvents` (simultaneous events)
- Partner info: contact, commission rate, status
- Bar-specific fields: themes, alcohol options, vibe descriptor

**Time Slot Management:**
- Weekly recurring slots (dayOfWeek + startTime/endTime)
- Specific date overrides
- `maxConcurrentEvents` per slot
- Active/inactive toggle per slot

#### Automatic Venue Assignment

After pool matching completes, venues are assigned to matched groups automatically (unless kill-switched).

**Kill Switch:**
```bash
VENUE_ASSIGNMENT_ENABLED=false   # skips assignment, all groups stay "pending"
```

**Assignment Flow:**
1. Filter active venues by city + district + venue type (restaurant/cafe for 饭局, bar/homebar for 酒局)
2. Check time-slot availability at event datetime (respects `maxConcurrentEvents` + existing bookings)
3. Score each venue for each group (0-100):
   - **Budget Match (40 pts)** — hard fail if no overlap with group consensus budgets
   - **Cuisine Match (30 pts)** — overlap between group preferences and venue cuisines
   - **Capacity Match (20 pts)** — `seatingCapacity >= groupSize`
   - **Location (10 pts)** — same city/district
4. Pick highest-scoring venue per group
5. Persist booking + update `eventPoolGroups` atomically in a transaction

**Idempotency & Safety:**
- Groups with existing bookings are skipped
- Save-time concurrency re-check prevents race conditions
- In-memory slot usage tracker prevents same-pool overbooking
- Unassignment reasons: `no_available_slots`, `budget_mismatch`, `capacity_insufficient`, `no_suitable_venue`, `slot_fully_booked_at_save`

**Operational Endpoints:**
```typescript
GET  /api/admin/venue-assignment/unassigned          -- list unassigned groups
POST /api/admin/venue-assignment/groups/:id/migrate  -- atomic venue migration
```

**Emergency Migration:**
- Cancels existing `venueTimeSlotBooking` → creates new booking → updates group
- Wrapped in DB transaction
- Emits `VENUE_MIGRATED` admin audit log

**Group Status Tracking:**
```sql
event_pool_groups
  venue_assignment_status   -- pending | assigned | unassigned | manual_override
  venue_assignment_reason   -- null or reason code
  venue_id                  -- assigned venue
  venue_name                -- denormalized for display
  venue_address             -- denormalized for display
```

---

### 2.5 Event Template System

**File:** `apps/admin-client/src/pages/admin/AdminEventTemplatesPage.tsx`

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

**File:** `apps/admin-client/src/pages/admin/AdminEventsPage.tsx`

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

**File:** `apps/admin-client/src/pages/admin/AdminMatchingLabPage.tsx`

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
   - Forms groups of 4-6
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
  "社牛柯基": {
    "社牛柯基": 70, "小太阳鸡": 88, "夸夸仓鼠": 90, "寻宝狐": 85,
    "机灵海豚": 82, "人脉蛛": 83, "树洞考拉": 92, "脑洞章鱼": 86,
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

**File:** `apps/admin-client/src/pages/admin/AdminContentPage.tsx`

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

**File:** `apps/admin-client/src/pages/admin/AdminNotificationsPage.tsx`

#### Notification Types

**System Notifications:**
1. **Event Reminders**
   - 72h before: "您的活动即将开始，参与者信息已解锁"
   - 24h before: "明天的活动别忘了！"
   - 2h before: "活动即将在2小时后开始"

2. **权益状态提醒**
   - 7 days before expiry: "您的权益即将到期"
   - On expiry: "权益已到期，续期享85折优惠"

3. **Social Updates**
   - Event chat mention
   - New mutual connection

**Admin Broadcast Notifications:**

**Interface:**

```typescript
Create Notification:

1. Select Audience:
   - 全部用户 (All users)
   - 活跃权益用户 (Active subscribers)
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

**File:** `apps/admin-client/src/pages/admin/AdminModerationPage.tsx`, `apps/admin-client/src/pages/admin/AdminReportsPage.tsx`

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

**File:** `apps/admin-client/src/pages/admin/AdminReportsPage.tsx`

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

**File:** `apps/admin-client/src/pages/admin/AdminDataInsightsPage.tsx`

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
> Production system uses current 12 archetypes (社牛柯基, 小太阳鸡, 夸夸仓鼠, etc.)

```typescript
1. Overall Distribution
   Pie Chart (example data — production system uses current 12 archetypes):
   - 树洞考拉: 18.5%
   - 好奇猫头鹰: 16.2%
   - 夸夸仓鼠: 14.8%
   - 社牛柯基: 13.1%
   - 小太阳鸡: 12.3%
   - 寻宝狐: 10.7%
   - 机灵海豚: 9.4%
   - 其他 (4 archetypes): 5.0%
   
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

**File:** `apps/admin-client/src/pages/admin/AdminFeedbackPage.tsx`

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

**Backend:** `apps/server/src/wsService.ts`

**Mini-Program Client:** `apps/mini-program/src/lib/api.ts` (WebSocket integration via Taro)

**Web Reference:** `apps/user-client/src/hooks/useWebSocket.ts`

#### Architecture

**Backend WebSocket Service:**

```typescript
// apps/server/src/wsService.ts
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
// apps/user-client/src/hooks/useWebSocket.ts
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

**Mini-Program Frontend (Launch-Primary):**
- Taro 4.2 + React 18 + TypeScript
- Taro CLI (build tool)
- Sass (styling)
- WeChat-native APIs (`wx.login`, `Taro.requestPayment`, etc.)

**Web Frontend (Reference / Sandbox Only):**
- React 18 + TypeScript
- Vite (build tool)
- Wouter (routing)
- TanStack Query v5 (server state)
- Radix UI + shadcn/ui (components)
- Tailwind CSS (styling)
- Recharts (data visualization)
- Framer Motion (animations)

> **Platform Policy:** The WeChat Mini Program is the launch-primary and only shipping user-facing client. The web app (`apps/user-client`) exists as a development sandbox and parity reference. Cross-platform coordination rules are in `docs/reference/PLATFORM_COORDINATION.md`.

**Backend:**
- Node.js + Express.js
- TypeScript
- PostgreSQL (Dockerized on CVM)
- Drizzle ORM
- WebSocket (ws library)
- Express Session (authentication)

**Authentication:**
- WeChat Mini Program (primary): `Taro.login()` → `jscode2session` → `POST /api/auth/wechat/login`
- WeChat Official Account OAuth2 web flow (browser fallback, reference-only)
- Phone number + SMS verification (legacy fallback, dev-only)
- PostgreSQL session store (7-day persistence)

> **Note:** The canonical auth flow for launch is the mini-program `wx.login` path. The browser OAuth2 flow in `apps/user-client` is maintained for development reference and non-production environments only.

**Payment:**
- WeChat Pay v3 JSAPI (primary, mini-program): `Taro.requestPayment` with `timeStamp`, `nonceStr`, `package`, `signType`, `paySign` — requests signed with `WECHATPAY2-SHA256-RSA2048`; API v3 key used for notification decryption/validation
- WeChat Pay v3 H5 (secondary, browser reference): redirect-based payment flow for web sandbox
- Verified webhook handling (v3 signature validation before any state change)
- Idempotency handling for duplicate webhook delivery
- Payment kill switch (`paymentsEnabled` flag) — disables payment creation without code deployment
- Pending-order verification on mini-program app resume (`paymentVerificationStatus.ts`)

> **Note:** The mini-program uses the native JSAPI flow (`POST /api/payments/miniprogram/create` → `Taro.requestPayment`). The H5 flow (`/api/payments/create` → redirect) is for the web reference surface only.

**Real-Time:**
- WebSocket connections
- Event-based message broadcasting
- Auto-reconnection on disconnect

**Observability & Operational Readiness** *(PRs #397, #402)*
- Structured JSON logging via `apps/server/src/lib/logger.ts`; every request carries a unique `requestId` for log correlation
- Prometheus-compatible metrics endpoint (`/api/metrics`) — request rate, latency, memory, CPU, and domain-specific counters
- Health check: `GET /api/health` (liveness) and `GET /api/readyz` (readiness — verifies DB connectivity before accepting traffic; `/readyz` redirects here)
- Admin action audit log: `apps/server/src/lib/adminAuditLogger.ts` — every sensitive admin action emits a structured audit event
- AI call trace log: `apps/server/src/lib/aiTraceLogger.ts` — every AI invocation emits a single-line `[AITrace] {json}` to stdout
- Full observability setup: `docs/systems/observability.md`; incident runbooks: `docs/runbooks/observability.md`

---

### 3.1b Server Domain Architecture *(PRs #422, #425, #427, #429)*

The server uses a **route-domain modularization model** that all contributors should understand:

| Layer | Path | Role |
|-------|------|------|
| Composition root | `apps/server/src/routes.ts` | Mounts all domain routers; entry point for route registration |
| Domain routers | `apps/server/src/routes/domains/` | Each domain owns its routes: `auth`, `onboarding`, `assessment`, `payments`, `analytics`, `admin`, `icebreaker` |
| Repositories | `apps/server/src/repositories/` | Active persistence layer — new data access logic goes here |
| Compatibility facade | `apps/server/src/storage.ts` | Legacy composed facade from repositories; do not expand with new logic |
| Cross-cutting libs | `apps/server/src/lib/` | Logger, aiTraceLogger, adminAuditLogger, socialIcebreakerStore |

**Key rules:**
- New API routes belong in a domain router under `routes/domains/`, not directly in `routes.ts`
- New persistence logic belongs in a repository under `repositories/`, not in `storage.ts`
- Cross-cutting utilities (logging, audit, session store) belong in `lib/`

For full details: `apps/server/src/README.md` and `docs/architecture/current-state.md`

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
20. **event_pool_groups** - Matched groups (v1.1: added `communicationBalance` stored as `energy_balance`, `temperatureLevel`)
21. **matching_thresholds** - Configurable matching parameters (NEW v1.1)
22. **pool_matching_logs** - Matching decision history (NEW v1.1)
23. **invitations** - Event-specific invitation records (expiresAt, invitationType — linked to pool registrations)
24. **invitation_uses** - Invitation reward tracking (dedup-guarded, linked to invitations by UUID)
25. **referral_codes** - Permanent user-level referral codes (one per user, no expiry)
26. **referral_conversions** - Referral conversion tracking (who was referred by whom, dedup-guarded)
27. **user_coupons** - User coupon assignments (NEW v1.1)

**Full schema:** See `packages/shared/src/schema.ts` (Drizzle ORM — canonical source of truth for all tables)

---

### 3.3 API Endpoints Summary

**Public / Operational Routes:**
- `GET /api/health` - Liveness probe (always 200 if server is running)
- `GET /api/readyz` - Readiness probe (checks DB connectivity before accepting traffic; `/readyz` redirects here)
- `GET /api/metrics` - Prometheus-compatible metrics endpoint

**Public Routes:**
- `POST /api/phone/register` - Send SMS verification (legacy fallback)
- `POST /api/phone/verify` - Verify code + create session (legacy fallback)
- `POST /api/phone/login` - Existing user login (legacy fallback)
- `POST /api/auth/wechat/login-with-test` - WeChat login + save personality test
- `POST /api/auth/wechat/login` - WeChat returning-user login
- `GET /api/auth/wechat/oauth/start` - Browser OAuth2 flow start
- `GET /api/auth/wechat/oauth/callback` - Browser OAuth2 callback

**User Routes** (requires authentication):
- `GET /api/auth/user` - Get current user (including `nextStep` for onboarding routing)
- `POST /api/assessment/v4/start` - Start or resume adaptive personality assessment
- `POST /api/assessment/v4/{sessionId}/answer` - Submit test answer (idempotent, auto-completes when done)
- `PUT /api/assessment/v4/{sessionId}/answer` - Re-answer a previous question (back-review)
- `POST /api/assessment/v4/{sessionId}/skip` - Skip current question (max 3 per session)
- `GET /api/personality-test/stats` - Get archetype distribution (legacy path, active)
- `GET /api/onboarding/profile-tagline` - Get AI-generated profile tagline
- `POST /api/profile-review/complete` - Mark profile review as seen
- `GET /api/events` - List events
- `GET /api/events/:id` - Event details
- `POST /api/events/:id/register` - Register for event
- `POST /api/payments/create` - Create payment (subject to `paymentsEnabled` kill switch)
- `POST /api/payments/miniprogram/create` - Create mini-program JSAPI payment intent
- `GET /api/payments/ritual-context` - Payment Ritual V2 context (real DB-backed community stats, plans, coupons; requires auth)
- `POST /api/webhooks/wechat-pay` - WeChat Pay v3 webhook (verified before processing)
- `POST /api/coupons/validate` - Validate coupon code
- `GET /api/chats/:eventId` - Get event chat messages
- `POST /api/analytics/payment` - Payment Ritual V2 A/B test funnel instrumentation (fire-and-forget)
- `POST /api/chats/:eventId/message` - Send message
- `POST /api/chat/report` - Report message
- `POST /api/feedback/submit` - Submit event feedback
- `PATCH /api/profile` - Update profile

**Admin Routes** (requires admin role):
- `GET /api/admin/stats` - Dashboard metrics
- `GET /api/admin/users` - List/search/filter users (paginated; supports search, city, archetype, intent, completeness)
- `GET /api/admin/users/:id` - User summary
- `GET /api/admin/users/:id/detail` - User detail sheet (profile completeness, interests, registrations)
- `PATCH /api/admin/users/:id/ban` - Ban user
- `PATCH /api/admin/users/:id/unban` - Unban user
- `DELETE /api/admin/users/:id/data` - Delete all user data (operator+)
- `GET /api/admin/subscriptions` - List subscriptions
- `POST /api/admin/subscriptions/grant` - Grant free subscription
- `GET /api/admin/payments` - Payment history
- `POST /api/admin/payments/refund` - Issue refund
- `GET /api/admin/venues` - List venues
- `POST /api/admin/venues` - Create venue
- `GET /api/admin/smart-venues` - Filter venues with optional date-level availability
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
- `GET /api/admin/interaction-logs` - Query interaction/connection logs
- `GET /api/admin/contents` - CMS content list
- `POST /api/admin/contents` - Create content
- `POST /api/admin/notifications/broadcast` - Send notification
- `GET /api/admin/data-insights` - Analytics data
- `POST /api/admin/matching/test` - Test matching algorithm
- `PATCH /api/admin/matching/weights` - Update weights
- `GET /api/admin/matching-thresholds` - Get pool matching thresholds
- `PUT /api/admin/matching-thresholds/:poolId` - Update thresholds
- `POST /api/admin/trigger-matching/:poolId` - Manually trigger matching
- `GET /api/admin/matching-logs` - Get matching decision history

**Route architecture:** `apps/server/src/routes.ts` is the composition root that mounts domain routers from `apps/server/src/routes/domains/` (auth, onboarding, assessment, analytics, admin, payments, icebreaker). See `apps/server/src/README.md` for the active domain ownership map.

---

### 3.4 Matching Algorithm Deep Dive

> **Canonical reference:** `DEVELOPER_QUICK_REFERENCE.md` § *Event Pool Matching System* and `docs/systems/MATCHING_ALGORITHM_REFERENCE.md`.  
> **Implementation authority:** `apps/server/src/poolMatchingService.ts`.

The active matching system uses a **6-dimensional pair score** (7D when `ENABLE_SEMANTIC_SIMILARITY=true`):

| Dimension | Weight | Reads from |
|-----------|--------|-----------|
| Chemistry | 28% | 12×12 archetype chemistry matrix (`archetypeChemistry.ts`) |
| Interest | 28% | Heat-weighted Jaccard over `user_interests` |
| Social Affinity | 20% | `workMode` (life stage) + `educationLevel` + `hometownRegionCity` (opt-in) |
| Background Diversity | 15% | Industry niche + gender diversity |
| Preference | 5% | Event intent / venue preferences |
| Language | 4% | `preferredLanguages` |

**Education affinity** is an ordinal-distance signal (same/nearby levels score higher — **not** a diversity reward). The matching ordinals are:

| Level | Ordinal |
|-------|---------|
| 高中及以下 | 0 |
| 中专 / 大专 | 1 (same tier) |
| 本科 | 2 |
| 硕士 | 3 |
| 博士 | 4 |

Distance → score: same = 100, adjacent = 75, two steps = 50, ≥3 steps = 25.

**Group overall score:** `avgPairScore × 0.60 + groupDiversity × 0.25 + energyBalance × 0.15`

Hard constraints (budget, gender, industry, education, age) are applied as L1 filters **before** scoring.

> **Interest Signal Boundary (PR #379):** `user_interest_signals` are **not** part of deterministic pair scoring. They feed AI enrichment only (match explanations, icebreaker topics). This boundary is enforced by `apps/server/src/__tests__/interestSignalBoundary.test.ts`.

For full formulas, weight tables, MatcherV2 specifics, semantic-similarity details, and debug guidance — see `docs/systems/MATCHING_ALGORITHM_REFERENCE.md`.

---

### 3.5 Temperature Concept System 🌡️

**NEW in v1.1** (Nov 20, 2025)

**Files:** `apps/server/src/archetypeChemistry.ts`, `packages/shared/src/schema.ts`, `packages/shared/src/wsEvents.ts`

**Purpose:** Provide intuitive visual feedback on match quality using dual-temperature metaphor

#### Dual-Temperature System

**1. Social Energy Temperature (社交能量温度)**

Maps the 12 V4 personality archetypes to energy levels (0-100 scale) to prevent unbalanced groups.

> ⚠️ The example `ARCHETYPE_ENERGY` values below use illustrative names for readability. The actual implementation in `apps/server/src/archetypeChemistry.ts` uses the current 12 canonical V4 archetypes (社牛柯基, 小太阳鸡, 夸夸仓鼠, 寻宝狐, 机灵海豚, 人脉蛛, 树洞考拉, 脑洞章鱼, 好奇猫头鹰, 靠谱大象, 慢热龟, 小透明猫).

```typescript
// Energy levels for current 12 V4 archetypes (from archetypeChemistry.ts)
// High Energy (78-95): 社牛柯基 (95), 小太阳鸡 (88), 夸夸仓鼠 (82)
// Medium Energy (48-78): 寻宝狐 (78), 机灵海豚 (65), 人脉蛛 (60)
// Low-Medium (40-52): 树洞考拉 (48), 脑洞章鱼 (52), 好奇猫头鹰 (40)
// Low (20-40): 靠谱大象 (40), 慢热龟 (30), 小透明猫 (20)
```

**Communication Balance Calculation** (replaced former energy balance):

```typescript
// Average pairwise language score across all member pairs
function calculateCommunicationBalance(group) {
  let total = 0, pairs = 0;
  for (let i = 0; i < group.length; i++) {
    for (let j = i + 1; j < group.length; j++) {
      total += calculateLanguageScore(group[i], group[j]);
      pairs++;
    }
  }
  return pairs > 0 ? Math.round(total / pairs) : 50;
}
```

**Why This Matters:**
- Ensures the group can actually communicate across language preferences
- Pairs with a common language score 100; pairs with no common language score 30
- Low score indicates a multilingual barrier risk in the group

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
  const commDesc = scores.communicationBalance >= 70 ?
    "小组成员语言沟通兼容性强，交流顺畅" :
    "小组成员语言偏好有所差异，建议活动中多用共同语言";

  const tempDesc = scores.temperatureLevel === "🔥 炽热" ?
    "这是一个化学反应极强的小组！" :
    scores.temperatureLevel === "🌡️ 温暖" ?
    "这个小组有很好的匹配度" :
    "这个小组有一定的匹配度";

  return `${tempDesc} ${commDesc}`;
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

  -- communication balance (stored in energy_balance column for backward compatibility)
  energy_balance INTEGER,       -- Communication balance score (0-100) — formerly energy balance
  temperature_level VARCHAR,    -- Visual indicator: "fire", "warm", "mild", "cold"

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

| Module | Status | Primary Files | Notes |
|--------|--------|-------|-------|
| **WeChat-First Onboarding** | ✅ Complete | `features/onboarding/active/`, `routes/domains/auth.ts` | Anonymous test → WeChat login → server nextStep |
| **Personality Test V4** | ✅ Complete | `apps/mini-program/src/pages/onboarding/personality-test/index.tsx`, `packages/shared/src/personality/` | 12 archetypes, server-configured question range (`minQuestions`–`hardMaxQuestions`) |
| **Profile Review + AI Tagline** | ✅ Complete | `apps/mini-program/src/pages/onboarding/profile-review/index.tsx`, `profileTaglineService.ts` | Reduced wait, skippable, AI tagline |
| **Limited Browse Mode** | ✅ Experiment | `FinalProfileReviewPage.tsx` | Scoped by feature flag `ENABLE_LIMITED_BROWSE_MODE` |
| **Event Discovery** | ✅ Complete | `DiscoverPage.tsx`, `BlindBoxEventDetailPage.tsx` | Blind box system |
| **Blind Pool Join Flow** | ✅ Complete | `JoinEventPoolSheet.tsx`, `components/event-pool-registration/BlindPoolTrustExplainer.tsx`, `PreJoinVibeBriefSheet.tsx`, `components/event-pool-registration/WhyThisFitsCard.tsx` | Trust explainer + vibe brief + why-fits |
| **Matching-State UI** | ✅ Complete | `components/matching/` | 7-screen family: waiting, no-match, join-error, test-incomplete, extended-data-empty, reveal, points |
| **Center-Tab Empty State** | ✅ Complete | `CenterTabEmptyStatePage.tsx` | No-activity users via center nav tab |
| **Match Scoring** | ✅ Complete | `apps/server/src/poolMatchingService.ts` | 6-dimensional pair + group scoring; interest signals excluded from deterministic scoring |
| **Payment Integration** | ✅ Complete | `apps/server/src/paymentService.ts`, `routes/domains/payments.ts` | WeChat Pay v3 signed, verified webhook, kill switch |
| **Subscription Management** | ✅ Complete | `subscriptionService.ts` | Auto-expiry |
| **Chat System** | ✅ Complete | `EventChatDetailPage.tsx`, WebSocket | Real-time |
| **Social Icebreaker** | ✅ Complete | `routes/socialIcebreaker.ts`, `lib/socialIcebreakerStore.ts`, `socialIcebreakerPhaseConfig.ts` | Server-driven phases, PostgreSQL persistence, rejoin recovery |
| **Feedback System** | ✅ Complete | `EventFeedbackFlow.tsx`, 2-tier | Basic + Deep |
| **Connection Model** | ✅ Complete | `ChatsPage.tsx`, `SelectConnectionsStep.tsx` | Post-event selection + 连接 tab enrichment |
| **Admin Dashboard** | ✅ Complete | `AdminDashboard.tsx` | Key metrics |
| **User Management** | ✅ Complete | `AdminUsersPage.tsx` | List, detail sheet, ban/unban, delete all data, CSV export, profile-completeness star rating |
| **Venue Management** | ✅ Complete | `AdminVenuesPage.tsx`, `venueMatchingService.ts` | Auto-matching |
| **Matching Lab** | ✅ Complete | `AdminMatchingLabPage.tsx` | Weight tuning |
| **Content Management** | ✅ Complete | `AdminContentPage.tsx` | CMS for announcements |
| **Notification System** | ✅ Complete | `AdminNotificationsPage.tsx` | Broadcast |
| **Moderation System** | ✅ Complete | `AdminModerationPage.tsx`, `AdminReportsPage.tsx` | Report handling |
| **Data Insights** | ✅ Complete | `AdminDataInsightsPage.tsx` | 7 analytics modules |
| **WebSocket Sync** | ✅ Complete | `wsService.ts`, `useWebSocket.ts` | Bidirectional |
| **Observability Stack** | ✅ Complete | `lib/logger.ts`, `lib/aiTraceLogger.ts`, `lib/adminAuditLogger.ts` | Structured logs, request IDs, metrics, health/readiness |
| **Route Domain Modularization** | ✅ Complete | `routes/domains/*`, `repositories/*` | routes.ts as composition root; storage.ts as compat facade |
| **Temperature Concept** | ✅ Complete | `apps/server/src/archetypeChemistry.ts`, `poolMatchingService.ts` | Dual-temperature system |
| **Real-time Dynamic Matching** | ✅ Complete | `poolRealtimeMatchingService.ts`, `AdminMatchingConfigPage.tsx` | Three-tier threshold system |
| **Invitation & Viral Growth** | ✅ Complete | `poolMatchingService.ts`, `user_coupons` table | Auto-coupon issuance |

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
- WeChat Pay v3 JSAPI (primary) + H5 (reference) with `WECHATPAY2-SHA256-RSA2048` request signing and verified webhook decryption
- Cryptographic webhook signature verification (v3 protocol) — requests that fail verification are rejected before any state change
- Idempotency keys for duplicate prevention
- Payment kill switch (`paymentsEnabled`) for launch-safety control

**Moderation:**
- Automated keyword flagging
- Manual admin review required for bans
- All moderation actions logged for audit

---

## 🚀 Deployment & Environment

**Production Environment:**
- Database: PostgreSQL (Dockerized on CVM)
- Session Store: PostgreSQL
- File Storage: Not yet implemented as an app-managed subsystem; current profile images come from external identity providers (`wechatAvatarUrl`, legacy `profileImageUrl` via Replit auth), and there is no user-initiated upload pipeline in the active runtime
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

> ⚠️ **This section reflects the current monorepo structure.** The legacy `client/src/` and `server/` top-level paths are no longer used. All active code lives under `apps/`, `packages/`, or `docs/`.

```
joyjoin-monorepo/
├── apps/
│   ├── user-client/src/
│   │   ├── features/
│   │   │   └── onboarding/
│   │   │       ├── active/           # ACTIVE onboarding module (use this)
│   │   │       │   ├── pages/        # Onboarding page components
│   │   │       │   ├── flow.ts       # nextStep → route mapping
│   │   │       │   └── useOnboardingOrchestrator.ts
│   │   │       └── README.md
│   │   ├── pages/                    # Route-level page components
│   │   │   ├── PersonalityTestResultPage.tsx
│   │   │   ├── DiscoverPage.tsx
│   │   │   ├── BlindBoxEventDetailPage.tsx
│   │   │   ├── IcebreakerSessionPage.tsx
│   │   │   ├── EventFeedbackFlow.tsx
│   │   │   ├── MatchingStatusPage.tsx
│   │   │   └── ... (40+ pages total)
│   │   ├── components/
│   │   │   ├── ui/                   # shadcn/shared component wrappers
│   │   │   ├── matching/             # Matching-state screen family
│   │   │   │   ├── MatchingStateLayout.tsx
│   │   │   │   ├── MatchingWaitingScreen.tsx
│   │   │   │   ├── NoMatchScreen.tsx
│   │   │   │   ├── JoinErrorScreen.tsx
│   │   │   │   ├── TestIncompleteScreen.tsx
│   │   │   │   └── ExtendedDataEmptyScreen.tsx
│   │   │   ├── event-pool-registration/
│   │   │   │   ├── BlindPoolTrustExplainer.tsx
│   │   │   │   └── WhyThisFitsCard.tsx
│   │   │   ├── PreJoinVibeBriefSheet.tsx
│   │   │   ├── AttendeePreviewCard.tsx
│   │   │   └── feedback/
│   │   │       ├── ConnectionRadar.tsx
│   │   │       ├── TraitTagsWall.tsx
│   │   │       └── SelectConnectionsStep.tsx
│   │   ├── hooks/
│   │   │   ├── useAuth.ts
│   │   │   ├── useOnboardingRoute.ts
│   │   │   ├── useSocialIcebreaker.ts
│   │   │   └── useWebSocket.ts
│   │   ├── lib/
│   │   │   └── queryClient.ts
│   │   └── App.tsx                   # Main routing entry point
│   │
│   ├── admin-client/src/
│   │   ├── pages/admin/              # 18 admin pages
│   │   │   ├── AdminDashboard.tsx
│   │   │   ├── AdminUsersPage.tsx
│   │   │   ├── AdminSubscriptionsPage.tsx
│   │   │   ├── AdminVenuesPage.tsx
│   │   │   ├── AdminEventsPage.tsx
│   │   │   ├── AdminFinancePage.tsx
│   │   │   ├── AdminDataInsightsPage.tsx
│   │   │   ├── AdminFeedbackPage.tsx
│   │   │   ├── AdminMatchingLabPage.tsx
│   │   │   └── ... (18 total)
│   │   └── AdminApp.tsx
│   │
│   └── server/src/
│       ├── routes.ts                 # Composition root — mounts domain routers
│       ├── routes/domains/           # Domain routers (auth, onboarding, payments, etc.)
│       ├── repositories/             # Active persistence layer (new logic goes here)
│       ├── storage.ts                # Compatibility facade (legacy — do not expand)
│       ├── poolMatchingService.ts    # Blind pool matching algorithm
│       ├── paymentService.ts         # WeChat Pay v3 signed integration
│       ├── socialIcebreakerAIService.ts
│       ├── socialIcebreakerPhaseConfig.ts
│       ├── matchExplanationService.ts
│       ├── profileTaglineService.ts
│       ├── auth/policy.ts            # Auth policy and env-gate helpers
│       ├── lib/
│       │   ├── logger.ts             # Structured JSON logger (request IDs)
│       │   ├── aiTraceLogger.ts      # AI call trace logger
│       │   ├── adminAuditLogger.ts   # Admin action audit log
│       │   └── socialIcebreakerStore.ts  # PostgreSQL-backed icebreaker sessions
│       └── README.md                 # Server architecture guide
│
├── packages/shared/src/
│   ├── schema.ts                     # Canonical DB schema (Drizzle)
│   ├── personality/                  # V4 engine, archetypes, chemistry matrix
│   ├── types/aiMeta.ts               # AIResponseMeta contract
│   ├── socialIcebreaker.ts           # Shared icebreaker contracts
│   ├── constants.ts                  # INTENT_OPTIONS, WORK_MODE, etc.
│   └── index.ts                      # Barrel export
│
└── docs/
    ├── onboarding-flow.md            # Active onboarding flow reference
    ├── observability.md              # Monitoring, metrics, alerting setup
    ├── architecture/current-state.md # Active architecture map
    ├── icebreaker-system.md          # Social Icebreaker full system docs
    └── runbooks/observability.md     # Incident response runbook
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
   - Navigate to `/admin` (admin portal is `apps/admin-client`)
   - Use the `set-admin` CLI script to grant admin access: `npm run set-admin`

3. **Key Files to Read First:**
  - `docs/README.md` — active documentation index
  - `DEVELOPER_QUICK_REFERENCE.md` — active codebase reference and canonical rules
  - `CONTRIBUTING.md` — contributor workflow, validation, and repo guidance
  - `docs/architecture/current-state.md` — active architecture map by domain
  - `apps/server/src/README.md` — server domain ownership and file placement guide
  - `packages/shared/src/schema.ts` — canonical DB schema (Drizzle)
  - `apps/server/src/routes.ts` — API route composition root
  - `apps/user-client/src/App.tsx` — client routing entry point

4. **Common Tasks:**
   - Add new API route → `apps/server/src/routes/domains/<domain>.ts`, mount in `routes.ts`
   - Add new admin page → `apps/admin-client/src/pages/admin/`
   - Modify matching → `apps/server/src/poolMatchingService.ts`
   - New persistence logic → `apps/server/src/repositories/<domain>Repo.ts` (not `storage.ts`)
   - Update schema → `packages/shared/src/schema.ts` + `npm run db:push`
   - Active onboarding page → `apps/user-client/src/features/onboarding/active/pages/`

5. **Skills / Architecture guides:**
  - `.github/skills/README.md` — domain skill index for AI coding agents
  - `docs/systems/observability.md` — monitoring, logging, metrics
  - `docs/systems/onboarding-flow.md` — complete onboarding flow reference
  - `docs/reference/PLATFORM_COORDINATION.md` — current web/mini-program payment and auth coordination playbook

**For Product Managers:**

- User flows: See Section 1 (User App Features)
- Admin capabilities: See Section 2 (Admin Portal Features)
- Analytics: AdminDataInsightsPage provides all metrics
- Feedback: AdminFeedbackPage shows user sentiment

**For Designers:**

- Design system: `packages/shared/src/ui/` (shared primitives) + `apps/user-client/src/components/ui/` (app wrappers)
- Color palette: Defined in `apps/user-client/src/index.css`
- Personality archetype branding: `apps/user-client/src/lib/archetypeAvatars.ts`
- Dark mode: Fully supported via Tailwind classes

---

## 📝 Changelog & Version History

**v1.4 (April 1, 2026)**
- ✅ WeChat Pay v3 signed integration + verified webhook handling + payment kill switch
- ✅ Server-driven observability: structured logging, request IDs, Prometheus metrics, health/readiness endpoints
- ✅ Server domain modularization: `routes/domains/*` as active domain routers; `repositories/*` as persistence layer; `storage.ts` as compatibility facade
- ✅ Social Icebreaker durability: PostgreSQL-backed session store, rejoin recovery, server-driven phase rollout
- ✅ Matching-state UI system: MatchingStateLayout + full screen family (7 screens)
- ✅ Blind pool join flow: BlindPoolTrustExplainer, PreJoinVibeBriefSheet, WhyThisFitsCard
- ✅ Onboarding clarity: reduced analyzing wait (1200ms / 500ms reduced-motion), skippable after 600ms
- ✅ Limited browse mode experiment (scoped, gated by feature flag)
- ✅ AI profile tagline, AIResponseMeta normalization, AI trace logger
- ✅ Interest signal boundary enforced: `user_interest_signals` removed from deterministic pair scoring
- ✅ Active onboarding module consolidation: `features/onboarding/active/` is single source of truth
- ✅ `.github/skills/README.md` and domain skills now active contributor guidance
- ✅ PRD metadata updated to v1.4 / April 1, 2026

**v1.3 (March 2026)**
- ✅ V4 personality test: server-configured question bounds (`minQuestions`, `softMaxQuestions`, `hardMaxQuestions`) with adaptive termination
- ✅ AI onboarding tagline on Profile Review page
- ✅ Interest Signal Boost: 2-step UX, pre-seeded from onboarding interest data
- ✅ Limited browse mode prototype

**v1.2 (February–March 2026)**
- ✅ Server-driven `nextStep` navigation (Scope B1)
- ✅ Active onboarding module: `features/onboarding/active/`
- ✅ Guide page deprecated (2026-02-16); replaced by inline coach marks
- ✅ Auth gate flow: `/personality-test/auth-gate` page + dev-only bypass
- ✅ Intent options: single source of truth in `packages/shared/src/constants.ts`

**v1.1 (November–December 2025)**
- ✅ Temperature concept system (dual-temperature: social energy + chemistry reaction)
- ✅ 12-archetype V4 system (replaced 14-archetype V1/V2)
- ✅ Three-tier matching threshold system with time decay
- ✅ Invitation & viral growth (auto-coupon issuance)
- ✅ Event pool user flow (two-stage matching UI)
- ✅ Life stage affinity matrix (LIFE_STAGE_AFFINITY workMode 7×7)

**v1.0 (November 14, 2025)**
- ✅ Complete user app with blind box events
- ✅ 12 personality archetype system (V4)
- ✅ 6-dimensional pair + group matching algorithm
- ✅ WeChat Pay integration
- ✅ Comprehensive admin portal (18 pages)
- ✅ Real-time WebSocket sync
- ✅ Two-tier feedback system
- ✅ Data insights dashboard
- ✅ Chat moderation system

---

## 📞 Support & Resources

**Documentation:**
- This PRD (`PRODUCT_REQUIREMENTS.md`) — canonical product and active-flow reference
- `docs/README.md` — active documentation index by topic and audience
- `DEVELOPER_QUICK_REFERENCE.md` — codebase navigation, conventions, active-flow rules
- `CONTRIBUTING.md` — contributor workflow and validation checklist
- `docs/architecture/current-state.md` — active architecture map by domain
- `apps/server/src/README.md` — server domain ownership and file placement
- `docs/systems/observability.md` — monitoring, structured logging, metrics, alerting
- `docs/runbooks/observability.md` — incident runbooks
- `docs/systems/onboarding-flow.md` — complete onboarding flow reference
- `docs/reference/PLATFORM_COORDINATION.md` — canonical cross-platform auth/payment coordination reference
- `docs/ai/ai-agent-harness-separation-strategy.md` — current shipped AI boundaries and architecture invariants
- `docs/ai/AI_INTEGRATION_PLAN.md` — planning-only AI roadmap, gates, and sequencing
- `.github/skills/README.md` — domain skill index for AI coding agents

**Developer Resources:**
- Schema: `packages/shared/src/schema.ts`
- Route composition: `apps/server/src/routes.ts` + `routes/domains/`
- Tests: `npm run test -w @joyjoin/server` (server tests), `npm run test -w @joyjoin/user-client` (Vitest, user-client)
- Guardrails: `npm run guardrails` (monorepo health checks — run before pushing)
- Logs: structured JSON to stdout; request ID correlation available in all server logs

**Ownership routing:**
- Engineering / architecture questions: start with `CONTRIBUTING.md`, `docs/README.md`, and the owning workspace README
- Product canon / scope questions: use this PRD plus the current planning owner for the affected initiative
- Design-system / mobile UX questions: start with `design_guidelines.md`, `docs/mobile-design-system.md`, and the relevant frontend/design-system guidance

---

**End of Product Requirements Document**

*Last updated: April 1, 2026*  
*Document version: 1.4*  
*Total pages: ~55 (Markdown equivalent)*
