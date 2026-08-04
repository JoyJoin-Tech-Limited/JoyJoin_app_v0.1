# 决策记录：恢复「浪漫邂逅」聚会意图选项（活动优先文案）

- **日期**：2026-08-03
- **状态**：已批准（干系人确认）
- **相关代码**：`packages/shared/src/constants.ts`（`INTENT_OPTIONS`）、`packages/shared/src/schema/_definitions.ts`（`registerUserSchema.intent`）、`apps/server/src/lib/profileEnrichment.ts`、`apps/server/src/deepseekClientXiaoyue.ts`、`apps/server/src/poolMatchingService.ts`（`MUTUAL_ROMANCE_TENSION_BONUS`）

## 背景

- `romance`（浪漫邂逅 / 遇见心动）于 2026-01-20 随 `INTENT_OPTIONS` 一并创建（commit `3bcfef27c`）。
- 2026-07-09，commit `48461d090`（"chore: batch commit all WIP changes"）将其一对一替换为 `explore`（尝鲜体验），同批在 `PRODUCT_REQUIREMENTS.md` 写入 "JoyJoin is 兴趣活动驱动的轻社交 — not a romance-seeking app" 的定位声明。**该次移除没有独立决策文档**，审计轨迹仅存在于批量提交中。
- 2026-08-03 干系人提出："为什么没有了浪漫的选项？"

## 决策

**恢复 `romance` 为第 6 个显式意图选项，但采用活动优先框架文案：**

```ts
{ value: "romance", label: "浪漫邂逅", subtitle: "在好玩的活动里，遇见心动", emoji: "💗", iconHint: "Heart" }
```

- 不恢复原版副标题「遇见心动」（直接承诺心动结果，偏向约会软件框架）。
- 副标题把心动放进「活动」容器里——承认动机，不承诺约会结果，符合 🔴 文案规则（无机制词、无虚构承诺、≤25 字）。
- **匹配加权（初版决策，同日被修正）**：初版决定不新增任何 romance 专属加权，仅靠 `commonIntent` 重叠评分天然处理；同日干系人修正为"双向 romance 允许 +5 张力加成"——见下方「后续修正」。
- PRD §560 定位声明**不改动**：本次恢复是对用户动机的诚实采集，而非产品定位反转。
- squad-unboxing 卡面不展示 intent 的既有规则（PRD §189）继续成立。

### 后续修正（2026-08-03 同日，干系人决策）

初版决策"不新增任何 romance 专属匹配加权"已按干系人指示修正：**当配对双方都 indicate `romance` 时，允许一点浪漫张力**——`calculatePairScore` 在加权总分后追加 **+5 双向浪漫加成**（`MUTUAL_ROMANCE_TENSION_BONUS`，post-weight、封顶 100，与 `wouldMeetAgain` +5 同一模式）。单向 romance 不产生任何加成；维度权重表不变。理由："不单纯只是一个纯找搭子的软件，一切看缘分"——双向奔赴的信号值得被轻轻推一把，但管道不会变成约会匹配器。测试覆盖：`poolMatchingService.test.ts` 的 `mutual romance tension bonus` 套件（双向 +5 / 单向为零 / 封顶 100 / eventIntent→userIntent 回退链）。

## 理由

1. 隐藏选项并不能消除动机——它把浪漫意图洗进 `friends`/`fun` 的噪声选择里，污染匹配依赖的 intent 信号。
2. 服务器三处 allow-list（schema enum、`ALLOWED_EVENT_INTENTS`、Xiaoyue 归一化）此前拒绝 `romance`，导致旧 DB 行中的 `romance` 值成为孤儿数据；恢复后这些数据重新合法，无需迁移。
3. 品牌风险通过文案框架而非选项缺失来管理。

## 备选方案（已否决）

- **保持现状不加**：品牌线最干净，但持续产生信号污染与信任损耗（本次干系人提问即是证据）。
- **恢复原版文案「遇见心动」**：与 "not a romance-seeking app" 定位张力最大。

## 治理教训

定位级变更不得随批量 WIP 提交落地。此类变更必须配有 `docs/deliberations/` 决策记录——本文档即补上 2026-07-09 缺失的审计轨迹。
