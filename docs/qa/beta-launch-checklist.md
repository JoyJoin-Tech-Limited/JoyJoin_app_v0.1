# JoyJoin Beta Launch — QA Checklist

## Overview
- Purpose: Pre-launch verification of all critical mini-program and admin portal features
- Scope: Registration/onboarding, matching, icebreaker sessions, admin portal, cross-cutting
- Priority levels: 🔴 Critical (beta-blocking) / 🟠 High (should verify) / 🟡 Medium (nice-to-have)

---

## 1. Mini-Program — Registration & Onboarding

| # | Test Case | Priority | How to Verify |
|---|-----------|----------|---------------|
| O-01 | WeChat login flow — `Taro.login()` → session → `nextStep` returned | 🔴 Critical | `wechatAuth.test.ts` + manual DevTools |
| O-02 | Server returns correct `nextStep` at each stage (`onboarding` → `personality-test` → `essential-data` → `extended-data` → `profile-review` → `discover`) | 🔴 Critical | `computeOnboardingNextStep.test.ts` (21 tests) + manual |
| O-03 | Personality test V4 — adaptive 8–16 questions, archetype assigned | 🔴 Critical | `assessmentV4.test.ts` + manual |
| O-04 | Archetype result screen — sprite animation renders, canvas poster generates, sharing works | 🟠 High | `docs/qa/mini-program-personality-card-sharing-smoke.md` |
| O-05 | Essential data — 5-step FormStepper: displayName → gender/birthYear → education/occupation/workMode/relationship → city/hometown → intent (max 3) | 🔴 Critical | Manual DevTools |
| O-06 | Extended data — 3-tier interest carousel, min 3 selections (no max), 6 categories | 🟠 High | Manual DevTools |
| O-07 | Profile review — read-only summary with archetype, tagline, readiness checklist, profile grid, intent chips, interest heat summary | 🔴 Critical | Manual DevTools |
| O-08 | "确认并进入发现" CTA navigates to `/discover` on completion | 🔴 Critical | Manual DevTools |
| O-09 | `complete-onboarding` + `complete-personality-test` endpoints save state correctly | 🔴 Critical | `completeOnboardingRoutes.test.ts` (15 tests) |
| O-10 | Onboarding restart — idempotent, capped at 3 restarts, resets correctly | 🟠 High | `onboardingRestartInvariant.test.ts` |
| O-11 | Welcome-back page — shows correct step name, "继续完成" and "重新开始" CTAs work | 🟡 Medium | Manual DevTools |
| O-12 | Anonymous mode — personality test available without login | 🟡 Medium | `anonymousOnboarding.test.ts` |
| O-13 | Swipe-back safety — `isExiting` flags reset on `useDidShow` | 🟡 Medium | Manual DevTools |

---

## 2. Mini-Program — Matching Flow

| # | Test Case | Priority | How to Verify |
|---|-----------|----------|---------------|
| M-01 | View available event pools on Discover | 🔴 Critical | Manual DevTools |
| M-02 | Register for an event pool | 🔴 Critical | `eventPoolRegistration.test.ts` + mock env |
| M-03 | Match Compass — set strictness (0–100), temperature, dealbreakers | 🟠 High | `matchCompass.test.ts` |
| M-04 | Matching pending → matched state transition | 🔴 Critical | `poolMatchingService.test.ts` + `poolRealtimeMatchingService.test.ts` (42 tests) + mock env |
| M-05 | Group formation — correct sizes (4–6), no orphans, valid scores | 🔴 Critical | Mock env stress mode |
| M-06 | Match explanation display — chemistry, interests, archetypes | 🟠 High | `matchExplanationService.test.ts` |
| M-07 | Squad Unboxing reveal — animation, group cards, chemistry scores, no overlap between fixed stage and scroll content; gift box tap + ribbon drag/tap both trigger reveal | 🟠 High | `squadUnboxingViewModels.test.ts` + `composition.test.ts` + `useSquadUnboxingController.test.ts` + `DragRevealRibbon.test.ts` + `docs/runbooks/mini-program-squad-unboxing-smoke.md` (DevTools preview mandatory) |
| M-08 | Match Compass lock 24h before event | 🟡 Medium | Existing test coverage |
| M-09 | No matching if pool below minimum fill | 🟠 High | Existing test coverage |
| M-10 | Predictive Shell — discover/profiles/events/connections bundled response | 🟡 Medium | `shellDiscover.test.ts` |

---

## 3. Mini-Program — Icebreaker Sessions

