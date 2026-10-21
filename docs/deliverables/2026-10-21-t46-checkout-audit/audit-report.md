# T46 验收审计报告 — AC-06 (P0d 收银台退款叙事) + AC-07 (P1a 收银台同行入口)

> 审计方：QA Agent（T46 收银台合并审计车 S5.3 + P1a）· 日期：2026-10-21
> 范围：`apps/mini-program/src/pages/payments/event-ticket-payment/`（payments 子包）
> - P0d：`components/RefundGuaranteeLine.tsx` 两行 stack + `lib/experimentBucket.ts`（server）+ ritual-context 挂载 + 曝光埋点
> - P1a：`components/DuoEntryLink.tsx` + duo-status 门控 + impression/tap 埋点
> 铁律遵守：未改任何业务/实现代码 · 未 commit · 未 push · 唯一工作树改动是截图审计工具链（§4.2/§4.3，已在盘上逐字复核）

---

## ⚠️ 0. 环境约束（必读，影响结论置信度）

本审计沙箱**无 shell 执行能力**（与 2026-10-20 详情页审计车同一限制，`search` 已确认目录内无 shell/terminal/exec 工具）。因此：

| 能力 | 状态 | 影响 |
|---|---|---|
| 读取源码 / 文档 / grep | ✅ 可用 | 源码级 AC 核对完整完成（§2/§3） |
| 运行 §8 六条命令门禁 | ❌ 无 shell | **全部 ⛔ 未执行**，给出精确复跑命令；不伪造输出 |
| H5 构建 + Playwright 截图 | ❌ 无 shell | **五张合并门禁截图 ⛔ 未产出**；已把完整 generator 落入工具链（§4），降级为「记录复跑命令」（任务允许） |
| 审计链四件（scanner） | ❌ 无 shell | 按技能 rubric 做 Read-in-code 评分，全部标 provisional，与 10-20 报告同口径 |

**凡标 ✅ = 源码级验证通过（file:line 证据）；凡标 ⛔/⚠️ provisional = 命令/渲染未执行。**

---

## 1. 门禁总表

| # | 门禁 | 阈值 | 结果 | 证据 |
|---|---|---|---|---|
| G1 | AC-06 源码级逐条 | 全 PASS | ✅ 6/6 PASS | §2 |
| G2 | AC-07 源码级逐条 | 全 PASS | ⚠️ 5/6 PASS + **1 项发现 BLOCKING-1**（跳转语义，非行内渲染） | §3 |
| G3 | 五张合并门禁截图 | 5 张 + CTA 结论 | ⛔ 未产出（generator 已就绪） | §4 |
| G4 | ui-layout-audit | 0 error | ⚠️ provisional 0 error（1 advisory） | §5.1 |
| G5 | frontend-design-audit | ≥16/20 零 Class A | ⚠️ provisional 19/20 零 Class A（Dim1=4 已入档） | §5.2 |
| G6 | completeness-audit | ≥32/44 零 P0 | ⚠️ provisional 40/44 零 P0 | §5.3 |
| G7 | performance-audit | **PASS**（P0d/P1a 强制） | ⚠️ provisional PASS 53/60 | §5.4 |
| G8 | 情绪 rubric 补漏（P0c/P0e） | 各 ≥12/24 | ⚠️ P0e 12/24 ✅ · **P0c 11/24（差 1，待裁决）** | §6 |
| G9 | 文案双签 | 清单 + 🔴🟠 证据 | ✅ 清单出炉（双签是人类动作） | §7 |
| G10 | §8 命令门禁六连 | 全绿 | ⛔ 未执行（复跑命令已给） | §8 |

---

## 2. AC-06 逐条判定（P0d 收银台退款叙事 50/50）

