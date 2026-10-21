# 转化 竞对反打 — 全量实施执行计划（审批制）

> 2026-10-20 · Planner 出品。输入：`2026-10-20-conversion-final-strategy.md`（冻结行动清单 + 7 项冲突裁决）+ `2026-10-20-conversion-design-strategy-confirmation.md`（设计规格 + §5 Wow Layer）+ `2026-10-20-conversion-competitor-teardown.md`（事实底稿）。
> 纪律：方案已冻结，本计划只做排期、拆解、验收定义。任何范围争议回 deliberation，不在实施层重新设计。
> Sprint Contract 草案：`.git/.orchestration/sprints/sprint-contract.benchmark-full-implementation.md`

---

## 1. Goal summary

止血（P0a 退款承诺 gap 兑现）+ 度量（P0b 七事件埋点，北极星 `detail_to_checkout_conv`）+ 及格线信任资产（P0c 流程条 / P0d 退款叙事 / P0e FAQ）+ 获客与结伴钩子（P1a Duo 入口 / P1c 游客预告卡）+ 供给节律运营配合（P1b）。P2 recap 金句排最后、不在本 sprint。

## 2. Assumptions and gaps（代码事实核查结论）

已核实（file:line 证据）：

- **埋点链路**：client 模块在 `apps/mini-program/src/lib/analytics/*.ts`（union type 枚举）；server 白名单 `DISCOVER_EVENT_TYPES` 在 `apps/server/src/routes/domains/analytics.ts:119`；`POST /api/analytics/discover` 是 rate-limit 公开通道（路由签名无 `requireAuth`），游客事件可发；契约测试范式 `apps/server/src/__tests__/discoverAnalyticsAllowlistContract.test.ts`（feedback 有镜像版）。
- **既有事件已覆盖部分目标**：`pay_cancel`/`pay_success`/`event_ticket_payment_view`/`event_ticket_payment_abandon` 已在 discoverAnalytics union——`checkout_cancel_rate` 与北极星分母大概率可由既有事件 + funnel SQL 派生，**S1.1 审计先行以避免重复埋点**。funnel SQL 先例：`apps/server/scripts/icebreaker-wave3-funnel-metrics.sql`。
- **P0a**：`preRevealRefundEnabled` 已是 DB-backed flag（`apps/server/src/lib/featureFlags.ts:333/610`，env `PRE_REVEAL_REFUND_ENABLED`，默认 false，admin `/admin/feature-flags` 可切、mutation 自动审计）；`poolRegistrationCancel.ts` 双 flag 关时 `computeRegistrationCancelPolicy` 返回 `undefined`、走 legacy 只删不退分支（L110-128）；`RefundGuaranteeLine.tsx` 为 fail-closed null tree（`visible=false` 不渲染）。**遗留缺口：flag 关时承诺行今天是否可见 = S2.1 必须用证据回答的第一问**（决定回滚动作是否需联动隐藏该行）。
- **P1c 游客态**：`GET /api/event-pools` 是 `requireAuth`（`apps/server/src/routes/domains/userEventPools.ts:145`），repo 无 optional-auth 中间件 → **必须新增 guest-safe 只读 endpoint**；`user.features` 需登录 → **P1c flag 只能在新 endpoint 内服务端解析**（fail-closed 返空），客户端拿不到也不应拿。
- **P1c 插入位**：`apps/mini-program/src/pages/onboarding/personality-test/results/FinalStage.tsx:759` `personality-results__stack-actions` 之前（已核实）。
- **50/50 灰度**：repo 无 per-user 实验分桶框架 → 需服务端确定性分桶（`hash(userId) mod 2`），不建新表（决策点 D1）。
- **copy 模块先例**：`packages/shared/src/copy/poolTeaserCopy.ts`（独立模块、不走 barrel）。
- **子包门禁**：payments（P0d/P1a）与 onboarding（P1c）均须 `npm run build:weapp -w mini-program && npm run verify:subpackage-styles -w mini-program`；新选择器登记 `apps/mini-program/scripts/verify-subpackage-styles.mjs`；组件 SCSS 必须 `@use` 进消费页面 SCSS，禁 TSX side-effect import。

缺口 / 待拍板：见 §8 决策点 D1–D4。

## 3. Wave 排序与依赖图

### 3.1 依赖图

