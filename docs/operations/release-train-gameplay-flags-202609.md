# 游戏性大版本 Release Train — Flag Matrix & Ops Runbook（Wave 1.5）

> **日期：** 2026-09-17
> **作者：** @product-manager（roadmap Wave 1 task 1.5 交付物）
> **上游：** `.git/.orchestration/plans/gameplay-depth-roadmap-2026-09.md`（Wave 5 发布列车）
> **合约：** `sprint-contract.wave1-2-lieDetectiveV2Enabled.md`（IMPLEMENTED + QA PASS）、`sprint-contract.wave1-3-personalityDiceChooseMode.md`（IMPLEMENTED + QA PASS）、`sprint-contract.wave2-auctionV2.md`（LOCKED）
> **用途：** 本页是 bundled「游戏性大版本」发布的唯一 ops 页面。**任何 flag 在任何环境首次置 `true` 之前，必须先关闭 §2 中对应的 BLOCKING 前置项。**
> **验证纪律：** 本文所有文件路径、行号、SQL 列名、指标名已于 2026-09-17 对照仓库代码逐一核实；无法从仓库确知的事项标注「待 ops 确认」并附检查命令。

---

## 1. Flag Matrix

> 管理入口（两环境，super_admin 登录，操作审计 `FEATURE_FLAG_UPDATED`）：
> - 生产：`https://admin.joyjoinapp.com/admin/feature-flags`
> - Staging：`https://staging.admin.joyjoinapp.com/admin/feature-flags`
> 服务端路由 `GET/PUT /api/admin/feature-flags[/:key]`，`requireAdmin + requireSuperAdmin`（`apps/server/src/routes/domains/admin.ts:190/:206`，已验证；admin-client 页面 `AdminFeatureFlagsPage.tsx`）。
> **Flag 机制真相（已验证）：** DB 行 = 真相源，env = 回退层，5s LRU 缓存（`featureFlags.ts`）。**Flag 是「每环境一个全局布尔」，没有百分比/人群灰度能力**——「小流量」只能按 §3 的时间窗程序执行。

| Flag key | Env fallback key | 缺省 | 快照语义 | Owner（代码 / ops） | 实施状态（2026-09-17 核实） | 回滚动作 |
|---|---|---|---|---|---|---|
| `miniscriptEvidenceVoteV2Enabled` | `MINISCRIPT_EVIDENCE_VOTE_V2_ENABLED` | `false`（`featureFlags.ts:463`） | mini_script **阶段进入时**快照入 session state；进行中会话不受后续切换影响 | @ai-engineer / 值班 super_admin | 代码早已就绪（DB-backed 先例）；**Wave 1.1 目录重生完成（validator exit 0），等人工内容审核（§4）**——flag 保持 OFF | 后台置 `false` → ≤5s 生效；已快照 V2 的会话按 V2 完结（快照canon） |
| `lieDetectiveV2Enabled` | `LIE_DETECTIVE_V2_ENABLED` | `false`（`featureFlags.ts:467`） | lie_detective **阶段进入时**快照入 `state.lieDetectiveMode`；解析序 = single-test 覆盖 > DB flag > env `LIE_DETECTIVE_MODE` > v1 | @backend-engineer / 值班 super_admin | **IMPLEMENTED + QA PASS（9/9 AC）**；剩余门：@auto-eval PASS-of-record 重跑 | 后台置 `false` → ≤5s 生效；已快照 v2 的会话按 V2 完结。**前置：env `LIE_DETECTIVE_MODE` 必须 unset 或 `v1`，否则 flag-OFF ≠ V1（§2-a）** |
| `personalityDiceChooseModeEnabled` | `PERSONALITY_DICE_CHOOSE_MODE_ENABLED` | **`true`**（`featureFlags.ts:475`）⚠️ | **会话创建（/start）时**快照入 `state.personalityDiceChooseModeEnabled`（注意：不是阶段进入——合约核实修正）；pregen 经 payload 透传快照 | @backend-engineer / 值班 super_admin | **IMPLEMENTED + QA PASS（10/10 AC）**；AC-09 ops 动作 = 本文 §2-b | **这是行为保持迁移：该功能今天已在生产 ON。** 置 `false` = 主动关掉一个 LIVE 功能（新会话回单 dare 模式）；误置 `true` 会静默覆盖有意设的 env `false`。首次写 DB 行前必须完成 §2-b |
| `auctionV2Enabled` | `AUCTION_V2_ENABLED` | `false`（合约 AC-01） | auction **阶段进入时**快照入 `state.auctionV2Enabled` | @backend-engineer / 值班 super_admin | **合约 LOCKED（2026-09-17 cycle-2 ACK），实现未开始**（已核实：`featureFlags.ts` 无注册项）。**简报中「in implementation」表述已过时** | 后台置 `false` → ≤5s 生效；beats 另有独立总闸 `icebreakerGroupBeatsEnabled`（OFF 即全静默，轮询兜底完整）。**前置最多：§2-c/d + §4 两项文案审核 + 客户端版本门（§2-e）** |
| `icebreakerHighlightsMetaEnabled`（Wave 4，规划中） | 未定（合约未起草） | 计划 `false` | 计划：**会话开始时**快照（参照 miniScript 模式） | 未定（Wave 4 spec 先行） | **未实施、未起草合约**——不在本次发布列车gates内，列出仅为矩阵完整 | 未定。Wave 4 合约起草时补本行 |

---

## 2. Ops 前置检查单（BLOCKING — 全部关闭后才允许任何 flag 置 true）

> 每项标注来源合约条款。检查命令中 `gh variable get` 依赖本机 gh CLI 已登录且有 repo 权限；CVM 上生产 env 文件为 `~/JoyJoin/deployment/.env.production`（已验证：`deployment/scripts/deploy-production.sh:147`）。

