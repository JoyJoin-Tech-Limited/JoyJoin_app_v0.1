# 拍卖 V2 重设计 Spec（Auction V2 Redesign）

> **日期：** 2026-09-16
> **作者：** @product-manager
> **上游计划：** `.git/.orchestration/plans/gameplay-depth-roadmap-2026-09.md` Wave 2（Auction 专属 Sprint，Week 2–3，Tier 2 → Sprint Contract required）
> **目标读者：** Sprint Contract 起草者（@backend-engineer / @taro-engineer / @ai-engineer）。本文每个机制都写到可以直接转化为验收标准的粒度，不需要再向产品提问。
> **状态：** 设计定稿，待 Sprint Contract 引用

---

## 1. 背景与目标

### 1.1 背景

拍卖（`auction`）是 Social Icebreaker 中评分最低的环节：综合 **3.2/10**（Visual 3.0 / Interaction 3.0 / Engagement 3.0 / Technical 4.0，评分标准见 `.git/.orchestration/plans/boost-all-games-to-8.md`）。2026-07 已上线视觉层（PhaseHeroCard 拍卖横幅、落槌 ParticleBurst、CardFlip 拍品揭晓），但**机制从未重新设计**：出价是自由输入框 + 固定 +5/+10 按钮，反超提醒是无震动的 3 秒 toast，全押无任何仪式感，结束后直接跳出「拍卖结束」静态卡片。

拍卖只出现在 **blaze 档（狂欢局，90 分钟）**——这是付费承诺最高的一档，拍卖是「premium 差异化」的核心载体之一（boost-all-games-to-8 §Key insight：blaze-only phases create the "premium" differentiator）。现状与这档位的承诺严重不匹配。

### 1.2 目标

- 综合评分 3.2 → **≥8.0**（QA Agent 按 boost rubric 重新打分）。
- 机制深度：从「填数字竞价」变成「有梯度决策、有反超张力、有全押高光、有终局叙事」的桌游。
- 不破坏三条既有铁律：**host-paced**（无倒计时、无自动推进）、**虚拟币与真实金钱零关联**、**服务器是唯一状态权威**。

### 1.3 非目标

见 §8 Out of scope。

---

## 2. 现状盘点（已对照代码验证）

> 验证日期 2026-09-16。任务简报与代码不符之处以代码为准，已逐条标注。

### 2.1 服务端（已验证）

| 项 | 真值 | 位置 |
|---|---|---|
| 路由文件 | 拍卖三条路由实际在 `socialIcebreakerExtended.ts`，**不在** `socialIcebreakerGameplay*.ts`（简报猜测有误） | `apps/server/src/routes/socialIcebreakerExtended.ts:974/1047/1119` |
| `generate-lots` | host-only；已生成则幂等返回；余额 = 全员（roster + host）各 `AUCTION_STARTING_COINS`；注入 `buildArchetypeContext(roster).mixText` | 同上 :974–1043 |
| `bid` | 任意正整数；须 > 当前最高；须 ≤ 可支配（余额 + 自己的托管出价）；新高价先退回前高出价者再扣新出价者；`auctionBidHistory` 上限 200 条 | 同上 :1047–1115 |
| `close-lot` | host-only；写一行 recap（成交或流拍）；最后一标置 `auctionAllLotsClosed=true` | 同上 :1119–1178 |
| 推进守卫 | 非 `auctionAllLotsClosed` 时 host `advance` 返回 400 | `socialIcebreakerExtended.ts:234–237` |
| 经济常量 | `AUCTION_STARTING_COINS = 100`；`AUCTION_MIN_LOTS = 2`；`AUCTION_MAX_LOTS = 5` | `packages/shared/src/socialIcebreaker.ts:354–359` |
| 提示词版本 | `AUCTION_LOTS_PROMPT_VERSION = 'social-auction-lots-v2'`（**简报写的 v1 已过时**）；但 generate-lots 的缓存 meta 回退硬编码 `'social-auction-lots-v1'`——**版本漂移，小修项** | `apps/server/src/ai/socialIcebreakerPrompts.ts:38` vs `socialIcebreakerExtended.ts:996` |
| LLM 开关 | `SOCIAL_AUCTION_LLM_ENABLED` **缺省 = true**（代码注释 "default: AI enabled for backward compat"）。**与 skill 文档（说缺省 false）矛盾，以代码为准**；docs-sync 跟进项 | `apps/server/src/socialIcebreakerAuctionAI.ts:77–81` |
| 兜底拍品 | 仅 **3 条**静态 curated（社死瞬间 / 离谱旅行故事 / 小习惯），全场次相同 | `socialIcebreakerAuctionAI.ts:71–75` |
| 安全管线 | `moderateGeneratedContent` + `enforceReviewVocab: true`；AITrace `fallbackUsed` 全路径记录；`raceWithTimeout` 硬限时 | `socialIcebreakerAuctionAI.ts:51–69` |
| AIGC 角标 | **fail-closed 已正确实现**：fallback 时 `buildAIGCMeta` 返回 `{ aiGenerated: false }`，策划内容不会误挂 AI 标 | `packages/shared/src/types/aiMeta.ts:87–98` |
| `auctionLotStartedAt` | **不存在**。skill 文档提到的「server-synced timer」在 state 中无任何痕迹——host-paced canon 下无倒计时，skill 文档已过时（docs-sync 跟进项） | 全库 grep 无结果 |
| 环节时长 | blaze run plan 中 auction = **17 分钟**，energyWeight 3 | `packages/shared/src/socialIcebreakerRunPlans.ts:57` |
| WS beats | `socialGroupBeats.ts` 现有 kind：`phase_advanced / session_recap / reveal`；pattern：`nudge / reveal / celebration`；**state-free**（仅 pattern + nonce + sentAt，广播到整个房间，不带 targetUserId——by design）；flag `icebreakerGroupBeatsEnabled` 当前 dark。拍卖今天**不发任何 beat** | `apps/server/src/lib/socialGroupBeats.ts`、`packages/shared/src/wsEvents.ts:182–202` |
| Recap | `buildAuctionRecapLines` 截取 ≤8 行、每行 ≤120 字，进入 recap LLM prompt | `apps/server/src/routes/socialIcebreakerHelpers.ts:823–827` |
| 环节开关 | `SOCIAL_ICEBREAKER_ENABLE_AUCTION` env 门，缺省 false | `apps/server/src/socialIcebreakerPhaseConfig.ts:41` |
| 埋点 | analytics 白名单已有 `auction_bid_placed` | `apps/server/src/routes/domains/analytics.ts:395` |

