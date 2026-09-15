# 职业画像纠错「坐标阶梯 + 候选 chips」产品规格（PRD，实现就绪）

> 日期：2026-09-15
> 状态：**规格已定稿（4 项开放问题已拍板）**，可进入实现。PM 视角与 UI/UX 设计视角已评审并收敛（见 §0）。
> 范围：onboarding「悦仔职业对话」overlay 的结果呈现与纠错路径，**外加 `standardizedOccupationId` 语义修正（Q4 决定纳入本波）**。不含行业专场、职业坐标分享卡（见 §12 非目标）。
> 输入：PM opinion memo + UI/UX design memo + 代码核实（本次会话）。本文档为下一波实现的规格。

> **评审拍板（2026-09-15）**：Q1 → 三态标题统一；Q2 → 候选随首包返回；Q3 → 不加「其他（手动输入）」chip；Q4 → `standardizedOccupationId` 语义**本波修正**（见 §7.4）。

---

## 0. 锁定产品决策（PM × UI/UX 收敛结论）

1. **唯一主目标是「身份可信度 / onboarding 转化」**，不是「对话素材生成引擎」。用户结束这一步时的感受必须是「我的档案很真实」，呈现词统一用 **活动画像**（canon），不得新增面向用户的新引擎名词。
2. **纠错是 on-demand，不是主输入。** chips 只在用户点「换一个」时出现；绝不做成常驻表单，绝不出现「提交」。用户是标注者，但不是在被面试。
3. **把被丢弃的三层结构（类别 › 细分 › 角色）作为呈现主体**，取代当前的 tag 汤。这是本波唯一的「科技感 / 精致」来源：**用留白与层级，不用 sparkle**。
4. **候选 chips 的机制由 embedding 向量索引承担**（`POST /api/occupation/search` 已存在但零客户端引用）——确定性、约 50ms、无 LLM 成本，并顺手补齐 `OCCUPATIONS` 只有 35/164 条 `seedMappings` 的覆盖缺口。
5. **砍掉「职业坐标分享卡」作为海报**（LinkedIn 式身份炫耀，与反简历 / 活动预约调性冲突）；保留的是**屏内阶梯**，它是纠错的载体，不是分享物。
6. **本波必须同时修复 AIGC 角标假归属**（`ProfessionChatOverlay.tsx:1042-1045`），否则改版后错误会被放大。
7. 城市语境遵循 canon：**香港 & 深圳**，不是北上广深。
8. **三态共用同一条标题**（统一悦仔口吻；诚实性由阶梯行承载，不由标题差异承载）——见 §6.2。
9. **`correctionCandidates` 随分类首包返回**，不做独立端点——见 §7.1。
10. **角色行候选不含「其他（手动输入）」**；无候选时保持「待补充」，不回退自由文本——见 §6.3。
11. **`standardizedOccupationId` 语义本波修正**为规范 `OCCUPATIONS.id`（不再等于 `niche.id`）——见 §7.4。

---

## 1. 现状（已核实，非猜测）

| 事实 | 位置 |
|---|---|
| 结果卡 = 标题 + 40rpx 悦仔头像 + tag 汤 + 单句 bridge + 「确认并继续」 | `ProfessionChatOverlay.tsx:1039-1088` |
| **标签只能删、不能改**：`removedTags` 只做追加，无 add/change 路径；`Chip selected` 但点击是「取消选中」，是 false affordance | `ProfessionChatOverlay.tsx:1047-1066` |
| 三层结构（`category` / `segment` / `niche`，各含 id + label）已被正确采集，随后被拍平成 `displayTags` | `ProfessionChatOverlay.tsx:718-729` |
| AIGC 角标**硬编码** `{ aiGenerated: true, labelType: 'ai-assisted' }`，fallback（确定性文案）路径也照样显示 | `ProfessionChatOverlay.tsx:1042-1045` |
| 服务端返回值包含 confidence 与 source（`seed\|ontology\|ai\|fallback\|fuzzy`），但 UI 只用 source 判 fallback 分支 | `professionUnderstanding.ts:654-685` |
| 已有确定性 embedding 检索：164 条职业向量索引（`OCCUPATIONS` 共 164 条，全部已向量化），返回 `matches[{occupationId, displayName, industryId, confidence}]` + `matchSource` | `occupationSearch.ts`；`apps/server/data/occupation-vectors.json`（1.8MB） |
| **该检索路由零客户端引用** | 全仓 grep `apps/mini-program`/`apps/admin-client` 均无 |
| 本步提交仍走既有 payload：`occupationId` + `industryRawInput` + 三层 code/label（存在才带） | `essential-data/index.tsx:573-596` |
| 可信度护栏：`isUsableProfessionResponse` 拒绝 fallback 或 confidence < 0.35 | `lib/onboarding/professionSubmissionGuard.ts` |
| `sanitizeIndustrySource` 把 `user` → `manual`（白名单 `seed\|ontology\|ai\|fallback\|manual`） | 同上 |
| `standardizedOccupationId` 语义**错误**：服务端返回 `classification.niche?.id`，与 `industryNiche` 重复，并非规范职业 ID；但 schema 注释定义它为规范 `OCCUPATIONS.id`（如 `diving_instructor`） | `professionUnderstanding.ts:668`；`_definitions.ts:76` |
| 已有可复用的规范职业解析：`fuzzyMatch`（Levenshtein over `OCCUPATIONS`）+ embedding 索引 | `inference/fuzzyMatcher.ts`；`routes/domains/occupationSearch.ts` |

