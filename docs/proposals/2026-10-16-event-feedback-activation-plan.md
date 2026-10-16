# 活动反馈激活 + 微信通知召回 — 产品计划（2026-10-16）

> 状态：**已实施**（2026-10-16，含 P0 recap 送达修复）· 类型：聚焦迭代（非反馈系统重设计）
> 实施记录：`docs/agent-context/mini-program-events.md` §反馈激活与评价入口；AGENTS.md §6 通知策略 2026-10-16 附注
> 问题来源（用户原话）：「提交反馈现在的逻辑应该是活动结束后才activate的吧？另外需要微信通知用户填写」

## §0 遗留事项（实施后回填）

1. ~~**pool「进入破冰」live 判定语义瑕疵**~~ → **已修（2026-10-16 后续轮次）**：确认该入口在生产环境不可达（服务端从不写 `started`/`ongoing`，且 group id 只在排桌后才存在）。pool 改用 dateTime 窗口 `[start − 1h, start + 3h]`（`apps/mini-program/src/lib/utils/eventLiveWindow.ts`，+3h 尾界对齐 `POOL_COMPLETION_BUFFER_MS`，与反馈开启无缝交接；`cancelled`/`archived` 恒不开，dateTime 缺失/不可解析 fail-closed）。joined-events 查询（groupId 来源）仅在该窗口内启用；盲盒维持原 status 判定。边界锁在 `eventLiveWindow.test.ts`（8 条），wiring 锁在 `eventDetailPage.test.ts`。
2. `event_feedback(user_id, event_id)` 唯一索引（需先做存量去重审计）。
3. `connectionsContextResolver.ts` feedback-pending 推导的 id 家族错位修复（本次未复用其路径，另立项）。

## §1 决策摘要

| # | 决策 | 一句话 |
|---|------|--------|
| D1 | 反馈开启规则 | **统一时间规则：活动开始后 3 小时（dateTime+3h）且活动未取消**，三种 event id 家族（pool / blind-box / legacy）一视同仁；不依赖 pool status（对齐 poolCompletionSweep 的 `POOL_COMPLETION_BUFFER_MS=3h`，避免 sweep tick 延迟 + test pool 永不开的问题） |
| D2 | 反馈窗口 | **只开不关**：本次迭代不设关闭时间；XP/金币奖励（基础 20/20，深度 50/50）不随时间衰减 |
| D3 | 按钮状态机 | 招募中/排桌中/已取消 → **隐藏**；已成局至活动进行中 → **置灰可点**（点击 toast 教学「活动结束后才能评价哦」）；已结束未提交 → **主 CTA「去评价」**；已提交 → **静态「已评价」态** |
| D4 | 服务端门槛 | fail-closed：未开启 403 `FEEDBACK_NOT_OPEN`、无资格 403 `FEEDBACK_NOT_ELIGIBLE`、重复提交 409 `FEEDBACK_ALREADY_SUBMITTED`（全部走 error-code 契约） |
| D5 | 资格定义 | pool：存在 matchStatus ∈ {matched, completed} 的报名；blind-box/legacy：存在未取消的 event_attendance。未成行/已退订/塌组退款用户不可评价；no-show 本次**不**限制 |
| D6 | Recap 推送落地页 | per-template page override：recap 模板直达 `pages/event-feedback/index?id=<poolId>&from=recap_push`，其余模板维持 `pages/events/index` |
| D7 | Recap hint 文案 | 「来聊聊感受，帮下次排桌更合拍」（14 字，服务口吻，零营销钩子，零激励承诺——奖励话术只留在反馈页内） |
| D8 | 无授权用户兜底 | 双通道：①足迹「已完成」tab 卡片加「去评价」角标（持久入口）；②recap 时刻同步创建站内通知（category=activities, type=feedback_invite，复用 notificationsRepo + tab 红点） |
| D9 | P0 修复 | recap 调度器成员查询只认 `matchStatus='matched'`，被 2026-10-06 上线的 poolCompletionSweep（matched→completed）击穿，**pool 活动 recap 推送当前实际零送达**——本迭代必须连带修复 |
| D10 | 测试池 | 反馈开启走同一时间规则（tester 可走通全流程）；recap 推送/站内通知排除 `is_test_pool`；bot 无 openid 天然被过滤 |

