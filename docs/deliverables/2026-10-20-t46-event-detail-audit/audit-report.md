# T46 验收审计报告 — AC-04 (P0c EventFlowStrip) + AC-05 (P0e EventFaqAccordion)

> 审计方：QA Agent（DeepSeek V4 Pro）· 日期：2026-10-20
> 范围：`apps/mini-program/src/pages/event-detail/`（主包，非子包）
> - P0c `components/event-detail/EventFlowStrip.tsx` + `EventFlowStrip.scss`
> - P0e `components/event-detail/EventFaqAccordion.tsx` + `EventFaqAccordion.scss` + `packages/shared/src/copy/eventFaqCopy.ts`
> 铁律遵守：未改任何业务代码 · 未 commit · 未 push · 避让 `pages/icebreaker-session/**`

---

## ⚠️ 0. 环境约束（必读，影响结论置信度）

本审计在受限沙箱中执行，**无 shell 执行能力、且已达 subagent 嵌套深度上限（无法派生子代理）**。因此：

| 能力 | 状态 | 影响 |
|---|---|---|
| 读取源码 / 文档 | ✅ 可用 | 源码级行为验证完整完成 |
| grep 静态检查 | ✅ 可用 | 🔴 词表 / min-max-clamp / emoji / BEM 全查过 |
| 运行 `npm run guardrails` | ❌ 无 shell | 命令级门禁**未执行**，改为源码级等价复核 |
| 运行 `npm run typecheck -w mini-program` | ❌ 无 shell | 同上（tsc 未跑，改为逐文件类型走查） |
| 运行 `npm run test -w mini-program` | ❌ 无 shell | 未执行 |
| 运行 `check-cdn-icon-coverage` | ❌ 无 shell | 改为清单/映射源码复核（见 §3.3） |
| H5 构建 + DevTools/H5 截图 | ❌ 无 shell（无预构建 dist，端口 5001 mock 未起） | 截图**被阻断**，按任务规定以静态分析替代（见 §7） |

**任何标 ✅ 的项均为「源码级验证通过」；任何标 ⛔ 的项为「命令/渲染未执行」。不伪造命令输出、不伪造截图。**

---

## 1. 门禁总表

| # | 门禁 | 阈值 | 结果 | 证据 |
|---|---|---|---|---|
| G1 | `npm run guardrails` 0 error | 0 error | ⛔ 未执行（无 shell） | §2 源码级等价复核 |
| G2 | `npm run typecheck -w mini-program` 绿 | 绿 | ⛔ 未执行（无 shell） | §2 类型走查 |
| G3 | `check-cdn-icon-coverage` 绿 | 绿 | ✅ 源码级 | §3.3 |
| G4 | ui-layout-audit 0 error | 0 error | ⚠️ 源码级（render 阻断） | §4 |
| G5 | frontend-design-audit ≥16/20 零 Class A（Dim 5 ≥3） | ≥16/20 | ⚠️ 源码级 19/20（provisional） | §5 |
| G6 | completeness-audit ≥32/44 零 P0 | ≥32/44 | ⚠️ 源码级 39/44（provisional） | §6 |
| G7 | copy 🔴 词表零命中 | 零命中 | ✅ | §3.1 |
| G8 | 源码级行为验证 | 全过 | ✅ | §3.2 |
| G9 | DevTools 667px + 320px 截图 | ≥1 张/档 | ⛔ 阻断（无 shell） | §7 |

---

## 2. 静态门禁源码级等价复核（G1/G2 替代）

因无 shell，逐条对 guardrails 链的**与本次改动相关**检查做源码级等价复核：

