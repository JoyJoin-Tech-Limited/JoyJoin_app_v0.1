# 高光值 Cozy Meta 设计 Spec（Session Glow Meta）

> **日期：** 2026-09-17
> **作者：** @product-manager
> **上游：** `.git/.orchestration/plans/gameplay-depth-roadmap-2026-09.md` Wave 4（最终 build wave，Tier 2 → Sprint Contract required）
> **目标读者：** Sprint Contract 起草者（@backend-engineer / @taro-engineer）。每个机制写到可直接转验收标准的粒度。
> **状态：** 设计定稿，待 Sprint Contract 引用

---

## 1. 背景与目标

### 1.1 问题

Waves 1–3 已落地（见 roadmap 状态快照），但每个环节仍是孤岛：拍卖的币死在拍卖里、quip 的票到不了 recap、奖章由 `curateMedals` 的**确定性洗牌兜底**产出——没有数据时奖章照样颁发（`apps/server/src/lib/medalCuration.ts:84-88/103-105/126-128` 的 `deterministicShuffle` fallback），「奖章与真实游玩不挂钩」是 recap 6.9 分的主要失分点。

### 1.2 目标

- **高光值**：一条贯穿全场次的 cozy 进度弧——游玩中**静默累积**（服务器权威），**只在 recap 揭示**，奖章从真实累积数据派生。
- Recap 综合分 6.9 → **≥7.5**；产出「我们这桌今晚越走越热」的叙事弧。
- **零竞争压力**（psychological-safety canon 不可协商）：无排名、无分数上屏（含 recap——见 D2/D4 的定性化处理）、无 mid-session 任何提示。

### 1.3 命名（为什么叫 sessionGlow）

计划占位名 `icebreakerHighlightsMetaEnabled` 与已落地的 Wave 3 flag **`highlightsInjectorEnabled`**（`featureFlags.ts:403`，prompt 上下文注入）视觉上几乎不可区分，admin 后台并列时必误操作。**推荐 flag：`sessionGlowEnabled`**（env fallback `SESSION_GLOW_ENABLED`，缺省 `false`）——「glow」直接对应产品语言「高光」，与 injector 一目了然地区分。文档与代码中的用户-facing 名称为「高光值」。

---

## 2. 信号源盘点（已对照代码验证，2026-09-17）

| 信号 | 状态字段 | 个人级可统计？ | 备注 |
|---|---|---|---|
| Quip battle 得票 | `quipBattleVotes: {voterId, answerId, promptId}[]`（`:706`）；**answerId = `${userId}::${promptId}`**（`socialIcebreakerExtended.ts:1340`） | ✅ 每人得票 = 以 `{userId}::` 为前缀的 answerId 票数 | **阶段退出时被 cleanup 擦除**（`socialIcebreakerHelpers.ts:1393` 注释"load-bearing"）——必须在 transitionPhase 的 **pre-cleanup** 点读取（与 highlights extractor 同点） |
| Group mirror 被提名 | `groupMirrorVotes/groupMirrorAnswers: GroupMirrorAnswer[]`（`:731-732`，含 `targetUserId`） | ✅ | cleanup 行为未逐字段核实——**待验证**是否同样在退出时擦除；按 pre-cleanup 读取设计即可免疫 |
| Lie detective V2 | `lieDetectiveRevealHistory: {round, correctRate}[]`（`:894`） | ❌ **仅轮级聚合**，无个人对错史（V1/V2 皆然）；`state.votes` 只存当前轮 | 诚实结论：**不计个人猜对分**，只计「完成自己的侦探回合」（`lieDetectiveCompletedUserIds`）。个人级统计是后续工单（见 §8） |
| Micro challenge / 人格骰子 | `challengeCompletedBy`（`:657`）、`diceCompletedBy`（`:669`） | ✅ 完成标记 | 无投票/评分信号（Wave 3 已记录同一现实） |
| 拍卖 V2 | `auctionLotResults: AuctionLotResult[]`（`:697`，含 `winnerUserId/winningAmount/wasAllIn`） | ✅ | Wave 2 已落地；`auctionV2Enabled` 快照字段存在（`:701`） |
| MiniScript V2 | `miniScriptRevealedPlayerResults: {userId, round1Correct?, round2Correct?}[]`（`:858`、`:548-552`） | ✅ 双对可判定 | 既有 honor line（`buildMiniScriptRecapLine`，`socialIcebreakerHelpers.ts:816-821`）是 recap-only 表彰先例 |
| 谁是卧底 | `undercoverWordVotes: UndercoverWordVote[]`（`:724`，{voterId, targetUserId}）+ `undercoverWordResults`（`:727`，含 `caught/undercoverUserId`） | ✅ 投票对错 = targetUserId === undercoverUserId | 阶段退出时 cleanup 擦除风险同上——pre-cleanup 读取 |
| **Wave 3 已落地（集成，不重复）** | `state.highlights: string`（`:762`，≤300 字，聚合匿名，`mergeSessionHighlights` 分节合并） | — | **仅作 LLM prompt 上下文**：已从 client state 中 sanitize 删除（`socialIcebreakerHelpers.ts:91`）。与高光值是**两个东西**：highlights = 匿名聚合文本喂 prompt；高光值 = 结构化个人数据驱动 recap UI。不复用、不合并（见 §5） |