## §2 反馈激活逻辑

### 2.1 现状（代码已核实）

- 按钮无门槛：`event-detail/index.tsx:187-192` 无条件渲染「提交反馈」。
- 服务端无门槛：`POST /api/events/:eventId/feedback`（`social.ts:303`）任何时刻可提交，无重复提交保护（`event_feedback` 表无 (user_id, event_id) 唯一约束），重复提交会重复发 XP。
- pool 生命周期：`poolCompletionSweep.ts`（2026-10-06）在活动开始 +3h 把 pool status → `completed`、报名 matchStatus `matched`→`completed`；test pool 被 sweep 排除（永远不到 completed）。
- 已有「feedback-pending」推导先例：`connectionsContextResolver.ts` + `shellRepository.ts:563`（按用户 feedback eventId 集合推导）。**注意：该推导对 pool 活动有 id 家族错位**——feedback 行存 canonical `events.id`（每组派生事件），而 connections context 的 joined events 携带 `eventPools.id`，匹配永远落空。本次实现足迹角标时须显式做 pool→group→canonical 映射，不要复用这条有缺陷的路径。

### 2.2 规范规则（canonical rule）

**反馈开启 = 活动开始时间 + 3 小时已过去，且活动未处于取消/关闭态。**

| id 家族 | 开启条件 | 取消态排除 |
|---------|---------|-----------|
| pool（`event_pools.id`） | `dateTime + 3h <= now` | `status ∈ {cancelled, archived}` 不开 |
| blind-box（`blind_box_events.id`） | `dateTime + 3h <= now` | `status ∈ {cancelled}` 不开；`completed/attended` 天然已过时间 |
| legacy（`events.id`） | 同上 | 同上 |

**为什么用时间规则而不是 status 规则：**
1. 与 sweep 自己的常量（3h）严格一致，显示态（足迹已完成 tab 本来就按 `dateTime < now` 时间分桶，`eventPartition.ts`）与反馈开启永不打架；
2. sweep 是 1h 间隔的 tick，status 规则会让反馈最晚多锁 1 小时；
3. test pool 永不被 sweep 完成，status 规则会让 tester 永远无法走通反馈流程；
4. 一条规则覆盖三个 id 家族，客户端零计算——由服务端新 helper `resolveFeedbackState(eventId, userId)` 统一输出（唯一事实源，POST 门槛与详情页/足迹展示共用）。
5. 时区纪律：服务端一律复用 `lib/eventDateTime.ts`（+8h + `getUTC*`），客户端不做任何时间运算。

### 2.3 窗口与奖励

- **开启**：T+3h（活动开始算起，约等于散场时刻）。
- **关闭**：本次不关闭。理由：recap 推送（T+1）与足迹角标（持久）已构成足够召回；硬性关窗会制造「为什么我的 50 积分没了」的客服压力，且当前反馈量瓶颈在「不知道入口」而非「拖延」。
- **奖励不变**：基础 20xp/20coins，深度（任一五维字段）50xp/50coins，与 UI 既有承诺「完成可得 +30 积分」一致。
- 后续若 recap→提交转化低于目标（§7），再评估「48h 内提交额外 +10」限时激励（follow-up，不在本次）。

## §3 活动详情页按钮状态机

「进入破冰」按钮逻辑**不动**。仅规范反馈按钮（copy 从「提交反馈」改为「去评价」，与 recap 推送「活动评价提醒」模板语义对齐）。

| 生命周期状态 | 反馈按钮 | 样式/交互 | 提示文案 |
|---|---|---|---|
| 招募中（active）/ 排桌中（matching） | **隐藏** | — | — |
| 已成局·活动前（matched，dateTime 未到） | **置灰可点** | 灰色次级样式 + `aria-disabled`；点击不跳转 | toast：「活动结束后才能评价哦」 |
| 活动进行中（dateTime 已过，< +3h） | **置灰可点** | 同上 | 同上 |
| 已结束·未提交（open） | **主 CTA「去评价」** | 实心品牌紫（$color-primary）+ haptics medium | — |
| 已结束·已提交（submitted） | **静态「已评价」** | 灰色静态态，不可点（非 button 语义） | — |
| 已取消 / 已关闭 / 未成行 / 塌组 / 无资格 | **隐藏** | — | 直接访问 URL 由 §4 服务端拦截 |

