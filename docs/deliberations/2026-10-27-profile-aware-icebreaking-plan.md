# 画像驱动破冰：结构化路线（PM × 商业化 × 资深桌主）

> 日期：2026-10-27
> 状态：方案已评审，待拍板 3 项，尚未实施
> 输入：product-manager、commercialization-genius、资深桌主（社会心理 / host 运营）三方独立评审
> 关联：`docs/deliberations/2026-10-26-icebreaker-agent-content-plan-review.md`、`docs/design/icebreaker-content-quality-evaluation-20261026.md`

---

## 0. 一句话裁决

**“让悦仔完全读懂用户画像”不是把个体档案塞进 prompt，而是让服务端把这桌人的共同点算准，并让流程先适配、内容后适配。当前首要工作不是加画像层，而是修三条已经断掉的数据管线。**

---

## 1. 当前真实状态：画像在“空转”

| 问题 | 代码事实 | 后果 |
|---|---|---|
| canonical 人格未被使用 | `buildArchetypeContext` 只读 legacy `users.archetype`；V4 测评写 `primaryArchetype` | `mixText` 很可能为空；run plan 的 shyHeavy 判定失效 |
| profile 被同一 legacy 字段误门禁 | `profile: participant.archetype ? buildParticipantProfile(...) : null` | 行业、年龄、城市、人生阶段、vibe、教育、bio 对 V4 用户全为 null |
| 共同兴趣在线未启用 | `icebreakerMatchingAwareEnabled` 默认 false，标记“停放/无 owner” | 共同兴趣从未进入线上 prompt |
| stateLabel 无源 | 依赖 `vibeVector`，生产无写入者 | 永远 null；真正 ACOEXP 在 `role_results` |
| 兴趣先截断再求交集 | 每人只取前 5 个标签，再求共同标签 | 公共性被个人热度排序污染 |
| 全程无画像评测 | 没有 mixText 非空率、sharedInterestCount、profile 非空率 | 无法判断修完有没有用 |

**结论：先修数据管线；在修好之前新增 tailoring 层，只会得到一套看不见效果的功能。**

---

## 2. 产品边界：group-shaped，不是 person-shaped

### 2.1 三层白名单

| 层 | 内容 | 进 prompt | 进用户可见文案 | 影响流程 |
|---|---|---|---|---|
| **W1 聚合上下文** | 兴趣标签、canonical 人格 id、桌级 vibe 偏好、城市/区、lifeStage 分档 | ✅ 仅聚合 | ✅ 仅“共同锚点 + 覆盖人数” | ✅ |
| **W2 只影响流程** | 桌级化学分档、pair 连接点、pulse 趋势 | ❌ | ❌ | ✅ |
| **W3 永不进入** | bio、精确年龄、性别、学历、行业细分、对话原文、个体 ACOEXP、逐人 pulse/活跃度、AI 推断兴趣 | ❌ | ❌ | ❌ |

**一句话规则：说“这张桌”，不说“你们几位”；说“看起来”，不说“你是谁”。**

### 2.2 四层计算模型

| 层 | 来源 | 规则 | 是否持久化 |
|---|---|---|---|
| L0 声明事实 | `user_interests`、`primary_archetype`、`table_vibe_preference`、`current_city`、`life_stage` | 不截断 | 否（输入） |
| L1 群体派生 | L0 + roster | 覆盖率、能量配比、共同锚点、禁忌域 | 否，内存计算 |
| L2 现场观察 | ready、pulse、完成率、超时 | 只有桌级聚合 | 随 session 6h |
| L3 排桌派生 | 化学分档、pair 连接点 | 只取分档，不取分数 | 随 group 生命周期 |

L1 是唯一进入 prompt 的画像层；L3 拿不到就退回 L1，绝不阻断开桌。

---

## 3. 内容与流程分开

| | 内容选择 | 流程控制 |
|---|---|---|
| 机制 | LLM + curated fallback | 纯函数、确定性、可回放 |
| 输入 | L1 聚合 + L2 桌级 | L1/L2/L3 分档 |
| 失败 | 回 curated，不空白 | 保持原顺序，不阻断 |
| 禁止 | 用 L3 分数写文案、用 L2 推断情绪 | LLM 决定环节顺序、个体行为决定谁先发言 |

