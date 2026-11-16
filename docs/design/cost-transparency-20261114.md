# 费用透明 · 收银台设计规格

**日期：** 2026-11-14　**类型：** 纯 UI/UX（无新 API、无定价改动、无赠饮承诺）
**来源：** `docs/deliberations/2026-11-12-ticket-drink-bundle-decision.md` §8 —— PM 异议后，费用透明被列为**无条件 P0**，与共享桶实验完全解耦。
**工作量：** 2–3 人天（含状态截图与 DevTools 走查）。本周可交付。

> **实施唯一基准（防旧稿误读）：** 视觉、间距、合计两行组、紧凑单行动作条与窄屏规则，一律以 **§12 + `cost-transparency-polish-20261114.html/.css`** 为准。基础版 HTML/PNG 只证明信息架构；六态矩阵只证明状态与文案，**不得**从旧稿复制间距、合计结构或动作条。金额与状态语义以 §4/§5 为准。

---

## 0. 问题定义（先说清在修什么）

收银台 `pages/payments/event-ticket-payment/index.tsx:1366-1379` 现在是四个等权 chip：

> 报名费含组织与排桌 ｜ 含悦仔多环节破冰 ｜ 现场消费 AA ｜ 精选场地专属折扣

三个具体缺陷：

1. **「现场消费 AA」没有金额。** 用户到付款成功都不知道今晚总共要花多少。
2. **「精选场地专属折扣」是空头承诺。** 小程序对 `GET /api/venues/:venueId/deals` **零消费方**，没有任何页面展示场地优惠。这句话在付款页兑现不了。
3. **「费用包含」弹层只讲破冰环节，从不讲不包含什么。** `IcebreakerInclusionSheet.tsx:129-170`。

**设计命题：** 把「一笔票钱」重新叙述成「一晚两笔账」——报名费是一笔，到店自付是另一笔，并且让用户**在输入支付密码之前**看到合计。

**不做什么：** 不加红色警告、不加感叹号、不加「请注意」式的免责腔。透明是**礼遇**，不是免责声明。这是「精致高级」的第一条判断标准。

---

## 1. 信息架构：一晚两笔账

```
已付（本次）   报名费 ¥88        → 组织、排桌、多环节破冰
到店自付       ¥80–150 / 人      → 现场酒水，同桌 AA，含无酒精特调
────────────────────────────────────────────
今晚大约       ¥168–238 / 人     → 报名费已在内
```

**关键叙事决定：到店自付的金额来自「你自己选的预算」，不是我们加收的费。**

`index.tsx:1171-1182` 的 `choiceChips` 已经从 `returnContext?.draft` 读出了用户自己的预算档（`barBudgetRange` / `budgetRange`）。所以这一行的措辞必须是「**按你选的预算**」——把金额归因到用户自己的选择，而不是平台的加价。这既诚实，也避免把总价 sticker shock 记到平台头上。

**零新数据请求。** 所有数字来自已有 draft + 订单金额 + `BUDGET_TIER_BY_ID`。

---

## 2. 界面 A：收银台（主改动）

### 2.1 结构变更

**删除**整个 `ticket-card__terms` 四 chip 行，**替换**为一个「今晚的费用」账块。

删除理由（符合五步审计）：四个 chip 做的是含糊的安心感，账块做的是具体的安心感；且其中一句是无法兑现的承诺。破冰价值点不丢失——它进入账块第一行的说明文字和弹层。

**同步删除选择区里的预算 chip**（`choiceChips` 中 `category: 'budget'` 那一项，index.tsx:1171–1182）。理由：预算金额已由账块第二行「按你选的预算 ¥80–150 / 人」承载，同一事实出现两次就是噪音（retro M4：一个事实只放一个家）。意图、饮酒偏好、场地主题等 chip 全部保留，选择区结构不动。

「查看费用包含内容 ›」链接保留位置，文案改为 **「费用怎么算 ›」**，打开扩展后的弹层（见 §3）。

### 2.2 视觉稿

