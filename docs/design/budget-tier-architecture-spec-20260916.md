# 预算档位架构锁定方案（Budget Tier Architecture）

- **日期：** 2026-09-16
- **状态：** 已锁定（grill-me 11 分支 + PM 评审 + 商业化评审）
- **Harness 分级：** Tier 2/3（跨匹配 / 场地 / 注册 / 后台 / schema 迁移）
- **相关性：** 发布前（无真实用户、无生产数据）

> **一句话：** 把六套分叉的预算词汇收成一个**代码内有序档位注册表**（命名空间 id）；场地能力把命名空间 id 存进**现有数组列**（不建新表）；注册侧两个互斥列**合并为单列**；档位下发 = **城市级目录覆盖**（不掺档期，档期归派场层）；派场用**就近梯度降级**作为安全网；迁移走 **expand → migrate → contract**。

---

## 1. 问题与失败链（含证据）

### 1.1 六套互不兼容的词汇

| # | 词汇 | 位置 |
|---|---|---|
| 1 | 饭局：`150以下 / 150-200 / 200-300 / 300-500` | `apps/mini-program/src/pages/pool-registration/flowConfig.ts:36-41` |
| 2 | 酒局：`80以下 / 80-150` | `flowConfig.ts:43-46` |
| 3 | 后台场地标签（`¥` 前缀重复品） | `apps/admin-client/src/pages/admin/venueConstants.ts:75-85` |
| 4 | 盲盒 `budgetTier` 标量 `"100-200"` | `packages/shared/src/schema/_definitions.ts:1038`；`apps/server/src/routes/domains/blindBoxEvents.ts:643-660` |
| 5 | 匹配测试机器人 `150-200 / 200-300 / 300-500`（**缺 `150以下`**） | `apps/server/src/services/matchingTestService.ts:69` |
| 6 | 遗留场地匹配 `budget/moderate/upscale/luxury` | `apps/server/src/venueMatchingService.ts:334` |

### 1.2 失败链（可观测、已有埋点）

```
用户选 150以下 / 80以下（最低档）
  → 无任何场地覆盖
  → calculateGroupBudget 30% 共识 (venueAssignmentService.ts:46-70)
  → scoreVenueForGroup 零重叠硬失败 score=0 (:267-288)
  → reason = "budget_mismatch" (:425-437)
  → venueAssignmentStatus='unassigned' → 用户看到「地点待定」+ WeCom 告警 (:636-649)
```

### 1.3 真实覆盖缺口（已核实）

- 派场唯一餐厅是 **T馆 `200-300`**（`seed_venue_partners_20260602.sql:30-33`）。
- 因此 **`150以下` 与 `150-200` 在饭局侧均无场地**。
- 酒吧 5 家中 **3 家不可达**（弥所/Bruma `150-200`、Max `300-500` 均为饭局档位；弥所是 `bar` 却打 `150-200`，见 `seed_venue_partners_20260602.sql:19-22`）。
- 种子全部写入 `onboarding_status='draft'`（`:26` / `seed_venue_batch_and_co_20260608.sql:26`），而派场要求 `='active'`（`venueAssignmentService.ts:344,352`）。

### 1.4 结构性缺陷

| 缺陷 | 证据 |
|---|---|
| 预算**不是**匹配期约束（幽灵功能） | `event_pools.budgetRestrictions` 仅被 `apps/server/src/matching/hardConstraints.ts:65,75` 读取，**全仓库无写入路径** |
| Match Compass dealbreaker 只实现了性别 | `hardConstraints.ts:143-163` |
| 一个池只有一个局型，却用两个互斥列 | `_definitions.ts:472,483`；`flowConfig`/`poolRegistrationForm.ts:55-64` 每次只填一个 |
| 用户看不到预算单位 | `flowConfig.ts:37-45` 裸标签；`ticketHelpers.ts:15-18` 只加 `¥`，丢掉「每杯/每人」 |
| 手写 SQL / duck-typed 静默失效面 | `apps/server/src/repositories/venuesRepo.ts:24,171,236`；`apps/server/src/lib/venueDataQuality.ts:109-112` |
| 微信提审违禁词遗留 | `flowConfig.ts:103,106,143,151`（饭局分支 `:115,118` 已合规 → 分支不一致） |
| 盲盒后台筛选静默返回空 | `AdminEventsPage.tsx:134-139` 用饭局词表，库存 `100-200`（`:322` 比较） |