**流程 tailoring 的杠杆远高于内容 tailoring，隐私成本却更低。**

### 3.1 四个交付概念（按价值 × 可行性排序）

1. **C1 这张桌的说明书**（host-only，零 LLM）：人数、能量构成、3 个共同锚点（含覆盖人数）、建议开场方向、1 个避雷领域。最高优先，因为它是“画像有用”的最便宜证据。
2. **C2 共同锚点卡**（可见阈值）：保证每个锚点至少一张卡，卡上只标“这桌 N 人有共鸣”，不点名。
3. **C3 节奏校准**（纯流程）：`tableVibePreference` 桌级分布进入现有 `orderByComposition`；慢热占多数 → 更早进入低压力结构化环节。
4. **C4 群像镜像画像化**（M3）：用共同锚点生成欣赏式匿名提问。

### 3.2 资深桌主的五个“真魔法”

1. 开场调**具体度**，不是调深浅；抽象题在任何桌子都是杀手。
2. 第一个开口选**最安全**的人，不是最外向的人；第一个人答多长会给全桌发“深度许可证”。
3. 配对用**稀有共同点**，不用相似背景；同行业配对容易变成互相面试。
4. 从桌级构成推**三个禁忌域**，不给个人理由。
5. 能量峰值按桌型前移/后移；低能量桌更早到峰值，高能量桌更晚。
6. 当 ≥4/6 同行业或同人生阶段，强制一次跨圈配对或给 outsider 一个专家角色。

---

## 4. 为什么共同兴趣“最多 3 个”

### 4.1 3 不是数据上限

数据层没有 3：用户可填多个；服务端每人取 5；共同标签取 3。真正的 3 是**注意力预算**——90 分钟只够 1 个锚点 + 1 个备选 + 1 个救场。

### 4.2 当前的 3 是“算错的 3”

1. 先按个人热度截断到 5，再求交集 → 公共性被私人排序污染。
2. 共同标签按“人数降序 → 字符序”排 → 选出的常是咖啡/旅行/电影/美食/健身等**通用礼貌标签**，社交效力最低。

### 4.3 推荐政策

- **数据不设限**：兴趣标签全部进入聚合。
- **prompt 设限**：balanced/game = 3，chat = 4，永不超 4。
- **host 卡片**：6–8 个，折叠为“备用弹药”。
- **可见文案**：coverage ≥ max(2, ceil(n/2)) 才可露出，且不说人数精确值。
- **选样**：`salience × distinctiveness × conversationPotential × safety`；coverage 2–4；按 macroCategory（food/play/sports/culture/life/growth）去重；n≥6 时 minMembers=3。
- **taxonomy 合并**：咖啡/咖啡馆、桌游/狼人杀/剧本杀 先归一再聚合，避免假性不共同。

---

## 5. 路线图

### M1.2 修正数据管线 + host 说明书（2 周，≤10 人日）

**范围**
1. `resolveRosterArchetype()`：`primaryArchetype ?? archetype`，并用 `ARCHETYPE_LEGACY_NAME_MAP` 归一中文旧名；覆盖 24 个旧名测试。
2. `profile` 构建改为“有任何画像字段就构造”，不再用 legacy archetype 判空。
3. 共同锚点改全集派生、coverage 排序、返回 `{label, coverage, supporters}`；修正 “先截断 5”。
4. C1 桌说明书：host-only sheet，零 LLM，sanitizer 保证 participant 不可见。

**非目标**：不改 prompt 文案结构；不改环节顺序；不新增 flag；不做个体档案；不动 L3 化学分。

**验收**
- `mixText` 非空率 >90%；`sharedInterestCount ≥1` 的桌子 >60%；`profile` 非空率可观测。
- legacy 名与 canonical 名同分同判（24 个旧名全覆盖）。
- 说明书 P95 ≤300ms，participant 视角无任何画像字段。
- 单次开桌 LLM 成本增量 = 0。