```
┌───────────────────────────────────────────────┐
│  今晚的费用                                    │
│                                               │
│  报名费                            ¥88        │
│  组织、排桌、多环节破冰                         │
│                                               │
│  到店自付 · 按你选的预算          ¥80–150 / 人 │
│  现场酒水，同桌 AA，含无酒精特调                │
│  ──────────────────────────────────────────   │  ← 全块仅此一条 hairline
│  今晚大约                      ¥168–238 / 人  │  ← 块内唯一主强调 36rpx/700
│  报名费已在内                                  │
└───────────────────────────────────────────────┘
```

**克制是这里的质感来源：** 一张票里只有一条分隔线（§12 工程纪律：一张卡一条线，第二条线会把卡变成档案柜）。不用卡片套卡片，不用图标罗列，不用底色块堆叠。

### 2.3 Token 规格（全部来自 `_variables.scss`，零硬编码 hex）

| 元素 | 规格 |
|---|---|
| 容器 | 无独立卡片背景；直接落在 `ReservationTicket` 白底上，上间距 **64rpx**（由选择区下间距承担，§12 最终值），左右 `$container-padding` (40rpx) |
| 区块标签「今晚的费用」 | `font-size: $font-size-base` (28rpx) / **40rpx 行盒** / weight 600 / `$color-text-primary` —— 费用块是卡内第一落点，标签不能弱于选择区标题 |
| 行容器 | flex row / `justify-content: space-between` / **`align-items: center`**（L2：金额与标签字号不同，禁止基线对齐） |
| 行标签 | `$font-size-base` (28rpx) / `$color-text-primary` |
| 金额组 | **flex row + `align-items: center` + gap `$spacing-xs` (8rpx)**：数字与「/ 人」是一个光学居中组，不是 baseline 排列 |
| 金额数字 | **`$font-mono`**（Quicksand → 等宽数字）/ `$font-size-md` (32rpx) / weight 600 / `$color-text-primary` |
| 金额单位「/ 人」 | `$font-size-xs` (22rpx) / weight 400 / `$color-text-secondary-warm`，在金额组内随组居中 |
| 说明文字 | `$font-size-xs` (22rpx) / `$color-text-secondary-warm` / line-height 1.6 |
| 分隔线 | **1rpx**（高保真稿 1px=2rpx，故 HTML 写 0.5px）/ `$color-divider` (#F3F4F6) / 位置固定在**到店自付与合计之间** / **上 32rpx、下 24rpx** |
| 合计行 | flex row / space-between / `align-items: center`；左侧「今晚大约」`$font-size-sm` (24rpx) / 500 / `$color-text-secondary-warm` 与「报名费已在内」`$font-size-xs` (22rpx) 组成**两行标注组（组内 8rpx）**；右侧金额 `$font-mono` **`$font-size-lg` (36rpx) / weight 700** / `$color-text-primary`，相对**整个两行组**垂直居中 |
| 行间距 | `$spacing-sm` (16rpx)；说明文字与所属行间距 `$spacing-2xs` (4rpx，光学微调，需注释) |
| 选择区标题「这次想怎么聚」 | 降为 `$font-size-base` (28rpx) / weight 500 / **40rpx 行盒**（原 32rpx/600），紫色竖条保留；让位给费用块 |
| 页面底色 | 统一 `$color-bg-warm-to` **#F5F1E8**，本页**不使用三段渐变** |
| 头部「地点 / 时间」标签 | `$color-text-secondary-warm` #6B6357。**禁用 `$color-text-tertiary` #8E949E**（暖底上仅 2.7–2.98:1） |
| 主 CTA 文案 | **`$font-size-xl` (40rpx) / weight 700**。白字 / #8B5CF6 = 4.23:1，普通字号不达 4.5:1；40rpx(20px) + 700 达到 WCAG 大字阈值（≥14pt bold），按 3:1 验收即合规——**不需要改品牌紫、不需要渐变、不需要治理例外** |

**对比度已验证（实测相对亮度）：** `#6B6357` / 白卡 = **5.92:1**，/ 米白 #F5F1E8 = **5.25:1**；`#2D3142` / 白卡 = **12.89:1**；badge `#7C3AED` / `#EDE9FE` = **4.80:1**；CTA 白字 / 主紫 = **4.23:1**，按上方大字方案合规。`$color-text-secondary` 在 #F5F1E8 上只有 4.29:1、`$color-text-muted` 更低、`$color-text-tertiary` 仅 2.7:1——**在票价/人数/地点时间这类功能信息上全部禁用**（icebreaker-uiux-wave1 AC-18 的既有裁定）。

**字号节奏：** 合计 36rpx/700 是块内唯一最大字，分项金额 32rpx/600，标签与说明 22–28rpx。**不做 48rpx 的夸张总价**，也不让选择区标题压过总账。透明要安静，但答案要一眼能看到。

**计算纪律（评审 P0 的复发锁）：** 合计一律由 `formatTonightTotal(paidCents, tierIds)` 计算，**任何设计稿、文案、示例不得手写总价**。初稿曾把 ¥88 + ¥80–150 误写为 ¥168–218（正确为 ¥168–238），已全量修正；实施时必须用「报名费 × 预算上下限」表格测试锁定：88+80=168、88+150=238、68+80=148、68+150=218。`paidCents` 是**优惠后的实际应付金额**；计算全程使用整数分，预算档的元→分只转换一次，**不得解析展示字符串再求和**。卡内报名费、合计输入与底部动作条金额必须来自同一个 `paidCents`，不得三处各自取值。

### 2.4 交互

- 账块本体**不可点**（它不是按钮，不加 hoverClass，避免暗示有下钻）。
- 「费用怎么算 ›」链接：`min-height: $cta-min-tap` (88rpx)，`haptics('light')`，沿用现有 `ticket_inclusion_sheet_open` 埋点（**不新增事件名**，免得动 `discoverAnalyticsAllowlistContract.test.ts` 的服务端白名单）。
- 账块**无入场动画**。它属于首屏关键信息，动画只会延迟用户看到总价的时间。

---

## 3. 界面 B：「费用怎么算」弹层

**完整复用** `IcebreakerInclusionSheet` 的外壳与全部手势（drag-to-dismiss 阈值 100px、阻尼 0.6、`__taroRouterChange` 关闭、`paymentTrust` 悦仔表情、280ms `cubic-bezier(0.22,1,0.36,1)`、reduced-motion 降级）。

**不改组件文件名、既有 props 与手势**——它被 `pageStructure.source-lock.test.ts` 等结构性测试锁定。只改标题与内容区。为承载本场预算，允许**新增只读可选 props**：`onSiteBudgetLabel?: string | null`（由 `formatOnSiteBudget()` 生成）与 `onSiteHint?: string`（按饭局/酒局取集中文案）。弹层不得自行读取 tier、计算金额或发起请求；无预算时传 `null`，显示「具体金额以门店菜单为准」。source-lock 断言与该新增输入在同一次编辑中更新。

| 区域 | 现状 | 改后 |
|---|---|---|
| `__title` | 费用包含 | **今晚的费用** |
| `__subtitle` | 报名费已包含悦仔引导的多环节破冰体验 | **一笔报名费，一笔到店自付，没有第三笔。** |
| 第一段 | 5 个 phase-item | 保留原样（报名费包含的破冰环节） |
| **新增第二段** | 无 | 「**不包含在报名费里**」：到店酒水自点、同桌 AA；列出本场预算区间；说明含无酒精特调 |
| `__note` | 具体环节由悦仔灵活组合 | 保留，追加一条独立 note：**「具体场地在排桌后公布，到店消费以门店菜单为准」** |

**「没有第三笔」是这个弹层的核心句子。** 它直接回答了用户没说出口的担心。

**为什么必须写「具体场地在排桌后公布」：** `eventFaqCopy.ts:57-60` 已确定场地在排桌后才揭晓，因此**任何门店级权益都不可能出现在收银台**。这条 note 是收银台叙事的边界，也解释了为什么这里给的是区间而非精确菜单价。

---

## 4. 状态矩阵（每个分支都要渲染一次）

| 状态 | 报名费行 | 到店自付行 | 合计行 |
|---|---|---|---|
| **标准单场** ¥88，预算 80–150 | ¥88 | ¥80–150 / 人 | ¥168–238 / 人 |
| **首单 WELCOME20** ¥68 | ¥68（划线价已由现有优惠券存根承担，此处**不重复**划线） | ¥80–150 / 人 | ¥148–218 / 人 |
| **正价多场权益购买**（`pack_3` / `pack_6` / `vip_monthly`） | 行标签改为「本次购买」，显示优惠后实际订单金额；说明使用订单已有的产品名/场次，缺数据就不补写 | 正常显示**本场**到店预算 | **整行不渲染，分隔线随之取消**；多场产品价格绝不计入「今晚大约」 |
| **下限未知**（如 `drinks_80_below`，min=null） | ¥88 | **¥80 以内 / 人** | **¥168 以内 / 人** |
| **多选预算档** | ¥88 | 取所有档的 min 最小值 / max 最大值 | 同规则 |
| **权益单 / 0 元单**（月卡、连局包） | **「已含在权益里」**，不显示 ¥0 | ¥80–150 / 人 | ¥80–150 / 人（仅到店部分），下接「本场无需再付报名费」 |
| **无预算数据**（draft 缺失、盲盒直进） | ¥88 | 行标签退化为「到店自付」、金额位显示「现场 AA」，**不给任何到店金额**，下接「具体金额以门店菜单为准」 | **整行不渲染**，分隔线随之取消 |
| **不可映射标签** `100-200`（`UNMAPPABLE_BLIND_BOX_BUDGET_LABEL`，B3 未决） | ¥88 | 同上，走 unknown，**绝不猜一个区间** | 整行不渲染 |

**多场权益购买不是权益核销。** `pack_3` / `pack_6` / `vip_monthly` 的本次付款覆盖多场，因此只呈现「本次购买」与「本场到店自付」，**不制造一个把整场套餐价算进今晚的合计**。底部动作条在这类产品上使用「本次实付」，不再写「报名费」；卡内金额、动作条金额仍同源。该状态复用已批准的「无合计行」布局，不新增视觉结构。

**铁律：没有数据就不显示数字，而不是显示一个编出来的数字。** 合计行在无预算时必须整体消失——留一个「今晚大约 —」比没有更糟。

**不饮酒用户：** 不单独降价、不单独改版。统一在说明文字里写「含无酒精特调」，与 `eventFaqCopy.ts:72-75` 的承诺一致。**不要写「不喝酒更便宜」**——我们不掌握门店无酒精定价，说了就是编造。

---

## 5. 文案表（集中管理，不散落在 JSX）

新增 `packages/shared/src/copy/eventCostCopy.ts`，导出标签常量与两个纯函数：

```
COST_BLOCK_TITLE        = '今晚的费用'
COST_ROW_TICKET         = '报名费'
COST_ROW_PURCHASE       = '本次购买'                        // 正价多场权益购买
COST_ACTION_PURCHASE    = '本次实付'                        // 多场权益的动作条金额标签
COST_ROW_TICKET_HINT    = '组织、排桌、多环节破冰'
COST_ROW_ONSITE         = '到店自付 · 按你选的预算'
COST_ROW_ONSITE_HINT    = '现场酒水，同桌 AA，含无酒精特调'
COST_ROW_ONSITE_HINT_DINING = '现场餐食，同桌 AA'          // 饭局
COST_TOTAL_SUFFIX       = '报名费已在内'
COST_TOTAL_SUFFIX_PLAN  = '本场无需再付报名费'              // 权益单（合计只含到店部分）
COST_INCLUDED_IN_PLAN   = '已含在权益里'
COST_ROW_ONSITE_UNKNOWN = '到店自付'                       // 无预算 / 不可映射：行标签退化
COST_ONSITE_UNKNOWN     = '现场 AA'                        // 金额位文案，不给数字
COST_ONSITE_MENU_NOTE   = '具体金额以门店菜单为准'
COST_SHEET_LINK         = '费用怎么算 ›'

formatOnSiteBudget(tierIds)  → '¥80–150 / 人' | '¥80 以内 / 人' | null
formatTonightTotal(paidCents, tierIds) → '¥168–238 / 人' | '¥168 以内 / 人' | null
```

**文案红线（WeChat 审核口径）：** 全块**不出现「含一杯」「赠饮」「免费酒水」**。到店消费一律表述为用户自点自付。这不只是措辞——一旦 ¥88 被描述成包含酒水，价格对价的性质就变了，退款争议和类目审核跟着来（见备忘录治理冲突 §）。

**禁用词：** 匹配、社交、灵魂、撮合、AI（可见文案）；「精选场地专属折扣」**从收银台移除**。

---

## 6. 界面 C：活动详情页 —— 明确划出本周范围

`pages/event-detail/` 目前 grep `price|¥|元|人均|费用|酒` **零命中**，信息行卡（时间/地点/人数/状态）是天然的落点，值得加一行「到店预算」。

**但它需要 `EventPoolSummary` 或报名记录带出预算档——这是 API 契约变更，不属于纯 UI 任务。**

→ 列为 **P1 后续项**，本周**不用硬编码金额冒充**。详情页是报名后的回看面，收银台才是决策点，先做决策点。

---

## 7. 落地文件清单（交接用，本次不改代码）

| 文件 | 动作 |
|---|---|
| `packages/shared/src/copy/eventCostCopy.ts` | **新增**：文案常量 + 两个纯函数 |
| `apps/mini-program/src/components/event-ticket-payment/CostBreakdown.tsx` + `.scss` | **新增**账块组件 |
| `apps/mini-program/src/pages/payments/event-ticket-payment/index.tsx` | 1366–1379 四 chip → `<CostBreakdown>`；链接文案改「费用怎么算 ›」 |
| `apps/mini-program/src/components/event-ticket-payment/IcebreakerInclusionSheet.tsx` + `.scss` | 标题/subtitle 改；新增「不包含在报名费里」段与场地揭晓 note |
| `__tests__/pageStructure.source-lock.test.ts` | **与结构改动同一次编辑内更新断言**（§12 纪律：不要改完结构再补测试） |

**两个已知的坑，写进交接：**
1. `index.tsx:1191-1197` 有 hook 顺序陷阱：`ticketFooter` 必须保持普通 const，不能包 `useMemo`（上方 early return 会让冷渲染崩溃）。**新增的预算派生值遵守同一规则。**
2. 若 `pages/payments` 属分包：组件 SCSS 必须在消费页 SCSS 里 `@use`，并**删掉组件 TSX 里的 side-effect import**，然后跑 `npm run build:weapp -w mini-program && npm run verify:subpackage-styles -w mini-program`，确认没有非空 `sub-common.wxss`。

---

## 8. 验收标准

- [ ] 付款前能看到今晚总花费区间，且明确「报名费已在内」
- [ ] 到店自付金额可追溯到用户自己选的预算档
- [ ] 无预算数据时**不出现任何到店金额，合计行与分隔线整条移除**（报名费 ¥88 仍正常显示）
- [ ] 「精选场地专属折扣」从收银台消失
- [ ] 弹层明确写出「不包含在报名费里」与「场地排桌后公布」
- [ ] 无酒精等价说明可见；不出现「含一杯 / 赠饮」
- [ ] 所有金额来自 draft / 订单，**零硬编码**
- [ ] 8rpx 间距节奏；仅一条 hairline；数字用 `$font-mono`
- [ ] 暖底功能文字 ≥4.5:1（`$color-text-secondary-warm`）
- [ ] 触控目标 ≥88rpx；链接有 `haptics('light')` 与 hoverClass
- [ ] §4 全部 7 个状态各有渲染截图（happy path 不算覆盖）
- [ ] 320 / 359 / 360 / 375 四个宽度边界验收：窄屏主标签互斥显隐，无「预算」孤字；归属辅助行只在确有预算金额时出现
- [ ] 320×568 + 权益长值组合态：价格组与 CTA 不换行；主内容可滚，滚到底后合计与费用链接完整位于动作条之上
- [ ] 底部预留 = 动作条实际总高度（含 `env(safe-area-inset-bottom)`）+ 32rpx；不写死 34px，不重复累加安全区
- [ ] 纯函数单测覆盖：min=null、多选、unknown 标签、paid=0
- [ ] WeChat DevTools 实测布局与字体的计算值（Full tier 强制）

## 9. 明确的范围外

赠桶与任何赠饮、场地优惠核销与 deals 展示、定价与优惠券规则改动、新 API 字段、新埋点事件名、详情页预算行（P1）。

## 10. 这个改动可能降低支付转化——这是被接受的代价

把总价从「¥88」变成「¥168–238」，首单转化大概率会受影响。**这是透明的成本，不是设计的失败。**

判断依据：被隐藏总价吸引来的首单，会在到店时产生「还要再花钱」的落差，而这种落差由**桌友和现场体验**承担，不是由支付页承担。首单 ¥68 本来就是亏本获客，真正值钱的是第二场（见 `docs/deliberations/2026-10-20-conversion-commercialization-memo.md`：首单转化 ≠ 胜利）。

**因此上线后要看的是「支付转化变化」与「费用相关投诉/退款」两条曲线的比值，而不是单看转化。** 转化跌了但费用争议归零，这笔交易就是划算的。

无基线数据（真实场次为 0），上线前先记录当前支付转化率作为对照。

## 11. 设计审批记录（2026-11-14）

**评审：** uiux-design-reviewer，七维三轮（no-ship → fix-then-ship → **APPROVE**）。**设计审批通过，可转交 taro-engineer，无需再设计复审。**

| 轮次 | 判定 | 关键问题 |
|---|---|---|
| v1 | no-ship | 合计算错（¥168–218 → 应为 **¥168–238**）；`#8E949E` 标签 2.7:1；页面三段渐变非米白底；6px/2px 出网格；金额与单位基线排列 |
| v2 | fix-then-ship | P0 全闭环；CTA 20px/700 满足 WCAG 大字标准（≥14pt 粗体，3:1 即合规），**不改品牌紫、不需治理例外**；余三项 P1 |
| v3 | **APPROVE** | 状态文案常量与渲染一致；间距以渲染为单一真值；pressed 态有真实 `:active` 渲染证据 |

**评审裁定（不要在实施中翻案）：**
- 预算 chip 不加回——金额由「到店自付 · 按你选的预算」承载，一个事实一个家
- 底部动作条「报名费 ¥88」**保留**——它确认本次扣款，卡内解释今晚总账，功能不同；可选 P2 改「本次实付」
- 账块本体不可点，不加 chevron/hover 暗示

### 转交实施的验收门槛

**A. 数据与状态**
1. 金额零硬编码，合计只能由 `formatTonightTotal()` 生成
2. 表格测试锁定 88+80=168 / 88+150=238 / 68+80=148 / 68+150=218，及 `min=null`、多选、unknown、`paid=0`
3. 八态逐项符合 §4：无预算/不可映射 = 无到店金额且合计与分隔线整条消失；权益单 = 「已含在权益里」而非 ¥0，合计只含到店部分并带权益单注脚；饭局用餐食辅助文案；正价多场权益购买不显示今晚合计，动作条用「本次实付」
4. 删除旧四 chip 行与选择区预算 chip；底部「报名费 ¥88」保留
5. 不得出现「精选场地专属折扣」与违禁赠饮文案
6. 链接打开扩展现有弹层并沿用原埋点；弹层含「不包含在报名费里」与场地排桌后公布说明

**B. 必须 WeChat DevTools / 真机复核（HTML 截图不能替代）**
1. 八态完整渲染矩阵：换行、溢出、裁切、重叠、合计与分隔线的增删；多场权益购买不得出现今晚合计
2. Quicksand 实载与 CDN 失败回退：金额仍不挤压、不换行
3. 金额组光学居中：数字、「以内」、「/ 人」均 flex row + `align-items:center`
4. 计算值以 §12 打磨稿为准：费用块上间距 **64rpx**；分隔线上 32rpx / 下 24rpx / 实际 1rpx；合计 36rpx/700 且金额相对左侧两行组居中；分项金额 32rpx/600；CTA 文案 40rpx/700
5. 品牌与表面：`#F5F1E8` 纯色底、白卡 32rpx 圆角、功能文字 `#6B6357`、CTA 纯色 `#8B5CF6` 无渐变
6. 链接真实交互：触控 ≥88rpx、pressed 背景可辨、触感一次；账块不可点
7. 底部动作条与安全区：常见设备宽度下 CTA、报名费、费用链接不被遮挡，无意外滚动
8. 弹层手势：drag-to-dismiss、路由切换关闭、reduced-motion 降级；长内容不遮挡费用说明

**C. 工程回归门**
- 结构断言与结构改动同一次编辑更新
- 分包样式 `@use` 到消费页，`npm run build:weapp -w mini-program && npm run verify:subpackage-styles -w mini-program`，不得产生非空 `sub-common.wxss`
- 新增样式通过 class coverage、guardrails 及相关页面测试

### 交付件清单

| 文件 | 内容 |
|---|---|
| `cost-transparency-20261114.md` | 本规格 |
| `cost-transparency-20261114.html` / `.css` | 基础高保真源：仅作信息架构参考，**视觉以 polish 为准** |
| `cost-transparency-cashier-20261114.png` | 基础标准态整屏 375×812 @3x（非最终视觉） |
| `cost-transparency-states-20261114.html` / `.png` | 其余六态：仅作状态/文案证据，**间距与合计结构以 polish 为准** |
| `cost-transparency-link-pressed-20261114.png` | 链接 pressed 态 |
| `cost-transparency-polish-20261114.html` / `.css` / `.png` | **最终视觉与布局基准** |
| `render-cost-transparency-polish-20261114.mjs` / `render-cost-transparency-actionbar-20261114.mjs` | 可重复渲染与响应式量测脚本 |
| `cost-transparency-actionbar-*.png` / `cost-transparency-polish-320*.png` / `cost-transparency-card-320-20261114.png` | 紧凑动作条、窄屏、长值、滚动可达性证据 |

---

## 12. 视觉打磨记录（2026-11-14，设计师自制打磨稿）

打磨稿（不覆盖已批准版本）：`cost-transparency-polish-20261114.html` / `.css` / `.png`，渲染脚本 `render-cost-transparency-polish-20261114.mjs`（Playwright，375×812，deviceScaleFactor 3）。
信息架构、文案契约、七态规则、合计主强调、预算 chip 删除、底部报名费 ¥88 保留——全部不变。

### 可直接纳入实施的 6 项

| # | 调整 | 规格值 |
|---|---|---|
| 1 | 选择区与费用区之间只加空气 | 选择区下间距 **48rpx → 64rpx**；两个区标题统一 **40rpx 行盒**。不加线、不加卡 |
| 2 | 「已有 N 人入座」归入票面元信息组 | 行盒固定 **32rpx**，其后间距 **32rpx → 24rpx**。紫点、字号、位置不变；**不移近费用块**（语义不同） |
| 3 | 合计两行式的跨行对齐 | 左侧「今晚大约 + 报名费已在内」为两行标注组，组内间距 **8rpx**；右侧金额相对**整个两行组**垂直居中。不改成一长行，不把注脚移到金额下方，不再放大金额 |
| 4 | 「费用怎么算」收回为票面附属说明 | 移除额外上间距；保留完整 **88rpx** 触控高度；左右 **40rpx** 外部 inset，使文字左边线与卡内正文对齐；pressed 改为伪元素 **opacity** 过渡（不动画 background）。链接仍在卡外，不做成填充按钮 |
| 5 | 行盒稳定，消除跨字体跳动 | chips 用 inline-flex + **32rpx 行盒**、padding **16rpx 24rpx**；标题/金额/单位各自固定行盒，**已批准字号不变** |
| 6 | 白卡阴影从描线感改为接触深度 | 见下方例外登记 |

### #7 底部动作条改紧凑单行：**APPROVE（2026-11-14 复审）**

左侧「报名费 / ¥88」上下成组，右侧 CTA 占剩余宽度；CTA 高度、40rpx/700 白字、品牌紫、安全区不变。
创始人已选择该方案；设计师复审正式批准动作条设计本体。

**已渲染证据**（脚本 `render-cost-transparency-actionbar-20261114.mjs`）：
- `cost-transparency-actionbar-320-20261114.png`
- `cost-transparency-actionbar-320-long-value-20261114.png`（320 +「已含在权益里」组合态）
- `cost-transparency-actionbar-375-long-value-20261114.png`
- `cost-transparency-actionbar-393-safearea-20261114.png`
- 四个宽度/组合均无横向溢出；价格组与 CTA 不换行、不截断；组间 32rpx；CTA 96rpx、40rpx/700。

**实施门槛（全部为验收硬条件）：**
1. 动作条固定在 ScrollView 外，页面 shell 不滚动，**主内容必须可滚**。
2. 内容底部预留 = **动作条实际总高度（含上下 padding 与实时安全区）+ 32rpx 收尾间距**，不得只预留 CTA 的 96rpx。
3. 安全区用 `env(safe-area-inset-bottom)`，**不得把证据机型的 34px 写成固定值**；避免基础 bottom padding 与 inset 重复累加。
4. 320×568 必须能滚动看到完整到店自付、合计、注脚与「费用怎么算」，动作条始终不遮字。
5. 真机复核 CTA pressed/loading/disabled，以及平台 disabled 色是否被祖先选择器正确覆盖。

### 320 窄屏断行规则：**APPROVE（本轮新增）**

- **≥360px**：主行完整显示「到店自付 · 按你选的预算」。
- **<360px**：主行只显示「到店自付」；「按你选的预算」作为独立辅助行，位于「现场酒水，同桌 AA…」之上。
- 用 WXSS `@media (max-width: 359px)` + 两个主标签互斥显隐；**不做 JS 宽度测量或 UA 判断**。
- 归属辅助行**只在确有预算金额时渲染**；无预算/不可映射状态不得出现「按你选的预算」，也不得复用 unknown 常量冒充。
- 允许费用块增加一行高度；**不得**通过缩字号、截断、金额换行或压缩 64rpx 分区留白来逃避。
- 验收 320 / 359 / 360 / 375 四个边界，任一宽度只显示一个主标签。

### 320 内容可达性 P0：已修复并渲染验收

初版 320 证据中，固定动作条截断到店自付行，合计与链接落在不可达区域。
打磨稿已改为「shell 不滚 + 主内容独立滚动 + 动作条占位」，并保留 32rpx 收尾间距；没有删留白、缩文字或压缩费用行。

证据：
- `cost-transparency-polish-320-20261114.png`（顶部）
- `cost-transparency-polish-320-scrolled-20261114.png`（滚到底：合计、注脚、链接完整位于动作条之上）
- `cost-transparency-polish-320-long-value-20261114.png` 与 `-scrolled` 同组
- `cost-transparency-card-320-20261114.png`（归属行在原辅助行之上，无「预算」孤字，金额位置不变）
- 量测：320 与 320 长值均 `contentScrollable=true`、`linkFullyAboveBar=true`，链接底 457.66px < 动作条顶 474px。

> 证据脚本注意：打磨稿 `html,body` 锁定 375×812 画框，响应式证据必须先解除画框；卡片区证据需展开主内容并隐藏动作条，避免 fullPage 重复叠入。

### ⚠ 视觉例外登记（design-system-governance）

打磨稿引入两个与现有 token 不同的阴影，实施时**必须登记为命名 token 或书面例外**，不得写成一次性字面值：

| 用途 | 打磨稿值（HTML px） | 换算 rpx | 与现有 token 的差异 |
|---|---|---|---|
| 白卡 | `0 8px 24px rgba(45,49,66,.06)` | `0 16rpx 48rpx rgba($color-text-primary,.06)` | 现有 `$shadow-card` = `0 2rpx 12rpx rgba(0,0,0,.07)`；打磨版更柔更扩散、改用品牌墨色而非纯黑 |
| 底部动作条 | `0 -4px 16px rgba(45,49,66,.05)` | `0 -8rpx 32rpx rgba($color-text-primary,.05)` | 现有 `$shadow-sheet` = `0 -4rpx 24rpx rgba(0,0,0,.06)` |

建议：新增 `$shadow-card-soft` / `$shadow-actionbar` 两个命名 token（写入 `_variables.scss` 并注明来源本节），**不修改** `$shadow-card` / `$shadow-sheet` 以免影响其他页面。

### 设计师明确「不该动」清单

一晚两笔账与总价 ¥168–238；合计两行式；分隔线位置与上 32/下 24rpx；链接留在卡外；CTA 紫色与 40rpx/700、无渐变无发光；不新增吉祥物、入场动画或账块点击感；活动头与酒局 badge 不加装饰。

§11 的 APPROVE 仍然有效；本节为增强方案，第 1–7 项及 320 窄屏规则均已批准。规格数值冲突时以本节打磨值为准；真机验收仍以 WeChat DevTools 为准，HTML 截图不能替代。
