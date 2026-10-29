# 破冰会话浮层与教学层仲裁静态审计（2026-10-29）

## 1. 审计性质、范围与结论

本报告是对工作区源码的静态审计，不是设备测试、视觉验收或运行时复现。审计基准为 `docs/architecture/xiaoyue-agent-architecture.md` 第 5.2 节及任务给出的四条规则；证据来自当前工作区的小程序源码与现有测试。未修改产品代码、测试或架构文档，未运行五人 host smoke，未进行微信开发者工具或真机检查。

为避免用一个总评掩盖组内差异，将四条文档规则拆成 13 个可独立判定的原子规则。

| 判定 | 数量 |
|---|---:|
| VERIFIED | 10 |
| PARTIAL | 0 |
| VIOLATED | 3 |
| NOT-IN-CODE | 0 |
| 合计 | 13 |

核心结论：`HostTableBriefPopover` 的让位链和 warmup 回调稳定机制基本符合文档；高优浮层对 Agent Ask/adaptive suggestion 的压制，以及 host coachmark 的完整仲裁，不符合文档。现有 13 个指定测试全部通过，但没有覆盖这三个冲突。

## 2. 逐条核对

| 编号 | 文档规则 | 判定 | 证据 file:line | 一行说明 |
|---|---|---|---|---|
| R1 | ritual / celebration / tier switch / native ActionSheet 高于 Agent Ask + adaptive suggestion | VIOLATED | `apps/mini-program/src/pages/icebreaker-session/index.tsx:458-481,515-526,1228-1249`; `apps/mini-program/src/pages/icebreaker-session/hooks/useXiaoyueAgentAsk.ts:83-113`; `apps/mini-program/src/components/mascot/XiaoyueSessionShell.tsx:263-267,320-366` | Agent Ask 的显示只取决于 Ask 状态，Agent Ask 与 adaptive suggestion 的渲染均未接收 ritual、tier sheet 或 ActionSheet 状态；在这两条卡片路径上，高优状态仅用于 HostBrief 仲裁。 |
| R2 | Agent Ask 与 adaptive suggestion 之间不共存 | VERIFIED | `apps/mini-program/src/pages/icebreaker-session/index.tsx:515-516,1232-1235` | Agent Ask 可见时，adaptive suggestion 在两处都被移除；实际还形成了文档未明写的 Agent Ask 优先于 adaptive suggestion。 |
| R3 | Agent Ask + adaptive suggestion 高于 HostTableBriefPopover | VERIFIED | `apps/mini-program/src/pages/icebreaker-session/index.tsx:517-526`; `apps/mini-program/src/pages/icebreaker-session/sessionShellLogic.ts:119-138` | `agentAskVisible` 或 `adaptiveSuggestionVisible` 为真时，`canShowHostTableBrief` 返回 false。 |
| R4 | ritual / celebration / tier switch / native ActionSheet 高于 HostTableBriefPopover | VERIFIED | `apps/mini-program/src/pages/icebreaker-session/index.tsx:517-555,951-958`; `apps/mini-program/src/pages/icebreaker-session/sessionShellLogic.ts:119-138`; `apps/mini-program/src/pages/icebreaker-session/phases/WarmupPhaseView.tsx:337-346` | HostBrief 对 tier sheet、PhaseIntro、warmup ritual/celebration 和 ActionSheet 均有关闭或隐藏路径。 |
| R5 | HostTableBriefPopover 高于 host coachmark | VERIFIED | `apps/mini-program/src/pages/icebreaker-session/index.tsx:517-526,1442-1454` | `hostBriefVisible` 为真时 coachmark 不渲染；实际连折叠但可用的 HostBrief 也会压制 coachmark。 |
| R6 | 由优先级链可推出的 Agent Ask 及高优浮层高于 host coachmark | VIOLATED | `apps/mini-program/src/pages/icebreaker-session/index.tsx:1442-1454`; `apps/mini-program/src/pages/icebreaker-session/components/XiaoyueAgentAsk.scss:6-13`; `apps/mini-program/src/pages/icebreaker-session/index.scss:103-114` | coachmark 只检查 adaptive suggestion 与 HostBrief，未检查 Agent Ask、warmupRitualActive 或 isTierSheetOpen；两者都采用 `top:100%` 与 `$z-modal` 的浮层模式，源码允许同 render 共存，但真实遮挡需设备验证。 |
| R7 | guidanceLine 活跃时抑制 phase-toast | VERIFIED | `apps/mini-program/src/pages/icebreaker-session/index.tsx:496-513,1499-1508` | guidanceLine 非空时 effect 立即清空 toast，并阻止后续 toast 建立。 |
| R8 | guidanceLine 活跃时抑制 PhaseIntroOverlay 的 host 提示与首次规则 | VERIFIED | `apps/mini-program/src/pages/icebreaker-session/index.tsx:1490-1496`; `apps/mini-program/src/pages/icebreaker-session/overlays/PhaseIntroOverlay.tsx:92-95,118-121,140-149` | `suppressGuidance` 同时关闭 host prompt 和 one-line rule，但保留阶段名与时长。 |
| R9 | guidanceLine 活跃时抑制 warmup 权限耳语 | VERIFIED | `apps/mini-program/src/pages/icebreaker-session/index.tsx:1316-1317`; `apps/mini-program/src/pages/icebreaker-session/SessionPhaseViews.tsx:300-320`; `apps/mini-program/src/pages/icebreaker-session/components/WarmupCardSlot.tsx:257,622-633` | suppress 标志贯通到 `showPermissionLine`，耳语区域不会进入渲染。 |
| R10 | guidanceLine 活跃时抑制 host coachmark | VIOLATED | `apps/mini-program/src/pages/icebreaker-session/sessionShellLogic.ts:98-115`; `apps/mini-program/src/pages/icebreaker-session/index.tsx:1053-1067,1442-1454` | warmup 的 guidanceLine 恒有文案，coachmark 的设置与渲染却都没有 guidance 条件，因此该去重规则未接入。 |
| R11 | WarmupPhaseView 以 overlayCallbackRef 和稳定 useCallback 上报 ritualGateOpen 或 celebration，避免回调身份引发反复翻转 | VERIFIED | `apps/mini-program/src/pages/icebreaker-session/phases/WarmupPhaseView.tsx:337-346`; `apps/mini-program/src/pages/icebreaker-session/index.tsx:1222-1226`; `apps/mini-program/src/pages/icebreaker-session/SessionPhaseViews.tsx:318-319` | ref 保存最新回调，可见性 effect 只依赖两个真实状态，页面回调为空依赖的 `useCallback`。 |
| R12 | HostTableBriefPopover 仅 host、仅 warmup、正文不超过三行 | VERIFIED | `apps/mini-program/src/pages/icebreaker-session/index.tsx:483-490,517-535`; `apps/mini-program/src/pages/icebreaker-session/sessionShellLogic.ts:129-138`; `apps/mini-program/src/pages/icebreaker-session/components/HostTableBriefPopover.tsx:42-48` | 页面双重限制 host+warmup，正文为 pace、可选 anchor、quiet/avoidDomain 三个 Text 节点；视觉折行不在静态证明范围内。 |
| R13 | HostTableBriefPopover 在 phaseKey 变化时关闭 | VERIFIED | `apps/mini-program/src/pages/icebreaker-session/index.tsx:541-555` | `hostTableBrief?.phaseKey` 是关闭 effect 的直接依赖，变化后将 `hostBriefOpen` 设为 false。 |

