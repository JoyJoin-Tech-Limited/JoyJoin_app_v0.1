# 悦仔破冰副驾 M1 · 技术规格

> 日期：2026-10-26 ｜ 状态：可开工（待任务拆解与 Sprint Contract）
> 上游：[`../deliberations/2026-10-26-icebreaker-agent-m1-deliberation.md`](../deliberations/2026-10-26-icebreaker-agent-m1-deliberation.md)（§11 三项拍板、§13 六条设计修订）
>  UI 契约：[`icebreaker-agent-m1-uiux-20261026.md`](./icebreaker-agent-m1-uiux-20261026.md)（本文不重复视觉规格，只实现其状态与时机）
> 范围：**2 phase 观察（warmup + micro_challenge）、1 phase 可行动（warmup 换一组话题卡）**。不含长期记忆、Director、自动推进/点名/换题。
> 本文所有字段名、路由、helper 均已对照现有代码核实；标注「新增」的为待建。

---

## 0. 关键现状事实（决定了设计，勿再推翻）

| 事实 | 出处 | 对 M1 的约束 |
|---|---|---|
| state 类型是 `SocialSessionState`，warmup 字段含 `warmupTopics / warmupTopicsMeta / warmupTopicsStatus / currentTopicIndex / warmupReadyUserIds / selectedMood` | `packages/shared/src/socialIcebreaker.ts:619-708` | 新字段挂在这里，全部 optional |
| **session 没有任何 revision / 乐观锁**，`updateSession` 整写无版本条件 | `lib/socialIcebreakerStore.ts:195-223` | 必须新增 `warmupTopicSetRevision`，提交走原子路径 |
| `POST /topics` 已能整组重生成，但会写 `warmupTopicsStatus='generating'`、重置 `currentTopicIndex=0`、**清空 `warmupReadyUserIds`**，无幂等键 | `routes/socialIcebreaker.ts:832-988` | **agent 动作不复用此路由**；ready 状态不得丢失、不广播全桌 generating |
| `avoidTopics`、`dedupeKey`（去重窗口键，**非幂等键**）已存在 | 同上 + `socialIcebreakerAI/warmupTopics.ts:209-250` | 复用于换题去重 |
| `generateWarmupTopics` 自带 6s `raceWithTimeout` + curated fallback | `warmupTopics.ts:350-524` | 生成逻辑直接复用，不重写 |
| 忽略建议只是**客户端本地** `dismissedSuggestionAt`，服务端无此字段 | `pages/icebreaker-session/index.tsx:125-137` | 决策持久化是新建能力 |
| `sanitizeStateForClient` 无条件删 `xiaoyueAdaptiveSuggestion`，非 host 另有 miniScript 裁剪 | `routes/socialIcebreakerHelpers.ts:83-301` | agent Ask/策略必须按 host 裁剪，participant 不可见 |
| `getPhaseTimeoutMinutes(phase, state)` 已优先读 run plan `allocatedMinutes` | `xiaoyueAdaptiveEngine.ts:214-222` | 超时信号直接复用，不另算预算 |
| `computePulseSignals` 已有 `avgVibe / completionRate / activeRate / pulseCheckCount`；`pulseChecks[].vibe` 为 1/2/3 | `xiaoyueAdaptiveEngine.ts:20-74`、`socialIcebreaker.ts:158-161` | 信号层复用；`activeRate` 只记录不触发 |
| `logAITrace` 无 token 字段，且 `extra` 不会进 stdout JSON | `lib/aiTraceLogger.ts:44-191` | 成本证据改由 episode 承载（见 §7） |
| micro_challenge 完成字段 `challengeCompletedBy` 无时间戳 | `xiaoyueAdaptiveEngine.ts:21-74` | M1 在 micro_challenge 只用超时 + pulse，**不做 completionStall** |
| migration 数字序列最大 `0098`，journal 末尾是 seed 文件不能据此推断 | `apps/server/migrations/` | 下一个为 `0099` |

---

## 1. 运行时总览

