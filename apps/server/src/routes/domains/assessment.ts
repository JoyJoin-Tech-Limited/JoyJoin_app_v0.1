import type { Express } from "express";
import { db } from "../../db";
import { requireAuth } from "../../middleware/auth";
import { storage } from "../../storage";
import { processTestV2, type AnswerV2 } from "../../personalityMatching";
import { isNotNull } from "drizzle-orm";
import { registerUserSchema, users } from "@shared/schema";
import type { ArchetypeName } from "../../archetypeConfig";
import { logger } from "../../lib/logger";
import { shellCache } from "../../lib/shellCache";

type Traits = {
  affinity: number;
  openness: number;
  conscientiousness: number;
  emotionalStability: number;
  extraversion: number;
  positivity: number;
};

const roleTraits: Record<ArchetypeName, Traits> = {
  "corgi": { affinity: 8, openness: 8, conscientiousness: 5, emotionalStability: 7, extraversion: 10, positivity: 10 },
  "rooster": { affinity: 9, openness: 7, conscientiousness: 8, emotionalStability: 9, extraversion: 7, positivity: 9 },
  "hamster_praise": { affinity: 10, openness: 8, conscientiousness: 7, emotionalStability: 8, extraversion: 9, positivity: 10 },
  "fox": { affinity: 7, openness: 10, conscientiousness: 6, emotionalStability: 8, extraversion: 8, positivity: 8 },
  "dolphin_calm": { affinity: 8, openness: 9, conscientiousness: 9, emotionalStability: 10, extraversion: 6, positivity: 8 },
  "spider": { affinity: 9, openness: 8, conscientiousness: 8, emotionalStability: 8, extraversion: 7, positivity: 7 },
  "koala": { affinity: 10, openness: 7, conscientiousness: 8, emotionalStability: 9, extraversion: 6, positivity: 9 },
  "octopus": { affinity: 7, openness: 10, conscientiousness: 5, emotionalStability: 8, extraversion: 8, positivity: 8 },
  "owl": { affinity: 6, openness: 9, conscientiousness: 10, emotionalStability: 9, extraversion: 5, positivity: 7 },
  "elephant": { affinity: 8, openness: 7, conscientiousness: 10, emotionalStability: 10, extraversion: 6, positivity: 7 },
  "turtle": { affinity: 7, openness: 8, conscientiousness: 9, emotionalStability: 9, extraversion: 4, positivity: 6 },
  "cat": { affinity: 6, openness: 7, conscientiousness: 8, emotionalStability: 9, extraversion: 4, positivity: 7 },
};

type Insights = {
  strengths: string;
  challenges: string;
  idealFriendTypes: ArchetypeName[];
};

const roleInsights: Record<ArchetypeName, Insights> = {
  "corgi": {
    strengths: "活力四射，擅长快速破冰",
    challenges: "有时过于热情，可能忽略细节",
    idealFriendTypes: ["koala", "hamster_praise", "dolphin_calm"],
  },
  "rooster": {
    strengths: "稳定温暖，给人安全感",
    challenges: "可能过于求稳，缺乏冒险精神",
    idealFriendTypes: ["corgi", "elephant", "dolphin_calm"],
  },
  "hamster_praise": {
    strengths: "正向反馈专家，情绪价值满分",
    challenges: "可能过于迎合，表达过于单一",
    idealFriendTypes: ["koala", "corgi", "spider"],
  },
  "fox": {
    strengths: "点子多，擅长发现新奇事物",
    challenges: "注意力容易分散，缺乏耐心",
    idealFriendTypes: ["octopus", "spider", "dolphin_calm"],
  },
  "dolphin_calm": {
    strengths: "情绪稳定，擅长调节气氛",
    challenges: "有时显得过于佛系，缺乏主见",
    idealFriendTypes: ["elephant", "rooster", "spider"],
  },
  "spider": {
    strengths: "连接者，能发现他人共同点",
    challenges: "可能过于关注关系网，忽略个人深度",
    idealFriendTypes: ["fox", "dolphin_calm", "koala"],
  },
  "koala": {
    strengths: "极佳的倾听者，共情力极强",
    challenges: "容易吸纳负面情绪，需要空间充电",
    idealFriendTypes: ["owl", "hamster_praise", "corgi"],
  },
  "octopus": {
    strengths: "创意无限，思维跳跃广阔",
    challenges: "想法太多难以落地，可能让人跟不上",
    idealFriendTypes: ["fox", "owl", "turtle"],
  },
  "owl": {
    strengths: "逻辑严密，提供深度洞察",
    challenges: "显得过于严肃，不擅长闲聊",
    idealFriendTypes: ["turtle", "koala", "elephant"],
  },
  "elephant": {
    strengths: "稳重可靠，是团队的定心丸",
    challenges: "节奏较慢，对变化反应略显迟钝",
    idealFriendTypes: ["rooster", "dolphin_calm", "owl"],
  },
  "turtle": {
    strengths: "看问题透彻，提供长远见解",
    challenges: "慢热，融入新群体需要时间",
    idealFriendTypes: ["owl", "elephant", "cat"],
  },
  "cat": {
    strengths: "安静观察者，提供舒适陪伴",
    challenges: "存在感弱，不擅长主动发起社交",
    idealFriendTypes: ["turtle", "elephant", "koala"],
  },
};

