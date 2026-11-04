# 破冰主持零培训 15 分钟 Smoke（5 名首次 host）

> **状态：未执行（gate OPEN）。** 本文件是执行规格 + 空白记录表。截至 2026-10-29 没有任何 host 跑过，§8 记录块保持空白。
> **性质：** 发布门，不是结果报告。表里每个数字都必须能对应到录屏时间码。
> **上游：** `docs/design/icebreaker-guidance-quiet-concierge-20261027.md` §2 / §8；`docs/design/icebreaker-w1-w3-implementation-plan-20261027.md` §10.4；`docs/runbooks/icebreaker-agent-m1-release-checklist.md`（本门是该清单之外独立存在的外部门，不在其 §1–§6 内）。
> **语言约定：** 正文中文；flag、事件名、PASS/FAIL/INVALID 保持英文机器标识。

---

## 1. 目的与诚实边界

### 1.1 本门证明什么

- 一个从没见过产品的人，在没有培训、没有简报、没有现场答疑的条件下，能自己开始一场 session 并把它推到 recap。
- host 在前 15 分钟需要几个「主动动作」：中位 ≤3、P90 ≤4。
- 引导层（当前环节提示 / 桌边小提示 / 活动说明书）不是必需品：不打开也能完成。

### 1.2 本门不证明什么

| 不证明的事 | 由谁证明 |
|---|---|
| 内容质量（卡片是否贴桌、话题是否好笑） | DQS 离线评级 `docs/design/icebreaker-content-quality-evaluation-20261026.md` |
| 留存、30 天复到场、商业效果 | Gate A / B / C（release checklist §4） |
| 真机性能、流畅度、分包样式、reduced-motion | 真机矩阵（release checklist §2） |
| 微信审核姿态与文案合规 | `docs/runbooks/wechat-review-submission.md` |
| 画像驱动的流程是否「更准」 | W1–W3 只读审计 + 后续桌级 A/B |
| 统计显著性 | 不证明。n=5，只用于消混淆（plan §10.4 原文：不宣称统计证明） |

### 1.3 措辞纪律

- 允许：「5/5 无帮助完成；中位 3、P90 4」。
- 禁止：「host 负担显著下降」「新手体验提升 X%」「证明引导有效」。
- 结论段落只描述这一次 5 个人的观察，不外推。

---

## 2. 招募规格

| 项 | 要求 |
|---|---|
| 人数 | 5 人，一人一场。禁止同一人跑多次（第二次就不再是「首次」） |
| 产品接触 | 从未使用过 JoyJoin；至少从未进过破冰 session；不得看过本文件或相关设计文档 |
| 互相隔离 | 5 人互不相识，不同场次，不得旁观彼此的场次，不得事后互相交流 |
| 排除项 | 内部员工 / 前员工、参与过本功能设计或测试的人、看过 spec 的人、看过本文件的人 |
| 设备 | 同一构建、同型号真机（记录 commit + 开发版版本号）；host 用自己微信登录 |
| 时间窗 | 2 天内跑完（plan §10.4） |

### 2.1 唯一简报话术（照读，不加字）

> 「今晚你是这桌的主持人，6 个人。活动大概 15 分钟，我会在旁边记录你的操作。过程中我不回答问题，也不提示。开始吧。」

**禁止补充的内容**（任何一句都会污染本门）：

- 不说「有提示可以点」「上面那行字可以展开」。
- 不说「右上角是主持人菜单」「点这个按钮继续」。
- 不解释悦仔、桌边小提示、活动说明书、agent、画像。
- 不提前打开 event-detail 的「到了现场，今晚会怎么过？」折叠区。
- 不说「卡住了可以问我」。

### 2.2 facilitator 纪律

- 15 分钟内不回答任何问题、不指屏幕、不做手势、不替 host 点按钮（包括「帮他打开菜单」）。
- 唯一例外：安全 / 隐私事故，或设备、构建、网络故障。此时当场停止，记 `ENV_FAULT`，该 host 记 INVALID 并补人（见 §6.6）。
- facilitator 全程只做两件事：录屏 + 填表。

### 2.3 文案对照批次：先 2 控，再 3 新（2026-11-02）

本轮把 host 的职责写进了等待屏的身份行（`formatIceWaitingHostLine`：「主持人：{name} · 开始与推进由你点按」）。这是**唯一一次**能在真实首次 host 身上拿到对照基线的机会——全部 5 场都用新文案，就再也说不清差异来自文案还是来自人。

