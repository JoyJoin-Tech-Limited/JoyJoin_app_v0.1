# 场地专属优惠 · 实现方案（数据模型 + 后台录入 + 前端切片顺序）

> 2026-11-13 · 仅方案，未改动产品代码。
> 设计依据：`index.html`（v2 主体，设计 APPROVE）、`redeem-ceremony.html`（同桌凭证 v2.3，设计 APPROVE）。
> 用户约束：**只有两种权益形态（统一折扣 / 定制套餐）、一条规则（仅限本场活动 · 本桌使用）、先出方案再动手**。
> Harness 分级：**Tier 2**（schema 变更 + 新公开 DTO + 多工作区 + 有状态承诺）。动手前先写 Sprint Contract 并过 Verifier。

---

## 0. 一句话方案

**先让「一桌人有一张能出示的凭证」跑通（场地确定之后），再让「报名时承诺有优惠」上线（有池级保底之后）。** 顺序不能反：先承诺后托底，就是把失实风险卖给用户。

两个触点，两个开关，互不强绑：

| 触点 | 内容 | 开关（DB-backed，`apps/server/src/lib/featureFlags.ts`） | 默认 |
|---|---|---|---|
| 触点 2 · 成局后兑现 | 小组详情优惠卡 + 同桌凭证出示页 | `venueDealsEnabled` | false |
| 触点 1 · 报名期承诺 | 费用包含第 5 格 + teaser + 费用边界行 | `venueDealPromiseEnabled` | false，且依赖池级保底（§1.3） |

---

## 1. 数据模型

Schema 唯一来源：`packages/shared/src/schema/_definitions.ts`（`venue_deals` 现定义在 ~1384 行）。
迁移纪律：`npm run db:generate -- --custom` → `npm run db:rebuild-journal` → **先对 `joyjoin_staging` 手动执行 `.sql`，再推部署**（`validateDbSchema()` 启动 fail-fast，未迁移即 502 崩溃循环）。

### 1.1 `venue_deals`：加一种类型、两个价格字段，其余一律不加

| 变更 | 取值 / 约束 | 说明 |
|---|---|---|
| `discountType` 增加枚举值 | `'set_menu'`（现有 `percentage` / `fixed` / `gift` 保留在枚举里，后台不再提供 `fixed` / `gift` 入口） | 定制套餐。旧数据不动，读取端只认 `percentage` 与 `set_menu` |
| `setMenuPriceCents` INTEGER NULL | > 0 | 套餐一口价，分 |
| `setMenuOriginalPriceCents` INTEGER NULL | > `setMenuPriceCents` | 划线原价，分；用于「划算」的唯一证据，不允许不填 |
| `description` | 必填，≤20 字 | 折扣 = 一句权益名；套餐 = 内容一句（如「6 菜 1 汤 + 特调饮品」） |
| `redemptionMethod` | 只允许 `show_page` / `code`；`set_menu` 强制 `show_page` | `qr_code` 保留枚举、后台隐藏：没有码图字段与核销端，不上线 |
| `redemptionCode` | `code` 时必填，2–8 字 | 出示页第一焦点，不能缺省伪造 |

**用户侧永远不再出现的字段**（列保留、后台隐藏、客户端不读）：`minSpend` / `maxDiscount` / `perPersonLimit` / `validFrom` / `validUntil` / `excludedDates` / `terms`。有效性由「是否被池绑定 + `isActive`」决定，活动结束自然失效，不需要日期语义。
`usageCount` 与 `POST /api/venue-deals/:id/use` **客户端不调用**：本期没有门店核销动作，不能把「复制暗号」记成「已使用」。该端点保留给后台统计，不删除（硬禁区：不删已有数据通路）。

### 1.2 小组读取模型：把 deal 嵌进小组详情，不多一次往返

- `event_pool_groups` 已有 `venueId` / `venueName` / `venueAddress` / `venueAssignmentStatus`，无需新列。
- `packages/shared/src/api/eventPools.ts` 小组 DTO 目前只暴露 `venueName`（143 / 194 行附近）→ 增加：
  ```ts
  venueDeal: {
    id: string
    kind: 'discount' | 'set_menu'
    valueOffPercent?: number        // 20 = 8 折，客户端换算显示
    setMenuPriceCents?: number
    setMenuOriginalPriceCents?: number
    title: string                   // ≤20 字
    method: 'show_page' | 'code'
    code?: string                   // 仅 method=code
    venueName: string
  } | null
  ```
- 服务端在小组详情查询里 LEFT JOIN 出 `venue_deals` 单条有效记录（**一场最多一张**，多条时取运营绑定的保底那张，见 §1.3），`venueAssignmentStatus='assigned'` 且 `isActive` 才返回，否则 `null`。
- 出示页复用同一份 DTO，**不新建公开 deal 接口**：`GET /api/venues/:venueId/deals` 是公开列表，不应成为出示页数据源（会泄露其它门店优惠、且无桌成员校验）。小组成员身份由现有小组详情路由的鉴权承担。

### 1.3 池级保底：触点 1 的唯一托底方式（推荐方案 B）

问题：报名时场地未分配，任何「这家店的优惠」都无法提前承诺。评审已明确 `hasVenueDealPotential`（候选场地里可能有优惠）**不足以支撑确定性文案**。

