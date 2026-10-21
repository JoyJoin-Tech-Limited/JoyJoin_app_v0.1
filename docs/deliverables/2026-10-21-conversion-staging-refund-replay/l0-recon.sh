#!/usr/bin/env bash
# 转化 S2.4 staging 复演 — Level 0 侦察（只读，零写入）
# 只碰 staging：所有 docker 目标均为 *-staging 容器，所有 psql 均为 -d joyjoin_staging
set -uo pipefail

KEY="$HOME/Desktop/Business idea/JoyJoin/SSH/OpenCode.pem"
HOST="root@1.12.243.104"
SSH="ssh -i \"$KEY\" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10 $HOST"
TS=$(date +%Y%m%d-%H%M%S)
OUT="l0-recon-output-$TS.txt"
exec > >(tee "$OUT") 2>&1

section() { echo; echo "================ $1 ================"; }

section "L0.0 环境确认：staging 容器在位"
eval "$SSH 'docker ps --format \"{{.Names}}\\t{{.Status}}\" | grep -- -staging || echo NO_STAGING_CONTAINERS'"

section "L0.1 staging API 存活"
curl -sS -o /dev/null -w "GET https://staging.joyjoinapp.com/api/readyz -> %{http_code}\n" https://staging.joyjoinapp.com/api/readyz

section "L0.2 feature_flags（期望：preRevealRefundEnabled=t；noRefundAfterReveal 无行）"
eval "$SSH 'docker exec postgres-staging psql -U joyjoin -d joyjoin_staging -c \"SELECT key, enabled, updated_at FROM feature_flags WHERE key IN ('"'"'preRevealRefundEnabled'"'"','"'"'noRefundAfterReveal'"'"');\"'"

section "L0.3 历史真实 ¥0.01 已支付单 + 关联报名状态（Level A 夹具探测）"
eval "$SSH 'docker exec postgres-staging psql -U joyjoin -d joyjoin_staging -x -c \"SELECT p.id AS payment_id, p.user_id, p.related_id AS pool_id, p.wechat_order_id, p.status, p.final_amount, p.created_at, r.id AS registration_id, r.match_status, ep.is_test_pool, ep.title FROM payments p LEFT JOIN event_pool_registrations r ON r.pool_id = p.related_id AND r.user_id = p.user_id LEFT JOIN event_pools ep ON ep.id = p.related_id WHERE p.payment_type = '"'"'event'"'"' AND p.status = '"'"'completed'"'"' AND p.final_amount = 1 AND left(p.wechat_order_id,4) <> '"'"'MOCK'"'"' ORDER BY p.created_at DESC LIMIT 20;\"'"

section "L0.4 未来可报名的池（评估新造夹具可行性；is_test_pool 必须为 false 才可复演 cancel）"
eval "$SSH 'docker exec postgres-staging psql -U joyjoin -d joyjoin_staging -c \"SELECT id, title, is_test_pool, date_time, registration_deadline, total_registrations FROM event_pools WHERE date_time > now() + interval '"'"'6 hours'"'"' ORDER BY date_time ASC LIMIT 15;\"'"

section "L0.5 sessions 表结构确认（为 Level A/B 的 session 铸造做格式核对）"
eval "$SSH 'docker exec postgres-staging psql -U joyjoin -d joyjoin_staging -c \"\\d sessions\" | head -20'"

section "L0.6 refund_attempts 近 10 行（历史退款痕迹与行格式）"
eval "$SSH 'docker exec postgres-staging psql -U joyjoin -d joyjoin_staging -c \"SELECT payment_id, status, reason, amount, initiated_by, created_at FROM refund_attempts ORDER BY created_at DESC LIMIT 10;\"'"

echo; echo "完成。请将终端完整输出（已同步写入 $OUT）贴回给 QA 子会话。"