- **第 1–2 场**：使用 `git` 上一个**未含**该文案的构建（控制组），照常记录 F6。
- **第 3–5 场**：使用含该文案的构建，照常记录 F6。
- 每场汇总表必须显式填 `F6 命中`（是/否）与「host 第一次 `/advance` 的动作时间」，不得只在失败时才写。
- 结论**只允许**写成「新文案后 F6 从 X/2 变为 Y/3（n=5，仅供方向参考）」。不得写成「A′ 已验证修复」——5 场不支持因果断言。
- 若 5 人中 ≥2 命中 F6，升级为完整 A（一次性简报）再讨论；否则维持现状。

---

## 3. 预检

### 3.1 flag 姿态

| flag | 期望值 | 说明 |
|---|---|---|
| `icebreakerAgentCopilotEnabled` | ON | env `ICEBREAKER_AGENT_COPILOT_ENABLED`，2026-10-26 起默认 true，现为 kill switch；server 拥有，不经 auth `features` 下发 |
| `icebreakerMatchingAwareEnabled` | ON | 默认 true（2026-10-28 起）；HostTableBrief 复用此 flag，没有独立 flag |

- 必须从 admin `/admin/feature-flags` 核对 **DB 行**（DB 优先于代码默认值），记录值与核对时间。
- 跑前、跑后各核一次；中途被改成 false 的场次记 INVALID。
- 本门不关闭任何 flag。flag OFF 的降级行为属于回滚验证，不是本门内容。

### 3.2 桌与角色：两种配置

**配置 A（推荐，保真度优先）：1 名新手 host + 5 名真人 filler**

- filler 可以培训（本门只测 host）；同一批 5 人复用于 5 场，减少人员成本。
- filler 唯一规则：「跟着屏幕走，不提问，不替主持人点」。
- 好处：warmup 的「大家都准备好后，主持人才可以推进下一步」真实存在；参与者新增输入可被真实观察。

**配置 B（低成本，保真度较低）：single-test 单人测试局（tester + 5 bots）**

已知偏差，必须在结论里标注：

1. bots 在 session 开始时即为 ready（`warmupReadyUserIds` 预置），host 看不到「我准备好了」这一步 → 动作数偏低，方向对本门有利。
2. 服务端在 advance guard 之前自动补 bot 提交，host 不会因为 bot 没提交而卡住。
3. participant 新增输入 = 0 在 bot 桌上恒真，**不构成证据** → §6.5 第 5 条判 NOT COVERED，不得写 PASS。

### 3.3 池与 tier

- 测试池 `is_test_pool=true`（跳过 `POOL_FULL` 容量门），6 座满桌。
- tier 用默认 `breeze`（破冰局）；不切 custom，不中途换 tier。
- 场地不参与本门判定，但除「地点待定」外不应出现任何报错。

### 3.4 观测器材

- 第二台设备录屏，P0 证据：要能回看 hesitation >5s 与 60s 卡死。
- 录屏命名 `H<n>.mov`，落盘 `.git/.orchestration/launch-qa/<date>/host-smoke/`（沿用 LAUNCH-QA-CHECKLIST 的证据纪律）。
- 时间一律取录屏时间码，不用人工估算、不用手机秒表。

### 3.5 每场之间的重置清单（缺一项则该场 INVALID）

- [ ] 上一场 session 已到 recap / ended，或已在 admin 侧结束
- [ ] 新 host 用自己微信账号，不复用上一场登录态
- [ ] 重新建池或重置到 waiting（不复用上一场已推进的 phase）
- [ ] 清客户端缓存并重新进入开发版（避免 draft / rejoin 残留）
- [ ] 关掉上一场的通知与订阅弹窗
- [ ] 记录：pool id、`socialSessionId`、`icebreakerSessionId`、构建版本、开始时间

### 3.6 跑前 30 秒自检

- [ ] host 端能看到当前环节提示（guidance line）
- [ ] 主 CTA 可点，点后状态有变化（用 staff 账号先试，**不要**用 host 的账号试）
- [ ] 配置 A：participant 端看不到桌边小提示（顺手验一次）

---

## 4. 观测协议

### 4.1 时间零点 T0

host 首次看到 warmup 卡面（或 waiting 的 current / next / final）的那一刻 = T0。`T0+15:00` 停止计数。

15 分钟是**计数窗口**，不是完成期限。session 可以继续跑到 recap，完成性在 session 自然结束时判定。

### 4.2 什么算一个 host 动作

定义：host 在窗口内主动发起、**改变 session 状态**或**改变自己可见的引导面**的点击 / 长按。

