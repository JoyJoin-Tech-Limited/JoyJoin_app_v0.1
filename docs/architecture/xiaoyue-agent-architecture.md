# 悦仔 Agent 架构（端到端）

> **状态：** Active reference（2026-10-29）。实现会话报告了全量验证；kill switch 以及浮层仲裁 R1 / R6 / R10 的修复仍在进行且尚未验证；**尚未部署**。
> **读者：** 要改破冰链路、要评估「悦仔到底算不算 agent」、或要接手 W1–W3 画像管线的工程师与产品。
> **性质：** 解释性架构文档。规范细节仍以 `docs/design/icebreaker-agent-m1-tech-spec-20261026.md`（运行时契约）、`docs/design/icebreaker-guidance-quiet-concierge-20261027.md`（三个引导表面）、`docs/design/icebreaker-w1-w3-implementation-plan-20261027.md`（画像管线）为准；本文负责把三者拼成一张完整的图。
> **语言约定：** 正文中文；flag、事件名、函数名、PASS/FAIL 保持英文机器标识。

---

## 0. 一句话结论

悦仔不是「会聊天的 AI 主持人」，而是一个**有界的破冰副驾**：它观察一场已经开始的破冰局，只在证据足够时向 host 提一个可执行的问题，host 同意后它执行**一个**真实动作（换一组话题卡），然后观察结果，必要时恢复。它自己永远不推进流程、不替 host 决策、不对参与者说话。

整条链路分三层，每层职责单一且不可互换：

| 层 | 回答的问题 | 实现位置 | 是否含 LLM |
|---|---|---|---|
| **数据层** 群体画像（W1–W3） | 这一桌是什么样的人？该给什么节奏？ | `lib/tablePersona.ts`、`packages/shared/src/tableRhythm.ts`、`lib/icebreakerRosterSignals.ts` | 否（纯派生） |
| **决策层** 有界 agent 运行时 | 现在该不该说话？说什么？做完之后怎么样？ | `lib/xiaoyueAgentPolicy.ts` / `Runtime.ts` / `Actions.ts` / `Recovery.ts` | 决策**否**（纯函数）；动作层换卡时**可有界调用** LLM（见 §4.4） |
| **表面层** 三个安静的引导面 | 人怎么看见它、怎么否决它？ | `XiaoyueSessionShell`、`EventActivityGuide`、`HostTableBriefPopover`、`XiaoyueAgentAsk` | 否（策展文案） |

---

## 1. 四条不可协商的约束（决定了整个设计）

这四条是产品决策，不是技术偏好。任何后续改动若违反其中一条，架构就不成立了。

1. **有界 agent，不是聊天机器人。**
   循环必须是 `观察 → 向 host 提问 → 执行一个真实动作 → 观察结果 → 调整`。不允许多轮对话、不允许多动作连发、不允许「AI 觉得应该这样」直接改状态。

2. **不做 shadow mode。**
   相关 flag 默认 ON，语义是 **kill switch**，不是灰度开关。目标契约是：OFF 后不再产生新的 Agent 行为，host 不再收到 `xiaoyueAgent`，decision/policy 路由以结构化错误码拒绝且无副作用，并回到旧手动路径。**2026-10-29 修复中：** 审计发现此前 OFF 只停止 tick 与 recovery 写入，既有 projection 和路由仍可继续，完整保证当时不成立；后端正在实现上述契约，尚未验证。

3. **群像，不是个人。**
   画像只能聚合成「这一桌」，可见文案永远说「这桌」，绝不说「你是……」。W3 原始值不得进入提示词、participant DTO 或 episode facts；只能在 server 受控聚合后以桌级枚举或计数输出（见 §3.1）。

4. **host 是最终闸门，且必须零培训。**
   默认路径 = 预生成卡组 → 按 vibe 形成 4/5/6 张暖场卡（game / balanced / chat）→ host 显式点「进入下一题」。悦仔的所有主动性都必须经过 host 一次点击；host 不点，什么都不会发生。

---

## 2. 三层架构总览

```
                    ┌──────────────────────────────────────────────┐
   数据层            │  roster (already loaded, no extra query)     │
   W1–W3             │    ├─ archetype  → resolveRosterArchetype    │
                     │    ├─ interests  → taxonomy / synonym 归一   │
                     │    └─ ACOEXP     → role_results (bounded)    │
                     │              ↓                               │
                     │        deriveTablePersona()                  │
                     │   energy / depthAppetite / anchors /         │
                     │   diversity（全部是桌级聚合，无个人分）      │
                     └───────────────┬──────────────────────────────┘
                                     │
        ┌────────────────────────────┼─────────────────────────────┐
        ↓                            ↓                             ↓
  节奏出口                     生成出口                        文案出口
  applyTableRhythm        deriveTableAnchorsForGeneration   buildHostTableBrief
  (warmup ±5min,           (group_mirror ≤2 anchors,        (paceShort +
   总时长不变)              route 与 worker 共用)            anchorLabel)
        │                            │                             │
        └────────────────────────────┼─────────────────────────────┘
                                     ↓
                    ┌──────────────────────────────────────────────┐
   决策层            │  decideAgentTick()  ← 纯函数，无 IO          │
   有界 agent        │    signals → none / suppress / candidate /   │
                     │    expire_ask / auto_disable / create_ask    │
                     │              ↓                               │
                     │  runXiaoyueAgentTick()  (host-only, 3s poll) │
                     │              ↓ host 点「换」                 │
                     │  executeWarmupTopicRotation()  (6s deadline) │
                     │              ↓                               │
                     │  social_agent_events (append-only 事实)      │
                     └───────────────┬──────────────────────────────┘
                                     ↓
                    ┌──────────────────────────────────────────────┐
   表面层            │  活动说明书   EventActivityGuide (活动详情)  │
   三个安静的表面     │  当前环节提示  guidanceLine (session shell)   │
                     │  桌边小提示   HostTableBriefPopover (host)    │
                     │  主动建议     XiaoyueAgentAsk (host, 非模态)  │
                     └──────────────────────────────────────────────┘
```

