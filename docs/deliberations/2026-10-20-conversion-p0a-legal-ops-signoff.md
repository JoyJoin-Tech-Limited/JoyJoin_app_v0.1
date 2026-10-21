# P0a 开旗前法务 + 运营复核签认（对标平台 竞对反打）

- **日期**：2026-10-20
- **Sprint**：`sprint_20261020_benchmark_full_implementation`（合同 `.git/.orchestration/sprints/sprint-contract.benchmark-full-implementation.md`）
- **验收锚点**：AC-03（P0a 法务/运营复核签认）——AC-03 门禁要求「flag ON 由人类经 `/admin/feature-flags` 执行且 admin audit log 证据入档；staging 复演 matched 前取消真实退款证据」。
- **性质**：法务/运营复核 + 签认产出。**未改任何业务文件，未 commit / push。**
- **上游输入**：`docs/deliberations/2026-10-20-conversion-p0a-verification-memo.md`（S2.1 已产出：flag-off fail-closed、smoke 全绿、裁决「可以开」）。

---

## 0. 结论速览（TL;DR）

| 问题 | 结论 |
|------|------|
| 四处退款承诺用词是否一致？ | 时点（「排桌完成前」）一致；措辞有两处**非阻塞漂移**（`可免费取消` 冗余断言、UI 缺「次数返还」澄清），均不构成违约（详见 §1）。 |
| 是否有法律阻塞项？ | **无**。相反：用户协议退款条款已于 **2026-08-27 生效**，而服务端 flag-off 处于「只删行不退钱」状态——**开 flag 是让行为与已生效条款对齐，属止血而非新增承诺**。 |
| 签认裁决 | **可以开**（无阻塞项；三条非阻塞前置见 §4）。 |

---

## 1. 条款一致性核对表（四面对照）

> 用户可见文案引号内为原文，精确到字符；代码标识 / 文件路径保留英文。

| # | 表面 | 原文 | 位置 | 对照结论 |
|---|------|------|------|----------|
| 1 | **订座确认弹层** | `排桌完成前可免费取消 · 全额退款` | `apps/mini-program/src/pages/pool-registration/components/RegistrationConfirmModal.tsx:104` | 🟠 唯一含「可免费」+「·」并列断言者；**无 flag 门控**（残留，见 §1.3） |
| 2 | **收银台退款保证行** | `排桌完成前取消，全额退款` | `apps/mini-program/src/pages/payments/event-ticket-payment/components/RefundGuaranteeLine.tsx:16` | 🟢 与 flag `preRevealRefundEnabled` 同源联动，flag-off 渲染 null tree |
| 3 | **PRD §1.5 退款条款** | `排桌完成前取消 = 全额退款（钱款原子退款 + 次数返还）；排桌完成后取消或未出席 = 不予退款；平台取消、场次未成行、或因成员退出导致整局顺延 = 全额退款或恢复次数` | `PRODUCT_REQUIREMENTS.md:1241` | 🟢 产品 canon，时点 + 三态边界完整 |
| 4 | **用户协议退款条款** | `取消与退款：— 排桌完成前取消（报名状态尚未变为已排桌）：全额退款，活动次数自动返还，权益用户不受影响。— 排桌完成后取消或未出席活动：不予退款，活动次数（如有）正常扣除。— 平台取消活动、场次未成行，或因成员退出导致整局顺延：全额退款或恢复活动次数，不受上述限制。— 「提前取消」指在排桌完成前通过平台完成取消操作。— 以上退款规则自2026年8月27日起生效；…` | `packages/shared/src/legal/joyjoinTermsZh.ts:68` | 🟠 唯一对「排桌完成前」给出精确定义 + 生效日；**已生效**（见 §1.1） |

### 1.1 「免费取消」 vs 「全额退款」语义差

- **「免费取消」（cancel for free）**：断言「取消行为本身无费用 / 无罚金」。
- **「全额退款」（full refund）**：断言「款项 100% 返还」。