| 方案 | 做法 | 判断 |
|---|---|---|
| A · 平台兜底补贴 | 池级权益由平台出资，与门店无关 | ❌ 涉及支付/补贴资金流，先不走 |
| **B · 池预绑定场地 + 权益（推荐）** | `event_pools` 增加 `guaranteedVenueId` + `guaranteedDealId` 两个可空 FK；该池的场地分配变为硬约束，运营在建池时就锁定 | ✅ 试点池本来就是运营手工策划，成本最低、承诺最真 |
| C · 全候选场地覆盖校验 | 只有候选场地全部有有效优惠才展示第 5 格 | ⏳ 作为 B 稳定后的自动化，先不做 |

方案 B 配套规则：
1. 建池/编辑池时选择保底场地与保底权益，服务端校验二者同店、权益 `isActive`、场地同城且 `isActive`。
2. `venueAssignmentService` 命中保底池时直接分配保底场地；**时段容量不足或门店停用 → 不成局，走既有「未成行全退」**，不允许改派到无权益场地还继续展示承诺。
3. 权益被撤销 / 停用：池立即失去展示资格（触点 1 服务端实时判断，不做缓存快照），已报名用户按 §5 风险口径处理。
4. 客户端逻辑极简：池详情 DTO 给 `hasGuaranteedDeal: boolean`（服务端算好），为 true 才渲染第 5 格与 teaser；客户端不做任何候选场地推测。

---

## 2. 后台录入

现有：`apps/admin-client/src/pages/admin/VenueDealsManager.tsx`、`AdminVenuesPage.tsx`、`AdminEventPoolsPage.tsx`、`EventPoolCreateDialog.tsx`；服务端 `apps/server/src/routes/domains/venues.ts`（`requireAdmin` + `requireOperatorOrAbove`）。

### 2.1 权益表单（VenueDealsManager 改造）

- 顶部一个分段选择：**统一折扣 / 定制套餐**。选完只出现对应字段，不出现门槛、有效期、每人限用、排除日期。
  - 统一折扣：折扣（折，1.0–9.9，一位小数）· 权益名（≤20 字，默认「本场专属折扣」）· 出示方式（出示本页 / 到店暗号）· 暗号（选暗号时必填）。
  - 定制套餐：套餐名（≤20 字）· 套餐内容一句（≤20 字）· 一口价（元）· 原价（元，必填且 > 一口价）。
- 存储换算：`折扣 8.0 折 → discountType='percentage', discountValue=20`；服务端 zod 校验整数 1–90，拒绝 0 与免费单。
- **右侧实时手机预览**：直接渲染与客户端同构的卡面与出示页（预览组件放 `apps/admin-client/src/components/VenueDealPreview.tsx`，文案来自共享 copy 模块，禁止后台另写一套文案）。
- 保存即 `isActive` 可切换；被池引用的权益停用前弹窗列出受影响池，确认后审计记录。

### 2.2 池绑定（AdminEventPoolsPage / EventPoolCreateDialog）

- 新增「专属优惠」区块：保底场地 + 该场地下的有效权益单选；选中即预览用户将看到的第 5 格与优惠卡。
- ~~无酒精池绑定含酒权益时服务端硬校验拒绝~~ **S1 修订：不可执行，暂缓。** `event_pools` 没有任何饮酒属性（只有 `users.alcohol_comfort` 与 `venues.alcohol_options`），无法可靠识别「无酒精池」；权益本身也只有自由文本。待池级饮酒字段立项后再定义该规则，现阶段由运营在录入时自律。
- 新服务端路由放 `apps/server/src/routes/domains/adminEventPools.ts`，`requireOperatorOrAbove`，全部写操作进 `adminAuditLogger`（含 before/after 的 venueId/dealId）。
- 数据访问新增 `apps/server/src/repositories/venueDealsRepo.ts`，不写进 `storage.ts`。

---

## 3. 前端组件与切片顺序

文案统一进 `packages/shared/src/copy/`（新增 `venueDealCopy.ts`）；`poolRegistrationInclusionsCopy.ts` 标注 **LOCKED**，第 5 格文案必须经 copy owner 批准，且遵守 🔴 无 emoji、订座语汇、不用「独家」除非真实独家。

| 切片 | 内容 | 主要文件 | 验收 | 体量 |
|---|---|---|---|---|
| **S0** | schema + 迁移 + 共享 DTO + 共享文案，无 UI | `_definitions.ts`、`api/eventPools.ts`、`copy/venueDealCopy.ts`、迁移 SQL | 迁移在本地与 staging 通过；zod 单测覆盖两种类型与非法值；`npm run guardrails` | S |
| **S1** | 后台权益表单 + 实时预览 + 池绑定 + 审计 | `VenueDealsManager.tsx`、`components/admin/VenueDealPreview.tsx`、`components/admin/PoolGuaranteeFields.tsx`、`adminEventPools.ts`、`venues.ts`、`venueDealsRepo.ts`、`lib/venueDealBinding.ts` | 运营 3 分钟建一个折扣与一个套餐；非法价被拒；停用/删除已绑定权益需确认并审计；POST 与 PATCH 均可绑定 | M |
| **S2** | 小组详情嵌入 `venueDeal`，保底池分配硬约束 | 小组详情路由（`routes/domains/userEventPools.ts` 一带）、`venueAssignmentService.ts` | 成员拿得到、非成员拿不到；无场地/未分配/权益停用 = `null`；保底池容量不足 → 不成局全退 | M |
| **S3** | `VenueDealCard` 上小组详情页（锁定 / 折扣 / 套餐 / 长内容 / 读取失败重试 / 已调整） | `apps/mini-program/src/components/VenueDealCard/`、`pages/pool-group-detail/` | 六个状态各有渲染稿；读取失败 ≠ 无优惠；**已分配但权益失效 = 「已调整」而非读取失败**；暗发 `venueDealsEnabled`；`npm run build:weapp -w mini-program` + `verify:subpackage-styles` + class-coverage 无新增孤儿 | M |
| **S4** | 同桌凭证出示页 v2.3 | 新页面挂在 `pool-group-detail` 同分包下（避免主包体积），如 `pages/pool-group-detail/deal-redeem` | 240ms 入场、reduce-motion 终帧、提亮/常亮进入退出恢复、复制成功/失败两态、暗号缺失不伪造；真机店内照明可读 | M |
| **S5** | 报名页第 5 格 + teaser + 费用边界行（仅在 S0–S2 保底上线后） | `poolRegistrationInclusionsCopy.ts`、`PoolRegistrationInclusions.tsx`、池详情 DTO | `hasGuaranteedDeal=false` 时页面与现在逐像素一致；**真实 Step 0 壳普通屏 + 短屏都渲染，订座 CTA 不被挤压** | S |
| **S6** | 埋点 + 数据校验 + 文档收尾 | `routes/domains/analytics.ts` 白名单、客户端埋点、`docs-sync` | 白名单契约测试通过；四个事件在 staging 真实落库 | S |

