import type { Express, Request } from "express";
import { z } from "zod";

import { requireAdmin, requireOperatorOrAbove } from "../../adminAuth";
import { getActingAdminId } from "../../lib/getActingAdminId";
import { logAdminAudit } from "../../lib/adminAuditLogger";
import { getFeatureFlag } from "../../lib/featureFlags";
import { logger } from "../../lib/logger";
import {
  createAdminEquipmentItem,
  createAdminEquipmentPool,
  AdminEquipmentRepositoryError,
  evaluateAdminEquipmentConsistency,
  getAdminEquipmentAnalytics,
  getAdminEquipmentOverview,
  hasLaunchReadyAdminEquipmentPool,
  listAdminEquipmentItems,
  listAdminEquipmentPools,
  listAdminEquipmentPoolSources,
  listAdminEquipmentRewardActivity,
  replaceAdminEquipmentPoolItems,
  updateAdminEquipmentItemSafely,
  updateAdminEquipmentPoolSafely,
} from "../../repositories/adminEquipmentRepo";

const uuidSchema = z.string().uuid();
const slugSchema = z.string().trim().min(2).max(120).regex(/^[a-z0-9-]+$/);
const slotSchema = z.enum(["top", "bottom", "shoes", "accessory"]);
const raritySchema = z.enum(["common", "rare"]);
const assetKeySchema = z.string().trim().min(1).max(160)
  .regex(/^equipment\/[a-z0-9/_-]+\.webp$/i, "素材键必须是 equipment/ 下的正式 WebP 路径");

export const adminEquipmentItemCreateSchema = z.object({
  slug: slugSchema,
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).nullable().optional(),
  slot: slotSchema,
  rarity: raritySchema.default("common"),
  assetKey: assetKeySchema,
  compatibleArchetypes: z.array(z.string().trim().min(1).max(50)).max(12).nullable().optional(),
  shopAvailable: z.boolean().default(false),
  isActive: z.boolean().default(true),
}).strict();

export const adminEquipmentItemPatchSchema = adminEquipmentItemCreateSchema
  .omit({ slug: true, slot: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, "至少提交一项修改");

export const adminEquipmentPoolCreateSchema = z.object({
  slug: slugSchema,
  name: z.string().trim().min(1).max(120),
  venueId: uuidSchema.nullable().optional(),
  alangMissionId: uuidSchema.nullable().optional(),
  isActive: z.boolean().default(false),
}).strict().superRefine((value, context) => {
  const sourceCount = Number(!!value.venueId) + Number(!!value.alangMissionId);
  if (sourceCount !== 1) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "装备池必须且只能绑定一个地点或旧阿浪任务" });
  }
});

export const adminEquipmentPoolPatchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  isActive: z.boolean().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "至少提交一项修改");

export const adminEquipmentPoolItemsSchema = z.object({
  items: z.array(z.object({
    itemId: uuidSchema,
    weight: z.number().int().min(1).max(10_000),
    isActive: z.boolean().default(true),
  }).strict()).max(200),
}).strict().superRefine((value, context) => {
  const ids = value.items.map((item) => item.itemId);
  if (new Set(ids).size !== ids.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "同一装备不能重复加入装备池" });
  }
});

export function hasLaunchReadyEquipmentPoolComposition(
  items: Array<{ itemRarity?: string; rarity?: string; isActive: boolean }>,
): boolean {
  return hasLaunchReadyAdminEquipmentPool(items.map((item) => ({
    rarity: item.itemRarity ?? item.rarity ?? "",
    isActive: item.isActive,
  })));
}

function audit(req: Request, action: "EQUIPMENT_ITEM_CREATED" | "EQUIPMENT_ITEM_UPDATED" | "EQUIPMENT_POOL_CREATED" | "EQUIPMENT_POOL_UPDATED", targetEntityType: string, targetEntityId: string, before?: Record<string, unknown>, after?: Record<string, unknown>) {
  logAdminAudit({
    action,
    adminId: getActingAdminId(req),
    adminRole: req.adminRole,
    targetEntityType,
    targetEntityId,
    before,
    after,
  });
}

