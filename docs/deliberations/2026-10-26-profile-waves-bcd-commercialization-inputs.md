# 商业化决策备忘录：Profile Wave B/C/D 与续费轨道——9 人生产数据校准

**日期：** 2026-10-26　**趋势检索时间：** 2026-10-26 16:43 HKT（3 组实时检索；RevenueCat 与国家统计局原文抓取）

**范围：** 只做决策，不改应用代码。生产证据采用任务提供的 2026-10-26 只读结果：**9 名用户、`xp_transactions` 全表为空、所有用户 `eventsJoined=0`**；未独立复跑生产 SQL。PR #649 open+green、满意度 24/24 是交付背景，不是收入或留存证据。

**经济学边界：** 分城市 CAC、分权益 LTV、付费/过期人数、首续率、海报归因均无基线（待验证）；本备忘录不伪造 LTV/CAC 或 uplift。

## 0. 五步审计（强制，置于决策建议之前）

| 步 | 本议题的答案 |
|----|-------------|
| 1 质疑需求 | 需求：用新生产数据重排 Wave B/C/D、续费轨道与海报工期｜来源：本任务书 + `docs/deliberations/2026-10-23-profile-full-marks-commercialization-plan.md` + `docs/deliberations/2026-10-23-profile-full-marks-pm-plan.md`｜证据：9 名生产用户、XP 流水 0、`eventsJoined` 全 0｜不重排的损失：把 M 级工期投向当前无人拥有的 XP/徽章事实，同时续费窗口继续静默；续费损失金额 = 过期付费人数 × 实付价 × 可挽回率，三个参数均待验证 |
| 2 删除 | 删除 Wave B A5-4（范围落点：`docs/deliberations/2026-10-23-profile-full-marks-pm-plan.md`；门：`docs/deliberations/2026-10-23-profile-full-marks-convergence.md` D-2）｜谁在用：无人，功能未建且 XP 流水为 0｜损失：没有「本周 +N」行，只有永不渲染的空模块｜回滚：仅在写入链被证实且合资格活跃用户的周 XP p50 ≥50 后重新立项。同步撤回前备忘录「身份经济链已真实闭环/已建 80%」的生产性表述，改为「代码常量存在，生产闭环待验证」；文档修订可 revert |
| 3 简化 | 不建周 XP 聚合、DTO、客户端行或空态；A6-3 不做第二次 canvas 改版；续费 pill/提醒只读支付权益事实，价值回执只读真实权益窗口内成行与 DB 定价，不把 XP 接入续费判定 |
| 4 提速 | 最小诊断从「未知是冷启动还是漏写」到明确分流，目标 **0.5 人天**；当前同类诊断耗时基线待验证，以只读对账 + 现有日志的实际耗时回填，不压缩验证 |
| 5 自动化 | **锁定**：9 人样本不新建 XP 周报、自动补账或海报报表；人工频次与年化节省待验证。先做一次人工只读对账；若确认 XP 应上线，再以「合资格动作有、成功流水无」告警和 `AwardResult` 日志做可观测性，禁止自动补写历史账 |

**硬禁区检查：** 删除对象是未建功能与过强文档表述；不删除支付/退款/对账、审计、合规、鉴权/隐私或数据保留链路，不做生产补账。

## 1. 决策建议

| # | 决策 | 当下动作 |
|---|------|----------|
| 1 | **是，升级为 P0 商业化诊断；不是现在宣布 P0 生产事故。** | 立即做 0.5 人天只读对账；在结论出来前，冻结一切「潮流值经济已运转」的商业论证和新增 XP 依赖面。续费 pill/提醒不被 XP 诊断阻塞 |
| 2 | **同意删除 Wave B。** | 「永远空的本周 +N」不如没有该行；不做 0 值、占位符或虚构回补 |
| 3 | **Tier-5 首发定为 15 场。** | 20 场暂不作为首发顶阶；以后不得把快到 15 场的用户再移回 20 场门槛 |
| 4 | **续费轨道今天仍不可见；暗实现 gate 不变。** | PM §1c 修正案 + 三个默认 OFF 的 flag 全部满足后才 GO 暗实现；逐 flag 验收后才可灰度。新数据不改变 pill/提醒，只撤掉身份经济链论据，并要求价值回执在零真实使用时隐藏 |
| 5 | **优先级：续费/价值回执轨道 > A6-3 海报 v2；但 XP 诊断先于两者。** | 轨道内部先做复活/临期 pill + 提醒，再做有真实数据的价值回执；A6-3 现在不投工程，不进当前 PR |