```
S1  P0b 埋点（无依赖，1 人天先行）──┬──► S6 P1a（需 duo_entry_ctr 已注册）
                                    └──► S7.4 P1c 客户端埋点（需 guest 事件）
S2  P0a 验证 + 法务/运营（human-async）──► S5 P0d 合入门禁 ──► P0d 50/50 灰度
S3  P0c 流程条（无依赖）
S4.1 P0e copy 起草双签（PM，长前置）──► S4.2 FAQ 实现 ──► 与 S3 同车一次 audit pipeline
S7.1 P1c guest endpoint + S7.2 flag/DTO ──► S7.3 P1c 客户端 ──► P1c flag 灰度
S8  P1b 代码侧审计（无依赖，trivial）
```

### 3.2 关键路径

- **工程关键路径（最长链）**：S1（1d）→ S7.1/S7.2（1d）→ S7.3（2–3d）→ P1c 验收链（1d）→ P1c 灰度。
- **营收保护链（human-gated）**：S2 验证（0.5d）→ 法务/运营确认（异步）→ flag ON → S5 合入 → 50/50 灰度 7d 盯 `checkout_cancel_rate`。
- **瓶颈判定（first-principles-velocity）**：瓶颈不是工程产能，是两个 human-async 前置——P0a 法务/运营确认、P0e copy 双签。两者 Day 0 并行启动，工程绕开它们推进其余全部。

### 3.3 Wave 表

| Wave | 窗口 | 内容 | 并行度 |
|------|------|------|--------|
| W0 度量与止血前置 | Day 0–2 | S1 P0b 埋点 · S2 P0a 验证 · S4.1 FAQ copy 起草 · S3 P0c 流程条开发 | 4 线并行，零相互依赖 |
| W1 详情页静态层 + 服务端前置 | Day 2–5 | S4.2 FAQ 实现（copy 签毕后）· S5 P0d 开发（flag-off 待命，合入等 S2.3）· S7.1/S7.2 P1c 服务端 · S8 P1b 审计 | P0c+P0e 同车 audit |
| W2 收银台入口 + 获客卡组 | Day 5–8 | S6 P1a（S5 合入后再动同页文件）· S7.3/S7.4 P1c 客户端 · 各件验收链 | 2 线并行 |
| W3 灰度与护栏 | Day 8+ | P0d 50/50 七天盯 `checkout_cancel_rate` · P1c 灰度盯 `guest_to_login_conv`/`guest_view_to_assessment_rate` · 北极星 = 灰度前后各 7 天对照 | 运营节奏 |

## 4. 任务拆解（可派单粒度）

审批纪律：每个 wave 开工前用户确认；`approval_required=yes` 的行必须显式批准才派单。所有实现 agent 开工前按 AGENTS.md §0 加载对应领域 skill（server-domain-architecture / mini-program-frontend-excellence / joyjoin-brand-guidelines / auth-session-and-safety-boundaries / api-contract-versioning / analytics-tracking）。

### S1 — P0b 转化埋点（1 人天，先行）

| step_id | agent_name | task_description | expected_output | depends_on | approval_required |
|---|---|---|---|---|---|
| S1.1 | backend-engineer | 既有事件覆盖审计：7 目标事件中哪些可由既有事件 + funnel SQL 派生（`checkout_cancel_rate`/`first_order_30d_renewal` 预期为 SQL 派生），哪些需新 raw 事件 | gap 清单（PR 附录或 `docs/deliberations/2026-10-20-conversion-analytics-gap-audit.md`） | — | yes |
| S1.2 | taro-engineer | client union 增补 + 发射点接线（detail 页 view / checkout view / guest 结果页 view / 登录 tap / duo 入口 tap）；metadata enum-only 零 PII | diff + `npm run typecheck -w mini-program` 绿 | S1.1 | yes |
| S1.3 | backend-engineer | server 白名单 parity 注册（`DISCOVER_EVENT_TYPES`）+ 契约测试扩展 + funnel SQL `apps/server/scripts/conversion-funnel-metrics.sql`（北极星 / 续费率 / 护栏三段） | `npm run test -w @joyjoin/server -- AllowlistContract` 绿 + SQL 文件 | S1.1 | yes |
| S1.4 | qa-agent | staging 实测：事件实发、metadata 无 PII、白名单不丢事件 | 验收记录（network 抓包截图/日志） | S1.2+S1.3 | yes |

### S2 — P0a 退款止血（human-gated）