关键点：**LLM 只出现在「生成内容」这一步，永远不出现在「决定流程」这一步。** 生成包括离线 / pre-generation 与 host 接受后的 live 有界调用，均可由策展内容兜底；只有决策天然确定、可单测回放，不能把所有内容生成统称为离线或可回放。

---

## 3. 第一层：群体画像（W1–W3）

### 3.1 三层数据边界

这是整套系统最重要的安全边界。三层不是按「数据来源」分，而是按**能不能进提示词**分。

| 层 | 内容 | 是否可进入提示词 | 去向 |
|---|---|---|---|
| **W1 聚合层** | 原型构成（12 原型计数）、桌级 energy/depth 分档、共享兴趣锚点、多样性计数 | 可以，且只能以聚合形式 | group_mirror 锚点、host brief 节奏、run plan 节奏 |
| **W2 流程层** | 阶段、时长、当前 revision、玩家数、pulse 聚合值 | 可以，只用于流程决策 | agent 信号、引导线 |
| **W3 禁区** | 个人 bio / 自由文本、对话内容、精确年龄/生日、性别、学历、细分行业、**个人 ACOEXP 分**、个人 pulse、匹配分数/chemistry、AI 推断的敏感特质 | **永不进入提示词、participant DTO 或 episode facts** | 原始值只在 server 受控聚合中使用；出口仅是桌级枚举与计数 |

W3 是**输出边界**，不是「server 从不读取」：个人 ACOEXP 会用于 roster 平均，`industryNicheLabel` 会形成 diversity bucket count（`lib/tablePersona.ts`、`lib/socialIcebreakerStore.ts`）。`deriveTablePersona` 不返回 user id、个人分数或原始行业标签；`group_mirror` 的提示词类型已经删掉 `participantNames` 字段。

### 3.2 一条推导管线，三个出口

所有画像推导都从**已经加载的 roster** 出发；3 秒轮询不得新增未受控的 roster / role_results 查询。唯一轮询内例外是 §5.3 的 anchor gate + 300 秒 memo，而不是每次轮询都读 `role_results`。

`apps/server/src/lib/tablePersona.ts`：

```ts
deriveTablePersona({ roster, roleResults? }) → {
  energy: 'low' | 'mid' | 'high',
  depthAppetite: TableRhythmAppetite,   // deep | mixed | light
  anchors: string[],                    // 桌级共享兴趣
  diversity: { ... }                    // 只有计数
}
```

能量分档阈值（写死并有测试）：

- `TABLE_ENERGY_LOW_MAX_X = 45`（X 均值 < 45 → low）
- `TABLE_ENERGY_HIGH_MIN_X = 70`（X 均值 ≥ 70 → high）
- `TABLE_ENERGY_HIGH_MIN_A = 40`（即使 X 很高，A < 40 也降级，避免把「话多但不放松」的桌判成高能量）
- `TABLE_PERSONA_MIN_TRAIT_SAMPLES = 3`（样本不足则退回原型构成推断，不硬算）
- `TABLE_PERSONA_LARGE_ROSTER = 6`、`TABLE_PERSONA_ANCHOR_LIMIT = 3`

**ACOEXP 刻度陷阱（已修）：** `assessmentRepo.normalizeRoleTraitScores` 只在 `testVersion === 1 && numeric <= 10` 时乘 10；V2/V4 本来就是 0–100。2026-10-28 QA 记录的旧缺陷是把 **V2** 低个位数的 0–100 分误放大，不是「所有 V4 用户都会变成 high」。

三个出口：

1. **节奏出口** — `packages/shared/src/tableRhythm.ts` `applyTableRhythm`：深度桌 warmup **最多 +5 分钟（上限 25）**，由单一 donor 阶段出资且 donor 保底 ≥4 分钟；轻快桌 warmup **最多 −5 分钟（下限 10）**。实际 shift 还受 warmup 余量及 donor / recipient 资格限制。**总时长不变，阶段不增不删不换序。**
2. **生成出口** — `lib/tableAnchorsForGeneration.ts` `deriveTableAnchorsForGeneration`：route 与 pre-generation worker **共用同一个锚点实现**，generator 再从实际使用的锚点选择 promptVersion，避免两条路径各自实现而漂移。
3. **文案出口** — `lib/hostTableBrief.ts` `buildHostTableBrief`：`paceShort` 由 `HOST_TABLE_BRIEF_PACE_BY_PERSONA[depth][energy]` 查表，`anchorLabel` 来自真实共享兴趣。

### 3.3 锚点选择为什么不是「取前 N 个」

`lib/icebreakerRosterSignals.ts` 的锚点排序是 **specificity → coverage → macro-category 多样性**，并对通用礼貌标签（咖啡 / 旅行 / 电影 / 美食 / 健身）降权。