| 条款 | 判定 | 证据（file:line） |
|---|---|---|
| 叙事上 / 事实下两行 stack | ✅ PASS | `RefundGuaranteeLine.tsx:27-32` — bucket 1 时叙事行（:28-30）条件渲染在事实行（:32）**之上**；渲染测试 `RefundGuaranteeLine.render.test.tsx:34-55` 断言行数=2、首行叙事含 `--narrative` modifier、`compareDocumentPosition` 证明叙事行在事实行之前。事实行「排桌完成前取消，全额退款」永不删除（组件 docblock :14-16；设计 ⚠1 解法落地） |
| spacer 282rpx 推导复算 | ✅ PASS（数学复核一致） | `index.scss:344-366`：基线 200rpx；stack 块 = margin-top 12rpx + 行盒 33rpx（`$font-size-xs: 22rpx` `_variables.scss:184` × line-height 1.5 `index.scss:1184`）+ 行距 4rpx（`:1197-1199`，注释登记 8rpx 节奏 hairline 例外）+ 33rpx = 82rpx；200+82=**282rpx** 精确。`ticketHelpers.test.ts:399-402` source-lock：含 `ticket-bottom-spacer--with-guarantee-stack` 且 **不含** `getBoundingClientRect`。bucket 0 走 D3 既有 248rpx 不动（:350-352） |
| flag-off null tree | ✅ PASS | 组件 `:24` `if (!visible) return null`；渲染测试 `:21-30` 覆盖 `visible=false` 与 `visible=undefined` 双路径 `firstChild===null`。服务端同源 fail-closed：`payments.ts:1347-1350` flag off → `refundNarrativeBucket=null`；`:1391-1393` 条件展开字段缺省；契约测试 `experimentBucket.test.ts:116-121` 用正则锁「flag off → 字段省略」 |
| 曝光 per-visit 去重 | ✅ PASS | `index.tsx:413-421`：`hasTrackedRefundGuaranteeImpressionRef`（声明 :142）前置短路；两桶均打点（bucket 元数据 `refundNarrativeBucket ?? 0` + poolId，零 PII，注释 :402-412 明确不骑 `event_ticket_payment_view`）；error-settled 读按 bucket 0 计量与渲染回落一致。`vipCheckoutGuards.test.ts:404-408` source-lock |
| 零 JS 测量 | ✅ PASS | `grep boundingClientRect|createSelectorQuery|getWindowInfoCompat|measure` 于 `pages/payments/**` 仅命中测试文件的**否定断言**（`ticketHelpers.test.ts:401`）；两桶高度全部 CSS 预留（`index.tsx:1440-1448` spacer 类名切换纯渲染前确定，`index.scss:356-360` 注释「CSS-reserved，禁 JS 测量后补」） |
| 50/50 分桶稳定 | ✅ PASS | `experimentBucket.ts:38-45`：`sha256(userId).hex.slice(0,8) % 2`，无随机/时间/存储；非法输入 fail-closed → 桶 0（:34-40）。`experimentBucket.test.ts:29-53` 确定性 + golden vectors 钉死算法；:55-75 2000 样本 45–55% 分布；:77-101 边界输入永不抛错。客户端解析 `ticketHelpers.ts:53-58` 只认字面 0/1，异常一律归控制组。**挂载链同 handler**：`payments.ts:1341-1350` 与 flag 同解析；桶键 = session userId（`payments.ts:1227`），跨设备/重启稳定 |

**AC-06 结论：源码级 6/6 PASS。**

附加 verified：零动画（`RefundGuaranteeLine` docblock :20-21「Zero animation by design — 收银台编排预算为零」；SCSS :1174-1200 块内无 transition/animation 属性）——设计 §5.3.2 允许 200ms 级联但非强制，实现取零，在预算内。

---

## 3. AC-07 逐条判定（P1a 收银台同行入口）