依赖：**S0 → S1 → S2 → S3 → S4 → S6** 可顺序交付；**S5 只在保底可用后开启**，它是收报名转化的切片，也是唯一会对用户许下承诺的切片。
每片都在 `venueDealsEnabled` / `venueDealPromiseEnabled` 下暗发，关旗即回到现状，无半上线状态。

### 埋点（4 个，属性最小化）

`deal_card_impression`、`deal_card_tap`、`redeem_page_open`、`deal_credential_present`（`dealId` / `method` / `secondsFromOpen`）。北极星：**出示率 = `redeem_page_open` ÷ `deal_card_impression`**；报名转化提升用 `venueDealPromiseEnabled` 分批对照，不预先写目标数字（待验证）。

---

## 4. 必过门禁（按切片执行）

- 每片：`npm run guardrails`、`npm run typecheck`、相关 workspace 测试。
- S0（已完成，见 §5 状态）：迁移 SQL 手写为 `apps/server/migrations/0106_venue_deal_foundation.sql`；如需用生成器，正确命令是 `npm run db:generate -w @joyjoin/server -- --custom`（root 没有 `db:generate`）。journal 只手工登记本切片条目，**不要跑全量 `db:rebuild-journal`**——它会把既有的未登记迁移一并并入。`npm run db:journal-check` 的既有失败基线是 `0105_pool_registration_revealed_at` 与 `seed_venue_ac_hookah_20261112` 两条，S0 之后仍应恰好是这两条。**staging / production 先迁移再部署**（`validateDbSchema()` 缺列 fail-fast），迁移失败即中止部署。
- S3/S4/S5：`npm run build:weapp -w mini-program && npm run verify:subpackage-styles -w mini-program`；新票券图标需 Lovart WebP + 本地/CDN 双登记（`check-cdn-icon-coverage`）；`npm run design:audit:changed`。
- S4：真机验证深色页可读性、提亮与常亮恢复、低端 Android 掉帧即关动画。
- 全部完成后：`harness-completion-gate` → `completeness-audit` → `performance-audit` → `user-satisfaction-audit` → `docs-sync`。

## 5. 风险与回滚

| 风险 | 口径 | 回滚 |
|---|---|---|
| 权益被撤销 / 门店停用 | 保底池：不成局则全退（既有管线）；已分配小组：卡片转为「本场优惠已调整」+ 客服入口，补偿口径由运营与法务定，**不自动承诺赔偿** | 停用即全端不再展示，报名承诺实时消失 |
| 用户以为 ¥88 含餐 | 报名 teaser 与出示页底部固定「订座费不含餐费，餐费到店与门店另结」 | 文案问题走 copy owner，不改机制 |
| 同桌谁出示 | 任一成员可出示，暗号复制只影响本机状态，不写「已使用」 | 无需回滚 |
| 长店名 / 长套餐名 / 无暗号 | 长内容降字阶两行；无暗号强制 `show_page`；缺数据不渲染不伪造 | 组件级降级 |
| 承诺过头 | 「独家」默认不用；保底不存在则触点 1 整段不上线 | 关 `venueDealPromiseEnabled` |

## 6. 交接

动手时按切片加载对应 skill：S0 `database-migration-safety` + `api-contract-versioning`；S1 `admin-client-frontend` + `admin-audit-and-rbac-governance`；S2 `venue-location-services` + `server-domain-architecture`；S3–S5 `mini-program-frontend-excellence` + `joyjoin-brand-guidelines`；S6 `analytics-tracking`；全程 `feature-flags-launch-config`。
Sprint Contract：`.git/.orchestration/sprints/sprint-contract.venue-deals.md`，先 Verifier ACK 再写代码。

---

## 7. 执行状态

### S0 — 代码完成（2026-11-13），**尚不具备部署资格**

合同：`.git/.orchestration/sprints/sprint-contract.venue-deals-s0.md`（Tier 2，Verifier 两轮 REJECT 后按修正意见锁定，diffBase `8a7a3c692`）。

已交付：

