# 入场卡卡面信息设计 v2 — PM 优化方案

> 状态：可进入实现（单 PR）｜日期：2026-11-22｜范围：`pages/onboarding/profile-review`（卡面 + 卡背联动）
> 技术面：无新接口、无 schema、无新 flag、无新组件、无新颜色 token。
> 复用的既有数据：`GET /api/auth/user`（`AuthUserResponse`）+ `GET /api/user/interests`（`UserInterestsResponse`）。

---

## 0. 五步判断（先质疑，再删，再优化）

| 步 | 结论 |
|----|------|
| **1 质疑需求** | 需求：卡面按 onboarding 已采集的颗粒度重排信息。<br>来源：用户 2026-11-22 反馈 4 条原话 + 2 张截图（截图 1 卡面、截图 2 tab bar）。<br>证据：① `index.tsx:853` `[occupationLabel, currentCity].filter(Boolean).join(' · ')` 落在 `white-space: nowrap + ellipsis` 里（`index.scss:429`）——两个不同单位的事实拼成一句，长职业会把城市整条吃掉；② `index.tsx:539-553` 卡面兴趣**只取 `topPriorities`（仅 level 3）**，`interestLevels`（561-578）算出来后只传给卡背（1062），卡面热度归零；③ 卡面上职业只以「拼接串」出现（`index.tsx:853`），完整职业/行业只存在于卡背 `ProfileArchiveSheet`（`index.tsx:644-651`）。<br>删掉损失：onboarding 最后一屏继续错述用户画像；用户在 extended-data 花掉的三档热度交互，在它最该被看见的一屏归零；「入场卡」从 keepsake 退化为一张 AI 文案卡。 |
| **2 删除** | 见 §2.4。删：卡面「小档案」拼接行、2 个逐行「修改」链接、数据层隐式多出的第 4 个兴趣 chip、约 400 行死 SCSS。 |
| **3 简化** | 同样结果、更少可动部件：3 个事实 chip 变 0（改一行文字）；4 种事实呈现方式（chip / pill / 拼接串 / 无强度标签）收敛成 1 种「`标签行 + 内容行`」事实块；事实块从 3 行固定栏位改成 2 个可缺席块；编辑入口 2 → 1。 |
| **4 提速** | 目标 1 个 PR、≤2 个工作日到 reviewable build；拆 4 个提交（纯函数 → 版式 → 卡背联动 → 测试/截图）。基线待验证（取最近一次 `profile-review` PR 的 open→merge 时长）。 |
| **5 自动化** | 锁定。本方案没有重复人工步骤可自动化；唯一新增的机器检查是 AC-17 的 poster 隐私契约测试（复用现有 vitest，不是新流水线）。 |

---

## 1. 问题诊断

### 1.1 反馈 1「颗粒度没对齐 / UIUX 单调 / 没有精致感」

「颗粒度」在这张卡上具体是四件事，逐条有码可查：

| 维度 | 现状 | 具体证据 |
|------|------|----------|
| **单位不统一** | 一行里混了 4 种物件：事实 chip（女/28/深圳）、身份 pill（原型）、拼接字符串（职业 · 城市）、无强度标签（兴趣）。同一视觉物件承担 4 种语义，读者无法判断哪条更重要。 | `index.tsx:797-805` / `849-908` |
| **层级不存在** | 卡面只有 2 档字号（40rpx 名字、22–24rpx 其余），十几个 pill 同尺寸同底色。读者的眼睛没有锚点，所以「单调」。 | `index.scss:294-344`（name 40 / tag 24 / summary 22–24） |
| **数据保真度** | 职业与城市用 ` · ` 拼成一句再 ellipsis：长职业会把城市静默截掉，用户既看不到城市也不知道自己丢了它。 | `index.tsx:853` + `index.scss:429-438` |
| **权重与价值错位** | 「你是谁 / 你做什么」是 24rpx 灰字；AI 三行占掉卡面约 60% 面积。keepsake 的重心放反了。 | 卡面顺序：`header → InsightRevealCard → summary` |

「精致感」不写成形容词，落到可验收的 5 条（§2.3 全部落 token）：
1. 每一层只允许 **1 个字号步进**（名字 40 / 事实 28 / 内容 24 / 微标签 22 / 极小 20）。
2. 只允许 **1 条** 分隔线（1rpx 实线），不再出现 2rpx 虚线（虚线在品牌语汇里是券/票据，不是卡片）。
3. 全卡只用 **3 种墨**：`$color-text-primary`、`$color-text-*-on-light`、原型 accent。`$color-primary-light` 作为 chip 底色下线。
4. 每条事实带自己的单位（职业是角色、行业是限定语、热度是档位词）。
5. 8rpx 网格或 token，禁止 2rpx 微调。

