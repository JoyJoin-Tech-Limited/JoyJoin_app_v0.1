# E9 UGC 内容安全专项 · 实施前测绘简报

> 测绘日期：2026-10-20 · 只读测绘（零代码改动）· 测绘人：researcher subagent
> 触发文档：`docs/deliberations/2026-10-20-icebreaker-polish-review-and-commercial-memo.md` §8 E9 行

## 〇、头条结论（与立项备忘的重要出入）

**E9 备忘的「UGC 无过滤」表述已过时。** 代码实证：破冰会话内**全部 7 个自由文本输入面均已接入** `validateContentSafeAsync`（Tier-0 敏感词 + Tier-1 微信 msgSecCheck 双层管线），且各路由持有自己的 `recordViolation` 升级调用。真实缺口是：

1. **UGC 无举报路径** —— 会话内只有 AIGC 举报入口（`PhaseAigcRow`/`WarmupCardSlot`），没有任何针对**玩家内容**的举报 UI；
2. 一处低危未过滤入口（host-only 的 `avoidTopics`，进 LLM prompt、不直接展示）；
3. 过滤覆盖缺测试锁（quip/group-mirror/miniscript-vote 三面已过过滤但未被 `contentSafetyIcebreakerSurfaces.test.ts` 具名锁定）。

因此 E9 的实际工作量从「建过滤 + 建举报」收缩为「**建 UGC 举报闭环 + 补测试锁 + 堵 avoidTopics**」，规模由 M 下修为 **S–M，零新表**。

---

## 表一：破冰会话 UGC 输入面全清单（含过滤现状 / 展示范围 / 持久化）

过滤字段名后括注 gating 位置。「state_json」指 `social_icebreaker_sessions.state_json`（`packages/shared/src/schema/_definitions_social.ts:26`），经 3s 轮询 `buildClientState` 广播给全体参与者；会话 6h TTL 清除，phase 切换时 `cleanupPhaseStateForNextPhase` 清理对应字段。

| # | Phase / 输入 | 客户端输入点 | 服务端接收路由 | 过滤现状 | 展示范围 | 持久化 |
|---|---|---|---|---|---|---|
| 1 | quip_battle 填空答案 | `apps/mini-program/src/pages/icebreaker-session/phases/QuipBattleHeroView.tsx:378`（`Input`，`handleAnswerChange`） | `POST /:id/quip-battle/submit` — `apps/server/src/routes/socialIcebreakerGameplayCore.ts:1062`；单条 ≤100 字 | ✅ `answerText` 双路径 gating（乐观 :1106 / 直写 :1143）+ `recordViolation` | **全桌**（投票列表+揭晓）；**获胜答案进 `state.highlights`** → 回顾页高光面板（`RecapPhaseView.tsx:119`）+ 回顾 LLM prompt（`sessionHighlights.ts:93`，`sanitizeHighlightText` 防注入） | state_json `quipBattleAnswers`；phase 退出清理（`socialIcebreakerPhaseConfig.ts:270`） |
| 2 | undercover_word 描述 | `UndercoverWordHeroView.tsx:507`（`Input`，客户端截 100 字） | `POST /:id/undercover-word/describe` — `socialIcebreakerGameplayExtra.ts:407` | ✅ `undercoverDescribe` gating（:417） | **全桌**（描述列表带 displayName，`UndercoverWordHeroView.tsx:487-489`） | state_json `undercoverWordRounds[].descriptions`；phase 退出清理（`phaseConfig.ts:254-266`） |
| 3 | lie_detective V1 三句手写陈述 | `LieDetectiveHeroView.tsx:392`（`Textarea`，`updateCustomStatement`） | `POST /:id/lie-detective/generate`（`customStatementTexts`）— `socialIcebreakerExtended.ts:754` | ✅ 逐句 `lieDetectiveStatement` gating（:818） | **全桌**（轮到该玩家时三句公开；`isLie` 服务端保密） | state_json `lieDetectivePlayers[].statements`（已剥 isLie）；isLie → `social_icebreaker_lie_truths` 表 |
| 4 | lie_detective V2 两个标签 | `LieDetectiveHeroView.tsx:403`（`Input`，`updateAssistTag`） | `POST /:id/lie-detective/submit-tags` — `socialIcebreakerGameplayCore.ts:289`；`POST /:id/lie-detective/generate-from-tag` — `socialIcebreakerExtended.ts:1557` | ✅ 路由级 `lieDetectiveTag` gating（:320）；AI 服务层二次防线 `validateContentSafe`（`socialIcebreakerAIService.ts:164/180`），生成文本出厂再验（:217） | 标签本身不直接展示；AI 扩写成的陈述**全桌**可见 | state_json `lieDetectiveV2Tags` |
| 5 | group_mirror 理由（可选） | 客户端**当前无自由文本输入框**（`GroupMirrorHeroView.tsx` 未引入 `Input/Textarea`；`reasonText` 仅为 API 可选字段，见 :23 类型） | `POST /:id/group-mirror/submit` — `socialIcebreakerGameplayExtra.ts:765`；单条 ≤100 字 | ✅ `reason` 双路径 gating（:805/:845） | **全桌揭晓**（`buildGroupMirrorAnswerRows`，揭晓视图 :238+） | state_json `groupMirrorAnswers`；phase 退出清理（`phaseConfig.ts:246`） |
| 6 | mini_script 投票附言 | `MiniScriptHeroView.tsx:1200`（`Input`，`setVoteReason` → `vote.why`，:544-553） | `POST /api/miniscript/vote` — `apps/server/src/routes/domains/miniscript.ts:1112` | ✅ `vote` 逐字段（who/what/why）gating（:1126） | 服务端 state 对**全桌可见**（`socialIcebreakerHelpers.ts:248` 注释明示 ballots visible）；客户端当前主要回显自己的理由（:315/:399） | state_json `miniScriptVotes` |
| 7 | 会话内 displayName | /start 入会时携带 | `POST /start` — `socialIcebreaker.ts:326` | ✅ `icebreakerDisplayName` gating（:339） | **全桌**（名册/点名/时刻卡 cast 名单） | `social_icebreaker_participants.displayName` + state_json |
| 8 | warmup `avoidTopics`（host-only，遗留 body 字段） | 客户端未见发送 UI | `POST /:id/topics` — `socialIcebreaker.ts:833` → prompt 拼接（`socialIcebreakerPrompts.ts:142`） | ❌ **未过滤**（唯一缺口；host-only、不直接展示、属 prompt 注入向量，低危） | 不直接展示 | 不持久化（仅当次 prompt） |

