# P0a 退款止血验证备忘录（T46 竞对反打）

- **日期**：2026-10-20
- **Sprint**：`sprint_20261020_t46_full_implementation`（合同 `.git/.orchestration/sprints/sprint-contract.t46-full-implementation.md`）
- **验收锚点**：AC-03（P0a 验证备忘录）
- **性质**：验证 + 证据产出。**未改任何业务文件，未 commit / push。**
- **决策背景**：用户已拍板 D4——法务/运营证据齐即经 `/admin/feature-flags` 直接开 `preRevealRefundEnabled`（止血优先）。

---

## 0. 裁决速览（TL;DR）

| 问题 | 结论 | 证据 |
|------|------|------|
| flag 关时收银台 `RefundGuaranteeLine` 承诺行可见吗？ | **否（不可见）**。该行与 `preRevealRefundEnabled` 同一 flag 联动，flag-off → `visible=false` → 渲染 null tree。 | 见 §2 完整调用链 |
| 是否存在**未联动**的「排桌完成前可取消·全额退款」承诺行？ | **是**——`RegistrationConfirmModal`（订座确认弹层）有一行**无条件**承诺文案，与 flag 无关。 | 见 §3 |
| `smoke:auto-refund` | **ALL PASS**（退款/回补/幂等全绿）。 | 见 §4 |
| flag ON 安全性裁决 | **可以开**（有前置：先处置/登记 §3 未联动承诺行 + 开时走 admin audit log + staging 复演）。 | 见 §5 |

---

## 1. legacy vs flag-on 行为 diff（file:line 级）

权威文件：`apps/server/src/lib/poolRegistrationCancel.ts`

### 1.1 分支裁决（`cancelPoolRegistrationWithPolicy`）

- **`computeRegistrationCancelPolicy`**（L110-121）：双 flag 全关时返回 `undefined`（L118 `if (!preRevealRefundEnabled && !noRefundAfterReveal) return undefined;`）；`isTestPool` 也返回 `undefined`（L117）；`matchStatus !== "matched" && preRevealRefundEnabled` → `"refundable"`（L119）；否则 `"non_refundable"`。
- **分支选择**（L177-187）：
  - `pool.isTestPool === true` → `"legacy"`（L179-180，AC-5 跳过整个 Phase 0）
  - `matchStatus === "matched"`（isPostReveal）→ `noRefundAfterReveal ? "post_reveal_no_refund" : "legacy"`（L181-184）
  - 否则（pre-reveal）→ `preRevealRefundEnabled ? "pre_reveal_refund" : "legacy"`（L185-187）

### 1.2 legacy 分支（`cancelLegacy`，L214-276）—— flag 关时的现状

| 步骤 | 行为 | 位置 |
|------|------|------|
| 0) FK 清理 | `DELETE invitationUses`（L223-225） | |
| 1) 删报名行 | `DELETE eventPoolRegistrations`（id+userId 范围）（L228-236） | |
| 2) 计数递减 | `totalRegistrations - 1`（L250-256） | |
| **返回** | **`refundedMoney: false, reversedCredit: false`**（L270-271） | **只删行，不退钱、不回补 credit** |

> 关键事实：legacy 路径 **没有任何** `paymentService` / `eventCreditsRepo` 调用。`refundedMoney: false` 是硬编码，不是「没找到支付」。

### 1.3 pre-reveal 分支（`cancelPreRevealWithRefund`，L280-440）—— flag ON 后的行为

| 步骤 | 行为 | 位置 |
|------|------|------|
| (a) 钱路径 | 先查 completed 的 event 支付（L293-308）；**MOCK_** 单直接 `finalizeRefundedPayment` + 记 refundAttempts（L315-329）；真实单走 `paymentService.createRefund`（L332） | L310-362 |
| 失败处理 | `REFUND_CLAIM_ERROR_MESSAGE` 命中 → 视为已退款（AC-1a 并发幂等）（L337-344）；其他失败 → **不删行**，返回 502 `code:"REFUND_FAILED_RETRYABLE"`（L345-359，Amendment 1） | |
| (b) credit 回补 + 删行 | **同一事务**内：删 invitationUses → `reverseRedemptionForRegistration`（先回补）→ 删报名行（后删，F6：redemption 行 FK 引用报名行，先删会 500）→ 计数递减（L369-404） | |
| 删行竞态 | 返回 404（`REGISTRATION_DELETE_RACE` 回滚回补）（L389-392, 406-416） | |
| **返回** | `refundedMoney`（真实值）、`reversedCredit`、`alreadyRefunded`（L429-439） | |