在付费报名场景下二者**同真、不矛盾**：取消后全额退款 ⇒ 取消行为零成本。故 `可免费取消 · 全额退款` 为**冗余并列**，非语义冲突。**裁决：🟡 措辞漂移，非违约，非阻塞**。收银台 / PRD / 协议三处均只提「取消，全额退款」，不含「免费」，建议后续将弹层文案统一为 `排桌完成前取消，全额退款`（P0d 一并处置，见 §4 前置 1）。

### 1.2 「次数返还」澄清缺失（UI vs 条款）

- 协议承诺 `活动次数自动返还，权益用户不受影响`；PRD 承诺 `次数返还`；服务端 pre-reveal 分支**确实**回补（`eventCreditsRepo.reverseRedemptionForRegistration`，`poolRegistrationCancel.ts:369-404`）。
- 但**弹层与收银台两处 UI 只写「全额退款」，未提「次数返还」**。

这是「服务端做得多、UI 承诺得少」——不构成违约（🟡），但对权益方案用户是**期望管理缺口**，且「全额退款」在权益语境下可能被误读为「退包款」。**由客服话术兜底（§2.1），非本次阻塞**。

### 1.3 弹层承诺行的 flag 门控（核心残留，非阻塞）

`RegistrationConfirmModal.tsx:104` 承诺行**无任何 flag 门控**（组件 props 无 flag 字段，`rows` 数组无条件构建；测试 `RegistrationConfirmModal.test.tsx:50,118` 断言其存在且与 flag 无关）。

- **flag OFF 时**：弹层承诺「免费取消 · 全额退款」，服务端 legacy 只删行不退钱 → **承诺 gap 真实存在**（但这是 pre-Phase-0 就有的现状，非本 sprint 引入）。
- **flag ON 时**：承诺变为真，gap 被**修复**。
- **flag 再关时**：回到现状，不比现在更糟。

即：**开 flag 只会改善、不会恶化**；真正的 gap 是「弹层文案本就不受 flag 控制」，应登记到 P0d/后续 sprint 一并处置（联到同一 flag 或改文案）。**裁决：登记为后续项，非开旗阻塞**。

---

## 2. 运营 runbook 更新草案（flag ON 后）

### 2.1 客服话术（用户取消 → 退款时效/路径）

| 场景 | 话术要点 |
|------|----------|
| **揭示前取消（未排桌）** | 「报名费已全额退回，按原支付方式原路返回。」路径：订座详情 / 我的报名 → 取消。 |
| **退款时效** | WeChat Pay 原路退回：零钱 / 余额较快，银行卡一般 **1–3 个工作日**（以发卡行入账为准）。staging / MOCK 测试单即时到账。 |
| **权益 / 连局包用户** | 澄清「退的是**该场次费用**，你的**场次次数已同步返还**，可继续报名其他场」——不可说「退包款」。 |
| **揭示后取消（已排桌）** | 仍为「不予退款」（`noRefundAfterReveal` 保持关，行为不变），话术与现有条款一致。 |
| **用户见「退款失败，请稍后重试」** | 安抚「**报名记录已保留**，钱不会丢」→ 引导稍后重试，或转人工登记（服务端 `REFUND_FAILED_RETRYABLE` 已保证失败不删行）。 |

### 2.2 WeCom 告警关注点

| 关注点 | 通道 / 数据源 | 动作 |
|--------|--------------|------|
| 退款处理成功 | Finance bot `notifyRefundProcessed`（`paymentService.ts:502,547` → `lib/wecomNotifications/payments.ts:100`） | 每笔成功退款一条，无需动作，仅留痕 |
| **退款失败（无专用告警，需主动盯）** | `refund_attempts.status='failed'`；`payments.status='refund_pending'` 卡住 | pre-reveal 失败路径**只向用户返 502**，未接 critical/finance bot——运营需巡检这两张表（建议 P0 后续补一条退款失败 critical 告警） |
| 揭示前退款量异常聚集 | `refund_attempts.initiatedBy='user-cancel'` 按池聚合 | 可能是竞对动作 / 价格 / 信任问题，上升 PM |

### 2.3 退款失败升级路径

