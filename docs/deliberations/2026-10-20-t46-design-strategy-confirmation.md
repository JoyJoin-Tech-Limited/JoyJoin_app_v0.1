# T46 终局策略 — 设计策略与框架确认

> 2026-10-20 · 资深 UIUX 设计专家确认稿。输入：`2026-10-20-t46-final-strategy.md`（冻结版行动清单）。
> 纪律：不推翻产品策略；发现问题标 ⚠ 并给设计侧解法。所有规格落到真实文件/组件路径。

---

## 1. 设计策略总确认

**裁决：✅ 方向确认——「信任资产陈列」与 JoyJoin 设计语言同构，可全部用现有组件语汇落地，无需新设计语言。**

理由：T46 的五件 UI 交付物本质都是「把已存在的事实（退款承诺、排桌流程、支付闭环、Duo 链路、真实场次）用页面内常驻、安静、事实性的语言摆出来」——这正是 JoyJoin 既有的「安静事实层」register（参照 `ticket-trust-row`「微信支付 · 安全加密」、`RefundGuaranteeLine`、`event-detail__support-card` 客服卡）。策略没有要求任何 blocking overlay、弹窗、倒计时、 urgency 色，与 PM 底线 #4（零新增 blocking overlay）和品牌「warm, minimal, breathable, no corporate/flashy」完全对齐。唯一需要设计侧看守的是：五件交付物全部落在「信任敏感面」（收银台/详情页/登录墙），文案 register 必须锁 System UI（暖中性、零语气词），不能让悦仔闺蜜腔渗进钱和承诺的语境。

**范围外确认：** Discover arrival coachmark 维持现状不扩容（策略冲突 #3 已裁决）——`components/guidance/GuidanceTipCard.tsx` + `lib/guidance/registry.ts` 体系不动，本清单不向其追加任何内容。

---

## 2. 逐交付物设计规格

### P0c — 详情页「怎么参加」4 拍流程条（订座→悦仔排桌→集结房间等开席→现场入座）

- **推荐组件/模式：** 新建 `EventFlowStrip` 静态组件，落 `apps/mini-program/src/components/event-detail/EventFlowStrip.tsx`（与页面同域，参考 `IcebreakerInclusionSheet` 的同域组件先例 `components/event-ticket-payment/`）。**不要**复用 `PoolRegistrationStepper`/`StepPill`——那是向导进度语义（active/complete 态），P0c 是「期望值陈列」不是进度；语义用 `role='list'` + `aria-label='参加流程'`，4 个等宽节点 + 节点间连接线段，首节点（订座）可用 `$color-primary` 轻描边标记「下一步」，其余节点 muted。**不**复用 `GuidanceTipCard`（coachmark 是一次性提示，流程条是常驻内容）。
- **插入位置：** `pages/event-detail/index.tsx` 的 ScrollView 内，信息卡（`event-detail__card`，index.tsx:185-228）与活动介绍卡之间——用户读完时间地点人数后立即回答「然后呢」。作为一张新 `event-detail__card` 变体（`event-detail__flow-card`），继承卡片圆角/留白 token。
- **布局与节奏：** 8rpx 节奏。节点 = 纵向 flex（图标 48rpx 在上、标签 2 行以内居中在下），节点间距 8rpx 的倍数，连接线 1rpx hairline（4rpx 例外需注释）。卡片内边距对齐现有 `event-detail__card`。**zero-scroll 不适用也不冲突**：event-detail 已是文档化滚动例外页（index.tsx:172-175 注释），内容在既有 ScrollView 内纵向增长即可，禁止新增第二个 scroll port。
- **品牌 token：** 图标描边/首节点用 `$color-primary`（#8B5CF6 纯色，禁渐变）；其余节点 `$color-text-secondary`；标签 `$font-ui`、`$font-size-sm`；卡片底色 `$color-surface`。**一页一吉祥物红线**：本页已有 `xiaoyue-event-detail-tip.webp`（index.tsx:235），流程条零吉祥物、零插画。
- **图标红线：** 4 个节点图标优先复用 `src/assets/icons/ui/` 既有 bundled glyph（`localAsset()` Image，GuidanceTipCard 同款模式，避免 JoyJoinIcon CDN-primary 在冷启动闪 emoji fallback）。若必须新增 (tier, assetKey) 映射：webp + `cdn-asset-manifest.json` 条目必须同 PR 落地（2026-10-15 教训：`check-cdn-icon-coverage.mjs` 门禁）。
- **文案红线：** 四个标签已全部是 canonical 术语（订座/排桌/集结房间/入座 ✅，术语表 §3）。条上标题建议「怎么参加」或「这四步，悦仔陪你走」——后者是悦仔腔，放信任敏感页偏暖可接受，但条内禁出现 匹配/社交/AI/算法（🔴），禁任何数字（除非 live query）。
- **微信工程陷阱：** ① 禁内联 emoji（guardrails 硬性）；② 所有新 BEM 类（`event-detail__flow-*`）必须同 PR 有 SCSS 定义（`check-class-coverage.mjs`）；③ 图标+标签混排用 flex column + `align-items: center`，禁 baseline 对齐（L2 陷阱）；④ CJK 标签禁 `overflow-wrap: anywhere`（孤字）；⑤ event-detail 在主包，无 subpackage WXSS 陷阱，但组件 SCSS 建议仍 `@use` 进 `pages/event-detail/index.scss`（与 GuidanceTipCard 惯例一致）。