**隐藏 vs 置灰的取舍（推荐依据）：**
- 「隐藏后突然出现」是正惊喜（新能力解锁，且由 recap 推送+站内通知主动告知）；「长期置灰」是死 UI。招募/排桌阶段可能持续数周，置灰按钮只会引发「是不是坏了」的疑问。
- 真正会反复访问详情页的用户处于「已成局→活动结束」区间，此时按钮以「置灰→点亮」的渐进变化精确教学规则——教学发生在最相关的时刻。
- 置灰态必须是「可点的置灰」（灰样式 + `aria-disabled` + 点击 toast），而不是 native `disabled`——WeChat 原生 disabled 按钮吞掉点击事件，无法教学也无法采集 `feedback_locked_tap` 信号。

**数据源**：详情页新增一次性请求 `GET /api/events/:eventId/feedback-state` → `{ state: 'locked' | 'open' | 'submitted' | 'ineligible' | 'closed' }`（`closed` 预留，本迭代恒不出现）。pool/blind-box/legacy 三族 id 均由该端点内部 canonicalize。不向 `EventPoolSummary`/`BlindBoxEventDetail` 加热字段，避免污染 Discover 高热 payload。

**反馈页自身门槛**：`pages/event-feedback/index.tsx` 加载时同样调 feedback-state——`locked` 渲染 StatusCard「活动还没结束」，`submitted` 渲染「已评价」致谢态。防直接 URL 访问/收藏夹穿越。

## §4 服务端门槛与错误码

`POST /api/events/:eventId/feedback` 在现有内容安全校验**之前**插入三道闸（顺序：资格 → 开启 → 重复）：

| 场景 | HTTP | code | 用户文案（进 ERROR_MESSAGE_MAP） |
|---|---|---|---|
| 活动未结束（locked） | 403 | `FEEDBACK_NOT_OPEN` | 「活动还没结束，结束后再来聊聊感受吧」 |
| 无资格（未报名/已退订/未成行/塌组/已取消） | 403 | `FEEDBACK_NOT_ELIGIBLE` | 「这场活动未成行，无法评价」 |
| 重复提交 | 409 | `FEEDBACK_ALREADY_SUBMITTED` | 「你已经评价过这场活动啦」 |

**硬性契约**（2026-09-10 规则）：
1. 三个 code 加入 `packages/shared/src/copy/errorBaselines.ts` 的 `ErrorCode` union + `ERROR_TEMPLATES`（surface: toast-error）；
2. 契约测试覆盖：扩展 `apps/server/src/__tests__/registrationErrorCodes.test.ts` 的扫描范围至 `social.ts` 反馈路由，或新建同模式 `feedbackErrorCodes.test.ts`；
3. 客户端 `resolveMessage()`（`useOptimisticRegistration.ts:48`）已有 code→模板映射 + 中文 message 兜底，无需改动。

**资格判定细节**：
- pool：按 canonical 映射反查——该用户在该 pool 有 matchStatus ∈ {matched, completed} 的报名（即真正排进了桌）。
- blind-box/legacy：`event_attendance` 行存在且 `status != 'cancelled'`。
- no-show（attendanceStatus='absent'）：**本次允许提交**。理由：pool 侧无可靠 no-show 标记（gathering-room 确认覆盖不全），一刀切会把大量真实到场但未点确认的用户锁在门外；且 no-show 惩罚已被永久否决（2026-08-27）。出席门槛列为 follow-up。
- 幂等：重复提交在应用层拦截（409）。DB 层 (user_id, event_id) 唯一索引列为 follow-up——需先对生产存量做去重审计，本次不动 schema。
- 内容安全校验、XP 发放、connections upsert、mutual-match 通知等既有逻辑全部保持原序原样。

## §5 微信订阅消息改造

### §5.0 P0 前置修复：recap 推送当前零送达

