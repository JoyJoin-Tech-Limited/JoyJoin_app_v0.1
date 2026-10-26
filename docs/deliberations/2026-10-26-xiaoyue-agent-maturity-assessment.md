# 小悦是不是破冰 Agent？—— 成熟度审计与全模块 Agent 框架提案

> 日期：2026-10-26
> 性质：架构评估（不含实现）
> 方法：先做外部 deep research（Anthropic / LangGraph / OpenAI Agents SDK / Microsoft Agent Framework / Google ADK / 2026 上下文工程共识 + 两篇学术论文），再用「agent 的最小定义」逐项对照本仓代码。
>
> **⚠️ 后续修订（2026-10-26）：** 本文的 §9 Phases 0–4 路线、§11「至少 3 个状态工具」验收线、§7「零新增成本」表述，已被 [`2026-10-26-icebreaker-agent-m1-deliberation.md`](./2026-10-26-icebreaker-agent-m1-deliberation.md) 的 PM × 商业化裁决取代。§1–§6 的现状审计与外部研究仍然有效。

---

## 0. 一句话结论

**现在不能。小悦不是破冰 agent，是破冰主持人的「嘴」——一个有品牌人格的、无状态的、单次生成的文案服务。**

**但这不是坏消息。** 真正的问题不是「小悦不够自主」，而是「小悦只有嘴，没有眼睛、没有手、没有记性」。而社交场景的实证研究（CHI '25）恰好证明：**破冰 agent 不应该全自主**。所以正确目标不是把它变成自主 agent，而是把它变成**有感知、有记忆、有手、但被门控的有界 agent**。

**全模块 agent 框架：纸面有，运行时不有。** 仓库里有一份 583 行的三角色 × 三系统设计，但三个 orchestrator 文件从未创建；真正在跑的是 40+ 个各自为战的 LLM 调用点。好消息是——**骨架已经在了，缺的是一次收口，不是从零重建**。

---

## 1. 先把「Agent」定义钉死

外部研究给出的共识非常一致。把 Anthropic 的 workflow/agent 区分、LangGraph 的运行时定义、Generative Agents 的认知架构三者取交集，一个 agent 至少要同时具备五件事：

| # | 能力 | 判据 |
|---|------|------|
| 1 | **Goal** | 有一个它持续追踪的目标，而不是一次请求一个 prompt |
| 2 | **Perception** | 能主动获取状态，不需要人喂 |
| 3 | **Decision** | 能在合法动作空间里选择下一步 |
| 4 | **Action** | 能通过工具改变世界，而不只是产出文本 |
| 5 | **Feedback Loop** | 能看到自己动作的结果并调整 |

Anthropic 的原话是分界线：**Workflow = LLM 与工具由预定义代码路径编排；Agent = LLM 动态决定自己的流程与工具使用。** 同时它还有一句同样重要的限定：*"Every agent starts as a workflow"* —— 应选**能通过评测的最简模式**，不要为自主而自主。

---

## 2. 小悦逐项对照

| 能力 | 现状 | 证据 |
|------|------|------|
| **Goal** | ❌ 无 | 无持久目标对象。`/api/xiaoyue/analysis` 是「给我一段性格解读」，`/adaptive-suggestion` 是「给我一条建议」。请求结束，目标即消失。 |
| **Perception** | ⚠️ 0.5 | `xiaoyueAdaptiveEngine.computePulseSignals()` 能算出 6 个信号（phaseElapsedMinutes / activeRate / completionRate / avgVibe / playerCount / pulseCheckCount）。但**这是 host 点击那一刻的快照**，不是持续观察；且 `computeCompletionRate` 只覆盖当前 phase 的局部完成率（auction 甚至是 0/1 二值）。没有跨 phase 趋势、没有个体参与度、没有话题级反馈。 |
| **Decision** | ⚠️ 0.5 | 八类模板（advance_ready / speed_up / slow_down / go_deeper / keep_light / rescue_quiet / energy_boost / keep_going）由纯规则选出。LLM 被明确剥夺决策权：文件头注释 *"No LLM call… AI (Xiaoyue) suggests; the deterministic session state machine decides what is allowed."*；prompt 里写死 *"不改变规则或阶段"*。 |
| **Action** | ❌ 无 | 它只能返回 `{ message, actionableHint }` 一段文字。不能推进 phase、不能发通知、不能换话题、不能点名、不能开投票。所有动作仍要 host 手动点。 |
| **Feedback** | ❌ 无 | 没有任何机制记录「这条建议是否被采纳」「采纳后 activeRate 有没有上升」。`xiaoyueAdaptiveSuggestion` 写回 session state 后**再无消费者**。 |

