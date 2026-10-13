# JoyJoin 上线时间表 × 冷启动作战计划（四线交付版）

> **日期：** 2026-10-12　**作者：** @commercialization-genius（CEO 备忘录）　**版本：** v2（趋势刷新 + 运营/营销/产品/技术四线拆分 + 定价附录）
> **趋势检索时间：** 2026-10-12（国际源实时检索成功；中文商业媒体实时检索受限，见 §2 标注）

---

## 1. 决策建议

**以深圳为唯一首发城市，公开软启动锁定 2026-11-09（周一），用「少池密人 + 体验场受托 + 未成行全退」三闸解决冷启动；任一硬停发未闭合自动顺延一周。四条线（运营/营销/产品/技术）并轨交付，各线不可越线抢跑。**

### 四线交付时间表

> 纪律：**技术线管"能不能发"，产品线管"发什么"，运营线管"发了能不能开桌"，营销线管"有人来"**。任何一线的某阶段 Exit 未达标 → 该阶段整体不进入下一阶段。

#### P0 清障周 · 10/12–10/16

| 线 | 交付内容 | Exit 标准 |
|---|---|---|
| **技术** | HS-01…HS-12 逐项执行并留证（`docs/testing/LAUNCH-QA-HARD-STOP-VERIFICATION.md`）；品牌字体真机复验；性能审计预跑 | 12 项全部 PASS 或列出唯一修复路径；证据落盘 `.git/.orchestration/launch-qa/2026-10-XX/` |
| **产品** | 场地档位决断书（补白名单 or 书面关档）；退款政策与页面/条款一致性复核；提审文案终稿 + 禁用词 triage 表 | 深圳 `dining_150_below/150_200/300_500` 每档有"补 or 关"的签字结论；文案扫描无未分类命中 |
| **运营** | 6 家种子场地真值核验（active + 档期覆盖 SQL 跑数）；注销受理通道确认（support 邮箱 + 台账）；WeCom 告警通道实测 | 每个将开放档位 ≥1 场地且档期覆盖池 `dateTime`；告警测试一条送达 |
| **营销** | **冻结期零动作**（仅内部准备）；种子邀请清单（首批 60 人，含 10 对 Duo 潜力组合） | 名单按"圈层×性别×性格"去重；不发送任何公开文案 |

#### P1 RC 冻结 + staging 验收 · 10/19–10/23

| 线 | 交付内容 | Exit 标准 |
|---|---|---|
| **技术** | main 冻结出 RC；staging 全量验收（清单 §1–§18 + §17 dirty 面重跑）；kill drill 逐条计时；数据库恢复演练；`check:full` + 子包样式门 | 全部 exit 0；kill drill 每条 <1min；恢复演练从快照 restore 后 `db:verify` 绿 |
| **产品** | 审核员视角全旅程走查（体验场：报名→支付→排桌→票）；AIGC 角标 fail-closed 验证；错误码中文兜底抽验 | 冷姿态下审核员任何操作不能触发 LLM；全旅程零白屏 |
| **运营** | 种子局 SOP 落盘（邀请话术/驻场分工/退款改期话术）；首周 3 场排期锁档；客服值班表 | SOP 可被非作者执行；3 场场地/档期/预算档位全部确认 |
| **营销** | 提审物料齐备（截图、备注原文、服务类目检查）；种子邀请函 + 私域预热内容排产（**只排产不发送**） | 邀请函经品牌硬规则过审；物料与提审 commit 一致 |

#### P2 生产上线 + 提审 · 10/26–10/30

