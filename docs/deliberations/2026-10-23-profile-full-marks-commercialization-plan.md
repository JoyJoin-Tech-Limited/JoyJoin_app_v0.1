# 商业化备忘录：「我的」tab 满分冲刺 —— 不开店、不加广告，用续费意愿与权益感知价值翻转付费判定

**日期：** 2026-10-23　**趋势检索时间：** 2026-10-23 15:40（实时检索 3 条 + adapty.io 原文抓取 1 条；中文商业底稿条目另标"底稿来源"）

> 任务背景：「我的」tab 20 项 polish 已全量落地（`.sisyphus/plans/profile-tab-polish-2026-10-22.progress.md:84-90`，验收 CLOSED，19/24 愿意回来 band；share/return/recommend = YES，pay = indirect yes）。三个已知封项：①情感共鸣被 Lovart Batch-D2 徽章美术封住（外部资产）；②整洁度被 F3 微信 DevTools 人工渲染门封住；③付费判定 = indirect yes（PM 备忘录裁定本 tab 不直接售卖）。本备忘录负责 ③，并从 ROI 视角复核 ①②。

---

## 0. 五步审计（强制，置于决策建议之前）

> 规则出处：[`.agents/skills/first-principles-velocity/references/requirement-algorithm.md`](../../.agents/skills/first-principles-velocity/references/requirement-algorithm.md)。

| 步 | 本议题的答案 |
|----|-------------|
| 1 质疑需求 | 需求：把「我的」tab 的付费判定从 indirect yes 翻转为 yes（以续费意愿 + 权益感知价值为杠杆，不开现金店）｜来源：本任务书 + 验收记录（`.sisyphus/plans/profile-tab-polish-2026-10-22.progress.md:89`）+ PM 裁决战报（`docs/deliberations/2026-10-22-profile-tab-polish-product-decisions.md` §1c/§7）｜证据：行业基准首次续订留存率仅 30.3%–58.1%（Adapty 2026，检索 2026-10-23）；仓内实锤——到期巡检是死代码（`apps/server/src/subscriptionService.ts:33` `startExpiryChecker` 全仓零调用点）、权益 pill 到期即静默消失（`apps/server/src/repositories/paymentsRepo.ts:99` `end_date > NOW()` + `apps/server/src/lib/entitlement.ts:48-62`）｜删掉损失：不做 = 月卡用户首次续费窗口（T-7d → T+14d）在 tab 上零触点、零通知，续费决策完全靠用户自发——对象是全部悦聚卡持有者的首次续费，量级 = 月卡 ¥98 × 首次续费流失率（无基线，见 §4） |
| 2 删除 | 删掉死巡检 `checkExpiredSubscriptions` 整段（`apps/server/src/subscriptionService.ts:33-118`，含 `startExpiryChecker`/`stopExpiryChecker`）｜谁在用：无人——grep 全仓零调用（2026-10-23 实查），且其实现本身有缺陷：3 天窗口内无去重字段，若被启动会每小时重复发「即将过期」通知（`subscriptionService.ts:94-95` 注释自承 "for now just send it"）｜损失：零——它从未运行过；其承担的续费提醒职能由本备忘录 §6 P0-2 带账本去重的重建替代｜回滚：revert 重建 PR 即恢复现状（现状 = 无提醒）。**tab UI 本身无可删**：PM 备忘录 2026-10-22 已执行 7 项删除（§10 register：免费用户 CTA pill、设置头像任务步、3 步门槛、稀有度 teaser、死海报管线、displayName 大标题、`users.eventsAttended` 信号），现存每个模块都承载 angle-5 回访钩子或间接付费职能；在整洁度尚未经 F3 渲染验证（封项②）时删模块 = 用 angle-5 的分换 angle-3 的分，负期望值 |
| 3 简化 | 同样的用户结果（知道卡还剩几天、到期能找回、买得值不值），不新增任何模块：续费触点 = 现有 P0-1 pill 的状态换肤（`剩 d 天` → T-7d 事实升级态 → `已过期` 复活态），价值回单进 pill 副行/数据带既有位置——可动部件净变化：+0 卡片、+0 路由、+0 新 pill（pill 上限 3 不变，`index.tsx:622-641`）、+2 pill 状态、+1 shell 字段；通知重建复用站内通知既有通道与 `subscribe_message_sends` 式账本，不新建通道 |
| 4 提速 | 复活态 + T-7d 态：决策到可观测 = 5 个工作日（S 级——daysRemaining 已在 shell `entitlement.subscription`，`apps/server/src/lib/entitlement.ts:34-40` 零新增读库）；价值回单 = 8–10 个工作日（需 per-window 出席 join，M 级）；基线：同量级 P0-1 strip 从决策到上线 = 1 天（progress log Phase B+C，2026-10-22 当日）——提速目标以此为基线，不压验证 |
| 5 自动化 | 被替代动作：人工导出到期用户 + 人工群发续费提醒——当前频次 0 次/周（死代码从未运行，实际等于无人做）；若运营人工做 ≈ 每周 1 次 × 30 分钟｜年化节省：≈26 小时/年（量级估算，运营实际频次待验证）｜可观测性：去重账本表（`subscribe_message_sends` 模式——unique user+moment 幂等claim，`apps/server/src/lib/subscribeReminderScheduler.ts:13` 同款机制，其内部实现细节待验证）+ `createNotification` 现有 logger 链路 + 契约测试锁定「同一用户同一到期事件只发一次」｜步骤 1–3 已过 → 解锁，且被自动化的对象（续费提醒）在本备忘录第 1 步已重新证明存在必要 |

