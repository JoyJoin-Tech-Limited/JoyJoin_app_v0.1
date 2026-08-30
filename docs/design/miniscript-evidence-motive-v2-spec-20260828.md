# 迷你剧本杀 V2：证物系统 + 动机二步指认 — 对比分析与 PRD

> 日期：2026-08-28 · 状态：已评审（grill-me 决策 + @product-manager / @supervisor 评审修订已落地）· 参照开源项目：[ScottishFold007/ai-murder-mystery](https://github.com/ScottishFold007/ai-murder-mystery)
> 前置技能：`miniscript-story-framework`、`social-icebreaker-domain`、`llm-runtime-safety-and-integration`、`api-contract-versioning`、`analytics-tracking`、`feature-flags-launch-config`、`content-safety-abuse-detection`

---

## Part A · 开源项目对比分析

### A.1 对方是什么

ai-murder-mystery 是一个**单人沉浸式**谋杀推理游戏：每个 NPC 角色是独立 AI 智能体（人格/记忆/秘密），玩家通过自由对话收集线索，配合证物系统（逆转裁判式出示）、AI 搭档、推理笔记面板，最终指认凶手 + 动机。技术栈 React + FastAPI + 多 LLM。亮点机制：

| 机制 | 说明 |
|------|------|
| 多智能体角色 | 每角色独立 AI，自由对话，有记忆和秘密 |
| 三层防泄露 | 初始生成 → critic 检测泄露 → 智能修订 |
| 证物系统 | 发现/出示/组合/反应，出示触发角色反应 |
| 动机二步指认 | 第一步选嫌疑人，第二步选动机，两步都对才通关 |
| 剧本库 + 编辑器 | 可视化编辑、AI 辅助创作、AI 质检 |
| 信息架构 | 对话区 + 证物面板 + 笔记面板 + AI 搭档四区分离 |

### A.2 我们是什么

JoyJoin `mini_script` 是 **4–6 真人、线下聚会、host-paced** 的社交破冰阶段（Social Icebreaker 的一个 phase）：

- 一次性 AI 生成完整剧本 JSON（28s `PIPELINE_TIMEOUT_MS` 硬 bound，超时落 catalog fallback）
- 子阶段状态机：`empty → preview → role → act → vote → truth`（`MiniScriptHeroView.tsx:259`）
- host 权威推进 + ready 软门 + 90 秒强制揭晓；server 是 reveal 唯一权威
- 单步投票（`POST /api/miniscript/vote`，`suspectRoleSlot`）→ host `reveal-solution`
- 硬约束：低压力、无暴力死亡；sensitive truth data server-only

### A.3 结论：借鉴什么、不借鉴什么

**不借鉴（方向相悖）：**
- 单人 AI 角色自由对话 —— 真人在场时各自低头和 AI 聊天会杀死现场气氛
- AI 搭档 / 推理笔记（单人机制）
- 聊天式桌面 UI —— 我们的子阶段状态机 + stepper 组织度已优于它

**采纳（4 项，本 PRD 范围）：**

| # | 借鉴点 | 我们的适配形态 |
|---|--------|---------------|
| 1 | 证物系统 | 幕绑定自动揭示 + 玩家自由出示；反应文本预生成、server-only、查表下发，零 runtime LLM |
| 2 | 动机二步指认 | 两轮顺序投票（嫌疑人 → 动机）；`motiveOptions[]` 预生成于 JSON |
| 3 | 三层质检 | 离线 critic-revise 进 catalog 生产管线 + runtime 轻量 critic 拦截 |
| 4 | 证物/笔记面板 IA | act/vote 阶段底部抽屉式「线索面板」，client 从已有 framework 派生 |

**UIUX 评估（对比结论）：** 我们的交互流程组织良好，无需重构；短板是「阅读型而非推理型」——线索读完即翻篇、投票凭记忆、真相揭示偏静态。本 PRD 的线索抽屉 + 证物出示正是补齐推理脚手架，而非改变流程骨架。

---

## Part B · PRD

### 1. Problem Statement

mini_script 目前是「读剧本 → 凭记忆投一票」的阅读型体验：线索没有沉淀载体、投票缺乏信息支撑、推理参与感弱，导致该 phase 的社交张力（讨论、质疑、指认）未达到设计上限。

### 2. Target Users and Scenario

- **Who：** 已匹配成团、处于活动前 Social Icebreaker `mini_script` phase 的 4–6 名玩家（host + players）
- **When：** 幕间讨论与最终投票环节
- **Current workaround：** 玩家靠记忆或口头复述回顾线索；投票时无据可查

### 3. Goals and Non-Goals

**Goals：**
- 幕间出示证物触发角色反应，制造幕间讨论高峰（以出示率/独立出示人数为可量化代理）
- 投票从「单步猜人」升级为「嫌疑人 + 动机」两步推理；公开表彰两步全对者，答错仅自己可见
- 内容质量：离线 critic-revise 管线使新 catalog 剧本 100% 带齐 `evidence[]` + `motiveOptions[]`，且通过泄露检测（含反应文本与动机干扰项）

**Non-Goals：**
- 不做 runtime AI 角色自由对话 / AI 搭档 / 推理笔记
- 不做「答错重投」循环（社交阶段必须可 terminate）
- 不改 host-paced 推进骨架与 bonus gate 语义
- 「当事人第一人称自述」真相揭示（第二轮再议，社交风险待评估）
- Web 端 parity（mini-program first，后续跟进）

### 4. User Stories / Primary Flows

- 作为玩家，我可以在幕间把证物出示给某个角色扮演者，当众读出 TA 的反应，引发讨论
- 作为玩家，我可以随时打开线索抽屉，按幕回顾已揭示的线索与证物，再投出有依据的一票
- 作为 host，我可以在嫌疑人投票后带大家进入动机投票，最后一次性揭晓真相与「金牌侦探」名单

**主流程（P2 上线后）：**
1. host `reveal-act` 第 N 幕 → 全员看到该幕线索 + 该幕证物卡片自动公开
2. 幕间任意玩家点证物 → 选目标角色 → `POST /api/miniscript/present-evidence` → **反应文本仅出示者即时可见**（引导文案「大声读出来！」），其他成员端延迟约 8 秒（或出示者点「已读完」）后可见；已出示的置灰防重复。每人每幕 ≤2 次出示
3. 最后一幕后进入投票 round 1：全员投嫌疑人（复用现有 `/vote`）
4. host 调 `POST /api/miniscript/open-motive-vote` 开启 round 2 → `motiveOptions[]`（公开字段，不含正确项标记）随 round-2 开启下发，全员投动机
5. host `reveal-solution` → 揭晓当事人 + 真动机；公开渲染「两步全对」荣誉名单，答错者仅在自己设备看到温和反馈
6. 任意时刻（act/vote 子阶段）→ 底部「线索 N 条」入口 → 上滑抽屉按幕分组回顾

### 5. Acceptance Criteria

**证物系统**
- [ ] Given 第 N 幕已揭示，when 任意玩家查看证物区，then 仅显示第 1..N 幕的证物
- [ ] Given 一张未出示证物 + 目标角色，when 玩家出示，then server 返回该角色预设反应文本并广播进 session state；**出示者端即时可见并引导其当众朗读，其他成员端延迟约 8 秒（或出示者确认「已读完」）后可见**，保留现场朗读时刻
- [ ] Given 已出示过的 (evidenceId, targetRoleSlot) 组合，when 再次出示，then 客户端置灰 / server 幂等返回既有结果，不重复计次
- [ ] Given 某玩家在当幕已出示 2 次，when 再次出示，then 400 `PRESENT_BUDGET_EXCEEDED`（每人每幕 ≤2 次，host 端可见计数）
- [ ] Given 已进入 vote 子阶段（round 1 开启后），when 尝试出示，then 400 `WRONG_SUB_PHASE`——出示仅 act 子阶段合法，杜绝投票后剧透边缘
- [ ] Edge: 对 framework 中无 `evidence[]` 的旧剧本 → UI 完全隐藏证物入口，流程退化为现状
- [ ] Edge: 某幕无证据 → 证物区显示空态文案，不显示入口条计数错误
- [ ] Edge: 出示给自己的角色 → 允许，反应文案需覆盖该情况（critic 校验）
- [ ] Edge: 出示时 session 已过期 → 410 `SESSION_EXPIRED`，客户端 toast 引导；已出示状态持久化于 session state，rejoin 玩家可见当前出示进度

**动机二步指认**
- [ ] Given framework 含 `motiveOptions[]`，when 进入投票，then 先进行 round 1（嫌疑人）；host 调 `POST /api/miniscript/open-motive-vote` 后才开放 round 2
- [ ] `motiveOptions[]` 为 framework **公开字段**（不含正确项标记），随 round-2 开启下发；正确动机保留在 server-only `solution`（`extractSecrets` 边界不变）
- [ ] Given round 2 完成或超时（沿用 90s 强制揭晓，round 2 独立计时），when host `reveal-solution`，then 返回当事人 + 真动机 + 每位玩家两步各自对错
- [ ] 展示策略：客户端只公开渲染「两步全对」荣誉名单；答错者仅在自己设备看到温和反馈，不当众点名
- [ ] Given framework 无 `motiveOptions[]`（旧剧本），when 进入投票，then 退化为现有单步投票，UI 无 round 2
- [ ] Error: round 2 未开启时提交 motive → 400 `WRONG_VOTE_ROUND`

**质检管线**
- [ ] Given 离线生成新剧本，when critic-revise 跑完，then 入库剧本 100% 通过 schema 校验 + 泄露检测（**含 `evidenceReactions` 逐条与 `motiveOptions[]` 干扰项**——反应文本不得确认/排除当事人，干扰项不得蕴含真动机）+ 低压力基调检测
- [ ] Given runtime 生成完成，when 轻量 critic 检测失败（泄露/违规），then fail-closed 落 catalog fallback，用户无感
- [ ] runtime critic 调用 ≤ 5s，超时不阻塞（视为通过，依赖离线质检兜底）——预算纳入既有 28s pipeline bound；超时时上报独立事件 `miniscript_runtime_critic_timeout`
- [ ] runtime critic 行为变化受 flag 控制或 flag-off 时证明为 no-op，保证 P1「用户无感」

**线索抽屉**
- [ ] Given act 或 vote 子阶段，when 玩家上滑底部入口，then 抽屉按幕分组展示已揭示 clues + 已公开证物，纯 client 派生
- [ ] 未揭示幕的线索不出现在抽屉（无剧透）

### 6. Constraints, Risks, Dependencies, Open Questions

| Type | Item | Mitigation / Owner |
|------|------|--------------------|
| Constraint | 零新增 runtime LLM 生成（28s bound + catalog fallback 兼容） | 全部新内容预生成于 JSON |
| Constraint | sensitive 反应文本 server-only（miniscript-story-framework 硬约束） | 反应查表路由，不进 client framework |
| Constraint | 低压力基调、无暴力死亡（内容硬约束） | critic 检测项内置；每人每幕出示 ≤2 次防围攻 |
| Constraint | WeChat 审核 posture：用户可见文案不得出现「AI」 | 复用现有 AIGC 角标 fail-closed 规范 |
| Constraint | AIGC 角标口径：离线生成 + 人工审核的 catalog 内容（剧本/证物/反应/动机选项）属「预先创作」，不带角标；runtime 生成内容维持现有 fail-closed 角标规则 | P3 合规自查 |
| Constraint | flag 在 `mini_script` phase 入口解析一次并快照进 session state，全端读快照 | 防止 mid-session flip 导致 UI 分裂 |
| Risk | 存量 catalog/老 session 无新字段 | optional 字段 + UI 降级，不 bump schemaVersion |
| Risk | 两轮投票拉长 phase 时长 | round 2 沿用 90s 强制揭晓；时长增幅入 §8 指标 |
| Risk | bot/single-test 模拟卡 round 2 | P2 合同必含 bot 自动投 round 2 + 全链路 single-test 走查 |
| Dependency | catalog 重新生成（带 evidence + motiveOptions）是 ops 步骤：LLM 成本 + 人工审核门，替换生产 catalog 前需 runbook 记录 | P1 离线管线产出后 P2 才有内容可跑 |
| Dependency | DeepSeek flash 档 critic（top-level `thinking: disabled`，禁 `extra_body`） | 遵循 `docs/ai/AI_MODEL_ROUTING_STRATEGY.md` |
| Dependency | 新埋点事件需 analytics 白名单登记（参照 `flash_search_started` 先例） | P2 开工时核实 |
| Open Question | recap 荣誉形态（「本桌名侦探」是否入 connections/profile） | P3 定；命名倾向「本桌名侦探」（悦仔颁发），「金牌」偏竞技 |
| Open Question | 证物图标资产来源（JoyJoinIcon 现有集 or 新 Lovart 资产） | P2 设计时定 |

### 7. Scope Boundaries

**In scope：**
- `MiniScriptStoryFramework` additive optional 字段：`act_flow[].evidence[]`（含 server-only `evidenceReactions`）、framework 公开 `motiveOptions[]`（正确项保留 server-only `solution`）
- 新路由 `POST /api/miniscript/present-evidence` + `POST /api/miniscript/open-motive-vote`（body 携带 `socialSessionId`，遵循 `/api/miniscript/*` 顶层挂载契约）
- `/vote` 扩展 `voteRound: 1|2` + `motiveChoice`；round 状态（每轮独立 vote 数组/`openedAt`）在 P2 Sprint Contract 锁定
- `socialIcebreakerBotService` 扩展：bot 自动出示、自动投 round 2（single-test 走查依赖）
- 离线 critic-revise 管线（catalog 生产侧）+ runtime 轻量 critic
- mini-program：证物卡片区、出示交互（出示者优先揭示）、线索底部抽屉、二步投票 UI、首次出现引导提示（证物出示 + round 2）
- Feature flag `MINISCRIPT_EVIDENCE_VOTE_V2_ENABLED`（default false，phase 入口快照）

**Out of scope (v2+)：**
- 当事人自述式真相揭示、证物组合（combine）、admin 可视化剧本编辑器
- Web/admin 端 parity、单人模式

### 8. Success Metrics

| Metric | Unit | Target | Window |
|--------|------|--------|--------|
| 证物出示率（有出示行为的 session 占比） | % | ≥ 60% | 上线后 4 周 |
| 每 session 独立出示人数（社交 spread） | 人 | ≥ 2 | 4 周 |
| round 2 完成率（进入 round 2 后完成动机投票） | % | ≥ 85% | 4 周 |
| 两步全对率（难度校准带） | % | 30–70% | 4 周 |
| mini_script phase 完成率 | % | 不低于基线（基线由 QA 在 flag-on 前记录并回填本文档） | 4 周 |
| mini_script phase 时长中位数增幅 | % | ≤ 25% | 4 周 |
| runtime critic 拦截率 | % | ≤ 2%（>5% 说明生成 prompt 退化） | 持续 |
| runtime critic 超时率（`miniscript_runtime_critic_timeout`） | % | 监控，随拦截率一并报告 | 持续 |
| mini_script 结构化 CSAT（event_feedback 新增题） | 分 | 较基线 +10% | 8 周 |

埋点：`miniscript_evidence_presented`、`miniscript_vote_round{1,2}_submitted`、`miniscript_clue_drawer_opened`、`miniscript_runtime_critic_blocked`、`miniscript_runtime_critic_timeout`——需先登记 analytics 白名单（参照 `flash_search_started` 先例）。

### 9. Engineering Impact Areas (Hypotheses)

- **Schema：** `packages/shared/src/miniscriptStoryFramework.ts`（additive optional 字段；sanitized 边界更新——`evidenceReactions` 不下发；注意现有字段是 `act_flow[]` 不是 `acts`）
- **Server：** `routes/domains/miniscript.ts`（present-evidence + open-motive-vote 路由、vote 扩展、reveal-solution 扩展）；`services/socialIcebreakerBotService.ts`（bot 出示 + round 2 投票）；runtime critic 进生成 pipeline；`logAITrace` 新 promptVersion
- **离线工具链：** catalog 生成脚本 + critic-revise 循环（对齐 flash `check-flash-story.mjs` 模式）
- **Mini-program：** `MiniScriptHeroView.tsx`（证物区、抽屉、二步投票、引导提示）、`useSocialActions.ts`（新 action）
- **测试：** `miniscriptClientPathContract.test.ts`——**既有断言不改、只新增**；vote/reveal/present/open-motive-vote 单测；sanitized 边界回归测试；bot 模拟全链路（round1→round2→reveal）

---

## Rollout Plan

- [x] Feature flag：`MINISCRIPT_EVIDENCE_VOTE_V2_ENABLED`（default false，DB-backed 走 `featureFlags.ts`）
- [x] Dark launch：P1 用户无感；P2 flag 先在 staging 开启验证
- [x] Rollback：关 flag → 回到单步投票 + 无证物 UI；schema additive 无需数据回滚

| Phase | 内容 | Harness Tier | 验收 |
|-------|------|-------------|------|
| **P1 数据层** | schema optional 字段 + 离线 critic-revise 管线 + runtime 轻量 critic + catalog 重新生成 | Tier 2 | critic 质检报告 + catalog 100% 通过 |
| **P2 玩法层** | present-evidence 路由 + 两轮投票 + 证物 UI + 线索抽屉（flag 保护） | Tier 2（Sprint Contract 必需） | staging 全流程走查 + 契约测试 |
| **P3 打磨** | 真相揭示仪式感、recap 荣誉、completeness/performance/user-satisfaction audits | Tier 1–2 | audits PASS |

## Grill-Me 决策记录（2026-08-28）

| # | 问题 | 决策 |
|---|------|------|
| Q1 | 迭代主目标 | 多人现场体验 + 内容生产管线；不做单人 AI 对话 |
| Q2 | 机制选型 | 证物系统 + 动机二步指认；暂缓当事人自述 |
| Q3 | 质检时机 | 离线 critic-revise（主）+ runtime 轻量 critic（兜底拦截） |
| Q4 | 出示交互模型 | 幕绑定揭示 + 自由出示（非 host 控制、非回合制） |
| Q5 | 投票状态机 | 两轮顺序投票；答错不阻塞，只影响 recap 荣誉 |
| Q6 | 线索面板形态 | 底部抽屉，client 派生，零 server 改动 |
| Q7 | Schema 演进 | additive optional 字段，不 bump schemaVersion，UI 优雅降级 |
| Q8 | 出示路由边界 | 新 `POST /api/miniscript/present-evidence`，反应文本 server-only |
| Q9 | 交付分期 | 三期 + 单 flag，P1 → P2 → P3 |
| Q10 | 反应下发节奏（PM 评审 BLOCKING） | 出示者优先即时可见 + 引导朗读；其他成员延迟 ~8s 或「已读完」后可见 |
| Q11 | 出示节奏约束（PM 评审 BLOCKING） | 每人每幕 ≤2 次（`PRESENT_BUDGET_EXCEEDED`）；仅 act 子阶段合法（`WRONG_SUB_PHASE`） |
| Q12 | 答错展示策略（PM 评审） | 公开只表彰两步全对者；答错仅自己设备温和反馈 |

## 评审修订记录（2026-08-28，@product-manager + @supervisor）

- round 1→2 过渡路由 `POST /api/miniscript/open-motive-vote` + `motiveOptions[]` 公私边界（公开选项、正确项 server-only）写入 §5/§7（Supervisor BLOCKING）
- critic 泄露检测扩展至 `evidenceReactions` 逐条 + `motiveOptions[]` 干扰项
- flag phase 入口快照、bot 模拟 round 2、analytics 白名单、catalog regen ops runbook 写入 §6/§7
- 指标硬化：独立出示人数、双对率 30–70% 校准带、phase 时长 ≤25%、critic 超时独立事件、结构化 CSAT、基线 flag-on 前回填
- 契约测试「只增不改」列为 P2 验收；`acts`→`act_flow` 命名修正；补 4 个前置技能
- P2 Sprint Contract 必锁：round 状态表示（每轮独立 vote 数组 + openedAt）、round-2 法定子阶段、契约测试 additive
- P1 Sprint Evaluation 附 lightweight `harness-verification-gate` 5-pillar 检查（pipeline 有事故史）