### 1.4 post-reveal 分支（`cancelPostRevealNoRefund`，L444-646）

与本次 P0a 无关（`noRefundAfterReveal` 独立 flag，默认 off）。要点：forfeit 费用 + 诚实组态（memberCount 递减 / event_attendance cancelled / collapse<4 触发 stayer 退款 via `REFUND_CONTEXTS.collapsed`）。**注意**：两 flag 独立（featureFlags.ts L326-340 注释 + 测试 `poolRegistrationCancelFlow.test.ts:393-405`「independent rollback」）——单独开 `preRevealRefundEnabled` **不会**改变 matched 后取消行为。

---

## 2. 关键裁决：flag 关时收银台承诺行不可见（证据链）

`RefundGuaranteeLine` 的 `visible` 来源完整调用链（自底向上）：

1. **`RefundGuaranteeLine.tsx:12-13`**：`if (!visible) return null` —— `visible=false` 渲染 null tree。
2. **`event-ticket-payment/index.tsx:1428`**：`<RefundGuaranteeLine visible={preRevealRefundEnabled} />`。
3. **`event-ticket-payment/index.tsx:201`**：`const { checkoutSubscriptionUpsellEnabled, preRevealRefundEnabled } = resolvePaymentCheckoutFlags(user)`。
4. **`ticketHelpers.ts:48-55`**（`resolvePaymentCheckoutFlags`）：`preRevealRefundEnabled: features.preRevealRefundEnabled === true` —— **严格 `=== true`，absent/undefined/非布尔一律 false**（fail-closed）。
5. **服务端暴露**：`buildAuthUserResponse.ts:231` `getFeatureFlag('preRevealRefundEnabled', false)` → 写入 `features.preRevealRefundEnabled`（L367）。
6. **flag 注册 + 默认值**：`featureFlags.ts:333` `preRevealRefundEnabled: "PRE_REVEAL_REFUND_ENABLED"`；`featureFlags.ts:610` `DEFAULT_FLAG_VALUES.preRevealRefundEnabled = false`。

**结论（确定）**：flag 关（默认）时，`features.preRevealRefundEnabled === false` → `resolvePaymentCheckoutFlags` 返回 false → `visible=false` → `RefundGuaranteeLine` 渲染 **null tree**，`「排桌完成前取消，全额退款」` **不可见**。

> **含义**：回滚（flag 关）时**无需**额外联动隐藏该行——它已绑定同一 flag，flag 关即自动隐藏。收银台这一面在 flag 关时是「既无退款、也无承诺」，**没有承诺 gap**。

锁定测试证据：
- `RefundGuaranteeLine.render.test.tsx:14/22/26`（visible=true 显示、false/undefined 不显示「全额退款」）。
- `ticketHelpers.test.ts:369-370`（pageSource 含 `<RefundGuaranteeLine visible={preRevealRefundEnabled}`）。
- `checkoutSubscriptionUpsellFlag.test.ts:65-67`（注册键 + 默认 false 锁定）。

---

## 3. 相关发现：一处**未联动**的承诺行（真正的残留 gap）

除收银台外，还有第二处「全额退款」承诺文案，**不受任何 flag 控制**：

- **文件**：`apps/mini-program/src/pages/pool-registration/components/RegistrationConfirmModal.tsx`
- **位置**：L102-105，`rows` 数组**硬编码**：`{ key: 'cancel', main: '排桌完成前可免费取消 · 全额退款' }`
- **证据**：组件 props（L7-28）**无任何 flag 字段**；`rows` 数组无条件构建；渲染于 `pool-registration/index.tsx:1255`。
- **测试锁定**：`RegistrationConfirmModal.test.tsx:50,118` 断言该文案存在（且与 flag 无关）。

