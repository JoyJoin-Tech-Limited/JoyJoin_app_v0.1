# 预算档位 T0 — 运营场地真值 + 每档位覆盖工作表（M0 闸门）

- **日期：** 2026-09-16
- **任务：** T0（`docs/design/budget-tier-implementation-plan-20260916.md:35`，归属 `@product-manager` + 运营）
- **状态：** 待运营填写与签核 → **M0 闸门**
- **设计依据：** `docs/design/budget-tier-architecture-spec-20260916.md` §4 / §10 / §11 / §13
- **实施计划：** `docs/design/budget-tier-implementation-plan-20260916.md` T0、§4 M0、§7.1、§7.8
- **Sprint Contract：** `.git/.orchestration/sprints/sprint-contract.budget-tier-architecture-20260916.md`（AC-1 修订措辞、Blocker B1）
- **阻塞链：** B1 → 本表。**代码无法制造供给**（spec `:141`）。

> **硬规则（不可违反）：** 本工作表**不允许**由 agent 或任何人代为填写预算档位与价格。
> 只允许填写**仓库/种子 SQL 中字面存在**的值，并一律标注 `[repo-derived · 待运营确认]`。
> 一切需要现实世界答案的字段（真实每杯/每人价格、能否服务某档、合同阶段）**留空**，由运营填写。

> ⚠️ **2026-09-16 修订通告（Q3 / B2）**：酒局单位已由「每杯（`per_drink`）」**修订为「每次人均（`per_person`）」**（依据：本批种子源自点评调研，其值为人均而非每杯；Max 电音夜店 `300-500` 作每杯不合理）。
> 因此本文中除**对现存代码的引用**（如 `_definitions.ts:483,1265`、`venueConstants.ts:83-84` 的 `/杯`，属**待 T5a 修正的旧语义**）外，**所有「每杯」应读作「每次人均」**。
> 同时 B2 已由运营决议：**弥所 / Bruma / Max 按 `≤150 人均` 假设 → `drinks_80_150`**，标 `ASSUMED_PENDING_VERIFICATION`（非核实真值，须复核）。
> 已知矛盾之处（弥所）标注 **REQUIRES OPS TRUTH**，**不得猜测**。
> 违反此规则 = 规模化复制「弥所」脏数据（spec §14.11）。

---

## 1. 目的 + 签核块

### 1.1 本工作表解决什么

T0 是整条预算档位链路的**唯一硬阻塞**。它产出三样东西：

1. **6 个种子场地的运营真值** — 局型归属、命名空间档位 id、**单位**（/人 vs /杯）、真实价格、合同阶段。
2. **每档位覆盖计划** — 对 `城市 × 局型 × 档位` 全注册表，逐行给出「覆盖场地」或「零覆盖处置决定」。
3. **档期覆盖确认（B1 追加交付物）** — 每个测试池 `dateTime` 必须被该档位 ≥1 个 `venue_time_slots` 覆盖；含只读 SQL 包。

> 本工件**不含代码、不含迁移**。它冻结的是**数据与决定**，供 T1（SQL 重打标）与 T2（注册表）消费。

### 1.2 签核块（全部填写后 M0 才算通过）

| 角色 | 姓名 | 签核范围 | 签名 | 日期 |
|---|---|---|---|---|
| 运营负责人（Venue Ops Lead） | ________________ | §2 真值表 · §4 覆盖计划 · §3 弥所缺陷 · §5 档期缺口确认 | ________________ | ______ |
| 产品负责人（PM / Owner） | ________________ | §7 B3/B4/B5/B6 · §2 单位与命名空间政策 | ________________ | ______ |
| 后端负责人（Backend Lead，咨询） | ________________ | §7 B7 验证结论 · §6 B-NEW-1 选项技术后果 | ________________ | ______ |
| 数据执行人（SQL 留档） | ________________ | §8 SQL 输出已附档（Q1–Q9） | ________________ | ______ |

**「已签核」解锁什么：**

```
V1 @verifier ACK（已达成：ACK-with-amendments，见 Contract 状态行）
        +
T0 本表签核（M0 退出）
        ↓
T1（种子 active + 重打标 SQL）与 T2（budgetTiers 注册表）解锁
        ↓
T2 解锁下游 T3 / T5a / T7 / T8（DAG：plan §3）
```

> 依据：plan `:223` —「仅在 V1 ACK 且 T0 签核后 → @backend-engineer 启动 T2」。

---

## 2. 场地真值表

**场地数量：6**（5 + 1，已核对种子文件）：
`seed_venue_partners_20260602.sql` 写入 5 家（ids `…0001`–`…0005`，`:17-72`）；
`seed_venue_batch_and_co_20260608.sql` 追加 1 家（id `…0006`，`:17-28`）。

### 2.1 真值表（主表）

> 图例：✅ = 仓库值明确且与命名空间一致（仍需运营确认） · ⛔ = **REQUIRES OPS TRUTH**（仓库值已知矛盾或缺失） · ⬜ = 运营必填
> `evidence/source` 缩写：`P:行` = `seed_venue_partners_20260602.sql`；`B:行` = `seed_venue_batch_and_co_20260608.sql`；`S:行` = `seed_venue_time_slots_20260602.sql`

