# PRD: 小队揭晓（Squad Unboxing）精致度与探索欲重做

- **日期**: 2026-10-14
- **状态**: Approved（用户已批准执行）
- **来源**: 三方专家评审（UIUX 设计 / PM / 商业化）合并产出
- **影响面**: `apps/mini-program/src/pages/squad-unboxing/*`（小程序单端；服务端零改动，仅复用既有基建）
- **Harness 分级**: Tier 2（多文件、用户核心仪式面、状态机敏感）

---

## 1. Problem Statement

小队揭晓是 ¥88 付费承诺的「收货时刻」，但当前页面存在两个 Class A 渲染缺陷（文案腰斩、聚焦卡切顶），且四个已设计的功能（背卡化学 tier 描边、慢翻、长按预翻、契合点光迹）因 CSS 缺失而静默死亡——5 张紫色背卡视觉上完全相同，用户付费后最需要回答的「这 ¥88 给我排到了什么？」在首屏零证据。结果是：探索欲不足、页面读作未完成、分享与回报资产闲置。

## 2. Target Users and Scenario

- **Who:** 已完成支付且排桌成功的用户（首单 ¥68 实付的新客占比最高）
- **When:** 收到「排桌完成」通知后首次进入本页（活动前 1–3 天），情绪任务 = 求证值回票价 → 期待今晚 → 确认出席 → 分享/回流
- **Current workaround:** 无。用户只能在一堆相同紫背上盲点，或一键全翻跳过全部仪式

## 3. Goals and Non-Goals

**Goals:**
1. 消除全部 Class A/B 渲染缺陷（bubble 腰斩、聚焦卡切顶、双重 padding、徽章压头像、vignette 贴纸感、错误态 hero 无尺寸）
2. 复活四个死 CSS 功能，让每张背卡在 spoiler-safe 前提下可区分（化学 tier、原型色相、rarity、收藏编号）
3. 叙事从「说明书」升级为「预告片」：tease 文案预支桌级证据（桌型诊断/金卡/进度池），fail-closed
4. 今晚这桌 panel 把「人」带回「场合」（who's-coming 摘要行、highlights 解耦）
5. 传播与回报资产化：海报嵌小程序码、分享氛围图、INVITE_REWARD 到账可见、埋点补齐

**Non-Goals:**
- 不改翻牌交互语义（点按=翻牌、长按=同一节拍）；「长按偷看」实验项明确放弃
- 不动匹配引擎、`viewerPairByMemberId` 数据形状、服务端路由
- 单场局票用户本页零购买元素；不做任何向上销售按钮
- 订阅消息文案不动（纯服务性）
- 不做剪影/局部身份揭示（需产品签批，v2 备选）
- 「⋯」左缘异物：代码侧无证据，不盲改；DevTools 定性后另立项

## 4. User Stories / Primary Flows

- 作为新客，我希望翻开第一张卡之前就能感到「这桌是为我排的」，这样我才愿意一张张翻而不是一键跳过
- 作为用户，我希望 5 张背卡看起来是 5 个不同的人（温度/色相/稀有度），这样「先翻哪张」本身是个决策
- 作为用户，当金背卡存在时，我希望被明确告知「有一张和你最合拍」，这样我会留到最后或第一个翻它
- 作为用户，我希望在今晚这桌 panel 一眼看到「6 位同桌 · 25–34 岁 · 暖意融融的一桌」，这样场合信息变成邀约
- 作为邀请人，我希望确认出席后看到「¥50 邀请奖励券已放进卡包」，这样我知道回报已到账
- 作为分享者，我希望保存的桌卡海报带小程序码，这样朋友扫码即达（纯归因，零奖励承诺）

## 5. Acceptance Criteria

### A. 止血（渲染缺陷）

