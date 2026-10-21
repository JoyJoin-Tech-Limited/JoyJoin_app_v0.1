# 转化 S8.1 — P1b 供给节律代码侧审计

> Sprint: `benchmark-full-implementation` · 任务 S8.1 · 合同 AC-11 · 执行人: backend-engineer
> 日期: 2026-10-20 · 性质: **纯 grep 审计，零文件修改，不 commit / 不 push**（本备忘是唯一产出）

---

## 0. 背景与判定标准

P1b 是**运营动作**（深圳周三/周六排期，内部承诺）。代码侧唯一硬性要求：

> 全仓不得有硬编码排期承诺文案；「每周都有局」类软表述若存在或需落地，必须走 copy 模块而非硬编码城市/星期。

判定三分类：

| 判定 | 含义 |
|------|------|
| **违规** | 用户可见文案中出现硬编码的排期承诺（固定星期 / 固定城市+周期 / 「每周都有局」类承诺） |
| **提示项** | 用户可见的周度软表述，但**非排期承诺**，且未走 copy 模块（非阻断） |
| **OK** | 内部逻辑 / 测试 fixture / 注释 / LLM few-shot / 叙事内容 / 数据派生文案 |

Harness session guard（Phase 0）:

```
node scripts/harness/harness-auto-trigger.mjs --prompt="..." --proposed-files=docs/deliberations/2026-10-20-conversion-p1b-code-audit.md
→ tier: 1 · contractRequired: false · action: PROCEED
```

审计扫描面：`apps/mini-program/src`、`apps/server/src`、`packages/shared/src`（含 `apps/server/migrations` 的种子 SQL 作为数据层旁证）。
排除：`**/__tests__/**`、`*.test.ts(x)`、`fixtures/`、`node_modules`、`dist/`、Git 历史。

---

## 1. 结论

### **PASS — 违规项 0 条。**

- **全仓无任何硬编码排期承诺文案。** 不存在「深圳周三」「每周三/六固定开局」「周周有局」「逢周三开」「固定局」等承诺式表述（含变体 `每周都` / `每周末` 承诺形态）。
- **「每周都有局」软表述目前不存在**（`都有局` / `周周` 全仓 0 命中）。即 P1b 的软表述**尚未落地到代码**，因此当前没有「该走 copy 模块却硬编码」的在案负债。
- 城市编排**不含周期承诺**：`深圳` 的硬编码只出现在三类合法位置（Flash 城市域常量 `FLASH_CITY`、场地地址目录、场地匹配城市白名单），没有一处与星期/周期绑定。
- 2 条**提示项**（非阻断，见 §5）：`HeroPromoBanner` 变体 A 的周度措辞与 `LocationFilterDrawer` 的周窗口模板，均为**组件内硬编码字符串**；两者都不是排期承诺，但若本轮统一「每周都有局」软表述，应一并迁入 copy 模块。

P1b 的「用户可见节律承诺延后、文案软表述」策略（见 `2026-10-20-conversion-final-strategy.md` §1/§7）在代码侧**已被自然满足**：因为没有一行代码提前写死了节律。

---

## 2. 方法（可复现）