| 项 | 位置 |
|---|---|
| `venue_deals.set_menu_price_cents` / `set_menu_original_price_cents` | `packages/shared/src/schema/_definitions.ts` |
| `event_pools.guaranteed_venue_id` / `guaranteed_deal_id`（FK `onDelete: restrict`） | 同上 |
| 独立严格 `adminVenueDealCreateSchema`（legacy `insertVenueDealSchema` 原样保留，路由接线属 S1） | 同上 + `schema/venues.ts` 导出 |
| `VenueDealSummary`、`PoolGroupSummary.venueDeal`、`EventPoolSummary.hasGuaranteedDeal` | `packages/shared/src/api/eventPools.ts` |
| 共享文案与面值格式化 | `packages/shared/src/copy/venueDealCopy.ts` + `copy/index.ts` |
| 迁移（幂等、事务、回滚注释） | `apps/server/migrations/0106_venue_deal_foundation.sql` |
| journal 手工登记（仅 0106） | `apps/server/migrations/meta/_journal.json` |
| 测试 30 + 23 例 | `schema/__tests__/adminVenueDealCreateSchema.test.ts`、`copy/__tests__/venueDealCopy.test.ts` |

验证结果：

- `npm run test -w @joyjoin/shared`：44 文件 / **598 例全 PASS**。
- `npm run typecheck`（shared / admin-client / mini-program / server）：全 PASS。
- `npm run guardrails`：**0 errors** / 12 warnings（既有）。
- 本地 dev DB 连跑两次迁移：均成功，第二次全部 `IF NOT EXISTS` 跳过；四列 nullable 类型正确，两条 FK `confdeltype = r`（RESTRICT）。
- `npm run db:journal-check`：仍恰为既有两条未登记（`0105_pool_registration_revealed_at`、`seed_venue_ac_hookah_20261112`），0106 已登记。
- 越界检查：本切片改动全部落在合同允许清单内；工作树中 mini-program squad-unboxing / center-hub 等改动为**他人既有未提交工作**，未触碰。
- server 既有 venue/pool 用例：105 通过；`adminSmartVenues.test.ts` 在并行跑一次启动探针超时，**单文件重跑 12/12 通过**，判为既有并发抖动而非本切片回归。

未完成（明确不在 S0）：staging / production 迁移执行、S1 后台录入与路由接线、S2 装配与保底分配、S3–S5 前端、flag 与埋点。**在这些列被应用到目标环境之前，不得部署引用它们的代码。**

### S1 — 完成（2026-11-14），QA Sprint Evaluation **PASS（17/17）**

合同：`.git/.orchestration/sprints/sprint-contract.venue-deals-s1.md`（Verifier 两轮 REJECT 后由 Supervisor 修正锁定，status=accepted，diffBase `8a7a3c692`）。

**服务端**
- `repositories/venueDealsRepo.ts`（新，Drizzle camelCase）：list/get/create、`updateVenueDealWithLock`（事务 + `FOR UPDATE` 行锁，读→合并→校验→写在锁内完成）、`listPoolsBoundToDeal`、delete。
- `lib/venueDealBinding.ts`：`resolvePoolDealBinding`（同空同非空、场地/权益启用、deal 属于该场地、场地同城）+ `planVenueDealPatch`（isActive-only / legacy 只读 / 现代核心字段合并校验）+ `buildMergedVenueDeal`。
- `routes/domains/venues.ts`：POST 用 `adminVenueDealCreateSchema.safeParse`（400 `INVALID_VENUE_DEAL`）；PATCH 三类策略 + 停用已绑定权益 409（`affectedPools`，需 `confirmDeactivate:true` 传输字段，不落库）；DELETE 被池引用 409 `DEAL_BOUND_TO_POOL`；四个写操作全部审计（`VENUE_DEAL_CREATED/UPDATED/DELETED`）。**公共只读路由仍走旧 storage，未动。**
- `routes/domains/adminEventPools.ts`：POST 与 PATCH 都执行绑定校验；PATCH 先合并既有池（仅改 city 也重校验）；创建即绑定、换绑、解绑分别写 `EVENT_POOL_DEAL_BOUND`；列表 GET 显式列补 `guaranteedVenueId/guaranteedDealId`。
- `adminAuditLogger.ts`：`ADMIN_AUDIT_ACTIONS` 加 4 个 action。

**后台**
- `VenueDealsManager.tsx` 整体重写（合同允许的 full-file 重写）：只有「统一折扣 / 定制套餐」；折扣以「折」录入（1.0–9.9，`discountValue=Math.round((10-折)*10)`）；套餐元→分；门槛/有效期/条款字段全部移除；右侧 280px 实时预览；停用遇 409 弹确认框列受影响池；legacy 行编辑仅标题/说明。
- `components/admin/VenueDealPreview.tsx`：文案全部来自 `@shared/copy/venueDealCopy`。
- `components/admin/PoolGuaranteeFields.tsx`：创建/编辑共用；同城 + 启用中过滤；切场地清空权益；「不绑定」同时清空两者；已停用权益以「（已停用）」回填；无有效权益给出提示。
- `AdminEventPoolsPage.tsx`：schema 加两字段 + 同空同非空 refine；`defaultValues` 中 `null as string | null`（`useForm` 未显式泛型时类型由 defaultValues 推断，`null` 会被推成字面量 null）；编辑回填来自**既有列表 GET**（不存在池详情端点，未新增）。

