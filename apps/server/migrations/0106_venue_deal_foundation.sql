-- Venue Deal S0：数据模型地基（2026-11-13）
-- 设计稿：docs/design/venue-deal/index.html（v2 主体，设计批准）
-- 出示页：docs/design/venue-deal/redeem-ceremony.html（v2.3，设计批准）
-- 实现方案：docs/design/venue-deal/implementation-plan.md
--
-- 全部为 nullable 新列 + 两条新外键，无默认值、无回填、无表重写、无既有行修改：
--   1. venue_deals.set_menu_price_cents          —— 定制套餐一口价（分）
--   2. venue_deals.set_menu_original_price_cents —— 定制套餐划线原价（分，必须 > 一口价）
--   3. event_pools.guaranteed_venue_id           —— 方案 B：建池即锁定的场地
--   4. event_pools.guaranteed_deal_id            —— 方案 B：建池即锁定的权益
--
-- 约束方向：外键为 ON DELETE RESTRICT。保底权益不允许被门店/权益删除动作静默解除；
-- 解除绑定必须走 S1 的显式后台流程。
--
-- 部署顺序（硬约束）：迁移必须先于代码部署应用到 staging 与 production。
-- 服务器启动时 validateDbSchema() 对每张表做 SELECT * LIMIT 0，缺列会 fail-fast。
-- 中止条件：迁移失败或未获得执行窗口时，不得部署引用这些列的代码。
--
-- 回滚：先回滚应用代码；这些附加列默认保留（旧代码不读它们，保留无害）。
-- 只有在代码回滚完成、且后续切片尚未写入引用/数据时，才可由操作者显式决定 DROP。
--
-- 幂等：列使用 IF NOT EXISTS，外键用 pg_constraint 存在性检查，可重复执行。

BEGIN;

ALTER TABLE venue_deals
  ADD COLUMN IF NOT EXISTS set_menu_price_cents integer,
  ADD COLUMN IF NOT EXISTS set_menu_original_price_cents integer;

ALTER TABLE event_pools
  ADD COLUMN IF NOT EXISTS guaranteed_venue_id varchar,
  ADD COLUMN IF NOT EXISTS guaranteed_deal_id varchar;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'event_pools_guaranteed_venue_id_venues_id_fk'
  ) THEN
    ALTER TABLE event_pools
      ADD CONSTRAINT event_pools_guaranteed_venue_id_venues_id_fk
      FOREIGN KEY (guaranteed_venue_id) REFERENCES venues(id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'event_pools_guaranteed_deal_id_venue_deals_id_fk'
  ) THEN
    ALTER TABLE event_pools
      ADD CONSTRAINT event_pools_guaranteed_deal_id_venue_deals_id_fk
      FOREIGN KEY (guaranteed_deal_id) REFERENCES venue_deals(id) ON DELETE RESTRICT;
  END IF;
END $$;

COMMENT ON COLUMN venue_deals.set_menu_price_cents IS
  '定制套餐一口价（分）；discount_type = set_menu 时必填';
COMMENT ON COLUMN venue_deals.set_menu_original_price_cents IS
  '定制套餐划线原价（分）；必须大于 set_menu_price_cents';
COMMENT ON COLUMN event_pools.guaranteed_venue_id IS
  '方案 B 保底场地：建池即锁定，场地分配视为硬约束；NULL = 无保底承诺';
COMMENT ON COLUMN event_pools.guaranteed_deal_id IS
  '方案 B 保底权益：与保底场地配套，客户端据此前置计算 hasGuaranteedDeal；NULL = 无保底承诺';

COMMIT;