| 类别 | 例子（真实控件名） | 计数 |
|---|---|---|
| 推进类 | `进入下一题` / `本轮结束` / 各 phase 的 advance / `不等了，直接继续 ›` / 换 tier（tier sheet） | 1 |
| 状态类 | `我准备好了` / `已准备 · 点按取消` / 主持人菜单里的状态改动 / 转移主持人 | 1 |
| 引导类 | 点开桌边小提示（guidance line 上的 `›`）/ 点开悦仔 Ask / 采纳或忽略 Ask | 1（spec §2：guide 点击也计入） |

计数细则：

- 一次点击 = 1。双击 / 连点仍记 1，但把「重复点击」写进困惑记录。
- 点了没反应、报错、重试：记 1，并在困惑记录里写明失败表现。
- 自己打开的 overlay，其关闭不额外计 1（已包含在那次打开里）。

### 4.3 什么不算动作

- 滚动、阅读、停留、犹豫、放大、把手机递给别人。
- participant 的 ready 点击（即使 host 在等）。
- 系统自动行为：自动进入 phase、自动 recap、toast / overlay 自动出现、haptics。
- 进入 session 之前的路径点击（报名、进房间、扫码）。
- 关闭一个自己没打开过的 overlay。

### 4.4 「可见下一步」判定（60s 硬规则用）

3 秒内、不滚动、不打开任何面板，就能指认一个能推进流程的控件或明确文案 = 有可见下一步。

### 4.5 「卡死」判定

≥60 秒无任何动作，且期间出现任一：

- (a) 屏幕上不存在可推进的控件（含折叠进菜单的）；
- (b) 点了控件但无状态变化、无 loading、无错误提示；
- (c) host 反复滑动同一屏并出现求助动作（抬头看 facilitator、把手机转给别人、出声问「然后呢」）。

**聊天继续、host 主动不推进不算卡死**：此时 `本轮结束` / `进入下一题` 可见，属于合法节奏。

### 4.6 顺带记录（不改变本门判定）

- **首张可用卡**：T0 → 第一张可操作卡面 + 主 CTA 可见的秒数（plan §10.4 的 P95 ≤8s）。
- **预读**：session 开始前是否展开过 event-detail 的「到了现场，今晚会怎么过？」（plan §10.4：预读必须为 0）。若 3 名以上 host 主动展开，视为「说明书可发现性 / 必要性」结论被推翻，需回看 design，而不是记一笔了事。

---

## 5. 观测表（空白模板）

填表规则：

- 每人 5 行是下限；动作超过 5 个就续行（失败场次往往正是动作多的场次，不要为了表格好看而截断）。
- 「时间」填 `mm:ss`，相对 T0。
- 「无帮助可发现」= host 没有求助、没有来回找，就点到了这个动作。
- 「犹豫 >5s」= 从出现意图到点下去超过 5 秒（从录屏读，不靠回忆）。

### 5.1 动作记录

| 主持 | 时间 (mm:ss) | 动作 | 无帮助可发现 (Y/N) | 犹豫 >5s (Y/N) | 困惑记录 |
|---|---|---|---|---|---|
| H1 |  |  |  |  |  |
| H1 |  |  |  |  |  |
| H1 |  |  |  |  |  |
| H1 |  |  |  |  |  |
| H1 |  |  |  |  |  |
| H2 |  |  |  |  |  |
| H2 |  |  |  |  |  |
| H2 |  |  |  |  |  |
| H2 |  |  |  |  |  |
| H2 |  |  |  |  |  |
| H3 |  |  |  |  |  |
| H3 |  |  |  |  |  |
| H3 |  |  |  |  |  |
| H3 |  |  |  |  |  |
| H3 |  |  |  |  |  |
| H4 |  |  |  |  |  |
| H4 |  |  |  |  |  |
| H4 |  |  |  |  |  |
| H4 |  |  |  |  |  |
| H4 |  |  |  |  |  |
| H5 |  |  |  |  |  |
| H5 |  |  |  |  |  |
| H5 |  |  |  |  |  |
| H5 |  |  |  |  |  |
| H5 |  |  |  |  |  |

### 5.2 每场汇总

| 主持 | 动作数 n | 最长「无可见下一步」(s) | 首张可用卡 (s) | 预读 (Y/N) | 完成 (Y/N) | 结果 (PASS/FAIL/INVALID) |
|---|---|---|---|---|---|---|
| H1 |  |  |  |  |  |  |
| H2 |  |  |  |  |  |  |
| H3 |  |  |  |  |  |  |
| H4 |  |  |  |  |  |  |
| H5 |  |  |  |  |  |  |