### 1.2 反馈 2「兴趣没有对齐热度的颗粒度」

三处丢数据，都是可复现的：

- **层级丢失**：`topInterestItems` 优先取 `topPriorities`，而 `topPriorities` 由 `buildStructuredInterestsPayload` 定义为 **仅 level 3**（`api/profile.ts:180-186`）。所以只要用户有 1 个必聊项，卡面就再也不会显示他的「很热衷 / 感兴趣」——用户刚在 extended-data 用三档手势标出来的曲线，在卡面被压平成同质标签。
- **强度丢失**：`interestLevels`（label → 1/2/3）已算好，但只作为卡背 prop 传下去（`index.tsx:1062`），卡面渲染 `topInterestLabels.slice(0,3)` 完全不用它。
- **总量丢失**：卡面显示 3 个，用户不知道自己一共标了几个；卡背能看到全部，但没人知道自己该去看。
- **口径不一致**：数据层 `slice(0,4)`、渲染层 `slice(0,3)`，两处上限不同源。

### 1.3 反馈 3「职业什么也没显示，onboarding 采集的有价值信息都该体现」

onboarding 实际采集到、且在 review 时可用的字段（`AuthUserResponse` 直出）：`displayName`、`gender`、`age/birthdate`、`currentCity`、`hometownRegionCity`、`relationshipStatus`、`educationLevel`、`occupationId`（→ 职业）、`workMode`（deprecated，读兜底）/`lifeStage`、`industryCategoryLabel`（→ 行业）、`intent[]`、兴趣（level/heat/categoryHeat）、`archetype` + `rarityPercentage`。

现状：职业与行业**只在卡背**。卡面唯一提及职业的地方就是那条被拼接、被截断的「小档案」行。用户看完正面不知道这张卡属于谁。

### 1.4 反馈 4「tab bar 在『连接』点亮，屏幕是『足迹』」

**不属于本卡范围。** 由另一个 agent 处理。仅供移交的定位线索：`足迹 = pages/events/index`（tab index 1）、`连接 = pages/connections/index`（index 2），见 `src/lib/navigation/tabBarConfig.ts`；选中态唯一写入口是 `src/native-custom-tab-bar/index.js` 的 `_reconcileSelection()`，路由映射双表由 `tabBarRouteIndexParity.test.ts` 锁定。本方案不改动任何 tab bar 代码。

---

## 2. 信息架构 v1

### 2.1 四层（卡面顺序即阅读顺序）

```
┌ 入场卡 ─────────────────────────────── [稀有度印章] ┐
│ L1 身份  姓名  [原型]                                │
│          女生 · 28岁 · 深圳                          │
│          产品经理 · 科技互联网                        │
│ L2 观察  「悦仔的观察」三行 + 证据 pill + AIGC + 反馈  │
│          存下这张卡                                  │
│ ─────────────── 1rpx 实线（全卡唯一）───────────────  │
│ L3 画像  兴趣热量                      共 12 个       │
│          [探店·必聊项] [咖啡·很热衷] [看展·感兴趣]    │
│          想找                                        │
│          [认识新朋友] [找人一起玩]                    │
│ 修改资料                            完整小档案 家乡·学历 ⌟│
└──────────────────────────────────────────────────┘
  见面礼（卡外）→ 底部 CTA（卡外、固定）
```

| 层 | 放什么 | 为什么在这一层 |
|----|--------|----------------|
| **L1 身份** | 姓名（display 字重）+ 原型 pill + `性别 · 年龄 · 城市` 一行 + `职业 · 行业` 一行 + 稀有度印章 | 卡片的第一句必须是「这是谁」。两行文字代替 3 个 chip，是因为事实需要用「句子」的颗粒度读，而不是用「标签」的颗粒度读。 |
| **L2 观察** | 现有 `InsightRevealCard` 全量不动（三行 + 证据 + AIGC 角标 + 反馈）+ `存下这张卡` | 它是这张卡的情绪峰值，且已有完整动效/合规/telemetry 契约，不动。位置保持在身份之后：先认识人，再听评价。 |
| **L3 画像** | `兴趣热量`（带档位词，3 个，+ 总量）+ `想找`（≤3 chip） | 这是「我能聊什么」，属于深读层；放在分享入口之后，才不会把 L2 的峰值挤下去。 |
| **L4 背面** | `修改资料`（左）+ `完整小档案` dog-ear（右，附 `家乡 · 学历` 提示） | 背面承载只给自己看的部分；正面不给敏感字段留位置（见 §2.2）。 |