原因：一桌 6 个人几乎必然都「喜欢美食」，这种锚点生成出来的破冰问题是废话。真正有用的是「都养猫」「都在做硬件」「都跑过马拉松」这类具体且有足够共享者的标签。门槛按出口区分：`deriveTablePersona` 在 roster ≥6 时要求 3 人、否则 2 人；host brief 用 `max(2, ceil(rosterSize / 2))`；通用 builder 默认 2 人（`lib/tablePersona.ts`、`lib/hostTableBrief.ts`）。不能把其中一个公式当成全管线统一门槛。

### 3.4 时长变更必须能落盘（曾经的隐形 bug）

`runPlanService.compileForSession` 会用画像调整节奏，但重编译只有在「形状」变化时才落盘。早期 `buildRunPlanShapeKey` 只比较阶段名序列，导致**纯时长调整被丢弃**（看起来生效，刷新就回退）。

现在 `apps/server/src/lib/runPlanShape.ts`：

```ts
buildRunPlanShapeKey(plan) → "phase:minutes|phase:minutes|...#total"
```

时长进入 key，纯时长变更可持久化。已知限制：`/start` 初始编译时还没有 roster，所以节奏调整从第 2 名成员加入或 tier reset 起才生效。

---

## 4. 第二层：有界 agent 运行时

### 4.1 决策内核是纯函数（这是可验证性的来源）

`apps/server/src/lib/xiaoyueAgentPolicy.ts` 里没有任何 IO：不读库、不发网络、不读时钟（`now` 由调用方传入）、不调 LLM。因此整条决策可以单测回放任意历史 session。

```ts
deriveAgentSignals(state, now, config?) → XiaoyueAgentSignals
decideAgentTick({ state, now, viewerIsHost, flagEnabled, config? })
  → { type: 'none' }
  | { type: 'suppress'; reason }
  | { type: 'mark_candidate'; key; since }
  | { type: 'clear_candidate' }
  | { type: 'expire_ask'; askId; reason: 'phase_changed' | 'evidence_stale' }
  | { type: 'auto_disable'; reason: 'ignored_streak' }
  | { type: 'create_ask'; draft }
```

内核本身不修改输入；`none` / `suppress` 不写状态，但 runtime 会持久化 `mark_candidate`、`clear_candidate`、`expire_ask`、`auto_disable` 与 `create_ask`，decision/policy 路由也会持久化 Ask 决定。纯的是决策计算，不是所有分支都无状态变化（`lib/xiaoyueAgentRuntime.ts`、`routes/socialIcebreakerXiaoyue.ts`）。

### 4.2 三个信号，两个强度等级

| 信号 | 判定 | 强度 |
|---|---|---|
| `phaseOverrun` | 当前阶段已耗时 ≥ 计划时长 × **1.25**，且持续 **60 秒** | 强（可单独触发） |
| `topicStall` | 当前话题卡 **180 秒**未推进或未换组，且持续 **60 秒** | 强（可单独触发） |
| `pulseLow` | 最近 **5 分钟**窗口内 pulse 偏低，持续 **30 秒** | 强（可单独触发，但需窗口内有数据） |
| `activeRate` | 参与活跃比例 | **弱：只记录，永不单独触发 Ask** |

`activeRate` 被刻意降级：它是结果指标，不是原因指标。用它触发提问会让 agent 在「大家正在安静听」的时候打断。

### 4.3 抑制、冷却与预算（防止 agent 变骚扰）

`XIAOYUE_AGENT_DEFAULT_CONFIG`：

| 参数 | 值 | 作用 |
|---|---|---|
| `maxAsksPerSession` | 3 | 一场最多 3 次主动建议 |
| `maxAsksPerPhase` | 1 | 每阶段最多 1 次 |
| `anyAskCooldownMs` | 5 分钟 | 任意两次建议的最小间隔 |
| `sameKindCooldownMs` | 10 分钟 | 显式忽略后，同类型建议的冷却时间 |
| `maxAgentLlmCalls` | 18 | 已提交的非 fallback 生成计数上限（见 §4.4） |
| `maxAgentEstimatedCostYuan` | 0.2 | 已提交非 fallback 生成的单场估算成本上限 |
| `warmupBudgetMinutes` | 20 | 无 run plan 时的阶段预算兜底 |
| `microChallengeBudgetMinutes` | 10 | 同上 |

阶段预算优先取真实 run plan 的 `allocatedMinutes`，取不到才用兜底常量。

**连续被忽略会自动闭嘴**：`applyXiaoyueAgentAskDecision` 在第二次 `ignored` 时直接置 `proactiveDisabled = true`；若旧状态已经 `ignoredStreak >= 2` 但尚未 disabled，tick 才返回 `auto_disable`。结果都是本场不再提示，host 的沉默是一种回答。

### 4.4 一次真实动作：换一组话题卡

`apps/server/src/lib/xiaoyueAgentActions.ts`：

```ts
executeWarmupTopicRotation({ ... }) → XiaoyueAgentActionOutcome
  status: 'succeeded' | 'failed' | 'unknown'
```

三条硬规则：

1. **原子提交 + 幂等**。整组话题卡带单调递增的 `topicSetRevision`（`lib/warmupTopicSetRevision.ts`）；重复点击或重试不会换两次。
2. **单一 6 秒截止线**。`AGENT_ACTION_DEADLINE_MS = 6_000`，`runWithAgentActionDeadline` 把「接受请求 → 终态」整体包住。超时返回 `unknown + AGENT_ACTION_DEADLINE_EXCEEDED`。
3. **原请求的迟到响应不能翻案**。一旦该请求判定 `unknown`，其迟到响应不得套用旧 snapshot 或把 UI 改成 success。显式「重新同步」是另一条路径：它可复用同一幂等键读取已提交结果并恢复对应状态，不能与迟到的原响应混为一谈。

