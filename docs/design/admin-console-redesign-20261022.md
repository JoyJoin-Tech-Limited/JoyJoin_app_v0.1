# PRD：JoyJoin 运营控制台重建（Admin Console Redesign）

- **日期**: 2026-10-22
- **状态**: Draft — 待人类决策（见 §12 开放问题）。工作量已在 §8.0 从 29 修正为 ≈56.5 人日；并行执行与文件所有权见 §14；评审补遗（含 11 条 `[MUST]`）见 §15
- **来源**: 用户反馈（"看板偏 raw、缺洞察、不够好用"）+ 后台 UI 生态调研（shadcn-admin / tremor / next-shadcn-admin-dashboard）+ 商业化备忘录结论合并
- **影响面**: `apps/admin-client`（UI 重建）· `apps/server/src/routes/domains/admin*.ts`（4 处数字修正 + 4 个只读端点）· `packages/shared/src/schema`（本期零 DDL，两处 待验证）
- **Harness 分级**: Tier 3（跨端、跨路由、含数据契约变更、含商业口径）

---

## 0. 摘要：本 PRD 要做的三件事

1. **先修真话，再画好图。** 后台当前有 4 个数字与其标签不符（见 §1.2）。在错误的数字上做出漂亮的图表，比现状更糟。Phase 1 只做真话 + 基础件，不新增任何图表。
2. **把"报表"改成"决策队列"。** 看板的首要职责不是展示指标，而是回答三个问题：**变了什么、为什么、我该点哪里**。现状 15 个卡片块全部是"是什么"，零个"所以呢"。
3. **让三个隐形的商业数字可见。** 每场实收单价、排桌审批时延、券核销→支付转化。这三个数字今天在系统里可计算、无界面、无人计算——没有它们，定价阶梯与排桌产能都无法被管理。

**一句话结论**：这是一次**信息架构 + 数据契约**的重建，视觉更新是它的副产品，不是目标。

---

## 1. 问题陈述

### 1.1 运营者原话（问题的主语是人，不是界面）

> "我不知道今天该干什么。看板从上滚到下大概有十几块，但没有一块告诉我哪个数字变坏了、坏在哪、谁该去处理。"
>
> "同一个东西两个数。上面写'即将截止 · 报名不足 3 个'，下面写'低填充池 · 24h 内截止 5 个'。我该信哪个？"
>
> "我要从'低填充池'跳到活动池页面，然后自己再用脑子记着是哪几个池。跳一次丢一次上下文。"
>
> "定价页就是一张表，我改一个数字，然后……就不知道了。这个月卖的月卡多还是六连包多、每场局实际收多少钱，我算不出来。"

四类问题，按修复价值排序：

| # | 问题 | 证据（已核实） | 影响 |
|---|---|---|---|
| P1 | **数字与标签不符**（4 处） | §1.2 | 运营基于错数做决定；发现一次即失去对整个看板的信任 |
| P2 | **无决策层**：只有指标，没有"变了什么/为什么/该做什么" | 看板 905 行、15 个卡片块，0 句洞察文案、0 个基线、0 个环比、0 个 sparkline | 每块都要人脑二次解读；新人无法上手 |
| P3 | **无对象上下文**：跳转不带参数 | 告警 `setLocation("/admin/event-pools")` 不带任何过滤；`GET /api/admin/event-pools` 只接受 `limit`/`offset`（`adminEventPools.ts:107-110`），无 status / 填充率 / 截止窗口过滤 | 每一次下钻都要人肉重新筛选（唯一例外：`/admin/users?maxCompleteness=50`） |
| P4 | **无商业口径**：收入侧只有"本月收入"一个数 | 定价页 484 行、单行 PATCH、无单价列、无 SKU 结构、无版本/回滚 | 定价阶梯的 3.78× 价差无法被观测，也无法被验证 |

### 1.2 已验证的四处数据失真（Phase 1 必修）

| # | 位置 | 现状 | 为什么错 | 判定 |
|---|---|---|---|---|
| D1 | `apps/server/src/routes/domains/adminUsers.ts:255` `GET /api/admin/stats` | `await storage.getAllUsers()` 把**全表用户**读进 Node 内存，再在 JS 里 `reduce` 出 archetype / city / level / completeness 分布 | O(n) 内存与 O(n) 序列化。用户量到 10 万级时这是**可用性事故**，不是性能优化项 | 修（SQL 聚合） |
| D2 | 同上，`userGrowth = Math.round(newUsersThisWeek / totalUsers * 100)` | UI 文案 `用户增长 · 相比上周`（`AdminDashboard.tsx:136-139`） | 这是"本周新增占总用户的比例"，不是周环比。真实 WoW 应为 `(近7天新增 − 前7天新增) / 前7天新增`。当前公式在增长期**永远显示一个正的小数字**，且分母越大数字越小——方向与直觉相反 | 重定义 |
| D3 | `adminUsers.ts:469` `underfilledPoolsClosingSoon` | `SELECT COUNT(*) FROM event_pools WHERE registration_deadline BETWEEN NOW() AND NOW()+24h` —— **无任何填充率条件**，却渲染成「即将截止 · 报名不足」 | 同一屏上 `AdminDashboard.tsx:70-73` 用 `filterPoolsClosingWithin24h()` + `isLowFill()`（`warRoomUtils.ts:119`）算出第二个数字。**同一个概念两个数，服务端那个还是错的** | 重定义 |
| D4 | `apps/server/src/repositories/legacyStorageRepo.ts:614` `getInsightsData()` | `匹配成功率 = COUNT(blind_box_events WHERE status IN ('matched','completed')) / COUNT(blind_box_events)` | `blind_box_events` 行只在排桌落库时创建（`matching/matchPersistence.ts:181`），分母本身就是"已排桌"——该指标**结构性恒等于 ~100%**，永远不可能报警 | 重定义 |

**判定口径说明**：保留 = 数字与标签一致、来源可查；重定义 = 概念有效但公式错；删除 = 概念本身无决策价值。

### 1.3 三个隐形数字（商业化的真正杠杆）

| 数字 | 今天为何不可见 | 可计算性 | 定义 |
|---|---|---|---|
| **每场实收单价** | 无任何界面；`AdminPricingPage.tsx` 只有 plan 表与单行 PATCH | ✅ `payments.final_amount` + `payments.payment_type` + `event_pools` 成行场次 | 期内 `SUM(payments.final_amount WHERE status='completed')` / 期内成行场次数。同时给 **SKU 结构**（subscription / event / event_bundle 三分类占比）与 **单场局票均价** 两个切面 |
| **排桌审批时延** | 列存在，无人算差值 | ✅ `event_pools.operator_reviewed_at`（`_definitions.ts:441`）− `event_pools.matched_at`（`:453`）；队列键 `operator_review_status`（`:438`） | P50 / P90（小时）。**前提：仅在 `matchingOperatorReviewEnabled=true` 时有样本**——该开关在冷启动期被显式关闭（见 Q9），因此本期同时提供恒有样本的「排桌时延（系统段）」作为主口径 |
| **券核销 → 支付转化** | 无 read endpoint，无界面 | ✅ `user_coupons.is_used` + `used_at`（`_definitions.ts:1516-1524`）→ `payments.coupon_id` + `status='completed'`（`:1447`） | 期内核销券的用户中，产生已支付订单的比例；附带券带来的 GMV 与折扣率 |

**为什么这三个数字决定这次改造是否值得做**：定价阶梯（`seed_pricing_plans_20260805.sql`）为 悦聚月卡 ¥98/30天、六连局包 ¥370/6、三连局包 ¥211/3、单场局票 ¥88。按"月卡 6 场"折算，名义单价 ¥16.3 vs 六连包 ¥61.7 = **3.78× 价差**；而 `apps/server/src/lib/entitlement.ts:40-42` 把订阅当作布尔闸门（`mode: 'subscription'`，`availableEventCredits` 强制 0），**服务端全树无任何按周期次数上限**（已 grep）。也就是说月卡用户的实际单场成本下限不受约束：去 12 场 = ¥8.2，价差变成 7.5×。**在"每场实收单价"可见之前，这个阶梯是好是坏无从判断**——这不是定价问题，是观测缺失问题。

> 边界：定价策略本身归 `payment-entitlement-authority`。本 PRD 只要求**管理端可见**（单价列 + SKU 收入结构 + 券转化），不重新决定价格，也不改 entitlement 语义。

### 1.4 为什么"好看"这个抱怨是合理的，但不能靠装饰解决

运营说的"raw"，实测对应三件具体的事：

1. **没有视觉层级**：905 行里 6 张"通用统计卡"（`AdminDashboard.tsx:575-605`）与 4 张渐变游戏化卡（`:823-878`）视觉权重相同，用户无法判断先看哪。
2. **数字不可扫读**：数值无等宽数字（`tabular-nums`）、无单位分层、无对齐；卡片里 `text-2xl font-bold` 与 `text-sm font-medium` 混排但无栅格。
3. **状态色无系统**：`red-50/amber-50/blue-50/green-50` 四套 Tailwind 调色板与 `--primary` 紫色并存于同一屏（`AdminDashboard.tsx:250-350`），而 `--chart-1..5`（`src/index.css:75-79`）在后台几乎未被使用。

**所以"premium"在本 PRD 中的定义是**：决策密度 + 可读性。具体可验收的规则：

- 一屏 ≤ 5 个 KPI；每个 KPI 必须带命名基线 + delta + sparkline + 下钻。
- 数字用 `font-variant-numeric: tabular-nums`；数值/单位两档字号（28/13px），不靠图标替代文字标签。
- 一屏一个强调色（`--primary: 280 45% 55%`）；状态色固定 4 个（success / warn / danger / neutral），全部走 token，禁止 `red-50` 这类裸色阶。
- **禁止**：渐变 KPI 卡、霓虹/玻璃拟态、发光阴影、装饰性插画占位、emoji（仓库硬规则）。
- 8px 基线栅格；卡片内距 16/20 两档；表格行高 40px，数字右对齐，决策列在左、实体列在右。

---

## 2. 目标与非目标

### 2.1 目标

| # | 目标 | 可观测的完成标志 |
|---|---|---|
| G1 | 后台不存在"标签与公式不符"的数字 | §6 每个数字有 SQL 级定义 + 契约测试 |
| G2 | 看板首屏回答"今天做什么" | 动作队列在首屏第一屏；每行有 SLA 与跳转 |
| G3 | 每个 KPI 可解释 | 100% KPI 带命名基线 + delta，0 个裸数字 |
| G4 | 下钻不丢上下文 | 每个数字的跳转带过滤参数，落地页筛选器回显 |
| G5 | 三个隐形数字可见 | 每场实收单价 / 审批时延 P50/P90 / 券转化 三个数上线 |
| G6 | 运营者 30 秒内定位当天最该处理的一件事 | 可用性测试：5 名运营，4/5 在 30s 内指名正确项 |
| G7 | 页面状态完整 | 新面 100% 具备 loading（Skeleton）/ empty / error（`AdminQueryError`）/ 无权限四态 |

### 2.2 非目标（明确不做，防止范围漂移）

- ❌ **纯视觉重刷**：不做"只换皮不动信息架构"的重建。
- ❌ **暗色模式预设/霓虹主题**：保留一个规范亮色主题（`ThemeToggle` 现状不动，不新增预设）。
- ❌ **45 页全量重写**：`pages/admin/` 46 个 `.tsx`、23,907 行，本期只重建看板 + 经营分析 + 队列相关 6 个面，其余页面仅做状态补全（Phase 4a），不重排信息架构。
- ❌ **框架/数据层迁移**：React 18 + Vite 5 + Tailwind 3 + Radix + wouter + Recharts 2 全部不动。不引入 Next.js / Base UI / TanStack Table 9。
- ❌ **AI Copilot**：不做自然语言问数、不做 LLM 生成洞察。洞察栏用**确定性规则**（§5.4），因为可测试、可解释、零幻觉。
- ❌ **真实任务指派**：不做 `admin_tasks` 表、不做跨人分派（P4 之后再说）；本期"归属人"字段显示为「未分配 / 我」。
- ❌ **移动端适配**：后台维持桌面优先（≥1280px 设计基线），仅保证 ≥1024px 不破版。**代价必须写明**：活动当天的现场签到确实发生在手机上（`AdminWarRoomPage.tsx` 615 行只有 1 处 `md:` 网格，且后台无 PWA/manifest），因此队列第 6 行「今日活动未签到」在 P3 之后仍然是**桌面可执行、手机不可执行**——本期不做移动签到页，替代路径是企微提醒里的链接回到桌面端处理。若现场值守必须靠手机，这是一条独立立项（见 §15 M-9）。
- ❌ **定价策略变更 / entitlement 语义变更**：只做观测面。**并且**：本期不建任何成本/毛利口径——`venue_deals` 没有任何成本字段（`_definitions.ts:1342` 起的 venueDeals 块只有折扣相关列），所以「每场毛利」在本期结构性不可计算。KPI-4 必须在界面与 tooltip 写死「未扣场地成本」（见 §15 S-4），不得被读成利润。

---

## 3. 角色与工作流

### 3.1 三个角色

| 角色 | 今天实际能看到的 nav 条目 | 真实工作 | 本期应看到 |
|---|---|---|---|
| `super_admin` | 32 / 32 | 定价、开关、算法标定、账号、审计 | 全部 |
| `operator` | 约 20（`ALL_ROLES` 6 + `SUPER_OPERATOR` 14） | 建池、盯报名、跑排桌、审批、场地、当天值守、退款、反馈 | 5 固定 + 场地 + 内容 4 + 安全/反馈 2 ≈ 12 |
| `viewer` | 6（仅 `ALL_ROLES`） | 看数、对齐、截图汇报 | 今日看板 + 经营分析（只读），约 2 |

`ALL_ROLES / SUPER_ONLY / SUPER_OPERATOR` 三组权限常量保持现状（`src/lib/adminNavConfig.ts:39-41`），`canAccessAdminPath()` 继续作为**路由级 RBAC 唯一来源**。**现状缺陷**：越权时 `AdminGuard` 只弹 toast 再静默跳回看板（`AdminGuard.tsx:41-52`），用户不知道自己被挡了什么。本期补一个 `Forbidden` 页（§7），复用 satnaing 的 error-page 形态。

### 3.2 "运营的一天"：泳道 + 现有上下文断点

以一场局为时间轴。**每一行的"断点"就是本期要修的具体位置**。

| 阶段 | 运营要做的事 | 现在在哪个页面 | 断点 |
|---|---|---|---|
| ① 建池 | 复制模板 → 定时间/城市/预算档/组数 | `/admin/event-pools` → `EventPoolCreateDialog`（729 行） | 模板 `/admin/templates` 是独立页，建池时不在此页，来回跳 |
| ② 报名监控 | 每天看哪些池会填不满 | `/admin/dashboard` 的告警块 | **数字是错的（D3）**；点进去是无过滤的池列表 |
| ③ 排桌 | 触发匹配、看分组质量 | `/admin/event-pools`（详情 Dialog） | 排桌结果、审批状态、场地三者分散在三个页面 |
| ④ 审批 | 逐池批准才揭示（`matchingOperatorReviewEnabled`） | `/admin/matching-reviews` | 埋在第 2 组"匹配"里；**无批量接口**；无时延显示；无 SLA |
| ⑤ 场地 | 处理"场地待定"的组 | `/admin/venues` | 从告警跳过来不带组 ID，需要自己在 1157 行页面里找 |
| ⑥ 当天 | 签到、迟到、缺席、破冰进度 | `/admin/war-room`（615 行，最接近"动作队列"的原型） | 这是唯一已经"以异常为中心"的页面，但没被复用 |
| ⑦ 退款 | 处理 `refund_pending` 与失败退款 | `/admin/finance` | 两个来源（支付状态 / 退款尝试）分两处，看板也各算一次 |
| ⑧ 反馈 | 看评分、低分活动、AI 反馈 | `/admin/feedback` + `/admin/icebreaker-ai-feedback` | 同一诉求两个 nav 条目 |

**跨阶段共性缺陷（架构级，不是排版级）**：

- **对象上下文不随身**：`poolId` 在任何一次跳转后丢失。没有任何页面接受 `?poolId=` 作为上下文锚点。
- **同一屏 5 个并发请求各自为政**：看板并发拉 `/api/admin/stats`、`/api/admin/ops-dashboard`、`/api/admin/refund-attempts`、`/api/admin/venue-assignment/unassigned`、`/api/admin/event-pools`（`AdminDashboard.tsx:40-63`），其中 `event-pools` 是**全量池列表**（上限 200 行，无过滤）。首屏成本随池数量线性增长。
- **工作流没有状态机**：池在 `active → matching → matched → completed` 之间移动（`event_pools.status`，`_definitions.ts:432`），但没有任何视图按"卡在哪一步"组织。

### 3.3 用户故事（含验收要点）

- **US-1（operator，早上 9:30）**：我要在 10 秒内知道今天最该处理的一件事，而不是读 15 块卡片。
  → 动作队列按 `风险 × 时限` 排序，第一行可点击直达带过滤的目标。