| 线 | 交付内容 | Exit 标准 |
|---|---|---|
| **技术** | 生产 DDL 台账逐条 `psql`（含 0093–0097 与全部未应用迁移）→ 结构 diff 校验 → 低峰部署 → `/api/readyz` 绿；同日 `api_target=production` 提审；48h 监控值守 | readyz `database/config` 均 ok；提审版本 = staging 验收同一 commit；LLM 杀开关全关 |
| **产品** | 生产姿态对账（16 暗 flag 全 false、payments enabled、≥1 体验场 open）；提审表单勾选「采集隐私」 | 暗 flag 定向 SQL 查询返回空；提审表单回执截图留档 |
| **运营** | 体验场保持 open 供审核；种子局场地方二次确认；退款演练 1 笔真实单 | 退款走通并留审计 `PAYMENT_REFUND_INITIATED` |
| **营销** | 零投放、零公开喊话；企微种子群建立（仅内部 60 人） | 群内只发运营通知，不引导分享（微信红线） |

#### P3 审核窗 + 种子封测 · 11/2–11/6（关键风险窗）

| 线 | 交付内容 | Exit 标准 |
|---|---|---|
| **技术** | 驳回修复待命通道（当天修→当天复审）；审核通过后版本发布操作；生产监控 | 驳回 24h 内完成修复并重新提交；发布后 2h 核心链路复测 |
| **产品** | 审核反馈 triage；种子局体验问卷（≤8 题） | 问卷回收 ≥80%；问题清单进入修复池 |
| **运营** | **11/7（周六）种子局执行**：1 场、邀请 ≤40、报名质量优先；驻场；现场问题台账 | ≥12 人实际出席；开桌成功；台账含每个触点问题 |
| **营销** | 种子局真实素材产出（照片/反馈证言，经用户授权）；**不公开发布** | 素材过品牌+隐私双审；无诱导分享元素 |

**顺延规则：审核 11/8（周日）前未通过 → 公开启动整体顺延至 11/16，营销继续冻结。**

#### P4 公开首周 · 11/9–11/15

| 线 | 交付内容 | Exit 标准 |
|---|---|---|
| **运营** | 3 场固定排期执行（周五晚/周六下午/周六晚，南山福田）；报名 <8 并池/顺延；驻场首 4 场；每日战报 | 成局率 ≥70%；出席率 ≥85%；零现场事故 |
| **营销** | 私域 + 小红书首发内容（真实局回顾，服务性文案）；Duo 双人邀请上线；**不投付费流量** | 内容零禁用词；分享不做解锁前置；邀请码归因正确 |
| **产品** | 每日漏斗看板（报名→支付→成局→出席）；<8 阈值策略微调 | 看板 T+1 更新；策略调整有记录 |
| **技术** | 支付成功率 / AI fallback / dwell 监控；48h 观察窗门 | 支付成功率 ≥99%；fallback ≤基线+2pp；dwell 退化 ≤15% |

#### P5 复盘扩量门 · 11/16–11/22

| 线 | 交付内容 | Exit 标准 |
|---|---|---|
| **技术** | 复盘报告（指标口径固化）；top3 问题修复 | 报告含每个门的对账数据与证据链接 |
| **产品** | 扩量决策评审：成局率 ≥70% → 下周场次 ×2；否则维持/回缩 | 评审结论一周内落文档 |
| **运营** | 下周 6 场排期；新增档位场地档期；种子用户转推荐人机制 | 6 场档期/场地/预算档位全部确认 |
| **营销** | 回顾订阅消息召回（T+1 模板在役）；推荐码活动；首个限额轻投放测试（可随时关） | 召回打开率可测；轻投放有日限额与 kill 开关 |

#### P6 增长循环 · 11/23–12/6

| 线 | 交付内容 | Exit 标准 |
|---|---|---|
| **技术** | 第二城就绪评估（city_unlock 状态机、场地数据、容量复核）；单副本扩展前置（Redis 评估） | 评估报告含扩容成本与风险 |
| **产品** | 定价 A/B 设计（首单券深度 vs 原价，2–4 周循环）；第二城 PRD 前置研究 | A/B 方案过 `payment-entitlement-authority` |
| **运营** | 单城单位经济核算（CAC/ARPU/复购/场次毛利）；每档位 ≥2 场地 SLA 补齐计划 | 数字落到分；缺口有书面白名单 |
| **营销** | 城市拓荒 waitlist（collecting→researching 阈值触发 WeCom）；自然裂变为主 | 不承诺未开城；分享零诱导 |