```
host 的 3s 轮询 GET /:id
   └─ decideAgentTick（纯函数，确定性，0 LLM，0 DB 额外读）
        ├─ none / suppress          → 不写库，直接返回 state
        ├─ mark_candidate           → 只写 candidate 起始时间
        ├─ expire_ask               → 写 ask.status='expired' + episode
        └─ create_ask               → 写 host-only ask + episode
                                          ↓
host 点卡 → POST .../xiaoyue/agent/decision { askId, decision, idempotencyKey? }
   ├─ ignored / closed_session / action_failed_dismissed → 更新 policy + episode，立即返回
   └─ accepted → in-flight 去重 → generateWarmupTopics（6s 上限，curated fallback）
                 → 单事务原子提交（revision+1 + episode + 幂等键）
                 → 返回 succeeded / failed / unknown + 最新 state
                                          ↓
全端下一轮轮询看到 warmupTopicSetRevision 变化 → 360ms 内容 crossfade
```

**只有 host 的轮询驱动 tick**（participant 轮询不计算、不写库）。LLM 只出现在换题生成；Ask 文案默认策展模板（见 §5），因此**一次有效介入通常只有 1 次 LLM 调用**。

---

## 2. Shared 契约（`packages/shared/src/socialIcebreaker.ts`，全部新增 optional）

```ts
// 全端唯一事实：每次话题组成功写入都 +1（含旧 /topics 与 /start 预编译）
warmupTopicSetRevision?: number;       // 首次建立为 1
warmupTopicSetUpdatedAt?: number;      // epoch ms，换组时间
warmupTopicAdvancedAt?: number;        // epoch ms，最近一次 currentTopicIndex 变化
warmupTopicSetProvenance?: 'precompile' | 'host_manual' | 'agent';

xiaoyueAgent?: XiaoyueAgentState;

export interface XiaoyueAgentState {
  ask?: XiaoyueAgentAsk;                       // 同 phase 最多 1 条有效 pending
  policy: {
    proactiveDisabled: boolean;                // 「本场不再提示」
    ignoredStreak: number;                     // 连续 2 → 自动 proactiveDisabled
    cooldownUntilByKind: Partial<Record<XiaoyueAgentAskKind, number>>;
    lastAskAt?: number;
    askCount: number;                          // 每场 ≤3
    askCountByPhase: Partial<Record<SocialIcebreakerPhase, number>>; // 每 phase ≤1
  };
  candidate?: { key: string; since: number };  // 强信号持续计时，避免写历史序列
  lastAction?: XiaoyueAgentActionSnapshot;     // rejoin 恢复执行中/结果用
}

export type XiaoyueAgentAskKind = 'warmup_rotate_topics';
export type XiaoyueAgentReason = 'phase_overrun' | 'topic_stall' | 'pulse_low';
export type XiaoyueAgentAskStatus =
  | 'pending' | 'accepted'
  | 'ignored' | 'expired' | 'closed_session' | 'action_failed_dismissed'
  | 'succeeded' | 'failed' | 'unknown';

export interface XiaoyueAgentAsk {
  id: string;                                  // ask_<uuid>
  kind: XiaoyueAgentAskKind;
  phase: 'warmup';                             // M1 只有 warmup 可行动
  reason: XiaoyueAgentReason;
  createdAt: number;
  baseTopicSetRevision: number;                // 提交时的乐观校验
  copy: { kicker: string; question: string; hint: string; cta: string };
  meta: AIResponseMeta;                        // per-item AIGC，复用现有类型
  status: XiaoyueAgentAskStatus;
  decisionAt?: number;
  action?: {
    idempotencyKey: string;                    // host 首次采纳生成，重试沿用
    startedAt?: number;
    finishedAt?: number;
    resultRevision?: number;
    errorCode?: string;
  };
}
```

**裁剪（`sanitizeStateForClient` 修改）**：`requestingUserId !== state.hostUserId` 时删除整个 `xiaoyueAgent`；host 保留。`warmupTopicSetRevision` 等四个话题字段对全端可见（participant 需要它驱动过渡）。**participant 永远收不到 Ask、policy、action 状态。**