**QA 首轮（session `ses_e276a18eaffe59NWs8TUbll00Y`）：FAIL，9 PASS / 6 PARTIAL / 2 FAIL，已全部修复**
1. AC-02 FAIL：update schema 的 enum 会抢先把 legacy 类型打成 `INVALID_VENUE_DEAL` → `discountType`/`redemptionMethod` 在 **update 传输层放宽为 string**，业务拒绝仍由 `planVenueDealPatch` 给出 `LEGACY_DEAL_READONLY`；create schema 不变。
2. AC-06 FAIL：PATCH 把目标类型不需要的面值字段设 undefined，JSON 丢弃后服务端合并保留旧值 → 折扣↔套餐互转必然被创建不变量拒绝 → `buildDealPayload(form,{forUpdate})` 在 PATCH 时对不用的面值字段显式写 `null`（含 `redemptionCode`），POST 仍为 undefined。
3. 停用判断抽成 `planVenueDealDeactivation(existing,updates,boundPools,confirmDeactivate)`，覆盖「legacy + 已绑定 + 确认停用」。
4. 池绑定审计抽成 `describePoolBindingChange(previous,next)`：换绑/解绑带 `before`、`after.unbound`、`context.changeType`，值未变不写审计。
5. 预览残留本地文案 → copy 增加 `VENUE_DEAL_DEFAULT_SET_MENU_TITLE / DEFAULT_DISCOUNT_DESCRIPTION / DEFAULT_SET_MENU_DESCRIPTION / SET_MENU_PRICE_NOTE` 并全部走共享常量。
6. 新增 `normalizePoolGuaranteePayload`（空串/undefined→null）并有 submit-payload 测试。

**最终验证（2026-11-14）**
- root `npm run typecheck`：shared / admin-client / mini-program / server 全 PASS。
- server：`adminVenueDeals` + `adminEventPoolDealBinding` **46 例 PASS**；早前连同 `adminEventPoolCreation`、`adminRbacCoverage` 共 117 例 PASS。
- shared：44 文件 / **603 例 PASS**（update schema 的 legacy 断言改为「传输层接受、策略层拒绝」，并注明服务端测试位置）。
- admin：12 文件 / **91 例 PASS**（新增 PATCH 互转与 submit-payload 用例）。
- `npm run guardrails` 通过；越界对账：本切片改动均在合同允许清单，`seed_venue_ac_hookah_*` 与 `docs/runbooks/venue-onboarding-ac-hookah.md` 等他人文件未触碰。
- 未做：浏览器手工验收（后台需 admin 会话）、staging 部署、S2 起的用户侧任何改动。

**QA 二轮（14 PASS / 3 PARTIAL / 0 FAIL）剩余项修复**
1. AC-07：预览最后三处本地文案（`门店名称`、`到店暗号`、折扣错误说明）→ 新增 `VENUE_DEAL_PREVIEW_VENUE_PLACEHOLDER / VENUE_DEAL_CODE_PLACEHOLDER / VENUE_DEAL_DISCOUNT_VALUE_ERROR` 共享常量并加窄断言。
2. AC-09：「legacy + 已绑定 + 确认停用」用例改为真实 `discountType:'gift'` 行，先断言 `planVenueDealPatch` 对 isActive-only 返回 `write`，再断言确认停用返回 `affectedPoolIds`。
3. OBS-01：同一用例补审计上下文断言（`confirmedDeactivation: true`、`affectedPoolIds: outcome.affectedPoolIds`）。
修复后：全 workspace typecheck PASS；server `adminVenueDeals` 29 例、admin `VenueDealPreview` 5 例、shared 603 例 PASS。

**QA 最终结论（三轮）：PASS，17/17 项全部通过，无 PARTIAL/FAIL。** verdict 与 round1/round2 历史在 `.git/.orchestration/sprints/sprint-sprint_20261113_venue_deals_s1-verdict.json`。
`releaseVerdict = NOT_DEPLOYMENT_ELIGIBLE`：0106 尚未在 staging / production 执行，后台浏览器手工验收未做；这两项是外部发布门禁，不影响合同闭环。

### S2 — 完成，QA Sprint Evaluation PASS（23/23）

**QA 首轮（17 PASS / 4 PARTIAL / 2 FAIL）后的修复：**
- **D6/AC-04（FAIL → 已修）**：`getGroupVenueDeal` 现在任一保底字段存在即进入保底分支；只有两个 ID 齐全且实际门店一致才读锁定权益，否则返回 `null`。venue-only / deal-only / 门店不一致三个 repository 回归用例已加（`venueDealGuarantee.test.ts`，db mock 为 `{}`，任何 DB 访问即抛错）。
- **AC-05（PARTIAL → 已修）**：池详情与池列表都有**响应级**断言——`guaranteedVenueId`/`guaranteedDealId` 为 `undefined`，详情另断言 `hasGuaranteedDeal` 由 `computeHasGuaranteedDeal` 计算（`poolGroupVenueDeal.test.ts`，withServer 真实路由）。
- **OBS-01（PARTIAL → 已修）**：无可用时段日志补 `poolId + reason`；逐组保底失败日志补 `poolId`。
- 验证：server 13 个相关测试文件全过（含 venueAssignmentService / venueAssignmentMetrics / venueTbdRetryScheduler / venueTbdCancellation / venuesRepoCamelCase / venueDataQuality / adminSmartVenues / gatheringRoomState）；新增三文件 40 例全过；`npm run typecheck -w @joyjoin/server` PASS。
- 注：合同 §5 实际列出的回归文件为 `venueAssignmentService.test.ts` / `budgetAdjacencyDegradation.test.ts` / `matchingMetrics.test.ts` / `matchingPostMatchEffects.test.ts`，全部存在且已跑通（后三个文件 24 例全过）；早先摘要里出现的 `slotUsageTracker` / `venueAssignmentAtomicity` / `venueAssignmentBudgetAdjacency` 是误记的文件名。

