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
| personality_dice | ✓ WaitingBeat（掷出前） | ✓ | ✓ | ✓ | ✓ 双就绪门 | ✓ | ✓ | ✓ | △ #22/#30 第二波 | 播报降 toast(AC-14)；CelebrationOverlay 浅卡(AC-13) |
| auction | ✓ WaitingBeat（生成前） | ✓ | ✓ | ✓ | ✓ 出价后 | ✓ | ✓ | ✓ V2 ladder gating | △ #23 第二波 | 播报降 toast(AC-14) |
| quip_battle | ✓ WaitingBeat（生成前） | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | △ | 播报降 toast(AC-14)；CelebrationOverlay 浅卡(AC-13) |
| undercover_word | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | △ | 播报降 toast(AC-14) |
| group_mirror | ✓ WaitingBeat（生成前） | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | △ #20 第二波 | detail scrim 0.08→0.45(AC-09)；播报降 toast(AC-14) |
| mini_script | ✓ AiGenerationShell + 心跳进度 | ✓ | ✓ pipeline_timeout → catalog fallback | ✓ | ✓ ready 态 | ✓ | ✓ stepper 进度 | ✓ | △ #24 第二波 | 保留 intro overlay 吸收播报(AC-14)；clue/evidence scrim 0.4→0.45(AC-09) |
| speed_friending | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | △ | 播报降 toast(AC-14) |
| recap | ✓ recap query 加载 | ✓ honest zero-medal | ✓ | ✓ | — | — | ✓ snapshot 不重演 | — | △ #21 第二波 | 保留 overlay(AC-14)；moment panel scrim 0.30→0.45(AC-09)；`moment_card_saved` 预埋(AC-20) |

## 附注

- **播报权重表（AC-14）**：轻环节（warmup/speed_friending/quip_battle/personality_dice）仅 toast；中环节（micro_challenge/lie_detective/auction/undercover_word/group_mirror）toast + toneLine（壳层自动）；重仪式（mini_script/recap）overlay 吸收 toast。任何 phase 不再 overlay + toast 同发。实现：`viewModels/phaseBroadcast.ts`。
- **AI 生成中干等（本表最大的 ✗→✓ 缺口）**：quip/undercover/group_mirror/auction/dice 玩家端 loading 目前只有 WaitingBeat 静态等待，无 warmup 式「生成中直播文案」——计划 #26，第三波（需服务端 contentStatus 泛化 + flag）。
- **pressed 列全 △**：12 文件 27+ 处 onClick 无 hoverClass（计划 #28），第二波统一补。
- **旁观列**：lie_detective roster-locked 卡为范本；其余环节的迟到旁观依赖各 phase 自身处理，第二波逐一核。
- Wave 2 完成后本表应重跑一遍；Wave 3（#26/#6）关闭 loading 与离开通道缺口。
