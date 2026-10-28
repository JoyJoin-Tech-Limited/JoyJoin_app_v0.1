# W1–W3 画像驱动破冰实施计划

> 日期：2026-10-27（2026-10-28 状态更新）
> 状态：**M1.2a 已实现**（archetype 归一 / profile 门禁 / 兴趣全集派生 / XiaoYue prompt 去 W3）。**M1.2b 已实现主体**（`TablePersona`、`role_results` 批量 X/A/E、GroupMirror anchored prompt、HostTableBrief persona pace）；**M2 已实现**（`tableRhythm` 接入 `compileForSession`，duration-only recompile 已修）；**M3 已实现**（group_mirror 锚点提问）。production/staging 画像审计、人工 DQS 与发布门仍未完成。
> 前置策略：`2026-10-27-profile-aware-icebreaking-plan.md`
> UI/UX 规格：`icebreaker-guidance-quiet-concierge-20261027.md`（活动说明书 / 当前环节提示 / Host 桌边小提示）
> 约束：**轻量丝滑、零新参与者动作、零培训、流程确定性、画像只用于桌级派生**
> 注意：正在进行的 playbook 轻量评审若进一步删减 host 指导，C1 只保留更少内容，不增加卡片。
>
> **轻量体验覆盖（2026-10-27，PM × 商业化评审）**：默认路径固定为「开局已有一组卡 → 3 张 warmup-style 卡 → 停止推内容 → host 显式 advance」。无方法库、无主/备/救场选择器、无开局前说明书、无 speaker/pair/role 分配、无可见倒计时、无强制披露。host 前 15 分钟动作 ≤3，参与者新增输入 = 0。任何与此冲突的 C1/C2/M2 设计均以本文 §10 的轻量覆盖为准。

---

## 0. 目标与非目标

### 目标

把「用户提供的个人信息」转化为三类安全输出：

1. **W1：更好的内容上下文**——模型只看到桌级聚合信号。
2. **W2：更合适的流程参数**——顺序、时长、具体度、避雷、host 提示，纯函数决定。
3. **W3：永不进入破冰运行时**——自由文本、敏感/精确身份字段、个体心理或行为评分。

最终用户感受不是「系统知道我」，而是「这桌被准备过，而且没人需要多学一套玩法」。

### 非目标

- 不做个人档案展示、AI 读心、按分数点名、公开排序。
- 不做 24 个 agent、不强制使用 playbook、不要求 host 示范或背稿。
- 不新建通用 Profile Context 中台、不新建画像数据库、不做跨场个人记忆。
- 不做 live best-of-2、critic LLM、自学习 selector。
- 不涨价、不分层、不把画像当作独立收费点。

---

## 1. W1–W3 的可执行边界

| 层 | 字段/派生 | 允许用途 | 禁止用途 |
|---|---|---|---|
| **W1 聚合内容上下文** | canonical archetype 构成；兴趣 taxonomy/热度/coverage；桌级 vibe 偏好；城市/区；经同意后的 lifeStage 分档 | 进入 warmup prompt 的受控字段；curated fallback；deck 选择 | 姓名、userId、个人原始数组、任何“谁知道什么”的描述 |
| **W2 流程-only** | 桌级能量/深度偏好；化学分档；pair connection points；pulse 趋势；ACOEXP X/A/E 的桌级聚合；行业宏观/年龄段/lifeStage 多样性；新手比例 | run plan、时长、具体度、避雷域、host-only 提示、后续实验的首发/配对建议 | 不进入用户可见画像叙述，不暴露个人分数，不作为公开点名理由 |
| **W3 永不进入** | bio/对话原文；精确生日/性别/收入/婚恋/精确位置；个体 ACOEXP；逐人 pulse/活跃排名；匹配分数与双人 chemistry；AI 推断敏感标签 | 无 | prompt、可见文案、流程决策、日志 |

