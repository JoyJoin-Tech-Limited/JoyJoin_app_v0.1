# T46 P1c 游客预告卡 — 性能审计报告（S7.6 / AC-10 performance-audit）

- **审计日期**：2026-10-20
- **审计对象**：`GuestEventPreviewCard.tsx` / `GuestEventPreviewSection.tsx` / `GuestEventPreviewCard.scss` + `FinalStage.tsx:766-770` 挂载 + `useResultsLoginHandoff.ts:160-167` 埋点
- **基线**：Gen Z 主力机（8GB+ / 120Hz / 5G），降级档仅兜底
- **审计方式**：源码级六维审计 + 编译产物（dist）取证。**只审计，未改代码，未 commit。**

---

## ⚠️ 置顶：门禁重跑状态（必读）

> **本审计会话的沙箱工具目录没有 shell/terminal，三个强制重跑命令在本会话内未能执行**（尝试 spawn 子代理亦被深度限制拦截）。以下列出让 orchestrator 在合并前亲自跑一遍的确切命令：

| 命令 | 本会话状态 | 替代取证 |
|---|---|---|
| `npm run typecheck -w mini-program` | **未重跑** | dist 构建产物含当前源码编译结果（见下），tsc 独立状态**待 orchestrator 确认** |
| `npm run build:weapp -w mini-program` | **未重跑** | dist 现存产物时间戳 **23:00:37 CST**，晚于全部交付源码最后修改（22:40:27 CST）→ 交付方确实用当前源码成功构建过一次 |
| `npm run verify:subpackage-styles -w mini-program` | **未重跑** | 人工核对了 gate 源文件 `scripts/verify-subpackage-styles.mjs:321-328` 已注册 8 个 guest-event 选择器；编译产物取证见维度 6 |

**编译产物取证（直接读 dist，等价于 verify 的静态断言）**：
- `dist/pages/onboarding/personality-test/results/index.wxss`（69.7KB，23:00:37 构建）内含全部 4 个 guest-preview keyframes，且 **keyframes 块内零 layout 属性**（逐块正则扫描：rise / ken-burns / hook-rise / shimmer 全部为 transform/opacity-only）。
- `dist/pages/onboarding/` 下**不存在 `sub-common.wxss`**（2026-08-17 强化门的硬条件满足）。
- `dist/.../results/index.js`（112.8KB）含 `guest-event-preview-section` 观察器逻辑（minified，中文转 \u 转义）。
- 未改动 `pages/icebreaker-session/**`（避让纪律遵守）。

---

## 六维裁决

| # | 维度 | 得分 | 裁决 |
|---|---|---|---|
| 1 | 流畅度 | 9/10 | **PASS** |
| 2 | 速度 | 9/10 | **PASS** |
| 3 | 设备适配 | 8/10 | **PASS**（实机截图待合并前批次补） |
| 4 | 内存安全 | 9/10 | **PASS** |
| 5 | 网络韧性 | 9/10 | **PASS** |
| 6 | 包体积 | 10/10 | **PASS** |

**Composite：55/60 ≥ 48，无维度 < 6 → 总 verdict：PASS**（门禁重跑为合并前置条件，见置顶横幅）

---

## 1. 流畅度 — 9/10 PASS

**编排全链 transform/opacity only（编译产物证实，非仅源码）**
- 对编译后 `index.wxss` 逐 keyframe 块扫描：`guest-preview-rise`（translateY 24rpx→0 + opacity，400ms）、`guest-preview-ken-burns`（scale 1.04→1.0，400ms，同一 cubic-bezier(0.22,1,0.36,1)、同一 animationDelay——同帧同曲线成立）、`guest-preview-hook-rise`（350ms，delay 530ms，结算 880ms ≤1000ms）、`guest-preview-shimmer`（opacity 0.25↔0.65，唯一循环且只活在 loading 态）——**全部零 width/height/top/margin/padding/font-size 动画**。
- hover 态 `transition: background 0.12s` 是 repo 标准 hoverClass 模式，仅按压期间 paint，非滚动路径。

**IO once-only**
- 双保险：回调内立即 `cleanup()`（disconnect）+ `triggeredRef` 幂等；threshold 0.3 与规格一致（`OBSERVER_THRESHOLD = 0.3`）。
- effect deps 含 `motionPhase`：phase 翻 'entered' 后 cleanup 再跑一次（disconnect 幂等 try/catch 包裹）。

