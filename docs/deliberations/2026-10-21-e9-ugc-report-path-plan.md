# E9 UGC 举报闭环 · Sprint 实施计划（v1）

> 起草：2026-10-21 · 状态：**draft（待 verifier 评审 → Sprint Contract）**
> 上游依据：`docs/deliberations/2026-10-20-ugc-safety-survey.md`（测绘简报，全部 file:line 已核实）
> 规模判定：**S–M，零新表、零迁移、零 admin 改动**（测绘头条：过滤已全覆盖，真实缺口=举报路径）

---

## 1. 目标（一句话）

玩家在破冰会话内能长按举报其他玩家的 UGC → 服务端即时快照原文落入既有 `reports` 表 → 既有 admin `UserReportsTab` 处置队列零改动可见可处置。

## 2. 范围与轨道切分（零重叠并行）

### Track S — 服务端（backend-engineer）

| # | 项 | 落点 | 备注 |
|---|---|---|---|
| S1 | 新路由 `POST /api/social-icebreaker/:socialSessionId/report-content` | 新小文件 `apps/server/src/routes/socialIcebreakerUgcReport.ts`，挂进破冰路由族 | body 契约见 §3 |
| S2 | 快照 helper `snapshotIcebreakerUgc(state, participants, contentRef)` | `apps/server/src/lib/icebreakerUgcReport.ts` | 即时取数；取不到→降级元数据（G5/G8） |
| S3 | 限流 3 次/会话/小时（复用 `createRateLimiter` 模式）+ 参与者校验 + `reportedUserId` 须同会话成员 | 同路由文件 | R2 恶意轰炸缓解 |
| S4 | `avoidTopics` 堵口：`validateContentSafe` sync 门 | `apps/server/src/routes/socialIcebreaker.ts:836-903`（topics 路由） | ~5 行（G3） |
| S5 | 测试锁扩展：quip(:1106/:1143)/group-mirror(:805/:845)/miniscript-vote(:1126)/V1 陈述(:818) 四面具名 | `apps/server/src/__tests__/contentSafetyIcebreakerSurfaces.test.ts` | G2，防重构回归 |
| S6 | 新路由测试：快照正确性 / 已清理降级 / 限流 429 / 非参与者 403 / description 前缀格式锁 / admin 队列可见冒烟 | 新测试文件 | R5 前缀机器可解析 |

### Track C — 客户端（taro-engineer）

| # | 项 | 落点 | 备注 |
|---|---|---|---|
| C1 | `useUgcReport` hook（action sheet → 确认 modal → 调路由 → 暖 toast） | `apps/mini-program/src/pages/icebreaker-session/hooks/useUgcReport.ts` | **不复用 `AIContentReportButton`**（语义专属 AIGC 且无快照能力，G4）；可借其 SCSS 壳 |
| C2 | 六个长按挂载点（视觉权重低，无 emoji） | quip 投票/揭晓列表（`QuipBattleHeroView.tsx`）、卧底描述列表（`UndercoverWordHeroView.tsx:487`）、侦探陈述卡 V1（`LieDetectiveHeroView.tsx`）、群像揭晓行（`GroupMirrorHeroView.tsx`）、miniscript 投票区（`MiniScriptHeroView.tsx:1200` 附近）、名册/点名昵称 | 长按或「···」更多菜单，二选一全場统一 |
| C3 | 埋点 `ugc_report_submitted` + 服务端白名单 parity | 客户端 union + `routes/domains/analytics.ts` 白名单 | 复用 `discoverAnalyticsAllowlistContract.test.ts` 先例 |

### 共享契约（两轨共同依赖，先行锁定）

`packages/shared/src/api/` 或就近类型：`UgcContentRef = { kind: 'quipAnswer'|'undercoverDescription'|'lieStatement'|'groupMirrorReason'|'miniscriptVoteNote'|'displayName', promptId?: string, round?: number, index?: number }`；body = `{ phase, targetUserId, contentRef, note? }`。

## 3. 服务端行为规格（Track S 核心）