---

## 2. 核心依据（趋势引用已刷新）

- **商业逻辑（第一性）：** 冷启动死亡谷 = 单城单时段密度不足。6 人一桌，3 人报名的池 = 3 份退款 + 3 次信任损耗。供给（场地）代码造不出来 → 供给闸必须运营先签核。
- **趋势引用（2026-10-12 实时检索，TechCrunch 站内检索）：**
  - 全球头部约会产品集体转向线下：Tinder 上线「Group Hangouts」群组局功能、IRL 活动扩至数十城 — 来源：TechCrunch，2026-09-30 / 2026-08-05，检索 2026-10-12。
  - Bumble 宣布转向「免滑动 + 线下见面」；Gen Z 新品 Ditto 弃滑动改用 AI 撮合 — 来源：TechCrunch，2026-08-06，检索 2026-10-12。
  - 近半美国单身者对「AI 出现在约会里」持负面态度 — 来源：TechCrunch（Match 调研），2026-06-18，检索 2026-10-12。含义：AI 放在排桌/破冰幕后、真人留在现场，是更安全的公开姿态。
  - Snapchat 推出活动组织功能对标 Partiful；Instinct 把 AI 智能体放进群聊协调聚会出行 — 来源：TechCrunch，2026-09-10 / 2026-10-05，检索 2026-10-12。含义：「组织一场局」本身是 2026 的热赛道。
  - 全球社交平台竞争从用户规模转向互动质量 — 来源：Morning Consult《社交媒体现状》经 199IT，2026-10-11 发布，检索 2026-10-12。
  - AI 陪伴类高转化≠高留存（7 日留存 34.1% < 社交类 58.7%）— 来源：行业报告底稿，检索 2026-08-05（**底稿数据，中文源当日不可达，待复核**）。
- **中文市场口径（底稿来源，非实时）：** 搭子经济约 150 亿、线下社交活动市场约 1800 亿 +23.6%、深圳 67.4% 线上交友疲劳、抖音核销率 50–57% vs 美团 80–90% — 来源：`china-market-baseline.md` 底稿（检索 2026-08-04/05）。2026-10-12 实时复核失败（36kr 验证墙、Bing 结果不可用、多数中文 RSS 超时），上线前由运营以深圳本地渠道数据二次校准。
- **数据缺口（待采集）：** 审核实际时长（本次实测）、支付转化率、每池报名中位数、成局率/出席率基线、CAC/LTV。

---

## 3. repo 落点

| 领域 | 真实落点 |
|---|---|
| 硬停发 12 项 | `docs/testing/LAUNCH-QA-HARD-STOP-VERIFICATION.md`；总表 `docs/testing/LAUNCH-QA-CHECKLIST.md` §19 |
| 场地供给 | `apps/server/migrations/0092_budget_tier_venue_activation.sql`、`0093/0094` 重打标；白名单 `docs/design/budget-tier-t0-signoff-checklist-20260916.md` |
| 开桌阈值/满员 | `apps/server/src/lib/poolRegistrationRules.ts:70` |
| 排桌权威/人工复核 | `apps/server/src/poolMatchingService.ts`；`matchingOperatorReviewEnabled` |
| 未成行退款 | `npm run smoke:auto-refund -w @joyjoin/server` |
| 提审姿态 | `docs/runbooks/wechat-review-submission.md` §4 |
| 支付杀开关 | `docs/product/LAUNCH_CONFIG.md`；`apps/server/src/lib/featureFlags.ts` |
| 注销合规 | `docs/runbooks/account-deletion.md` + `apps/server/src/lib/revokeUserSessions.ts` + migration `0096` |
| 裂变/双人 | `apps/server/src/routes/domains/referrals.ts`、`duo.ts` |
| 召回 | `apps/server/src/lib/wechatSubscribeMessage.ts` + `subscribeReminderScheduler.ts` |
| 回滚 | `docs/operations/release-train-gameplay-flags-202609.md` §5；`open-beta-single-replica.md` |

