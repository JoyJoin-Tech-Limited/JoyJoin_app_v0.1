# Execution Plan — Onboarding Guidance Iteration (2026-08-27)

> Source PRD (locked): `docs/prd/onboarding-guidance-iteration-20260827.md`. Approval-first; no code written by planner. Build order is locked: **C4 → A1+A2 → C5 → B3 → C6 → D7**.

## 1. Goal Summary

Ship a first-run-only guidance layer for the mini-program: kill purpose skepticism before the personality test (A1/A2), kill Discover overwhelm (C5/C4), add pure-visual in-test gather feedback (B3), behavior-triggered tab tips (C6), all arbitrated by a central GuidanceQueue (C4) with server-persisted seen-state, measured by D7 events on the existing `/api/analytics/discover` pipe. Everything ships dark behind DB-backed flags.

## 2. Assumptions & Gaps

- D7 server whitelist is Tier 1 and unconditional per PRD §8; recommended to land with Wave 1 (see §5).
- `users.seen_guidance` is additive nullable jsonb — chosen over a new table per PRD §9; production DDL is manual psql on the CVM.
- The queue only fires on tab pages; ceremonies live on non-tab pages/overlays, so suppression is a belt-and-suspenders registry, not the primary guard.
- No new bundled assets are required by any wave (all CSS/GPU-safe motion) → no `packOptions.include` changes.

## 3. Wave Structure

