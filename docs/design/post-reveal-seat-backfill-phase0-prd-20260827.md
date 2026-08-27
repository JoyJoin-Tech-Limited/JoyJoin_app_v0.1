# PRD · Phase 0 — 揭示后不退款 + 诚实组态（安心补位 · 第一期）

> 日期：2026-08-27
> 状态：待评审（backlog-ready）
> 上游规格：`docs/design/post-reveal-seat-backfill-spec-20260827.md`（§0 锁定决策为本 PRD 不可逾越边界）
> Flag：`NO_REFUND_AFTER_REVEAL`（DB-backed，`apps/server/src/lib/featureFlags.ts`）

---

## 1. Problem Statement

匹配揭示后有人取消或爽约时，当前实现只删除报名行（`apps/server/src/routes/domains/userEventPools.ts:1363`）——不从已成形的组里移除该成员、不通知任何人、无任何票款后果。剩余成员到场才发现少了人（silent hole），退出者零成本，体验与信任双重受损。

## 2. Target Users and Scenario

- **Who:** 已支付并被排上桌的活动池成员（主要）；揭示后需要取消的成员（次要）；运营（告警接收方）
- **When:** 匹配揭示之后、活动开场之前，某成员取消报名或确定不来
- **Current workaround:** 无。组员到场才发现空位；运营无告警，只能事后人工处理

## 3. Goals and Non-Goals

**Goals:**
- 揭示后取消 = 票款不退，且取消流程前置明确警示（政策威慑成立）
- 取消发生后，组态立即诚实：该成员从组视图移除，剩余成员收到通知，不再出现"到场才发现"
- 组剩余 <4 人时触发整局顺延，挂现有「场次未成行」auto-refund pipeline
- 全程零匹配引擎改动、零 LLM

**Non-Goals:**
- 候补/回补机制（Phase 1，`BACKFILL_ENABLED`）
- T-24h/T-4h 确认触点（Phase 2，数据触发）
- 任何形式的处罚阶梯、爽约记录、排桌权重、暂停报名（已被 §0 永久否决）
- 缩组补偿 credits（已否决）
- admin 席位面板（首版用 WeCom 告警 + 现有 admin 工具兜底）

## 4. User Stories / Primary Flows

**Story A（取消者）：** 作为已揭示排桌结果的成员，我在取消时想被明确告知"现在取消不退款"，以便我做出知情决定。
- Flow A：matching-status（matched 态）→ 取消报名 → 弹层「现在取消将不退还报名费。这桌的伙伴们会收到通知哦。」→「再想想」（默认聚焦）/「确认取消」→ 取消成功 toast「已取消，期待下次见到你」

**Story B（留下的人）：** 作为同桌成员，我想在有人退出时收到通知，以便我到场前就知道今晚是几人局。
- Flow B：系统检测取消 → 组视图空位变为中性「排桌中…」占位（不暴露退出者身份）→ 剩余成员收到站内通知 → 若缩组成立：「有位伙伴临时有事来不了，今晚是温馨的 5 人局」

**Story C（塌组）：** 作为剩余成员，当局因退出而人数不足时，我想被自动顺延并退款，而不是被晾着。
- Flow C：组剩余 <4 → 触发整局顺延 → 现有 Trigger B 模式退款 → 通知「这次没能成行，报名费已退回。已为你优先保留下一场的排桌资格」（首版仅文案，无实际优先权逻辑）

## 5. Acceptance Criteria

**不退款政策：**
- [ ] Given 注册处于揭示后状态（`matchStatus` = matched 且已过揭示时刻），when 用户完成取消，then 不创建任何退款记录，注册被删除，组关系被移除
- [ ] Given 揭示前状态，when 用户取消，then 走现有退款政策（行为不变）
- [ ] Given 揭示后取消弹层，when 用户点「再想想」，then 弹层关闭、无任何状态变更
- [ ] Given flag `NO_REFUND_AFTER_REVEAL` = off，when 揭示后取消，then 行为完全回到现状（退款照旧）

**诚实组态：**
- [ ] Given 揭示后取消成功，when 组员查看组视图/matching-status，then 退出者不再出现，其席位显示中性占位「排桌中…」，无退出者身份泄露
- [ ] Given 揭示后取消成功，when 事件提交，then 所有剩余组员收到 `seat_vacated_group_notice` 通知（经现有 `createNotification`）
- [ ] Given 取消后组剩余 ≥4 人，when 通知发出，then 文案为缩组文案（含实际人数）
- [ ] Given 取消后组剩余 <4 人，when 塌组触发，then 剩余付费成员进入现有「场次未成行」auto-refund pipeline（退款或退回次数），退出者不获退款
- [ ] Edge case：duo 之一揭示后取消 → 默认仅移除退出者一人，留下伙伴保留席位与规则不变（不退款规则对其同样适用）
- [ ] Edge case：`is_test_pool=true` 测试池 → 整个生命周期跳过，行为同现状
- [ ] Error case：取消请求中途失败（删行成功但通知失败）→ 取消不回滚，通知重试/降级记录 error log（通知失败永不阻断取消主流程）

