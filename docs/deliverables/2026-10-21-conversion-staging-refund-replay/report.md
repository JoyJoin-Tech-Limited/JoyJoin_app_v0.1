# 转化 Sprint S2.4 — Staging 复演报告：matched 前取消 → 全额退款真实证据（AC-03 收尾项）

- 日期：2026-10-21
- 执行人：QA Agent（子会话）
- 范围：staging only（CVM 1.12.243.104，容器 joyjoin-api-staging / postgres-staging，库 joyjoin_staging）。生产容器与生产库零接触。
- 任务约束：不改代码、不 commit、不重启容器；staging 写入最小化且自清理。

---

## 0. 状态：⏸ BLOCKED-ON-ACCESS（等待接入决定）

**阻塞证据**：本会话 runtime 的工具目录中不存在 shell/SSH/终端工具（已在 Code Mode catalog 中分别检索 ssh / shell / terminal / exec / spawn / pty / run command / remote / deploy 等关键词，返回均为 browser / filesystem / memory 类工具；MCP resources 列表为空）。本地文件系统可读、公网 HTTPS 可访，但：

- staging Postgres 只绑定 CVM 回环 `127.0.0.1:5433`（deployment/docker-compose.staging.yml L24-25），公网不可达；
- staging 用户态 API 需要 session（APP_MODE=staging 仅微信登录，无密码登录）；
- `/api/test/admin/*` 需要 staging admin super_admin 会话（N1 修复后 fail-closed）。

因此 DB 侦察、夹具种子、session 铸造均无法在本会话内执行。**代码级核实已全部完成（§1），可执行 runbook 已就绪（§2–§5），接入方式一旦确定即可在分钟级跑完全部等级。**

---

## 1. 代码级核实结论（本地完成，无需 staging）

### 1.1 分支矩阵（apps/server/src/lib/poolRegistrationCancel.ts L177-187）

| 条件 | 分支 | 行为 |
|---|---|---|
| pool.is_test_pool = true | **legacy** | **跳过整个 Phase 0**（AC-5）——不退款、无 refund_attempts |
| matchStatus='matched' + noRefundAfterReveal=on | post_reveal_no_refund | 不退款 + 组状态诚实化 |
| matchStatus≠'matched' + preRevealRefundEnabled=on | **pre_reveal_refund** | 真实全额退款 + 删除报名 |
| 其余（任一 flag off） | legacy | 与 Phase 0 前逐字节一致 |

> ⚠️ **对任务背景的关键修正**：「test pool 豁免 POOL_FULL」只适用于报名容量闸（poolRegistrationRules.ts）。**复演 cancel 必须用 is_test_pool=false 的真实池**——否则 cancel 走 legacy 分支，什么退款证据都不会产生。

### 1.2 pre_reveal_refund 的退款机制（paymentService.createRefund，L788-855）

1. `paymentsRepo.claimPaymentForRefund` 原子 claim（completed → refund_pending），防并发双退（AC-1a）；
2. 真实调用微信支付 v3 `POST /v3/refund/domestic/refunds`，body = { out_trade_no: payments.wechat_order_id, out_refund_no: RF<ts><id>, amount.refund=total=finalAmount }；
3. **仅当微信支付 API 返回成功后**才写 refund_attempts（status='pending'）——所以 **refund_attempts 出现 pending/success 行 = 微信侧真实受理了退款的充分证据**；
4. 之后 WeChat `REFUND.SUCCESS` webhook → payments.status='refunded' + refund_attempts pending→success（异步，秒级）。

结论：**要拿到「真实退款成功」证据，wechat_order_id 必须是微信侧真实存在且已支付的订单**（staging ¥0.01 测试单）。无头脚本无法完成 wx 客户端支付动作 → 见 Level A' 真机操作卡。

### 1.3 取消入口与响应