| step_id | agent_name | task_description | expected_output | depends_on | approval_required |
|---|---|---|---|---|---|
| S2.1 | backend-engineer | 验证备忘录：①`poolRegistrationCancel.ts` legacy vs flag-on 行为 diff（file:line）②`RefundGuaranteeLine` visible 来源——flag 关时承诺行今天是否可见 ③`npm run smoke:auto-refund -w @joyjoin/server` 证据 ④flag ON 后 cancelPolicy/refund 路径预期行为 | 备忘录 + smoke 输出 | — | yes |
| S2.2 | product-manager | 法务/条款对齐复核（条款 v2026-08-27 已对齐 PRD:1241）+ 运营 runbook 更新 | 签认记录 | S2.1 | yes |
| S2.3 | （人类操作，非 agent） | super_admin 在 `/admin/feature-flags` 开启 `preRevealRefundEnabled`（DB-backed，mutation 自动审计） | admin audit log 证据 | S2.2 | **用户本人** |
| S2.4 | qa-agent | staging 复演：matched 前取消 → 真实退款 / credits 回补 → 证据归档 | 复演报告 | S2.3 | yes |
| S2.5 | taro-engineer | （2026-10-20 追加，S2.1 发现）`RegistrationConfirmModal.tsx:104` 硬编码承诺行「排桌完成前可免费取消 · 全额退款」无 flag 门控——改为与收银台同源读取 `preRevealRefundEnabled`，flag 关时隐藏该行，永久对齐可见性与服务端行为 | diff + render test | S2.1 | yes |

### S3 — P0c 详情页 4 拍流程条（全量不灰度）

| step_id | agent_name | task_description | expected_output | depends_on | approval_required |
|---|---|---|---|---|---|
| S3.1 | taro-engineer | 新建 `apps/mini-program/src/components/event-detail/EventFlowStrip.tsx` + `@use` 进 `pages/event-detail/index.scss`：4 节点 canonical 标签（订座→悦仔排桌→集结房间等开席→现场入座），`role='list'` 语义，首节点 `$color-primary` 描边，图标优先复用 `src/assets/icons/ui/` bundled glyph 走 `localAsset()`（新增映射须同 PR 过 `check-cdn-icon-coverage`）；Wow = 连接线 `scaleX(0→1)` 300ms stagger 80ms one-shot 总 ≤700ms，数据就绪后触发不在 skeleton 阶段，reduced-motion 全静态，禁任何 loop | diff + `npm run guardrails` 绿 | — | yes |
| S3.2 | qa-agent | 验收链：ui-layout-audit 0 error · frontend-design-audit ≥16/20 零 Class A · 667px + 320px DevTools 截图入 PR · 中端机录屏连线绘制（60fps 无长帧） | 审计报告 + 截图/录屏 | S3.1 | yes |

### S4 — P0e FAQ 手风琴（copy-gated）

| step_id | agent_name | task_description | expected_output | depends_on | approval_required |
|---|---|---|---|---|---|
| S4.1 | product-manager | 起草 6–8 条 FAQ 进 `packages/shared/src/copy/eventFaqCopy.ts`（独立模块不走 barrel，`poolTeaserCopy.ts` 先例），首批必含「平台支付闭环，真人到场核销」；🔴🟠 审（禁 匹配/社交/灵魂/AI/算法/智能，禁「平台担保/官方认证」越界承诺，数字只写 live query）；🟡 长度 waiver 登记（解释性内容 ≤60 字/条）；PM + eng lead 双签 | copy 模块 diff + 双签记录 + waiver 登记 | — | yes |
| S4.2 | taro-engineer | 新建 `components/event-detail/EventFaqAccordion.tsx`：条件渲染 + `opacity`/`translateY(8rpx)` 250ms 入场（**禁 height 动画**），chevron 仅 `transform` 200ms `cubic-bezier(0.22,1,0.36,1)`，一次只开一条，旧答案先退 150ms 再开新答案（单次切换 <400ms），touch target ≥88rpx + `hoverClass` 淡 tint + `haptics('light')`，reduced-motion 瞬时切换零动画；插入 P0c 之后（同 ScrollView 流）；`@use` 进页面 SCSS | diff + guardrails 绿 | S4.1 | yes |
| S4.3 | qa-agent | 与 S3 同车完整 audit pipeline（ui-layout → design ≥16/20 → completeness ≥32/44 零 P0）+ 667px 回归 | 审计报告 | S4.2 + S3.2 | yes |

### S5 — P0d 收银台退款叙事（前置 P0a，50/50 灰度）