**已确认无自由文本、无 UGC 风险的路由**（逐代码核实）：`auction/bid`（zod `z.number().int().positive()`，`socialIcebreakerExtended.ts:1155`；客户端 `AuctionHeroView.tsx:748` 的 `bidText` 仅解析为数字）、`personality-dice/choose`（optionIndex 0-2）、`personality-dice/complete`（pass/ready 布尔）、`micro-challenge/complete`（无 body 文本）、`lie-detective/vote`（guessedStatementIndex）、`undercover-word/vote`、`quip-battle/vote`、`miniscript/present-evidence`（evidenceId+slot）、`miniscript/generate`（style/genres 枚举 + selectedLabel）、`miniscript/bonus/*`（枚举）、`ai-feedback`（rating，zod schema）、`speed-friending/*`。

**外溢面（UGC 流出会话边界）**：时刻卡 PNG（`momentCardPayload.ts:97-134`）的 quote 只取 AI 回顾/AI 话题/固定文案，**不渲染原始 quip 文本**；cast 渲染 displayName（已在 #7 过滤）。quip 金句经 `state.highlights` 进回顾 LLM prompt 后被改写为 AI 产出（归 AIGC 体系覆盖）。

---

## 表二：既有安全基建盘点

| # | 资产 | 位置 | 能力 / 覆盖内容类型 | 当前接入面 |
|---|---|---|---|---|
| 1 | Tier-0 敏感词过滤 | `apps/server/src/contentFilter.ts` | 6 类词表：political/pornographic/violent/illegal=severe，harassment/spam=warning；英文 leet/分隔符/重复字母/缺字母正则；`obfuscatedPattern` 反混淆；`contentFilterSimulation.test.ts` 1000×15 变体压测（MUST-CATCH 零漏检） | 被 #2 统一封装，不直接被路由调用（唯二例外：`socialIcebreakerAIService.ts`、`tagGenerationService` 模式） |
| 2 | 统一字段级内容闸门 | `apps/server/src/lib/contentSafety.ts` | `validateContentSafe` / `validateContentSafeAsync`（Tier-0 干净后才问 Tier-1；250ms 预算 fail-open；预算外判违规后台补记不重复计数）；`contentViolationResponse` 400 形态；每次命中写 `content_filter_logs`；决策表 6 行：severe 无条件阻断、warning 由 DB flag `contentModerationSevereFailClosedEnabled` 控制（默认 ON） | 破冰 7 面（表一）+ event-feedback + group-outcome freeText + attendance absentReason + chat-report 描述 + 订阅取消原因 + 举报描述 + profile bio/displayName + onboarding bio + admin 广播 |
| 3 | 微信 msgSecCheck（Tier-1） | `apps/server/src/lib/wechatMsgSecCheck.ts` | 语义级审核（谐音/拆字/上下文辱骂）；token 缓存+单飞刷新；3s 超时；label→ViolationType 映射；flag `contentModerationMsgSecCheckEnabled` 默认 ON | 随 #2 的 async 路径全部生效 |
| 4 | 违规升级阶梯 | `apps/server/src/abuseDetection.ts` | severe+2 / warning+1 计 `users.violationCount`；severe 单次→1h AI 冻结；≥3→24h 冻结；≥5→`isBanned`+permaban 并 `revokeUserSessions`（fail-open，per-request 门禁仍权威） | 所有 gating 路由自持 `recordViolation` 调用 |
| 5 | 过滤日志 + 复核队列 | `content_filter_logs` 表（`_definitions.ts:1620`，含 reviewStatus/missFlag）；`GET/PATCH /api/admin/content-filter/logs`；admin UI `/admin/content-filter` | 全量阻断记录（字段/类型/严重度/命中词/输入预览/tier0\|tier1）；operator+ 复核、误伤标 missFlag 回训词表；`CONTENT_FILTER_LOG_REVIEWED` 审计 | 全局 |
| 6 | 通用举报轨 | `reports` 表（`_definitions.ts:1582`）；`POST /api/reports`（`routes/domains/reports.ts:41`） | category 枚举：`ai_content`/`harassment`/`inappropriate_content`/`fake_profile`/`other`；description ≤2000 且过内容闸门；限流 5 次/5min；status 机 pending/reviewing/resolved/dismissed；`reportedUserId` 可挂被举报人 | 客户端仅 AIGC 举报在调；**admin 处置面已齐**：`/api/admin/moderation/reports`（`userEventPools.ts:2081`）+ `UserReportsTab`（含封禁/警告/驳回动作 + `moderationLogs`） |
| 7 | AI 内容举报轨 | `AI_CONTENT_REPORT_CATEGORY='ai_content'`（`packages/shared/src/api/aigc.ts:36`）；`GET/PATCH /api/admin/reports/ai-content` | 专属 admin 列表/幂等处置（`AiContentReportsTab`）；`AI_CONTENT_REPORT_REVIEWED` 审计 | 客户端 `AIContentReportButton`（`components/ai-content/AIContentReportButton.tsx` → `lib/api/ai-content/reportAIContent.ts` → `POST /api/reports`）已挂 9 处，破冰内 2 处：`PhaseAigcRow.tsx:20`、`WarmupCardSlot.tsx:661` |
| 8 | 聊天举报轨 | `chatReports` 表；`POST /api/chat-reports`（`matchingAdmin.ts:20`，描述过滤+限流）；`/api/admin/chat-reports` + `ChatReportsTab` | 群聊消息级举报-处置双轨（先驱模板：被举报消息上下文由 admin 路由联查 `chatMessages`，而非客户端回传） | 群聊（`/connections` 体系） |
| 9 | 封禁执行面 | `users.isBanned/violationCount/aiFrozenUntil`；`middleware/auth.ts` 每请求核查；`revokeUserSessions` 四路径（ban/permaban/delete/disable，`revokeUserSessionsContract.test.ts` 23 测试） | 封禁即失效 | 全局 |
| 10 | UGC 过滤先例（可抄模式） | event-feedback：`routes/domains/social.ts:474-488` | **多字段逐条 sync + 拼接后一次 async = 1 次微信调用**的成本最优模式；违规 400 + `recordViolation` 恰好一次 | E9 若新增字段直接套用 |