| guardrails 检查项 | 源码级结果 |
|---|---|
| 内联 emoji（`apps/mini-program` TS/TSX） | ✅ 两新组件零内联 emoji；grep emoji 区间仅命中注释里的 → 箭头（非 emoji、非正文） |
| BEM class-coverage 无新增 orphan | ✅ 两组件所有 `__` 类均在同 PR SCSS 有定义（§3.2.1 逐条枚举） |
| legacy identifier / 根 `shared/` import / 跨 app import | ✅ `@shared/copy/eventFaqCopy` 走 `@shared/*` alias（tsconfig + config/index.ts:447 → packages/shared/src），无 legacy `shared/` 导入 |
| design-audit `--scope changed --fail-on error` | ✅ 两 SCSS 无 `min()/max()/clamp()`、无 layout-triggering animation、CJK 无 `overflow-wrap:anywhere` |
| subpackage style-splitting | ✅ event-detail 在主包；组件 SCSS 用 `@use` 进 `pages/event-detail/index.scss`（无 TSX side-effect import）——符合 AGENTS.md 惯例 |
| check-icebreaker-visuals | 不适用（未触碰 `pages/icebreaker-session/**`，已避让） |

**类型走查（G2 替代）**：EventFaqAccordion 依赖 `@shared/copy/eventFaqCopy`（`EVENT_FAQ_ITEMS` + `EventFaqItem`）、`getSystemReducedMotion()`（返回 boolean）、`haptics('light')`（HapticType 联合含 light）、`localAsset()`；EventFlowStrip 依赖 `localAsset()`、`getSystemReducedMotion()`。所有导入目标已确认存在且签名匹配。`user?.features?.preRevealRefundEnabled === true` 类型匹配 `AuthUserResponse.features.preRevealRefundEnabled?: boolean`（`packages/shared/src/api/auth.ts:233`）。

> ⚠️ 说明：上述为**等价复核**，不能替代真实 `tsc --noEmit` 与 guardrails 全链（含 8 条存量 window/px warning 的精确计数）。命令级 PASS 需 shell-capable 环境复跑。

---

## 3. 源码级验证详证

### 3.1 copy 🔴 红线（G7）— ✅ 零命中

对 `eventFaqCopy.ts` 全部 question/answer 用户可见文案 + 两组件内文案 grep `匹配|社交|灵魂|AI|算法|智能|担保|认证`：

- **零命中**（唯一匹配是 line 17 的注释文字，非用户可见 copy）。
- 使用 canonical 词：排桌 / 桌友 / 合拍 / 悦仔 / 集结房间 / 破冰 / 入座。
- **无虚构数字**：全部答案定性表述（「几个人同桌」「双方会排进同一桌」），无静态人数/百分比/金额——符合「社会证明必须 live query，此组件无数字 = 正确」。
- 「平台支付闭环、真人到场核销」（`payment_checkin`）为事实陈述，未派生「平台担保/官方认证」越界承诺。
- 8 条 FAQ 全部 ≤60 字（🟡 waiver 已在 copy 文件头登记：解释性内容豁免「描述 ≤25 字」，目标 ≤60 字/条）。

8 条清单（`id`）：`what_is_this` / `after_booking` / `who_sits_together` / `location_reveal` / `cancel_refund` / `payment_checkin` / `no_drinking` / `duo_together` ✅（含「平台支付闭环，真人到场核销」）。

### 3.2 组件行为验证（G8）— ✅

#### EventFlowStrip（P0c）
- ✅ `role='list'` + `aria-label='参加流程'` + 4× `role='listitem'`（TSX:58,67）
- ✅ canonical 四标签：订座 → 悦仔排桌 → 集结房间等开席 → 现场入座（一字未改）
- ✅ 首节点 primary 描边：`--first` = `rgba($color-primary,0.08)` 底 + `2rpx rgba($color-primary,0.35)` 描边 + label 用 `$color-primary`（SCSS:52-62），纯色禁渐变
- ✅ 图标 bundled `localAsset()`：icon-ticket / icon-status / icon-people / icon-location（均存在 `src/assets/icons/ui/`，且在 `cdn-asset-manifest.json` 有条目）；解码失败降级 8rpx brand dot（TSX:49,76-84）
- ✅ 连接线 one-shot：`scaleX(0→1)` 300ms `cubic-bezier(0.22,1,0.36,1)` delay 0.33s，`transform-origin:left center`；节点 fade+translateY 250ms 同曲线；**无 infinite / 无 loop / 无 replay**
- ✅ 总序列 630ms（250+80+300）≤ 700ms（SCSS 注释 + keyframes 佐证）
- ✅ reduced-motion 双路静态：JS `getSystemReducedMotion()` → `--rm` modifier + `@media (prefers-reduced-motion:reduce)` 双保险 `animation:none`（SCSS:16-21,119-124）
- ✅ 数据就绪后才触发：组件仅在页面 `authLoading||isLoading` 早退（index.tsx:94-101）与 `error||!event` 早退（index.tsx:103-120）之后挂载，连接线绘制永不发生在 skeleton 阶段
- ✅ 无 `min()/max()/clamp()`；CJK 标签 `overflow-wrap` 保持 normal（未用 anywhere）