**同意不是 blanket waiver。** 现注册/匹配同意不能自动视为「用于这一桌的内容与流程 + 第三方模型处理」的同意。实施前需要 consent text 审计；可撤回、可删除、目的限定。任一桌成员撤回，整桌回退通用路径，避免“谁退出了”成为新信息。

---

## 2. 总体结构：一条派生管线，三个出口

```
users / user_interests / role_results / pool_groups（只读）
        │
        ▼
修正后的 roster projection（server-only）
        │
        ▼
deriveTablePersona()（纯函数，无 LLM，无个体输出）
        │
        ├─ WarmupPromptContext   → 现有 generateWarmupTopics（W1）
        ├─ FlowContext           → runPlanCompiler / Agent policy（W1+W2）
        └─ HostTableBrief        → host-only 说明书（零 LLM）
```

**核心原则：** LLM 永远不读 roster 原始档案；它只读 `deriveTablePersona()` 批准后的聚合上下文。所有缺失/异常都退回现有通用路径，不阻断开桌。

### 不新增持久画像层

- 不为画像建表，不把原始 profile 写入 episode 或 AITrace。
- 第一版按请求计算；只有性能证据证明必要时，才允许在 **6h session state** 内保存**纯聚合派生快照**（participant 端裁剪），作为独立性能决策。
- `social_agent_events` 继续只存聚合事实，90 天删除；不存 prompt 原文、画像或个体分数。

---

## 3. 阶段 0：先证明管线不是空转（2 天）

在做任何 tailoring 前，对近 30 天满员局做只读抽样（20–30 桌）：

| 指标 | 目的 | 通过线（首轮建议，待真实数据校准） |
|---|---|---|
| `mixText` 非空率 | archetype 是否真进入上下文 | >90% |
| `sharedInterestCount` 分布 | 共同兴趣是否存在且可用 | ≥1 锚点的桌 >60% |
| `profile` 非空率 | 画像投影是否被 legacy 判空吞掉 | 查明原因，不设粉饰目标 |
| 锚点落在「咖啡/旅行/电影/美食/健身」比例 | 是否被选样逻辑推向通用礼貌标签 | 记录基线，供 A/B |

**停止条件：** 如果 archetype 已充足但共同锚点仍极稀疏，先做 taxonomy/声明质量，不做「桌说明书」包装。

---

## 4. M1.2：修管线 + Host-only 桌说明书（约 2 周）

**实现状态（2026-10-28）：** M1.2a 已落地并验证：`resolveRosterArchetype()`（primary → legacy，24 旧名归一）、`contextInjector`/`runPlanCompiler`/六条 roster 投影、profile 门禁（任一画像字段存在即构造）、兴趣读取上限 5→64、taxonomy/同义词归一、coverage + 具体度 + macroCategory 多样性 anchor 选样，以及 XiaoYue comment prompt 的 W3 字段清除（promptVersion `social-xiaoyue-comment-v3`）。**M1.2b/M2/M3 已落地主体**：`TablePersona` 确定性聚合（X/A 能量、depth、anchors、diversity）；`role_results` 单次批量 latest + 0–100/0–10 归一；HostTableBrief 按 energy/depth 选择策展 pace；`tableRhythm` 接入 `compileForSession`，总量不变、不增删/重排 phase；warmup-growth recompile 使用完整 plan 签名，duration-only 变化也会持久化；group_mirror 使用聚合 anchor 的 anchored promptVersion。`icebreakerMatchingAwareEnabled` 已默认 ON。只读审计脚本 `audit:icebreaker-profile-context` 已可运行；本地 dev DB 返回 `INSUFFICIENT_DATA`（0 sessions），生产/staging 只读审计、人工 DQS/Stage A 与任何线上效果声明仍未完成。

### 4.1 数据修正（必做）

1. **Archetype 归一**
   - 新增 `resolveRosterArchetype()`：`primaryArchetype ?? archetype`，legacy 中文名通过现有 map 归一为 canonical id。
   - 替换所有画像派生读取点；不允许 legacy 缺失时静默退回中性 60。
   - 24 个 legacy 名做表驱动测试：canonical 与 legacy 同分、同 shyHeavy、同 run plan。