## 3. VIOLATED 规则的最小修复建议与测试归属

以下只描述修复，不在本次审计中实施。

### R1：高优浮层未压制 Agent Ask 与 adaptive suggestion

最小正确修复：在页面形成一个统一的高优布尔值，至少包含 `showPhaseIntro`、`warmupRitualActive`、`isTierSheetOpen`、`hostMenuOpen`，并把 tier 切换确认中的 `pendingTierSwitch` 也纳入同一语义；用它派生实际可渲染的 `agentAskOverlayVisible` 与 `adaptiveOverlayVisible`，再统一供 shell props、HostBrief 仲裁和 coachmark 使用。高优层出现时只暂时隐藏卡片，不应伪造 Ask 的 ignore/close 服务端决定；高优层结束后可按既有 Ask 状态恢复。

回归测试归属：应扩展现有 `apps/mini-program/src/pages/icebreaker-session/__tests__/quietConciergeContract.test.ts`，锁定统一高优门控同时作用于 Agent Ask 与 adaptive suggestion。该文件现版本只断言 HostBrief wiring，不能捕获此问题；当前没有任何已运行测试会在 R1 冲突下失败。

### R6：Agent Ask、ritual/celebration、tier sheet 未完整压制 coachmark

最小正确修复：把 R1 的高优布尔值和实际 `agentAskOverlayVisible` 加入 coachmark 的唯一可见性条件，不再分别维护不完整的布尔组合；渲染条件同时复核 `phase === 'warmup'` 与 `isHost`，避免已置真的 `coachmarkShown` 在阶段或角色变化后残留。native ActionSheet 现有的「首次真实使用后永久标记 seen」行为可保留。