## 2. 核心依据

### 2.1 P0 只查一个问题：没有合资格动作，还是 active 写入链根本没接上？

**代码事实（已核）：**

- `apps/server/src/gamificationService.ts` 的 `awardXPAndCoins` 会更新用户余额并插入 `xp_transactions`；函数内未见统一 XP env flag。仓内业务调用点只有 `apps/server/src/routes/domains/assessment.ts` 的 `POST /api/user/register`、`apps/server/src/routes/domains/social.ts` 的活动反馈，以及 streak/admin 内部路径。该函数捕获异常后返回 `success:false`；registration route 未检查返回值便记录「Awarded」，所以成功字样日志本身不能证明已入账。
- 当前 mini-program essential-data 经 `packages/shared/src/api/profile.ts` 调 `PATCH /api/profile`；对应 `apps/server/src/routes/domains/profile.ts` 没有 XP 发放调用。`POST /api/user/register` 是否仍有真实生产调用待验证，不能把历史 route 当作 active 证据。
- `updateActivityStreak` 在仓内没有调用点；因此「streak 阶梯存在」不等于它会触发奖励。反馈是否发生过、是否曾 admin 调整、生产 `users.experience_points/joy_coins` 是否也为 0，均待验证。

**最小诊断（owner：`backend-engineer` + 数据/PM；只读）：** 对 9 名用户做一份对账：essential/profile 完成信号、`experience_points`、`joy_coins`、反馈数、出席/报名数、XP 流水数；再用现有 request 与 `[Gamification]` / `Error awarding XP` 日志确认是否发生过上述合资格调用及 `AwardResult.success`。不写生产、不先加埋点、不先重建经济系统。

**Owner-ready question（原样可交）：**

> 这 9 名生产用户中，谁实际调用过 `POST /api/user/register` 或 `POST /api/events/:eventId/feedback`，或有 `admin_adjust`？只要有 1 次，为什么 `xp_transactions` 仍为 0，对应 `users.experience_points/joy_coins`、`xpResult` 与错误日志分别是什么？如果一次也没有，请确认：active onboarding 的 `PATCH /api/profile` 与 streak 流程目前是否本就不发 XP——潮流值是「尚未接线」还是「刻意停用」？仓内未发现一个统一 XP env flag，运行时是否另有门控待验证。

**分流即决策：**

- **无合资格调用：** 不宣布写入事故；按「冷启动 + active 流程未接线」处理，PM 必须决定 XP 是否还应存在，经济链继续视为未上线。
- **有合资格调用但无流水/余额：** 升级为工程 P0 写入事故；先修真实写入与可观测性，再谈任何 XP 展示。
- **余额非零但流水为空：** 按账本/迁移完整性事故处理；先查来源，不自动补账。

### 2.2 Wave B：删除判断已经满足 D-2，不需要第二次研究

D-2 要求周 XP p50 ≥50 才建；当前全量生产 cohort 的流水为 0，p50=0，且不存在可支撑「只筛活跃用户就会不同」的 XP 记录。**商业结论：无行 > 恒空行。** 重新进入条件只有两个：写入链已证实、合资格活跃用户的周 XP p50 ≥50；p75 仅作辅助观察。

### 2.3 Tier-5：15 场的商业含义

**定 15 场。** 当前 p95=0 虽满足原 D-4 的 `<12` 规则，但 9 人且零成行不能证明长期分布，故这是一项「冷启动可达性」决策而非统计结论：20 场约需 5 个月每周参加，首发阶段没有任何近期可达持有者，顶阶就无法承担留存钩子；15 场约 4 个月，仍具稀缺性但更像可承诺的目标。Batch-D2 美术无数字（见 `docs/agent-context/mini-program-profile.md`），不需重约稿；真实成行 cohort 形成后再评估新增更高荣誉，**不把 15 场已接近达成的用户移回 20 场**。

### 2.4 续费轨道：精确 go/no-go，新数据只改论据，不改支付事实

