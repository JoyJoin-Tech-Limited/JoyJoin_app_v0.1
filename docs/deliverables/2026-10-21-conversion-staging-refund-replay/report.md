# 转化 Sprint S2.4 — Staging 复演报告：matched 前取消 → 全额退款真实证据（AC-03 收尾项）

- 日期：2026-10-21
- 执行：QA Agent（子会话）出方案与判定，主会话代跑 CVM 命令（本会话 runtime 无 shell/SSH 工具，已留痕）
- 范围：staging only（CVM 1.12.243.104，容器 joyjoin-api-staging / postgres-staging，库 joyjoin_staging）。**生产容器与生产库全程零接触**（所有命令可审计：docker 目标均 *-staging 后缀，psql 均 -d joyjoin_staging）。
- 纪律：不改代码、不 commit、不重启容器；staging 写入最小化且全部自清理（L2.8 归零断言全过）。

> **脱敏说明（2026-10-22）**：本文档已移除竞对名称与内部项目代号。文档层统一以中性代号 `CNV` 指代对标项目；staging 内的历史种子/互锁串实值仍为原始代号，文中引用已同步替换（如 `QA_CNV_…`、`CONFIRM_STAGING_REPLAY=CNV-S2.4`），因此与当时真实命令不再逐字一致。复核时请用**日期目录名与输出文件时间戳**定位原始证据，不要按代号字面值 grep。代码与运行时行为未受影响。

---

## 0. 结论：✅ PASS（Level B 全证）＋ 1 项真机待补

**「flag ON 时 matched 前取消 = 走真实全额退款分支」已在 staging 生产形态部署下全链复演成功。** 分支命中、原子 claim、**真实微信支付退款 API 被调用**（微信侧真实应答 404 RESOURCE_NOT_EXISTS）、Amendment 1 优雅降级（报名保留可重试）、幂等重试、matched 边界对照——全部取证。

**唯一未证项**：真实资金 ¥0.01 退回用户钱包（需要微信客户端完成真实支付动作，无头不可脚本化）。该缺口与本次复演证明的命题正交：本次证明的是「取消路径会真实发起全额退款」；资金落账由微信 REFUND.SUCCESS webhook 处理（代码路径已被 smoke:auto-refund 在 dev DB 覆盖），残余风险极低，用 §6 真机 3 步操作卡在启用前补一刀即可。

**PASS 等级定义**：
- ~~Level A（历史真实已支付单全链退款）~~ — **不可行**：staging 现存 7 笔历史真实 ¥0.01 completed 单全部报名/池列为空（孤儿 payments，L1 输出 L118-208），未来 6h+ 可报名池为 0（L218）。
- **Level B（本报告达成）**：flag 分支命中 + 真实微信 API 调用 + 降级语义 + 幂等 + 边界全证。
- Level A'（真机 3 步卡，§6）：资金真实回转的最后一块，建议 S5 启用前完成。

---

## 1. 证据清单（全部 file:line 可复查）

输出文件（同目录）：
- `l1-recon-output-20261021-154156.txt`（侦察，下称 **L1**）
- `l2-execute-output-20261021-154857.txt`（复演终跑，下称 **L2**；前两次跑为主会话修脚本 bug 的中间跑，已废弃）
- 脚本：`l0-recon.sh` / `l1-recon.sh` / `l2-execute.sh`（安全互锁 CONFIRM_STAGING_REPLAY=CNV-S2.4）