**命中率：0.5 / 5。**

### 2.1 它到底是什么

准确的描述是：**Workflow-bound persona + 单次生成 + 确定性建议分类学**。

拆开看：
- `generateXiaoyueAnalysis` — prompt → 文本，一次性。
- `generateXiaoyueSessionPack` — prompt → JSON，`max_tokens: 400`，失败落 `FALLBACK_SESSION_PACK`。
- `generateXiaoYueComment` — 默认文案 map 优先，LLM 仅兜底（而且前端当前未直接消费 `xiaoYueComment`）。
- `generateAdaptiveGameSuggestion` — 确定性 fallback 先出，LLM 只做措辞改写，`max_tokens: 220`，40–100 字 message + 20–60 字 hint，过 `containsReviewBlockedVocab`。
- `XiaoyueSessionShell` — 10 个 phase 的主持人细条，换表情、toneLine、host-only ⋯ 菜单、断网灰点、AIGC 页脚。

这是**提词器（teleprompter）**，不是 agent。而且是**无状态提词器**——它不知道这桌人上一场怎么样，也不知道自己上一条建议有没有用。

### 2.2 一个容易被忽略的事实

AGENTS.md 写得很清楚：*"Xiaoyue chat-based onboarding is deprecated — mascot character only (visuals, loading, empty states)"*。

也就是说，团队**已经主动把「对话式 agent」这条路砍掉过一次**。现在的小悦是刻意收敛的产物。所以这次评估的正确问法不是「为什么它不 agent」，而是「**收敛是不是收过头了**」。

我的判断：**收过头了，但只在一个维度上——感知与记忆。** 自主性收得对（见 §4），感知和记忆收得错。

---

## 3. 更重要的发现：真正接近 agent 的不是小悦

这是本次审计最有价值的结论。**Social Icebreaker 运行时本身，比小悦更像一个 agent harness。**

| Agent 要素 | Social Icebreaker 运行时 | 小悦 |
|---|---|---|
| 状态 | ✅ 服务端 `SocialSessionState`，DB 持久化 | ❌ 无 |
| 动作空间 | ✅ `socialIcebreakerPhaseConfig` 定义合法 phase 与开关 | ❌ 无 |
| 推进守卫 | ✅ `getNextEligiblePhase()` + minPlayers 校验 + run plan segment 顺序 | ❌ 无 |
| 计划 | ⚠️ `runPlanService.compileForSession()` —— **确定性模板编译器**，不是 LLM planner | ❌ 无 |
| 生成 | ✅ 12+ 个 phase generator，全部带 curated fallback | ✅ 4 个 |
| 评估循环 | ⚠️ 仅 `miniscriptAgent` 有真正的 generator → critic → revise | ❌ 无 |
| 兜底 | ✅ 每层都有确定性 fallback | ✅ 部分 |
| 可观测 | ✅ `AITrace` + promptVersion | ✅ 部分 |
| **策略归属** | ❌ **人类主持人**（host-paced，不自动推进） | ❌ 人类主持人 |

结论：**这个系统的「智能」不在循环里，在人身上。** 它是一个非常好的**协作式状态机**，但 agent 的定义要求「模型决定流程」——现在决定流程的是 host。

`runPlanService` 的注释写 *"The Game Design Agent produces these after analyzing the matched group"*，但实现是 `compiler-template-v1-${vibe}-${tier}` 的模板查表 + 预算分配。**名字叫 agent，实质是编译器。** 这个命名债值得清理，否则会持续误导架构判断。