- `DELETE /api/pool-registrations/:id`（userEventPools.ts L1446）→ 成功响应 `{ ok: true, cancelledRegistrationIds: [...], policy: "pre_reveal_refund" }` —— **`policy` 字段即分支命中证据**。
- 失败（退款 API 失败）：502 `{ message: "退款失败，报名记录已保留，请稍后重试", code: "REFUND_FAILED_RETRYABLE" }` —— Amendment 1 语义：报名保留、可重试。
- AC-9 cancelPolicy DTO：`GET /api/my-pool-registrations` 每条报名带 `cancelPolicy: "refundable" | "non_refundable"`（flag on + 非 test pool 时才出现该字段）——**取消前的 refundable 预判证据**。

### 1.4 staging 鉴权解锁（无需微信、无需 cookie 签名）

- staging cookie 名 `connect.sid_stg`（lib/sessionCookieName.ts，防生产域 cookie 串扰）；
- **`X-Session-Token: <sid>` 请求头**（routes.ts L109-122）：服务器用 SESSION_SECRET 自行签 cookie 并从 `sessions` 表恢复会话——小程序真机本来就这么干；
- 因此只需在 joyjoin_staging.`sessions` 表插一行 `{ sid, sess: {"cookie":{...},"userId":"<uuid>"}, expire }` 即获得任意测试用户的完整用户态。SESSION_SECRET 无需知道（服务端代签）。

### 1.5 日志锚点（docker logs joyjoin-api-staging 检索词）

- `[MyPoolRegistrationsCancel] route hit` / `attempting to delete registration`
- `policy branch resolved`（带 branch / flags / matchStatus 字段）
- `pre-reveal cancel with refund complete`（refundedMoney / reversedCredit）
- `pre-reveal refund failed — aborting cancel, registration kept`（降级路径证据）
- `WeChat Pay API request failed (404)`（假单触发真实 API 的证据）
- `REFUND.SUCCESS` / refund webhook 处理行（handleSuccessfulRefund 附近）

---

## 2. Level 0 侦察（只读，SSH 恢复后第一步）

```bash
SSH="ssh -i ~/Desktop/Business\ idea/JoyJoin/SSH/OpenCode.pem root@1.12.243.104"

# 0.1 只碰 staging 容器，确认在位（严禁 joyjoin-api / postgres 生产容器）
$SSH 'docker ps --format "{{.Names}}	{{.Status}}" | grep staging'

# 0.2 feature flag 行（确认 2026-10-21 已开 + noRefundAfterReveal 无行=关 → 顺带完成 Level C 前置证明）
$SSH 'docker exec postgres-staging psql -U joyjoin -d joyjoin_staging -c   "SELECT key, enabled, updated_at FROM feature_flags WHERE key IN ($$preRevealRefundEnabled$$,$$noRefundAfterReveal$$);"'

# 0.3 历史真实 ¥0.01 已支付单 + 关联报名的 pre-match 状态（Level A 夹具）
$SSH 'docker exec postgres-staging psql -U joyjoin -d joyjoin_staging -c   "SELECT p.id AS payment_id, p.user_id, p.related_id AS pool_id, p.wechat_order_id,           p.status, p.final_amount, p.created_at,           r.id AS registration_id, r.match_status, ep.is_test_pool, ep.title    FROM payments p    LEFT JOIN event_pool_registrations r ON r.pool_id = p.related_id AND r.user_id = p.user_id    LEFT JOIN event_pools ep ON ep.id = p.related_id    WHERE p.payment_type = $$event$$ AND p.status = $$completed$$      AND p.final_amount = 1 AND p.wechat_order_id NOT LIKE $$MOCK_%$$    ORDER BY p.created_at DESC LIMIT 20;"'

# 0.4 未来可报名的非 test 池（若无历史夹具则评估新造）
$SSH 'docker exec postgres-staging psql -U joyjoin -d joyjoin_staging -c   "SELECT id, title, is_test_pool, date_time, total_registrations, max_group_size*target_groups AS capacity    FROM event_pools WHERE date_time > now() + interval $$6 hours$$    ORDER BY date_time ASC LIMIT 10;"'
```