封面外不动：`BoxJourneySpine`(step 3)、标题、教练气泡、`WelcomeGiftCard compact`、底部 CTA（CTA 在 ScrollView 外，永远可达）。

### 2.2 上卡面 / 留卡背 / 永不上卡

| 字段 | 卡面 | 卡背 | 理由 |
|------|------|------|------|
| 姓名 / 性别 / 年龄 / 城市 | ✅ | ✅ | 已在卡面，无需变化 |
| 职业 / 行业 | ✅ | ✅ | 正面一句「你是谁」，背面给完整字段 |
| 兴趣（含 level/heat） | ✅ 3 个 + 总量 | ✅ 全部 + 类别 | 正面给颗粒度，背面给全量 |
| 想找 intent | ✅ ≤3 | ✅ | 已存在 |
| 原型 + 稀有度 | ✅ | — | 身份的一部分 |
| 家乡 / 学历 | ❌（dog-ear 提示词出现，值不出现） | ✅ | 值属于隐私面；只在折角上写「有这两栏」 |
| 关系状态 | ❌（连提示词都不写） | ✅ | 卡面会被截图转发；关系状态是单条最敏感字段，不在正面留任何痕 |
| 总热度 / categoryHeat 数值 | ❌ | ✅（已有句子） | 内部权重，不是用户语言 |
| 生日原文、`workMode` 机器值、`industryCategory` 机器 id | ❌ | ❌ | 低价值 / 机器值 |

**判断规则（写进设计注释）**：卡面 = 可以被人截图转发也不尴尬的一面；卡背 = 只给自己看的一面。任何新字段先过这条，再谈位置。

### 2.3 版式规格（可直接落 SCSS）

卡片内宽 = 750 − 2×`$container-padding`(40) − 2×`$spacing-md`(24) = **622rpx**。

| 元素 | 字号 | 字重 / 字体 | 墨 | 间距 |
|------|------|-------------|-----|------|
| 姓名 | `$font-size-xl` 40 | `$font-weight-black` + `$font-cn-display` | primary | 行高 1.35 |
| 原型 pill | `$font-size-sm` 24 | semibold | accentText on accentSoft（现状） | 与姓名 `$spacing-sm` |
| `性别 · 年龄 · 城市` | `$font-size-sm` 24 | regular | `$color-text-secondary-on-light` | `margin-top: $spacing-xs`(8)；分隔符 `·` tertiary 6 成，左右 8rpx |
| `职业 · 行业` | 职业 28 / 行业 24 | 职业 semibold / 行业 regular | 职业 primary / 行业 `$color-text-secondary-on-light` | `margin-top: $spacing-xs`(8)；**允许折行，不 clamp，不 ellipsis** |
| 事实块标签 | `$font-size-xs` 22 | semibold | `$color-text-tertiary-on-light` | 与内容 `$spacing-xs`(8) |
| 事实块右注（`共 12 个`） | `$font-size-2xs` 20 | regular | `$color-text-tertiary-on-light` | 右对齐，同行 |
| chip 文本 | `$font-size-sm` 24 | regular | primary | min-height 56rpx，padding 0 `$spacing-sm` |
| chip 档位词 | `$font-size-2xs` 20 | medium | 必聊项 primary / 很热衷 secondary-on-light / 感兴趣 tertiary-on-light | 与 chip 文本 8rpx |
| 分隔线 | 1rpx solid `rgba($color-border, 0.7)` | — | — | 左右内缩 `$spacing-md`，**卡面仅此一条**（卡背的分节规则不动） |
| 底部行 | `$font-size-xs` 22 | `修改资料` medium / `完整小档案` semibold | tertiary-on-light / archiveAccentText | 行 min-height 88rpx |

硬规则：
- 字号只许出现 40 / 28 / 24 / 22 / 20 五档；不新增 18rpx / 26rpx / 30rpx 字面量。
- chip 无边框、无阴影；底色统一 `rgba($color-primary, 0.06)`；层级只靠档位词的墨阶（单色 ramp，不引入第二色）。
- 不用虚线。`__summary` 的 `2rpx dashed` 随本节一起改 `1rpx solid`。
- 两行 chip 之间不加第二条横线；不够分离就加间距到 `$spacing-sm`。
- 姓名行 `flex-wrap: wrap`，pill `flex-shrink: 0`（保留现有防溢出策略）。

**折叠位测算（防止好评变差评）**：卡面在 L2 之上只比今天多 +46rpx（meta 行替代 tag 行 ≈ −4，职业行新增 ≈ +50）。按 568pt 屏估算，观察区首行落在 y≈780rpx，远在 1334rpx 视口内。**因此不裁 hero 区**；若真机实测首行被折到视口外，只允许裁副标题一行，不允许把 L2 挪回事实之上（会把卡面重新变成 AI 输出面板）。

