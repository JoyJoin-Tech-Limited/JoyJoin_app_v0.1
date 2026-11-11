-- D3 临期准入曲线：可观测性字段（2026-11-11）
--
-- 全部为 nullable，无默认值、无回填、无表重写，支持零停机发布：
--   1. event_pool_groups.avg_pair_score      —— 成组时的平均配对分（历史行 NULL = 未知）
--   2. event_pool_groups.formed_member_count —— 成组时的成员数（不可变，用于桌型分布）
--   3. event_pool_groups.pair_floor_policy   —— legacy | curve_v1（历史行 NULL = 未知）
--   4. pool_matching_logs.pair_floor         —— 本次扫描解析出的逐人准入下限（flag 关 = NULL）
--
-- 迁移必须先于代码部署应用到 staging 与 production；服务器启动时
-- validateDbSchema() 会检查 drizzle schema 中的新列，缺列会 fail-fast。
-- 幂等：全部 IF NOT EXISTS，可重复执行。

BEGIN;

ALTER TABLE event_pool_groups
  ADD COLUMN IF NOT EXISTS avg_pair_score integer,
  ADD COLUMN IF NOT EXISTS formed_member_count integer,
  ADD COLUMN IF NOT EXISTS pair_floor_policy varchar(20);

ALTER TABLE pool_matching_logs
  ADD COLUMN IF NOT EXISTS pair_floor integer;

COMMENT ON COLUMN event_pool_groups.avg_pair_score IS
  '平均配对兼容性分数；NULL = 未知（D3 之前的历史组）';
COMMENT ON COLUMN event_pool_groups.formed_member_count IS
  '成组时的成员数（不可变）；用于桌型分布，不随后续 member_count 变更';
COMMENT ON COLUMN event_pool_groups.pair_floor_policy IS
  '成组时使用的准入策略：legacy | curve_v1；NULL = 未知';
COMMENT ON COLUMN pool_matching_logs.pair_floor IS
  '本次扫描解析出的逐人准入下限；flag 关闭时为 NULL';

COMMIT;