### 2.2 客户端（已验证，`apps/mini-program/src/pages/icebreaker-session/phases/AuctionHeroView.tsx`）

| 项 | 真值 |
|---|---|
| 出价 UI | 快捷按钮 **+5 / +10 / 全押** + **自由数字输入框**（`type='number'`，唤起微信键盘） |
| 反超提醒 | **轮询驱动**：检测到 `auctionHighBid.userId` 从自己变为他人 → toast「被 X 以 N 币超价！」3 秒自动消失；**无震动、无 WS 通道** |
| 出价记录 | 当前标最近 6 条（`auctionBidHistory` 按 `lotIndex` 过滤） |
| 全押 | 仅是一个按钮文案（出价 = 全部余额），**无任何特殊视觉/震动/全桌通告** |
| 视觉 | CardFlip 拍品揭晓（500ms）、落槌 ParticleBurst（赢家本机 900ms）、PhaseHeroCard + `band-auction.webp`、`PhaseAigcRow` |
| 角色 | `resolveAuctionRoleControls`：**真实会话中 host 不能出价**（仅 host 控制）；single-test 可切换预览角色 |
| 结束态 | `allClosed` 后静态卡片「拍卖结束」+ host「进入下一阶段」按钮。**无结算、无排行榜、无奖项** |
| 可用资产 | `IdentityReveal`（recap / undercover 已在用）、`ParticleBurst`、`CardFlip`、social haptic grammar（flag `icebreakerHapticGrammarEnabled`）、`groupBeatModel.ts` 客户端 beat 分发（含 nonce 去重 + 轮询双发抑制窗口 6500ms） |

### 2.3 约束真相

- **Host-paced canon（2026-07-29）**：无倒计时、无自动推进；出价持续到 host 落槌。本设计全程遵守——所有「仪式感」都通过轮询/beat 自然浮现，绝不强制打断。
- **Blaze-only**：auction 仅在 blaze 档编译进 run plan（`runPlanCompiler.ts:197`）。默认档（glow）零影响，爆炸半径可控。
- **vibe 字段已存在**：`state.vibe: 'chat' | 'balanced' | 'game'`（深聊/均衡/暢玩），可直接用于经济与拍品调性分流。

---

## 3. 机制设计（8 项决策）

### D1. 叫价梯度（bid ladder）

**决策：删掉自由数字输入框，改为纯点按三档阶梯；梯度随当前最高价缩放（scaled-to-current-bid），按钮直接展示「出价后的总价」。**