**Recap 现状（验证）：** `recapSnapshot`（`:769-800+`）已含 `medals: Medal[]`、`lieDetectiveV2Stats`、`personalityDiceHighlights`、`undercoverWordResult`、`microChallengeHighlights`、`groupMirrorHighlights`；`ensureRecapSnapshot` 幂等（`socialIcebreakerHelpers.ts:928-933`）；`Medal = {emoji, title, recipientDisplayName, description}`（`:482`）；客户端 `RecapPhaseView.tsx` 有奖章网格（`:353-369`）、`IdentityReveal`（`:318`）、moment-card 面板。**`transitionPhase` 的 pre-cleanup 点 = `socialIcebreakerHelpers.ts:1393-1443`**，highlights extractor 已在此运行——高光值累积块紧随其后，是同一咽喉点。

---

## 3. 机制设计（6 项决策）

### D1. 累积规则表

**原则：小而暖（数字只用于奖章派生与分档，永不上屏）；每源设 cap 防刷；blaze 与 breeze 不做总分归一化（无排名则无公平问题），但「全勤」类按**本场次实际提供的环节**判定。**

| 来源 | 事件 | 分值 | Cap/人 | 读取点 |
|---|---|---|---|---|
| Quip battle | 收到 1 票 | +2 | +8 | transitionPhase pre-cleanup（**必须**，票随 cleanup 销毁） |
| Group mirror | 被提名 1 次 | +2 | +8 | 同上（防御性 pre-cleanup） |
| 拍卖 | 成交 1 标 | +3 | +6 | `auctionLotResults`（ survives cleanup） |
| MiniScript V2 | 双对（round1+round2 皆对） | +3 | +3 | `miniScriptRevealedPlayerResults` |
| 谁是卧底 | 卧底成功隐藏（caught=false → 卧底本人）；或 抓对卧底（caught=true → 投对者各 +2） | +3 / +2 | +3 / +2 | pre-cleanup 读 `undercoverWordVotes` + `undercoverWordResults` |
| Micro challenge | 完成挑战 | +2 | +2 | `challengeCompletedBy` |
| 人格骰子 | 完成挑战 | +2 | +2 | `diceCompletedBy` |
| Lie detective | 完成自己的回合 | +1 | +1 | `lieDetectiveCompletedUserIds`（个人对错分**故意不做**——数据不可信，§2） |

**理论上限 ≈ 33 分；典型场次人均 3–15。** 存储为**按源分解**的结构（奖章派生需要分源数据，见 D2）：