**QA 二轮结论（2026-11-14，session `ses_e276a18eaffe59NWs8TUbll00Y`）：23/23 PASS，0 PARTIAL / 0 FAIL。** verdict 含 round1 历史，位于 `.git/.orchestration/sprints/sprint-sprint_20261114_venue_deals_s2-verdict.json`。`releaseVerdict = NOT_DEPLOYMENT_ELIGIBLE`（0106 环境迁移 + 真实浏览器/API 验收是外部门禁）。


合同 `.git/.orchestration/sprints/sprint-contract.venue-deals-s2.md`（status=accepted，两轮 Verifier 协商后由 Supervisor 修正锁定）。

**交付**
- 新 `apps/server/src/lib/venueDealVisibility.ts`：唯一「可兑现权益」判定 `isRedeemableVenueDeal`（自身含 isActive，仅 percentage/set_menu + show_page/code，面值/套餐价/暗号齐全）、统一选择 `selectRedeemableVenueDeal`（先过滤再取 createdAt 最新）、`toVenueDealSummary`（valueOffPercent 直接拷贝 discountValue）、`sanitizePublicVenueDeal(s)`。
- `venueAssignmentService.ts`：每次 run 按 poolId 自读一次保底绑定（`matchingPostMatchEffects`/`venueTbdRetry` 零改动）；部分绑定 fail-closed；候选集只保留锁定门店且必须满足完整 `buildEligibleVenueConditions`；分配前校验保底权益可兑现；保底分支绕过打分但复用 slotUsageTracker；新纯函数 `planGuaranteedGroupAssignment`；五个新 reason code 按 D8 优先级。
- `venueDealsRepo.ts`：`getPoolGuarantee` / `getEligibleGuaranteedVenue` / `computeHasGuaranteedDeal` / `getGroupVenueDeal`（保底只认 locked 那一张，失效即 null 不换券；非保底取最新可兑现一张）。
- `userEventPools.ts`：池列表 + 池详情剔除 `guaranteedVenueId/guaranteedDealId`（不再 `...pool`）；池详情返回 `hasGuaranteedDeal`；小组详情返回 `group.venueDeal`。
- **安全修复（评审发现的历史泄露）**：公开路由 `/api/venues/:venueId/deals`、`/api/venues/:venueId/with-deals`、`/api/venues/by-name` 不再返回 `redemption_code/redemptionCode`。
- 新 reason 接入 `matchingMetrics`（不归 `__other__`）、`wecomNotifier` 与 admin `EventPoolDetailDialog` 中文文案；S1 停用确认弹窗改为明确「无法成局 + 既有全退」。

**验证**
- 新增测试：`venueDealGuarantee`（判定/选择/映射/保底决策/源码契约/metrics）、`publicVenueDealRedaction`、`poolGroupVenueDeal`（withServer：200 装配、保底失效 null、非成员 403 不调用装配、未登录 401）、admin `venueDealS2`。
- 合同 §5 全量：11 个 server 测试文件 106 例，105 过 1 失败（`gatheringRoomState` 并行 readiness probe 超时，**单文件重跑 16/16 通过**，与 S0 adminSmartVenues 同属既有并发抖动）；root typecheck 全 workspace PASS；admin 13 文件 98 例 PASS；guardrails 通过。
- 越界对账：本切片文件均在合同允许清单；mini-program / 他人文档改动未触碰。

**仍未完成**：staging/production 的 0106 迁移、真机与后台手工验收、S3–S5 前端、flag 与埋点接线。

### S3 — 完成，QA Sprint Evaluation PASS（14/14）

- 新组件 `apps/mini-program/src/components/VenueDealCard/`（TSX + SCSS + 11 例组件测试），页面 `pool-group-detail` 接线 + 7 例集成契约测试；样式 `@use ... as venue-deal` 合编译，`verify-subpackage-styles.mjs` 选择器清单同步。
- **Verifier 第 1 轮 REJECT 的实质修正**：
  1. 保底真值随小组响应同发：`PoolGroupSourceSummary.hasGuaranteedDeal` + 小组路由 pool 载荷复用 `computeHasGuaranteedDeal`（方案 A，无第二次请求竞争）。
  2. **六态而非五态**：`assigned + 保底 + 正常响应 deal=null` 的真实语义是权益失效/撤销/跨店 → 新「已调整」态（`VENUE_DEAL_CARD_ADJUSTED_*`，转客服，无重试假动作）；「读取失败」只由真实 query/refetch 错误触发（refetch 失败保留旧数据，页面不再因 error 直接整页报错）。已承诺但面值缺失同样归「已调整」，不编造面值。
  3. 装饰符号 `?`/`!`/`›` aria-hidden；52/44rpx 登记为卡内装饰符号例外；长面值边界 99999 分（76rpx）/100000 分（64rpx）锁定。
  4. **flag `venueDealsEnabled` 全链路**（DB flag + env `VENUE_DEALS_ENABLED` 默认 false + features 暴露 + shared auth 类型 + 后台 flag 中文文案），页面 `=== true` 才渲染。
- 渲染证据：`docs/design/venue-deal/shots-s3/s3-{discount,setmenu,long,locked,adjusted}.png`（H5 + Playwright，mock `group-deal-*` 场景）；票券左值右文、打孔、划线原价、套餐餐费边界均与已批准设计一致。
- 验证：mini 3 文件 30 例、shared 44 文件 607 例、server poolGroupVenueDeal + gatheringRoomState + featureFlagCopyContract 31 例全 PASS；root typecheck 全 workspace PASS；guardrails 初报 `#E3DED6` 硬编码 → 已登记 `$color-deal-muted-border`。