---

## 2. 锁定决策（Q1–Q11）

| # | 决策 | 理由（best practice） |
|---|---|---|
| **Q1** | 种子场地经**新的幂等 SQL** 改为 `onboarding_status='active'`（**不修改已应用的种子文件**） | 修数据、不修闸门；`onboarding_status` 是运营安全轨 |
| **Q2** | **延迟**关联表。场地能力 = 现有 `venues.budget_categories TEXT[]` 存**命名空间档位 id**。关联表（`venue_tier_terms` 形状）仅在**每档位条款**出现时建 | 6 场地阶段零能力增益；避免手动 DDL×3 + 两处静默失效面 + 热路径 N+1。命名空间 id **零迁移**即解决串味 |
| **Q3（2026-09-16 修订）** | 酒局单位 = **每次人均（per_person）**；注册表携带 `unit`；**用户可见文案必须标单位**。**修订理由**：种子 5 家场地源自点评调研（`seed_venue_partners_api.json` 头注释），其值为**人均**而非每杯（Max 电音夜店 `300-500` 作每杯不合理）→ 维持 `per_drink` 会强制人均→每杯换算，正是本缺陷的错误来源。运营据此对三家未决酒吧取 `≤150 人均` 假设 | 原 `per_drink` 依据为 `_definitions.ts:483,1265` + `venueConstants.ts:83-84` —— **这三处是待修正的旧语义**，由 T5a 一并更新为 `/人` |
| **Q4** | **埋掉** `event_pools.budgetRestrictions` / `barBudgetRestrictions`，注释「有意不实现」 | 幽灵读取比缺失代码更危险；L1 硬约束会切碎薄池 |
| **Q4.5** | 无每档位佣金/最低消费；**档期不一致归 `venueTimeSlots`**，不得进档位模型 | 档期（周循环 `dayOfWeek` / 单次 `specificDate` + 容量）已在 `_definitions_extended.ts` + `venueAssignmentService.ts:114-175` 建模；两者正交 |
| **Q5** | 档位下发 = **城市级目录覆盖**，按 `城市 × 局型` 缓存；**可预订性完全归派场层** | catalog（低 churn）≠ availability（高 churn）；避免两处推理可用性、避免缓存与预订数据耦合 |
| **Q6** | 注册侧合并为单一 `budget_tier_ids text[]`；归一化器放 `packages/shared`；校验分三层（归一化 → 严格枚举，**不加 DB CHECK**） | 消除互斥双列/冗余真源；纵深防御；拒绝平行真源 |
| **Q7** | 派场降级：按 `order` 距离 **精确40 / ±1 20 / ±2 8 / 更远0**；**两段式**（严格→软）；**最多跨一档** + 显式披露；原因码 `budget_adjacent` | 让失败类结构性消失；防「降级变抬价」 |
| **Q8** | 错误码 `INVALID_BUDGET_TIER` + `BUDGET_TIER_REQUIRED`；**必填写在共享 schema**；`flowConfig.ts` 整文件文案清理（独立 commit） | 每个用户可见失败必须有 code；不变量写在契约里（make illegal states unrepresentable） |
| **Q9** | 数据质量「id 必须在注册表内 + 不得跨命名空间」升为 **error**；守卫脚本**含测试夹具与 demo**（旧值走一次性 grandfathered 基线） | `matchingTestService.ts:69` 漏 `150以下` 正是死档位从未被测出的原因 |
| **Q10** | 后台人工派场按档位距离**排序** + 显示距离 + **超政策必填理由** + 审计留痕 | 人工兜底必须看到与算法相同的输入，且能被有意、留痕地越过 |
| **Q11** | **expand → migrate → contract** 三段式；派场降级 flag `budgetAdjacencyEnabled`（默认 false）；迁移幂等 + 前后置校验；先 staging 后 prod | DDL 手动、CI 跳过 DDL；`DROP` 不能在引入列的同一次迁移（旧代码会启动失败） |

---

## 3. 目标架构：每个关注点的唯一真源