---

## 4. 衡量指标

- **北极星：公开首两周成局率**（成功成组场次 ÷ 已发布场次），P4 基线采集，P5 目标 ≥70%。
- **护栏：** ① 成行后 24h 退款率 ≤10%；② 零审核/诱导分享/AIGC 合规投诉。
- **分线 KPI：** 技术=支付成功率 ≥99%、fallback ≤基线+2pp；产品=漏斗零断点、错误码中文兜底；运营=每池付费报名中位数 ≥12、出席率 ≥85%；营销=私域内容互动、邀请码转化率（首月只采不考核）。

---

## 5. 风险与回滚

| 风险 | 动作 | 分级 |
|---|---|---|
| 支付 create/webhook/reconcile 异常 | `PAYMENTS_ENABLED=false`（≤5s） | P0 |
| 提审驳回/抽查 | LLM 杀开关保持关 + 体验场全链路；旧版本回退预案 | P0 |
| 任一暗发布 flag 误开 | 16 项对账（HS-04）；后台置 false + 审计 | P0 |
| 场地未分配/档位无供给 | `venue_tbd` + WeCom；T-72h 档期覆盖核查；未覆盖档位不开池 | P1 |
| 报名不足导致死亡螺旋 | 顺延/并池 + 未成行全额退；池数回缩；不虚构人数 | P1 |
| 单副本契约破坏 | 维持 1 实例；扩容先上 Redis | P0 |

---

## 6. 优先级与交接

| 优先级 | 动作 | 交接给 | 预估投入 |
|---|---|---|---|
| P0 | HS-01…12 执行/修复 | `@backend-engineer` + ops + `@qa-agent` | 3–5 人天 |
| P0 | 场地白名单决断 + DDL 台账 | ops/PM + `database-migration-safety` | 2–4 人天 |
| P0 | 注销演练 + legal 裁定 | legal + ops + `payment-entitlement-authority` | 1–2 人天 |
| P1 | 种子局 SOP + 首周排期 | PM + ops | 2 人天 |
| P1 | 冷启动埋点（池密度/成局/出席） | `analytics-tracking` | 1 人天 |
| P2 | 定价 A/B（Week-3 后） | `commercialization-genius` → `payment-entitlement-authority` | 后续 |

---

## 7. 本地化雷达（强制）

| 城市 | 适用性 | 差异化动作 |
|---|---|---|
| **深圳** | **首发且唯一**（南山/福田双 cluster；场地缺口待决断） | 周五晚+周末固定排期；档位缺口补 or 关 |
| **北京** | 延后；无池/无场地证据 | `city_unlock_progress` 保持 collecting，不出现空城入口 |
| **上海** | 延后（第二优先）；线下活动局趋势明确 | 深圳单位经济跑正后评估；先攒阈值+场地 |
| **广州** | 延后；与深圳同运营半径、复购习惯好 | 华南第二站候选，置于上海之后按供给就绪度决策 |

---

## 定价附录：¥88 锚 × WELCOME20（2026-10-12 决策，已落地）

### 决策

**单场局票 ¥88 锚不动（永不砸）；见面礼券从「WELCOME50 五折」改为「WELCOME20 固定减 ¥20」——首单实付 ¥68（6=禄、8=发），消除粤语区忌讳的 ¥44（四≈死）。**

### 背景与依据

- ¥44 是双暴露：实付 ¥44 + 横幅「立省 ¥44」（旧 `FirstTimeCouponBanner` 按 planPrice × discountPercent 计算）。深圳为首发城市（粤语区），上线前修正成本最低。
- 备选「减 ¥30 → ¥58」被否（粤语 58≈唔发）；百分比券在 ¥88 上先天产生丑数字（¥44/¥48.4/¥52.8）→ 固定金额券是系统性解。
- ¥68 正是 City GO 调研中已社会化的价格（`docs/proposals/joyjoin-city-go-research-plan.md:126`），现在以"券后价"身份复用，不新增挂牌价。
- 首单实收从 ¥44 提升到 ¥68（每单少补贴 ¥24）；锚价、月卡（¥98/6场）、季卡（¥294/18场）结构不变。