**当前纠错的真实断点**：AI 判错时，用户唯一的动作是把错误标签一个个点掉，且**无法补上正确的**。用户只能说「不对」，不能说「其实我是 X」。这是本波要解决的核心问题。

---

## 2. 问题陈述

悦仔用对话把「你是做什么的」变成一次情绪体验，但**它不承认自己可能错**。三层分类结果被拍平成 tag 汤，既浪费了最精致的资产，又让纠错变成死胡同。

后果不是「少了个功能」，而是**信任不对称**：系统明确显示「你是数据分析师」，用户却无法反驳；随后（若该用户落入 fallback）其 `industryNiche` 为空，在行业受限池中会被**静默排除且无任何提示**。展示得越肯定，错误越伤。

**本波要回答的问题**：如何让用户在 3 秒内、不感到被打扰、也不感到在做表单的前提下，把 AI 的判断纠正为「对的」？

---

## 3. 目标用户与场景

- **主要**：完成 essential-data 职业输入、进入结果卡的 onboarding 用户（港深 25–35 职场人）。
- **次要**：`useProfessionRetry` 后台补分类后回到 edit-profile 的用户（本波仅保证数据结构兼容，不改 edit-profile UI）。
- **触发场景**：悦仔给出结果卡后，用户看到「角色」行不是自己的职业（长尾职业 / 英文输入 / 拼写变体最容易命中）。

---

## 4. 目标 / 非目标

### 目标
1. 为三层分类提供**屏内、单行、单选的纠错路径**，且纠错不打断悦仔的对话语气。
2. 把结果卡重构为 **职业坐标阶梯**（类别 › 细分 › 角色），取代 tag 汤。
3. 让纠错结果**进入既有提交 payload**，并带 `source='user'` / `confidence=1.0` 语义（用户确认 = 最高可信）。
4. 修复 AIGC 角标假归属（fail-closed）。
5. 把 fallback 死胡同改为**收益导向的补充提示**。

### 非目标（明确排除，防止 creep）
- ❌ 服务端重校验 / 规范化（独立 workstream，本波仅在契约上预留）。
- ❌ 行业专场（`industryRestrictions` 目前**无 admin UI 可写**，属休眠门禁，见 §9）。
- ❌ 职业坐标分享海报。
- ❌ 职业互补雷达 / 组队社交证明（n=6 时为统计噪声）。
- ❌ 从原文抽取公司层级 / 职级（涉及可识别雇主数据，需隐私裁决）。
- ❌ 行业相邻度图 / 匹配权重改动（不触碰 `backgroundDiversity`）。
- ❌ 新增用户可见引擎名词。

---

## 5. 主流程与用户故事

**US-1**｜作为判错职业的用户，我希望看到「角色」那一行可以直接换成对的，这样我的档案才是真的。
**US-2**｜作为不确定的用户，我希望系统给我两三个猜测让我选，而不是让我重新打字。
**US-3**｜作为只被识别到「类别」的用户，我希望能补上「细分」，而不是被迫接受一个模糊标签。
**US-4**｜作为网络不好时的用户，我希望被告知下一步能做什么，而不是只看到「正在细品」。

**主流程**
```
结果卡（阶梯三行）
  ├─ 行全部有值 ──► 自动可确认（唯一主 CTA）
  └─ 点某行「换一个」
        └─ 行内展开 tray（≤3 单选 chips，一次一行）
              ├─ 选一个 ──► 该行更新 + 轻反馈，tray 收起
              └─ 不选/收起 ──► 保持原值，无副作用
  └─ 仍有未知行 ──► 该行渲染虚线「待补充」pill + 收益提示
确认 ──► 写回本地 classificationData（source=user, confidence=1.0）──► 既有提交路径
```

---

## 6. 交互规格

### 6.1 组件解剖（结果卡重构）

```
┌───────────────────────────────────────────────┐
│  [64–72rpx 悦仔]   悦仔记下了你的职业           │  ← 统一标题（三态共用）
│                                                │
│  类别     [科技互联网        ]       换一个 →   │  ← 阶梯行 ×3
│  细分     [AI/机器学习       ]       换一个 →   │     行高 ≥88rpx
│  角色     [算法工程师        ]       换一个 →   │
│                                                │
│  ── 分隔 ──                                     │
│  JoyJoin 里还有很多科技互联网方向的小伙伴        │  ← bridge（沿用，降级为次要层级）
│                                                │
│              [ 确认并继续 ]                     │  ← 唯一主 CTA
└───────────────────────────────────────────────┘
```

