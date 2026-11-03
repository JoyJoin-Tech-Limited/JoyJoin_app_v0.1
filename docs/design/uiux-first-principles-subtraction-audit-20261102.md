# JoyJoin 小程序 UI/UX 第一性原理减法审查

- 日期：2026-11-02
- 范围：`apps/mini-program`（9 主包页 / 15 分包 / 55 个页面目录 / 约 30k 行页面代码）
- 席位：A 产品（用户是否还需要这一步）× B 商业化（这一步是否值得付工程与转化成本）
- 性质：**审查与方案**。不含代码改动、不含 schema/flag 变更。
- 评审：视觉设计师席位复核 = **fix-then-ship**（2026-11-02，文档级评审，不代表已渲染验收）。P0 死代码删除可独立执行；**P1/P2 必须先满足 §8.1 数值门槛与 §12 视觉交付物，再交给 coding agent**。

---

## 0. 五步审计（前置块）

| 步 | 状态 | 结论 |
|----|------|------|
| 1 质疑 | 完成 | 6 条主流程、55 个页面逐个过"来源 + 证据 + 删掉会坏什么"。35 条通过，12 条判 `待证伪`（不进决策），8 条证据确凿（本文第 3 节）。 |
| 2 删除 | 完成（方案层） | 死代码 9 个页面目录约 1,970 行 + 2 个"单页分包根"；在线流程删除 6 项（第 3 节）。未用"新增"替代任何删除。 |
| 3 简化/合并 | 完成 | 5 组收敛：成员渲染 13→3 层、状态/倒计时 5 张表→1、日期格式化 5→2、庆祝 7→1 骨架、等待叙事 10→2。 |
| 4 加速 | 完成 | 报名交互节点 9→6；同一事实的重复渲染点 10→2；个人页可点目标 24→18。全部为可数指标。 |
| 5 自动化 | 锁定 | 本报告不提出任何自动化方案（五步算法第 5 步在第 1–3 步落地前不得开启）。 |

**五类禁区声明**：支付/退款/对账、审计日志、合规与微信审核文案（含 fail-closed AIGC 角标）、鉴权/会话/隐私边界、数据保留记录——本报告未将其中任何一项列为删除对象。

---

## 1. 一页结论

- **最该删**：`event-coordination`、`center-tab-empty`（各自是一个"单页分包根"）、`alang/story-detail`、`alang/preferences`、`alang/debug`、`pages/my-events`、`pages/dev/wow-demo`。合计约 1,970 行，用户不可达，删除零风险。
- **最该并**：同一个"局"在三处并行叙述（`events` 标签页 / `center-hub` / `matching-status`），同一批成员在 13 处渲染，同一状态有 5 张标签映射表。合并后"我的局"只有一个入口、一种状态语言。
- **最不该动**：定价与权益链路、onboarding 的画像字段（它是排桌质量的输入）、冰 breaker 的 host 控制面、微信审核相关文案。减法不得以削这些为代价。

一句话：**这不是"页面太多"的问题，是"同一件事被讲了 3 遍、同一批人被画了 13 遍、同一个状态有 5 套词"的问题。** 删页面只解决 7%；合并叙事解决 60%。

---

## 2. 全局冗余地图（六条主流程）

标注：`R1` 同事实重复渲染 / `R2` 同决策问两次 / `R3` 重复庆祝 / `R4` 一目标多入口 / `R5` 一信息多视觉配方。

### 流程 ① 新用户 onboarding

```
index(landing) → personality-test(服务端自适应 8–16 题) → results
→ essential-data(5 子步 / 10 字段) → extended-data(兴趣, 最少 3)
→ profile-review(只读海报 + 确认) → discover
```

- 决策密度：6 屏 + 5 个子步 + 每题 2 次点按（16–32 次）→ 首次看到任何一场局之前，用户已做出约 40+ 次交互。
- `R2`：`intent`（活动期待）在 essential-data 采集一次，在 `pool-registration` Step 3 再问一次，在 `edit-profile` 第三次出现。
- `R2`：`profile-review` 复述 10 个字段后要求确认——这是"复述确认"，有价值（微信审核 + 用户信任），**不删**；但它的价值来自"一次确认"，不该再叠加报名页的确认弹窗。
- 无 `R3`/`R4` 级问题：onboarding 是全站最干净的一段。

### 流程 ② 报名与支付

```
discover → event-detail → pool-registration(Step0 简报 → Step1 预算 → Step2 意图
→ 确认弹窗) → 权益/结算 → 微信支付 → 内联校验 → 成功仪式
```

- `R2`：Step2 意图 = onboarding 已采集值；确认弹窗 = Step1/Step2 之和的第二次确认。**9 个交互节点里有 2 个是重复决策。**
- `R1`：活动日期在 10 处渲染（discover 卡、events 卡、足迹卡、event-detail、matching-status ×3、报名页 hero、报名成功页、checkout 票面、checkout 成功页）。
- `R1`：状态标签有 5 张映射表：`getJoinedEventStatusLabel`、`getEventPoolStatusLabel`、共享 `getStatusLabel`、`STATUS_MOMENTUM_COPY`、`STATUS_WAITING_COPY`。
- `R1`：日期格式化 5 个函数（`formatEventFactDateTime` 7 处引用 / `formatEventDateTime` 仅 1 处 / `formatEventDateShort` / `formatDateTimeParts` / `formatDateTimeLabel`），另有 `getCountdownText` **零引用**。
- `R3`：报名成功有 7 套庆祝：共享 `RegistrationSuccessCeremony`（2 个挂载点）、`BlindBoxLifecycleFlow`、`RitualCelebrationOverlay`、verification 付费 hero、events 首场里程碑 hero、center-hub「报名成功」flow 步、matching-status 揭晓覆盖层。
- `R4`：同一动作 6 种按钮文案——`看看谁在等你 · ¥N` / `看看是谁` / `入座这场{type}` / `确认加入这场局` / `立即锁定席位 · ¥` / `继续完成报名`。

### 流程 ③ 排桌等待 → 揭晓 → 集结

```
matching-status(10 处等待叙事) → squad-unboxing(手风琴扇形 + 名单条 + 今晚这桌)
→ pool-group-detail(卡组条 + 完整名单 + 成员详情) → gathering-room(暗置) → event-detail
```

- `R1`：**等待/匹配状态共 10 个渲染面**（状态标题、等待卡、自动刷新进度条、events 卡等待提示、center-hub flow 步、报名终态"挑同频桌友"、报名成功页"排桌完成提醒"、checkout 成功副标题、verification「权益确认中」、订阅页 kicker）。
- `R4`：**成员渲染 13 处、跨 7 页、用了 5 种组件**（`TeammateCard` 扇形、`DeckPillMini` 胶囊条、`TablemateCard` 轮播、`ArchetypeHead` 名单、`GatheringRoomScene` 座位、`WarmupPresenceStrip`）。
- `R1`：**团魂/氛围叙事 6 处**（pool-group-detail 悦仔氛围卡、squad-unboxing 团魂气泡、今晚这桌 chemistry 章节、matching-status `UnifiedRevealCard`、揭晓覆盖层复用 `unifiedReveal`、icebreaker `group_mirror`）。其中 `GroupAnalysisSourceHint` 在 2 处重复渲染。
- `R1`：倒计时/开始提示 8 处（matching-status ×2、pool-group-detail、gathering-room ×2、icebreaker ×3）。
- 出席确认只有 2 个落点（squad-unboxing、gathering-room）。gathering-room 默认关闭，因此**线上实际只有 1 个**——这部分不构成重复。