### P0d — 收银台退款理由叙事（「这一桌已经写上你的名字」）

- **推荐组件/模式：** 扩展既有 `pages/payments/event-ticket-payment/components/RefundGuaranteeLine.tsx`，**不新建组件**。⚠ 设计侧解法（不推翻策略）：叙事句**不替换**事实句「排桌完成前取消，全额退款」——承诺类文案的永久教训是「说的必须是服务端正在做的」，叙事句是修辞层，事实句是承诺层，两者叠放：`.ticket-refund-guarantee` 变为两行 caption stack（叙事行在上、事实行在下），或叙事行上移进 `ticket-trust-row__line` 槽位（现「有悦仔在，这场局会好好办」index.tsx:1366 的 A/B 变体）。推荐前者（改动最小，灰度边界清晰）。
- **布局与节奏：** 沿用 `.ticket-refund-guarantee`（index.scss:1115-1126）：`$font-size-xs`、`$ticket-text-muted`、`line-height 1.5`、行间距 4rpx（hairline 级微调需注释）。footer 增高一行 → **必须**扩展既有 `ticket-bottom-spacer--with-guarantee` 机制（index.tsx:1390），spacer 增高量与 footer 实际增高逐像素对齐。zero-scroll 硬性约束：**短机（667px 级）上 CTA 不得被顶出首屏**——WeChat DevTools 667px 视口验证是 merge 前置条件。
- **品牌 token：** 与 trust row 同 register 的 muted caption，无图标、无吉祥物、无 accent 色——安静是设计本体。
- **文案红线：** Tone Mode = System UI（信任敏感，零语气词，`~`/`啦`/`哦` 全禁，§4 金律）。「这一桌已经写上你的名字」用了「这一桌」——canonical ✅。**🔴 前置依赖不可绕过**：P0a（`preRevealRefundEnabled` 真实退款行为）未灰度生效前，本行不得渲染（PM 底线 #3）；灰度 50/50 期间 flag-off 桶必须 fail-closed 回落到现状单行（`visible=false` 时 null tree 的既有契约不可破坏）。灰度护栏 `checkout_cancel_rate` 打点挂在行曝光上（曝光一次打一次，去重 per page visit，参照 `feedbackEntryTrackedRef` 模式 index.tsx:78-84）。
- **微信工程陷阱：** ① payments 是**子包**（`MINI_PROGRAM_PAYMENTS_SUBPACKAGE_ROOT`）——若拆出任何新组件 SCSS，必须 `@use` 进 `pages/payments/event-ticket-payment/index.scss`，并在 `scripts/verify-subpackage-styles.mjs` 登记新选择器，跑 `npm run build:weapp -w mini-program && npm run verify:subpackage-styles -w mini-program`；② footer 内若出现任何 disabled 态按钮，记住平台 disabled 色会盖掉自定义色（2026-10-16 教训），需祖先选择器复断言；③ 灰度桶切换不得引起布局跳动——两桶的行高差必须在渲染前确定（CSS 预留而非 JS 测量后补）。

### P0e — FAQ 手风琴（6-8 条，含「平台支付闭环，真人到场核销」）