| step_id | agent_name | task_description | expected_output | depends_on | approval_required |
|---|---|---|---|---|---|
| S5.1 | backend-engineer | 50/50 分桶：服务端确定性 `hash(userId) mod 2`（不建新表不建实验框架），bucket 结果随收银台页面数据下发；单测覆盖同用户稳定性与分布 | diff + 单测绿 | S2.1（D1 拍板后） | yes |
| S5.2 | taro-engineer | 扩展 `RefundGuaranteeLine` 为两行 caption stack：叙事行「这一桌已经写上你的名字」在上、事实行「排桌完成前取消，全额退款」在下**永不删**；`ticket-bottom-spacer--with-guarantee` 同步增高逐像素对齐；灰度 flag-off 桶 = 现状单行 null tree 契约不破（扩展 `RefundGuaranteeLine.render.test.tsx`）；`checkout_cancel_rate` 护栏打点挂行曝光（per page visit 去重，`feedbackEntryTrackedRef` 模式）；两桶行高差 CSS 预留（禁 JS 测量后补导致布局跳动）；payments 子包 `@use` + 选择器登记 | diff + render test 绿 + `verify:subpackage-styles` 绿 | S1（打点）+ S5.1 | yes |
| S5.3 | qa-agent | 667px 视口 CTA 首屏可见截图（merge 前置）+ 验收链 + performance-audit PASS | 审计报告 | S5.2 | yes |
| S5-GATE | （门禁，非派单） | **S5 合入阻断直到 S2.3 flag ON 证据附 PR**（PM 底线 #3：承诺类文案上线前服务端行为先生效） | 证据链接入 PR | S2.3 | 用户确认 |

### S6 — P1a Duo 同行入口（收银台）

| step_id | agent_name | task_description | expected_output | depends_on | approval_required |
|---|---|---|---|---|---|
| S6.1 | taro-engineer | 新建 `components/event-ticket-payment/DuoEntryLink.tsx` 文本链接 register（`ticket-refund-link` 同款：一行文字 + `›` + hoverClass 淡压）：位置 trust row 之下、refund link 之上；一屏一主 CTA 纪律（禁卡/按钮/徽章）；入口零金额零 urgency——`¥`/「立得」/「现金」/「提现」grep 零命中，奖励规则只在落地页；独立 query `enabled` 门控、失败静默隐藏（fail-closed）；tap `haptics('light')`；`duo_entry_ctr` 发射；payments 子包门禁 | diff + 验收链绿 | S1.3 + S5 合入（同页避让） | yes |

### S7 — P1c 游客预告卡（最重，3–4 人天）

| step_id | agent_name | task_description | expected_output | depends_on | approval_required |
|---|---|---|---|---|---|
| S7.1 | backend-engineer | 新 guest-safe 只读 endpoint `GET /api/event-pools/guest-preview`（挂 `userEventPools.ts`，加载 `auth-session-and-safety-boundaries` 审）：无 `requireAuth` + rate limit；**服务端解析 flag + 供给 ≥3 双门槛，不满足 fail-closed 返空**；排除 test pool、`status='active'`、`registrationDeadline > now`；返回 ≤3 场最小 DTO（标题 / dateTime / 区 / eventType / 实时剩余座位 = live 计算）；零 PII | diff + 路由测试绿 | —（D2/D3 拍板后） | yes |
| S7.2 | backend-engineer | flag 注册 `guestEventPreviewEnabled`（`featureFlags.ts` DB-backed + env fallback，默认 false，admin toggle 自动获得）+ DTO Zod 入 `packages/shared/src/api.ts`（api-contract-versioning）+ client-server 契约测试 | diff + 契约测试绿 | S7.1 | yes |
| S7.3 | taro-engineer | 新建 `components/onboarding/GuestEventPreviewCard.tsx` + `GuestEventPreviewSection`：抽 OracleCard L1 hero / L3 决策事实 / L4 标题壳（**无 corner badge / count-up / high-chemistry 徽章 / Discover 埋点键**），插入 `FinalStage.tsx:759` `__stack-actions` 之前，渲染数 `min(3, 供给)`；Wow 编排 = `Taro.createIntersectionObserver`（threshold 0.3，once-only，observer 不可用 fail-closed 静态直出）+ 卡 `translateY(24rpx→0)+opacity` 400ms stagger 90ms + vignette one-shot Ken Burns `scale(1.04→1.0)` 同帧 + 钩子句 `font-cn-display` 350ms 落定 `haptics('light')`，**与 slot 庆典隔 ≥400ms**，总序列 ≤1000ms；CDN vignette + 奶油色降级（降级态同样参与编排）；**零 bundled 资产**；reduced-motion 全静态；onboarding 子包 `@use` + 选择器登记；flag 互斥契约测试（`guidanceQueueContract.test.ts` 模式） | diff + `verify:subpackage-styles` 绿 + 契约测试绿 | S1.2 + S7.2 | yes |
| S7.4 | taro-engineer | guest 事件发射接线（`guest_view_to_assessment_rate` / `guest_to_login_conv`，随 S7.3 同 PR） | 随 S7.3 | S1.2 | 随 S7.3 |
| S7.5 | user-satisfaction-auditor | 情绪 rubric ≥14 且**编排版 ≥ 静态版**（低于则退回静态版，设计 §5.4 既定）；六维第一人称 walk | rubric 报告 | S7.3 | yes |
| S7.6 | qa-agent | performance-audit PASS（强制）+ 完整验收链 + 中端机录屏全序列 + DevTools 60fps 面板无长帧 | 审计报告 | S7.3 | yes |