---

## 6. 计分

### 6.1 单场计数

`n_i` = host i 在 T0 起 15 分钟内的动作数（按 §4.2）。只数动作，不数点击次数里的连点。

### 6.2 中位数

5 个样本排序后取第 3 个。阈值 ≤3。

### 6.3 P90 在 n=5 下的诚实读法

nearest-rank 定义：位置 = `ceil(0.9 × 5)` = 第 5 个 = **最大值**。

所以 **P90 ≤4 在 n=5 下等价于 5 名 host 全部 ≤4**。这不是加严，是这个小样本下 P90 唯一站得住的算法。

同时记录线性插值 P90（Excel `PERCENTILE.INC` / numpy `linear`）：rank = `1 + (n-1) × 0.9 = 4.6` → `sorted[4] + 0.6 × (sorted[5] - sorted[4])`。它只作记录，不参与判定。

若产品方本意是「4/5 达标即算 P90 通过」，必须在本文件显式写 **AMENDED** + 理由 + 谁批的，不得默认放宽。

### 6.4 计算示例

| 5 个样本（升序） | 中位 | P90 nearest-rank | P90 线性插值 | 判定 |
|---|---|---|---|---|
| 2, 3, 3, 4, 4 | 3 | 4 | 4.0 | PASS（中位 3 ≤3；P90 4 ≤4） |
| 2, 3, 3, 4, 6 | 3 | 6 | 5.2 | FAIL（P90 6 >4；中位达标但样本里有人明显吃力） |
| 3, 3, 4, 4, 4 | 4 | 4 | 4.0 | FAIL（中位 4 >3） |
| 2, 2, 3, 3, 3，且 H4 卡死 72s | 3 | 3 | 3.0 | FAIL（硬规则：卡死不看中位） |

### 6.5 PASS 规则

全部满足才 PASS：

1. 5/5 无帮助开始并完成（无 facilitator 干预、无 INVALID 顶替）。
2. 中位 ≤3。
3. P90（nearest-rank）≤4，即 5/5 ≤4。
4. 无任何 host 触发 §4.5 卡死。**任何 host 卡死 >60s 且无可见下一步 = FAIL，与中位无关。**
5. 参与者新增输入 = 0。仅配置 A 可判；配置 B 记 NOT COVERED。
6. 无隐私 / 安全 P0：桌边小提示、画像字段、coverage 数字出现在 participant 端。

### 6.6 FAIL / INVALID / 排除

| 情形 | 处理 |
|---|---|
| 任一硬规则触发 | FAIL，不看中位 |
| 环境、构建、bot、网络故障 | INVALID：补一名新 host，记录原因，不静默丢弃 |
| 重置清单漏项 | INVALID（同上） |
| host 之前用过产品 / 看过本文件 | 排除，换人；不算 INVALID，不占样本 |
| 中位达标但有人明显吃力 | FAIL 时按 §7 归因，不要用「平均还好」圆过去 |

结论只允许 PASS / FAIL / INVALID（需补人）。不接受 PARTIAL。

---

## 7. 失败分类

每条观察都必须归到一个 ID。归不到 = 分类表缺项，当场补一行，不要硬塞进相近的类别。

| ID | 名称 | 观察信号 | 归因区域 / fix owner |
|---|---|---|---|
| F1 | 无可见下一步 (NO_VISIBLE_NEXT) | 屏幕上看不到推进控件，或控件折叠在菜单里、被 overlay 盖住 | `apps/mini-program/src/pages/icebreaker-session`（会话壳 / phase view） |
| F2 | 引导线被忽略 (GUIDANCE_IGNORED) | guidance line 在，但 host 没读或读了不用，转而去翻主持人菜单 | `packages/shared/src/copy/icebreakerSession.ts` + `XiaoyueSessionShell`（文案与层级） |
| F3 | 桌边小提示被当指令 (BRIEF_AS_INSTRUCTION) | host 把「先聊具体小事」当成必须执行的任务，开始逐条念或指挥别人 | server `lib/tablePersona.ts` 的 `paceShort` 措辞 + copy |
| F4 | overlay 冲突 (OVERLAY_COLLISION) | toast / coachmark / PhaseIntroOverlay / 桌边小提示同时出现或互相遮挡，主 CTA 点不到 | session shell overlay 仲裁（`index.tsx` 优先级链） |
| F5 | 重进困惑 (REJOIN_CONFUSION) | 后台回来或断网恢复后看到旧 phase / 空白 / 不知道自己在哪 | `useRejoinCatchUp` + rejoin 文案 |
| F6 | 主持人身份不可见 (HOST_ROLE_INVISIBLE) | host 不知道自己有权推进，一直在等别人先动 | host 身份呈现（phase 行 / 成员条） |
| F7 | 卡面与动作不匹配 (CARD_ACTION_MISMATCH) | 卡面说一件事，CTA 说另一件事（如「本轮结束」与「进入下一题」混读） | `warmupViewModels.buildCTAState` + 卡面文案 |
| F8 | 等待态误读 (WAITING_MISREAD) | 把 waiting 的 current / next / final 理解成「等系统开始」，一直不点开始 | `WaitingPhase` 文案 |
| F9 | 环境故障 (ENV_FAULT) | 网络、构建、bot、账号问题 | 不计产品失败；该场 INVALID，补人 |