服务端只做一件事：换话题卡。不改阶段、不改 host、不推进流程。

**这一步是有界的 LLM 调用点。** 换卡时会先问 `canUseAgentLlm(baseState, AGENT_TOPIC_CALL_ESTIMATE_YUAN)`（单次估算 `0.0104` 元）：

- 预算允许 → **尝试**生成新卡；roster 侧只投影归一后的 archetype 与 interests，由现有生成器形成聚合 archetype mix / shared interests。只有 `generated.meta.fallbackUsed === false` 时才令 `usedLlm = true`，并累加 `agentLlmCallCount` 与 `agentEstimatedCostYuan`；
- 预算用尽 / 无 provider / 非截止线生成失败 → 回落到策展卡组，`meta.fallbackUsed = true`，`usedLlm = false`（不记调用数与估算成本）；触及统一截止线则按上面的 `unknown` 规则处理；
- 成功提交时，`lastAction` 与 `action_commit` 都记录 `fallbackUsed` 与 `dedupeRelaxed`，所以事后能分辨这次换卡是 AI 生成的还是策展的。

上限由决策层的配置兜住：`maxAgentLlmCalls = 18`、`maxAgentEstimatedCostYuan = 0.2`。18 × 0.0104 = 0.1872 元，19 × 0.0104 = 0.1976 元，因此在从零开始、估算不变的序列里，**调用次数 cap 会先挡住第 19 次**，成本 cap 是第二道保险。当前 M1 只有 warmup 且 `maxAsksPerPhase = 1`，正常路径会先到 Ask cap，通常到不了这两个 LLM 上限；计数也不包含失败或 fallback 的 provider 尝试。**决策本身不调用 LLM**——LLM 只能改变「卡片内容」，不能改变「要不要换卡」。

### 4.5 观察结果：恢复快照

`apps/server/src/lib/xiaoyueAgentRecovery.ts`：`XIAOYUE_AGENT_RECOVERY_OFFSETS = [60, 180]`。

动作 `finishedAt` 后满 **60 秒**与 **180 秒**时，相应快照到期，并在**下一次 host 轮询**写入**原始聚合快照**（不解释、不打分）；没有独立后台定时器。每个 action / offset 最多写一次，若之后没有 host 轮询则不写。这是「观察结果」的真实实现——它记录事实，不生成结论。

### 4.6 Episode facts 不是记忆系统

`social_agent_events` 表（migration `apps/server/migrations/0099_social_agent_events.sql`）是**追加型事件日志**，以 90 天为删除阈值（`lib/socialAgentEventsRetention.ts` + `repositories/socialAgentEventsRepo.ts`）。每日有界、fail-open 的批量清理在失败或积压时可能让行保留更久，因此这不是绝对的 90 天删除时限。

- 只有 `action_commit` 携带部分唯一幂等键 `(social_session_id, idempotency_key) WHERE idempotency_key IS NOT NULL`。
- 刻意**不建** session / user 外键：行要能比 session 墓碑活得更久，删除只由保留任务负责。
- **没有跨 session 读取路径。** 它不是用户画像、不是长期记忆、不会被下一场局读到。Director 式自主决策不在范围内。

### 4.7 权威与触发

`apps/server/src/routes/socialIcebreakerXiaoyue.ts`：

- `POST /api/social-icebreaker/:socialSessionId/xiaoyue/agent/decision` — host 提交对 Ask 的决定（采纳 / 忽略 / 关闭）。
- `POST /api/social-icebreaker/:socialSessionId/xiaoyue/agent/policy` — host 关闭本场主动建议。
- **不新增 tick 路由**：tick 挂在已有的 3 秒 `GET` 轮询上，由 `lib/xiaoyueAgentRuntime.ts` `runXiaoyueAgentTick` 执行，且只有 host 的轮询会触发。
- 参与者视角：`sanitizeStateForClient` 剥掉整个 `xiaoyueAgent` 对象与 `hostTableBrief`，但保留公开的话题 revision 元数据，包括 Agent 换卡写入的 `warmupTopicSetProvenance: 'agent'`。因此，被隐藏的是 Agent 内部对象与桌边提示；公开 provenance 仍会标明本次换卡来自 Agent。

**M1 只有 `warmup` 阶段有可执行 Ask。** `micro_challenge` 返回 `observation_only_phase`，没有 M1 Agent Ask、真实动作或 recovery snapshot，不允许呈现「接受/执行」的假循环；既有的独立 adaptive suggestion 不属于这条 bounded Agent loop。

---

## 5. 第三层：三个安静的引导表面

三个表面共享一套系统，**不是三层教程**。这是设计上最容易做错的地方：每加一个提示，用户就多一个要忽略的东西。

| 表面 | 在哪 | 说什么 | 谁看得见 |
|---|---|---|---|
| **活动说明书** `EventActivityGuide` | `pages/event-detail`，默认折叠 | 粗略的四步活动流程，明确标注「大概」 | 所有人 |
| **当前环节提示** `guidanceLine` | session shell 唯一一行 | 由真实 run plan 派生的当前 / 下一步 / 收尾 | 所有人 |
| **桌边小提示** `HostTableBriefPopover` | host 阶段行，可展开 | ≤3 行：节奏建议 + 可选真实共享兴趣锚点 | 仅 host，仅 warmup |
| **主动建议** `XiaoyueAgentAsk` | host 阶段行上方，非模态 | 一个问题 + 一个动作按钮 | 仅 host |