---

## 3. 信号与 tick 纯函数（新增 `apps/server/src/lib/xiaoyueAgentTick.ts`）

### 3.1 信号契约

| 信号 | 计算 | 默认阈值（env 可调） | 可单独触发 |
|---|---|---|---|
| `phase_overrun` | `elapsed / getPhaseTimeoutMinutes(phase, state)` | ≥1.25 且持续 ≥60s | ✅（warmup + micro_challenge 观察） |
| `topic_stall` | `now - warmupTopicAdvancedAt`（缺省回退 `phaseStartedAt`） | ≥180s 且持续 ≥60s | ✅（仅 warmup） |
| `pulse_low` | 近 5 分钟新增 `pulseChecks`，最新 vibe=1 或均值 ≤1.5 | 持续 ≥30s | ✅（最强信号） |
| `activeRate` | 复用 `computePulseSignals` | — | ❌ **只记录，永不触发** |
| `completionRate / readyRate` | 同上 | — | ❌ 仅作恢复评估与 episode 上下文 |
| `completion_stall` | 需要完成时间戳，**M1 不建** | — | ❌ 缺数据即不触发 |

### 3.2 抑制规则（任一命中即 `suppress`，不写 Ask）

`flag off` ｜ 非 host 轮询 ｜ `currentPhase` 不在 {warmup, micro_challenge} ｜ micro_challenge 无可行动作（只记录信号，**不生成带采纳承诺的 Ask**）｜ `policy.proactiveDisabled` ｜ 已有 pending/accepted Ask ｜ 距 `lastAskAt` <5min ｜ 该 kind 冷却中 ｜ `askCount ≥3` ｜ 该 phase 已有过 Ask ｜ `warmupTopicsStatus==='generating'` ｜ 仪式/庆祝等 overlay 由客户端抑制展示、服务端不因此新建 Ask ｜ session 已结束。

`expired`（phase 切换、证据失效、被新 Ask 取代）**不计入 ignoredStreak、不触发冷却**。

### 3.3 函数签名（无 LLM、无 DB、可单测回放）

```ts
export interface XiaoyueAgentTickInput {
  state: SocialSessionState;
  now: number;
  viewerIsHost: boolean;
  flagEnabled: boolean;
  config?: Partial<XiaoyueAgentConfig>;
}
export type XiaoyueAgentTickDecision =
  | { type: 'none' }
  | { type: 'suppress'; reason: string }
  | { type: 'mark_candidate'; key: string; since: number }
  | { type: 'clear_candidate' }
  | { type: 'expire_ask'; askId: string; reason: 'phase_changed' | 'evidence_stale' }
  | { type: 'auto_disable'; reason: 'ignored_streak' }
  | { type: 'create_ask'; draft: Omit<XiaoyueAgentAsk, 'id' | 'createdAt' | 'status'> };

export function decideAgentTick(input: XiaoyueAgentTickInput): XiaoyueAgentTickDecision;
```

`create_ask` 只在 warmup 产出；micro_challenge 的观察结果只进 episode `signal_snapshot`，供 Stage A 分析与未来第二动作评估。

---

## 4. 路由（新增，均挂在现有 `socialIcebreakerXiaoyue.ts` 同域）

### 4.1 `POST /api/social-icebreaker/:socialSessionId/xiaoyue/agent/decision`

```ts
// zod body
{
  askId: string.min(1),
  decision: z.enum(['accepted','ignored','closed_session','action_failed_dismissed']),
  idempotencyKey: string.min(8).max(80).optional(), // accepted 必填
  clientActionId: string.optional()                 // 仅 trace 关联
}
```

处理顺序：`requireAuthenticatedUserId` → `resolveSession` → `isHostAuthorized` → ask 存在且属本场 → `currentPhase === ask.phase` → 按 decision 分支。

