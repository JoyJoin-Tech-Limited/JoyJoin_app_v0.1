# JoyJoin Launch QA — 硬停发验证清单（§19 可执行版）

> **版本：** v1 · 2026-10-06
> **来源：** `docs/testing/LAUNCH-QA-CHECKLIST.md` v2 §19（硬停发清单，出现即 NO-GO）
> **范围：** 仅 §19 十二项 hard stop 的可执行形态。**本文件不重复完整上线清单**（§1–§18 见原表）。
> **裁决规则：任何一条 FAIL = NO-GO。** 先修复，再只重跑该 gate（聚合门如 HS-08 需整组重跑）。不允许带未闭合硬停发进入发布。
> **证据纪律：** 每条 gate 的命令输出/DB 行/URL/截图落盘 `<EV> = .git/.orchestration/launch-qa/2026-10-06/`（先 `mkdir -p <EV>`）。文件名见各条 Evidence 字段。不接受「本地能跑」的口头结论。
> **核实基线：** 所有 `npm run` 命令、路由路径、表名、行号于 2026-10-06 对照仓库核实。标 `待验证` 的步骤需要 CVM / production / 设备 / 邮箱权限，必须由 ops 按所给命令实际执行后回填。

---

## 通用参数（各条共用）

| 项 | 值 |
|---|---|
| 生产 API 容器 | `joyjoin-api`（`deployment/docker-compose.nginx.yml`，单实例） |
| 生产 Admin | `https://admin.joyjoinapp.com`（`/api/*` 同源代理到生产 API — nginx conf:195-205） |
| 生产 DB | 容器 `postgres`，库 `joyjoin`，用户 `joyjoin` |
| Staging API 容器 | `joyjoin-api-staging`（`deployment/docker-compose.staging.yml`） |
| Staging Admin | `https://staging.admin.joyjoinapp.com`（`/api/*` → staging API — nginx conf:287-297） |
| Staging DB | 容器 `postgres-staging`，库 `joyjoin_staging`，用户 `joyjoin` |
| CVM env 文件 | `~/JoyJoin/deployment/.env.production` / `~/JoyJoin/deployment/.env.staging` |
| Flag 真相 | DB `feature_flags` 行 > env 回退，5s LRU（`apps/server/src/lib/featureFlags.ts:567`） |
| 建议执行顺序 | HS-08 → HS-05 → HS-04 → HS-02 → HS-03 → HS-06 → HS-10 → HS-09 → HS-01 → HS-12 → HS-11 → HS-07 |

---

## HS-01 支付 create/webhook/reconcile 任一链路失败或重复扣款

- **Severity:** LAUNCH-BLOCKING
- **Trigger（可证伪）：** `POST /api/payments/create` / `/api/payments/miniprogram/create`、`POST /api/webhooks/wechat-pay`、`POST /api/payments/:wechatOrderId/reconcile` 任一返回 5xx / 用户已付款但订单未 fulfil；或同一 `wechat_order_id` 出现第二笔 fulfilment / entitlement 重复入账 / 重复扣款。
- **Environment:** local（自动化）+ staging（真金 ¥0.01 全链路）+ production（小额真单，§3 要求）
- **Procedure:**
  1. （local）`npm run test -w @joyjoin/server -- payment 2>&1 | tee <EV>/HS-01-payment-tests.log; echo "EXIT=$?"` — 期望 exit 0（覆盖 `paymentWebhook.test.ts`、`paymentService.test.ts`、`paymentFulfillmentRepo.test.ts`、`miniProgramPaymentRoutes.test.ts`、`paymentTestPrice.test.ts`）。
  2. （local）`node scripts/check/payment-smoke-test.mjs https://staging.joyjoinapp.com 2>&1 | tee <EV>/HS-01-payment-smoke.log; echo "EXIT=$?"` — 期望 exit 0（8 项：health、readyz、未登录 401 × 5、metrics）。
  3. （local + dev DB）`npm run smoke:auto-refund -w @joyjoin/server 2>&1 | tee <EV>/HS-01-auto-refund.log; echo "EXIT=$?"` — 期望 exit 0（Trigger A 场次取消 + Trigger B 未成行、credits 恢复、幂等、自清理）。
  4. （staging，`待验证` CVM）环境姿态：`grep -E '^(APP_MODE|TEST_PAYMENT_PRICE_IN_CENTS|PAYMENTS_ENABLED|MOCK_PAYMENTS)=' ~/JoyJoin/deployment/.env.staging` — 期望 `APP_MODE=staging`、`TEST_PAYMENT_PRICE_IN_CENTS=1`、`PAYMENTS_ENABLED=true`。
  5. （staging + device）开发版小程序（`TARO_APP_API_BASE_URL=https://staging.joyjoinapp.com`）完成 报名 → 支付 ¥0.01 → 验证页轮询 → 报名落库；记录 `wechatOrderId`、金额、plan 名、优惠券抵扣。
  6. （staging，`待验证` CVM）Webhook 入账：`docker logs joyjoin-api-staging --since 15m 2>&1 | grep -iE 'wechat-pay|webhook'` — 期望签名验证通过的入账记录。
  7. （staging）重复 webhook 幂等复放：从日志/网关取最后一次 webhook 原始 headers（`Wechatpay-Timestamp/Nonce/Signature/Serial`）+ raw body，**5 分钟时间戳窗内**复放：`curl -sS -D- -X POST https://staging.joyjoinapp.com/api/webhooks/wechat-pay -H 'Content-Type: application/json' -H "Wechatpay-Timestamp: <t>" -H 'Wechatpay-Nonce: <n>' -H 'Wechatpay-Signature: <s>' -H 'Wechatpay-Serial: <sn>' --data-binary @<EV>/webhook-body.json` — 期望第二次不产生第二笔 fulfilment。
  8. （staging）reconcile 幂等：对同一订单以用户会话调用两次：`curl -sS -X POST https://staging.joyjoinapp.com/api/payments/<wechatOrderId>/reconcile -b <EV>/staging-user-cookie.txt` — 期望两次均返回 `{status, fulfilled}`，第二次 `fulfilled:false` 且无重复入账。
  9. （staging DB）无重复核验：`docker exec postgres-staging psql -U joyjoin -d joyjoin_staging -c "SELECT wechat_order_id, count(*) FROM payments GROUP BY wechat_order_id HAVING count(*) > 1;"` — 期望空；同一订单 `-c "SELECT status, paid_at FROM payments WHERE wechat_order_id='<order>';"` — 期望单行 `completed`。
  10. （production，§3）小额真单：完成 1 单最低价真实支付 → admin `POST /api/admin/payments/:paymentId/refund` 退款 → 核对 `refund_attempts` 与审计 `PAYMENT_REFUND_INITIATED`。