### 5.1 诚实性原则

- 活动说明书**绝不编造** `next` / `total` / `free_chat`：它不知道真实 run plan，就只说「大概」。
- `session-waiting` 才是消费真实 run plan 的表面，只显示当前 / 下一个 / 收尾三个位置。
- 桌边小提示**不显示** ID、分数、覆盖率、revision、原始 persona 数值，也不含 LLM 生成。

### 5.2 仲裁：同时只允许一个浮层

目标优先级从高到低：

```
仪式 / 庆祝 / tier 切换 / 原生 ActionSheet
  > Agent Ask
    > 自适应建议
      > HostTableBriefPopover
        > host coachmark
```

目标契约还包括：高优状态必须压制 Agent Ask 与 adaptive suggestion 的实际渲染，只暂时隐藏而不伪造 Ask 的 ignore / close 服务端决定；Agent Ask 及这些高优状态也必须压制 coachmark；`guidanceLine` 活跃时不得建立或显示 coachmark。**2026-10-29 修复中：** 独立静态审计发现 R1（高优层未压制 Ask / adaptive）、R6（coachmark 未检查 Ask / ritual / tier）、R10（guidanceLine 未接入 coachmark）三项冲突；小程序正在实现统一高优谓语和 coachmark 门控，尚未验证，不能把目标契约写成已通过。

审计已证实的既有决胜与生命周期规则：

- Agent Ask 会压制 adaptive suggestion；HostBrief **只要可用，即使仍折叠**，也会压制 coachmark。
- HostBrief 在 phase、host 身份、Agent Ask、adaptive suggestion、tier sheet、PhaseIntro、ActionSheet、warmup ritual / celebration 变化时关闭，并在页面重新显示时经 `useResetOnShow` 复位；`phaseKey` 变化也会关闭。
- `phase-toast` 另有广播权重门槛：排除 warmup、phase_selection、从 waiting 的首次转换及 ritual 权重；`PhaseIntroOverlay` 只在真实阶段转换到 ritual 权重时触发。`guidanceLine` 活跃时再抑制 toast、PhaseIntro 的 host 提示与首次规则、warmup 权限耳语。
- coachmark 是**持久化 seen 的教学提示**，驻留到首次真实使用主持人菜单或点击 coachmark，不是定时自动消失的浮层；打开 ActionSheet 时会关闭它。

仲裁所有权是分散的：页面与 `sessionShellLogic.ts` 负责可见性和优先级判定，`XiaoyueSessionShell` 只渲染传入的 `agentAsk`、`hostBrief`、`adaptiveSuggestion` 插槽，不是唯一仲裁者。`WarmupPhaseView` 通过 `overlayCallbackRef` 上报 `ritualGateOpen || showCelebration`，页面回调必须是稳定的 `useCallback([])`——早期不稳定回调曾造成 `false → true` 反复翻转和浮层闪烁。

### 5.3 桌边小提示为什么需要一次查询，以及怎么不拖垮轮询

`buildHostTableBrief` 接受一个**惰性 thunk** `resolveRoleResults`，只有在锚点门槛通过（存在真实共享兴趣）之后才会被调用——没有锚点就直接返回 `null`，一次查询都不发。

真正发查询时走 `lib/hostBriefRoleResultsMemo.ts`：

- **每个进程、每 session、在顺序完成的 lookup 中**，每 **300 秒 TTL** 最多一次 `getLatestRoleResultsForUsers` 批量查询；cold miss 没有 in-flight single-flight，并发 miss 仍可能重复查询，多进程也不共享 memo
- 模块级 `Map`，最多 **200** 个 session
- **只允许** `requestingUserId === hostUserId` 且 `currentPhase === 'warmup'` 且 `icebreakerMatchingAwareEnabled` 为真
- 查询 reject 时 **fail-open**：返回空 Map，退回原型构成推断；但 DB 调用没有 timeout，挂起的查询仍可能阻塞轮询

**已 settle 的失败或空结果也会被缓存**，这是故意的：如果只缓存成功，数据库持续 reject 时，3 秒轮询会变成重试风暴。这个保护不覆盖并发 cold miss 或永不 settle 的查询。

调用顺序被 `icebreakerProfilePipelineWiring.test.ts` 的源码顺序断言锁死：
`host+warmup 守卫 → flag → buildHostTableBrief → memo 调用`。任何重排都会重新打开 memo 本来要堵住的那个洞。

---

## 6. 一次完整的 60 秒

```
t+0s    host 手机每 3 秒 GET 一次会话状态
       → runXiaoyueAgentTick 执行（非 host 不触发）
       → decideAgentTick 读信号：warmup 已跑 26 分钟，计划 20 分钟，超时比 1.30 > 1.25
         且已持续 60 秒 → create_ask(phase_overrun)

t+0s    返回给 host 的 state 里多一个 xiaoyueAgent.ask
       （参与者的 xiaoyueAgent 被剥离，公开 revision 元数据仍保留）
       → XiaoyueAgentAsk 非模态卡片出现：「想换个话题继续吗？我可以换一组。」

t+3s    卡片仍在（没有固定 8 秒自动消失；phase / revision 变化或 pulse 转正可使其自动过期）

t+9s    host 点「换一组」
       → POST .../xiaoyue/agent/decision  { accept }
       → executeWarmupTopicRotation 开始，6 秒截止线启动

t+11s   提交成功 → topicSetRevision +1
       → host 端话题卡交叉淡入；参与者看到内容变化及公开 provenance='agent'
         但收不到 xiaoyueAgent 内部状态或 hostTableBrief
       → 写 social_agent_events: action_commit（带幂等键）

t+71s   +60s 已到期，host poll 写恢复快照 #1：原始聚合值落盘，不解释
t+191s  +180s 已到期，host poll 写恢复快照 #2：每个 action / offset 最多一次

t+…     若 host 连续忽略两次 → proactiveDisabled = true → 本场不再提示
```