- `ignored`：`ignoredStreak+1`、该 kind 冷却 +10min、≥2 则 `proactiveDisabled=true`；写 episode；返回最新 state。
- `closed_session`：`proactiveDisabled=true`，当前 Ask 记 `closed_session`；返回 state。
- `action_failed_dismissed`：只关闭卡片，**不加 ignoredStreak、不冷却**。
- `accepted`：进入 §5 执行流程，同步返回终态。

**错误必须同时带 `code` 与 `error`**（现有 xiaoyue 老路由只有 `error`，新路由不沿用这个缺陷）：
`400 AGENT_ASK_NOT_FOUND` / `409 AGENT_ASK_EXPIRED` / `409 AGENT_PHASE_MISMATCH` / `409 AGENT_ACTION_IN_FLIGHT` / `403 AGENT_NOT_HOST` / `410 SESSION_EXPIRED`。

成功响应：`{ status: 'succeeded'|'failed'|'unknown'|'decision_recorded', topicSetRevision?, state }`。

### 4.2 `POST /api/social-icebreaker/:socialSessionId/xiaoyue/agent/policy`

body `{ proactiveEnabled: boolean }`，host only，用于菜单「重新开启主动提示」；开启时清 `ignoredStreak`。写 episode `policy_changed`。

### 4.3 不新增 tick 路由

tick 挂在现有 `GET /:id` 轮询内、仅 host + flag on；无状态变化则不写库。旧的 `adaptive-suggestion` 手动入口**保持不变**，与主动 Ask 互斥展示由客户端保证。

---

## 5. 真实动作：换一组话题卡（原子提交 + 幂等）

**不复用 `POST /topics`**，新增内部函数 `executeWarmupTopicRotation`（`apps/server/src/lib/xiaoyueAgentActions.ts`）：

1. **前置去重**：若 `xiaoyueAgent.lastAction.idempotencyKey` 已提交 → 直接返回已存结果；进程内 `Set` 以 `askId` 防并发（仿 `fuseExecutionsInFlight`）。
2. **生成**（事务外，6s 硬上限）：复用 `generateWarmupTopics({ mood: state.selectedMood ?? 'relaxed', participantCount: roster.length, avoidTopics: 现有问题文本, dedupeKey: state.icebreakerSessionId, vibe: state.vibe, roster })`。curated fallback 也是合法成功结果，记 `fallbackUsed`。
3. **单事务提交**：锁定 session 行 → 重读最新 state → 校验 `currentPhase==='warmup'` 且 `warmupTopicSetRevision === ask.baseTopicSetRevision`（不符则 `unknown`/`failed`，不覆盖他人新题）→ 只合并 owned fields：

   ```ts
   warmupTopics = 新题;  warmupTopicsMeta = meta;
   warmupTopicSetRevision = old + 1;
   warmupTopicSetUpdatedAt = now;  warmupTopicAdvancedAt = now;
   warmupTopicSetProvenance = 'agent';
   currentTopicIndex = 0;
   // 保留 warmupReadyUserIds；不写 warmupTopicsStatus='generating'
   xiaoyueAgent.ask.status = 'succeeded'; lastAction = {...};
   ```
   同一事务写入 episode `ask_decision` + `action_commit`（带幂等键）。
4. **幂等约束**：episode 表对 `(socialSessionId, idempotencyKey)` 建部分唯一索引；冲突即读取已提交结果返回，**不重复生成、不重复加 revision**。
5. **结果判定**：提交成功=`succeeded`；生成/提交明确失败=`failed`（旧题保留，可重试）；超时或连接中断导致无法确认=`unknown`（客户端「重新同步」，以服务端 revision 为准，重试沿用同一幂等键）。

**旧路径同步改造（小但必需）**：`POST /topics` 与 `/start` 预编译成功写题时也要 `warmupTopicSetRevision` 递增/初始化、写 `warmupTopicSetUpdatedAt`，并更新 `warmupTopicAdvancedAt`（话题推进处同理）。否则全端事实不唯一、stall 信号会撒谎。

