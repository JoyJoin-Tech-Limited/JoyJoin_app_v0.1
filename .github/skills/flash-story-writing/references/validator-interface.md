# check-flash-story.mjs 校验契约（validator-interface）

> 街头盲盒 story episode 质量门。13 项 Story-to-game 校验本地化后的子集，
> 挂入 `npm run check:full`（CI），任何 episode 写入前必须零违规。
> 本契约是写作侧接口约定；脚本本身由 backend-engineer 按 Tier 2 Sprint Contract 实现
> （当前未实现，契约以本文为准，实现时以本文为验收标准之一）。

## 输入

- **扫描范围：仅 `content->>'v' = '2'` 的 episode 行**。存量 v1 内容（无 v 字段）一律跳过，
  不得报 E101（否则 check:full 对现有库必然全量报错）。
- 指定单元时：`--unit s1-p1-alang` 按 `code` 精确匹配，目标行是 v1 时提示跳过并 exit 0。
- 结构示例见 `node-model.md`。

## 运行环境语义

| 场景 | 行为 |
|------|------|
| DB 可用（默认，读 `DATABASE_URL`） | 全量扫描 v2 行 |
| DB 不可用（CI 无 DB） | 退出码 0 + 提示"DB unavailable, skipped"（CI 中 check:full 不应因无 DB 崩） |
| `--ci` 标志 | 警告级项不阻断：仅致命项（E1xx 首字节）令退出码 1；否则 0 |
| 手动运行 | 退出码 0=通过 / 1=致命 / 2=仅警告 |

## 校验项（13 项子集）

| # | 校验 | 说明 | 级别 |
|---|------|------|------|
| 1 | 结构合法 | content 有 `v`/`start`/`nodes`；JSON 可解析 | 致命 |
| 2 | 节点存在 | `start` 与所有 `next`/`callback` 引用节点存在 | 致命 |
| 3 | 可达性 | 从 start 出发所有节点可达 | 致命 |
| 4 | 无死胡同 | 非 closure/ending 节点都有 next/choices；variants 每个非 default 变体也有 next | 致命 |
| 5 | 结局可达 | 每条路径可达某结局（季末单元）或 closure | 致命 |
| 6 | 选项格式 | 选项 text 不含"说/问/让/声明/表达/回应"前缀词 | 致命 |
| 7 | 模板词扫描 | 正文/选项不含 玩家/用户/分支/任务/传话/节点 等元叙事词 | 致命 |
| 8 | 心理描写词 | 含"意识到/承认/决定"等词时按上下文词对复核（报告级） | 警告 |
| 9 | callback 覆盖 | 每个 choice 选项都有独立 callback 节点（同 next 也须各插） | 致命 |
| 10 | 分支配比 | 态度 60-70% / 路径 20-30% / 命运 ~10%（季内统计） | 警告 |
| 11 | 互动节奏 | 连续 segments 超过 5 句无互动 → 报告 | 警告 |
| 12 | 钩子登记 | 单元 closure 最后句存在钩子（与单元设计文档登记表核对） | 警告 |
| 13 | 状态引用完整 | condition/variants/flags/valDelta 引用的变量在季内被设置过 | 致命 |

## 错误码格式

```
FLASH_STORY_E101 结构不合法（缺 v/start/nodes）
FLASH_STORY_E102 引用节点不存在: <nodeId>
FLASH_STORY_E103 节点不可达: <nodeId>
FLASH_STORY_E104 死胡同节点: <nodeId>
FLASH_STORY_E105 结局不可达（季末单元）
FLASH_STORY_E106 选项格式违规: <choiceId>
FLASH_STORY_E107 模板词命中: <word> @ <nodeId>
FLASH_STORY_E108 心理描写疑似: <word> @ <nodeId>（警告级）
FLASH_STORY_E109 callback 缺失: <choiceId>
FLASH_STORY_E110 分支配比偏离（警告级）
FLASH_STORY_E111 互动间隔过长 @ <nodeId>（警告级）
FLASH_STORY_E112 钩子缺失 @ <closureNodeId>（警告级）
FLASH_STORY_E113 状态引用未定义: <name>（致命）
```

## 运行方式

```bash
node scripts/check/check-flash-story.mjs            # 全量
node scripts/check/check-flash-story.mjs --unit s1-p1-alang   # 单单元
```

退出码：0 = 通过；1 = 有致命项；2 = 仅警告。

## 与 skill 的关系

- 写作侧：`flash-story-writing`（本 skill）负责产出合规内容。
- 实现侧：backend-engineer 按 Sprint Contract 实现脚本；本契约是验收标准。
- 接入点：`npm run check:full`（CI）与 admin 发布动作（`review_status` 置 reviewed 前）。