### F4 修订（产品决策记录）

原 Audit F4：见面礼不得自动作用于锚价品（当时 WELCOME50 为 5 折，5 折打锚危险）。
修订（2026-10-12）：**锚价品只接受「固定金额 ≤ ¥20」的见面礼**（`isAnchorSafeWelcomeCoupon`，cap 2000 cents）——首单 ¥68（约 23% off，一次性）；旧百分比码（WELCOME50/40）继续在锚价品屏蔽。连局包/月卡/季卡保持原样。

### 落地清单（已实施）

| # | 变更 | 文件 |
|---|---|---|
| 1 | 发券链 `WELCOME20 → WELCOME50 → WELCOME40` | `apps/server/src/routes/domains/auth.ts`、`routes/domains/assessmentV4.ts` |
| 2 | 券种子（幂等，fixed_amount 2000，不过期，不停用旧券） | `apps/server/migrations/0097_seed_welcome_coupon_20261012.sql`（已重建 journal） |
| 3 | 通行证链 + 锚价安全规则 | `apps/mini-program/.../event-ticket-payment/ticketHelpers.ts`（`CANONICAL_WELCOME_*`、`isAnchorSafeWelcomeCoupon`） |
| 4 | 票页 F4 修订 + 防零元单护栏 | `.../event-ticket-payment/index.tsx`（`discountAmount < currentPrice` 才提交券） |
| 5 | banner 固定金额模式（首单立减 ¥20 / ¥20 watermark / 立省 ¥20） | `apps/mini-program/src/components/FirstTimeCouponBanner.tsx` + `blind-box-payment/index.tsx` |
| 6 | 礼卡/拆盒仪式固定金额渲染（20元） | `WelcomeGiftCard.tsx`、`UnboxingCeremony.tsx`、`profile-review/index.tsx` |
| 7 | 测试 | `wechatAuthRoutes.test.ts`（¥20 主档 + WELCOME50 回退）、`ticketHelpers.test.ts`（锚价安全 + 88→68）、`WelcomeGiftCard.render.test.tsx`、`UnboxingCeremony.test.tsx` |
| 8 | 文档与 mock | `PRODUCT_REQUIREMENTS.md`、`apps/mini-program/AGENTS.md`、`docs/agent-context/mini-program-assets.md`、`docs/testing/LAUNCH-QA-CHECKLIST.md`、`mock-h5-server.mjs` 等 |

### 治理与后续

- 券值/定价均在 DB 配置层（`coupons` / `pricing_settings`），零硬编码；改价/改券值走 `payment-entitlement-authority`。
- 禁虚构划线价规则不变（`original_price_in_cents` 保持 NULL）。
- 上线后 2–4 周若首单转化偏低：**在券层实验**（减 ¥10 vs 减 ¥20），不挂牌价；仅当增量×毛利 > 券成本且不蚕食月卡时才讨论改价。
- 部署提示：生产/Staging 需先执行 `0097` seed；旧 WELCOME50 持有券继续可核销（发券已切换，存量不回收）。

---

## 治理冲突声明

- ⚠ 12 项硬停发未全 PASS 前不允许上线（`LAUNCH-QA-CHECKLIST.md` §19）；10/23 前未闭合 → P2 整体顺延。
- ⚠ 有支付历史用户的注销在 legal 裁定前暂停（`account-deletion-retention-decision-20261006.md` §5.3）；未闭合 = 提审 NO-GO。
- ⚠ 微信禁止利益诱导分享；邀请奖励只能"自然分享 + 轻奖励"（`wechat-review-submission.md` §9 前置扫描）。
- ⚠ F4 修订改变了既有审计决定（锚价品从"完全无券"变为"仅接受固定 ¥20 见面礼"）——已在此记录决策依据；如需回退，恢复 `ticketHelpers.ts` 的过滤配方即可。