**硬禁区检查：** 删除对象是死代码巡检，不是支付/退款/对账链路本身；通知重建走站内通知既有通道（不新增微信订阅推送——「不推送清单」治理不变，见 §3）；不触碰合规文案、鉴权/会话、数据保留。两项治理修正见文末 ⚠ 声明（PM §1c 修正、季度卡定价结构另案）。

---

## 1. 决策建议

**不做的事：** 不在「我的」tab 放任何现金购买入口、不加广告 pill、不动 P0-1「事实只读」红线、不开装备商城。

**做的事（一句话）：** 修复「续费时刻」在本 tab 上的三处结构性泄漏——①**pill 状态机**：`剩 d 天` → T-7d 事实升级态（视觉升权，文案仍纯事实）→ 到期后 14 天内显示「已过期 · 重新开通」复活态（深链支付页预选同档位）；②**续费通知脊椎重建**：删除死巡检，以账本去重的站内通知覆盖 T-7d / T-1d / 已过期三个时刻；③**价值回单**：pill 副行或数据带显示「已用 X 场 · 已省 ¥Y」（按本仓定价实算，零营销措辞）——全部走 DB feature flag 灰度、PM 文案签认，两周内上线第一刀（①+②），价值回单（③）紧随其后。

> 例式表述：把「我的」tab 从「资产陈列柜」改成「权益驾驶舱」——用户在这里完成「我买得值 → 我还记得续 → 我续得顺手」的完整闭环，而闭环上没有一个「买」字。

---

## 2. 核心依据

### 2a. 对任务书之问的直接回答：付费判定到底要什么？

用户满意度量规（`.agents/skills/user-satisfaction-audit/SKILL.md:51`）的第四问是 *"Would I pay **because of** this?"*——它要求的是**这个屏幕创造了付费意愿**，而非**这个屏幕含有购买按钮**。对订阅/场次包产品，「我的」tab 的付费时刻天然是**续费**：用户在这里盘点「我还有什么」（剩几天、剩几张）与「我得到了什么」（几场局、几枚徽章、几周连续、多少悦币）。审计给 indirect yes，说明 tab 已经让用户觉得产品值（return/recommend = YES），但**没有一个机制把「值」翻译成「续」**——tab 在续费窗口期是哑的。

因此结论是后者：**强化续费意愿与权益感知价值，完全符合判定要求，且是唯一与「本 tab 不直接售卖」裁定兼容的解读。** 在「我的」这种个人页放购买 CTA 才是否定项——PM 备忘录 §1c 已正确删除免费用户 CTA pill（"an ad pill on 我的 damages the personal-screen trust"），本备忘录不挑战该裁定的适用对象（never-paid 用户），只修正其对 lapsed-paid 用户的过度覆盖（见 ⚠ 声明 1）。

### 2b. 第一性原理：感知价值 = 已得利益 ÷ 已付价格

付费意愿的物理公式里没有「催促」这个变量。当前 tab 只展示分母侧（剩几天 = 还没消耗的），从不展示分子侧（已得利益）。三处泄漏按价值排序：