| id | name | venue_type | city/area | partner_status | onboarding_status | current price_range | current budget_categories | proposed tier ids | unit | evidence/source | confidence | ⬜ ops truth required | ops sign-off |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `…0001` | 弥所 | `bar` | 深圳 / 南山区 | `active` | **`draft`** ⚠️ | `150-200` | `{150-200}` | `drinks_80_150` ⚠️**假设** | `per_person` | P:19-27（type `:19`，价 `:22`，draft `:26`） | 仓库值明确 · 归类矛盾 · **已按运营假设重打标** | ⚠️ **ASSUMED ≤150 人均**（待复核）③ 合同阶段 ⬜ | ⬜ |
| `…0002` | T馆·艺术餐厅 | `restaurant` | 深圳 / 南山区 | `active` | **`draft`** ⚠️ | `200-300` | `{200-300}` | ✅ `dining_200_300` | ✅ `per_person` | P:30-38（type `:30`，价 `:33`，draft `:36`） | 高 · 待运营确认 | ① 真实人均价区间确认？ ② 合同阶段/到期日？ ③ 是否仍为唯一餐厅？ | ⬜ |
| `…0003` | Bruma | `bar` | 深圳 / 福田区 | `active` | **`draft`** ⚠️ | `150-200` | `{150-200}` | `drinks_80_150` ⚠️**假设** | `per_person` | P:41-49（type `:41`，价 `:44`，draft `:47`） | 仓库值明确 · 归类矛盾 · **已按运营假设重打标** | ⚠️ **ASSUMED ≤150 人均**（待复核）② 仅 Wed/Thu/Sun 档期是否维持？ | ⬜ |
| `…0004` | Max Shenzhen | `bar` | 深圳 / 福田区 | `active` | **`draft`** ⚠️ | `300-500` | `{300-500}` | `drinks_80_150` ⚠️**假设** | `per_person` | P:52-60（type `:52`，价 `:55`，draft `:58`） | 仓库值明确 · 归类矛盾 · **已按运营假设重打标** | ⚠️ **ASSUMED ≤150 人均**（仓库 `300-500` → 大幅下调，**最需复核**） | ⬜ |
| `…0005` | Delete Bar大喇叭精酿 | `bar` | 深圳 / 南山区 | `active` | **`draft`** ⚠️ | `80-150` | `{80-150}` | ✅ `drinks_80_150` | ✅ `per_person` | P:63-71（type `:63`，价 `:66`，draft `:69`） | 高 · 待运营确认 | ① 真实人均价确认？ ② 合同阶段？ | ⬜ |
| `…0006` | Batch & Co | `bar` | 深圳 / 福田区（cluster `futian`，district `meilin`） | `active` | **`draft`** ⚠️ | `80-150` | `{80-150}` | ✅ `drinks_80_150` | ✅ `per_person` | B:18-27（type `:18`，价 `:22`，draft `:26`） | 高 · 待运营确认 · **档期不可匹配**（B-NEW-1） | ① 真实人均价？ ② 营业时间 `20:00–02:00` 是否能改为同日可匹配窗口？（B-NEW-1，见 §6）③ 合同阶段？ | ⬜ |

**表中 `unit` 的仓库依据：** `apps/admin-client/src/pages/admin/venueConstants.ts:75-79`（`RESTAURANT_PRICE_RANGES` 全部 `/人`）、`:81-84`（`BAR_PRICE_RANGES` 全部 `/杯`）；schema 注释亦一致：`packages/shared/src/schema/_definitions.ts:1258`（餐厅 `/人` vs 酒吧 `/杯`）、`:1265`（`barPriceRange` … 每杯）。
**规范决策佐证：** spec Q3（`…architecture-spec…:63`）— 酒局单位 = 每杯。

### 2.2 逐场地证据与开放问题（可打印填写页）

> 运营在此页逐条作答；答案回填到 §2.1 的 ⬜ 列。

**⬜ 弥所（id `…0001`）— 最高优先级**
- [ ] 真实**每杯**价格区间：`________`（**不得沿用 `150-200` 作猜测**）
- [ ] 归属：☐ 落回 `drinks_80_150` ☐ 新增酒局档 `drinks_150_200` ☐ 其他 `________`（= B2）
- [ ] 合同阶段：☐ `contract_start_date` / `contract_end_date` = `________` / `________`
- [ ] 备注：`____________________________________________`

**⬜ T馆·艺术餐厅（id `…0002`）**
- [ ] 真实人均价区间确认：☐ 维持 `200-300` ☐ 修正为 `________`
- [ ] 合同阶段：`________` / `________`
- [ ] 是否仍为**唯一**餐厅场地：☐ 是 ☐ 否（新增 `________`）

**⬜ Bruma（id `…0003`）**
- [ ] 真实**每杯**价：`________`
- [ ] 酒局档位归属：☐ `drinks_80_150` ☐ `drinks_150_200` ☐ 其他 `________`
- [ ] 档期：☐ 维持仅 周三/周四/周日 ☐ 扩展至 `________`
- [ ] 合同阶段：`________` / `________`

**⬜ Max Shenzhen（id `…0004`）**
- [ ] 真实**每杯**价：`________`
- [ ] 酒局档位归属：☐ 需新增酒局档 `________` ☐ 其他 `________`
- [ ] 合同阶段：`________` / `________`

**⬜ Delete Bar大喇叭精酿（id `…0005`）**
- [ ] 真实每杯价：☐ 维持 `80-150` ☐ 修正 `________`
- [ ] 合同阶段：`________` / `________`