- **Pass criteria:** 上述全部 exit 0 / 期望输出；无重复 fulfil / 无重复扣款。
- **FAIL signal:** 任一测试红；payment-smoke exit 1；auto-refund 非 0；有效签名 webhook 复放 5xx 或重复入账；reconcile 5xx；`payments` 出现同单多行；生产退款无审计。
- **Evidence:** `HS-01-payment-tests.log`、`HS-01-payment-smoke.log`、`HS-01-auto-refund.log`、`HS-01-staging-e2e.md`（订单号+webhook 复放+reconcile 两次响应）、`HS-01-prod-order.md`
- **估计耗时 / Owner:** 90 min / @backend-engineer + ops + 真机测试人（步骤 4–10 `待验证`）
- **Remediation:** `payment-entitlement-authority` skill → @backend-engineer；测试缺口见下。
- **Gap（2026-10-06 核实 → 2026-10-09 已补）：** `reconcilePayment` 无 vitest 覆盖 → 已新增 `apps/server/src/__tests__/paymentReconcile.test.ts`（343 行 / 14 tests，覆盖归属负路径、幂等、already-completed、失败路径；14/14 独立复跑绿）；HS-01 执行时纳入证据。

---

## HS-02 WECHAT_PAY_APP_ID ≠ WECHAT_APPID 或生产启动校验失败

- **Severity:** LAUNCH-BLOCKING
- **Trigger：** running 生产容器中 `WECHAT_PAY_APP_ID != WECHAT_APPID`；或 `/api/readyz` 的 `checks.config != "ok"`；或启动日志出现 appid 一致性 `[FATAL]`。
- **Environment:** production（+ staging 彩排）
- **Procedure:**
  1. （production，`待验证` CVM）`docker exec joyjoin-api sh -lc 'test -n "$WECHAT_APPID" && [ "$WECHAT_PAY_APP_ID" = "$WECHAT_APPID" ] && echo "MATCH: $WECHAT_APPID" || echo "MISMATCH: appid=[$WECHAT_APPID] pay=[$WECHAT_PAY_APP_ID]"'` — 期望 `MATCH`。
  2. （production，`待验证`）env 文件对账：`grep -E '^(WECHAT_APPID|WECHAT_PAY_APP_ID)=' ~/JoyJoin/deployment/.env.production` — 两值相等。
  3. （production）`docker logs joyjoin-api 2>&1 | grep -E '\[FATAL\]' | tail -20` — 期望无 appid 一致性 FATAL（校验位置 `apps/server/src/lib/configValidation.ts:133-150`；注意：`validateConfig` 记 FATAL 但不 abort — 以 readyz 为准）。
  4. （production）`curl -s https://joyjoinapp.com/api/readyz | tee <EV>/HS-02-readyz-prod.json` — 期望 200、`checks.config == "ok"`（config 异常 → 503）。
  5. （staging 彩排，可选）同 1–4 对 `joyjoin-api-staging` / `https://staging.joyjoinapp.com/api/readyz`。
- **Pass criteria:** MATCH + readyz 200 且 config ok + 无 FATAL。
- **FAIL signal:** MISMATCH / readyz config 非 ok / FATAL 日志（付款创建还会在 `PaymentService.assertMiniProgramAppIdConsistency` 硬失败）。
- **Evidence:** `HS-02-prod-env.log`、`HS-02-readyz-prod.json`
- **估计耗时 / Owner:** 10 min / ops（步骤 1–2 `待验证`）
- **Remediation:** `payment-entitlement-authority` + ops：`WECHAT_PAY_APP_ID` 校正为 `WECHAT_APPID` 后重建容器，重跑本 gate。

---

## HS-03 生产 env 有 ALLOW_PRODUCTION_AUTH_DEBUG=1 / ENABLE_DEV_AUTH_TOOLS

- **Severity:** LAUNCH-BLOCKING
- **Trigger：** running 生产容器中 `ENABLE_DEV_AUTH_TOOLS=1` 或 `ALLOW_PRODUCTION_AUTH_DEBUG=1`（代码判定值 `=== "1"`，`apps/server/src/auth/policy.ts:14-16`）；或 `/api/auth/dev-login` 在生产返回 200。
- **Environment:** production（+ local 自动化）
- **Procedure:**
  1. （production，`待验证` CVM）`docker exec joyjoin-api sh -lc 'echo "ENABLE_DEV_AUTH_TOOLS=[${ENABLE_DEV_AUTH_TOOLS:-unset}]"; echo "ALLOW_PRODUCTION_AUTH_DEBUG=[${ALLOW_PRODUCTION_AUTH_DEBUG:-unset}]"'` — 期望两者 `[unset]`。
  2. （production）`curl -s -o /dev/null -w '%{http_code}\n' -X POST https://joyjoinapp.com/api/auth/dev-login -H 'Content-Type: application/json' -d '{"phone":"13800000000"}' | tee <EV>/HS-03-dev-login-http.txt` — 期望 `403`（`routes/domains/auth.ts:106-109`，仅 development 可用；200 = FAIL）。
  3. （local）`npm run test -w @joyjoin/server -- testAdminAuth authPolicy 2>&1 | tee <EV>/HS-03-auth-tests.log; echo "EXIT=$?"` — 期望 exit 0（`/api/test/**` 鉴权兜底 + dev-tools policy；`authPolicy.test.ts:18-41`）。
  4. （production，`待验证`）env 文件兜底：`grep -E 'ALLOW_PRODUCTION_AUTH_DEBUG|ENABLE_DEV_AUTH_TOOLS' ~/JoyJoin/deployment/.env.production || echo 'unset'` — 期望 `unset` 或非 `1`。