**影响面**：这是**订座确认弹层**（用户点「确认订座」前看到的信任行）。当 `preRevealRefundEnabled` 关时，此弹层仍承诺「免费取消·全额退款」，但服务端 legacy 行为是「只删行、不退钱」。也就是说，**「承诺 gap」真实存在，但它不在收银台 `RefundGuaranteeLine`，而在订座确认弹层 `RegistrationConfirmModal`**。

> 注意：这是 **pre-Phase-0 就存在**的文案（非本 sprint 引入）。开 `preRevealRefundEnabled` 会**修复**收银台面的 gap，但**不会**自动让这处弹层文案与行为对齐——它本来就不受 flag 控制。按纪律本备忘只记录、不改。

---

## 4. `smoke:auto-refund` 结果（dev DB 自清理）

命令：`npm run smoke:auto-refund -w @joyjoin/server`

```text
=== Auto-refund smoke (run 1792504965357) ===

✅ PASS seed: grant remaining = 2 after 1 consumption — remaining=2
✅ PASS seed: redemption row exists
[AutoRefund] run complete  context:"seat_not_allocated"  refundedPayments:1  refundedCredits:0  skippedRefunds:2  failedCount:0
✅ PASS B: unmatched money refunded (payC only) — refundedPayments=1
✅ PASS B: unmatched credits untouched — refundedCredits=0
✅ PASS B: zero failures — []
✅ PASS B: payment C status → refunded — status=refunded
✅ PASS B: seat-not-allocated notification created
✅ PASS B: free unmatched user notified exactly once — count=1
✅ PASS B: free copy is not 场次未成行
[AutoRefund] run complete  context:"pool_cancelled"  refundedPayments:1  refundedCredits:1  failedCount:0
✅ PASS A: remaining money refunded (payA only) — refundedPayments=1
✅ PASS A: credit restored count — refundedCredits=1
✅ PASS A: zero failures — []
✅ PASS A: payment A status → refunded — status=refunded
✅ PASS A: refundAttempts row recorded — {"status":"success","initiatedBy":"auto-refund"}
✅ PASS A: user notification created — {"type":"pool_cancelled_refund","title":"活动取消，报名费已退回"}
✅ PASS A: grant credit restored (+1 → 3) — remaining=3
✅ PASS A: redemption row removed
✅ PASS A: coupon usage row removed — count=0
✅ PASS A: user coupon restored to unused — {"isUsed":false,"usedAt":null}
✅ PASS A: coupon used_count decremented to 0 — usedCount=0
[AutoRefund] run complete  refundedPayments:0  refundedCredits:0  failedRefunds:[]  skippedRefunds:0  reason:"pool_cancelled"
✅ PASS A: re-run is a no-op — {"refundedPayments":0,"refundedCredits":0,...}
✅ PASS B: re-run is a no-op — {...}
✅ PASS B: free notice still exactly once after re-run — count=1
✅ PASS B: paid notice still exactly once after re-run — count=1
[AdminAudit] action:"PAYMENT_REFUND_INITIATED"  triggerA:{refundedPayments:1,refundedCredits:1,failedRefunds:0}  triggerB:{refundedPayments:1,refundedCredits:0,failedRefunds:0}

🧹 cleanup done
=== Smoke result: ALL PASS ===
```

**读法**：此 smoke 走的是**场次未成行 auto-refund** 管线（Trigger A cancel + Trigger B unmatched），但它复用的正是 pre-reveal 分支将启用的**同一条退款铁轨**：
- `paymentsRepo.claimPaymentForRefund`（原子 claim，`paymentsRepo.ts:332-338`，`completed→refund_pending`，WHERE 锁 `status='completed'` 保证单次）
- `paymentService.createRefund` / `paymentFulfillmentRepo.finalizeRefundedPayment`
- `eventCreditsRepo.reverseRedemptionForRegistration`（`eventCreditsRepo.ts:268-312`，delete-first 原子 claim + grant `+1` + 过期顺延 7 天）
- **幂等**：re-run no-op（`refundedPayments:0`），退款/通知各恰好一次。