- **行结构**：左侧 micro-label（`类别 / 细分 / 角色`，22rpx，meta 灰）→ 中间主 pill（单行，`numberOfLines=1`，超出省略）→ 右侧「换一个」（min-height 88rpx，右对齐）。
- **主 pill 复用 `Chip`**（`apps/mini-program/src/components/ui/Chip.tsx`，props: `label` / `level` / `compact`）。
- **未解析行**：渲染虚线边框的 `待补充` pill（非可选中态），点击行为等同「换一个」。
- **标签去重（评审 F2）**：若「细分」与「角色」标签高度相似（如 segment「前端开发」vs role「前端工程师」），只显示一行、另一行作为内部字段，避免阶梯看起来重复。判定阈值由实现定（建议规范化后相等或高重叠即合并显示）。
- **四概念 vs 三行（评审 F2）**：taxonomy 为 category › segment › niche（三层）+ occupation（角色）共四个概念；阶梯只暴露三行（类别 / 细分 / 角色），**`industryNiche` 不单独暴露**——它的派生规则见 §7.5。不要因为看不到 niche 就忘了写它。
- **头像**：由 40rpx 提升至 **64–72rpx**，或移除、让阶梯本身成为视觉主体。二选一由设计在实现时定，规格倾向 64rpx 保留温度。
- **层级**：bridge 文案（`...方向的小伙伴` / 特质 + 背景）保留但**视觉降级**为次要灰字，不得与阶梯争夺注意力。
- **删除**：5 个装饰性 `__sparkle` 节点、手搓的两段式对勾。保留**一次**柔和对勾绘制。

### 6.2 卡片三态

| 态 | 判定 | 标题 | 阶梯 | 提示 |
|---|---|---|---|---|
| **完整** | 三层皆有值且非 fallback | 悦仔记下了你的职业 | 三行实心 | bridge 灰字 |
| **部分** | 有类别/细分、无角色（或反之） | 悦仔记下了你的职业 | 已知行实心 + 未知行虚线「待补充」 | 收益导向补充提示（见 §6.5） |
| **fallback** | `source` 含 `fallback` | 悦仔记下了你的职业 | 全部虚线「待补充」 | 收益导向补充提示 + 可主动补充入口 |

> **Q1 已拍板：三态共用同一标题。** 标题**不**随状态变化；诚实性由阶梯行承载（实心 = 已识别 / 虚线「待补充」= 未识别）+ 次级提示承载。避免状态依赖的文案分支，也让 fallback 不再暗示「已识别成功」。

### 6.3 「换一个」tray

- **形态**：**行内展开**，不是弹层、不是新页面、不是全屏 sheet。
- **内容**：2–3 个**单选** chips，每个 ≤1 行；数据来自本次分类响应携带的 `correctionCandidates`（见 §7.1）。
- **交互**：一次只展开一行（展开新行自动收起旧行）；选择后立即更新该行并收起 tray；不选可直接收起，无副作用。
- **级联规则（评审 F1-cascade，硬性）**：纠错父级会**清空其子级**——改「类别」→「细分」「角色」回到「待补充」；改「细分」→「角色」回到「待补充」；改「角色」只动 `standardizedOccupationId`，不影响上层。详见 §7.5。
- **禁止**：多选、超过 3 个候选、「提交」按钮、任何表单语义。

### 6.4 动效与触感

- 阶梯行入场：`translateY(12rpx)` + opacity，逐行 60ms 间隔，`cubic-bezier(0.22,1,0.36,1)`，总时长 ≤360ms。
- tray chips：40ms 间隔入场。
- 触感：展开 tray → `light`；选中 chip → `light`；最终确认 → `success`（沿用）。
- **`prefers-reduced-motion` 与设备降级**：跳过分隔动画，仅保留静态呈现（沿用 overlay 既有 `useDeviceTier` / `getSystemReducedMotion` 判定）。

### 6.5 文案（悦仔第二人称，简体，无 emoji，无 AI 词汇）

| 位置 | 文案 |
|---|---|
| 统一标题（三态共用，Q1） | 悦仔记下了你的职业 |
| 行标签 | 类别 / 细分 / 角色 |
| 未解析 pill | 待补充 |
| 纠错动作 | 换一个 |
| 选中确认 | 好，记下了 |
| fallback 收益提示 | 补上职业方向，之后能进更对味的局 |
| bridge（沿用） | `JoyJoin 里还有很多{类别}方向的小伙伴，你们应该很有共鸣～` |

- **禁止词**（canon）：匹配 / 社交 / 灵魂 / 撮合 / AI（可见文案）；也禁止「算法 / 权重 / 加分」。
- 注：当前 shipped fallback 文案「网络有点慢，悦仔先记下了…」保留但**降为次级**，不与收益提示并列。

### 6.6 布局陷阱（硬性）

- tray 在 `<ScrollView>` 内展开会把下方行推出屏幕 → 用 `ScrollView.scrollIntoView`（传 id，**无 `#`**）；`Taro.pageScrollTo` 在 ScrollView 内是 no-op。
- **组件 SCSS 必须在消费页 SCSS 里 `@use`**，或 Taro 会把样式 chunk 掉，真机出现无样式空白（反复发生的空白 UI 事故）。overlay 属 onboarding 主包，遵循既有 `import './ProfessionChatOverlay.scss'` 模式即可，但新增子组件必须同 PR 带样式。
- `Chip compact` 可能 <88rpx → 外层容器保证 `min-height` 88rpx。
- WXSS 禁用 `min()/max()/clamp()`；逐帧动画禁用 CSS 自定义属性，用内联 px transform。
- 加载/空/错误态必须垂直居中（`min-height: 100dvh` + flex）。