如果第 9 秒网络挂了：6 秒后 UI 进入 `unknown`，文案是「还没确认换新，当前话题保留」，提供「重新同步」。原请求的迟到响应不会把界面翻成成功；host 显式重新同步时，则可凭同一幂等键读取已提交结果并恢复对应状态。

---

## 7. 权威边界：谁能决定什么

| 决定 | 唯一权威 | 悦仔能否影响 |
|---|---|---|
| 当前处于哪个阶段 | host 手动推进（`PHASE_ORDER` + advance guard） | **不能**。没有自动推进，2026-07-29 起倒计时/自动 advance 已退役 |
| 这一阶段多长 | `runPlanService.compileForSession` + `applyTableRhythm` | 只能通过画像间接影响**编译期**，运行时不能改 |
| 话题卡内容 | 预生成卡组 + 人工策展兜底 | 能在 host 同意后**换一组**，不能凭空生成新话题 |
| 谁看见什么 | `sanitizeStateForClient` | 不能绕过。参与者的 `xiaoyueAgent` 永远被剥掉 |
| 是否继续被提示 | host（忽略 / 关闭） | 连续被忽略时自我关闭 |
| 匹配与排桌 | `poolMatchingService`（确定性） | **完全无关**。悦仔不参与匹配 |

一条重要的推论：**悦仔不是一个「更聪明的调度器」，它是一个「在 host 卡住时提供一次可选帮助」的组件。** 如果把它做成调度器，host 就会失去权威，零培训目标也就不成立了。

---

## 8. Feature flag 与 kill switch

| Flag | 默认 | 作用 | 关掉之后 |
|---|---|---|---|
| `icebreakerAgentCopilotEnabled` | **true** | 有界 agent 全部行为 | 目标：无新 Agent 行为、host 无 `xiaoyueAgent` projection、decision/policy coded refusal 且无副作用（修复中） |
| `icebreakerMatchingAwareEnabled` | **true** | 画像管线（W1–W3）、锚点、节奏、桌边小提示 | 停用该管线的 anchors、role_results enrichment、table rhythm 与桌边小提示；不承诺所有既有 archetype 上下文都被此开关移除 |

两个都是 **kill switch**，不是灰度。解析顺序是 DB 行 → env → `DEFAULT_FLAG_VALUES`；没有 DB 行且 env 未设置时，两个代码默认都已是 `true`，所以生产**不需要**为了默认 ON 建行，DB 行用于覆盖或紧急关闭。

**2026-10-29 修复中：** 审计发现 Agent OFF 此前只停 tick / recovery，既有 host projection 与 decision/policy 路由仍可用；后端正在把上表目标补成完整关闭契约，尚未验证。

同一族但**仍为关闭**的相关 flag（不在本次范围，列出避免混淆）：`icebreakerGroupBeatsEnabled`（false）、`gatheringRoomEnabled`（false）、`miniscriptEvidenceVoteV2Enabled`（false）、`budgetAdjacencyEnabled`（false）、`preRevealRefundEnabled` / `noRefundAfterReveal`（false）。

---

## 9. 数据、隐私与 AI 标注

- **参与者零新增输入。** 整个 M1 没有给参与者增加任何交互；他们的界面只有话题卡交叉淡入。
- **参与者可见性边界。** 参与者不会收到 `xiaoyueAgent` 或 `hostTableBrief`；但公开 revision 元数据包含 `warmupTopicSetProvenance: 'agent'`，公开 provenance 使 Agent 换卡的来源可被识别；被隐藏的是内部对象，不是所有行动痕迹。
- **AIGC 标注 fail-closed。** 只有内容**确实**由 AI 生成时才渲染角标；策展兜底内容不标注。**Ask 的文案是 4 条策展模板**（按 reason 分：`default` / `phase_overrun` / `topic_stall` / `pulse_low`），文案本身不调用 LLM。真正会调 LLM 的是**换卡动作**（§4.4）。话题卡角标由 `aigcLabelsEnabled` 与 `warmupTopicsMeta.aigc.aiGenerated === true` 共同决定；`lastAction.fallbackUsed` 只用于行动事实与审计，不是角标输入。
- **MiniScript 的已接受例外：** 迷你剧本杀的生成提示词仍然携带参与者显示名（角色需要按真实玩家写，玩家才认得出自己）。这是**有意的**、已在源码注释中记录，硬约束是提示词永不落盘、永不进日志、永不进 trace。要做数据最小化，必须与 fallback 编织路径**联合**改，不能只换提示词标签。
- **微信生成式 AI 备案**是独立发布前置条件，不由代码解决。

---

## 10. 什么被证明，什么没有

### 10.1 实施会话报告的验证结果（代码 + 测试 + 迁移）

以下数字由实施会话于 **2026-10-29** 报告，本文保留其证据口径；本次架构审计没有重新执行这些全量命令：