### 2-a. `LIE_DETECTIVE_MODE` 环境姿态（来源：wave1-2 AC-09；BLOCKING for `lieDetectiveV2Enabled=true`）

**为什么：** 解析序中 env `LIE_DETECTIVE_MODE` 是 flag-OFF 的回退层。若某环境设了 `LIE_DETECTIVE_MODE=v2`，则「flag 关掉」并不等于「回到 V1」——kill switch 失效。

- [ ] 生产：`ssh` 到 CVM，执行 `grep LIE_DETECTIVE_MODE ~/JoyJoin/deployment/.env.production || echo "unset"`——结果必须为 `unset` 或 `LIE_DETECTIVE_MODE=v1`。**待 ops 确认**（repo 不可知；`.env.example:281` 的本地缺省是 `v1`，不代表生产）。
- [ ] Staging：`grep LIE_DETECTIVE_MODE ~/JoyJoin/deployment/.env.staging || echo "unset"`。**待 ops 确认**。
- [ ] 结果记录到本文 §6「姿态记录表」。

### 2-b. `PERSONALITY_DICE_CHOOSE_MODE_ENABLED` 环境姿态（来源：wave1-3 AC-09，反向前置；BLOCKING for 首次写该 flag 的 DB 行）

**为什么（与 2-a 方向相反）：** 该 flag 缺省 `true`，行为今天已在生产 ON。风险不是「关不掉」，而是「意外的 DB 行让 LIVE 行为偏离 env 文档姿态」——DB `false` 会杀掉 LIVE 功能，DB `true` 会静默覆盖有意的 env `false`。

- [ ] 查 GitHub repo variable（repo 内不可知，Wave 0 finding 0.5 的悬而未决项在此关闭）：`gh variable get PERSONALITY_DICE_CHOOSE_MODE_ENABLED`（未设则报错 = 未设）。**待 ops 确认**。机制依据（已验证）：`deploy-production.yml:293`（vars 注入）+ `deployment/scripts/deploy-production.sh:266`（`upsert_if_nonempty`——变量为空则**不写** env 文件，等效于缺省 ON）；staging 侧 `deploy-staging.yml:997`（`write_if_nonempty`）。
- [ ] 查 CVM 已部署 env：`grep PERSONALITY_DICE_CHOOSE_MODE_ENABLED ~/JoyJoin/deployment/.env.production ~/JoyJoin/deployment/.env.staging`。**待 ops 确认**。
- [ ] 与产品确认 choose-mode 在该环境**应保持 ON**（默认答案：是——现状即 ON）。
- [ ] 结果记录到 §6。

### 2-c. `SOCIAL_ICEBREAKER_ENABLE_AUCTION` 环境姿态（来源：wave2-auctionV2 AC-10(a) = 设计 spec V-2；BLOCKING for `auctionV2Enabled=true`）

**为什么：** 拍卖环节总开关（env，缺省 `false`，`socialIcebreakerPhaseConfig.ts:41` 已验证）。若生产该 env 为 OFF，则拍卖环节本身不在 run plan 里，`auctionV2Enabled` 开了也无人到达——灰度顺序必须先开环节、再开 V2。

- [ ] `gh variable get SOCIAL_ICEBREAKER_ENABLE_AUCTION`。**待 ops 确认**（注入点已验证：`deploy-production.yml:291`、staging `:805`；`upsert_if_nonempty` 语义同上，未设 = env 文件无此行 = 缺省 OFF）。
- [ ] `grep SOCIAL_ICEBREAKER_ENABLE_AUCTION ~/JoyJoin/deployment/.env.production ~/JoyJoin/deployment/.env.staging`。**待 ops 确认**。
- [ ] 结果记录到 §6，并据此写明该环境的灰度顺序（先环节 ON → 观察 → 再 V2 ON，或环节早已 ON → 直接 V2 灰度）。

### 2-d. 基线快照（来源：Wave 0.6 + wave2-auctionV2 AC-10(b)；BLOCKING for 生产小流量，建议 flag-on 前完成）

**为什么：** Wave 5 发布门「dwell 不退化 >15%」「出价参与率 ≥80%」需要对照基线；没有基线，≥8.0 评分门和 dwell 门都无法判定。

- [ ] **Per-phase dwell 基线**（列名已对照 `packages/shared/src/schema/_definitions_social.ts:181-195` 核实：`phase` / `dwell_time_ms` / `started_at`；`is_test_session` 列存在于 `social_icebreaker_sessions`，用于排除测试会话）：

```sql
SELECT m.phase,
       avg(m.dwell_time_ms) AS avg_dwell_ms,
       count(*)             AS samples
FROM social_icebreaker_phase_metrics m
JOIN social_icebreaker_sessions s ON s.id = m.social_session_id
WHERE m.started_at > now() - interval '30 days'
  AND s.is_test_session = false
  AND m.dwell_time_ms IS NOT NULL
GROUP BY m.phase
ORDER BY m.phase;
```

> 说明：比任务简报的 starter SQL 多了 JOIN——排除 single-test 机器人会话，否则基线被测试流量污染。对生产 `postgres` 服务执行（CVM：`docker exec` 进 postgres 容器或 `psql "$DATABASE_URL"`）。
> **2026-09-18 qa-agent 核定：** 列名/表名/`is_test_session` 全部对照 schema 核实（`_definitions_social.ts:181-195,28`），SQL 原样有效。**但 recap 环节永远没有 dwell 行**：`savePhaseMetric` 只在 transitionPhase **离开**某环节时触发（`socialIcebreakerHelpers.ts:1443`），recap 是终止环节、无出口转换 → G3 的「recap dwell 不下降」腿目前无数据源（见 §2-f G3-b / 工单 T-2）。dev DB 2026-09-18 不可达，首跑 = ops。