| 条款 | 判定 | 证据（file:line） |
|---|---|---|
| 文本链接 register | ✅ PASS | `DuoEntryLink.tsx:63-74`：单行（主文案+轻量 hint+›）、`hoverClass='ticket-duo-link--pressed'`；测试 :114-118 断言行 classList.length===1（无 card/button/badge chrome）、`role='button'`。SCSS `index.scss:1134-1167` 与 `ticket-refund-link`（:1100-1123）同族，88rpx min-height 偏差有注释备案（:1126-1133）。**插入位置正确**：`index.tsx:1414-1417` 恰在 trust-row（:1408）之下、退款政策链接（:1418）之上，ScrollView 内、不进 fixed footer（设计 §P0a/P1a 位置规格逐字满足） |
| 零金额零 urgency | ✅ PASS | source-lock 测试 `DuoEntryLink.render.test.tsx:179-199`：源码零 `¥`/`立得`/`现金`/`提现` + 🔴 词表（匹配/社交/灵魂/AI/算法/智能）零命中；hint「同行有奖励」SCSS 用 `$ticket-text-muted`（`index.scss:1150-1156` 注释「muted so it never reads as urgency」） |
| fail-closed 门控 | ✅ PASS | 页级门 `index.tsx:210-211,1416`：`enabled = Boolean(user?.id) && Boolean(poolId) && duoRegistrationEnabled`（`poolId` 为空串时 query 不发射）；组件级 `:36-44`：`enabled && Boolean(poolId)`、`retry:false`、`visible = isSuccess && data?.state==='none'`。测试矩阵 :79-137：enabled=false 不渲染不请求 / loading 静默 null / error null / `waiting` null / `bound` null / 仅 `none` 渲染。门控失败永不阻塞首屏（行在 scroll 流内，footer 不受影响，`index.tsx:1409-1413` 注释明示）。服务端 kill switch 真实存在：`featureFlags.ts:93,538`（`DUO_REGISTRATION_ENABLED`，default true，admin 可关）、`buildAuthUserResponse.ts:214`、`duo.ts:58` |
| haptics | ✅ PASS | `DuoEntryLink.tsx:56` `haptics('light')`；测试 :141-153 断言 |
| 埋点发射 | ✅ PASS | 客户端 union `discoverAnalytics.ts:151-152` + 发射函数 :377-383；服务端 allowlist `analytics.ts:318-319`；**双向 parity 契约锁** `discoverAnalyticsAllowlistContract.test.ts:27-34`（T46_CONVERSION_EVENTS 含 duo_entry_link_impression/tap，client⊆server 与 server⊆client 双向）。曝光 per-visit 去重 `DuoEntryLink.tsx:45-53` + 测试 :155-176（rerender 不重复计量）；tap 计量 :57 |
| 一屏一主 CTA | ✅ PASS | duo 行无实心填充（SCSS 基态零 background，仅 pressed tint `rgba($color-primary,0.06)` :1164-1166）；全页唯一 solid primary 仍是 `.ticket-cta`（`index.tsx:1465-1481`）；行内零动画（SCSS 块无 transition/animation；§5.3.4「入场随 trust row 同帧、不 stagger」预算内取零） |
| **跳转目标语义（设计 §P1a：跳转 = Duo 邀请链路）** | ❌ **FAIL → BLOCKING-1** | 见 §3.1。**行内渲染全部合规，但 tap 落地页在收银台生命周期内无法兑现「排进同一桌」** |

### 3.1 BLOCKING-1：DuoEntryLink 跳转未携带 poolId，落地页 duo 车道对收银台 pool 必然不可达

**证据链（逐环 file:line）：**