```bash
# A. 排期承诺词（星期 / 周期承诺）
rg -n -e '每周|周[一二三四五六日天]|星期|逢周|固定局|都有局|周周' \
   apps/mini-program apps/server packages/shared \
   -g '!**/node_modules/**' -g '!**/dist/**' -g '!**/__tests__/**' \
   -g '!**/*.test.ts' -g '!**/*.test.tsx' -g '!**/*.spec.ts' \
   -g '!**/fixtures/**' -g '!**/__mocks__/**'
# → 54 hits

# B. 城市 + 排期组合（同一行内共现）
rg -n -e '(深圳|广州|北京|上海|杭州|成都|南山|福田|罗湖|宝安|龙岗|龙华|天河|越秀|海珠)' \
   apps/mini-program/src apps/server/src packages/shared/src \
 | rg -e '周[一二三四五六日天]|每周|星期|逢周|周周|排期|固定局|都有局'
# → 2 hits，均在测试文件（flowAnimationCopy.test.ts），判定 OK

# C. 承诺词单独收口（确认变体是否存在）
for p in '都有局' '周周' '固定局' '逢周' '每周都' '每周末' '天天有' '每周固定' '固定排期'; do ... done
# → 都有局/周周/固定局/逢周/每周都/天天有/固定排期 = 0
# → 每周末 = 1（LLM few-shot 语料）、每周固定 = 3（叙事卡 + schema 注释）

# D. 软性周表述（供「顺带查」与提示项）
rg -n -e '本周|这周|下周|周末' apps/mini-program/src packages/shared/src apps/server/src \
   -g '!**/__tests__/**' -g '!**/*.test.ts' -g '!**/*.test.tsx' -g '!**/fixtures/**'
# → 98 hits / 43 files
```

---

## 3. 命中清单 A — 排期承诺词（54 hits，逐条判定）

### 3.1 用户可见文案（需人工判断语义）

| file:line | 字符串 | 判定 | 理由 |
|---|---|---|---|
| `packages/shared/src/alang/atuanFirstAct.ts:14` | `{ id: 'private_time', label: '每周固定出现的时间', destination: 'cover' }` | **OK（叙事内容）** | 街头盲盒 NPC「阿团」第一次见面线索卡的**角色习惯**标签，非平台排期承诺。字面唯一命中「每周固定」的用户可见文案。有测试锁定（`atuan-cards/index.test.tsx:77`）。 |
| `packages/shared/src/lieDetectiveFallback.ts:126` | `'我每周六都随机坐公交玩'` | **OK（游戏内容）** | 谁是卧底 fallback 声明池里的玩家自述，「每周六」是个人习惯描述。 |
| `packages/shared/src/constants.ts:119` | `SOCIAL_FREQUENCY_OPTIONS = ["每周聚会", "每两周一次", "每月一两次", "看心情"]` | **OK（用户自述选项）** | 描述**用户自己**的社交频率，非平台供给承诺。已在 shared 常量模块而非组件内联。 |
| `apps/server/src/routes/domains/adminAlang.ts:940` | `"正式版角色的固定上线星期不能修改"` | **OK（admin 面）** | 运营后台校验错误文案，非 C 端可见。 |
| `apps/server/src/routes/domains/demo.ts:46 / 156` | `"周四 19:00 · 饭局"` / `"周三 20:00 · 酒局"` | **OK（demo 种子数据）** | demo 建局数据标题，不是承诺表述；非生产路径。 |
| `apps/server/migrations/seed_venue_partners_20260602.sql:46` + `seed_venue_partners_api.json:84` | `'仅周三、周四、周日晚间可保证留位…'` | **OK（数据层 / admin-only）** | 场地 `notes` 为运营备注。已核验：`notes` **未出现在任何 mini-program 读取路径**，也未进入 `packages/shared/src/api` 的用户 DTO → 不构成 C 端承诺。 |
| `apps/mini-program/src/components/HeroPromoBanner.tsx:28,29,30,32` | `'本周推荐'` / `'这周末，会遇见谁？'` / `'每周精选 · 小聚刚刚好'` / a11y label | **⚠️ 提示项（见 §5.1）** | 用户可见周度软措辞硬编码在组件内；**非排期承诺**（未承诺「每周几局」），但未走 copy 模块。 |

### 3.2 内部逻辑 / 注释 / 测试（判定 OK，无动作）