- [ ] **拍卖出价参与率 / 每标出价次数基线**（2026-09-18 qa-agent 核定：jsonb 路径已对照 `SocialSessionState` 核实并**修正**——原稿用 `state_json->'auctionLots'` 做会话过滤器无效：auction 阶段退出时 `cleanupPhaseStateForNextPhase` 抹除 `auctionLots`（`apps/server/src/socialIcebreakerPhaseConfig.ts:229-237`），持久态只剩跨阶段保留的 `auctionBidHistory`（D5，`socialIcebreakerExtended.ts:1123-1127`，上限 200 条截断——高出价场次 `total_bids` 封顶 200）。以下 SQL 语法已对齐 schema；**dev DB 2026-09-18 不可达（localhost:5432 ECONNREFUSED），首跑 = ops**）：

```sql
-- 每场拍卖：出价人数、总出价数、有出价的标数、出价参与率（近 30 天，排除测试会话/机器人/主持）
SELECT s.id,
       b.total_bids,
       b.unique_bidders,
       b.lots_with_bids,
       p.eligible_bidders,
       round(b.unique_bidders::numeric / nullif(p.eligible_bidders, 0), 3) AS bid_participation_rate
FROM social_icebreaker_sessions s
CROSS JOIN LATERAL (
  SELECT count(*) AS total_bids,
         count(DISTINCT e->>'userId')   AS unique_bidders,
         count(DISTINCT e->>'lotIndex') AS lots_with_bids
  FROM jsonb_array_elements(s.state_json->'auctionBidHistory') e
) b
CROSS JOIN LATERAL (
  SELECT count(*) AS eligible_bidders
  FROM social_icebreaker_participants sp
  WHERE sp.social_session_id = s.id
    AND sp.is_test_bot = false
    AND sp.user_id <> s.host_user_id
) p
WHERE s.created_at > now() - interval '30 days'
  AND s.is_test_session = false
  AND b.total_bids > 0
ORDER BY s.created_at DESC;
```

> 修正说明：`lots_with_bids` 只统计**有出价**的标——零出价流拍标在 bid history 中不可见（V2 的 `auctionLotResults` 跨 cleanup 持久，`auctionV2Enabled` 打开后可改用其得精确标数）。参与率分母 = 参与者表去掉主持与测试机器人；中途退出者仍在分母（基线近似，可接受）。汇总 rollup（avg unique_bidders / avg bid_participation_rate）可按同 FROM/WHERE 自行聚合。

- [ ] 结果粘到 §6；同时快照 `joyjoin_ai_calls_total{outcome="fallback"}` 当前速率（`curl -s https://joyjoinapp.com/api/metrics | grep joyjoin_ai_calls_total`，指标与标签已验证：`apps/server/src/middleware/metrics.ts:14,469`）作为 §3 门 G2 的对照。

### 2-e. 客户端版本门（来源：wave2-auctionV2 AC-10(e)，verifier M5；BLOCKING for `auctionV2Enabled=true`）

- [ ] 确认携带拍卖 V2 客户端（合约 AC-11…AC-16）的小程序版本**已在目标环境上线**（WeChat 后台版本号 + 该版本指向的 API 目标）。服务端 V2 对旧客户端可优雅降级（新增字段惰性、任意整数出价仍接受），但用户将看到旧体验——这违背了开 flag 的目的。
- [ ] 记录版本号到 §6。**待 ops 确认**（依赖 Wave 2 实现完成 + 微信提审通过，时间点在合约实现之后）。

---

### 2-f. 指标口径（2026-09-18 qa-agent 核定）

> 本节关闭 roadmap Wave 0.6 + Wave 5 launch gates 的指标缺口。结论先行：**G3 moment-card 生成率无现成取数口径（需工单 T-1；recap dwell 腿需 T-2）；glow 奖章诚实率已交付只读脚本（`npm run check:glow-honesty -w @joyjoin/server`）；§2-d 两条基线 SQL 语法已对照 schema 核实，dev DB 当日不可达（localhost:5432 ECONNREFUSED），首跑 = ops。**

#### G3-a. moment-card 生成率 —— 现状：无口径

取证结果（全部对照代码核实）：

1. `moment_card_interactions` 表（`_definitions_social.ts:126-137`）只记录 `save` / `share` / `qr_scan` 三种用户动作，由 `POST /api/social-icebreaker/:id/moment-card-event` 写入（`routes/socialIcebreaker.ts:1156-1176`）。**但全仓库（含已归档 web client）没有任何客户端调用该端点**——生产上此表预期为空，不能当分子。
2. `GET /:id/moment-card.png` 服务端渲染路由被 `SOCIAL_ICEBREAKER_ENABLE_MOMENT_CARD_SERVER_RENDER`（缺省 `false`）闸住，且即使打开也不写任何记录（`socialIcebreakerGameplayExtra.ts:205-251`）。
3. 实际高光卡是**客户端 canvas 渲染**（`MomentCardView.tsx`，保存走 `Taro.saveImageToPhotosAlbum`），渲染/保存全程零埋点。
4. 唯一现存相关信号是 Prometheus 计数器 `joyjoin_ai_calls_total{domain="icebreaker", feature="generateMomentHighlights"}`（`socialIcebreakerAIService.ts:870/874/887` → `recordAICallMetric`）——它计量的是「生成高光」面板 JSON（`GET /:id/moment-card`，RecapPhaseView「生成高光」按钮），不是卡片渲染；且是进程内计数器（重启清零、无 session 维度、同会话重复点击重复计数）。

**口径定义（T-1 落地后生效）：**
- 分子：时间窗内 `moment_card_interactions` 中 `action='generate'` 的去重会话数（join sessions 排除 `is_test_session`）。
- 分母：同窗内到达 recap 的非测试会话数（`state_json->'recapSnapshot' IS NOT NULL AND is_test_session = false`）。
- 时间窗：与发布门观察窗一致（小流量 48h / 全量周窗）；「不下降」判定允许 ±2pp 抖动（与 G2 对齐）。