- **数据源**：`refund_attempts` 表（`paymentId / status / reason / wechatRefundId / amount / initiatedBy / initiatedAt / resolvedAt / failureReason`）；`refundAttemptsRepo.getAllWithPaymentDetails()` 已带支付+用户 JOIN，可直接出对账清单。
- **幂等语义（排查前先理解）**：
  - `paymentsRepo.claimPaymentForRefund`（`paymentsRepo.ts:332-338`）：原子 claim，`completed → refund_pending`，`WHERE status='completed'` 保证单次。
  - `paymentService.createRefund` 失败：自释放 claim（`refund_pending → completed`）+ 记 failed attempt，再抛错。
  - `REFUND_CLAIM_ERROR_MESSAGE`（`"Can only refund completed payments"`）命中 → 视为**已退款**（`alreadyRefunded=true`，并发幂等），继续删行、不退第二笔。
- **卡 `pending`**：`refundAttemptsRepo.findPendingByPaymentId` 找长期 pending 单（微信退款异步、webhook 未回）→ 查微信商户平台退款单状态 → 命中 success 则 `updateStatus` 置 success。
- **人工退款兜底**：服务端退款失败且不可重试 → 微信商户平台手动原路退款 + 回写 `refundAttemptsRepo.updateStatus` 记录。

---

## 3. 开旗检查单（人类 runbook）

> 目标：先 staging → QA 复演（S2.4）→ 生产，全程 audit log 入档。`noRefundAfterReveal` 全程保持 **OFF**。

1. **前置登记**：把 §1.3 弹层未联动承诺行登记到 P0d / 后续 sprint backlog（联 flag 或改文案），避免开旗后误以为「承诺面已全部对齐」。
2. **staging 先开**：经 `staging.admin.joyjoinapp.com` `/admin/feature-flags`（super_admin）开 `preRevealRefundEnabled`；确认 `noRefundAfterReveal` 仍关。
3. **QA 复演（S2.4）**：matched 前取消 → 收集证据：钱退回 + 次数返还 + `refund_attempts` 记录 + admin audit log `PAYMENT_REFUND_INITIATED`。
4. **生产开**：经生产 `/admin/feature-flags`（super_admin）开 `preRevealRefundEnabled`。
5. **audit log 截图入档**：开旗 mutation 的 admin audit log（`updatedBy` / 时间戳 / from→to）截图，附 AC-03 证据。
6. **回滚预案**：若退款失败率异常 → 关 flag（收银台 `RefundGuaranteeLine` 自动隐藏，无回旋镖）；注意弹层 `RegistrationConfirmModal` 承诺行**不随 flag 关隐藏**（已知残留，见 §1.3）。

---

## 4. 签认裁决

**裁决：可以开，无阻塞项。**

- ✅ 服务端行为就绪且与收银台承诺行同源联动（flag-off fail-closed）。
- ✅ 底层退款 / 回补 / 幂等铁轨 smoke 全绿（`smoke:auto-refund` ALL PASS）。
- ✅ **条款已于 2026-08-27 生效**——开 flag 是让行为对齐已生效条款，属止血，不新增承诺、不引入新法律风险。
- ✅ 揭示后取消不受影响（两 flag 独立，`noRefundAfterReveal` 保持关）。

**非阻塞前置（开之前/同时登记）：**
1. 登记 §1.3 弹层未联动承诺行到 P0d/后续 sprint。
2. 开 flag 走人类 `/admin/feature-flags`（super_admin），audit log 证据入档。
3. staging 复演 matched 前取消真实退款证据（S2.4 承接）。

**边界**：本签认只覆盖 P0a 法务/运营复核；flag ON 的人工执行、staging 复演、P0d 叙事层、P0b 埋点、P0c/P0e/P1a/P1c 在合同其他 AC。未改任何业务文件；未 commit / push。

关键代码锚点（供复核）：`poolRegistrationCancel.ts:110-121/177-187/280-440`；`paymentsRepo.ts:332-344`；`refundAttemptsRepo.ts:27-86`；`paymentService.ts:147/801`；`featureFlags.ts:333/610`；`joyjoinTermsZh.ts:68`；`RefundGuaranteeLine.tsx:12-16`；`RegistrationConfirmModal.tsx:102-105`。
