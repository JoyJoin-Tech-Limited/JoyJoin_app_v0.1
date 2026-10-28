# Quiet Concierge — 三类说明书 UI/UX 规格

> 日期：2026-10-27
> 状态：已实现（2026-10-28）；QA Implementation PASS。外部发布门（5 名新 host 零培训 smoke、真机矩阵、微信审核）仍未完成。
> 输入：UI/UX 设计总监评审 + PM/商业化轻量评审
> 目标：第一次到场也知道接下来会发生什么，同时不增加任何必须完成的阅读、教学或主持人负担。
> 与 `icebreaker-w1-w3-implementation-plan-20261027.md` 配套；冲突时以「零培训、零新增参与者动作」为先。

---

## 1. 设计原则

1. **三类说明书是同一引导系统的三个时刻，不是三个并列组件。** 不同时出现，不形成教程系统。
2. **开始活动不需要读任何东西。** 活动说明书默认折叠；当前提示直接给答案；host 不打开任何面板也能完成。
3. **只有真实流程被解释，agent/画像不被解释。** 用户不需要理解 agent、playbook、画像或算法。
4. **合并现有教学层，而不是再加一层。** PhaseIntroOverlay host prompt/first-time rule、host coachmark、phase toast、warmup permission whisper 必须仲裁去重。
5. **画像只让选择更准，不变成文案。** Host 小提示无个人字段、无分数、无「根据画像/数据/AI」。

---

## 2. 三个表面与各自职责

| 表面 | 主要位置 | 回答的问题 | 默认 |
|---|---|---|---|
| **活动说明书** | `event-detail` | 从到达到结束会发生什么 | 折叠，用户主动展开 |
| **当前环节提示** | icebreaker session 现有 Xiaoyue shell | 现在该做什么、能否跳过 | 一行，不展开 |
| **Host 桌边小提示** | 仅 warmup 的 host phase 行 | 这桌先怎么带、哪里别踩 | 一行；可选展开 ≤3 行 |

**participant 新增输入 = 0；host 前 15 分钟动作中位 ≤3、P90 ≤4（guide 点击也计入）。**

---

## 3. 活动说明书

### 3.1 嵌入点

- 主入口：`pages/event-detail` 现有 `EventFlowStrip` 内，新增 `EventActivityGuide`，标题建议 **「到了现场，今晚会怎么过？」**。
- 默认一行：「到场后跟着卡面走，想跳过都可以」+「具体安排」文字展开。
- 展开 3–4 步，点击区域 ≥88rpx，无嵌套 ScrollView。
- 报名/支付流程不插入教程；gathering-room 仅 deep-link 回 event-detail，不内嵌第二份说明书；icebreaker waiting 只显示 current/next/final。

### 3.2 内容必须由真实 run plan/tier 派生

只显示 **当前步 + 下一步 + 最后回顾**；无 run plan 时不编 next/total；不虚构 `free_chat` phase。

轻量路径可用四步示例：
1. 到场入座，不用准备自我介绍
2. 话题卡暖场，想跳过也可以
3. 自在聊下去，卡住了可以换一组
4. 一起回顾，不用轮流发言

有真实下一互动环节时，用它替换第 3 步；未知则写「有下一环时，跟着卡面走就好，不用提前准备」。

### 3.3 状态

无首次自动展开、无永久 seen 状态、无重新打开 KPI。空数据、custom/unknown、offline 都回退为通用一行，不报错。

---

## 4. 当前环节提示

- 复用 Xiaoyue shell 的 toneLine，不另加卡片、不展开。
- ≤14 字，只有真实 phase 变化才更新；不轮询重播、不重播 TypewriterText。
- Rejoin 直接呈现当前 phase；offline 保留最后确认文案，不新增 spinner/error。

示例：
- 「不想答就跳过，先听也可以」
- 「聊得正好就继续，不用赶着换」

新环节只补一句当前规则，不提前解释后续所有玩法。

---

## 5. Host 桌边小提示

### 5.1 展示条件

只在 **host + warmup + 有确定性内容 + 无高优 surface** 时出现。

默认合并进现有 host phase 行，例如「话题卡 · 先聊具体小事」，不是额外第三行说明。

可点开非模态 popover，最多 3 行：
1. 节奏：「先聊具体小事，顺畅就不必换」
2. 一个安全锚点（可选）：「『最近的短途出行』会比较好接」
3. 一个避雷域或低披露许可（可选）：「收入、感情细节先不展开」

没有足够数据就只保留普通 phase hint；**不自动展开，不要求阅读。**

### 5.2 数据契约

`HostTableBrief` 仅含：
- `paceShort`（一句节奏）
- `anchorLabel?`（一个安全锚点）
- `avoidDomain?`（一个避雷域，**不附原因**）
- `revision / phaseKey`