### S8 — P1b 供给节律（代码侧仅审计）

| step_id | agent_name | task_description | expected_output | depends_on | approval_required |
|---|---|---|---|---|---|
| S8.1 | backend-engineer | 代码侧审计：全仓 grep 无硬编码排期承诺文案；「每周都有局」软表述若需落地走 copy 模块不硬编码城市/星期 | 审计备忘（grep 证据） | — | yes |
| S8.2 | （人类运营，非 agent） | 深圳周三/周六排期内部承诺生效；venue 白名单补档并行（深圳 `dining_150_below`/`150_200`/`300_500` 缺口为已知 blocker） | 运营记录 | — | 用户/运营 |

## 5. 首个交接建议（批准后）

立即并行派单三单：**S1.1**（backend-engineer，埋点 gap 审计）、**S2.1**（backend-engineer，P0a 验证备忘录）、**S4.1**（product-manager，FAQ copy 起草）；**S3.1**（taro-engineer，P0c 流程条）同波并行。理由：S1 解锁度量与两个下游依赖；S2 启动 human-async 法务链；S4.1 启动 copy 双签长前置；S3 无依赖直接产出。

## 6. 确定性验收链（逐交付物门禁映射）

五件 UI 交付物全部 Full tier。通用链：

`npm run guardrails`（0 error：无 inline emoji、BEM class-coverage 无新增 orphan、design-audit `--scope changed --fail-on error` 0 阻塞）→ `npm run build:weapp -w mini-program && npm run verify:subpackage-styles -w mini-program`（P0d / P1a / P1c）→ `check-cdn-icon-coverage`（P0c 若新增映射）→ `npm run typecheck -w mini-program` + 契约/render 测试 → ui-layout-audit 0 error → frontend-design-audit ≥16/20 零 Class A（Dim 5 ≥3，无 layout-triggering animation 发现）→ completeness-audit ≥32/44 零 P0 → performance-audit（P0d / P1a / P1c 强制 PASS；P0c / P0e 至少 WARN-free）→ 情绪 rubric（P1c ≥14 且编排版 ≥ 静态版；P0c / P0e ≥12）→ 文案双签（P0d / P0e / P1a / P1c）→ DevTools 667px 短机回归（P0c / P0d / P0e / P1a）→ 灰度护栏（P0d：`checkout_cancel_rate`；P1c：`guest_to_login_conv` / `guest_view_to_assessment_rate`）。

## 7. 风险与回滚

| 项 | 护栏指标 | 回滚动作 | 特殊风险 |
|---|---|---|---|
| P0a flag | `smoke:auto-refund` 绿 + staging 复演证据 | 关 flag。**承诺 gap 回旋镖**：若 S2.1 证实 flag 关时承诺行可见，回滚必须同时强制 `RefundGuaranteeLine` 隐藏（config 级）并按事故通知 PM——开了再关 = 明知不退还展示承诺 | 开 flag 是不可逆承诺升级，故 S2 链 human-gated；P0d 叙事行随 P0a 关闭自动失效（依赖链） |
| P0d 50/50 | `checkout_cancel_rate` 7 天不回退才全量 | 关变体桶 → fail-closed 回落现状单行（null tree 契约已由 render test 锁定） | 灰度桶切换布局跳动 = 直接打回（CSS 预留纪律） |
| P1c flag | `guest_to_login_conv` / `guest_view_to_assessment_rate` 不降 | 关 flag → endpoint 返空 → 客户端字节级不渲染 | 编排版情绪分 < 静态版 → 退回静态版（设计 §5.4）；供给 <3 时永不渲染「暂无」态 |
| P1a | `duo_entry_ctr` 读数 + 审核反馈 | revert PR（小组件隔离） | 「同行有奖励」诱导审核线：入口零金额已冻结，不得加码 |
| P0c / P0e | 静态全量，无灰度 | revert PR | 320px 孤字/换行事故 → DevTools 截图门禁拦截 |