| Gate | GO 的必要条件 | 2026-10-26 状态 |
|------|---------------|------------------|
| PM §1c 修正案 | 在 `docs/deliberations/2026-10-22-profile-tab-polish-product-decisions.md` addendum 明确：**never-paid 继续结构性隐藏；只有真实付过且权益已过期的用户能看复活 pill**；采用原商业化案的 **14 天**窗口，或 PM 明确以 7 天覆盖。当前 `docs/deliberations/2026-10-23-profile-full-marks-convergence.md` 写 7 天、原商业化案写 14 天，必须单一化；文案只用 System UI 事实，无稀缺/催促 | **NO-GO：待签** |
| 三个暗旗 | `profileRenewalStatesEnabled`、`subscriptionRenewalRemindersEnabled`、`profileValueReceiptEnabled` 均在 `apps/server/src/lib/featureFlags.ts` 的 `FLAG_ENV_MAP` + `DEFAULT_FLAG_VALUES` 注册为默认 OFF，调用 fallback 一致；`packages/shared/src/copy/featureFlags.ts` 与 `docs/agent-context/feature-flags.md` 同步；逐 flag 可独立回滚 | **NO-GO：当前未注册** |
| 暗实现 vs 可见 | 上两门通过才 **GO 暗实现/合并**；用户可见仍须逐 flag 验收：never-paid 曝光=0、支付深链同档预选、通知去重、F3 新增 pill 态、品牌 🔴 文案通过；`renewal_30d_rate` 基线采集同步开始，4 周前不得宣称 uplift | **今天不可见** |
| 价值回执额外真值门 | 当前权益窗口内真实已成行/已使用场次与 DB 实付/锚价口径通过契约核验，退款/未成行不计入，0 场时整行隐藏；**不得直接拿 `eventsJoined` 的 pending+matched 混合口径冒充「已用」** | **保持 dark；按当前可读口径无分子，真实已用场次数待验证** |

**新数据的影响：** 复活 pill 与续费提醒来自支付/权益，不来自 XP，所以 go/no-go 不变；价值回执也不应由 XP 计算，但按当前 `eventsJoined=0` 的可读口径，没有可据以展示「已用 X 场 · 已省 ¥Y」的分子，真实已用场次数待验证。前备忘录第三点「身份—经济链」从续费商业 case 中撤下，直到 P0 诊断证明其真实运行。

### 2.5 A6-3：现在不做；排序不是「美化 vs 美化」，而是「LTV 断点 vs 未证明的 CAC 助手」

1. **续费/价值回执轨道第一（LTV）。** 先修权益到期断点；价值回执等真实使用与计数口径就位后跟进。
2. **A6-3 海报 v2 第二（潜在 CAC 助手，暂缓）。** `apps/mini-program/src/lib/profile/useProfileCardShare.ts` 目前只明确埋 `profile_share_card_generated`，生成不等于保存/分享，更不等于注册或首付；分享完成、QR 归因注册/首付与 v1 使用基线均待验证。当前 XP 流水=0、按现有 `eventsJoined` 口径徽章=0，海报 v2 不会自动产生更体面的身份事实（用户 XP 余额待验证）；24/24 已消除满意度返工理由。重启门槛：先有 v1 结果漏斗与明确归因假设，具体阈值待验证；不为给 v2 让路而反向制造分享激励。

**趋势只作外部参照，不替代本仓 9 人事实：**

- AI 付费产品「每付费用户收入高 41%、流失快 30%」说明新鲜感不能代替持续价值——来源：RevenueCat《State of Subscription Apps 2026》（115,000+ apps），检索/原文抓取 2026-10-26 16:43 HKT；跨 App Store/Play 与 AI 品类，对微信一次性场次包的适配性待验证。
- 2025 年服务零售额同比 +5.5%，比商品零售额增速高 1.7 个百分点，支持把价值证明锚在真实线下服务使用而非积分装饰——来源：国家统计局《消费市场扩容升级 商贸流通焕新提质》（2026-06-04），检索/原文抓取 2026-10-26 16:43 HKT；宏观参照，不是 JoyJoin 需求预测。

## 3. repo 落点