**证据门**：用近 30 天 20 个满员组做只读抽样，人工核对“全集交集”下 anchor 命中率变化；提升 <10pp 则判信号层没救，停工转 M1 timing。

### M2 流程定制 + 锚点可见（3 周）

1. C3 节奏校准：`tableVibePreference` 分布进入 `orderByComposition`，纯函数。
2. C2 锚点卡 + 可见阈值。
3. warmup prompt v7：锚点带 coverage 语义；balanced/game 3、chat 4。
4. 无锚点时 prompt 与 v6 字节一致（沿用 HL 双版本纪律）。

**验收**：20 场回放中安静桌 full-participation 环节数下降 ≥1 且不跳过核心环节；锚点卡可见阈值边界 n=3/4/5/6 正确；6s/fallback/AIGC 不回退。

### M3 群像镜像画像化（4 周，需 M2 证据）

- group_mirror 提问由 L1 锚点启发，保留欣赏式硬门；coverage ≥2；不新增 LLM 调用预算。

### 统一护栏

- 复用 `icebreakerMatchingAwareEnabled` 单 kill switch，OFF 与今天字节一致。
- 所有 enrichment 失败退回通用路径且不阻断开桌。
- 不新增画像表、不新增跨场读取、不新增第二 flag。

---

## 6. 商业与实验

- **不涨价、不加档、不做权益分层**；价值捕获看单场 → 三连局包迁移。
- 画像本身成本可忽略（+¥0.006~0.026/桌）；贵的是第二候选/合成/评审。上下文必须在 session 开始时算好，不进 6s 窗口。
- **12 桌 Stage A 不能证明内容**：最多 12 次曝光、12 个 cluster、随机化单位错配、host 混杂。内容结论只认离线 DQS。
- 实验顺序：
  - **Gate 0（40 桌，零 LLM）**：确定性特定卡 vs 通用卡，感知分 Δ≥0.4 且 awkward 不升。
  - **Gate 1（离线 DQS）**：A 现状 / B 富上下文 N=1 / C 同上下文 N=2；B 胜 A，C 才可谈。
  - **Gate 2（护栏）**：awkward +2pp、投诉 <2%、P95 ≤6s、≤¥0.20/桌。
  - **Gate 3（季度）**：30 天付费到场、三连迁移，只做方向记录。
- 与 M1 Stage A **串行**抢桌位，不并行。

---

## 7. 风险与合规

| 风险 | 处置 |
|---|---|
| 当众画像/被分析感 | 个体档案永不进文案；每副牌画像卡 ≤1；聚合 ≥2 人；可见阈值更高 |
| 排除感 | 可见文案要求 coverage 过半；禁用精确人数 |
| 反推泄露 | 不说“谁喜欢什么”；不引用 bio 原文 |
| 流程过度适配 | flow 变更设 phase completion 回退线 |
| 信号虚假繁荣 | M1.2 先看 anchor diff；无差异就停 |
| 微信审核 | 提审构建 LLM 关闭；对外用“活动画像/合拍度”，不说 AI/匹配/社交画像；AIGC fail-closed |

**同意边界**：兴趣/原型/桌级偏好已在排桌中使用，用于“准备这张桌”属目的内复用；bio、lifeStage、行业、精确年龄若进入 prompt，必须单独同意与删除路径——首发不做。

---

## 8. 待拍板

1. **画像形态**：接受 group-shaped（推荐），还是坚持个体级定制？
2. **flag**：接管 `icebreakerMatchingAwareEnabled` 并补齐验收（推荐），还是新开一个画像 flag？
3. **共同兴趣政策**：接受“数据不设限 / prompt 3（chat 4）/ host 折叠 6–8 / 可见过半阈值”（推荐），还是要求全部进 prompt？

---

## 9. 如果只做一件事

**修 M1.2 的 ①②③：canonical archetype 归一、profile 门禁、全集兴趣派生。** 这三项不需要新产品决策，只需要工程动作；不做它们，后面所有“画像魔法”都是建筑学表演。