**⬜ Batch & Co（id `…0006`）**
- [ ] 真实每杯价：☐ 维持 `80-150` ☐ 修正 `________`
- [ ] 营业窗口决策：☐ 选项 (a) 重写种子为同日可匹配 ☐ 选项 (b) 谓词加跨零点（B-NEW-1，见 §6）
- [ ] `area='福田区'` 与 `district_id='meilin'` 是否影响城区派场过滤？（`venueAssignmentService.ts:342` 用 `venues.area = poolDistrict`）
- [ ] 合同阶段：`________` / `________`

### 2.3 全场地共性缺陷（必须由 T1 修复，M0 需知晓）

| 缺陷 | 证据 | 影响 | 归属 |
|---|---|---|---|
| 6/6 场地 `onboarding_status='draft'`，而派场要求 `='active'` | 种子 P:26 / B:26；`venueAssignmentService.ts:344,352` | **派场候选集恒为空** → 所有档位都「无覆盖」 | T1（幂等 SQL 改 `active`，Q1 决策，spec Q1） |
| `contract_end_date` 全为 `NULL` | P:26-27 / B:26-27 对应列为 `NULL` | 合同过滤 `IS NULL OR >= CURRENT_DATE` 放行（`:346,354`）→ 需运营确认真实到期日 | 运营填 §2.1 |
| 全部 `partner_status='active'` | P:25 / B:25 | 已满足过滤 | — |
| 全部 `is_active=true` | P:23 / B:23 | 已满足过滤 | — |

---

## 3. 已知缺陷专项（弥所）— REQUIRES OPS TRUTH

> **这是本工作表存在的根本原因**（spec §14.11「自动给场地打档位标签会规模化复制『弥所』类脏数据」）。

### 3.1 缺陷事实

| 项 | 值 | 证据 |
|---|---|---|
| `venue_type` | `bar` | `seed_venue_partners_20260602.sql:19` |
| `budget_categories` | `{150-200}` | 同文件 `:22` |
| 命名空间判定 | `150-200` 属**饭局梯**（`dining_150_200`） | spec §4 / `_definitions.ts:1258` 注释 |
| 矛盾 | **酒吧持有饭局档位** → 违反 AC-7（`bar`/`homebar` 不得含 `dining_*`） | 契约 AC-7；spec §1.3 |
| 连带失效 | 饭局派场只允许 `restaurant`/`cafe`（`venueAssignmentService.ts:335-337`）→ 弥所的 `150-200` 对饭局**不可用**；酒局梯又没有 `150-200` → 对酒局**也不可用** | `:335` |

### 3.2 运营必须二选一（B2）

| 选项 | 含义 | 后果 |
|---|---|---|
| **A. 判定为酒局档** | 弥所真实是每杯 `80-150` → 重打标 `drinks_80_150` | 酒局 `80-150` 供给从 2 → 3 家（但 Batch 档期待修，见 §6） |
| **B. 新增酒局档** | 弥所真实每杯 `150-200` → 注册表新增 `drinks_150_200`（`order=2`，预留命名空间） | 酒局梯多一档 → 触发 spec §4 注册表扩展；AC-1 需为新增档位补覆盖评估 |

> ⚠️ **禁止**由 agent 或 PM 推断选项。必须由运营提供**真实每杯价**（§2.2 填空）后决定。

---

## 4. 档位注册表 id 冻结 + 每档位覆盖计划

### 4.1 档位 id 冻结（M0 退出条件之一）

> 依据 spec §4。`order` 从 0 起，0 = 最便宜。挂冻结后 **T1 的 SQL 与 T2 的注册表共享同一份 id 集合**（plan §7.2 指出二者发散会使 AC-6 失败且 T1 需重做）。

| tier id | eventType | label | unit | min | max | order | 冻结状态 |
|---|---|---|---|---|---|---|---|
| `dining_150_below` | 饭局 | `150以下` | `per_person` | `null` | 150 | 0 | ☐ 冻结 |
| `dining_150_200` | 饭局 | `150-200` | `per_person` | 150 | 200 | 1 | ☐ 冻结 |
| `dining_200_300` | 饭局 | `200-300` | `per_person` | 200 | 300 | 2 | ☐ 冻结 |
| `dining_300_500` | 饭局 | `300-500` | `per_person` | 300 | 500 | 3 | ☐ 冻结 |
| `drinks_80_below` | 酒局 | `80以下` | **`per_person`** | `null` | 80 | 0 | ☐ 冻结 |
| `drinks_80_150` | 酒局 | `80-150` | **`per_person`** | 80 | 150 | 1 | ☐ 冻结 |
| `drinks_150_200`（**预留，未启用**） | 酒局 | `150-200` | **`per_person`** | 150 | 200 | 2 | ☐ 保持预留（B2 已决议：≤150 假设，**未启用**） |

**标签来源：** 饭局 `150以下/150-200/200-300/300-500` = `apps/mini-program/src/pages/pool-registration/flowConfig.ts:36-41`；酒局 `80以下/80-150` = 同文件 `:43-46`。
**预留命名空间做法：** B2 若选「新增酒局档」，`drinks_150_200` 追加时**不得重排既有 `order`**（plan §7 滑期兜底 `:206`）。

### 4.2 每档位覆盖计划（`城市 × 局型 × tier`）

> **规则：** 「覆盖场地」列仅为**仓库最佳努力**（`[repo-derived · 待运营确认]`，未确认）。零覆盖行必须在 **decision** 列三选一：
> `招募新场地` / `接受并列入白名单` / `调整档位`。
> **本表不产生任何未经运营确认的覆盖结论。**