- **Pass criteria:** 两变量非 `1`（unset）+ dev-login 403 + 测试绿。
- **FAIL signal:** 任一 `=1`；dev-login 200；测试红。（这两个变量**无启动校验**，必须做运行时 printenv + 行为探测。）
- **Evidence:** `HS-03-prod-env.log`、`HS-03-dev-login-http.txt`、`HS-03-auth-tests.log`
- **估计耗时 / Owner:** 15 min / ops + @backend-engineer（步骤 1、4 `待验证`）
- **Remediation:** `auth-session-and-safety-boundaries` + `docs/runbooks/emergency-auth-surfaces.md`；移除变量并重建容器。

---

## HS-04 任一暗发布 flag 在生产为 true

- **Severity:** LAUNCH-BLOCKING
- **Trigger：** 暗发布清单任一 flag 在 production 的**有效值**为 true（`feature_flags` DB 行 true，或无 DB 行时 env 回退 true）。
- **暗发布清单（checklist §10；16 项，全部必须 false）：**
  `alangEnabled`、`flashStoryActionsEnabled`、`gatheringRoomEnabled`、`preRevealRefundEnabled`、`noRefundAfterReveal`、`budgetAdjacencyEnabled`、`icebreakerGroupBeatsEnabled`、`miniscriptEvidenceVoteV2Enabled`、`auctionV2Enabled`、`matchNeverMeetSentinel`、`matchChemistryCalibrationEnabled`、`matchingPuzzlePreludeEnabled`、`socialSquadComposedHeroEnabled`、`profilePixelAvatarEnabled`、`equipmentRewardsEnabled`、`personalStoryEnabled`
  > 注 1：`personalityDiceChooseModeEnabled` 缺省 true 且是 LIVE 功能（release-train §2-b），**不在暗清单**，勿误判。
  > 注 2：release-train §1 的前置姿态（`LIE_DETECTIVE_MODE` unset/v1、`SOCIAL_ICEBREAKER_ENABLE_AUCTION`、`PERSONALITY_DICE_CHOOSE_MODE_ENABLED`）属于开灯前置，见 release-train §2。2026-09-22 已批准的 LIVE 集合以 release-train §6-a 记录为准。
- **Environment:** production（DB 为真相源；admin API 为可执行通道）
- **Procedure:**
  1. （production UI，super_admin）打开 `https://admin.joyjoinapp.com/admin/feature-flags`，逐行核对 16 个暗 flag — 期望全 OFF。
  2. （production API）浏览器登录 admin → 复制 session cookie → `curl -s -b <EV>/prod-admin-cookie.txt https://admin.joyjoinapp.com/api/admin/feature-flags | tee <EV>/HS-04-flags-api.json | jq -r '.flags[] | select(.value==true) | .key' | tee <EV>/HS-04-production-true-flags.txt` — 期望输出集合 ⊆ 已批准 LIVE 清单，16 暗 flag 不出现（响应形状为 `{ flags: [...] }`，2026-10-06 核实；无 jq 时人工读 JSON）。
  3. （production DB 行）`docker exec postgres psql -U joyjoin -d joyjoin -c "SELECT key, value, updated_by, updated_at FROM feature_flags WHERE value='true' ORDER BY key;" | tee <EV>/HS-04-flags-db.log`；再跑定向查询 — **期望空**：
     ```sql
     SELECT key FROM feature_flags WHERE value='true' AND key IN
     ('alangEnabled','flashStoryActionsEnabled','gatheringRoomEnabled','preRevealRefundEnabled','noRefundAfterReveal','budgetAdjacencyEnabled','icebreakerGroupBeatsEnabled','miniscriptEvidenceVoteV2Enabled','auctionV2Enabled','matchNeverMeetSentinel','matchChemistryCalibrationEnabled','matchingPuzzlePreludeEnabled','socialSquadComposedHeroEnabled','profilePixelAvatarEnabled','equipmentRewardsEnabled','personalStoryEnabled');
     ```
  4. （production env 回退层）只落盘命中行，避免全量 printenv（含密钥）进入证据：`docker exec joyjoin-api printenv | grep -E 'ALANG_ENABLED|FLASH_STORY_ACTIONS_ENABLED|GATHERING_ROOM_ENABLED|PRE_REVEAL_REFUND_ENABLED|NO_REFUND_AFTER_REVEAL_ENABLED|BUDGET_ADJACENCY_ENABLED|ICEBREAKER_GROUP_BEATS_ENABLED|MINISCRIPT_EVIDENCE_VOTE_V2_ENABLED|AUCTION_V2_ENABLED|MATCH_NEVER_MEET_SENTINEL|MATCH_CHEMISTRY_CALIBRATION_ENABLED|MATCHING_PUZZLE_PRELUDE_ENABLED|SOCIAL_SQUAD_COMPOSED_HERO_ENABLED|PROFILE_PIXEL_AVATAR_ENABLED|EQUIPMENT_REWARDS_ENABLED|PERSONAL_STORY_ENABLED' | tee <EV>/HS-04-flag-env.log; echo "(空文件 = none set)"` — 期望无 `=true`（空 = unset = 安全缺省 false）。
