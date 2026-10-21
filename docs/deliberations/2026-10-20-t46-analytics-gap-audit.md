# T46 转化埋点 Gap 审计（S1.1 / AC-01）

> 2026-10-20 · 纯审计产出，不改任何业务文件，不 commit 不 push。
> 输入：`2026-10-20-t46-implementation-plan.md` §4 S1（7 目标事件定义）。
> 结论先行：7 目标中 **3 个纯 SQL 派生**（`checkout_cancel_rate` / `first_order_30d_renewal` / `duo_invite_to_register_conv`），**1 个 SQL 派生但语义待澄清**（北极星 `detail_to_checkout_conv`），**3 个需新增 raw 事件**（`guest_view_to_assessment_rate` / `guest_to_login_conv` / `duo_entry_ctr`，合计 **6 个新事件**）。

---

## 1. 既有事件清单

埋点链路三段（均为事实核查结论）：

- **client union**：`apps/mini-program/src/lib/analytics/discoverAnalytics.ts:5-127`（`DiscoverAnalyticsEventType`，约 100+ 成员；另有 `landingAnalytics.ts` / `eventsAnalytics.ts` / `feedbackAnalytics.ts` / `authAnalytics.ts` / `squadUnboxingAnalytics.ts` / `socialIcebreakerAnalytics.ts` / `flowAnalytics.ts` / `gatheringRoomAnalytics.ts` / `profileAnalytics.ts` 等独立 union）。
- **server 白名单**：`apps/server/src/routes/domains/analytics.ts:119-303`（`DISCOVER_EVENT_TYPES`）——所有 `POST /api/analytics/discover` 事件都落在 `discover_analytics_events` 表（`userId` / `sessionId` / `eventType` / `poolId` / `metadata` / `timestamp`）。
- **契约测试**：`apps/server/src/__tests__/discoverAnalyticsAllowlistContract.test.ts` 用源码扫描断言 client union ⊆ server 白名单（新事件只加一端即红）。

### 1.1 与 7 目标直接相关的事件（发射点 file:line + metadata 形状）

| 事件 | 发射点 | metadata | 语义 |
|---|---|---|---|
| `pool_card_tap` | `components/discover/OracleCard.tsx:144` | `{cardVersion, accentFamily, highChemistryShare, hasEventTypeVignette, hasCornerCount, cornerCount}` | Discover 卡片 tap → 进入订座页 |
| `registration_start` | `pages/pool-registration/index.tsx:459` | 无（poolId 走 envelope） | **订座/详情页 mount 一次性 view**（ref 去重） |
| `registration_abandoned` | `pages/pool-registration/index.tsx:465` | 无 | 订座页未注册即离开 |
| `registration_complete` | `pages/pool-registration/index.tsx:865` + `hooks/useOptimisticRegistration.ts:256` | 无 | 注册完成 |
| `pool_teaser_impression` | `pages/pool-registration/index.tsx:410` | `{variant:'in-letter'}` | 订座页 teaser 曝光 |
| `event_ticket_payment_view` | `pages/payments/event-ticket-payment/index.tsx:337` | `{poolId, defaultPlan, hasWelcomeCoupon, hasAnyCoupon, deviceTier}` | **收银台页 view（一次性）** |
| `event_ticket_payment_abandon` | `pages/payments/event-ticket-payment/index.tsx:917` | `{poolId}` | 收银台放弃 |
| `event_ticket_payment_success_view` | `pages/payments/event-ticket-payment/index.tsx:390` | `{poolId}` | 支付成功页 view |
| `pay_start` | `pages/payments/event-ticket-payment/index.tsx:681` | `{poolId}` | 拉起支付 |
| `pay_success` | `pages/payments/event-ticket-payment/index.tsx:488,550` | `{poolId}` | 支付成功（两处：单场/订阅分支） |
| `pay_cancel` | `pages/payments/event-ticket-payment/index.tsx:697` | `{poolId}` | **支付取消（checkout cancel 分子）** |
| `pay_cancel_retention_shown/_tap/_dismiss` | `event-ticket-payment/index.tsx:118,1474,1486` | `{poolId}` | 取消挽留三态 |
| `plan_selector_impression` | `event-ticket-payment/index.tsx:364` | `{poolId, plansShown, defaultPlan, singlePrice, pack3Price, pack6Price}` | 套餐选择曝光 |
| `ticket_terms_row_impression` | `event-ticket-payment/index.tsx:378` | `{poolId}` | 条款行曝光 |
| `refund_policy_viewed` | `event-ticket-payment/index.tsx:1375` | `{poolId, context}` | 退款政策查看 |
| `duo_status_update` | `hooks/useDuoRegistration.ts:204` | `{from, to}` | duo 状态机迁移 |
| `duo_card_impression` | `hooks/useDuoRegistration.ts:224` | 无 | duo 卡片曝光 |
| `duo_banner_impression` | `hooks/useDuoRegistration.ts:241` | 无 | duo banner 曝光 |
| `duo_share_trigger` | `hooks/useDuoRegistration.ts:257` | 无 | **触发 duo 分享**（注册流程内，非收银台入口） |
| `duo_segment_select` | `hooks/useDuoRegistration.ts:273` | `{mode}` | duo 分档选择 |
| `duo_success_view` | `pages/pool-registration/components/PoolRegistrationSuccessCeremony.tsx:61` | `{bound}` | duo 成行页 |
| `login_cta_tap` | `pages/onboarding/personality-test/results/hooks/useResultsLoginHandoff.ts:85` | `{surface}` | 结果页登录 CTA tap |
| `login_handoff_duration` | `useResultsLoginHandoff.ts:155,179` | `{durationMs, outcome}` | 登录 handoff 时长 |
| `landing_logged_out_login_tap` | `lib/analytics/landingAnalytics.ts:88` | `{auth_entry, dwell_ms}` | 落地页游客登录 tap |
| `discover_first_arrival` | `pages/discover/index.tsx:251` | `{fromOnboarding, source}` | 首到达（tombstone 去重） |