不得包含姓名、ID、个体分数、coverage 数字、避雷原因、画像措辞。coverage 只用于服务端安全判断，不展示。零 LLM，无 AIGC 角标。

### 5.3 关闭与仲裁

- Phase change、Agent Ask/adaptive suggestion、host transfer 自动关闭；冷 rejoin 保持折叠。
- Overlay 优先级：**Agent Ask / adaptive suggestion > HostTableBriefPopover > coachmark**；ritual/celebration/tier sheet/native ActionSheet 压过全部。
- Participant 永远收不到 brief payload；继续走 sanitizer + matching-aware 控制。

---

## 6. 视觉、动效与无障碍

### 活动说明书
- 位于 `event-detail__flow-card` 内；展开行 ≥88rpx。
- 标题 28rpx、正文 24rpx、8rpx 节奏；展开 250ms、收起 150ms，只 transform/opacity。

### Host popover
- 复用 M1 Ask 几何：606rpx、24rpx padding/radius、白底细边、轻阴影、`$z-modal`、无 scrim。
- 高 184–208rpx；关闭目标 ≥88rpx；不推挤主 CTA，不新增滚动。
- Reduced-motion/rejoin 全静态；无粒子、渐变、玻璃、AI sparkle、打字机、循环动效。

### 通用
- 所有目标 ≥88rpx，正文 ≥24rpx，对比 ≥4.5:1。
- 首次跳过许可为静态文案，不重播 TypewriterText。
- 验收必须覆盖 375×667、390×844、小屏 Android、reduced-motion、offline、rejoin、host transfer。

---

## 7. 实现落点（后续任务，不代表已完成）

### Shared / server
- 新 `packages/shared/src/copy/eventActivityGuide.ts`：按 tier/run plan 生成活动步骤。
- 扩展 `packages/shared/src/copy/icebreakerSession.ts`：当前环节一句话与 host 三行文案。
- `HostTableBrief` 复用现有 per-viewer session DTO + sanitizer，**不新增 poll、不新增画像表**。

### Mini-program
- 新 `components/event-detail/EventActivityGuide.tsx/.scss`，挂载到 `pages/event-detail`；`index.scss @use`。
- gathering-room 只改 deep link。
- session shell 统一 guidance line 与 overlay 仲裁。
- 新 `pages/icebreaker-session/components/HostTableBriefPopover.tsx/.scss`，由 `pages/icebreaker-session/index.scss @use`；纳入 subpackage style 验证。
- 清理 PhaseIntroOverlay/host coachmark/ember hint/permission copy 的重叠；不重设计 WarmupCardSlot/ActionBar；不新增 phase 类型。

### 明确不做
不做 guide impressions/open/dwell/scroll KPI；不新增方法库；不做参与者教学任务；不做主持人示范；不做房内付费 CTA；不做自动展开。

---

## 8. 验收

1. **不打开任何 guide 也能开始并完成**，这是首要验收。
2. 5 个首次 host 零培训 15 分钟 smoke；host 前 15 分钟动作中位 ≤3、P90 ≤4。
3. Participant 新增输入=0；当前/下一/最终步骤只来自权威 plan。
4. 活动说明书可展开但不自动展开；host brief 空数据、rejoin、host transfer、Agent Ask 下状态正确。
5. 所有真机矩阵、reduced-motion、分包样式、AIGC 与微信文案检查通过。
6. 只在确有需要时使用一个 `host_guide_action`（action/phase/time bucket，无画像）计算 effort；不看 guide 打开率。

**退出条件：** Host brief 若增加 effort 或引发被监视感，删除该表面；活动说明书与当前环节提示可独立保留。

---

## 9. 实现状态（2026-10-28）

**Implementation PASS**（QA verdict：`.git/.orchestration/sprints/sprint-quiet-concierge-verdict-r2.json`）。

已落地三类说明书：event-detail 活动说明书与 gathering-room poolId deep-link；waiting current/next/final；shell guidanceLine；warmup/host-only HostTableBrief（真实 shared-interest 派生，participant sanitizer 剥离）。已合并 phase toast、PhaseIntroOverlay host prompt/first-time rule、host coachmark 与 warmup permission whisper，Agent Ask/adaptive > HostBrief > coachmark。

验证：全量 mini 348 files / 3485 tests PASS；server HostBrief/ClientState/Agent tick/replay/sanitizer 62 tests PASS；server/shared/mini typecheck 本任务通过；build:weapp、verify:subpackage-styles、guardrails 通过。

**尚未完成（发布门，不是代码失败）：** 5 名新 host 零培训 15 分钟 smoke、375×667/390×844/小 Android/reduced-motion/offline/rejoin/host-transfer 真机矩阵、微信审核。HostBrief 仍受 `icebreakerMatchingAwareEnabled` 控制。

