# PRD — Onboarding Guidance Iteration (2026-08-27)

> Status: Locked scope (grill-me interview complete). Document task — no code in this PRD.
> Canon: `PRODUCT_REQUIREMENTS.md`, `docs/copy/brand-copy-strategy.md`, WeChat review posture (AGENTS.md §2).

---

## 1. Problem Statement

New users reach two cliff edges in the first session:

1. **Purpose skepticism before the personality test.** The landing page sells the 盲盒 fantasy, but the test intro sells "3 分钟读懂你的聚会气场" — it never says *what the answers buy you*. Users who don't believe the test shapes their table abandon mid-test or never start.
2. **Discover-page overwhelm.** A freshly-minted user lands on Discover facing pool cards, filters, 街头盲盒 entry, promo banner, and five unfamiliar tabs with zero hierarchy of "do this first." The existing arrival coachmark explains the play-mode concept but does not point at the first action.

**Mission (locked):** Capture attention in the first 60 seconds. Kill purpose skepticism before the personality test; kill Discover-page overwhelm before registration.

### Current state (what exists today)

| Asset | Status |
|---|---|
| Landing 盒子吐卡 mechanism hero + caption「① 答小题 · ② 攒一桌 · ③ 见真人」 | Shipped 2026-07-31 |
| Test intro trust points + bridge line「先装盒，再拆盒」 | Shipped |
| Discover arrival coachmark (one-time, storage-keyed, 6s auto-dismiss) | Shipped PR-5/PR-9 |
| BoxJourneySpine macro-journey spine (onboarding steps) | Shipped |
| No central guidance system; tips are ad-hoc storage flags | **Gap this PRD closes** |

---

## 2. Goals & Success Metrics

Measured via D7 events on the existing `/api/analytics/discover` pipe. Targets are **hypotheses** (marked H), to be calibrated against a 2-week baseline pull before flag-on.

| # | Metric | Formula | Baseline | Target (H) |
|---|---|---|---|---|
| G1 | Test-start rate | `personality_test_started` / `onboarding_intro_viewed` | TBD | +10% rel. |
| G2 | Test completion rate | `personality_test_completed` / `personality_test_started` | TBD | +5% rel. |
| G3 | Discover→registration conversion | `registration_started` / `discover_first_arrival` (same user, ≤7d) | TBD | +15% rel. |
| G4 | Paid conversion | `registration_paid` / `registration_started` | TBD | no regression |
| G5 | Guidance engagement | `guidance_shown`→`guidance_dismissed(reason=tap_through)` ratio; auto-dismiss rate < 60% | n/a | establish baseline |

**Guardrail metrics:** no increase in test abandonment at Q1–Q3; no increase in Discover immediate-exit (page dwell < 3s); ceremony completion (UnboxingCeremony `onAdvance`) unchanged.

---

## 3. Non-Goals (locked out of scope)

- Skip/defer paths for onboarding/extended steps (revisit with funnel data).
- Bespoke welcome-back cohort changes (returning users only see unfired tips via empty seen flags — organic reuse).
- Payment framing anywhere before Discover.
- Archetype names, percentages, or any scoring language mid-test.
- Autoplay video, extra onboarding screens, a second coachmark visible at once.

---

## 4. User Stories

- **US-1 (A1/A2):** As a first-time visitor, I see within one screen what the test *produces* (a table of people), so I start it believing the effort buys something.
- **US-2 (B3):** As a test-taker, each answer visibly "feeds" something, so the test feels alive and cumulative — without spoiling my result.
- **US-3 (C4/C6):** As a new user exploring tabs, I get at most one gentle tip at the moment a feature first becomes relevant, so I learn the app progressively without a tutorial wall.
- **US-4 (C5):** As a new arrival on Discover, my eye is pulled to the first pool card's CTA with a clear "start here" and honest price, so my first registration feels obvious and low-risk.

---

## 5. Acceptance Criteria (per workstream)

### A1 — Landing step micro-loop
- [ ] 3-beat loop (答小题 → 攒一桌 → 见真人 icons lighting in sequence) extends the 盒子吐卡 motion language; one subtle loop, no autoplay video, no new screens.
- [ ] Falls back to static line 「全程约 8 分钟 · 答题 → 名片 → 入场」 if motion exceeds the ≤0.5-day budget or on RM/low-end tiers.
- [ ] Loop suppressed under `prefers-reduced-motion` and `--low-end` (same tier classes as landing hero).

### A2 — Test intro WHY line
- [ ] One line tying answers to table outcome (e.g. 「你的每道题，都在决定谁和你坐一桌」) rendered in the intro stage, sourced from `packages/shared/src/copy/` with `toneMode` metadata.
- [ ] Copy passes WeChat-safe vocabulary scan (no 匹配/社交/灵魂/撮合/AI in visible copy).

### B3 — In-test gather-glow feedback
- [ ] Each submitted answer triggers a light/colour fragment gathering into the on-screen 盲盒 visual; rides existing answer events, zero new API calls.
- [ ] No archetype names, no percentages, no scoring hints mid-test. Reveal ceremony (slot animation) untouched.
- [ ] RM tier: fragments appear statically (opacity step, no flight animation).