**文案**：M1 Ask 用 `packages/shared/src/copy/icebreakerSession.ts` 的 4 条策展模板按 `reason` 选择，**不调 LLM**，因此 Ask 的 `meta` 走 `buildFallbackAIMeta` 类策展语义、无 AIGC 角标；换题结果的 AIGC 仍由 `warmupTopicsMeta.aigc.aiGenerated` 决定并展示在话题卡。若未来启用 LLM 改写 Ask，必须新增 `promptVersion` 并把角标条件切到 per-item meta。

---

## 6. Feature flag 与配置

- 新 flag：`icebreakerAgentCopilotEnabled` → env `ICEBREAKER_AGENT_COPILOT_ENABLED`，**默认 `true`**（2026-10-26 产品决定；flag 保留为 kill switch）。
- 同步三处必需 + 两处文档：`lib/featureFlags.ts` 的 `FLAG_ENV_MAP` 与 `DEFAULT_FLAG_VALUES`；`packages/shared/src/copy/featureFlags.ts` 的 section（`icebreaker-core`）/label/description；`.env.example`；`docs/agent-context/feature-flags.md`、`docs/agent-context/social-icebreaker.md`。契约测试 `featureFlagDefaultsContract` / `featureFlagCopyContract` 会强制。
- **不需要**经 `/api/auth/user` 暴露给客户端：Ask 由轮询 state 驱动，无 Ask 即无 UI。
- 阈值集中在新增 `lib/xiaoyueAgentConfig.ts`：`maxAsksPerSession=3`、`maxAskPerPhase=1`、`anyAskCooldownMs=5min`、`sameKindCooldownMs=10min`、`ignoredStreakDisable=2`、`overrunRatio=1.25`、`signalSustainMs=60s`（pulse 30s）、`topicStallMs=180s`、`actionBudgetMs=6000`。运行时只有读，不做每 tick fan-out。

---

## 7. Episode 事实日志（不是记忆系统）

**新表 `social_agent_events`**，定义放 `packages/shared/src/schema/_definitions_social.ts`，从 `schema/socialIcebreaker.ts` 导出；repository 新增 `apps/server/src/repositories/socialAgentEventsRepo.ts`（`append` / `findByIdempotencyKey` / `listForSession` 仅供评测）。

| 列 | 说明 |
|---|---|
| `id` | uuid 主键 |
| `socialSessionId` | 索引；**不做跨场读取 API** |
| `phase` / `kind` | kind：`signal_snapshot` / `ask_created` / `ask_decision` / `action_commit` / `action_failed` / `policy_changed` |
| `askId` / `idempotencyKey` | 后者仅在动作类事件有值，配部分唯一索引 |
| `actorUserId` | 仅 host；**不记录 participant 个体行为** |
| `signals` jsonb | 触发时的聚合信号快照（含 activeRate，仅供研究） |
| `payload` jsonb | copy reason、`AIResponseMeta`（promptVersion/fallbackUsed/provider/latency）、revision 前后值、errorCode、**token 用量与估算成本** |
| `createdAt` | epoch/ms 时间戳 |

- **恢复评估**：动作提交后由后续 tick 在 +60s/+180s 各写一条 `signal_snapshot`（含 `topicAdvancedSince`、`completionRate`、`pulseChecks` 增量），并把「连续忽略 → 降频/关闭」体现在后续 `suppress` 决策里——这就是反馈进入下一次决策，不需要新 UI。
- **成本可验证**：因为 `logAITrace` 无 token 字段且 `extra` 不落盘，token/成本写进 `payload`；同时顺手修 `aiTraceLogger` 的 `extra` 透传（小改 + `aiTraceLogger.test.ts` 补断言），否则 AITrace 与 episode 对不上。
- **隐私与保留**：只存聚合信号与 host 决策；不存个人活跃度排名、不存情绪推断；90 天删除（随现有清理任务或新增每日 job）；M1 无任何跨场记忆读取。
- 迁移：`0099_social_agent_events.sql`，走 `npm run db:generate -- --custom` → `npm run db:rebuild-journal` → `npm run db:journal-check`；生产手动 `psql` 执行，部署脚本不自动 DDL。