### 2.4 删除 / 合并 / 替换（一个 PR 内的减法）

| 动作 | 对象 | 谁在用 | 删了损失什么 | 回滚 |
|------|------|--------|--------------|------|
| **删** | 卡面「小档案」行（`__summary-row` #1 + `__summary-value` 拼接串） | 唯一用途是把职业/城市塞进一行 | 无——两件事实分别升到 L1 的两行文字，信息不减反增（城市不再被截断） | revert PR |
| **删** | 两个逐行「修改」链接 | 修错入口 | 由底部单个 `修改资料` 承接（→ `essentialData?from=review&step=professionalProfile`，向导内可前后走，覆盖全部字段） | revert PR |
| **删** | 卡面第 4 个兴趣 chip 的隐式存在（数据层 `slice(0,4)`） | 无人——渲染只取 3 | 无 | — |
| **删** | 死 SCSS 家族：`__info-grid/__info-block/__info-caption/__info-annotation/__ai-tag*/__intent-chip*/__interest-conclusion/__interest-stats/__interest-stat/__interest-value/__interest-label/__chip-group/__interest-story-pill/__interest-skeleton/__skeleton-*/__interest-placeholder*`（TSX 命中数全为 0，约 400+ 行，子包 WXSS 白付体积） | 无人 | 无 | revert PR |
| **合并** | 3 个事实栏位 → 2 个 `标签行 + 内容行` 事实块 | — | — | — |
| **替换** | `__summary-*` 命名 → `__facts/__fact*`；`__poster-tags/__poster-tag*` → `__poster-meta*` | — | — | — |
| **保留不动** | dog-ear `__archive-entry*`、卡背 `ProfileArchiveSheet` 结构、`WelcomeGiftCard`、CTA、`InsightShareEntry`、AIGC 角标、反馈控件 | — | — | — |

> 死 SCSS 清理后跑一次 `node scripts/check/check-class-coverage.mjs --write-baseline` 收口 ratchet；不新增任何未定义 class。

---

## 3. 兴趣热度产品规则

### 3.1 三档映射（复用 onboarding 已教的词，不造新词）

| level | heat | 档位词（`INTEREST_LEVEL_LABELS`） | 卡面墨阶 |
|-------|------|-----------------------------------|----------|
| 3 | 25 | **必聊项** | `$color-text-primary` |
| 2 | 10 | **很热衷** | `$color-text-secondary-on-light` |
| 1 | 3 | **感兴趣** | `$color-text-tertiary-on-light` |
| —（历史行无 level） | — | 不显示档位词（诚实：没有强度就不假装有） | 与 chip 文本同墨 |

不显示总热度数值、不显示百分比、不显示「热度 25」。`heat` 是内部权重，用户语言里只有三档。

### 3.2 取数、排序、取几个（纯函数，可表驱动测试）

新增纯模块 `apps/mini-program/src/lib/onboarding/entryCardFacts.ts`（无 React、无网络），导出 `buildEntryCardInterests(interests: UserInterestsResponse | null)`：

```
输入：selections[]（权威）+ topPriorities[]（兜底）+ totalSelections
1) 归一化：tier = level===3 ? 3 : level===2 ? 2 : level===1 ? 1 : null
   - 丢弃 label 为空白项；按 topicId 去重取最大 tier
2) 兜底：selections 为空且 topPriorities 非空 → 每项 { tier: 3 }
   （契约上 topPriorities 仅 level 3，这是定义而非猜测）
3) 卡面取样（代表制，最多 3 个）：
   a. 按 tier 3→2→1 各取 1 个：组内按 heat desc → label（zh-Hans-CN）asc → topicId asc
   b. 不足 3 个时，从剩余池按 heat desc → label asc → topicId asc 补满
4) 卡背列表（全量）：tier desc → heat desc → label asc
5) 输出 { face: CardInterest[≤3], ranked: CardInterest[], total, overflow: total - face.length }
   （overflow 只进 telemetry，卡面不渲染第 4 个 chip）
```

**为什么是「代表制」而不是「排名制」**：排名制下，一个把 5 个兴趣都标成必聊项的用户，卡面会得到 3 个「必聊项」——热度轴彻底不可见，正是本次投诉。代表制保证只要用户标了两档以上，卡面就一定能看出「曲线的形状」；只有一档时不伪造第二档。补满规则保证不会因为「某些档位为空」而让卡面缺位。

**确定性**：三层 tie-break 收敛到 `topicId`，同一份数据任何一次渲染顺序一致（避免 swipe-back 重排的闪烁）。