1. **续费窗口静默（最大漏口）。** 月卡 ¥98 是一次性场次包（无自动续费，`paymentsRepo.ts:108` `auto_renew` 默认 false；显示名注释「one-time goods purchase, not a subscription」，`subscriptionService.ts:178-179`）——**每一笔续费都是一次主动决策**，而产品在决策窗口（T-7d → T+14d）给出的信号是：pill 消失（`paymentsRepo.ts:99`）、通知为零（死巡检）。行业基准：首次续订留存率是订阅生意最弱的一环，品类区间 30.3%–58.1%，月套餐 380 天留存仅 14.2%（Adapty《2026 年应用内订阅现状报告》，adapty.io，检索 2026-10-23；量级参考——全球 iOS/Android 订阅样本，对微信一次性场次包模型的适配性待验证）。
2. **已得利益不可见（感知价值分子为零）。** 月卡用户 6 场全用，按单场局票锚价 ¥88 实算 **已省 ¥430**；用 4 场 = **已省 ¥254**（公式：min(已用场次,6) × ¥88 − ¥98；定价源 `PRODUCT_REQUIREMENTS.md:1233-1237`，锚价 canon 见 `:200` WELCOME20 把首单锚在 ¥68）。这是纯事实算术，不是营销话术——而它此刻不存在于任何界面。
3. **身份资产的损失框架未成链（已建 80%，缺最后一公里）。** 5 层徽章墙（1/3/5/10/20 场，`还差 n 场` 已在）、streak 阶梯（3/6/12 周 → +200/500/1000 XP + 100/250/500 悦币，`apps/server/src/gamificationService.ts:390-394`）、悦币兑换商城（100 币 = 9 折券 ≈ ¥8.8 券面，`packages/shared/src/gamification.ts:235`）——**留存→返利→核销的经济链在仓内是真实闭环**，但 tab 上没有任何一处把「连续 8 周」和「再走 4 周 = 500 悦币 ≈ 一张 8 折券」连起来说。注意成本控制：streak 里程碑为一次性触发（`newStreak === 3/6/12`），**单用户终身返利上限 850 悦币 ≈ ¥74.8 券面**（实际成本 = 券面 × 核销率 × (1−毛利回收)，核销率无基线 → 待采集，见 §4）——整套留存预算不到半张月卡，这是全仓最便宜的 LTV 杠杆。

**数据缺口（全部待采集，不编造）：** 首次续费率基线、复活转化率、券核销率、分城市 CAC、Duo 漏斗转化率、Lovart 委托单价。

### 2c. 趋势引用（检索时间 2026-10-23）

- `订阅生意的胜负手是首次续订：首次续订留存率品类区间 30.3%–58.1%，月套餐 380 天留存 14.2%；试用/低门槛进入者的长期留存高于直接购买 1.4–1.7×` — 来源：Adapty《2026 年应用内订阅现状报告》（16,000 款应用、$30 亿收入样本），adapty.io 原文抓取，检索 2026-10-23。含义：JoyJoin 的 WELCOME20 低门槛首单（¥88→¥68）方向与「低门槛进入者留存更高」同向；续费窗口的运营触点是被验证的最大杠杆点。
- `小程序留存基准：次日 28% / 7 日 14% / 30 日 7%——「用完即走」是生态默认，回访理由必须长在屏上` — 来源：fkw.com 行业汇编（2026-05），检索 2026-10-23（二级来源，量级参考非审计口径）。含义：streak 火焰、徽章进度、复活态 pill 这些「长在屏上的回访理由」与生态现实对齐。
- `约会/陌生人社交付费盘继续萎缩：Match Group 付费用户同比 -5%、Tinder -8%（Q4 2025），头部集体转向群组 + 线下局` — 来源：swipestats.io / gitnux 汇编，检索 2026-10-23（量级参考）；同向佐证：底稿 §2.5（TechCrunch，检索 2026-10-12）Tinder Group Hangouts、Bumble 转 IRL。含义：JoyJoin 形态被 incumbent 验证，但「形态对」不等于「续费对」——续费工程是必须自己修的内功。

### 2d. ROI 视角复核封项 ①②（任务书要求）

