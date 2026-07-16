-- Idempotent V1.7 equipment catalog seed.
-- Assets are stable CDN keys/placeholders only; this migration does not claim
-- that final character or restaurant artwork has been approved.

BEGIN;
--> statement-breakpoint
WITH canonical_archetypes(archetype_id, display_name) AS (
  VALUES
    ('corgi', '社牛柯基'),
    ('rooster', '小太阳鸡'),
    ('hamster_praise', '夸夸仓鼠'),
    ('fox', '寻宝狐'),
    ('dolphin_calm', '机灵海豚'),
    ('spider', '人脉蛛'),
    ('koala', '树洞考拉'),
    ('octopus', '脑洞章鱼'),
    ('owl', '好奇猫头鹰'),
    ('elephant', '靠谱大象'),
    ('turtle', '慢热龟'),
    ('cat', '小透明猫')
), starter_slots(slot, slot_name) AS (
  VALUES
    ('top', '初始上装'),
    ('bottom', '初始下装'),
    ('shoes', '初始鞋履'),
    ('accessory', '初始配饰')
)
INSERT INTO "equipment_items" (
  "slug",
  "name",
  "description",
  "slot",
  "rarity",
  "asset_key",
  "compatible_archetypes",
  "is_initial",
  "initial_archetype_id",
  "shop_available",
  "is_active"
)
SELECT
  'starter-' || archetype_id || '-' || slot,
  display_name || '·' || slot_name,
  'V1.7 像素人格初始装备；当前使用稳定占位资产键，正式美术确认后原位替换。',
  slot,
  'common',
  'equipment/starter/' || archetype_id || '/' || slot || '/v1',
  ARRAY[archetype_id]::text[],
  true,
  archetype_id,
  false,
  true
FROM canonical_archetypes
CROSS JOIN starter_slots
ON CONFLICT DO NOTHING;
--> statement-breakpoint

-- A restaurant pool is owned by venues.id, never by a Blind Box event. This
-- lets Blind Box and future reunion activities at the same restaurant share it.
INSERT INTO "equipment_pools" (
  "slug",
  "name",
  "venue_id",
  "alang_mission_id",
  "is_active"
)
SELECT
  'venue-' || v."id",
  left(coalesce(nullif(v."brand_name", ''), v."name") || ' 装备池', 120),
  v."id",
  NULL,
  true
FROM "venues" v
WHERE v."is_active" IS TRUE
  AND v."partner_status" = 'active'
  AND v."onboarding_status" = 'active'
ON CONFLICT DO NOTHING;
--> statement-breakpoint

-- Alang/flash pools remain mission-owned and do not share target coordinates.
INSERT INTO "equipment_pools" (
  "slug",
  "name",
  "venue_id",
  "alang_mission_id",
  "is_active"
)
SELECT
  'alang-' || m."id",
  left(m."title" || ' 装备池', 120),
  NULL,
  m."id",
  true
FROM "alang_missions" m
WHERE m."status" IN ('active', 'approved')
ON CONFLICT DO NOTHING;
--> statement-breakpoint

WITH eligible_pools AS (
  SELECT
    p."id" AS pool_id,
    'venue'::text AS authority_kind,
    v."id" AS authority_id,
    coalesce(nullif(v."brand_name", ''), v."name") AS display_name
  FROM "equipment_pools" p
  INNER JOIN "venues" v ON v."id" = p."venue_id"
  WHERE p."is_active" IS TRUE
    AND v."is_active" IS TRUE
    AND v."partner_status" = 'active'
    AND v."onboarding_status" = 'active'

  UNION ALL

  SELECT
    p."id" AS pool_id,
    'alang'::text AS authority_kind,
    m."id" AS authority_id,
    m."title" AS display_name
  FROM "equipment_pools" p
  INNER JOIN "alang_missions" m ON m."id" = p."alang_mission_id"
  WHERE p."is_active" IS TRUE
    AND m."status" IN ('active', 'approved')
), pool_variants(variant, slot, rarity, label, weight) AS (
  VALUES
    ('common-top', 'top', 'common', '日常上装', 20),
    ('common-bottom', 'bottom', 'common', '日常下装', 20),
    ('common-shoes', 'shoes', 'common', '日常鞋履', 20),
    ('common-accessory', 'accessory', 'common', '日常配饰', 20),
    ('rare-top', 'top', 'rare', '限定上装', 10),
    ('rare-accessory', 'accessory', 'rare', '限定配饰', 10)
)
INSERT INTO "equipment_items" (
  "slug",
  "name",
  "description",
  "slot",
  "rarity",
  "asset_key",
  "compatible_archetypes",
  "is_initial",
  "initial_archetype_id",
  "shop_available",
  "is_active"
)
SELECT
  authority_kind || '-' || authority_id || '-' || variant,
  left(display_name || '·' || label, 100),
  '地点装备池单品；当前使用稳定占位资产键，正式美术确认后原位替换。',
  slot,
  rarity,
  'equipment/pools/' || authority_kind || '/' || authority_id || '/' || variant || '/v1',
  NULL,
  false,
  NULL,
  true,
  true
FROM eligible_pools
CROSS JOIN pool_variants
ON CONFLICT DO NOTHING;
--> statement-breakpoint

WITH eligible_pools AS (
  SELECT
    p."id" AS pool_id,
    'venue'::text AS authority_kind,
    v."id" AS authority_id
  FROM "equipment_pools" p
  INNER JOIN "venues" v ON v."id" = p."venue_id"
  WHERE p."is_active" IS TRUE
    AND v."is_active" IS TRUE
    AND v."partner_status" = 'active'
    AND v."onboarding_status" = 'active'

  UNION ALL

  SELECT
    p."id" AS pool_id,
    'alang'::text AS authority_kind,
    m."id" AS authority_id
  FROM "equipment_pools" p
  INNER JOIN "alang_missions" m ON m."id" = p."alang_mission_id"
  WHERE p."is_active" IS TRUE
    AND m."status" IN ('active', 'approved')
), pool_variants(variant, weight) AS (
  VALUES
    ('common-top', 20),
    ('common-bottom', 20),
    ('common-shoes', 20),
    ('common-accessory', 20),
    ('rare-top', 10),
    ('rare-accessory', 10)
)
INSERT INTO "equipment_pool_items" (
  "pool_id",
  "item_id",
  "weight",
  "is_active"
)
SELECT
  eligible_pools.pool_id,
  equipment_items."id",
  pool_variants.weight,
  true
FROM eligible_pools
CROSS JOIN pool_variants
INNER JOIN "equipment_items" ON true
WHERE equipment_items."slug" =
  eligible_pools.authority_kind || '-' || eligible_pools.authority_id || '-' || pool_variants.variant
ON CONFLICT ("pool_id", "item_id") DO UPDATE
SET
  "weight" = EXCLUDED."weight",
  "is_active" = true,
  "updated_at" = now();
--> statement-breakpoint
COMMIT;