**口径统一**：卡面（≤3）、卡背（全量）、`heatConclusion`（取 ranked 前 2）都从同一份 `ranked` 派生，不再出现数据层 4 / 渲染层 3 的两套上限。

### 3.3 文案与边界状态（可直接抄进 JSX）

| 状态 | 触发 | 卡面呈现 | 文案 |
|------|------|----------|------|
| `ready` | `face.length > 0` | ≤3 个 chip + 右注总量 | 标签 `兴趣热量`；右注 `共 ${total} 个`（total ≤ 3 时省略右注）；chip 文本 = label；档位词见 §3.1 |
| `loading` | 请求中 | 3 个骨架 chip（56rpx 高，`aria-busy='true'`，`role='status'`） | 无文字 |
| `error` | 请求失败 | 一行静态文字，无重试（重试在卡背） | `兴趣暂时没读到` |
| `empty` | 请求成功但无选择；或用户没走兴趣轮播 | 一行静态文字 | `兴趣还没标，之后可以在「我的」补充` |
| `unmarked` | 单项缺 level（历史行） | chip 只显示 label，不带档位词 | — |

规则：`共 N 个` 的 N 来自归一化后的 `total`（去重后），不是 `totalSelections` 原值——两者不一致时以卡面实际可展开的条数为准，否则「共 12 个」点进去只有 10 个，是新的诚实性缺陷。

### 3.4 卡背联动（只改传参，不改结构）

- `interestLabels` 从「前 4 个」改为 `ranked` 全量（最多 48，chip cloud 已支持换行，面板可滚）。
- `interestLevels` 保持 label→tier 映射（当前 48 个 label 无重名；改成 topicId 为键是 P2）。
- `heatConclusion` 用 `ranked` 前 2 生成，句子不变。
- `interestState` 四态（ready/loading/error/empty）沿用同一判定源，卡面/卡背不再各算一套。

---

## 4. 职业 / 行业呈现规则

| 场景 | 卡面 | 说明 |
|------|------|------|
| 职业 + 行业都有 | `产品经理 · 科技互联网` | 职业 28rpx semibold primary；`·` 8rpx；行业 24rpx secondary-on-light。一行，可折行 |
| 只有职业 | `产品经理` | 行业缺失不补占位 |
| 学生（`workMode=student`） | `学生` | 行业不显示（学生的「行业」来自职业映射，会误导） |
| 创业者 / 自由职业 | `创业中 · 产品顾问`、`自由职业 · 摄影师` | 保留 `getOccupationDisplayLabel(showWorkMode:true)` 的前缀语义；在职（`employed`）不加前缀 |
| 职业缺失 | **整行不渲染** | 卡面不放「资料待补充」——keepsake 上出现表单占位语，等于宣告这张卡没做完；卡背仍保留 `资料待补充` |
| 超长（职业 12 字 + 行业 8 字） | 折行到 2 行，不 ellipsis、不 clamp | 这是对「城市被吃掉」那个 bug 的正向修复；宁可多一行，不可静默丢数据 |

- 取数：`getOccupationDisplayLabel(occupationId, workMode, { showWorkMode: true, fallback: '' })` + `getIndustryDisplayLabel(occupationId, industryCategoryLabel)`（两者均沿用现状；行业 fallback 只在职业映射缺失时生效，不构成第二套事实来源）。
- `workMode` 是否显示：只显示上面三种「身份前缀」，不单独成 chip，不出现机器值（`employed`/`self_employed`）。helper 的前缀白名单目前只覆盖 `founder/self_employed/student`——`transitioning/ caregiver_retired/ successor` 拿不到前缀，是 helper 的既有缺口，本 PR 不修（与 `lifeStage` 兜底同批处理）。
- `lifeStage`：本 PR 不引入（写了 `lifeStage` 但没写 `workMode` 的新用户，`getOccupationDisplayLabel` 会拿不到前缀）。**P2**：让 helper 接受 `lifeStage` 兜底，属于 shared 契约改动，单独 PR。

---

## 5. 举一反三清单（相邻优化，标注优先级）