const roleMapping: Record<string, Record<string, string>> = {
  "1": { "A": "corgi", "B": "dolphin_calm", "C": "cat", "D": "spider" },
  "2": { "A": "fox", "B": "hamster_praise", "C": "koala", "D": "owl" },
  "3": { "A": "koala", "B": "rooster", "C": "cat", "D": "dolphin_calm" },
  "4": { "A": "octopus", "B": "owl", "C": "spider", "D": "elephant" },
  "5": { "A": "corgi", "B": "dolphin_calm", "C": "turtle", "D": "octopus" },
  "6": { "A": "turtle", "B": "hamster_praise", "C": "koala", "D": "elephant" },
  "7": { "A": "corgi", "B": "rooster", "C": "fox", "D": "cat" },
  "8": { "A": "hamster_praise", "B": "owl", "C": "spider", "D": "turtle" },
  "9": { "A": "corgi", "B": "rooster", "C": "elephant", "D": "cat" },
  "10": { "A": "rooster", "B": "fox", "C": "octopus", "D": "elephant" },
};

const supplementaryRoleMapping: Record<string, Record<string, string>> = {
  "101": { "A": "corgi", "B": "rooster" },
  "102": { "A": "corgi", "B": "rooster" },
  "103": { "A": "dolphin_calm", "B": "spider" },
  "104": { "A": "dolphin_calm", "B": "spider" },
  "105": { "A": "owl", "B": "turtle" },
  "106": { "A": "owl", "B": "turtle" },
  "107": { "A": "fox", "B": "octopus" },
  "108": { "A": "fox", "B": "octopus" },
  "109": { "A": "koala", "B": "hamster_praise" },
  "110": { "A": "koala", "B": "hamster_praise" },
  "111": { "A": "elephant", "B": "dolphin_calm" },
  "112": { "A": "elephant", "B": "dolphin_calm" },
  "113": { "A": "cat", "B": "turtle" },
  "114": { "A": "cat", "B": "turtle" },
  "115": { "A": "corgi", "B": "fox" },
  "116": { "A": "rooster", "B": "koala" },
  "117": { "A": "spider", "B": "fox" },
  "118": { "A": "octopus", "B": "owl" },
  "119": { "A": "elephant", "B": "turtle" },
  "120": { "A": "hamster_praise", "B": "rooster" },
};

function calculateRoleScores(responses: Record<number, any>): Record<string, number> {
  const scores: Record<string, number> = {
    "corgi": 0,
    "rooster": 0,
    "hamster_praise": 0,
    "fox": 0,
    "dolphin_calm": 0,
    "spider": 0,
    "koala": 0,
    "octopus": 0,
    "owl": 0,
    "elephant": 0,
    "turtle": 0,
    "cat": 0,
  };

  Object.entries(responses).forEach(([questionId, answer]) => {
    const questionNum = parseInt(questionId);
    const mapping = questionNum >= 101 ? supplementaryRoleMapping[questionId] : roleMapping[questionId];
    if (mapping && mapping[answer as string]) {
      const role = mapping[answer as string];
      scores[role] += questionNum >= 101 ? 3 : 2;
    }
  });

  return scores;
}