- **推荐组件/模式：** 新建 `EventFaqAccordion`，落 `apps/mini-program/src/components/event-detail/EventFaqAccordion.tsx`。仓库无现成手风琴（grep 确认 accordion/collapse 无通用组件）——`IcebreakerInclusionSheet` 是 bottom sheet 不是手风琴，`DeckCollapsePill` 是牌组专用，均不复用。文案集中放新 copy 模块 `packages/shared/src/copy/eventFaqCopy.ts`（**不走 barrel**，参照 `poolTeaserCopy.ts` 先例：独立模块直接 import），受 copy/ CODEOWNERS 双签（PM+eng lead）约束。
- **插入位置：** 紧跟 P0c 流程条之后（同一 ScrollView 流内），形成「怎么参加 → 常见问题 → 客服卡」的信任递进。作为 `event-detail__card` 变体（`event-detail__faq-card`）。
- **布局与节奏：** 每条 Q 是一行可点区（touch target ≥88rpx 高，`hoverClass` 淡色 tint + `haptics('light')`），Q 行 = 标题 + 右侧 chevron（CSS 绘制或 ui glyph，禁 emoji ▾）。展开态：答案块 `padding 16rpx 0 24rpx`，`$font-size-sm`、`$color-text-secondary`、`line-height ≥1.6`（空态排版标准）。一次只开一条（手风琴语义，`aria-expanded` 切换）。zero-scroll：与 P0c 同，页内常驻滚动流，无新政策冲突。
- **品牌 token：** Q 标题 `$font-ui` medium `$color-text-primary`；答案 `$color-text-secondary`；分隔线 `rgba($color-text-primary, 0.06)` hairline；chevron 旋转用 `transform` 200ms `cubic-bezier(0.22,1,0.36,1)`。零吉祥物（本页配额已用）。
- **文案红线：** 全 6-8 条过 🔴🟠 审：禁 匹配/社交/灵魂/AI/算法/智能；「真人到场核销」「平台支付闭环」属事实陈述可用，但禁止派生「平台担保」「官方认证」等越界承诺；任何涉及人数的答案只写 live query 数字或不写数字。🟡 waiver 预告：FAQ 答案必然超过「描述 ≤25 字」指引——按解释性内容处理，目标 ≤60 字/条，在 `exceptions.ts` 或 PR 描述中登记 waiver。
- **微信工程陷阱：** ① **禁 height 动画**（WXSS height auto 过渡在 WeChat 必 jank + 触发 layout）——答案块用条件渲染 + 200ms `opacity`/`translateY(8rpx)` 入场（`--open` modifier），chevron 只转 `transform`；② 答案区若有 JS 计算定位，inline style 只发 px 不发 rpx；③ `--open` 等动态 BEM 类同样过 class-coverage 门禁；④ reduced-motion：`@media (prefers-reduced-motion: reduce)` 下入场动画全静态（`useMiniRevealMotion`/`getSystemReducedMotion` 已有先例）。

### P1a — 收银台「和朋友一起？邀 TA 同行，排进同一桌」入口

- **推荐组件/模式：** 复用 `ticket-refund-link` 的**文本链接 register**（index.tsx:1370-1381：一行文字 + `›` + hoverClass 淡压），新建为独立小组件 `components/event-ticket-payment/DuoEntryLink.tsx` 或直接内联。**禁止**做成卡片/按钮/徽章——收银台一屏只允许一个 solid primary CTA（支付按钮），event-detail action bar 的「至多一个实心主 CTA」矩阵（index.tsx:128-146 注释）是已固化的全站纪律。跳转目标 = Duo 邀请链路（`apps/server/src/routes/domains/duo.ts` 的 `POST /api/pools/:id/duo-invites` 对应的客户端页面/流程；引擎零改动，复用 `lib/duo/duoState.ts` 与 `PoolRegistrationDuoCard` 的既有状态机语义，但 UI 不搬那张 segmented 卡进收银台）。
- **插入位置：** ScrollView 内、`ticket-trust-row` 之下、`ticket-refund-link` 之上——信任簇（trust row → duo 入口 → 退款政策链接）集中陈列，不进 sticky footer（footer 已被 P0d 加高）。
- **布局与节奏：** 单行 88rpx touch target，左右 32rpx 页边距对齐 trust row。zero-scroll 约束：scroll 内容区加一行不威胁 CTA 首屏可见性，但需 667px 视口回归验证（与 P0d 同一次 DevTools 过检）。
- **品牌 token：** 文字 `$color-primary`（链接语义，全站链接色惯例）或 `$color-text-secondary` + primary chevron；`$font-size-sm`。无图标或复用 `icon-people.webp`（GuidanceTipCard 已用的 bundled ui glyph，零新资产）。
- **文案红线：** 主文案「和朋友一起？邀 TA 同行，排进同一桌」用 canonical 排桌/同行 ✅。⚠ **「同行有奖励」挂件是 WeChat 诱导分享审核敏感区**：INVITE_REWARD（¥50）是「排桌成功」后发的平台奖励，不是「分享即得」，入口文案只挂轻量「同行有奖励」，奖励金额与规则**只能**出现在落地页，入口行禁出现 ¥ 数字、「立得」「现金」「提现」字样。打点 `duo_entry_ctr`（已在 P0b 清单）。
- **微信工程陷阱：** ① payments 子包 SCSS `@use` + verify-subpackage-styles（同 P0d ①）；② tap 必须 `haptics('light')`（非 onboarding 互动面 haptics 强制）；③ 若 Duo 状态需轮询/loading，入口行渲染不得阻塞收银台首屏（独立 query，`enabled` 门控，失败静默隐藏入口——fail-closed 参照 feedback entry 模式）。