---

## 4. 全模块 Agent 框架存在吗

### 4.1 纸面上有

`docs/ai/ai-agent-harness-separation-strategy.md`（583 行，2026-04-02）提出了三个产品 agent 系统：

| 系统 | 职责 | 内部三角色 |
|---|---|---|
| Onboarding Discovery Agent | 注册到画像 | Generator / Evaluator / Policy Synthesizer |
| Match Intelligence Agent | 匹配解释与调整 | 同上 |
| Event Momentum Agent | 现场节奏 | 同上 |

### 4.2 运行时不有

同一份文档 §0.3 自己承认：`onboardingDiscoveryOrchestrator.ts`、`matchIntelligenceOrchestrator.ts`、`eventMomentumOrchestrator.ts` **全部是 🔲 Proposed — No file exists**；`packages/shared/src/ai/matching.ts`、`ai/icebreaker.ts` 也未创建。

而且这份设计**本质是职责分类学，不是运行时框架**。它没有回答：
- AgentContext 长什么样？（感知层）
- 工具怎么注册、怎么鉴权、怎么保证幂等？（行动层）
- 记忆写在哪、怎么衰减、怎么失效？（记忆层）
- loop 怎么转、在哪 checkpoint、预算怎么卡？（运行时）
- 怎么证明改了一版 prompt 没变差？（评测）

### 4.3 但骨架已经在了

散落的高质量原语，其实已经覆盖了框架的 60%：

| 原语 | 位置 | 在框架里的角色 |
|---|---|---|
| `socialIcebreakerPhaseConfig` | server | 动作空间定义 |
| `runPlanService` | server | 计划编译器 |
| `xiaoyueAdaptiveEngine` | server | 感知 + 规则策略 |
| `socialModelRouter` | server | 模型路由 |
| `AITrace` + promptVersion | server | 可观测 |
| feature flags（DB-backed） | server | 灰度与 kill switch |
| curated fallback banks | server | 降级 |
| `raceWithTimeout` | server | 硬预算 |
| `phaseModule.ts` | shared | 结构化契约 |

**缺的不是零件，是装配图。**

---

## 5. 外部研究给出的四条硬约束

这四条直接决定框架形态，不能绕过。

### ① 不要为自主而自主（Anthropic）
> "Every agent starts as a workflow."

选**能通过评测的最简模式**。五种模式里，本仓现状已经用了 prompt chaining（多 phase 串联）和 routing（tier/phase 分流）；缺的是 orchestrator-workers 和 evaluator-optimizer。

### ② 社交场景里，全自主介入是反模式（CHI '25）
Houtti et al.《Observe, Ask, Intervene》，9 场 ideation + "virtual co-host" 原型 + 实验室研究（n=68，12 组，18 访谈）：

> 参与者希望 AI agent **在介入前先询问**；用过原型的人**明显偏好 OAI 而非完全自主介入**。

同时论文也记录了一个反面：用户会 "rationalize away" 虚拟主持人的批评性反馈。意味着**介入的语气与时机比介入的内容更关键**。

这条直接否掉了「让小悦自动推进 phase / 自动点名 / 自动换话题」的所有方案。

### ③ 记忆不是可选项（Generative Agents）
Park et al. 的消融实验证明：observation、planning、reflection **三者都不可或缺**。架构是 memory stream + 检索（recency × importance × relevance）+ reflection tree + 递归 planning。

对本仓的启示很直接：**没有 episodic memory 的小悦，跨场次只会重复同一套话术。** 而"越用越懂这群人"恰恰是社交产品的核心资产。

### ④ 上下文是稀缺资源（2026 共识）
- 四个操作：write / select / compress / isolate
- 三层记忆：working / episodic / semantic，**必须有 decay 与 invalidation**
- Tool gating：Vercel 实测，把复杂工具移出上下文后准确率 80% → 100%，token 少 40%
- 单步工具清单 < 20–30 个
- KV-cache 命中率是生产 agent 第一指标 → 上下文要 append-only、稳定前缀在前