- 全量服务端测试 **391 文件 / 4598 测试通过**，0 失败（62 skipped）。
- 小程序测试 **350 文件 / 3489 测试通过**，0 失败。
- `typecheck` server / shared / mini-program 三处干净。
- `npm run guardrails` **0 errors / 12 warnings**（全部为既存小程序警告）。
- `build:weapp` PASS（主包在 2.00 MB 内），`verify:subpackage-styles` PASS（icebreaker-session 42 个必需选择器齐备）。
- 发布 runbook 记录 migration `0099_social_agent_events.sql` 已在 staging 与 production 应用，且 production 确认 5 个索引（`docs/runbooks/icebreaker-agent-m1-release-checklist.md` §0–§1）；本文没有独立查询远端数据库。
- 画像管线 **B1/B2 focused re-check PASS，0 blockers in that scope**（`.git/.orchestration/sprints/sprint-w1-w3-profile-pipeline-verdict-r1.json`）；父级 pipeline verdict 为 **PARTIAL**，不能改写成全管线或发布 PASS。

### 10.2 只有规格、修复中或没有证据

- **完整 kill switch 契约：修复中，未验证。** 2026-10-29 审计确认，旧实现的 OFF 只停止 tick / recovery，host projection 与 decision/policy 路由没有同步关闭；后端修复不得在未验证前记为完成。
- **参与者可见性旧表述有误。** 参与者不接收 `xiaoyueAgent` / `hostTableBrief`，但会接收公开 `warmupTopicSetProvenance: 'agent'`；这是一项公开 DTO 事实；文档只能限定内部对象的下发边界，不能扩大为行动来源也不公开。
- **浮层仲裁 R1 / R6 / R10：修复中，未验证。** 高优层对 Ask / adaptive 的压制、coachmark 对 Ask / ritual / tier 的门控、guidanceLine 对 coachmark 的抑制，正在小程序侧实现。
- **5 名首次 host 零培训 15 分钟 smoke：0 人跑过，gate OPEN。** 规格在 `docs/testing/icebreaker-host-zero-training-smoke.md`（373 行，含空白观测表）。阈值：host 主动动作中位 ≤3、P90 ≤4；任一 host 卡住 >60 秒且看不到下一步 = FAIL。注意 n=5 时最近秩 P90 等于最大值，所以「P90 ≤4」实际含义是「5 人全部 ≤4」——这一点在文档里写明，并留了 AMENDED 出口。
- **内容质量（DQS）**：需要真人盲评，未开始。任何「内容更好了」的说法目前都没有证据。
- **留存 / 30 天复到场**：需要 Gate A/B/C 实验，未开始。

### 10.3 被真实世界数据挡住

- **画像审计无法出证据。** staging 与 production 的 `social_icebreaker_sessions` / 参与者 / `social_agent_events` 全部是 **0 行**，`audit:icebreaker-profile-context` 返回 `INSUFFICIENT_DATA`。破冰系统从未在本地开发环境之外跑过。这个门只能在**第一个真实 session 产生之后**关闭，绝不能用空数据宣称通过。

### 10.4 外部前置

- 真机矩阵（iOS + Android + 小屏 Android）、无障碍、生命周期（rejoin / 后台回前台 / host 转移）
- 微信生成式 AI 备案与提审

---

## 11. 代码地图

**决策内核与运行时**

| 文件 | 职责 |
|---|---|
| `apps/server/src/lib/xiaoyueAgentPolicy.ts` | 纯决策内核、信号派生、默认配置；Ask 决定返回 cloned next state，不直接落库 |
| `apps/server/src/lib/xiaoyueAgentRuntime.ts` | `runXiaoyueAgentTick`，挂在 host 的 3 秒轮询上，并持久化 candidate / Ask / expiry / auto_disable |
| `apps/server/src/lib/xiaoyueAgentActions.ts` | 唯一的真实动作 + 6 秒截止线 |
| `apps/server/src/lib/xiaoyueAgentRecovery.ts` | +60s / +180s 恢复快照 |
| `apps/server/src/lib/warmupTopicSetRevision.ts` | 整组话题卡单调 revision |
| `apps/server/src/lib/warmupServedTopics.ts` | 已服务话题去重（240 key 上限，提交域内） |
| `apps/server/src/routes/socialIcebreakerXiaoyue.ts` | host-only 路由 + 结构化错误码 + decision / policy 持久化 |

**画像管线**

| 文件 | 职责 |
|---|---|
| `apps/server/src/lib/tablePersona.ts` | `deriveTablePersona`、`resolveTableAnchorsForPrompt`、阈值常量 |
| `packages/shared/src/tableRhythm.ts` | 节奏分类与总时长守恒的 `applyTableRhythm` |
| `apps/server/src/lib/icebreakerRosterSignals.ts` | 兴趣归一、通用标签降权、锚点排序、`buildSharedInterestHooks` |
| `apps/server/src/lib/tableAnchorsForGeneration.ts` | route 与 worker 共用的锚点派生 |
| `apps/server/src/lib/hostTableBrief.ts` | 桌边小提示（pace + anchor） |
| `apps/server/src/lib/hostBriefRoleResultsMemo.ts` | 300s / 200 session 的 role_results 记忆化 |
| `apps/server/src/lib/runPlanShape.ts` | `buildRunPlanShapeKey`（时长进入形状键） |
| `apps/server/src/repositories/assessmentRepo.ts` | `getLatestRoleResultsForUsers` + 刻度归一 |