- [ ] A1 `tease`/`burst`/`soul`/`member` 四态气泡在 SE/标准/Plus 三机型完整显示，无腰斩；桌型诊断行仅在 `deckPhase !== 'fan'` 时渲染
- [ ] A2 顶行任意卡聚焦时整卡（含徽章行）在视口内完整可见（三机型）
- [ ] A3 五张背卡在静止态肉眼可区分：化学 tier 描边色随 `getPairChemistryTier` 分档（fire/warm/mild/cold），无 pair 数据的卡回退中性
- [ ] A4 最佳拍档翻牌时内层 rotateY 过渡为 0.6× 慢速；长按扣置卡出现 +8° 倾斜 + 箔光；翻牌时契合点光迹从卡位落向气泡（全部 RM/降级档禁用）
- [ ] A5 revealed 内容列与扇的左右边线对齐（统一 40rpx 列宽，无双倍 padding）

### B. 背卡探索欲（spoiler-safe）

- [ ] B6 背卡 top-left 显示化学 tier 图标（JoyJoinIcon，金背卡保持金箔不叠加）
- [ ] B7 背卡 lattice 顶部径向光混入该成员 archetype 色相（0.10–0.14 alpha）；扣置态边框存在感提升
- [ ] B8 背卡底部显示收藏编号「No.02/06」；逐卡 lattice 相位差（纯 CSS nth-child）
- [ ] B9 rarity=rare/epic 的背卡箔纹密度/光泽分档
- [ ] B10 「我」卡徽章行不压头像（下移缩小），并纳入 48rpx safe-inset 规则（N=7/8 不被邻卡遮）

### C. 叙事升级（全部文案单点维护于 `squadUnboxingViewModels.ts`）

- [ ] C11 静止态 tease 优先输出桌型诊断悬念句（`buildTableDiagnosis` 非空时），否则回退现文案；无诊断、无混编时永不渲染空句
- [ ] C12 `bestPartnerUserId` 存在且未翻时，金卡认领句进入轮播且优先级最高
- [ ] C13 `unflippedCount` 4→1 进度文案池；RM/降级档只出首句
- [ ] C14 rarity='rare' 的连接点 evidence 加「全桌少见：」前缀
- [ ] C-合规 全部新文案零禁用词（匹配/社交/撮合/AI/灵魂），感叹号克制，AIGC 角标规则不新增

### D. 今晚这桌 panel

- [ ] D15 brief-header 下新增 who's-coming 摘要行「N 位同桌 · 年龄带 · 化学词的一桌」；年龄带解析失败静默省略
- [ ] D16 `groupThemeHighlights` 与主题三元组解耦渲染；`groupThemeTags[0]` 存在时显示「今晚从{tag}聊起」
- [ ] D17 全翻前 panel 上方显示桌卡预告一行；return thread 改为「活动结束后，悦仔会把这桌的故事收进回忆卡」

### E. 传播 / 回报 / 度量

- [ ] E18 桌卡海报右下角嵌小程序码（复用 `wechatShareQrCode` + `shareQrScene` 基建，scene 带分享者推荐码纯归因）；原生分享补 5:4 氛围图（化学词 + 桌型诊断 + 日期，无人名头像）
- [ ] E19 成功遮罩上，若本用户本池存在 `source='invitation_reward'` 的 ¥50 券，显示到账确认行（无则零占位）；卡包/月卡用户确认成功后显示余额回显「还剩 N 场 · 去挑下一场」（单场用户不可见）
- [ ] E20 `squad_unboxing_card_flip` 埋点附 `msSinceDealSettled` + `teaseVariant`；新增 `squad_unboxing_whos_coming_view` 曝光事件（走 server 白名单 + 路由测试既有流程）

### 横切验收

- [ ] X1 `npm run typecheck -w mini-program` / `npm run guardrails` / `npm run test -w mini-program` 全绿
- [ ] X2 新增动态类名全部改为静态查找表（Record 字面量），杜绝模板字符串拼类名；`check-class-coverage` 无新增孤儿
- [ ] X3 `npm run build:weapp -w mini-program && npm run verify:subpackage-styles -w mini-program` 通过
- [ ] X4 RM / degradation 档全部新动效有静态等价
- [ ] X5 WeChat DevTools 三机型（SE/标准/Plus）目检：fan/pocketed/全翻/聚焦四态无遮挡