### 流程 ④ 到场破冰

```
event-detail → tier-selector(3 意图预设 + 自由局) → icebreaker-session(9 个玩法 phase)
```

- `R5`：**9 个 overlay + 2 个原生 sheet + 4 个内联层**（PhaseIntro / BonusGate / TierSheet / MiniScriptConfig / AgentAsk / HostTableBrief / WarmupCelebration / HandshakeRitual / adaptive suggestion；原生 host ActionSheet、提前结束确认；coachmark、phase toast、catch-up chip）。
- `R5`：**host 侧 11 个入口**（⋯ 菜单、tier sheet、桌情 popover、悦仔问答、warmup dock、提前结束、一次性 coachmark、剧本配置、工具选择、开始破冰、生成/自定义段）。
- 这是全站最大单包（15.5k 行），也是唯一"重叠有正当理由"的地方：玩法 phase 之间必须互斥。问题不是 phase 多，是**同一时刻可能有 3 层浮层在争夺注意力**（已有 2026-10-29 的高优先级仲裁，方向正确，本次不重复提）。

### 流程 ⑤ 活动后反馈 → 连接

```
event-feedback(experience → connections → wrapup) → connections
```

- 2026-08-15 已从 6 屏合并为 3 屏，是全站做得最对的一次减法，**本次不再动**。
- `R1` 残留：`connections` 每个 peer 同时渲染 `sharedEventTitle` 胶囊 + `来自：{eventTitle}` 文本行（同一事实两遍）。

### 流程 ⑥ 回访稳态

```
profile(16 个区块 / 最多 24 个可点目标) / events / connections / rewards / invite / notifications
```

- `R4`：通知有 2 个入口（profile 铃铛、discover 铃铛），但 `notifications` 列表**整行不可点**——用户点进去只能看，不能到达任何地方（死端）。
- `R1`：`profile` 的"下一场局"行与 `events` 卡、`center-hub` 步重复同一事实。
- `R1`：`connections` 与 `events` 各自在挂载时清未读角标，且空态都跳 discover（同一意图两条路径）。
- 资料完成度只在 profile 一处出现（40/30/30/10 加权），**不重复**，保留。

---

## 3. 删除候选 Top 10（按 ROI 排序）

ROI = 用户可感知摩擦消除 ÷ 工程小时。P0 为"用户不可见、零回滚风险"。

| # | 删什么 | 证据 | 用户可感知收益 | 工程 | 风险 | ROI |
|---|--------|------|----------------|------|------|-----|
| 1 | `pages/event-coordination`（152 行）+ 其分包根 | `src` 与 `server` 全域零入站；仅路由常量与分包声明 | 无（不可达） | 0.5h | 无 | 极高 |
| 2 | `pages/center-tab-empty`（43 行）+ 其分包根 | 零入站；文档已标注被 center-hub 取代 | 无 | 0.5h | 无 | 极高 |
| 3 | `pages/alang/story-detail`（142）+ `alang/preferences`（55） | 各自零入站，却在 alang 分包页表里 | 无 | 0.5h | 无 | 极高 |
| 4 | `pages/my-events`、`pages/dev/wow-demo`（214） | 均未在路由表/分包表注册，纯死目录 | 无 | 0.3h | 无 | 极高 |
| 5 | `getCountdownText`（零引用）+ 3 个无消费者的日期/状态辅助 | `eventDisplay.ts:129` 零 import | 无 | 0.3h | 无 | 极高 |
| 6 | `pages/alang/debug`（253，测试面板） | 零入站；`shouldShowAlangDebugTools` 仅 `appMode==='test'` | 无（正式用户不可见） | 1h | 测试同学需改走 debug 入口 | 高 |
| 7 | 等待叙事 10 → 2 | 见流程 ③ | 少 8 处"同一句话"；等待页一次读懂 | 6h | 文案回归 | 高 |
| 8 | 成员渲染 13 → 3 层 | 见流程 ③ | 同一批人只出现 3 次（概览/名单/详情），不再有"胶囊条+扇形+文本行"三连 | 10h | 揭晓动效需回归 | 高 |
| 9 | 报名交互节点 9 → 6（删确认弹窗、意图改为回填） | 流程 ② | 少 3 次确认/输入 | 8h | 支付前确认感下降，需真机验证 | 中高 |
| 10 | 庆祝 7 → 1 骨架 + 3 变体 | 流程 ② | 成功只被庆祝一次；后续页面不再重复"报名成功" | 12h | 情绪峰值变弱，需 A/B + 逐变体视觉对齐（§4.4） | 中 |

**不删**（明确保护）：`profile-review` 的确认步、`event-feedback` 三段式、`icebreaker` 的 phase 互斥、`alang/event-detail` 与 `alang/dialogue` 两个重定向壳（旧链接恢复，各 15–27 行，删了会断分享链接）。

---

## 4. 合并/整合方案

### 4.1 "我的局"只有一个入口

现状：`events` 标签页（全部已报名，含进行中）、`center-hub`（只筛进行中，复用同一 query）、`profile` 下一场行、`matching-status` 状态页——同一场局最多出现在 4 个地方。

目标形态：
- `events` 成为唯一 inbox，顶部加 3 个分段：`进行中 / 待开始 / 已结束`。
- `center-hub` 保留路由与 tab 中心按钮（**不改 tabBar**，微信审核零风险），但内容改为"进行中"分段的直达入口：点进来 = events + 已选分段，不再自建一套 flow 步与卡片。
- `matching-status` 只保留"排桌中/已排桌"这一种状态页，不再渲染"相似局推荐 + 报名成功 flow 步"。
- 删除 `center-hub` 的重复 query 挂载（与 events 同一份 joined-events，两处独立订阅）。

净效果：同一事实的渲染点 4 → 2（events 列表 + matching-status 状态），tabBar 不变，回滚 = 恢复 center-hub 内容组件。

**视觉护栏（设计师席位）**：center-hub 是视觉重心最高的 tab，改成"分段直达"最容易丢掉"我现在在哪"的定位感。落地前必须交付冷启动进入、分段已选、进行中 0/1/多场、滑动返回 五种情形的点按录屏与截图（§12）；落地态必须在视觉上仍承担"当前这一场"的职责，不得退化为一个跳转按钮。

### 4.2 成员三层渲染