| Wave | Workstream | Goal | Files (create / modify) | Agent | Tier | Depends | Effort | Verify |
|---|---|---|---|---|---|---|---|---|
| **W1** | **C4 + D7-whitelist** | GuidanceQueue orchestrator end-to-end, dark; analytics whitelist live | Server: `packages/shared/src/schema/users.ts` (+`seenGuidance` jsonb), `apps/server/migrations/####_seen_guidance.sql` (custom), `apps/server/src/lib/featureFlags.ts` (5 new flags), `apps/server/src/routes/domains/guidance.ts` (new, mark-seen), `apps/server/src/routes/domains/analytics.ts` (whitelist +8 events), auth user payload (`seenGuidance`, 5 `features` flags). Client: `apps/mini-program/src/lib/guidance/{registry.ts,ceremonyState.ts,arrivalMigration.ts}`, `hooks/useGuidanceQueue.ts`, `components/guidance/GuidanceTipCard.tsx+.scss`, edits to `pages/discover/index.tsx` (legacy coachmark absorbed behind flag), ceremony enter/exit hooks in `UnboxingCeremony`, squad-unboxing, Flash, icebreaker session mount. Tests: `guidanceQueueContract.test.ts` (ceremony guard + ≤1 tip), `guidanceCopy.test.ts`. | backend-engineer (server) + taro-engineer (client) | **2 — Sprint Contract required** at `.git/.orchestration/sprints/sprint-contract.c4-guidance-queue.md` | none | **L** | `npm run guardrails`; `npm run typecheck` (server+mini); `npm run test -w @joyjoin/server`; `npm run build:weapp -w mini-program && npm run verify:subpackage-styles -w mini-program`; contract test green |
| **W2a** | A1 | Landing 3-beat step micro-loop + static fallback | `apps/mini-program/src/pages/index/{index.tsx,index.scss}` (mechanism-strip zone); maybe `lib/landing/stepLoop.ts` (+ unit test if JS-driven) | taro-engineer | 1 | W1 merged (order lock; zero code overlap) | S/M | typecheck, guardrails, `?motion=reduce` + `--low-end` DevTools pass |
| **W2b** | A2 | Test-intro WHY line via shared copy | `packages/shared/src/copy/guidanceCopy.ts` + `index.ts` barrel; `apps/mini-program/.../PersonalityTestIntro.tsx`; copy completeness test | taro-engineer | 1 | none (can start during W1 — copy-only) | S | guardrails (banned-token grep), copy test, typecheck |
| **W3** | C5 | Discover registration spotlight (beacon + price caption) | `pages/discover/index.tsx`, `components/discover/OracleCard.tsx` (+SCSS `@use`d), price via existing pricing fetch; spotlight registered as a queue tip | taro-engineer | **2 — Sprint Contract** (pricing read + conversion surface) | W1 (queue), W2 | M | full gate suite incl. build:weapp + verify:subpackage-styles |
| **W4** | B3 | In-test gather-glow on answer submit | `PersonalityTestQuestion.tsx`, `pages/onboarding/personality-test/index.scss` (`@use` new SCSS — subpackage rule) | taro-engineer | 1 | none code-wise; sequenced after W3 per lock (may parallel W3) | M | build:weapp + verify:subpackage-styles, RM tier check |
| **W5** | C6 | Behavior-triggered tab tips (足迹/连接/进行中) | `native-custom-tab-bar` beacon channel, per-tab pages (`events`, `connections`, `center-hub`) trigger hooks feeding the W1 queue | taro-engineer | **2 — rides C4 contract** (amend, don't redraft) | W1, W3 | M | typecheck, guardrails, tab-bar smoke (`docs/runbooks/mini-program-tab-bar-smoke.md`) |
| **W6** | D7 residual | Client event emission audit + 2-week baseline pull | `apps/mini-program/src/lib/analytics/*` wiring verification; PRD §2 TBD cells filled | qa-agent + product-manager | 1 | W1–W5 | S | events visible in `discover_analytics_events` on staging |

## 4. C4 GuidanceQueue Design Sketch (W1 — critical path)

**Client architecture** (`apps/mini-program/src/`):
- `lib/guidance/registry.ts` — ordered tip definitions: `{ id, priority, surface, trigger: (ctx) => boolean, copyKey }`. Covers 5 tabs, 街头盲盒 entry, 盲盒活动, registration spotlight (W3 registers into it), discover-arrival (migrated).
- `lib/guidance/ceremonyState.ts` — module-level registry: `enterCeremony(id)` / `exitCeremony(id)` / `isCeremonyActive()`. Called from UnboxingCeremony mount/unmount, squad-unboxing, Flash flows, icebreaker session mount. Queue hard-refuses to fire while active.
- `hooks/useGuidanceQueue.ts` — session-scoped arbitration: evaluate registry on tab-page `useDidShow` + trigger events; **max 1 tip per session** (module-level `sessionShownTipId`); check flag → ceremony state → `seenGuidance` → fire. Dismiss commits to server *before* exit animation starts (PRD §10).
- `components/guidance/GuidanceTipCard.tsx+.scss` — shared coachmark visual extracted from the discover arrival coachmark pattern (slide-up 16rpx, 300ms spring, 6s dwell, 200ms exit); SCSS `@use`d by each consuming page SCSS per the subpackage rule.

**Server surface** (recommendation):
- Schema: `users.seenGuidance` jsonb nullable (`{ [tipId]: isoDate }`) in `packages/shared/src/schema/`; migration via `npm run db:generate -- --custom` + `npm run db:rebuild-journal`; **manual `psql` apply on staging + CVM before deploy** (deploy pipeline skips DDL). Verify `validateDbSchema()` passes (column is additive; add to critical-select list only if the guard flags it).
- Read: fold `seenGuidance` into the existing `GET /api/auth/user` payload — zero new round-trips, already hydrated on every page via `useAuth`.
- Write: `POST /api/guidance/seen` in new `routes/domains/guidance.ts` — idempotent merge `{ tipId }`, auth-gated, Zod-validated tipId against a shared enum. Cheaper than PATCH semantics and naturally retry-safe.

**Arrival-coachmark migration** (`lib/guidance/arrivalMigration.ts`): on first queue init with flag on, read `joyjoin_discover_arrival_seen:<userId>` / `..._pending:<userId>`; if seen → include `discover_arrival` in the first `POST /api/guidance/seen` batch, then remove both keys. Pending → queue inherits it as a pending tip (priority preserved). When flag is off, the legacy storage-keyed path in `pages/discover/index.tsx` runs untouched — the two paths are mutually exclusive by flag, so no double-fire during the rollout window.

**Arbitration invariants** (locked by `guidanceQueueContract.test.ts`, pattern: `miniscriptClientPathContract.test.ts`): (1) ≤1 tip mounted app-wide; (2) queue reads `isCeremonyActive()`; (3) queue fires only on tab-page routes; (4) dismiss persists server-side before exit.

## 5. Sequencing, Parallelization & Models

- **Strictly sequential (critical path):** W1 → W3 → W5 (queue → spotlight-in-queue → tab triggers).
- **Parallel-safe:** W2b (A2 copy) can run during W1 server work (different workspaces, zero overlap). W4 (B3) can parallel W3 (different surfaces) but merge after W3 per the locked order.
- **D7 recommendation:** deploy the analytics whitelist **with W1**, not last. PRD §7 requires a 2-week baseline with flags off before flag-on; the funnel events are unconditional, so every day the whitelist isn't live burns baseline window. It is a Tier-1 server-only edit — no reason to hold it.

| Wave | Model | Why |
|---|---|---|
| W1 server | **DeepSeek V4 Pro** (thinking max) | High blast radius: DB column + auth payload + money-adjacent surface (escalate on blast radius) |
| W1 client | **Kimi K2.6** | Multi-file coordination across lib/hooks/components/4 ceremony surfaces |
| W2a | DeepSeek V4 Pro | Animation correctness in WeChat runtime; mechanism-strip precision |
| W2b | **DeepSeek V4 Flash** | Bounded copy module + test; shallow |
| W3 | DeepSeek V4 Pro | Pricing read path + conversion surface |
| W4 | DeepSeek V4 Pro | WeChat animation runtime traps |
| W5 | Kimi K2.6 | Native tab-bar + multi-page coordination |
| W6 | DeepSeek V4 Flash | Read-only audit + data pull |

Estimated premium cost: W1 ~$1.5–2.5 (Tier 2), W3/W5 ~$0.5–1 each, others <$0.3. Total ≈ $4–6.

## 6. Flag Rollout Schedule (all dark at merge)

| Flag | Registered | Gates | Staging acceptance before next flip |
|---|---|---|---|
| `guidanceQueueEnabled` | W1 | C4+C6 | Contract test green; arrival coachmark migration verified on staging; zero tips during ceremonies; `guidance_shown/dismissed` flowing |
| `testIntroWhyLineEnabled` | W1 (skeleton) / consumed W2b | A2 | Banned-token grep clean; line renders in intro stage |
| `landingStepLoopEnabled` | W1 / consumed W2a | A1 | RM + `--low-end` static fallback verified in DevTools |
| `discoverSpotlightEnabled` | W1 / consumed W3 | C5 | Price caption from `pricing_settings`; absent-price omission path; beacon inside L6, never over L1 |
| `testGatherGlowEnabled` | W1 / consumed W4 | B3 | RM static fragments; zero new API calls (network-tab check) |

Baseline: D7 events live from W1 deploy → 2-week pull → fill PRD §2 TBD → then `guidanceQueueEnabled` flips on staging first, one flag per acceptance cycle, rollback = flag off.

## 7. Risk Register (Top 5)

| # | Risk | Mitigation |
|---|---|---|
| 1 | `seen_guidance` migration on CVM (manual DDL window) | Additive nullable jsonb; `db:generate --custom` + `rebuild-journal`; psql apply on staging first, then prod **before** code deploy; `validateDbSchema()` startup check; rollback = column stays (harmless) |
| 2 | Subpackage style-splitting blank UI for new guidance/glow components | Every consuming page SCSS `@use`s the component SCSS; `npm run build:weapp -w mini-program && npm run verify:subpackage-styles -w mini-program` mandatory per wave; fail on non-empty `sub-common.wxss` |
| 3 | WeChat copy vocabulary drift (匹配/社交/灵魂/撮合/AI) | All copy via `packages/shared/src/copy/` with `toneMode`; pre-merge banned-token grep; `guidanceCopy.test.ts` (pattern: `onboardingVoice.test.ts`) locks coverage + zero-emoji |
| 4 | Coachmark collision during migration window (legacy arrival vs queue) | Flag-mutually-exclusive paths; one-time idempotent backfill of `joyjoin_discover_arrival_seen/pending` into `seen_guidance`; contract test asserts ≤1 mounted tip |
| 5 | Beacon/glow animation cost on low-end devices | Opacity-pulse only (no `background-position`); GPU-safe transforms; gates via `useMiniRevealMotion` + `useDeviceTier`; `will-change: auto` on low-end; no `min()/max()/clamp()` in WXSS; `performance-audit` before flag-on |

## 8. Approval Requested — confirm before Wave 1

1. **Server surface:** fold `seenGuidance` into `GET /api/auth/user` + new `POST /api/guidance/seen` (recommended) — vs a dedicated GET endpoint.
2. **Migration strategy:** client-driven one-time backfill of the discover arrival storage keys into server `seen_guidance` (recommended) — vs letting existing users re-see the arrival tip once.
3. **D7 timing:** analytics whitelist ships with W1 to start the 2-week baseline clock immediately (recommended) — vs riding last per the literal build order.
4. **Ceremony suppression:** module-level `ceremonyState.ts` with enter/exit calls added to UnboxingCeremony, squad-unboxing, Flash, and icebreaker session mounts (small touches to 4 existing surfaces) — approve the cross-surface edits.
5. **Model assignment:** W1 on DeepSeek V4 Pro (thinking max) + Kimi K2.6 as tabled — confirm or escalate W1 server to GLM 5.1.

**Recommended first handoff after approval:** backend-engineer — draft the Tier-2 Sprint Contract for C4 at `.git/.orchestration/sprints/sprint-contract.c4-guidance-queue.md`, then route to @verifier for contract review.