| # | Test Case | Priority | How to Verify |
|---|-----------|----------|---------------|
| I-01 | Host starts session — breeze/glow/blaze tier, chat/mixed/competitive vibe | 🔴 Critical | `socialIcebreakerRoutes.test.ts` + mock env |
| I-02 | Warmup phase — topic generation, readiness tracking, common ground scoring | 🔴 Critical | Mock env |
| I-03 | Lie Detective V1 — statement generation, isLie secrecy, vote/reveal | 🔴 Critical | `socialIcebreakerRoutes.test.ts` |
| I-04 | Lie Detective V2 — user writes 2 tags, AI expands + inserts 1 fake | 🟠 High | `lieDetectiveV2.test.ts` |
| I-05 | Speed Friending — timer, rotation, all players complete | 🔴 Critical | `speedFriending.test.ts` (13 tests) + mock env |
| I-06 | Personality Dice — challenge generation, player completion | 🟠 High | `personalityDice.test.ts` (19 tests) + mock env |
| I-07 | Group Mirror — generate, answer, vote, reveal | 🟠 High | `microChallengeGroupMirrorV2.integration.test.ts` |
| I-08 | Undercover Word — word assignment, voting, reveal | 🟡 Medium | `undercoverWord.test.ts` (26 tests) + mock env |
| I-09 | Quip Battle — results, optimistic sync | 🟡 Medium | `quipBattleResultsAuth.test.ts` |
| I-10 | Auction — lot generation, English auction bidding, lot closing | 🟡 Medium | `auctionPhase.test.ts` (26 tests) + mock env |
| I-11 | Mini Script (bonus) — generate story, poll, game flow | 🟠 High | `miniscriptGameplay.test.ts` |
| I-12 | Bonus gate — host+player vote before mini_script entry | 🔴 Critical | `bonusGate.test.ts` (21 tests) + mock env |
| I-13 | Phase advance state machine — all transitions correct | 🔴 Critical | `socialIcebreakerRoutes.test.ts` + mock env |
| I-14 | Rejoin session after disconnect | 🔴 Critical | `socialIcebreaker.test.ts` + mock env |
| I-15 | Recap screen — all phase summaries rendered | 🟠 High | Mock env |
| I-16 | Moment Card server render (PNG) | 🟡 Medium | `momentCardRenderer.test.ts` |
| I-17 | Phase metrics (dwellTimeMs tracked on every advance) | 🟡 Medium | Mock env |
| I-18 | Run plan compilation — correct budget allocation, core fan, vibe weighting | 🟠 High | `runPlanCompiler.test.ts` |

---

## 4. Admin Portal

| # | Test Case | Priority | How to Verify |
|---|-----------|----------|---------------|
| A-01 | Admin login — super_admin / operator / viewer roles | 🔴 Critical | `adminAuth.test.ts` + manual |
| A-02 | RBAC — operator cannot access super_admin-only routes, viewer read-only | 🔴 Critical | `adminRbacCoverage.test.ts` |
| A-03 | Create / edit event pool — dates, group sizes, city, time slots | 🔴 Critical | Manual admin UI |
| A-04 | Run matching on a pool — trigger, monitor, view results | 🔴 Critical | Manual admin UI |
| A-05 | View pool stats — registrations, groups, fill rate, outcomes | 🟠 High | Manual admin UI |
| A-06 | Group outcomes — submit attendance, notes per group | 🟠 High | `eventGroupOutcomeRoutes.test.ts` |
| A-07 | Manage venues — CRUD, time slots, deals | 🟠 High | Manual admin UI |
| A-08 | Send notification — broadcast to pool, single user | 🟡 Medium | Manual admin UI |
| A-09 | Refund a payment — full flow through WeChat Pay | 🔴 Critical | `paymentService.test.ts` + manual |
| A-10 | Ban / unban user | 🟠 High | Manual admin UI |
| A-11 | City unlock report — thresholds, status transitions | 🟡 Medium | Manual admin UI |
| A-12 | Audit log entries for sensitive actions | 🟡 Medium | `adminAuditLogger.test.ts` |

---

## 5. Cross-Cutting