- **封项①（徽章美术，angle 4）：验证通过，但有一个硬前置。** Batch-D2 是三张像素徽章的一次性固定成本（Lovart 委托，单价不在仓内 → 待验证），换来的是 5 层收藏墙对所有未来用户永久生效的身份资产；CSS 占位章（当前 `badge: null` 状态，`docs/design/lovart-brief-milestone-batch-d2-20261022.md:4`）撑不起「城市传说」的仪式感，这是已知 angle-4 封项。**硬前置 = PM 备忘录待验证 #1：先用 `shellRepository.ts:434-464` 同款计数 SQL 拉线上成行分布，若 p95 < 12 场，必须把第 5 层从 20 场改为 15 场再生成美术**——美术是唯一不可逆成本，阈值错了重画就是双倍成本。ROI 判定：委托它，但绝不在 p95 查询之前委托。
- **封项②（F3 渲染门，angle 3）：强烈验证通过——这是全桌最便宜的一分。** F3 是人工 DevTools 矩阵（计划 §F3），零工程成本、纯人工小时；整洁度的分用任何功能投入都买不回来，它不是投资是门。**排序要求：F3 必须排在本备忘录 ①（pill 状态机）合并之后或与其同批执行**——状态机给 strip 新增 2 个渲染态（T-7d 升级态、已过期态），F3 矩阵需 +2 个 case（streak 临界、RM、退化档原有 case 不变），否则今天过的 F3 明天就过时。

---

## 3. repo 落点

| 机制 | 文件路径 | 现状与改动性质 |
|------|---------|---------------|
| 权益 pill 数据源（daysRemaining 已在） | `apps/server/src/lib/entitlement.ts:29-70`（`ResolvedEntitlement.subscription`）；shell 透传 `apps/server/src/repositories/shellRepository.ts` `getProfileShellData`（可选字段、fail-open，P0-1 已落地） | 零新增读库；T-7d 态纯客户端派生 |
| pill 渲染与点击 | `apps/mini-program/src/pages/profile/index.tsx:613-651`（数据派生）+ `:1312-1345`（渲染）；点击已接 `openMiniProgramPaymentPage`（`apps/mini-program/src/lib/payment/paymentEntry.ts:38-55`） | 加状态机；续费深链复用 `returnTab` 同款 query 模式（`paymentEntry.ts:53`），新增 `?source=profile_renewal` 让支付页预选同档位——预选逻辑落点 `paymentPageModel.ts`（待验证具体函数名） |
| 到期静默消失的根源 | `apps/server/src/repositories/paymentsRepo.ts:97-103`（`status='active' AND end_date > NOW()`） | 复活态需要「最近过期」信号：**不碰** `resolveEntitlementMode`（它是报名闸权威，`entitlement.ts:1-22` 注释明令语义不可漂移）——在 shell 加独立可选字段 `recentlyExpired: { planType, expiredAt } | null`（14 天窗口），fail-open |
| 死巡检（删除对象） | `apps/server/src/subscriptionService.ts:33-118` | 整段删除；`getUserSubscriptionStatus`/`renewSubscription`/`cancelSubscription` 保留（有活调用） |
| 续费通知重建 | 新建于 `apps/server/src/lib/`（模式参照 `apps/server/src/lib/subscribeReminderScheduler.ts`——10 分钟 tick + user+moment 幂等 claim 账本）；通知创建走 `storage.createNotification`（`subscriptionService.ts:78-85` 同款调用）；账本表参考 `subscribe_message_sends`（unique user+moment+pool） | **只做站内通知，不新增微信订阅推送**——现有 3 模板策略的「刻意不推」清单不变（AGENTS §6 订阅消息策略）；归 `notification-system` skill 边界 |
| 价值回单（已用 X 场 · 已省 ¥Y） | 计数 SQL 复用 `apps/server/src/repositories/shellRepository.ts:434-464` 同款语义（与「已参加活动」stat 卡一致，PM §1a 先例）；定价读 DB `pricing_settings`（admin `/admin/pricing` 可改，兜底 `apps/server/src/routes/domains/payments.ts`）；shell 加可选字段 | 「已用」= 当前订阅窗口内（start_date→now）成行场次的计数口径待验证（建议与 stat 卡同语义，避免两处数字打架） |
| streak 阶梯与悦币经济 | `apps/server/src/gamificationService.ts:330-404`（3/6/12 周 +200/500/1000 XP + 100/250/500 币，一次性）；`packages/shared/src/gamification.ts:228-295`（兑换商城 100–1000 币档） | 只读复用；商城为硬编码 const，调价需改码（本备忘录不动） |
| Duo 卡（获客对冲） | `apps/mini-program/src/pages/profile/index.tsx:555-575`（72h snooze、`duo-status` lazy query）；邀请奖励 `PRODUCT_REQUIREMENTS.md:564-567`（INVITE_REWARD ¥50，migration `0098`） | **当前卡片零埋点**（2026-10-23 实查 grep 无 track 调用）→ 补 impression/tap 事件 + 服务端 duo_bound→首付归因 |
| 文案法 | `docs/copy/brand-copy-strategy.md` §2（🔴：不解释机器、社证数字必须为真）、§3/§3.1（只用 权益/悦聚月卡/悦聚季卡/三连局包/六连局包/单场局票；禁 会员/VIP）；支付/信任面用 System UI、不开心路径零语气词（§2 🟡） | 本备忘录全部新文案按 System UI  factual register 起草，PM 签认后落地 |
| 灰度开关 | `apps/server/src/lib/featureFlags.ts`（DB 为源、5s LRU、admin `/admin/feature-flags` 超管开关、变更审计） | 新 flag：`profileRenewalStatesEnabled`（①）、`subscriptionRenewalRemindersEnabled`（②）、`profileValueReceiptEnabled`（③）——全部默认 dark，注册进 `docs/agent-context/feature-flags.md` |
| 徽章资产 | 简报 `docs/design/lovart-brief-milestone-batch-d2-20261022.md`（落地清单 6 步含 CDN manifest + Upload 工作流）；p95 前置查询 = PM 备忘录待验证 #1 | 外部委托 + 1 人天接线 |