| 层 | 唯一组件 | 出现位置 |
|----|----------|----------|
| 概览（横滑） | `TablemateCard` | matching-status 轮播、pool-group-detail 卡组条 |
| 名单（竖列） | `ArchetypeHead` 行 | pool-group-detail 完整名单 |
| 详情（抽屉） | `TablemateDetailSheet` | 三处共用 |

删除：`DeckPillMini` 胶囊条、`SquadUnboxingTonightsPanel` 的"今晚这桌"文本名单、`gathering-room/memory` 的裸 `Image` 行（改 `ArchetypeHead`）。扇形揭晓 `SquadDeckStage` 保留——它是情绪峰值，不是信息冗余。

**视觉护栏（设计师席位）**：按组件数合并最容易抹掉"不同场景需要不同密度"这件事——好的横滑卡不天然等于好的一眼名单，更不等于暗色房间里的在场行。落地前先交**成员信息对等矩阵**：姓名 / 原型 / 合拍点 / 在场与空缺 / 超长名 / 部分名单 / 图片加载失败 / 详情抽屉可达性，逐格标注三层各自的承载方式。允许三层各自有**密度变体**，不要求三处视觉完全一致。

### 4.3 一个状态语言

- 5 张状态映射表 → 1 张（`packages/shared/src/features/matching-status/viewModels.ts` 的 `getStatusLabel` 为唯一源），页面只取 `label + tone`。
- 8 处倒计时 → 2 处（列表卡一枚 `N 天后截止` 胶囊；详情/等待页一枚主倒计时）。删除 3 处本地重实现。
- 5 个日期格式化 → 2 个（`formatEventFactDateTime` 保留为唯一对外函数；`formatDateTimeParts` 保留给分段渲染）。

**视觉护栏（设计师席位）**：报名截止、活动开始、现场进行中是三种不同 urgency，合并成两个壳之后不得变成"同一个倒计时样式 + 两句文案"。先交**时钟语义矩阵**：每个时钟的含义 / 时区（`lib/eventDateTime.ts` 的 +8h 口径）/ 到点后的状态 / 离线或数据过期时的呈现 / 色调 / 该时刻的下一步动作。壳可以只有 2 个，**语义变体不许被压平**。

### 4.4 一次庆祝

`RegistrationSuccessCeremony` 作为唯一骨架，只允许 **3 种变体**：`paid`（票根）、`free`（留座印章）、`first`（首场里程碑）。删除 `BlindBoxLifecycleFlow`、`RitualCelebrationOverlay`、center-hub flow 步、checkout 成功页的独立 hero。

**视觉护栏（设计师席位）**：这是全报告情绪风险最高的一条。统一骨架不等于统一情绪——付费票根、免费印章、首场里程碑若塌缩成同一个"通用成功弹窗"，A/B 的转化指标看不出手艺流失。删除任何现有仪式之前，先交**逐变体对齐表**：各自的 hero 资产、唯一情绪峰值、enter/peak/exit 编排与退出后的交接、haptic、reduced-motion 与低档机静态等价物，逐项证明"变体之间仍然有区别"。

### 4.5 按钮语言

- 报名动作：6 种文案 → 1 种（`锁定席位 · ¥N`；免费局为 `确认加入`）。
- 探索动作：5 种 → 1 种（`去看看别的局`）。
- 回我的局：3 种 → 1 种（`查看我的局`）。

### 4.6 删除确认弹窗 = 确认信息内联化，不是确认消失

报名 9 → 6 节点里删掉的是**弹窗这种形式**，不是"下单前再看一眼"这个能力。§7.6 原本把二次确认寄托在微信支付面板上，这只覆盖付费路径，**免费局与权益局没有支付面板**。

因此硬性要求：在主 CTA 上方保留一个**常驻的内联最终确认区**，包含场次 / 时间 / 地点或待定说明 / 价格或权益扣减 / 已回填的 intent（可就地编辑）。付费、免费、权益三条路径都必须有；disabled、submitting、失败、成功四态都要出图（§12）。**不允许用"再弹一个窗"来实现**，否则等于没减。

---

## 5. 暗置表面裁决（flag 默认 false，与在线流程分开算）

| 表面 | 体量 | 裁决 | 理由 |
|------|------|------|------|
| `gathering-room`（集结房间） | 727 行 / 2 页 | **不上线，30 天后删** | 与 `pool-group-detail` 功能重叠（成员 + 时间 + 出席确认），上线等于新增第 4 个"局详情"页；pre-event presence 价值可由 events 分段承接。保留代码至 2026-12-02 观察。 |
| `alang/teaser`（pool teaser） | 134 行 | **删** | discover 已有 teaser 卡，页面本身只回跳 discover，是单向死端。 |
| `checkoutSubscriptionUpsell` | 无独立页 | **删** | checkout 已是全站最重路径（4.0k 行），转化点不宜再加分支。 |
| `personal-story` / `my-image` / `equipment` / `rewards` | 3.4k 行分包 | **保持暗置** | 不进首屏、不进 tab，不影响摩擦；是否上线是产品命题，不是减法命题。 |
| `miniscriptEvidenceVoteV2` / `auctionV2` / `sessionGlow` / `highlights` / `wechatId` / `matchingPuzzlePrelude` | — | **保持暗置** | 未上线即无用户摩擦，本次不评估。 |

---

## 6. 死路由与兼容别名裁决

| 页面 | 行数 | 入站 | 已注册 | 裁决 |
|------|------|------|--------|------|
| `pages/event-coordination` | 152 | 0（含 server） | 是（独立分包根） | 删 |
| `pages/center-tab-empty` | 43 | 0 | 是（独立分包根） | 删 |
| `pages/alang/story-detail` | 142 | 0 | 是 | 删 |
| `pages/alang/preferences` | 55 | 0 | 是 | 删 |
| `pages/alang/debug` | 253 | 0 | 是（`appMode==='test'` 可见） | P1 删 |
| `pages/alang/config` | 1,107 | 仅路由常量 | 是（测试点配置器） | P2 移入 admin，或确认测试流程后删 |
| `pages/my-events` | — | 0 | 否 | 删 |
| `pages/dev/wow-demo` | 214 | 0 | 否 | 删 |
| `pages/alang/event-detail` | 27 | 旧链接 | 是 | 保留（重定向壳） |
| `pages/alang/dialogue` | 15 | 旧链接 | 是 | 保留（重定向壳） |

合计可删约 **1,970 行 + 2 个分包根**（`event-coordination`、`center-tab-empty` 各是一个"一个页面一个分包"的结构，删除后主包/分包表更短）。

---

## 7. 商业化视角（CEO memo）

### 7.1 五步审计（商业侧）

| 步 | 结论 |
|----|------|
| 质疑 | "让用户多看到一个页面"从未被证明能提升报名率；repo 内无任何 A/B 或漏斗数据支持"多入口 = 高转化"。→ `待验证`，但不构成新增页面的理由。 |
| 删除 | 删除的是"重复叙述"，不是"选择权"。用户的选择权在定价（5 档）与场次，不在"同一场局出现 4 次"。 |
| 简化 | 报名 9 → 6 节点，直接作用于首单转化。 |
| 加速 | 只报可数项：节点 -3、重复渲染 -8、个人页可点目标 -6。 |
| 自动化 | 锁定。 |