1. `DuoEntryLink.tsx:58`：`Taro.navigateTo({ url: MINI_PROGRAM_ROUTES.invite })` —— **query 为空**，落地页不知道用户正在为哪个 pool 付款。
2. 落地页 duo 车道绑定的是「用户已有报名」：`pages/profile-linked/invite/index.tsx:79` `activeSharePoolId = myRegistrations?.[0]?.poolId`；:123-129 `createDuoInvite` 仅在 `Boolean(activeSharePoolId)` 时启用；:130-133 shareMode 由该 query 结果决定，失败回落 referral。
3. 收银台时刻该 pool **不存在报名行**：`userEventPools.ts:715-723` 注册端点在 entitlement 门（`NO_ACTIVE_ENTITLEMENT` 403）**之前返回**——即用户就是因为在该 pool 没有可用权益才被 handing off 到支付页（与 mock `payment_return_context.handoffCode:'NO_ACTIVE_ENTITLEMENT'` 一致，`screenshot-server.mjs:251` 同款 fixture）。
4. 因此落地页只能走 referral 兜底——而该页自己的注释禁止 referral 路径承诺同桌：`invite/index.tsx:21-26`「never promise '同一桌' from a referral share」。
5. 服务端能力其实已就绪：`duo.ts:46-83` `POST /api/pools/:id/duo-invites` 只要求 pool active/open + flag on，**不要求 inviter 已有报名行**，且幂等——阻塞纯粹是客户端导航没传 poolId。

**后果**：主流路径（首访支付、无其他在报名局）下，用户点「和朋友一起？邀 TA 同行，排进同一桌」→ 落到只能发推荐码的页面 → 同行入口的核心承诺无法兑现。若用户另有在报名局，则为**错误的 pool** 生成 duo 码。

**修复方向（只报告，不代改）**：① `DuoEntryLink` 导航带 `?poolId=${poolId}`；② invite 页 duo query 优先消费 query poolId（服务端无需改动）；③ 补一个 source-lock/行为测试锁「duo entry 导航携带 checkout poolId」。影响半径小（两文件 + 测试）。

> 说明：AC-07 的六条「行内」条款全部 PASS；本条是设计 §P1a「跳转目标 = Duo 邀请链路」的端到端语义验收，判 BLOCKING（合并阻断）。

---

## 4. 截图证据（合并门禁）

### 4.1 结论

⛔ **五张截图未产出**——沙箱无 shell，无法 `build:h5`、无法起 `mock-h5-server.mjs`(:5001)/`screenshot-server.mjs`(:9000)、无法跑 Playwright（与 10-20 审计车 §7 同一 blocker，不伪造截图）。

### 4.2 已交付的截图工具链（本次唯一工作树改动，全部盘上复核）

- **新增** `scripts/screenshot/generators-checkout-t46.mjs`：五个 capture，沿用 `generators-event-detail.mjs` 的 state-extension 先例（auth/user override + ritual-context 注入 + duo-status 门控）。**每张 capture 内建 `assertVariantAndMeasureCta`**：先断言 DOM 状态精确匹配（行数 0/1/2 + narrative modifier + duo 行有无），再测量 footer/CTA/duoRow 的 bounding box 并验证 CTA 首屏可见，**不符即让该张捕获直接失败**（带测量 JSON），杜绝静默产出错误状态截图。
- **登记** `scripts/screenshot-server.mjs:10,169`（import + register，diff 已复核）与 `scripts/screenshot-open.mjs:94-116`（五个 PAGES 入口）。
- 状态矩阵：①flag off 基线（**duoRegistrationEnabled=false 走真实 kill switch**，非 duo-status hack，逐像素对齐线上现状）②bucket 0 单行 ③bucket 1 两行 ④bucket 1 + duo 可见（375×667，合并关键帧）⑤=④ 的 320×568。

### 4.3 复跑命令

见 `screenshots/README.md`（含一键 curl 落盘到本目录 + 关停命令）。复跑后需把五张 PNG 的 CTA 测量日志（`[checkout-t46] ... {"ctaFirstScreenVisible":true,...}`）贴回 PR。

---

## 5. 审计链四件（Read-in-code provisional，render 阻断）

> 口径与 10-20 报告一致：所有「视觉/平台安全/视觉完成度」维度的 render 验证待 DevTools，分数为 provisional；零 Class A 仅能源码级确认。

### 5.1 ui-layout-audit — provisional 0 error（1 advisory）