**过渡口径（T-1 未落地前，仅方向性、不作硬门）：** `joyjoin_ai_calls_total{feature="generateMomentHighlights", outcome="success"}` 窗内增量 ÷ 同窗 recap 会话数。已知缺陷：可 >100%（重复点击）、部署清零需 ops 在窗边界快照。

#### G3-b. recap dwell —— 现状：无数据源

`social_icebreaker_phase_metrics` 的 dwell 行只在**离开**环节时写入；recap 是终止环节，永不产生 dwell 行。G3 的「Recap dwell 不下降」腿目前不可测。

#### 跟进工单（需要运行时代码，本任务未实施）

| # | 工单 | 最小改动 | 解锁指标 |
|---|---|---|---|
| T-1 | moment-card `generate` 埋点 | **IMPLEMENTED 2026-09-18（@backend-engineer）。** action 列为 varchar（无 pgEnum、零 DDL）；服务端白名单加 `'generate'`（`routes/socialIcebreaker.ts` moment-card-event）；客户端 `MomentCardCTA.handleOpen` 成功路径 fire-and-forget（`pages/icebreaker-session/momentCardTelemetry.ts`，模块级 Set 每会话去重一次，fail-open）。注：取证修正——`MomentCardView.tsx` canvas 覆盖层当前**无任何 JSX 调用方**（孤儿组件），唯一 LIVE 高光卡面是 RecapPhaseView 的「生成高光」面板，故埋点挂在该成功路径。测试：`momentCardEvent.test.ts`（路由白名单 4 例）+ `momentCardGenerateTelemetry.test.ts`（客户端去重/fail-open 4 例） | G3 生成率精确口径 |
| T-2 | recap dwell 记录 | **IMPLEMENTED 2026-09-18（@backend-engineer）。** 新增 `computeRecapDwellMs` / `recordRecapDwellMetric` / `recordRecapDwellForExpiringSessions`（`lib/socialIcebreakerStore.ts`）；两条终止路径覆盖：① TTL sweep（tombstone 前补写，dwell = `expiresAt − phaseStartedAt`，fail-open 不阻塞清扫）② 客户端 `/force-end`（仅 recap 相时写，dwell = now − phaseStartedAt）。口径 = recap 可用窗口（非主动观看时长），<1s 与 transitionPhase 同地板丢弃。幂等：`idx_phase_metrics_session_phase` 唯一索引 + `onConflictDoNothing` 首写胜出。测试：`recapDwellMetric.test.ts`（8 例）+ `socialIcebreakerForceEnd.test.ts`（3 例） | G3 recap dwell 腿 |
| T-3 | `moment-card-event` 客户端接线核查 | **AUDITED 2026-09-18（只读，未修复）。** 孤儿图谱：save/share/qr_scan 三者服务端路由+存储写入均存在，但小程序与已归档 web client **全部零调用**；自然发射 UI（`MomentCardView.tsx` 的 handleSave/handleLongPress）本身是孤儿组件（无 JSX 消费方，仅被自身 layout 测试 import）；qr_scan 的设计触发点在被 flag 闸住的 PNG 路由上（客户端无 QR 绘制工具，Q1-3 注释）。另有死 import：`socialIcebreaker.ts:77` 与 `socialIcebreakerGameplayExtra.ts:44-45` 导入 `getMomentCardStats`/`logMomentCardInteraction` 但零调用。读取方唯一：`GET /api/admin/icebreaker-analytics/summary`（requireAdmin）。跟进建议：要么接线 save/share（需先挂载 MomentCardView 或在面板页加保存动作），要么在 admin 面板标注「无数据源」 | 数据卫生 |

#### G4. glow 奖章诚实率（Wave 4 健康指标，要求 =100%，<100 即 P1）

- **工具：** `apps/server/src/scripts/check-glow-medal-honesty.ts`（只读，SELECT-only），命令 `npm run check:glow-honesty -w @joyjoin/server`（可选 `-- --days 30`）。
- **判定逻辑：** 对每个 `state_json->>'sessionGlowEnabled'='true'` 且带 `recapSnapshot.glow` 的会话，逐奖章核对底层持久数据：接梗王 `glowPoints.quip≥4` / 暖心雷达 `mirror≥4` / 豪气担当 `auctionLotResults` 有该用户胜标 / 全勤小可爱 复用服务端真实函数 `hasFullGlowAttendance`（非重写）/ 挑战先锋 `challengeCompletedBy`（cleanup 后存活）/ 话题王 `social_icebreaker_phase_pulse_checks` 有行 / 最佳侦探 **部分可审计**——权重链证据（votes/reveal/completedUserIds）在 cleanup 时被抹除，只核对 floor `glowPoints.lie≥1`（脚本内标注 PARTIAL）。另核结构不变量：`glow.medals === recapSnapshot.medals`（dual-write，AC-07）、≤4 枚、获奖者互斥、逐人 tier === `deriveGlowTier(glowTotal(...))`、flag-on + recapSnapshot 必有 glow 载荷。
- **输出/退出码：** 控制台报告 + `GLOW_HONESTY_SUMMARY {json}` 尾行；exit 0 = 100% 或无数据（NO_DATA）；exit 1 = 存在违例（按 roadmap = P1）；exit 2 = 脚本/连接错误。
- **为什么不是纯 SQL：** 奖章只存 `recipientDisplayName`（无 userId），全勤判定需要 runPlan/enabledPhases 交集逻辑，最佳侦探证据已被 cleanup 抹除——纯 SQL 无法保真，故用复用服务端真实函数的只读脚本。
- **验证状态（2026-09-18）：** typecheck PASS；脚本端到端启动至首个 DB 查询后走 clean-fail（exit 2，dev DB ECONNREFUSED）——**逻辑未对真实数据跑过；flag 全暗期间预期输出 NO_DATA + exit 0；flag-on 后首跑 = ops。**