#### 深圳 × 饭局（allowed venue types = `restaurant`/`cafe`，`venueAssignmentService.ts:337`）

| tier id | 覆盖场地（仓库·未确认） | 数量 | 档期匹配 | decision（运营填） | 备注 |
|---|---|---|---|---|---|
| `dining_150_below` | **无** | **0** | — | ☐ 招募新场地 ☐ 白名单 ☐ 调整档位 | **结构性缺口**（唯一餐厅 T馆 为 `200-300`） |
| `dining_150_200` | **无**（弥所虽持此标签，但是 `bar`，饭局不可用） | **0** | — | ☐ 招募新场地 ☐ 白名单 ☐ 调整档位 | **结构性缺口**（同上） |
| `dining_200_300` | T馆·艺术餐厅（`…0002`） | 1 | 7/7 天 18:00–23:00 | ☐ 已确认 ☐ 需补第 2 家 | 单点供给风险（spec R1「每城每档位 ≥2 场地 SLA」） |
| `dining_300_500` | **无**（Max 持此标签，但是 `bar`，饭局不可用） | **0** | — | ☐ 招募新场地 ☐ 白名单 ☐ 调整档位 | **结构性缺口**（verifier 已独立证实「T馆 为唯一餐厅时 ≥3 硬死档」，契约 Negotiation Log `:109`） |

#### 深圳 × 酒局（allowed venue types = `bar`/`homebar`，`venueAssignmentService.ts:335-336`）

| tier id | 覆盖场地（仓库·未确认） | 数量 | 档期匹配 | decision（运营填） | 备注 |
|---|---|---|---|---|---|
| `drinks_80_below` | **无** | **0** | — | ☐ 招募新场地 ☐ 白名单 ☐ 调整档位 | 低价酒局无供给 |
| `drinks_80_150` | Delete Bar大喇叭精酿（`…0005`）、Batch & Co（`…0006`） | 2（**实际可用 1**） | Delete 7/7 天 18:00–23:00；**Batch 7× `20:00–02:00` 全部不可匹配** | ☐ 已确认 ☐ 需补第 3 家 | Batch 档期问题见 §6（B-NEW-1） |
| `drinks_150_200`（预留） | **未启用** | — | — | ☐ 待 B2 决定是否启用 | 若 B2 选 B → 弥所可能落此档 |

#### 香港 × 饭局 / 香港 × 酒局（全注册表）

| 城市 × 局型 | tier id | 覆盖场地 | 数量 | decision（运营填） | 备注 |
|---|---|---|---|---|---|
| 香港 × 饭局 | `dining_150_below` … `dining_300_500`（4 档） | **无种子场地** | 0 | ☐ 招募新场地（城市扩张） ☐ 该城市暂不开放注册 | `venueConstants.ts:70-73` 含 `香港` 城市项；`matchingTestService.ts:61` 含香港区县，但**零种子场地** |
| 香港 × 酒局 | `drinks_80_below`、`drinks_80_150`（2 档） | **无种子场地** | 0 | ☐ 招募新场地（城市扩张） ☐ 该城市暂不开放注册 | 同上 |

> **AC-1 修订措辞的应用（必须明示）：** 按修订后的 AC-1，M1 以**全量注册表**评估，判定标准是「无**代码造成**的死档位」；「每个档位都有真实供给」降为 **M0 运营指标**，**允许书面零供给白名单**。
> 因此上文 `dining_150_below` 与 `dining_150_200` 的零覆盖是**结构性预期**（仓库内唯一餐厅 T馆为 `200-300`），**必须**通过下列之一收口：
> **(1) 签下新场地**（招募），或 **(2) 书面白名单**（在 decision 列勾选「白名单」并在 §8 附注长期无覆盖说明）。
> `dining_300_500` 属**同类**结构性缺口，同样处理。（契约 `:20`；spec §6 必然残余注 `:141`。）

---

## 5. 档期覆盖确认（B1 必交交付物）

> **为什么必须有这一节：** `active` ≠ 有档期。`checkTimeSlotAvailability`（`venueAssignmentService.ts:114-142`）按 `dayOfWeek` + 时间窗把无匹配槽位的场地**排除**；而 B1 原交付物完全没有档期（plan §7.1 `:191`）。AC-1 判定必须 **JOIN `venue_time_slots`**。

### 5.1 列语义（已核实）

| 列 | 类型 | 语义 | 证据 |
|---|---|---|---|
| `day_of_week` | `integer`（可空） | 0=周日 … 6=周六；周循环模式 | `packages/shared/src/schema/_definitions_extended.ts:430` |
| `specific_date` | `date`（可空） | 具体日期模式；与 `day_of_week` 二选一 | `:431` |
| `start_time` / `end_time` | **`varchar`**（`NOT NULL`） | `"HH:MM"` 字符串；**字典序比较** | `:434-435` |
| `is_active` | `boolean` | 参与匹配 | `:441` |

> ⚠️ **谓词真相：** 应用用 `startTime <= timeStr AND endTime >= timeStr`（`venueAssignmentService.ts:128-129,140-141`）。因两列是 `varchar`，比较是**字典序**；当 `start_time > end_time`（跨零点）时该不等式**对任何 `t` 都无解**。
> ⚠️ **时区注意（验证方法提醒，非决策）：** `parseEventDate` 用 `toISOString()` 取 `dateStr`/`timeStr`（`:34-36`），即 **UTC**；而 `dayOfWeek` 由解析出的年/月/日重建（`:37-38`）。请在跑 Q5 时同时用「本地墙钟」与「UTC」两种解释比对，尤其针对 00:00–08:00 的事件。