#### EventFaqAccordion（P0e）
- ✅ `cancel_refund` 仅在 `preRevealRefundEnabled === true` 渲染（fail-closed）：页面 `index.tsx:45` 归一化 `user?.features?.preRevealRefundEnabled === true`，组件 `TSX:73-75` `.filter(id !== 'cancel_refund')`；absent/undefined 一律读 false。flag 已确认服务端下发（`buildAuthUserResponse.ts:231/367` + 契约测试 `checkoutSubscriptionUpsellFlag.test.ts:95-116`）
- ✅ 一次只开一条：`openId/visibleId/exiting` 三态 + `exitTimerRef`；旧答案 150ms 退场（`--exit` → opacity 0）后 `visibleId` 翻转卸载，新答案 250ms 入场，**永不双挂载**（TSX:77-116；快速连点路径已走查，无残留/双开）
- ✅ 禁 height 动画：答案 = 条件渲染 + `opacity 0→1` + `translateY(8rpx→0)` 250ms；exit = `opacity→0` 150ms；chevron 仅 `transform: rotate(45°→225°)` 200ms `cubic-bezier(0.22,1,0.36,1)`；无 spring/bounce
- ✅ chevron 是 CSS 边框（`border-right`+`border-bottom` 3rpx），非 emoji ▾
- ✅ touch target ≥88rpx（`min-height:88rpx`）+ `hoverClass` tint `rgba($color-primary,0.06)` 120ms + `haptics('light')`（TSX:78,137）
- ✅ reduced-motion 瞬时切换：`reduceMotion` 分支直接 `setOpenId/setVisibleId` 无 timer（TSX:84-89）+ SCSS `--rm` + media query 双杀动画
- ✅ 组件内零硬编码 FAQ 文案（全部来自 `EVENT_FAQ_ITEMS`）

#### 两组件 isPoolEvent 门控
- ✅ 均包在 `index.tsx:243-259` 的 `{isPoolEvent ? ... : null}` 内（`event?.source === 'event_pool'`）；非 pool event（blind-box/legacy）详情页字节级不渲染，fail-closed。

#### 3.2.1 BEM class-coverage 逐条核对（两组件 TSX 用到的 `__` 类全部有 SCSS 定义）

EventFlowStrip：`event-flow-strip` / `--rm` / `__title` / `__track` / `__node` / `__node--first` / `__node-icon` / `__node-glyph` / `__node-dot` / `__node-label` / `__connector` ✅ 全定义
EventFaqAccordion：`event-faq-accordion` / `--rm` / `__item` / `__item--open` / `__row` / `__row--pressed` / `__question` / `__chevron` / `__answer` / `__answer--exit` / `__answer-text` ✅ 全定义
页面变体：`event-detail__flow-card` / `event-detail__faq-card` ✅ 在 `index.scss:120/129` 定义

### 3.3 check-cdn-icon-coverage（G3）— ✅ 源码级

EventFlowStrip 用 `localAsset()`（bundled glyph）而非 `JoyJoinIcon`（CDN-primary emojiToIconMap），**未新增任何 (tier, assetKey) 映射**。四个图标文件均存在且已在 `cdn-asset-manifest.json`（icon-location L1178 / icon-people L1190 / icon-status L1202 / icon-ticket L1206）。故 `check-cdn-icon-coverage` 无新增项需校验，逻辑上绿。

---

## 4. ui-layout-audit（G4）— ⚠️ 源码级，render 阻断

Step 0（Rendered-Truth Visual Gate）无法执行（无 shell 起 H5 + Playwright）。以下为 Read-in-code 结果：