## 6. Constraints, Risks, Dependencies, Open Questions

| Type | Item | Mitigation |
|------|------|-----------|
| Constraint | revealed 态视口硬锁（`disableScroll` + `scrollY=false`），内容列预算 ~513–563rpx | 诊断行让位 + 双 padding 删除回收 ~80rpx |
| Constraint | 微信审核：禁用词清单 + AIGC 角标 fail-closed | 文案过 `wechat-review-submission.md` 前置扫描 |
| Constraint | 微信利益诱导红线：分享不得绑定奖励 | 海报二维码纯归因，零奖励文案 |
| Risk | 背卡信息量上升导致「翻牌动机」下降 | tease 只给 tier/色相不给身份；北极星指标监控逐张翻牌率 |
| Risk | 海报二维码生成耗时阻塞保存 | 复用既有基建；失败时海报照常保存（码位留白），`table_card_save_failed` 已埋点 |
| Dependency | E19 依赖客户端可查邀请奖励券（`pages/profile-linked/rewards` 通路） | 执行时先验证；不存在则降级为「去卡包看看」通用行或砍掉 |
| Dependency | E18 依赖 `apps/server/src/lib/wechatShareQrCode.ts` 可用 | 执行时先验证；不可用则 E18 降级为仅分享氛围图 |
| Open Question | 「⋯」左缘异物来源 | DevTools Wxml 点选定性后另立项 |

## 7. Scope Boundaries

**In scope:** 小程序 squad-unboxing 页全部视图层、文案层、埋点层；海报 canvas；成功遮罩文案行
**Out of scope (v2+):** 长按偷看、剪影提示、服务端新路由（除白名单加事件）、admin 配置面、T+1 回顾页本身

## 8. Success Metrics

| Metric | Unit | Target | Window |
|--------|------|--------|--------|
| 首翻时延中位数（deal settled → 首次 card_flip） | s | ≤ 5 | 上线后 2 周 |
| 一张未翻即全翻占比（reveal_all_tap remainingCount=5） | % | ≤ 25 | 2 周 |
| 逐张翻牌率（flippedByTap / (tap+revealAll)） | % | ≥ 60 | 2 周 |
| 「有探索的确认」（≥4 张逐张翻且 confirm 成功） | % | 建基线，环比 ↑ | 4 周 |
| 海报保存率 / 分享率 | % | 建基线，环比 ↑ | 4 周 |

未达标回滚：tease 文案池回退现句（单点常量切换），背卡视觉层保留（纯增益）。

## 9. Engineering Impact Areas

- **视图层**: `squad-unboxing/index.tsx`、`index.scss`、`TeammateCard.tsx`、`SquadUnboxingAnalysisBubble.tsx`、`SquadUnboxingTonightsPanel.tsx`、`SquadUnboxingSuccessOverlay.tsx`、`squadTableCardPoster.ts`、`squadUnboxingViewModels.ts`
- **埋点**: `lib/analytics/squadUnboxingAnalytics.ts` + server 白名单（`discoverAnalyticsAllowlistContract.test.ts` 既有流程）
- **复用基建（先验证）**: `apps/server/src/lib/wechatShareQrCode.ts`、`lib/referral/shareQrScene.ts`、rewards 查询通路
- **服务端改动**: 仅分析事件白名单（若需要），零路由零 schema

## Rollout

- 视觉层（A/B/D）不需要 flag——纯修复与增强；叙事层（C）走 `squadUnboxingTeaseV2Enabled` DB flag（默认 ON，可秒回滚现句）；E19 奖励可见化走既有券查询，无新 flag
- 回滚：flag 关闭 + revert 单 PR

---

## 执行记录 (2026-10-14)

**状态: 已实现（待 DevTools 真机目检 + 灰度观察）。**

### 验收对照