| # | 项 | 优先级 | 理由 |
|---|----|--------|------|
| 1 | **卡背可发现性**：dog-ear 右侧加 `家乡 · 学历` 提示（只列实际存在的字段，最多 2 个；关系状态永不出现在提示里） | **P0** | 正面这一版把「家乡/学历/关系状态」彻底下沉，如果折角没人点，等于信息删除。提示词让折角变成「有东西可翻」而不是「装饰」。 |
| 2 | **分享海报隐私回归测试**：把 `职业/行业/家乡/学历/关系状态` 的值加进 canvas spy 断言 | **P0** | 正面从此带职业。任何后续「把卡存下来」的改动只要 spread 了 user，就会把敏感字段烘进 1080×1560 海报。现有测试必须立刻扩容，否则这次改动降低了下一次改动的安全边际。 |
| 3 | **三态齐备**：兴趣 block（loading/error/empty）+ 职业行（缺失即隐藏） | P1 | 现状只有一句 `兴趣标签暂时不可用` 混在 3 行里；新 block 若照抄会留下半截空行。 |
| 4 | **长文本 / 320pt / 大字号**：职业两行、3 chip 折行、`共 N 个` 右注不挤压标签 | P1 | WeChat「字体大小 → 大/超大」会让 22rpx 微标签变宽；这是最容易在真机翻车的组合。 |
| 5 | **可访问性**：兴趣块 `role='group'` + `aria-label='兴趣热量：探店必聊项、咖啡很热衷、看展感兴趣'`；chip `aria-label='探店，必聊项'`；`修改资料`/`完整小档案` 两个 target 各 88rpx | P1 | 档位现在是**文字**而非纯色块，屏幕阅读器能读到强度；这是把「热度」做成可访问信息的唯一正确姿势。 |
| 6 | **编辑入口合并**：2 个逐行「修改」→ 1 个 `修改资料` | P1 | 逐行「修改」把卡片正文变成表单；合并后正文纯净，且不再需要回答「改哪一行」这个歧义。 |
| 7 | **完成态回归**：`入场卡已生效` 遮罩是 `inset:0` 覆盖整张 poster，新增 block 自动被覆盖 | P1 | 只需在真机确认遮罩仍完全不透明、720ms 不露底（这次卡面变高，要确认不是「只遮住上半截」）。 |
| 8 | **死 SCSS 清理 + class-coverage 基线** | P1 | 子包 WXSS 记在主包预算里；400 行死代码是纯负债，且会误导下一个改卡面的人以为那些结构还在用。 |
| 9 | **稀有度印章语义**：`前12%` 补 `aria-label='原型稀有度：全站前 12%'`；`rarityPercentage` 为 null 时已有 `JOYJOIN ORIGINAL` 兜底 | P2 | 印章被刻意降权过（2026-10-14），不再改动视觉，只补语义。 |
| 10 | **卡面直接改兴趣**：`extended-data?from=review` 深链 | P2 | 需要处理向导 checkpoint 回写，风险大于收益；先给「去我的补」这条诚实路径。 |
| 11 | **卡片可回看**：`我的` → 入场卡只读复用 | P2 | 现在这张卡完成即消失；它是 keepsake，理应能再看。属于新surface，不进本 PR。 |
| 12 | **档位词不是承诺**：「必聊项」是自我介绍，文案评审时不得演化为「优先排同好」类撮合承诺 | P2（评审项） | 与 `profileFieldAnnotations.ts` 的 AC-17 同一条纪律：不承诺引擎不提供的行为。 |

---

## 6. 验收标准（按最小可验证输出排序）