### 6.7 出卡后的输入区语义（评审 F5）

- **阶梯出现后，聊天输入区隐藏 / 禁用**：否则用户再次发送会**静默丢弃**已做的纠错。出卡后纠错的唯一入口是阶梯的「换一个」。
- **移除**「没识别准确？点击重新分析」重试 hint（`ProfessionChatOverlay.tsx:913`）——已被「换一个」取代；保留会与阶梯竞争且语义重复。
- **渲染条件变更**：当前 reveal 卡门控为 `showRevealCard && revealTags.length > 0`（`:977`）。阶梯必须**基于行数据渲染**，不再依赖 `revealTags`；某行无候选时渲染「待补充」，而不是因为 tag 为空就不渲染整卡。
- 若产品后续仍想保留「重新描述」，应作为显式次级动作（如「重新描述」入口），而非常驻输入框；**本波不做**，仅隐藏。

---

## 7. 数据契约

### 7.1 分类响应扩展（服务端）

在 `POST /api/inference/understand-profession` 响应中**新增可选字段**（向后兼容，老客户端忽略）：

```ts
interface UnderstandProfessionResponse {
  // ...既有字段不变
  correctionCandidates?: {
    category: Array<{ id: string; label: string }>;   // ≤3
    segment:  Array<{ id: string; label: string }>;   // ≤3
    occupation: Array<{ id: string; label: string }>; // ≤3，来源：occupationSearch 向量索引
  };
}
```

- **候选来源（评审 F1 修正：复用既有机制，不新建 embedding 流水线）**：
  - `category` / `segment` / `occupation` **首选复用 `industryClassifier.ts` 已有的 `generateCandidates()`**（`industryClassifier.ts:442`）。分类结果在 `confidence < 0.7` 及 fallback 时**已返回** `candidates[]`（含 `category/segment/niche/confidence/reasoning/occupationId/occupationName`），确定性、无 LLM 调用、无新产物——`understand-profession` 目前只是**未透传**它，本波把它映射进响应即可。
  - `occupation` 行在既有候选不足时，用已存在的 164 条职业向量索引（`OCCUPATIONS` 共 164 条，全部已向量化；`occupationSearch.ts` 的 `loadIndex()` + `cosine()`）补齐，仍**不新增 LLM 调用**。
  - **不要**为 category/segment 新建 taxonomy 向量产物；`generateCandidates` 已按关键词 / 同义词 / occupation 匹配产出，覆盖足够。
- 服务端裁剪为 ≤3，去重，排除已选值。
- 若候选为空（纯 fallback），字段可省 → UI 走 fallback 态。
- **Q2 已拍板：候选随分类首包返回**，不新增独立端点、不新增往返。首包候选足以支持「每行一次换一个」。
- **Q3 已拍板：不设「其他（手动输入）」chip**。`occupation` 候选为空时（长尾职业），角色行保持「待补充」，**不回退自由文本**，维持单选一致性。
- 复用 `occupationSearch.ts` 的索引加载逻辑时，按 `server-domain-architecture` 抽出共享模块（建议 `apps/server/src/lib/occupationVectorIndex.ts`），`occupationSearch` 与新分类服务共同引用——**不要**让分类 domain 直接 import 一个 routes 文件。

### 7.2 本地状态与持久化

- **不新增持久化端点**。纠错只更新 overlay 的本地 `classificationData`（`ProfessionChatOverlay.tsx:718-729` 同形状），随后由**既有** `essential-data` 提交路径（`essential-data/index.tsx:573-596`）落库。
- **持久化已核实（评审 F6）**：`updateFullProfileSchema` 的 pick 列表**已包含** `industryCategory*` / `industrySegment*` / `industryNiche*` / `industrySource` / `industryConfidence` / `occupationId` / **`standardizedOccupationId`**（`_definitions.ts:844-866`）。本波**无需 schema 变更、无需迁移**——纠错写回既有字段即可，无静默丢弃风险。
- **数据形状保持不变**：三层 code + label 同步更新（`industryCategory` / `industrySegmentNew` / `industryNiche` 及其 `*Label`），保证 label 与 code 不脱钩。
- 若纠正「角色」：同步更新 `standardizedOccupationId` 为所选职业的**规范 `OCCUPATIONS.id`**（语义修正见 §7.4，本波一并落地）。纠错后的 `standardizedOccupationId` 必须与 `correctionCandidates.occupation[].id` 同源，保证「显示什么 = 存什么」。

### 7.3 source / confidence 语义

| 场景 | `industrySource` | `industryConfidence` |
|---|---|---|
| 用户未纠错，沿用 AI | 响应原值（`ai`/`seed`/…） | 响应原值 |
| 用户纠错 ≥1 行 | `'user'`（经 `sanitizeIndustrySource` → 落库 `manual`） | `1.0` |

**理由**：用户确认是最高可信信号，`manual` 已在白名单内，无需改 schema。

### 7.4 `standardizedOccupationId` 语义修正（Q4，本波落地）