### 1.2 关键覆盖缺口（grep 证据）

- **无任何 `guest_*` 事件**（server 白名单 + client union 全量 grep 零命中）。
- **无任何「详情页 view」事件**：`pages/event-detail/index.tsx` 只发 `support_contact_tap`（:261）+ feedback 事件，无 `event_detail_view`；`pages/pool-registration` 用 `registration_start` 充当 view 信号。
- **无「登录成功」事件**：union 里有 `login_cta_tap`/`login_handoff_duration`/`landing_logged_out_login_tap`（都是 tap/duration），无 `login_success`/`guest_login_success`。
- **无「收银台 duo 入口」事件**：既有 duo 事件全部属于注册流程内的分享/绑定，S6 的收银台 `DuoEntryLink` 是全新表面。

---

## 2. 七目标事件逐一裁决

| # | 目标 | 裁决 | 依据（file:line） |
|---|---|---|---|
| 1 | `detail_to_checkout_conv`（北极星） | **SQL 派生**（语义待澄清） | 分母 `registration_start`（pool-registration:459，订座页 view）→ 分子 `event_ticket_payment_view`（event-ticket-payment:337）。见 §2.1 的语义 caveat。 |
| 2 | `guest_view_to_assessment_rate` | **需新增**（2 事件） | 无 `guest_*` 事件（§1.2）。 |
| 3 | `guest_to_login_conv` | **需新增**（2 事件） | 无登录成功事件；tap 侧可复用 `login_cta_tap` 但缺成功侧。 |
| 4 | `duo_entry_ctr` | **需新增**（2 事件） | S6 `DuoEntryLink` 是全新表面；既有 duo 事件不覆盖收银台入口。 |
| 5 | `duo_invite_to_register_conv` | **SQL 派生** | `invitations`（type='duo'）+ `invitation_uses` + `event_pool_registrations`，见 §2.5。 |
| 6 | `first_order_30d_renewal` | **SQL 派生** | `payments` 表（paymentType/status/paidAt/userId），见 §2.6。 |
| 7 | `checkout_cancel_rate` | **SQL 派生** | `pay_cancel`（event-ticket-payment:697）/ `pay_start`（:681）或 `/ event_ticket_payment_view`（:337），见 §2.7。 |

### 2.1 `detail_to_checkout_conv`（北极星）— SQL 派生，附语义 caveat