找不到的机制一律未编造：支付页预选函数名、账本表确切表名（`subscribe_message_sends` 内部结构）、Lovart 委托单价、城市级 flag 粒度（featureFlags 是否支持按城市灰度）——均标 `待验证`。

---

## 4. 衡量指标

- **北极星（1 个）：`renewal_30d_rate`** = 到期后 30 天内重新购买任意权益（月卡/季卡/连局包/单场）的过期订阅用户占比。**当前无基线**——上线前必须先埋点采集 4 周纯基线（flag 全 dark），否则后续 uplift 无可归因。
- **护栏（2 个）：**
  1. **退款率不升**（现有链路基线待查，`payment-entitlement-authority` 口径）；复活态引流订单的退款率单独切片——若高于大盘 1.5×，判定文案诱导嫌疑，立即回滚。
  2. **通知投诉/退订不升**：续费提醒点击退订率（通知已读但 48h 内未点击且出现设置页退出行为的比例——口径待 `analytics-tracking` 定义）；以及 pill 点击率不降级——现有事件 `profile_entitlement_pill_tap`（`index.tsx:645`）加 `state` 维度（normal/urgent/expired）后，urgent 态点击率若显著低于 normal 态，说明升权设计被读成广告，回滚视觉层。
- **次要观测：** 复活转化率（expired pill 展示 → 14d 内支付完成）；价值回单展示 → renewal_30d 相关性（先相关后因果，不作因果宣称）；悦币核销率（商城兑换/发放比）；Duo 漏斗（card_impression → invite_sent → duo_bound → invitee_first_payment）——vs 单客 CAC（无基线，待 `analytics-tracking` 建立分渠道口径）。

---

## 5. 风险与回滚

