# 首次主持零培训 Smoke：facilitator 执行单

> 编制日期：2026-10-29。当前状态：OPEN，未执行，0 名 host，没有任何观察结果。
> 唯一判定依据：`docs/testing/icebreaker-host-zero-training-smoke.md`。本执行单不放宽阈值，也不替代该文件。

## 1. 开跑前锁定

- 只采用配置 A：1 名首次 host 加 5 名真人 filler。配置 B 的 participant 新增输入恒为 NOT COVERED，计分器不会给 PASS，只能用于流程排练。
- 5 名 host 互不相识、从未使用 JoyJoin、从未看过相关文档，每人只跑一场；5 场在实际首个执行日起 2 个自然日内完成。同一构建、同型号真机、默认 `breeze`、6 座测试池。
- 在 admin `/admin/feature-flags` 核对 DB 行，不以代码默认值代替：`icebreakerAgentCopilotEnabled=ON`，`icebreakerMatchingAwareEnabled=ON`。本门不关闭 flag。
- 复制 `results.template.json` 为当场 `results.json`。构建 SHA、开发版版本号、设备型号、执行日期必须填实际值；日期用 `YYYY-MM-DD`，时间用带时区的 ISO 8601，例如 `2026-10-30T09:00:00+08:00`。
- 证据目录用 `.git/.orchestration/launch-qa/<date>/host-smoke/`，把 `<date>` 换成实际绝对日期，例如 `2026-10-30`。招募文案已给出 2026-10-30 主执行日和 2026-10-31 候补日；改期时必须同步改成新的绝对日期。

## 2. 执行日时间线

以下以 2026-10-30 为例；实际改期时只改绝对日期，不改变顺序。

| 时间 | facilitator 动作 |
|---|---|
| 08:45–09:15 | 用 staff 账号完成协议 §3.6 自检；准备池、filler、第二台录屏设备；记录跑前两项 flag 的值与核对时间。不要用 host 账号试点。 |
| 每人开始前 5 分钟 | 完成第 5 节重置；记录该 host 的 before flag 姿态、pool id、`socialSessionId`、`icebreakerSessionId`、构建和开始时间。 |
| 每人 00:00 | 开始第二台设备录屏，再让 host 进入；首次看到 warmup 卡面或 waiting 的 current/next/final 时记 T0。 |
| T0 前 | 只照读第 3 节唯一简报，不添加任何产品说明。 |
| T0–T0+15:00 | 只录屏和填表。按协议 §4.2 记录动作，所有秒数取录屏时间码；15 分钟后停止计数，但让 session 自然跑到 recap 以判定完成。 |
| 每场结束后 5 分钟 | 核对 participant 新增输入和隐私 P0，记录 after flag 姿态；保存录屏、观察表并更新 JSON，再重置下一场。 |
| 最后一场后 | 再核两项 DB flag；从仓库根目录运行第 6 节计分命令，保存完整输出并回填协议 §8。 |

filler 只听这一句：「跟着屏幕走，不提问，不替主持人点」。

## 3. 对 host 照读，一字不加

> 「今晚你是这桌的主持人，6 个人。活动大概 15 分钟，我会在旁边记录你的操作。过程中我不回答问题，也不提示。开始吧。」

永远不说：

- 「有提示可以点」「上面那行字可以展开」。
- 「右上角是主持人菜单」「点这个按钮继续」。
- 不解释悦仔、桌边小提示、活动说明书、agent、画像。
- 不提前打开 event-detail 的「到了现场，今晚会怎么过？」折叠区。
- 不说「卡住了可以问我」；不回答问题、不指屏幕、不做手势、不替 host 点按钮。
- 只有安全、隐私、设备、构建或网络事故可以中断。此时停止该场，记 `ENV_FAULT` 和 INVALID，补一名新 host；不要抢救后继续计入样本。

## 4. 每场必须留下的证据

