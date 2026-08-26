# 街头盲盒打磨策略 — 六维审计与执行计划（2026-08-26）

> 产出方式：PM 六维审计（精致度/简洁度/丝滑度/趣味性/上瘾性/情绪价值给予度，各 10 项）+ grill-me 逐问收敛。所有决策均已拍板，本文件是执行依据。

## 1. 现状总结（审计基线）

- 完整链路已闭环：Discover 静态入口 → 盲盒首页（intro/在线列表/碎片 X/15）→ 定位寻路（100m 服务端判定）→ 对话故事（v1 互动小游戏 + v2 试点分支引擎）→ 任务 → 档案台（24s 仪式）→ 季末结局。
- 强项：隐私合规 fail-closed、寻路状态机完整（9 态）、文案审核体系、回声/印记系统雏形。
- 最大短板：上瘾性（唯一留存钩是碎片收集，且小字呈现）、情绪价值（无纪念物、无分享出口）、丝滑度（`distanceSmoothing.ts` 库+测试已写好但全站零引用；24s 归档仪式无跳过）。

## 2. 红线先例（约束所有未来改动，永久有效）

1. **时间戳只进档案台** — 任何卡面/列表（含离线角色卡）不显示日期/星期；个人历史只记「共 X 面 + 首次相遇日期」，不做周/星期聚合。
2. **变体播种按相遇次数，不按日期** — 视觉新鲜感归「第几次见面」，与排班推演脱钩。
3. **分享内容 = 审核固定内容 + 「虚构数字角色」声明** — 用户数据永远不上分享海报。

## 3. 红线批裁决记录（8/8）

| # | 条目 | 裁决 |
|---|---|---|
| 上瘾#2 个人历史统计 | adapt：只「共 X 面 + 首次相遇」，档案台编年 |
| 上瘾#6 离线角色卡 | adapt：卡面零日期，时间戳只在档案台 |
| 上瘾#8 今日 X 位出没 | adapt：Discover 入口保持静态，升级首页 hero 锚 |
| 情绪#2 分享海报 | keep：仅季末一张，虚构声明，零用户数据 |
| 情绪#7 私有回应 | keep：「写给他们的信」角落，散场日期前置，过期留淡出痕 |
| 趣味#3 任务扩类 | adapt：现有 30 条按 NPC 性格重排子池，零新审核面 |
| 趣味#5 资产变体 | adapt：相遇次数播种，用 candidates/ 现有素材 |
| 丝滑#5 归档仪式 | adapt：保留 24s + 8s 后跳过按钮，规格时长不动 |

## 4. ROI 散点（价值 1-5 × 成本 1-5，S≈1-2 / M≈3 / L≈4-5）

**① Quick Wins（价值≥4 且成本≤2）— 17 个**
丝滑#1 距离平滑接线(5,1)、丝滑#5 跳过按钮(4,1)、丝滑#2 地图 crossfade(4,1)、简洁#1 首页压缩(4,1)、简洁#3 空态动作(4,1)、情绪#5 散场拍点(4,1)、精致#2 相遇 bloom(5,2)、趣味#9 盖章动画(5,2)、上瘾#1 15 格收藏条(5,2)、上瘾#2 共 X 面(4,2)、上瘾#6 离线角色卡(4,2)、趣味#5 资产变体(4,2)、趣味#3 任务重排(4,2)、精致#4 回声计量条(4,2)、简洁#2 consent 折叠(4,2)、丝滑#3 分段 stagger(4,2)、丝滑#7 到达庆祝(4,2)

**② Big Bets（价值 5，成本≥3）— 7 个**
情绪#1 相遇小记(5,3)、情绪#3 回声旅程回顾(5,3)、情绪#7 写给他们的信(5,3)、趣味#1 小游戏嫁接 v2(5,4)、情绪#2 季末海报(5,4)、情绪#6 交付后反馈(5,4)、趣味#6 证据墙(5,5)

**③ Strategic（价值 4，成本 3-4）— 5 个**
精致#3 对话排版节奏(4,3)、简洁#5 档案台渐进披露(4,3)、上瘾#5 只读回看(4,3)、情绪#4 v1 共情镜像(4,3)、上瘾#3 首遇印章(4,4)

**④ Park（约 21 个）** — 价值≤3 或成本高价值中；其中 上瘾#7 任务链(4,5) 挂第二季立项顺带。

## 5. 发布策略

**主题：第一发布 =「相遇的仪式感」**（相遇是 100% 用户必经的情感峰值）。

