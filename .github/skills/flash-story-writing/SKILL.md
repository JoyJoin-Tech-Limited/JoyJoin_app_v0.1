---
name: flash-story-writing
description: >-
  街头盲盒（Flash）story episode v2 文案生产与质量规范：单元节点模型（5-9 节点状态驱动分支）、
  选择回响三层（即时/持续/结局）、每单元悬念钩子、5 NPC 风格指纹、去AI味三遍法、
  与 check-flash-story.mjs 质量门对接。覆盖离线生成→自动校验→人工审核→入库全流程，
  运行时零 LLM。触发：街头盲盒剧情、flash story、单元v2、悬念钩子、去AI味、风格指纹、
  copy-spec、阿浪、栗子、默默、拾柒、阿团。配合 llm-runtime-safety-and-integration（离线生成边界）、
  joyjoin-brand-guidelines（文案调性）。
---

# flash-story-writing（街头盲盒剧情文案 v2）

## Hard constraints（铁律，违反即返工）

- **运行时零 LLM**：全部内容离线生成 + 人工审核入库；运行时代码路径不得调 LLM（`docs/agent-context/alang-flash.md`）。
- **坐标隐私**：剧情文本/节点/选项/碎片永不包含坐标、距离、路线、班次细节；只允许 admin 审核过的公开地点名。
- **单元 v2 节点模型**：每个 episode = 5-9 个节点（建制→登场→选择点→汇合→收束），消灭假三选。
- **选择必有回响**：即时 callback（每选必做）+ 持续影响（跨单元 flag/val）+ 结局差异；`changes ≠ callback`。
- **分支配比**：态度 60-70% / 路径 20-30% / 命运 ~10%；单节点 2-3 选项，无装饰性选项。
- **基调**：治愈底色 + 每单元 ≥1 个悬念钩子；第 2-3 幕 1-2 处轻冲突；第 3 幕钩子收束。
- **结局矩阵**：真结局 1 / 普通 1-2 / 分支 2-3 / 隐藏 0-1；结局前必须 closure 节点；结局页是判词不是剧情摘要。
- **质量门**：任何 episode 写入前必须过 `scripts/check/check-flash-story.mjs`（零违规）。

## 生产管线

```
叙事策略锁定稿 → 单元设计文档（每单元）→ 离线生成（本 skill）→ 自动校验（质量门）
→ 人工审核（adminAlang review 流程）→ 入库（content_version 递增）
```

## 工作流（每单元）

1. **读语感卡 + 设计文档**：先读 `references/voice-card.md`（目标语感/五维卡片/失控感清单），再读叙事策略锁定稿 + 该单元设计（节点规划/状态变化/钩子位置）+ 对应 NPC 风格指纹（`references/style-fingerprints.md`）。
2. **声明情绪目标**：按 `voice-card.md` §1 情绪目标表登记（无声明不写）。
3. **写节点 JSON**：按 `references/node-model.md` 的 v2 结构；每节点先答"叙事目的"，无目的不写。
4. **选项自查**：逐条过 `references/copy-rules.md` 选项铁律（台词/动作直写、不引用未知信息、只回应此刻）。
5. **回响检查**：每选项专属 callback；同向选项插独立 callback 节点；状态变化与文案可见差异一一对应。
6. **钩子检查**：单元内 ≥1 悬念钩子（`references/hooks-and-emotion.md` 钩子库选型），登记在单元设计文档，第 3 幕回收。
7. **去AI味三遍 + 失控感检查**：按 `references/de-ai-check.md` 执行（词表扫描→句式改写→通读判读感），再按 `voice-card.md` §3 失控感清单逐条打勾。
8. **过质量门**：跑 `node scripts/check/check-flash-story.mjs` 零致命违规，附自检报告，转人工审核。

## References（按需加载）

| 文件 | 用途 |
|------|------|
| [references/voice-card.md](references/voice-card.md) | **语感卡**：五维风格打分基准、失控感清单、温暖现实收束规则、金句校准、自检十问（动笔前必读） |
| [references/node-model.md](references/node-model.md) | 单元 v2 节点 JSON 结构、节点类型、state/condition 语法 |
| [references/copy-rules.md](references/copy-rules.md) | 文案铁律完整清单 + 自检十问 |
| [references/style-fingerprints.md](references/style-fingerprints.md) | 5 NPC 风格指纹（5 维：叙述温度/对白风格/节奏型/口头禅/禁区） |
| [references/hooks-and-emotion.md](references/hooks-and-emotion.md) | 悬念钩子库（13 式改编）+ 情绪弧线（和解+悬念） |
| [references/de-ai-check.md](references/de-ai-check.md) | 去AI味三遍法、禁用词表、检测清单（词表→句式→通读） |
| [references/validator-interface.md](references/validator-interface.md) | check-flash-story.mjs 校验契约（E101–E113 结构 + E114–E122 语感卡门禁） |
| [references/vendor/](references/vendor/) | 上游写作参考原文（human-texture / warm-realism / sentence-rhythm / anti-ai-checklist / style-imitation，MIT） |

## Quick example（before/after）

**Before（v1，违禁项标注）：**
```
question: "你想先注意哪一件事？"
选项: "它刚才做的动作"  ← 抽象描述行为，不是台词/动作
responseByOption: "你注意到了它怎样处理，而不是只听它解释。"  ← 心理总结腔 + 说教
```

**After（v2）：**
```
N3 选择点: 阿浪把图按旧折痕收好。
选项: "这图画的是两个人吧。"  ← 直接台词
     / 把纸转回原来的方向      ← 直接动作
N4 回响: "阿浪愣了一下，手指停在折痕上："画图的人……可能是我爷爷。""  ← 专属 callback + 钩子
```

## Troubleshooting

| 症状 | 处理 |
|------|------|
| 写出来又是心理总结腔 | 对照 `de-ai-check.md` 词表扫描 + `copy-rules.md` 禁令 2/3 |
| 选项变成三个同构 | 检查分支配比表 + 每选项信息差是否真实 |
| 5 个 NPC 口吻混同 | 逐句对照 `style-fingerprints.md` 该 NPC 对白规则 |
| 钩子悬空未回收 | 单元设计文档钩子登记表 + 第 3 幕回收检查 |
| 质量门报错 | 按 `validator-interface.md` 错误码逐条修复，禁止绕过 |

## Review checklist

- [ ] 每单元 5-9 节点，无假三选；每节点有叙事目的 + 情绪目标已登记
- [ ] 每选项专属 callback；状态变化有可见文本差异
- [ ] 无心理描写/说教/元叙事词/叙述者提问/升华收束；选项为台词或动作
- [ ] 每单元 ≥1 悬念钩子且登记回收；基调未偏离治愈+悬念
- [ ] 口吻匹配该 NPC 风格指纹
- [ ] 失控感清单逐条达标（≥1 话说一半、≥1 非理性小动作、允许 1 条没收干净的线）
- [ ] `node scripts/check/check-flash-story.mjs` 零致命违规（警告项附处理说明）
- [ ] 审核通过、review_status='reviewed' 后入库