**现状缺陷**：`professionUnderstanding.ts:668` 返回 `classification.niche?.id ?? null`，使该字段等价于 `industryNiche`，并未承载「规范职业 ID」语义。而 `_definitions.ts:76` 的注释明确定义它为规范 ID（例：`diving_instructor`）。下游（overlay / `useProfessionRetry` / edit-profile / essential-data）均在传递这个错值。

**修正契约**：

```ts
// 语义：规范职业 ID = OCCUPATIONS[].id；与 industryNiche 完全解耦
standardizedOccupationId: string | null;
```

**解析顺序（服务端，确定性）**：
1. 精确 / synonyms 命中 `OCCUPATIONS` → 取该 `id`（置信 1.0）。
2. ~~embedding 索引最高分且 `confidence ≥ 阈值` → 取该 `occupationId`。~~
   **本波改写（2026-09-15 产品决策）**：`OCCUPATION_RESOLUTION_THRESHOLD = null`，**embedding 分支禁用**，自动解析仅走 exact/synonym。原因：仓库内没有独立的人工标注语料，自造语料会让 precision 循环自证（AC-11 曾因此 REJECT）。真实语料 + 校准 τ 作为**后续任务**；校准脚本保留但不被运行时消费。
3. 否则 → `null`（**不猜**；宁可为空也不写错值）。

**硬性约束**：
- `standardizedOccupationId` 必须与 `correctionCandidates.occupation[].id` 取自**同一解析结果**——用户在「角色」行看到并选中的 ID，就是最终落库的 ID。
- **阈值不得直接复用 `MIN_STRUCTURED_CONFIDENCE = 0.35`**（评审 P2）——0.35 是意图置信口径，对 cosine 职业映射太弱，会大量写错。必须对 `occupation-vectors.json` 跑**离线校准**（已知输入的 precision/recall 曲线）后取一个更高阈值，并把校准脚本 / 报告作为本波交付物之一（见 §13）。低置信一律 `null`。
- **无 schema 变更**（列注释已为此语义）；无迁移。
- 与 `industryNiche` 的重复耦合解除后，`industryNiche` 仍由三层分类独立承担，二者不再互相冒充。
- 阈值具体取值属残留开放项（见 §9 R1），但**校准方法**是本波硬要求，不是「实现时再说」。

### 7.5 纠错级联与 `industryNiche` 派生（评审 F1-cascade / F2，硬性）

**问题**：三行阶梯只暴露 category / segment / occupation，但匹配真正读取的是 `industryNiche`。若不定义派生与级联，会出现「用户改了父级、子级还是 AI 旧值」或「改了角色、niche 却对不上」——正是本功能要消灭的不一致。

**级联规则**：

| 用户改动 | 对下游的影响 |
|---|---|
| 改 **类别** | 清空 `industrySegmentNew` / `industryNiche`（含 label）→ 细分行、角色行回「待补充」 |
| 改 **细分** | 清空 `industryNiche`（含 label）→ 角色行回「待补充」 |
| 改 **角色**（occupation） | 只更新 `standardizedOccupationId`；上层 category / segment **不动**（role 与 industry 路径是两条独立信号，符合 §7.4 的解耦） |

**`industryNiche` 派生规则（角色纠错时，三态必须显式编码）**：
1. 所选 occupation **有 `seedMappings` 且带 `niche`** → 由 `seedMappings.{category,segment,niche}` 回填三层 + label。
2. 所选 occupation **有 `seedMappings` 但不含 `niche` 键**（如 `mobile_engineer` / `blockchain_engineer`）→ 回填 category/segment，**`industryNiche` 置 `null`**（不臆造）。
3. 所选 occupation **不含 `seedMappings`**（当前 164 条中仅 35 条有，其余无）→ 保留上层已确认的 category/segment，`industryNiche` 置 `null`（宁缺勿错）。
4. 该规则必须在实现中显式编码；**不得**用「角色 label 猜 niche」。三态缺一不可，尤其状态 2 最易被误写成「回填三层」。

**约束**：纠错后的三层 code/label 必须始终成对且同源；`industryCategory`/`industrySegmentNew`/`industryNiche` 三者不得出现「用户改的父 + AI 的旧子」混合态。

---

## 8. 验收标准

