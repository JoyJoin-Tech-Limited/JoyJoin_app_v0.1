# 悦仔内容生成扩展：PM × 商业化统一修订裁决

> 日期：2026-10-26
> 输入：M1.1 三 port 草案（`ContentContext` / best-of-2 + critic + selector / `improved-flat-worse`）
> 评审：product-manager、commercialization-genius、主会话代码复核
> 结论：**不做通用内容框架；改为 Warmup Correctness + Evidence。离线内容消融可做，live best-of-2 暂不做。**
>
> **后续用户决定（2026-10-26）：所有相关 flag 默认 ON，由团队确保迁移、真机与合规工作完成。** 因此本文 §6/§8 的「默认 OFF / 生产先显式 OFF」建议不再作为发布策略；child flag 若未来实现，也按默认 ON 设计。实验证据门槛不变。

---

## 1. 总裁决

| 议题 | 裁决 |
|---|---|
| 通用三 port 内容框架 | **拒绝**。一个消费者时抽象漂移大于收益 |
| Agent/manual 生成输入 parity | **必须修**（代码已证实 agent 漏传 roster） |
| 持久 no-repeat | **必须修**（process-local window 不是保证） |
| `TopicDeckPlan` 新能量弧 | **先不建**；现有 prompt 已有 vibe-specific arc，先 fixture 验证 |
| Context-enriched N=1 | **可进入离线消融**，白名单输入 |
| Live best-of-2 + critic | **暂缓**；先离线证明 same-context N=2 能稳定胜过 N=1 |
| `improved/flat/worse` 标签 | **不成立为会话质量真相，更不得作 runtime reward** |
| M1 timing/Stage A 发布 | **优先于内容扩展**，不得让路 |

---

## 2. 代码证实的真问题（不是想象中的需求）

1. **输入不等价**：agent `xiaoyueAgentActions.ts` 未传 roster；manual `/topics` 传了。Agent 旋转因此丢掉已有的 archetype / shared-interest 上下文。
2. **去重不是持久契约**：`warmupTopics.ts` 用 process-local recently-served window；重启、多实例、窗口失效后可能重复。caller 的 `avoidTopics` 也没有被统一强制。
3. **N=2 有副作用**：直接调用两次生成器会让**被丢弃的候选也进入 recently-served**，污染后续去重。候选采样必须与“实际 served 记录”分离。
4. **现有资产被低估**：vibe-specific arc、可选 async judge、`helpful|neutral|awkward` 反馈契约已存在，不应另造平行系统。

---

## 3. M1.1：Warmup Correctness + Evidence（先做这些）

### 3.1 输入 parity 与白名单

复用 warmup-specific 契约，不建通用 `ContentContext`。允许：

- 现有 `mood / vibe / eventType / participantCount / highlights`
- 聚合 archetype 计数
- 最多 3 个「至少 2 人共同」的兴趣标签

禁止：姓名、user ID、bio、个体 ACOEXP、个人 pulse 历史、对话原文。`rotationReason` 先只进 policy/episode，不进 prompt；`elapsed/remaining/energyTrend/lastDeckOutcome` 暂不进入。Roster enrichment 失败必须退回现有 no-roster 路径，不得阻断换题。

### 3.2 `servedTopicKeys`，不是 `discussedTopics`

发牌/推进不等于聊过。只在 atomic commit 记录本场已发题 key；后续 live 与 curated fallback 都过滤 exact / normalized ID+question 重复，覆盖 retry / rejoin / restart。池耗尽时确定性 relax，并记录 `dedupeRelaxed`，绝不空 deck。只承诺精确去重，不宣称语义近重消除；不做跨场内容记忆。

### 3.3 现有 arc fixture 验证

`chat=6 / balanced=5 / game=4`，先轻后深，首张 gentle，brave-safe 不作 opener。live 与 curated 都要过固定 vibe/mood/roster 矩阵。只有发现违规才加确定性修复；不靠 N=2 掩盖 arc 问题。

### 3.4 一次调用、一个总 deadline

每个 accepted rotation 最多 1 次生成调用；**accept → terminal 总共 6s**。旧 deck 保留到 revision+1；ready、幂等、revision conflict、schema、moderation、per-item AIGC 全部不变。安全是硬门，不是 critic 加权项。

### 3.5 房内零新增 UX

不加候选选择器、结果徽章、恢复分、实时 outcome 问卷。Participant 仍只见既有静默 crossfade。

### 3.6 证据包先行

以 `socialSessionId + topicSetRevision` 串联 askId / promptVersion / aiCorrelationId / variant / fallbackUsed / latency / 原始信号与实际曝光。先做人盲评（清晰度、具体度、环节适配、心理安全、重复）。若没有实质 gap，停在 correctness fixes，不为架构 momentum 继续加层。

---

## 4. 诚实的 outcome 与指标

`improved/flat/worse` 不能由 activeRate、tap、ready、advance 推断。好聊天常意味着更少看手机，反标签会奖励更多屏幕操作。

只保留：

- 原始 +60/+180 聚合快照与显式反馈，分开存储。
- 离线可选 `better / same / worse`：仅在可比较的 host pulse 或显式内容反馈存在时计算。
- `unobserved`：post 反馈不足或未真实曝光；**缺失绝不是 flat**。
- `invalidated`：phase change 或其他介入破坏归因。

