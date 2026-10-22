#!/usr/bin/env bash
# =============================================================================
# CNV S2.4 — 本地 flag-on HTTP 复演（2026-10-22）
# 命题：PRE_REVEAL_REFUND_ENABLED=true 时，HTTP 取消路由（DELETE
#       /api/pool-registrations/:id）对「未 matched + 非 test 池 + MOCK 已支付单」
#       走 pre_reveal_refund 分支 = 全额退款成功落账语义。
#       —— 2026-10-21 staging 复演（Level B，微信 404 降级路径）覆盖的是
#       「会真实发起退款 + 失败优雅降级」；本脚本补「MOCK 成功路径」的 HTTP 层证据。
#
# 关键设计（全部来自代码核实，见报告 §2/§3）：
#   * is_test_pool=false 硬要求：test 池强制 legacy（poolRegistrationCancel.ts L179-180, AC-5）。
#   * wechat_order_id 以 MOCK_ 开头 → finalizeRefundedPayment + refund_attempts(success)
#     （poolRegistrationCancel.ts L315-329），不触网微信，本地可跑通成功路径。
#   * feature_flags DB 行优先于 env（featureFlags.ts fetchFromDb）：脚本捕获并临时
#     删除本地覆盖行，exit 时恢复，零残留。
#   * .env 四件套临时归一，exit 时整文件恢复。NO_REFUND_AFTER_REVEAL_ENABLED 不碰
#     （pre-reveal 分支选择不读它，L177-187）。
#   * NODE_ENV=development 仅作用于复演进程（dev-login 硬要求；node --env-file 不覆盖
#     已存在的 process.env，命令前缀赋值生效）。
#
# 互锁：CONFIRM_LOCAL_REPLAY=CNV-S24 bash s2-local-replay.sh
# =============================================================================
set -o pipefail

if [ "$CONFIRM_LOCAL_REPLAY" != "CNV-S24" ]; then
  echo "安全互锁：请显式执行 CONFIRM_LOCAL_REPLAY=CNV-S24 bash s2-local-replay.sh"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
cd "$ROOT"
echo "repo root: $ROOT"

TS=$(date +%s)
OUT="$SCRIPT_DIR/s2-local-replay-output-$(date +%Y%m%d-%H%M%S).txt"
exec > >(tee "$OUT") 2>&1

FAILS=0
note() { echo; echo "---- $1"; }
pass() { echo "PASS: $1"; }
fail() { echo "FAIL: $1"; FAILS=$((FAILS+1)); }

note "0) 前置检查（psql/curl/端口空闲/.env 存在）"
command -v psql >/dev/null || { echo "FATAL: 无 psql"; exit 1; }
command -v curl >/dev/null || { echo "FATAL: 无 curl"; exit 1; }
[ -f .env ] || { echo "FATAL: 缺 root .env"; exit 1; }

DATABASE_URL="$(grep '^DATABASE_URL=' .env | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")"
[ -n "$DATABASE_URL" ] || { echo "FATAL: .env 无 DATABASE_URL"; exit 1; }
PORT="$(grep '^PORT=' .env | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")"
if [ -z "$PORT" ]; then PORT=5001; fi
echo "目标端口: $PORT（取自 .env PORT，默认 5001）"
if curl -sS -m 2 "http://localhost:$PORT/api/health" >/dev/null 2>&1; then
  echo "FATAL: $PORT 已被占用——先停掉现有 dev server（避免误杀他人进程）"
  exit 1
fi

ENV_BAK="$(mktemp -t s24env)"; cp .env "$ENV_BAK"
FLAG_ROWS_FILE="$(mktemp -t s24flags)"; : > "$FLAG_ROWS_FILE"
SERVER_LOG="$(mktemp -t s24srv)"; JAR="$(mktemp -t s24jar)"
SERVER_PID=""
POOL_ID=""; REG_ID=""; PAY_ID=""; USER_ID=""