即：**底层退款/回补机械在 dev DB 上已验证为绿且幂等**，为 flag ON 后的 `pre_reveal_refund` 分支提供间接但直接的信心。

---

## 5. flag ON 后的预期行为 + 安全性裁决

### 5.1 flag ON 预期（`preRevealRefundEnabled = true`，`noRefundAfterReveal` 保持 false）

- 揭示前取消（`matchStatus !== "matched"`，非 test pool）→ `pre_reveal_refund` 分支：
  - 钱：真实单走 `createRefund`（原子 claim → WeChat 退款 → refundAttempts pending）；MOCK 单直接 `finalizeRefundedPayment`。
  - credit：同事务内先回补再删行。
  - 幂等：并发/重复取消 → `alreadyRefunded=true` 视为成功；re-run no-op。
  - 退款失败 → 不删行，返回 502 `REFUND_FAILED_RETRYABLE`（用户可重试，不会「钱没退、名却没了」）。
- 揭示后取消（`matchStatus === "matched"`）→ **仍 legacy**（`noRefundAfterReveal` 关），行为不变。
- DTO：`computeRegistrationCancelPolicy` 开始对揭示前报名返回 `"refundable"`（此前为 `undefined`）；收银台 `RefundGuaranteeLine` 变为可见。

### 5.2 回滚风险（开了再关的「承诺 gap 回旋镖」）

1. **收银台 `RefundGuaranteeLine`**：关 flag → 行自动隐藏。**无回旋镖**。
2. **订座确认弹层 `RegistrationConfirmModal`**：这行**从未受 flag 控制**。开 flag 前它已承诺「免费取消·全额退款」而服务端不退钱；关 flag 后它依然如此。所以「开了再关」只是**回到现状**，不会比现在更糟——真正的 gap 是**现状本身**，应在 P0d 或后续 sprint 一并处置（联到同一 flag 或改文案）。
3. **行为原子性**：`pre_reveal_refund` 分支的退款失败会 abort 删行（retryable），不会出现「收了退款请求但行已删、钱未退」的中间态；`claimPaymentForRefund` 的原子 claim 保证同一支付不会重复发起 WeChat 退款。

### 5.3 裁决：**可以开**（有前置条件）

- ✅ 服务端行为已就绪且与承诺行同源联动（收银台面）。
- ✅ 底层退款/回补/幂等铁轨 smoke 全绿。
- ✅ flag-off 严格 fail-closed（`=== true` 判定，absent 读 false）。
- ✅ 揭示后取消不受影响（两 flag 独立，`noRefundAfterReveal` 保持关）。

**前置（非阻塞，建议在开之前登记/处置）**：
1. **登记 §3 未联动承诺行**（`RegistrationConfirmModal`）——这是 AC-03「flag ON」与 AC-06「P0d 叙事层」之间的已知残留，避免开 flag 后误以为「承诺面已全部对齐」。
2. **开 flag 走人类 `/admin/feature-flags`**（super_admin），admin audit log 证据入档（AC-03 要求）。
3. **staging 复演**：matched 前取消 → 真实退款证据（AC-03 要求）。

---

## 6. 边界与未尽项

- 本备忘只覆盖 P0a 验证；flag ON 的人工执行、staging 复演、P0d 50/50 叙事层、P0b 埋点、P0c/P0e/P1a/P1c 均在合同其他 AC，不在此列。
- 未改动任何业务文件；未 commit / push。
- 关键代码锚点（供复核）：`poolRegistrationCancel.ts` L110-121 / L177-187 / L214-276 / L280-440 / L444-646；`featureFlags.ts` L326-340 / L610；`buildAuthUserResponse.ts` L231；`ticketHelpers.ts` L48-55；`RefundGuaranteeLine.tsx` L12-13；`RegistrationConfirmModal.tsx` L102-105。