### 5.2 SQL 包（只读，Q3–Q6）

**Q3 — 逐场地档期清单（天 × 时间窗）**

```sql
SELECT v.id, v.name, v.venue_type,
       COALESCE('DOW:' || s.day_of_week::text, 'DATE:' || s.specific_date::text) AS day_key,
       s.start_time, s.end_time, s.max_concurrent_events, s.is_active, s.notes
FROM venues v
LEFT JOIN venue_time_slots s ON s.venue_id = v.id
WHERE v.id IN (
  '550e8400-e29b-41d4-a716-446655440001','550e8400-e29b-41d4-a716-446655440002',
  '550e8400-e29b-41d4-a716-446655440003','550e8400-e29b-41d4-a716-446655440004',
  '550e8400-e29b-41d4-a716-446655440005','550e8400-e29b-41d4-a716-446655440006'
)
ORDER BY v.name, s.day_of_week NULLS LAST, s.start_time;
```

**Q4 — 逐场地档期聚合 + 缺口探测（Bruma 天数 / 零 `specific_date` / 跨零点）**

```sql
SELECT v.name,
       count(DISTINCT s.day_of_week) FILTER (WHERE s.day_of_week IS NOT NULL) AS weekly_days,
       count(*) FILTER (WHERE s.specific_date IS NOT NULL)                     AS specific_date_rows,
       count(*) FILTER (WHERE s.is_active)                                     AS active_slots,
       count(*) FILTER (WHERE s.start_time > s.end_time)                       AS cross_midnight_slots,
       min(s.start_time) AS earliest_start, max(s.end_time) AS latest_end
FROM venues v
LEFT JOIN venue_time_slots s ON s.venue_id = v.id
WHERE v.id LIKE '550e8400-e29b-41d4-a716-44665544000%'
GROUP BY v.id, v.name
ORDER BY v.name;
```

**Q5 — 给定测试池 `dateTime` 的逐档位覆盖（AC-1 判定查询）**

> 用法：替换 `:pool_datetime`（本地墙钟，如 `2026-09-16 19:00`）。此查询镜像 `checkTimeSlotAvailability` 的 OR 语义（周循环 OR 具体日期）与谓词，并 JOIN 出每档位可用场地数。

```sql
WITH p AS (
  SELECT :'pool_datetime'::timestamp            AS dt,
         EXTRACT(DOW FROM :'pool_datetime'::timestamp)::int AS dow,
         to_char(:'pool_datetime'::timestamp, 'HH24:MI')    AS t,
         :'pool_datetime'::date                    AS d
),
slot_ok AS (
  SELECT DISTINCT s.venue_id
  FROM venue_time_slots s, p
  WHERE s.is_active = true
    AND (s.day_of_week = p.dow OR s.specific_date = p.d)
    AND s.start_time <= p.t
    AND s.end_time   >= p.t
)
SELECT t.tier,
       count(DISTINCT v.id) AS venues_with_slot,
       string_agg(DISTINCT v.name, ', ' ORDER BY v.name) AS venue_names
FROM venues v
JOIN p ON true
JOIN slot_ok ON slot_ok.venue_id = v.id
CROSS JOIN LATERAL unnest(v.budget_categories) AS t(tier)
WHERE v.is_active = true
  AND v.onboarding_status = 'active'
  AND v.partner_status = 'active'
  AND (v.contract_end_date IS NULL OR v.contract_end_date >= CURRENT_DATE)
GROUP BY t.tier
ORDER BY t.tier;
```

**Q5b — 同一查询，但按 `venue_type` 过滤（局型口径，更贴近派场真相）**

```sql
-- 饭局：allowedVenueTypes = restaurant, cafe；酒局：bar, homebar（venueAssignmentService.ts:335-337）
-- 在 Q5 的 slot_ok 之后追加：
--   AND v.venue_type IN ('restaurant','cafe')   -- 饭局
--   AND v.venue_type IN ('bar','homebar')       -- 酒局
```

**Q5c — 时间-of-day 粗探针（证明 18:00–23:00 以外无场地）**

```sql
SELECT to_char(h, 'HH24:MI') AS probe_time,
       count(DISTINCT s.venue_id) AS venues_covering
FROM generate_series(timestamp '2026-01-01 00:00', timestamp '2026-01-01 23:00', interval '1 hour') h
LEFT JOIN venue_time_slots s
  ON s.is_active
 AND s.start_time <= to_char(h, 'HH24:MI')
 AND s.end_time   >= to_char(h, 'HH24:MI')
GROUP BY h
ORDER BY h;
```

**Q6 — 跨零点不可匹配窗口（B-NEW-1 证据查询）**

```sql
-- 6a：列出所有跨零点槽位（这些槽位在现行谓词下永不匹配）
SELECT venue_id, start_time, end_time, max_concurrent_events
FROM venue_time_slots
WHERE start_time > end_time;

-- 6b：证明「可匹配槽位」集合不含跨零点
SELECT count(*) AS never_matchable FROM venue_time_slots WHERE start_time > end_time;
SELECT count(*) AS matchable      FROM venue_time_slots WHERE start_time <= end_time;
```

### 5.3 已核实的档期缺口（必须记录，源自仓库）