**运营：**
- [ ] Given 揭示后取消发生，when 事件提交，then 运营收到 WeCom 告警（沿用 `notifyVenueUnassigned` 模式），含 poolId、剩余人数
- [ ] Given admin 查看该报名记录，when 取消原因展示，then 显示「揭示后取消（不退款）」

**文案合规：**
- [ ] 全部新增文案通过 🔴 硬规则：排桌/席位词汇，无 匹配/社交/撮合/AI，无内联 emoji
- [ ] `joyjoinTermsZh.ts` 退款条款更新为揭示后不退款，法务确认后方可上线

## 6. Constraints, Risks, Dependencies, and Open Questions

| Type | Item | Mitigation or Owner |
|------|------|---------------------|
| Constraint | 零匹配引擎改动；零 LLM；状态机仅 `filled → open → released`（Phase 0 无 claimed） | 规格 §0/§6 |
| Constraint | 文案 🔴 硬规则 + 微信审核姿态（退款政策表述须清晰无歧义） | `docs/copy/brand-copy-strategy.md` |
| Risk | 不退款引发客诉 | 条款 + 取消弹层双重告知；客服话术由运营准备（本 PRD 不含） |
| Risk | 通知失败导致组员仍不知情 | 通知异步、失败重试、error log；不阻断取消 |
| Dependency | 退款路径判定改动属 `payment-entitlement-authority` 治理域 | 实现前加载该 skill |
| Dependency | 条款更新 `packages/shared/src/legal/joyjoinTermsZh.ts` + 法务确认 | 上线 blocker |
| Dependency | schema 若需记录取消原因/揭示时刻，走 `database-migration-safety`（`db:generate --custom` + journal） | 实现 agent 确认最小 schema 变更 |
| Open Question | duo 留下伙伴是否需要显式「我也退出」入口？ | 首版不做，规格 §8.3 |
| Open Question | 塌组顺延"优先排桌资格"是否在后继期次兑现为真实逻辑？ | 首版仅文案 |

## 7. Scope Boundaries

**In scope:**
- 小程序：matching-status / 组详情的取消弹层、组视图空位占位、缩组/塌组通知展示
- 服务端：取消 handler 改造（移除组员 + 不退款判定 + 通知触发）、塌组接现有 auto-refund、WeCom 告警、admin 取消原因展示
- 条款：`joyjoinTermsZh.ts` 更新
- Flag：`NO_REFUND_AFTER_REVEAL`

**Out of scope（后续期次或永久否决）:**
- 候补队列、认领端点、候补支付路径（Phase 1）
- 确认触点（Phase 2）
- 处罚阶梯 / 爽约记录 / 排桌权重 / 暂停报名 / 免责卡（永久否决）
- 缩组补偿 credits（永久否决）
- 候补折扣定价（永久否决）
- admin 席位面板（用现有工具 + 告警兜底）
- 已成形组的任何重排/重优化（永远锁定）

## 8. Success Metrics

| Metric | Unit | Target | Window |
|--------|------|--------|--------|
| 揭示后取消率 | % | 相对基线下降 ≥30%（不退款威慑生效） | 上线后 4 周 |
| 门前 surprise 投诉 | 工单数 | 0（"到场才发现少人"类投诉归零） | 上线后 4 周 |
| 不退款客诉率 | 工单/百场 | ≤ 2，且客服话术可覆盖 | 上线后 4 周 |
| 塌组退款成功率 | % | 100%（复用现有 pipeline，零手工介入） | 持续 |
| 护栏：报名转化率 | % | 相对降幅 <5%（弹层不吓退新报名） | 上线后 4 周 |

公式：揭示后取消率 = 揭示后取消数 / 揭示后排桌席位数 × 100；基线 = 上线前 4 周同口径数据（若基线缺失，首 4 周兼做基线采集，标注"待验证"）。

**Phase 1 触发判据：** 若揭示后取消率仍 >15%，确认触点（Phase 2a）与候补回补（Phase 1）优先级上调；若取消率已打到地板，Phase 1 触发频率极低，可延后。

## 9. Engineering Impact Areas (Hypotheses)

- **Hypothesis:** 取消 handler（`userEventPools.ts` DELETE `/api/pool-registrations/:id`）需按揭示状态分支：移除组关系 + 不退款 + 触发通知
- **Hypothesis:** 组关系移除需定位组 membership 的真实存储（pool group 成员由注册行的 group 归属派生，待实现 agent 核实）
- **Hypothesis:** 退款判定改动落 `payments` / `paymentService` 域，受 `payment-entitlement-authority` 治理
- **Hypothesis:** 塌组检测挂在取消成功后同步执行，复用 `autoRefundService.ts` Trigger B 骨架
- **Platform:** 小程序（唯一用户面）+ 服务端；admin 仅取消原因展示
- **Flag:** 是（DB-backed）；可 dark launch（flag off = 现状）；回滚 = 关 flag，无残留状态（已执行的不退款不退溯）

## Rollout Questions

- [x] Behind a feature flag? — `NO_REFUND_AFTER_REVEAL`
- [x] Dark launch 可行? — 是，flag off 即现状
- [x] 回滚方案? — 关 flag；已发生的不退款取消不做追溯退款（法务口径需在条款中明示政策生效时点）
- [ ] 上线 blocker：法务确认条款变更 + 客服用不退款话术就绪