| # | Test Case | Priority | How to Verify |
|---|-----------|----------|---------------|
| C-01 | Feature flags respected at runtime | 🔴 Critical | `configValidation.test.ts` |
| C-02 | Error responses — consistent shape, client-safe, no leaked secrets | 🟠 High | Manual spot-check |
| C-03 | Session expiry → redirect to login | 🟠 High | Manual |
| C-04 | Payment flow — create order → WeChat Pay v3 → verify → entitlement | 🔴 Critical | `paymentService.test.ts` + manual |
| C-05 | Tab bar navigation — discover, connections, center, notifications, profile | 🔴 Critical | `tabBarConfig.test.ts` + manual |
| C-06 | CDN assets loading — mascot sprites, archetype images, phase icons | 🟡 Medium | Manual DevTools |
| C-07 | Predictive Shell prefetch on landing page | 🟡 Medium | `shellDiscover.test.ts` |
| C-08 | No stale phone login UI or 666666 references in mini-program | 🔴 Critical | Grep verification |

---

## 6. Mock Environment Verification

| # | Test Case | Priority | How to Verify |
|---|-----------|----------|---------------|
| MOCK-01 | `--smoke` mode creates 12 diverse users in < 30 seconds | 🟠 High | `node scripts/mock/mock-beta-env.mjs --smoke` |
| MOCK-02 | `--stress` mode creates 50 users, runs matching, verifies groups | 🟠 High | `node scripts/mock/mock-beta-env.mjs --stress` |
| MOCK-03 | Icebreaker simulation — all breeze phases complete without error | 🔴 Critical | `node scripts/mock/mock-beta-env.mjs --smoke --tier breeze` |
| MOCK-04 | Icebreaker blaze tier — extended phases all complete | 🟠 High | `node scripts/mock/mock-beta-env.mjs --smoke --tier blaze` |
| MOCK-05 | `--icebreaker-only` works on existing pool | 🟡 Medium | Manual |

---

## 7. Regression Guardrails (before every beta release)

Run these commands and verify all pass:
```bash
npm run guardrails              # Env, secrets, legacy, import checks
npm run check:full              # guardrails + lint + tests + build
npm run harness:gate            # 5-pillar quality gate
node scripts/auto/auto-eval.mjs --mode manual-report  # Auto-eval gate
```

## 8. Known Risks Not Fully Mitigated (post-beta follow-up)

| # | Risk | Status | Resolution |
|---|------|--------|------------|
### Resolved (tests written, backend built)

| # | Risk | Resolution |
|---|------|------------|
| R-01 | `auction` bid/coin state machine | 26 tests in `auctionPhase.test.ts` — generate-lots, bid, close-lot, full integration |
| R-02 | `undercover_word` phase — no dedicated test | 26 tests in `undercoverWord.test.ts` — generate, describe, vote, reveal, next-round |
| R-03 | `personality_dice` — no dedicated test | 19 tests in `personalityDice.test.ts` — generate, complete, allCompleted, edge cases |
| R-04 | `poolRealtimeMatchingService` | 42 tests in `poolRealtimeMatchingService.test.ts` — pool validation, time decay, threshold, scanAll |
| R-05 | Mini-program icebreaker — zero component tests | 6 files, 109 tests in `icebreaker-session/__tests__/` — model, phaseUtils, warmup, labels, celebration |
| R-06 | `speed_friending` — zero server implementation | Full backend: routes (GET/next-round/complete), auto-init on advance, round-robin pairing, state, registry, advance guard (13 tests). Mini-program: `SpeedFriendingPhaseView` with my-pair highlight, bye state, stagger animations, reduced-motion support, haptics. Phase icon asset delivered. |

### Active (requires environment setup)

| # | Risk | Mitigation |
|---|------|------------|
| R-07 | Mock env script not runtime-tested | Syntactically verified. Requires PostgreSQL + dev server. Schema fix for `feature_flags` applied. Run: `node scripts/mock/mock-beta-env.mjs --smoke` on dev machine with Docker PostgreSQL.

## 9. Developer Quickstart — Running the Mock Environment

### Prerequisites
```bash
# In .env, ensure these are set:
NODE_ENV=development
ENABLE_DEV_AUTH_TOOLS=1
ADMIN_CREATE_SECRET_KEY=<your-secret>

# Start the server
npm run dev:server
```

### Usage
```bash
# Smoke test — 12 users (one per archetype), full pipeline
ADMIN_CREATE_SECRET_KEY=<your-secret> node scripts/mock/mock-beta-env.mjs --smoke

# Stress test — 50 users, full pipeline
ADMIN_CREATE_SECRET_KEY=<your-secret> node scripts/mock/mock-beta-env.mjs --stress

# Seed-only (no matching or icebreaker)
ADMIN_CREATE_SECRET_KEY=<your-secret> node scripts/mock/mock-beta-env.mjs --seed-only --users 20

# Icebreaker replay on existing pool
ADMIN_CREATE_SECRET_KEY=<your-secret> node scripts/mock/mock-beta-env.mjs --icebreaker-only --pool-id <id> --tier breeze --vibe chat
```