### P1c — 游客预告卡（测评结果页 → 登录墙之间，2-3 张真实场次只读卡）

- **推荐组件/模式：** **不直接复用 `OracleCard`**（`components/discover/OracleCard.tsx` 六层视觉 + 角落实时人数徽章 + 四分支叙事 + Discover 埋点键，全部耦合登录态与 Discover 语境）。做法：抽 OracleCard 的 **L1 hero 信息 / L3 决策事实 / L4 标题**视觉壳，新建 `GuestEventPreviewCard`（落 `components/onboarding/GuestEventPreviewCard.tsx`），纯静态、纯只读、无 corner badge、无 count-up、无 high-chemistry 徽章。整组卡 + 登录钩子组成 `GuestEventPreviewSection`，插入 `pages/onboarding/personality-test/results/FinalStage.tsx` 的 ScrollView 内、`personality-results__stack-actions`（FinalStage.tsx:759，登录墙 CTA 区）**之前**——先看见真实的局，再撞「微信登录，为你留座」。
- **布局与节奏：** 8rpx 节奏；卡片全宽（对齐结果页既有 Card 槽宽），2-3 张纵向堆叠、间距 24rpx；每张卡高建议 ≤240rpx（信息密度低于 OracleCard——游客只需要「这是什么局、什么时候、在哪、还剩几座」四个事实）。zero-scroll：结果页是 ScrollView 页，卡组在流内纵向增长，不违反政策；注意勿让登录 CTA 在 667px 视口被推出首屏太远——3 张卡 + 钩子总量控制在约一屏内，超出则减至 2 张（渲染数 min(3, 供给数)）。
- **品牌 token：** 卡片底色 `$color-surface`，标题 `$font-cn-display`（短情绪中文）或 `$font-ui` bold，事实行 `$color-text-secondary`；「微信登录，为你留座」CTA = 现有 `Button variant='wechat'`（FinalStage.tsx:776）不动，钩子句作为其上 caption。场次类型 vignette 图走 CDN + 失败降级为纯奶油色底（`ProfileReviewInviteCard` 的 flat-cream 降级先例）。**本页吉祥物/插画配额已爆满**（slot 机 + 原型图 + celebrate 悦仔），预告卡零吉祥物。
- **文案红线：** 「留座」canonical ✅。🔴 **人数/剩余席位数字必须 live query**（≥3 场供给门槛是服务端判定，不足 3 场整组不渲染——fail-closed，不是渲染「暂无」）；禁「抢手」「仅剩」等 urgency 词（OracleCard corner badge 的「factual, not scarcity-driven」原则平移过来）；禁 匹配/社交/AI；场次名直接用 pool 真实标题。灰度 flag-off = 字节级 legacy 渲染（参照 `guidanceQueueContract.test.ts` 的 flag 互斥契约测试模式）。
- **微信工程陷阱：** ① onboarding 是**子包**——组件 SCSS `@use` 进 `results/index.scss`，新选择器登记 `verify-subpackage-styles.mjs`；② **零新增 bundled 资产**（主包/子包体积红线，2026-10-15 教训）——vignette 全走 `cdnAsset()`，失败降级纯色；③ 本页已有 slot 机动画，预告卡**入场最多一次单 fade**（transform/opacity only，`cubic-bezier(0.22,1,0.36,1)` 300ms），reduced-motion 全静态，禁 cascade 串场；④ 任何 JS 计算的 inline style 只发 px；⑤ 打点 `guest_view_to_assessment_rate`/`guest_to_login_conv`（P0b）需过 client union + server whitelist 双登记（`discoverAnalyticsAllowlistContract.test.ts` 同款 parity 纪律）。

---

## 3. 设计风险清单（每件最可能翻车的一点）