| # | 缺口 | 仓库证据 | 影响 | 归属 |
|---|---|---|---|---|
| G-1 | **Bruma 仅 3 天有档期**（周日 `0`、周三 `3`、周四 `4`） | `seed_venue_time_slots_20260602.sql:25-27`；种子注释 `:3,24` | Bruma 在周一/二/五/六对派场**不可见** | T1（扩档期）或运营确认「仅 3 天是硬约束」 |
| G-2 | **零 `specific_date` 行**（全仓 38 个槽位全为周循环；`specific_date` 仅在 DDL 与索引出现，无种子写入） | grep：`apps/server/migrations/seed_*.sql` 无 `specific_date`；DDL `0000_hesitant_molly_hayes.sql:1126`、索引 `0050_first_sue_storm.sql:26` | 任何「具体日期例外/包场」配置无从验证；AC-1 的 `specificDate` 分支**当前空跑** | 运营填写：是否需要单次日期档期 |
| G-3 | **事件落在 `18:00–23:00` 之外则全城无场地**（Batch & Co 除外，但其窗口不可匹配 → 实为相同结论） | 5 家槽位窗 `18:00–23:00`（`seed_venue_time_slots_20260602.sql:7-44`）；Batch `20:00–02:00`（`seed_venue_batch_and_co_20260608.sql:46-52`） | 上午/午市/深夜测试池**必然** `venue_tbd` | 运营：限定测试池 `dateTime` 落在 18:00–23:00；或招募扩时场地 |
| G-4 | 种子全 `draft` 时档期**再全也会被 `:344,352` 过滤掉** | 见 §2.3 | Q3–Q5 结果须在 T1 改 `active` **之后**再复跑一次 | T1 + 运营复核 |

---

## 6. B-NEW-1 决策提示（夜间跨零点窗口）— 不代为决定

### 6.1 问题事实

| 项 | 值 | 证据 |
|---|---|---|
| 场地 | Batch & Co（`…0006`） | `seed_venue_batch_and_co_20260608.sql:18` |
| 槽位 | 7 天 × `20:00–02:00` | 同文件 `:46-52` |
| 谓词 | `start_time <= t AND end_time >= t` | `venueAssignmentService.ts:128-129,140-141` |
| 结果 | `'20:00' <= t` **且** `'02:00' >= t` → **交集为空**（`start_time`/`end_time` 为 `varchar`，见 §5.1） | verifier 独立重推导，契约 `:109` |
| 影响 | 该校 `drinks_80_150` 场地**永久无档期** → 与预算无关地压低酒局覆盖；AC-1/AC-2 可能因此失败 | 契约 `:96` |

### 6.2 两个选项（运营 + 后端共同决定，本表不裁决）

| 选项 | 做法 | 后果 | 风险 |
|---|---|---|---|
| **(a) 重写种子为同日可匹配窗口** | T1 幂等 SQL 把 `20:00–02:00` 改为同日窗口（如 `20:00–23:59`），并同步运营真实打烊时间 | 改动小、派场立即可用；语义上把「营业到 02:00」压缩为同日展示 | 若真实包场确跨零点，同日窗口会**低估**可用性，且需运营确认可接受；须更新备注 |
| **(b) 谓词加跨零点处理** | 改 `venueAssignmentService.ts:128-129,140-141`：`start <= end ? (t BETWEEN start AND end) : (t >= start OR t <= end)` | 保留真实营业语义，未来夜店/深夜场地可复用 | 触核心派场引擎（高爆炸半径）；须新增跨零点测试；UTC/本地时区问题（§5.1）会更复杂；属 T1 未列范围 → 需扩任务 |

> **决策记录：** ☐ 选项 (a)　☐ 选项 (b)　决定人：__________　日期：__________
> **若选 (b)：** 须在 T1 之外单开子契约（plan §5 `:170` 建议 T7/不可逆步骤各加子契约）。

---

## 7. 待决事项 (B2–B7 + B4/B5) — 每项一行问题 + 建议 + 归属

> 建议仅为 PM 立场，**不是决定**。运营/产品填「决定」列。

| # | 一行问题 | 建议（PM 立场） | 归属 | 决定 | 日期 |
|---|---|---|---|---|---|
| **B2** | 弥所 / Bruma / Max 真实**人均**价是多少？ | **2026-09-16 运营决议**：三家按 `≤150 人均` 假设 → `drinks_80_150`，标 `ASSUMED_PENDING_VERIFICATION`。**这不是核实真值**，须用真实菜单/人均复核。若 >150 则启用预留 `drinks_150_200`（不重排 `order`） | 运营 | ✅ 已决议（假设） | 2026-09-16 |
| **B3** | 盲盒 `100-200`（横跨 `150以下` 与 `150-200`）如何映射：显式规则还是判定非法？ | **判定不得静默映射**。两条候选路：① 写入层 fail-closed（`INVALID_BUDGET_TIER`）＋要求重选；② 历史行一次性保守归到 `dining_150_below`（≤用户原意上界，不诱导超支）。**注意两档当前均零供给（§4.2），映射选择对今日供给中性**。推荐 ① 长期 + ② 仅作历史 grandfathered | 产品 | ☐ ______ | ______ |
| **B4** | 是否确认「最多跨一档」降级政策？（代价：`150以下` 在签下廉价餐厅前仍 `venue_tbd`） | **确认**（spec Q7 / §6.3 / AC-8）。跨两档以上交人工是诚实修复，避免「降级变抬价」 | 产品 | ☐ ______ | ______ |
| **B5** | 档位是否 `min(1)` 必填 + `max(1)` 单选？ | **两者都确认**：必填保证不空（配合 `BUDGET_TIER_REQUIRED`），单选匹配现有注册表单（`flowConfig.ts:36-46` 每组单选） | 产品 | ☐ ______ | ______ |
| **B6** | 下发集合挂在哪个端点：`GET /api/event-pools/:id` 还是 shell 载荷？ | 以 **`GET /api/event-pools/:id`** 为准（注册页需该池的 `eventType` 才能定命名空间）；shell 载荷可作预取镜像。服务端按 `城市 × 局型` 缓存（spec Q5） | 后端 | ☐ ______ | ______ |
| **B7** | `event_pools.event_type` 是否曾写入英文值（`dining`/`drinks`）或第三值 `其他`？ | **M0 前必须验证**。运行 Q7；若存在 `其他`/英文值 → 写入层加枚举（`adminEventPools.ts:29` 现为 `z.string()`）＋派场前归一化。**注意 `其他` 现被静默当饭局**（`venueAssignmentService.ts:335` 仅严格判 `=== "酒局"`） | 后端 / 产品 | ☐ ______ | ______ |