- **US-2（operator，审批）**：我要一次批准多个池，并且知道每个池已经等了多久。
  → 队列行显示 `等待 3.2h`；批量接口逐池返回结果；超 SLA 行标红。
- **US-3（operator，下钻）**：我从"24h 内截止且报名不足 7 个"点进去，应该正好看到这 7 个。
  → 目标页 URL 带过滤参数并在 UI 回显；数量与服务端一致。
- **US-4（super_admin，定价）**：我要看到每个权益方案的**单场折算价**与本期实收结构，而不是一张 plan 表。
  → 新增 单价列 + SKU 结构 + 券折扣列。
- **US-5（viewer，汇报）**：我要能选时间范围并导出，不要"本月"这种写死的口径。
  → 日期范围控件驱动全部查询；CSV 导出（复用 `@/lib/csvExport`）。
- **US-6（任何角色，越权）**：我点到一个没权限的链接，应该看到一个解释与回退，而不是被静默弹走。
  → `Forbidden` 页 + 说明 + 返回入口。

---

## 4. 信息架构

### 4.1 现状盘点（已核实）

- `src/lib/adminNavConfig.ts`：**6 个固定项 + 5 组 = 32 个导航条目**（安全与反馈 3 / 匹配 5 / 运营配置 11 / 数据与洞察 4 / 系统 3）。
- `AdminLayout.tsx`：**37 个 `<Route>`**（32 个真实页面 + 4 个重定向 + 1 个 404），与 32 个导航条目一一对应。
- 无 nav badge、无 nav 搜索、无面包屑（`components/ui/breadcrumb.tsx` 存在但**零引用**）。
- `AdminDataInsightsPage.tsx` 已经叫「运营决策指挥中心」，已有 用户规模 / 商业健康 / 匹配效率 / 用户分层 / 活动质量 / 留存曲线 / 收入转化漏斗 七块——**但侧边栏与看板都不往那里引流**。这是整合机会，不是新造。

### 4.2 判断（诚实版）

**结论：组结构不是主要问题，"没有层级"和"入口按实体而非按工作分"才是。**

三条判断：

1. **"运营配置" 11 条是灾难**：一个分组里塞了 活动/模板/通知/内容/横幅/订阅/定价/优惠券/财务/邀请/双人成行 —— 覆盖 4 种不同工作（活动、触达、钱、增长），运营每天都在这里迷路。
2. **入口按实体切，不按工作切**：`活动池` / `活动` / `活动模板` 是同一个工作流的三个片段，却是三个 nav 条目；`数据洞察` / `成行分析` / `连接日志` 是同一份数据的三个切面，也是三个条目。
3. **最该被钉在顶部的三件事，一件都没钉**：排桌审批（阻塞用户）、24h 低填充池（阻塞成行）、场地待定（阻塞体验）。它们分散在第 2、2、6 个分组里。反而「街头盲盒运营」——一个每周打开一次的内容面——被钉在固定区。

### 4.3 目标 IA：32 → 16 条目，路由 0 删除

| 区 | 条目 | 含 tab 的工作区 | RBAC | Badge |
|---|---|---|---|---|
| **固定（5）** | 今日看板 `/admin/dashboard` | — | ALL | 待办总数 |
| | 排桌审批 `/admin/matching-reviews` | — | SUPER_OPERATOR | 待审批池数 |
| | 活动池 `/admin/event-pools` | tab：活动池 / 排期(`events`) / 模板(`templates`) | ALL | 24h 内低填充数 |
| | 用户 `/admin/users` | — | ALL | — |
| | 现场值守 `/admin/war-room` | — | SUPER_OPERATOR | 今日未签到组数 |
| **活动与场地（1）** | 场地管理 `/admin/venues` | — | ALL | 场地待定组数 |
| **经营分析（1）** | 经营分析 `/admin/insights` | tab：总览 / 成行(`outcome-analytics`) / 连接(`interaction-logs`) / 复盘(`feedback`) | SUPER_ONLY（operator 见只读 3 个 KPI） | — |
| **权益与定价（1）** | 权益与定价 `/admin/pricing` | tab：方案 / 优惠券(`coupons`) / 订阅(`subscriptions`) | SUPER_ONLY | — |
| **收入与增长（1）** | 财务与增长 `/admin/finance` | tab：流水 / 退款 / 邀请裂变(`referrals`) / 双人成行(`duo-invites`) | SUPER_OPERATOR | 退款待处理数 |
| **内容与触达（4）** | 通知推送 / 内容管理 / 横幅管理 / 街头盲盒运营 | — | SUPER_ONLY ×2 · SUPER_OPERATOR · ALL | — |
| **安全与反馈（2）** | 安全中心 `/admin/moderation` | tab：举报 / 内容审核日志(`content-filter`) | SUPER_OPERATOR | 举报待审数 |
| | 反馈管理 `/admin/feedback` | tab：活动反馈 / 破冰 AI 反馈(`icebreaker-ai-feedback`) | SUPER_OPERATOR | 待处理反馈数 |
| **系统（2）** | 算法工作台 `/admin/matching-config` | tab：配置 / 实验室(`matching`) / 日志(`matching-logs`) / 悦仔进化(`evolution`) | SUPER_ONLY | — |
| | 系统设置 `/admin/accounts` | tab：账号 / 审计日志(`audit-logs`) / 功能开关(`feature-flags`) | SUPER_ONLY | — |

**净变化**：32 → 16 条目（−50%）；5 个分组；**0 个路由删除**——被合并的 15 个路由全部保留，作为 tab 或 `Redirect`（旧 URL 必须继续可用，含现有书签与文档引用）。

**逐项判定**：

| 判定 | 条目 |
|---|---|
| **晋升（钉到固定区）** | 排桌审批（从"匹配"组）· 场地管理（从固定区外的实体页，仅通过队列入口）· ~~数据洞察~~（晋升为分组级分析中枢） |
| **合并（→ tab）** | 内容审核日志→安全中心 · 破冰 AI 反馈→反馈管理 · 成行分析/连接日志→经营分析 · 优惠券/订阅→权益与定价 · 邀请裂变/双人成行→财务与增长 · 活动排期/模板→活动池 · 匹配配置/实验室/日志/悦仔进化→算法工作台 · 管理员账号/审计日志/功能开关→系统设置 |
| **降级（离开固定区）** | 街头盲盒运营 → 内容与触达（周频内容工作，非日频运维） |
| **删除（页面保留，导航不再出现）** | 无。本期不删任何路由能力，只删"导航噪音" |
| **内容删除（不是路由删除）** | 看板内的游戏化 4 卡 + 等级分布 + `平均等级/悦币流通/总经验值/活跃连击`（§5.6） |

**风险提示**：`系统设置` 把「算法标定」和「管理员账号」放一个 tab 组里，语义上略勉强——它们共享"超级管理员专属、低频、危险操作"这三个属性，这是分组的真实依据（低频危险面聚合）。若人类决策认为不成立，降级为两个分组（见 §12 Q2）。

### 4.4 Nav badge 规格

- 数据源：**单个端点** `GET /api/admin/nav-badges`（§6.3），返回 5 个 count + `asOf` 时间戳。
- 刷新：`TanStack Query`，`staleTime: 60s`，`refetchOnWindowFocus: true`；不轮询、不走 WS（后台是低并发面）。
- 语义硬约束：**badge 数字必须与点击后页面的行数一致**。为此 badge 端点与目标列表端点必须共用同一个 WHERE 子句构造器（服务端共享函数），并在契约测试里断言 `badge === list.total`。
- 渲染：`Badge` 尺寸 18px 高、`tabular-nums`；>99 显示 `99+`；`0` 不渲染（不留 0，避免噪音）。
- 失败：badge 请求失败时静默不渲染徽标（不渲染 `!` 错误标），避免把网络抖动变成运营焦虑。

### 4.5 Nav 搜索：决策 = 做，但不引入 `cmdk`

**事实**：16 个条目 / 32 个路由，今天零搜索。运营现在靠记忆找页面（`.` 与 `,` 之间没有中间层）。

**但**：`cmdk` 与 framer-motion/embla/vaul 于 2026-09-07 被刻意清除（`apps/admin-client/AGENTS.md` §1 明列为 legacy）。重新引入仅为 16 条目的模糊匹配，不划算。

**决策：Phase 3 做一个 120 行以内的路由调色板**，基于已有的 `Dialog` + `Input` + `ScrollArea`：

- 触发：`Cmd/Ctrl + K` + header 搜索框（`placeholder: 搜索页面`）。
- 范围：**只匹配导航条目与页面标题**，不做数据命令、不做写操作命令（避免"在调色板里误操作生产数据"这类事故类别）。
- 数据：直接读 `ALL_NAV_ITEMS` + `getPageTitle()`，零新依赖、零新端点。
- 为什么不是 Phase 1/2：调色板的价值在"条目多到记不住"时最大；IA 收口到 16 条后，先观察 2 周，再决定是否需要。若 16 条仍不可记，Phase 3 上线。

---

## 5. 新看板规格（`/admin/dashboard`）

### 5.1 页面结构（自上而下 4 段，一屏内见前两段）

```
┌─ Header ────────────────────────────────────────────────────────────────┐
│ 今日看板      [今天|近7天|近30天|自定义]   数据截至 14:23 · 刷新 · 导出   │
├─ KPI Strip（5 张，等宽，单行）─────────────────────────────────────────┤
│ 新增报名 · 成行率 · 排桌审批时延 · 每场实收单价 · 券核销→支付转化        │
├─ 主体：左 8 列 = 运营动作队列    │  右 4 列 = 洞察栏（≤5 句）           │
├─ 异常优先台账（全宽表格，按 riskScore 降序）───────────────────────────┤
└─ 折叠：今日活动（3 行摘要 → 现场值守）──────────────────────────────────┘
```

**删除的页面级元素**：`数据更新于 HH:mm:ss` 的手动刷新区块改为 header 内联（保留能力，去掉视觉权重）；`本页 15 个 Card` 的垂直堆叠结构整体废弃。

### 5.2 日期范围控件（新增，强制）

- 选项：今天 / 近 7 天（默认） / 近 30 天 / 自定义（`calendar` popover，Phase 1 vendored）。
- 行为：**驱动本页全部查询与全部 KPI 的 baseline 计算**。任何写死"本月""本周"的代码必须删除。
- baseline 规则：`今天/近7天/近30天` → 前一等长区间；自定义 → 前一个等长区间；区间长度 < 3 天时，基线标签显示「基线不足」且 delta 不渲染（不画一个假的 ±0%）。
- 状态：Range 存入 URL query（`?range=7d&from=&to=`），可分享、可刷新保持。

### 5.3 KPI Strip（≤5，每个都必须有：命名基线 + delta + sparkline + 下钻）

| KPI | 定义（精确） | 命名基线 | 下钻 |
|---|---|---|---|
| **新增报名** | `COUNT(*) FROM event_pool_registrations WHERE created_at ∈ range` | 「较上一等长周期」 | `/admin/event-pools?registeredWithin={range}` |
| **成行率** | **分母（唯一时间锚）**：`date_time ∈ range` 且 `date_time < NOW() − 3h` 且 `is_test_pool = false` 的池数。3h 是 `lib/poolCompletionSweep.ts` 的 `POOL_COMPLETION_BUFFER_MS`——未过 buffer 的场次还没被落成 `completed`，把它算进分母等于把「尚未揭晓」判成「未成行」。**分子**：同一分母集合中 `status IN ('matched','completed')` 的池数 | 「较上一等长周期」+「目标 70%」（目标值 Phase 2 由人类设定，之前显示「目标待定」） | `/admin/event-pools?outcome=unformed&dateWithin={range}` |
| **排桌时延 P50** | **主口径（恒有样本）**：`(matched_at − registration_deadline)/3600` 小时，样本 = 期内 `matched_at` 非空的池。**次口径（仅当 `matchingOperatorReviewEnabled=true`）**：`(operator_reviewed_at − matched_at)/3600`，即人工审批段 | 「较上一周期」；审批段开启时追加「SLA 4h」 | 主口径 → `/admin/event-pools?matchedWithin={range}`；次口径 → `/admin/matching-reviews?reviewedWithin={range}` |
| **每场实收单价** | `SUM(payments.final_amount) WHERE status='completed' AND created_at ∈ range` / 期内成行场次数 | 「较上一周期」+「上一周期单场局票均价 ¥88」（可配置基线） | `/admin/pricing?tab=plans&range={range}` |
| **券核销→支付转化** | `COUNT(DISTINCT p.user_id) FROM payments p JOIN user_coupons uc ON p.coupon_id=uc.coupon_id AND p.user_id=uc.user_id WHERE uc.used_at ∈ range AND p.status='completed'` / `COUNT(*) FROM user_coupons WHERE used_at ∈ range` | 「较上一周期」 | `/admin/coupons?range={range}` |

**为什么审批时延不是主口径**：审批开关在冷启动期被显式关闭（冷启动无值班运营；开着会让每次排桌停在 `operatorReviewStatus='pending'` 并阻断通知/场地/邀请派生链路——见 `featureFlags.ts` 工作区未提交改动与 Q9）。一个恒空的 KPI 是装饰品，所以主口径取**系统侧排桌时延**（截止 → `matched_at`），审批段作为"开关打开后才出现的第二段"由同一个 KPI 槽位条件渲染。

**KPI 硬约束（进验收）**：没有命名基线的数字不允许进入 KPI Strip；只有 delta 没有基线的数字，降级到台账或二级页。

**权限处理（决定，不是回避）**：KPI-4/KPI-5 涉及收入，数据源端点 `SUPER_ONLY`。`operator` / `viewer` 看到的是**占位卡**（标题 + 「仅超级管理员可见」+ 申请入口），**不是 403 报错**。这样避免 ALL_ROLES 页面里出现错误态，同时不伪造数字。

### 5.4 运营动作队列（本页的主语）

每行固定 6 列：`待办 | 正确数字 | 建议动作 | SLA | 归属人 | 跳转`。排序 = `超期程度 × 影响人数`；超 SLA 行左侧 2px danger 竖线。

| # | 待办 | 正确数字（唯一来源） | 建议动作 | SLA | 归属 |
|---|---|---|---|---|---|
| 1 | **条件行**：`matchingOperatorReviewEnabled=true` → 排桌待审批；`false` → 排桌积压 | 开启：`COUNT(*) FROM event_pools WHERE operator_review_status='pending'` + 最老一条 `NOW() − matched_at`；关闭：`COUNT(*) FROM event_pools WHERE status IN ('active','matching') AND matched_at IS NULL AND registration_deadline < NOW()`（截止后仍未排桌） | 开启：「批量审批 · 最长等待 {x}h」；关闭：「排桌未完成 · 逾期 {x}h」→ 去触发排桌 | 开启 2h / 关闭 6h | operator |
| 2 | 24h 内截止且报名不足 | `COUNT(*) FROM event_pools p WHERE p.status='active' AND p.is_test_pool = false AND p.registration_deadline BETWEEN NOW() AND NOW()+24h AND (SELECT COUNT(*) FROM event_pool_registrations r WHERE r.pool_id=p.id) < p.min_group_size * p.target_groups` —— **阈值必须是「每组最小人数 × 目标组数」**；`min_group_size` 是单组最小成局人数（`_definitions.ts:427`，默认 4），多组池用单组阈值会系统性漏报（3 组 × 6 人 = 18 目标的池，8 人报名不会被标红）。同源函数见 `poolRealtimeMatchingService` 的 `targetRegistrations` | 「催报名 / 合并场次 / 提前取消」 | 截止前 | operator |
| 3 | 场地待定 | `event_pools` 中已 matched 且无 venue 分配的组数（复用 `GET /api/admin/venue-assignment/unassigned`） | 「去分配场地」 | 12h | operator |
| 4 | 退款待处理 | `COUNT(*) FROM payments WHERE status='refund_pending'` + `COUNT(*) FROM refund_attempts WHERE status='failed'`（**两个数分开显示**，不合并） | 「处理退款 / 重试失败」 | 4h | operator |
| 5 | 举报待审 | `COUNT(*) FROM reports WHERE status='pending'` | 「进入安全中心」 | 8h | operator |
| 6 | 今日活动未签到 | 今日场次中 `event_attendance.attendance_status = 'pending'` 的**组**数（不是人数，行是 per-user）。**必须读 `attendance_status` 而不是 `status`**：匹配落库时写的是 `status:'confirmed'`（`matching/matchPersistence.ts:171`），`status='pending'` 永远不成立 → 恒 0（D4 同类结构性空指标）。今日范围要经 `blind_box_events.date_time` 判定，`event_attendance.blind_box_event_id` 无 FK 约束（`_definitions.ts` 注释已声明） | 「打开现场值守」 | 活动开始 +30min | operator |
| 7 | 注册流程滞留 | 复用现有 SQL（`adminUsers.ts:485-492`：`onboarding_checkpoint` 7 天未推进） | 「批量提醒 / 排查」 | 周频 | operator |