```ts
interface GlowPointBreakdown {
  quip: number; mirror: number; auction: number; miniscript: number;
  undercover: number; challenge: number; dice: number; lie: number;
}
// state.glowPoints?: Record<userId, GlowPointBreakdown>  // 全部可选，缺省全零
```

**迟到者 / 跳过环节：** 不归一化。迟到者机会少是物理事实；由于没有排名和分数展示，不存在不公。选择 opt-out（`phaseOptOutUserIds`，诚实跳过）**永不扣分**——参与底线档照样获得（D2 分档地板）。**累积只在 snapshot ON 时发生**；某环节 flag OFF 的会话该环节自然无贡献（breeze 合法低分）。

### D2. 奖章派生（诚实改造）

**规则 1（诚实铁律）：数据派生奖章永远不在无底层数据时颁发。现有 3 枚奖章的 `deterministicShuffle` 无数据兜底，在 flag ON 时移除；flag OFF 时保持字节级现状。**

| 奖章 | 数据源 | 触发门槛（诚实下限） | 备注 |
|---|---|---|---|
| 接梗王 | glowPoints.quip | ≥2 票（即 ≥4 分），取最高 | 新增 |
| 暖心雷达 | glowPoints.mirror | ≥2 次提名，取最高 | 新增 |
| 豪气担当 | 成交标数（auctionLotResults） | ≥1 标，取最多；并列取先成交者 | 新增 |
| 名侦探（既有 最佳侦探 改造） | 现有 medalCuration 权重（当前轮 votes/reveal + completedUserIds 兜底链） | 权重链非空才发；**删掉 shuffle 兜底** | 保留品牌，诚实化 |
| 挑战先锋（既有） | `challengeCompletedBy` | 同上 | 保留，诚实化 |
| 话题王（既有） | `pulseChecks`/`warmupReadyUserIds` | 同上 | 保留，诚实化 |
| 全勤小可爱 | 完成本场次**实际提供**的全部 full-participation 环节（按 `enabledPhases`/runPlan 判定） | 全部完成 | 新增；按场次裁剪，breeze 可达 |

**每奖章不同得主**（沿用 `usedUserIds` 规则）；**上限 4 枚/场**（4–6 人桌，多数人有奖但不至于通胀）；优先级 = 数据强度降序（分高者优先占位）。并列沿用 `sortByWeightDescThenName`（权重 → zh-CN 名 → userId，确定性）。MiniScript 双对**不设新奖章**——既有 honor line 就是它的表彰（§5 集成决策）；它只贡献高光值 +3。

**分档（定性词，非分数）：** 每人在 recap 获得一个档位词——`微光`（地板，到场即有）/ `暖心`（总分 ≥6）/ `闪闪发光`（总分 ≥12）。**数字永不上屏**；地板档文案必须正面（「静静发光也是光」方向，最终文案过 🔴 审校）。**零数据桌：只发地板档 + 诚实空态文案，零奖章**（见 D5）。

### D3. Recap 揭示序列

- **位置：** recap 页内，既有奖章网格（`RecapPhaseView.tsx:353-369`）扩展为「今晚的高光」区块：桌级标题行（「这桌今晚的高光时刻」+ 一句桌级总结，数据来自聚合）→ **逐人卡片**（座位/roster 顺序，自己的卡片高亮描边）。
- **揭示节奏：** 首屏展示桌级行 + 第一张卡片；其余卡片**逐张 stagger 淡入**（复用 `useMiniRevealMotion` 模式）或点按「看下一位」手动推进（host 与参与者同权——**没有 host 专属视图**，同桌同见）。奖章内嵌在对应人的卡片里，不再单独成网格。
- **RM：** `prefers-reduced-motion` → 全部卡片静态直出，无 stagger。
- **Haptics：** 区块入场 `socialCelebration` 一次（`icebreakerHapticGrammarEnabled` 门控下）；逐卡不再震。
- **资产：** 零新增重资产——CSS 光晕 + `JoyJoinIcon` + 既有 `IdentityReveal` 模式；无新 Lovart 批次、无新字体。子包规则：新组件 SCSS `@use` 进页面 SCSS（防 sub-common.wxss 陷阱）。