cleanup() {
  note "CLEANUP（kill server / 删种子 / 恢复 flag 行 / 恢复 .env）"
  if [ -n "$SERVER_PID" ]; then kill "$SERVER_PID" 2>/dev/null; wait "$SERVER_PID" 2>/dev/null; fi
  if [ -n "$PAY_ID" ]; then
    psql "$DATABASE_URL" -q -c "DELETE FROM refund_attempts WHERE payment_id = '$PAY_ID'; DELETE FROM payments WHERE id = '$PAY_ID';" >/dev/null 2>&1
  fi
  if [ -n "$REG_ID" ]; then psql "$DATABASE_URL" -q -c "DELETE FROM event_pool_registrations WHERE id = '$REG_ID';" >/dev/null 2>&1; fi
  if [ -n "$POOL_ID" ]; then psql "$DATABASE_URL" -q -c "DELETE FROM event_pools WHERE id = '$POOL_ID';" >/dev/null 2>&1; fi
  if [ -s "$FLAG_ROWS_FILE" ]; then
    while IFS='|' read -r k v; do
      if [ -n "$k" ]; then psql "$DATABASE_URL" -q -c "INSERT INTO feature_flags (key, value) VALUES ('$k', '$v') ON CONFLICT (key) DO NOTHING" >/dev/null 2>&1; fi
    done < "$FLAG_ROWS_FILE"
    echo "feature_flags 覆盖行已恢复"
  fi
  cp "$ENV_BAK" .env && echo ".env 已恢复"
  LEFT="$(psql "$DATABASE_URL" -t -A -c "SELECT count(*) FROM payments WHERE wechat_order_id LIKE 'MOCK_S24_%'" 2>/dev/null)"
  echo "残留复核: $LEFT 笔 MOCK_S24 支付残留（期望 0）"
}
trap cleanup EXIT

note "1) .env 四件套归一（PRE_REVEAL_REFUND_ENABLED/MOCK_PAYMENTS/APP_MODE/TEST_PAYMENT_PRICE_IN_CENTS）"
ensure_var() {
  if grep -q "^$1=" .env; then sed -i '' "s|^$1=.*|$1=$2|" .env; else echo "$1=$2" >> .env; fi
  grep "^$1=" .env
}
ensure_var PRE_REVEAL_REFUND_ENABLED true
ensure_var MOCK_PAYMENTS true
ensure_var APP_MODE staging
ensure_var TEST_PAYMENT_PRICE_IN_CENTS 1
echo "（NO_REFUND_AFTER_REVEAL_ENABLED 保持原值——pre-reveal 分支不读它）"

note "2) 本地 feature_flags 覆盖行检查（DB 行优先于 env；须无行 env=true 才生效）"
FLAG_ROWS="$(psql "$DATABASE_URL" -t -A -c "SELECT key || '|' || value FROM feature_flags WHERE key IN ('preRevealRefundEnabled','noRefundAfterReveal')")"
if [ -n "$FLAG_ROWS" ]; then
  echo "$FLAG_ROWS" > "$FLAG_ROWS_FILE"
  echo "发现覆盖行（已临时移除，exit 恢复）:"
  echo "$FLAG_ROWS"
  psql "$DATABASE_URL" -q -c "DELETE FROM feature_flags WHERE key IN ('preRevealRefundEnabled','noRefundAfterReveal')"
else
  echo "无覆盖行 → env fallback 生效（PRE_REVEAL_REFUND_ENABLED=true）"
fi

note "3) 启动 dev server（NODE_ENV=development override，端口 $PORT）"
(cd apps/server && NODE_ENV=development node --env-file=../../.env --import tsx/esm src/index.ts > "$SERVER_LOG" 2>&1) &
SERVER_PID=$!
echo "server pid=$SERVER_PID"
READY=0
for i in $(seq 1 90); do
  if curl -sS -m 2 "http://localhost:$PORT/api/health" >/dev/null 2>&1; then READY=1; break; fi
  sleep 1