## 交接提示

硬门执行 → `@qa-agent` + ops；支付/退款 → `payment-entitlement-authority`；flag → `feature-flags-launch-config`；场地 → `venue-location-services`；文案/提审 → `joyjoin-brand-guidelines`；埋点 → `analytics-tracking`；go/no-go → `@verifier` + Launch Readiness。

---

## 附录 B：固化清单（2026-10-12 评审 — commercialization-genius × PM agent）

> 评审方法：只读代码核查（每项带文件路径）。`待验证` = 需 staging/生产/法务确认。

### 已当场修复（2026-10-12）

| # | 缺陷 | 文件 | 修复 |
|---|---|---|---|
| F-1 | **P0 金额显示 bug**：固定券在奖励页把分当元显示（WELCOME20 → 「¥2000」） | `apps/mini-program/src/pages/profile-linked/rewards/index.tsx` `formatCouponValue` | `¥${Math.floor(discountValue / 100)}` → 「¥20」 |
| F-2 | **P1 文案 bug**：旧百分比券 banner 标题渲染为「首单50折」 | `FirstTimeCouponBanner.tsx` | 百分比模式换算折（50% → 「首单5折」），aria 同步 |

### 上线阻塞（P0，未决）

| # | 事项 | 依据 |
|---|---|---|
| S-1 | **服务端零元单护栏**（mini-program JSAPI 路径）：客户端已在 `discountAmount < currentPrice` 时弃券，但服务端 `paymentService.ts` fixed 分支未截断，`total: 0` 会 500；H5 路径有免费自动履行可作 parity 参照 | `paymentService.ts:164-170 / 991-995` |
| S-2 | **Staging 券 E2E 前提**：`TEST_PAYMENT_PRICE_IN_CENTS=1` 下 ¥20 券被客户端丢弃（防空单）→ 券证据全为空谈；必须用 **≥2001 分**或关闭测试价跑一次真实核销 | `event-ticket-payment/index.tsx` 护栏 |
| S-3 | **退款 → 券回冲验证**：代码会恢复（`paymentFulfillmentRepo.ts:514-552`）但零覆盖；`smoke:auto-refund` 无券断言 → 补 staging 演练 + smoke 扩展 | PM E1 |
| S-4 | **0097 seed 应用到 staging + production** 并核对 `WELCOME%` 行（含旧券存量 `待验证`） | 本 memo 定价附录 |

### P1（种子局/提审前关闭）

| # | 事项 | 建议 |
|---|---|---|
| S-5 | **邀请页奖励阶梯与真实机制不符**：页面承诺「1 人 7 折 / 3 人 5 折 / 5 人免费月卡」，实际 `INVITE_REWARD` 按配对发放且仓库无 seed；5 折承诺与固定金额策略冲突，且触碰微信利益诱导红线（`docs/design/duo-registration-spec-20260807.md:211` 曾提出） | **先改文案对齐真实机制，不先建阶梯**；奖励一律固定金额（锚价不变量） |
| S-6 | **锚价不变量泛化**：`isAnchorSafeWelcomeCoupon` 只约束 WELCOME*；未来非欢迎类固定券（INVITE_REWARD ¥50 等）可绕过 → ¥38 锚价 | 决策：单场局票自动用券统一「固定 ≤ ¥20 或白名单」 |
| S-7 | **原始券码暴露在品牌界面**（ticket stub 「优惠码 WELCOME20」、权益列表 title=code、奖励页 title=code） | 改为「见面礼券 · 立减 ¥20」等友好名，代码仅保留在客服层 |
| S-8 | **旧券双持策略**：旧 WELCOME50 持有者会再获 WELCOME20（按 coupon id 去重，非按家族）→ 双持测试者行为已定（§A7 矩阵），需明文记录 | 测试者双持可接受；公开发放只发 WELCOME20 |

### 验收清单（PM 签核版，A1–A6 为上线门）