| 交付物 | 最大设计风险 | 规避 |
|--------|-------------|------|
| P0c 流程条 | 320px 窄机上 4 列节点标签换行出孤字 / 图标与标签 baseline 错位（L2 陷阱），一眼「廉价小程序」 | 节点强制 flex column（图标上、标签下、居中），标签限 4-6 字、允许 2 行；Full-tier 纪律：最小目标设备 DevTools 实机截图入 PR；CJK 禁 `overflow-wrap: anywhere` |
| P0d 退款叙事 | footer 加一行后短机 CTA 被顶出首屏，或叙事行与「查看退款与取消政策」链接语义打架（一个说承诺、一个进条款） | spacer 同步增高 + 667px 视口 DevTools 验证为 merge 前置；叙事行（修辞）与事实行（承诺）叠放分工，政策链接保持原样不动 |
| P0e FAQ | WeChat height 动画 jank + 展开态把客服卡顶出视野，页面节奏崩塌 | 条件渲染 + transform/opacity 入场，禁 height 动画；一次只开一条；答案 ≤60 字；展开后 `scrollIntoView` **不用**（ScrollView 内 Taro.pageScrollTo 无效陷阱），靠内容量自控 |
| P1a 同行入口 | 做成第二个视觉重心，与支付 CTA 抢焦（一屏一主 CTA 纪律破坏），或「同行有奖励」被审核判诱导 | 锁死文本链接 register（`ticket-refund-link` 同款）；入口零金额、零 urgency；奖励详情只活在其落地页 |
| P1c 游客预告卡 | 直接拖 OracleCard 进游客场景——实时徽章/埋点/个性化分支在匿名态全部失效，且给已超载的结果页再加 cascade 动画与 bundled 资产 | 抽壳新建轻卡（L1/L3/L4 三层）；零徽章零 count-up；单次 fade 上限；CDN-only 图 + 奶油色降级；<3 场供给整组 fail-closed 不渲染 |

---

## 4. 验收框架（上线前 audit 链与通过门槛）

**五件交付物全部按 Full tier 处理**（mini-program-frontend-excellence：新组件/新布局 = Full；19 项清单 + WeChat DevTools 实机检查强制，截图/选择器笔记入 PR）。

| 门禁 | 通过门槛 | 适用 |
|------|---------|------|
| `npm run guardrails` | 0 error：无内联 emoji、BEM class-coverage 无新增 orphan（新组件 SCSS 同 PR）、design-audit `--scope changed --fail-on error` 0 阻塞 | 全部 |
| `npm run build:weapp -w mini-program && npm run verify:subpackage-styles -w mini-program` | 通过，无非空 `sub-common.wxss`；新选择器已登记 | P0d / P1a（payments 子包）、P1c（onboarding 子包） |
| `check-cdn-icon-coverage.mjs`（guardrails 链内） | 新 (tier, assetKey) 图标映射 = webp + manifest 条目齐全 | P0c（若新增图标） |
| `npm run typecheck -w mini-program` + 相关 render/contract 测试 | 通过；P0d 灰度桶 fail-closed 有渲染测试（参照 `RefundGuaranteeLine.render.test.tsx` 扩展）；P1c flag 互斥契约测试（参照 `guidanceQueueContract.test.ts` 模式） | 全部 |
| **ui-layout-audit** | 0 error 级发现；8rpx 节奏、CJK 换行、R1-R8 render-integrity 全过 | 全部 |
| **frontend-design-audit**（5 维 /0-20） | ≥16/20，Dim 1 品牌保真 ≥3，**Visual Gate 零 Class A 缺陷**（重叠/裁切/对比度不可读 = 自动 P0，一票否决） | 全部 |
| **completeness-audit**（完成度全流程：ui-layout → design → completeness） | ≥32/44（坚稳档），零 P0 gap；dim 9 未被 Class A 压帽 | 全部（五件合并跑一次 pipeline） |
| **performance-audit** | PASS（无 BLOCK）；重点：P1c 结果页流畅度（新卡不得引入 layout 动画/多余重绘）、P0d+P1a 收银台 footer 首屏渲染 | P1c、P0d、P1a 强制；P0c/P0e 至少 WARN-free |
| 情绪价值 rubric（`docs/reference/emotional-value-rubric.md` /0-24） | P1c ≥14（获客钩子面，情绪是功能）；P0c/P0e ≥12；P0d/P1a 信任面不设下限但 Dim 1 证据须入档 | 全部 |
| **文案双签** | 6-8 条 FAQ + 所有新句子经 PM+eng lead 双签；🔴 词表零命中；承诺类文案有服务端行为证据链接（P0d ↔ P0a 灰度证据） | P0d / P0e / P1a / P1c |
| **DevTools 短机回归** | 667px 视口：收银台 CTA 首屏可见（P0d+P1a 同屏叠加验证）、详情页流程条/FAQ 无换行事故 | P0c / P0d / P0e / P1a |
| **灰度护栏** | P0d 灰度期 `checkout_cancel_rate` 7 天读数不回退才全量；P1c flag 灰度盯 `guest_to_login_conv` | P0d / P1c |