### C4 — GuidanceQueue orchestrator
- [ ] Central queue owns ALL first-time tips: 5 tabs (发现/足迹/连接/进行中/我的), 街头盲盒 entry, 盲盒活动, registration spotlight.
- [ ] Priority-ordered; **max 1 tip per session**; never fires during ceremonies (UnboxingCeremony, squad unboxing, Flash flows, icebreaker sessions).
- [ ] Each tip shown exactly once per user, persisted server-side (`users.seen_guidance` jsonb — additive nullable column; see §9 migration note).
- [ ] Reuses the existing coachmark visual pattern (discover arrival coachmark / icebreaker coachmark).

### C5 — Discover registration spotlight
- [ ] Animated beacon on first pool card CTA + 「从这里开始你的第一局」 + price caption 「每场局 ¥XX 起」.
- [ ] Price resolved from `pricing_settings` (DB-driven), never hardcoded; absent price → caption omitted, beacon still shows.
- [ ] Tap routes directly to pool registration; tier education stays on pool detail pages.

### C6 — Behavior-triggered tab tips
- [ ] 足迹 tip fires after first registration; 连接 after first match; 进行中 hub after first confirmed event.
- [ ] Pulsing beacon on tab icon → slide-up tip card → auto-dismiss; never stacked, never blocks the current task.

### D7 — Instrumentation
- [ ] Events whitelisted server-side: `onboarding_intro_viewed`, `personality_test_started`, `personality_test_completed`, `discover_first_arrival`, `registration_started`, `registration_paid`, `guidance_shown`, `guidance_dismissed`.
- [ ] Metadata minimal (same fail-open pattern as `flash_search_started`).

---

## 6. Scope Boundaries

| In | Out |
|---|---|
| Mini-program only | Admin portal surfaces |
| First-time tips only | Repeat/nurture campaigns, push notifications |
| Visual motion feedback (B3) | Any mid-test scoring/archetype disclosure |
| ~8 analytics events | New analytics infrastructure or dashboards (iteration 2) |

---

## 7. Analytics & Measurement Plan

All events flow through `POST /api/analytics/discover` (same pipe as `flash_search_started`; server whitelist in `routes/domains/analytics.ts`). Funnel: `onboarding_intro_viewed → personality_test_started → personality_test_completed → discover_first_arrival → registration_started → registration_paid`. Guidance health: `guidance_shown` vs `guidance_dismissed` (`reason: button|tap_through|auto`). **Step 0 of rollout:** 2-week baseline pull with flags off to replace the TBD cells in §2.

---

## 8. Rollout Plan (feature flags)

DB-backed flags per `apps/server/src/lib/featureFlags.ts` (DB = truth, env = fallback, exposed via auth `features`, admin-toggleable, audit-logged). All ship **dark (default false)** except D7 events (unconditional).

| Flag | Env | Gates | Default |
|---|---|---|---|
| `guidanceQueueEnabled` | `GUIDANCE_QUEUE_ENABLED` | C4 + C6 (whole orchestrator) | false |
| `discoverSpotlightEnabled` | `DISCOVER_SPOTLIGHT_ENABLED` | C5 | false |
| `landingStepLoopEnabled` | `LANDING_STEP_LOOP_ENABLED` | A1 (static line is the off state) | false |
| `testIntroWhyLineEnabled` | `TEST_INTRO_WHY_LINE_ENABLED` | A2 | false |
| `testGatherGlowEnabled` | `TEST_GATHER_GLOW_ENABLED` | B3 | false |

Build order (locked): **C4 → A1+A2 → C5 → B3 → C6 → D7** (events ride along each workstream). Staging acceptance per workstream before the next flag flips on; rollback = flag off, no deploy.

---

## 9. Open Risks & Dependencies

| Risk | Mitigation |
|---|---|
| `users.seen_guidance` jsonb migration on production CVM (manual DDL) | Additive nullable column, `db:generate --custom` + `db:rebuild-journal`, psql apply before deploy; `validateDbSchema()` must not flag it (add to critical-select list if needed). Chosen over a new table: no FK, no joins, lightest safe option per database-migration-safety. |
| Tip collisions with existing arrival coachmark | C4 owns the arrival coachmark's slot too (migration of that storage flag into the queue, one-time backfill from `joyjoin_discover_arrival_seen:<userId>`). |
| Beacon animation cost on low-end devices | Opacity-pulse only (no `background-position`), GPU-safe transforms; killed on `--low-end` + RM. |
| WeChat review vocabulary drift in new copy | All copy through `packages/shared/src/copy/`; pre-ship grep for banned tokens. |
| Ceremony guard regressions (C4 firing during UnboxingCeremony) | Explicit ceremony-state registry check; contract test (see §11). |

---

## 10. UIUX Design Strategy