2. **Profile 门禁**
   - 从 `participant.archetype ? buildParticipantProfile(...) : null` 改为「任一允许画像字段存在即构造」。
   - 不再因 legacy `users.archetype` 为空而丢弃 V4 用户的行业/城市/人生阶段等字段。

3. **真实 ACOEXP 来源**
   - 用 `role_results` 的 X/A/E 做桌级派生；停止使用没有生产写入者的 `vibeVector` 作为状态标签来源。
   - 不输出个人分数，不读 O/C/P 进 prompt。

4. **共同兴趣派生**
   - 删除「每人先截断 5，再求交集」的偏差；在全量声明上求公共性。
   - taxonomy id/同义词先归一，再计算 coverage。
   - 返回 `{taxonomyId,label,coverage,supporters,salience,distinctiveness,conversationPotential,safety,macroCategory}`。
   - 选样按 salience × distinctiveness × conversationPotential × safety，而非 count-desc。
   - 通用礼貌标签降权；候选池最多 8，按 macroCategory 去重；prompt 3（chat 4），deck ≤1；host 备用可折叠 6–8。

### 4.2 C1：Host-only「这张桌的说明书」（零 LLM）

首版只输出**确定性聚合结果**，不是 AI 总结：

- 桌级节奏一句（如「这桌偏慢热，先用具体小事」）。
- 1 个主锚点 + 1 个备选（含 coverage，不点名）。
- 1 个避雷域（只写领域，不写谁造成）。

**认知预算：** 默认 ≤3 行；不要求 host 打开菜单、读 playbook、做示范或背话术。普通 host 不操作也能继续原流程。说明书只帮助愿意看一眼的人。

**可见性：** host-only；participant 无此 payload；无可读信息时整块不显示，不展示「数据不足」。

### 验收

- Archetype/门禁/锚点 diff 可解释；无 silent neutral fallback。
- host brief 不含 userId、姓名、bio、精确年龄、个人分数；participant sanitizer 测试通过。
- P95 计算 ≤300ms；开桌 LLM 成本增量 = 0；OFF 与现状字节一致。
- 复用 `icebreakerMatchingAwareEnabled`，指定 owner；不再新增画像 flag。

---

## 5. M2：W1 内容贴合 + W2 流程校准（约 3 周）

### 5.1 WarmupPromptContext（只给批准的字段）

```ts
{
  archetypeMixText?: string
  sharedAnchors?: Array<{ label, coverage, macroCategory }>
  firstCardConstraint?: 'concrete_scene' | 'binary_choice' | 'low_disclosure'
  avoidDomains?: string[]          // 只有领域，没有成因或个人
  mood, vibe, eventType, participantCount, highlights, avoidTopics
}
```

- 无锚点时 prompt 与当前版本**字节一致**；有锚点走新 promptVersion。
- 每 deck 最多 1 张画像卡，且必须保留通用入口；不会变成共同点清单。
- 锚点可见文案采用更高覆盖阈值（建议 ≥ max(2, ceil(n/2))）；幕后 prompt 可保留 2 人共享。
- `rotationReason` 暂只进 episode，不进 prompt；`lastDeckOutcome` 不进入。

### 5.2 FlowContext 与纯函数 run plan

```ts
{
  energy: 'low'|'mid'|'high'
  depthAppetite: 'light'|'mixed'|'deep'
  firstTimerRatio?: number
  diversity: { archetypeSpread, industrySpread, lifeStageSpread }
  avoidDomains: string[]
}
```

- `resolveTableAdjustedRunPlan(basePlan, flowContext)` 只能调整**顺序、时长与具体度约束**；不得跳过核心环节，不得自动推进。
- 低能量：更早结构化低压力、首题具体、降低披露要求；高能量：峰值后移；同型/高度异质各有策展规则。
- 首问对象、配对建议、跨圈动作**先作为 host-only 实验**，不进入默认路径，也不要求 host 执行。
- 一切 enrichment 失败保持 basePlan。