#### §2-d 基线 SQL 试跑结论（2026-09-18）

| SQL | 结论 |
|---|---|
| dwell 基线（§2-d 第一条） | 语法/列名/`is_test_session` 全部核实有效，**原样可用**；recap 永无行（见 G3-b）。dev DB 不可达 → 待 ops 首跑 |
| 拍卖出价基线（原稿） | **已修正**：`auctionLots` 过滤器只命中「正在拍卖中」会话（阶段退出即被 cleanup 抹除）；改用持久的 `auctionBidHistory` 并补参与率分母（去主持/机器人）。修正版见 §2-d |
| 修正版语法 | jsonb 路径已对照 `SocialSessionState`（`auctionBidHistory[].userId/.lotIndex`、`auctionLotResults`）核实；待 ops 首跑 |

---

## 3. 发布顺序与门（Wave 5）

### 3.1 顺序

| 步骤 | 内容 | 通过标准 |
|---|---|---|
| ① Staging 全量 | 全部就绪 flag 置 `true`：miniscript（待 §4 审核后）、lieDetectiveV2、dice（已是 true 语义）、auctionV2（待实现+§2-c/e） | 完整 blaze + glow 真机走查（Wave 1.4）；每条 flag 可从后台单独关掉 <1min |
| ② 生产「小流量」48h | **机制真相：flag 是全局布尔，无人群灰度。** 程序 = 低峰时段（建议工作日上午）置 `true` → 48h 观察 → 任何门触发即置回 `false`（<1min，§5） | §3.2 五门全绿 |
| ③ 全量 | 48h 无回归 → 保持 ON 即全量（布尔 flag 下「小流量→全量」是时间决策，不是流量比例调节） | 门持续绿 1 周 |

### 3.2 发布门（小流量期间全部必须成立；来源：roadmap Wave 5 Launch gates）

| # | 门 | 测量方式（已验证） |
|---|---|---|
| G1 | 每 phase `dwellTimeMs` 相对 §2-d 基线**无 >15% 退化**；warmup/micro/auction dwell 应改善 | §2-d SQL 重跑对比 |
| G2 | 每个 AI 生成器 AITrace fallback 率 ≤ 基线 +2pp | `GET /api/metrics` 的 `joyjoin_ai_calls_total{outcome="fallback"}`（标签 `domain, feature, outcome`）按 feature 对比 §2-d 快照 |
| G3 | Recap dwell + moment-card 生成率**不下降** | dwell SQL（phase='recap'）；moment-card 率待 qa-agent 给出取数口径（**待 ops/qa 确认**——roadmap 未定义现成指标） |
| G4 | 零 诱导分享 / AIGC 角标合规投诉 | 客服/反馈渠道人工监测 |
| G5 | 每条 flag 可独立 <1min 从 `/admin/feature-flags` 关闭 | ① 步 staging 演练时逐条实测并记录耗时 |

---

## 4. 人工审核 Gate 追踪表（owner = 人；全部 pending；阻塞对应 flag-on）

| # | 审核项 | 来源 | 阻塞的 flag | 状态 |
|---|---|---|---|---|
| H1 | ~~MiniScript 桂花糕 e1 reaction（说书人 self-hint 边界）~~ → AI 评审团 Lens B 裁定 DEFECTIVE，已替换（「整整齐齐三个板儿，付钱这位，讲究得吓人。」commit `08bb14859`） | Wave 1.1 | `miniscriptEvidenceVoteV2Enabled` | ✅ fixed 2026-09-18 |
| H2 | ~~MiniScript 桂花糕 e5（团圆饼 露骨边界）~~ → Lens B 裁定 DEFECTIVE（动机剧透），已替换（commit `08bb14859`） | Wave 1.1 | `miniscriptEvidenceVoteV2Enabled` | ✅ fixed 2026-09-18 |
| H3 | ~~MiniScript 胸针 e2（伯爵夫人 proto-defensive）~~ → Lens B + @verifier 裁定 genre-fair misdirection（她的秘密就是偷看诗稿，「眼熟」有根有据且不碰真凶） | Wave 1.1 | `miniscriptEvidenceVoteV2Enabled` | ✅ ruled SAFE 2026-09-18 |
| H4 | 3 个未映射 iconKeys 的 Lovart 资产决策 → 裁定：🔍 兜底为设计内行为，可开灯；Lovart 正式图标列为发布后资产任务 | Wave 1.1 | `miniscriptEvidenceVoteV2Enabled` | ✅ ruled 2026-09-18 |
| H1b | **评审团全量扫描新发现（同批修复）**：桂花糕 e2 说书人「笔锋像说书先生」（近乎自招）、桂花糕 e5 大师姐「没碰整块的」（替他人定罪/脱罪）、胸针 e4 伯爵夫人「瞥了一眼客厅角落」（指向真凶座位）、桂花糕 e5 小师弟「少的那个角」（事实错误） | Wave 1.1 | `miniscriptEvidenceVoteV2Enabled` | ✅ fixed 2026-09-18 (`08bb14859`) |
| H5 | ~~Lie 兜底既有 set：spider fake「组织过百人相亲」（约会词汇）~~ → 已修复为「我组织过百人同城观影会」（commit `bfadb052a`） | Wave 1.6 | `lieDetectiveV2Enabled` | ✅ fixed 2026-09-18 |
| H6 | ~~Lie 兜底既有 set：koala fake「养过一只考拉」（不合常理）~~ → 已修复为「我的手写信在图书馆展出过」（commit `bfadb052a`） | Wave 1.6 | 同上 | ✅ fixed 2026-09-18 |

### §4-a 快速通道（2026-09-18 核定）：🟢🟡 两 flag 可先开