| 关注点 | 唯一真源 | 位置 |
|---|---|---|
| 档位是什么（id/label/unit/区间/顺序/局型） | `BUDGET_TIERS` 注册表 | `packages/shared/src/budgetTiers.ts`（新增） |
| 某场地能服务哪些档位 | `venues.budget_categories`（命名空间 id 数组） | 现有列（`_definitions.ts:1258`） |
| 客户端可展示哪些档位 | **服务端计算的下发集合** = 注册表 ∩ 有供给的城市目录 | 新增 resolver（复用 `venuesRepo.ts:97` 风格） |
| 派场如何消费档位 | 档位 id 重叠 + `order` 距离梯度 | `venueAssignmentService.ts` |
| 档位合法性 | 注册表 + 写入层白名单 | `packages/shared` + `_definitions.ts:943` |
| 词汇守卫 | CI ratchet 脚本 | `scripts/check/check-budget-tiers.mjs`（新增） |

**分类法归代码，不归数据库**：与 `packages/shared/src/interests.ts`、`constants.ts`、`districts.ts` 一致；仓库唯一 DB 配置先例 `matching_config` 已漂移出生产使用（注释明确 "consumed ONLY by the lab/legacy userMatchingService"）。DB 保持「哑」。

---

## 4. 档位注册表规格

```ts
export type BudgetUnit = 'per_person' | 'per_drink';

export interface BudgetTier {
  id: string;                    // 'dining_150_200' | 'drinks_80_150'
  eventType: '饭局' | '酒局';     // 命名空间归属
  label: string;                 // '150-200'（不含单位）
  unit: BudgetUnit;
  min: number | null;            // null = 开区间下界（「以下」）
  max: number | null;            // null = 开区间上界
  order: number;                 // 0 = 最便宜，递增
}
```

辅助函数（纯函数，无 I/O）：`BUDGET_TIER_BY_ID`、`getTiersForEventType`、`isValidTierId`、`LEGACY_BUDGET_LABEL_TO_TIER_ID`、`normalizeBudgetTierIds`、`formatBudgetTier(tier) → '150-200/人' | '80-150/人'`（Q3 修订后两梯同为 `per_person`）、`getOfferedTiers(eventType, coveredTierIds)`。

**硬约束：** 饭局与酒局是**不相交命名空间**；`bar`/`homebar` 不得持有 `dining_*`。`id ≠ label`（存储与文案解耦）。

---

## 5. 档位下发（城市级目录）

```
BUDGET_TIERS（代码）
  ∩ { 该城市 × 该局型下，至少 1 个 active 场地 }
      active = isActive ∧ onboardingStatus='active' ∧ partnerStatus='active'
               ∧ (contractEndDate IS NULL OR ≥ today) ∧ venueType ∈ allowed(eventType)
  → coveredTierIds → getOfferedTiers(...)
  → 注册页预算步只渲染这些
  → 空 / 失败 → fail-open 回退到全量注册表
```

- **永不阻断注册**：resolver 故障或空集合 → 全量注册表（= 今日行为）。
- **不新增步骤/滚动**（`docs/design/registration-ceremony-spec-20260817.md:16-22`）。
- **不掺档期**：可预订性由 `checkTimeSlotAvailability`（`venueAssignmentService.ts:114`）在派场时处理。
- **不隐藏需求**：无供给档位以**标注**方式呈现并记录（需求信号供招商），不做静默过滤。

---

## 6. 派场降级规则

1. **梯度**（按 `order` 距离）：精确 40 / ±1 得 20 / ±2 得 8 / 更远 0。容量仍是唯一硬闸门（`venueAssignmentService.ts:260-265`）。
2. **两段式**：第一遍严格；结果为空时第二遍把预算降级为普通偏好分 → **绝不因预算单独留下未派场**。
3. **上限**：最多跨一档。跨两档及以上 → `venue_tbd` 交人工，**不静默超档**。
4. **披露**：新增原因码 `budget_adjacent`（`预算就近安排`），通知/展示须写明**实际档位**。
5. **移除不对称分支**：删除 `venueAssignmentService.ts:270-273`（空共识反而 +40）。
6. **诊断**：输出类型化诊断（组共识档位、候选场地、逐场地失败原因）；`unassignedBreakdown`（`:622-645`）升为指标。

> ⚠️ **必然残余（需运营知晓）：** 在签下 `150以下`/`150-200` 餐厅之前，`150以下`（与 T馆 `200-300` 相距 2 档）**仍会 `地点待定`**。代码造不出供给 → **Step 0 是上线前提。**

---

## 7. 校验分层