### 验收

- 20 场 golden replay：安静桌不出现更多高披露要求，核心 phase 不丢，顺序确定。
- 6s 总 deadline、fallback、AIGC、ready/idempotency 不回退。
- DQS 离线门：Δ≥0.40、偏好≥60%、可靠性≥0.60、无维度下降 >0.20、硬门槛全过；不过就不做 live 内容实验。
- 参与者没有新增动作、页面、评分或画像展示。

---

## 6. M3：Group Mirror 画像化（需 M2 证据，约 4 周）

- 只用 W1 锚点启发**欣赏式**提问；保留 `isAppreciationGroupMirrorQuestion` 硬门。
- 不做「系统眼中的你」、不做性格评价、不做个体打分。
- 任一「这题在说我」/awkward 投诉即回退通用题库。

---

## 7. 文件落点与分工

| 工作 | 主要落点 | owner |
|---|---|---|
| Archetype/profile/ACOEXP 修正 | `socialIcebreakerStore.ts`、`contextInjector.ts`、新 `rosterProfile.ts` | Backend |
| 锚点全集派生/选样 | `icebreakerRosterSignals.ts`、taxonomy helpers、tests | Backend |
| TablePersona 与三个出口 | 新 `tablePersona.ts`、`runPlanCompiler.ts`、`runPlanService.ts` | Backend |
| Prompt/fallback | `socialIcebreakerAI/warmupTopics.ts`、`ai/socialIcebreakerPrompts.ts` | AI/Backend |
| Host brief | 新只读 host route + `XiaoyueSessionShell` 的轻量插槽 | Backend + Taro |
| 证据/指标 | DQS evaluator、锚点 diff 报告、guardrail 报表 | QA/Analytics |

**不新增数据库表；若未来确需 consent version 字段，再单独走 migration 评审。**

---

## 8. 实验与发布顺序

1. **阶段 0 数据审计**（先于代码承诺）。
2. **M1.2 管线 + C1**：先出派生 diff 与说明书可用性，不改 prompt。
3. **M1 Stage A timing**（现有桌位先消耗，内容不要抢桌）。
4. **Gate 0（40 桌，零 LLM）**：确定性特定卡 vs 通用卡，感知分 Δ≥0.4，awkward 不升；不过就停止内容投资。
5. **Gate 1 离线 DQS**：A=current、B=W1 enriched、C=同上下文 N=2；B 不胜 A 不做富上下文，C 不胜 B 不做 live N=2。
6. **Gate 2 房内护栏**：6s、成本、awkward、投诉、phase completion；只读，不把小样本当效果证明。
7. **Gate 3 商业季度方向**：30 天付费复到场 + 单场→三连迁移；样本不足只写 inconclusive。

---

## 9. 发布护栏与 kill criteria

- 任一「我的资料被拿到桌上」投诉：全局 `icebreakerMatchingAwareEnabled` OFF，该 session 回退通用。
- 锚点派生修复后命中率提升 <10pp：停止信号层包装，回到 M1 timing。
- 说明书 3 秒内关闭率 >50%：删除，不教育用户。
- phase completion 下降 >5pp 或 awkward +2pp：回退流程变更。
- 成本 >¥0.20/桌、P95 >6s、AIGC/备案不合规：禁止发布。
- host 额外工作上升、participant 需要学习新规则：默认路径简化失败，必须删功能而不是加教程。

---

## 10. 轻量 playbook 覆盖（PM × 商业化，2026-10-27）

### 10.1 不做 24 方法库，也不做选择器

24 个方法不是内容资产，而是培训、选择与 QA 负债。普通 host 不应诊断桌情、选方法、分配发言人/配对/角色、管理可见倒计时或解释 agent。「主/备/救场」也不进入产品语言：下一张就是备用，现有 M1 换题就是救场。