| file:line | 内容性质 |
|---|---|
| `packages/shared/src/atmospherePrediction.ts:481` | `weekDays` 标签数组，氛围预测内部映射 |
| `packages/shared/src/hongKongTime.ts:17` | `weekdays` 标签数组（港时区工具） |
| `apps/mini-program/src/pages/gathering-room/useGatheringRoomController.ts:60,62,63` | `WEEKDAY_LABELS` + 注释；注释记录了**已修复**的「硬编码 周六见」缺陷（2026-08-12），正值反例 |
| `apps/mini-program/src/pages/squad-unboxing/squadUnboxingViewModels.ts:130` | `WEEKDAY_LABELS` |
| `apps/mini-program/src/lib/utils/discoverCounts.ts:22,53` | `WEEKDAY_CN` + 窗口注释；标签由真实 `pool.dateTime` 派生 |
| `apps/server/src/repositories/blindBoxEventsRepo.ts:87,90,91` | 「周三」→ 下一个该星期几的**日期解析逻辑**，内部计算 |
| `packages/shared/src/schema/_definitions.ts:398,1064,1380` | 列注释示例（`// 活动标题，如："周五夜聊酒局"`） |
| `packages/shared/src/schema/_definitions_extended.ts:356,449,457,459,492` | 列注释 / 「每周固定时间槽」模式说明（**场地可用时段模型**，非承诺文案） |
| `packages/shared/src/personality/questionsV4*.ts`（8 处） | 测评情景文案（「周五晚上…」「周一早上…」），测评语料 |
| `apps/mini-program/src/pages/onboarding/personality-test/idleWhispers.ts:38,40,157,161` | 测评待机耳语（含 2 处注释） |
| `apps/mini-program/src/pages/squad-unboxing/squadTableCardPoster.ts:34`、`SquadTableCard.tsx:18` | JSDoc 示例注释 |
| `apps/mini-program/src/pages/alang/search/index.tsx:27` | 注释（明确声明「与日期/星期无关」） |
| `apps/server/src/ai/socialIcebreakerPrompts.ts:336`、`ai/qualityJudgePrompts.ts:294,357,358` | LLM few-shot / judge 示例语料（非渲染文案） |
| `apps/server/src/lib/miniscriptCatalog.ts:46` | 剧本杀 catalog 剧情文本 |
| `apps/server/src/scripts/seed-test-data.ts:201`、`scripts/smoke-icebreaker-waves.ts:325`、`scripts/evaluate-embedding-quality/lib/triplet-set.ts:30,78` | 测试 / 评测 / smoke 语料 |
| `apps/mini-program/src/lib/dev/devPoolMocks.ts:26,56` | dev mock 标题（`__DEV__` 路径） |

---

## 4. 命中清单 B — 软性周表述（98 hits，按语义归并）

只列**用户可见**部分；LLM prompt 语料 / 测评题面 / 注释类统一判定 OK。

| file:line | 字符串 | 判定 |
|---|---|---|
| `apps/mini-program/src/lib/onboarding/professionOverlayCopy.ts:211` | `` `本周${city}有 ${count} 场局在排桌` `` | **OK（正例）** — 城市为**运行时变量**（非硬编码），`count` 为真实计算值，且已有 fail-closed 约束（N=0 不渲染）。**已是 copy builder 形态**（`buildCityPoolLine`），正是 P1b 软表述应遵循的先例。 |
| `apps/mini-program/src/lib/onboarding/professionCityPoolLine.ts:6` | 注释 + `countCityPoolsWithinWeek` | **OK（正例）** — 7 天窗口真实计数，纯读缓存不发请求 |
| `apps/mini-program/src/pages/payments/blind-box-payment/lib/paymentRitualCopy.ts:81,239,242,245,248,250` | `本周${weeklyEvents}场局…` / `本周新伙伴的选择` 等 | **OK（正例）** — 全部在 `lib/…/copy` 模块，且有 `weeklyEvents > 0` 数据门 |
| `apps/mini-program/src/components/discover/LocationFilterDrawer.tsx:214,215,234,252,410,415,416,417,427,640` | `${cluster.displayName}本周暂无场次` / `本周 ${weekTotal} 场 · N 个区域` 等 | **⚠️ 提示项（见 §5.2）** — 全部由 `weekCountsByCluster` 真实计数派生（无虚构 0，符合 2026-09-30 覆盖图修复），但模板字符串硬编码在组件内 |
| `apps/mini-program/src/pages/squad-unboxing/index.tsx:245` | `'我在 JoyJoin 开出了这周的同频桌友'` | **OK** — 分享海报文案，指本次真实开箱 |
| `packages/shared/src/alang/flashInvitationCatalog.ts:28` | `'现在给周末选个去处'` | **OK** — 阿浪生活邀约任务文案，指个人周末计划 |
| `packages/shared/src/constants.ts:115` | `ACTIVITY_TIME_PREFERENCE_OPTIONS = ["工作日晚上","周末白天","周末晚上","都可以"]` | **OK** — 用户活动时间偏好选项 |
| `apps/mini-program/src/pages/discover/index.tsx:1109` | 注释「speaks in 本周 semantics」 | **OK** — 注释 |
| `apps/server/src/{matchExplanation/fallbackCopy, routes/domains/icebreakerContent, socialIcebreakerAI/warmupTopics, conversationTopicsService, services/singleTestService, inference/dialogGuidanceSystem}.ts`、`packages/shared/src/{topicCards,interests,types/eventTheme,atmospherePrediction}.ts` | 「周末最喜欢的放松方式是什么？」「如果周末有一整天自由时间…」等 | **OK** — 破冰/话题/画像题库语料，「周末」是**话题主题**，非供给承诺 |