| 层 | 机制 | 职责 |
|---|---|---|
| **L1 归一化** | `normalizeBudgetTierIds(raw)`（`packages/shared`） | 历史标签 → id；未知值记 warning 后丢弃。用于迁移窗口 + 外部通道（盲盒、机器人） |
| **L2 严格枚举** | `_definitions.ts:943` 改 `z.enum(TIER_IDS)`（含必填）；后台 `venues.ts:49` 同理 | fail-closed 兜底 + 契约测试锚点 |
| **L3 DB** | **不加 CHECK** | 分类法归代码；DB CHECK 会成第二真源 |

**错误码：** `INVALID_BUDGET_TIER`、`BUDGET_TIER_REQUIRED` 必须同时加入 `packages/shared/src/copy/errorBaselines.ts` 的 `ErrorCode` union 与 `ERROR_TEMPLATES`，否则 `apps/server/src/__tests__/registrationErrorCodes.test.ts` 失败。**不加** `BUDGET_TIER_UNAVAILABLE`（供给是 UX，不是写入错误）。

**盲盒通道：** 本轮**不改其列**（避免扩爆炸半径），但写入边界强制归一化；并修 `AdminEventsPage.tsx` 的筛选静默 bug。

---

## 8. 运营与可观测

1. `apps/server/src/lib/venueDataQuality.ts:181-187` 升为 `severity: 'error'`；新增规则：(a) 所有档位 id ∈ 注册表；(b) 不得跨命名空间（按 `venueType`）。
2. `scripts/check/check-budget-tiers.mjs` ratchet（对标 `check-class-coverage.mjs`），**含测试夹具与 demo 脚本**，旧值一次性 grandfathered 基线。
3. `unassignedBreakdown` 升为指标 + 逐档位诊断。
4. 后台人工派场候选（`venues.ts:1140-1171`）按档位距离排序 + 距离标注 + 超政策必填理由 + `adminAuditLogger` 记录 `{groupId, venueId, tierDistance, overrideReason}`。

---

## 9. 迁移：expand → migrate → contract

**约束（已核实）：** `apps/server/src/db.ts:74-104` 遍历所有 schema 表做 `select().from(table).limit(0)`；Drizzle 0.39.1 实测展开**显式列清单**（`select "id","col2","col3" from "t" limit $1`）→ **能捕获缺失列**，在 `index.ts:95` 于 `listen` 前 fail-fast。⚠️ **`DROP` 的危险根因不是验证器**，而是**旧代码的 Drizzle schema 仍命名被删列**；验证器只是把「首请求 500」变成「拒绝启动」。规则：**R3 的 `DROP` 仅当新版本与其回滚目标都已停止引用旧列时才安全**。CI/CD **跳过 DDL**；local / staging / prod 均**手动**应用。

| 阶段 | 内容 | 回滚 |
|---|---|---|
| **R1 扩张** | 注册表 + 归一化器（读路径兼容旧标签与 id）+ `ADD COLUMN budget_tier_ids text[]`（**保留旧列**）+ 幂等值迁移（回填新列、改写 `venues.budget_categories`）+ 派场降级**藏 flag 默认关** | 回退部署；旧列数据完好 |
| **R2 灰度** | flag 开城市级档位下发；派场降级做**双跑对比**（先例：`simulate:groups`、`magnetismDualRun.test.ts`）→ 通过后开 flag | 关 flag |
| **R3 收口** | 收紧为严格枚举；守卫基线清理；**最后** `DROP` 两个旧列 | 回退部署 |

**为什么不用原子切换：** 取消列会让回滚变成「从备份恢复」；三段式每步可回退，且这套纪律上线后照用。

**幂等 + 前后置校验：**

```sql
-- 前置
SELECT count(*) FILTER (WHERE budget_range IS NOT NULL OR bar_budget_range IS NOT NULL)
FROM event_pool_registrations;
SELECT budget_categories, count(*) FROM venues GROUP BY 1;

-- 后置
SELECT count(*) FROM event_pool_registrations WHERE budget_tier_ids IS NULL;  -- 应等于前置「两者皆空」数
SELECT DISTINCT unnest(budget_categories) FROM venues;                        -- 必须全部 ∈ 注册表
```

**迁移纪律：** `npm run db:generate -- --custom` → 填 SQL → `npm run db:rebuild-journal`；先 staging 验证后 prod。

---

## 10. 验收标准