必须带 confounders：基线趋势、实际 offset、phase/预算/转换、roster/host 变化、presence、响应覆盖、其他介入、mood/tier、后续 revision、曝光、variant/provider/fallback、test 排除、可得时的前后台与网络状态。标签在验证前不得进入 prompt/selector。

**北极星改为参与者级 30 天再次付费到场**（到场日期、含权益/credit 兑换，排除 staff/bots/test/refunded/unattended），不是「第二笔支付」——月卡复到场可能没有新支付。`groupOutcomePayload.icebreakerRatings.overall='neutral'` 是 placeholder，禁止作为质量标签。

---

## 5. 实验顺序：先 timing，再内容，再候选

### Gate A — M1 timing（先过）

同 generator/prompt，桌级 agent on/off。**先修 Stage A 有效性门槛**：12 处理桌 × warmup 每桌最多 1 个可执行 Ask = 理论上限 12 次曝光。现行规则如下：

- 启动前预注册基线、MDE、双侧 **α=0.05**、**power=0.80**，并记录每桌预期人数与 ICC；以桌为随机化与分析聚类单位，按设计效应（`DEFF = 1 + (m - 1) × ICC`）计算每臂所需桌数及对应的可执行 Ask 曝光预算，同时报告桌级聚类置信区间。若 12 次实际上限低于功效分析所需曝光量，本阶段只能判为 underpowered / inconclusive，必须扩桌或调整 MDE，不能把不显著宣称为有效或无效。
- 处理前必须完成 **A/A 或 shadow** 校验，验证桌级分配、基线平衡、曝光日志与指标管线；校验失败不得进入 A/B 效果解释。
- **Gate A 只检验 timing**：固定 generator、prompt 与内容，内容实验留在 Gate B/C，不得混入本门或借用本门样本作内容 uplift 结论。

若 Ask 曝光/采纳不足，先修触发与 UX，停止内容投资；若采纳与恢复都好，当前内容已够，不做内容层。

> **已拒绝的历史规则（不参与现行 Gate A 判定）**：原「至少 100 次 Ask 曝光，否则结果无效」在 12 处理桌、每桌最多 1 次曝光的设计下数学上不可达，且未经功效分析；保留此句仅为审计历史。

### Gate B — 离线内容消融（可与 Gate A 并行）

冻结上下文定义，比较：
- A：current N=1
- B：context-enriched N=1
- C：same-context two-candidate + 确定性 selector

B 必须先证明值得（提案筛选线：对 A 偏好 ≥60% 且负向 ≤25%，需按实际基线校准）；C 必须同样胜过 B，才允许讨论 live N=2。现有 judge 先与人工评分校准。全部候选、fallback 都计入分析，避免只看好 LLM 输出的选择偏差。

### Gate C — 仅在 A+B 通过后，桌级 content-only 实验

固定初始 deck、agent policy、Ask 文案、阈值、UI、价格；只在首次 accepted rotation 分配 current vs 一个内容 variant，按 rotation reason/vibe/host 分层，ITT 分析全部 fallback。内容主指标为盲评与 phase-exit/recap 的 exposed-deck helpful/neutral/awkward；Ask 采纳、活跃、复购不是内容质量主指标。

---

## 6. 若未来做 N=2，硬约束一次写死

- 最多 2 次主调用，约 ¥0.0208/action；两次都过调用前预算预检，被丢弃候选也计成本。
- 并行调用、**整个 action 共享 6s**，不是每个 candidate 各 6s；不允许串行 6s 生成或 6s 内 LLM critic。
- 确定性 selector，零额外 LLM；deadline/安全/fallback/成本不得回退。
- 候选生成与实际 served 记录分离，修掉污染去重的副作用。
- 只有离线 C 稳定胜过 B、且运行时证明通过，才实现 child flag `icebreakerAgentContentPlanningEnabled`（当前仅为提案；按用户决定，未来实现时默认 ON）。

---

## 7. 不做清单

不做多 Agent / Director / 每 tick LLM / 无限 fan-out；不做个体画像或对话文本进 prompt；不做跨 session 内容记忆；不做 runtime 自我改写；不把 episode 变成跨场读取；不加价、不做 tier 权益、不房内置支付 CTA；不宣称行业第一、读情绪或自学习护城河。

---

## 8. 执行顺序

1. **已完成**：+60/+180 原始恢复快照、hook 上移删 ref、mini 70 files / 823 tests、typecheck、build:weapp、subpackage styles 全绿。
2. **P0 发布前置**：应用 0099、真机矩阵、微信备案/提审；parent flag 保持 ON，以上清单由团队负责完成（不再采用生产 DB 先显式 OFF 的策略）。
3. **P0 并行**：M1.1 correctness + 离线 A/B/C 消融（3–5 人日）；修 Stage A 门槛与 attendance/entitlement-aware 指标（2–3 人日）。
4. **P1**：证据成立才实现 child flag 与 cheapest winning variant。
5. **P2**：才讨论 live N=2、其他 phase、selector learning。