**"immortal memory" 是明确反模式**：过期记忆比没有记忆更危险。

---

## 6. 建议框架：JSAF（JoyJoin Social Agent Framework）

### 6.1 核心原则

> **Spine decides. Agent advises. Human gates.**

翻译成工程语言：
- **确定性脊柱**拥有所有不可委托的权力（匹配分数、权益、退款、phase 合法性、安全红线）
- **Agent 节点**只做「在合法集合里选一个 + 说明理由 + 生成措辞」
- **人类门控**保留在社交敏感动作上（介入、点名、推进）

这不是妥协，这是 CHI '25 的实证结论。

### 6.2 六层架构

```
┌─────────────────────────────────────────────────────────┐
│ L5  Eval           golden sessions · rubric · 回归门      │
├─────────────────────────────────────────────────────────┤
│ L4  Runtime        tick loop · checkpoint · 预算 · trace  │
├─────────────────────────────────────────────────────────┤
│ L3  Agent Nodes    Director · Facilitator · Guardian ·    │
│                    Chronicler · MatchNarrator             │
├─────────────────────────────────────────────────────────┤
│ L2  Capabilities   typed tools (JSON Schema + scope +     │
│                    idempotency key)                       │
├─────────────────────────────────────────────────────────┤
│ L1  Context        AgentContext builder（感知层）          │
├─────────────────────────────────────────────────────────┤
│ L0  Policy Kernel  永不进 LLM：分数/权益/退款/合法性/红线   │
└─────────────────────────────────────────────────────────┘
```

### 6.3 L1：AgentContext（当前最缺、ROI 最高的一层）

现在每个 generator 都是「prompt + 三五个字段」。这一层补上，**所有已有生成器的质量会同时提升，且不需要改动任何一个 prompt 的业务逻辑**。

```ts
interface AgentContext {
  user: {
    id: string
    archetype: ArchetypeId
    traits: TraitScores            // ACOEXP 6 维
    interests: string[]
    budgetTier: string
    socialEnergy: 'high' | 'mid' | 'low'
    pastSessions: EpisodeSummary[] // 来自 episodic memory
  }
  group: {
    memberIds: string[]
    archetypeMix: ArchetypeComposition
    chemistryEdges: PairChemistry[]
    duoBindings: DuoBinding[]
    size: number
    vibe: 'warm' | 'neutral' | 'cold'
  }
  event: { poolId, tier, venueId, startAt, city, theme }
  session: {
    phase: SocialIcebreakerPhase
    elapsedMinutes: number
    activeRate: number
    completionRate: number
    avgVibe: number
    pulseCount: number
    recentEvents: SessionEvent[]   // 结构化，不是自由文本
  }
  memory: {
    episodic: Episode[]
    semantic: string[]             // 已提炼的稳定偏好
    procedural: RunPlanTemplate
  }
  constraints: {
    allowedActions: ToolName[]     // 由 L0 计算，agent 不得越界
    bannedVocab: string[]
    timeBudgetMs: number
    tokenBudget: number
  }
}
```

关键设计：
- `constraints.allowedActions` **由 Policy Kernel 计算后注入**，不是 agent 自己判断。
- `recentEvents` 是结构化的（`{ type, actorId, at, payload }`），不是把聊天记录塞进 prompt —— 这是 context engineering 的 "select" 原则。
- `memory.semantic` 有 **条数上限 + 每条带 confidence 与 expiresAt**，防止 immortal memory。

### 6.4 L2：工具层（把 service 包成有权限的工具）

当前 40+ 个 LLM 调用点全是「函数直调」，没有统一的鉴权、幂等、预算。工具层要把它们收编：