| 档位 | 公式（`high` = 当前最高价，无出价时 = 0） | 定位 |
|---|---|---|
| 稳一手 | `high + max(5, round5(high × 0.10))` | 低承诺跟价 |
| 加一点 | `high + max(15, round5(high × 0.30))` | 表态式跳价 |
| 全押 | 全部可支配余额（余额 + 自己托管中的出价） | 高光时刻（见 D3） |

`round5` = 向上取整到 5 的倍数。按钮文案显示**总价**而非增量：如「20」「35」「全押 80」。无出价时三档为 5 / 15 / 全押。

**服务端不变**：`bid` 仍接受任意 `int > high 且 ≤ spendable`（bot、API 测试、旧版本客户端兼容）；阶梯纯属客户端呈现层。并发竞态维持现有语义：两笔同价同时到达，先到先得，后者 400「须高于当前最高」→ 客户端 toast 并立即刷新（现有错误路径复用）。

**理由：**
- **微信键盘在酒桌上是交互杀手**：6 人围桌、单手、光线暗，唤起键盘 → 输入 → 校验 → 纠错是 4 步摩擦；点按是 1 步。这是 Interaction 3.0 的最大单点失分。
- 固定 +5 在高价区（60+）需要 8 次点击才能翻倍，残局拖沓；缩放梯度保证任何价位 2–4 次抬价完成一次升级，节奏恒定。
- 展示总价而非 +N：消除「+10 是加在谁头上」的心算歧义（新用户最高频困惑点）。
- 删输入框同时删掉一整类错误态（非正整数、超余额、低于最高价的前端校验文案）。

### D2. 反超提醒（outbid alert）

**决策：三层通道，轮询仍是唯一状态真相；新增 WS beat 只做「提前震动」。**

1. **轮询检测（现有机制，保留为兜底）**：客户端检测到 `auctionHighBid.userId` 从自己变为他人 → 展示反超 toast + 触发 `socialNudge` 震动（在 `icebreakerHapticGrammarEnabled` 门控下；当前实现无震动，本次补上）。
2. **WS group beat（新增，加速通道）**：`socialGroupBeats.ts` 新增 kind **`auction_outbid`**，映射 pattern **`nudge`**（复用现有 pattern 词汇表，`wsEvents.ts` 零改动）。`/bid` 成功且存在 `previousHighBidder` 时发射。
   - **服务器侧限流：同一会话两次 `auction_outbid` beat 间隔 ≥ 5 秒**（模块级 Map<sessionId, lastEmitAt>）。6 人桌快速互抬时 beat 合并，不会连震。
   - **state-free 契约不变**：beat 不携带 targetUserId。收到 beat 的各客户端自查「上一帧状态里最高价是不是我」→ 是则立即播 toast + `socialNudge`；否则仅触发一次提前轮询刷新出价区。Buzz-before-picture 偏移符合 beats 既有语义（"late, never missing"）。
   - 客户端去重：`GroupBeatTracker` 现有 nonce 去重 + 6500ms 同 pattern 抑制窗口直接复用，轮询兜底到达时不双震。
3. **文案**：`「{displayName} 出到 {amount} 币，你被反超啦」`（3 秒自动消失，现有 toast 容器复用）。去掉「超价！」的对抗感，保留事实 + 温度。

**限流总结**：beat 服务端 ≥5s/会话；toast 单条 3s 自然去重；haptic 由 `SOCIAL_HAPTIC_PRIORITY` busy-guard 仲裁（socialNudge 优先级 1，不会打断 reveal/celebration）。

### D3. 全押时刻（all-in ceremony）

**决策：全押是一等事件——服务器打标、全桌同步、专属仪式感；但全押不锁标（诚实机制）。**

1. **服务器打标**：`/bid` 时若 `amount === spendable`（余额 + 托管全出），在该条 `AuctionBidRecord` 上写 **`isAllIn: true`**，并同步到 `auctionHighBid.isAllIn`（客户端无需扫历史即可渲染）。
2. **全桌通告**：新增 beat kind **`auction_all_in`**，pattern **`reveal`**（群体时刻，全 grammar 中唯一长震）。全押是稀有事件（每人每环节最多数次），无需限流；同一人同一标重复全押不重复发射（服务器按 `auctionHighBid.isAllIn` 已置位去重）。
3. **客户端呈现**（下一次轮询或 beat 到达时，遵守 host-paced——不打断任何进行中的操作）：
   - 领先者行变为「全押」印章徽章（`JoyJoinIcon`，非 raw emoji）+ 一次性 `ParticleBurst`（复用现有组件；reduced-motion → 静态徽章，无粒子）。
   - 全桌 `socialReveal` 震动（`icebreakerHapticGrammarEnabled` 门控下）。
   - 出价历史该条追加「全押」标签。