### 7.2 决策建议

**把减法预算全部投在"第二次报名"之前，不投在首屏美化。**

理由（全部来自 repo 真实定价，`seed_pricing_plans_20260805.sql`）：

| 商品 | 价格 | 单场均价 | 相对单场 |
|------|------|----------|----------|
| 单场局票 | ¥88 | ¥88 | — |
| 三连局包 | ¥211 | ¥70.3 | -20% |
| 六连局包 | ¥370 | ¥61.7 | -30% |
| 悦聚月卡 | ¥98（6 场） | ¥16.3 | -81% |
| 悦聚季卡 | ¥294（18 场） | ¥16.3 | -81% |
| 首单（WELCOME20） | ¥68 | ¥68 | -23% |

结论：首单在未知单座成本下**无法判定为正毛利**；真正的 LTV 从第二单（连局包/月卡）开始。因此"首单之后的路径"（等待 → 揭晓 → 到场 → 反馈 → 再报名）每减少一次摩擦，商业价值都高于首屏再美一版。

### 7.3 核心依据（CAC vs LTV，必须写清）

- **已知获客成本**：邀请奖励 ¥50/成功邀请（`INVITE_REWARD`）；无付费投放数据 → CAC `待验证`。
- **已知客单**：首单 ¥68；六连 ¥370；月卡 ¥98/月。
- **未知（不得编造）**：单座场地+餐饮成本、支付通道费率、退款率、复购间隔、月卡实际到场次数 → 全部 `待验证`。
- **可写死的判断**：若月卡用户 6 场全到场，单场收入 ¥16.3，任何高于 ¥16.3 的单座成本都会使该用户负毛利。**月卡是"用频次换留存"的产品，不是利润来源**；利润在连局包与单场。→ 减法必须保护"连局包"的转化点，而不是把用户往月卡赶。

### 7.4 repo 落点

| 减法项 | 商业作用 |
|--------|----------|
| 报名 9→6 节点 | 首单转化率 |
| 等待叙事 10→2 | 等待期跳出率（这段时间是退款/放弃高发区） |
| 成员 13→3 层 | 揭晓后的到场意愿（看得懂"这桌有谁"） |
| 庆祝 7→1 | 口碑分享的清晰度（一次峰值 > 七次噪声） |
| 删死代码 1,970 行 | 包体积 → 首屏加载 → 冷启动转化 |

### 7.5 衡量指标（上线前后各取 14 天）

1. 报名完成率（进入 pool-registration → 成功）
2. 首单 → 第二单转化率（7 天 / 30 天）
3. 连局包转化率（成功页 → pack 购买）
4. 等待页跳出率（matching-status 进入 → 离开无操作）
5. onboarding 完成率（**监控项：不得下降超过 1pp**）
6. 主包体积（KB，删除后必须下降）

### 7.6 风险与回滚

| 风险 | 回滚方式 |
|------|----------|
| 删 center-hub 内容导致"进行中"不可发现 | 恢复内容组件（路由与 tabBar 未改，单文件回滚） |
| 成员渲染合并后揭晓动效变弱 | 保留 `SquadDeckStage` 原文件一版，`git revert` 单页 |
| 报名确认弹窗删除后误下单 | 保留弹窗组件，必要时以 flag 恢复；支付前二次确认由微信支付面板承担 |
| 状态文案统一后语义丢失 | 旧映射表保留一个版本周期 |

### 7.7 优先级与交接

P0（死代码）→ 当周可合；P1（叙事合并）→ 需 `ui-layout-audit` + `user-satisfaction-audit` 回归；P2（alang/config 迁 admin、center-hub 改分段）→ 需产品与运营确认。

### 7.8 本地化雷达（四城）

- **深圳**：已知供给 blocker——`dining_150_below / 150_200 / 300_500` 三档无可用餐厅。减法不能以"多一个页面帮助选档"解决，供给缺口必须在 admin 侧补。
- **北京 / 上海 / 广州**：repo 内无分城供给与转化数据 → `待验证`。任何"按城市加页面"的提案在没有数据前不成立。
- 共同点：四城用户对"这桌有谁、在哪、几点"的信息需求一致，因此**合并成员与状态叙事是跨城通用收益**，不依赖城市差异。

---

## 8. 保护清单验收表（7 条不变量）

| # | 不变量 | 验收方式 | 门槛 |
|---|--------|----------|------|
| 1 | 单一主 CTA | 每屏主按钮 1 个、次级 ≤2；截图走查 + `npm run design:audit` | 无新增主 CTA |
| 2 | 状态完备 | 加载/空/错误/部分/完成/无权限 6 态；错误必须有 `code` 且有重试；**加载形态有明确规定（见 §8.1-B）** | 6/6 覆盖，缺一即回退 |
| 3 | 动效纪律 | 仅 `transform/opacity`；时长/easing 走 token；reduced-motion 与低档机有静态等价物；无布局抖动 | 不新增编排体系；必要的 exit / reduced-motion 修正允许新增，但必须在 `motion-spec.md` 登记 |
| 4 | 材质克制 | `styles/variables` token；无渐变滥用；主文案零 emoji | 裸 hex 不增加（当前 12 处） |
| 5 | 触感 | 触达 ≥88rpx；按下态；haptic 语法一致；防连点；**disabled 态用祖先选择器重声明颜色，不被平台默认色覆盖** | 全部满足，disabled 必须出图 |
| 6 | 文案调性 | 微信词表（排桌中/排桌完成/合拍度/活动画像/轮桌畅聊）；AIGC 角标 fail-closed | 违规词 0 |
| 7 | 首屏密度 | 一屏读完，滚动有理由；**判定口径见 §8.1-D** | 首屏 ≤1 个主张 |

### 8.1 数值门槛（设计师席位补充：把"高级感"从形容词变成可判定的检查）

**A. 动效契约**
- 时长与 easing 只能取 `apps/mini-program/src/styles/_reveal-motion.scss` 的命名 token；禁止散写毫秒数。
- 每段编排在 `motion-spec.md` 登记：enter / peak / exit 各自的 owner、总时长预算、同时运行的动画数量上限、被打断时的取消与重入行为。
- reduced-motion 与低档机必须给出**静态等价物**，而不是简单关掉动画后留下空白或突兀跳变。
- haptic 语法沿用 `apps/mini-program/AGENTS.md` §5 的既有约定，同一类事件不得出现两种震动。
- **静态 H5 截图不能作为"丝滑"的验收证据**；必须附真机录屏或帧轨迹，链接写进 `motion-spec.md`。