**S3 v3（Verifier 第 2 轮 → Supervisor 锁定）**：再修一个语义漏洞——权益撤销后 `computeHasGuaranteedDeal` 也变 false，若只认它，整卡仍会静默消失。小组响应新增 `hasGuaranteedDealBinding`（绑定事实，撤销后仍为 true），页面状态改由纯函数 `resolveVenueDealCardState`（`apps/mini-program/src/lib/matching/venueDealCardState.ts`，9 例真值表行为测试：非保底有券出票券 / 有效保底未分配 locked / 撤销后 adjusted / 真实 refetch error → error / flag-off 全隐藏 / collapsed 隐藏）。server 补两条小组响应级断言（保底真值+id 不外泄；撤销后 binding=true、deal=null）。合同 v3 文本同步（六态、装饰符号例外、允许清单、design:audit 命令）。

**S3 范围收尾**：QA 复评要求根目录临时渲染脚本不得游离于合同允许清单之外；`render-venue-deal-s3-tmp.mjs` 已在截图生成后删除，工作树不再包含该文件。`shots-s3/` 渲染证据保留；后续如需重渲，按 §7 的 mock 场景与参数重建临时脚本，不纳入产品代码。

**S3 最终结论**：QA 三轮后 **14/14 PASS，0 PARTIAL / 0 FAIL**。verdict（含 round1/round2）`.git/.orchestration/sprints/sprint-sprint_20261114_venue_deals_s3-verdict.json`。首轮两项 PARTIAL 仅为证据缺口（v3 构建/样式校验、越界对账），已补；二轮唯一 FAIL 为根目录临时渲染脚本不在允许清单，已删除并记录范围收尾。`releaseVerdict = NOT_DEPLOYMENT_ELIGIBLE`：真机六态、真实异常网络/重试、0106 环境迁移仍是发布门禁。

### S4 — 完成，QA Sprint Evaluation PASS（2026-11-14）

- 新页面 `pages/pool-group-detail/credential/index`（同分包、custom 导航）：复用 S2 小组详情 query 与 `VenueDealSummary`，不新增凭证接口；URL 只带 groupId。按已批准 v2.3 实现深紫舞台、单色纸面、92rpx 到店暗号 / 64rpx 套餐名、单环印章、唯一规则与费用边界。
- 仅 S3 `ticket` 且 flag on 时票券可点；缺 id / 403 / 读取失败 / flag off / 未 assigned / 无 deal / code 缺失均不可用。`discount+show_page` 是合法静态出示，`set_menu+show_page` 可出示且无按钮。
- 复制成功才出现绿按钮与「暗号已复制」印章；失败提示包含真实暗号；成功/失败不混显；不调用核销端点。
- `useCredentialScreen` 控制器覆盖 onShow/onHide/unload、迟到 Promise、reject、API 缺失、有效原亮度恢复；状态条只反映真实结果。
- 测试：mini 合同套件 6 文件 59 例 PASS（页面 11 + 屏幕 9）；shared 44 文件 609 例 PASS；server poolGroupVenueDeal 9/9；typecheck PASS；guardrails PASS；design audit 0 error。构建/截图证据见本目录 `shots-s4/`。
- 渲染复核修正：长店名为印章预留 `padding: 0 112rpx`，不再穿章；`discount+show_page` 使用「本场优惠 / 门店按本页权益结算」，不再误称暗号或按套餐出餐；规则与订座费边界各只出现一次。
- AC-08 真机 iOS/Android 提亮、常亮、恢复与可读性仍为 MANUAL；未完成前不得生产开启 flag。

**S4 最终验证补充**：H5 六态重渲无页面错误；weapp + 分包样式 + 包体积通过；root typecheck、design:audit:changed、server poolGroupVenueDeal 9/9 通过。`npm run guardrails` 当前被**非本切片**的预算词表新增占用阻断：`apps/mini-program/src/components/event-ticket-payment/__tests__/CostBreakdown.render.test.tsx` 与未跟踪的 `packages/shared/src/copy/__tests__/eventCostCopy.test.ts`；S4 未触碰这些文件，品牌色/class-coverage 等其他检查均通过，不擅自修改或并入他人工作。根目录两个早期设计渲染脚本已移至 `/tmp`，S4 截图脚本也只存在于 `/tmp`。

**S4 QA 首轮修复（2026-11-14）**：出示页 query 现读取 `error`，无数据失败与「有缓存但 refetch 失败」都进入不可用态、无复制按钮且屏幕能力停用；补 `setScreenBrightness` rejection 独立用例；共享 copy 禁词测试改为遍历模块全部字符串导出，S4 新常量不再漏检；mock 新增 8 字暗号 `group-deal-longcode`，补最长暗号渲染证据。修复后 mini 6 文件 61 例 PASS；shared 45 文件 628 例 PASS（含他人新增测试文件）；shared typecheck PASS。mini typecheck 当前被非 S4 文件 `pages/payments/event-ticket-payment/index.tsx:1187` 的 `formatBudgetLabel` 未定义挡住，未触碰该外部改动。