**硬规则**：
- 每个数字**只允许有一个服务端来源**。客户端不得再用本地过滤重算（这正是 D3 的成因）。删除 `AdminDashboard.tsx:70-73` 的 `lowFillPools` 本地计算。
- 每行 0 时**不消失**，显示 `已清空` + 灰态（消失会让运营无法确认"是没数据还是没加载"）。
- 归属人字段本期只显示「未分配」或「我」（无指派系统，不假装有）。

### 5.5 洞察栏（右 4 列，≤5 句，确定性规则）

形态：`一句话结论` + `数字证据` + `跳转`。例：

> 成行率 62%，较上周期 −8pt。主因：3 个场次在截止前 24h 报名不足（占未成行 75%）。→ 查看这 3 个场次

**规则引擎**（服务端 `lib/adminInsights.ts`，纯 SQL + 固定模板，**无 LLM**，可单测）：

| Rule | 触发条件 | 生成句子 | 证据字段 |
|---|---|---|---|
| R1 | 成行率环比 ≤ −5pt | 「成行率下降，主因是截止前低填充池」 | `lowFillCount / unformedCount` |
| R2 | 审批时延 P50 > SLA | 「审批积压：{n} 个池待审，最老 {h}h」 | `pendingCount`, `oldestAge` |
| R3 | 每场实收单价环比 ≤ −10% | 「单价下降，SKU 结构向 {plan} 倾斜 / 券折扣率升至 {x}%」 | `planMix`, `discountRate` |
| R4 | 券核销 ↑ 且支付转化 ↓ | 「券发得多、用得少：转化 {x}%，券面额可能高于门槛」 | `redeemed`, `converted` |
| R5 | 反馈均分 < 4.0 且集中于某场地 | 「{venue} 的评分 {x}，低于整体 {y}」 | `avgRating by venue` |

**无规则命中时**：渲染一句「本周期无异常波动」+ 最后一个周期对比数字。**不允许**渲染"一切正常"式的空话冒充洞察。

### 5.6 异常优先台账（全宽表格，异常优先于实体）

列序（**决策列在左，实体列在右**）：`风险 | 对象 | 异常 | 影响（人数/金额） | 已持续 | 建议动作 | 归属`。

- `riskScore` = 规则加权（超 SLA 权重最高），服务端算，客户端只排序。
- 默认 top 10，可展开全量；行点击 → 对象详情（带 `poolId` 上下文）。
- 空态必须给动作（「无待处理异常，去看经营分析」），不是一个灰图标。

### 5.7 现存 15 块的逐块处置（保留 / 合并 / 删除 / 降级）

| # | 现状块 | 判定 | 去向与**正确数据源** |
|---|---|---|---|
| 1 | 今日待办 alerts grid（7 种 tile + 全清态） | **合并 → 动作队列** | 全部 7 行迁入 §5.4；`underfilledPools` 改用带填充条件的 SQL（§6.1 D3） |
| 2 | 今日活动 | **保留（移出主位）** | 折叠为 3 行摘要 → 点击进 `/admin/war-room`；数据源 `/api/admin/ops-dashboard.todayEvents` 保留 |
| 3 | 运营健康记分卡（6 个内联 IIFE，阈值 5%/80%/70%/15%/50%/10） | **删除** | 阈值无来源、无基线、无历史 → 由 5 个 KPI（§5.3）替代。**阈值必须由人类定义或删除，不得沿用手写魔数** |
| 4 | 语义匹配观测（3 卡） | **降级** | → 算法工作台（`/admin/matching-config?tab=lab`），`SUPER_ONLY`。数据源 `stats.matchingMetrics` 保留但移出 ALL_ROLES 页面 |
| 5 | 6 张通用统计卡（用户总数/订阅会员/本月活动/本月收入/新增用户/用户增长） | **拆分** | 用户总数、订阅会员 → 经营分析·总览；本月活动 → 活动池 badge；本月收入 → KPI-4 的分母/结构；新增用户 → 经营分析；**用户增长 → 删除（D2，公式错）** |
| 6 | 本周匹配满意度卡 | **降级 + 补基线** | → 经营分析·复盘（数据源：`event_feedback` 均分，按周分桶）。补环比基线后才可回看板 |
| 7 | 低分匹配预警卡 | **合并** | → 算法工作台（标定面）；若无处置动作则删除。数据源 `stats.lowScoringMatches` 需标明"分数阈值"与样本窗口 |
| 8 | 性格类型分布 | **降级** | → 经营分析·用户分层 |
| 9 | 资料完整度分布（5 星） | **降级（保留唯一可用下钻）** | → 经营分析·用户分层；`/admin/users?maxCompleteness=50` 这个既有下钻**必须保留**（全后台唯一正确的下钻样例） |
| 10 | 12 原型分布 | **降级** | → 经营分析·用户分层 |
| 11 | 城市分布 | **降级** | → 经营分析·用户分层（叠加覆盖图，与 `adminPoolCoverage` 口径对齐 待验证） |
| 12 | 资料待完善用户（weak users 列表） | **合并** | → 动作队列第 7 行 + 经营分析·用户分层明细 |
| 13 | 游戏化概览 4 张渐变卡（平均等级/悦币流通/总经验值/活跃连击） | **删除** | 无决策动作的虚荣指标；`stats.gamificationStats` 保留在 API（不删契约），UI 移除。若未来做激励计划再以新面重建 |
| 14 | 等级分布 | **删除** | 同上 |
| 15 | 手动刷新 + `数据更新于` 时间戳 | **保留（重做），但不再是全局一个时间戳** | 一个 header 全局时间戳是谎言：badge 60s 缓存、KPI 端点有缓存、队列/台账实时。改为**每区块各自的 `asOf`**（服务端在每个响应里返回），header 只保留「刷新」按钮。见 §15 S-3 |

### 5.8 页面状态（强制）

| 状态 | 规格 |
|---|---|
| Loading | 5 个 KPI 用 `Skeleton` 等高占位（**不是 spinner**）；队列区 7 行骨架；台账 5 行骨架。禁止整页 spinner（现状 `AdminDashboard.tsx:171-180` 是整页 spinner，必须替换） |
| Empty | 每个区块独立空态，必须带动作（`EmptyState` 需扩展 `action` 插槽，§7） |
| Error | 每区块独立 `AdminQueryError`（含 `code` 与 retry），**不允许一错全页崩**（现状是 stats 一挂整页黑） |
| 部分失败 | KPI 4/5 无权限 → 占位卡；其余区块正常渲染 |
| 无权限 | `Forbidden` 页（§4.3） |

---

## 6. 数据契约

### 6.1 四处失真的修复

#### D1 — `GET /api/admin/stats` 的 O(n) 内存

**现状**：`getAllUsers()` → JS reduce 出 4 个分布 + 逐用户算完整度（`calculateAdminProfileCompleteness`）。

**修复（Phase 1，拆成两个端点）**：

```
GET /api/admin/stats/overview?range=7d
  → { totalUsers, subscribedUsers, newUsersInRange, revenueInRange, eventsInRange }
    全部为单条 SQL 聚合，禁止 SELECT * INTO Node。

GET /api/admin/users/distributions
  → { archetype: [...], city: [...], level: [...] }   -- 三条 GROUP BY
  -- 0 行 JS reduce

GET /api/admin/users/completeness-distribution   （分页/预算受限）
  → { star1..star5, sampledRows, isSampled }
  -- 完整度是 JS 打分逻辑（含多字段加权），无法无损下推到 SQL。
  -- Phase 1：仅 SELECT 打分所需列 + 上限 20,000 行 + 5 分钟缓存 + isSampled 标记。
  -- Phase 2（待验证）：materialize `users.profile_completeness_score` 列，
  --   由写入路径更新；作为 schema 变更单独评审（本期不做 DDL）。
```

**验收**：`/api/admin/stats/overview` 的 Node 峰值内存与 users 行数**无关**（用 10 万行 fixture 断言 RSS 增量 < 20MB）。完整度端点若 `isSampled=true`，UI 必须标注「基于最近 N 行样本」。

#### D2 — `userGrowth`

```sql
-- 定义：周环比（真 WoW）
WITH cur AS (SELECT COUNT(*)::int c FROM users WHERE created_at >= NOW()-INTERVAL '7 days'),
     prev AS (SELECT COUNT(*)::int c FROM users WHERE created_at >= NOW()-INTERVAL '14 days'
                                              AND created_at <  NOW()-INTERVAL '7 days')
SELECT cur.c AS current, prev.c AS previous,
       CASE WHEN prev.c = 0 THEN NULL
            ELSE ROUND(((cur.c - prev.c)::numeric / prev.c) * 100, 1) END AS wow_pct
FROM cur, prev;
```

- `wow_pct` 允许 `null`；UI 显示「基线不足」而非 `0%`。
- 字段名改为 `newUsersWowPct`（保留 `userGrowth` 一个 release 作为 deprecated alias，避免旧客户端崩溃——`AdminStats` 是内部契约，但仍按兼容处理）。
- **判定：重定义**。同时该数不上 KPI Strip（用户增长不是运营当天可动作的量），只在经营分析出现。

#### D3 — `underfilledPoolsClosingSoon`

```sql
SELECT COUNT(*)::int AS count
FROM event_pools p
WHERE p.status = 'active'
  AND p.is_test_pool = false
  AND p.registration_deadline > NOW()
  AND p.registration_deadline <= NOW() + INTERVAL '24 hours'
  -- 注意：阈值 = 每组最小人数 × 目标组数，不是单组阈值。
  -- 用 p.min_group_size 只修正了「缺填充条件」的一半——多组池仍会漏报。
  AND (SELECT COUNT(*) FROM event_pool_registrations r
        WHERE r.pool_id = p.id) < p.min_group_size * p.target_groups;
```

- **客户端同步删除** `AdminDashboard.tsx:70-73` 的本地重算；`warRoomUtils.filterPoolsClosingWithin24h` 保留给 `AdminWarRoomPage`，但**同一概念在全站只允许一个数字来源**：改为服务端该端点的返回值，客户端只渲染。
- 测试池处理：`is_test_pool=true` 的池是否计入（现状 `AdminDashboard` 未排除）→ 默认**排除**（与 `poolRegistrationRules` 的测试池豁免语义一致），进开放问题 Q6。
- **判定：重定义**。

**附带发现（须标注）**：`event_pools.total_registrations`（`_definitions.ts:433`）是反规范化计数器。本 PRD 的所有告警/队列数字**一律用 `COUNT(event_pool_registrations)`**，计数器只作展示缓存；是否漂移 待验证（建议加一条每日对账告警）。

#### D4 — `getInsightsData()` 逐指标审计

| 指标 | 现状公式 | 问题 | 判定 |
|---|---|---|---|
| `engagementMetrics.totalUsers` | `COUNT(users)` | 无 | **保留** |
| `engagementMetrics.activeUsers` | `COUNT(DISTINCT user_id) FROM blind_box_events WHERE 30d` | 这是"参与过排桌的用户"，不是活跃用户 | **重定义** → 改名 `participatingUsers`；真正的活跃需定义（登录/打开/报名），本期不造 |
| `engagementMetrics.totalEvents` | `COUNT(blind_box_events)` | 这是"已排桌的场次"，不是活动数 | **重定义** → `matchedSessions` |
| `engagementMetrics.avgEventsPerUser` | totalEvents/totalUsers | 分子分母不同概念 | **删除** |
| `newUsers7Days / newUsersPrevious7Days` | 直算 | 无 | **保留** |
| `userGrowth[]` | 按日新增 | 无 | **保留** |
| `eventTrends[]` | 按日 blind_box_events | 同上，会被误读为"需求趋势" | **重定义** → 拆 `signupTrend`（报名）与 `matchedTrend`（排桌） |
| `personalityDistribution` | `GROUP BY archetype` | 无 | **保留** |
| `matchingEfficiency.successRate` | 已排桌/已排桌 | **结构性 ~100%（D4）** | **重定义** → `成行率 = 成行场次 / 到期场次`（分母 = `registration_deadline < NOW()` 的池） |
| `matchingEfficiency.avgMatchTime` | `updated_at − created_at` on blind_box_events | 这是"落库到再更新"的时延，与运营体感无关 | **重定义** → 拆 `排桌生成时延`（池截止→matchedAt）与 `审批时延`（matchedAt→operatorReviewedAt） |
| `matchingEfficiency.attemptsPerUser` | totalEvents/totalUsers | 同上 | **删除** |
| `retention.weeklyRetention` | cohort 活跃 = `blind_box_events` | 度量的是"参与留存"，标签写"留存"会被误读为 APP 留存 | **重定义** → 标签改「参与留存」，并在图注注明活跃定义 |
| `retention.userSegments`（new/active/dormant/churned） | 分段规则未在本次核实 | 口径不明 | **保留待核**（Phase 2 定义写进 tooltip；定义缺失则删除） |
| `retention.superUsers` | 待核 | 决策价值低 | **降级** → 折叠区 |
| `eventQuality.completionRate` | 待核 | 口径不明 | **保留待核** |
| `eventQuality.avgRating` / `complaintRate` / `lowRatedEvents` | 反馈表直算 | 无 | **保留** |
| `monetization.conversionRate` | 分子分母待核 | 需明确"谁转化到谁" | **重定义** → 明确定义为「首单付费用户 / 有报名行为用户」 |
| `monetization.revenueBreakdown{subscription, singleEvent}` | 二分类 | schema 有 `payment_type` 三类（subscription/event/event_bundle），二分会把连局包错记 | **重定义** → 按 `payment_type` 三类 + `planType` 细分 |
| `monetization.arpu` | 期内收入/总用户 | 不是运营可动作的量 | **重定义** → 每场实收单价（§6.2） |
| `monetization.conversionFunnel{registered,browsedEvents,signedUp,paid}` | 声称是漏斗，但上三档疑似非事件表直算 | **这是全站最像"编造"的一块**：有漏斗名，无漏斗源 | **重定义** → 必须由 `discover_analytics_events` + `payment_ritual_events` + `payments` 计算（§6.3）；在数据接入前，该块显示「漏斗数据源接入中」而不是渲染推测值 |
| `monetization.monthlyRevenue` | 当月 completed 求和 | 写死当月，无视 range | **保留**（参数化） |

> 审计方法：每个指标必须在 `docs/design/` 的附录或代码注释里写下 `公式 + 表名 + 判定`。没有定义的指标不允许上线。

### 6.2 三个新数字的定义

```sql
-- M1 每场实收单价（现金口径）
SELECT COALESCE(SUM(final_amount),0)::int AS revenue,
       COUNT(*) FILTER (WHERE status='completed')::int AS paid_orders
FROM payments
WHERE status='completed' AND created_at >= :from AND created_at < :to;

SELECT COUNT(*)::int AS formed_sessions
FROM event_pools
WHERE status IN ('matched','completed') AND date_time >= :from AND date_time < :to;

-- unit_price_per_session = revenue / NULLIF(formed_sessions, 0)

-- M1b SKU 结构（依赖 payments.payment_type，已核实存在）
SELECT payment_type, COUNT(*)::int orders, SUM(final_amount)::int revenue
FROM payments WHERE status='completed' AND created_at BETWEEN :from AND :to
GROUP BY payment_type ORDER BY revenue DESC;

-- M2 排桌时延（列已核实：event_pools.operator_reviewed_at / matched_at / operator_review_status / registration_deadline）
-- 主口径：matched_at - registration_deadline（系统段，恒有样本）
-- 次口径（下方 SQL，仅 matchingOperatorReviewEnabled=true）：operator_reviewed_at - matched_at（人工段）
SELECT
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (operator_reviewed_at - matched_at))/3600) AS p50_hours,
  PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (operator_reviewed_at - matched_at))/3600) AS p90_hours,
  COUNT(*)::int AS sample
FROM event_pools
WHERE operator_reviewed_at IS NOT NULL AND matched_at IS NOT NULL
  AND operator_reviewed_at >= :from AND operator_reviewed_at < :to;

-- M3 券核销 → 支付转化
WITH redeemed AS (
  SELECT user_id, coupon_id FROM user_coupons
  WHERE used_at >= :from AND used_at < :to
),
converted AS (
  SELECT DISTINCT r.user_id, r.coupon_id
  FROM redeemed r
  JOIN payments p ON p.user_id = r.user_id AND p.coupon_id = r.coupon_id
  WHERE p.status='completed' AND p.created_at >= :from AND p.created_at < :to
)
SELECT (SELECT COUNT(*) FROM redeemed)::int AS redeemed,
       (SELECT COUNT(*) FROM converted)::int AS converted,
       ROUND(100.0 * (SELECT COUNT(*) FROM converted) / NULLIF((SELECT COUNT(*) FROM redeemed),0), 1) AS rate;
```

**已知口径限制（必须写进 UI tooltip，不能藏）**：
- M1 是**现金口径**：订阅收入在 30 天周期内一次性计入，而场次按 `date_time` 计入 → 月卡销量高的周期，"每场实收单价"会被**高估**。因此 M1 必须与 M1b（SKU 结构）同时展示，并加一行「单场局票均价」作为对照锚。
- M3 的分母受 `user_coupons` 的 `uniqueIndex(user_id, coupon_id)`（`_definitions.ts:1527`）约束：同一用户对同一张券**只能核销一次**，因此"复购用券"不会计入分母。这是设计事实，不是 bug，但要在 tooltip 说明转化率是"首核销转化"。