- ✅ 8rpx 节奏：节点间距/图标 48rpx（`$icon-slot-md`）/ 连接线 1rpx hairline / `$spacing-*` token 全用
- ✅ 图标+标签 flex column + `align-items:center`（禁 baseline 对齐，L2 陷阱已避）
- ✅ 首节点描边纯色无渐变；灰阶 `$color-text-primary/-secondary/-tertiary` 分层清晰
- ✅ 无 min()/max()/clamp()；无内联 emoji；标题/正文 font-size 分层
- ⚠️ **320px 窄机孤字/折行未验证（render 阻断）**：`集结房间等开席`（6 字）在 320px 下约 61px 字宽 vs 节点约 64px 宽，临界，`-webkit-line-clamp:2` 允许折行，孤字风险无法从源码定论——正是设计稿 §3 标记的「P0c 最大风险」，必须 DevTools 320px 实机确认（见 §7）。

---

## 5. frontend-design-audit（G5）— ⚠️ provisional 19/20（源码级）

> render 阻断，以下为 Read-in-code 评分，Class A「零缺陷」仅能源码级确认（无重叠/裁切渲染证据）。

| Dim | 分 | 依据 |
|---|---|---|
| 1 品牌保真 & 反模式 | 4 | canonical token/术语、纯色 primary、零 emoji、信任面安静事实 register、无 AI-slop |
| 2 状态完备 | 4 | loading（页面级）、glyph 失败降级 dot、reduced-motion、press 态 |
| 3 主题 & token 纪律 | 4 | 全 `$color-*/`$spacing-*/`$font-*` token，8rpx 节奏零例外 |
| 4 响应式 & 平台安全 | 3 | ≥88rpx touch、rpx+media（无 min/max/clamp）、CJK 不 anywhere；**320px 孤字未验证扣 1** |
| 5 性能 & 动效卫生 | 4 | transform/opacity/background only、禁 height、零 loop、one-shot、reduced-motion 静态、时长合规 |
| **合计** | **19/20** | Dim 5 = 4 ≥ 3 ✅ |

---

## 6. completeness-audit（G6）— ⚠️ provisional 39/44（源码级，render 阻断）

| # | 维度 | 分 | 备注 |
|---|---|---|---|
| 1 | 功能完备 | 3 | 主路径+glyph 降级+reduced-motion；无 render 确认 |
| 2 | 状态完备 | 3 | 同上 |
| 3 | 文案完备 | 4 | 8 条双签 copy、零硬编码、零虚构数字 |
| 4 | 交互完备 | 4 | hoverClass tint + haptics + chevron + 单开语义 |
| 5 | 愉悦度 | 3 | 连接线一笔画 + 开合回应感（render 未确认） |
| 6 | 流程完备 | 4 | 流程条→FAQ→客服卡信任递进 |
| 7 | 无障碍 | 3 | ≥88rpx、reduced-motion、ARIA；**缺 aria-controls**（NIT） |
| 8 | Taro 纪律 | 4 | 主包、`@use` 非 side-effect、BEM 齐、无 min/max/clamp |
| 9 | 视觉完成度 | 3 | 来自 ui-layout（render 阻断，320px 未验证） |
| 10 | 品牌灵魂 | 4 | 来自 design Dim 1 = 4 |
| 11 | 运营完备 | 4 | blast radius 低、复用既有 flag（fail-closed）、无新表/新 LLM/新 endpoint |
| **合计** | | **39/44**（坚稳~完美边界，provisional） | 零 P0 gap |

---

## 7. DevTools 截图（G9）— ⛔ 阻断（以静态分析替代，未伪造）

**Blocker**：本沙箱无 shell，无法执行 `npm run build:h5 -w mini-program`（无预构建 `dist/index.html`）、无法启动 `scripts/mock-h5-server.mjs`（探测 localhost:5001/9000/9003 均 unreachable）、且无法派生子代理代跑 Playwright。已按任务规定「截图流程不可用 → 明确记录 blocker + 静态分析替代」处理。