A1 seed 双环境应用并核对；A2 发券链测试绿 + staging 返回 `fixed_amount/2000`；A3 真机：礼品卡「20元」→ 单场 ¥88→实付 ¥68 → 核销 → 奖励页「¥20」；A4 ≥¥20.01 真实支付与 `coupon_usage` 行；A5 退款后券回冲可用；A6 服务端零元单护栏；A7 旧/新/混合三账户矩阵；A8 文案扫描（5折/¥44/50折 零命中）；A9 提审素材与姿态；A10 `discountType` 埋点 + 首单核销率 SQL；A11 文档同步（含 schema 注释单位修正）；A12 smoke 扩展 + guardrails 绿。

### 商业化立场（固化期内不变）

- 首两周**不加新促销、不叠券、不投付费流量**——冷启动缺的是密度与信任，不是折扣深度。
- 首单核销率与券后客单价（目标 ¥68）先采集；2–4 周后在**券深度**做 A/B（¥10 vs ¥20），不挂牌价。
- 旧券人群仅限测试者；公开漏斗只见 WELCOME20，客服口径统一（退款回券、月卡首单 ¥78 可用）。

### 执行状态（2026-10-12 晚）

- ✅ **S-1 服务端零元单护栏**：`paymentService.ts` 新增 `CouponFullDiscountError` + `requiresChargeableAmount` 守卫（在创建支付行之前拒绝），fixed 折扣封顶；`resolveCouponValidation` 对「全额抵扣」返回 `COUPON_FULL_DISCOUNT`，4 条路由补 code。回归测试新增 2 例（拒绝且不触达 WeChat / ¥88−¥20=¥68 正常计价）。
- ✅ **S-3 退款 → 券回冲**：`smoke-auto-refund` 新增券燃烧种子 + 3 条断言（`coupon_usage` 删除 / `user_coupons` 回未用 / `used_count` 归零）——dev DB 实测 **ALL PASS**，自清理完成。
- ✅ **S-5 邀请页文案**：删除「1人7折/3人5折/5人免费月卡」阶梯与解锁状态，改为真实机制三步（分享 → 朋友报名同一场局 → 排进同一桌自动到账）；清除分享文案中的「社交」用词。
- ✅ **S-7 券友好名**：新增 `apps/mini-program/src/lib/payment/couponDisplay.ts`（WELCOME*→见面礼券、50%→5折、fixed→立减 ¥20），应用于支付券列表 / 奖励页 / 票根；单测 6/6。
- **验证**：mini-program 2610/2611 绿；server 目标套件 74 绿 + 双端 typecheck 绿；guardrails PASS（5 条 warning 来自并行工作流）。
- **仍待**：S-2（staging ≥¥20.01 券 E2E）、S-6（锚价不变量泛化决策）、S-8（旧券双持策略明文）、A1/A4/A5/A7/A9/A10（staging/生产/真机证据）。

### Scoped pre-ship pipeline（2026-10-12 晚，第二轮）

**独立 code review（外部 reviewer，非作者自评）→ PARTIAL → 修复后 PASS：**
- BLOCKING：邀请页文案承诺的「邀请奖励券」机制在本页分享路径（推荐码 → referral_conversions）上永不触发（INVITE_REWARD 只认 invitation_uses）→ 已改为零承诺的推荐码三步文案。
- CONCERN：`CouponFullDiscountError` 未被路由捕获映射（会塌成 500 死重试）→ 已在 miniprogram/create + register-with-payment 两路 catch 映射为 400 + code。
- CONCERN：旧券持有者可能额外获发 WELCOME20（按 coupon id 去重）→ 已改为按 WELCOME* 家族去重（终身一次），返回持有券本体；新增家族去重回归测试。
- NIT×3：`errorBaselines` 补 `COUPON_FULL_DISCOUNT`；banner 固定态 analytics 的 discountPercent 改为 null + discountYuan；邀请页死 CSS 已删。