**与 slot 庆典隔离**
- 关键发现（源码证实，比交付方注释更强）：results 页用 `key={flowStage}` stage crossfade（index.tsx:650），`'slot'` 阶段在 `'result'` 挂载前**已整体卸载**——slot 庆典与预告卡编排不可能同帧竞争。MIN_SETTLE_GAP_MS=400 的 mountTimeRef 闸门确属 belt-and-braces。

**setData 纪律**
- phase 翻转一次 setData，stagger 完全由 CSS animationDelay 承担（inline style 一次写入），无逐卡 JS 定时器；图片 onLoad/onError 每卡至多 1 次 setData；总量 ≤6 次小粒度 setData。

**−1 理由（ residual risk，非阻断）**：observer 静默不回调时卡片+钩子句保持 `opacity:0`（默认态不可见，而 HeroPromoBanner 先例的默认态是可见）。平台行为上 observe() 注册即回发当前交集，且 VirtualList 懒渲染、useEventCountdown 均靠同一机制在生产运行，风险概率低；但影响是转化面整段静默消失而非 UI 破损。**可选加固（不建议本轮做）**：1500ms 兜底定时器调 startChoreography（triggeredRef 已防双发）。

## 2. 速度 — 9/10 PASS

- **拉取时机不阻塞首屏**：`useQuery enabled: !authIsLoading && !isAuthenticated`，section 在数据到达前渲染 byte-level null；请求在 `'result'` stage 才发出，远在 slot/reveal/bridge 流程之后，完全离开关键路径。
- **retry: 0 + staleTime 60s**：不重试、页面栈保活重进直接吃缓存。
- **CDN 图策略**：2 张 hero 复用已发布 manifest 资产（无新增下载面）；无预载但该图只在滚动进入视口后才被看见，懒载即默认正确；shimmer 占位避免裸奔。
- **LCP 影响**：零。条件渲染 + 位于长页底部，数据到达不产生可见 CLS。

## 3. 设备适配 — 8/10 PASS

- **667px 短机**：整页 ScrollView，卡堆（3×~240rpx + 24rpx gap + 钩子句 40rpx margin）自然滚动，无固定高度陷阱；无 `min()/max()/clamp()` WXSS（repo 禁令遵守）。
- **320px 窄机**：容器边距 40rpx×2 后内容宽 670rpx 等效，宽裕；钩子句「微信登录，为你留座」9 字 × 32rpx ≈ 123px ≪ 320px，`font-cn-display` 字宽变化无溢出风险；卡题 `numberOfLines={1}` 防溢出；事实行（日期·时间·类型·区）过长时自然折行，line-height 1.5，无截断破损。
- **reduce-motion 双保险**：JS 门（`getSystemReducedMotion`，fail-open=false）→ static 直出；CSS 门（`.personality-results--reduce-motion` 页面根类由 index.tsx:646 真实携带，历史死代码教训已修）→ `animation: none !important` + `--pre` 强制可见。
- **−2 理由**：实机渲染未验证（沙箱无 DevTools）。源码级无风险项，但按 brief 约定**实机截图列入合并前批次清单**（见下）。

## 4. 内存安全 — 9/10 PASS

- **IO disconnect 全路径**：触发即断、effect cleanup 断、卸载断；disconnect 包 try/catch（teardown 永不抛出）；observer 创建/取 page/observe 三个 throw 点全部 fail-closed 到 static 直出。
- **定时器清理**：880ms haptic 定时器挂在独立的 `motionPhase==='entered'` effect 上，cleanup `clearTimeout` 完备——源码注释里明确记录了为什么不能把它挂在 observer effect（cleanup 恰好cancel 自己）这个时序陷阱，处理正确。startTimer 由 cleanup 闭包共享清除 + `mountedRef` 双保险。
- **无泄漏源**：`itemsRef` render-assigned 不重建 observer；`React.memo` 卡组件；埋点 flag 是 module-scope boolean，生命周期=页面会话，零 PII、无闭包持有组件。

## 5. 网络韧性 — 9/10 PASS