**上线顺序设计侧确认：** P0c+P0e 同车（同为详情页静态内容，一次 audit pipeline 覆盖）；P0d 严等 P0a 行为生效证据；P1a 可并行开发 flag-off；P1c 最后（依赖最重、风险最高、供给门槛需运营数据）。

---

## 附：⚠ 标记汇总（不推翻策略，仅设计侧解法备案）

1. ⚠ P0d「这一桌已经写上你的名字」在排桌完成前是修辞而非事实——解法：叙事行+事实行叠放，事实行「排桌完成前取消，全额退款」永不删除。
2. ⚠ P1a「同行有奖励」贴诱导分享审核线——解法：入口零金额，奖励规则只上落地页。
3. ⚠ P1c 复用 OracleCard 的诱惑——解法：抽壳不拖藕，轻卡组件独立，避免 Discover 耦合污染匿名场景。
4. ⚠ FAQ 答案长度必然破 🟡 ≤25 字指引——解法：按解释性内容登记 waiver，目标 ≤60 字。

---

## 5. Wow Layer — 简洁高级的爆发感设计规格

> 回应「简洁但高级精致、需要爆炸 wow」的方向。本章解决「安静事实层」与「爆炸 wow」的表面张力。

### 5.1 张力解法（一句话裁决）

**事实层负责「说什么」，wow 层负责「怎么说」——内容永远不吵；工艺让每条内容显得被认真对待；编排只允许在获客面（P1c）有一次高潮。** 信任面的 wow = 沉默的精度（像素、灰阶、节奏），获客面的 wow = 编排的节奏（时序、落定、一句好文案）。两者都不靠特效密度——这正是 JoyJoin 品牌 motion 原则（gentle / restrained / ≤300ms feedback / ≤500ms reveal / 禁 bouncy）与 wow-elements「crafted confidence, not decoration」的重合点。

**Wow 预算分配（一屏一个编排时刻，不可挪用）：**

| 屏幕 | 编排层预算 | 去向 |
|------|-----------|------|
| 详情页（P0c+P0e） | 1 次 | P0c 连接线绘制入场（§5.3.1） |
| 收银台（P0d+P1a） | **0 次** | 全部预算投进排版精度与按压物理（§5.3.2 / §5.3.4） |
| 测评结果页（P1c） | 1 次 | 卡组升起编排 + 钩子句亮相（§5.3.5），接在老虎机庆典峰值**之后** |

### 5.2 工艺层 Wow 共享基线（五件全享，锁定值）

以下是「润物细无声」的高级感来源，五件交付物共用，不再逐件重复论证：

1. **唯一曲线：** 所有入场/揭示用 `cubic-bezier(0.22, 1, 0.36, 1)`（repo 既定标准）；按压/hover 反馈用 `ease-out` ≤150ms。**禁** spring/bounce/elastic（品牌红线：avoid bouncy keyframes）。
2. **时长纪律：** 常规反馈 ≤200ms；情感揭示 ≤500ms（wow-elements 验收硬线）；任何编排序列总长 ≤1000ms。
3. **属性白名单：** 只动 `transform` + `opacity`。height/width/margin 动画 = 直接打回（layout thrash + CLS）。
4. **按压物理：** 所有可点行（FAQ 问题行、P1a 入口行）= `hoverClass` 淡色 tint（`rgba($color-primary, 0.06)`，120ms）+ 可选 `scale(0.98)` 100ms + `haptics('light')`。
5. **Reduced-motion：** 一切动画有静态等价态（`getSystemReducedMotion` / media query）；内容与状态在无动画下完整可读——意义永远不单独挂在动效上。
6. **精度即豪华：** 1rpx hairline 分隔、8rpx 节奏零例外、CJK 标点不孤字、灰阶层级（`$color-text-primary` / `-secondary` / muted caption）不越级。信任面的「高级感」90% 来自这里，不来自任何动效。
7. **设备验证：** 中端机实测，不只开发机（wow-elements checklist 硬项）；任何掉帧先砍动效保内容。

### 5.3 逐交付物 Wow 规格

#### 5.3.1 P0c 流程条 —— 落点：连接线的「一笔画」