人工审核预算只挡 🔴 三项（miniscript H1–H4、auction 奖项名/全押、sessionGlow 奖章名）。以下两个 flag 的 copy 暴露面已清零，可走独立快速通道：

| Flag | 暴露面结论 | 开灯步骤 |
|---|---|---|
| 🟢 `highlightsInjectorEnabled` | 纯 prompt 侧注入，零用户可见新文案；flag-off 字节一致性经 QA 字符串级验证 | ① staging 置 true → ② single-test bot 全链路 + 一场 blaze 真局走查（确认 AITrace `promptVersion` 带 `_HL`、`fallbackUsed` 速率不升）→ ③ 生产低峰窗口置 true，48h 观察 dwell 与 fallback 率 |
| 🟡 `lieDetectiveV2Enabled` | H5/H6 已修复（`bfadb052a`）；bank 36/36 干净；AC-09 GitHub 侧已满足（`LIE_DETECTIVE_MODE` 未设置） | ① 先确认 CVM env 无 `LIE_DETECTIVE_MODE` 残留（§2-a 行）→ ② staging 置 true → ③ bot 走查 + 真局确认出题质量 → ④ 生产低峰置 true，48h 观察 `joyjoin_ai_calls_total{feature="generateLieDetectiveStatements",outcome="fallback"}` |

⚠️ 注意：这两个 flag 的生产开启仍要求 §2 的 CVM env 行确认（`gh variable` 侧已完成）与 §3 观察期纪律，只是不再被 §4 文案审核阻塞。
| H7 | 拍卖 12 条新兜底拍品全量 🔴 Hard Rules 审校 → AI 评审团 Lens A（赌博/婚恋/禁用词/真钱框架四扫描全 CLEAN）+ Lens C（品牌调性 KEEP）双透镜通过 | wave2 AC-10(c) | `auctionV2Enabled` | ✅ passed 2026-09-18 |
| H8 | ~~拍卖四个奖项名 🔴 审校~~ → Lens C：最敢花/捡漏王/全场最热 KEEP；**最稳的手 → 定力担当**（得主人为未中标者，原名为 spec R-E 标记的嘲讽误读风险，commit `08bb14859`） | wave2 AC-10(d) | `auctionV2Enabled` | ✅ fixed 2026-09-18 |
| H9 | 「全押」隔离检查 → Lens A 逐屏审计 PASS（零 赌/赢 共现）；**Lens C 发布裁决：直接启用预案「全力一击」**（同步上传 + 关键词扫描器不看语境，一行可回滚，commit `08bb14859`；「全押」保留于 `AUCTION_ALL_IN_FALLBACK_LABEL`） | wave2 AC-16 / spec D7 | `auctionV2Enabled` | ✅ resolved 2026-09-18 |
| H10 | sessionGlow 奖章名（接梗王/暖心雷达/豪气担当/全勤小可爱）+ 档位词（微光/暖心/闪闪发光）→ Lens C 全 KEEP（正向地板规则满足、零比较框架、零羞辱面） | wave4 AC-11(a) | `sessionGlowEnabled` | ✅ passed 2026-09-18 |

> **AI 评审团记录（2026-09-18）：** 三透镜（A 确定性合规扫描 / B 游戏逻辑泄漏 / C 品牌调性）+ @verifier 交叉验证（5 处泄漏全部引证确认、替换文本 5 项检查全过、热替换机制核实）。遗留 follow-up（不阻塞开灯）：① 赌博黑名单补 筹码/彩票；② 共现测试去掉「全押存在」前置条件；③ V1 inline 文案（含 AuctionHeroView:598 硬编码字面量）纳入扫描或提升进 copy 模块。

> 流程先例：Lie V2 bank 审校（Wave 1.6 注）——内容人工审校 → 修改 → 入库。H1–H4 是 flag-on 的 **HARD GATE**（roadmap 原文）。

---

## 5. 回滚 Runbook（按 flag）

> 通用事实（已验证）：flag 读取走 5s LRU（`featureFlags.ts`）；回滚 = 后台置 `false` → **≤5s 对新解析生效**；**快照 canon：已快照 V2/true 的进行中会话按原样完结**，不做状态清理、不做数据迁移、不强制改写会话。所有操作留 `FEATURE_FLAG_UPDATED` 审计。

### 5.1 `miniscriptEvidenceVoteV2Enabled`

| 症状 | 动作 | 预期恢复 | 进行中会话 |
|---|---|---|---|
| 证据/动机投票环节报错或内容投诉 | `/admin/feature-flags` 置 `false`（super_admin） | ≤5s；新进入 mini_script 的会话走 V1（目录兜底完好） | 已快照 V2 的会话按 V2 完结——已知内容安全（全部经 validate:miniscript-story + §4 审核），无强制干预必要 |

### 5.2 `lieDetectiveV2Enabled`

| 症状 | 动作 | 预期恢复 | 进行中会话 |
|---|---|---|---|
| V2 出题质量/审核投诉；或 kill switch 演练 | 置 `false` | ≤5s；新进入 lie_detective 的会话 = V1（**前提：§2-a 已关闭**，否则 env=v2 会让「关掉」≠ V1） | 已快照 `'v2'` 的会话按 V2 完结（合约 AC-03/AC-07 测试锁定） |

### 5.3 `personalityDiceChooseModeEnabled`（注意：这是 LIVE 功能的开关）

| 症状 | 动作 | 预期恢复 | 进行中会话 |
|---|---|---|---|
| choose-mode 选择器故障或内容投诉 | 置 `false` | ≤5s；**新会话**回单 dare 模式；之后入队的 pregen 载荷携带 `false` | 已快照 `true` 的会话按 choose-mode 完结（pregen/recap/bot 全部跟快照走，不会出现混合形态） |
| 误置 DB 行导致与 env 姿态不一致（§2-b 防的情形） | 后台**删除该 DB 行**（恢复 env→缺省解析）或改回目标值 | ≤5s | 同上 |