---

## 8. 客户端接线（按 UI 契约，不重复视觉）

- 新增 `components/XiaoyueAgentAsk.tsx/.scss`、`viewModels/xiaoyueAgentAskModel.ts`、`hooks/useXiaoyueAgentAsk.ts`；SCSS 由 `pages/icebreaker-session/index.scss` `@use`，TSX 不做 side-effect import。
- `XiaoyueSessionShell` 增加 `agentAsk` 插槽；**不复用 adaptiveSuggestion 的 8s timer**；主动 Ask 与旧建议/ coachmark 互斥。
- `useSocialActions` 为 agent decision 建独立 action key 与 **6s 契约**（0ms 请求、4s 慢提示、6s 三态）；不复用 topics 的 8s + backoff `[2000,5000,10000]` 冒充。
- `WarmupCardSlot` 以 **`warmupTopicSetRevision`** 触发 360ms 双段 crossfade（不再只看 `currentTopicIndex`）；reduced-motion 直接替换；rejoin 不补播。
- `index.tsx` 负责 host/phase 门控、overlay 仲裁、`useResetOnShow` 清理瞬态。
- 埋点走 **`/api/analytics/social-icebreaker`**（不是 discover）：新增 `agent_ask_shown` / `agent_ask_decision` / `agent_action_result` / `agent_policy_changed`，同步 client union 与 server `SOCIAL_ICEBREAKER_EVENT_TYPES`，由 `socialIcebreakerAnalyticsWhitelist.test.ts` 锁 parity。metadata 只带 askId/kind/reason/decision/result/latency/fallbackUsed。

---

## 9. Golden sessions 与评测（前置，先于行为上线）

- 纯函数 `decideAgentTick` 使评测无需 LLM、无需 DB：fixtures 为 `initialState + events[{t,type,payload}] + expected{ ask:'never'|{byT,reason?}, maxAsks }`。
- 位置：`apps/server/src/__tests__/fixtures/xiaoyueAgent/*.json`（20 场）+ `xiaoyueAgentTick.test.ts`（参数化回放，进 CI）+ 可选 `scripts/replay-xiaoyue-agent.ts` 输出指标。
- **20 场构成**：8 场该介入（超时/话题停滞/pulse 走低/组合，考召回 ≥90%）；8 场不该介入（**≥4 场健康安静**：activeRate 低但节奏正常、无负面自评；每 20 分钟误 Ask ≤1）；4 场边界（弱网重试、rejoin、phase 切换瞬间、single-test）。
- 另需契约测试：sanitizer 不泄漏 agent 字段给 participant；decision 路由 host/phase/幂等；revision 在三条写题路径一致递增；`warmupReadyUserIds` 在 agent 换题后保留。

---

## 10. 验收映射与上线顺序

| 验收 | 由什么证明 |
|---|---|
| AC1 召回/误报 | §9 回放测试 + 指标输出 |
| AC2 30s 内 Ask 到达 | tick 在 host 轮询内 + 端到端试局计时（无新增轮询间隔） |
| AC3 100% host 门控/冷却/关闭 | 路由测试 + policy 持久化测试 |
| AC4 6s 真实动作/幂等/rejoin | §5 事务与幂等测试 + 真机竞争测试 |
| AC5 可追溯 + 反馈复用 | episode 全链查询 + ignoredStreak/降频单测 |
| AC6 安全合规 | per-item AIGC 测试、违禁词检查、微信备案与重新提审（**上线前置，非工程可豁免**） |
| AC7 成本 | episode token/成本汇总；目标 ≤12 次/场，硬上限 18 次/¥0.20 |
| 设计门槛 | UI 契约 §8 清单：真机 + 分包样式 + reduced-motion + 双视角审计 |