### 6.3 新增端点（全部只读除批量审批）

| 端点 | 方法 | RBAC | 用途 | 备注 |
|---|---|---|---|---|
| `/api/admin/kpi?range=&from=&to=` | GET | ALL（收入项按角色置 `null`） | 5 KPI：值 / 基线 / delta / 7 点序列 / 下钻参数 | 单次响应目标 ≤ 8KB；一次往返取代 4 次 |
| `/api/admin/action-queue?range=` | GET | SUPER_OPERATOR | 7 行队列：count / oldestAgeMinutes / slaMinutes / href | 与 badge 共用 WHERE 构造器 |
| `/api/admin/nav-badges` | GET | ALL | 5 个 count + `asOf` | 60s 缓存 |
| `/api/admin/analytics/discover?from&to&eventType&poolId` | GET | SUPER_ONLY | `discover_analytics_events` 的**唯一读口**：按 `event_type` 分桶计数、按日序列、按 `pool_id` 过滤 | `metadata` 仅白名单字段回传（禁止整包 jsonb 外泄，含潜在 PII） |
| `/api/admin/analytics/payment-ritual?from&to&step` | GET | SUPER_ONLY | `payment_ritual_events` 同上 | 同上 |
| `/api/admin/analytics/funnel?funnel=booking&from&to` | GET | SUPER_ONLY | 预订漏斗：曝光→查看池→报名→支付→排桌→到场，含各步转化 | 由上面两表 + `payments` + `event_pool_registrations` 拼装 |
| `/api/admin/matching-reviews/approve-batch` | POST | SUPER_OPERATOR | 批量批准（≤20 池），逐池返回 `{poolId, ok, code}` | 幂等（已批准的池返回 `ok:true, code:'ALREADY_REVIEWED'`）；审计 `MATCH_REVIEW_BATCH_APPROVED`（含 poolIds 与逐池结果） |

**端点契约硬要求（仓库规则）**：
- 每个用户可见错误必须带机器可读 `code`。本期新增码：`RANGE_INVALID`、`BATCH_LIMIT_EXCEEDED`（>20）、`POOL_NOT_PENDING_REVIEW`、`ALREADY_REVIEWED`、`ANALYTICS_RANGE_TOO_WIDE`（>92 天，防全表扫）。
- **原文此处写错了，已修正**：`adminRbacCoverage.test.ts` **不会**自动发现新路由。它读的是一份硬编码文件白名单 `ADMIN_ROUTE_FILES`（`__tests__/adminRbacCoverage.test.ts:58-80`），且正则**只解析 `app.get('/api/admin/...')` 形式的内联声明**，文件头注释明写「`.use('/api/admin', router)` 挂载不会被发现」。因此新 router 文件（`adminConsole.ts`）：① 必须追加进 `ADMIN_ROUTE_FILES`；② 内部必须用 `app.get(...)` 而不是 `router.get(...)`；③ 必须按 `requireAdmin` + `requireOperatorOrAbove` / `requireSuperAdmin` 的既有组合声明。缺一件 = 该文件全部路由**零 RBAC 覆盖，而测试仍然是绿的**。
- 所有 `SUPER_ONLY` 新端点必须有「operator 调用返回 403 且响应含 `code`」的测试。

### 6.4 查询参数补齐（下钻的前提）

| 端点 | 现状 | 新增 |
|---|---|---|
| `GET /api/admin/event-pools` | 仅 `limit`/`offset`（`adminEventPools.ts:107-110`），**且响应不带 `total`** | `status`、`deadlineWithinHours`、`fillBelowMin`（阈值口径同 D3：`min_group_size × target_groups`）、`registeredWithin`、`outcome=unformed`、`city`、`poolId`（对象级落点）；**必须新增 `total`（与列表同一 WHERE 的 COUNT）与 `registrationCount`（不再读反规范化列）**；同时补 `operator_review_status` / `operator_reviewed_at`（现未 select，池列表无法显示审批态） |
| `GET /api/admin/users` | 已支持 `search`/`city`/`archetype`/`min-maxCompleteness`/`page` | `stuckOnboarding=true`、`createdWithin` |
| `GET /api/admin/matching-reviews/pools` | 待核实过滤能力 | `reviewedWithin`、`status` |

**每个新参数都必须能被 UI 回显**（筛选器显示当前值），否则视为未实现——否则用户点进去看到的是一堆行，不知道自己在看什么。

### 6.5 性能与索引

- `discover_analytics_events` / `payment_ritual_events` 已有 `event_type`、`timestamp`、`pool_id` 索引（`_definitions_extended.ts:1324-1327`、`1345-1348`）。
- 分桶查询必须**强制带 `timestamp` 区间**（服务端拒绝 >92 天，返回 `ANALYTICS_RANGE_TOO_WIDE`），禁止无界扫描。
- 目标：`/api/admin/kpi` P95 < 200ms（staging，近 30 天区间）；`/api/admin/action-queue` P95 < 250ms。

---

## 7. 组件清单

### 7.1 引入 / vendor（含出处与许可）

> **栈兼容性事实（已调研，勿再论证）**：生态里活跃维护的 shadcn-admin 类仓库已全部迁到 React 19 + Tailwind 4 + Base UI + TanStack Table 9，**无一可直接落地**。唯一三个可用来源如下。

| 组件 | 来源（repo / path） | 许可 | 替代什么 | 落地方式 |
|---|---|---|---|---|
| `data-table-toolbar` / `-faceted-filter` / `-view-options` / `-pagination` / `-column-header` / `-row-actions` / `-bulk-actions` | `satnaing/shadcn-admin` **tag `v1.2.0`**（最后一个 Tailwind-3 版本） | MIT（保留 LICENSE 与来源注释） | 现有 2 个页面各自手写的 `Table` + 无分页/无列显隐 | 复制进 `src/components/admin/data-table/`，配 `@tanstack/react-table@^8.21` |
| `app-sidebar` / `nav-group` / `nav-user` / `header` / `main` | 同上 | MIT | `AdminSidebar.tsx`(201 行) 与 `AdminLayout.tsx` 的 header | 改造而非替换：保留 `adminNavConfig` 驱动，只借结构 |
| `forbidden` / `unauthorized` / `not-found` / `general` / `maintenance` 错误页 | 同上 | MIT | `AdminGuard` 的 toast+静默跳转、`AdminNotFound` | 三页落地（forbidden / not-found / general） |
| `dropdown-menu` / `command` / `collapsible` / `avatar` / `calendar` | 同上（shadcn 原语） | MIT | **缺失原语**（`src/components/ui/` 现有 30 个，无这 5 个） | 按需加入；`command` 仅在确认做调色板时引入（§12 Q6） |
| `SparkAreaChart` / `SparkLineChart` / `BarList` / `CategoryBar` / `Tracker` / `ProgressBar` / `ProgressCircle` / `ComboChart` | `tremorlabs/tremor` | Apache-2.0（**必须在文件头保留 NOTICE 与许可声明**） | KPI sparkline、SKU 结构条、覆盖/留存网格 | 只 vendor 用到的 3–4 个，不整包引入 |
| IA 模式（非代码） | `arhamkhnz/next-shadcn-admin-dashboard` 的 `(legacy)/analytics-v1` | MIT（仅参考） | — | **零代码可移植**（Next 16 / RSC / Base UI / TT9）。只借 4 个模式：命名基线 KPI 条、右侧动作管理器、目标 vs 实际 + `ReferenceLine`、异常优先台账 |

**Tailwind-4 → 3 token 回移表（必须逐项替换，实测静默失败）**：

| TW4 写法 | TW3 必须写成 | 失败表现 |
|---|---|---|
| `w-37.5` / `h-68` | `w-[150px]` / `h-[272px]` | 类不生成，宽度塌陷 |
| `shadow-xs` | `shadow-sm` | 阴影消失 |
| `outline-hidden` | `outline-none` | 焦点环样式错 |
| `bg-linear-to-*` | `bg-gradient-to-*` | 背景透明 |
| `text-sm/6` | `text-sm leading-6` | 行高失效 |
| `size-7` | `h-7 w-7` | 尺寸为 0 或默认 |

> 这 6 条**构建不会报错**，只有肉眼可见的布局塌陷。必须配 CI gate（§9 AC-9）。

### 7.2 必须**扩展**而不是复制（现状已有，勿重造）

| 现有件 | 路径 | 必须扩展的能力 | 禁止行为 |
|---|---|---|---|
| `EmptyState` | `src/components/admin/EmptyState.tsx` | 加 `action?: ReactNode` 插槽（现在只有标题/描述/图标，无法带 CTA，导致各页自己手写空态） | 不许新建 `EmptyState2` / `BlankState` / 页面内联空态 |
| `AdminQueryError` | `src/components/admin/AdminQueryError.tsx` | 加 `code?: string` 显示 + `compact` 变体（队列行内用）+ `onRetry` 必填化 | 不许新建第二套错误组件 |
| `Card` | `src/components/ui/card.tsx` | 加 `density="compact"` 变体（内距 16px）供密集区使用 | 不许用 `p-3` 到处手调 |
| `Table` | `src/components/ui/table.tsx` | 加 sticky thead + 数字列右对齐约定（`numeric` prop）+ 列宽 meta | 不许页面内重定义 `td className` 堆叠 |
| `Badge` | `src/components/ui/badge.tsx` | 加 `count` 变体（18px 高、tabular-nums）供 nav badge | — |
| `Skeleton` | `src/components/ui/skeleton.tsx` | 新增 3 个组合态：`KpiSkeleton`、`TableSkeleton(rows)`、`ChartSkeleton(h)` | 不许页面内拼骨架 |
| `breadcrumb` | `src/components/ui/breadcrumb.tsx` | **已存在但零引用**：直接用于页头（活动池 › 池名 › 排桌） | 不许再引新依赖 |

### 7.3 净新建（生态里没人做，必须自建）

| 组件 | 说明 | 工作量 |
|---|---|---|
| `KpiCard` | 值 / 单位 / 命名基线 / delta（含方向语义：成行率下降=坏，单价上升=好）/ sparkline / 下钻 / 权限占位态 | 1.5d |
| `ActionQueue` + `ActionQueueRow` | 7 行类型、SLA 时钟、超期竖线、空行不消失、批量选择 | 2d |
| `InsightRail` | 规则引擎输出的句子 + 证据 + 跳转；≤5 句；空态不空话 | 1d（含服务端规则 0.5d） |
| `ExceptionLedger` | 风险排序表（决策列在左）、展开、行内动作 | 1.5d |
| `RangePicker` | 今天/7d/30d/自定义 + URL 同步 + 基线区间推导 | 1d |
| **Metric→FilteredList 下钻** | 约定：数字 → `href + params` → 目标页筛选项回显。**全生态无人提供** | 1d（净新） |
| ~~Saved Views~~ | **本期删除**（见 §15 S-6）：16 条目 + 带参下钻已覆盖 80% 的检索需求；localStorage 级视图在多运营场景下还会制造「他看的是另一个队列」的错觉 | ~~1.5d~~ → 0 |

---

## 8. 分期路线图（地基 + 5 段 + 质量预算，≈56 人日）

### 8.0 先修正工作量：29 人日是低估，不是预算

原文写「总计约 29 人日（6+9+8+6）」，与本文档 §7.3 自相矛盾：**单是 7 个新组件的估算就是 9.5 人日，已经超过 Phase 2 整段的 9 人日**，而 Phase 2 还包含导航重构、8 个 tab 工作区、31 条旧路由的 Redirect、badge 接线与首屏性能门禁。逐项加总（每一项都能在本文档内找到出处，不是重新拍数）：

| 段 | 原文 | 修正 | 加总依据（可逐条核对） |
|---|---|---|---|
| **F 地基**（新增，§14.2） | 0 | **1.5** | props 类型冻结 0.5 · `adminMetrics.ts` 签名 + 一个参考实现 0.4 · `adminFilters.ts` 签名 0.2 · `adminConsole.ts` 骨架 + `routes.ts` 挂载 + `ADMIN_ROUTE_FILES` 追加 0.4 |
| P1 真话 + 基础件 | 6 | **11** | D1 拆三端点 1.5 · D2 0.3 · D3 0.5（含阈值修正）· D4 二十余指标逐条重定义 + 契约测试 2.5 · nav-badges + 共享 WHERE 构造器 1 · `event-pools` 参数 + `total` 1 · 客户端件 3.9（KpiCard 1.5 + Forbidden 1 + Skeleton 组合态 0.5 + 两个插槽 0.4 + TW3 gate 0.5）· `ui-flags` 回滚底座 0.3 |
| P2 看板 + IA | 9 | **20** | 服务端 kpi/队列/洞察 3.5 · §7.3 组件 8（已扣掉 Saved Views）· IA：16 条目 + 8 个 tab 工作区 + 31 条旧路由 Redirect 4 · badge 接线 1 · legacy 壳 + `?v=1` 0.5 · AC-7 首屏 harness 1.5 · 联调 + TW3 视觉对照 1.5 |
| P3 分析 + 商业可见性 | 8 | **9** | 三只读端点 3 · 漏斗 tab 3 · 定价双列 1 · 下钻全量接入 1 · 调色板 1（Q6 否决则 −1） |
| P4a 卫生（**可独立**） | — | **5** | 三态补齐（约 30 页，先做模板再批量）3 · sticky 表头 + 数字列右对齐 0.5 · 分页复用 1 · 面包屑接入 0.5 |
| P4b 模式推广（**依赖 P2**） | 6 | **4** | 5 张表迁 `data-table` 3 · 删除 legacy + 导航收尾 1 |
| 质量预算（原文为 0） | 0 | **6** | G6 可用性测试（5 名运营 × 30s 计时）1.5 · TW3 六类静默失败逐组件截图对照 1.5 · `pre-ship-pipeline` + harness gate + 三轮修复 3 |
| **合计** | **29** | **≈56.5**（区间 52–60） | 逐项加总（1.5 + 11 + 20 + 9 + 5 + 4 + 6） |

**收敛版（若必须在 6 周内交付）≈48 人日**：砍 P4b（4）· 调色板（1）· D4 只做被 KPI/队列实际引用的 8 个指标（−1.3）· P4a 只补 8 个高频页（−1.5）· 保留全部质量预算。**不建议再往下砍**：再砍就是砍 AC 或砍质量预算，两者都会让「这次改造是否值得」无法被回答。

> 区间说明：区间宽度来自实现熟悉度（admin-client 与 server 是否同一人做），不是来自需求不确定性。需求边界在 §2.2 已写死。

### 8.1 Phase 1 — 真话 + 基础件（11 人日）

**目标**：让后台不再说假话，并备好后面所有段要用的最小件、门禁与**回滚底座**。
**为什么必须第一**：一个漂亮图表画在错数字上，比现状更糟——它会让错误更快被信任。

| 范围 | 内容 |
|---|---|
| 服务端 | D1（拆 `/stats/overview` + `/users/distributions` + `/users/completeness-distribution`）· D2 · D3（含 `min_group_size × target_groups` 阈值修正）· `lib/adminMetrics.ts`（**唯一 SQL 源**，队列/badge/KPI 共用）· 新增 `/api/admin/nav-badges` · `event-pools` 查询参数 + `total` · `RANGE_INVALID` 等错误码 · **`GET /api/admin/ui-flags`（`requireAdmin`，只回传 2 个 UI 开关）** |
| 客户端 | `KpiCard`（先接真数、先不上看板）· `Skeleton` 组合态 · `EmptyState` action 插槽 · `AdminQueryError` code 支持 · `Forbidden` 页 · TW3 token CI gate |
| 测试 | 每个修正数字一条契约测试（断言公式与标签一致）· badge 与 list `total` 一致性测试 · `adminConsole.ts` 追加进 `ADMIN_ROUTE_FILES` |
| 依赖 | 无（可在当前 main 上独立发布） |

**为什么 `ui-flags` 在 Phase 1**：现有唯一读口 `GET /api/admin/feature-flags` 是 `requireSuperAdmin`（`routes/domains/admin.ts:190`），而看板是 ALL_ROLES——`operator`/`viewer` 拿到的是 403，且 admin-client 全树**没有任何 flag 读取层**（已 grep：仅 `AdminFeatureFlagsPage` 自己读）。因此 `adminDashboardV2` 这种 DB 型开关**对非超管不成立**。真正的回滚底座必须是给 `requireAdmin` 的一个极窄只读端点。0.3 人日，换两个可运行时切换的开关。

**退出标准**：四处失真全部有测试锁定；`/api/admin/stats` 不再全表入内存；现有看板**视觉不变但数字变对**（这是刻意的：先纠正，再重排）。
**回滚**：纯后端 + 无 DDL + 无路由变更 → `git revert` 即可；新端点旧前端不调用，删除无副作用。
**发布**：**必须单独发布一次**（见 §8.6）。