| 决策 | 真实路径 | 用途/边界 |
|------|----------|-----------|
| XP 写入与账本 | `apps/server/src/gamificationService.ts`；`packages/shared/src/schema/_definitions_extended.ts` | 只读诊断；不补账 |
| XP 合资格调用 | `apps/server/src/routes/domains/assessment.ts`；`apps/server/src/routes/domains/social.ts` | 区分 route 存在与生产真实调用 |
| Active onboarding 未接线假设 | `packages/shared/src/api/profile.ts`；`apps/server/src/routes/domains/profile.ts` | 待生产日志验证，不凭 grep 单独定事故 |
| Wave B 删除 | `docs/deliberations/2026-10-23-profile-full-marks-pm-plan.md`；`docs/deliberations/2026-10-23-profile-full-marks-convergence.md` | A5-4 / D-2 范围，无应用代码 |
| Tier-5 | `apps/mini-program/src/pages/profile/profileConstants.ts`；`docs/agent-context/mini-program-profile.md` | 当前阈值 20；美术无数字 |
| 续费原案与 PM 门 | `docs/deliberations/2026-10-23-profile-full-marks-commercialization-plan.md`；`docs/deliberations/2026-10-22-profile-tab-polish-product-decisions.md`；`docs/deliberations/2026-10-23-profile-full-marks-convergence.md` | §1c、7/14 天冲突与三暗旗 |
| 权益事实 | `apps/server/src/lib/entitlement.ts`；`apps/server/src/repositories/paymentsRepo.ts`；`PRODUCT_REQUIREMENTS.md` | 报名闸语义不改；价格 DB 为源 |
| 回执计数反例 | `apps/server/src/repositories/shellRepository.ts` | 现有 `eventsJoined` 含 pending+matched，不能直接当已使用 |
| 暗旗治理 | `apps/server/src/lib/featureFlags.ts`；`packages/shared/src/copy/featureFlags.ts`；`docs/agent-context/feature-flags.md` | 默认 OFF、后台文案、回滚一致 |
| A6-3 与度量缺口 | `apps/mini-program/src/lib/profile/profileCardPoster.ts`；`apps/mini-program/src/lib/profile/useProfileCardShare.ts`；`apps/mini-program/src/lib/analytics/profileAnalytics.ts`；`apps/server/src/routes/domains/analytics.ts` | 当前 canvas 与生成事件；不等于分享/获客结果 |

## 4. 衡量指标

- **北极星（不变）：`renewal_30d_rate`** = 权益到期后 30 天内重新购买任意权益的过期付费用户占比。当前无分母、无基线（待验证）；先采 4 周纯基线，不能拿行业值当 JoyJoin 基线。
- **P0 诊断出口：`qualifying_xp_actions_without_successful_ledger`**。当前待对账；若 PM 确认 XP 应上线，修复后目标=0，且用户余额与流水逐笔一致。
- **信任护栏：** never-paid 复活 pill 曝光=0；价值回执事实错误=0；0 场回执曝光=0；退款率不得因复活流量恶化（现有分渠道基线待验证）。
- **A6-3 重启证据：** v1 `profile_share_card_generated` 数量可先从 `discover_analytics_events` 查；保存/分享完成、QR 归因注册、归因首付目前缺口待验证。未形成漏斗前，不设伪造的分享 uplift 目标。
- **Tier-5 后续观察：** 真实成行 cohort 的 15 场达成率与达成后次月留存；当前全 0 仅是冷启动基线，目标阈值待验证。
- **单位经济待采集：** 分城市/渠道 CAC、分权益实付 LTV、券核销与毛利回收；在这些数字到位前，海报不能声称降 CAC，续费功能也不能声称已升 LTV。

## 5. 风险与回滚

