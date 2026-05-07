import { logger } from "../../lib/logger";
import type { Express } from "express";
import { venueMatchingService } from "../../venueMatchingService";
import { requireAdmin, requireOperatorOrAbove } from "../../adminAuth";
import { requireAuth } from "../../phoneAuth";
import { storage } from "../../storage";
import { calculateUserMatchScore, matchUsersToGroups, validateWeights, DEFAULT_WEIGHTS, type MatchingWeights } from "../../userMatchingService";
import type { User } from "@shared/schema";

export function registerMatchingConfigRoutes(app: Express): void {
  // ============ VENUE MATCHING ============
  
  // Find matching venues for event criteria
  app.post("/api/venues/match", requireAuth, async (req, res) => {
    try {
      const { eventType, theme, participantCount, preferredDistrict, preferredCity, cuisinePreferences, priceRange } = req.body;
      
      if (!eventType || !participantCount) {
        return res.status(400).json({ message: "eventType and participantCount are required" });
      }
      
      const matches = await venueMatchingService.findMatchingVenues({
        eventType,
        theme,
        participantCount,
        preferredDistrict,
        preferredCity,
        cuisinePreferences,
        priceRange,
      });
      
      res.json({ venues: matches });
    } catch (error) {
      logger.error("Error matching venues", { error: String(error) });
      res.status(500).json({ message: "Failed to match venues" });
    }
  });
  
  // Get best venue for event
  app.post("/api/venues/select-best", requireAuth, async (req, res) => {
    try {
      const { eventType, theme, participantCount, preferredDistrict, preferredCity, cuisinePreferences, priceRange } = req.body;
      
      if (!eventType || !participantCount) {
        return res.status(400).json({ message: "eventType and participantCount are required" });
      }
      
      const bestMatch = await venueMatchingService.selectBestVenue({
        eventType,
        theme,
        participantCount,
        preferredDistrict,
        preferredCity,
        cuisinePreferences,
        priceRange,
      });
      
      if (!bestMatch) {
        return res.status(404).json({ message: "No suitable venue found" });
      }
      
      res.json(bestMatch);
    } catch (error) {
      logger.error("Error selecting venue", { error: String(error) });
      res.status(500).json({ message: "Failed to select venue" });
    }
  });

  // ============ MATCHING ALGORITHM ENDPOINTS ============
  
  // Calculate match score between two users
  app.post("/api/matching/calculate-pair", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    try {
      const { userId1, userId2, weights } = req.body;
      
      if (!userId1 || !userId2) {
        return res.status(400).json({ message: "userId1 and userId2 are required" });
      }
      
      // Parallelize user fetching for better performance
      const [user1, user2] = await Promise.all([
        storage.getUserById(userId1),
        storage.getUserById(userId2)
      ]);
      
      if (!user1 || !user2) {
        return res.status(404).json({ message: "One or both users not found" });
      }
      
      const matchWeights: MatchingWeights = weights || DEFAULT_WEIGHTS;
      const score = calculateUserMatchScore(user1, user2, matchWeights);
      
      res.json(score);
    } catch (error) {
      logger.error("Error calculating match score", { error: String(error) });
      res.status(500).json({ message: "Failed to calculate match score" });
    }
  });
  
  // Match users to groups (主匹配算法)
  app.post("/api/matching/create-groups", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    try {
      const { userIds, config } = req.body;
      
      if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({ message: "userIds array is required" });
      }
      
      // 获取所有用户信息
      const users = await Promise.all(
        userIds.map(id => storage.getUserById(id))
      );
      
      const validUsers = users.filter((u): u is User => u !== undefined);
      
      if (validUsers.length < (config?.minGroupSize || 5)) {
        return res.status(400).json({ 
          message: `至少需要${config?.minGroupSize || 5}个有效用户` 
        });
      }
      
      const startTime = Date.now();
      const groups = matchUsersToGroups(validUsers, config);
      const executionTime = Date.now() - startTime;
      
      res.json({
        groups,
        totalUsers: validUsers.length,
        groupCount: groups.length,
        executionTimeMs: executionTime,
      });
    } catch (error: any) {
      logger.error("Error creating groups", { error: String(error) });
      res.status(500).json({ message: error.message || "Failed to create groups" });
    }
  });
  
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
  app.post("/api/matching/config", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    try {
      
      const config = req.body;
      
      const normalizedLanguageWeight =
        config.languageWeight ??
        ((config.cultureWeight ?? 0) + (config.conversationSignatureWeight ?? 0));

      // Translate legacy admin payload keys to the active 6-dimension vocabulary.
      // Legacy key                               → Active vocabulary key
      // personalityWeight                        → chemistryWeight
      // interestsWeight                          → interestWeight
      // intentWeight                             → preferenceWeight
      // backgroundWeight                         → backgroundDiversityWeight
      // cultureWeight + conversationSignatureWeight → languageWeight
      // (no legacy source)                       → socialAffinityWeight (default 0 for validation pass-through)
      const weightsForValidation: MatchingWeights = {
        chemistryWeight: config.chemistryWeight ?? config.personalityWeight ?? 0,
        interestWeight: config.interestWeight ?? config.interestsWeight ?? 0,
        preferenceWeight: config.preferenceWeight ?? config.intentWeight ?? 0,
        backgroundDiversityWeight: config.backgroundDiversityWeight ?? config.backgroundWeight ?? 0,
        languageWeight: normalizedLanguageWeight,
        socialAffinityWeight: config.socialAffinityWeight ?? 0,
      };

      const configForStorage = {
        configName: config.configName,
        personalityWeight: weightsForValidation.chemistryWeight,
        interestsWeight: weightsForValidation.interestWeight,
        intentWeight: weightsForValidation.preferenceWeight,
        backgroundWeight: weightsForValidation.backgroundDiversityWeight,
        cultureWeight: weightsForValidation.languageWeight,
        minGroupSize: config.minGroupSize,
        maxGroupSize: config.maxGroupSize,
        preferredGroupSize: config.preferredGroupSize,
        maxSameArchetypeRatio: config.maxSameArchetypeRatio,
        minChemistryScore: config.minChemistryScore,
        notes: config.notes,
        createdBy: config.createdBy,
      };

      // 验证权重
      const validation = validateWeights(weightsForValidation);
      
      if (!validation.valid) {
        return res.status(400).json({ message: validation.error });
      }
      
      const updatedConfig = await storage.updateMatchingConfig(configForStorage);
      res.json(updatedConfig);
    } catch (error) {
      logger.error("Error updating matching config", { error: String(error) });
      res.status(500).json({ message: "Failed to update matching config" });
    }
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