### 8.2 Phase 2 — 新看板 + IA 收口（20 人日）

**目标**：`/admin/dashboard` 换成决策队列形态；导航 32 → 16。

| 范围 | 内容 |
|---|---|
| 服务端 | `/api/admin/kpi` · `/api/admin/action-queue` · `lib/adminInsights.ts` 规则引擎（R1–R5） |
| 客户端 | 新看板（RangePicker / KPI Strip / ActionQueue / InsightRail / ExceptionLedger）· 导航重构（tab 工作区 + badge）· 31 条旧路由全部 `Redirect` 或 tab 保留 · **8 个 tab 工作区页面的受控 tab 化**（`outcome-analytics` / `interaction-logs` / `feedback` / `coupons` / `subscriptions` / `referrals` / `duo-invites` / `content-filter` 等必须接受 `?tab=`） |
| 门禁 | 首屏预算并入 CI（见 AC-7） |
| 依赖 | Phase 1 的 `KpiCard`/状态件/`ui-flags`/`adminMetrics.ts` |

**退出标准**：§5 全部区块上线；旧看板仍可通过 `/admin/dashboard?v=1` 访问（保留 2 周）；badge 与列表 `total` 100% 一致；无 KPI 缺基线。
**回滚（已修正）**：
- 看板 → `GET /api/admin/ui-flags` 返回 `dashboardVersion:'v1'`，客户端渲染 `AdminDashboardLegacy.tsx`；`?v=1` 作为不依赖网络的旁路。
- **导航 → 同一端点返回 `navVersion:'v1'`**，客户端从两套 nav 数据里选。原文「导航重构无开关，回滚 = revert 单次提交」在生产压力下不成立：`AdminNavItem` 当前没有 `children`/`badge` 字段，加字段会同时波及 `AdminSidebar`、`AdminGuard`、页面标题与面包屑；revert 单提交会把同批的其他修复一起带走。两套 nav 数据的成本是 ~0.5 人日，远低于一次故障中的回退风险。

### 8.3 Phase 3 — 分析深度 + 商业可见性（9 人日）

**目标**：漏斗数据可见；定价页从「表」变成「决策面」；审批不再逐个点。

| 范围 | 内容 |
|---|---|
| 服务端 | `/api/admin/analytics/discover` · `/payment-ritual` · `/funnel`（SUPER_ONLY，带区间上限）· `approve-batch`（≤20，逐池结果 + 审计） |
| 客户端 | 经营分析·漏斗 tab（Recharts `Funnel` 或分段条，**不引新依赖**）· 定价页加「单场折算价」列 + SKU 收入结构 + 券折扣列（**仅管理端可见，不改定价逻辑**）· `Metric→FilteredList` 下钻全量接入 · 路由调色板（若 Q6 决定做） |
| 依赖 | Phase 1 错误码体系；`payments.payment_type` 数据质量（待验证 V-5）；**阻断性决策 G-1（见下）** |

**阻断性决策 G-1（新增）**：`approve-batch` 复用 `executePostMatchCommitSideEffects`（`lib/matchingPostMatchEffects.ts:21`），它逐池执行通知 / 场地分配 / 主题生成——批量 20 池 = 20 组副作用。因此批量接口必须是**逐池串行 + 单池事务 + 显式部分失败回报**（第 12 池失败不能回滚前 11 池，但必须让运营看见"11 成功 / 1 失败 / 8 未执行"）。原文的「逐池返回 `{poolId, ok, code}`」不足以表达"未执行"，需加 `skipped` 状态。

**阻断性决策 G-2（新增，非代码）**：定价页只加两列不够。§1.3 已证明「月卡无场次上限 → 实际单场成本无下限」，这是收入自侵蚀机制而非展示缺陷。本期**不做**定价决策（边界不变），但 Phase 3 交付前必须拿到商业化对「悦聚月卡是否设场次上限」的书面结论；否则 KPI-4 上线只会把争论从"看不见"变成"看见了但不许改"。**没有这个结论，Phase 3 的定价列不予发布**。

**退出标准**：三个隐形数字全部可见并有 tooltip 口径说明；批量审批成功/失败/未执行逐池可见；从任一 KPI 下钻，落地页行数 === KPI 数字（依赖 `event-pools.total`）。
**回滚**：`approve-batch` 有审计与幂等 → 保留；分析端点独立只读 → 单独下线无副作用；定价页列为纯展示增列 → revert 单文件。

### 8.4 Phase 4a — 卫生补齐（5 人日，**只依赖 Phase 1**）

**目标**：把三态与表格卫生推到剩余页面。**这一段不依赖 Phase 2**，因为它消费的是 Phase 1 的 `Skeleton`/`EmptyState`/`AdminQueryError`，不是 Phase 2 的看板模式。

| 范围 | 内容 |
|---|---|
| 客户端 | 剩余页面 loading/empty/error 三态补齐（先做 3 个模板再批量套）· sticky 表头 + 数字列右对齐 · 分页复用（现状仅 2 页有分页）· `useDebounce` 接入搜索框 · 面包屑接入（`breadcrumb.tsx` 已存在、零引用） |
| 不包含 | 信息架构重排、组件替换、`data-table` 迁移（在 4b） |
| 依赖 | Phase 1 的三态件与 `Forbidden` 页 |

**退出标准**：三态覆盖率 100%（可用 AST/正则门禁统计）；表格分页在 top 5 高频表可用。
**回滚**：逐页提交，单页可单独 revert。

### 8.5 Phase 4b — 模式推广 + 收尾（4 人日，**依赖 Phase 2 已上线**）

| 范围 | 内容 |
|---|---|
| 客户端 | 高频 5 张表迁 `data-table`（vendor `satnaing/shadcn-admin@v1.2.0`）· 游戏化卡与等级分布删除 · 生产观察满 2 周且旧版访问 <10% 后**物理删除 `AdminDashboardLegacy.tsx`** |
| 依赖 | Phase 2 已上线并观察 2 周 |

**退出标准**：`AdminDashboardLegacy.tsx` 物理删除；top 5 表具备分页/列显隐/批量操作。
**回滚**：删除 legacy 是最后一步，且此时 `ui-flags` 的 `dashboardVersion` 已无意义（可一并清理）。

### 8.6 发布边界（与分期无关，独立硬规则）

**两次发布，不是一次。** 即使 §14 的并行开发把 P1 与 P2 的编码压到同一时间段，**发布必须切开**：

1. **Release A（P1）**：只含服务端修正 + 三态件 + `ui-flags` + `event-pools total`。视觉零变化，运营无需重新学习，`ADMIN_STATS_LEGACY_BUGS` 应急开关窗口独立。
2. **Release B（P2）**：看板 + IA。

理由（不是流程洁癖）：
- P1 是**唯一能在"运营零感知"前提下提升正确性的切片**；把它和 IA 重构捆在一起发布，等于让「数字变了」和「页面变了」两件事同时发生——运营无法区分"是我看错"还是"系统改了"。这正是 R-2 与 R-7 两个风险相撞的最坏情形。
- P1 单独上线后，`ui-flags` 已经存在，P2 的回滚路径在上线前就被验证过一次（用 `navVersion:'v1'` 灰度）。
- 若 P2 因故延期，P1 的价值不受影响（四处失真已经修完，运营当天的判断已经不再基于错数）。

> **明确不在任何一期**：定价策略决策、entitlement 次数上限、真实任务指派系统、暗色主题、移动端签到页、LLM 洞察、毛利/成本口径（见 §15 S-4）。

---

## 9. 验收标准

### 数据真实性
- **AC-1** `userGrowth` 的 UI 文案与 SQL 公式一致：断言「相比上一等长周期」的百分比 = `(cur-prev)/prev`；`prev=0` 时返回 `null` 且 UI 显示「基线不足」，**不得渲染 0%**。
- **AC-2** 「即将截止 · 报名不足」的数字必须等于 `COUNT(registrations) < min_group_size × target_groups` 的查询结果。fixture 必须**包含一个多组池**：`target_groups=3, min_group_size=6, registrations=8` → 该池**必须被判为低填充**（8 > 6，用单组阈值会漏报）。同时断言 1 个高填充池不计入、1 个 `is_test_pool=true` 的池不计入。
- **AC-2b** 队列第 6 行必须读 `event_attendance.attendance_status`，**不得**读 `status`。fixture：一个今日场次、6 名成员、`status` 全为 `'confirmed'`、`attendance_status` 全为 `'pending'` → 断言该行为 `1`（组），而不是 `0`。反向：把 2 人置为 `attendance_status='confirmed'` → 断言 `attendanceStatusConfirmed` 计数为 2。
- **AC-3** 同一概念在同一屏只出现一次：全站 grep 断言 `underfilledPoolsClosingSoon` 与 `filterPoolsClosingWithin24h` 不再同时被看板调用；客户端不存在告警数字的本地重算。
- **AC-4** `GET /api/admin/stats/overview` 在 100,000 行 users fixture 下，Node 堆增量 < 20MB，且不出现 `getAllUsers()` 调用栈。
- **AC-5** `getInsightsData()` 中每个被标「重定义」的指标，其返回值与新定义公式一致；被标「删除」的字段不再出现在 API 响应里（或标记 `deprecated` 且前端零读取）。
- **AC-6** 成行率不可能结构性恒为 100%：用「10 个到期池、仅 3 个成行」的 fixture 断言返回 30%（±0.1）。**并且**：加入 1 个「已过 `registration_deadline` 但 `date_time` 在 3h 缓冲内的池」→ 断言它**不进入分母**（分母仍为 10，不是 11）。

### 信息设计
- **AC-7** 看板首屏预算（staging，冷缓存，P75，桌面 1440×900）：5 个 KPI 可见 ≤ **1.5s**；首屏请求 ≤ **3** 个；首屏响应体合计 ≤ **120KB**；主线程可交互 ≤ 2.0s。CI 用 Playwright 采样，超预算即失败。
- **AC-8** 无 KPI 缺基线：遍历 KPI 配置数组断言每一项都有 `baseline.label`、`baseline.value`（或显式 `established:false`）、`delta`、`series.length >= 1`、`drill.href`。缺任一 → 测试失败（这条是防回归的硬闸）。
- **AC-9** 零 Tailwind-4 token 泄漏：新增 `scripts/check/check-admin-tw3-tokens.mjs`，扫描 `apps/admin-client/src/**`，命中 `w-37.5|h-68|shadow-xs|outline-hidden|bg-linear-to-|text-sm/\d|size-\d` 即失败；纳入 `npm run guardrails`。
- **AC-10** 禁止裸色阶：新增面不得出现 `bg-red-50|bg-amber-50|bg-blue-50|bg-green-50` 等无 token 的颜色类（白名单：状态语义 token）。
- **AC-11** 一屏 ≤ 5 KPI；无渐变 KPI 卡（grep `bg-gradient` 于 KPI 组件 → 失败）。
- **AC-12** 数字可扫读：KPI 与表格数字列带 `tabular-nums`；表格数字列右对齐。
- **AC-13** 每块独立错误态：模拟 `/api/admin/kpi` 500，断言 KPI 区显示 `AdminQueryError`（含 `code` 与重试）而队列区正常渲染；**整页不得空白**。
- **AC-14** loading 用 Skeleton：看板首屏不得出现 `animate-spin`（现状整页 spinner 必须消失）。

### 导航与下钻
- **AC-15** 具名任务可达性：从任意后台页面，任务「批准一个待审批的池」「找到 24h 内低填充池」「处理一笔失败退款」各自 ≤ **2 次点击** 或 **1 次调色板搜索**。
- **AC-16** nav badge 与列表一致：对 5 个 badge，断言 `badge.count === 目标端点返回的 total`（同一 fixture）。**前提**：目标列表端点必须返回 `total`（`event-pools` 现在没有，见 M-4）——没有 `total` 这条 AC 无法编写，视为该端点未完成。
- **AC-17** 下钻不丢上下文：点击 KPI/队列行后，URL 带过滤参数，目标页筛选器回显，页面行数 === 来源数字。
- **AC-18** 旧 URL 不 404：32 个现有 `/admin/*` 路径全部可访问（tab 或 redirect），用路由表白名单测试锁定。
- **AC-19** 导航条目 ≤ 18（目标 16），且 `adminNavConfig.ts` 仍是 nav + 路由 RBAC 的唯一来源（测试断言 `AdminSidebar` 与 `AdminGuard` 都从它派生）。

### 权限与状态
- **AC-20** 每个新面四态齐备：loading / empty / error / forbidden。`viewer` 访问 `SUPER_ONLY` 面 → `Forbidden` 页（有解释 + 返回），**不得**静默跳转。
- **AC-21** 收入 KPI 对 `operator`：显示占位卡（「仅超级管理员可见」），**不是** 403 错误态；端点仍返回 403 且含 `code`。
- **AC-22** `approve-batch` 逐池结果：混合 fixture（2 待审 + 1 已审 + 1 非 pending）→ 返回 4 条结果，`ok` 状态各自正确；审计日志写入 1 条含 4 个 poolId 与逐池结果；重复调用幂等（第二次全 `ALREADY_REVIEWED`，DB 无二次变更）。
- **AC-23** 每个新端点的所有用户可见错误响应含 `code`；`RANGE_INVALID`、`BATCH_LIMIT_EXCEEDED`、`ANALYTICS_RANGE_TOO_WIDE` 各有测试。

### 契约与回归
- **AC-24** 新路由纳入 `adminRbacCoverage.test.ts`；新增 `SUPER_ONLY` 端点的 operator 403 测试。
- **AC-25** 无新依赖越界：`package.json` diff 仅允许 `@tanstack/react-table@^8.21` 与（可选）`@radix-ui/react-dropdown-menu|collapsible|avatar|hover-card`；不得出现 Next.js / Base UI / TT9 / cmdk（除非 Q6 明确批准）。
- **AC-26** vendor 代码保留出处与许可：每个来自 shadcn-admin / tremor 的文件头含 repo + tag/commit + license 标识。
- **AC-27** 单一 SQL 源：全树 grep 断言「低填充」「成行」「每场实收单价」「券转化」四类聚合**只出现在 `lib/adminMetrics.ts`**；任何其他文件出现 `min_group_size` 比较或 `final_amount` 求和即失败（与 AC-3 同型，防"新设计制造第 5 处同概念两个数"）。
- **AC-28** 对象级落点：`/admin/event-pools?poolId=<id>` 必须直接打开该池详情 Dialog；且 `wecomNotifications/poolLifecycle.ts` 的提醒 CTA 不再指向不存在的 `/admin/pools/:id`（断言 URL 属于 `ADMIN_ROUTE_TABLE` 的可解析集合）。
- **AC-29** 回滚可用性：`GET /api/admin/ui-flags` 以 `operator` 身份返回 200 且含 `dashboardVersion`/`navVersion`；以 `viewer` 身份同样 200（只读）。`dashboardVersion='v1'` 时渲染 `AdminDashboardLegacy`，`navVersion='v1'` 时渲染旧 32 条目导航——两条都要有测试。
- **AC-30** RBAC 覆盖不漏：`adminConsole.ts` 出现在 `ADMIN_ROUTE_FILES` 白名单中，且该文件内所有 `/api/admin/*` 路由都带 `requireAdmin` + 相应角色中间件（用测试断言"白名单包含该文件"本身，防止新 router 静默逃逸）。

---

## 10. 指标（怎么知道这次做对了）

> 全部标注基线现状。**未测量的写「待采集」，不编数字。**

### 10.1 收入相邻（这次改造的商业价值证明）

| 指标 | 定义 | 基线 | 目标 |
|---|---|---|---|
| 排桌审批时延 P50 | `operator_reviewed_at − matched_at` | **待采集**（本期 Phase 1 起开始记录，历史不可回溯） | Phase 3 后 ≤ 2h；季度内 ≤ 1h |
| 每场实收单价 | §6.2 M1 | **可回溯计算**（payments 历史存在）→ Phase 1 立即回填 8 周基线 | 不设目标（观测项）；**目标是由它触发的定价动作** |
| 券核销→支付转化 | §6.2 M3 | **待采集**（需回填，`used_at` 历史存在） | 基线 +5pt |
| 成行率 | 成行 / 到期 | 可回溯计算（`event_pools` 历史） | 基线 +10pt |
| 「决策时长」代理指标 | 运营从登录到第一次点击队列行的时长（前端埋点） | **待采集** | ≤ 60s |

### 10.2 卫生（防回归）

| 指标 | 基线 | 目标 |
|---|---|---|
| 无基线的 KPI 数量 | 当前 6/6（全部无基线） | **0** |
| 同一概念多处不同数字（人工/AST 检查） | ≥ 1（D3 已确证） | **0** |
| 看板首屏请求数 | 5（含全量池列表） | ≤ 3 |
| 首屏 KPI 可见 P75 | **待采集**（先测一次现状作为对照） | ≤ 1.5s |
| 具四态的新面占比 | 0% | 100% |
| 导航条目数 | 32 | ≤ 18 |
| 页面内 `animate-spin` 整页 loading | ≥ 4 处（看板/Guard/Suspense 等） | 0（除登录鉴权） |
| 下钻带过滤参数的比例 | 1/7（仅 `/admin/users?maxCompleteness=50`） | 100% |