4. **Host 侧提示**：host 面板出现轻提示「{displayName} 全押了，可以落槌」——决策辅助，不是强制。
5. **诚实机制**：全押 ≠ 必胜。余额更多的人仍可反超（此时前者已归零出局本标，符合拍卖直觉）。文案永不暗示全押「锁定」拍品。

### D4. 终局结算（finale）

**决策：`allClosed` 后的静态「拍卖结束」卡片替换为两幕结算序列；新状态字段 `auctionLotResults` 是唯一数据源。**

**新状态字段（服务器在 `close-lot` 时逐标写入）：**

```ts
interface AuctionLotResult {
  lotIndex: number;
  lotId: string;
  title: string;          // 快照，防 auctionLots 后续变更
  winnerUserId: string | null;   // null = 流拍
  winningAmount: number | null;
  bidCount: number;              // 本标总出价次数（auctionBidHistory 按 lotIndex 计数）
  wasAllIn: boolean;             // 成交出价是否全押
}
// SocialSessionState.auctionLotResults?: AuctionLotResult[]
```

**第一幕：奖项揭晓（host 点按逐个翻牌，`IdentityReveal` 模式复用）**

| 奖项 | 判定规则 | 空态规则 |
|---|---|---|
| 今晚最敢花 | 单笔成交价最高者（`max(winningAmount)`） | 全场流拍 → 跳过该奖项 |
| 捡漏王 | 成交价 ≥1 中最低者（`min(winningAmount)`） | 仅 1 人成交 → 仍颁发（文案转为夸眼光） |
| 全场最热 | `bidCount` 最高的标（展示标名 + 次数，不点名个人） | 并列 → 取先出现者 |
| 最稳的手 | 未拍得任何标且剩余币最多者 | 全员都有成交 → 跳过；**文案只夸定力，绝不对比贬低出价者** |

**第二幕：全桌账单**

每人一行：拍到的标（缩略列表）+ 剩余币。这是**局内排行榜**，允许排序（游戏内即时反馈不构成 R5 心理压力——R5 针对的是跨局累积的 高光值）；**不写入任何持久 profile**，会话结束即蒸发。

**`auctionRecapLines` v2**：`close-lot` 维持逐标一行（成交/流拍）；最后一标落槌时追加 ≤3 行奖项总结（如「今晚最敢花：{name}，{amount} 币拿下《{title}》」）。总量仍受 `buildAuctionRecapLines` ≤8 行 × ≤120 字约束——奖项行在超限时**替换**而非追加（优先保奖项，丢早期逐标行）。

**流程**：最后一标落槌 → 全员看到结算入口 → host 点按逐奖项揭晓 → 账单页 → host「进入下一阶段」（`advance` 守卫不变）。参与者视角全程只读 + 鼓掌反应（复用 TapRhythm/表情反应若有现成组件，否则纯观看——**待验证** blaze 是否已有反应组件可复用）。

### D5. 虚拟货币经济调参

| 参数 | 现值 | V2 值 | 理由 |
|---|---|---|---|
| 起始币 | 100（`AUCTION_STARTING_COINS`） | **100 不变** | 100 是好记的整数心智模型；稀缺本身是乐趣（赢不了所有标 → 每笔下注都是取舍）。按 3–5 名出价者 × 100 = 300–500 流通量、4 标的健康清算价 25–60，数值自洽 |
| 标数量 | LLM 3–5 / 兜底恒 3 | **确定性目标：`clamp(可出价人数, 3, 5)`**（可出价人数 = roster − host；host 不能出价）。4 人桌 → 3 标，5–6 人桌 → 4 标 | 「几乎人人能赢一标」是参与感的关键；标的数匹配出价人数而非拍脑袋 |
| 节奏（17 分钟预算） | 无设计 | 生成/介绍 ~1.5 min + 每标 ~3 min（揭晓 20s + 出价 ~2.5 min + 落槌庆祝 20s）× 3–4 标 + 结算 ~1.5 min | 17 分钟来自 blaze run plan（已验证），不快不慢刚好；host-paced 下由 stall nudge 兜底拖沓 |
| 分 vibe 调性 | 无（prompt 只收 eventType + mixText） | `state.vibe` 传入 prompt：深聊 → 标的 = 3，题目偏分享/故事型；均衡 → 4，混合；暢玩 → 4–5，偏表演/整活型 | 深聊桌不该被整活拍品打断气场；暢玩桌嫌纯分享闷 |