- [ ] **AC-1** 结果卡渲染为三行阶梯（类别/细分/角色），tag 汤与 5 个 sparkle 已移除。
- [ ] **AC-2** 点击任意行「换一个」在该行**行内**展开 ≤3 个单选 chips；不出现弹层/新页面/「提交」。
- [ ] **AC-3** 选择 chip 后该行即时更新，tray 收起，escalation 触感 `light`；再点「换一个」可再次修改（**修复「只能删不能改」**）。
- [ ] **AC-4** 展开 tray 时目标行仍在视口内（`scrollIntoView` 生效，真机验证）。
- [ ] **AC-5** 纠错后提交的 payload 中三层 code 与 label 同步且一致，`industrySource='user'`→`manual`，`industryConfidence=1.0`。
- [ ] **AC-6** 未解析行渲染虚线「待补充」pill，且点击行为等同「换一个」。
- [ ] **AC-7** fallback 态显示收益导向提示，且**不**呈现「已识别成功」口吻；AIGC 角标在 fallback/确定性内容时**不渲染**（fail-closed）。**实现方式（评审 F4）**：把服务端 `data.meta.aigc` 透传给 `AIGCLabel`，删除 `ProfessionChatOverlay.tsx:1043` 的硬编码字面量——服务端 `buildAIGCMeta({ fallbackUsed })` 已正确返回 `{ aiGenerated: false }`（`aiMeta.ts:94-97`），是客户端把它丢掉了。
- [ ] **AC-8** 全卡只有**一个**主 CTA。**现状即已满足（评审 P1）**：footer confirm 已由 `!showRevealCard` 门控（`ProfessionChatOverlay.tsx:1172`），阶梯展示时只保留卡内确认。本 AC 仅要求**保持**并加注释说明，不引入双主按钮。
- [ ] **AC-9** `prefers-reduced-motion` 与降级设备下无分隔动画，静态可用。
- [ ] **AC-10** 无 emoji、无 canon 禁止词、CTA ≤12 字；`npm run guardrails` 通过；`npm run typecheck -w mini-program` 与 `npm run typecheck -w @joyjoin/server` 均通过（Q4 含服务端改动）。
- [ ] **AC-11** 真机（WeChat DevTools 或实机）验证完整/部分/fallback 三态 + 键盘态。
- [ ] **AC-12** 服务端返回的 `standardizedOccupationId` 是规范 `OCCUPATIONS.id`（或 `null`），**不等于** `industryNiche`；低置信时为 `null` 而非猜测值（`professionUnderstanding.ts` 单测覆盖）。
- [ ] **AC-13** 用户纠正「角色」后，落库的 `standardizedOccupationId` 等于所选 `correctionCandidates.occupation[].id`（显示 = 存储）。
- [ ] **AC-14（级联）** 改「类别」→ 细分/角色回到「待补充」且对应字段清空；改「细分」→ 角色回到「待补充」；改「角色」→ 上层不变。三层不出现「新父 + 旧子」混合态（§7.5）。
- [ ] **AC-15（niche 派生）** 角色纠错且所选 occupation 有 `seedMappings` 时，三层由 seedMappings 回填；无 `seedMappings` 时 `industryNiche = null` 而非猜测值（§7.5）。
- [ ] **AC-16（出卡输入）** 阶梯展示后聊天输入区隐藏/禁用；「没识别准确？点击重新分析」hint 已移除；阶梯基于行数据渲染，不再依赖 `revealTags.length`（§6.7）。
- [ ] **AC-17（候选复用）** `correctionCandidates` 由既有 `generateCandidates()` 透传 + occupation 索引补齐；category/segment **未**新增 taxonomy 向量产物（§7.1）。
- [ ] **AC-18（阈值校准）** 角色解析阈值来自离线校准且高于 0.35；校准脚本/报告已提交（§7.4 / §13）。

---

## 9. 约束 / 风险 / 依赖 / 开放问题

### 风险
1. **表单化风险（最高）**：阶梯一旦出现常驻 chips、多选或「提交」，立刻变成简历字段组。**缓解**：chips 只在「换一个」之后出现，≤3、单选、一次一行。
2. **假归属合规风险**：AIGC 角标硬编码 `aiGenerated: true` 已在生产；本波必须一并 fail-closed，否则改版放大。**修复面比 spec 初稿小**：服务端 meta 已正确，只需客户端透传（见 §9「已核实」）。
3. **静默排除未解**：本波只解决「用户能纠正」，若用户仍不纠正且落 fallback，行业受限池的静默排除仍在。属 §12 遗留（需 `matching-domain` grill-me 后再动 L1）。
4. **样式 chunk 空白**：新增子组件 SCSS 未在消费页 `@use` → 真机空白（反复事故）。

### 依赖
- **AIGC fail-closed 修复**（阻断级，同 PR）：客户端把服务端 `data.meta.aigc` 透传给 `AIGCLabel`，删除硬编码字面量（`ProfessionChatOverlay.tsx:1043`）。服务端无需改动。
- `occupationSearch` 的 `loadIndex()` 可被分类服务复用（跨 domain 引用需按 `server-domain-architecture` 决定放置：建议抽 `lib/occupationVectorIndex.ts`，两处引用）。
- 无 schema 变更、无迁移。

### 已核实（评审锚点，2026-09-15）
| # | 核实结论 | 证据 |
|---|---|---|
| F1 | `generateCandidates()` 已存在且在低置信/fallback 时返回完整候选（含 `occupationId`/`occupationName`），`understand-profession` 只是未透传 | `industryClassifier.ts:442, 993-1019` |
| F4 | 服务端 `buildAIGCMeta({ fallbackUsed })` 已正确返回 `{ aiGenerated: false }`；客户端丢弃并硬编码 `true` | `aiMeta.ts:94-97`；`ProfessionChatOverlay.tsx:1043` |
| F6 | `updateFullProfileSchema` 已 pick 全部行业字段（含 `standardizedOccupationId`），持久化无缺口 | `_definitions.ts:844-866` |

### 已拍板（2026-09-15，原开放问题）
- **Q1 ✅ 三态标题统一**为「悦仔记下了你的职业」；诚实性由阶梯行承载（见 §6.2）。
- **Q2 ✅ 候选随分类首包返回**；不新增端点（见 §7.1）。
- **Q3 ✅ 不设「其他（手动输入）」chip**；无候选即「待补充」（见 §7.1）。
- **Q4 ✅ `standardizedOccupationId` 语义本波修正**为规范 `OCCUPATIONS.id`（见 §7.4）。