**S4 复评补证（2026-11-14）**：最长 8 字暗号 H5 图 `shots-s4/s4-longcode.png` 已目视，完整两行、不截断。weapp 重建 + 分包样式 PASS（credential WXSS 4.67kB）；server poolGroupVenueDeal 9/9；design:audit:changed 0 error；root typecheck 最新全 workspace PASS。guardrails 最新失败项变为非 S4 的 `CostBreakdown.tsx` 新增 class `cost-breakdown__hint--purchase` 无样式（外部 cost-transparency 工作），S4 未触碰；此前 budget baseline 外部失败已不在本次输出中。

**S4 QA 最终结论**：聚焦复评四项全部 PASS，总体 `implementationVerdict=PASS`；verdict（含 round1 历史）在 `.git/.orchestration/sprints/sprint-sprint_20261114_venue_deals_s4-verdict.json`。AC-08 真机提亮/常亮/恢复/店内可读性/低端动画仍为 MANUAL 外部门禁；`releaseVerdict=NOT_DEPLOYMENT_ELIGIBLE`，完成前生产不得开启 `venueDealsEnabled`。

### S5 + S6 — 完成，QA Sprint Evaluation PASS（S5 7/7，S6 8/8）

- S5：新独立 flag `venueDealPromiseEnabled`（默认 false，env `VENUE_DEAL_PROMISE_ENABLED`，经 auth user features 下发并登记后台中文说明）。Step 0 仅在 flag + `pool.hasGuaranteedDeal===true` 时渲染 A1 第五格、teaser 与餐费边界；短屏改 compact 而非整段隐藏，无承诺保持 legacy 四格与 640px collapse。第五格暂用已登记 JoyJoinIcon 🎫，Lovart WebP + CDN 仍是上线资产门禁。
- S6：新 `lib/analytics/venueDealAnalytics.ts`，四个 discover 事件 `deal_card_impression` / `deal_card_tap` / `redeem_page_open` / `deal_credential_present`，client union 与 server whitelist 同步；metadata 只有 poolId/groupId/dealId/kind/method/secondsFromOpen。卡曝光仅 ticket 且每 mount 按 group+deal 去重；点卡先于导航；code 仅复制成功 present，show_page 首次可用渲染 present；错误/不可用不发，永不表示商户核销。
- 文档口径已统一：`index.html` §6.3 删除旧的 deal_inclusion_impression / deal_redeem_page_open / deal_code_copy 模型。
- 已验证：root typecheck 全 workspace PASS；S5 组件+源码 9 例 PASS；S6 helper/凭证/小组接线与既有 VenueDealCard 套件已跑，server 新 flag/analytics + featureFlagCopyContract + poolGroupVenueDeal 已跑。shared 全量与 H5 构建在后台；S5 普通屏/短屏/legacy 三图待生成。
- 外部门禁：staging 四事件真实落库并核对 metadata；0106 迁移；S4 真机 AC-08；S5 Lovart/CDN 资产与真实 Step 0 验收。完成前生产两 flag 均不得开。

**S5+S6 验证与渲染（2026-11-14）**：root typecheck 全 workspace PASS；shared 45 文件 628 例、server 四文件 21 例、mini 九文件 75 例全 PASS；guardrails PASS（0 error / 13 warnings，既有）；H5 三图已生成并目视：`shots-s5/s5-promise.png`（普通屏第五格+teaser+费用边界+CTA）、`s5-promise-short.png`（375×667 compact，承诺不消失且 CTA 可见）、`s5-legacy.png`（pool-screenshot-003 无保底，仍四格 legacy，无承诺）。四事件埋点只在真实 ticket/点击/可用出示/复制或静态出示时触发；staging 真实落库仍未做，属外部发布门禁。
S5+S6 构建门禁：`build:weapp`、`verify:subpackage-styles`（pool-registration 29 选择器，credential 3，pool-group-detail 12）、包体积与 upload assets 全 PASS；`design:audit:changed` 0 error（仅 S1 既有预览 inline-color warning）；`guardrails` 0 error / 13 既有 warnings。临时渲染脚本仅 `/tmp/venue-deal-s5-shots.mjs`，未留仓库。

**S5/S6 QA 最终结论**：S5 7/7 PASS、S6 8/8 PASS；verdict 分别在 `.git/.orchestration/sprints/sprint-sprint_20261114_venue_deals_s5-verdict.json` 与 `sprint-sprint_20261114_venue_deals_s6-verdict.json`。S6 非法事件由真实 withServer 测试证明 200 + success:false 且不写库。两片 releaseVerdict 均 NOT_DEPLOYMENT_ELIGIBLE：0106 环境迁移、S4 真机、S5 真机 Step 0 与 Lovart/CDN、S6 staging 四事件真实落库与 metadata/PII 核查完成前，不得生产开旗。

**集成加固（2026-11-16）**：全量 review 后修复三个跨切片风险。① 绑定校验改用与分配器一致的完整目录资格（city/district/eventType/onboarding/partner/contract/type）+ `isRedeemableVenueDeal`；② 成局后禁止保底换绑/解绑，PATCH 返回 409 `POOL_GUARANTEE_LOCKED_AFTER_MATCHING`，后台选择器锁定；③ 报名承诺同时要求 `venueDealPromiseEnabled` 与 `venueDealsEnabled`，后台 flag 文案记录联动依赖。UI 同步收紧：teaser 改为「场地确定后揭晓…」，票券入口有 onPress 时显示「查看同桌凭证」，复制后允许再次复制且印章单行，读取失败与权益不可用分离。验证：root typecheck、server/admin/mini/shared focused suites、H5/S5/S4 重渲、weapp、guardrails、design audit 全过。H5 `s4-copied` 中「内容已复制」toast 为 Taro H5 平台 `setClipboardData` 自带行为，非产品代码。