**残局保护（防一条龙）**：同一玩家已成交 ≥2 标后，客户端在其出价按钮下加轻提示「你已经有 {n} 件藏品啦」（纯 UI 提示，不阻止出价——不引入硬规则，保持机制简单）。

### D6. LLM 拍品质量

**好拍品的定义（写入 prompt 与人工审校标准）**：① 桌边 1–2 分钟内可完成；② 零道具零准备；③ 低压力、可优雅跳过；④ 全桌都能接话，不只是赢家表演；⑤ 有悬念钩（让人想听答案）；⑥ 不探隐私、不碰酒精/恋爱史/政治/宗教（现有 prompt 规则保留）。

**决策：**
1. **保留 archetype 注入**：`buildArchetypeContext` 的 `mixText` 已在用，继续；新增 `vibe` 入参（D5.4）。promptVersion 升 `social-auction-lots-v3`。
2. **兜底库扩充 3 → 12 条**：分三类（分享型 ×5 / 表演型 ×4 / 共创型 ×3），按 vibe 过滤 + 按 `sessionId` 哈希确定性轮换（同一桌重进看到同一组，不同桌看到不同组）。12 条由内容人工审校后入库，运行时零 LLM 路径不变。
3. **质量门不变**：`moderateGeneratedContent` + `enforceReviewVocab` + AITrace `fallbackUsed` + 指标 `joyjoin_ai_calls_total{outcome="fallback"}`；Wave 5 发布门复用「fallback 率 ≤ 基线 +2pp」。
4. **小修项**：generate-lots 缓存 meta 回退里硬编码的 `'social-auction-lots-v1'` 改为引用 `AUCTION_LOTS_PROMPT_VERSION` 常量（消除版本漂移）。

### D7. 合规与安全（硬约束）

1. **虚拟货币与真实金钱零关联**：币仅是会话内 ephemeral 整数；界面任何位置不出现「充值/购买/兑换/提现/奖金/现金/价值」字样；币单位首次出现处写「虚拟币」，后续可简称「币」（现状已如此，保持）。
2. **赌博词汇黑名单（拍卖域新增，写入 Sprint Contract 的 copy 检查项）**：`赌 / 博彩 / 押注 / 下注 / 赔率 / 庄家 / 赢钱 / 输 / 本金 / 回报 / 梭哈` 一律禁用。
   - **「全押」处置**：已上线词汇，扑克语境但在纯娱乐 + 虚拟币 + 无输赢利益框架下风险低。**保留**，但约束：永不与「赌/注/赢」同屏共现；其徽章文案用「全押」而非「梭哈/All In」。列入 WeChat 审核观察项，若被打回则降级为「全力一击」（预案，不预设切换）。
   - 「拍卖/竞拍/出价/落槌」本身是合法文娱词汇（非赌博语义），保持。
3. **无竞价排名感**：拍品是「体验/分享」而非可估值商品；永不把币与人民币或实物价值做任何类比（如「相当于一杯奶茶」禁止）。
4. **不羞辱币少者**：奖项全部正向框架（D4）；余额低时 UI 提示「攒着币等下一件喜欢的」而非「你没钱了」；流拍文案轻描淡写（现有「流拍（无人出价）」改为「这条先跳过」更轻——**文案微调项**）。
5. **AIGC 角标 fail-closed**：已验证现有实现正确（fallback → `aiGenerated: false`，无角标）。V2 任何新 AI 生成面（奖项总结若引入 LLM——本设计**不引入**，奖项全部确定性计算）必须走同一管线。
6. **机制透明**：🔴「No explaining the machine」——不写「系统为你生成」，生成入口文案维持「生成竞拍条目」（personified 由悦仔语气承担）。

### D8. 无障碍与性能门