**决策**：0.3 若返回「completed + pre-match（pending/unmatched/null）+ is_test_pool=false」的行 → 走 **Level A**；否则 → **Level B（降级）** + Level A' 真机卡。

---

## 3. Level A — 真实退款全链（最高证据）

前置：Level 0.3 找到可用历史夹具（真实已支付 ¥0.01、未排桌、非 test pool）。该报名属历史 QA 遗留数据则退款+删除即自清理。

```bash
# A.1 铸造目标用户会话（staging DB 单行写入，演完即删）
$SSH 'docker exec postgres-staging psql -U joyjoin -d joyjoin_staging -c   "INSERT INTO sessions (sid, sess, expire) VALUES ($$benchmarks24-<ts>$$,    jsonb_build_object($$cookie$$, jsonb_build_object($$path$$,$$/$$,$$httpOnly$$,true,$$secure$$,false),                      $$userId$$, $$<夹具user_id>$$),    now() + interval $$2 hours$$) ON CONFLICT (sid) DO NOTHING;"'

# A.2 AC-9 预判证据：cancelPolicy 应为 refundable
curl -s https://staging.joyjoinapp.com/api/my-pool-registrations   -H "X-Session-Token: benchmarks2x4-<ts>" | jq '.[] | select(.id=="<registration_id>") | {id, matchStatus, cancelPolicy}'

# A.3 执行取消（真实分支命中 + 真实微信退款 API）
curl -s -X DELETE https://staging.joyjoinapp.com/api/pool-registrations/<registration_id>   -H "X-Session-Token: benchmarks2x4-<ts>"
# 期望：{"ok":true,"cancelledRegistrationIds":["..."],"policy":"pre_reveal_refund"}

# A.4 日志证据（分支 + 微信 API + webhook）
$SSH 'docker logs joyjoin-api-staging --since 10m 2>&1 | grep -E "MyPoolRegistrationsCancel|policy branch|pre-reveal|REFUND"'

# A.5 DB 终态证据（退款异步落定：先 refund_pending，webhook 后 refunded）
$SSH 'docker exec postgres-staging psql -U joyjoin -d joyjoin_staging -c   "SELECT id, status, wechat_order_id, updated_at FROM payments WHERE id=$$<payment_id>$$;"'
$SSH 'docker exec postgres-staging psql -U joyjoin -d joyjoin_staging -c   "SELECT payment_id, status, reason, wechat_refund_id, amount, initiated_by, created_at    FROM refund_attempts WHERE payment_id=$$<payment_id>$$ ORDER BY created_at;"'
# 期望：payments.status=refunded；refund_attempts 1 行 status=success、reason=揭示前取消，全额退款、amount=1

# A.6 报名已删 + 池计数回减
$SSH 'docker exec postgres-staging psql -U joyjoin -d joyjoin_staging -c   "SELECT count(*) FROM event_pool_registrations WHERE id=$$<registration_id>$$;"'

# A.7 清理：删除铸造的 session 行（报名/支付行已被 cancel 语义本身消耗，历史遗留数据已妥善处理）
$SSH 'docker exec postgres-staging psql -U joyjoin -d joyjoin_staging -c   "DELETE FROM sessions WHERE sid=$$benchmarks2x4-<ts>$$;"'
```

**Level A 通过信号**：A.3 响应 policy=pre_reveal_refund ∧ A.5 payments=refunded ∧ refund_attempts success(amount=1) ∧ A.4 日志链完整。

---

## 4. Level B — 降级：flag 分支命中 + 真实退款 API 调用证据（无需真机）

当 Level 0.3 无历史真实已支付单时执行。种子行全部带 `QA_BENCH_<ts>` 标识，演完即删。

