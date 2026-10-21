#!/usr/bin/env bash
# T46 S2.4 staging 复演 — L2 执行（Level B：flag 分支命中 + 真实微信退款 API 调用证据 + Level C 边界对照）
# 纪律：只写 joyjoin_staging；全部种子带 QA_T46 标识且本脚本自清理；不重启任何容器；生产零接触。
# 期望终局：502 REFUND_FAILED_RETRYABLE（WeChat 404）→ 幂等重试 → matched 边界 legacy → 清理归零。
set -uo pipefail

if [ "${CONFIRM_STAGING_REPLAY:-}" != "T46-S2.4" ]; then
  echo "安全互锁：请显式执行 CONFIRM_STAGING_REPLAY=T46-S2.4 bash l2-execute.sh"
  exit 1
fi

KEY="$HOME/Desktop/Business idea/JoyJoin/SSH/OpenCode.pem"
ssh_cvm() { ssh -i "$KEY" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10 root@1.12.243.104 "$@"; }
PSQL='docker exec -i postgres-staging psql -U joyjoin -d joyjoin_staging'
API="https://staging.joyjoinapp.com"
TS=$(date +%s)
SID="t46s2x4-$TS"
OUT="l2-execute-output-$TS.txt"
exec > >(tee "$OUT") 2>&1

section() { echo; echo "================ $1 ================"; }

section "L2.0 前置复核：flag 在位（preRevealRefundEnabled=true；noRefundAfterReveal 应无行）"
ssh_cvm "$PSQL -x" <<'SQL'
SELECT key, value FROM feature_flags
WHERE key IN ('preRevealRefundEnabled','noRefundAfterReveal');
SQL

section "L2.1 种子：QA 用户 + 非 test 池 + pre-match 报名 + completed 假单 + 会话（全部 QA_T46 标识）"
QA_USER_ID=$(ssh_cvm "$PSQL -t -A -q" <<SQL
INSERT INTO users (phone_number, first_name, last_name)
VALUES ('13946$TS', 'QA', 'T46复演')
RETURNING id;
SQL
)
echo "QA_USER_ID=$QA_USER_ID"

POOL_ID=$(ssh_cvm "$PSQL -t -A -q" <<SQL
INSERT INTO event_pools (title, description, event_type, city, date_time, registration_deadline, created_by, is_test_pool, total_registrations)
VALUES ('QA_T46复演池-$TS 勿报名', 'T46 S2.4 staging 复演种子，演完即删', '饭局', '深圳',
        now() + interval '2 days', now() + interval '1 day', '$QA_USER_ID', false, 1)
RETURNING id;
SQL
)
echo "POOL_ID=$POOL_ID"

REG_ID=$(ssh_cvm "$PSQL -t -A -q" <<SQL
INSERT INTO event_pool_registrations (pool_id, user_id, match_status)
VALUES ('$POOL_ID', '$QA_USER_ID', 'pending')
RETURNING id;
SQL
)
echo "REG_ID=$REG_ID"

PAY_ID=$(ssh_cvm "$PSQL -t -A -q" <<SQL
INSERT INTO payments (user_id, payment_type, related_id, original_amount, final_amount, wechat_order_id, status, paid_at)
VALUES ('$QA_USER_ID', 'event', '$POOL_ID', 1, 1, 'QA_T46_$TS', 'completed', now())
RETURNING id;
SQL
)
echo "PAY_ID=$PAY_ID"

ssh_cvm "$PSQL -t -A -q" <<SQL
INSERT INTO sessions (sid, sess, expire)
VALUES ('$SID',
        jsonb_build_object('cookie', jsonb_build_object('path','/','httpOnly',true,'secure',false),
                           'userId', '$QA_USER_ID'),
        now() + interval '2 hours');
SELECT 'SESSION_INSERTED $SID';
SQL

section "L2.2 AC-9 预判证据：cancelPolicy 应为 refundable"
curl -sS "$API/api/my-pool-registrations" -H "X-Session-Token: $SID" | tee /tmp/l2-my-regs.json
echo
grep -o '\"cancelPolicy\":\"[^\]*\"' /tmp/l2-my-regs.json || echo '(cancelPolicy 字段未出现——异常信号！)'