## 8. 决策点（✅ 2026-10-20 已全部拍板）

- **D1 P0d 50/50 分桶机制**：✅ **服务端确定性 `hash(userId) mod 2`**，随收银台页面数据下发，不建新表不建实验框架。
- **D2 P1c flag 命名**：✅ **`guestEventPreviewEnabled`**（env `GUEST_EVENT_PREVIEW_ENABLED`，默认 false，DB-backed，admin 可切）。
- **D3 guest-preview city 默认**：✅ **可选 `city` query，缺省深圳**；供给门槛 ≥3 为冻结值不动。
- **D4 P0a flag ON 时间点**：✅ **法务/运营证据齐即直接开**（止血优先，用户原话「直接开」），P0d 就绪后补叙事层。

## 8.5 进度日志（2026-10-21 主会话 consolidate）

**已落地（全部门禁绿，未 commit）**：
- C1=A ✅：guest-preview 钩子句=「这周有 N 场正在排桌」（N=live count，server ≥3 门槛保证真实），32/32+guardrails 绿（copy 双签随合并批）。flag 口径：staging 开 `preRevealRefundEnabled`+`guestEventPreviewEnabled`；`noRefundAfterReveal` 保持关；生产等 S2.4 证据/合并后灰度。
- S5.1 P0d 分桶服务端 ✅：`lib/experimentBucket.ts`（sha256(userId) 前 8 hex mod 2，纯函数 fail-closed 控制桶）+ 挂载 `GET /api/payments/ritual-context`（payments.ts:1341，flag off 字段整体缺席）+ 10 单测（黄金向量钉死算法），全量 4151 绿。
- S5.2 P0d 客户端 ✅：RefundGuaranteeLine `narrative` prop 两行 stack（叙事上/事实下永不删）、`resolveRefundNarrativeBucket` fail-closed resolver（非 0/1 坍缩 null=控制组）、spacer 282rpx 逐像素推导（行盒 33rpx+4rpx 行距，零 JS 测量）、曝光 `ticket_refund_guarantee_impression`（双臂打点 bucket 维度入白名单 parity）、四态矩阵+DOM 顺序锁 5 tests、payments 子包门禁绿。零动画（收银台编排预算为零）。
- S5.3 改为收银台合并审计车（P0d+P1a 同车），等 S6 落地后派。
- S6 P1a DuoEntryLink ✅：文本链接 register（「和朋友一起？邀 TA 同行，排进同一桌」+ muted「同行有奖励」，零金额零 urgency source-lock grep 断言）、duo-status 三态门控（none 显示/waiting/bound 隐藏）+ `duoRegistrationEnabled` flag 门控、fail-closed 静默、9/9 测试、spacer 三变体不变（duo 行进 scroll-flow 不进 sticky footer）、payments 13 选择器绿。**暴露跟进项（后续单开，不在本 sprint）**：invite 落地页 duo 模式依赖「已有 active 报名」，收银台是付款前场景 → 承诺链付款前暂不闭环；解法=invite 页接受 `?poolId=` 进 pool-scoped duo 态（服务端 POST duo-invites 本就支持注册前建码，spec §A.5）。
- **全部开发单收官**（2026-10-21）。收银台合并审计车（P0d+P1a+P0c/P0e rubric 补漏）已派 ses_ea2c533adffexhKdKXayqn8XbJ。
- **2026-10-21 staging flags 已开**（orchestrator 代执行，用户授权，SSH 直写 staging DB + FEATURE_FLAG_UPDATED 审计行）：`preRevealRefundEnabled=true`（即时生效，止血）、`guestEventPreviewEnabled=true`（休眠，代码部署后生效）；`noRefundAfterReveal` 无行无 env=保持关。staging 支付=真实微信 ¥0.01 测试单。S2.4 staging 复演 ses_ea2b148b1ffedBeeQ7TqvHfVCf（L0 脚本 SQL bug 已回灌修正，续跑中）。
- **收银台审计车结果**（`docs/deliverables/2026-10-21-conversion-checkout-audit/audit-report.md`）：AC-06 6/6 PASS、AC-07 行内 6/6 PASS；design 19/20 / completeness 40/44（B1 修复后 42）/ perf PASS 53/60（全 provisional）；rubric P0e 12/24 ✅、P0c 11/24（差 1 已裁决，见下）；双签清单 14 条证据齐。**BLOCKING-1**：DuoEntryLink 未带 `?poolId=` → invite 页 duo 车道绑 `myRegistrations[0]`，收银台时刻无报名行 → 承诺链断（§3.1 五环证据）。已派修复 ses_ea2abb91cffeKMqFYx50iJPc40（导航带 poolId + invite 页 query 优先 + 契约测试，服务端零改动）。
- **对标平台 代号 scrub 事件**：某 agent 全局改名（代码+docs+deliverables，内部代号→conversion/benchmark/转化，零残留）。代价：`experimentBucket.test.ts` golden vectors 输入串被改、期望值未重算 → 1 失败，主会话已修（golden-d→0 换入+注释留档「改名必须重算」，10/10 绿）；截图工具链三套名不匹配（文件 conversion / import bench / README 内部代号）→ 已派正名+实跑批 ses_ea29a77a8ffeHKVnOqvTQRLen4（统一 checkout-conversion + 出 5 张门禁图）。**本文档及全部 deliberation/deliverable 文件现名 = `*-conversion-*`**；sprint 合同文件名未动（.git 目录未被 scrub）。
- **P0c rubric 11/24 裁决（orchestrator 拍板）**：惊喜感 2→3（连接线 one-shot scaleX 是设计 §5.3.1 指定的详情页唯一编排时刻，Linear 参照成立）→ P0c=12/24 压线过；成就感/身份/归属三维结构性封顶系信任面设计红线（§1 禁个性化），据实记录不再追分。
- **B1 修复完成 ✅**（ses_ea2abb91cffeKMqFYx50iJPc40）：`?poolId=` 全链（DuoEntryLink.tsx:55-64 → invite 页 query 优先消费 index.tsx:81-89/132-135）；顺手抓到第二 bug（duo-status query `enabled` 绑错 activeSharePoolId → 改绑 duoSharePoolId）；服务端零改动；3216 passed + typecheck + guardrails 全绿。
- **S2.4 staging 复演 Level B PASS**（2026-10-21，证据 `docs/deliverables/2026-10-21-conversion-staging-refund-replay/`）：staging 全真环境（real WeChat 应答、双 flag 行）种子用户+池+报名+假单全链——cancelPolicy=refundable（flag ON 分支铁证）→ DELETE 命中 `branch=pre_reveal_refund` → 原子 claim → **真实调微信退款 API**（假单号 404 RESOURCE_NOT_EXISTS 真实应答）→ Amendment 1 优雅降级 502 REFUND_FAILED_RETRYABLE 报名保留 → refund_attempts failed 行+claim 释放 → 幂等二次 502 无双退 → Level C 边界=registration.matchStatus（matched 后 legacy 零退款）→ 自清理归零全过。**未证项**：真实资金退款成功需真机真实支付（真机 3 步卡在报告 §5，非阻塞启用前条件）。AC-03 三路闭环（备忘+smoke+staging）→ S5 门禁解除。
- **2026-10-21 用户已 commit+push 全部 sprint 交付到 origin/main**（f15f801bd 服务端共享层 / 78f6df902 小程序端 / 9b8d05486 admin+截图 / 563918ee7 docs / fb86d565d 游客组件 / e915dca94 匿名化 / c9998779f+2850aaa5b icebreaker docs；B1 修复已核对在 HEAD）。验收转为合并后验证。staging 落后 9 commit 等 CI；`guestEventPreviewEnabled` staging DB 已 ON，部署落地即激活 → S1.4 解锁。server 全量复跑 **4159 passed 0 failed**（早前 1 failed 未复现）。用户并行工作 `feat(admin) flags 中文化`（a7889b593 未 push + 4 文件残余）**不碰**；主会话残余（计划 §8.5/S2.4 证据/截图正名）待截图批回来外科手术提交。
- S1.1 埋点审计备忘 → S1.2 client 6 事件 union + `lib/analytics/guestAttemptId.ts` → S1.3 server 白名单 parity + 双向契约测试 + `scripts/conversion-funnel-metrics.sql`（5 段）。高风险登记：analytics 路由早于 session 中间件，user_id 恒 null，guest 关联走 metadata guestAttemptId。
- S2.1 P0a 验证备忘（可以开；真 gap=RegistrationConfirmModal 硬编码承诺行）→ S2.2 法务签认（无阻塞，staging 先开）→ S2.5 modal flag 门控落地（15/15 render tests 绿）。
- S3.1 EventFlowStrip + S4.1 FAQ copy（8 条，`packages/shared/src/copy/eventFaqCopy.ts`）+ S4.2 EventFaqAccordion（cancel_refund 按 flag 门控 fail-closed）→ S3.2+S4.3 合并审计车源码级全绿（`docs/deliverables/2026-10-20-conversion-event-detail-audit/`）。
- S7.1/S7.2 guest-preview 服务端（`userEventPools.ts:400`、flag `guestEventPreviewEnabled` featureFlags.ts:524/693、DTO eventPools.ts:425、31/31+全量 4137 绿）→ S7.3/S7.4 卡组+Wow 编排全规格（FinalStage.tsx:766 插入、useResultsLoginHandoff.ts:160 login-success 发射）→ S7.5 rubric **编排版 15/24 KEEP 编排**（静态 12/24）→ S7.6 **perf PASS 55/60**（`docs/deliverables/2026-10-20-conversion-guest-preview-perf/`）。
- S8.1 AC-11 PASS（`2026-10-20-conversion-p1b-code-audit.md`）。
- CONCERN 修复：C3 observer watchdog（2500ms fail-closed 静态直出）✅；C2 满员场过滤（`lib/guestEventPreview.ts` Gate 3 spotsLeft>0，全量 4141 绿）✅。