**AC-1（纯函数，先落地）** 新增 `entryCardFacts.ts` + 表驱动测试：输入 → 输出 `face/ranked/total/overflow` 逐行锁定。用例覆盖：三档各 1、全 L3×3、L3×2+L2×1+L1×3、仅 topPriorities、空 selections、无 level 历史行、label 空白项、同 heat 同 tier 的 tie-break。
**AC-2** 给定职业 + 行业 → 卡面渲染 `产品经理 · 科技互联网`，两段墨阶不同，`getOccupationDisplayLabel` / `getIndustryDisplayLabel` 为唯一来源。
**AC-3** 无职业 → 职业行 DOM 不存在（不是空 `<Text>`），卡面无 `资料待补充`；卡背仍有 `资料待补充`。
**AC-4** `workMode=student` → 只显示 `学生`，无行业段；`founder/self_employed` → 保留前缀；`employed` → 无前缀。
**AC-5** level 1/2/3 → 档位词分别为 `感兴趣 / 很热衷 / 必聊项`，墨阶为 tertiary / secondary / primary（三档可区分）。
**AC-6** 代表制：L3×2、L2×1、L1×3 → 卡面 3 个 chip，顺序 L3→L2→L1，且每个档位各 1 个。
**AC-7** 全 L3×3 → 3 个 `必聊项`，无第二档（不伪造）。
**AC-8** `selections` 空 + `topPriorities=[a,b]` → 2 个 `必聊项`，`共 2 个` 右注省略，无 error 态。
**AC-9** 历史行无 level → chip 只有 label，无档位词，仍计入 `total`。
**AC-10** `total=12` → 右注 `共 12 个`；`total≤3` → 右注不渲染。
**AC-11** 兴趣 loading → 3 个骨架 chip（`role='status'` + `aria-busy='true'` + `aria-label='兴趣数据加载中'`），不出现文字占位。
**AC-12** 兴趣 error → 单行 `兴趣暂时没读到`，卡面无重试按钮；卡背 `重新加载` 仍可用（现有 `onRetryInterests` 路径不变）。
**AC-13** 兴趣 empty → 单行 `兴趣还没标，之后可以在「我的」补充`。
**AC-14** 超长：职业 12 字 + 行业 8 字 → 折行 ≤2 行，无 ellipsis、无截断；`城市` 在任何组合下都不被遮挡（回归 `join(' · ')` 缺陷）。
**AC-15** 320pt + WeChat 大字号：无重叠/裁切；3 chip 最多折 2 行；底部 CTA 始终可达（CTA 在 ScrollView 外）。
**AC-16** 卡面分隔线只有 1 条 `1rpx solid`；卡面无 `dashed`、无 `2rpx` 分隔线（卡背 `ProfileArchiveSheet` 的分节规则不变）。
**AC-17（隐私）** canvas spy 断言：`职业`、`行业`、`家乡`、`学历`、`关系状态` 的值**永不**进入海报绘制入参（沿用 `insightPoster.ts` 的结构性排除，测试扩到新字段）。
**AC-18（a11y）** 兴趣块 `role='group'` + 聚合 `aria-label`；每个 chip 有 `aria-label='${label}，${档位词}'`；`修改资料`（`aria-label='去修改入场卡上的资料'`）与 `完整小档案`（`aria-label='翻看完整小档案'`）命中区 ≥88rpx。
**AC-19（减法）** 卡面无「小档案」行、无逐行「修改」；`grep` 确认 §2.4 列出的死 SCSS 家族全部删除，class-coverage 基线已重生成。
**AC-20（telemetry）** 只发两个事件，不重复上报：`entry_card_facts` 每 visit 一次，字段 `{hasOccupation, hasIndustry, hasProfessionLine, interestTotal, interestShown, tierSpread, hasRightMeta, archiveHintShown}`，**全部为布尔/计数，不含任何用户文本**；`entry_card_edit_tap` 在 `修改资料` 点击时发出。
**AC-21（动效）** 不新增动画；chip/档位词静态；`prefers-reduced-motion` 下与常显一致；现有 stage 1–6 stagger 与 gift 时序不变（`insightRowsLanded` 语义不变）。
**AC-22（构建）** `npm run typecheck -w mini-program`、`npm run guardrails`、`npm run build:weapp -w mini-program && npm run verify:subpackage-styles -w mini-program` 通过；新增样式全部落在页面 SCSS（不新增组件、不新增 `@use`、不需要注册新 required selector）；DevTools + H5 截图覆盖 ready / loading / error / empty + 320pt 首屏 + 大字号。

---

## 7. 明确不做

- 不改任何**接口 / schema / DTO / feature flag**（所需数据全部已在 `AuthUserResponse` + `UserInterestsResponse` 里）。
- 不改**分享海报**构图与字段（只加隐私测试）。职业/行业进海报**永不**。
- 卡面**永不**出现：关系状态、家乡值、学历值、总热度数值、热度百分比、`workMode` 机器值、`industryCategory` 机器 id。
- 不重构 `InsightRevealCard`（三行、证据 pill、AIGC、反馈、gift timing 全部冻结）。
- 不改 `ProfileArchiveSheet` 结构（只改传入的 `interestLabels` 口径 + dog-ear 提示词在卡面）。
- 不新增卡片组件、不新增颜色 token、不引入渐变、不使用 emoji。
- 不处理 tab bar 选中态（属另一个 agent）。
- 不做「卡面直接改兴趣」「卡片回看页」（P2，见 §5 #10/#11）。
- 不动匹配/排序/`poolMatchingService` 任何逻辑——卡面只是展示，不改撮合。

---

## 8. 指标（复用现有 onboarding analytics 通道，无后端改动）

事件通过 `onboardingAnalytics.interaction(step, action, metadata)` 落到 `POST /api/analytics/onboarding`：`eventType` 用已白名单的 `interaction`，`action` 与 metadata 键不做服务端校验，因此**零后端改动**即可上线。