**B. 加载与资产连续性**
- 明确每种等待用 skeleton 还是 spinner 还是 mascot：票根/订单类沿用 `components/payments/TicketOrderSkeleton.tsx` 的骨架屏，全屏加载沿用 `components/loading/JoyJoinLoadingScreen.tsx`，禁止把有品牌的等待降级成裸 spinner。
- 图片必须预留几何（宽高比 + 固定槽位），解码时不得推动布局；头像加载失败走 `components/mascot/MissingArchetypePlaceholder.tsx`，不得留空圈。
- 空态插画按既有空态组件选型，不为省事先放空再补。
- 保留下来的资产必须同时存在于 `scripts/cdn-asset-manifest.json` 与 `project.config.json` 的 include 规则中（缺 include 会在上传时被静默丢弃）；mascot 表情以 `src/lib/mascot/xiaoyueExpressions.ts` 为准。

**C. 排版、平台与暗色面**
- 字号/行高取 `styles/_variables.scss` 与 `styles/_mixins.scss` 的既有 token，不新增 off-scale 字阶。
- 必测极端文案：超长中文名、超长场名、倒计时换行、孤字（orphan glyph）——孤字测量沿用 `scripts/screenshot/generators-event-detail.mjs` 的既有先例。
- 安全区、Android 与 iOS 的字体渲染差异、WeChat 原生 disabled 配色必须各出一张图。
- `gathering-room/memory` 是**常暗场景**（局部深色 UI），不是系统暗色模式：它的对比度不得因共享 `label + tone` 而下降。注意 `styles/_dark-variables.scss` 当前 **0 处引用**，系统暗色模式未接线，本次不得以"暗色适配"为由新增变体（见 §13.4）。

**D. "首屏一个主张"的判定口径**
必须写明：命名视口（390×844 / 375×667 / 320×568 三档）+ 数据状态（空/单场/多场）+ 主 CTA 是否无需滚动即可见。三者缺一则该条不成立。

**E. 基线必须落盘**
"分数不得低于改动前基线"只有在基线存在时才可执行。每批 P1 改动前，先把当次的 `ui-layout-audit` / `frontend-design-audit` / `user-satisfaction-audit` 评分、评审人、日期、证据链接写进 `score-baseline.md`（§12），改动后同口径复测。没有基线的分数对比一律视为未验收。

### 8.2 回归命令（每批改动必须全绿）

```bash
npm run guardrails
npm run typecheck -w mini-program
npm run test -w mini-program
npm run build:weapp -w mini-program && npm run verify:subpackage-styles -w mini-program
npm run check:package-size -w mini-program
npm run design:audit

# 视觉扫描必须带路由与等待选择器，裸 `npm run audit:visual` 不可执行：
node scripts/visual-correctness-scan.mjs \
  --url "http://localhost:5001/#/pages/<page>/index" \
  --wait "<css-selector>" --pretty \
  > docs/deliverables/2026-11-02-uiux-subtraction/visual-scan/<change>-<state>-<viewport>-after.json
```

扫描出现 Class A 的重叠、裁切、溢出、遮挡，**无论各项审计总分多少都直接阻断**。

并对改动过的屏重跑 `ui-layout-audit` / `frontend-design-audit` / `user-satisfaction-audit`，按 §8.1-E 的落盘基线对比，**分数不得低于改动前基线**。

---

## 9. 分批落地计划

### P0 — 零风险删除（预计 1 个 PR，净 -1,970 行 / -2 分包根）

| 文件 | 动作 | 预估 diff |
|------|------|-----------|
| `pages/event-coordination/**` | 删目录 | -152 |
| `pages/center-tab-empty/**` | 删目录 | -43 |
| `pages/alang/story-detail/**` | 删目录 | -142 |
| `pages/alang/preferences/**` | 删目录 | -55 |
| `pages/my-events/**` | 删目录 | — |
| `pages/dev/wow-demo/**` | 删目录 | -214 |
| `lib/onboarding/onboardingRoutes.ts` | 删 4 个页面常量 + 2 个分包根 + 页表项 | -40 |
| `lib/utils/eventDisplay.ts` | 删 `getCountdownText` 及零消费者辅助 | -20 |

验证：`guardrails` + `build:weapp` + `verify:subpackage-styles` + `check:package-size`（必须下降）。
回滚：单 PR revert，无数据影响。

### P1 — 叙事合并（3 个 PR）　**（2026-11-02 已经 §15 复核修订，以 §15 为准）**

1. **状态与时间单一源**：5 张状态表 → 1，8 处倒计时 → 2，5 个日期函数 → 2。触点：`lib/utils/eventDisplay.ts`、`packages/shared/src/features/matching-status/viewModels.ts`、`components/events/*`、`pool-group-detail`、`gathering-room`。预估 ±260 行。
2. **成员三层渲染**：删 `DeckPillMini`、`TonightsPanel` 名单、memory 裸行；统一到 `TablemateCard` / `ArchetypeHead` / `TablemateDetailSheet`。预估 -320 行。
3. **报名 9→6 节点**：删确认弹窗、`intent` 改为回填 + 就地编辑；确认信息按 **§4.6** 内联化（付费/免费/权益三路径都要有）。预估 -180 行。

每项独立可回滚；每项都必须真机看"已报名 / 待支付 / 支付成功"三态，并按 **§12** 交付前后对照证据。

### P2 — 需产品/运营确认

1. `alang/config`（1,107 行）迁 admin portal（需新增后台页，按规则降为 P2）。
2. `center-hub` 改为 events 分段直达（保留路由与 tabBar，仅换内容）。
3. 庆祝 7→1 骨架（需 A/B，情绪峰值下降风险最高）。

---

## 10. 附：PM 七宗罪映射

| 罪 | 严重度 | 证据 | 用户影响 | 纠正 |
|----|--------|------|----------|------|
| Clutter 冗余 | 高 | 等待叙事 10 处、成员 13 处、个人页 24 个可点 | 不知道"现在该做什么" | 第 4 节合并 |
| Vanity 自嗨 | 高 | 7 套庆祝机制 | 峰值被稀释成噪声 | 4.4 |
| Blindness 失明 | 中 | 同一场局出现在 4 处，无唯一 inbox | 反复确认"我到底报没报上" | 4.1 |
| Misfit 错配 | 中 | host 侧 11 个入口 vs 玩家 1 个 | 主持人学习成本高 | 不在本期（已有仲裁） |
| Isolation 孤岛 | 中 | 通知列表整行不可点 | 点进去出不来 | P2 |
| Disrespect 失礼 | 高 | 9 节点报名、意图问两次 | 首单流失 | P1-3 |
| Myopia 短视 | 中 | 1,970 行死代码 + 测试工具进发行包 | 包体积、审核风险 | P0 / P2-1 |

---

## 11. 自检