| 级 | 风险 | 影响面 | 回滚路径 |
|----|------|--------|---------|
| P0 | 价值回单算错（把已退款/未成行场次计进「已用」，或价格读取漂移导致「已省」虚高） | 信任损伤大于没有回单——社证数字为真是 🔴 硬规则（`brand-copy-strategy.md` §2） | flag `profileValueReceiptEnabled` 关 = 字段不渲染；契约测试锁定计数 SQL 与 stat 卡同语义；灰度 5% 起 |
| P0 | 复活态 pill 被读成广告，违反 PM §1c 精神（个人页信任） | never-paid 用户若误见 = 直接违反裁定 | 实现约束：`recentlyExpired` 仅由真实过期订阅行派生，never-paid 用户在数据层就无此字段——结构性不可能误见；仍走 PM 签认 + flag `profileRenewalStatesEnabled` 关 = 回到静默消失现状 |
| P1 | 通知去重账本缺陷 → 同一用户重复收续费提醒 | 骚扰投诉 | 账本 unique 约束即幂等 claim（`subscribe_message_sends` 同款）；kill switch `subscriptionRenewalRemindersEnabled`；死巡检删除与新实现同 PR，回滚 = revert 该 PR（回到无提醒现状，可接受） |
| P1 | 季度卡无折扣事实被文案误写成「续季更划算」（¥98×3=¥294，见 ⚠ 声明 2） | 虚假宣传风险（底稿 §5 监管红线） | 文案评审门：本备忘录授权的唯一季卡话术是 canon 徽标「更省心」（`brand-copy-strategy.md` §3.1）——便利性框架，非省钱框架；任何含「划算/省」的季卡文案一律打回 |
| P2 | T-7d 视觉升权在退化档/RM 设备渲染异常 | angle-3 反噬 | 升权 = 静态样式差异（边框/底色），零动画零 loop；并入 F3 矩阵 +2 case（§2d） |
| P2 | 悦币面额可见性提升 → 核销率上升 → 券负债上升 | 毛利稀释 | 核销率入 §4 观测；商城档位为硬编码 const（`gamification.ts:228`），可随时改码调档；量级上限已知（终身 850 币/人 ≈ ¥74.8 券面） |

---

## 6. 优先级与交接

| 优先级 | 动作 | 交接给 | 预估投入 |
|--------|------|--------|----------|
| P0-1 | pill 状态机（T-7d 升权态 + 已过期 14d 复活态）+ 续费深链预选 + `profile_entitlement_pill_tap` 加 `state` 维度；flag `profileRenewalStatesEnabled` dark 上线 | `taro-engineer` + `backend-engineer`（shell `recentlyExpired` 字段）；文案签认 `product-manager` | 3–4 人天 |
| P0-2 | 删除死巡检（`subscriptionService.ts:33-118`）+ 重建 T-7d/T-1d/已过期站内通知（账本去重）；flag `subscriptionRenewalRemindersEnabled` dark；**同步开 4 周 `renewal_30d_rate` 纯基线采集** | `backend-engineer`（边界：`notification-system` + `reliability-and-state-integrity`）；埋点 `analytics-tracking` | 2–3 人天 |
| P1-1 | 价值回单「已用 X 场 · 已省 ¥Y」（pill 副行/数据带既有位置）；flag `profileValueReceiptEnabled` | `backend-engineer` + `taro-engineer`；契约测试 `testing-and-regression-guardrails` | 4–5 人天 |
| P1-2 | **先跑 p95 成行分布查询**（PM 待验证 #1），再委托 Batch-D2，落地按简报 6 步清单 | `visual-designer`（Lovart 委托）+ `taro-engineer`（1 人天接线）；p95 查询 `backend-engineer`（0.5 人天） | 外部委托 + 1.5 人天 |
| P1-3 | F3 渲染矩阵排期执行（含 pill 新 2 态的 +2 case）——全桌最便宜的一分 | `qa-agent` + 人工（WeChat DevTools）；`multimodal-looker` 辅助截图比对 | 1 人天（人工） |
| P2-1 | Duo 卡埋点（impression/tap）+ duo_bound → 首付归因查询 | `backend-engineer`（`analytics-tracking`） | 1–2 人天 |
| P2-2 | streak 临界提示行加悦币面额事实（如 `再坚持 1 周领 +200 悦币`——在既有 hint 上补单位，零新增行） | `taro-engineer`；文案 `joyjoin-brand-guidelines` 0.5h 评审 | 0.5 人天 |
| P3（另案） | 季度卡定价结构 + 自动续费（微信支付分委托代扣）评估——见 ⚠ 声明 2，Tier-3，不在本 sprint | `commercialization-genius` 起案 + `payment-entitlement-authority` 评审 | 另立 deliberation |

---

## 7. 本地化雷达（强制）

> 城市画像依据：`references/china-market-baseline.md` §2（底稿，2026-08-05 检索校准，标"底稿"）；定价事实依据 `PRODUCT_REQUIREMENTS.md:1233-1237`。城市级 flag 灰度能力 `待验证`（`featureFlags.ts` 是否支持按城市维度——若不支持，灰度按用户 hash 而非城市）。