1. **Reduced-motion**：CardFlip / ParticleBurst / IdentityReveal 全部检查 `useMiniRevealMotion().shouldReduceMotion`；RM 下拍品直接展示、粒子替换为静态徽章、奖项翻牌替换为淡入。（CardFlip 现有 RM 行为 **待验证**——若无 RM 分支，本 sprint 补上，属验收项。）
2. **Haptics**：所有新震动走 `socialHaptics()` grammar（`icebreakerHapticGrammarEnabled` 门控），不新增裸 `haptics()` 调用；UI 点击反馈维持现有 `medium`。
3. **子包体积**：零新增重资产——复用 `band-auction.webp`、`ParticleBurst`、`IdentityReveal`、`CardFlip`；不引新字体；不引新 Lovart 批次（结算页视觉用纯 CSS + 现有 icon 体系）。`npm run check:package-size -w mini-program` + `verify:subpackage-styles` 必须绿；新增组件 SCSS 按 subpackage 规则 `@use` 进页面 SCSS（防 sub-common.wxss 陷阱）。
4. **轮询压力**：beat 到达触发的「提前刷新」做 1s 防抖，避免互抬高峰轮询风暴；3s 基础轮询节奏不变。
5. **WXSS 安全**：不用 `min()/max()/clamp()`（rpx + 媒体查询）；不用 `hsla()`；shimmer 用 opacity pulse。

---

## 4. 状态与数据契约变更

> 全部为**可选字段追加**（additive），无破坏性变更；旧客户端读到新字段忽略，新客户端读到旧会话按 undefined 降级。

### 4.1 `packages/shared/src/socialIcebreaker.ts`

| 变更 | 内容 |
|---|---|
| `AuctionBidRecord` 追加 | `isAllIn?: boolean` |
| `AuctionHighBid` 追加 | `isAllIn?: boolean` |
| 新 interface | `AuctionLotResult`（字段见 D4） |
| `SocialSessionState` 追加 | `auctionLotResults?: AuctionLotResult[]` |
| 常量追加 | `AUCTION_LOT_COUNT_MIN = 3`（确定性目标标数下限；现有 `AUCTION_MIN_LOTS = 2` 是 LLM payload schema 约束，保持不变以兼容） |

### 4.2 `apps/server/src/lib/socialGroupBeats.ts`

| 变更 | 内容 |
|---|---|
| `SocialGroupBeatKind` 追加 | `'auction_outbid'`（pattern `nudge`）、`'auction_all_in'`（pattern `reveal`）——pattern 词汇表复用，`wsEvents.ts` 零改动 |
| 限流 | 模块级 `Map<sessionId, lastOutbidBeatAt>`，≥5s 间隔；全押 beat 按 `auctionHighBid.isAllIn` 已置位去重 |

### 4.3 路由行为变更（`socialIcebreakerExtended.ts`）

| 路由 | 变更 |
|---|---|
| `auction/generate-lots` | 传 `vibe` 进 `generateAuctionLots`；标数目标 `clamp(bidderCount, 3, 5)`；兜底库 12 条轮换；缓存 meta 版本号引用常量（小修） |
| `auction/bid` | 计算并写入 `isAllIn`；成功后按需发射 `auction_outbid` / `auction_all_in` beat（fire-and-forget，失败不破主流程，复用 `emitSocialGroupBeat` 模式） |
| `auction/close-lot` | 写 `auctionLotResults` 条目；最后一标追加奖项 recap 行（D4）；**幂等性测试是 Sprint Contract 硬性验收项**（重复 close-lot 不产生重复 result） |

### 4.4 新 feature flag

| Flag | 类型 | 缺省 | 作用域 |
|---|---|---|---|
| `auctionV2Enabled` | DB-backed（`featureFlags.ts` 注册） | `false` | 服务端拍卖路由 + 客户端视图统一门控；OFF 时所有 V2 行为（阶梯 UI、isAllIn、lotResults、beats、结算页）完全退回现状 |

> 理由：发布列车铁律「bundled launch ≠ bundled rollback」（roadmap Wave 1.5 flag matrix 要求每个 workstream 独立可杀）。session 级快照：进入 auction 阶段时读一次存入 state（参照 `lieDetectiveMode` / `personalityDiceChooseModeEnabled` 快照模式），阶段中途切 flag 不影响进行中的会话。
>
> `SOCIAL_ICEBREAKER_ENABLE_AUCTION`（env，缺省 false）维持不变，仍是环节总开关。生产环境该 env 当前取值 **待验证**（ops 检查项，影响灰度顺序）。

### 4.5 客户端

| 变更 | 内容 |
|---|---|
| `AuctionHeroView.tsx` | 删自由输入框；三档阶梯按钮（总价文案）；反超 toast 文案 + `socialNudge`；全押徽章 + burst；host 全押提示 |
| 新组件 `AuctionFinaleView`（或 allClosed 分支重构） | 两幕结算（奖项 IdentityReveal 序列 + 全桌账单），host 逐奖项翻牌 |
| `groupBeatModel.ts` | 新 kind 的客户端分发（`parseSocialGroupBeat` 无需改——它只认 pattern；分发逻辑按 pattern 路由即可） |

---

