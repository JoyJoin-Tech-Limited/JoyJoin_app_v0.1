#!/usr/bin/env bash
# =============================================================================
# T46 S2.4 — staging 开关证据（2026-10-22）【纯只读：只有 SELECT，零写入】
# 目标：补 AC-03 闭环的 staging 侧证据 —
#   S1.1  feature_flags 当前值（preRevealRefundEnabled 应 ='true'；
#         noRefundAfterReveal 应无行或 ='false'）
#   S1.2  admin_audit_logs 本次 toggle 的 FEATURE_FLAG_UPDATED 记录
#         （admin.ts:231-238 形状：target_entity_type='feature_flag',
#          target_entity_id=<key>, context={"value":"true",...}）
# 纪律：仅 postgres-staging / joyjoin-api-staging；生产容器零接触；不重启任何服务。
# 注意：logAdminAudit 的 DB 持久化是 fire-and-forget（adminAuditLogger.ts:234-253），
#       toggle 后几秒钟内行才可见；本脚本只做查询。
# 互锁：CONFIRM_STAGING_READONLY=T46-S24 bash s1-staging-flag-evidence.sh
# =============================================================================
set -uo pipefail

if [ "${CONFIRM_STAGING_READONLY:-}" != "T46-S24" ]; then
  echo "安全互锁：请显式执行 CONFIRM_STAGING_READONLY=T46-S24 bash s1-staging-flag-evidence.sh"
  exit 1
fi

# SSH key：优先任务书指定路径，回退到 2026-10-21 复演已验证路径
KEY="$HOME/.ssh/OpenCode.pem"
[ -f "$KEY" ] || KEY="$HOME/Desktop/Business idea/JoyJoin/SSH/OpenCode.pem"
if [ ! -f "$KEY" ]; then echo "FATAL: 找不到 OpenCode.pem"; exit 1; fi

ssh_cvm() { ssh -i "$KEY" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10 root@1.12.243.104 "$@"; }
PSQL='docker exec -i postgres-staging psql -U joyjoin -d joyjoin_staging'
TS=$(date +%Y%m%d-%H%M%S)
OUT="$(dirname "$0")/s1-staging-flag-evidence-output-$TS.txt"
exec > >(tee "$OUT") 2>&1

section() { echo; echo "================ $1 ================"; }

section "S1.0  sanity：staging API 存活（公开端点，无鉴权）"
curl -sS -m 10 https://staging.joyjoinapp.com/api/health; echo

section "S1.1  feature_flags 当前值（期望 preRevealRefundEnabled='true'；noRefundAfterReveal 无行或 'false'）"
ssh_cvm "$PSQL -x" <<'SQL'
SELECT key, value, updated_at, updated_by
FROM feature_flags
WHERE key IN ('preRevealRefundEnabled','noRefundAfterReveal');
SQL

section "S1.2  admin_audit_logs：两 flag 的 FEATURE_FLAG_UPDATED 历史（新→旧，10 行）"
ssh_cvm "$PSQL -x" <<'SQL'
SELECT audit_id, "timestamp", admin_id, admin_role, action,
       target_entity_type, target_entity_id, context
FROM admin_audit_logs
WHERE action = 'FEATURE_FLAG_UPDATED'
  AND target_entity_type = 'feature_flag'
  AND target_entity_id IN ('preRevealRefundEnabled','noRefundAfterReveal')
ORDER BY "timestamp" DESC
LIMIT 10;
SQL

section "S1.3  PASS 判据（人工核对本输出）"
echo "P1  S1.1 必须含 preRevealRefundEnabled 行且 value='true'。"
echo "P2  S1.1 中 noRefundAfterReveal 不存在 或 value='false'。"
echo "P3  S1.2 最新一条 preRevealRefundEnabled 审计行 context->>value='true'，"
echo "    timestamp 落在 2026-10-22（用户本人今日手动 toggle）；admin_role='super_admin'。"
echo "P4  对照基线：2026-10-21 L1/L2 输出已见 value='true'（report.md E1）。"
echo "    若 S1.2 显示 10-21→10-22 间存在 false→true 翻转，说明期间曾被关、今日重开——同样满足 P3。"
echo
echo "完成。输出已写入 $OUT —— 请贴回 QA 子会话判定。"