- ✅ 层序（footer）：CTA → caption(s) → error 槽；信任簇：trust row(24rpx 32rpx 边距, :937-942) → duo 行(16rpx 32rpx, :1139) → refund link(12rpx 32rpx, :1105) → abandon。页边距 32rpx 全簇对齐 trust row ✅
- ✅ 字阶：叙事行 `$color-text-secondary` 比事实行 `$ticket-text-muted` 深半阶（:1187-1193 注释备案，阅读次序=先情绪后承诺）；22rpx caption × 1.5 行高
- ✅ 零内联 emoji（grep + 测试双锁）；孤字不适用（居中短句，375pt 下行宽充裕）
- ✅ touch target：duo 行 88rpx min-height；CTA 在 fixed footer 内，首屏可见性由构造保证（667px render 复跑确认 pending）
- ✅ 4rpx caption 行距 = 设计 §P0d 明文允许的 hairline 微调且已注释（:1195-1199）
- ⚠️ **advisory**：duo 行上 16rpx / 下 12rpx 的簇内混距（12rpx 为 refund link 存量值，设计明确「follows unchanged」）——记录在案，不阻断

### 5.2 frontend-design-audit — provisional 19/20，零 Class A（源码级）

| Dim | 分 | 依据 |
|---|---|---|
| 1 品牌保真 & 反模式 | 4 | System UI register、muted caption、承诺句零装饰（§5.3.2 防爆红线遵守）、canonical 术语、纯色 primary、零 emoji、无 AI-slop。**信任面 Dim 1 证据入档（设计 §4 要求）** |
| 2 状态完备 | 4 | P0d 三态（off null / bucket0 单行 / bucket1 stack）+ P1a 六态（off/loading/error/none/waiting/bound）全矩阵有渲染测试 |
| 3 主题 & token 纪律 | 4 | 全部 `$font-*`/`$color-*` token；4rpx 例外有注释；pressed tint `rgba($color-primary,0.06)` 全站惯例 |
| 4 响应式 & 平台安全 | 3 | 88rpx touch、rpx-only、**无 min()/max()/clamp()**（grep 全 SCSS 零命中）、H5 内联 rpx 陷阱不涉及（无 JS 内联样式）；320×568 渲染待复跑 |
| 5 性能 & 动效卫生 | 4 | **零新增动画**（编排预算为零）、无 height/margin 动画、无 loop；reduced-motion 无需额外处理（静态直出） |
| 合计 | **19/20** | 零 Class A（源码级）；render 级 Class A 确认待 §4 截图 |

### 5.3 completeness-audit — provisional 40/44，零 P0 gap

| 维度 | 分 | 备注 |
|---|---|---|
| 1 功能 | 4 | 灰度桶 + duo 状态机双矩阵，fail-closed 全覆盖 |
| 2 状态 | 4 | loading 静默 null / error null / 双 kill switch |
| 3 文案 | 3 | canonical + 零红线；**FAQ eng-lead 双签未落**（§7，流程 gap） |
| 4 交互 | 4 | hoverClass tint + haptics('light') + 埋点双发 |
| 5 愉悦 | 3 | 信任面按设计取安静（编排预算零），按压物理齐 |
| 6 流程 | 2 | **受 BLOCKING-1 拖累**：入口→落地 duo 链路断一环（修复后回 4） |
| 7 无障碍 | 3 | role/aria-label/≥88rpx；同簇 refund link 无 role 的惯例不一致（NIT-2） |
| 8 Taro 纪律 | 4 | 子包 13 选择器全登记（`verify-subpackage-styles.mjs:182-211`：存量 7 + P0d 2 + P1a 4，无 sub-common.wxss 风险——SCSS 全在 page index.scss）；BEM 齐；无 JS 测量 |
| 9 视觉完成 | 3 | 来自 ui-layout（render 阻断待复跑） |
| 10 品牌灵魂 | 4 | = design Dim 1 |
| 11 运营 | 4 | 灰度护栏埋点齐、双 flag 均有 admin kill switch、桶算法零存储零依赖 |
| 合计 | **40/44** | 坚稳档；**BLOCKING-1 修复后 42/44** |