### 残留开放项（不阻断开工，实现时校准）
- **R1**：occupation 解析的置信阈值取值——需离线样本校准，避免过度 `null`（见 §7.4）。
- **R2**：部分态是否给一句更具体的「哪一层没识别」次级提示？（当前仅收益导向提示；可在实现中按真机观感决定，不阻塞）

---

## 10. 成功指标

| 指标 | 定义 | 目标 |
|---|---|---|
| **主指标：null-`industryNiche` 率** | onboarding 完成后 `industryNiche` 为空的比例 | **< 5%**（实现前先跑基线测量任务，见下方） |
| **角色解析率（评审 P3）** | onboarding 完成后 `standardizedOccupationId` 非空的会话占比 | **> 60%**（Q3 不设手动输入，长尾角色会留空——这是诚实上限检查） |
| 纠错采纳率 | 有 ≥1 行纠错的会话 / 有结果卡的会话 | 10%–25%（低于 10% 说明 AI 已足够准；高于 25% 说明分类器需修） |
| 纠错确认率 | 展开 tray 后至少选 1 个的会话 / 展开 sessions | > 50% |
| 数据质量增量 | 纠错后最终存储 niche ≠ AI 原始 niche 的会话占比 | 观测值，用于回归分类器 |
| 步骤完成率 | essential-data 完成率 | **不得下降**（改版不得损伤转化） |
| AIGC 误标率 | fallback 内容渲染 AI 角标的会话数 | **= 0**（fail-closed） |

**前置任务（P3）**：主指标与角色解析率在实现前**都没有基线**。开工第一步先跑一次只读 SQL 统计当前 onboarding 完成人群的 `industryNiche IS NULL` 与 `standardizedOccupationId IS NULL` 比例，写入本节作为对照，否则「<5%」「>60%」无法评估。

### 基线（2026-09-15，AC-23 / OBS-03）

只读 SQL，本地 dev DB（`has_completed_registration = true`）：

| 指标 | 值 |
|---|---|
| 完成 onboarding 用户数 | **108** |
| `industry_niche IS NULL` | 100 / 108 = **92.6%** |
| `standardized_occupation_id IS NULL` | 108 / 108 = **100%** |
| `industry_raw_input IS NOT NULL` | **0** |

> ⚠️ **基线口径警告**：这是**本地 dev DB**，且 `industry_raw_input` 为 0 → 该人群**从未提交过职业自由文本**（overlay 未被使用或早于该功能），因此**不代表本功能的目标人群**，不能直接对照 `<5%` / `>60%` 目标。上线前须在**生产库**重跑同一只读查询作为正式基线；本节数值仅作为「纠正前状态」的记录证据（`standardizedOccupationId` 100% 为空，佐证语义修正的必要性）。

---

## 11. 埋点

沿用 overlay 既有 `analytics.interaction(event, metadata)` 模式（`profession_chat_*` 系列）。

| 事件 | 触发 | metadata |
|---|---|---|
| `profession_chat_ladder_viewed` | 结果卡渲染 | `tierCount`（有值行数）, `source`, `confidence` |
| `profession_chat_correction_opened` | 点「换一个」 | `tier`（category/segment/occupation）, `candidateCount` |
| `profession_chat_tier_corrected` | 选中 chip | `tier`, `from`, `to`（均为 code，非文案） |
| `profession_chat_correction_confirmed` | 确认时存在 ≥1 纠错 | `correctedTiers[]` |
| `profession_chat_correction_abandoned` | 离开时展开过 tray 但未纠错 | `tier`, `reason` |

**注意**：metadata 只带 code / 计数，**不带**用户原始输入文案。

**清理（评审 P4 / P7）**：
- `profession_chat_tag_removed` 随 tag 汤移除而**废弃**，本波一并删除该埋点调用；`displayTags` 服务端仍返回但新 UI **不再渲染**，作为向后兼容**保留**（下波清理，勿在本 PR 移除）。
- `profession_chat_ladder_viewed` 应替代原 `profession_chat_reveal_card_viewed`（若后者存在），避免同一卡两个语义重复事件。

---

## 12. 分期与范围

| 波次 | 内容 | 本规格覆盖 |
|---|---|---|
| **本波（本文档）** | 阶梯 + chips 纠错；AIGC fail-closed；唯一 CTA；**`standardizedOccupationId` 语义修正（Q4）**；`correctionCandidates` 随首包返回；**部分态**收益提示 | ✅ |
| **下一波** | 服务端重校验 / 规范化（label-code 一致性、拒绝脏对）；null-niche fail-open（需 `matching-domain` grill-me） | ❌ 本波不做 |
| **已顺延（2026-09-15 决策）** | ① **纯 fallback 全虚线卡片 + §6.7「重新描述」恢复入口**（fallback 现保持输入可用，无死胡同；避免未接恢复入口就上死态）② **embedding 职业解析 + 校准 τ**（需真实独立标注语料，见 §7.4） | ❌ 本波不做 |
| **更后** | 多信号抽取（隐私裁决先行）；行业相邻度图；embedding 作为 Tier 2.5 进分类级联 | ❌ |
| **已砍** | 分享海报、互补雷达、结果闭环调权、admin 审核队列 | ❌ |