**B7 验证 SQL（只读，staging + prod 各跑一次）：**

```sql
-- Q7a：event_pools 实际值域（问题原文要求）
SELECT event_type, count(*) FROM event_pools GROUP BY 1 ORDER BY 2 DESC;

-- Q7b：是否含英文/第三值（预期：仅 饭局/酒局）
SELECT DISTINCT event_type FROM event_pools
WHERE event_type NOT IN ('饭局','酒局');

-- Q7c：盲盒通道旁证（同源风险）
SELECT event_type, count(*) FROM blind_box_events GROUP BY 1 ORDER BY 2 DESC;
```

> **列约束事实（供判定时参考）：** `event_pools.event_type` 是**无约束 `varchar`**，Schema 注释含第三值 → `// 饭局/酒局/其他`（`packages/shared/src/schema/_definitions.ts:399`）；Zod 创建枚举确有 `其他`（`:918`）；后台更新用 `z.string()`（`apps/server/src/routes/domains/adminEventPools.ts:29`）。
> 排除英文值后，「是否存在 `其他`」仍需经验判断：**存在即需产品定义 `其他` 的派场归属**（当前静默=饭局）。

---

## 8. 运营 Runbook（编号执行）

> **前提：** 所有 SQL **只读**；禁止 `UPDATE/INSERT/DELETE`。T0 不产生任何数据变更。

1. **确认环境与凭据**
   - 本地：`psql "$DATABASE_URL"`（读 `.env`）。
   - staging：`postgres-staging:5432/joyjoin_staging`（在 CVM 上通过 docker exec 或 `psql` 连接）。
   - prod：CVM 上 `psql "$DATABASE_URL"`，仅 `SELECT`。
2. **跑 Q1–Q4**（场地清单 + 值域 + 档期清单 + 聚合），在 **local 与 staging** 各留一份原始输出。
3. **跑 Q5/Q5b/Q5c**：对**每个待用测试池的 `dateTime`** 替换参数执行，记录「逐档位可用场地数」。
4. **跑 Q6**：确认跨零点槽位数量与不可匹配性（B-NEW-1 证据）。
5. **跑 Q7a–Q7c**（B7）于 **staging 与 prod**；记录 `event_type` 实际值域分布。
6. **回填 §2.1**：逐场地填 `proposed tier ids` 确认 / `unit` / 真实价格 / 合同阶段 / ops sign-off；弥所按 §2.2 答题。
7. **回填 §4.2**：逐零覆盖行在 `decision` 列三选一（`招募新场地`/`白名单`/`调整档位`）；若选白名单，在 §8.2 附注长期无覆盖书面说明。
8. **确认 §5.3 缺口**（G-1/G-2/G-3/G-4），勾选处置；若测试池 `dateTime` 落在 18:00–23:00 之外，调整排期或列入白名单。
9. **裁决 §6（B-NEW-1）** 与 **§7（B2–B7）**，逐项签名 + 日期。
10. **签核 §1.2**；执行 §8.1 M0 退出清单；通知 `@backend-engineer` 启动 T1 + T2。

### 8.1 M0 退出清单（plan §4 `:146` + 本表追加项）

- [ ] **6 场地真值表签核**（§2.1 全部 ⬜ 已填，含 `unit` 与真实价格）
- [ ] **每档位供给计划**（§4.2 每行 decision 已填；含「将长期无覆盖」白名单说明）
- [ ] **档期覆盖 SQL 验证**（Q3–Q6 已跑，输出已附档；G-1..G-4 已处置）
- [ ] **档位 id 冻结**（§4.1 六 id + 预留命名空间已冻结）
- [ ] **B2/B4/B5 已决定**（§7）
- [ ] **B3/B6 已决定**（§7）
- [ ] **B7 已验证**（Q7a–Q7c 于 staging + prod；英文值/`其他` 的存在性已确认并给出归一化归属）
- [ ] **B-NEW-1 选项已裁决**（§6；若选 (b) 已创建子契约任务）
- [ ] **弥所缺陷已收口**（§3，B2 决定落地）
- [ ] **§1.2 签核块完整**

### 8.2 长期无覆盖书面白名单（运营填写）

| 城市 × 局型 × tier | 白名单理由 | 预计解除条件 | 运营签名 |
|---|---|---|---|
| ______________ | ______________ | ______________ | ______ |
| ______________ | ______________ | ______________ | ______ |
| ______________ | ______________ | ______________ | ______ |