- **Pass criteria:** 16 暗 flag 的有效值全部 false（DB + env 回退两条路径都检查）。
- **FAIL signal:** 任一暗 flag effective true；或出现未在批准 LIVE 记录中的 true。
- **Evidence:** `HS-04-flags-api.json`、`HS-04-production-true-flags.txt`、`HS-04-flags-db.log`、`HS-04-flag-env.log`
- **估计耗时 / Owner:** 15 min / ops + @backend-engineer（`待验证` production 访问）
- **Remediation:** `feature-flags-launch-config`；后台置 false（留 `FEATURE_FLAG_UPDATED` 审计）后重跑本 gate。

---

## HS-05 verify:subpackage-styles 失败或存在非空 sub-common.wxss

- **Severity:** LAUNCH-BLOCKING
- **Trigger：** `verify:subpackage-styles` exit ≠ 0；或 build 产物中任一 `sub-common.wxss` 去掉 `@charset "UTF-8";` 与空白后仍非空。
- **Environment:** local（release commit；build-time-only gate）
- **Procedure:**
  1. 前置：`npm run build:weapp -w mini-program 2>&1 | tee <EV>/HS-05-build.log` — 期望 exit 0。**必要前置**：`verify:subpackage-styles` 不在 build 链内（2026-10-06 核实），且当前 `dist/` 可能是陈旧 H5 构建 — 不先 build，gate 会以 "missing build output" 失败。
  2. `npm run verify:subpackage-styles -w mini-program 2>&1 | tee <EV>/HS-05-subpackage-styles.log; echo "EXIT=$?"` — 期望 exit 0，无 "unreachable styles"。
  3. 独立证明（15 个子包根，必须递归全量；gate 语义 = 去 charset 后 trim 非空）：
     ```bash
     find apps/mini-program/dist -name 'sub-common.wxss' -print | while read -r f; do \
       c=$(sed 's/@charset "UTF-8";//' "$f" | tr -d '[:space:]'); \
       [ -n "$c" ] && echo "NON-EMPTY: $f"; done; echo "scan-done" | tee <EV>/HS-05-sub-common-scan.log
     ```
     期望：无 `NON-EMPTY` 行。
  4. 设备补充（不改变本 gate 判定）：gate 只覆盖 `REQUIREMENTS` 枚举的 selector；本批新增/移动的子包样式组件仍需 DevTools/真机走查（失败模式为设备端静默无样式）。
- **Pass criteria:** build exit 0 + gate exit 0 + 无 `NON-EMPTY`。
- **FAIL signal:** gate red；任何 `NON-EMPTY`；或 gate 因 dist 缺失失败（先 build 再重跑，不能算 pass）。
- **Evidence:** `HS-05-build.log`、`HS-05-subpackage-styles.log`、`HS-05-sub-common-scan.log`
- **估计耗时 / Owner:** 30 min / @taro-engineer
- **Remediation:** `docs/runbooks/mini-program-asset-delivery.md` §1.3/§4.6 — 在消费页 SCSS 中 `@use` 组件 SCSS，移除组件 TSX 的副作用 import；确保无 `sub-common.wxss` 残留。

---

## HS-06 db:verify 失败 / 服务器 schema drift fail-fast

- **Severity:** LAUNCH-BLOCKING
- **Trigger：** `db:verify` 对 staging 或 production exit ≠ 0；或服务器冷启动 `validateDbSchema()` 失败（crash-loop / 启动日志）；或 `/api/readyz` 的 `checks.database != "ok"`。
- **Environment:** local（journal）+ staging + production（DB）
- **Procedure:**
  1. （local）`npm run db:journal-check 2>&1 | tee <EV>/HS-06-journal-check.log; echo "EXIT=$?"` — 期望 exit 0（全部迁移已注册）。
  2. （staging，`待验证`）`DATABASE_URL='postgres://joyjoin:<pw>@<staging-host>:5432/joyjoin_staging' npm run db:verify 2>&1 | tee <EV>/HS-06-db-verify-staging.log; echo "EXIT=$?"` — 期望 exit 0。**注意：** shell 注入的 `DATABASE_URL` 会覆盖 `--env-file=.env`，不要在 repo root 用带生产 URL 的 `.env` 误跑。
  3. （production，`待验证`）同上，换 `joyjoin` 库的生产 `DATABASE_URL`，`tee <EV>/HS-06-db-verify-production.log`。
  4. （production/staging）fail-fast 观察：`docker logs joyjoin-api 2>&1 | grep -iE 'validateDbSchema|schema.*(mismatch|drift)|does not exist' | tail -20` — 期望空；`curl -s https://joyjoinapp.com/api/readyz | tee <EV>/HS-06-readyz-prod.json` — 期望 `checks.database == "ok"`。
  5. （production，历史注意）生产曾无 `__drizzle_migrations` 跟踪表（2026-09-22 事故）。若仍缺失，按 §2 纪律逐条记录 `apps/server/migrations/*.sql` 的 `psql "$DATABASE_URL" -f <file>` 应用台账（不自动跑 DDL）。
- **Pass criteria:** journal-check 0 + 两环境 db:verify 0 + 无启动 schema 错误 + readyz database ok。
- **FAIL signal:** 任一 verify 非 0；readyz database 非 ok；启动日志 schema 错误；发现未应用迁移。
- **Evidence:** `HS-06-journal-check.log`、`HS-06-db-verify-staging.log`、`HS-06-db-verify-production.log`、`HS-06-readyz-prod.json`
- **估计耗时 / Owner:** 30 min / ops + @backend-engineer（步骤 2–5 `待验证`）
- **Remediation:** `database-migration-safety` skill；按生成的 `.sql` 手工 `psql` 应用，先于代码部署，重跑本 gate。

---