1. `H<n>.mov`：从简报前开始，覆盖 T0、15 分钟窗口及自然结束，能回看超过 5 秒犹豫和 60 秒卡死。
2. `H<n>-observation.md`：粘贴并填写协议 §5.1 与 §5.2；动作超过 5 行必须续行。记录所有困惑时间码、F1–F9 分类、预读、participant 新增输入和 participant 端隐私检查。同一段困惑可记多个分类。
3. `results.json`：`actionCount` 只数 T0 后 15 分钟内的主动动作；`longestStuckSeconds` 填最长「无可见下一步」秒数；`firstUsableCardSeconds` 取 T0 到首张可操作卡面且主 CTA 可见；`minute` 是相对 T0 的分钟数，01:30 写 `1.5`。
4. 每名 host 的 `evidence.recording` 和 `evidence.observationSheet` 填相对仓库根目录的路径；`resetChecklistComplete=true`、`facilitatorIntervention=false` 才可计入有效样本。
5. 配置 A 的 `participantInput.newInputCount` 必须为 0；任一 participant 端出现桌边小提示、画像字段或 coverage 数字，立即把 `privacyP0Observed=true`，停止本门并升级，不能继续凑样本。
6. INVALID 不静默删除：保留录屏和观察表，并在同目录 `invalid-attempts.md` 写明原因与补人关系。当前 `hosts` 中若有 INVALID，计分器只会给 INCOMPLETE 或 FAIL；补人后另建最终五人 `results.json`，同时保留无效场档案。

不得用 `session_health_snapshot.myActionCount` 代替人工动作数，不得估算时间，不得新增埋点或产品 instrumentation。

## 5. 每场重置清单

- [ ] 上一场 session 已到 recap/ended，或已在 admin 侧结束。
- [ ] 新 host 使用自己的微信，不复用上一场登录态；到场再次确认从未使用产品、未看文档、未跑过本测试。
- [ ] 重新建池或重置到 waiting，不复用已推进 phase。
- [ ] 清客户端缓存并重进同一开发版，无 draft/rejoin 残留。
- [ ] 关闭上一场通知与订阅弹窗。
- [ ] 记录 pool id、`socialSessionId`、`icebreakerSessionId`、构建版本、开始时间。
- [ ] 该场 before flag 两项均为 ON 且有时间；上一场 after flag 已落盘。
- [ ] 录屏文件名和观察表文件名已确定，录屏存储空间充足。

任一重置项漏做：该场 INVALID，补人。host 其实用过产品或看过文档：直接排除并换人，不占 INVALID。

## 6. 计分、归档与门状态

从仓库根目录执行：

```bash
node scripts/testing/score-host-smoke.mjs .git/.orchestration/launch-qa/2026-10-30/host-smoke/results.json
```

把路径中的 2026-10-30 换成实际绝对日期。脚本只读，不改 JSON；它检查五名 host、构建、session、重置、证据文件、每场前后 flag、完成性、participant 输入和隐私 P0。PASS 退出码为 0；FAIL、INCOMPLETE、JSON 或用法错误均为非 0。另运行 `node scripts/testing/score-host-smoke.mjs --self-test` 验证计分器本身。

将输出原文保存为 `score.txt`，把同一输出回填 `verdict` 和协议 §8，列出三个最差困惑时刻及录屏位置。只有协议 §5 与 §8 填满、录屏归档、计分器 PASS 才能关闭门；FAIL 按 F1–F9 回派，INCOMPLETE 继续补证据或补人。结论只描述这 5 人，不宣称统计显著、内容质量、留存或商业效果。

## Open questions for the owner（待 owner 澄清）

1. 协议 §4.5 写「≥60 秒」，§6.5 与发布检查单写「>60s」。计分器按明确硬规则 `>60` 自动 FAIL；恰好 `60` 秒返回 INCOMPLETE，需 owner 裁定，绝不自动 PASS。
2. 协议 §4.6 提到首张可用卡 P95≤8s，但 §6.5 未把它列为 PASS 条件。计分器展示每场秒数，不以该指标自动判定。
3. 协议 §4.6 写预读必须为 0，又规定 3 名以上主动展开才推翻设计结论，且 §6.5 未列预读门槛。观察表仍逐场记录；当前 JSON 和计分器不自动判预读，需 owner 明确最终口径。
4. 协议 §8 允许 VERDICT=INVALID（需补人），本计分器按交付要求只输出 PASS/FAIL/INCOMPLETE。凡 hosts 中有 INVALID 都映射为 INCOMPLETE 并非 0 退出；协议 §8 仍可写 INVALID（需补人）。

## 7. 计分器已执行验证（2026-10-29）

- `node scripts/testing/score-host-smoke.mjs --self-test`：10/10 PASS，退出码 0。覆盖协议四个 worked example、缺证据、硬规则覆盖合格计数、INVALID host、配置 B、恰好 60 秒边界、participant 输入非零。
- `node scripts/testing/score-host-smoke.mjs docs/testing/host-smoke/results.template.json`：VERDICT=INCOMPLETE，退出码 1，逐场列出缺失字段；空模板不能被判成 PASS。
- 这只证明计分器与模板可用，**不构成任何 host 观察结果**。门仍 OPEN，0/5 host。
