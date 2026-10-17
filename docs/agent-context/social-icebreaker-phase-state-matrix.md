# Social Icebreaker — Phase × 状态矩阵 v1（AC-19 / 计划 #32）

> 建表日期：2026-10-16（sprint icebreaker-uiux-wave1）。
> 用途：13 环节 × 9 状态的诚实覆盖清单。每波改造结束更新「最近修复」列；第三波（#26 contentStatus 泛化、#6 离开通道/host 失联兜底）完成后本表应全 ✓。
> 图例：✓ = 已覆盖（有专门 UI）｜△ = 部分覆盖（有 UI 但降级/不一致）｜✗ = 缺失（干等或静默）｜— = 该状态不存在于此环节。
> 状态列：loading / empty / error / 同步中(sync-lost) / 已提交(等他人) / 旁观(roster-locked/迟到) / replay(重进不重演) / disabled(门槛未达) / pressed(按压反馈)。

| Phase | loading | empty | error | 同步中 | 已提交 | 旁观 | replay | disabled | pressed | Wave 1 修复 |
|---|---|---|---|---|---|---|---|---|---|---|
| waiting | ✓ 页级 bootstrap shell | ✓ WaitingPhase 阵容卡 | ✓ 410 终态页 + 全页错误 | ✓ 灰点 calm-by-default | — | ✓ 玩家等 host 视角 | ✓ | ✓ host 推进 gating | △ #28 第二波 | — |
| warmup | ✓ 卡形 shimmer + 4s 阶梯文案 | ✓ host 选氛围卡 / 玩家等待卡 | ✓ error 卡 + 自动重试 recovering | ✓ | ✓ 已准备 morph + 余烬边 | ✓ roster-locked 旁观卡 | ✓ deal/sheen 不重演 | ✓ micro 式 gating 不适用；host 推进随 CTA | △ #28 第二波 | **CTA dock(AC-01/02)、三段卡(AC-03)、卡顶 ≤2+首燃提示(AC-04)、N/M 文字(AC-04)、材质 L1(AC-08)、庆祝 backdrop(AC-13)、计数胶囊+未备名(AC-06)、stall 出口(AC-07)、测试局胶囊(AC-15)** |
| phase_selection | ✓ | ✓ CustomModeSection | △ 选择失败 toast | ✓ | — | ✓ host-only picker（玩家不可见） | ✓ | ✓ host-only | △ | — |
| micro_challenge | ✓ WaitingBeat（生成前） | ✓ | ✓ | ✓ | ✓ 完成后等待态 | ✓ | ✓ | ✓ 全员完成前禁推进+原因文案（范本） | △ | 播报降 toast+toneLine(AC-14) |
| lie_detective | ✓ WaitingBeat | ✓ | ✓ | ✓ | ✓ 已提交等待他人 | ✓ roster-locked 旁观卡 | ✓ | ✓ | △ #19 第二波 | 播报降 toast(AC-14) |
| personality_dice | ✓ WaitingBeat + W3 直播文案 | ✓ | ✓ | ✓ | ✓ 双就绪门 | ✓ | ✓ | ✓ | △ #22/#30 第二波 | 播报降 toast(AC-14)；CelebrationOverlay 浅卡(AC-13) |
| auction | ✓ WaitingBeat + W3 直播文案 | ✓ | ✓ | ✓ | ✓ 出价后 | ✓ | ✓ | ✓ V2 ladder gating | △ #23 第二波 | 播报降 toast(AC-14) |
| quip_battle | ✓ WaitingBeat + W3 直播文案 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | △ | 播报降 toast(AC-14)；CelebrationOverlay 浅卡(AC-13) |
| undercover_word | ✓ + W3 直播文案 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | △ | 播报降 toast(AC-14) |
| group_mirror | ✓ WaitingBeat + W3 直播文案 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | △ #20 第二波 | detail scrim 0.08→0.45(AC-09)；播报降 toast(AC-14) |
| mini_script | ✓ AiGenerationShell + 心跳进度 | ✓ | ✓ pipeline_timeout → catalog fallback | ✓ | ✓ ready 态 | ✓ | ✓ stepper 进度 | ✓ | △ #24 第二波 | 保留 intro overlay 吸收播报(AC-14)；clue/evidence scrim 0.4→0.45(AC-09) |
| speed_friending | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | △ | 播报降 toast(AC-14) |
| recap | ✓ recap query 加载 | ✓ honest zero-medal | ✓ | ✓ | — | — | ✓ snapshot 不重演 | — | △ #21 第二波 | 保留 overlay(AC-14)；moment panel scrim 0.30→0.45(AC-09)；`moment_card_saved` 预埋(AC-20) |

## 附注