function routeFailure(req: Request, res: any, operation: string, error: unknown) {
  logger.error(`[AdminEquipment] ${operation}`, {
    requestId: req.requestId,
    error: error instanceof Error ? error.message : String(error),
  });
  const code = (error as { code?: unknown })?.code;
  if (error instanceof AdminEquipmentRepositoryError) {
    res.status(409).json({ code: error.adminCode, message: error.message });
    return;
  }
  if (code === "23505") {
    res.status(409).json({ code: "EQUIPMENT_ADMIN_CONFLICT", message: "名称、标识或绑定来源已被使用" });
    return;
  }
  if (code === "23503" || code === "23514") {
    res.status(400).json({ code: "EQUIPMENT_ADMIN_INVALID_RELATION", message: "装备、装备池或来源配置无效" });
    return;
  }
  res.status(500).json({ code: "EQUIPMENT_ADMIN_FAILED", message: "装备运营请求暂时失败，请稍后重试" });
}

export function registerAdminEquipmentRoutes(app: Express): void {
  app.get("/api/admin/equipment/consistency", requireAdmin, async (req, res) => {
    try {
      const [items, pools, profilePixelAvatarEnabled, equipmentRewardsEnabled] = await Promise.all([
        listAdminEquipmentItems(),
        listAdminEquipmentPools(),
        getFeatureFlag("profilePixelAvatarEnabled", false),
        getFeatureFlag("equipmentRewardsEnabled", false),
      ]);
      res.json(evaluateAdminEquipmentConsistency({
        items,
        pools,
        rollout: { profilePixelAvatarEnabled, equipmentRewardsEnabled },
      }));
    } catch (error) {
      routeFailure(req, res, "consistency check failed", error);
    }
  });

  app.get("/api/admin/equipment/overview", requireAdmin, async (req, res) => {
    try {
      const [overview, profilePixelAvatarEnabled, equipmentRewardsEnabled] = await Promise.all([
        getAdminEquipmentOverview(),
        getFeatureFlag("profilePixelAvatarEnabled", false),
        getFeatureFlag("equipmentRewardsEnabled", false),
      ]);
      res.json({
        ...overview,
        rollout: { profilePixelAvatarEnabled, equipmentRewardsEnabled },
      });
    } catch (error) {
      routeFailure(req, res, "overview failed", error);
    }
  });

  app.get("/api/admin/equipment/items", requireAdmin, async (req, res) => {
    try {
      res.json({ items: await listAdminEquipmentItems() });
    } catch (error) {
      routeFailure(req, res, "item list failed", error);
    }
  });

  app.post("/api/admin/equipment/items", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    const body = adminEquipmentItemCreateSchema.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ message: body.error.issues[0]?.message ?? "装备信息无效" });
      return;
    }
    try {
      const created = await createAdminEquipmentItem(body.data);
      audit(req, "EQUIPMENT_ITEM_CREATED", "equipment_item", created.id, undefined, {
        slug: created.slug,
        slot: created.slot,
        rarity: created.rarity,
        isActive: created.isActive,
      });
      res.status(201).json(created);
    } catch (error) {
      routeFailure(req, res, "item create failed", error);
    }
  });

  app.patch("/api/admin/equipment/items/:id", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    const id = uuidSchema.safeParse(req.params.id);
    const body = adminEquipmentItemPatchSchema.safeParse(req.body);
    if (!id.success || !body.success) {
      res.status(400).json({ message: body.success ? "装备 ID 无效" : body.error.issues[0]?.message });
      return;
    }
    try {
      const result = await updateAdminEquipmentItemSafely(id.data, body.data);
      if (!result) {
        res.status(404).json({ message: "没有找到这件装备" });
        return;
      }
      audit(req, "EQUIPMENT_ITEM_UPDATED", "equipment_item", id.data, {
        name: result.before.name,
        rarity: result.before.rarity,
        shopAvailable: result.before.shopAvailable,
        isActive: result.before.isActive,
      }, body.data);
      res.json(result.updated);
    } catch (error) {
      routeFailure(req, res, "item update failed", error);
    }
  });

  app.get("/api/admin/equipment/pools", requireAdmin, async (req, res) => {
    try {
      res.json({ pools: await listAdminEquipmentPools() });
    } catch (error) {
      routeFailure(req, res, "pool list failed", error);
    }
  });

  app.get("/api/admin/equipment/sources", requireAdmin, async (req, res) => {
    try {
      res.json(await listAdminEquipmentPoolSources());
    } catch (error) {
      routeFailure(req, res, "source list failed", error);
    }
  });

  app.post("/api/admin/equipment/pools", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    const body = adminEquipmentPoolCreateSchema.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ message: body.error.issues[0]?.message ?? "装备池信息无效" });
      return;
    }
    try {
      const created = await createAdminEquipmentPool(body.data);
      audit(req, "EQUIPMENT_POOL_CREATED", "equipment_pool", created.id, undefined, {
        slug: created.slug,
        venueId: created.venueId,
        alangMissionId: created.alangMissionId,
        isActive: created.isActive,
      });
      res.status(201).json(created);
    } catch (error) {
      routeFailure(req, res, "pool create failed", error);
    }
  });

  app.patch("/api/admin/equipment/pools/:id", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    const id = uuidSchema.safeParse(req.params.id);
    const body = adminEquipmentPoolPatchSchema.safeParse(req.body);
    if (!id.success || !body.success) {
      res.status(400).json({ message: body.success ? "装备池 ID 无效" : body.error.issues[0]?.message });
      return;
    }
    try {
      const result = await updateAdminEquipmentPoolSafely(id.data, body.data);
      if (!result) {
        res.status(404).json({ message: "没有找到这个装备池" });
        return;
      }
      audit(req, "EQUIPMENT_POOL_UPDATED", "equipment_pool", id.data, {
        name: result.before.name,
        isActive: result.before.isActive,
      }, body.data);
      res.json(result.updated);
    } catch (error) {
      routeFailure(req, res, "pool update failed", error);
    }
  });

  app.put("/api/admin/equipment/pools/:id/items", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    const id = uuidSchema.safeParse(req.params.id);
    const body = adminEquipmentPoolItemsSchema.safeParse(req.body);
    if (!id.success || !body.success) {
      res.status(400).json({ message: body.success ? "装备池 ID 无效" : body.error.issues[0]?.message });
      return;
    }
    try {
      const updated = await replaceAdminEquipmentPoolItems(id.data, body.data.items);
      if (!updated) {
        res.status(404).json({ message: "没有找到这个装备池" });
        return;
      }
      audit(req, "EQUIPMENT_POOL_UPDATED", "equipment_pool", id.data, {
        items: updated.before.map((item: any) => ({
          itemId: item.itemId,
          weight: item.weight,
          isActive: item.isActive,
        })),
      }, {
        items: updated.after.map((item: any) => ({
          itemId: item.itemId,
          weight: item.weight,
          isActive: item.isActive,
        })),
      });
      res.json({ ok: true });
    } catch (error) {
      routeFailure(req, res, "pool items update failed", error);
    }
  });

  app.get("/api/admin/equipment/rewards", requireAdmin, async (req, res) => {
    const limit = z.coerce.number().int().min(1).max(200).catch(50).parse(req.query.limit);
    try {
      res.json(await listAdminEquipmentRewardActivity(limit));
    } catch (error) {
      routeFailure(req, res, "reward list failed", error);
    }
  });

  app.get("/api/admin/equipment/analytics", requireAdmin, async (req, res) => {
    const days = z.coerce.number().int().pipe(z.union([z.literal(7), z.literal(30), z.literal(90)])).catch(30).parse(req.query.days);
    try {
      res.json(await getAdminEquipmentAnalytics(days));
    } catch (error) {
      routeFailure(req, res, "analytics failed", error);
    }
  });
}