- **R1 = 相遇峰值 7 项**（默认开启上线）：
  - PR1（零风险）：丝滑#1 距离平滑接线 + 丝滑#2 地图 crossfade + 丝滑#5 跳过按钮
  - PR2（仪式，需 DevTools 走查 + 视觉验收）：丝滑#7 到达庆祝过渡 + 精致#2 相遇 bloom + 情绪#5 散场拍点 + 趣味#9 盖章动画
- **R2 = 回路闭合 3 项**：上瘾#1 15 格收藏条 + 趣味#5 资产变体 + 趣味#3 任务重排（服务端，需 Sprint Contract）

## 6. 度量方案与门槛（Q7=C，Q8=A）

- 指标：① 寻路启动→到达率 ② 到达→碎片落袋率 ③ 21 天二次相遇率（参考值） ④ 对话中途流失点
- 基线：R1 上线前抓 **14 天**；PR0 必须先行上线。
- R2 门槛：**② 提升 ≥3pp 或回退 ≥-1pp** 才放行；回退超 1pp 先修动画再谈收藏。

**基线数据源核查结论（2026-08-26，代码已验证）：**
- 方案 B（纯服务端基线）**不成立**：`flashLocateBudgets` 是 (userId, shiftId) **upsert 单行**（attemptCount），非追加事件日志，且 `purgeExpiredFlashLocateBudgets` 定期清理——无法重构历史「寻路启动」次数。
- 因此 PR0 = 方案 A：客户端补 **1 个事件**（consent 允许时发 `search_started`）。4 个指标里 ②③④ 均可由服务端表现成（encounters / flash_user_story_episodes / flash-story 埋点），只有 ① 的头段需要 PR0。
- ① 的历史基线自 PR0 上线日起算；②③④ 可直接用既有表回看。

**PR0 实现记录（2026-08-26 已实现）：**
- 事件名 `flash_search_started`，走既有 `/api/analytics/discover` 端点（whitelist + `sanitizeMetadata` + fail-open 全部复用，服务端仅 +1 枚举项，`apps/server/src/routes/domains/analytics.ts`）。
- 客户端新模块 `apps/mini-program/src/lib/analytics/flashSearchAnalytics.ts`（`trackFlashSearchStarted(appearanceId)`，fire-and-forget，metadata 仅 appearanceId——无坐标/无文本/无设备标识）。
- 触发点：`pages/alang/search/index.tsx` `startMapGuidance` 中前台定位真正开启后（`trackingRef.current = true`），每次尝试计一次；拒绝定位不计。
- 默认开启、无 feature flag（用户指令）。测试：模块 4 例 + 页面 2 例新增，21/21 通过；server flashStoryAnalyticsRoutes 5/5；双端 typecheck + guardrails 全绿。

**PR1+PR2 实现记录（2026-08-26 已实现，按 pre-launch 修订不再等待基线）：**
- **PR1·丝滑#1 距离平滑接线**：`pages/alang/search/index.tsx` 接入现成 `smoothAlangDistance`（EMA 0.35 + 1m deadband，`force` 仅在服务端确认到达时置位），读数用 `displayDistance ?? mapFrame.distanceMeters` 渲染，重新开启寻找时重置。
- **PR1·丝滑#2 地图 crossfade**：`flash-radar__map-fade` 包装层 360ms 淡入（opacity-only，GPU 安全；原生 Map 组件不动）。
- **PR1·丝滑#5 归档仪式跳过**：`pages/alang/archive` 抽出唯一 `finishCeremony` 收尾路径（自然计时与跳过共用，`phase_synthesis_completed` 仍恰好一次、storage 标记不变），跳过按钮 8s 后出现（reduced-motion 按 4s 仪式半程 2s），残留计时器全部清理（测试含 60s 双触发断言）。**24s 时长规格未动**。
- **PR2·丝滑#7+精致#2 相遇时刻**：到达判定后 900ms 全屏「遇见了」overlay（bloom 呼吸环 + portrait rise + 三段文案错峰浮现，`过去吧，这次见面会留在回声里。`），随后原重定向链；重定向失败时清除 overlay 回到 found 态。
- **PR2·情绪#5 散场拍点**：ended 态新增 `flash-radar__result-echo`（`下次见面，也许是另一条街。`，320ms 延迟淡入，纯旁白、非 NPC 台词——红线安全）。
- **PR2·趣味#9 盖章动画**：`flash-dialogue__fragment` 新增 `已收下` 圆章（560ms 两段式压印，卡片 position:relative + overflow:hidden），仅对话落袋瞬间；首页/档案台碎片卡不受影响。
- 全部动画尊重 `prefers-reduced-motion`（flash.scss 既有 media query 统一收编）；无 emoji、无新 feature flag、CTA 紫无渐变。
- 测试：search +3 例（庆祝拍→对话序、EMA 缓动、散场回声）、archive +1 例（8s 跳过恰好一次 + 残留计时器不二次触发）；57/57 通过；typecheck + guardrails（class-coverage 无孤儿）全绿。
- 待办：PR2 涉及 5 处新动画，合并前需 WeChat DevTools 真机走查 search/dialogue/archive 三页跨全部状态（mini-program AGENTS.md 硬规则）；performance-audit 建议在同一走查中完成。