**顺序**：dark 合并（flag off）→ 内部 single-test 局 → 深圳 Stage A 24 桌对照 → 达标才对外称「有界破冰智能体」→ Stage B 付费验证。任何 P0（心理安全、AIGC 漏标、投诉 ≥2%、成本超限）立即 `icebreakerAgentCopilotEnabled=false` 回退到现有手动建议。

---

## 11. 任务拆解（可直接开工）

| # | 任务 | 主要文件 | 粗估 |
|---|---|---|---|
| T1 | shared DTO + revision 三路径写点 + sanitizer 裁剪 + 测试 | `socialIcebreaker.ts`、`socialIcebreakerHelpers.ts`、`socialIcebreaker.ts`(/topics、预编译) | 1.5d |
| T2 | tick 纯函数 + 配置 + 20 场 golden 回放（**最先做**） | `lib/xiaoyueAgentTick.ts`、`xiaoyueAgentConfig.ts`、fixtures/tests | 2.5d |
| T3 | episode 表 + migration 0099 + repo + AITrace extra 修复 | `_definitions_social.ts`、`socialAgentEventsRepo.ts`、`aiTraceLogger.ts` | 1.5d |
| T4 | decision/policy 路由 + 原子动作 + 幂等 + episode 写入 | `socialIcebreakerXiaoyue.ts`、`lib/xiaoyueAgentActions.ts` | 3d |
| T5 | flag 三处 + 文档 + .env.example | 见 §6 | 0.5d |
| T6 | host Ask UI + 状态机 + 6s 契约 + 埋点 | mini-program（见 §8） | 3d |
| T7 | participant revision crossfade + reduced-motion + rejoin | `WarmupCardSlot` 等 | 1d |
| T8 | 真机/分包样式/性能/双视角审计 + Stage A 试点准备 | 全链路 | 2d |

合计约 **15 人日工程**（不含运营试点与合规流程），与 M1 的 4–6 周窗口一致。**T2 必须先于 T4/T6 完成**——没有回放证据，不进入真实桌。

---

## 12. 契约锁定后的实现修订（R2，2026-10-26）

> 与上文冲突时以本节为准。完整验收见 `.git/.orchestration/sprints/sprint-contract.icebreaker-agent-m1.md`（status=accepted）。

1. **幂等唯一键只给 `action_commit`**：`(social_session_id, idempotency_key)` 为**部分唯一索引（`WHERE idempotency_key IS NOT NULL`）**；`ask_decision / action_failed` 的 `idempotency_key` 列保持 NULL，键值放 `payload`，否则失败后同 key 重试永远无法写入。必须有 `failed → 同 key retry → succeeded` 测试。
2. **成本硬上限要「调用前预检」**：state 的 `xiaoyueAgent` 内新增 `agentLlmCallCount / agentEstimatedCostYuan`（随 `xiaoyueAgent` 一起对非 host 整体裁剪）。每次 agent LLM 调用前，以本次保守成本上界预检：`current + estimate > 0.20` → 直接 curated-only、0 次 LLM（例：`0.199 + 0.0104` 必须阻断）；恰好 0.20 允许。调用次数 ≥18 同理直接 curated-only。curated-only 路径不得触发任何 LLM。
3. **`logAITrace` 的 `extra` 修复 = 非 PII 白名单透传**，不是全量透传：只允许数值/布尔类安全字段（latencyMs、token 用量、estimatedCostYuan、fallbackUsed 等）；`mixText / blockedWord / roster / archetype / prompt` 等文本与画像绝不进 stdout，并有测试。
4. **真实展示 ≠ `ask_created`**：client 在 Ask 首次前台可见时发射一次 `agent_ask_shown`（带 `askId`），轮询/rejoin 不重复；分析侧用 episode + analytics 以 `askId` join。
5. **participant 仍可收到 revision 四字段**，但整个 `xiaoyueAgent`（含成本字段）对非 host 不存在。
6. **快照两类分别限频**：动作恢复 `signal_snapshot` 在 +60s/+180s 各恰好一次；micro_challenge 观察快照每 phase ≤1 条/5min，不与恢复快照混算。
7. **episode 90 天删除任务必须接线**并有 89/90 天边界测试；`listForSession` 仅供评测，不新增任何客户端 episode 读取路由。
8. **测试文件命名（待新增）**：server `src/__tests__/xiaoyueAgentTick.test.ts`、`xiaoyueAgentReplay.test.ts`、`xiaoyueAgentSanitizer.test.ts`、`warmupTopicSetRevision.test.ts`、`xiaoyueAgentRoutes.test.ts`、`xiaoyueAgentActions.test.ts`、`socialAgentEventsRepo.test.ts`；client `apps/mini-program/src/pages/icebreaker-session/__tests__/xiaoyueAgentAsk.test.tsx`、`useXiaoyueAgentAsk.test.ts`、`warmupTopicRevisionCrossfade.test.tsx`、`xiaoyueAgentAskAigc.test.tsx`。扩展已有：`featureFlagDefaultsContract.test.ts`、`featureFlagCopyContract.test.ts`、`socialIcebreakerAnalyticsWhitelist.test.ts`、`aiTraceLogger.test.ts`、`WarmupCardSlot.aigc.test.tsx`。