**证据链**：
- `subscribeReminderScheduler.ts:124` `findMatchedMembers` 只查 `matchStatus = 'matched'`；
- `poolCompletionSweep.ts`（2026-10-06 上线）在活动开始 +3h 把 matched 报名批量翻成 `completed`；
- recap 窗口 = 活动开始 20–30h 后 → 此刻所有报名已是 `completed` → 成员查询恒空 → `members.length === 0 → continue`。
- **结论：自 2026-10-06 起，pool 活动的 T+1 recap 推送无一送达**（event_day 提醒在 +3h 前发送，不受影响）。

修复（本迭代 P0，随 §5.1 同 PR）：
1. `findMatchedMembers` 改为 `inArray(matchStatus, ['matched', 'completed'])`；
2. 池查询补 `isTestPool = false` 排除（当前缺失，修复成员查询后 tester 会收到测试池 recap）；
3. 补单元测试：覆盖「completed 报名在 recap 窗口被选中」+「test pool 全程静默」。

### 5.1 落地页修复（核心诉求）

`wechatSubscribeMessage.ts:43` 的 `LANDING_PAGE = "pages/events/index"` 被三个模板共享——recap 推送把用户落到**没有反馈入口**的足迹 tab，召唤无路可走。

改造：`TEMPLATES` 每模板增加可选 `buildPage(ctx)`，默认返回 `LANDING_PAGE`；recap 返回：
```
pages/event-feedback/index?id=<poolId>&from=recap_push
```
（WeChat subscribe message `page` 字段支持 query string；反馈页与 POST 路由均已 canonicalize pool id。）

result/reminder 模板落地页本次**不动**（match_success 直达 matching-status 是合理 follow-up，另立项）。

### 5.2 Recap hint 文案（thing3，≤20 字）

- **推荐**：「来聊聊感受，帮下次排桌更合拍」（14 字）
- 备选：「活动已结束，等你一句感受」（12 字）
- 约束复述：服务通知口吻、零营销钩子、**不得提及积分/奖励**（微信禁止订阅消息含激励诱导，奖励话术只出现在反馈页内）；禁用 匹配/社交/灵魂/撮合/AI 词汇，用 排桌/合拍 词族。
- 替换现有「回顾已生成，来说一句感受吧」——「回顾已生成」承诺了一个未必存在的产物，新文案与直达落地页语义一致。

### 5.3 无授权用户兜底（本次纳入范围）

微信订阅消息是一次性授权（一次 grant = 一次发送），拒绝/未授权用户（43101 静默跳过）目前**没有任何召回**。本迭代补齐两层：

1. **足迹「去评价」角标（持久入口，P1）**：`JoinedEventSummary` 新增可选字段 `feedbackPending: boolean`，由 `getUserJoinedEventsSummary` 服务端推导（terminal 状态 + 时间已过 +3h + 未提交；需 1 次额外 round-trip：按 userId 查 `event_feedback` 得 canonical eventId 集合，再经 `eventPoolGroups` 映射回 pool id——**不要复用 connectionsContext 的错位路径**，见 §2.1）。`FootprintOracleCard` 在 terminal + feedbackPending 卡片右上渲染「去评价」pill，点击 `stopPropagation` 直达 `/pages/event-feedback/index?id=<poolId>&from=events_tab`。`JOINED_EVENTS_QUERY_KEY` 持久缓存为可选字段增量，**无需 bump** `CACHE_SCHEMA_VERSION`。
2. **站内通知（主动召回，P1）**：recap 调度器在同一 tick 内对全部合格成员（不论 push 授权与否）创建 `category='activities', type='feedback_invite'` 通知，`relatedResourceId = poolId`，复用 `notificationsRepo.createNotification` + 既有 tab 红点/已读链路。幂等：插入前按 (userId, type, relatedResourceId) select-then-insert（沿用 `social.ts` mutual_match 通知的既有模式；调度器单线程 tick，可接受）。文案：title「昨晚的活动怎么样？」，message「来说一句感受，帮下次排桌更合拍」。有 push 授权的用户会双通道触达（系统 push + 站内红点）——push 易被错过、站内持久，二者互补，判为可接受。

**明确不做**：不按「是否有 push 授权」区分站内通知策略（无授权状态服务端不可知，43101 只在发送时回执）；不为 recap 站内通知新建 ledger 表。

## §6 边界情况