| 工具 | 作用 | 权限域 | 幂等键 |
|---|---|---|---|
| `read_session_state` | 读当前状态 | read | — |
| `advance_phase` | 推进阶段 | **host-only** | `sessionId + from + to` |
| `generate_phase_content` | 生成话题/挑战/题目 | generate | `sessionId + phase + turn` |
| `send_nudge` | 发起一次 Ask（非介入） | system | `sessionId + signalHash` |
| `open_vote` | 开一轮投票 | host-only | `sessionId + round` |
| `assign_roles` | 分配角色 | host-only | `sessionId + phase` |
| `write_episode` | 写会话记忆 | system | `sessionId` |
| `fetch_group_analysis` | 读组分析 | read | — |

硬约束（来自 context engineering 研究）：
- 单步暴露 ≤ 12 个工具（远低于 20–30 上限，给未来留余量）
- 每个工具带 JSON Schema，schema 变更视为 breaking change
- 所有写操作必须幂等
- 工具描述进 stable prefix，保住 KV-cache

### 6.5 L3：五个角色（v1 全部是同一 runtime 里的 node，不是五个进程）

| 角色 | 目标 | 权力 | 对应外部模式 |
|---|---|---|---|
| **Director** | 这 90 分钟怎么走 | 在合法 phase 集合内**选择**顺序与时长权重；输出 `{ choice, rationale }`，编译器仍负责预算分配 | orchestrator-workers |
| **Facilitator** | 当前 phase 的内容 | 调 `generate_phase_content`，不能改状态 | prompt chaining |
| **Guardian** | 安全与合规 | **一票否决**：心理安全、微信合规、AIGC 标注、违禁词 | evaluator-optimizer |
| **Chronicler** | 记忆与反思 | 写 episode + reflection，**只写可观测事实** | Generative Agents reflection |
| **MatchNarrator** | 跨模块解释 | 只读匹配结果，**不能改分数** | routing |

**最重要的一条：Guardian 必须独立。** 现在违禁词检查是每个 generator 自己调 `containsReviewBlockedVocab` —— 新增一个 generator 就可能漏一个。独立 Guardian node 是 fail-closed 的唯一可靠形态。

### 6.6 L4：Runtime 职责

- **单次 tick**：perceive → plan → act → evaluate，一次只走一步（不是无限自治循环）
- **硬预算**：`timeBudgetMs`（建议 6s，与现有 `raceWithTimeout` 对齐）、`tokenBudget`、`maxToolCalls`
- **checkpoint**：复用现有 DB session state，每次 tick 后落盘（LangGraph 的 durable execution 我们用这个替代）
- **HITL 门**：`advance_phase` / `send_nudge` / `assign_roles` 强制人工确认
- **trace**：扩展现有 `AITrace`，每步一个 span：`{ tickId, node, input, output, toolCalls, latencyMs, fallbackUsed }`

### 6.7 L5：Eval（从 L3 到 L5 的唯一路径）

- **golden sessions**：20 组固定 roster × 固定 tier，跑完整 pipeline
- **rubric 四维**：话题相关性 / 心理安全 / 能量曲线匹配度 / 文案品牌一致性
- **回归门**：promptVersion 变更必须跑，分数不得低于 baseline − ε
- **在线指标**：Ask 采纳率、phase 完成率、recap 正面率、次月复购

没有 eval 的 agent，只能靠感觉迭代 —— 这是当前 40+ 个调用点最大的隐性成本。

---

## 7. 小悦的正确形态：OAI 门控

这是把「提词器」变成「副驾」的最小跳变，也是 CHI '25 的直接应用。

**现状**
```
host 想到 → 点 ⋯ 菜单 → 点「建议」→ 服务端算信号 → 出文案 → 8s 后消失
```
问题：**host 必须先想到**。冷场的时候，人往往是最想不到的。

**目标**
```
服务端每 3s 算信号（已有轮询，零新增成本）
      ↓ 触发阈值
小悦：「这轮有点安静，要不要我提个建议？」   ← Ask，低打扰
      ↓ host 接受 / 忽略
生成建议 → 展示 → 记录采纳与后续效果        ← Intervene + Feedback
```