「agent 知道 20–30 个方法」只能是内部策展知识库，**不是用户目标**。用户目标是：host 需要知道 0 个方法，系统提供一条明显路径、一个可靠救援、一个优雅收尾。Agent 的水平首先体现为「何时保持安静」。

### 10.2 默认路径只有四个原语

1. 具体、可回答的 prompt copy（A/B 可答任一/两者/跳过，细节可选，不构成顺序门槛）。
2. 一次性静态许可「可以先听，不想答就跳过」；不新增个人 pass 按钮或记录。
3. 现有 M1 host-gated 换题救援；轻量默认中，elapsed/quiet 单独不得制造 timer-only rescue。
4. 现有 recap + 活动后 mutual consent。

默认：**3 张 warmup-style 卡 → 停止推内容 → host 准备好后显式 advance**。第 15 分钟不自动换卡、不自动救援、不自动 advance；继续聊当前卡完全合法。host 前 15 分钟动作 ≤3；rescue 全场最多 1 次可选；参与者新增决策/输入 = 0。

### 10.3 C1「桌说明书」不进默认路径

Host-only 只解决可见性/隐私，**不解决认知负荷**。因此：

- 不做开局前必读说明书，不做 6–8 张备用卡。
- 至多保留「当前情境的一条轻提示」，且必须可忽略、不影响原流程；没有信息就不显示。
- 在该提示未通过 effort/comfort 证据前，C1 视为延后，不作为 M1.2 的必备交付。
- 不分配首发者、配对、角色，不要求主持人故事或 40 秒示范。

### 10.4 轻量验收先于内容/商业指标

- 2 天、5 个新手 host、15 分钟无培训试局：预读必须为 0，全部能无帮助开始并完成；用于消混淆，不宣称统计证明。
- 随后桌级 A/B：当前 opening vs reduced opening，**前 3 张策展卡与救援内容相同**，隔离交互 effort 与内容质量；与 M1 实验串行，预注册 baseline/MDE/cluster/power。
- 主证据：host effort 1–5 分下降 ≥0.5（table-clustered CI 不含 0）；≥90% 新手无指导完成；host 动作中位 ≤3、P90 ≤4；首张可用卡 P95 ≤8s；参与者新增输入 = 0。
- 护栏：awkward ≤+2pp、helpful ≥-5pp、early exit ≤+5pp、投诉 <2%；任何强迫披露/隐私 P0 即停；健康安静不得产生 timer-only rescue。
- 更多卡/tap/ready/活跃/Ask 采纳/方法使用均不是成功指标。DQS 只证内容，不证 host 轻松或复购；商业功效不足只能 INCONCLUSIVE。

### 10.5 对原计划的明确删改

- 删除/延后：24 库与 selector、首发者分配、稀有同好/跨圈配对、角色分工、主持人示范、可见时间盒、能量换挡、开局前说明书、房内付费 CTA。
- 保留：固定轻→具体内容弧、软时间预算、M1 host-gated 换题、自动 recap、单场→三连与 30 天复到场作为长期结果指标（不在房内强推）。
- 延后到 custom mode 或独立证据：稀有共同点配对、共同创作、画像驱动流程、能量杆、下次见面承诺。

---

## 11. 第一批工程任务（可直接排期）

1. `resolveRosterArchetype` + 24 个 legacy 名表驱动测试。
2. profile 门禁修复 + V4-only fixture。
3. `role_results` X/A/E 聚合，不输出个人分。
4. 全量兴趣交集 + taxonomy 归一 + 选样评分 + 通用礼貌标签降权。
5. 20–30 桌只读数据审计报告。
6. `deriveTablePersona`（零 LLM）与 sanitizer/延迟测试；**不默认输出 host brief**。
7. 仅在 effort/comfort 证据后评估一条可忽略的情境轻提示；否则保持无说明书路径。

**一句话：** 先把「拿到的数据真的能用」修好，再让画像只改变「哪张卡、哪个顺序、哪个雷区别碰」。默认用户什么都不用学，才是这条实施计划的验收线。
