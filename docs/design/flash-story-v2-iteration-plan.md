# 街头盲盒故事线 — 下一轮迭代策略与执行计划

> 日期：2026-08-11 ｜ 状态：Phase 1 已执行 + C1 staging 走查通过（2026-08-20，终稿 v4 复走）｜ 前置：RPG 故事大师审阅（7/10，主题统一 9 / 选择意义 5 / 重玩价值 4 / 追更引擎 5.5）

## 0. 使命与北极星

**使命**：把街头盲盒从"体验一次的好故事"升级为"让人追更、让人上瘾的连续剧"。

**北极星**：周复访率（同一用户周内 ≥2 次相遇 / 周活跃）——上线采集基线，4 周目标 ≥30%。
**次要指标**：单元完成率、结局分布（5 档是否都有人到达）、单单元停留时长。

## 1. 主题决策（审阅结论）

**主题不大改，做主题深化**："和解" → "和解是有代价的"。
- 五件旧物 = 五种"未完成"的物件即隐喻结构保留（审阅 9 分，全季最值钱资产）
- 治愈+悬念框架保留；只加 1-2 处刀锋，不黑化
- 什么情况下才考虑换主题：staging 数据证明"旧物和解"情绪位在目标人群零共振——数据决定，非设计猜

## 2. 三个工作流

### Workstream A — 内容深化（主线）
| # | 动作 | 决策 | 状态 |
|---|------|------|------|
| A1 | 一个"没和解成"的对照组 | 栗子 p3 知道默默邀请但"还没准备好"（温和版，拒绝选项已否） | ✅ 已执行 |
| A2 | 一处"和解的代价" | 拾柒 p3 删除时间行时发现下面压着"最后一班 23 路"——正确但有损失 | ✅ 已执行 |
| A3 | 硬钩子（温和版） | 拾柒 p2 观察卡：阿浪最近总绕远路，走一条没画进任何册子的路（未解之谜型） | ✅ 已执行 |
| A4 | 反转型 callback | 阿浪 p2 destiny 选项："想过。每天都想。……但你不该问。"（询问也是边界，呼应记录边界主题） | ✅ 已执行 |
| A5 | 季末硬钩 | **待拍板**：软收（现状）vs 硬钩（触碰"数字居民不影响现实"世界观边界）。本次保守不执行 | ⏸ 待决策 |

### Workstream B — 上瘾机制（2026-08-13 已实现）
| # | 动作 | 状态 |
|---|------|------|
| B1 | 结局图鉴（季末"你差哪两步到 X 结局"，不剧透选项） | ✅ 已实现：引擎 `buildV2EndingGallery`（5 档阈值 + echoGap + approxChoices，每档 ≈10 echo/次深挖）+ finale 响应 `ending.gallery` + finale 页图鉴卡（已抵达/还差 N 次深挖） |
| B2 | 回声可视化（closure 轻量 echo 感知） | ✅ 已实现：storyV2 DTO 加 `echo`，`resolveV2EchoTier`（彻/深/轻），FlashStoryV2Stage closure 节点显示回声档位文案 |
| B3 | 追更钩子（完成页暗示哪条线还有悬念未解） | ✅ 已实现：shared `FLASH_V2_HOOK_HINTS`（4 钩子，planted/resolved 单元 + hint 文案）+ `nextFlashV2HookHint` + 服务端 completed 视图 `nextStoryHint` + 完成页"还有一件事没有答案"卡 |

### Workstream C — 部署验证
| # | 动作 | 状态 |
|---|------|------|
| C1 | staging 走查（试点 SQL + 体验版验证） | 🟡 部分完成（2026-08-20：三版 SQL 已应用 staging，含 20260820010000 二轮定点终稿 v4；`qa-flash-v2-staging.ts` 引擎全分支走查通过，v3/v4 两轮均绿；体验版设备验证并入 C2） |
| C2 | 真机视觉验证（DevTools + 真机，AGENTS.md 硬性要求） | 待执行 |
| C3 | 指标埋点（周复访/完成率/结局分布/停留） | 待执行 |
| C4 | 定性反馈（"明天还想来吗"+"30 秒能复述吗"） | 待执行 |

### Workstream D — 全季启用（A/C 验收后）
- D1：全季 12 单元按 A 标准修订（补刀/补反转/补对照）
- D2：生成全季 SQL 并启用
- D3：Atuan 3 单元保持 v1 专属交互，未来单独迭代

## 3. 执行顺序

