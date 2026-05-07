import type { Express } from "express";
import { db } from "../../db";
import { eq, and, desc, inArray } from "drizzle-orm";
import { blindBoxEvents, eventPools, eventPoolRegistrations } from "@shared/schema";
import { requireAdmin, requireOperatorOrAbove } from "../../adminAuth";
import { logger } from "../../lib/logger";
import { storage } from "../../storage";
import { broadcastAttendanceStatusUpdated } from "../../eventBroadcast";

function getUserDisplayName(user: any): string {
  return user?.displayName || user?.display_name || user?.firstName || 'Unknown';
}

function isParticipantOfBlindBoxEvent(event: any, userId: string): boolean {
  if (event.userId === userId) return true;
  const matchedAttendees = Array.isArray(event.matchedAttendees) ? event.matchedAttendees : [];
  return matchedAttendees.some((a: any) => a.userId === userId);
}

export function registerAttendanceRoutes(app: Express): void {
  // ============ ATTENDANCE STATUS ROUTES ============

  function getUserDisplayName(user: any): string {
    return user?.displayName || user?.display_name || user?.firstName || 'Unknown';
  }

  function isParticipantOfBlindBoxEvent(event: any, userId: string): boolean {
    if (event.userId === userId) return true;
    const matchedAttendees = Array.isArray(event.matchedAttendees) ? event.matchedAttendees : [];
    return matchedAttendees.some((a: any) => a.userId === userId);
  }

  // User: get my attendance status for an event

  // User: update my attendance status for an event

  // User/TableMates: get attendance summary for an event (all attendees' statuses)

  // Admin: get attendance summary for an event
  app.get('/api/admin/events/:eventId/attendance-summary', requireAdmin, async (req: any, res) => {
    try {
      const { eventId } = req.params;
      const summary = await storage.getEventAttendanceSummary(eventId);
      res.json(summary);
    } catch (error) {
      logger.error("[AttendanceStatus] Admin error fetching attendance summary", { error: String(error) });
      res.status(500).json({ message: "Failed to fetch attendance summary" });
    }
  });

  // Admin: override attendance status for a specific user
  app.patch('/api/admin/events/:eventId/attendees/:userId/attendance-status', requireAdmin, requireOperatorOrAbove, async (req: any, res) => {
    try {
      const adminId = req.session.userId;
      const { eventId, userId } = req.params;
      const { status } = req.body;

      const validStatuses = ['pending', 'confirmed', 'late', 'absent'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: "Invalid status value" });
      }

      await storage.adminOverrideAttendanceStatus(eventId, userId, status, adminId);

      // Broadcast the override
      const user = await storage.getUser(userId);
      const displayName = getUserDisplayName(user);
      broadcastAttendanceStatusUpdated(eventId, userId, displayName, status as any);

      res.json({ success: true });
    } catch (error) {
      logger.error("[AttendanceStatus] Admin error overriding status", { error: String(error) });
      res.status(500).json({ message: "Failed to override attendance status" });
    }
  });

  // ============ ADMIN BLIND BOX EVENT ROUTES ============
  // ============ ADMIN BLIND BOX EVENT ROUTES ============

  // Admin: list all blind box events (for management console)
  app.get('/api/admin/events', requireAdmin, async (req: any, res) => {
    try {
      const adminId = req.session.userId;
      logger.info("[AdminBlindBox] GET /api/admin/events by admin", { data: adminId });

      const events = await db
        .select()
        .from(blindBoxEvents)
        .orderBy(desc(blindBoxEvents.dateTime));

      logger.info("[AdminBlindBox] Loaded blind box events count", { data: events.length });
      res.json(events);
    } catch (error: any) {
      logger.error("[AdminBlindBox] Error fetching blind box events", { error: String(error) });
      res.status(500).json({
        message: "Failed to fetch blind box events",
        error: error?.message || String(error),
      });
    }
  });

  // Admin: create a blind box event (桌) that admins manage
  app.post('/api/admin/blind-box-events', requireAdmin, requireOperatorOrAbove, async (req: any, res) => {
    try {
      const adminId = req.session.userId;
      if (!adminId) {
        logger.error("[AdminBlindBox] No adminId in session on create");
        return res.status(401).json({ message: "Unauthorized" });
      }

      const {
        // 桌子标题（比如「海底捞」）
        title,
        // 饭局 / 酒局
        eventType,
        // 必须绑定一个池子：这个桌子就是在这个池子里开出来的
        poolId,
        // 预算档位（前端传的 budgetTier，直接存进去）
        budgetTier,
        // 下面几个是偏好字段，前端可能用 languages / cuisines / tasteIntensity，
        // 也可能用 selectedLanguages / selectedCuisines / selectedTasteIntensity，这里统一兼容
        languages,
        cuisines,
        tasteIntensity,
        selectedLanguages,
        selectedCuisines,
        selectedTasteIntensity,
        // 预留：后面如果要做「自动匹配」可以用这个开关
        autoMatch,
      } = req.body || {};

      // 必填校验：这里刻意不要求 city/district/dateTime，因为这些都从 pool 上继承
      if (!title || !eventType || !poolId || !budgetTier) {
        logger.warn("[AdminBlindBox] Missing required fields when creating blind box event");
        return res.status(400).json({
          message: "缺少必填字段：title / eventType / poolId / budgetTier",
        });
      }

      // 找到对应的活动池
      const [pool] = await db
        .select()
        .from(eventPools)
        .where(eq(eventPools.id, poolId));

      if (!pool) {
        logger.warn("[AdminBlindBox] Pool not found for create", { data: poolId });
        return res.status(404).json({ message: "活动池不存在" });
      }

      // 参数归一化
      const toStringArray = (value: any): string[] => {
        if (Array.isArray(value)) return value.map((v) => String(v));
        if (typeof value === "string") {
          return value
            .split(/[,\s/、]+/)
            .map((s) => s.trim())
            .filter(Boolean);
        }
        return [];
      };

      const normalizedLanguages = toStringArray(selectedLanguages ?? languages);
      const normalizedCuisines = toStringArray(selectedCuisines ?? cuisines);
      const normalizedTasteIntensity = toStringArray(selectedTasteIntensity ?? tasteIntensity);

      logger.info("[AdminBlindBox] incoming create payload:", {
        adminId,
        title,
        eventType,
        poolId,
        budgetTier,
        normalizedLanguages,
        normalizedCuisines,
        normalizedTasteIntensity,
        autoMatch,
      });

      const [created] = await db
        .insert(blindBoxEvents)
        .values({
          // 用 admin 的 userId 做创建者
          userId: adminId ?? "",
          title: title ?? "",
          eventType: eventType ?? "",
          // 城市 / 区域 / 时间直接继承池子的配置
          city: pool.city,
          district: pool.district ?? "",
          dateTime: pool.dateTime,
          // 绑定池子，后面匹配会用到
          poolId: pool.id,
          // 桌子的预算档
          budgetTier: budgetTier ?? "",
          // 偏好字段
          selectedLanguages: normalizedLanguages,
          selectedTasteIntensity: normalizedTasteIntensity,
          selectedCuisines: normalizedCuisines,
          cuisineTags: normalizedCuisines,
          // 桌子初始状态：匹配中
          status: "matching",
          progress: 0,
          currentParticipants: 0,
          totalParticipants: pool.maxGroupSize ?? null,
          // 暂时把池子的 venue 复用到店名/地址上（以后有更细 schema 再拆）
          restaurantName: null,
          restaurantAddress: null,
        })
        .returning();

      logger.info("[AdminBlindBox] created blindBoxEvent", { data: created });

      res.json(created);
    } catch (error: any) {
      logger.error("[AdminBlindBox] Failed to create blind box event", { error: String(error) });
      res.status(500).json({
        message: "Failed to create blind box event",
        error: error?.message || String(error),
      });
    }
  });

  // Admin: manual match trigger for blind box event
  app.post('/api/admin/events/:id/match', requireAdmin, requireOperatorOrAbove, async (req: any, res) => {
    try {
      const adminId = req.session.userId;
      const eventId = req.params.id;

      logger.info("[AdminBlindBox] manual match trigger by admin:", {
        adminId,
        eventId,
      });

      // 1. 读取桌子信息
      const [event] = await db
        .select()
        .from(blindBoxEvents)
        .where(eq(blindBoxEvents.id, eventId));

      if (!event) {
        logger.warn("[AdminBlindBox] event not found for manual match", { data: eventId });
        return res.status(404).json({ message: "Event not found" });
      }

      if (!event.poolId) {
        logger.warn("[AdminBlindBox] event has no poolId, cannot match", { data: eventId });
        return res.status(400).json({ message: "该盲盒活动未绑定活动池，无法匹配" });
      }

      // 2. 读取池子配置
      const [pool] = await db
        .select()
        .from(eventPools)
        .where(eq(eventPools.id, event.poolId));

      if (!pool) {
        logger.warn("[AdminBlindBox] pool not found for event:", {
          eventId,
          poolId: event.poolId,
        });
        return res.status(404).json({ message: "活动池不存在" });
      }

      const minSize = pool.minGroupSize ?? 4;
      const maxSize = pool.maxGroupSize ?? 6;

      // 3. 取出池子里所有「待匹配」的用户
      const pendingRegistrations = await db
        .select()
        .from(eventPoolRegistrations)
        .where(
          and(
            eq(eventPoolRegistrations.poolId, pool.id),
            eq(eventPoolRegistrations.matchStatus, "pending")
          )
        )
        .orderBy(eventPoolRegistrations.registeredAt);

      logger.info("[AdminBlindBox] pending registrations count", { data: pendingRegistrations.length });

      if (pendingRegistrations.length < minSize) {
        return res.status(400).json({
          message: `当前池子报名人数不足（${pendingRegistrations.length}/${minSize}），暂时无法成局`,
        });
      }

      // 简单版本：按报名先后顺序取一桌
      const groupSize = Math.min(maxSize, pendingRegistrations.length);
      const selected = pendingRegistrations.slice(0, groupSize);

      const selectedIds = (selected as any[]).map((r: any) => r.id);

      // 4. 更新报名记录为 matched，并标记桌子 id
      await db
        .update(eventPoolRegistrations)
        .set({
          matchStatus: "matched",
          assignedGroupId: event.id,
        })
        .where(inArray(eventPoolRegistrations.id, selectedIds));

      // 5. 更新桌子状态
      const [updatedEvent] = await db
        .update(blindBoxEvents)
        .set({
          status: "matched",
          progress: 100,
          currentParticipants: groupSize,
          totalParticipants: groupSize,
        })
        .where(eq(blindBoxEvents.id, event.id))
        .returning();

      logger.info("[AdminBlindBox] manual match finished:", {
        eventId: event.id,
        poolId: pool.id,
        groupSize,
      });

      return res.json({
        ok: true,
        event: updatedEvent,
        poolId: pool.id,
        groupSize,
        registrationIds: selectedIds,
      });
    } catch (error: any) {
      logger.error("[AdminBlindBox] Error in manual match", { error: String(error) });
      res.status(500).json({
        message: "Failed to run manual match",
        error: error?.message || String(error),
      });
    }
  });
  // // Admin: list all blind box events (for management console)


// =============================================end of blind box event routes============================
// ======================================================================================================












  // Demo endpoint to set match data for testing

}