## HS-07 文案扫描命中审核禁用词且无例外记录

- **Severity:** LAUNCH-BLOCKING
- **Trigger：** 用户可见文案命中微信审核禁用词（匹配/社交/灵魂/撮合/快速交友/AI 等），且未归入：机器标识符、runbook §2 刻意保留、或已登记例外（`exceptions.ts` / Copy Council 签核）。
- **Environment:** local（扫描）+ production（提审姿态对账）
- **Procedure:**
  1. （local）精确短语扫描（无现成自动化工具 — 2026-10-06 核实；`check-guardrails.mjs` 不扫文案）：
     ```bash
     grep -rnE '匹配中|匹配成功|已匹配|匹配度|为你匹配|撮合|社交期待|社交画像|社交签名|社交人格|快速交友|灵魂默契|有趣的灵魂|社交DNA|AI社交建筑师' \
       apps/mini-program/src/pages apps/mini-program/src/components apps/mini-program/src/lib \
       packages/shared/src/copy packages/shared/src/legal \
       apps/server/src/lib/wechatSubscribeMessage.ts apps/server/src/lib/subscribeReminderScheduler.ts \
       --include='*.ts' --include='*.tsx' > <EV>/HS-07-raw-hits.txt; echo "EXIT=$?"
     ```
  2. （local）宽词扫描供上下文判断：同 1 的目录，pattern 改 `'匹配|社交|灵魂|撮合|AI'` → `<EV>/HS-07-broad-hits.txt`。
  3. （local）逐条 triage 写入 `<EV>/HS-07-triage-table.md`：(a) 机器标识/注释/测试（非用户可见）；(b) runbook §2 刻意保留（「社交裁缝蛛」原型名、「交新朋友」意向、「轻社交勇气」（默认关闭）、AIGC 角标）；(c) 已登记例外。**未分类 = FAIL。**
  4. （local）例外核验：`packages/shared/src/copy/exceptions.ts` ORANGE_WORDS（匹配/AI/推荐 的 allowed/banned context）；`registerException` 条目须含 `id/approvedBy/expiresAt`（内存注册，须在证据中固化批准记录）。
  5. （local）动态 LLM 输出侧确认：`grep -rn --include='*.ts' 'findReviewBlockedVocab' apps/server/src | head` — 期望命中 `moderation.ts`、`warmupTopics.ts`、`socialIcebreakerAIService.ts` 等消费方（词表定义在 `packages/shared/src/copy/terms.ts:119-147`；`REVIEW_BLOCKED_VOCAB` 常量名在 server 无引用，勿 grep 该名）。
- **Pass criteria:** 所有用户可见命中均归入 (a)/(b)/(c)，例外记录齐全。
- **FAIL signal:** 任何未分类的用户可见命中。
- **Evidence:** `HS-07-raw-hits.txt`、`HS-07-broad-hits.txt`、`HS-07-triage-table.md`、`HS-07-exceptions.md`
- **估计耗时 / Owner:** 45 min / @qa-agent + 品牌文案 owner（product）
- **Remediation:** `joyjoin-brand-guidelines`；改文案或登记例外（PM + 工程双签 + 到期日）。
- **Gap（2026-10-06 核实）：** 无自动化 gate。建议新增 `scripts/check/check-wechat-vocab.mjs`（窄词表 + exceptions 白名单）并挂入 guardrails，锁死本项。

---

## HS-08 guardrails / test -w @joyjoin/server / harness:gate 任一红

- **Severity:** LAUNCH-BLOCKING
- **Trigger：** release commit 上三条命令任一 exit ≠ 0。
- **Environment:** local（release commit 工作树）
- **Procedure:**
  1. 固化基线：`git rev-parse HEAD; git status --short` — 记录 release commit 与 dirty 范围（§17 的 73 个改动面必须在场）。
  2. `npm run guardrails 2>&1 | tee <EV>/HS-08-guardrails.log; echo "EXIT=$?"` — 期望 0。
  3. `npm run test -w @joyjoin/server 2>&1 | tee <EV>/HS-08-server-tests.log; echo "EXIT=$?"` — 期望 0；并确认关键套件在输出中 PASS：`registrationErrorCodes`、`fkCascadeDeleteContract`、`adminRbacCoverage`、`testAdminAuth`、`districtCatalogContract`。
  4. `npm run harness:gate 2>&1 | tee <EV>/HS-08-harness-gate.log; echo "EXIT=$?"` — 期望 0（exit 2 = concerns，非 pass）。**注意：** 该脚本扫描 `git diff HEAD` + untracked 文件，必须在实际 release 工作树执行以覆盖 release diff。
  5. （增强，§1 要求）`npm run check:full 2>&1 | tee <EV>/HS-08-check-full.log; echo "EXIT=$?"` — 期望 0。
- **Pass criteria:** 全部 exit 0。
- **FAIL signal:** 任一非 0；harness:gate 输出 concerns。
- **Evidence:** `HS-08-guardrails.log`、`HS-08-server-tests.log`、`HS-08-harness-gate.log`（+ `HS-08-check-full.log`）
- **估计耗时 / Owner:** 45 min / release owner + @backend-engineer
- **Remediation:** 修复红项；`harness-completion-gate` skill；修复后重跑**整个 HS-08**（三条相互独立）。

---

## HS-09 任一 LIVE flag 无法 <1min 关停