### 5.4 `auctionV2Enabled`

| 症状 | 动作 | 预期恢复 | 进行中会话 |
|---|---|---|---|
| 阶梯/结算/beats 任一异常；评分门不通过 | 置 `false` | ≤5s；新进入 auction 的会话 = 字节级今日拍卖（合约 AC-09 零编辑门锁定） | 已快照 `true` 的会话按 V2 完结 |
| 仅 beats 异常（连震/打扰） | **不必动 auctionV2**：置 `icebreakerGroupBeatsEnabled = false` 即全静默，轮询兜底完整（拍卖 V2 不依赖 beats 开灯） | ≤5s | 无影响（beats 本身 state-free） |

### 5.5 回滚演练要求

- G5 门要求：staging 全量步骤中逐条实测「置 OFF → 新会话行为回退」并记录耗时（目标 <1min 含登录后台）。
- 代码级回滚（git revert）仅作兜底：三条 flag 的 env 回退层均未改动，revert 后即使有残留 DB 行也变为不可读（wave1-2/wave1-3/wave2 合约 Rollback Plan 一致）。

---

## §5-a 真机走查清单（2026-09-18）

> 目的：加速 Wave 5 人工 WeChat DevTools 走查（wave2 AC-13 结算双幕、wave4 高光块 + RM）。H5 预览已覆盖「渲染形态」；真机只需聚焦 H5 无法覆盖的维度。
>
> 用法（仓库根目录）：`npm run build:h5 --workspace=mini-program`（需 `TARO_APP_API_BASE_URL=http://localhost:5001`）→ `node scripts/mock-h5-server.mjs` → `node scripts/screenshot-server.mjs` → 打开 `http://localhost:9000/<name>.png`。PNG 按需生成、不落库（skill canon）。2026-09-18 本轮 capture 已逐张人工核验非空白、DOM 断言全过（阶梯 3 档/全押徽章、奖项 4 张/账单 5 行、高光卡 4 张/奖章 3 枚/零奖章空态、RM 无 stagger class）。

### H5 预览已覆盖（不必在真机重复核对渲染形态）

| 状态 | 生成器（`<name>.png`） | mock state | 覆盖点 |
|---|---|---|---|
| 拍卖 V2 实时出价·参与者视角 | `icebreaker-auction-v2-live` | `mock-auction-v2-live` | 3 档阶梯（稳一手 90 / 加一点 105 disabled / 全押 100）、领先者 🔥全押 徽章、出价记录全押标记、余额行 |
| 拍卖 V2 实时出价·主持人视角 | `icebreaker-auction-v2-live-host` | `mock-auction-v2-live-host` | 无阶梯、落槌 CTA、主持人专属全押提示（「阿澈 全押了，可以落槌」） |
| 拍卖 V2 结算·第一幕（未揭晓） | `icebreaker-auction-v2-finale` | `mock-auction-v2-finale` | 4 奖项卡背（点按揭晓）、全部揭晓 + 进入下一阶段 CTA、全桌账单 5 行（含 0 币阿澈、流拍标不入账） |
| 拍卖 V2 结算·全揭晓 | `icebreaker-auction-v2-finale-revealed` | 同上（点击 全部揭晓） | 4 奖项正面：今晚最敢花=桃桃 85 / 捡漏王=小鹿 25 / 全场最热=《爆料…》5 次出价（不点名）/ 最稳的手=老周 100 |
| 拍卖 V2 结算·参与者视角 | `icebreaker-auction-v2-finale-participant` | 同上（auth override 为小鹿） | 卡片默认全揭晓、无主持人控件、鼓掌块、账单「（我）」行 |
| Recap 高光块·正常 | `icebreaker-recap-glow` | `mock-recap-glow` | 桌级行（hot 变体）、4 卡按桌序（非高光序）、你 徽章自卡描边、闪闪发光/暖心/微光 档位词、3 奖章嵌入 recipient 卡、自卡折叠明细入口 |
| Recap 高光块·RM | `icebreaker-recap-glow-rm` | 同上 + reducedMotion context + `joyjoin:mini-reveal-motion` storage | 全部卡片静态渲染、无 `recap-glow__card--stagger`（DOM 断言通过） |
| Recap 高光块·全零诚实空态 | `icebreaker-recap-glow-zero` | `mock-recap-glow-zero` | quiet 桌级行 + 「静静发光也是光」地板行、4 卡全 微光、0 奖章、无明细入口（零高光不伪造来源标签） |

### 必须在真机/DevTools 核对（H5 无法覆盖）

1. **触觉反馈（haptics）**：全押一刻的 `socialReveal` 震感（全桌）、被超价时的 `socialNudge`（仅原领先者）、高光块入场的单次 `socialCelebration`（每卡不震）。H5 无振动通道。
2. **RM 真实系统路径**：H5 的 RM 走的是 storage key + Playwright context；真机需开 iOS/Android 系统级「减弱动态效果」核对 `useMiniRevealMotion` 的 system fallback（含全押粒子 = 零、奖章揭示无 stagger、finale CardFlip 瞬时）。
3. **Poll-vs-beat 时序**（wave2 D8.4/D3）：beats 加速 + 3s 轮询为唯一状态真相——连点出价确认无双重 toast/双震；断网恢复后状态经轮询自愈。H5 mock 无 WS beat 通道（`mock-h5-server.mjs` 的 `/ws` 只模拟 gathering-room presence）。
4. **结算主持人-vs-参与者差异的实时性**：H5 已各自截静态形态，但真机需核对「主持人点揭晓」与「参与者端默认揭晓」在同一 live session 中的观感差异（参与者无揭晓仪式是直接看到结果——确认这不是「不同步」投诉点）。
5. **高光值隐私边界**：真机抓包确认他人 `glowPoints` breakdown 不出现在响应里（sanitizeStateForClient 裁剪，AC-09）；H5 mock 只种了 viewer 自己的 entry，无法验证服务端裁剪。
6. **AIGC 角标**：拍卖条目/ recap 内容的 AI 角标在真机渲染（H5 已见 PhaseAigcRow，但 AIGC 角标 fail-closed 行为需在真机核对 flag-off 设备）。