### D4. 个人级隐私

**决策：档位词与奖章全桌可见（与今日奖章可见性一致），数字永不出现，个人分明细（哪一源得了多少）仅自己可见且默认折叠。**

理由：4–6 人陌生人同桌，「被看见」是破冰的目标而非风险——奖章今天就是公开的；真正的高压来自**可比较的精确数字**，所以数字彻底移除。分源明细（「你的高光来自：接梗 ×3」）是自我叙事素材，自己可见即可，默认收起、点开才看，避免逐人朗读尴尬。服务器下发：`glowPoints` 全量随 recap 快照下发（奖章派生在服务端完成，客户端不做计算——server-authoritative canon），但**客户端只在本人卡片渲染明细**。**待验证：recap 快照下发时 `glowPoints` 是否需经 `sanitizeStateForClient` 裁剪他人明细**——隐私 canon 下建议裁剪（他人只留档位词 + 奖章，明细只发本人），列为合约 AC。

### D5. 边界情况

| 情况 | 行为 |
|---|---|
| 并列 | `sortByWeightDescThenName` 确定性裁决（既有函数，复用） |
| 全零桌（无人有任何信号） | 零奖章；全员地板档「微光」；诚实空态文案（「今晚这桌更像静静相处的一桌」方向，🔴 审校）；**不伪造高光** |
| Breeze 场（warmup/micro/lie/recap） | 可用源 = challenge +2 / lie +1 /（话题王奖章）——足够产出 1–2 枚诚实奖章 + 地板档；quip/mirror/auction 奖章自然不触发 |
| 提前结束（`endedEarlyAt`/`interruptedAtPhase`） | 已发生即累积；recap 既有 `interrupted` 诚实框架沿用 |
| 迟到加入 | 只累积其到场后的事件（自然结果，无需特判）；地板档照发 |
| Opt-out / 沉默被 auto-complete | 不扣分、不标记；地板档照发（psychological-safety canon） |
| 高光值会话中途 flag 被关 | 快照 canon：`/start` 快照后切换不影响进行中会话；新会话按新值 |
| 单源刷屏（如 quip 互投联盟） | 每源 cap（D1）已封顶；奖章每枚不同得主 + 上限 4 枚 |

### D6. 衡量

| 指标 | 口径 | 目标 |
|---|---|---|
| Recap dwell | `social_icebreaker_phase_metrics`，phase='recap'，`dwell_time_ms`（列名已验证） | flag ON vs 基线提升，且不退化 >15%（发布门沿用） |
| Moment-card 生成率 | 生成请求 / recap 会话 | 不下降（发布门 G3） |
| **奖章诚实率（新）** | 数据派生奖章数 / 总颁发奖章数（埋点 `glow_medal_awarded{dataDerived}`） | ON 时 = 100%（shuffle 兜底已删）；这是本 workstream 的定义性指标 |
| 人均档位分布 | `glow_recap_revealed` 埋点携带 tier（匿名聚合） | 观察地板档占比是否 >60%（>60% 说明信号太稀疏，需调参） |
| 活动反馈 CSAT | 既有 event_feedback | 不下降 |
| 投诉 | 竞争压力/炫耀类反馈 | 零 |

---

## 4. 状态与数据契约变更

> 全部**可选字段追加**；V1 会话（无新字段）序列化/客户端渲染不受影响；flag OFF = 字节级今日 recap。

### 4.1 `packages/shared/src/socialIcebreaker.ts`