---

## 表三：缺口映射（UGC 面 × 基建）

| # | 缺口 | 实证 | 复用路径 | 规模 |
|---|---|---|---|---|
| G1 | **会话内 UGC 无举报入口**（核心缺口） | 破冰页面 grep 举报/report 仅命中 AIGC 组件与无关符号；`reports` 表 category/reportedUserId、admin `UserReportsTab` 处置面均已存在 | 客户端新增长按举报 → 服务端快照路由（§四-2）→ 落 `reports` 表 → 既有 admin 队列 | **S–M** |
| G2 | 过滤已全覆盖但**缺测试锁** | `contentSafetyIcebreakerSurfaces.test.ts` 文件头只具名 S5 undercover / S6 displayName / S8 submit-tags；quip(:1106/:1143)、group-mirror(:805/:845)、miniscript-vote(:1126)、V1 陈述(:818) 四面靠路由代码保障 | 扩展现有测试文件的具名覆盖（防未来重构回归） | XS |
| G3 | `avoidTopics` 未过滤 | `socialIcebreaker.ts:836-903` → `socialIcebreakerPrompts.ts:142` 直接拼 prompt | 路由加 `validateContentSafe`（sync 即可，host-only 不值得一次微信调用）或 zod 枚举化 | XS |
| G4 | **举报流自伤陷阱** | `POST /api/reports` 对 description 跑 `validateContentSafeAsync`（`reports.ts:55`）——若让举报人填写/引用冒犯原文，举报本身会被 400 拦下 | 冒犯原文**必须服务端快照拼接**（不过滤证据文本），客户端只传结构化引用 + 可选备注 | 设计约束，含在 G1 |
| G5 | **证据时效**：state_json 的 UGC 在 phase 切换即清、会话 6h 清除 | `phaseConfig.ts:270/246/254`；TTL sweep | 举报必须**即时取数**（用户长按当下快照）；已清理则降级存元数据（phase/作者/时间）并如实提示 | 含在 G1 |
| G6 | `reports.relatedEventId` FK 到 `events.id`，破冰会话不是 event | `_definitions.ts:1590` | 传 canonical event id（`resolveCanonicalEventId` 先例）或留空，上下文塞 description 前缀 | 含在 G1 |
| G7 | displayName 也可成为被举报内容 | #7 输入面 | 举报路由的 `contentRef` 需支持 `displayName` 类型（从 participants 表取快照） | 含在 G1 |
| G8 | 回顾期举报更早环节内容 → 原文已不在 state | 同 G5 | v1 接受降级：快照不到就记录可得元数据；不做 cross-phase 内容归档（那要新表，超 v1） | 风险登记 |