**R2 实现记录（2026-08-26 已实现，Sprint Contract `.git/.orchestration/sprints/sprint-contract.r2-flash-polish.md`）：**
- **上瘾#1 15 格收藏条**：首页「我的故事碎片」区新增 `flash-story-collection`——5 NPC（固定顺序，纯展示无排班含义）× 3 格，已收集格按碎片 category 四色着色（object 紫/past 蓝灰/relationship 珊瑚/key 绿），未收集格虚线描边 + 2.4s 呼吸发光（reduced-motion 静态），整条点击进档案台，替代原「X/15」小字（计数并入条尾 `N/15` chip）。数据复用 `useFlashStoryFragments`（npcName 分组、解锁顺序填充，DTO 无 unitId 故不做 unit 精确映射），零新 API。
- **趣味#5 相遇时刻变体（范围修正）**：服务端复用既有 `flash_npc_relationships.encounterCount`（getOrCreateFlashEncounter 本就 upsert 计数）新增只读 `getFlashNpcEncounterCount`，locate 响应附带 `encounterOrdinal`（纯计数无日期，计数失败回退 1 不阻断到达）；客户端庆祝 overlay 按 ordinal 选文案：1「遇见了 / 过去吧，这次见面会留在回声里。」、2「又碰上了 / 上一次还留在回声里。」、3+「老位置，又见面了 / 回声越来越满了。」。**美术变体不做**：candidates/ 是 legacy 流程回退图（approvalStatus=awaiting-approved-art），与正式版像素体系冲突，并入第二季美术批次。
- **趣味#3 调研结论：种子层已实现，改锁定不重排**——30 任务本来就是 5 NPC × 6（5 生活邀请 + 1 NPC 传话）性格子集（阿浪 T01-05 城市出发、栗子文化娱乐混合、默默阅读/散步、拾柒一直想做、阿团运动/关系、各 1 条定向传话），每 NPC 只从自己 6 条抽，`npcWeight` 全 100 无重排对象。新增 `apps/server/src/__tests__/flashTaskPersonalityAllocation.test.ts` 结构回归测试（5 例：数量/单 NPC 归属/每 NPC 5+1/传话目标≠来源/分配表快照），未来种子改动破坏性格聚类会显式失败。
- 测试：event +3（15 格/点击跳转/空态全空格）、search +2（ordinal=2「又碰上了」、ordinal=5 钳制第三变体）、server 结构测试 +5；mini-program 34/34、server 66/66、三 workspace typecheck + guardrails 全绿。
- 既有测试适配：event 页 5 处 `findByText('阿浪')` 因收藏条 NPC 名撞名改为在线卡独有邀请文案断言（断言意图不变）。

## 7. 执行序列与验证门

```
PR0（1 事件）→ [14 天基线] → PR1 → PR2 → [观察 21 天] → R2 门槛判定
```

**Pre-launch 修订（2026-08-26 当日，用户拍板）：** beta pre-launch 流量 n≈0，14 天基线无意义——砍掉等待。PR1/PR2 立即开发随做随上；PR0 埋点照常先上，作为 launch 后监控；R2 门槛从「基线对比 +3pp」降级为「上线后监控 + DevTools/审计定性验收」；漏斗 SQL/看板后置到 launch 前一周。

- 执行路线：Direct + micro-plan（R1 单 workspace、S 成本；R2 服务端任务重排需 Sprint Contract）
- 验证门：typecheck + guardrails + 测试 + verify:subpackage-styles；PR2 合并前跑 `completeness-audit` 全流程（search/dialogue/event/archive 四页）+ `performance-audit`（动画密集面）；PR2 必须 WeChat DevTools 真机走查跨全部状态。
- `user-satisfaction-audit` 留给 R2 与季末海报。

## 8. 全局指令

- **新功能一律默认开启**（2026-08-26 用户指令）：不新增 feature flag、不做 dark rollout；确需 kill switch 时以「默认 ON + 可关闭」交付。
- 红线先例见 §2，未来任何街头盲盒改动自动继承。

## 9. Out of Scope

- Park 桶 21 项（含证据墙、首遇印章、只读回看、任务链）
- 第二季内容扩展（任务库扩量、剧情生产）
- 非深圳城市扩展