- **事实**：`handlePoolTap`（discover/index.tsx:654-657）直接 `navigateTo('/pages/pool-registration/index?id=...')`，Discover 与收银台之间**没有独立「详情页」**——订座页（pool-registration）即详情页（承载活动画像/合拍度/detail）。订座页 mount 发 `registration_start`（一次性），收银台 mount 发 `event_ticket_payment_view`。
- **派生口径**：`conv = COUNT(event_ticket_payment_view) / COUNT(registration_start)`，按 `poolId` join（跨表可再按时间窗对齐）。
- **caveat（需 S2/S3 澄清）**：`registration_start` 语义是「开始注册」而非纯「查看详情」——若产品要统计「仅浏览详情、未进入订座」的 bounce，则需要一个独立 `event_detail_view`（**非本次必需**，但若 P0c 流程条落在 `pages/event-detail`（S3.1 的 `@use` 目标）而该页今天无 view 事件，则应新增）。本审计判定：**北极星比值本身可由既有事件派生，不阻塞 S1.3 漏斗 SQL**。
- **命名注意**：计划 §1 北极星命名 `detail_to_checkout_conv`；但代码层「detail」=`registration_start`。若坚持口径纯「detail」，需新增 `event_detail_view`；否则沿用 `registration_start` 并在 SQL 注释写明等价关系。

### 2.2 `guest_view_to_assessment_rate` — 需新增（2 事件）

P1c 游客预告卡（S7.3 `GuestEventPreviewCard`，插入 `FinalStage.tsx:759`）。游客未登录，现有 `discoverAnalytics` 通道可发（无 requireAuth，见 §5）。需：
- 分母：`guest_preview_card_impression`（卡渲染，一次性 ref 去重）。
- 分子：`guest_preview_card_tap`（tap → 进入测评/登录）。

### 2.3 `guest_to_login_conv` — 需新增（2 事件）

- 分母：`guest_preview_login_tap`（卡上登录 CTA tap）。可选复用 `login_cta_tap`（surface='guest_preview_card'），但为携带相关性 ID 建议独立事件。
- 分子：`guest_preview_login_success`（登录成功，同一 `guestAttemptId`）。
- **关键**：因 `user_id`/`session_id` 在 analytics 表恒为 null（§5.2 路由源码证据），无法用 userId 过渡桥接「tap→success」，必须由 client 生成 `guestAttemptId`（Taro storage 临时存、tap 与 success 两次发射携带），SQL 按 `metadata->>'guestAttemptId'` join——沿用 icebreaker funnel 的 `socialSessionId` 相关性先例（`icebreaker-wave3-funnel-metrics.sql:43,97`）。

### 2.4 `duo_entry_ctr` — 需新增（2 事件）

S6.1 `DuoEntryLink`（收银台 trust row 下）。CTR = tap/impression，两段都要：
- 分母：`duo_entry_link_impression`（链接渲染，一次性）。
- 分子：`duo_entry_link_tap`（tap）。计划 S6.1 只写「`duo_entry_ctr` 发射」——**仅 tap 无法算 CTR**，需补 impression，否则该指标退化为 tap 计数。

### 2.5 `duo_invite_to_register_conv` — SQL 派生

- 分子：`invitation_uses`（`inviteeId` 已报名，`poolRegistrationId` 非空）按 `invitationId` 关联到 duo 邀请。
- 分母：`invitations` where `invitation_type='duo'`。
- 表：`invitations`（`_definitions.ts:1677`，duo 邀请 pool-scoped，`idx_invitations_pool_id` + `idx_invitations_duo_pool_inviter`）+ `invitation_uses`（`_definitions.ts:1724`，`invitationId`/`inviteeId`/`poolRegistrationId`/`matchedTogether`）。
- 无需新事件；`invitations.totalRegistrations`/`totalClicks` 是冗余计数器，SQL 直接 join 更可靠。

### 2.6 `first_order_30d_renewal` — SQL 派生

- 表：`payments`（`_definitions.ts:1430`，`userId`/`paymentType`/`status`/`paidAt`/`finalAmount`）。
- 口径：按 userId，`paymentType='event'` 且 `status='completed'` 的 paidAt 升序；首单后 30 天内出现第二单 completed = 续费。
- caveat：`event_bundle`（三连局包/六连局包）走 `event_credit_grants`/`event_credit_redemptions`（`_definitions.ts:1530/1546`），信用核销不算「新订单」——北极星口径应锁定「第二次 completed `paymentType='event'` 订单」，bundle 首购是否计为「首单」需 PM 拍板（本审计建议：仅 `paymentType='event'` 计为订单，bundle 单列）。