| 城市 | 适用性判断 | 差异化动作 |
|------|-----------|-----------|
| 上海 | **先行试点。** 消费力最高、体验溢价接受度最高、线下活动局是 2026 明确趋势（底稿 §2）；对直接但体面的续费呈现耐受度最强 | 第一波灰度城市；价值回单按实计算直给（¥88 锚价感知最强的市场）；复活态文案保持 System UI 最简形态 |
| 深圳 | **第二波。** 时间成本敏感、67.4% 单身者线上交友疲劳（底稿 §2，2026 调研）、996 密度高——「省心」叙事天然契合；且季卡 canon 徽标「更省心」（§3.1）恰好是唯一合规的季卡框架 | 续费深链默认预选 = 同档位（月卡→月卡），但支付页可对深圳用户重点呈现季卡「更省心」徽标——便利性而非折扣；T-1d 通知在深圳权重高于 T-7d（时间稀缺人群决策窗口更短——假设，待 A/B 验证） |
| 北京 | **第三波。** 「心价比」= 情绪价值 + 性价比并重（底稿 §2，《2026 北京青年消费趋势指南》）；对身份感/圈层敏感 | 价值回单是北京的最强杠杆（「已省 ¥Y」直接对话心价比）；徽章墙的身份资产叙事在北京权重最高——Batch-D2 落地后观察北京用户徽章展开率（现有 accordion 交互可埋点，事件名待 `analytics-tracking` 定义） |
| 广州 | **最后、最保守。** 性价比敏感但复购习惯好（底稿 §2）；同城竞品 39–99 元/场 + 49 元/月（底稿 §3.2，量级待核验）——悦聚月卡折合约 ¥16.3/场已低于竞品单价，价值回单会如实显示这一点（不点名竞品，只算自家账） | 重点监控券核销对毛利的稀释（广州用户核销倾向假设更高——待验证）；复活态窗口文案在广州可延后至 T+7d 再出现（降低「被催单」感——假设，待 A/B 验证） |

**试点顺序：上海 → 深圳 → 北京 → 广州。** 依据：付费意愿梯度（上海最高）× 叙事契合度（深圳省心/北京心价比）× 风险梯度（广州价格敏感最后）。

---

## 8. 行动序列（任务书要求：动作 → 预期维度收益 → 工作量 → 负责 → 依赖）

> 六角度编号：1=3 秒清晰度，2=认知顺滑，3=整体整洁，4=情感共鸣，5=回访钩子，6=分享欲。付费判定为独立 verdict，单列。

| # | 动作 | 预期维度收益 | 工作量 | 负责 | 依赖 |
|---|------|-------------|--------|------|------|
| 1 | pill 状态机（T-7d 升权 + 已过期 14d 复活 + 续费深链预选） | **angle 5**（「我的卡状态活着」= 回访理由）+ **付费判定翻转核心机制** | S（3–4 人天） | taro-engineer + backend-engineer | PM 文案签认（System UI 纯事实）；flag；shell `recentlyExpired` 字段（不动报名闸语义） |
| 2 | 死巡检删除 + 续费站内通知重建（账本去重，T-7d/T-1d/已过期） | **angle 5**（到期提醒 = 回访触发）+ 付费判定 | M（2–3 人天） | backend-engineer | 账本表（subscribe_message_sends 模式，内部结构待验证）；kill switch flag；4 周 renewal_30d 基线先行 |
| 3 | 价值回单「已用 X 场 · 已省 ¥Y」 | **angle 4**（「我买得值」的仪式感= 价值确认的庄重时刻）+ 付费判定 | M（4–5 人天） | backend-engineer + taro-engineer | per-window 出席计数（口径待验证，与 stat 卡同语义）；契约测试；PM 签认 |
| 4 | p95 成行分布查询 → Batch-D2 徽章委托与落地 | **angle 4**（封项①解锁——CSS 占位章 → 像素徽章真身） | S 仓内（1.5 人天）+ 外部委托 | visual-designer + backend-engineer（查询）+ taro-engineer（接线） | **p95 查询硬前置**（PM 待验证 #1，阈值可能 20→15 场）；CDN Upload 工作流 |
| 5 | F3 渲染矩阵执行（含 pill 新 2 态 +2 case） | **angle 3**（封项②解锁——全桌最便宜的一分） | S（1 人天人工） | qa-agent + 人工 | 排在动作 1 合并之后或同批 |
| 6 | Duo 卡埋点 + duo_bound→首付归因 | angle 5（间接——获客对冲度量，不直接涨分但支撑付费判定的经济学叙事） | S（1–2 人天） | backend-engineer | 分析事件白名单双端注册（`analytics-tracking`） |
| 7 | streak 提示行补悦币单位（`+200 悦币`） | angle 5（轻——把既有阶梯接到真实经济链上） | S（0.5 人天） | taro-engineer | 文案 0.5h 评审（`joyjoin-brand-guidelines`） |
| 8 | 4 周 `renewal_30d_rate` 纯基线采集（flag 全 dark 期） | 无直接维度收益——**它是动作 1/2/3 能否宣称 uplift 的归因前提** | S（埋点 1 人天 + 4 周等待） | backend-engineer（`analytics-tracking`） | 与动作 2 同 PR 落地埋点 |