---

## 13. 实现状态（2026-10-26）

**代码已落地并默认开启（`ICEBREAKER_AGENT_COPILOT_ENABLED=true`，2026-10-26 产品决定）；flag 仍为 kill switch，OFF = 零 Agent 行为。真实桌 / 真机 / 微信提审仍是发布前置。**

| 层 | 状态 | 落点 |
|---|---|---|
| 确定性策略内核 | ✅ | `apps/server/src/lib/xiaoyueAgentPolicy.ts`（纯函数；31 项策略测试 + 20 场 golden replay 全绿） |
| 状态 DTO / revision / sanitizer | ✅ | `packages/shared/src/socialIcebreaker.ts`、`socialIcebreakerHelpers.ts`（participant 无 `xiaoyueAgent`） |
| 三条写题路径 | ✅ | `/start` 初始 revision 1、`/topics` + heal 整组 +1、下一题只更新 `warmupTopicAdvancedAt`（`lib/warmupTopicSetRevision.ts`） |
| episode 事实表 | ✅ | `social_agent_events` + migration `0099` + 90 天 retention scheduler；仅 `action_commit` 有部分唯一幂等键 |
| 轮询 tick | ✅ | `GET /:id` 内 host-only、flag-gated；无独立后台循环；无 LLM |
| 真实动作 | ✅ | `POST .../xiaoyue/agent/decision` accepted → `executeWarmupTopicRotation`（事务外生成 + 单事务提交 + revision+1 + 保留 ready + 不广播 generating） |
| 决策 / 策略路由 | ✅ | `ignored` / `closed_session` / `action_failed_dismissed` / `policy`；全部 `{code,error}` 双写 |
| Host UI | ✅ | `XiaoyueAgentAsk` + `useXiaoyueAgentAsk`：无 8s 自动消失、0/4/6s 三态、幂等重试、关闭 toast、首次前台 shown 一次 |
| Participant 过渡 | ✅ | 仅服务端 revision 变化触发既有 360ms quiet crossfade；没有 toast / 触感 / 本地乐观 deck |
| 安全 / 合规 | ✅ 代码层 | host-only 投影、per-item AIGC（Ask 为策展文案故无角标）、成本调用前预检、flag off 零行为 |
| 发布门槛 | ⛔ 未完成 | 微信备案 + 重新提审、Stage A 24 桌行为证伪、真机矩阵（iOS/Android/弱网/rejoin）、双视角审计、30 天复购基线 |

**验证记录（2026-10-26）：** server 新增 8 个测试文件全绿；mini-program icebreaker-session 70 files / 822 tests 全绿；`build:weapp` 与 `verify:subpackage-styles` 通过（41 selectors in page WXSS）；guardrails 0 error。全量 server 测试仅 2 个与本变更无关的既有 `adminMetrics.ts sql.join` 失败。