**发布（评审 P5）**：**不新增 feature flag**。阶梯改造沿用既有 `smartProfession`（DB-backed，env `SMART_PROFESSION_ENABLED`）门控——关闭时走 legacy 关键词路径，天然有回滚面。无需额外 kill switch。

---

## 13. 测试计划（评审 P6）

| 层 | 文件 | 覆盖 |
|---|---|---|
| 服务端单元 | `apps/server/src/__tests__/professionUnderstanding.test.ts`（新建或扩展） | 解析顺序（exact/synonym → embedding → null）；低置信 → `null`；`correctionCandidates` 透传自 `generateCandidates`；`standardizedOccupationId ≠ industryNiche`；阈值校准边界 |
| 服务端结构 | 复用 `industryClassifier` 既有 `candidateGeneration.test.ts` | `generateCandidates` 输出形状满足 `correctionCandidates` 契约 |
| 客户端结构 | 新建 `ProfessionChatOverlay.spec`（沿用 repo 客户端结构测试模式） | 级联规则（§7.5）；出卡后输入隐藏（§6.7）；AIGC meta 透传；唯一 CTA |
| 门禁 | `npm run guardrails` | BEM class coverage（新 `.scss` 必须带样式）、diff design-audit（changed lines）、无 emoji |

---

## 14. 既有模式速查表（实现引用真实位置）

| 用途 | 既有模式 | 位置 |
|---|---|---|
| overlay 根 / 结果卡 | 全屏 overlay + ScrollView + 静态 bottom-anchor | `ProfessionChatOverlay.tsx:1039-1096` |
| 结果卡标题 / fallback 分支 | `industrySource?.includes('fallback')` 条件渲染 | `:1040, :1083-1085` |
| 分类本地状态形状 | `classificationData`（三层 code+label + source + confidence） | `:27-35, :718-729` |
| Tag pill | `Chip`（`label` / `level` / `compact` / `selected`） | `components/ui/Chip.tsx` |
| 图标（禁用 emoji） | `JoyJoinIcon` | `components/ui/JoyJoinIcon.tsx` |
| 触感 | `haptics('light'\|'medium'\|'success')` | `lib/utils/haptics.ts` |
| 降级 / 减少动效 | `useDeviceTier()` + `getSystemReducedMotion()` | `hooks/useDeviceTier.ts`, `lib/utils/accessibility.ts` |
| swipe-back 状态复位 | `useResetOnShow`（若新增展开态 state） | `hooks/useResetOnShow.ts` |
| 可信度护栏 | `isUsableProfessionResponse` / `sanitizeIndustrySource` | `lib/onboarding/professionSubmissionGuard.ts` |
| 提交 payload | essential-data 条件展开三层字段 | `pages/onboarding/essential-data/index.tsx:573-596` |
| 服务端索引 | `loadIndex()` + `cosine()` | `apps/server/src/routes/domains/occupationSearch.ts` |
| 分类级联 | 4 层 + niche 推断 | `apps/server/src/inference/industryClassifier.ts` |
| AIGC 角标 | `AIGCLabel`（`shouldShowAIGCLabel(meta)` gate） | `components/ai-content/AIGCLabel.tsx` |
| 埋点 | `analytics.interaction(event, metadata)` | `ProfessionChatOverlay.tsx` 内 `analytics` |

---

## 附：评审记录（本次会话收敛）

- **PM**：主目标是身份可信度/转化，非对话引擎；chips 作为 on-demand 纠错；行业专场为休眠门禁（无 admin writer），不要为其造基建；砍分享卡与互补雷达；canon 城市为港深。
- **UI/UX**：纠错死胡同是最严重的精致度缺陷；用「坐标阶梯」取代 tag 汤；chips 只能藏在「换一个」之后，≤3、单选、一次一行；删 sparkle，用留白读精致；AIGC 角标必须 fail-closed；注意 ScrollView / SCSS chunk 两个真机陷阱。
- **工程核实**：`industryRestrictions` 在 `admin-client` 零引用（确认休眠）；`ProfessionChatOverlay.tsx:1042-1045` 硬编码 `aiGenerated: true`（确认真实缺陷）；`occupationSearch` 零客户端引用（确认死资产）。
- **Q1–Q4 拍板（2026-09-15）**：Q1 三态标题统一；Q2 候选随首包；Q3 不设手动输入 chip；Q4 `standardizedOccupationId` 本波修正。Q4 使本波范围**新增服务端解析改动**，残留项 R1（阈值校准）不阻断开工。
- **第二轮评审（2026-09-15，F1–F6 + P1–P7 已应用）**：复用 `generateCandidates`（F1）；补级联 + niche 派生（§7.5）；niche 不暴露说明（§6.1）；AIGC 改为透传（F4）；补出卡输入语义（§6.7）；确认持久化无缺口（F6）；阈值必须校准（P2）；角色解析率指标 + 基线任务（P3）；埋点清理（P4/P7）；不新增 flag（P5）；新增 §13 测试计划（P6）。