| 级 | 风险 | 决策性回滚/护栏 |
|----|------|------------------|
| P0 | 把 9 人冷启动误判成生产事故，或反向把漏接线误判成「无活动所以正常」 | 只按「合资格调用是否存在」分流；两种结论都保留 owner 与证据，不用 env 猜测替代日志 |
| P0 | 为让经济链看起来运行而补造 XP、出席或「已省」 | 明确禁止生产补造/自动补账；价值回执 flag 保持 OFF，零事实即隐藏 |
| P1 | 复活 pill 误触达 never-paid，或 7/14 天口径漂移 | PM addendum 未签不实现；`profileRenewalStatesEnabled=false` 回退到现状 |
| P1 | 15/20 场随小样本反复移动，伤害身份资产可信度 | 首发定 15 后不对近达成用户加门槛；未来只做新增荣誉，不做回溯降档 |
| P1 | 通知重复或价值回执引错价格/退款场 | `subscriptionRenewalRemindersEnabled=false`、`profileValueReceiptEnabled=false` 独立回滚；通知去重与计数/定价契约未过不开 |
| P2 | 海报 v2 诱导分享或泄露隐私 | 当前不改 canvas；既有隐私排除与零激励约束继续有效，重启仍须同门 |

## 6. 优先级与交接

| 优先级 | 动作 | 交接给 | 预估投入 |
|--------|------|--------|----------|
| **P0-0** | 9 人 XP 只读对账 + 日志分流 + PM「XP 是否存在」裁决 | `backend-engineer` + 数据/PM；若漏写转 `debug` | **目标 0.5 人天** |
| **P0-1** | PM §1c addendum（含 7/14 天单一口径）+ 三暗旗治理准备 | `product-manager` + `feature-flags-launch-config` + `payment-entitlement-authority` | 决策/登记目标 0.5 人天；功能工时另列下行 |
| **P1-1（商业排序 #1）** | 临期/复活 pill + 续费提醒，GO 后暗实现；价值回执随后且受真值门约束 | `backend-engineer` + `taro-engineer` + `notification-system` + `analytics-tracking` | pill/提醒 **5–7 人天**、回执 **4–5 人天**（沿用 2026-10-23 原案估算） |
| **P1-2** | Wave B 正式关闭；Tier-5 首发 15 场写入 PM 决策记录，避免旧 D-4 再触发反复 | `product-manager`；实施另交 `taro-engineer` | 文档 XS；实施工时待验证 |
| **P2（商业排序 #2，暂缓）** | A6-3 仅在 v1 结果漏斗与归因假设成立后重新评审；不占当前工程切片 | `product-manager` 先证需求，再交 `taro-engineer` | M（PM 原估）；准确人日待验证 |

## 7. 本地化雷达（强制）

> 9 人无城市分布结论；下表沿用 `.agents/skills/commercialization-genius/references/china-market-baseline.md`（底稿，待复核）。城市级 flag 能力待验证；若不支持，实际灰度按用户 hash，不假装能按城市开关。

| 城市 | 适用性判断 | 差异化动作 |
|------|-----------|-----------|
| 上海 | **续费灰度首选（待验证）。** 服务体验付费假设最强，适合先验证事实型权益提醒 | 先 pill/提醒，再有真实使用后的金额回执；CAC/LTV 单列，暂不投海报 v2 |
| 深圳 | **第二。** 时间稀缺使「到期事实 + 短路径」比成长脉冲更有潜在价值 | 保持最短续费深链；T-1 是否比 T-7 更有效待 A/B，不预设 |
| 北京 | **第三。** 身份/圈层叙事可能有价值，但不能用空 XP 经济支撑 | 15 场与徽章先观察真实成行；价值回执有数据后再开，身份付费假设待验证 |
| 广州 | **最后、最保守。** 性价比敏感假设下，真实账目比海报美化更重要，券成本也更需护栏 | 回执只展示可核算事实；重点看券核销/毛利，分城市 CAC/LTV 待验证 |

**期望试点序：上海 → 深圳 → 北京 → 广州；实际可执行性待城市灰度能力验证。**

## 治理冲突声明

⚠ **PM §1c 与窗口口径未收敛：** never-paid 不得看复活 pill 是保留红线；lapsed-paid 例外、14 天（原商业化案）或 7 天（收敛案）必须在 `docs/deliberations/2026-10-22-profile-tab-polish-product-decisions.md` addendum 由 PM 单点签认。未签前不实现，不由工程任选。

**交接提示：** XP 诊断交 `backend-engineer`/`debug`；续费交 `payment-entitlement-authority` + `notification-system` + `feature-flags-launch-config`；指标交 `analytics-tracking`；所有新文案过 `joyjoin-brand-guidelines`。本备忘录不修改任何应用代码。
