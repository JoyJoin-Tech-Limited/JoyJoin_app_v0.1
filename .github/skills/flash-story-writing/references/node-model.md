# 单元 v2 节点模型（node-model）

> 街头盲盒 story episode v2 的 content JSON 结构与写作规则。取代 v1 的
> `{opening, action, discovery, question, responseByOption, closing}` 扁平结构。
> 结构契约待 `flashStoryEngine.ts`（Tier 2 Sprint Contract）实现后与代码对齐；本文件是写作侧规范。

## 1. 总体结构

```json
{
  "v": 2,
  "start": "n1_setup",
  "nodes": {
    "n1_setup": { "type": "prose", "segments": [...], "next": "n2_object" },
    "n2_object": { "type": "prose", "segments": [...], "next": "n3_choice" },
    "n3_choice": { "type": "choice", "segments": [...], "choices": [...] },
    "n4_echo_a": { "type": "callback", "segments": [...], "next": "n5_close" },
    "n4_echo_b": { "type": "callback", "segments": [...], "next": "n5_close" },
    "n5_close": { "type": "closure", "segments": [...], "state": {...}, "unlockFragment": "s1-p1-alang-fragment" }
  },
  "state": { "valDelta": {"echo": 5}, "flagsSet": ["alang-first-glance"], "variables": {} }
}
```

## 2. 节点类型

| type | 用途 | 约束 |
|------|------|------|
| `prose` | 叙述推进（建制/登场/过渡） | segments 2-4 句；禁心理描写；可带单选确认 |
| `choice` | 关键选择点 | 2-3 个选项；态度/路径/命运分支配比；每个选项有独立 callback |
| `callback` | 选择回响 | 1-2 句针对该选项的世界反应；同向选项必须各插一个；next 指向共同汇合点 |
| `closure` | 单元收束 | NPC 反应/物件归处/意象回收 + 悬念钩子句；若有解锁碎片在此声明 |
| `ending` | 结局（仅季末单元） | 前必有 closure；判词收束，不交代剧情 |

## 3. choice 选项结构

```json
"choices": [
  { "id": "ask-direct", "text": "这图画的是两个人吧。", "kind": "attitude", "next": "n4_echo_a" },
  { "id": "turn-paper", "text": "把纸转回原来的方向", "kind": "path", "next": "n4_echo_b" }
]
```

- `text`：直接台词（加引号）或直接动作；禁止"说XX/问XX/声明XX/表达XX"。
- `kind`：`attitude` / `path` / `destiny`，用于质量门统计分支配比。
- 禁止引用玩家尚未获知的人名/概念/事件。

## 4. 状态语法（季内闭环）

- 主状态值：`echo`（回声，0-100，三档：轻/深/彻）。"你让旧物故事发出多大回响"。
- flags：`s1-<npc>-<event>` 命名，如 `s1-alang-routebook-returned`。
- 变量：per-NPC 关系档（0-3），如 `bond.alang`。
- **持久化**：季内状态（echo/flags/variables/当前节点）落在 `flash_story_universe_runs`（复用既有
  `flags text[]`/`echoQueue`/`endingCode`/`stateVersion` 列 + 新增 `current_node`/`node_path` 列），
  每用户每 release 一条；`flash_user_story_progress` 保持 phase 级进度职责不变。**不在 progress 表
  新建并列状态存储**（避免两套 flag 源）。
- 三处生效：① `callback` 文本即时差异（必做）② 后续单元 `prose`/`choice` 的 condition 变体（持续影响）
  ③ 季末 ending code 组合（结局差异，写回 `universe_runs.endingCode`）。
- 每一处状态变化必须对应玩家可感知的文本差异；`changes ≠ callback`。

### 4.1 condition 变体语法（引擎契约，写作侧必须遵守）

节点可声明 `variants` 按当前状态选择文本/选项：

```json
{
  "id": "n5_close",
  "type": "closure",
  "variants": [
    {
      "when": { "flags": ["s1-alang-routebook-returned"], "echo": { "gte": 40 } },
      "segments": ["阿浪把图按旧折痕收好，这次没有再看它一眼。"],
      "next": null
    },
    {
      "when": "default",
      "segments": ["阿浪把图收好，折痕比上次更深了。"],
      "next": null
    }
  ]
}
```

规则：
- `when.flags` 数组 = 需全部命中（AND）；`when.echo` 支持 `{gte|lte|lt|gt}` 单条；多个条件 = AND。
- 每个带 `variants` 的节点必须有一个 `when: "default"` 兜底变体（保证任意状态可达）。
- 引擎按声明顺序取第一个命中的变体；校验器 E113 检查 `when` 引用的 flags/echo 在季内被设置过。
- 无 variants 的节点直接读 `segments`/`choices`。
- **根级 `state` 对象语义**：`{valDelta, flagsSet, variables}` 是该单元**入口初始状态**（进入单元时应用一次），
  节点级 `choices[].effect` 才是选项的即时状态变化；二者叠加。根级 state 是写作侧便利项，
  引擎 AC-03 必须实现"进入单元先应用根级 state 再求值首个节点"。避免歧义：root `state` 一律不写
  condition（无变体），有变体的状态差异一律放节点 `variants`。

## 5. 单元规模与节奏

- 每单元 5-9 节点；每 1-5 句正文必须有一次互动（含单选确认"继续听下去"）。
- 长段落（>5 句）仅限结局、独白高潮、真相揭露。
- 单元首节点完成建制（时间/空间/身份/情境），旧物首次登场必须有 2-3 个感官细节。

## 6. 与 v1 迁移对照

| v1 字段 | v2 去向 |
|---------|---------|
| opening | `n1_setup` segments 前 1-2 句 |
| action / discovery | `n2_object` + 选择点上下文 segments |
| question + options | `n3_choice`（选项全量重写为台词/动作） |
| responseByOption | 独立 `callback` 节点（1-2 句世界反应，非心理总结） |
| closing | `n5_close` closure + 钩子句 |
| fragment 解锁 | `n5_close.unlockFragment` |

## 7. 结局矩阵（季级，第 3 幕单元）

- 真结局 1（钥匙线收束）/ 普通 1-2 / 分支 2-3（依赖 key flags）/ 隐藏 0-1。
- 先定结局再倒推路径：每个结局列出到达条件（val 范围 + 必要 flag 组合）。
- 任意选择路径必须可达某结局（兜底规则）；结局前必须 closure 节点。
- 结局页是判词（压下的印章），不是剧情摘要。