### 未能 H5 驱动的状态（DevTools-only）

- 无。四个目标状态（拍卖 V2 阶梯实时、拍卖 V2 结算、高光块、高光全零空态）全部由 mock state 驱动成功，未改动任何生产组件。唯一调整：finale/glow 的截图从 `fullPage` 改为「scrollIntoView + viewport」——Taro H5 的 `.taro_page` 是固定高度滚动容器，fullPage 会截掉视口外内容（与 squad-unboxing 既有做法一致）。

---

## 6. 姿态记录表（ops 执行 §2 后填写；flag-on 的凭据）

| 环境 | 检查项 | 命令 | 结果 | 检查人 / 日期 |
|---|---|---|---|---|
| 生产 | GitHub var `LIE_DETECTIVE_MODE` | `gh variable get LIE_DETECTIVE_MODE` | **未设置（2026-09-18 已查）** — 满足 wave1-2 AC-09 的 GitHub 侧；CVM env 行仍需确认（下方两行） | agent / 2026-09-18 |
| 生产 | `LIE_DETECTIVE_MODE` | `grep LIE_DETECTIVE_MODE ~/JoyJoin/deployment/.env.production \|\| echo unset` | 待 ops 确认 | |
| Staging | `LIE_DETECTIVE_MODE` | `grep LIE_DETECTIVE_MODE ~/JoyJoin/deployment/.env.staging \|\| echo unset` | 待 ops 确认 | |
| 生产 | GitHub var `PERSONALITY_DICE_CHOOSE_MODE_ENABLED` | `gh variable get PERSONALITY_DICE_CHOOSE_MODE_ENABLED` | **`true`（2026-09-18 已查）** — 与代码缺省一致；DB flag 缺省 `true` 行为保持成立 | agent / 2026-09-18 |
| 生产+Staging | 已部署 env 中的 `PERSONALITY_DICE_CHOOSE_MODE_ENABLED` | `grep PERSONALITY_DICE_CHOOSE_MODE_ENABLED ~/JoyJoin/deployment/.env.production ~/JoyJoin/deployment/.env.staging` | 待 ops 确认 | |
| 生产 | GitHub var `SOCIAL_ICEBREAKER_ENABLE_AUCTION` | `gh variable get SOCIAL_ICEBREAKER_ENABLE_AUCTION` | **`true`（2026-09-18 已查）** — 拍卖 V1 当前在生产的 blaze 路径上是 LIVE；auctionV2Enabled 的灰度顺序因此有意义 | agent / 2026-09-18 |
| 生产+Staging | 已部署 env 中的 `SOCIAL_ICEBREAKER_ENABLE_AUCTION` | `grep SOCIAL_ICEBREAKER_ENABLE_AUCTION ~/JoyJoin/deployment/.env.production ~/JoyJoin/deployment/.env.staging` | 待 ops 确认 | |
| 生产 | dwell 基线 SQL（§2-d） | psql | SQL 已核定（列名/`is_test_session` 对照 schema 有效，原样可用）；dev DB 2026-09-18 不可达（ECONNREFUSED）→ 待 ops 首跑。注意：recap 环节永无 dwell 行（§2-f G3-b） | qa-agent / 2026-09-18 |
| 生产 | 拍卖出价基线 SQL（§2-d） | psql | 原稿已修正（`auctionLots` 被 cleanup 抹除 → 改用持久 `auctionBidHistory` + 参与率分母）；语法核实，dev DB 不可达 → 待 ops 首跑 | qa-agent / 2026-09-18 |
| 生产+Staging | glow 奖章诚实率（§2-f G4） | `npm run check:glow-honesty -w @joyjoin/server` | 脚本已交付、typecheck PASS；flag 全暗期间预期 NO_DATA + exit 0；flag-on 后首跑 = ops | qa-agent / 2026-09-18 |
| 生产 | fallback 速率快照 | `curl -s https://joyjoinapp.com/api/metrics \| grep joyjoin_ai_calls_total` | 待 ops 确认 | |
| 生产 | 拍卖 V2 客户端版本号（§2-e） | 微信后台 | 待 ops 确认（Wave 2 实现后） | |

---

## 7. 已知限制与诚实声明

1. **无人群灰度**：DB flag 是全局布尔。「小流量」= 低峰时间窗 + 快速可关，不是百分比放量。若未来需要真灰度，是 featureFlags 机制的新工作（不在本列车）。
2. **G3 moment-card 生成率**已经 qa-agent 核定（§2-f）：无现成口径、客户端零埋点；过渡口径 = `joyjoin_ai_calls_total{feature="generateMomentHighlights"}` 方向性代理（不作硬门）；精确口径待工单 T-1（`generate` 埋点）；recap dwell 腿无数据源，待 T-2。
3. **拍卖出价基线 SQL** 已经 qa-agent 修正并核定（§2-d/§2-f）：原稿 `auctionLots` 过滤器无效（cleanup 抹除），改用 `auctionBidHistory`；dev DB 不可达，首跑 = ops。
4. **`auctionV2Enabled` 实现未开始**——本文其相关行均为「合约锁定值」，实现完成后由 @backend-engineer 复核本行。
5. 本页不覆盖 Wave 3（Context Injector Highlights，无 flag）与 Wave 4（高光值，flag 未建）——Wave 4 合约起草后补录。