- **服务端 fail-closed 三重门**（lib/guestEventPreview.ts 源码证实）：flag OFF → 200+[]；合格供给 <3 → 200+[]；任何异常 → log + 200+[]。**永不吐错误页给游客**。路由注册在 `:id` 参数路由之前，不会被吞；IP 级 rate limiter 已挂。
- **客户端 fail-closed**：fetch error / 空数组 → `items.length===0` → null；auth 解析中 / 已登录 → null。契约测试 `GuestEventPreviewSection.render.test.tsx` 覆盖全部这些分支。
- **CDN 图失败**：`onError` → `heroImageFailed` → 奶油降级面，文字永远落在奶油上（scrim 双保险），降级变体与正常变体阅读体验一致。
- **重复进入（page-stack 保活）**：编排 once-only ref 在保活页面中保持 'entered'/'static' 终态——不重复触发、无卡死瞬态 flag（本组件无 isExiting/isSubmitting 类隐患，无需 useResetOnShow）。
- **−1 理由**：图片连接挂起（无 onError 也不 onLoad）时 shimmer 无限循环——纯装饰性、opacity-only，代价可忽略，记录在案。

## 6. 包体积 — 10/10 PASS

- **零新增资产**：`cdn-asset-manifest.json` 中 2 张 hero（942-947 行）为既有条目（batch C 2026-06-16 已上传），无 manifest diff、无新 bundled 资产。
- **主包影响：零**。results 页属 `pages/onboarding` 子包（`config/miniProgramChunks.ts:5` SUBPACKAGE_ROOTS）；新组件仅被该页消费，编译进子包页面 JS/WXSS（dist 取证确认）。
- 新增源码体积：TS 6.5KB + 9.2KB、SCSS 6.0KB（source），gzip 后约 4-5KB 增量全部落在 onboarding 子包。
- `verify-subpackage-styles.mjs` 选择器 8 条已注册（321-328 行）；无 `sub-common.wxss` 产出。

---

## 合并前批次：中端机实机录影清单（待执行）

**机位**：小米 13 / Redmi K60（8GB，120Hz，Android 13+）+ iPhone 13（4GB 降级档对照，各 1 台即可）
**前置**：开发版构建（含本变更）→ 真机预览；DevTools 关闭「不校验合法域名」不适用真机，用开发版正常链路。

1. **冷启动 → 完成测试 → results 页**：清缓存进入，做完 8-16 题，录 SlotStage → FinalStage 全段。验收：slot 庆典与预告卡编排无同帧竞争；滚动至底部时卡堆 400ms 起 + 90ms stagger + Ken Burns 同帧、钩子句 880ms 处 light 震动。
2. **慢网（4G 节流 / 弱网模拟）**：CDN hero 失败时奶油降级出现，无白卡无破图；shimmer 不卡滚动。
3. **320px 窄机位（iPhone SE 模拟器或开发者选项调分辨率）**：钩子句无折行溢出，卡题单行截断正常。
4. **667px 短机位**：滚到底 CTA 区不被卡堆顶起，登录墙弹层正常。
5. **重复进入**：results 页滑走再滑回（页面栈保活），编排不重放、不闪白。
6. **reduce-motion（系统放大动效关闭）**：静态直出，全部内容立即可读。

## DevTools 60fps 面板验证步骤

1. DevTools → 真机调试（2. 中任一台）→ 「性能」面板开录制，滚动 results 页从顶部到底部（经过预告卡编排）。
2. 检查：compose 阶段无长条（编排期间每帧 <8ms @120Hz）；无 layout/paint 长帧（Animation 面板应只有 transform/opacity 动画在跑）。
3. 「内存」面板：进入-退出 results 页 5 次，堆内存无阶梯式上涨（IO/定时器清理验证）。
4. Network 面板 throttle 到 Slow 4G 复测 hero 加载与降级路径。
5. 底部 Audits 跑「体验」评分，results 页 LCP 与交付前基线对比应无回退。

---

## 发现汇总（无 BLOCKING）

| 级别 | 发现 | 建议 |
|---|---|---|
| CONCERN | observer 静默不回调时整段保持不可见（概率低，平台机制有生产先例背书） | 可选：1500ms 兜底触发 startChoreography（幂等 ref 已就位） |
| CONCERN | 图片挂起时 shimmer 无限循环 | 不处理（opacity-only 装饰态） |
| 待确认 | 三个强制命令未在本会话重跑（沙箱无 shell） | orchestrator 合并前跑一遍置顶表格中的 3 条命令 |
| 待确认 | 实机截图/录影 | 按上方清单在合并前批次统一补 |

*报告完。未修改任何代码，未 commit。*