### Motion language principles
- New motion **extends, never competes**: A1 reuses the 盒子吐卡 keyframe vocabulary (converge/settle easing, `$ease-reveal-*` from `_reveal-motion.scss`); B3 fragments reuse the UnboxingCeremony halo/glow palette so the payoff ceremony feels like the same object's final state.
- One motion idea per surface. If a screen already has a hero animation (landing mechanism loop), the guidance layer is *static + opacity only*.
- Anti-AI-slop: no generic shimmer/gradient sweeps on new elements; beacons use a single 2.4s opacity-pulse ring (same spec as Flash collection-strip breathing), never multicolor.

### GuidanceQueue choreography
| Rule | Spec |
|---|---|
| Enter | Slide-up 16rpx + fade, 300ms `cubic-bezier(0.22,1,0.36,1)` (matching-status spring) |
| Dwell / auto-dismiss | 6s (matches arrival coachmark); RM tier shows static card, same dwell |
| Exit | 200ms fade + translateY(8rpx); dismissed state committed to server before exit starts |
| Tab beacon | Pulsing ring on tab icon, ≤3 pulses then rest until next session show |
| Haptics | `light` on explicit dismiss/tap-through only; none on auto-dismiss or beacon pulse |
| Stacking | Hard invariant: one tip instance mounted app-wide; queue drains on next session |

### Discover spotlight hierarchy
Beacon sits *inside* the OracleCard CTA layer (L6) — never above the L1 hero message. Price caption is tertiary type (system font, 0.75 opacity tier), below the CTA label, so the CTA remains the loudest element. Solid `$color-primary` CTA preserved; beacon ring uses `$color-primary` at 30% opacity.

### Accessibility & performance hard constraints
- `@media (prefers-reduced-motion: reduce)` + `useMiniRevealMotion` gates on every new animation; RM fallbacks are static equivalents, not removals of information.
- WeChat WXSS: no `min()`/`max()`/`clamp()` — rpx + media queries; `rgba()` only (no `hsla()`); opacity-pulse shimmers (GPU-safe), `will-change` reset to auto on low-end.
- Full-screen states keep `min-height: 100vh`→`100dvh` + flex centering; `@include scroll-view-centered-state` inside ScrollViews.
- No hooks below early returns; transient flags reset via `useResetOnShow`.

---

## 11. Execution Guidelines

### File/surface map
| WS | Touch |
|---|---|
| A1 | `apps/mini-program/src/pages/index/index.tsx` + `index.scss` (mechanism-strip zone) |
| A2 | `packages/shared/src/copy/` (new `guidanceCopy.ts`, barrel export) + `PersonalityTestIntro.tsx` |
| B3 | `PersonalityTestQuestion.tsx` + `pages/onboarding/personality-test/index.scss` (@use new component SCSS — subpackage rule) |
| C4 | New `apps/mini-program/src/components/guidance/GuidanceQueue.tsx` (+`.scss`); `hooks/useGuidanceQueue.ts`; server: `routes/domains/` guidance seen-flag route + `users.seen_guidance` migration + `packages/shared/src/schema/` |
| C5 | `pages/discover/index.tsx` + `components/discover/OracleCard.tsx`; price via existing pricing fetch pattern |
| C6 | `native-custom-tab-bar` beacon channel + per-tab pages (events/connections/center-hub) trigger hooks |
| D7 | `routes/domains/analytics.ts` whitelist + `lib/analytics/` client modules |

### Copy governance
All user-facing copy through `packages/shared/src/copy/` with `toneMode` metadata (`system-ui` for beacons/buttons, `yuezai-voice` for coach lines). Zero emoji in TSX (JoyJoinIcon only). Banned-token grep before merge: 匹配/社交/灵魂/撮合/AI/算法/权重/评分 in visible copy.

### Testing expectations
- Structural contract test for C4 ceremony-guard invariant (pattern: `miniscriptClientPathContract.test.ts`) — asserts GuidanceQueue reads ceremony state and mounts ≤1 tip.
- Copy completeness test for the new copy module (pattern: `onboardingVoice.test.ts`) — toneMode coverage + zero-emoji rule.
- `mechanismBurst.ts`-style unit test for A1 beat sequencing if JS-driven.

### Guardrails compliance
`npm run guardrails` green; **BEM class coverage gate — every new component ships its CSS in the same PR**; subpackage rule: `@use` component SCSS in consuming page SCSS (verify with `npm run build:weapp -w mini-program && npm run verify:subpackage-styles -w mini-program`); no new bundled assets without a `packOptions.include` regexp.

### Harness tier classification
| WS | Tier | Notes |
|---|---|---|
| C4 | **Tier 2** | New DB column + server route + cross-page state → Sprint Contract before edits |
| C5 | Tier 2 | Touches pricing read path + conversion surface |
| C6 | Tier 2 | Tab-bar native component + multi-page triggers (rides C4 contract) |
| A1, A2, B3, D7 | Tier 1 | Bounded single-surface UI/copy/whitelist changes |

---

*End of PRD. Next step: route C4 to backend-engineer with a Tier-2 Sprint Contract draft.*