---

## 四、最小 v1 实施建议（S–M，零新表、零迁移）

**目标闭环：玩家能举报玩家内容 → 落入既有 admin 处置队列 → 处置动作（封禁/警告）走既有 moderationLogs + recordViolation 体系。**

### 1. 服务端（约 100–150 行 + 测试）

**新增轻量路由**（挂在 socialIcebreaker 路由族，例如 `socialIcebreakerGameplayExtra.ts` 或独立小文件）：

```
POST /api/social-icebreaker/:socialSessionId/report-content
body: { phase, targetUserId, contentRef: { kind: 'quipAnswer'|'undercoverDescription'|'lieStatement'|'groupMirrorReason'|'miniscriptVoteNote'|'displayName', promptId?/round?/index? }, note? }
```

行为：
- `requireAuth` + 参与者校验（举报人须为本会话参与者）+ 复用 `createRateLimiter` 模式（建议 3 次/会话/小时 或对齐 `report` 5 次/5min）；
- **服务端即时从 state/participants 快照冒犯原文**（G4/G5：不过滤证据文本；取不到则降级存元数据）；
- 用户备注 `note` 走 `validateContentSafeAsync`（与 `reports.ts` 同规）；
- 组装 `description = "[icebreaker:<phase>] <原文快照> — 备注:<note>"`（≤2000 字截断），写 `reports` 表：`category='inappropriate_content'`、`reportedUserId=targetUserId`、`relatedEventId` 传 canonical event id 或留空（G6）；
- **不新增 category、不改表结构、admin 零改动**——`UserReportsTab`（`/api/admin/moderation/reports`）即刻可见可处置。