- **① Wow 落点：** 4 节点之间的 3 段连接线。数据就绪后（**不在 skeleton 阶段**），连接线从左到右依次 `scaleX(0→1)` 长出——「这条路是通的」的隐喻由线承担，文字图标全部安静。配合节点图标微落定。
- **② 动效规格：** 节点 fade + `translateY(8rpx→0)` 250ms `cubic-bezier(0.22,1,0.36,1)`；连接线 `scaleX(0→1)` 300ms 同曲线，每段在其左节点落定后 80ms 启动（stagger gap 80ms，对齐 catalog easing 表）；全序列 ≤700ms，每次页面挂载一次性，不循环、不重播。Reduced-motion：全静态直出。
- **③ 精品参照：** Linear 的 roadmap 时间线——「流动感」由线的绘制承担，文字从不动。
- **④ 防爆红线：** **禁止任何循环动画**（呼吸灯、箭头飘动、虚线滚动）。流程条是常驻内容，loop 在用户阅读活动介绍时持续抢焦，30 秒内从高级变廉价烟花。one-shot 是它的全部生命力。

#### 5.3.2 P0d 退款叙事行 —— 落点：零特效，全投进排版

- **① Wow 落点：** 排版精度本身——叙事行与事实行的灰阶层级（同 `$ticket-text-muted`，叙事行可深半阶）、4rpx hairline 行距、与支付按钮的垂直节奏。这是收银台，**编排预算为零**。
- **② 动效规格：** 唯一允许的动作：footer 挂载时两行 caption 级联落位——叙事行 `opacity 0→1` 200ms `ease-out`，事实行延迟 60ms 同规格（「先情绪后承诺」的阅读次序）。一次性，≤260ms。无触觉（无交互元素）。Reduced-motion：两行静态直出。
- **③ 精品参照：** Apple Pay 收银条——信任文案永远安静落位，高级感全部来自字距、灰阶与 1rpx 级垂直节奏，不靠任何特效。
- **④ 防爆红线：** **禁止给「这一桌已经写上你的名字」加 accent 色、图标、下划线生长动画或逐字渐显**。承诺句一旦被装饰，用户第一反应是「你在掩饰什么」——信任面的装饰即减信。

#### 5.3.3 P0e FAQ 手风琴 —— 落点：开合的「回应感」

- **① Wow 落点：** Q→A 的时序衔接——chevron 旋转与答案入场有因果感，切换条目时「先收后开」不打架。高级感在衔接节奏，不在开合本身。
- **② 动效规格：** tap → `haptics('light')`；chevron `rotate(0→180°)` 200ms `cubic-bezier(0.22,1,0.36,1)`；答案块条件渲染 + `opacity 0→1` + `translateY(8rpx→0)` 250ms 同曲线；换条时旧答案先退（`opacity→0` 150ms），新答案在其后 80ms 入场，单次切换总长 <400ms。Reduced-motion：瞬时切换，零动画。
- **③ 精品参照：** Airbnb 房源页「显示全部设施」分组展开——开合有回应感，从不弹跳、从不改变视觉重量。
- **④ 防爆红线：** 禁 spring/elastic 回弹；禁答案块带色块展开（背景突变 = 视觉噪声）；禁多条同开的「瀑布」。一条一问一答一回应。

#### 5.3.4 P1a 同行入口 —— 落点：100ms 的按压物理

- **① Wow 落点：** 按压瞬间——`hoverClass` tint + `scale(0.98)` + chevron 微移（`translateX(0→4rpx)`）暗示「这扇门可以推开」。静止时它必须像本来就在那里的一件设施。
- **② 动效规格：** press 反馈 100ms `ease-out`；入场不单独编排——随 trust row 同帧 fade（信任簇是一个整体，不 stagger 成员）。Reduced-motion：保留 tint 着色（状态语义），去掉 scale/chevron 位移。
- **③ 精品参照：** Linear 次级导航行——全部生命力在 100ms 按压物理里，静态时完全隐形。
- **④ 防爆红线：** **禁止脉冲、光晕、「奖」字角标呼吸闪**。收银台的任何闪烁都直接读作「诱导」，与 WeChat 审核红线同向。它的 wow 是「克制到几乎不存在」。

#### 5.3.5 P1c 游客预告卡 —— 编排层唯一允许的「爆炸」