| 变更 | 内容 |
|---|---|
| 新 interface | `GlowPointBreakdown`（8 源分，D1） |
| 新 interface | `GlowTierWord = '微光' \| '暖心' \| '闪闪发光'`（机器值建议英文枚举 `'ember' \| 'warm' \| 'blazing'`，中文由 copy 层映射——**待合约起草者定**，以 i18n/序列化惯例为准） |
| `SocialSessionState` 追加 | `sessionGlowEnabled?: boolean`（/start 快照）、`glowPoints?: Record<string, GlowPointBreakdown>` |
| `recapSnapshot` 追加 | `glow?: { tiers: Record<userId, tier>; medals: Medal[]; tableLine: string }`（服务端派生的最终产物，客户端纯渲染） |

### 4.2 服务端

| 位置 | 变更 |
|---|---|
| `featureFlags.ts` | `FLAG_ENV_MAP.sessionGlowEnabled: 'SESSION_GLOW_ENABLED'` + `DEFAULT_FLAG_VALUES.sessionGlowEnabled: false`（含命名理由注释） |
| `socialIcebreaker.ts` `/start` | 快照读入 `state.sessionGlowEnabled`——**并行化**：参照既有 `highlightsInjectorPromise`（`:538`）模式，Promise 并发发起，不增 /start 墙钟 |
| `socialIcebreakerHelpers.ts` `transitionPhase` | **pre-cleanup 点**（`:1393-1443`，highlights extractor 之后）新增累积块：snapshot ON 时按 D1 表把刚离开环节的分写入 `glowPoints`（纯同步、确定性、无 LLM——与 extractor 同纪律） |
| `lib/medalCuration.ts` | flag ON 路径：新增 4 数据奖章 + 删 shuffle 兜底 + 上限 4 + 门槛表（D2）；flag OFF 路径**零改动** |
| `ensureRecapSnapshot` | snapshot ON 时派生 tiers/medals/tableLine 写入 `recapSnapshot.glow`；幂等沿用 |
| recap LLM | **可选**：把派生奖章/桌级行作为有界字符串喂 `generateRecapSummary`（auctionRecapLines 先例）——AI 可叙述、不可发明；奖章区块永远由结构化数据渲染，不读 AI 文本。**待合约决定本轮是否接线**（不接也完全成立，见 §7 风险 R-C） |
| `sanitizeStateForClient` | 裁剪 `glowPoints` 他人明细（D4，待验证项转正） |

### 4.3 客户端

| 位置 | 变更 |
|---|---|
| `RecapPhaseView.tsx` | 奖章网格改造为「今晚的高光」区块（桌级行 + 逐人卡 + 档位词 + 内嵌奖章 + 本人明细折叠） |
| 新 `viewModels/sessionGlowModel.ts` | 纯函数：卡片排序、本人判定、明细可见性（单测覆盖） |
| 埋点 | `glow_recap_revealed`（tier 分布）、`glow_medal_awarded`（medal + dataDerived + source）、`glow_detail_expanded`（本人明细点开率）——走既有 analytics 白名单流程 |

---

## 5. 与 Wave 2/3 落地件的集成点（文件：行）