### 5.4 performance-audit — provisional **PASS 53/60**（P0d/P1a 强制项）

| 维度 | 分 | 依据 |
|---|---|---|
| 流畅度 | 9 | 零新增动画/零 layout thrash；caption 行 = 一个静态布局行 |
| 速度 | 9 | bucket 骑既有 ritual-context 首屏 payload（**零新增请求**）；duo-status 一次非阻塞 GET（enabled 门控、retry:false） |
| 设备适配 | 8 | rpx + 88rpx；320×568 实机验证待复跑 |
| 内存安全 | 9 | 无新缓存/监听器/定时器；dedup 用 ref |
| 网络韧性 | 9 | ritual-context 失败 → bucket null → 控制组渲染；duo 失败静默隐藏；retry:false 无重试风暴 |
| 包体积 | 9 | 两小组件 + 子包内 SCSS；主包零增量；选择器登记零资产 |
| **Gate** | **PASS**（≥48 且无 <6） | 待 `scripts/perf-audit-collect.mjs` + DevTools 实机复核后转正 |

---

## 6. 情绪 rubric 补漏（P0c + P0e，组件级，≥12/24 门槛）

> 依据 `docs/reference/emotional-value-rubric.md` 六维。详情页两件在 10-20 审计车**未含** rubric，此处补打；不重复跑截图（指令允许）。

### P0e EventFaqAccordion — **12/24 ✅（压线过门槛）**

| 维度 | 分 | 证据 |
|---|---|---|
| 归属感 | 2 | 「几个人同桌」「认识几位新朋友」「同桌的人更合拍」（eventFaqCopy.ts:44,54）——有社群意象但无成员身份锚 |
| 成就感 | 1 | 无完成时刻（静态信息面，结构性封顶） |
| 身份认同 | 2 | System UI register + canonical 词；「悦仔会参考你们的活动偏好、年龄、职业」（:54）——用户被当作有偏好的个体，但无身份徽章 |
| 惊喜感 | 2 | 开合「回应感」编排（exit-then-enter 150/250ms + chevron 200ms，EventFaqAccordion.tsx:77-116）是标准好模式，非个人化惊喜 |
| 被理解感 | 3 | **本组件即「懂我」面**：八问精准覆盖真实焦虑（这是什么局/订座后/谁同桌/地点揭晓/取消退款/安全/不喝酒/带朋友，eventFaqCopy.ts:40-81），且 who_sits_together 答案引用用户自身偏好数据 |
| 仪式感 | 2 | Q→A 有因果时序与触觉（haptics('light')），是轻仪式非盛典 |
| 合计 | **12/24** | 功能满足上限；WTP 瓶颈在成就感/惊喜感（被理解感已拉满该面天花板） |

### P0c EventFlowStrip — **11/24 ⚠️（差 1 分，待 orchestrator 裁决）**

| 维度 | 分 | 证据 |
|---|---|---|
| 归属感 | 2 | 四拍隐含「一桌人聚齐」叙事（集结房间等开席/现场入座，EventFlowStrip.tsx:38-43），无社群称谓 |
| 成就感 | 1 | 无（结构性封顶，同上） |
| 身份认同 | 2 | 安静事实 register、首节点纯色描边；对全用户无差异（信任面禁止个性化，设计 §1 明文） |
| 惊喜感 | 2 | 连接线 one-shot scaleX 绘制（630ms ≤700ms，SCSS:107-115）是一件工艺级微时刻；非「为我而作」 |
| 被理解感 | 2 | 在信息卡之后立刻回答「然后呢？」——语境位置聪明（index.tsx:185-228 插入点），但内容对所有用户一致 |
| 仪式感 | 2 | 四拍预先排演参与仪式 + 首拍标记「下一步」；静态陈列非过渡 |
| 合计 | **11/24** | 距 ≥12 差 1 |