- [ ] AC-1 **无代码造成的死档位**：对每个 `城市 × 局型 × T`（T ∈ 注册表），不存在因代码/数据缺陷导致「active 且**档期匹配**的场地 = 0」的档位（判定须 JOIN `venue_time_slots`）。**M1 以全量注册表评估**（resolver 属 M2）；「每个档位都有真实供给」为 **M0 运营指标**（允许书面零供给白名单）。**按测试池 `dateTime` 评估**
- [ ] AC-2 单测池（`is_test_pool=true`）对**每个档位**跑通派场：`venueAssignmentStatus !== 'unassigned'` 且 `reason !== 'budget_mismatch'`
- [ ] AC-3 机器人样本覆盖**全量注册表**（修 `matchingTestService.ts:69` 缺 `150以下` 的缺陷）
- [ ] AC-4 档位下发**永不为空**；resolver 故障 → fail-open 全量注册表（契约测试）
- [ ] AC-5 注册写入拒绝非注册表值 → `INVALID_BUDGET_TIER`；缺档位 → `BUDGET_TIER_REQUIRED`
- [ ] AC-6 `venues.budget_categories` 与注册后数据值 100% ∈ 注册表
- [ ] AC-7 `bar`/`homebar` 无 `dining_*` 档位（数据质量 error 规则通过）
- [ ] AC-8 派场：组共识仅 `150以下` 时**不再** `budget_mismatch`（有 ≤1 档邻近场地则就近放行 + 披露；无则 `venue_tbd`）
- [ ] AC-9 移除 `venueAssignmentService.ts:270-273` 不对称分支后，**新增测试真实执行 `scoreVenueForGroup` 预算路径**并证明空共识组不再获无条件 +40（**不得**引用「原有 9 场景全绿」——该套件内联重实现 helper，删除后仍全绿）
- [ ] AC-10 `flowConfig.ts` 无 `匹配/配对` 可见文案；标签含单位后缀；`getStepReactionLine` 使用 label 而非 raw value
- [ ] AC-11 守卫脚本在注册表外出现档位字面量时失败；基线仅含 grandfathered 旧值
- [ ] AC-12 人工派场候选按档位距离排序；超一档需理由且审计留痕

---

## 11. 指标

**发布前（staging / 单测池，今天即可跑）**

| 指标 | 定义 | 门槛 |
|---|---|---|
| 死档位数 | `城市 × 局型 × 档位` 中 **active 且档期匹配**（JOIN `venue_time_slots`，含 `dayOfWeek`/`specificDate`）场地数 = 0 的数量；**按测试池 `dateTime` 评估** | **0**（允许 M0 书面白名单） |
| 派场覆盖率 | 逐档位跑单测池的自动派场成功率 | **100%** |
| 词汇守卫 | 注册表外的档位字面量数 | **0** |
| id 合法率 | `budget_tier_ids`/`budget_categories` 值 ∈ 注册表 | **100%** |

**发布后**

| 指标 | 来源 | 目标 |
|---|---|---|
| `budget_mismatch` 占未派场原因比 | `unassignedBreakdown` | **→ 0%**（≥1 告警） |
| 地点待定渲染数 | 客户端埋点 | **0** |
| 预算步注册完成率 | 注册漏斗 | **不降**（受 ceremony 约束） |
| 需求 vs 供给分布 | 注册 + `event_pool_groups.venue_id` | 招商 BD 输入 |
| 人工派场工时 / 周 | 运营流程 | ≥90% 下降 |

基线：**无线上基线**，以 staging 单测池建立。

---

## 12. 风险

