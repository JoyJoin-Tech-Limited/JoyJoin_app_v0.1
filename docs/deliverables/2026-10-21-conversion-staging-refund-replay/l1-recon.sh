#!/usr/bin/env bash
# 对标平台 S2.4 staging 复演 — L1 侦察（只读，零写入；SQL 经 stdin 直灌，无嵌套转义）
# 只碰 staging：docker 目标 postgres-staging / 库 joyjoin_staging；生产零接触。
set -uo pipefail

KEY="$HOME/Desktop/Business idea/JoyJoin/SSH/OpenCode.pem"
# ssh 命令走函数而非字符串变量——字符串会被 word-splitting 拆碎含空格路径（L1 首跑病因）
ssh_cvm() { ssh -i "$KEY" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10 root@1.12.243.104 "$@"; }
PSQL='docker exec -i postgres-staging psql -U joyjoin -d joyjoin_staging'
TS=$(date +%Y%m%d-%H%M%S)
OUT="l1-recon-output-$TS.txt"
exec > >(tee "$OUT") 2>&1

section() { echo; echo "================ $1 ================"; }

section "L1.1 feature_flags 精确行（确认 preRevealRefundEnabled=true / noRefundAfterReveal 无行）"
ssh_cvm "$PSQL -x" <<'SQL'
SELECT key, value, updated_by, updated_at
FROM feature_flags
WHERE key IN ('preRevealRefundEnabled','noRefundAfterReveal','guestEventPreviewEnabled');
SQL

section "L1.2 payments 状态词表 + 近 15 行（wechat_order_id 形态与 status 取值）"
ssh_cvm "$PSQL -x" <<'SQL'
SELECT status, payment_type, count(*) FROM payments GROUP BY 1,2 ORDER BY 1,2;
SELECT id, user_id, payment_type, related_id, status, final_amount,
       left(wechat_order_id,28) AS order_id_head, created_at
FROM payments ORDER BY created_at DESC LIMIT 15;
SQL

section "L1.3 历史真实 ¥0.01 已支付单 + 关联报名状态（Level A 夹具探测；排除 MOCK_ 前缀）"
ssh_cvm "$PSQL -x" <<'SQL'
SELECT p.id AS payment_id, p.user_id, p.related_id AS pool_id,
       left(p.wechat_order_id,28) AS order_id_head,
       p.status, p.final_amount, p.created_at,
       r.id AS registration_id, r.match_status,
       ep.is_test_pool, ep.title, ep.date_time AS pool_date
FROM payments p
LEFT JOIN event_pool_registrations r
  ON r.pool_id = p.related_id AND r.user_id = p.user_id
LEFT JOIN event_pools ep ON ep.id = p.related_id
WHERE p.payment_type = 'event'
  AND p.status = 'completed'
  AND p.final_amount = 1
  AND left(p.wechat_order_id,4) <> 'MOCK'
ORDER BY p.created_at DESC
LIMIT 20;
SQL

section "L1.4 历史已退款单（微信退款链曾真实跑通的旁证）"
ssh_cvm "$PSQL -x" <<'SQL'
SELECT id, user_id, payment_type, related_id, status, final_amount,
       left(wechat_order_id,28) AS order_id_head, updated_at
FROM payments
WHERE status IN ('refunded','refund_pending')
ORDER BY updated_at DESC
LIMIT 10;
SQL

section "L1.5 未来 6h+ 可报名的池（cancel 复演要求 is_test_pool=false）"
ssh_cvm "$PSQL -x" <<'SQL'
SELECT id, title, is_test_pool, city, date_time, registration_deadline,
       total_registrations, min_group_size, max_group_size, target_groups
FROM event_pools
WHERE date_time > now() + interval '6 hours'
ORDER BY date_time ASC
LIMIT 15;
SQL

section "L1.6 表结构核对（列名清单；\d 输出过滤列定义行）"
ssh_cvm "$PSQL" <<'SQL' | grep -E '^ [a-z_]+ +\|'
\echo ===== payments =====
\d payments
\echo ===== refund_attempts =====
\d refund_attempts
\echo ===== event_pool_registrations =====
\d event_pool_registrations
\echo ===== event_pools =====
\d event_pools
SQL

section "L1.7 近期 staging 用户（Level A 用历史夹具时取对应 user_id 铸 session）"
ssh_cvm "$PSQL -x" <<'SQL'
SELECT id, phone_number, first_name, last_name, created_at
FROM users
ORDER BY created_at DESC
LIMIT 10;
SQL

echo; echo "完成。请将完整输出贴回 QA 子会话（已写入 $OUT）。"