done
if [ "$READY" != "1" ]; then
  fail "dev server 90s 未就绪"
  tail -40 "$SERVER_LOG"
  exit 1
fi
pass "dev server 就绪"

note "4) POST /api/auth/dev-login"
LOGIN_RESP="$(curl -sS -c "$JAR" -X POST "http://localhost:$PORT/api/auth/dev-login" -H 'content-type: application/json' -d '{}')"
echo "$LOGIN_RESP"
USER_ID="$(echo "$LOGIN_RESP" | grep -o '"userId":"[^"]*"' | cut -d'"' -f4)"
if [ -n "$USER_ID" ]; then pass "dev-login userId=$USER_ID"; else fail "dev-login 未返回 userId"; exit 1; fi

note "5) 种子（QA_S24 标识；is_test_pool=false 硬要求）"
POOL_ID="$(psql "$DATABASE_URL" -t -A -q -v ON_ERROR_STOP=1 <<SQL
INSERT INTO event_pools (title, description, event_type, city, date_time, registration_deadline, created_by, is_test_pool, total_registrations)
VALUES ('QA_S24本地复演池-$TS 勿报名', 'CNV S2.4 本地 HTTP 复演种子，演完即删', '饭局', '深圳', now() + interval '2 days', now() + interval '1 day', '$USER_ID', false, 1)
RETURNING id;
SQL
)"
REG_ID="$(psql "$DATABASE_URL" -t -A -q -v ON_ERROR_STOP=1 <<SQL
INSERT INTO event_pool_registrations (pool_id, user_id, match_status)
VALUES ('$POOL_ID', '$USER_ID', 'pending')
RETURNING id;
SQL
)"
PAY_ID="$(psql "$DATABASE_URL" -t -A -q -v ON_ERROR_STOP=1 <<SQL
INSERT INTO payments (user_id, payment_type, related_id, original_amount, final_amount, wechat_order_id, status, paid_at)
VALUES ('$USER_ID', 'event', '$POOL_ID', 1, 1, 'MOCK_S24_$TS', 'completed', now())
RETURNING id;
SQL
)"
echo "POOL_ID=$POOL_ID"
echo "REG_ID=$REG_ID"
echo "PAY_ID=$PAY_ID  (wechat_order_id=MOCK_S24_$TS)"
if [ -n "$POOL_ID" ] && [ -n "$REG_ID" ] && [ -n "$PAY_ID" ]; then pass "种子就位"; else fail "种子插入失败"; exit 1; fi

note "6) 检查① GET /api/my-pool-registrations（期望该报名 cancelPolicy='refundable'）"
curl -sS -b "$JAR" "http://localhost:$PORT/api/my-pool-registrations" > "$SCRIPT_DIR/s2-my-regs-$TS.json"
head -c 1200 "$SCRIPT_DIR/s2-my-regs-$TS.json"; echo
if grep -q "$REG_ID" "$SCRIPT_DIR/s2-my-regs-$TS.json" && grep -q '"cancelPolicy":"refundable"' "$SCRIPT_DIR/s2-my-regs-$TS.json"; then
  pass "①cancelPolicy=refundable 在 DTO 上（AC-9；computeRegistrationCancelPolicy L110-121）"
else
  fail "①cancelPolicy 未如预期（检查 s2-my-regs-$TS.json）"
fi

note "7) 检查② DELETE /api/pool-registrations/$REG_ID（期望 200 + policy=pre_reveal_refund）"
DEL_RESP="$(curl -sS -b "$JAR" -w '\nHTTP_STATUS:%{http_code}' -X DELETE "http://localhost:$PORT/api/pool-registrations/$REG_ID")"
echo "$DEL_RESP"
if echo "$DEL_RESP" | grep -q 'HTTP_STATUS:200' && echo "$DEL_RESP" | grep -q '"policy":"pre_reveal_refund"'; then
  pass "②取消响应 policy=pre_reveal_refund（userEventPools.ts L1498-1502）"