---

## 5. 提示项（非阻断，供 P1b 文案落地时一并处理）

### 5.1 `HeroPromoBanner` 变体 A 的周度措辞硬编码在组件内

- 位置：`apps/mini-program/src/components/HeroPromoBanner.tsx:26-58`（`PROMO_VARIANTS`），含 eyebrow `本周推荐`、title `这周末，会遇见谁？`、subtitle `每周精选 · 小聚刚刚好`、a11y label。
- 现状：不是排期承诺（未声明场次频次），但它是**Discover 首屏最显眼的周度节律暗示**——用户会把它读成「每周都有局」。
- 与 P1b 的关系：P1b 的软表述口径若定为「每周都有局」，此处是**唯一需要对齐的既有用户可见周度文案**，否则会出现两套口径（首屏「每周精选」 vs FAQ「每周都有局」）。
- 建议（**不在本任务执行**）：迁移到 copy 模块，例如新增 `packages/shared/src/copy/discoverHeroCopy.ts` 导出 `PROMO_VARIANTS`，与 `eventFaqCopy.ts` / `poolTeaserCopy.ts` 的独立模块先例一致（这两个文件刻意不进 `copy/index.ts` barrel）。
- 改动成本提示：`HeroPromoBanner.test.tsx:94` 锁定了 `'这周末，会遇见谁？'` 字符串，改文案需同步该断言。

### 5.2 `LocationFilterDrawer` 周窗口模板字符串

- 位置：`apps/mini-program/src/components/discover/LocationFilterDrawer.tsx`（10 处，见 §4）。
- 现状：数值**全部真实派生**（`weekCountsByCluster` / `weekTotal`），零虚构 0，符合 2026-09-30 覆盖图修复的不变量。问题仅在**模板文案内联于组件**。
- 风险等级：低。它不含城市/星期字面量（区域名来自 `cluster.displayName`，标签来自真实 `dateTime`），因此不触碰 P1b 的「硬编码城市/星期」红线。
- 建议：若未来做 copy 模块统一（与 §5.1 同批），把这些模板收进 `lib/copy/discoverCoverageCopy.ts`；否则维持现状可接受。

---

## 6. 「每周都有局」软表述现状（任务指定的顺带查询）

**结论：全仓不存在。**

- `都有局` / `周周` / `固定局` / `逢周` / `每周都` / `天天有` / `固定排期` → **0 命中**（含 docs）。
- 最接近的既有表述是**数据门控**的三条线，全部在 copy builder 里，且都带「N=0 不渲染」的 fail-closed 门：
  1. `buildCityPoolLine()` — `本周{city}有 N 场局在排桌`（`professionOverlayCopy.ts:211`）
  2. `paymentRitualCopy.ts:81` — `本周${weeklyEvents}场局，…`（`weeklyEvents > 0`）
  3. `LocationFilterDrawer` — `本周 ${weekTotal} 场`（真实计数）