| 场景 | 行为 |
|---|---|
| 活动取消（自动退款路径） | 按钮隐藏；无 recap push（调度器已排除 cancelled 池）；无站内通知；直接访问 URL → `FEEDBACK_NOT_ELIGIBLE` |
| 用户活动前退订 | 报名行删除/取消 → 无资格，全部入口隐藏 |
| 塌组（post-reveal collapse，安心补位 Phase 0） | 留场用户走 `REFUND_CONTEXTS.collapsed` 退款 → 活动未发生 → 无资格，不召回 |
| no-show（matched 但未到场） | **允许**评价（本次）； attendance-gating 列 follow-up |
| 单场测试池（is_test_pool） | 反馈按时间规则正常开启（tester 可走通）；recap push + 站内通知**排除**；bot 无 openid 天然静默 |
| pool status sweep 延迟 | 不影响——反馈走时间规则，不依赖 status |
| 用户重复提交（双击/重进） | 409 `FEEDBACK_ALREADY_SUBMITTED`；客户端提交后本地置「已评价」态 |
| 盲盒/legacy 活动 status 不流转 | 时间规则兜底，不依赖运营手工翻转 |
| 时区 | 服务端统一 `lib/eventDateTime.ts`；客户端零时间运算 |
| 重复 XP 领取（现状漏洞） | 本次由 409 闸关闭；(user_id, event_id) DB 唯一索引列 follow-up（需存量去重审计） |

## §7 分析事件

新增客户端事件（须同步服务端 `analytics.ts` 白名单）：

| 事件 | 触发 | 关键 metadata |
|---|---|---|
| `feedback_entry_shown` | event-detail 挂载且 feedback-state 返回（每页一次） | `state`（locked/open/submitted）、`eventId` |
| `feedback_locked_tap` | 置灰按钮点击（toast 教学） | `eventId` |
| `feedback_reminder_tap` | 足迹「去评价」pill 点击 | `eventId`、`from='events_tab'` |
| `feedback_page_open` | 反馈页挂载 | `source`（event_detail / events_tab / recap_push / notification）、`eventId` |

已有可复用：`feedback_invite_seen` / `feedback_deep_engaged` / `feedback_deep_submitted`（已在白名单）、`subscribe_grant_result`（授权计量）、`subscribe_message_sends` ledger（发送计量）。

**转化口径（无需新基建）**：recap→提交转化 = recap 发送成功（ledger moment='recap'）后 24h 内产生 event_feedback 行的比例；`from=recap_push` 提供直接归因补充。

**成功指标**（上线后 4 周窗口）：
- recap 推送送达恢复：ledger 中 moment='recap' 成功发送 > 0（当前基线 = 0，P0 bug）。
- recap push → 反馈页打开 ≥ 25%（订阅消息点击率行业常态 15–30%）。
- 合格用户 72h 内反馈提交率 ≥ 40%（基线：当前无召回、入口被动，预计 <15%，上线前先跑一遍存量数取真实基线）。
- `feedback_locked_tap / feedback_entry_shown(locked)` 逐周下降；若 2 周后仍 >30%，回炉改提示文案。
- 重复提交 409 计数（数据完整性哨兵，预期个位数/周）。

## §8 验收标准 + 明确不做的事

### 验收标准

- AC-1（开启规则）：pool/blind-box/legacy 三族活动，`dateTime+3h` 前 `feedback-state` 返回 `locked`、之后返回 `open`；cancelled/archived 恒 `ineligible`；test pool 同样按时间开启。单元测试覆盖时间边界（±1min）与全部取消态。
- AC-2（按钮状态机）：§3 表格七态逐态可复现；置灰态点击出 toast 且发 `feedback_locked_tap`；已提交态不可点。
- AC-3（服务端闸）：三个新 code 全部进 `ERROR_MESSAGE_MAP` + 契约测试绿；未开启/无资格/重复提交分别返回 403/403/409 且文案不落 generic fallback。
- AC-4（P0 修复）：构造 matchStatus='completed' 的报名 + 20–30h 前 dateTime 的池，调度器 tick 后 ledger 出现 recap claim；test pool 全程无 claim。
- AC-5（落地页）：recap push 的 `page` = `pages/event-feedback/index?id=<poolId>&from=recap_push`；result/reminder 模板 `page` 不变。
- AC-6（兜底）：无授权用户在 recap 时刻收到站内通知（activities 红点 +1）；足迹已完成 tab 对 terminal+未提交活动渲染「去评价」pill，点击直达反馈页；提交后 pill 消失。
- AC-7（反馈页门槛）：`locked` 态直达反馈页 → StatusCard「活动还没结束」；`submitted` 态 → 致谢态。
- AC-8（文案合规）：push hint ≤20 字、零激励话术、零违禁词（匹配/社交/灵魂/撮合/AI）；`npm run verify:subscribe-templates` 不需变更模板字段（仅改 value）。
- AC-9（回归）：内容安全校验、XP 发放、connections upsert、mutual-match 通知、event_day 推送行为不变；`npm run test -w @joyjoin/server` 全绿。