| # | 风险 | 级别 | 缓解 |
|---|---|---|---|
| R1 | 薄供给：唯一餐厅掉线 = 档位静默死亡 | **高** | 城市级下发 + 每城每档位 ≥2 场地 SLA |
| R2 | 静默失效（手写 SQL / duck-typed 数据质量），范围含 `event_pool_registrations` 仓储 | **高** | 显式往返测试（**注册仓储，非 `venuesRepo`**）+ 数据质量 error + ratchet |
| R3 | `DROP` 与「停止引用旧列的代码」同期 → 旧代码 schema 命名被删列 → 拒绝启动 | **高** | 三段式，`DROP` 放 R3 且独立发布 |
| R10 | **夜间跨零点档期窗口不可匹配**（`seed_venue_batch_and_co_20260608.sql:46-52` 的 `20:00–02:00` vs 谓词 `venueAssignmentService.ts:128-129,140-141`） | **高** | **已决议 (a)**（2026-09-16）：重写种子为同日可匹配窗口 + 测试（T1a） |
| R4 | 收紧校验打断陈旧客户端 / 盲盒自由字符串 | 中 | 先上客户端与归一化器，再收紧 |
| R5 | 微信提审文案暴露 | 中 | 独立 commit 全文清理（排桌词表） |
| R6 | `event_pools.event_type` 中英值域分歧（`饭局/酒局` vs `dining/drinks`） | 中（潜在，`待验证`） | 待验证；`adminEventPools.ts:29` 加枚举 + 派场前归一化 |
| R7 | 下发 resolver 给注册带来延迟/失败 | 中 | 按 `城市 × 局型` 缓存；fail-open |
| R8 | 幽灵 `budgetRestrictions` 被后人「补完」 | 中 | 删列或注释「有意不实现」+ 守卫 |
| R9 | 测试夹具共享同一缺陷 | 中 | 机器人采样全量注册表（AC-3） |

---

## 13. 待决事项 / 阻塞项

| # | 事项 | 归属 | 状态 |
|---|---|---|---|
| **B1** | **Step 0：运营提供 6 个场地的真值（venueType / 档位 / 单位）+ 每档位覆盖计划 + 档期覆盖确认**（每个测试池 `dateTime` 必须被该档位 ≥1 个 slot 覆盖） | 运营 / PM | **阻塞发布** |
| B2 | `弥所` / `Bruma` / `Max` 真实人均价。**2026-09-16 运营决议：三家按 `≤150 人均` 假设 → `drinks_80_150`**，标 `ASSUMED_PENDING_VERIFICATION`（**非核实真值，须后续复核**） | 运营 | **已决议（假设）** |
| B3 | 盲盒 `100-200` 无规范对应值（横跨 `150以下`/`150-200`）→ 显式映射或判定非法 | 产品 | 待定 |
| B4 | 「最多跨一档」政策确认（代价：`150以下` 在有廉价餐厅前走不通） | 产品 | 待确认 |
| B5 | 档位是否 `min(1)` 必填 + 是否 `max(1)`（UX 单选） | 产品 | 待确认 |
| B6 | 下发集合挂在哪个端点（`GET /api/event-pools/:id` 还是 shell 载荷） | 后端 | `待验证` |
| B7 | `event_pools.event_type` 是否存在英值写入。DB 列**无约束**（`_definitions.ts:399`，注释含第三值 `其他`），而派场用严格 `=== "酒局"` → `其他` 被静默当饭局 | 后端 | **M0 前必须验证** |
| **B-NEW-1** | 夜间跨零点档期窗口不可匹配（Batch & Co `20:00–02:00` 永久无档期） | 后端 | **已决议 (a)**（2026-09-16）：重写种子为同日窗口 → T1a |
| **B-NEW-5** | **重打标不能单独上线**：`venueAssignmentService.ts:275` 裸字符串比较 + `:286` 零重叠硬失败 → 场地改 id 而注册侧仍旧标签 ⇒ 每组 `budget_mismatch` | 后端 | **T1 已拆为 T1a（激活）/ T1b（重打标，与 T6+T7 同发布）** |
| **N1** 🔴 | **`/api/test/admin/*` 无鉴权且在所有环境注册**：`testAdmin.ts:5` 导入 `requireAdmin` 却**从未作为中间件使用**（`:66,75,91,113,132` 均为裸 handler）；`routes.ts:206` 无条件注册。可写任意 `event_type`/`date_time`，另有 `/users` 与 `/reset`。nginx `location /api/` 未拦截 `/api/test` | **安全** | ✅ **已修复（2026-09-16）**：5 条 `/api/test/admin/*` + `requireAdmin, requireSuperAdmin`；social-icebreaker 两条 + `requireAdmin`（保留生产 403）；6 条审计日志。**另修 `/api/test/single-test/reset`（此前匿名可变数据）**。根因：`adminRbacCoverage.test.ts:102` 只过滤 `/api/admin` → `/api/test/admin/*` 结构性不可见。新增 `testAdminAuth.test.ts`（10 tests，路由内省 + 源码扫描，新路由自动覆盖）。**OQ-1 待决**：生产是否保留（runbook §B 记载可用） |
| **N2** 🟠 | `venue_time_slot_bookings.booking_date` 继承 B8 偏移（`venueAssignmentService.ts:474`）| 后端 | ✅ 随 B8 已修（`parseEventDate` 现返回本地 `dateStr`） |
| **N3** 🟡 | 读侧英文词汇：`poolCardCopyWorker.ts:122` 比较 `dinner`/`drinks` 对中文列 → 文案恒降级为「活动」；`venueMatchingService.ts:179,185` 用 `dining` | 后端 | 与 B7 写入层收紧一并处理 |
| **B-NEW-2** | AC-9 原证据结构性无效（套件从不 import `scoreVenueForGroup`，假阴性） | 后端 | 已修订契约，待 **T7** 实施 |
| **B-NEW-3** | 错误码可能永不发射（`lib/eventPoolRegistration.ts:154` 抛无码 `Error`） | 后端 | 已修订契约，待 **T6** 实施 |
| **B-NEW-4** | `已下发档位` 在 M1 未定义（resolver 属 M2） | 后端 | 已修订（AC-1） |
| **B8** | ✅ **已核实为真（局部证实）**：`event_pools.date_time` 是 **`timestamp without time zone`**；Drizzle 写入用 `value.toISOString()` → 存**真 UTC**（本地 CST 19:30 → 存 `11:30`）。而 `parseEventDate`（`venueAssignmentService.ts:34-38`）把存储值当**本地墙钟**读 → **−8h 偏移**（本地 `00:00–08:00` 事件另有 **±1 天**）。实证：`冒烟测试饭局` 行 `date_time = created_at + 7d − 8h` | 后端 | ✅ **已修复（2026-09-16）**：新增 `apps/server/src/lib/eventDateTime.ts`（显式 `+8h` + `getUTC*`，**TZ 无关**）；`parseEventDate` 委派并保留导出面；venue 测试 **47/47** 绿。**修复后 T0 的 Q5 覆盖校验（本地墙钟语义）与代码一致 → AC-1 可签署**。残留：legacy 混约定行须按该契约 §7 检测/归一化（staging/prod `待验证`） |