**Phase 1（本次）**：A1-A4 内容修订 → 质量门 → 试点 SQL 重生成 → 测试回归 → 提交
**Phase 2**：staging 走查（C1+C2+C4）→ 按反馈定稿 → B1-B3 上瘾机制 → 二轮走查
**Phase 3**：全季 12 单元按 A 标准修订（D1/D2）→ 全季启用 → 数据校准 → 第二季锁定稿

## 4. 决策记录（4 个拍板项）

| # | 决策 | 本次选择 | 理由 |
|---|------|---------|------|
| 1 | A5 季末硬钩 | 软收保持 | 不触碰世界观边界，留待第二季锁定稿处理 |
| 2 | 对照组 | 栗子"还没准备好" | 温和真实，拒绝会过度破坏治愈基调 |
| 3 | 硬钩子强度 | 未解之谜型（未画的路） | 威胁型（离开深圳）可能让治愈党不适 |
| 4 | 计划文档 | 存档本文档 | — |

## 4.5 审阅修复批（2026-08-13，verifier + user-satisfaction-auditor 并行审阅后）

- **图鉴对比度 Class A**：深灰字在深紫卡上（1.6:1）→ 全改 warm-cream 系（≥4.5:1）
- **宇宙轨迹全 +0**：v2 完成路径 configuredEffects:[] 导致 vector 永不更新 → finale 对 v2 run 用 echo 派生 truth 维度
- **"advance" 选项文本**：advance 完成路径 selectedOptionId 写字面量 → 引擎/持久化加 lastChoiceId（v2_state.lastChoiceId），完成时落真实选项
- **阈值一致性**：resolveV2Ending 改由 FLASH_V2_ENDING_TIERS 派生（单一权威）+ 一致性测试锁定
- **echoTier 单一权威**：DTO 下发 echoTier，删除客户端重复实现（原 resolveV2EchoTier 生产死代码修复）
- **追更卡试点盲区**：四钩子全部 planted 在试点外 → 新增 h1-metal-sound（s1-p1-alang，试点可达）置顶
- **图鉴措辞评判感**："还差 N 次深挖"→"再追问 N 次，也许能抵达"；"已抵达"→"本次抵达"（跨 run 语义诚实化）
- **回声行身份**：加固定标签"你的追问，让旧物发出了回声"
- **closure 死屏 = 审阅误报**：isTerminal 仅 ending，closure 按钮正常；补测锁定该行为
- QA 补测：echo 三档边界（40/15）、tier 一致性、lastChoiceId 跨 answer/advance 保留
- 验证：服务端 flash 82/82、mini-program alang 162/162、harness gate 100/100、质量门 0 警告

## 5. Phase 1 执行细节（已落地）

### A1 对照组（跨单元 condition 变体，引擎核心卖点首次真实使用）
- `s1-p3-momo` 根级 state 加 `flagsSet: ["s1-momo-invited"]`（进入该单元即见证邀请）
- `s1-p3-lizi` closure 加 variants：
  - `when {flags:["s1-momo-invited"]}`："普通并不等于白去。……她忽然想起什么：'默默约了我下周。南边的公园，或者旧书市。'她顿了顿，'我还没想好。'"
  - `when default`：原文本

### A2 和解的代价（s1-p3-shiqi）
- n4_echo_b 加一句："时间行下面还压着一行小字——'最后一班 23 路。'他停了一下，还是删了。"

### A3 硬钩子（s1-p2-shiqi）
- n2_object 加："还有一条：最近他总是绕远路，走一条没画进任何册子的路。"
- hookLedger 新增 h14-route-unmapped（s1-p2-shiqi 埋 → season-finale 收）

### A4 反转 callback（s1-p2-alang）
- n4_echo_b destiny 分支："阿浪停了很久。'想过。每天都想。'他看了你一眼，'但你不该问。'"

## 6. 风险与回滚

| 风险 | 等级 | 缓解 |
|------|------|------|
| 刀/反转破坏治愈品牌 | P1 | 只 4 处，staging 定性反馈先行，flag 可整体回滚 |
| 跨单元 condition 变体引擎行为异常 | P1 | 引擎测试已覆盖 variants 命中；走查重点验证 |
| 全季启用后单单元穿帮 | P2 | 单单元 content 更新（幂等迁移模式就绪） |
| harness gate 红线（他人 WIP 文件过大） | P2 | 等 WIP 提交后处理，不阻塞本计划 |

## 7. 交接提示

- 内容修订管线：`flash-story-writing` skill → `check-flash-story.mjs` → 人工审核 → 入库
- 上瘾机制（B1-B3）实现：backend-engineer（图鉴端点）+ taro-engineer（图鉴/回声 UI）
- 走查（C1/C2）：需 staging 环境 + DevTools/真机，交接给运营/QA