回归测试归属：同样应扩展现有 `quietConciergeContract.test.ts`，因为 coachmark 位于页面而非 `XiaoyueSessionShell`；现有 `XiaoyueSessionShell.quietConcierge.test.tsx` 无法覆盖它，现版本没有任何断言能捕获 R6。

### R10：guidanceLine 未抑制 coachmark

最小正确修复：在同一 coachmark 可见性条件中加入 `!sessionGuidanceLine`，并让初始化 effect 在 guidance 活跃时不设置 `coachmarkShown`；不必改变 coachmark 的持久化 seen 规则。这样与 R6 共用一个谓语即可，避免再新增第三套仲裁逻辑。

回归测试归属：现有 `quietConciergeContract.test.ts` 中「uses one guidance line and removes duplicate teaching」正是对应测试组，但当前只检查 phase-toast、PhaseIntroOverlay 和 permission whisper，必须补上 coachmark 断言后才会捕获 R10。

## 4. 代码中存在但架构文档未写明的行为

1. **同一文档优先级内部还有实际次序。** Agent Ask 会压制 adaptive suggestion，而不是两者并列自由显示，证据为 `index.tsx:515-516,1232-1235`。这是应当写入架构文档的真实决胜规则。
2. **HostBrief 的「可用」比「展开」更强地压制 coachmark。** `hostBriefVisible` 实际表示可展示入口；即使 `hostBriefOpen=false`，coachmark 仍被隐藏，证据为 `index.tsx:527-539,1237-1239,1442`。文档只写了 Popover 优先级，没有写这个更强的去重策略。
3. **HostBrief 的关闭条件多于 phaseKey。** 它还在 phase、host 身份、Agent Ask、adaptive suggestion、tier sheet、PhaseIntro、ActionSheet、warmup ritual/celebration 变化时关闭，并在页面重新显示时经 `useResetOnShow` 复位，证据为 `index.tsx:157-165,541-555`。
4. **phase-toast 与 PhaseIntroOverlay 另有广播权重和阶段转换门槛。** toast 还排除 warmup、phase_selection、从 waiting 的首次转换及 ritual 权重；PhaseIntro 只在真实阶段转换且目标为 ritual 权重时触发，证据为 `index.tsx:496-513,852-864`。第 5.2 节只写了 guidance 去重，未记录这套前置仲裁。
5. **coachmark 是驻留到真实交互，而非定时浮层。** 首次打开主持人菜单或点击 coachmark 都会持久化 seen；打开 ActionSheet 时同时关闭 coachmark，证据为 `index.tsx:643-651,951-962,1047-1073`。这属于教学层生命周期，架构文档尚未记录。
6. **仲裁所有权是分散的，不是 shell 内聚的。** 页面和 `sessionShellLogic.ts` 负责判定，`XiaoyueSessionShell` 只渲染传入的 `agentAsk`、`hostBrief`、`adaptiveSuggestion` 插槽，证据为 `XiaoyueSessionShell.tsx:263-267,320-366`。若文档继续使用「shell 统一仲裁」的表述，应注明真实控制面在页面。
7. **另有一个未记录的生命周期风险。** coachmark effect 在非 warmup 或非 host 时只是 early return，渲染条件也没有 phase/isHost；一旦 `coachmarkShown=true`，代码允许它跨阶段或角色变化残留，证据为 `index.tsx:1053-1067,1442-1454`。这更像实现遗漏，不应被文档当成合理契约学习。