| # | 证据 | 出处 | 结果 |
|---|---|---|---|
| E1 | feature flag 在位：`preRevealRefundEnabled='true'`；`noRefundAfterReveal` 无行=关 | L1:3-12；L2:2-5 | ✅ |
| E2 | Level A 夹具不可用判定：7 笔历史真实 ¥0.01 单 registration/pool 全空 | L1:118-208 | ✅（决定降级） |
| E3 | 无宿主池：未来 6h+ 池 0 行 | L1:217-218 | ✅ |
| E4 | AC-9 预判：报名 DTO `cancelPolicy:"refundable"`（非 test 池 + pending + flag on） | L2:15-17 | ✅ |
| E5 | 取消响应：HTTP 502 + `{message:"退款失败，报名记录已保留，请稍后重试", code:"REFUND_FAILED_RETRYABLE"}` | L2:19-21 | ✅ |
| E6 | 日志-分支命中：`policy branch resolved ... "branch":"pre_reveal_refund"`（含 flags/matchStatus/isTestPool 全字段） | L2:26 | ✅ |
| E7 | 日志-真实微信 API 应答：`WeChat Pay API request failed (404): {"code":"RESOURCE_NOT_EXISTS","message":"订单不存在"}` —— **微信服务端真实返回** | L2:27 | ✅ |
| E8 | 日志-Amendment 1：`pre-reveal refund failed — aborting cancel, registration kept` | L2:27 | ✅ |
| E9 | DB：`refund_attempts` failed 行（reason=揭示前取消，全额退款、wechat_refund_id=RF…、amount=1、initiated_by=user-cancel） | L2:29-37 | ✅ |
| E10 | DB：原子 claim 已释放——payments 从 refund_pending 回 `completed` | L2:39-42 | ✅ |
| E11 | DB：报名保留（match_status 仍 pending） | L2:44-46 | ✅ |
| E12 | 幂等重试：二次 DELETE 仍 502，attempts=2 行，报名仍保留，无双重扣退 | L2:49-53 | ✅ |
| E13 | Level C 边界：改 match_status='matched' 后取消 → `policy:"legacy"`、HTTP 200、报名删除、退款零新增、payment 原封 completed —— **边界=registration.matchStatus**（noRefundAfterReveal 关不影响 pre-match 路径） | L2:55-61 | ✅ |
| E14 | 自清理归零：refund_attempts/payments/pools/sessions 4 项 expect-0 断言全过；首跑残留 1 user+1 pool 已手工补清 | L2:63-72 | ✅ |
| E15 | 生产零接触 | 命令历史（脚本全文） | ✅ |

---

## 2. 复演设计要点（为什么 502 是通过信号）

- 种子（全部 `QA_CNV_` 标识）：非 test 池 + QA 用户 + pending 报名 + completed 假单（wechat_order_id='QA_CNV_<ts>'）+ 铸造 session（`X-Session-Token` 头，staging cookie 名 `connect.sid_stg`）。
- `is_test_pool=false` 是硬要求：**test pool 走 legacy 分支跳过整个 Phase 0**（poolRegistrationCancel.ts L179-180）——任务背景里「test pool 豁免 POOL_FULL」仅适用于报名容量闸，不适用于取消。
- 假单号必然触发微信 404，恰好形成完美证据：`createRefund` 只有在**微信 API 真实受理后**才写 refund_attempts（paymentService.ts L814-838），因此 E7+E9 共同证明「真实退款请求已送达微信并被执行级处理」；Amendment 1 要求此时**不得删除报名**（E8/E11），与旧逻辑「钱没退成先把报名删了」形成行为对照。
- E13 顺带在种子上验证了 flag 矩阵的另一格：matched × noRefundAfterReveal=off → legacy（无退款、无报错、报名正常删除），坐实「揭示边界挂在报名的 matchStatus 上，而非 pool.matchedAt」。

---

## 3. 与 AC-03 其他证据的合流结论

| 证据 | 环境 | 覆盖命题 | 状态 |
|---|---|---|---|
| CNV 验证备忘（`docs/deliberations/2026-10-20-conversion-p0a-verification-memo.md`） | 本地/CI | flag on/off 分支矩阵、单元+集成层语义 | ✅ |
| `npm run smoke:auto-refund -w @joyjoin/server` | dev DB（真实 repo 层） | Trigger A/B 自动退款、credits 回补、幂等、MOCK 单 finalize | ✅ ALL PASS |
| **本复演（Level B）** | **staging 生产形态部署** | **真实 flag 行驱动分支命中、真实微信 v3 退款 API 接线、降级/幂等/边界行为、AC-9 DTO** | ✅ 本报告 |