### 10.3 反向指标（必须监控的副作用）

- 运营在旧看板（`?v=1`）的停留比例 → 若 2 周后 >30%，说明新看板没解决问题，需回访。
- 队列行「建议动作」的点击率 → 若 <20%，说明建议动作不成立（写了没人点 = 文案问题或动作错）。
- 批量审批的误批率（批准后 24h 内被 reject / 被回滚的池占比）→ 目标 0；出现即回退为逐池。

---

## 11. 风险与回滚

| # | 风险 | 概率/影响 | 缓解 | 回滚 |
|---|---|---|---|---|
| R-1 | **Tailwind 4 token 静默失败**：从 shadcn-admin 复制的类在 TW3 不生成，构建通过但布局塌陷 | 高 / 高 | AC-9 CI gate + code review checklist + 逐组件截图比对 | 单组件 revert |
| R-2 | **数字修正引发运营不适**：账面"即将截止"从 5 变 2，被误认为系统坏了 | 中 / 中 | 发布说明 + 看板内一次性 inline 说明条（「该数字此前未含填充率条件，已修正」）+ 旧值不可对比 | 开关：`ADMIN_STATS_LEGACY_BUGS`（仅用于 24h 内应急，默认关） |
| R-3 | **漏斗数据质量差**：`discover_analytics_events` 埋点覆盖不全，漏斗各步对不上 | 中 / 高 | 上线前先跑一次覆盖率盘点；若报名→支付步骤缺口 >10%，该 tab 显示「数据源接入中」而非画一个断裂漏斗 | 隐藏 tab（纯展示面） |
| R-4 | **审批时延首次可见即难看**（可能 P50 数十小时） | 高 / 中 | 这是**目的**而非缺陷；同步准备一句解释与改进路径（批量审批已在 P3） | 无需回滚 |
| R-5 | **批量审批误操作**：一次批 20 个池，错批后用户已看到结果 | 低 / 极高 | 上限 20 + 二次确认（列出池名与影响人数）+ 审计 + 幂等；不提供"全选所有" | 单池 revert 不存在 → 只能事后沟通，故限制在 ≤20 |
| R-6 | **analytics 端点拖慢生产库**：两表为高写入表 | 中 / 高 | 强制时间区间（≤92 天）+ 只读连接/只读事务 + 查询 P95 门禁 + 索引已存在 | 端点独立下线 |
| R-7 | **IA 重构打断肌肉记忆**：运营找不到页面 | 高 / 低 | 旧 URL 100% 保留（AC-18）+ 调色板（P3）+ 2 周双轨 | 导航改动集中在 `adminNavConfig.ts`，单文件 revert |
| R-8 | **`metadata` jsonb 泄漏 PII** 到管理端 | 低 / 高 | `discover/payment-ritual` 端点只回传白名单字段，禁止整包转发；测试断言响应不含 `metadata` 原对象 | 端点下线 |
| R-9 | **范围蔓延成"45 页全改"** | 高 / 中 | §2.2 非目标写死；Phase 4a 只做状态补齐与表格卫生，Phase 4b 只做 `data-table` 迁移，两段都不重排剩余页面信息架构 | 分期提交，逐页 revert |
| R-10 | **Tremor Apache-2.0 归属遗漏** | 中 / 低 | 文件头 NOTICE + 仓库 `THIRD_PARTY_NOTICES` 条目（如已有则追加） | 移除该组件 |
| R-11 | **`featureFlags` 工作树冲突**：另一会话正持有 `featureFlags.ts`×2 的未提交改动（默认值翻转 + 30 键补齐 + 新契约测试），本计划的并行泳道若同时编辑这两个文件，会让那套契约测试的语义基础在合并时失效 | 中 / 高 | 本期**不新建 feature flag**，回滚走 `ui-flags`（§14.3 硬约束）；若必须用，先 rebase 再只做末尾追加 | 单行 revert；`ui-flags` 不依赖它 |
| R-12 | **单文件热点让并行归零**：`AdminDashboard.tsx` 905 行、`AdminEventPoolsPage.tsx` 992 行、`adminUsers.ts` 1082 行。若 5 个看板区块仍写进同一个文件，第二个工程师只能在旁边等 | 高 / 中 | §14.2 的区块文件强制拆分 + §14.3 的单写者窗口；拆分是**并行能否成立的技术前提**，不是代码风格 | 各区块独立文件，可单独 revert |

**旧看板可达性（硬要求）**：Phase 2 上线后 2 周内 `/admin/dashboard?v=1` 渲染 `AdminDashboardLegacy.tsx`。开关走 **Phase 1 的 `GET /api/admin/ui-flags`**（`requireAdmin`），不是 `GET /api/admin/feature-flags`（后者 `requireSuperAdmin`，operator/viewer 拿不到，回滚对三分之二用户不成立）。**删除 legacy 是 Phase 4b 的最后一步**，且必须在生产观察满 2 周、旧版访问占比 <10% 之后。

---

## 12. 开放问题（需人类决策，各附推荐默认）

| # | 问题 | 推荐默认 | 理由 |
|---|---|---|---|
| Q1 | KPI 就选这 5 个？（新增报名 / 成行率 / 审批时延 / 每场实收单价 / 券转化） | **是** | 每个都对应一个运营可执行动作。备选：把"新增报名"换成"待处理异常总数"（更像 KPI 但不可环比） |
| Q2 | 「算法标定」与「管理员账号」合并进一个 `系统设置` tab 组，是否可接受？ | **可接受**（低频危险面聚合） | 若被否，退化为两个分组 → 导航 17 条 |
| Q3 | 收入类 KPI 对 `operator` 显示占位卡还是干脆不显示？ | **占位卡** | 不显示会让 operator 以为"没有这个数"；占位卡同时是权限叙事与申请入口 |
| Q4 | 是否允许批量审批？上限？ | **允许，上限 20 池** | 审批时延是三个隐形数字之一，无批量则 SLA 不可达；但误批不可逆，故限 20 |
| Q5 | 是否 materialize `users.profile_completeness_score` 列？ | **本期不做**；users > 50k 或完整度查询 P95 > 800ms 时立项 | 需要 schema 变更 + 写入路径改动，与"真话优先"无关，避免把 DDL 混进 P1 |
| Q6 | 是否做命令调色板？用什么实现？ | **做，但 Phase 3，且不引入 `cmdk`** | 16 条 nav 的搜索价值小于"误操作系统写接口"的风险；用 `Dialog`+`Input` 自建 ~120 行，避免重引被清除的依赖 |
| Q7 | 游戏化数据（悦币流通/总经验值/等级分布）是否直接删除？ | **UI 删除，API 保留** | 无决策动作；但未来激励计划可能需要历史，故不删契约 |
| Q8 | 「目标值」（如成行率目标 70%）由谁定？ | **Phase 2 前由商业化/运营共同定一次，写入配置表** | PRD 不编数字。未定前显示「目标待定」，不显示假目标 |
| Q9 | 人工审批（`matchingOperatorReviewEnabled`）的目标姿态是什么？ | **确认为关闭**（冷启动无值班运营），据此把 KPI-3 主口径改为系统侧排桌时延 | **已发现姿态冲突**：`featureFlags.ts` 工作区有一处**未提交**改动把默认 `true` → `false`，注释理由是"开着则每次排桌停在 `pending`，通知/场地分配/邀请奖励全不执行，用户看到「排桌中」卡死"；`docs/agent-context/feature-flags.md` 正文也改成"明确关闭"，但**同一文件后段仍留着 `(default true)` 的旧描述 → 文档自相矛盾**。若最终改回开启，KPI-3 次口径与队列第 1 行需同时激活（已按条件渲染写死，无需改代码结构） |
| Q10 | 测试池（`is_test_pool=true`）是否计入告警与 KPI？ | **不计入** | §6.1 D3 默认排除；否则测试池会长期污染"低填充"与成行率 |

---

## 13. 与既有文档 / 契约的关系（本期必须同步的产出）

本期新增 11 条 `/api/admin/*` 路由、改 1 个响应形状、改 1 个导航契约。以下四份东西**必须**跟着动，否则会留下"代码新、文档旧"的漂移——其中第 1、2 项是**代码门禁直接引用**的文件，不是软性文档：

| # | 产出 | 为什么是硬性 | 归属 | 成本 |
|---|---|---|---|---|
| 1 | `docs/admin/admin-rbac-matrix.md` 增补新路由行（端点 / 方法 / 所需中间件 / 说明） | `adminRbacCoverage.test.ts` 的文件头把这份矩阵指为"文档化的例外清单"；矩阵过期会让下一次 RBAC 审查以过期清单为依据 | F | 0.2d |
| 2 | **新建** `docs/admin/admin-metrics.md`：§6.1 要求每个指标写下「公式 + 表名 + 判定」，这份文件就是那个附录（也是 AC-27"单一 SQL 源"的人工对照面） | §6.1 自己定的规则："没有定义的指标不允许上线"。没有这个文件，规则无法执行 | L1 | 0.3d |
| 3 | `docs/agent-context/feature-flags.md` | **本期禁止修改**：该文件正被另一会话改动（与 §14.3 的 `featureFlags.ts` 同批）。若本期真的新增了 flag，必须等那批入库后再补 | — | 0 |
| 4 | `PRODUCT_REQUIREMENTS.md` | **本期不修改**（该文件有未提交改动）。本期改动全部落在管理端内部：不改用户侧术语、不改定价策略、不改 entitlement 语义，因此 canon 无需变更。**唯一例外**：若 §1.3 的定价阶梯结论被采纳为策略，那是 pricing PRD 的事，不是本 PRD 的事 | — | 0 |

> 这 0.5 人日已计入 §8.0 的区间上界（中值 ≈56.5，区间 52–60 覆盖它）。不要把它当成"顺便写写"——第 1 项过期会直接让 RBAC 门禁失去依据。

---

## 14. 并行化执行计划

> 结论先说：**四期作为四个整块不能并行**，因为 §8 的分期编码的是**价值顺序**（先真话、后重建），不是依赖顺序。把价值顺序与真实依赖分开之后：**10 条泳道里有 5 条在第 0.5 天就能开工，8 条在第 8 天前开工**，只剩 L8（模式推广，必须等 P2 上线）与 L9 的尾段是真的串行。但开发并行不代表发布并行——发布必须仍是两次（§8.6）。

### 14.1 真实依赖图

判定标准：**硬阻塞 = 没有它就无法编译/无法验证**。凡是"可以先对着 stub 契约写、最后接线"的，都不算硬阻塞——本仓的既有形态已经支持这件事（`apiRequest` 在 `lib/queryClient.ts:101`，端点是字符串路径；`TanStack Query` 的 `queryFn` 可返回任何符合类型的桩数据）。

| 工作项 | 硬阻塞（真） | 伪阻塞（可对着 stub 开工） | 结论 |
|---|---|---|---|
| **D1** `/stats/overview` + `/users/distributions` + `/users/completeness-distribution` | 无 | 消费端（看板/经营分析） | 第 0.5 天可开工 |
| **D2** `newUsersWowPct` | 无 | UI 文案（`AdminDashboard.tsx:135-139`）——该文件归 L3，所以这处文案改动放进 L3 的第一个提交，由 L1 提供字段名 | 第 0.5 天可开工 |
| **D3** 低填充（含阈值修正） | `lib/adminMetrics.ts` 的函数签名（F 泳道产出） | — | 第 0.5 天 |
| **D4** 二十余指标逐条重定义 | 无（读写都在 `legacyStorageRepo.getInsightsData()`） | 经营分析页渲染 | 第 0.5 天 |
| **`/api/admin/nav-badges`** | 共享 WHERE 构造器（F） | badge 组件（L2） | 第 0.5 天 |
| **`event-pools` 参数 + `total`** | 无 | 目标页筛选器回显（L3/L6） | 第 0.5 天 |
| **`ui-flags`** | 无 | 客户端读取层（L2） | 第 0.5 天 |
| **P1 客户端件**（KpiCard / Skeleton 组合态 / EmptyState action / AdminQueryError code / Forbidden / TW3 gate） | 各自的 props 类型冻结（0.5 天，F） | 所有消费方 | 第 0.5 天；见下方"门成本" |
| **`/api/admin/kpi`** | `adminMetrics.ts`（F）；**不依赖 D1–D4** | 全部 UI | 第 1 天 |
| **`/api/admin/action-queue`** | `adminMetrics.ts` + `adminFilters.ts`（F） | 全部 UI | 第 1 天 |
| **`lib/adminInsights.ts`（R1–R5）** | `adminMetrics.ts` 的聚合返回形状（F 定契约） | 需要 fixture 才能跑规则测试，不需要真 DB | 第 1 天 |
| **看板 UI（5 个区块）** | `KpiCard` 可用（**2.1 天**，见下） + kpi 响应契约（F 定） | 真数据接线 | 第 2 天 |
| **IA：16 条目 + 8 个 tab 工作区 + 31 条 Redirect** | `AdminNavItem` 加 `children`/`badge` 字段（单次类型变更，L3 独占） | 8 个页面各自的 tab 受控改造 | 第 2 天（**应最先做**，见下） |
| **badge 接线** | nav-badges 契约（F） | — | 第 2 天 |
| **AC-7 首屏 harness** | **Playwright 在 CI 里可用（待验证，见 V-11）** | 首屏本身 | 第 2 天（与 L3 并行，不阻塞） |
| **`/analytics/discover` · `/payment-ritual` · `/funnel`** | **无** | 全部 | **第 0.5 天**（见下） |
| **`approve-batch`** | **无** | 队列主按钮（L3） | **第 0.5 天**（见下） |
| **漏斗 tab UI** | 分析端点契约（F）+ 经营分析的 **tab 壳**（L3 第 6 天前交付） | 真数据 | 第 7 天 |
| **定价页双列** | `adminMetrics.ts` 的 M1/M1b（F 定契约） | — | 第 7 天 |
| **P4a 卫生（三态/sticky/分页/面包屑）** | 三态件（2.1 天，L2） | — | **第 1.5 天**（只碰 L3 之外的页面） |
| **P4b `data-table` 迁移** | **P2 已上线**（要有"已成立模式"可推广） | — | 第 22 天（真串行） |

**三个必须点名的判断**：

1. **没有任何一个 KPI 在字面上依赖 D1–D4**。KPI-1/3/4/5 是全新 SQL；KPI-2（成行率）共享的是 D4 的**定义**（§5.3 + §6.1 D4 已写死），不是 D4 的代码路径（`getInsightsData()` vs `adminMetrics.ts`）。真正的硬阻塞只有一个：**同一概念必须只有一个 SQL 实现**——否则这次改造会亲手制造第 5 处"同一概念两个数"。解法是 F 泳道先建 `lib/adminMetrics.ts`，队列 7 行 / badge / KPI / 经营分析全部从它取。

2. **P1 基础件的扇出门成本是 2.1 天，不是 4.5 天**。整段 P1 客户端件是 3.9 人日，但卡在别人关键路径上的只有：`KpiCard` 1.5 + `Skeleton.kpi` 组合 0.2 + `AdminQueryError.code` 0.2 + `EmptyState.action` 0.2 = **2.1 天**。`Forbidden`（1 天）与 TW3 gate（0.5 天）不在任何人的关键路径上，可以在 L2 的后半段慢慢做。因此 P1 不需要"整段完成后才解锁下游"，只需要 2.1 天。

3. **P3 的只读分析端点可以第 0.5 天开工，而且应该**。它们只读 `discover_analytics_events` + `payment_ritual_events`（两表已有 `event_type`/`timestamp`/`pool_id` 索引，`_definitions_extended.ts:1324-1327`、`1345-1347`），与 P1/P2 零耦合；需要共享的只有错误码注册表与新 router 文件（都在 F）。**`approve-batch` 更简单：它完全不需要新看板**——它只需要 `adminMatchingReview.ts` 里已存在的 `buildMatchGroupsForApproval` 与 `executePostMatchCommitSideEffects`（`lib/matchingPostMatchEffects.ts:21`），入口可以是现有 `/admin/matching-reviews` 页面上的一个按钮。**把批量审批留在 P3 只是为了叙事顺，不是为了技术依赖**，因此它是本计划里"最便宜的时间回收"：提前 2 天做完，P3 就只剩展示面。

### 14.2 泳道切分（按所有权命名，不按期）