| 项 | 状态 | 落地 |
|----|------|------|
| A1 bubble 腰斩 | ✅ | `showDiagnosis={deckPhase !== 'fan'}`（与桌卡/transition 同闸） |
| A2 聚焦卡切顶 | ✅ | fan 0.84 / deck 位移 −8rpx / stage clamp 460·46dvh / 首行 lift −12·1.07 |
| A3 背卡 tier 描边 | ✅ | `BACK_TIER_CLASS` 静态表 + 4 条 SCSS；baseline 修正 |
| A4 死 CSS 复活 | ✅ | slow-flip 0.57s / anticipating +3° 阶梯 / flip-trail 0.56s（全部 RM 清单内） |
| A5 双 padding | ✅ | `--scroll-content--revealed` 横向 padding 删除 |
| B6–B10 | ✅ | tier 图标 / 色相耳语 / 编号+格纹相位 / rarity 箔光 / 徽章压缩+covered-band 上限 |
| C11–C14 | ✅ | `buildSquadTease` 文案池 + flag `squadUnboxingTeaseV2Enabled`（默认 ON）+ rarity 前缀 |
| D15–D17 | ✅ | whos-coming 行 / highlights 解耦 + 开场钩子 / 桌卡预告 + 回忆卡 return thread |
| E18 | ⚠️ 部分 | 海报嵌小程序码 ✅（fail-open）；分享 5:4 氛围图 **deferred**（分享时异步 canvas 风险大于收益，见下） |
| E19 | ✅（降级） | 邀请奖励到账行（≤72h available 券，跳 rewards）；权益回显行 **无场次计数**（客户端无计数端点，按 PRD 依赖条款降级） |
| E20 | ✅ | `msSinceDealSettled` + `teaseVariant` 随拨卡事件；`squad_unboxing_whos_coming_view` 白名单+路由测试 |

### 验证证据

- `npm run test -w mini-program`：281 files / 2724 tests 全绿
- `npm run test -w @joyjoin/server`：341 files / 3942 tests 全绿
- `npm run typecheck`（四工作区）全绿
- `npm run guardrails`：PASS（class-coverage baseline 收缩 4 条——四个复活类从孤儿清单移除）
- `npm run build:weapp -w mini-program` + `npm run verify:subpackage-styles`：PASS

### 偏差与遗留

1. **E18 分享氛围图 deferred**：`useShareAppMessage` 的异步 promise 图在各基础库版本行为不一致，分享时现画 canvas 有白屏分享风险；海报二维码已覆盖核心获客路径，v2 再做。
2. **E19 场次计数不可得**：客户端无权益计数端点（仅 `entitlementMode`），回显行不含「还剩 N 场」。
3. **SE 级机型聚焦顶部卡残留 ≤16rpx 角部裁切**（徽章行不受影响）——DevTools 三机型目检项，若不接受可再收 stage 或彻底去掉首行 translateY。
4. **未做**：长按偷看（PRD 明确放弃）、剪影提示、服务端计数端点。

### 需人工完成的门

- WeChat DevTools 三机型（SE / 标准 / Plus）四态目检（fan / pocketed / 全翻 / 聚焦）——自动化无法覆盖遮挡类缺陷。
- 灰度观察 2 周：首翻时延中位 ≤5s、`reveal_all_tap.remainingCount=5` 占比 ≤25%、逐张翻牌率 ≥60%。

### 加固补充 (2026-10-14 收尾)

- **隐私对齐**：`buildWhosComingLine` 排除 `ageVisible === false` 成员——隐藏年龄不得影响全桌年龄带聚合（测试锁定）
- **E19 抽取**：`useInviteRewardLines.ts` + 纯函数 `inviteReward.ts`（含单元测试 `inviteReward.test.ts`）；index.tsx 1294→1259 行，远离 1800 fail 线
- **回归锁**：控制器 tease 接线 source 测试；TeammateCard 背卡探索层 emission+SCSS 双断言（防 2026-07-24 类「TSX 有、CSS 无」事故复发）
- **频道文档**：`docs/systems/squad-unboxing-analytics-funnels.md` 增补 whos_coming_view / msSinceDealSettled / teaseVariant / 探索 KPI 定义；`squadUnboxingAnalytics.ts` NOTE
- **Harness gate**：CONCERN（全体 diff 含用户 WIP；本页归属项仅 index.tsx 行数 warn〔1259，fail 线 1800〕，其余 finding 均为 WIP 既有）
- 终态验证：mini-program 283 files / 2742 tests 全绿；typecheck 绿；build + verify:subpackage-styles PASS