三路证据合流：**从单元语义 → repo 层数据流 → 生产形态部署的真实 API 接线，AC-03「matched 前取消=全额退款」的实现正确性已闭环**。剩余唯一缺口是「资金真实落账」端到端（真机），其 webhook 处理路径（REFUND.SUCCESS → payments.refunded + attempts.success）已被 smoke 覆盖微信不可达侧之外的全部本地逻辑。

## 4. S5 合入门禁解除建议

1. **建议解除 S2.4/AC-03 的合入门禁**（Level B 达成，证据 E1-E15 齐）。
2. **保留一个启用前条件（非阻塞）**：S5 真实灰度前完成 §6 真机 3 步卡，拿到资金落账截图归档（微信「支付」退款通知 + payments.refunded 行）。若灰度窗口紧张，可将该卡并入首次真实用户取消的自然事件——届时按 §6 第 3 步同式取证即可。
3. 复演资产（脚本+输出）已留在 deliverables 目录，后续回归可直接重跑 `l2-execute.sh`（互锁+自清理，5 分钟出全量证据）。

---

## 5. 真机 3 步操作卡（Level A'，发给测试机主）

> 前提：体验版小程序（指向 staging.joyjoinapp.com）+ 真机微信可付 ¥0.01。

1. **报名支付**：发现页选一场未来 6 小时以上的真实局（标题不含 QA/测试）→ 报名 → 微信支付真实扣款 ¥0.01 → 截图「报名成功」页。
2. **matched 前取消**：报名后 10 分钟内（matching 跑批前）→ 我的 → 我的报名 → 取消报名 → 截图取消结果提示。
3. **到账取证**：1-5 分钟内微信「微信支付」服务通知出现 ¥0.01 退款到账 → 截图发 QA 群；QA 复核命令（CVM）：`docker logs joyjoin-api-staging --since 15m | grep REFUND` + `SELECT status FROM payments WHERE wechat_order_id LIKE 'JJ%'<该单>`（期望 refunded）+ `SELECT status FROM refund_attempts WHERE payment_id=...`（期望 success）。

任一步无法完成即停在当前步截图，不要重复支付。

---

## 6. 附录

### 6.1 执行实录时间线
- L0/L1 侦察：发现 schema 真实形态（feature_flags=key/value 文本布尔；payments 无 updated_at；refund_attempts=initiated_at/resolved_at）与「Level A 夹具不可用」。
- L2 首跑：主会话修复两个脚本 bug（`$SSH` 字符串 word-splitting → ssh_cvm() 函数式；psql INSERT..RETURNING 命令标签污染捕获 → -q），并手工清理首跑残留的 1 user+1 pool。
- L2 终跑（154857）：全部预期命中，归零断言全过。

### 6.2 关键代码锚点
- 分支矩阵：`apps/server/src/lib/poolRegistrationCancel.ts` L177-187（test pool → legacy L179-180）
- 退款 API 接线：`apps/server/src/paymentService.ts` createRefund L788-855（attempts 仅在 API 成功后写入 L831-838）
- 取消入口：`apps/server/src/routes/domains/userEventPools.ts` DELETE L1446-1507（响应含 policy 分支字段）
- AC-9 DTO：`computeRegistrationCancelPolicy` L110-121
- 幂等/原子 claim：`paymentsRepo.claimPaymentForRefund` / `releasePaymentRefundClaim`

### 6.3 复跑方法
```bash
CONFIRM_STAGING_REPLAY=CNV-S2.4 bash docs/deliverables/2026-10-21-conversion-staging-refund-replay/l2-execute.sh
```