### 2.7 `checkout_cancel_rate` — SQL 派生

- 分子：`pay_cancel`（event-ticket-payment:697）。
- 分母：`pay_start`（:681）或 `event_ticket_payment_view`（:337）。建议分母用 `pay_start`（更贴近「进入支付即算 checkout attempt」）；用 `event_ticket_payment_view` 会把「只看不收」也算入分母，两者口径不同，SQL 草案两者都给出。

---

## 3. 新增事件规格（6 个，全部 enum-only 零 PII）

统一走 `POST /api/analytics/discover`（`discoverAnalyticsEvents` 表），metadata 只含 enum/计数/相关性 ID，不传 user text / 手机号 / WeChat code / 坐标 / 设备标识。**三处必须同步注册**，否则契约测试（`discoverAnalyticsAllowlistContract.test.ts`）红：

1. client union：`apps/mini-program/src/lib/analytics/discoverAnalytics.ts`（`DiscoverAnalyticsEventType` 增补）。
2. server 白名单：`apps/server/src/routes/domains/analytics.ts` `DISCOVER_EVENT_TYPES`（~L119-303）。
3. （funnel SQL：`apps/server/scripts/t46-conversion-funnel-metrics.sql`，S1.3 产出）。

| 新事件 | 发射点（建议 file:line） | metadata（enum-only） | 归属目标 |
|---|---|---|---|
| `guest_preview_card_impression` | `components/onboarding/GuestEventPreviewCard.tsx` mount（一次性 ref） | `{ variant, supplyCount }` | guest_view_to_assessment_rate 分母 |
| `guest_preview_card_tap` | `GuestEventPreviewCard.tsx` 卡片 tap handler | `{ destination: 'assessment'\|'login'\|'event' }` | guest_view_to_assessment_rate 分子 |
| `guest_preview_login_tap` | `GuestEventPreviewCard.tsx` 登录 CTA tap | `{ surface:'guest_preview_card', guestAttemptId }` | guest_to_login_conv 分母 |
| `guest_preview_login_success` | 登录成功回调（`useResultsLoginHandoff` 同级，S7.4 接线） | `{ guestAttemptId }` | guest_to_login_conv 分子 |
| `duo_entry_link_impression` | `components/event-ticket-payment/DuoEntryLink.tsx` 渲染（一次性 ref） | `{ poolId }` | duo_entry_ctr 分母 |
| `duo_entry_link_tap` | `DuoEntryLink.tsx` tap handler | `{ poolId }` | duo_entry_ctr 分子 |

- **相关性 ID 纪律**（guest 两事件）：`guestAttemptId` 由 client 生成（`Taro.setStorageSync` 临时），tap 前写入、success 后读取回填并清除；SQL 按 `metadata->>'guestAttemptId'` join。这是 `user_id` 恒 null 约束下唯一可靠的桥接（§5.2）。
- **零 PII**：所有 metadata 值来自枚举集合，禁止传标题/区名原文/真实座位数之外的自由文本。

---

## 4. funnel SQL 草案大纲（S1.3 产出文件骨架）

文件：`apps/server/scripts/t46-conversion-funnel-metrics.sql`。全部 `SELECT` over `discover_analytics_events` + `payments` + `invitations`/`invitation_uses`，只读，无新表无路由，`psql "$DATABASE_URL" -f ...` 直跑（对齐 `icebreaker-wave3-funnel-metrics.sql` 先例）。口径 caveat：与 icebreaker 先例一致，funnel 是 **client-side per acting client**，同一 poolId/session 跨设备重装可能重发，比率按 row 计数 + 附 distinct 口径。

### 4.1 北极星 `detail_to_checkout_conv`

```sql
SELECT
  (SELECT COUNT(*) FROM discover_analytics_events
    WHERE event_type='event_ticket_payment_view' AND "timestamp" >= now()-interval '30 days') AS checkout_views,
  (SELECT COUNT(*) FROM discover_analytics_events
    WHERE event_type='registration_start'      AND "timestamp" >= now()-interval '30 days') AS detail_views,
  ROUND(100.0 * checkout_views / NULLIF(detail_views,0), 1) AS conv_pct;
-- 按 poolId 粒度 join：
-- SELECT e.pool_id, COUNT(DISTINCT pv.metadata->>'poolId') ...
```