export function determineSubtype(primaryArchetype: string, responses: Record<number, any>): string {
  const subtypeMap: Record<string, string[]> = {
    "corgi": ["活力型", "社交型", "冒险型"],
    "rooster": ["温暖型", "稳定型", "关怀型"],
    "hamster_praise": ["鼓励型", "治愈型", "欢乐型"],
    "fox": ["创意型", "智慧型", "探索型"],
    "dolphin_calm": ["平和型", "理性型", "包容型"],
    "spider": ["连接型", "协调型", "组织型"],
    "koala": ["照顾型", "倾听型", "支持型"],
    "octopus": ["想象型", "艺术型", "自由型"],
    "owl": ["深度型", "分析型", "洞察型"],
    "elephant": ["稳重型", "可靠型", "领导型"],
    "turtle": ["谨慎型", "耐心型", "思考型"],
    "cat": ["内敛型", "观察型", "陪伴型"],
  };
  return subtypeMap[primaryArchetype]?.[0] || "平衡型";
}

function calculateTraitScores(primaryArchetype: string, secondaryArchetype: string | null): {
  affinityScore: number;
  opennessScore: number;
  conscientiousnessScore: number;
  emotionalStabilityScore: number;
  extraversionScore: number;
  positivityScore: number;
} {
  const primary = roleTraits[primaryArchetype as ArchetypeName] || roleTraits["dolphin_calm"];
  const secondary = secondaryArchetype ? roleTraits[secondaryArchetype as ArchetypeName] : null;

  if (!secondary) {
    return {
      affinityScore: primary.affinity,
      opennessScore: primary.openness,
      conscientiousnessScore: primary.conscientiousness,
      emotionalStabilityScore: primary.emotionalStability,
      extraversionScore: primary.extraversion,
      positivityScore: primary.positivity,
    };
  }

  return {
    affinityScore: Math.round(primary.affinity * 0.7 + secondary.affinity * 0.3),
    opennessScore: Math.round(primary.openness * 0.7 + secondary.openness * 0.3),
    conscientiousnessScore: Math.round(primary.conscientiousness * 0.7 + secondary.conscientiousness * 0.3),
    emotionalStabilityScore: Math.round(primary.emotionalStability * 0.7 + secondary.emotionalStability * 0.3),
    extraversionScore: Math.round(primary.extraversion * 0.7 + secondary.extraversion * 0.3),
    positivityScore: Math.round(primary.positivity * 0.7 + secondary.positivity * 0.3),
  };
}

export function generateInsights(primaryArchetype: string, secondaryArchetype: string | null): Insights {
  return roleInsights[primaryArchetype as ArchetypeName] || roleInsights["dolphin_calm"];
}