**裁决建议（不代决）**：三维被结构性封顶（成就感=静态信息面无完成时刻；身份/归属=信任面设计红线禁止个性化）。若按「详情页信任栈（P0c+P0e 合并面）」口径计，合并体验已达门槛（被理解感 3 + 仪式感 2 由两件共享）。备选：把 P0c 惊喜感评 3（「每 flow 一个清晰 delight 时刻」——连接线绘制即详情页信任栈的唯一编排时刻，设计 §5.3.1 精品参照 Linear），则 12/24 压线。**组件级严格口径 = 11，本审计据实记录为 CONCERN-2（C2）。**

---

## 7. 待双签文案清单（🔴🟠 合规证据 + 签署状态）

> 双签本身是 PM+eng lead 人类动作；本清单只列证据。grep 口径：`匹配|社交|灵魂|AI|算法|智能|担保|认证`（🔴）+ `仅剩|抢手|立得|现金|提现|¥`（诱导/金额）。

| # | 文案 | 位置 | 🔴🟠 grep 证据 | 状态 |
|---|---|---|---|---|
| 1 | 这一桌已经写上你的名字 | RefundGuaranteeLine.tsx:29 | 零命中（grep 全组件）；无语气词（无 ~/啦/哦） | **待双签**；承诺层依赖 P0a 行为证据（设计 §4） |
| 2 | 排桌完成前取消，全额退款 | RefundGuaranteeLine.tsx:32 | 零命中 | **待双签**（同附 P0a 灰度证据链接） |
| 3 | 和朋友一起？邀 TA 同行，排进同一桌 | DuoEntryLink.tsx:71 | 零命中；测试 :179-199 source-lock | **待双签** |
| 4 | 同行有奖励（hint 挂件） | DuoEntryLink.tsx:72 | 零金额零诱导词（测试锁 ¥/立得/现金/提现）；设计 §P1a 明文批准的轻量挂件 | **待双签**（需附 WeChat 诱导分享评审口径：金额/规则只在落地页） |
| 5-12 | FAQ 8 条（这是什么局/订座后/谁同桌/地点揭晓/取消退款/支付到场/不喝酒/带朋友） | eventFaqCopy.ts:40-81 | 用户可见文案零命中（唯一命中是 :17 模块头注释的自检描述）；全部 ≤60 字，🟡 waiver 已登记（:21-24）；cancel_refund 条渲染门控依赖 P0a（:26-28 依赖提示） | **PM 已签认；eng lead 待 PR 复核**（:8-9）——10-20 审计 N3 延续 |
| 13 | 这周有 N 场正在排桌（N=live query） | GuestEventPreviewSection.tsx:247 | 零命中（含 仅剩/抢手）；N 恒为服务端供给真实计数（:242-246 注释） | **待双签** |
| 14 | 怎么参加 + 四拍标签（订座/悦仔排桌/集结房间等开席/现场入座） | EventFlowStrip.tsx:38-43,57 | canonical 术语表零命中 | 低风险，随 #5-12 同批签 |

---

## 8. 命令门禁摘要（⛔ 全部未执行——沙箱无 shell；零伪造）

| 命令 | 状态 | 复跑要点 |
|---|---|---|
| `npm run guardrails` | ⛔ | 关注：payments SCSS 无 min/max/clamp（已源码级 ✅）、无内联 emoji、BEM 无新 orphan、design-audit --scope changed |
| `npm run test -w mini-program` | ⛔ | 重点文件：`RefundGuaranteeLine.render.test.tsx`（8 例）、`DuoEntryLink.render.test.tsx`（11 例）、`ticketHelpers.test.ts`、`vipCheckoutGuards.test.ts` |
| `npm run typecheck -w mini-program` | ⛔ | 走查已过：DuoEntryLink props {poolId:string, enabled:boolean} 与页级传入匹配；poolId state 为 string（index.tsx:151-158） |
| `npm run build:weapp -w mini-program && npm run verify:subpackage-styles -w mini-program` | ⛔ | payments 页 13 选择器全登记（源码级 ✅ :182-211）；确认无非空 sub-common.wxss |
| `npm run test -w @joyjoin/server`（全量 + AllowlistContract） | ⛔ | 重点：`experimentBucket.test.ts`（3 describe）、`discoverAnalyticsAllowlistContract.test.ts`（双向 parity） |
| 审计链 scanner（`audit:visual` / `design:audit:changed` / `perf-audit-collect`） | ⛔ | render 转正用；命令见 §4.2 与 §5 |