### 4.2 护栏 `checkout_cancel_rate`

```sql
SELECT
  (SELECT COUNT(*) FROM discover_analytics_events WHERE event_type='pay_cancel' AND "timestamp" >= now()-interval '7 days') AS cancels,
  (SELECT COUNT(*) FROM discover_analytics_events WHERE event_type='pay_start'  AND "timestamp" >= now()-interval '7 days') AS pay_starts,
  (SELECT COUNT(*) FROM discover_analytics_events WHERE event_type='event_ticket_payment_view' AND "timestamp" >= now()-interval '7 days') AS checkout_views,
  ROUND(100.0 * cancels / NULLIF(pay_starts,0), 1)     AS cancel_rate_vs_pay_start,
  ROUND(100.0 * cancels / NULLIF(checkout_views,0), 1) AS cancel_rate_vs_view;
```

### 4.3 续费率 `first_order_30d_renewal`

```sql
WITH orders AS (
  SELECT user_id, paid_at,
         ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY paid_at) AS ord
  FROM payments
  WHERE payment_type='event' AND status='completed' AND paid_at IS NOT NULL
)
SELECT
  COUNT(*) FILTER (WHERE ord=1)                              AS first_orders,
  COUNT(*) FILTER (WHERE ord=2
    AND paid_at <= (SELECT min(paid_at) FROM orders o2 WHERE o2.user_id=orders.user_id) + interval '30 days')
                                                             AS renewed_within_30d,
  ROUND(100.0 * renewed_within_30d / NULLIF(first_orders,0),1) AS renewal_pct;
```

（caveat：`payments` 无 `paymentType` 索引查询路径需核对；`event_bundle` 排除在订单定义外，见 §2.6。）

### 4.4 guest 两段（P1c）

```sql
-- guest_view_to_assessment_rate
SELECT
  (SELECT COUNT(*) FROM discover_analytics_events WHERE event_type='guest_preview_card_impression' AND "timestamp" >= now()-interval '30 days') AS impressions,
  (SELECT COUNT(*) FROM discover_analytics_events WHERE event_type='guest_preview_card_tap'        AND "timestamp" >= now()-interval '30 days') AS taps,
  ROUND(100.0 * taps / NULLIF(impressions,0), 1) AS view_to_assessment_pct;

-- guest_to_login_conv（按 guestAttemptId join，user_id 恒 null 无法桥接）
SELECT
  (SELECT COUNT(DISTINCT metadata->>'guestAttemptId') FROM discover_analytics_events WHERE event_type='guest_preview_login_tap'    AND "timestamp" >= now()-interval '30 days') AS login_taps,
  (SELECT COUNT(DISTINCT metadata->>'guestAttemptId') FROM discover_analytics_events WHERE event_type='guest_preview_login_success' AND "timestamp" >= now()-interval '30 days') AS login_success,
  ROUND(100.0 * login_success / NULLIF(login_taps,0), 1) AS guest_login_conv_pct;
```

### 4.5 duo 两段

```sql
-- duo_entry_ctr
SELECT
  (SELECT COUNT(*) FROM discover_analytics_events WHERE event_type='duo_entry_link_impression' AND "timestamp" >= now()-interval '30 days') AS impressions,
  (SELECT COUNT(*) FROM discover_analytics_events WHERE event_type='duo_entry_link_tap'        AND "timestamp" >= now()-interval '30 days') AS taps,
  ROUND(100.0 * taps / NULLIF(impressions,0), 1) AS duo_entry_ctr_pct;

-- duo_invite_to_register_conv（纯 DB，无事件）
SELECT
  (SELECT COUNT(*) FROM invitations i WHERE i.invitation_type='duo')                    AS duo_invites,
  (SELECT COUNT(*) FROM invitation_uses u
     JOIN invitations i ON i.id=u.invitation_id
    WHERE i.invitation_type='duo' AND u.pool_registration_id IS NOT NULL)               AS registered_invitees,
  ROUND(100.0 * registered_invitees / NULLIF(duo_invites,0), 1)                         AS duo_invite_conv_pct;
```

---

## 5. 明确风险