分类之外的两条纪律：

- 同一段卡顿可以同时命中两个 ID（如 F1 + F4），两个都记，不要二选一。
- 隐私类问题不走本表，直接 P0（§6.5 第 6 条），停止本门并升级。

---

## 8. 结果记录模板（粘贴回填）

```
# 破冰主持零培训 15 分钟 Smoke — 结果记录

- 执行日期：
- 构建 / commit：
- 开发版版本号：
- 配置：A（真人 filler）/ B（single-test bots）
- flag 核对：icebreakerAgentCopilotEnabled = ____ @ ____；icebreakerMatchingAwareEnabled = ____ @ ____
- 跑后复核：一致 / 不一致（不一致则相关场次 INVALID）
- 证据目录：.git/.orchestration/launch-qa/<date>/host-smoke/

## 计数
H1 = __
H2 = __
H3 = __
H4 = __
H5 = __
升序：__ , __ , __ , __ , __
中位 = __（阈值 ≤3）
P90 nearest-rank = __（阈值 ≤4）
P90 线性插值 = __（仅记录）
硬规则（任一 host 卡死 >60s 且无可见下一步）：触发 / 未触发
参与者新增输入 = 0：PASS / FAIL / NOT COVERED（配置 B）
隐私 P0：无 / 有（描述）

## 判定
VERDICT：PASS / FAIL / INVALID（需补人）

未达标项：
-
-

## 三个最差困惑时刻
1. H_ / mm:ss / 分类 F_ / 一句话描述 / 录屏片段位置
2.
3.

## 归因与回派
| 分类 | 次数 | owner 区域 | 处置（修 / 观察 / 不修） |
|---|---|---|---|
|  |  |  |  |

## INVALID 记录（如有）
- H_：原因 / 是否补人 / 补的是哪一位

## 措辞纪律
本结论只覆盖「首次 host 能否无培训完成」。不得据此声明内容质量、留存、商业效果或统计显著。
```

---

## 9. 与现有埋点的关系（诚实说明）

- 今天**没有**服务端 `host_guide_action`。spec §8 第 6 条写的是「只在确有需要时使用」，未实现。因此本门的动作计数只能人工从录屏数，不能从 analytics 直接取。
- `session_health_snapshot` 的 `myActionCount` **不能替代**：它在 recap 首次展示时一次性发出、按用户、覆盖整场、由本地状态推导，并且包含参与者式贡献（发言 / 投票），既没有 15 分钟窗口，也不区分 host。
- 可作交叉核对的既有事件（`/api/analytics/social-icebreaker` 白名单内）：`phase_view`、`warmup_host_menu_open`、`warmup_tier_sheet_open`、`agent_ask_shown`、`agent_ask_decision`、`stall_nudge_shown`。它们能证明「某个控件被点过」，不能证明「host 一共点了几个」，也不能替代人工判定「有没有可见下一步」。
- 若要把这个指标变成可长期监控的量，最小增量就是 spec §8 第 6 条那个事件（action / phase / time bucket，无画像）。本门不要求先有埋点，也不因为缺埋点而放宽判定。

---

## 10. 门状态

- **状态：OPEN（未执行）。** 5 名 host 一个都还没跑，§5 表格与 §8 记录块均为空白模板。
- **与本门并列未完成的发布项：** 真机矩阵（375×667 / 390×844 / 小屏 Android / reduced-motion / offline / rejoin / host-transfer）与微信审核（spec §9 明列）。
- **关闭条件：** §5 与 §8 填满 + 录屏归档 + VERDICT = PASS。FAIL 时按 §7 归因回派，**不得靠调阈值关闭本门**。
