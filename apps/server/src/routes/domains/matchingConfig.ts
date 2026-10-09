import { logger } from "../../lib/logger";
import type { Express } from "express";
import { requireAdmin, requireOperatorOrAbove } from "../../adminAuth";
import { storage } from "../../storage";
import { matchUsersToGroups } from "../../userMatchingService";
import type { User } from "@shared/schema";

export function registerMatchingConfigRoutes(app: Express): void {
  
  // Get current matching configuration
  app.get("/api/matching/config", requireAdmin, async (req, res) => {
    try {
      // 从数据库获取活跃配置，如果没有则返回默认配置
      const activeConfig = await storage.getActiveMatchingConfig();
      
      if (activeConfig) {
        res.json(activeConfig);
      } else {
        res.json({
          configName: "default",
          personalityWeight: 30,
          interestsWeight: 25,
          intentWeight: 20,
          backgroundWeight: 15,
          cultureWeight: 10,
          minGroupSize: 5,
          maxGroupSize: 10,
          preferredGroupSize: 7,
          maxSameArchetypeRatio: 40,
          minChemistryScore: 60,
          isActive: true,
        });
      }
    } catch (error) {
      logger.error("Error getting matching config", { error: String(error) });
      res.status(500).json({ message: "Failed to get matching config" });
    }
  });
  
  // Update matching configuration (Admin only)
  // DEPRECATED (Phase-0 W7, 2026-08-03): this legacy endpoint writes the
  // `matching_config` row consumed ONLY by the lab/legacy userMatchingService —
  // it never affected the live pool-matching pipeline (poolMatchingService),
  // which made it an admin trap. It now returns 410 Gone. Live controls:
  // - thresholds: PUT /api/admin/matching-thresholds (admin UI: 匹配配置 /admin/matching-config)
  // - adaptive weights: /api/admin/evolution/weights* (aiServices.ts)
  app.post("/api/matching/config", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    logger.warn("Deprecated POST /api/matching/config called (returns 410)", {
      data: { adminId: (req as any).adminAccount?.id ?? (req.session as any)?.userId ?? "unknown" },
    });
    res.status(410).json({
      message:
        "POST /api/matching/config is deprecated and no longer accepts updates. " +
        "This legacy config only fed the matching lab and never affected live pool matching. " +
        "Use PUT /api/admin/matching-thresholds for live matching thresholds, " +
        "or the /api/admin/evolution/weights endpoints for adaptive weights.",
      deprecated: true,
      replacementEndpoints: [
        "PUT /api/admin/matching-thresholds",
        "GET/POST /api/admin/evolution/weights",
      ],
    });
  });
  
  // Test matching scenario (Admin only - for algorithm tuning)
  app.post("/api/matching/test-scenario", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    try {
      
      const { userIds, config } = req.body;
      
      if (!userIds || !Array.isArray(userIds)) {
        return res.status(400).json({ message: "userIds array is required" });
      }
      
      const users = await Promise.all(
        userIds.map(id => storage.getUserById(id))
      );
      
      const validUsers = users.filter((u): u is User => u !== undefined);
      
      const startTime = Date.now();
      const groups = matchUsersToGroups(validUsers, config);
      const executionTime = Date.now() - startTime;
      
      // 计算整体评分指标
      const avgChemistryScore = Math.round(
        groups.reduce((sum, g) => sum + g.avgChemistryScore, 0) / groups.length
      );
      const avgDiversityScore = Math.round(
        groups.reduce((sum, g) => sum + g.diversityScore, 0) / groups.length
      );
      const overallMatchQuality = Math.round((avgChemistryScore + avgDiversityScore) / 2);
      
      // 保存测试结果到数据库
      const result = await storage.saveMatchingResult({
        userIds,
        userCount: validUsers.length,
        groups: groups.map(g => ({
          groupId: g.groupId,
          userIds: g.userIds,
          chemistryScore: g.avgChemistryScore,
          diversityScore: g.diversityScore,
          overallScore: g.overallScore,
        })),
        groupCount: groups.length,
        avgChemistryScore,
        avgDiversityScore,
        overallMatchQuality,
        executionTimeMs: executionTime,
        isTestRun: true,
        configId: config?.configId,
        notes: config?.notes,
      });
      
      res.json({
        testId: result.id,
        groups,
        metrics: {
          totalUsers: validUsers.length,
          groupCount: groups.length,
          avgChemistryScore,
          avgDiversityScore,
          overallMatchQuality,
          executionTimeMs: executionTime,
        },
      });
    } catch (error: any) {
      logger.error("Error testing matching scenario", { error: String(error) });
      res.status(500).json({ message: error.message || "Failed to test matching scenario" });
    }
  });
}