| # | 事件 | 看什么 | 判读规则 |
|---|------|--------|----------|
| 1 | `entry_card_facts` | `hasProfessionLine` 占比 = 卡面能否说出「你是谁」 | 上线 7 天后，完成 onboarding 的用户中该占比目标 ≥70%（professionalProfile 允许跳过，故不等于 100%）；低于 60% 说明采集跳过率过高或映射断了，问题不在设计 |
| 2 | `entry_card_facts.tierSpread` | 分布（1/2/3 档） | 在「用户自己标了 ≥2 档」的子集里，`tierSpread≥2` 应占多数；这是「热度颗粒度真的被看见了」的唯一直接证据 |
| 3 | `profile_archive_opened`（已有，`source='entry_card_back'`） | 折角点击率，按 `archiveHintShown` 分组 | `archiveHintShown=true` 的子集点击率应更高；否则提示词无效，回退提示词 |
| 4 | `profile_review_cta_tap`（已有） | 完成转化 | 上线后 7 天不低于上线前 7 天 −1pp；卡面变高不得换来转化下滑 |
| 5 | `insight_poster_created`（已有） | 分享率 | 不下降；且 poster 相关测试无职业字符串（隐私闸） |

基线说明：1/2 为新增事件，无历史基线 → 首周取分布作为基线（标注 `待验证`）；4/5 有历史，按上表阈值判读。

---

## 9. 实施顺序与时间盒

目标：**1 个 PR / ≤2 个工作日**到 reviewable build。若超时，按 §5 优先级从 P1 尾部砍，不砍 AC-1/AC-17。

1. **提交 1（0.5 天）**：`entryCardFacts.ts` + 测试（AC-1）。先让「取哪 3 个、按什么排、共几个」变成可表驱动验证的事实。
2. **提交 2（0.5 天）**：版式重排（L1 两行文字 + 删除小档案行 + L3 两个事实块 + 单条分隔线 + 死 SCSS 清理）。
3. **提交 3（0.3 天）**：卡背联动（`ranked` 全量 + dog-ear 提示词）+ footer 单个 `修改资料` + telemetry 三个事件。
4. **提交 4（0.5 天）**：poster 隐私测试扩容、a11y、状态截图（ready/loading/error/empty + 320pt 首屏 + WeChat 大字号）、真机走查。

验证命令见 AC-22；截图走 `docs/runbooks/` 现有的 H5/DevTools 流程（H5 dist 会被 `build:weapp` 清掉，先 weapp 后 H5）。

---

## 10. 风险与依赖

| 风险 | 影响 | 缓解 |
|------|------|------|
| **A. 卡面变高把「观察」挤下去** | L2 是这张卡的情绪峰值，被折到首屏之外就等于白做 | §2.3 已算：L2 之上只 +46rpx；真机若越界，只准裁 hero 副标题，不准把 L2 挪到事实之上。截图必须含 568pt 首屏。 |
| **B. 隐私泄漏经海报外溢** | 卡面从此带职业；任何「把卡存下来」的后续改动 spread user 就会烘进海报 | AC-17 先把 canvas spy 测试扩到 5 个新字段，再改卡面（测试先行，顺序不可倒） |
| **C. 代表制被误读为「只有 3 个兴趣」** | 用户以为自己的兴趣被砍 | `共 N 个` 右注常显（total>3 时）+ 折角提示词 + 卡背全量；文案评审确认 `N` 与展开条数一致 |
| **D. 档位词被读成撮合承诺** | 微信审核 / 品牌纪律风险 | 档位词是自我介绍（「必聊项」= 我想聊），不是引擎行为；禁止在卡面新增「优先/优先排/更容易排到」类表述 |
| **E. `topPriorities` 口径漂移** | 若服务端将来不再按 level 3 生成，兜底会错误标成必聊项 | 只在 `selections` 为空时使用；模块注释写明该契约来源（`api/profile.ts:180-186`） |

依赖：无新增后端依赖。已确认可用数据：`occupationId`、`workMode`、`interest.selections[].level/heat`、`topPriorities`、`categoryHeat`、`archetype`、`rarityPercentage`。

---

## 11. 下一版本（本 PR 之后）

1. **P1 收尾**：`getOccupationDisplayLabel` 接受 `lifeStage` 兜底（shared 契约，单独 PR + 表驱动测试）。
2. **P2 卡片回看**：`我的` → 只读入场卡，复用同一份 `entryCardFacts` 与同一套版式（这是让 keepsake 真正成立的一步）。
3. **P2 兴趣直达编辑**：从卡面进入 `extended-data?from=review`，需要先解决向导 checkpoint 回写，属于独立风险项。
4. **观察每两周复盘**（owner: PM）：看 §8 的 `tierSpread` 分布是否稳定在 ≥2，若某城市/某原型 cohort 长期只有 1 档，说明 extended-data 的手势教学没生效，问题回到上游而不是继续改卡面。