- [x] 页面清单来自 `app.config.ts` / `onboardingRoutes.ts`，与文档差异已记录（`pages/journey` 已不存在；`my-events` 未注册）
- [x] 每条删除有来源 + 证据 + 损失 + 回滚
- [x] 至少 1 条"删了会痛"的硬删除（庆祝 7→1、确认弹窗）
- [x] 未触碰五类禁区
- [x] 暗置表面与在线流程分开裁决
- [x] 7 条不变量均有验收方式
- [x] 每条改动有 ROI 与工程小时
- [x] 商业化 memo 含 CAC/LTV 口径与四城判断
- [x] 所有路径真实存在；无数据的判断标 `待验证`
- [x] 设计师席位复核已合并：§4.1/4.2/4.3/4.4 视觉护栏、§4.6 内联确认、§8.1 数值门槛、§8.2 可执行命令、§12 视觉交付物
- [x] 变体数量口径已统一：庆祝 = 1 骨架 + **3** 变体（§3-10、§4.4）

---

## 12. 视觉验收交付物（设计师席位：P1/P2 的放行条件）

目录沿用 `docs/deliverables/2026-10-20-conversion-event-detail-audit/` 的既有约定，新建：

```
docs/deliverables/2026-11-02-uiux-subtraction/
├── render-matrix.md          # 每行 = 改动 × 界面 × 数据形态 × 状态 × 视口 × 前后，链接 PNG + 扫描 JSON + 评审人 + 结论
├── screenshots/<change>/<before|after>/<surface>-<state>-<viewport>.png
├── visual-scan/<change>-<state>-<viewport>-<before|after>.json
├── motion-spec.md            # 编排契约 + 真机录屏/帧轨迹链接 + 静态等价物
├── motion/<surface>-<mode>-<start|mid|end>.png
├── device-matrix.md          # 真实机型、微信与基础库版本、安全区、字体、暗色面、reduced-motion、低档机结果
├── asset-check.md            # 资产/fallback/宽高比清点，对照 cdn-asset-manifest.json 与 packOptions.include
└── score-baseline.md         # 改动前三项审计的分数、评审人、日期、证据链接
```

**render-matrix 的最低覆盖**：

| 改动 | 必测状态 |
|------|----------|
| 状态/时间单一源 | 加载、离线、已过期、数据部分缺失、超长中文场名、倒计时换行、孤字 |
| 成员三层 | 部分名单、满员、超长名、图片加载失败、缺席/空缺位、reduced-motion、常暗场景（gathering-room/memory） |
| 报名 9→6 | 付费、免费、权益、intent 已编辑、disabled、submitting、失败、成功 |
| center-hub（P2） | 冷启动、分段已选、进行中 0/1/多场、滑动返回 |
| 庆祝（P2） | paid / free / first 三变体各自的 enter-peak-exit 与静态等价物 |

**设备与视口**：H5 走既有三档 390×844 / 375×667 / 320×568（`scripts/screenshot/generators-event-detail.mjs` 先例）；WeChat DevTools 一遍；真机至少 iOS、Android 各一台，口径对齐 `docs/testing/LAUNCH-QA-CHECKLIST.md` §15。**device-matrix 里只填实测结果，不预填预期值。**

**生成器**：新增 `scripts/screenshot/generators-subtraction-*.mjs`，经 `scripts/screenshot-server.mjs` 注册并在 root `package.json` 暴露命令；对状态与几何写硬断言（沿用 event-detail 生成器的做法），让"删错了"直接变红，而不是靠肉眼。

---

## 13. 设计与交互语言统一性（追加审查）

### 13.1 结论

- **token 层"有，但漏"**：圆角与阴影 token 都在 `styles/_variables.scss`，但大量裸值与 token **同值不同写法**，阴影实际上没有阶梯。
- **组件层"主干统一、边缘分裂"**：`ui/Button`（79 文件）、`ui/Card`（36）、`JoyJoinIcon`（90）采用率高，不需要动；空态、全屏加载、浮层容器、轻反馈各有 2 套以上语言。
- 统一性**不靠新设计规范**，靠"唯一归属 + 变体配额"。本节只收敛变体数量，不改变任何既有视觉风格。

### 13.2 证据盘点

| 层 | 现状（证据） | 判定 |
|----|--------------|------|
| 圆角 | 8 个 token（`$button-radius 48` / `$card-radius 32` / `$card-radius-sm 24` / `$card-radius-lg 40` / `$radius-md 16` / `$radius-pill 56` / `$radius-full 100` / `$radius-circle 50%`）；同时裸写 `24rpx`×69、`32rpx`×49、`16rpx`×32（与 token 同值），`999rpx`×179 与 pill token 并存，`50%`×277 与 `$radius-circle`×109 并存；off-scale `28rpx`×32、`20rpx`×23 | 看着统一，改不动；需同值归并 |
| 阴影 | 6 个 token（`$shadow-sm/md/lg/card/sheet/primary-soft`）对 **339 条互不相同的 `box-shadow` 声明** | 无有效高度阶梯，是"每页像不同产品"的最大单点来源 |
| 全屏加载 | `components/loading/` 下 7 个组件：`JoyJoinLoadingScreen` / `LoadingScreen` / `FancyLineLoadingScreen` / `BoxLogoEntryScreen` / `OnboardingLoadingShell` / `AnalyzingAnimation`，另有 Skeleton 15 处 | 全屏加载 7 种语言，需收敛为 1 壳 + 2 变体 |
| 空态/错误 | `StatusCard` 18 文件 vs `XiaoyueEmptyState` 4 文件 + 页内 inline 空态 | 两种情绪语言并存，缺选型规则 |
| 浮层容器 | 自定义 Overlay×15 / Sheet×6 / Modal×5 / Drawer×2 / Popover×2；同时原生 `Taro.showModal`×30、`showActionSheet`×8 | 两套容器语言并存，但没有成文的"什么时候用哪个" |
| 轻反馈 | **184 处直接 `Taro.showToast`**，无共享封装；`lib/navigation/matchingNavigation.ts` 同一 toast 重复 4 次 | 时长/图标/文案各自为政 |
| 手势 | 共享 `components/gesture`（SwipeCard / TapReaction / TapRhythm）存在，仍有 41 处裸 `onTouchMove`/`catchMove` | 有原语、接线率低 |
| 暗色 | `styles/_dark-variables.scss` **0 处引用**；`gathering-room` 是常暗场景而非暗色模式 | 系统暗色未接线，不得当作既有约束 |

### 13.3 统一规则（唯一归属 + 变体配额）

| 场景 | 唯一归属 | 允许变体 | 收敛动作 |
|------|----------|----------|----------|
| 阻断式确认（危险/不可逆） | 原生 `Taro.showModal` | 1 | 保持现状；不得再写自定义确认弹窗。与 §4.6 不冲突：内联终检是信息复述，不是确认弹窗 |
| 信息型浮层（选项/详情/配置） | 既有 bottom sheet 壳 | 1 壳 + 位置变体 | 新浮层必须复用既有壳，不得新增 Overlay 配方 |
| 轻反馈（成功/失败/提示） | lib 层单一 toast 封装 | 1 | 新增与改动处必须走封装；184 处存量**不批量重写**，随触达渐进 |
| 全屏加载 | `JoyJoinLoadingScreen` | 2（品牌进入 / 分析生成） | 其余 5 个全屏 loader 逐个判定"改为壳变体或下线"；Skeleton 仍是内容型加载唯一方案 |
| 空态 | 情绪空态 = `XiaoyueEmptyState`；错误/权限 = `StatusCard` | 2 | 不再新增页内 inline 空态；旧 inline 在触达该页时替换 |
| 手势 | `components/gesture` | 3 | 新增拖拽/点按反馈必须走共享原语，不再裸写 touch handler |
| 圆角 | 8 个既有 token | 0 新增 | 触达文件时同值裸写归并为 token；`28rpx`/`20rpx` 等 off-scale 需写例外理由 |
| 阴影 | 6 个既有 token | 0 新增 | 触达文件时自定义阴影归并到最近 token；不得为"更精致"新增第 7 种 |