## 5. 埋点与衡量

### 5.1 新增埋点事件（走现有 `/api/analytics/*` 白名单）

| 事件 | 触发 | 关键 metadata |
|---|---|---|
| `auction_bid_placed`（已有，扩 metadata） | 出价成功 | `tier`（steady/jump/all_in）、`amount`、`lotIndex`、`isAllIn` |
| `auction_outbid_notified` | 反超 toast 展示 | `channel`（beat/poll）、`lotIndex` |
| `auction_all_in_fired` | 全押成交出价出现 | `lotIndex`、`amount` |
| `auction_finale_viewed` | 结算页进入 | `lotCount`、`soldCount` |
| `auction_award_revealed` | 每个奖项揭晓 | `award`（biggest_spend/bargain/hottest/steadiest） |

### 5.2 成功指标（Wave 5 发布门复用 + 拍卖专属）

- QA Agent 按 boost rubric 重打 **composite ≥ 8.0**（Interaction、Engagement 两个 3.0 子项是主要提分对象）。
- 拍卖阶段 `dwellTimeMs` ≥ 基线（Wave 0.6 快照）且不退化 >15%。
- 出价参与率：有 ≥1 次出价的玩家占可出价人数比例 ≥ 80%（现状基线未知，Wave 0.6 补采）。
- 每标平均出价次数 ≥ 3（现状未知，目标互抬发生）。
- 全押发生率：≥30% 的拍卖会话出现 ≥1 次全押（高光机制被用到的证据）。
- AITrace `fallbackUsed` 率 ≤ 基线 +2pp。
- 结算页到达率（`auction_finale_viewed` / 进入拍卖会话）≥ 90%——验证 host 没有在落槌前提前跳走。

---

## 6. 风险与回滚

| # | 风险 | 级 | 缓解 |
|---|---|---|---|
| R-A | 并发出价竞态（两人同时出同价/阶梯连点） | L×H | 现有语义已安全（先到先得 + 400 刷新）；Sprint Contract 强制**并发出价测试**（roadmap R3 继承）；余额变更保持在单次 `updateSession` 内 |
| R-B | `auctionV2Enabled` 灰度中出新 bug | M×H | DB flag 单点回滚 <1 分钟；session 快照保证进行中会话不撕裂；OFF = 精确现状行为 |
| R-C | WS beat 风暴（互抬高峰） | L×M | 服务端 5s 限流 + 客户端 nonce 去重 + 6500ms 抑制窗 + haptic busy-guard 四层；beat 失败自动降级轮询（"late, never missing"） |
| R-D | 「全押/拍卖」被 WeChat 审核误读为赌博 | L×H | D7 词汇黑名单 + 虚拟币框架 + 零利益输赢；预案「全力一击」文案热替换（集中 copy 模块） |
| R-E | 奖项文案意外羞辱（最稳的手被读作嘲讽） | M×M | 全部奖项文案走 🔴 规则人工审校 + `user-satisfaction-audit` 过一遍 |
| R-F | 结算页拉长阶段时长超 17 分钟预算 | L×M | 奖项翻牌上限 4 张 + host 可一键「全部揭晓」；stall nudge 既有机制兜底 |

**回滚路径**：`auctionV2Enabled = false`（DB flag，admin 后台 <1 分钟）→ 精确退回 V1 行为；无 schema 变更、无数据迁移，回滚零成本。

---

## 7. 依赖

- `icebreakerGroupBeatsEnabled`（dark）：`auction_outbid` / `auction_all_in` beat 走同一发射管线。若该 flag 继续 dark，拍卖 beat 一并 dark，轮询兜底完整可用——**拍卖 V2 不依赖 beats 开灯**，beats 只是加速通道。
- `icebreakerHapticGrammarEnabled`：震动门控；OFF 时纯视觉，功能完整。
- Wave 0.6 基线快照（@qa-agent）：dwellTimeMs 与出价参与率基线需先于 Wave 5 发布门存在。
- 兜底拍品 12 条内容：需内容人工审校（参照 Lie V2 bank 审校流程）。

---

## 8. Out of scope

- **任何形式的真实价值**：币的充值、购买、跨会话累积、兑换、与权益/优惠券挂钩——永久排除（payment-entitlement-authority 红线）。
- **倒计时/自动落槌**：host-paced canon 不可协商（2026-07-29 ruling）。
- **高光值跨局累积**：属 Wave 4 workstream，本 sprint 只保证 `auctionLotResults` 数据结构可被 Wave 4 直接消费。
- **拍卖进入 breeze/glow 档**：blaze-only 定位不变。
- **新的 Lovart 视觉批次 / 3D / WebGL**：零新重资产（D8.3）。
- **语音出价、表情竞价等花哨交互**：先验证核心循环。
- **skill 文档修正**（`SOCIAL_AUCTION_LLM_ENABLED` 缺省值、`auctionLotStartedAt` 残留）：列入 docs-sync 跟进，不阻塞本 sprint。