### 明确不做（Out of Scope）

- ❌ 反馈窗口关闭 / 限时积分激励（待转化数据再议）
- ❌ no-show 用户的评价资格限制
- ❌ `event_feedback` (user_id, event_id) DB 唯一索引（需存量审计，follow-up）
- ❌ result/reminder 模板落地页优化（match_success 直达 matching-status，另立项）
- ❌ 反馈表单本身的内容/结构改动、深度反馈交互改版
- ❌ 候补补位（安心补位 Phase 1）、管理员代填/催填工具
- ❌ connectionsContextResolver 既有 id 错位修复（本次新推导绕开它；旧路径修复另立项）
- ❌ Web 端任何改动（user-client 已归档）

## §9 涉及文件清单（交给实现 agent）

**Shared**
- `packages/shared/src/api/user.ts` — `JoinedEventSummary.feedbackPending?`；新增 `EventFeedbackState` 类型 + `getEventFeedbackState(api, eventId)` transport
- `packages/shared/src/copy/errorBaselines.ts` — 3 个新 ErrorCode + 模板

**Server**
- `apps/server/src/lib/feedbackStateResolver.ts`（新）— canonical 开启规则 + 资格 + 已提交判定，三族 id canonicalize（复用 `resolveCanonicalEventId` / `eventFeedbackRepo.resolveCanonicalFeedbackEventId`），时区走 `lib/eventDateTime.ts`
- `apps/server/src/routes/domains/social.ts` — POST 三道闸（资格→开启→重复，置于内容安全校验前）；新增 `GET /api/events/:eventId/feedback-state`
- `apps/server/src/repositories/joinedEventsRepo.ts` — `feedbackPending` 推导（feedback canonical id 集合 ←→ pool group 映射；1 次额外 round-trip）
- `apps/server/src/lib/subscribeReminderScheduler.ts` — **P0**：`findMatchedMembers` 改 `inArray(matchStatus, ['matched','completed'])`；池查询补 `isTestPool=false`；recap tick 内 fan-out 站内通知（select-then-insert 幂等）；hint 文案替换
- `apps/server/src/lib/wechatSubscribeMessage.ts` — `TEMPLATES` 增 `buildPage` per-template override，recap 直达反馈页
- `apps/server/src/routes/domains/analytics.ts` — 4 个新客户端事件进白名单
- 测试：`apps/server/src/__tests__/feedbackErrorCodes.test.ts`（新，或扩 registrationErrorCodes 扫描范围）；`feedbackStateResolver` 单测；`subscribeReminderScheduler` 成员查询/测试池排除单测

**Mini-program**
- `apps/mini-program/src/pages/event-detail/index.tsx`（+ `index.scss`）— 按钮状态机（接 feedback-state）、置灰可点 toast、「去评价」主 CTA、`feedback_entry_shown`/`feedback_locked_tap`
- `apps/mini-program/src/pages/event-feedback/index.tsx` — 入口门槛（locked → StatusCard；submitted → 致谢态）、`feedback_page_open{source}`
- `apps/mini-program/src/components/events/FootprintOracleCard.tsx`（+ scss）— terminal+feedbackPending 卡片「去评价」pill（stopPropagation 直达，`from=events_tab`）
- `apps/mini-program/src/lib/analytics/eventsAnalytics.ts` — 新事件 track 方法
- 注意既有纪律：提交成功后 `bustRegistrationCaches` 同款 bust joined-events/shell 缓存（否则足迹 pill 滞留 30s+）