**表面**

| 文件 | 职责 |
|---|---|
| `apps/mini-program/src/pages/icebreaker-session/index.tsx` | 页面级仲裁控制面：高优可见性、coachmark、HostBrief 生命周期与插槽输入 |
| `apps/mini-program/src/pages/icebreaker-session/sessionShellLogic.ts` | `guidanceLine`、HostBrief / adaptive 可见性及仲裁纯判定 |
| `apps/mini-program/src/pages/icebreaker-session/phases/WarmupPhaseView.tsx` | 以 `overlayCallbackRef` 上报 ritual / celebration，遵守稳定回调契约 |
| `apps/mini-program/src/pages/icebreaker-session/overlays/PhaseIntroOverlay.tsx` | 真实阶段转换 + ritual 权重门控；guidance 活跃时 suppress host prompt / 首次规则 |
| `apps/mini-program/src/pages/icebreaker-session/components/XiaoyueAgentAsk.tsx` | 非模态 host 建议卡 |
| `apps/mini-program/src/pages/icebreaker-session/viewModels/xiaoyueAgentAskModel.ts` | payload 校验、view model、策展文案、revision 单调判断；不拥有计时器 |
| `apps/mini-program/src/pages/icebreaker-session/hooks/useXiaoyueAgentAsk.ts` | 提交、重试、resync；4 秒 slow hint、6 秒 unknown、6.5 秒传输超时计时器 |
| `apps/mini-program/src/pages/icebreaker-session/components/HostTableBriefPopover.tsx` | host 桌边小提示 |
| `apps/mini-program/src/components/mascot/XiaoyueSessionShell.tsx` | 唯一 `guidanceLine` 的渲染与插槽布局；不负责全部仲裁 |
| `apps/mini-program/src/components/event-detail/EventActivityGuide.tsx` | 活动说明书（粗略四步） |

**数据**

| 文件 | 职责 |
|---|---|
| `apps/server/migrations/0099_social_agent_events.sql` | episode facts 表（幂等，无 session/user FK） |
| `apps/server/src/repositories/socialAgentEventsRepo.ts` | 追加写入 |
| `apps/server/src/lib/socialAgentEventsRetention.ts` | 90 天保留 |
| `packages/shared/src/socialIcebreaker.ts` | `XiaoyueAgentAsk` 契约；`SocialSessionState.hostTableBrief` / `xiaoyueAgent` 为 optional |

---

## 12. 常见误解（澄清）

**「悦仔是 AI 主持人吗？」**
不是。它不推进阶段、不点名、不主持。host 主持，悦仔只在 host 卡住时递一张纸条。

**「它用了大模型做决策吗？」**
没有。决策是纯函数，可单测回放。LLM 只出现在「换卡动作生成新卡组」这一步（预算内、失败即回落策展卡组），永远不会决定要不要换卡、也不会推进流程。

**「它是聊天机器人吗？」**
不是。没有自由对话入口。4 条策展 Ask 文案，host 只能采纳 / 忽略 / 关闭。

**「它有记忆吗？」**
没有跨 session 记忆。`social_agent_events` 是 90 天保留的追加事实日志，没有跨 session 读取路径。

**「它会根据我的性格给我安排角色吗？」**
不会。画像只聚合成桌级特征（能量档、深度偏好、共享锚点、多样性计数），不产出个人结论，也不对参与者可见。

**「关掉 flag 会怎样？」**
目标契约是回到改造前的行为：无新 Agent 行为、host 无 `xiaoyueAgent` projection、decision/policy coded refusal 且无副作用。2026-10-29 审计发现旧实现并未做到，后端修复仍在进行且尚未验证；不能把目标写成既成事实。

**「现在能上线吗？」**
不能。代码实现存在，但完整 kill switch 与浮层仲裁 R1 / R6 / R10 修复仍在进行且未验证，参与者还会收到公开 `warmupTopicSetProvenance: 'agent'`。外部门也全部未关：5 名首次 host 零培训 smoke 未跑、真机矩阵未做、微信生成式 AI 备案未完成、画像审计因零真实 session 无法出证据。

---

## 13. 相关文档

| 文档 | 关系 |
|---|---|
| `docs/design/icebreaker-agent-m1-tech-spec-20261026.md` | 运行时契约的规范源（本文 §4 的细节以它为准） |
| `docs/design/icebreaker-agent-m1-uiux-20261026.md` | Ask 卡的 UI/UX 规范 |
| `docs/design/icebreaker-guidance-quiet-concierge-20261027.md` | 三个引导表面的规范源（本文 §5） |
| `docs/design/icebreaker-w1-w3-implementation-plan-20261027.md` | 画像管线规范源（本文 §3） |
| `docs/design/icebreaker-content-quality-evaluation-20261026.md` | DQS 离线内容评级 |
| `docs/agent-context/social-icebreaker.md` | 面向 agent 的密集上下文 |
| `docs/architecture/icebreaker-lane-selection.md` | 改破冰代码该走哪条交付道 |
| `docs/runbooks/icebreaker-agent-m1-release-checklist.md` | 发布操作清单 |
| `docs/testing/icebreaker-host-zero-training-smoke.md` | 零培训 smoke 执行规格（gate OPEN） |
| `docs/testing/icebreaker-overlay-arbitration-audit-20261029.md` | §5.2 的静态证据、R1 / R6 / R10 冲突与修复目标 |
| `docs/icebreaker/icebreaker-system.md` | 破冰系统总览（更广，含各阶段） |