**待 orchestrator 在 shell-capable 环境补齐的截图清单（merge 前置，AC-04 硬项）：**
1. `375×667`（iPhone SE 2/3 档）viewport 截图，重点：EventFlowStrip 四标签无孤字、EventFaqAccordion 首屏位置。
2. `320×568`（iPhone SE 1 档 / 320px 宽）viewport 截图，重点：`集结房间等开席` 6 字标签**是否折行出孤字**（设计稿 §3 标为 P0c 最大风险）。
3. 建议同帧抓 FAQ 展开态，确认展开一条不把客服卡/CTA 顶出可读范围（ScrollView 内自控，不用 scrollIntoView）。

> 复用路径：`scripts/screenshot/generators-event-detail.mjs` 已具备 event-detail 的 mock 路由（`mapEventPoolToEventDetail` 恒设 `source:'event_pool'`，故 mock pool 即可触发 isPoolEvent 渲染两组件）；需改 viewport 为 375×667 / 320×568，并给 `/api/auth/user` override `features.preRevealRefundEnabled=true` 以显示完整 8 条 FAQ。

---

## 8. 发现问题分级

### BLOCKING
**无。**

### CONCERN（非阻断，建议修复/验证后合入）
1. **C1 — 手风琴换条时序与设计稿差 80ms gap**：设计 §5.3.3「旧答案先退 150ms，新答案在其后 **80ms** 入场，单次切换 **<400ms**」；实现为新答案在 150ms 边界即挂载（0ms gap），单次切换恰为 400ms（= 而非 <）。硬约束（一次一条、永不双挂载、禁 height 动画、opacity/transform only）全部满足，仅时序微妙差。→ 属工艺级，不阻断；建议实现方确认是否接受，或补一个 80ms 的 enter delay（易改）。
2. **C2 — 无专用 source-lock 契约测试**：`cancel_refund` fail-closed 门控与 `isPoolEvent` 门控是「承诺-行为顺序锁」级决策，本仓惯例（`eventDetailPage.test.ts`、`discoverAnalyticsAllowlistContract.test.ts`）应配 source-lock 测试锁定，当前缺失。→ 建议补一个 `eventFaqAccordion.test.ts` 断言 `.filter(id !== 'cancel_refund')` + 页面 `isPoolEvent` 门控字符串。

### NIT（记档，不阻断）
1. **N1 — 连接线「从左到右依次」并行实现**：设计 §5.3.1「依次 scaleX 长出」；实现为 3 段连接线同 delay 0.33s 并行绘制（`transform-origin:left` 各自左→右生长）。AC-04 的「stagger 80ms 总 ≤700ms」已满足（80ms = 节点落定后 80ms），仅「逐段级联」的视觉效果与文字描述存在微妙差异。
2. **N2 — 缺 aria-controls**：FAQ 答案有 `id`（`event-faq-answer-*`）但 Q 行 `role='button'` 未设 `aria-controls` 关联。
3. **N3 — copy 文件头「eng lead 侧待 PR 复核」**：PM 已签认、eng lead 双签记录尚标注「待 PR 复核」——AC-05 要求「PM + eng lead 双签记录入 PR」，双签证据需在 PR 补齐。

---

## 9. AC-04 / AC-05 结论

- **源码级：全绿，零 BLOCKING。** AC-04/AC-05 的全部行为与文案规格均在代码中落地且一致（四标签、role=list、bundled icon、one-shot scaleX ≤700ms、reduced-motion 双路、isPoolEvent 门控、cancel_refund fail-closed、一次一条、禁 height 动画、CSS 边框 chevron、≥88rpx、🔴 词表零命中、无虚构数字、独立 copy 模块非 barrel）。
- **命令级 + 渲染级：未执行**（本沙箱无 shell、无子代理、无预构建 dist）。因此**不能给出终局 ✅**——G1/G2/G9（guardrails / typecheck / DevTools 667px+320px 截图）需 orchestrator 在 shell-capable 环境复跑后关闭。

**最终判定：AC-04 / AC-05 = 源码级 ✅ · 环境阻塞 ⏸（PENDING 命令门禁 + DevTools 截图）**。未发现任何 BLOCKING 问题；C1/C2/N1-N3 为 CONCERN/NIT 级，由 orchestrator 决定是否派单修复（本审计按铁律只记档、不代改代码）。