---

## 9. 范围外提醒

- ❌ **T0 不含代码**：不改 `venueAssignmentService.ts`、不改 `venueDataQuality.ts`、不建注册表。
- ❌ **T0 不含迁移**：不改种子文件（spec §14.9），不执行 `db:push` / `db:migrate`，不动 `_journal.json`。
- ❌ **T0 不自动打档位标签**：任何档位/价格必须由运营提供（spec §14.11）。
- ❌ **T0 不决定降级政策的技术实现**：只确认政策（B4）；实现属 T7。
- ❌ **T0 不做城市扩张承诺**：香港零覆盖仅登记为决策项，不在本轮交付。
- ✅ **T0 只产出**：签核后的**数据真值** + **覆盖计划** + **决策记录**，供 T1/T2 消费。

---

## 附录 A — 只读 SQL 包汇总（可直接另存为 `t0_venue_truth.sql`）

> 全部为 `SELECT`。建议在文件头加 `BEGIN READ ONLY;` … `ROLLBACK;` 以杜绝误写。

```sql
BEGIN READ ONLY;

-- Q1 逐场地全字段清单
SELECT id, name, venue_type, city, area, district_id, cluster_id,
       partner_status, onboarding_status, is_active,
       price_range, budget_categories, bar_price_range,
       capacity, seating_capacity,
       contract_start_date, contract_end_date
FROM venues
WHERE id LIKE '550e8400-e29b-41d4-a716-44665544000%'
ORDER BY name;

-- Q2 现有档位值域（对照注册表前的基线；spec §9 前置校验）
SELECT unnest(budget_categories) AS tier, count(*) AS venue_count
FROM venues GROUP BY 1 ORDER BY 1;

SELECT count(*) FILTER (WHERE budget_categories IS NULL OR budget_categories = '{}') AS venues_without_tiers
FROM venues;

-- Q3 逐场地档期清单
SELECT v.name, s.day_of_week, s.specific_date, s.start_time, s.end_time,
       s.max_concurrent_events, s.is_active, s.notes
FROM venues v LEFT JOIN venue_time_slots s ON s.venue_id = v.id
WHERE v.id LIKE '550e8400-e29b-41d4-a716-44665544000%'
ORDER BY v.name, s.day_of_week NULLS LAST, s.start_time;

-- Q4 逐场地档期聚合 + 缺口探测
SELECT v.name,
       count(DISTINCT s.day_of_week) FILTER (WHERE s.day_of_week IS NOT NULL) AS weekly_days,
       count(*) FILTER (WHERE s.specific_date IS NOT NULL) AS specific_date_rows,
       count(*) FILTER (WHERE s.is_active) AS active_slots,
       count(*) FILTER (WHERE s.start_time > s.end_time) AS cross_midnight_slots,
       min(s.start_time) AS earliest_start, max(s.end_time) AS latest_end
FROM venues v LEFT JOIN venue_time_slots s ON s.venue_id = v.id
WHERE v.id LIKE '550e8400-e29b-41d4-a716-44665544000%'
GROUP BY v.id, v.name ORDER BY v.name;

-- Q6 跨零点不可匹配证据
SELECT venue_id, start_time, end_time FROM venue_time_slots WHERE start_time > end_time;
SELECT count(*) AS never_matchable FROM venue_time_slots WHERE start_time > end_time;

-- Q7 event_pools.event_type 值域（B7）
SELECT event_type, count(*) FROM event_pools GROUP BY 1 ORDER BY 2 DESC;

ROLLBACK;
```

> Q5（参数化覆盖查询）单独存放，因其需要按测试池 `dateTime` 逐一替换参数。

## 附录 B — 引用清单

| 引用 | 用途 |
|---|---|
| `docs/design/budget-tier-architecture-spec-20260916.md` | §4 注册表 · §10 AC · §11 指标 · §13 B1–B7/B-NEW · §14.11 禁自动打标 |
| `docs/design/budget-tier-implementation-plan-20260916.md` | T0 行 `:35` · M0 门 `:146` · §7.1 `:191` · §7.8 `:198` · 交接 `:223` |
| `.git/.orchestration/sprints/sprint-contract.budget-tier-architecture-20260916.md` | AC-1 `:20` · B1 追加交付物 `:87-92` · B-NEW-1 `:96,109` |
| `apps/server/migrations/seed_venue_partners_20260602.sql` | 5 场地真值 |
| `apps/server/migrations/seed_venue_batch_and_co_20260608.sql` | 第 6 场地 + 跨零点档期 |
| `apps/server/migrations/seed_venue_time_slots_20260602.sql` | 5 场地档期 |
| `apps/server/src/venueAssignmentService.ts` | 派场谓词 · 局型过滤 · 降级现状 |
| `packages/shared/src/schema/_definitions.ts` | venue 字段 · `event_pools.event_type` |
| `packages/shared/src/schema/_definitions_extended.ts` | `venue_time_slots` 列语义 |
| `apps/admin-client/src/pages/admin/venueConstants.ts` | 单位（/人 · /杯）· 城市 |
| `apps/server/src/services/matchingTestService.ts` | 机器人档位缺 `150以下`（AC-3） |
| `apps/mini-program/src/pages/pool-registration/flowConfig.ts` | 六套分叉词汇的来源 |
| `apps/server/migrations/20260203000000_add_venue_budget_categories.sql:40` | 过期的 `COMMENT ON COLUMN`（T1 须更新） |