- 最接近的既有**承诺式**措辞是 `HeroPromoBanner` 变体 A 的 `每周精选`（§5.1），仍未构成场次承诺。
- **若 P1b 软表述要落地，落点建议**：`packages/shared/src/copy/eventFaqCopy.ts`（对标平台 AC-05 已建，当前 8 条 FAQ，**尚无节律类条目**）。新增一条 `question: '多久会有一次局？'` + 答案用软表述（「每周都有局，具体场次以发现页为准」类），即可满足「走 copy 模块 + 不硬编码城市/星期」两条要求，且天然落在信任敏感面（`toneMode: 'system-ui'`，禁闺蜜腔）。

---

## 7. 范围排除说明（区分 docs 与代码约束）

| 位置 | 内容 | 是否受 P1b 代码约束 |
|---|---|---|
| `docs/deliberations/2026-10-20-conversion-commercialization-memo.md:93,105` | 「文案限定『每周三/六晚固定开局（深圳）』」 | **否** — 决策记录，非渲染文案。且 `2026-10-20-conversion-final-strategy.md:12,32` 已把该口径**降级**为内部运营承诺 + 软表述。 |
| `docs/deliberations/2026-10-20-conversion-pm-analysis.md:97,134` | 「固定『每周三/周六晚局』，零代码」+「FAQ 措辞用『每周都有局』软表述」 | **否** — 文档；其第 134 行正是本次审计的判定依据来源。 |
| `docs/deliberations/2026-10-20-conversion-implementation-plan.md:125-126` | S8.1 / S8.2 任务定义 | **否** — 任务说明 |
| `apps/server/migrations/seed_venue_partners_*` | 场地运营备注中的「仅周三、周四、周日晚间可保证留位」 | **数据层，不在代码文案约束内**；且已核验不进入 C 端载荷（§3.1） |
| `apps/admin-client/src/pages/admin/AdminEventTemplatesPage.tsx:63-69,476,500,651` | 后台星期下拉/表单占位符 | **否** — 运营后台工具面，非 C 端承诺 |
| 测试文件 / fixtures / LLM few-shot / 剧本剧情 | 各种「周五晚」字样 | **否** — 非渲染路径或无承诺语义 |

---

## 8. AC-11 判定

| 检查点 | 结果 |
|---|---|
| 全仓无硬编码排期承诺文案（城市+星期+周期） | ✅ **PASS**（0 条违规） |
| 「每周都有局」类软表述必走 copy 模块 | ✅ **PASS（空集）** — 该表述尚未存在；既有周度软表述中 3/3 数据门控线已在 copy builder，仅 2 处组件内联属非承诺文案（提示项） |
| 未硬编码城市 | ✅ **PASS** — `深圳` 硬编码仅限 Flash 城市域常量、场地地址目录、场地匹配白名单（均与周期无关） |
| 本任务是否改动代码 | ✅ 仅新增本备忘，**零源码修改、未 commit / 未 push** |

---

## 9. 关联文档

- `docs/deliberations/2026-10-20-conversion-final-strategy.md` §1（Q-E 裁决：内部承诺生效 / 用户可见文案用软表述 / 连续 4 周供给达标后才写死节律）、§7（P1b 定义）
- `docs/deliberations/2026-10-20-conversion-pm-analysis.md:134`（软表述 + venue 白名单 blocker 依据）
- `docs/deliberations/2026-10-20-conversion-implementation-plan.md:125-126`（S8.1 / S8.2 分工）
- `packages/shared/src/copy/eventFaqCopy.ts`（软表述推荐落点，当前 8 条 FAQ 无节律条目）
- `docs/copy/brand-copy-strategy.md`（copy 模块治理与 🔴 Hard Rules）