| 落地件 | 集成决策 | 位置 |
|---|---|---|
| Wave 3 `state.highlights`（匿名聚合 prompt 文本） | **不复用、不合并。** highlights 是 sanitize 到客户端都不可见的 LLM 上下文（`socialIcebreakerHelpers.ts:91`）；高光值是客户端渲染数据源。两者数据源重叠但用途互斥。唯一共性：同在 transitionPhase pre-cleanup 点计算（`:1393-1443`）——累积块紧随 extractor 块 | `socialIcebreakerHelpers.ts:1393-1443`；`lib/sessionHighlights.ts` |
| Wave 3 `highlightsInjectorEnabled` flag | 仅命名避让（§1.3）。两 flag 独立可杀 | `featureFlags.ts:403/515` |
| Wave 3 recap `highlights` 参数（`*_HL` promptVersions） | 高光值**不进** HL prompt 块（那是匿名聚合通道）；奖章数据如进 prompt 走独立有界参数（§4.2 可选项） | `socialIcebreakerAI/recap.ts:53` 等 |
| Wave 2 `auctionLotResults` | D1 拍卖源的直接输入（成交 +3、wasAllIn 不另加分——全押的高光已在环节内庆祝过，避免重复奖励同一行为） | `socialIcebreaker.ts:697` |
| MiniScript honor line | **保持独立**：`buildMiniScriptRecapLine` 是 recap 文案表彰；双对同时喂 +3 高光值。**不重复设奖章**——同一成就不两次表彰 | `socialIcebreakerHelpers.ts:816-821` |
| `curateMedals` | D2 诚实化改造的唯一触点；flag OFF 零改动 | `lib/medalCuration.ts:151-175` |
| `recapSnapshot.medals` | 派生奖章的最终落地处（沿用既有快照幂等） | `socialIcebreakerHelpers.ts:997` |
| 客户端 `IdentityReveal` / 奖章网格 | D3 复用模式，不引新资产 | `RecapPhaseView.tsx:318/353-369` |

---

## 6. 埋点与衡量

见 D6 表。三个新事件（`glow_recap_revealed` / `glow_medal_awarded` / `glow_detail_expanded`）需进 `apps/server/src/routes/domains/analytics.ts` 白名单（`auction_bid_placed` 旁，`:395` 区域先例）。**奖章诚实率 = 本 workstream 的定义性健康指标**：flag ON 后必须为 100%，任何 <100% 意味着诚实铁律被穿透，等同 P1。

## 7. 风险与回滚

| # | 风险 | 级 | 缓解 |
|---|---|---|---|
| R-A | 档位词仍构成软比较（微光 vs 闪闪发光） | M×H（R5 传承） | 仅 3 档 + 地板全正面文案 + 数字绝不上屏 + 明细本人折叠；产品复核拥有否决权（roadmap R5 veto path）；全量文案过 `user-satisfaction-audit` |
| R-B | 累积点位置错误（post-cleanup 读票 → 全零） | L×H | 合约强制「quip 票在 pre-cleanup 累积」测试（镜像 highlights extractor 的 load-bearing 测试）；代码评审点名检查 `:1393-1443` 相对位置 |
| R-C | 奖章进 recap prompt 引入 AI 失真 | L×M | 本轮**默认不接线**（§4.2 可选项）；奖章区块永远结构化渲染——即使接线，AI 只叙述桌级行 |
| R-D | Breeze 场信号稀疏 → 全桌微光 | M×L | D6 地板档占比监测；后续可调 threshold 或加 warmup 参与分（本轮故意保守） |
| R-E | flag 命名混淆（与 highlightsInjectorEnabled） | L×M | `sessionGlowEnabled` 命名（§1.3）+ featureFlags.ts 注释 + admin 后台两 flag 不相邻时可加描述 |

**回滚：** `/admin/feature-flags` 置 `sessionGlowEnabled=false` → ≤5s 新会话生效；已快照会话按快照完结（快照 canon）；`glowPoints` 等可选字段在 flag OFF 代码路径下惰性（不读不写）；无 DDL、无迁移、回滚零成本。代码级 revert 后残留 DB 行不可读（既有模式）。

## 8. Out of scope

- **跨场次持久化**：高光值是场次内 ephemeral；入 profile/徽章墙/等级体系是永久否决项（竞争压力 canon）。
- **Lie detective 个人级对错统计**：需要 V2 逐轮 reveal 路由挂钩累积（超出 transitionPhase 咽喉点纪律）——后续工单，本轮只计参与。
- **Mid-session 任何形式的高光提示**（进度条、 toast、「你刚 +2」）——canon 禁止，永不做。
- **数字总分展示**（任何界面、任何时刻）。
- **高光值进 `state.highlights` prompt 通道**（§5 决策）。
- **新视觉资产 / 3D / WebGL / 新字体**。
- Wave 3 highlights extractor 本身的改动（它已 QA PASS）。