### What to Check
The script outputs a manifest to `tmp/mock-users.json`. Key things to verify:
- All users created with correct archetypes
- All users placed in groups (matching)
- Icebreaker advances through all phases without 4xx/5xx errors

---

## 10. 中文摘要 — JoyJoin Beta 测试总览

### 测试范围
| 模块 | 测试项数 | 关键测试点 |
|------|---------|-----------|
| 注册与引导流程 | 13 | 微信登录、人格测试V4、基础资料5步骤、兴趣选择、预览确认、`nextStep`路由 |
| 匹配流程 | 10 | 活动池报名、Match Compass偏好、小组分组、配对分数、Squad Unboxing动画 |
| 破冰环节 | 18 | 9种破冰玩法（狼人杀、拍卖、短聊等）、加分关卡、状态恢复、阶段推进 |
| 管理后台 | 12 | 角色登录、活动池管理、触发匹配、退款、封禁用户、审计日志 |
| 跨功能 | 8 | 功能开关、错误提示、支付流程、Tab导航、CDN资源加载 |

### 优先级分布
- 🔴 关键（20项）— 必须验证通过
- 🟠 高（19项）— 建议验证
- 🟡 中（18项）— 可选

### 新增交付物（12 个测试文件 + 1 个模拟脚本 + Speed Friending 后端实现）

| 交付物 | 测试数 | 说明 |
|--------|--------|------|
| 模拟环境 `scripts/mock/mock-beta-env.mjs` | — | 自动创建12/50用户 → 触发匹配 → 模拟破冰全流程 |
| `computeOnboardingNextStep.test.ts` | 21 | 覆盖所有`nextStep`状态和检查点恢复 |
| `completeOnboardingRoutes.test.ts` | 15 | 引导完成接口的完整参数验证 |
| `speedFriending.test.ts` | 13 | 速配阶段注册、运行计划、轮换配对算法 |
| `bonusGate.test.ts` | 21 | 加分关卡的主客投票全流程 |
| `auctionPhase.test.ts` | 26 | 拍卖生成、竞价、关单、完整集成流程 |
| `undercoverWord.test.ts` | 26 | 卧底词生成、描述、投票、揭示、下一轮 |
| `personalityDice.test.ts` | 19 | 个性骰子生成、完成、全完成、边界条件 |
| `poolRealtimeMatchingService.test.ts` | 42 | 实时匹配、时间衰减、阈值评估、全局扫描 |
| `icebreakerSessionModel.test.ts` | 41 | 会话模型、显示名、用户原型、参与者派生 |
| `warmupAndPhaseLogic.test.ts` | 18 | 原型混合文本、下一阶段选择、淘汰逻辑 |
| `phaseUtils + miniscriptLabels + phaseViews + celebrationAssets` | 50 | 阶段标签、情境选项、情绪标签、资源验证 |
| Speed Friending 后端 | — | 完整路由、循环轮换配对、状态管理、阶段注册、功能开关 |

**共计：** 292 个新测试，全部通过

### 运行时注意事项
- 模拟脚本需 PostgreSQL + 开发服务器：设置 `NODE_ENV=development ENABLE_DEV_AUTH_TOOLS=1` 后运行 `node scripts/mock/mock-beta-env.mjs --smoke`
- 已修复 `feature_flags` 表缺失问题（`packages/shared/src/schema/_definitions.ts`）

### 测试前准备工作
```bash
# 1. 确保环境变量正确
export NODE_ENV=development
export ENABLE_DEV_AUTH_TOOLS=1
export ADMIN_CREATE_SECRET_KEY=<your-secret>

# 2. 启动服务器
npm run dev:server

# 3. 运行回归测试
npm run test -w @joyjoin/server

# 4. 启动模拟环境
node scripts/mock/mock-beta-env.mjs --smoke

# 5. 参考本文档的64项测试用例逐一手动验证
```

---

## Sign-off

- [ ] All 🔴 Critical items verified
- [ ] ≥ 90% of 🟠 High items verified
- [ ] Mock env `--smoke` passes end-to-end
- [ ] Mock env `--stress` passes end-to-end
- [ ] Server regression suite passes: `npm run test -w @joyjoin/server`
- [ ] Guardrails pass: `npm run guardrails`
- [ ] Harness gate passes: `npm run harness:gate`
- [ ] Legal checklist reviewed: `docs/product/legal-open-beta-checklist.md`