| 泳道 | owns（谁拥有什么） | 硬阻塞 | 工期（人日） | 最早开工 |
|---|---|---|---|---|
| **F 地基**（单人，必须最先） | props 类型冻结 · `lib/adminMetrics.ts`（唯一 SQL 源）· `lib/adminFilters.ts`（badge/列表共享 WHERE）· `routes/domains/adminConsole.ts` 骨架 + `routes.ts` 挂载 + `ADMIN_ROUTE_FILES` 追加 · 错误码注册 · `ui-flags` | 无 | **1.5d** | D0 |
| **L1 数据真话（服务端）** | `adminUsers.ts`（D1/D2/D3）· `legacyStorageRepo.ts`（D4）· `adminMetrics.ts` 的全部实现 · `event-pools` 查询参数与 `total` | F（签名） | 7d | D0.5 |
| **L2 基础件（客户端）** | `components/ui/skeleton.tsx` · `components/ui/badge.tsx`（count 变体）· `components/admin/{KpiCard,EmptyState,AdminQueryError}` · `Forbidden` 页 · TW3 门禁脚本 | F（类型冻结） | 4d | D0.5 |
| **L3 看板 + IA** | `pages/admin/AdminDashboard.tsx` · `lib/adminNavConfig.ts` · `pages/admin/AdminLayout.tsx` · `components/admin/AdminSidebar.tsx` · 8 个 tab 工作区页面 · `components/admin/dashboard/*`（新目录） | F + L2 的 KpiCard（2.1d） | 20d | **D2**（IA 壳先做，见下） |
| **L4 只读分析（服务端）** | `adminConsole.ts` 的分析段 · 新 `lib/adminAnalytics.ts` | F | 3d | **D0.5** |
| **L5 批量审批（服务端）** | `adminMatchingReview.ts`（仅新增 batch 路由） | F | 2d | **D0.5** |
| **L6 卫生（客户端）** | 30 个剩余页面的三态 · `table.tsx` sticky/数字列 · 面包屑接入 | F + L2 的三态件 | 5d | D1.5 |
| **L7 分析面 + 定价面** | `AdminDataInsightsPage.tsx` 的漏斗 tab · `AdminPricingPage.tsx` · `Metric→FilteredList` 全量接线 · 路由调色板 | L4 契约（F）+ L3 的 tab 壳（D6） | 4d | D7 |
| **L8 模式推广** | `components/admin/data-table/*`（vendor）· 5 张表迁移 · 删除 legacy | **L3 已上线** | 4d | D22 |
| **L9 发布 / UAT / 视觉对照** | 灰度、`ui-flags` 演练、G6 可用性测试、TW3 六类 token 逐组件截图、`pre-ship-pipeline` | Release A（D8 起）、其余在 D22 后 | 6d | **D8 起滚动** |

> 工期合计 1.5 + 7 + 4 + 20 + 3 + 2 + 5 + 4 + 4 + 6 = **56.5 人日**，与 §8.0 的合计一致——泳道是同一批工作按所有权重切，不是新增工作。

**L3 内部必须再切一刀**（否则加人不减压）：`AdminDashboard.tsx` 现在是 905 行单文件，直接把 5 个区块并排写进去，第二个人就只能等第一个人提交。规则：**页面容器只做布局与查询编排，5 个区块各自一个文件**（`components/admin/dashboard/{KpiStrip,ActionQueue,InsightRail,ExceptionLedger,TodayStrip}.tsx`），容器对区块只做 append-only 引用。这样 L3 可以被 2 个人同时做，10 天而不是 20 天。

同理，**IA 壳必须在 L3 的第 1 周内先落地**（`AdminNavItem` 加字段 + 8 个 tab 壳 + Redirect），因为 L7 与 L8 的开工前提是 tab 壳存在；把 IA 留到看板做完再动，就等于让两条下游泳道白等两周。

### 14.3 文件所有权矩阵（并行是否成立，取决于这张表）

> 一个文件在同一个窗口内**只能有一个泳道写入**。读不限。窗口用相对天（D0 = 地基开工）。

| 文件 / 目录 | 独占泳道 | 窗口 | 规则 |
|---|---|---|---|
| `apps/admin-client/src/lib/adminNavConfig.ts` | **L3** | D2–D8 | 类型变更（`AdminNavItem.children?`/`badge?`）+ 16 条目 + `navVersion` 双版本数据，全部在**一个提交**内完成。L6（面包屑）只调用导出的 `getPageTitle()`，**不写此文件**；L7 新增漏斗 tab **不新增导航条目**（它是 `insights` 的 tab，不是 nav item） |
| `apps/admin-client/src/pages/admin/AdminLayout.tsx` | **L3** | D2–D8 | 37 条 `<Route>` 改为**数据驱动的路由表**（`ADMIN_ROUTE_TABLE`），后续泳道追加路由只改那张表的一个数组项，不碰 JSX。这一步是"为什么并行能成立"的技术前提，不是风格偏好 |
| `apps/admin-client/src/components/admin/AdminSidebar.tsx` | **L3** | D2–D8 | 只读 `adminNavConfig` 的两套数据 + `ui-flags.navVersion` |
| `apps/admin-client/src/pages/admin/AdminDashboard.tsx` | **L3** | D2–D22 | 只做容器；5 个区块在 `components/admin/dashboard/*`，由 L3 内部两人分持不同文件 |
| `apps/admin-client/src/components/ui/*` | **L2 独占** | D0.5–D3 | L3/L6/L7 **只读消费**；新原语（`dropdown-menu`/`collapsible`/`avatar`/`calendar`）只能由 L2 加入。窗口结束后新原语需求回流给 L2，不允许各泳道自行加文件 |
| `apps/admin-client/src/components/admin/{KpiCard,EmptyState,AdminQueryError}` | **L2 独占** | D0.5–D3 | 契约冻结在 D0（F 产出 `.ts` 类型 + 桩组件），实现与消费分离 |
| `apps/admin-client/src/pages/admin/AdminPricingPage.tsx` | **L7 独占** | D7–D11 | 纯展示增列 |
| `apps/admin-client/src/pages/admin/AdminDataInsightsPage.tsx` | **L7 独占** | D7–D11 | 漏斗 tab（tab 壳由 L3 提供，L7 只填内容） |
| `apps/admin-client/src/components/admin/data-table/*` | **L8 独占** | D22–D26 | vendor 一次性落地 |
| `apps/server/src/routes/domains/adminUsers.ts` | **L1 独占** | D0.5–D4 | 该文件 1082 行且已承载 `/api/admin/stats` 与 `/api/admin/ops-dashboard`。**新端点一律不要放这里** |
| `apps/server/src/routes/domains/adminConsole.ts`（新） | **F 建骨架，之后按段分持**：`kpi`/`action-queue`/`nav-badges` → L1；`analytics/*` → L4；`ui-flags` → F | D0.5 起 | **推荐新建这个文件**，理由：①`adminUsers.ts` 已是热点；②`routes/domains/admin.ts` 只有 247 行但混了账号/审计/开关三类语义，再塞 KPI 会让 RBAC 审查无法聚焦；③新文件让 RBAC 覆盖测试的被审对象清晰。挂载点：`apps/server/src/routes.ts` 的 admin 区块（`registerAdminUserRoutes(app)` 之后，约 `:192` 处）一行 `registerAdminConsoleRoutes(app)` |
| `apps/server/src/routes/domains/adminMatchingReview.ts` | **L5 独占** | D0.5–D2.5 | 只追加 batch 路由，不改既有逐池路由 |
| `apps/server/src/lib/adminMetrics.ts`（新） | **F 定签名，L1 实现** | D0–D4 | 任何泳道要用聚合数字，**必须**加函数到这里，不允许在自己文件里写第二份 SQL |
| `apps/server/src/__tests__/adminRbacCoverage.test.ts` | **F 独占** | D0 单次 | 把 `adminConsole.ts` 追加进 `ADMIN_ROUTE_FILES`。**之后所有泳道只读**。忘记追加 = 新文件全部路由零覆盖且测试仍绿（已验证，见 §6.3） |
| `apps/server/src/routes.ts` | **F 独占** | D0 单次 | 只加一行挂载 |
| `apps/server/src/lib/wecomNotifier.ts` / `lib/wecomNotifications/*.ts` | **L1** | D4–D6 | 只追加（不重构），且仅在采纳 §15 S-5 时动 |
| **`apps/server/src/lib/featureFlags.ts`**<br>**`packages/shared/src/copy/featureFlags.ts`** | **⚠ 本计划内无人写入** | — | 见下方硬约束 |
| `PRODUCT_REQUIREMENTS.md` | **本窗口禁止写入** | — | 该文件有未提交改动（外部会话），本期不修改 canon |

**⚠ featureFlags 协调硬约束（外部会话的未提交工作树）**：这两个文件当前处于未提交状态——`matchingOperatorReviewEnabled` 默认 `true → false`、`DEFAULT_FLAG_VALUES` 补齐 30 个缺失键、新增 `apps/server/src/__tests__/featureFlagDefaultsContract.test.ts`、`docs/agent-context/feature-flags.md` 同步中。规则按优先级：

1. **首选：本期不新建任何 feature flag。** 看板与导航的回滚改用 Phase 1 的 `GET /api/admin/ui-flags`（代码常量 + 一行业务表读取）。这是最省的规避，也顺手避开了与上述未入库契约测试的耦合。
2. 若人类决策坚持用 `featureFlags`：唯一合法做法是**等该工作树入库后 rebase**，新增键只追加在文件末尾独立区块，且必须同时满足 `featureFlagDefaultsContract.test.ts` 的双向不变量（`FLAG_ENV_MAP` ⊆ `DEFAULT_FLAG_VALUES`，且值 = 调用点 fallback）。**禁止**在同一窗口内改既有键或"DEFAULT_FLAG_VALUES 排序整理"这类顺手动作。
3. 该工作树何时入库 → **待验证**。本计划不得假设它在任何具体日期前入库；若它在本期中途落地，所有泳道需 rebase 一次并重跑 guardrails。

### 14.4 人数假设（并行化不减少人日，只压缩日历）

协调税的定义：merge 冲突解算 + 交叉 review + 共享文件排队 + 一次回归重跑的固定成本。**税率为估计值，基于本计划的 6 个热点文件**（不是实测数据）。

| 人数 | 墙钟（原文 29d 口径） | 墙钟（修正 56.5d 口径） | 协调税 | 关键路径约束 |
|---|---|---|---|---|
| **1** | 29–30d | **57–61d** | 0 | 无。**此时「并行」是虚构的**——一个人做 F→L1→L2→L3 的串行链，加法就是全部 |
| **2** | 16–17d | **34–36d** | 15–20% | L3 若不分文件，第二个人只能在 IA 壳上等；必须按 §14.2 的区块拆分才拿到这个数 |
| **3** | 12–13d | **26–29d** | 30–35% | L3 拆成 4 个区块 + IA 壳前置后，关键路径 ≈ D2 + 13（L3 拆分后）+ 4（L8）+ 4（L9 尾段）= 23–25d，关键路径 23–25d 已贴近下界，**第 3 人的边际收益开始小于协调税** |
| **4** | 11–12d | 23–26d | 45–55% | 第 4 人的边际收益只有 2–3d（F/L1/L6 剩下的是不可切分的单文件工作），**不值得** |

**最小值得并行的门槛 = 2 人**；**推荐 3 人**。1 人时任何"并行"说法都不成立；4 人时增量被协调税吃掉。

### 14.5 并行化的代价：Phase 1 的三个性质里有两条会消失

Phase 1 的价值全部来自三个性质：**视觉零变化、数字正确、可独立发布**。一旦并行开发让 P1 与 P2 进入同一个发布窗口：

- "视觉零变化"消失 → 运营无法把「数字变了」和「页面变了」分开归因（R-2 与 R-7 相撞）。
- "可独立发布"消失 → 失去唯一一次低风险验证机会；`ui-flags` 灰度演练也被推迟到 P2。
- 只有"数字正确"活着，但它失去了被单独确认的机会。

**建议：并行开发，串行发布。** 具体三条：

1. Release A 的 tag **只能**包含 F + L1 + L2 + `total`/`ui-flags`/`event-pools` 参数。L3 的 UI 改动即使已经在分支上写完，也不进这个 tag。
2. Release A 上线后至少观察 3 天（看 `ADMIN_STATS_LEGACY_BUGS` 是否被触发、运营是否有"数字怎么变了"的困惑反馈），再放 Release B。
3. Release A 存在的意义恰恰是：**如果 Release B 需要紧急回滚，数字仍然是正确的**——回滚只回 UI，不回真话。这是并行化唯一不能省的顺序。

---

## 15. 评审补遗

> 以下每条都是"若不做，这个控制台会在某个具体场景里失去可信度或可执行性"。级别：`[MUST]` = 进入本期范围，否则 §8 的退出标准不成立；`[SHOULD]` = 本期做，成本低价值高，可降级；`[NICE]` = 记录，不做。
> 泳道缩写见 §14.2。

### 15.1 [MUST]

| # | 缺口 | 为什么对这个后台重要 | 落点 |
|---|---|---|---|
| **M-1** | **队列第 6 行读错了列**：写的是 `event_attendance.status='pending'`，但匹配落库时写入的是 `status:'confirmed'`（`matching/matchPersistence.ts:171`），签到的真实列是 `attendance_status`（默认 `'pending'`）。该行会**恒等于 0**，而且看起来"今天都签到了"。另：行是 per-user，"组数"需要 distinct group | 这是 D4 的同一类错误（结构性空指标）出现在新设计里。它比旧错误更危险，因为旧错误是"数字不对"，这个是"数字永远说没事" | L1（SQL）+ L3（行） |
| **M-2** | **低填充阈值错了一个量级**：D3 修正版与队列第 2 行都用 `< p.min_group_size`，但 `min_group_size` 是**单组**最小成局人数（`_definitions.ts:427`）；多组池需要 `< min_group_size × target_groups`。客户端 `warRoomUtils.ts:119` 的 `isLowFill` 同病 | 3 组 × 6 人的池，8 人报名会被判"不低填充"，而这正是最该催的池。原文只修了"缺填充条件"这一半，另一半原样留给了新设计 | L1 |
| **M-3** | **KPI-2 混用两个时间锚**：分子按 `status`、分母按「已过 `registration_deadline`」。场次在**开始 +3h** 才被 `poolCompletionSweep` 落成 `completed`（`POOL_COMPLETION_BUFFER_MS`），因此"已截止但还没揭晓"的池会被算成"未成行" | 成行率是 G1/G2 的核心数字，也是唯一被要求"不可能恒为 100%"的指标（AC-6）。口径错误会让它系统性偏低，并且**每天不同**（随当日场次数波动） | L1 |
| **M-4** | **"下钻行数 === 来源数字"当前不可验证**：`GET /api/admin/event-pools` 不返回 `total`（`adminEventPools.ts:108-142` 只有 `limit`/`offset`），且未 select `operator_review_status`/`operator_reviewed_at` | AC-16（badge === list.total）与 AC-17（行数 === 来源数字）是本 PRD 的两条硬 AC，现在只能靠前端手算，等于没有验收 | L1 |
| **M-5** | **`adminDashboardV2` 开关对 2/3 角色不成立**：唯一读口 `GET /api/admin/feature-flags` 是 `requireSuperAdmin`（`routes/domains/admin.ts:190`）；admin-client 全树没有 flag 读取层；admin 是独立 SPA，不吃 `/api/auth/user.features` | 意味着"回滚"只对超管有效——而真正用看板的是 operator。故障时回滚按钮按不下去，是最糟的回滚 | F（`ui-flags`）+ L3 |
| **M-6** | **IA 没有运行时开关**：原方案"回滚 = revert 单提交"，但 `AdminNavItem` 当前无 `children`/`badge` 字段，加字段会同时波及 `AdminSidebar`、`AdminGuard`、页面标题、面包屑；revert 会把同批其他修复一起带走 | 16 条目 + 8 个 tab 工作区是这次改动中**最打断肌肉记忆**的部分（R-7 自评"高"），却给了最弱的回滚 | L3（双版本 nav 数据）+ F（`ui-flags`） |
| **M-7** | **§6.3 的 RBAC 断言是错的**（已在 §6.3 修正）：`adminRbacCoverage.test.ts` 用硬编码文件白名单 + 只解析 `app.get(...)` 内联声明 | 如果按原文假设行事，新建 `adminConsole.ts` 会**完全逃过 RBAC 覆盖而测试是绿的**——这是一个安全门禁的静默失效，正好发生在"为了并行而新建 router"的那一步 | F |
| **M-8** | **全篇"下钻"没有对象级落点**：`/admin/pools/:id` 不存在（`AdminLayout.tsx:92-128` 的 37 条路由内没有），池详情是 `AdminEventPoolsPage.tsx:139-140` 的内部 state；`?poolId=` 无人解析。而**线上企微提醒 `notifyLowRegistration` 的 CTA 正指向 `/admin/pools/${poolId}`**（`lib/wecomNotifications/poolLifecycle.ts:144`）→ 运营点进去落到 `AdminNotFound` | ① 这是今天就在发生的死链，属于 P3 的"无对象上下文"而不是新需求；② AC-17 的"行点击 → 对象详情（带 poolId 上下文）"在没有落点时无法实现；③ 台账每行都要点 | F（路由约定）+ L6（`?poolId=` 打开详情）+ L1（修企微链接） |
| **M-9** | **"移动端非目标"让队列第 6 行在活动当天不可执行**：`AdminWarRoomPage.tsx` 615 行只有 1 处 `md:` 网格（`:283`），无 PWA/manifest（`admin-client/public` 不存在，`index.html` 只有 viewport meta） | 签到发生在场地里、手机上。这行写着「打开现场值守」，但那个页面在手机上不可用——于是这行是一个**看起来有动作、实际没有**的队列项，直接违反 §5.4 的立身之本 | L3（行内文案标注）+ §2.2 增补说明 |
| **M-10** | **质量预算缺失**：29 人日不含 G6 的 5 人可用性测试、TW3 六类静默失败的逐组件截图对照、AC-7 的 Playwright harness。且 `playwright` 目前只是 `@executeautomation/playwright-mcp-server` 的**传递依赖**（存在于 `node_modules`，但没有任何 workspace 在 `package.json` 里声明它；CI 是否安装了浏览器 待验证 V-11） | 没有这三项，AC-7/AC-9/AC-10 全部是纸面 AC；"是否值得做"（§10）也无法回答 | 已并入 §8 的 6 人日质量预算；L9 |
| **M-11** | **定价阶梯不能停在"只加两列"**：§1.3 已证明「月卡无场次上限 → 实际单场成本无下限」，3.78× 价差在 12 场时变 7.5×。这是收入自侵蚀机制，不是展示缺陷 | 只做观测面会把问题从"看不见"变成"看见了但不许改"，而这恰恰是最消耗运营信任的状态。**不需要本 PRD 实现定价，但 Phase 3 的定价列必须有 G-2 的书面结论才发**（见 §8 Phase 3） | Gate，L7 之前 |