```bash
# B.1 种子：非 test 池 + 用户 + pre-match 报名 + completed 支付单（假 out_trade_no）
$SSH 'docker exec postgres-staging psql -U joyjoin -d joyjoin_staging <<SQL
INSERT INTO event_pools (id, title, event_type, city, created_by, date_time, registration_deadline, is_test_pool, total_registrations)
VALUES ('qa-bench-pool-<ts>', 'QA_BENCH 复演池 <ts>', '饭局', '深圳', (SELECT id FROM users LIMIT 1), now()+interval '2 days', now()+interval '1 day', false, 1);
-- 若需新用户：INSERT INTO users (id, phone_number, first_name, last_name, ...) VALUES ('qa-bench-user-<ts>', ...);
INSERT INTO event_pool_registrations (id, pool_id, user_id, match_status) VALUES ('qa-bench-reg-<ts>', 'qa-bench-pool-<ts>', '<user_id>', 'pending');
INSERT INTO payments (id, user_id, payment_type, related_id, original_amount, discount_amount, final_amount, wechat_order_id, status)
VALUES ('qa-bench-pay-<ts>', '<user_id>', 'event', 'qa-bench-pool-<ts>', 1, 0, 1, 'QA_BENCH_<ts>', 'completed');
SQL'

# B.2 同 A.1 铸造 session（userId=<user_id>）

# B.3 AC-9 预判：cancelPolicy=refundable（同 A.2）

# B.4 执行取消 → 期望 502：
#   {"message":"退款失败，报名记录已保留，请稍后重试","code":"REFUND_FAILED_RETRYABLE"}
# 含义：flag 分支命中 → 原子 claim 成功 → 真实调用微信退款 API（假单 404 RESOURCE_NOT_EXISTS）→
#       按 Amendment 1 释放 claim + 记 failed attempt + 报名保留可重试
curl -s -X DELETE https://staging.joyjoinapp.com/api/pool-registrations/qa-bench-reg-<ts>   -H "X-Session-Token: benchmarks2x4-<ts>"

# B.5 DB 证据：failed attempt 行（wechat_refund_id=RF...、amount=1）+ payments 回 completed（claim 已释放）+ 报名仍在
$SSH 'docker exec postgres-staging psql -U joyjoin -d joyjoin_staging -c   "SELECT status, reason, wechat_refund_id, amount FROM refund_attempts WHERE payment_id=$$qa-bench-pay-<ts>$$;"'

# B.6 日志证据：policy branch resolved=pre_reveal_refund + WeChat Pay API request failed (404) + aborting cancel
$SSH 'docker logs joyjoin-api-staging --since 10m 2>&1 | grep -E "policy branch|pre-reveal refund failed|WeChat Pay API request failed"'

# B.7 幂等重试证据（Amendment 1：报名保留 → 同一 DELETE 可重试且不产生双退）
curl -s -X DELETE ...  # 再次调用，仍 502，refund_attempts 增加第二条 failed 行

# B.8 清理（cascade 纪律：先子后父，全部 QA_BENCH 标识行）
$SSH 'docker exec postgres-staging psql -U joyjoin -d joyjoin_staging <<SQL
DELETE FROM refund_attempts WHERE payment_id IN (SELECT id FROM payments WHERE wechat_order_id LIKE 'QA_BENCH_%');
DELETE FROM event_pool_registrations WHERE id LIKE 'qa-bench-reg-%';
DELETE FROM payments WHERE wechat_order_id LIKE 'QA_BENCH_%';
DELETE FROM event_pools WHERE id LIKE 'qa-bench-pool-%';
DELETE FROM users WHERE id LIKE 'qa-bench-user-%';
DELETE FROM sessions WHERE sid LIKE 'benchmarks2x4-%';
SQL'
```

**Level B 通过信号**：502+REFUND_FAILED_RETRYABLE ∧ refund_attempts failed 行 ∧ 日志命中分支 ∧ 报名保留可重试。此等级证明「flag ON → pre-match cancel 命中退款分支并真实调用微信 API」，但**资金真实回转需 Level A/A' 补证**。

---

## 5. Level A' — 真机 3 步操作卡（资金真实回转的最高证据，发给测试机主）