---

## 9. 验收标准（供 Sprint Contract 引用）

> 每条都可独立验证。AC-01~09 为功能项，AC-10~14 为 Harness 门。

- **AC-01 阶梯出价**：拍卖出价 UI 不含任何自由输入框；三档按钮展示总价，金额符合 D1 公式；禁用态（余额不足/非最高价可超）正确。
- **AC-02 服务端兼容**：`POST /auction/bid` 仍接受任意合法整数出价（bot/旧客户端路径回归测试通过）。
- **AC-03 反超提醒**：被反超方在 beat 开灯时 ≤1s 收到 toast + `socialNudge`；beat 关灯时 ≤3.5s 轮询兜底收到；同一会话 5s 内多次被反超只震一次（限流验证）。
- **AC-04 全押事件**：全押出价在 state 中携带 `isAllIn: true`；全桌下一轮轮询/beat 后看到徽章 + 单次粒子 + `socialReveal` 震动；全押后余额更多者仍可反超（诚实机制测试）。
- **AC-05 终局结算**：`close-lot` 逐标写 `auctionLotResults`；最后一标后 host 可逐个揭晓 4 奖项（判定规则符合 D4 表格含空态）；账单页展示每人成交 + 余额；**重复调用 `close-lot` 幂等**（不产生重复 result/recap 行）。
- **AC-06 Recap v2**：`auctionRecapLines` ≤8 行 × ≤120 字，含 ≤3 行奖项总结；recap LLM prompt 消费不报错。
- **AC-07 经济参数**：起始币 100；标数 = `clamp(可出价人数, 3, 5)`；vibe 传入 prompt 且 promptVersion = `social-auction-lots-v3`；兜底库 12 条按 sessionId 哈希确定性轮换。
- **AC-08 Flag 行为**：`auctionV2Enabled=false` 时全部 V2 行为精确退回现状（阶梯/徽章/结算页/beats/lotResults 均不出现）；session 进入拍卖阶段时快照，阶段内切 flag 不影响进行中会话。
- **AC-09 埋点**：§5.1 五个事件进入白名单并可被 `discover_analytics_events` 查询。
- **AC-10 并发测试**：两客户端同时对同标出价，一笔成功一笔 400，余额与托管退回无丢失（总币数守恒断言：Σ余额 + Σ成交价 = Σ起始币）。
- **AC-11 无障碍**：reduced-motion 下 CardFlip/粒子/IdentityReveal 全部静态降级；新震动全部走 `socialHaptics()` 且受 flag 门控。
- **AC-12 包体积与样式门**：`check:package-size` 与 `verify:subpackage-styles` 绿；无 sub-common.wxss 回归；无新 CDN/本地重资产。
- **AC-13 文案合规**：全量新文案过 🔴 Hard Rules + D7 黑名单扫描；无 raw emoji 进主文案（guardrails）；AIGC 角标 fail-closed 复验（fallback 拍品无角标）。
- **AC-14 评分门**：QA Agent 按 boost rubric 重打 composite ≥ 8.0 并出具逐项分数。

---

## 10. 待验证清单（Contract 起草前需关闭或转为假设）

| # | 项 | 负责人建议 |
|---|---|---|
| V-1 | `CardFlip` 是否已有 reduced-motion 分支 | @taro-engineer 读码确认；无则 AC-11 包含补分支 |
| V-2 | 生产环境 `SOCIAL_ICEBREAKER_ENABLE_AUCTION` 当前取值（影响灰度顺序与「flag 缺省 OFF」验收表述） | ops / @backend-engineer 查 GitHub vars |
| V-3 | `listParticipants` 返回的 roster 是否包含 host（影响 D5 标数公式中「−1」的准确性） | @backend-engineer 读码确认；公式以「可出价人数 = 实际能点出价按钮的人数」为准 |
| V-4 | blaze 阶段是否已有可复用的表情/TapRhythm 反应组件（D4 参与者鼓掌反应） | @taro-engineer；无则结算页参与者纯观看 |
| V-5 | 拍卖出价参与率与每标出价次数现状基线（§5.2 需要） | @qa-agent 并入 Wave 0.6 快照 |
