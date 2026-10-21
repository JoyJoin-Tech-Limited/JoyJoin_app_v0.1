# 转化 合并前固化批 — Source-Lock 契约测试 + EventDetail 截图状态扩展

> 执行：taro-engineer 子任务 · 2026-10-21 · 合并门禁项（审计报告 CONCERN C2 + G9 截图阻断）
> 纪律：未 commit · 未 push · 未触碰 `pages/icebreaker-session/**` · 未改任何组件业务/样式代码（孤字结论 = 无需修复，见 §4）

---

## 1. 改动文件清单

| 文件 | 性质 |
|---|---|
| `apps/mini-program/src/pages/event-detail/__tests__/eventFlowStrip.test.ts` | 新增（16 断言组 1，7 test） |
| `apps/mini-program/src/pages/event-detail/__tests__/eventFaqAccordion.test.ts` | 新增（3 describe，8 test） |
| `apps/mini-program/src/pages/event-detail/__tests__/eventDetailPage.test.ts` | 追加 1 个 describe（4 test，surgical edit） |
| `scripts/screenshot/generators-event-detail.mjs` | 扩展：6 个新截图状态 + `authOverrides` 参数（修复 Playwright last-registered-wins 会顶掉 features override 的路由顺序陷阱） |
| `scripts/screenshot-open.mjs` | 扩展：6 个新 PAGES 条目（手动复跑入口） |
| `docs/deliverables/2026-10-20-conversion-event-detail-audit/screenshots/*.png` | 新增 6 张截图（见 §3） |

**组件 SCSS/TSX、页面代码：零改动。** 因此 `build:weapp && verify:subpackage-styles` 门禁按任务定义不适用（「若动了组件 SCSS」的前置不满足）。

## 2. Source-lock 断言锁定点

### EventFlowStrip（`__tests__/eventFlowStrip.test.ts`）

| 断言 | 锁定点 |
|---|---|
| 四标签 canonical 顺序（订座→悦仔排桌→集结房间等开席→现场入座）且恰好 4 拍 | `EventFlowStrip.tsx:38-43`（FLOW_STEPS 数组顺序 + `label: '` 精确匹配 + length=4） |
| `role='list'` / `aria-label='参加流程'` / `role='listitem'` | `EventFlowStrip.tsx:58,67` |
| 连接线 `scaleX(0)→scaleX(1)` one-shot；无 infinite/loop/animation-iteration-count | `EventFlowStrip.scss:137-144`（keyframes）+ 全文 animation 声明扫描 |
| 连接线 0.3s cubic-bezier(0.22,1,0.36,1) 0.33s both + transform-origin:left | `EventFlowStrip.scss:113-114` |
| reduced-motion 双路静态（JS `--rm` modifier + media query） | `EventFlowStrip.tsx:46,51` · `EventFlowStrip.scss:16-21,119-124` |
| 首节点纯色 primary 描边、禁渐变 | `EventFlowStrip.scss:52-62` |
| CJK 无 overflow-wrap:anywhere、无 min/max/clamp（去注释后扫描） | `EventFlowStrip.scss:91-101` |
| 无 TSX side-effect SCSS import（子包 WXSS 规则） | `EventFlowStrip.tsx` import 区 |
| glyph 走 `localAsset()` + 解码失败降级 8rpx 品牌点 | `EventFlowStrip.tsx:60,76-84` |

### EventFaqAccordion（`__tests__/eventFaqAccordion.test.ts`）

| 断言 | 锁定点 |
|---|---|
| `cancel_refund` 仅 `preRevealRefundEnabled === true` 渲染（fail-closed filter 分支） | `EventFaqAccordion.tsx:46,73-75` |
| 组件内零硬编码退款承诺文案（全部来自 `@shared/copy/eventFaqCopy`） | `EventFaqAccordion.tsx:3` + 禁词断言 |
| **禁 height 动画**：transition/animation 声明与全部 keyframes body 无 height/max-height/width | `EventFaqAccordion.scss` 全文（含 :88-94,117-135 keyframes 逐 body 断言） |
| chevron 仅 `transition: transform 0.2s cubic-bezier(0.22,1,0.36,1)`，rotate(45°→225°)，无 width/height/color/opacity/background 过渡 | `EventFaqAccordion.scss:69-84` |
| enter 250ms / exit 150ms opacity+transform keyframes；无 infinite | `EventFaqAccordion.scss:88-93,117-135` |
| reduced-motion 瞬时无 timer 分支 + `--rm`/media query 双杀 | `EventFaqAccordion.tsx:84-90` · `EventFaqAccordion.scss:22-28,109-115` |
| 单开状态机：`openId/visibleId` 单值 useState、无 openIds/openItems/openSet、exitTimerRef、条件渲染至多一条答案 | `EventFaqAccordion.tsx:61-64,146-155` |
| tap haptics('light') + Q 行 ≥88rpx + hoverClass | `EventFaqAccordion.tsx:78,137` · `EventFaqAccordion.scss:45` |

### 页面插入顺序（`eventDetailPage.test.ts` 追加 describe）