**源码级等价复核已覆盖**：🔴 词表、min/max/clamp、内联 emoji、BEM class-coverage（两组件全部 `__` 类在 page SCSS 有定义）、legacy import、JS 测量——全部零命中/齐配。命令级 PASS 需 shell 环境复跑后关闭。

---

## 9. 分级清单

### BLOCKING（合并阻断）

| # | 问题 | 证据 | 修复方向 |
|---|---|---|---|
| **B1** | **DuoEntryLink 跳转未携带 poolId → 落地页 duo 车道对收银台 pool 必然不可达**，「排进同一桌」承诺在主流路径无法兑现（详见 §3.1 五环证据链：DuoEntryLink.tsx:58 / invite/index.tsx:79,123-129 / userEventPools.ts:715-723 / invite/index.tsx:21-26 / duo.ts:46-83） | §3.1 | 导航带 `?poolId=` + invite 页 duo query 优先消费 query poolId + 契约测试锁。服务端零改动（duo-invites 已幂等且不要求 inviter 报名行） |

### CONCERN（非阻断，建议同车处理/裁决）

| # | 问题 | 处置建议 |
|---|---|---|
| C1 | eng-lead 侧双签未落（eventFaqCopy.ts:8-9；10-20 N3 延续），且 P0d 事实行/FAQ cancel_refund 条双签需附 P0a 行为证据链接 | 合并前补齐签认记录入 PR |
| C2 | P0c 情绪 rubric 组件级 11/24，差 1 分（§6：三维被结构性封顶） | orchestrator 裁决：组件级豁免 / 信任栈合并口径 / 惊喜=3 重评 |
| C3 | duo 行 60s staleTime 的 duo-status 缓存：若在别处刚建 duo lane，行最长 60s 内仍可见（tap 后落地页自身状态机兜底的低危窗口） | 可接受；如需严谨可在 tap 前 invalidate |
| C4 | 五张合并门禁截图 + §8 六条命令门禁未执行（环境） | merge 前置，按 §4.2/§8 复跑关闭 |

### NIT（记档）

| # | 问题 |
|---|---|
| N1 | 同簇 a11y 惯例不一致：duo 行有 `role='button' + aria-label`，其 register 先例 refund link 两者皆无——建议全簇统一 |
| N2 | duo 行上 16rpx / 下 12rpx 簇内混距（12rpx 为存量值，设计备案） |
| N3 | FAQ 缺 `aria-controls`（10-20 N2 已记档，此处不重复计数） |
| N4 | 4rpx caption 行距为 8rpx 节奏例外，已有注释；若 repo 有 exceptions 登记惯例可顺手登记 |

---

## 10. 总结论

- **AC-06：源码级 6/6 PASS**（叙事/事实叠放、282rpx 推导复算一致、flag-off null tree、曝光 per-visit 去重、零 JS 测量、50/50 确定性分桶全链路有测试锁）。
- **AC-07：行内 6/6 PASS；端到端跳转语义 1 项 BLOCKING（B1）**——行本身完美，落地链路断一环，服务端能力已就绪、客户端修复半径小。
- **审计链**：design 19/20 · completeness 40/44（B1 修复后 42）· perf PASS 53/60 · rubric P0e 12 ✅ / P0c 11 待裁决——全部 provisional，待命令门禁 + DevTools 截图转正。
- **合并不建议**：B1 修复 + 双签补齐 + §8 复跑绿 + 五张截图入 PR 后，可合并。