### 13.4 明确不做

- 不新建设计系统、不重写样式、不批量替换 184 处 toast——P0/P1 的范围不因此扩大。
- 不接系统暗色模式；`_dark-variables.scss` 保持未接线，是否接线是独立命题。
- 不为统一而统一：§4.2 的密度变体、§4.3 的语义变体继续允许；配额限制的是"同场景同信息的不同配方"。
- 不把统一性当作新增组件的理由（§3 硬约束不变：减法不得以新增实现）。

### 13.5 验收

- 触达文件内 off-scale 圆角/阴影/字阶**不得净增**（可挂在既有 `design-audit` 与 `check-icebreaker-visuals` 的 ratchet 思路上）。
- 新增 Overlay / Sheet / Loader / 空态组件数 = **0**（PR 审查硬条件）。
- 改动屏与相邻屏同框截图，肉眼核对高度、圆角、阴影、加载、空态是否"像同一个产品"。
- 若要把配额变成 CI 扫描脚本，列为 P2，不在本期。

---

## 16. P1-1 执行记录（2026-11-02）

### 增量 1：已加入终态的重复等待句（静态证据已闭环，待真机）

- 改动：`apps/mini-program/src/pages/pool-registration/components/PoolRegistrationTerminalStates.tsx`，删除 `PoolRegistrationAlreadyJoined` 的正文长句「你的预算和期待已经收到，悦仔正在帮你挑同频的桌友，有结果会第一时间通知你。」（-3 行，无新增）。
- 依据：同屏标题「你已经加入这场{eventType}了」+ 下方 `EventSummaryCard status='registered'`（`STATUS_WAITING_COPY.registered` = 「报名成功，等待排桌」）已承载同一事实，原句是**同屏第三次复述**，属 R1。
- 保留：标题、双人成行行（复用 `pool-reg__already-text`，故无孤儿 CSS）、卡片、「查看我的局」CTA。
- 明确不动：支付成功副标题的 matching / 非 matching 两个语义变体、payment-verification「权益确认中」、订阅消息授权文案、tab-bar「排桌中…」、`VacatedSeatCard`、profile 任务提示、gathering-room（暗置）。它们要么是支付/合规面，要么是不同事实。

工程门（全绿）：pool-registration vitest **16 文件 / 108 用例**通过；`typecheck -w mini-program` 通过；`guardrails` 通过；`build:weapp` exit 0；`verify:subpackage-styles` 通过。

**静态视觉证据（2026-11-02 已闭环）**：
- BEFORE 取自 HEAD `3401aefdc` 的独立 clean worktree，使用同一生成器的 `SUBTRACTION_BEFORE=1` 模式；solo / duo × 390×844 / 375×667 / 320×568 共 12 张 BEFORE/AFTER 均已落盘并通过硬断言，当前工作树未被回滚。
- BEFORE/AFTER 视觉扫描各 3 个视口均 PASS、0 blocking。AFTER-390 的 CTA 对比度 advisory（4.23:1）在同一按钮样式下未于 BEFORE 报出，记录为扫描采样差异，不归因于本次删句。
- 独立视觉审计复核 solo-390、solo-320、duo-375、duo-320：ui-layout **78/100 → 82/100**；frontend-design **13/20 → 13/20**；user-satisfaction **18/24 → 20/24**。无新增 Class A，无评分回退。frontend-design 的 Motion 1/1 仅代表静态 reduced-motion 证据，不代表动态流畅度测量。
- BEFORE/AFTER 均存在 mascot 右侧裁切、320 标题换行与倒计时密集，判定为既有问题，本改动不处理。
- 证据：`docs/deliverables/2026-11-02-uiux-subtraction/render-matrix.md`、`score-baseline.md`、`screenshots/{before,after,diff}/`、`visual-scan/`。

**仍未测（因此 P1-1 未完成）**：真机 iOS / Android 各一台（可选 WeChat DevTools），结果只能实测后填入 `docs/deliverables/2026-11-02-uiux-subtraction/device-matrix.md`，不得预填。

回滚：恢复该 3 行即可，无数据结构、无路由、无 API 影响。

### 增量 2：已加入终态的满分目标迭代（UI 100 达成，其余按证据保留开放项）

合同：`.git/.orchestration/sprints/sprint-contract.p1-1-already-joined-full-marks.md`，状态 accepted。

- 在增量 1 基础上修复真实渲染缺陷：Taro `aspectFit` 在居中文本容器中导致 mascot 右半裁切，方形源图改用 `scaleToFill`；倒计时 flex 溢出、装饰进度、低对比单位/分隔符与地点、重复成功 pill、长双人名换行均在此终态局部修复；CTA 去阴影并用 40rpx 粗体满足大字对比度。
- 标题改为「这一局，有你的位置了」；仅在活动标题以 ` · ${poolArea}` 结尾且与 meta 完全重复时移除该后缀，其他标题不裁切。
- 未改共享 `EventSummaryCard`，未新增页面/组件/flag/API，未为分数新增分享或庆祝流程。
- 最终 8 张生成器截图全部通过硬断言；solo 三视口扫描全部 **PASS，0 blocking、0 advisory**。
- 独立最终复测：**ui-layout 100/100；frontend-design 19/20；user-satisfaction 21/24**。UI 静态目标达成；Frontend Motion 仍待动态/真机，Satisfaction 的情绪/分享分数不应靠把私密回执改成营销或分享页来凑满。
- 证据已更新：`docs/deliverables/2026-11-02-uiux-subtraction/render-matrix.md`、`score-baseline.md`。
- 最终工程验证：pool-registration/events 目标测试 **16 文件 / 108 用例**通过；`typecheck -w mini-program` 通过；隔离 `build:h5`、`build:weapp` 均通过；主包 zip **1.33 MB / 2 MB**；upload-assets 与 `verify:subpackage-styles` 通过（pool-registration 29 个必需 selector）。主仓 `guardrails` 仍被 **154 个非本次改动的 icebreaker-session 新 orphan class** 阻断，本次 pool-registration 类不在违规清单中。
- Tier-2 QA Sprint Evaluation：**PARTIAL**。AC-01/03 PASS；AC-02 PARTIAL（100/100、19/20、21/24，未达三个满分）；AC-04 PARTIAL（本次检查通过，但合同要求的主仓 guardrails 全绿仍被外部并行改动阻断）；AC-05 FAIL（iOS、Android、WeChat DevTools 未测）。不得把本增量标为 launch-complete。