export function registerAssessmentRoutes(app: Express): void {
  // Registration routes
  app.post('/api/user/register', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      logger.info("[Backend] Received registration data", { data: req.body });
      const result = registerUserSchema.safeParse(req.body);

      if (!result.success) {
        logger.error("Validation failed", { error: String(result.error) });
        return res.status(400).json({ error: result.error });
      }

      logger.info("[Backend] Validated data", { data: result.data });
      const user = await storage.registerUser(userId, result.data);
      logger.info("[Backend] User updated successfully", { data: { id: user.id, displayName: user.displayName, gender: user.gender, birthdate: user.birthdate } });

      try {
        const { awardXPAndCoins } = await import('../../gamificationService');
        await awardXPAndCoins(userId, 'registration');
        logger.info(`[Gamification] Awarded registration XP to user ${userId}`);
      } catch (xpError) {
        logger.error("Error awarding registration XP:", { error: xpError instanceof Error ? xpError.message : String(xpError) });
      }

      try {
        const { dialogueEmbeddingsService } = await import('../../dialogueEmbeddingsService');
        const verifiedPhone = req.session?.verifiedPhoneNumber;
        if (verifiedPhone) {
          const linkResult = await dialogueEmbeddingsService.linkByPhoneNumber(verifiedPhone, userId);
          if (linkResult.linked > 0) {
            logger.info(`[AI Evolution] Linked ${linkResult.linked} records by phone to user ${userId}`);
          } else {
            const sessionId = req.session?.chatSessionId || req.body?.chatSessionId || req.sessionID;
            if (sessionId) {
              const sessionResult = await dialogueEmbeddingsService.linkSessionToUser(sessionId, userId);
              logger.info(`[AI Evolution] Fallback: Linked ${sessionResult.linked} records by sessionId to user ${userId}`);
            }
          }
        } else {
          const sessionId = req.session?.chatSessionId || req.body?.chatSessionId || req.sessionID;
          if (sessionId) {
            const linkResult = await dialogueEmbeddingsService.linkSessionToUser(sessionId, userId);
            logger.info(`[AI Evolution] Linked ${linkResult.linked} records from session ${sessionId} to user ${userId}`);
          }
        }
      } catch (linkError) {
        logger.error('Failed to link insights to user', { error: linkError instanceof Error ? linkError.message : String(linkError) });
      }

      res.json(user);
    } catch (error: any) {
      logger.error("Error registering user:", { error: error instanceof Error ? error.message : String(error) });
      const errorMessage = error?.message || "Failed to register user";
      res.status(500).json({
        message: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error?.stack : undefined,
      });
    }
  });

  // Personality test routes
  app.post('/api/personality-test/preliminary-score', requireAuth, async (req: any, res) => {
    try {
      const { responses } = req.body;
      const roleScores = calculateRoleScores(responses);

      const sortedRoles = Object.entries(roleScores)
        .sort(([roleA, scoreA], [roleB, scoreB]) => {
          if (scoreB !== scoreA) return scoreB - scoreA;
          return roleA.localeCompare(roleB);
        });

      const top1 = sortedRoles[0];
      const top2 = sortedRoles[1];
      const scoreDiff = top1[1] - top2[1];
      const SUPPLEMENTARY_THRESHOLD = 3;

      if (scoreDiff < SUPPLEMENTARY_THRESHOLD) {
        res.json({
          needsSupplementary: true,
          candidateArchetypes: [
            { name: top1[0], score: top1[1] },
            { name: top2[0], score: top2[1] },
          ],
          allScores: roleScores,
        });
      } else {
        const primaryArchetype = top1[0];
        const rawSecondaryArchetype = top2[0];
        const secondaryArchetype = top2[1] >= 70 ? rawSecondaryArchetype : null;
        const roleSubtype = determineSubtype(primaryArchetype, responses);
        const traitScores = calculateTraitScores(primaryArchetype, secondaryArchetype);
        const insights = generateInsights(primaryArchetype, secondaryArchetype);

        res.json({
          needsSupplementary: false,
          result: {
            primaryArchetype,
            primaryArchetypeScore: top1[1],
            secondaryArchetype,
            secondaryArchetypeScore: secondaryArchetype ? top2[1] : 0,
            roleSubtype,
            ...traitScores,
            ...insights,
          },
        });
      }
    } catch (error) {
      logger.error("Error in preliminary scoring:", { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ message: "Failed to calculate preliminary score" });
    }
  });

  app.post('/api/personality-test/submit', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { responses } = req.body;
      const roleScores = calculateRoleScores(responses);

      const sortedRoles = Object.entries(roleScores)
        .sort(([roleA, scoreA], [roleB, scoreB]) => {
          if (scoreB !== scoreA) return scoreB - scoreA;
          return roleA.localeCompare(roleB);
        });

      const primaryArchetype = sortedRoles[0][0];
      const primaryArchetypeScore = sortedRoles[0][1];
      const rawSecondaryArchetype = sortedRoles[1]?.[0] || null;
      const secondaryArchetypeScoreRaw = sortedRoles[1]?.[1] || 0;
      const secondaryArchetype = secondaryArchetypeScoreRaw >= 70 ? rawSecondaryArchetype : null;
      const secondaryArchetypeScore = secondaryArchetype ? secondaryArchetypeScoreRaw : 0;

      const roleSubtype = determineSubtype(primaryArchetype, responses);
      const traitScores = calculateTraitScores(primaryArchetype, secondaryArchetype);
      const insights = generateInsights(primaryArchetype, secondaryArchetype);

      await storage.saveTestResponses(userId, responses);
      const roleResult = await storage.saveRoleResult(userId, {
        userId,
        primaryArchetype: primaryArchetype as any,
        primaryArchetypeScore,
        secondaryArchetype: secondaryArchetype as any,
        secondaryArchetypeScore,
        roleSubtype,
        roleScores,
        ...traitScores,
        ...insights,
        testVersion: 1,
      });

      await storage.markPersonalityTestComplete(userId);
      res.json(roleResult);
    } catch (error) {
      logger.error("Error submitting personality test:", { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ message: "Failed to submit personality test" });
    }
  });

  app.post('/api/personality-test/v2/submit', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { responses } = req.body as { responses: Record<number, AnswerV2> };
      const matchResult = processTestV2(responses);

      const primaryArchetype = matchResult.primaryArchetype;
      const rawSecondaryArchetype = matchResult.secondaryArchetype;
      const secondaryArchetype = matchResult.secondaryMatchScore >= 70 ? rawSecondaryArchetype : null;
      const roleSubtype = determineSubtype(primaryArchetype, responses);
      const insights = generateInsights(primaryArchetype, secondaryArchetype);

      await storage.saveTestResponses(userId, responses);
      const roleResult = await storage.saveRoleResult(userId, {
        userId,
        primaryArchetype: primaryArchetype as any,
        primaryArchetypeScore: matchResult.primaryMatchScore,
        secondaryArchetype: secondaryArchetype as any,
        secondaryArchetypeScore: secondaryArchetype ? matchResult.secondaryMatchScore : 0,
        roleSubtype,
        roleScores: {},
        affinityScore: matchResult.userTraits.A,
        opennessScore: matchResult.userTraits.O,
        conscientiousnessScore: matchResult.userTraits.C,
        emotionalStabilityScore: matchResult.userTraits.E,
        extraversionScore: matchResult.userTraits.X,
        positivityScore: matchResult.userTraits.P,
        ...insights,
        testVersion: 2,
      });

      await storage.markPersonalityTestComplete(userId);

      try {
        // Award welcome coupon: prefer WELCOME50 (50% off), fallback to WELCOME40.
        // Admin controls the actual discount value via the coupon record.
        const welcomeCoupon50 = await storage.getCouponByCode('WELCOME50');
        const welcomeCoupon40 = await storage.getCouponByCode('WELCOME40');
        const welcomeCoupon = welcomeCoupon50 ?? welcomeCoupon40;
        if (welcomeCoupon) {
          const existingCoupons = await storage.getUserCoupons(userId);
          const alreadyHas = existingCoupons.some((uc: any) => uc.coupon_id === welcomeCoupon.id);
          if (!alreadyHas) {
            await storage.createUserCoupon({
              userId,
              couponId: welcomeCoupon.id,
              source: 'registration_complete',
            });
            shellCache.invalidateUser(userId);
            logger.info(`[Registration] Awarded welcome coupon ${welcomeCoupon.code} to user ${userId}`);
          }
        }
      } catch (couponError) {
        logger.error("Error awarding welcome coupon:", { error: couponError instanceof Error ? couponError.message : String(couponError) });
      }

      res.json({
        ...roleResult,
        matchDetails: {
          primaryDistance: matchResult.primaryDistance,
          secondaryDistance: matchResult.secondaryDistance,
          userTraits: matchResult.userTraits,
        },
        welcomeCouponAwarded: true,
      });
    } catch (error) {
      logger.error("Error submitting V2 personality test:", { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ message: "Failed to submit V2 personality test" });
    }
  });

  app.get('/api/user/coupons', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const coupons = await storage.getUserCoupons(userId);
      res.json({ count: coupons.length, coupons });
    } catch (error) {
      logger.error("Error fetching user coupons:", { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ message: "Failed to fetch coupons" });
    }
  });

  app.get('/api/user/coupons/expiring', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const withinDays = parseInt(req.query.days as string) || 7;
      const coupons = await storage.getUserCoupons(userId);
      const now = new Date();
      const thresholdDate = new Date(now.getTime() + withinDays * 24 * 60 * 60 * 1000);

      const expiringCoupons = coupons.filter((coupon: any) => {
        if (coupon.is_used) return false;
        if (!coupon.valid_until) return false;

        const validUntil = new Date(coupon.valid_until);
        return validUntil > now && validUntil <= thresholdDate;
      }).map((coupon: any) => {
        const validUntil = new Date(coupon.valid_until);
        const daysRemaining = Math.ceil((validUntil.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
        return {
          id: coupon.id,
          code: coupon.code,
          discountType: coupon.discount_type,
          discountValue: coupon.discount_value,
          validFrom: coupon.valid_from,
          validUntil: coupon.valid_until,
          isUsed: coupon.is_used,
          source: coupon.source,
          daysRemaining,
          isUrgent: daysRemaining <= 3,
        };
      });

      res.json({
        expiringCoupons,
        totalExpiring: expiringCoupons.length,
        urgentCount: expiringCoupons.filter((c: any) => c.isUrgent).length,
      });
    } catch (error) {
      logger.error("Error fetching expiring coupons:", { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ message: "Failed to fetch expiring coupons" });
    }
  });

  app.get('/api/user/gamification', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { getUserGamificationInfo } = await import('../../gamificationService');
      const info = await getUserGamificationInfo(userId);

      if (!info) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json(info);
    } catch (error) {
      logger.error("Error fetching gamification info:", { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ message: "Failed to fetch gamification info" });
    }
  });

  app.get('/api/user/gamification/history', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const limit = parseInt(req.query.limit as string) || 20;
      const { getUserTransactionHistory } = await import('../../gamificationService');
      const history = await getUserTransactionHistory(userId, limit);
      res.json(history);
    } catch (error) {
      logger.error("Error fetching transaction history:", { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ message: "Failed to fetch transaction history" });
    }
  });

  app.post('/api/user/gamification/redeem', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { itemId } = req.body;

      if (!itemId) {
        return res.status(400).json({ message: "Item ID is required" });
      }

      const { REDEEMABLE_ITEMS } = await import('@shared/gamification');
      const item = REDEEMABLE_ITEMS.find(i => i.id === itemId);

      if (!item) {
        return res.status(404).json({ message: "Item not found" });
      }

      const { checkCoinBalance, redeemCoins, refundCoins } = await import('../../gamificationService');
      const balanceCheck = await checkCoinBalance(userId, item.costCoins);

      if (!balanceCheck.hasEnough) {
        return res.status(400).json({
          message: balanceCheck.error || "悦币不足",
          currentBalance: balanceCheck.currentBalance,
          required: item.costCoins,
        });
      }

      const result = await redeemCoins(userId, item.costCoins, item.id, item.nameCn);

      if (!result.success) {
        return res.status(400).json({ message: result.error || "Redemption failed" });
      }

      if (item.type === 'discount_coupon' || item.type === 'free_event') {
        try {
          const expiryDate = new Date();
          expiryDate.setDate(expiryDate.getDate() + item.validDays);

          const existingCoupons = await storage.getAllCoupons();
          let couponId = existingCoupons.find((c: any) => c.code === item.id)?.id;

          if (!couponId) {
            const newCoupon = await storage.createCoupon({
              code: item.id,
              discountType: 'percentage',
              discountValue: item.value,
              description: item.descriptionCn,
              expiresAt: expiryDate,
              maxUses: 10000,
              currentUses: 0,
              isActive: true,
            });
            couponId = newCoupon.id;
          }

          await storage.createUserCoupon({
            userId,
            couponId,
            source: 'joy_coins_redemption',
          });
          shellCache.invalidateUser(userId);
        } catch (couponError) {
          logger.error("Coupon creation failed, initiating refund:", { error: couponError instanceof Error ? couponError.message : String(couponError) });

          const refundResult = await refundCoins(userId, item.costCoins, `兑换失败退还 - ${item.nameCn}`);

          if (refundResult.success) {
            return res.status(500).json({
              message: "优惠券创建失败，悦币已退还，请重试",
              refunded: true,
              newCoinsBalance: refundResult.newCoinsBalance,
            });
          }

          logger.error("Critical: Both coupon creation and refund failed", { error: refundResult.error ?? 'unknown' });
          return res.status(500).json({
            message: "系统错误，请联系客服处理",
            coinsDeducted: item.costCoins,
          });
        }
      }

      res.json({
        success: true,
        newCoinsBalance: result.newCoinsBalance,
        redeemedItem: item,
      });
    } catch (error) {
      logger.error("Error redeeming coins:", { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ message: "Failed to redeem coins" });
    }
  });

  app.get('/api/user/gamification/redeemable-items', requireAuth, async (_req: any, res) => {
    try {
      const { REDEEMABLE_ITEMS } = await import('@shared/gamification');
      res.json(REDEEMABLE_ITEMS);
    } catch (error) {
      logger.error("Error fetching redeemable items:", { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ message: "Failed to fetch redeemable items" });
    }
  });

  app.get('/api/gamification/levels', async (_req, res) => {
    try {
      const { LEVELS } = await import('@shared/gamification');
      res.json(LEVELS);
    } catch (error) {
      logger.error("Error fetching levels:", { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ message: "Failed to fetch levels" });
    }
  });

  app.get('/api/user/gamification/level-discount', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { getLevelDiscount, getLevelConfig } = await import('@shared/gamification');
      const userLevel = user.currentLevel || 1;
      const discountPercent = getLevelDiscount(userLevel);
      const levelConfig = getLevelConfig(userLevel);

      res.json({
        level: userLevel,
        levelName: levelConfig.nameCn,
        discountPercent,
        hasDiscount: discountPercent > 0,
      });
    } catch (error) {
      logger.error("Error fetching level discount:", { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ message: "Failed to fetch level discount" });
    }
  });

  app.get('/api/personality-test/results', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const result = await storage.getRoleResult(userId);

      if (!result) {
        return res.status(404).json({ message: "No test results found" });
      }

      res.json(result);
    } catch (error) {
      logger.error("Error fetching test results:", { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ message: "Failed to fetch test results" });
    }
  });

  app.get('/api/personality-test/stats', requireAuth, async (_req: any, res) => {
    try {
      const stats = await storage.getPersonalityDistribution();
      res.json(stats);
    } catch (error) {
      logger.error("Error fetching personality stats:", { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ message: "Failed to fetch personality stats" });
    }
  });

  app.get('/api/personality/role-distribution', requireAuth, async (_req: any, res) => {
    try {
      const allUsers = await db.select({ primaryArchetype: users.primaryArchetype }).from(users).where(isNotNull(users.primaryArchetype)).limit(1000);

      if (allUsers.length === 0) {
        const defaultDistribution: Record<string, number> = {
          'corgi': 8,
          'rooster': 9,
          'hamster_praise': 8,
          'fox': 9,
          'dolphin_calm': 8,
          'spider': 7,
          'koala': 9,
          'octopus': 8,
          'owl': 7,
          'elephant': 6,
          'turtle': 5,
          'cat': 6,
        };
        return res.json(defaultDistribution);
      }

      const distribution: Record<string, number> = {
        'corgi': 0,
        'rooster': 0,
        'hamster_praise': 0,
        'fox': 0,
        'dolphin_calm': 0,
        'spider': 0,
        'koala': 0,
        'octopus': 0,
        'owl': 0,
        'elephant': 0,
        'turtle': 0,
        'cat': 0,
      };

      allUsers.forEach((user: any) => {
        if (user.primaryArchetype && distribution.hasOwnProperty(user.primaryArchetype)) {
          distribution[user.primaryArchetype] += 1;
        }
      });

      const total = allUsers.length;
      const percentages: Record<string, number> = {};
      Object.keys(distribution).forEach((role) => {
        percentages[role] = Math.round((distribution[role] / total) * 100);
      });

      res.json(percentages);
    } catch (error) {
      logger.error("Error fetching role distribution:", { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ message: "Failed to fetch role distribution" });
    }
  });
}