---

## 14. 明确不做

1. ❌ DB 码表 `budget_tiers`（会漂移、绕开文案治理、热路径多一次读）。
2. ❌ 现在就建 `venue_budget_tiers` 关联表（零能力增益；待每档位条款）。
3. ❌ 每档位元数据列（佣金 / 最低消费 / `event_type` 列）。
4. ❌ 复活 `event_pools.budgetRestrictions` 作为 L1 闸门（切碎薄池）。
5. ❌ 本轮把预算做进 7D 匹配维度（pair 分数神圣）。
6. ❌ 用邻接放行**掩盖**供给缺口（供给收敛才是诚实修复）。
7. ❌ 新增注册步骤/滚动/必填额外输入。
8. ❌ 双写 `price_range` / `bar_price_range`。
9. ❌ 修改已应用的历史种子文件。
10. ❌ 以档期过滤档位下发（把可用性问题藏在错误层）。
11. ❌ 自动给场地打档位标签（会规模化复制「弥所」类脏数据）。

---

## 15. 执行顺序

| 序 | 动作 | 前置 | 归属 |
|---|---|---|---|
| 0 | **B1 运营场地真值 + 覆盖计划** | — | 运营 / PM |
| 1 | Step 1+2：一条幂等 SQL（种子 `active` + 档位 id 重打标） | 0 | backend |
| 2 | Step 3：`packages/shared/src/budgetTiers.ts` 注册表 + 归一化器 | 0 | shared / backend |
| 3 | Step 7(a)：数据质量升 error + 命名空间规则 | 2 | backend |
| 4 | **MVP 上线（免 DDL，先修漏斗）** | 1–3 | — |
| 5 | Step 4：客户端/后台绑注册表（含排桌文案独立 commit） | 2 | taro / admin |
| 6 | Step 5：服务端枚举 + 错误码 | 5 | backend |
| 7 | Step 6：城市级下发 resolver + 派场诊断（flag 默认关） | 1,2 | backend |
| 8 | Step 7(b,c)：守卫脚本 + 指标 | 2 | observability |
| 9 | Q11-R1..R3：三段式迁移（列合并 → 双跑 → 收紧 → DROP） | 4–8 | backend / dba |
| 10 | Step 8 关联表（触发式，非本次） | 每档位条款出现 | — |