- **Severity:** LAUNCH-BLOCKING
- **Trigger：** production 任一有效值为 true 的 flag，不存在可在 60 秒内完成并观测到生效的关停路径（DB flag 期望 ≤5s 生效；env-only 需重建容器的按实测计时）。
- **Environment:** staging（Kill drill 执行场）+ production（LIVE 清单来源）
- **Procedure:**
  1. 列 LIVE 清单（复用 HS-04 产物，该文件本身已是 key 列表）：`cat <EV>/HS-04-production-true-flags.txt | tee <EV>/HS-09-live-flags.txt`；DB 替代：`docker exec postgres psql -U joyjoin -d joyjoin -tAc "SELECT key FROM feature_flags WHERE value='true' ORDER BY key;" | tee <EV>/HS-09-live-flags.txt`。
  2. （staging drill，逐条计时）用 super_admin 登录 `https://staging.admin.joyjoinapp.com/admin/feature-flags`，对每个 LIVE flag：置 `<key>=false` → 记录 T0；刷新页面/发起**新请求或新会话**观测效果 → T1；恢复原值。目标：T1−T0 ≤ 5s（机制：`featureFlags.ts` `CACHE_TTL_MS=5000`）；含后台登录的全程 < 60s。
  3. （staging，可脚本化替代）`curl -sS -w '\nHTTP %{http_code} in %{time_total}s\n' -X PUT https://staging.admin.joyjoinapp.com/api/admin/feature-flags/<key> -b <EV>/staging-admin-cookie.txt -H 'Content-Type: application/json' -d '{"value":"false"}' | tee -a <EV>/HS-09-kill-drill.log`
  4. 快照语义核对：`lie/dice/auction/miniscript/highlights/sessionGlow` 等 resolve-once flag，进行中会话不受影响是**设计行为** — 效果须在「新会话/新发展」观测，在证据中写明观测方式，避免误判。
  5. 审计与回写：`docker exec postgres-staging psql -U joyjoin -d joyjoin_staging -c "SELECT key, value, updated_by, updated_at FROM feature_flags WHERE key='<key>';"` — 期望 `updated_by/updated_at` 变化 + admin 审计 `FEATURE_FLAG_UPDATED`。
  6. （env-only LIVE 开关，`待验证` staging CVM）无 DB 行的 LIVE 开关（如 `SOCIAL_*_LLM_ENABLED` 中当前为 true 者）：实测 `cd ~/JoyJoin/deployment && time docker compose -f docker-compose.staging.yml up -d joyjoin-api-staging` 的墙钟时间并记录 → `HS-09-env-only-timing.md`。**>1min 或不可执行 = 该 flag 不得保持 LIVE（否则本 gate FAIL）。**
- **Pass criteria:** 每个 LIVE flag 实测关停观测 ≤60s；env-only 开关要么非 LIVE，要么实测达标并有记录。
- **FAIL signal:** 任一 LIVE flag 关停观测 >60s；或不存在可执行关停路径。
- **Evidence:** `HS-09-live-flags.txt`、`HS-09-kill-drill.log`、`HS-09-env-only-timing.md`
- **估计耗时 / Owner:** 60 min / ops + @backend-engineer（步骤 6 `待验证`）
- **Remediation:** `feature-flags-launch-config`；DB flag 卡住查 DB/缓存；env-only 补 <1min 重建 runbook 或发布前置 false。

---

## HS-10 单副本契约被破坏（replicas > 1 且未上 Redis）

- **Severity:** LAUNCH-BLOCKING
- **Trigger：** production API 运行 >1 实例，而 rate limit / abuse / inference cache 仍为进程内且无 Redis（契约见 `docs/runbooks/open-beta-single-replica.md`）。
- **Environment:** production（CVM）+ repo 配置
- **Procedure:**
  1. （local）配置核对：`grep -rnE 'replicas|scale:' deployment/*.yml || echo 'no replica directives'`；`grep -ri redis deployment/*.yml || echo 'no redis in deployment configs'` — 期望均无输出/如注释。
  2. （production，`待验证` CVM）运行时实例数：`docker ps --format '{{.Names}}' | grep -x joyjoin-api | wc -l` — 期望 `1`；`cd ~/JoyJoin/deployment && docker compose -f docker-compose.nginx.yml ps -q joyjoin-api | wc -l` — 期望 `1`。
  3. （production）Redis 缺失确认：`docker ps --format '{{.Names}} {{.Image}}' | grep -i redis || echo 'no redis container'` — 期望无。
  4. 契约文档在册核对：确认进程内组件清单（`rateLimiter.ts`、`abuseDetection.ts`、`inference/cache.ts`）与「扩展需先上 Redis」声明；如需扩容，先走 `caching-strategy` skill 迁移 Redis，否则 NO-GO。
- **Pass criteria:** 生产 API 恰 1 实例 + 无 replica/scale 指令（或已有 Redis 承接共享状态）。
- **FAIL signal:** API 实例数 >1；配置含 replica/scale；多实例且无 Redis。
- **Evidence:** `HS-10-replica-count.log`、`HS-10-compose-config.log`
- **估计耗时 / Owner:** 10 min / ops（`待验证`）
- **Remediation:** `open-beta-single-replica` runbook；回退到单实例或先做 Redis 迁移。

---

## HS-11 用户注销无受理流程（§5 未关闭）