### 2. 客户端（破冰会话内，视觉权重必须低）

- 在 quip 答案卡、卧底描述卡、侦探陈述卡（V1）、群像揭晓理由、miniscript 投票理由、名册/点名昵称上加**长按**（或「···」更多菜单）→ action sheet「举报这条内容」→ 确认 modal → 调新路由 → toast 反馈。**不复用 `AIContentReportButton`**：它的文案与确认流（「举报这段 AI 生成内容」）语义专属 AIGC，且直接 `POST /api/reports` 不带服务端快照能力（G4）。可抽其样式壳（`aigc-report-button` SCSS）做 UGC 变体，交互流自写（~1 个 hook + 各 view 挂载点）。
- 挂载点（表一已定位）：`QuipBattleHeroView.tsx` 投票/揭晓列表、`UndercoverWordHeroView.tsx:487` 描述列表、`LieDetectiveHeroView.tsx` 陈述卡、`GroupMirrorHeroView.tsx` 揭晓行、`MiniScriptHeroView.tsx` 投票区、名册条。
- 埋点：复用 discover analytics 白名单模式（`discoverAnalyticsAllowlistContract.test.ts` 先例）加 `ugc_report_submitted`。

### 3. 过滤补强与测试锁

- `avoidTopics` 路由加 `validateContentSafe`（G3，~5 行）；
- 扩展 `contentSafetyIcebreakerSurfaces.test.ts`：补 quip/group-mirror/miniscript-vote/V1 陈述四面具名用例（G2）；
- 新举报路由测试：快照正确性、已清理降级、限流、非参与者 403、admin 可见性冒烟。

### 4. 明确不做（v1 边界）

- 不做 cross-phase UGC 归档表（G8 接受降级）；
- 不做实时撤回/屏蔽他人内容（需 state 写入新语义，超 v1）；
- 不改 `AIContentReportButton` 既有 AIGC 流；
- 不引入新 admin 页面。

---

## 五、风险清单

| # | 风险 | 等级 | 缓解 |
|---|---|---|---|
| R1 | 举报原文快照含违规词进入 `reports.description` | 低 | admin-only 可见；证据必须原样，不可过过滤器（否则毁证据且触发 G4 自伤） |
| R2 | 恶意举报轰炸同桌玩家 | 中 | 路由限流 + 举报人须参与者 + `reportedUserId` 须同会话成员；admin 驳回零成本；反复恶意举报可走 `recordViolation`（harassment） |
| R3 | 回顾阶段举报更早 phase 内容 → 原文已清理 | 中 | G5/G8：即时快照；取不到降级存元数据并提示「内容已过期，已记录相关信息」 |
| R4 | 游戏氛围被举报入口污染 | 低 | E9 备忘已定调「长按举报」；不做常驻按钮；无 emoji、弱视觉 |
| R5 | 举报描述前缀格式被 admin 误读 | 低 | 前缀格式加单测锁定；`[icebreaker:<phase>]` 机器可解析 |
| R6 | Tier-1 fail-open 窗口期违规内容短暂可见 | 已接受 | 既有决策表第 6 行（后台补记）；非 E9 新增面 |
| R7 | displayName 举报与昵称变更竞态 | 低 | participants 表即时快照；admin 看到的是快照值 |
| R8 | 微信小程序合规口径 | 低 | 文本 UGC 已过 msgSecCheck（先审后发等效）+ 举报处置闭环后满足平台「内容安全机制」要求；repo 先例：event-feedback/chat-reports/profile 字段同构。`docs/runbooks/wechat-review-submission.md` 无 UGC 专项条款（grep 0 命中），v1 上线前可在该 runbook 补一段口径说明 |

---

## 附：测绘方法与证据边界

- 全部 file:line 于 2026-10-20 在当前工作区逐一打开核实（路由、客户端 view、schema、admin、测试）。
- 「展示范围」判定依据：字段是否存在于 state_json（3s 轮询对全桌广播）+ 客户端 view 的实际渲染点；miniscript 投票理由的「全桌可见」依据 `socialIcebreakerHelpers.ts:248-249` 注释（ballots visible on state），客户端当前只回显自己的理由。
- 未覆盖：E10（昵称 emoji/截断）属展示打磨而非内容安全，未展开；破冰外的 UGC 面（event-feedback、profile、chat）仅作先例引用。