---

## 视觉验证与二次修复 (2026-10-15)

**触发**：用户要求「visualise and validate yourself」。使用仓库既有 H5 + Playwright 台架（`mock-h5-server` :5001 + `screenshot-server` :9000）对 fan / 聚焦 / 全翻 / 收纳四态做像素级 + DOM 级验证（390×844，另测 375×667）。

### 验证结论：已修项实测通过

| 项 | 实测证据 |
|----|----------|
| P0-3 背卡差异化 | ✅ 五张扣置背面不再相同：tier 徽记（🔥 No.02/03、✨ No.04/05）+ 金框 best-partner（No.06）+ 每张 `No.0X/06` 编号 + 格纹/色相差异（截图确认） |
| P0-2 聚焦卡切顶 | ✅ 顶行卡聚焦后卡顶 = 舞台顶 + 15px（修复前预测 −29rpx）；截图圆角与金印完整 |
| A1 诊断行 | ✅ fan 态不渲染；pocketed 全量渲染且无裁切 |
| C12/C13/D16/D17/D19 | ✅ 金卡未翻句、进度句、开场钩子、桌卡预告、「全桌少见：」前缀均按预期渲染 |
| 曾疑「左侧 `（` 异物」 | ⏹ 非缺陷：是 `ConnectionPointPill` 的 `border-left: 4rpx` rarity 描边在小尺寸下的月牙观感（DOM 文本为纯「内向细腻」） |

### 新发现缺陷（线上可见，已修）

1. **气泡文案从未被真正裁剪（跨平台空操作）**：`<Text numberOfLines>` 在 Taro 中仅标注 `@supported alipay`（微信原生为 `overflow`/`maxLines`；H5 把该 prop 透传为惰性属性），页面 SCSS 也无任何 `-webkit-line-clamp` ⇒ 2026-08-19 的「4→3 行 clamp」在双端都是空操作。实测：全翻 fan 态灵魂段落 5 行 116.5px 被硬切在半句（无省略号）；聚焦态尾行（开场白）被切 20px。
   **修复**：`&__analysis-bubble-text` / `&__narrative-verdict` 改为真正的 `display: -webkit-box` + `-webkit-line-clamp`（5 / 3 行）；`TypewriterText` 同时下发微信原生 `maxLines` + `overflow='ellipsis'` 保持双端一致。
2. **fan 列容不下「全翻」内容**：fan 内容列实测 407px（舞台 332.8 + 底栏预留 104），而全翻态「段落 + 面板」392px、面板 402px ⇒ 面板尾部（底部 padding 与圆角）压到固定 dock 之下（dock 顶 710.9 < 面板底 730.8）；D17 桌卡预告与回忆卡 return thread 实测 top 819.7，完全不可见。
   **修复（沿用 2026-08-19「放不进扇内列的内容在收纳后首演」惯例）**：① 主题行（145.6px）闸到 `deckPhase !== 'fan'`；② return thread 同闸；③ 全翻 fan 态语音改为短句 `SQUAD_BURST_COMPLETION_BUBBLE_TEXT`，灵魂段落（章节二）在收纳后的宽松列首演；④ 收纳后清除 burst 旁白，避免其永久盖住灵魂段落；⑤ 底栏预留 184 → **244rpx**（实测最高 dock = 256rpx）。