### 下一步

1. ~~AFTER/BEFORE 截图、硬断言、视觉扫描与三项评分落盘~~（静态证据已完成）。
2. 真机 iOS / Android 各一台实测填入 `device-matrix.md`。
3. 真机通过后才评估是否继续收敛其余等待面；目前多数已判定为"不同事实"或"支付/合规面"，**不应为了凑 10→2 而删**。

---

## 15. P1 执行前复核（2026-11-02，证据优先于原计划）

复核结论：**P1 里"零风险/暗置清理"的部分大多不成立**。状态、日期、倒计时看似重复，实则分域且语义不同；真正剩下的都是用户可见改动，必须先有 §12 基线。

### 15.1 逐项裁决

| 项 | 原判 | 复核证据 | 新裁决 |
|----|------|----------|--------|
| 7 `alang/debug` | P1 删 | 仍是带 `index.test.tsx` 的测试工具 | 维持"需测试负责人确认"，不单方面删除 |
| 8a `alang/teaser` | 暗置死页，删 | `components/alang/AlangDiscoverCard.test.tsx:110` 断言 `navigateTo('/pages/alang/teaser/index')`；页面注释写明 `alangEnabled` 关闭时由 Discover 预告卡与 promo banner D 进入 | **不是死页，是功能关闭期的兜底落地页**。删它必须连同 Discover 预告卡一起下，等于"是否还为未开放功能做广告"的产品决策 → 降 P2 |
| 8b `checkoutSubscriptionUpsellEnabled` | 死代码，删 | `event-ticket-payment/index.tsx:213/232/253/388`、`TicketPlanSelection` D2 悦聚月卡、`ticketHelpers.resolvePaymentCheckoutFlags`、server `featureFlags.ts:352/642`、`checkoutSubscriptionUpsellFlag.test.ts` | **完整实现的月卡增购面，非死代码**，且触及支付/权益。保持暗置，商业化单独决策，移出减法范围 |
| 9 状态/时间单一源 | 5 表→1、5 函数→2、8 倒计时→2 | `eventDisplay.ts` 已是 joined-event 与 pool 两域的唯一标签源；shared `getStatusLabel` 属 matching-status 域；`STATUS_MOMENTUM_COPY`/`STATUS_WAITING_COPY` 是叙事文案不是状态标签。倒计时两处语义相反：`pool-group-detail` 过期="活动进行中"，`matching-status` 过期="当前这桌未能成局"。两处 `formatDateTimeLabel` 输出不同（含周几 vs 不含；fallback 分别为原串/空 与 '刚刚'/'时间未定'） | **撤回数量目标**，不按个数合并（§4.3 禁止压平语义变体）。本项唯一真实冗余是"等待叙事 10→2"，转入 15.2 |
| 10 成员三层 | 不变 | — | 保留，P1，需 §12 基线 |
| 11 报名 9→6 | 不变 | — | 保留，P1，需 §12 基线 + §4.6 内联终检 |

### 15.2 修正后的 P1 执行清单（全部用户可见，全部需基线）

1. **等待叙事 10 → 2**：同一"排桌中/等待"事实在 10 个表面各写一套文案，收敛为"列表卡一枚 + 状态页主叙事"。
2. **成员三层渲染**：13 处 → 概览 `TablemateCard` / 名单 `ArchetypeHead` / 详情 `TablemateDetailSheet`，保留 `SquadDeckStage` 扇形。
3. **报名 9 → 6 节点**：删确认弹窗、`intent` 回填 + 就地编辑，按 §4.6 提供内联终检块（付费/免费/权益 + disabled/submitting/失败/成功）。

**统一前置条件（缺一不可）**：§12 三档视口截图基线 + 三项审计评分落盘 `score-baseline.md` + 真机 iOS/Android 各一台。未落基线前，这三项不得标记为完成。

### 15.3 新增 P2 决策项

- 街头盲盒预告链路整体取舍：Discover 预告卡 + promo banner D + `alang/teaser` 兜底页是否保留（"为未开放功能做广告"是否仍成立）。
- 悦聚月卡 checkout 增购面的商业化裁决（保持暗置 / 上线 / 下线），由商业化席单独评估，不属于减法。

---

## 14. P0 执行记录（2026-11-02，已落地未提交）

**删除**：`event-coordination`、`center-tab-empty`、`alang/story-detail`、`alang/preferences`、`my-events`、`dev/wow-demo` 六个页面目录（含各自 config/scss/test）。

**接线修改**：`lib/onboarding/onboardingRoutes.ts`（4 个页面常量 + 4 个路由 + 2 个 alang 页表项 + 2 个分包根/页表 + 2 个分包声明）、`onboardingRoutes.test.ts`、`config/miniProgramChunks.ts`、`scripts/verify-flash-package.mjs`、`lib/navigation/centerTabRouting.ts`（无人使用的 `MINI_PROGRAM_CENTER_TAB_EMPTY_ROUTE`）、`lib/alang/flashVisualTokens.test.ts`（移除对已删 preferences 页的源码断言）、`scripts/check/class-coverage-baseline.json`（收缩至 51）。

**零消费者辅助**：仅 `getCountdownText` 确认零引用并删除；`formatEventDateShort` 等仍有引用，留待 P1 统一时处理。

**验证结果**：
- 删除符号引用扫描 0 残留。
- 定向测试 8 个文件 / 78 个用例全绿。
- `npm run guardrails` PASS（0 error，12 个既有 warning）。
- `build:weapp` PASS、`verify:subpackage-styles` PASS、`verify:upload-assets` PASS（216 个资产分类）。
- 产物 `dist/app.json`：分包根 **15 → 13**，alang 页 **14 → 12**；主包 zip **1.33 MB / 2 MB**。
- `typecheck`：本次触及文件 0 错误；现存错误全部位于他人进行中的 results 分享/海报文件（`momentsPosterFactory.test.ts`、`sharePoster.test.ts`、`FinalStage.test.ts`、`results/index.tsx`、`useResultShareActions.test.ts`），未触碰。

**复核阶段追加清理**（审查时发现删除后遗留的孤儿）：`pages/alang/flash-preferences.scss`（0 引用）、`assets/empty-state/center-empty-{bg,illustration}.webp` 及 CDN manifest 对应两条、`useArchiveDetail` + `fetchArchiveDetail` + 归档详情 query key（随 story-detail 页失去唯一消费者）。class-coverage 基线再次收缩至 51。

**最终结果**：31 个文件、**-1,401 行 / +0 行**；全量测试 **361/361 文件通过**（3,586 用例通过、1 skip）；guardrails **0 error**；`build:weapp` + `verify:subpackage-styles` 通过；主包 zip **1.32 MB / 2 MB**。

**回滚**：整批 revert 即可，无数据与 API 合约影响。