else
  fail "②取消响应异常"
fi

sleep 2
note "7b) DB 复核：payments / refund_attempts / registration / pool 计数"
psql "$DATABASE_URL" -x <<SQL
SELECT id, status, final_amount, wechat_order_id FROM payments WHERE id = '$PAY_ID';
SELECT status, reason, wechat_refund_id, amount, initiated_by FROM refund_attempts WHERE payment_id = '$PAY_ID';
SELECT count(*) AS registration_rows_expect_0 FROM event_pool_registrations WHERE id = '$REG_ID';
SELECT total_registrations AS pool_count_expect_0 FROM event_pools WHERE id = '$POOL_ID';
SQL
PAY_STATUS="$(psql "$DATABASE_URL" -t -A -c "SELECT status FROM payments WHERE id = '$PAY_ID'")"
ATT_ROW="$(psql "$DATABASE_URL" -t -A -c "SELECT status || '|' || coalesce(wechat_refund_id,'') || '|' || initiated_by FROM refund_attempts WHERE payment_id = '$PAY_ID'")"
REG_LEFT="$(psql "$DATABASE_URL" -t -A -c "SELECT count(*) FROM event_pool_registrations WHERE id = '$REG_ID'")"
if [ "$PAY_STATUS" = "refunded" ]; then pass "②payments.status=refunded（finalizeRefundedPayment L555-561）"; else fail "②payments.status=$PAY_STATUS（期望 refunded）"; fi
if echo "$ATT_ROW" | grep -q "^success|MOCK_RF_$PAY_ID|user-cancel"; then pass "②refund_attempts 成功行（MOCK_RF_ / user-cancel）"; else fail "②refund_attempts 行异常: $ATT_ROW"; fi
if [ "$REG_LEFT" = "0" ]; then pass "②报名行已删除（先退款成功后删行，Amendment 1 顺序）"; else fail "②报名行残留 $REG_LEFT"; fi

note "7c) 服务端日志证据（policy branch resolved → pre_reveal_refund；refundedMoney:true）"
grep -E "policy branch resolved|pre-reveal cancel with refund complete" "$SERVER_LOG" | tail -6
if grep -q '"branch":"pre_reveal_refund"' "$SERVER_LOG"; then pass "日志分支命中 pre_reveal_refund"; else fail "日志未见 pre_reveal_refund 分支"; fi

note "8) 检查③ credits：本复演走 MOCK 现金路径未用 credits → N/A（credits 逆转由 smoke:auto-refund 与 poolRegistrationCancelFlow.test.ts 覆盖）"
note "8b) 检查④ admin_audit_logs：pre-reveal 用户自取消【按设计不写】admin 审计"
AUDIT_N="$(psql "$DATABASE_URL" -t -A -c "SELECT count(*) FROM admin_audit_logs WHERE target_entity_type='event_pool_registration' AND target_entity_id='$REG_ID'")"
echo "admin_audit_logs 中本报名条目数: $AUDIT_N"
if [ "$AUDIT_N" = "0" ]; then
  pass "④与设计一致=0（审计词表取消类仅 POST_REVEAL_CANCEL_NO_REFUND L64 / POOL_REGISTRATION_CANCELLED_BY_ADMIN L81；pre-reveal 资金证据在 refund_attempts；staging 开关审计由 S1 的 FEATURE_FLAG_UPDATED 行承担）"
else
  fail "④出现非预期审计行（$AUDIT_N 条）——需人工复核"
fi

echo
echo "================ 汇总 ================"
if [ "$FAILS" = "0" ]; then
  echo "S2 LOCAL REPLAY: ALL PASS"
else
  echo "S2 LOCAL REPLAY: $FAILS 项 FAIL —— 见上方 FAIL: 行"
fi
echo "完整输出: $OUT"
exit "$FAILS"