### 5.1 游客事件 auth 边界 — 已确认「真无 requireAuth」

`POST /api/analytics/discover` 路由签名（`analytics.ts:729`）：

```ts
app.post("/api/analytics/discover", discoverAnalyticsLimiter, async (req: Request, res) => { ... })
```

- 中间件只有 `discoverAnalyticsLimiter`（120 req/min 限流，`analytics.ts:30-34`），**无 `requireAuth`/`requireAdmin`**（全文件 grep `requireAuth` 零命中）。
- handler 内 `const userId = req.session?.userId ?? null`（`analytics.ts:750`）+ `sessionId = req.sessionID ?? null`（:751）——**显式处理匿名态**，游客事件可发，落库 `userId=null`。
- client 侧 `apiRequest({ ..., handleUnauthorized: false })`（`discoverAnalytics.ts:250`）不触发 401 拦截。
- **结论**：游客 `guest_*` 事件发射边界无阻塞。风险点不在此，而在下一项。

### 5.2 ⚠️ 高风险：analytics 表 `user_id`/`session_id` 恒为 null（session 中间件顺序）

`registerAnalyticsRoutes(app)` 在 `routes.ts:102` 注册，**早于** `app.use(session(...))`（`routes.ts:140`）。Express 按注册顺序匹配——analytics 路由 handler 先于 express-session 执行，`req.session` 在 handler 内恒为 `undefined`：

- `req.session?.userId ?? null` → **恒 null**
- `req.sessionID ?? null` → **恒 null**

**后果（既有数据质量问题，非本任务引入）**：
1. `discover_analytics_events.user_id` / `session_id` 全表恒空 → **任何依赖 userId 的 analytics 归因都不可用**。
2. 现有 funnel SQL 早已绕开此列——`icebreaker-wave3-funnel-metrics.sql` 全程用 `metadata->>'socialSessionId'`（client 生成）而非 `user_id`。**T46 新 funnel 必须沿用同一模式**：跨事件相关性走 `metadata` 里的 client 生成 ID（guest 用 `guestAttemptId`；checkout/detail 按 `poolId` 关联）。
3. **对 7 目标的影响矩阵**：
   - 纯 DB 派生（`first_order_30d_renewal` / `duo_invite_to_register_conv`）——**不受影响**（用 `payments.userId` / `invitation_uses.inviteeId`，不经过 analytics）。
   - 计数型比率（`checkout_cancel_rate` / `detail_to_checkout_conv` / `duo_entry_ctr`）——**不受影响**（分子分母都是 event 计数，无需 userId）。
   - guest 两段——**受影响**：无法用 userId 桥接 tap→success，必须走 `guestAttemptId` 相关性 ID（§3/§4.4）。

### 5.3 其他风险

- **S6.1 计划只写「`duo_entry_ctr` 发射」**：若只埋 tap 不埋 impression，`duo_entry_ctr` 无法算成「率」，退化为 tap 计数。建议 S1.2 同时补 `duo_entry_link_impression`。
- **北极星命名 vs 代码语义**（§2.1）：`detail_to_checkout_conv` 的「detail」在代码层是 `registration_start`（订座页），非独立详情页；若产品坚持独立「详情页 view」口径，需新增 `event_detail_view`（本审计判定非必需，但需 PM/S3 拍板口径）。
- **`first_order_30d_renewal` 的 bundle 歧义**（§2.6）：`event_bundle` 首购是否计为「首单」未定，北极星口径需 PM 锁死，避免续费率被 bundle 首购污染。

---

## 6. 交付物小结

- 需新增 raw 事件：**6 个**（`guest_preview_card_impression` / `guest_preview_card_tap` / `guest_preview_login_tap` / `guest_preview_login_success` / `duo_entry_link_impression` / `duo_entry_link_tap`）。
- 纯 SQL 派生（零新埋点）：`checkout_cancel_rate` / `first_order_30d_renewal` / `duo_invite_to_register_conv`。
- SQL 派生但口径待拍板：`detail_to_checkout_conv`（分母 `registration_start` vs 新 `event_detail_view`）。
- 契约测试扩展点（S1.3）：`DISCOVER_EVENT_TYPES`（`analytics.ts:119`）+ client union（`discoverAnalytics.ts:5`）+ `discoverAnalyticsAllowlistContract.test.ts` 自动锁 parity。