**UI/完成度/满意度（scoped，静态 + 机械门）：**
- `design:audit:changed` 0 error / 0 warning；`build:weapp` + `verify:subpackage-styles` + `verify:upload-assets` 全绿；包体 < 2MB。
- 完成度（scoped 四屏）≈ 36/44 坚稳——邀请页步骤卡缺数字指示（P2 polish）；邀请页删掉承诺后情绪钩子变平（dim 5 有意降级，等真实奖励机制回归再用 `wow-elements` 补，不允许再造假承诺）。
- 用户满意度（邀请页，被邀请者视角）≈ 17/24 愿意回来：清晰与诚实提升，仪式感下降（无奖励承诺）。
- `performance-audit` 跳过（无新增动画/资产，反而删了 3 个图标）。
- **render-truth 欠账**：固定金额 banner / 礼品卡 / 拆盒仪式 / 邀请页四屏需在 WeChat DevTools 或真机过目（jsdom 单测已绿，不等于视觉验收）。

### 第三轮（grill-me 拍板后，2026-10-12 深夜）

- **Q1 推荐码现状已核实并记录**：referral_codes = 纯归因（登录归因 + 注册归因 + 点击计数），零奖励（rewardIssued 列无人写）；invitations = 场次级（Duo/事件邀请码），奖励只在 invitation_uses 配对成功时发（INVITE_REWARD 需 admin 建券）。邀请页文案已按此真相改写。
- **Q2 家族级去重已拍板接受**：旧 WELCOME50/40 持有者不再获发 WELCOME20。
- **Q3 锚价不变量已泛化**：`isAnchorSafeCoupon`（fixed ≤¥20，任意码家族）成为单场局票自动用券的唯一门；非欢迎百分比券/大额固定券一律不再自动作用于锚价品。`ticketHelpers.test.ts` 37/37。
- **Q4 远程视觉验证已执行**（本机 H5 + mock + Playwright）：邀请页（新文案渲染 ✓）、奖励页（「见面礼券 · ¥20」✓）、blind-box 见面礼 banner（「首单立减 ¥20」✓）、profile-review 礼品卡（「20元」✓）；截图存 `/tmp/jj-pipeline/*.png`。event-ticket-payment 生成器 500 为**既有 H5 挂载限制**（A/B 对照证实：改动前同样空白，非本批引入）；该页仍需真机/DevTools 过目。
- 仍待（ops/产品）：S-2 staging ≥¥20.01 券 E2E、S-6 决策已收敛为「泛化」（已完成）、邀请奖励是否接 Duo 邀请码为开放产品题、A1/A4/A5/A9/A10 环境证据。

### 第四轮：邀请页接 Duo 邀请码 → 真实邀请奖励（2026-10-13 凌晨）

- **服务端几乎零改动**：Duo 码创建（幂等 per user+pool）、报名绑定（invitation_uses）、同桌奖励发放（`processInvitationRewards` ← `executePostMatchCommitSideEffects`，正式排桌路径在役）全部已存在。
- **唯一 seed**：`0098_seed_invite_reward_coupon_20261012.sql` — `INVITE_REWARD` fixed ¥50（PRD §4 正典值）；>¥20 锚价安全帽，永不自动作用于 ¥88 单场局票（已在 generalized invariant 测试中锁定）。
- **邀请页**：有在报名局 + `duoRegistrationEnabled` 时分享池级 Duo 码（`resolveInviteShareMode`，duo=1 落地链路复用既有 Duo 流程）；否则回退推荐码。Duo 模式文案（「同行码只对这场局有效，排桌锁定前截止」「排进同一桌后你收到一张邀请奖励券」）这次**真实成立**——奖励链路已接通。
- **验证**：duoContext 单测 5/5（含 resolveInviteShareMode）；mini-program 全量 2615/2616 绿；guardrails + design:audit:changed 绿；H5 渲染实证 duo 模式（同行码卡 + 副标题 + 步骤）。
- **已知约束**：同一邀请码多人领取时，一桌最多容纳一组 Duo（既有 [DUO] 守卫），其余顺延+全额退——文案以「邀请一位朋友」的单数口吻规避期望偏差。