**情绪上下文：** 结果页节奏 = slot 机悬念 → 原型揭晓（庆典峰值）→ 收集格 → 登录墙。预告卡组插在峰值**之后**（`FinalStage.tsx` 收集格/retest prompt 与 `__stack-actions` 之间）——庆典完全 settle ≥400ms 后才允许卡组有任何动作，不与 slot 机抢戏，不与 confetti 同帧。「爆炸」的载体 = 编排节奏 + 图像质感 + 钩子句，零特效堆叠。

**① Wow 落点 A — 卡组入场编排（stagger 升起，不做视差）：**
- 触发：`Taro.createIntersectionObserver`（相对页面 ScrollView，threshold 0.3，once-only）；observer 不可用/报错 → fail-closed 为**静态直出**（绝不 fail 到不可见）。
- 规格：card1 `opacity 0→1` + `translateY(24rpx→0)` 400ms `cubic-bezier(0.22,1,0.36,1)`；card2 延迟 +90ms；card3 延迟 +180ms（stagger gap 90ms，落在 catalog 50–80ms 上限附近，取 90 是因为卡片比列表项重）。**禁滚动视差**（onScroll 监听 = 性能税 + jank，catalog 明示避免）。
- **禁自动轮播**——2-3 张静态堆叠就是全部，auto-carousel = 信息流广告即视感。

**② Wow 落点 B — vignette 质感（cinematic settle）：**
- 卡片升起的同时，卡内场次图做一次 **one-shot Ken Burns 定场**：`scale(1.04→1.0)` 400ms 与升起同曲线同帧——图像从轻微放大「落回」画框，是电影感而非动感。transform only ✅，无循环。
- 图像加载期用 opacity-pulse shimmer 占位（`shimmer-pulse 1.5s ease-in-out infinite`，opacity 0.25↔0.65——GPU 安全的 opacity 脉冲，repo 既定模式，禁 background-position 渐变）。
- 图像底部罩品牌奶油色渐变罩 + 1rpx 内描边，文字活在罩上，图像永远不裸奔。CDN 失败 → flat cream 降级（`ProfileReviewInviteCard` 先例），降级态同样参与编排（米色块升起依然成立）。

**③ Wow 落点 C — 「微信登录，为你留座」钩子句亮相：**
- 第三张卡落定后 150ms（总序列 ≈880ms，≤1000ms 纪律内）：钩子句以 `font-cn-display`（短情绪中文的专属字役）`translateY(12rpx→0)` + `opacity 0→1` 350ms 升起，落定瞬间一次 `haptics('light')`。
- **先例依据：** 编排完成点触发编程式 haptic 已有 repo 先例——`InsightRevealCard` 仅在最终行落地时 `haptics('success')`（AGENTS.md 条目）。此处用 `light` 不用 `success`：庆典峰值已属于 slot 机，钩子句是自信的余韵，不是第二次庆典。
- 钩子句与 `Button variant='wechat'`（既有登录 CTA）构成「句→钮」视觉对位，句升钮静。

**④ 防爆红线（P1c 专属清单）：**
- 禁 confetti/粒子/礼花（结果页庆典刚用过，二次使用即贬值；且那是 slot 机的语言，不是卡组的语言）
- 禁卡片循环浮动（bobbing）/ 循环 Ken Burns——one-shot 定场后一切静止
- 禁 urgency 色（金/红/橙）与「仅剩 X 座」闪烁——数字只能是 live query 的安静事实（OracleCard corner badge 的 factual-not-scarcity 原则平移）
- 禁与 slot 机/庆典同帧叠加任何新动画（≥400ms settle 隔离带）
- 禁阴影层级跳动（卡升起时 shadow 不动，动的只有 transform/opacity）
- Reduced-motion：卡组、定场、钩子句全部静态直出，内容与 CTA 完整可用。

**精品参照（整组一句）：** Apple Photos「回忆」开场的卡片升起 + Airbnb 房源图的 Ken Burns 定场——爆发感来自编排节奏与质感，不来自特效密度。

### 5.4 验收追加（并入第 4 章门禁）

- wow-elements grill-me checklist：每个编排时刻须答「为什么在这里、为什么是现在、为什么是这种形式」，答不出即删。
- `frontend-design-audit` Dim 5（craft/motion）≥3 且无任何「layout-triggering animation」发现；`performance-audit` 对 P1c 结果页强制 PASS（编排序列不得引起掉帧/CLS）。
- 情绪价值 rubric 复核：P1c 编排后 ≥14（获客面硬指标）；若编排版反而低于静态版，退回静态版——wow 永远不能以降低情绪分的方式存在。
- 中端机实机录屏入 PR（P0c 连线绘制、P1c 全序列），DevTools 60fps 面板无长帧。