**排序逻辑：** 8（基线埋点）与 1、2 同周启动 → 3 → 4（p95 先行）→ 5（F3 收尾人工门）→ 6、7 穿插。全部 flag dark 上线后按 §7 城市序灰度。

---

## 治理冲突声明（如有）

⚠ **冲突 1 — PM 备忘录 §1c「FREE users see nothing — the strip is hidden」需限缩修正。** 现规则：`docs/deliberations/2026-10-22-profile-tab-polish-product-decisions.md:46-48`。其裁定本意（防广告 pill 伤害个人页信任）适用于 **never-paid** 用户；但到期后 pill 静默消失把 **lapsed-paid** 用户也一并静默了——后者是已经付过钱、正处于续费决策窗口的人，与广告骚扰对象不是同一 cohort。修正提案：never-paid 用户继续什么都看不见（裁定不动）；lapsed-paid（过期 ≤14 天）显示事实复活态「悦聚月卡 · 已过期」+「重新开通」。改变它需要：PM 复审本备忘录并签认 §1c 修正案（记录于 PM 备忘录 addendum，与 P0-5/P0-1 先例同格式）。

⚠ **冲突 2 — 季度卡定价结构是零折扣（¥98 × 3 = ¥294，场次同比 6×3=18）。** 现规则：DB `pricing_settings` 为源，兜底 `PRODUCT_REQUIREMENTS.md:1233-1234`（待验证 DB 现值与兜底一致）。含义：**理性续费用户没有任何经济理由选季卡**——「升档 framing」在本备忘录中被明确降级为弱杠杆（唯一合规话术 = 便利性徽标「更省心」，§3.1 canon），任何「续季更划算」写法都是虚假宣传。这不阻塞本 sprint，但它是定价结构的真问题：改变它需要 `commercialization-genius` 另起定价备忘录 + `payment-entitlement-authority` + admin `/admin/pricing` 操作（Tier-3 流程，含自动续费/委托代扣一并评估）。

⚠ **红线兼容性自查（非冲突，是约束登记）：** PM「无 scarcity/urgency 文案」红线（`2026-10-22-profile-tab-polish-product-decisions.md:43`）——本备忘录 T-7d 态全部文案为纯事实（`剩 3 天`/`今天到期`/`已过期`），视觉升权不构成 urgency copy；季卡不写「划算」；价值回单数字必须实算（🔴 社证数字为真）；无 会员/VIP 字样（悦聚卡家族 only）；无诱导分享措辞（海报与 Duo 链路均不涉及奖励承诺，`PRODUCT_REQUIREMENTS.md:567` INVITE_REWARD 永不在卡面提及——现行裁定沿用）。

---

## 交接提示

落地本备忘录时，实现类工作交给：`payment-entitlement-authority`（复活/续费链路与退款护栏）、`notification-system`（续费站内通知重建）、`feature-flags-launch-config`（三个新 flag 注册与灰度）、`analytics-tracking`（renewal_30d 基线与漏斗）、`joyjoin-brand-guidelines`（全部新文案 🔴 门）、`testing-and-regression-guardrails`（价值回单计数契约测试）、`draft-prd`（若 §1c 修正案需要 PRD 化）。徽章美术走 `visual-designer`（Lovart 流程）。本备忘录不修改任何应用代码。