**待用户决定**：~~C1 登录 pitch 三连堆叠 A/B/C~~ ✅ **2026-10-21 用户选 A，已落地**：钩子句改供给事实承接句「这周有 N 场正在排桌」（N=live preview count，GuestEventPreviewSection.tsx hookText；渲染/契约测试 32/32 绿，guardrails exit 0；next-horizon 保唯一情绪钩子）；copy 双签随合并批登记。剩余用户动作：staging admin 开 flag（见下）。

**Flag 裁决（2026-10-21 用户「keep all enabled」→ 主会话裁量）**：staging 开 `preRevealRefundEnabled` + `guestEventPreviewEnabled`（staging 验证需要）；**`noRefundAfterReveal` 保持关**（法务签认只覆盖 pre-reveal，post-reveal 不退款属另一承诺级别，待单独 sign-off）；生产 `preRevealRefundEnabled` 等 S2.4 复演证据后开；生产 `guestEventPreviewEnabled` 合并后灰度。

**进行中**：S5.1 P0d 服务端分桶（ses_ea2ed4bf8ffe6esnyzGMLMVulC，kimi-k2.6：hash(userId) mod 2 确定性分桶随收银台数据下发，零新表）。S5.2 客户端（RefundGuaranteeLine 两行 stack）等 S5.1 落地后派。