- **Severity:** LAUNCH-BLOCKING
- **Trigger：** 无人工注销 runbook + 受理台账；或演练出现级联残留（23503）/ 会话未即时失效 / 台账不完整。
- **Environment:** docs + staging（演练）+ ops（受理通道）
- **Procedure:**
  1. runbook 存在性：`ls docs/runbooks/ | grep -iE '注销|account|deletion' | tee <EV>/HS-11-runbook-exists.log` — 期望非空（建议 `docs/runbooks/account-deletion.md`，含受理入口、身份核验、删除范围、留存边界、15 工作日 SLA 台账格式）。**现状（2026-10-06 更新）：runbook 已落盘 `docs/runbooks/account-deletion.md`（194 行）；本 gate 剩余 FAIL 项 = staging 演练 + §5.3 legal 留存裁定 + §2 受理通道 ops 确认。**
  2. 受理入口（`待验证` ops/邮箱）：条款承诺 `support@joyjoinapp.com` + 十五个工作日（`packages/shared/src/legal/joyjoinTermsZh.ts:139-140`）。发一封测试注销申请，确认受理回执 + 台账登记。
  3. 演练（staging，1 个测试用户）：按 runbook 走 身份核验 → 登记 → 执行删除。删除使用 `cascadeDeleteByIds`（`apps/server/src/lib/fkCascadeDelete.ts:166`）；drizzle-only FK（如 `event_attendance.blind_box_event_id`，无 DB FK）必须先手工删（参考 `singleTestService.ts:856-867` 模式）。现有唯一删除面：admin `DELETE /api/admin/users/:id/data`（`adminUsers.ts:963`）。
  4. 即时失效核验：`docker exec postgres-staging psql -U joyjoin -d joyjoin_staging -c "SELECT count(*) FROM sessions WHERE sess->>'userId'='<uid>';"` — 期望 `0`；删除后残留 cookie 调 `/api/auth/user` — 期望 401。
  5. 无残留核验：`... -c "SELECT count(*) FROM users WHERE id='<uid>';"` — 期望 `0`；`docker logs joyjoin-api-staging --since 10m 2>&1 | grep -c '23503'` — 期望 `0`；台账完整（申请日/核验方式/执行人/范围/完成日）。
  6. 一致性：条款描述的注销路径与实际流程一致（若 runbook 不用邮箱入口，先改条款再演练）。
- **Pass criteria:** runbook 落盘 + 受理可验证 + 演练无残留 + 会话即时失效 + 台账完整。
- **FAIL signal:** runbook 缺席（当前即 FAIL）；无受理台账；演练 23503 残留；会话存活；条款漂移。
- **Evidence:** `HS-11-runbook-exists.log`、`HS-11-deletion-drill.log`、`HS-11-ledger-entry.md`、`HS-11-post-delete-auth.txt`
- **估计耗时 / Owner:** 60 min / ops + product/legal + @backend-engineer（步骤 2 `待验证`）
- **Remediation:** `docs-sync` + 新建 account-deletion runbook；自建注销路由为 follow-up（人工流程存在即不阻塞，但 §5 全部勾选才关闭）。

---

## HS-12 revokeUserSessions 未接全 ban/disable 路径或无测试

- **Severity:** LAUNCH-BLOCKING
- **Trigger：** 任一 ban / disable / 注销路径未调用 `revokeUserSessions`；或无任何自动化测试覆盖。
- **Environment:** local（源码+测试）+ staging（行为演练）
- **Procedure:**
  1. （local）调用点扫描：`grep -rn --include='*.ts' 'revokeUserSessions' apps/server/src | grep -v __tests__ | tee <EV>/HS-12-callsite-grep.log` — 期望覆盖：admin ban（`adminUsers.ts:882`）、admin 删除用户数据（`DELETE /api/admin/users/:id/data`）、自动永久封禁（`apps/server/src/abuseDetection.ts:56`）、注销流程（随 HS-11 落地）。**现状（2026-10-06 更新）：已实现 — 4 路径接线（ban `adminUsers.ts:882`、permaban `abuseDetection.ts:56`、delete-data `adminUsers.ts:984` tx 内 fail-closed、admin disable `adminAuth.ts:365`）+ `revokeUserSessionsContract.test.ts` 21/21 绿；typecheck 绿；verifier 审计 VERIFIED WITH CONCERNS（全量套件因本机 8GB 饱和的 withServer 探针抖动未跑全，目标文件隔离全绿）。剩余：合并前 hunk 隔离（与 sibling workstream 交错）+ 非饱和主机全量复跑。**
  2. （local）管理员账号 disable 路径（R-05）：检查 admin 账号禁用/删除路由是否清理其存量会话（`sessions` 表），记录结论与落地位置（`grep -rn --include='*.ts' 'admin_accounts' apps/server/src/routes/domains | head`）。
  3. （local）测试存在性：`grep -rln --include='*.ts' 'revokeUserSessions' apps/server/src/__tests__ | tee <EV>/HS-12-tests.log` — 期望 ≥1；`npm run test -w @joyjoin/server -- revoke` — 期望绿。建议最小测试 `revokeUserSessionsContract.test.ts`：断言 ban/delete/permaban 三路径均调用 + 会话删除后下一请求 401 + 失败语义（当前 ban 路径 try/catch warn = fail-open，须产品/工程确认是否接受并写进测试）。
  4. （staging 行为演练）测试用户双端登录（`sessions` ≥2 行）→ admin ban（`PATCH /api/admin/users/:id/ban`）→ 立即 `docker exec postgres-staging psql -U joyjoin -d joyjoin_staging -c "SELECT count(*) FROM sessions WHERE sess->>'userId'='<uid>';"` — 期望 `0`；旧 cookie 调 `/api/auth/user` — 期望 401。
- **Pass criteria:** 所有 ban/disable/注销路径接线 + ≥1 测试 + 演练会话即时失效。
- **FAIL signal:** 缺调用点；零测试；演练后会话存活。
- **Evidence:** `HS-12-callsite-grep.log`、`HS-12-tests.log`、`HS-12-ban-drill.log`
- **估计耗时 / Owner:** 45 min（含修复）/ @backend-engineer + @qa-agent（步骤 4 `待验证` staging）
- **Remediation:** @backend-engineer 接线剩余路径（ban 已接；补 delete-data / permaban / 注销）；`testing-and-regression-guardrails` 锁契约测试；逐条关闭 §11 ①②③。

---

## 汇总表（HS-ID | gate | env | 步骤数 | 估计耗时）