三段各自的工程含义：
- **Observe**：`computePulseSignals` 从「点击时快照」升级为「持续序列」，加趋势判断（下滑 / 持平 / 回升）
- **Ask**：新增 `send_nudge` 工具 + 客户端轻提示（不是浮层卡，是 Shell 上的一行 toneLine）
- **Intervene**：复用现有 `generateAdaptiveGameSuggestion`，**一行不改**
- **Feedback**：记录 `{ askedAt, accepted, ignoredAt, postActiveRateDelta }` —— 这是全仓第一个 agent 闭环

**这一条做完，小悦就从「0.5/5」跳到「3/5」。**

---

## 8. 记忆设计（三张表）

| 表 | 内容 | 关键字段 | 衰减 |
|---|---|---|---|
| `agent_session_episodes` | 每场会的结构化摘要 | phase 序列、各 phase 实际时长、参与率曲线、host 采纳了哪些建议、recap 情绪 | 不衰减（事实） |
| `agent_user_social_memory` | 跨场次社交画像 | 「在 6 人桌上通常第 3 个发言」「auction 类参与度高」 | `decay_at` + `confidence` |
| `agent_reflections` | 高阶推断（reflection tree） | 「2 高能量 + 4 低能量时，warmup 需要 +3 分钟」+ `evidenceIds[]` | `expires_at` + 证据回溯 |

写入铁律：
1. **只写可观测事实，不写模型臆测**（臆测只能进 `agent_reflections`，且必须带 evidence pointers）
2. 每条带 `confidence` 与 `expires_at`
3. 用户可查、可删（合规）
4. 读取时按 recency × importance × relevance 加权，只取 top-K（Generative Agents 的做法）

---

## 9. 落地路线（按 ROI 排序）

| 阶段 | 周期 | 内容 | 风险 | 收益 |
|---|---|---|---|---|
| **Phase 0** | 1–2 周 | `agentContext` builder + `toolRegistry` 骨架 + signals 扩展为序列。**不改任何行为** | 零 | 为后续所有能力铺路；顺便统一 40+ 个调用点的入参形态 |
| **Phase 1** | 2–3 周 | OAI 门控上线，只服务 `warmup` + `micro_challenge`；A/B 测 Ask 采纳率 | 低（可 flag 关闭） | 第一个 agent 闭环；解决「host 想不到」的核心可用性问题 |
| **Phase 2** | 3–4 周 | 记忆三表 + Chronicler，**先只写不读** | 低 | 观察数据质量，避免脏记忆污染 |
| **Phase 3** | 4–6 周 | Director 接管 run plan（只做 choice + rationale）；Guardian 独立化 | 中 | 从 L2 到 L3；安全缺口收口 |
| **Phase 4** | 持续 | eval harness + 在线指标闭环 | 低 | 从 L3 到 L5 |

**如果只做一件事**：做 Phase 0 + Phase 1。理由——它不改任何现有生成逻辑，却同时补上感知层、工具层、反馈闭环三块，且直接命中用户可感知的价值（冷场被更早发现）。

---

## 10. 明确不做什么

| 不做 | 理由 |
|---|---|
| 引入 LangGraph / CrewAI / LangChain | TS + Express + 自研 DB session state + 严格 monorepo 边界。LangGraph 的 durable execution 我们已有等价物（DB state + 幂等 + checkpoint），引入的是**运维成本**不是能力。借模式，不借依赖。 |
| 让小悦全自主推进 phase / 点名 / 换话题 | CHI '25 实证反证；微信审核风险；心理安全红线。 |
| 让 LLM 碰匹配分数 / 权益 / 退款 | 匹配是 `poolMatchingService` 的确定性权威，百年不动。 |
| 立刻做 5 个独立 agent 进程 | Anthropic：最简模式。v1 全部是同一 runtime 的 node。 |
| 继续扩散 LLM 调用点 | 已有 40+ 个。新能力必须先过 runtime，否则永远收不了口。 |
| 做「沉浸式长期记忆」 | 过期记忆比没有记忆更危险。所有记忆必须带 decay 与 invalidation。 |

---

## 11. 验收标准：怎么才算「真的成为破冰 agent」