### 15.2 [SHOULD]

| # | 缺口 | 判断 | 落点 |
|---|---|---|---|
| **S-1** | **告警疲劳 / 无 ack**：R1–R5 + 7 行队列每天都会命中；慢性低填充池会连续红一周 | **v1 不做 ack/snooze**（ack 会稀释 SLA 语义，且"静音"在多运营场景下等于"没人负责"）。改为两件不需要 DDL 的事：① 每行可展开「为什么红」的 SQL 级证据；② **慢性标记**——`registration_deadline − created_at > 72h` 且填充 <50% 的池，从首屏队列降级到「慢性项」折叠区。两列都在 `event_pools` 上，零 DDL | L3 |
| **S-2** | **审计没有内联**：对象页看不到"谁改的、何时改的" | **几乎免费的洞察**：`GET /api/admin/audit-logs` **已经支持** `targetEntityType` + `targetEntityId` 过滤（`routes/domains/admin.ts:166-188`），只需要一个 `useEntityAudit(type, id)` hook + 折叠区块（约 0.5d/页 × 3 页：定价、场地、活动池）。对 3 角色 RBAC 的后台，这是"信任 vs 甩锅"的分界线 | L7（定价）+ L6（场地/池） |
| **S-3** | **新鲜度诚实性**：一个全局 `dataUpdatedAt` 是谎言 | badge 60s 缓存、KPI 端点有缓存、队列/台账实时——三者不同源。改为**服务端在每个响应里返回 `asOf`**，每区块各自显示；header 只留「刷新」。已同步修正 §5.7 #15 | L1（响应加 `asOf`）+ L3（渲染） |
| **S-4** | **收入 ≠ 毛利**：`venue_deals` **没有任何成本字段**（只有 `discount_type`/`discount_value`/`min_spend`/`max_discount`，`_definitions.ts` venue_deals 块），所以每场毛利与单位经济无法计算 | KPI-4 叫「每场实收单价」，字面上是收入没错，但它是首屏 5 个 KPI 之一，读者会当成利润。**本期不建 `cost_per_seat`**（守住零 DDL），但必须在 KPI 卡与 tooltip 写死「未扣场地成本」，并在 §2.2 明列「毛利不可计算」为已知边界；把"venue_deals 加成本字段"写成独立的触发条件（当 KPI-4 连续两个周期被用于定价讨论时立项） | L3（文案）+ 文档边界 |
| **S-5** | **队列 SLA 无推送**：仓库已有 `notifyOpsMarkdown`/`notifyCriticalMarkdown`/`notifyLowRegistration`/`buildAdminUrl`（`lib/wecomNotifier.ts:206-251`），但低填充提醒只在 `triggeredBy === 'cron_job'` 且 `percentFilled < 50 && daysUntilDeadline <= 3` 时触发（`poolRealtimeMatchingService.ts:276-300`），**无去重、且 CTA 是死链（见 M-8）** | 纯下拉式看板的最坏情形已经被写进问题陈述：23:00 的低填充池会在次日 10:00 才被发现。但**逐行推送会造成刷屏**。本期只做**一条**「每日 09:30 队列摘要」（复用既有 scheduler 形态 `lib/*Scheduler.ts`，fail-open，去重键 = 队列行 + 日期），不做逐行实时推送 | L1 |
| **S-6** | **Saved Views 1.5d 应删除** | 16 条目 + 带参下钻已经覆盖 80% 的检索需求；localStorage 级视图在多运营场景下制造"他看的是另一个队列"的错觉。已在 §7.3 删除 | — |
| **S-7** | **队列第 7 行把"从未开始引导"算成"滞留"**：SQL 是 `onboarding_checkpoint IS NULL OR NOT IN ('profile-review')` + `created_at < 7 天`（`adminUsers.ts:483-488`），`IS NULL` 分支会把长期沉默的"注册即流失"用户与"卡在某一步"的用户混成一个数 | 这两类人的处置动作完全不同（提醒 vs 不管）。至少要在行内拆成两个数，或在 tooltip 写明包含未开始用户 | L1 |

### 15.3 [NICE]

- **N-1** `lib/adminInsights.ts` 的 R1–R5 阈值必须与 KPI 目标值**同源**（Q8 的配置表），否则 P3 之后会出现"KPI 说 70% 是目标，洞察在 65% 就报警"的第二套魔数——这正是 §5.7 #3 要删除的东西。
- **N-2** 8 个 tab 工作区的受控 tab 化建议统一一个 `useAdminTab()`（同步 URL query + 回显），不要每页自己写 `useSearch`，否则 31 条 Redirect 的落地页会出现 4 种不一致的 tab 参数名。
- **N-3** 台账的 `riskScore` 权重若在 P2 上线后被反复手调，应把它移进配置表（与 Q8 同表），而不是留在 `adminInsights.ts` 常量里。

### 15.4 已评估但**不采纳**的候选（记录判断，避免二次讨论）

| 候选 | 判断 | 理由 |
|---|---|---|
| 把 `data_updated_at` 全局时间戳彻底删掉 | 不采纳（改为 per-block `asOf`） | 见 S-3；删掉会让人无法判断"这是不是刚刷的" |
| 为看板做 WebSocket 实时推送 | 不采纳 | 后台是低并发面；5s/60s 级轮询足够，WS 只增加运维面 |
| 把 `AdminDashboardLegacy` 永远保留 | 不采纳 | 双看板永久共存会让 §10.3 的反向指标永远无法收敛；保留 2 周 + 访问 <10% 后物理删除 |
| 本期给 `venue_deals` 加成本字段 | 不采纳（本期） | 引入 DDL 与"成本由谁维护"的流程问题，与"真话优先"无关；先让收入可见（S-4） |

---

## 16. 附录

### 16.1 已核实证据（本轮直接读码确认，可直接引用）

| 事实 | 位置 |
|---|---|
| 32 个 nav 条目 / 5 组 / 6 固定 | `src/lib/adminNavConfig.ts:57-124` |
| 37 个 `<Route>`（32 页面 + 4 Redirect + 1 404） | `pages/admin/AdminLayout.tsx:92-128` |
| 看板 905 行 / 5 个并发查询 / 整页 spinner / 硬编码阈值 5%·80%·70%·15%·50%·10 | `pages/admin/AdminDashboard.tsx:40-63, 171-180, 446-520` |
| `userGrowth` 公式与「相比上周」文案 | `adminUsers.ts:277` + `AdminDashboard.tsx:135-139` |
| `getAllUsers()` 进内存 | `adminUsers.ts:255` |
| `underfilledPoolsClosingSoon` 无填充条件 | `adminUsers.ts:469-473` |
| 客户端同概念重算（`filterPoolsClosingWithin24h` + `isLowFill`） | `AdminDashboard.tsx:70-73` + `warRoomUtils.ts:119` |
| 匹配成功率分母 = `blind_box_events` | `legacyStorageRepo.ts:600-616` |
| `event_pools` 有 `operator_review_status` / `operator_reviewed_at` / `matched_at` | `packages/shared/src/schema/_definitions.ts:438-453` |
| `payments` 有 `payment_type`（3 类）/ `coupon_id` / `final_amount` | `_definitions.ts:1438, 1447, 1444` |
| `user_coupons` 有 `is_used` / `used_at` / 唯一索引 | `_definitions.ts:1516-1527` |
| `discover_analytics_events` / `payment_ritual_events` 结构 + 索引；**全树无 admin read 端点** | `_definitions_extended.ts:1315-1351` |
| `payment_ritual` 只写不读（仅 analytics 写路由与测试） | `routes/domains/analytics.ts:907` + `__tests__/*AnalyticsRoutes.test.ts` |
| 订阅为布尔闸门（无周期次数） | `lib/entitlement.ts:40-42` |
| 定价阶梯种子（¥98/30d、¥294/90d、¥88、¥211/3、¥370/6） | `apps/server/migrations/seed_pricing_plans_20260805.sql:27-31` |
| `--primary` 与 `--chart-1..5` | `apps/admin-client/src/index.css:53, 75-79` |
| `Skeleton` 覆盖 10 页 / 分页 2 页 / `useDebounce` 0 使用 / Recharts 3 页 | grep 统计（`pages/`） |
| `breadcrumb.tsx` 存在但零引用；无 `chart.tsx` / `react-table` / `cmdk` | `src/components/ui/` 目录（30 个原语） |
| `AdminGuard` 越权 = toast + 静默跳转（无 `Forbidden` 页） | `components/admin/AdminGuard.tsx:41-52` |
| `EmptyState` 无 action 插槽 / `AdminQueryError` 无 `code` | `components/admin/{EmptyState,AdminQueryError}.tsx` |
| 审批仅逐池（无 batch） | `routes/domains/adminMatchingReview.ts:264, 365` |
| `GET /api/admin/event-pools` 仅 `limit`/`offset` | `routes/domains/adminEventPools.ts:107-110` |
| **事件表两份口径**：`event_attendance` 有 `status`（匹配落库写 `'confirmed'`）与 `attendance_status`（默认 `'pending'`）两列，签到读后者 | `matching/matchPersistence.ts:171` + `_definitions.ts` event_attendance 块 |
| **场次完成有 3h 缓冲**：`POOL_COMPLETION_BUFFER_MS = 3h`，`status='completed'` 在场次开始 +3h 后才写 | `lib/poolCompletionSweep.ts` |
| **低填充阈值在客户端也是单组口径**（`registrationCount < minGroupSize`） | `pages/admin/warRoomUtils.ts:119` |
| **`min_group_size` 是单组最小成局人数，另有 `target_groups`** | `_definitions.ts:427-429` |
| **RBAC 覆盖测试用硬编码文件白名单 + 只解析 `app.get` 内联声明** | `__tests__/adminRbacCoverage.test.ts:58-80`（文件头注释明写 `.use()` 挂载不被发现） |
| **审计端点已支持按对象过滤**（`targetEntityType` + `targetEntityId`） | `routes/domains/admin.ts:166-188` |
| **feature-flags 读口是 `requireSuperAdmin`；admin-client 无 flag 读取层** | `routes/domains/admin.ts:190` + grep `admin-client/src` |
| **企微低填充提醒的 CTA 指向 `/admin/pools/:id`（不存在的路由）** | `lib/wecomNotifications/poolLifecycle.ts:144` vs `AdminLayout.tsx:92-128` |
| **`venue_deals` 无任何成本字段**（仅 discount/min_spend/max_discount） | `_definitions.ts` venueDeals 块 |
| **`event-pools` 响应无 `total`** | `routes/domains/adminEventPools.ts:108-142` |
| **admin-client 有真实 vitest（7 个测试文件）**；`AdminNavItem` 无 `children`/`badge` 字段 | `apps/admin-client/package.json` + `lib/adminNavConfig.ts:39-49` |
| **war-room 无移动布局**（仅 1 处 `md:`），admin-client 无 PWA/manifest | `AdminWarRoomPage.tsx:283` + `apps/admin-client/index.html` |

### 16.2 待验证清单（本 PRD 中标注但未实证的项，实现前必须落实）

| # | 待验证项 | 影响 | 验证方式 |
|---|---|---|---|
| V-1 | `matchingOperatorReviewEnabled` **生产 DB 行的实际值**（代码默认处于 true→false 的未提交变更中，文档前后自相矛盾） | 决定 KPI-3 主/次口径与队列第 1 行形态（Q9，已按条件渲染兜住） | 查生产/预发 `feature_flags` 表该行；再核 `GET /api/auth/user` 的 `features` 回显 |
| V-2 | `event_pools.total_registrations` 计数器是否漂移 | 若漂移，展示数字与真实不一致 | 抽样 20 池对账 `COUNT(event_pool_registrations)` |
| V-3 | `discover_analytics_events` 的 `event_type` 实际枚举与覆盖度 | 决定漏斗能否上线（R-3） | `SELECT event_type, COUNT(*) ... GROUP BY 1` 看最后 30 天分布 |
| V-4 | `payment_ritual_events` 的步骤命名与 `metadata` 字段 | 漏斗步骤映射 | 同上 + 抽样 20 行 `metadata` |
| V-5 | `payments.payment_type` 历史空值/异常值比例 | SKU 结构准确性 | `GROUP BY payment_type` 含 `NULL` |
| V-6 | `retention.userSegments` / `eventQuality.completionRate` / `monetization.conversionRate` 的真实口径 | 决定保留/删除 | 读 `legacyStorageRepo.getInsightsData()` 全文 |
| V-7 | `event_pools` → `blind_box_events` → `event_attendance` 的"成行"定义在服务端的既有唯一口径 | 成行率公式必须与既有语义一致 | 查 `poolCompletionSweep` 与 `venueAssignmentService` 的选取条件 |
| V-8 | 小程序端是否在客户端限制月卡场次 | 影响 §1.3 的 3.78× 结论强度 | 搜 `apps/mini-program` 的订阅场次逻辑 |
| V-9 | `adminRbacCoverage.test.ts` 对新端点的具体断言形式 | AC-24 的写法 | 读该测试文件 |
| V-10 | 现状首屏性能基线 | §10.2 的对照值 | 在 staging 跑一次 Playwright 采样 |
| V-11 | **`playwright` 是否可在 CI 使用**：它存在于 `node_modules`，但只是 `@executeautomation/playwright-mcp-server` 的传递依赖；没有任何 workspace 在 `package.json` 里声明，CI 是否有浏览器安装步骤未知 | AC-7（首屏预算）、§8 质量预算里的视觉对照、M-10 | 查 `quality-gates` workflow 是否 `npx playwright install`；若无需在 L9 补 0.5d |
| V-12 | `admin_audit_logs` 到底覆盖了哪些写路径（定价 PATCH / 场地 CRUD / 池 PATCH 是否都 `logAdminAudit`） | S-2 内联审计能显示什么；若覆盖不全，内联区块会显示空态并制造"没人改过"的错觉 | grep `logAdminAudit(` 的全部调用点，按 `targetEntityType` 分组统计 |
| V-13 | `?poolId=` 打开池详情需要的最小改造：`AdminEventPoolsPage` 是 992 行、详情为内部 state（`selectedPool`/`showDetailsDialog`） | M-8 的成本（估 0.5d，未验证是否有其他页面依赖同一 Dialog） | 读 `EventPoolDetailDialog` 的 props 与数据依赖 |

### 16.3 术语与文案约束（本 PRD 新增文案直接受约束）

- 用户可见文案按 `docs/copy/brand-copy-strategy.md` 🔴 规则：禁用 `LLM / 算法 / 权重 / 评分 / 数据（指机制）`。
- 运营后台词汇沿用 "活动 / 场次 / 局 / 桌 / 排桌 / 合拍度 / 活动画像 / 权益"，**不出现** "匹配 / 灵魂 / 撮合" 于可见文案（`admin nav` 的「匹配」按 §3 术语表属允许的 admin-nav 用法，但新文案优先用「排桌」）。
  - 因此：本 PRD 中的「排桌审批」「排桌完成率」为**界面文案**；代码标识符继续用 `matching`（不改既有命名，避免大面积 diff）。
- 无 emoji（仓库 guardrail 对 `apps/mini-program` 有硬扫描；后台按同规格自我约束）。
- 错误文案：`code` 给机器，中文 `message` 给人；两者都存在（`ErrorCode` 映射按仓库既有模式）。

---

*本文档的每个 repo 引用均为本轮已读码确认或明确标注「待验证」。未验证的数字一律未写入。*

*工作量与人日为**逐项加总的估算**（§8.0 的加总依据表可逐条核对），不是承诺值；协调税与人数墙钟（§14.4）是**基于 6 个热点文件的估计**，不是实测。凡未实证的事实都挂在 §16.2 的待验证清单上（V-1 … V-13）。*