## 5. 指定现有测试的实际运行结果

2026-10-29 在 `apps/mini-program` 执行：

```bash
npx vitest run src/pages/icebreaker-session/__tests__/quietConciergeContract.test.ts src/pages/icebreaker-session/__tests__/warmupOverlayStability.test.tsx src/pages/icebreaker-session/__tests__/waitingPhaseContract.test.tsx
```

实际结果：**3 个测试文件通过，13 个测试通过，0 失败**。Vitest 报告耗时 2.03 秒。

| 文件 | 通过测试数 |
|---|---:|
| `quietConciergeContract.test.ts` | 3 |
| `warmupOverlayStability.test.tsx` | 1 |
| `waitingPhaseContract.test.tsx` | 9 |
| 合计 | 13 |

这些通过结果仅证明现有断言成立。`quietConciergeContract.test.ts` 主要是源码字符串契约；`warmupOverlayStability.test.tsx` 覆盖稳定回调下的单次 true 上报；`waitingPhaseContract.test.tsx` 覆盖 waiting 渲染。它们均不构造 R1、R6、R10 的冲突状态。

## 6. 静态审计无法证明的事项

- 未验证真实点击、滑动、阶段轮询与本地定时器叠加时的手势时序，也未在设备上证明不存在任何闪烁或 render loop；R11 的结论仅覆盖代码结构和现有单元测试。
- 未验证微信原生 ActionSheet、showModal、RootPortal celebration 在 iOS 或 Android 上的真实层级、遮挡与触摸拦截；本报告所说的共存是源码允许同时渲染，不冒称已观察到设备画面。
- 未验证 HostBrief 三个正文节点在不同字号、窄屏和长文案下的实际视觉行数，因此「三行」只按节点结构判定。
- 未覆盖 rejoin、后台回前台、host transfer、reduced-motion、离线或小屏 Android 的真机行为。
- 未运行也不宣称通过五名首次 host 零培训 smoke、真机矩阵、微信审核或任何发布门。

## 7. 架构文档是否需要修改

需要，但不应把当前冲突反向写成正确行为。

- **第 5.2 节必须修改。** 保留目标优先级，同时注明当前实现差距；修复后补充 Agent Ask 优先于 adaptive suggestion、HostBrief 可用即压制 coachmark、coachmark 的驻留/seen 生命周期，以及统一高优谓语的真实所有权。
- **第 11 节代码地图建议修改。** 在「表面」中补入 `pages/icebreaker-session/index.tsx`、`sessionShellLogic.ts`、`WarmupPhaseView.tsx` 和 `PhaseIntroOverlay.tsx` 的仲裁职责，避免读者误以为 `XiaoyueSessionShell` 自己完成全部仲裁。
- **第 5.1、5.3、10.1、10.2、10.3、10.4 节无需依据本次审计修改。** 本次只运行 13 个指定测试，既不能证实也不能否定第 10.1 节的全量计数，也不改变任何外部发布门状态。

本报告本身是唯一新增文件；架构文档未在本次任务中编辑。