1. `requireAuth` + 举报人须为本会话参与者；`targetUserId` 须同会话成员。
2. **服务端即时从 state_json/participants 快照冒犯原文**（`contentRef.kind` 定位：quipAnswer→`quipBattleAnswers`；undercoverDescription→`undercoverWordRounds[].descriptions`；lieStatement→`lieDetectivePlayers[].statements`（只快照文本，**不碰 isLie**）；groupMirrorReason→`groupMirrorAnswers[].reason`；miniscriptVoteNote→`miniScriptVotes[].why`；displayName→participants 表）。**证据文本不过过滤器**（G4 自伤陷阱：否则举报被自家 400 拦下且毁证据）。
3. 原文已被 phase 清理/会话过期 → 降级：只存 `{ phase, targetUserId, kind, 时间 }` 元数据，description 如实标注「内容已过期」。
4. 用户备注 `note` 走 `validateContentSafeAsync`（与 `routes/domains/reports.ts:55` 同规）。
5. 组装 `description = "[icebreaker:<phase>] <原文快照或元数据> — 备注:<note>"`（≤2000 截断），写 `reports` 表：`category='inappropriate_content'`、`reportedUserId=targetUserId`、`relatedEventId` 经 `resolveCanonicalEventId` 或留空（G6）。
6. **不新增 category、不改表结构、admin 零改动**——`UserReportsTab`（`/api/admin/moderation/reports`）即刻可见可处置；处置动作走既有 moderationLogs + recordViolation 体系。

## 4. 明确不做（v1 边界）

- ❌ cross-phase UGC 归档表（G8 接受降级）
- ❌ 实时撤回/屏蔽他人内容（需 state 写入新语义）
- ❌ 改动 `AIContentReportButton` 既有 AIGC 流
- ❌ 新 admin 页面 / 新 feature flag（合规功能，直接上；长按入口本身低视觉权重）
- ❌ E10 昵称展示打磨（属另一轨）

## 5. 验收标准草案（Sprint Contract AC 备料）

| AC | 判据 | 验证 |
|---|---|---|
| AC-1 | 六种 contentRef.kind 快照正确（含 displayName 从 participants 取） | 新路由测试 |
| AC-2 | 已清理内容降级存元数据且 description 含「内容已过期」 | 测试 |
| AC-3 | 证据原文不经过滤器写入（含违规词的原文能落库） | 测试（G4 回归锁） |
| AC-4 | 限流 3/会话/小时 → 第 4 次 429；非参与者 403；跨会话 target 403 | 测试 |
| AC-5 | `avoidTopics` 过 sync 闸门，违规 400 + recordViolation 恰好一次 | 测试 |
| AC-6 | 四面过滤测试锁具名通过 | `contentSafetyIcebreakerSurfaces.test.ts` |
| AC-7 | 客户端六挂载点长按 → 确认 → 成功 toast；AIContentReportButton 零改动 | 代码审查 + render 断言 |
| AC-8 | `ugc_report_submitted` 两侧白名单 parity | parity 测试 |
| AC-9 | admin `UserReportsTab` 冒烟：破冰举报出现在队列且前缀可解析 | 测试/手动 |
| AC-10 | `npm run guardrails` + server/mini-program 聚焦测试全绿；零 schema 变更 | CI 命令 |

## 6. 风险与回滚

- 风险表沿用测绘 §五（R1–R8），其中 R8（微信合规口径）落地动作：**上线前在 `docs/runbooks/wechat-review-submission.md` 补一段 UGC 举报机制口径说明**（测绘 grep 确认该 runbook 当前无 UGC 专项条款）。
- 回滚：删路由 + 删挂载点即可，无表/无 flag/无数据迁移，回滚成本≈0。

## 7. 排期建议

- 契约（§2 共享契约段）先行定稿 → Track S 与 Track C 可同树并行（文件零重叠：server routes/lib/__tests__ vs mini-program hooks/phases）。
- 建议作为下一个独立 sprint（Tier 2），Sprint Contract 按 §5 起草后走 verifier 两轮协商惯例。
- 与在册事项无冲突：不碰 recap 分享/chips/haptic 任何文件。