3. **北星路径（逐张翻牌）永远无法收纳**：`squadAutoPocket` 的 `focusedIndex < 0` 手臂条件与「焦点即永久取消」使逐张探索者永远留在 fan 列，而 `collapseDeck` 虽已实现却无任何 UI 消费 ⇒ 该路径看不到主题行、桌卡、return thread。
   **修复**：全翻且自动收纳未 armed 时，在既有 chip 位渲染「收起卡组 · 查看今晚这桌」（复用 `collapseDeck`，含 haptics / 埋点 / 首次收纳提示）；控制器新增 `autoFoldPending` 镜像，避免 reveal-all 路径闪现。

### 修复后实测（390×844，全部 clip = 0）

| 态 | 气泡 | 面板 | 主题行 | 预告 | chip |
|----|------|------|--------|------|------|
| tease | 66.5 @375.3 | 247.3 @450.2→697.5 | — | — | 还有 N 位未揭晓 |
| 全翻 fan | 133.1 @342 | 247.3 → **≤710.9** | — | — | 收起卡组 · 查看今晚这桌 |
| 聚焦 | 100.3 @358.4 | 247.3 → 714.4 | — | — | 同上 |
| 收纳 | 85.7 @143.5 | 402.2 @271.3→673.5 | 145.6 ✓ | 17.2 ✓ | 卡组 pill |

> SE 级（375×667）仍超预算：内容列仅 ~260px，而内容栈 ~350px（舞台 306.8 + dock 128 + 内容）——既有结构限制。按 `performance-audit` 机型口径（Gen Z 8GB+ 为主力档）列为已知限制，本轮未扩大范围。

### 仍需人工完成

- WeChat DevTools 三机型（SE / 标准 / Plus）四态目检——本轮验收基于 H5 渲染（几何与文案一致，真机 WXSS 行为需目视确认）。
- E18 海报二维码 canvas 端到端（本轮未触发保存流程，fail-open 降级路径未验）。
- 灰度 2 周指标：首翻时延中位 ≤5s、`reveal_all_tap.remainingCount=5` 占比 ≤25%、逐张翻牌率 ≥60%。

### 二次修复：扇态/收纳态预算（2026-10-15，H5 实测驱动）

第一轮修复后重新实测暴露了三个结构问题，均已修复并复测（390×844 四态全绿；375×667 仍为已知机型限制）。

1. **死 clamp 的真根因**：Taro `<Text numberOfLines>` 是 **alipay-only** 属性（WeChat 原生对应 `maxLines`，H5 直接展开为无效属性），所以 2026-08-19「4→3 行 clamp」在两端都是空操作——长文案被父级 `overflow: hidden` 从中截断。现改为真实 CSS clamp（`__analysis-bubble-text` = 4 行、`__narrative-verdict` = 3 行，`display: -webkit-box` + `-webkit-box-orient: vertical`），尾行以 `…` 收束；`numberOfLines` 仅保留为 alipay 兼容。
2. **收纳态（folded）预算超支**：折叠后内容栈（灵魂段落 156 + 过渡线 19 + 桌卡 73 + 面板 402 + 间距）超出锁定列约 20px，牺牲品是主题行底部与气泡末行。三处机械回收：`__table-transition` 的 `margin: $spacing-md 0 $spacing-sm` 与父级 `gap` 叠加（双重间距）→ `margin: 0`（−25px）；收纳态 dock 只有返回行 + CTA（实测 91px）→ 新增 `__scroll-inner--pocketed`，把 reserve 从扇态 244rpx 收到 160rpx；灵魂段落 clamp 收到 4 行（仅三腿极值文案会出现 `…`）。
3. **扇态 vs 收纳态的声音分层**：折叠后才出现的反思段落由收纳态独享；扇态全翻保持短句 `SQUAD_BURST_COMPLETION_BUBBLE_TEXT`（同时充当折叠邀请）。首次折叠的 3.6s 提示会把舞台 spacer 撑高 ~50px，这段时间同样保持短句（`showPocketHint`），提示消失后再让反思段落打字机出场。

**结论**：390×844 四态（tease / 全翻 fan / 聚焦 / 收纳）实测 `clip: 0`；主题行仅收纳态出现且完整；面板 `scrollHeight == clientHeight`；收纳态面板底边 752 ≤ dock 顶 753。