---

## 9. 验收标准（供 Sprint Contract 引用）

- **AC-01 Flag 注册**：`sessionGlowEnabled` 入 `FLAG_ENV_MAP`（env `SESSION_GLOW_ENABLED`）+ `DEFAULT_FLAG_VALUES=false`；注册测试 + admin PUT→GET 往返测试（N1 先例：真实 `registerAdminRoutes` app，断言 `source:'db'` + `FEATURE_FLAG_UPDATED` 审计 + unknown-key 400）。
- **AC-02 /start 快照**：快照写 `state.sessionGlowEnabled`；读取与既有 flag 读**并发**发起（/start 墙钟预算测试不破，500ms 预算 ≥3 次实测）；中途切 flag 不变进行中的会话（快照不可变测试，镜像 `miniscriptEvidenceVoteV2.test.ts:906-940`）。
- **AC-03 累积正确性**：D1 表每源单测（分值、cap、读取字段）；**quip 票在 pre-cleanup 累积**的 load-bearing 测试（phase 退出后 quipBattleVotes 被擦除但 glowPoints.quip 已入账）；opt-out/沉默不产生负分。
- **AC-04 奖章诚实**：flag ON 时无数据奖章数 = 0（shuffle 兜底在 ON 路径不存在）；每枚奖章不同得主；上限 4；并列确定性（同输入同输出 ×3 次）。
- **AC-05 Recap 快照**：`recapSnapshot.glow` 含 tiers/medals/tableLine；`ensureRecapSnapshot` 幂等（二次进入不重复派生）；全零桌 → 零奖章 + 全员地板档 + 诚实空态文案。
- **AC-06 Flag-OFF 字节级**：`curateMedals` OFF 路径与今日逐字节一致（既有 medal 测试零编辑通过）；无 `glowPoints` 写入；recap 快照无 `glow` 键。
- **AC-07 隐私**：`sanitizeStateForClient` 后他人 `glowPoints` 明细不可见（仅 tier + medals 下发）；本人明细完整；客户端只在本人卡片渲染明细。
- **AC-08 客户端**：档位卡逐张 stagger + RM 静态直出；`socialCelebration` 仅在区块入场一次且受 haptic flag 门控；零新重资产；`build:weapp` + `verify:subpackage-styles` + `check:package-size` 绿。
- **AC-09 埋点**：三事件入白名单并可按 `discover_analytics_events` 形状查询；`glow_medal_awarded` 携带 `dataDerived`。
- **AC-10 文案**：档位词/空态/桌级行/明细文案全量过 🔴 Hard Rules；无数字上屏（含 recap）的静态断言测试；无 raw emoji（guardrails）。

---

## 10. 待验证清单（合约起草前关闭或转假设）

| # | 项 | 建议负责人 |
|---|---|---|
| V-1 | `groupMirrorVotes/Answers`、`undercoverWordVotes` 是否同样被 `cleanupPhaseStateForNextPhase` 擦除（D1 按 pre-cleanup 读取设计已免疫，但合约测试需确切断言） | @backend-engineer 读 `socialIcebreakerPhaseConfig.ts` cleanup 表 |
| V-2 | `glowPoints` 全量下发 vs sanitize 裁剪他人明细的最终隐私裁决（D4 推荐裁剪） | 合约起草 + verifier |
| V-3 | 档位机器值枚举命名（`'ember'/'warm'/'blazing'` vs 中文直存） | 合约起草者按序列化惯例定 |
| V-4 | 奖章数据进 recap LLM prompt 本轮是否接线（§4.2 可选项，默认不接） | 合约起草者 + @ai-engineer |
| V-5 | 「全勤小可爱」对 custom-mode / runPlan 场次的「实际提供环节」判定口径（`enabledPhases` vs runPlan.segments vs completedPhases） | @backend-engineer |