section "L2.3 第一次取消（Level B 主证据：期望 502 + REFUND_FAILED_RETRYABLE，报名保留）"
curl -sS -w '\nHTTP_STATUS:%{http_code}\n' -X DELETE "$API/api/pool-registrations/$REG_ID"   -H "X-Session-Token: $SID" | tee /tmp/l2-cancel-1.json

section "L2.4 日志证据（分支命中 + 真实微信 API 404 + Amendment 1 保留报名）"
sleep 3
ssh_cvm 'docker logs joyjoin-api-staging --since 10m 2>&1 | grep -E "MyPoolRegistrationsCancel|policy branch|pre-reveal|WeChat Pay API request failed" | tail -30'

section "L2.5 DB 证据：failed attempt 行 + claim 已释放回 completed + 报名仍在"
ssh_cvm "$PSQL -x" <<SQL
SELECT status, reason, wechat_refund_id, amount, initiated_by, initiated_at, failure_reason
FROM refund_attempts WHERE payment_id = '$PAY_ID' ORDER BY initiated_at;
SELECT id, status, final_amount FROM payments WHERE id = '$PAY_ID';
SELECT id, match_status FROM event_pool_registrations WHERE id = '$REG_ID';
SQL

section "L2.6 幂等重试证据（Amendment 1：再次 DELETE 仍 502，不产生双退，第二条 failed attempt）"
curl -sS -w '\nHTTP_STATUS:%{http_code}\n' -X DELETE "$API/api/pool-registrations/$REG_ID"   -H "X-Session-Token: $SID" | tee /tmp/l2-cancel-2.json
ssh_cvm "$PSQL -t -A -q" <<SQL
SELECT count(*) || ' refund_attempts rows' FROM refund_attempts WHERE payment_id = '$PAY_ID';
SELECT id, match_status FROM event_pool_registrations WHERE id = '$REG_ID';
SQL

section "L2.7 Level C 边界对照：改 match_status='matched' 再取消 → 期望 policy=legacy 且无退款（边界=registration.matchStatus）"
ssh_cvm "$PSQL -t -A -q" <<SQL
UPDATE event_pool_registrations SET match_status = 'matched', updated_at = now() WHERE id = '$REG_ID';
SELECT 'match_status flipped to matched';
SQL
curl -sS -w '\nHTTP_STATUS:%{http_code}\n' -X DELETE "$API/api/pool-registrations/$REG_ID"   -H "X-Session-Token: $SID" | tee /tmp/l2-cancel-3.json
ssh_cvm "$PSQL -t -A -q" <<SQL
SELECT count(*) || ' registration rows (expect 0 — legacy delete consumed)' FROM event_pool_registrations WHERE id = '$REG_ID';
SELECT status || ' payment status after legacy cancel (expect completed, untouched)' FROM payments WHERE id = '$PAY_ID';
SELECT count(*) || ' refund_attempts total (expect 2 — no new refund from legacy branch)' FROM refund_attempts WHERE payment_id = '$PAY_ID';
SQL

section "L2.8 自清理：全部 QA_T46 种子 + 会话删除，并复核归零"
ssh_cvm "$PSQL" <<SQL
DELETE FROM refund_attempts WHERE payment_id = '$PAY_ID';
DELETE FROM payments WHERE id = '$PAY_ID';
DELETE FROM event_pools WHERE id = '$POOL_ID';
DELETE FROM users WHERE id = '$QA_USER_ID';
DELETE FROM sessions WHERE sid = '$SID';
SQL
ssh_cvm "$PSQL -t -A -q" <<SQL
SELECT count(*) || ' pools left (expect 0)' FROM event_pools WHERE id = '$POOL_ID';
SELECT count(*) || ' payments left (expect 0)' FROM payments WHERE id = '$PAY_ID';
SELECT count(*) || ' sessions left (expect 0)' FROM sessions WHERE sid = '$SID';
SELECT count(*) || ' orphan QA_T46 payments anywhere (expect 0)' FROM payments WHERE wechat_order_id LIKE 'QA_T46_%';
SQL

echo; echo "完成。请将完整输出贴回 QA 子会话（已写入 $OUT）。"