**待派（解锁即走）**：S2.4 staging 复演、S5 P0d（hash 分桶 50/50）、S6 P1a DuoEntryLink —— 全挂 staging flag ON 证据。S1.4 staging 抓包需合并+staging 部署后执行。

**合并前批次**：source-lock 契约测试 + 375×667/320×568 截图（进行中）→ 中端机 6 机位录屏（清单在 perf 报告）→ 主会话验收 → commit。

## 9. 明确不做（冻结清单）

付款前置 · 真人审核流水线 · 群聊沉淀终点 · 虚构社会证明数字 · 转化 式模拟聊天指引 · 一人代付两座（Q-C 双方一致否决）· Discover arrival coachmark 扩容（冲突 #3 已裁决）· Q-D 第二层揭晓（归档，P0/P1 落地 + 互选率基线后由 draft-prd 单独立项）· P2 recap 金句（后续单开 sprint）· 任何新增 blocking overlay · onboarding `nextStep` 结构变更 · 新增 LLM 调用 · 新增 DB 表。

## 10. Model Recommendation for Execution

- **Recommended Model**：默认 **DeepSeek V4 Pro**（1.00x）执行全部实现与验收任务；**S7.3（P1c 客户端编排）升级 Kimi K2.6**（2.50x）；**S8.1 审计用 DeepSeek V4 Flash**（0.33x）。
- **Justification**：规格已冻结（ambiguity 低）但 blast radius 跨支付 / 获客 / auth 边界（高）→ Pro 基线；S7.3 是全场多文件协调 + 指令遵循密度最高的一单（onboarding 子包 + 编排规格 + flag 互斥契约），正是 Kimi K2.6 强项区间；S8.1 为机械 grep 备忘，Flash 足够；审计/验收类（qa-agent、verifier、user-satisfaction-auditor）保持 Pro——验收误判成本高于省下的倍率。
- **Estimated Premium Request Cost**：约 20 个派单 ≈ 实现类 11×Pro（11.0）+ S7.3 1×Kimi K2.6（2.5）+ S8.1 1×Flash（0.33）+ 审计/验收/复盘类 7×Pro（7.0）≈ **21 premium request units**（不含 W3 灰度观察期人力与运营动作）。