> 前提：体验版小程序（开发版已指向 staging.joyjoinapp.com）+ 真机微信可付 ¥0.01。

1. **报名支付**：发现页选一场未来 6 小时以上的真实局（标题不含「测试」、非调试局）→ 走报名 → 微信支付真实扣款 ¥0.01 → 截图「报名成功」页（含局标题）。
2. **matched 前取消**：报名后 10 分钟内（matching 跑批前）→ 我的 → 我的报名 → 该局 → 取消报名 → 截图取消确认与结果提示。
3. **到账取证**：1–5 分钟内微信「微信支付」服务通知出现 ¥0.01 退款到账消息 → 截图；把两张截图发 QA 群。

QA 侧复核（收到截图后，同 Level A 的 A.4–A.6 三行命令）：日志 refund 链 + payments=refunded + refund_attempts success(amount=1)。三步中任一步无法完成即停在当前步截图，不要重复支付。

---

## 6. Level C — 回归对照（noRefundAfterReveal 关闭不影响 matched 前路径）

Level C 无需额外动作即已内嵌：
- Level 0.2 的 SQL 输出证明 `noRefundAfterReveal` 无行（=关）；
- Level A/B 的取消在**该 flag 关**的前提下仍命中 `pre_reveal_refund` —— 与代码矩阵一致（pre-match 分支只读 `preRevealRefundEnabled`，边界是 **registration.matchStatus** 而非 pool.matchedAt）。

可选强化（种子数据上，2 分钟）：把 Level B 种子报名的 matchStatus 改为 'matched' 再取消 → 期望 `policy:"legacy"` 且无退款无报错（flag 关 → matched 走 legacy），直接坐实边界语义。

---

## 7. 证据清单

| # | 证据 | Level A | Level B | 状态 |
|---|---|---|---|---|
| E1 | feature_flags 行（preRevealRefundEnabled=on，noRefundAfterReveal 无行） | ✓ | ✓ | ⏳ 待 Level 0.2 |
| E2 | cancelPolicy="refundable"（AC-9 DTO，取消前） | ✓ | ✓ | ⏳ 待 A.2/B.3 |
| E3 | 取消响应 policy="pre_reveal_refund" | ✓ | （502 响应+code） | ⏳ |
| E4 | docker logs：policy branch resolved + pre-reveal complete/failed | ✓ | ✓ | ⏳ |
| E5 | refund_attempts 行（success / failed，amount=1） | ✓ success | ✓ failed | ⏳ |
| E6 | payments completed → refund_pending → refunded | ✓ | n/a（回滚 completed） | ⏳ |
| E7 | 微信退款 API 真实调用（B：404 应答摘录） | ✓ 受理即证 | ✓ | ⏳ |
| E8 | ¥0.01 真实资金回转（真机退款通知截图） | ✓（A'） | ⏳ 待真机 | ⏳ |
| E9 | 报名删除 + 池计数回减 | ✓ | ✓（保留，幂等重试后删） | ⏳ |
| E10 | 清理确认（QA_BENCH 标识行 0 残留 + session 行删除） | ✓ | ✓ | ⏳ |

## 8. 清理确认（执行后勾选）

- [ ] sessions 表 `benchmarks2x4-%` 行已删
- [ ] Level B 种子（QA_BENCH 标识）全部删除且 count=0 复核
- [ ] Level A 铸造 session 已删；历史夹具报名已被 cancel 语义正常消耗（退款到账）
- [ ] 生产容器/生产库全程零接触（命令历史可审计：所有 docker exec 均带 `-staging` 后缀、psql 均 `-d joyjoin_staging`）

## 9. 待补输入（阻塞解除所需）

1. SSH 执行通道（推荐：父会话/用户按 §2–§6 回贴输出；或为本会话开放 shell 工具）。
2. 若无 SSH：至少提供 staging admin super_admin 凭据（仅可完成 Level 0.2 的 flag 核实 + 夹具查询无法做——不推荐，不足以完成 cancel 复演）。