- **播报权重表（AC-14）**：轻环节（warmup/speed_friending/quip_battle/personality_dice）仅 toast；中环节（micro_challenge/lie_detective/auction/undercover_word/group_mirror）toast + toneLine（壳层自动）；重仪式（mini_script/recap）overlay 吸收 toast。任何 phase 不再 overlay + toast 同发。实现：`viewModels/phaseBroadcast.ts`。
- ~~**AI 生成中干等（本表最大的 ✗→✓ 缺口）**~~：**已关闭（Wave 3 Track C，2026-10-16）**——quip/undercover/group_mirror/auction/dice 玩家端在 `*ContentStatus==='generating'` 时渲染「悦仔正在出题…」式 4s 阶梯直播文案（flag `icebreakerContentStatusEnabled` 门控；字段缺失 → 既有静态等待文案原样兜底）。实现：`viewModels/generatingLiveCopy.ts` + `hooks/useGeneratingLiveCopy.ts`；渲染守卫只许 `=== 'generating'` 正向判等（契约测试 `contentStatusLiveCopyContract.test.ts` 禁 `!== 'idle'`）。
- **pressed 列全 △**：12 文件 27+ 处 onClick 无 hoverClass（计划 #28），第二波统一补。
- **旁观列**：lie_detective roster-locked 卡为范本；其余环节的迟到旁观依赖各 phase 自身处理，第二波逐一核。
- Wave 2 完成后本表应重跑一遍；Wave 3（#26/#6）关闭 loading 与离开通道缺口。

## Wave 3 填修（2026-10-16，sprint icebreaker-uiux-wave3 Track C）

**Track B（服务端，commit `bd3e136a7`）新增可选字段（flag `icebreakerContentStatusEnabled` 门控，flag off 时 sanitize 剥离、客户端 snapshot 与 Wave 2 逐字节一致）**：5 个 per-phase `*ContentStatus`（quip/undercover/group_mirror/auction/dice，词表 `idle|generating|ready|failed`）、`leftUserIds`、`hostUnreachable`（host 心跳 180s 宽限推导，纯告知）。新路由唯一：`POST /:id/leave`（self-state、幂等、`{left:false}` rejoin 全恢复）。

**Track C（客户端）新渲染态**：

| 新渲染态 | 覆盖 | 实现 | 兜底 |
|---|---|---|---|
| 生成中直播文案 ×5 phase | flag on + `=== 'generating'` 正向判等 → 4s 阶梯文案（stage0 悦仔正在出… / stage1 安抚句）；host/玩家同见 | 5 HeroView `statusText` 经 `useGeneratingLiveCopy` 覆盖 | 字段缺失 → `??` 落回既有静态等待文案（AC-03） |
| stall 出口抑制（warmup，唯一有出口的 phase） | 出口自 poll-观测到 `warmupTopicsStatus==='generating'` 起 30s（`GENERATING_STALL_SUPPRESS_MS`，shared 常量）内不渲染；30s 后自愈重现 | `index.tsx` `stallExitSuppressed`（设备本地时钟，禁比 server 时间戳） | 无出口的 phase 不新增（5 个生成型 phase 本无出口） |
| 「我离开一下」次级入口 | 壳层安静 text 入口（非主 CTA）；离开 → 安心文案「已暂时离开，不影响大家，回来接着玩」；回来 → 「我回来了」 | `index.tsx` leave-row + `useSocialActions.handleToggleLeave`（POST /leave） | 本地乐观态 + `leftUserIds` 在 flag on 时服务端 reconcile；失败/跳闸释放回服务端真值 |
| host 失联纯告知 | `hostUnreachable === true && !isHost` → 一行安静提示「主持人暂时离开了…」 | `index.tsx` host-away row | 字段缺失（flag off）→ 不渲染任何相关 UI；零认领 UI、零自动推进措辞（host authority 红线由契约测试锁） |
| 胜利脉冲 ×3 时刻 | 骰子揭晓（reveal-card 阶梯 stagger）、落槌（pulse-frame 全桌）、投票命中（winner answer） | 统一词汇表 `_phase-motion.scss` `@mixin ice-victory-pulse`（transform/opacity only、≤500ms、`cubic-bezier(0.22,1,0.36,1)`、单 RM 块坍缩 150ms） | RM → 静态落定；`victoryPulseContract.test.ts` 锁词汇合规 |

**新发现的状态缺口（登记为后续波次，本波不修）**：

1. **leave 标记的他者可见性**：`leftUserIds` 目前仅本人客户端消费（入口态翻转）；同桌其他成员视角的「暂离」徽标（头像条/roster 灰显）未做——需设计稿定展示位，登记 Wave 4 候选。
2. **host 失联后的下一步引导**：纯告知已落地，但玩家除了干等没有出口（不能认领、不能离开会话标记之外的动作）；若失联超阈值 N 分钟是否给「先离席，稍后再来」的出口，需产品决策，登记候选。
3. **flag-off 下 leave 标记的冷启动丢失**：flag off 时 `leftUserIds` 不透出，冷重进后「已暂时离开」态依赖本地乐观态、不可恢复；flag 全量后此缺口自然关闭（见 shared 字段注释的 REMOVAL CONDITION）。
4. **胜利脉冲覆盖面**：本波 3 时刻（骰子揭晓/落槌/投票命中）；侦探揭晓、挑战完成、群像镜像揭晓等同质时刻仍用各自既有 celebrate（ParticleBurst/CelebrationOverlay），是否统一收编进脉冲词汇表待设计评审，登记候选。