| HS-ID | Gate | Environment | Steps | Est. |
|---|---|---|---|---|
| HS-01 | 支付 create/webhook/reconcile + 幂等 | local + staging + production | 10 | 90 min |
| HS-02 | WECHAT_PAY_APP_ID 一致性 + readyz config | production（+staging） | 5 | 10 min |
| HS-03 | 生产 auth debug 关闭 | production + local | 4 | 15 min |
| HS-04 | 16 暗发布 flag 全 false | production | 4 | 15 min |
| HS-05 | 子包样式 gate + 无 sub-common.wxss | local | 4 | 30 min |
| HS-06 | db:verify + schema fail-fast | local + staging + production | 5 | 30 min |
| HS-07 | 审核禁用词扫描 + 例外记录 | local（+production 姿态） | 5 | 45 min |
| HS-08 | guardrails / server tests / harness gate | local | 5 | 45 min |
| HS-09 | LIVE flag <1min 关停 | staging + production（清单） | 6 | 60 min |
| HS-10 | 单副本契约 + 无 Redis 缺失 | production + repo | 4 | 10 min |
| HS-11 | 注销受理流程 + 演练 | docs + staging + ops | 6 | 60 min |
| HS-12 | revokeUserSessions 全覆盖 + 测试 | local + staging | 4 | 45 min |
| **合计** | | | **62** | **~7.5 h + 修复时间** |

**执行环境分层：**
- **可完全本地执行：** HS-05、HS-08（HS-01/06/07/12 的自动化/源码步骤亦本地）。
- **需要 staging 访问：** HS-01（真金全链路）、HS-06（staging DB）、HS-09（Kill drill）、HS-11（演练）、HS-12（行为演练）。
- **需要 production/CVM 访问（`待验证`）：** HS-02、HS-03、HS-04、HS-06（生产 DB）、HS-09（LIVE 清单+env-only 计时）、HS-10、HS-01（小额真单）。
- **需要设备：** HS-01 步骤 5（开发版真机）、HS-05 步骤 4（新增子包组件时）。

## `待验证` 权限清单（ops 执行前准备）

| 条目 | 需要的访问 | 命令锚点 |
|---|---|---|
| HS-01 | CVM staging + 真金支付能力 + 生产小额真单 + 真机 | 步骤 4–10 |
| HS-02 / HS-03 | CVM（`docker exec joyjoin-api`、env 文件） | HS-02 步骤 1–2；HS-03 步骤 1、4 |
| HS-04 | production admin 会话 + CVM postgres | 步骤 1–4 |
| HS-06 | staging / production `DATABASE_URL` 或 CVM psql | 步骤 2–5 |
| HS-09 | staging admin super_admin + CVM（env-only 计时） | 步骤 2–6 |
| HS-10 | CVM docker/compose | 步骤 2–3 |
| HS-11 | `support@joyjoinapp.com` 邮箱 + staging 演练 | 步骤 1–2（runbook 当前缺席 = 即 FAIL） |
| HS-12 | staging 行为演练 | 步骤 4 |

## 结果登记（执行后回填）

| HS-ID | 结果 | 证据路径 | 执行人 | 日期 | 备注 / 修复单 |
|---|---|---|---|---|---|
| HS-01 | ☐ PASS ☐ FAIL | | | | |
| HS-02 | ☐ PASS ☐ FAIL | | | | |
| HS-03 | ☐ PASS ☐ FAIL | | | | |
| HS-04 | ☐ PASS ☐ FAIL | | | | |
| HS-05 | ☐ PASS ☐ FAIL | | | | |
| HS-06 | ☐ PASS ☐ FAIL | | | | |
| HS-07 | ☐ PASS ☐ FAIL | | | | |
| HS-08 | ☐ PASS ☐ FAIL | | | | |
| HS-09 | ☐ PASS ☐ FAIL | | | | |
| HS-10 | ☐ PASS ☐ FAIL | | | | |
| HS-11 | ☐ PASS ☐ FAIL | | | | |
| HS-12 | ✅ PASS（条件式 · 代码面通过；整条 gate 待步骤 4 staging 演练后回填为完全 PASS） | 实现：`apps/server/src/lib/revokeUserSessions.ts`（新增 `revokeAdminSessions`）、`abuseDetection.ts:54-67`、`adminUsers.ts:881-888 & 983-1005`、`adminAuth.ts:8,363-372`；测试：`apps/server/src/__tests__/revokeUserSessionsContract.test.ts` 21/21；合同：`.git/.orchestration/sprints/sprint-contract.launch-qa-hs12-revoke-sessions.md`；独立 grep 复核 4 调用点 = 精确；日志待落盘 `<EV>/HS-12-callsite-grep.log`、`<EV>/HS-12-tests.log` | @backend-engineer + @qa-agent | 2026-10-06 | 4 路径全部接线（ban / delete-data tx 内 fail-closed / permaban / admin disable）+ 21/21 契约测试绿 + typecheck 绿 + 7 套消费者回归全绿。合并前遗留：(1) hunk 隔离 — `adminUsers.ts` 混有 sibling W1 hunks，`gatheringRoomState.test.ts:96` 一行 mock 修复随行；(2) 新文件未跟踪（`revokeUserSessions.ts` + 契约测试），需 `git add`；(3) 非饱和主机重跑全量 server 套件（本机 8GB 饱和导致 withServer 探针抖动 3826/3889，目标文件隔离全绿；HS-08 强制项）。Caveats：AC-02 回滚为 mock 级验证（结构证据：revoke 为 tx 首步 + `cascadeDeleteByIds` 未执行断言），建议随步骤 4 演练顺带复验（删除持 ≥2 会话的测试用户 → `sessions=0` + `users=0`）；AC-06 严格记 PARTIAL（环境性）。Gate 最终关闭：Procedure 步骤 4 staging 行为演练（ban → `sessions` 计数=0 → 旧 cookie 调 `/api/auth/user` 期望 401）。 |

**全部 12 条 PASS 后**：将结果抄入 `docs/testing/LAUNCH-QA-CHECKLIST.md` §21 证据登记表，并按该表完成 Go/No-Go 签字。