五条可测判据，全绿 = L3。

- [ ] **无点击感知**：host 全程不点任何按钮的情况下，小悦能在冷场发生后 30s 内发起一次 Ask（不是直接介入）
- [ ] **跨场记忆**：它能引用「上一场这桌人的情况」，且引用内容可追溯到具体 episode
- [ ] **真实行动**：它至少能调用 3 个会改变状态的工具，而不只是返回文本
- [ ] **闭环记录**：每条介入都有 `{ 采纳, 忽略, 效果 }` 记录，且可用于下一轮决策
- [ ] **评测门**：任何 promptVersion 变更未经 eval gate 不得上线

L4 的额外条件：Director 能在合法 phase 集合内自主编排，且 Guardian 拥有独立否决权。

---

## 12. 成熟度定级（全仓）

| 层级 | 定义 | 本仓位置 |
|---|---|---|
| **L0** | Prompt wrapper（一次调用一次输出） | 部分 tool-tagging 脚本 |
| **L1** | Workflow（预定义代码路径编排） | **主体**：40+ 个 generator、`runPlanService`、小悦全部 |
| **L1.5** | Workflow + 确定性感知/策略 | `xiaoyueAdaptiveEngine`（信号 → 规则 → 建议） |
| **L2** | Tool-using single agent（模型选工具，有界循环） | `miniscriptAgent`（唯一有 critic 循环的） |
| **L3** | Stateful + memory + planning | **空缺** |
| **L4** | Multi-agent roles + handoffs + evaluator | **空缺**（只有纸面设计） |
| **L5** | Eval-driven self-improvement | **空缺** |

一句话：**这个仓库是一个优秀的 L1 系统，局部摸到了 L2，整体缺 L3。**

这不是落后——大多数生产系统都在 L1。问题只是：**L1 的天花板是「生成内容」，L3 的天花板是「改变行为」。** 破冰这件事，价值在行为改变。

---

## 13. 证据索引

**代码**
- `apps/server/src/routes/domains/xiaoyue.ts`（143 行，2 端点）
- `apps/server/src/xiaoyueAnalysisService.ts`
- `apps/server/src/xiaoyueAdaptiveEngine.ts`（确定性规则 + 八类模板）
- `apps/server/src/routes/socialIcebreakerXiaoyue.ts`（host-only、recap 禁用）
- `apps/server/src/services/runPlanService.ts`（模板编译器）
- `apps/server/src/lib/miniscriptAgent.ts`（唯一 generator→critic 循环）
- `apps/server/src/socialIcebreakerPhaseConfig.ts`
- `packages/shared/src/phaseModule.ts`
- `packages/shared/src/mascotConfig.ts`（machine id `xiaoyue` / displayName `悦仔`）
- `apps/mini-program/src/components/mascot/XiaoyueSessionShell.tsx`
- `apps/mini-program/src/pages/icebreaker-session/hooks/useSocialActions.ts:1150`

**文档**
- `docs/ai/ai-agent-harness-separation-strategy.md`（583 行，3 系统 × 3 角色，orchestrator 未落地）
- `docs/ai/AI_FEATURE_INVENTORY.md`（13 项 live AI 能力）
- `docs/agent-context/social-icebreaker.md`

**外部**
- Anthropic, *Building Effective Agents* — workflow vs agent 分界、五种模式
- LangChain / Splunk / Codebridge / Speakeasy 2026 框架横评 — LangGraph checkpoint 与 durable execution、OpenAI Agents SDK 无原生 durability、多 agent 过度设计
- 2026 context engineering 共识 — write/select/compress/isolate、三层记忆、tool gating（Vercel 80%→100%）、KV-cache
- Park et al., *Generative Agents*, arXiv:2304.03442 — memory stream + retrieval + reflection tree + planning；消融证明三者不可或缺
- Houtti, Zhou, Terveen, Chancellor, *Observe, Ask, Intervene*, CHI '25, arXiv:2501.10553 — n=68 / 12 组，偏好 OAI 而非全自主介入