| 断言 | 锁定点 |
|---|---|
| `<EventFlowStrip />` < `<EventFaqAccordion />` < `活动介绍`（源码顺序） | `pages/event-detail/index.tsx:243-272` |
| 两组件各自包在 `{isPoolEvent ? ...}` 内（blind-box 不渲染，fail-closed） | `index.tsx:243,255`（向前 400 字符窗口含 gate）+ `event?.source === 'event_pool'` 判别锁 |
| `preRevealRefundEnabled={preRevealRefundEnabled}` 传参 + 页面侧 `user?.features?.preRevealRefundEnabled === true` 归一化（禁组件直读 user） | `index.tsx:45,257` |
| 两组件 SCSS 经 `@use` 进页面 SCSS、无 TSX side-effect import | `pages/event-detail/index.scss:5-6` |

## 3. 截图清单

产出目录：`docs/deliverables/2026-10-20-conversion-event-detail-audit/screenshots/`

| 文件 | 视口 | 状态 | 验证点 |
|---|---|---|---|
| `event-detail-flow-strip-375x667.png` | 375×667 | 流程条可见 + FAQ 折叠 + CTA 同屏 | 四节点 5+2 折行无孤字；action bar 在视口内（generator 硬断言） |
| `event-detail-faq-collapsed-375x667.png` | 375×667 | FAQ 折叠 | 8 条全收（`preRevealRefundEnabled=true` override 生效，`cancel_refund` 条目可见） |
| `event-detail-faq-open-375x667.png` | 375×667 | FAQ 展开一条 | 恰一条展开（generator 硬断言 open 数=1），活动介绍卡与 CTA 可读 |
| `event-detail-flow-strip-320x568.png` | 320×568 | 流程条可见 + FAQ 折叠 + CTA 同屏 | 长节点 4+3 平衡双行（H5 下限渲染，悲观情形），无孤字/无裁切 |
| `event-detail-faq-collapsed-320x568.png` | 320×568 | FAQ 折叠 | 窄机可读性 |
| `event-detail-faq-open-320x568.png` | 320×568 | FAQ 展开一条 | 答案文本折行干净，CTA 不被顶出 |

**手动复跑命令**（任一单张）：
```bash
npm run screenshot:event-detail-flow-strip        # 375×667 flow strip
npm run screenshot:event-detail-faq-collapsed     # 375×667 FAQ 折叠
npm run screenshot:event-detail-faq-open          # 375×667 FAQ 展开
npm run screenshot:event-detail-flow-strip-320    # 320×568 flow strip
npm run screenshot:event-detail-faq-collapsed-320 # 320×568 FAQ 折叠
npm run screenshot:event-detail-faq-open-320      # 320×568 FAQ 展开
```
或直接命中已注册 generator：`node scripts/screenshot-server.mjs` 起服后 GET `http://localhost:9000/<name>.png`（mock-h5-server 需同起 :5001，H5 需以 `TARO_APP_API_BASE_URL=http://localhost:5001 TARO_APP_ENABLE_STORY_MODE=true` 预构建）。

## 4. 孤字结论（320×568 「集结房间等开席」）

**结论：无孤字 —— 且在任意宽度下数学上不可能出现孤字。未做任何修复（无需修复）。**

推导（rpx 真值：1rpx = W/750）：
- 节点宽度 = `(W − 232rpx×W/750) / 4 = 0.1727W`（容器 40rpx + 卡片 40rpx 两侧内边距 + 3×24rpx 连接线）
- 6 字宽度 = `144rpx = 0.192W > 0.1727W` ⇒ **任何宽度下第一行最多 5 字** ⇒ 第二行恒 ≥2 字 ⇒ 孤字窗口（节点 ∈ [6字宽, 7字宽)）恒为空集
- 真 WeChat 320px：节点 55.25px，7 字 71.68px → 折 5+2（集结房间等 / 开席）

模型经 H5 实测校验（公式预测 = 实测，分毫不差）：

| 视口 | 预测节点宽 | 实测节点宽 | 实测折行 |
|---|---|---|---|
| 375×667 | 64.75px | **64.75px** | 5+2（60px / 24px，末行 2 字） |
| 320×568 | 51.00px | **51.00px** | 4+3（48px / 36px，末行 3 字） |

⚠️ 复跑者须知：H5 harness 的 html 根字号有 **20px（=375 基准）下限**（`max(20px, 100vw/750×40)`），故 320 视口下 H5 的 rpx 字体/间距比真 WeChat 偏大（悲观方向）；flex 几何仍随真实视口收缩。本结论以经实测校验的解析模型为准，H5 截图作为悲观情形的佐证（即便如此也无孤字）。generator 内置 Range.getClientRects 逐行测量 + 孤字硬失败（末行 <1.2×fontSize 即 throw），未来回归会在截图层面直接炸出。

## 5. 门禁输出摘要

| 门禁 | 结果 |
|---|---|
| `npm run test -w mini-program` | ✅ 本批范围全绿：`src/pages/event-detail/**` 4 文件 41/41（含新增 19 test）；全量 3194 test 中唯一失败文件 = `src/components/onboarding/__tests__/GuestEventPreviewSection.render.test.tsx`（P1c 并行任务的 untracked 文件，本批零触碰，`git diff` 为空；失败计数随运行 1↔2 抖动 = 其 impression-mock 时序问题，应回 S7.3 任务方处置） |
| `npm run guardrails` | ✅ PASS with warnings（0 error；8 条 warning 为存量 window/px 类；class-coverage 无新增 orphan；icebreaker-visuals 未触碰） |
| `npm run typecheck -w mini-program` | ✅ 绿（tsc --noEmit 无输出） |
| `build:weapp && verify:subpackage-styles` | 不适用（零组件 SCSS 改动） |
| generator 语法 | ✅ `node --check` 两个改动文件均过 |
