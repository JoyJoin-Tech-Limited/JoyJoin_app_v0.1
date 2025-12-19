import { db } from "./db";
import { users, xpTransactions } from "@shared/schema";
import { eq, sql, desc } from "drizzle-orm";
import { 
  XP_REWARDS, 
  calculateLevel, 
  getLevelConfig, 
  getXPForNextLevel,
  type XPTransactionType 
} from "@shared/gamification";

// ============ XP/悦币发放服务 ============

interface AwardResult {
  success: boolean;
  xpAwarded: number;
  coinsAwarded: number;
  newXpTotal: number;
  newCoinsTotal: number;
  newLevel: number;
  leveledUp: boolean;
  oldLevel: number;
  error?: string;
}

/**
 * 发放XP和悦币给用户
 */
export async function awardXPAndCoins(
  userId: string,
  action: string,
  relatedEventId?: string,
  relatedFeedbackId?: string
): Promise<AwardResult> {
  const reward = XP_REWARDS[action];
  
  if (!reward) {
    return {
      success: false,
      xpAwarded: 0,
      coinsAwarded: 0,
      newXpTotal: 0,
      newCoinsTotal: 0,
      newLevel: 1,
      leveledUp: false,
      oldLevel: 1,
      error: `Unknown action: ${action}`,
    };
  }

  try {
    // 获取用户当前状态
    const [user] = await db
      .select({
        experiencePoints: users.experiencePoints,
        joyCoins: users.joyCoins,
        currentLevel: users.currentLevel,
      })
      .from(users)
      .where(eq(users.id, userId));

    if (!user) {
      return {
        success: false,
        xpAwarded: 0,
        coinsAwarded: 0,
        newXpTotal: 0,
        newCoinsTotal: 0,
        newLevel: 1,
        leveledUp: false,
        oldLevel: 1,
        error: "User not found",
      };
    }

    const oldXP = user.experiencePoints || 0;
    const oldCoins = user.joyCoins || 0;
    const oldLevel = user.currentLevel || 1;

    const newXpTotal = oldXP + reward.xp;
    const newCoinsTotal = oldCoins + reward.coins;
    const newLevel = calculateLevel(newXpTotal);
    const leveledUp = newLevel > oldLevel;

    // 更新用户积分
    await db
      .update(users)
      .set({
        experiencePoints: newXpTotal,
        joyCoins: newCoinsTotal,
        currentLevel: newLevel,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    // 记录交易日志
    await db.insert(xpTransactions).values({
      userId,
      transactionType: action,
      xpAmount: reward.xp,
      coinsAmount: reward.coins,
      xpBalance: newXpTotal,
      coinsBalance: newCoinsTotal,
      relatedEventId,
      relatedFeedbackId,
      description: reward.description,
      descriptionCn: reward.actionCn,
    });

    return {
      success: true,
      xpAwarded: reward.xp,
      coinsAwarded: reward.coins,
      newXpTotal,
      newCoinsTotal,
      newLevel,
      leveledUp,
      oldLevel,
    };
  } catch (error) {
    console.error("Error awarding XP:", error);
    return {
      success: false,
      xpAwarded: 0,
      coinsAwarded: 0,
      newXpTotal: 0,
      newCoinsTotal: 0,
      newLevel: 1,
      leveledUp: false,
      oldLevel: 1,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * 检查用户悦币余额是否足够
 */
export async function checkCoinBalance(
  userId: string,
  requiredCoins: number
): Promise<{ hasEnough: boolean; currentBalance: number; error?: string }> {
  try {
    const [user] = await db
      .select({
        joyCoins: users.joyCoins,
      })
      .from(users)
      .where(eq(users.id, userId));

    if (!user) {
      return { hasEnough: false, currentBalance: 0, error: "User not found" };
    }

    const currentBalance = user.joyCoins || 0;
    return { hasEnough: currentBalance >= requiredCoins, currentBalance };
  } catch (error) {
    console.error("Error checking coin balance:", error);
    return { hasEnough: false, currentBalance: 0, error: "Failed to check balance" };
  }
}

/**
 * 消耗悦币兑换物品
 */
export async function redeemCoins(
  userId: string,
  coinsToSpend: number,
  itemId: string,
  itemDescription: string
): Promise<{ success: boolean; newCoinsBalance: number; error?: string }> {
  try {
    // 获取用户当前悦币余额
    const [user] = await db
      .select({
        joyCoins: users.joyCoins,
        experiencePoints: users.experiencePoints,
      })
      .from(users)
      .where(eq(users.id, userId));

    if (!user) {
      return { success: false, newCoinsBalance: 0, error: "User not found" };
    }

    const currentCoins = user.joyCoins || 0;
    if (currentCoins < coinsToSpend) {
      return { success: false, newCoinsBalance: currentCoins, error: "Insufficient coins" };
    }

    const newCoinsBalance = currentCoins - coinsToSpend;

    // 更新用户悦币
    await db
      .update(users)
      .set({
        joyCoins: newCoinsBalance,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    // 记录交易日志
    await db.insert(xpTransactions).values({
      userId,
      transactionType: "redeem",
      xpAmount: 0,
      coinsAmount: -coinsToSpend,
      xpBalance: user.experiencePoints || 0,
      coinsBalance: newCoinsBalance,
      description: `Redeemed: ${itemId}`,
      descriptionCn: `兑换: ${itemDescription}`,
    });

    return { success: true, newCoinsBalance };
  } catch (error) {
    console.error("Error redeeming coins:", error);
    return {
      success: false,
      newCoinsBalance: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * 退还悦币（用于事务回滚）
 */
export async function refundCoins(
  userId: string,
  coinsToRefund: number,
  reason: string
): Promise<{ success: boolean; newCoinsBalance: number; error?: string }> {
  try {
    const [user] = await db
      .select({
        joyCoins: users.joyCoins,
        experiencePoints: users.experiencePoints,
      })
      .from(users)
      .where(eq(users.id, userId));

    if (!user) {
      return { success: false, newCoinsBalance: 0, error: "User not found" };
    }

    const currentCoins = user.joyCoins || 0;
    const newCoinsBalance = currentCoins + coinsToRefund;

    await db
      .update(users)
      .set({
        joyCoins: newCoinsBalance,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    await db.insert(xpTransactions).values({
      userId,
      transactionType: "refund",
      xpAmount: 0,
      coinsAmount: coinsToRefund,
      xpBalance: user.experiencePoints || 0,
      coinsBalance: newCoinsBalance,
      description: `Refund: ${reason}`,
      descriptionCn: `退还: ${reason}`,
    });

    return { success: true, newCoinsBalance };
  } catch (error) {
    console.error("Error refunding coins:", error);
    return {
      success: false,
      newCoinsBalance: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ============ 连击系统 ============

/**
 * 更新活动连击
 * @returns 新的连击天数和是否触发连击奖励
 */
export async function updateActivityStreak(
  userId: string
): Promise<{ 
  newStreak: number; 
  streakBonus?: { xp: number; coins: number; milestone: string };
  usedFreezeCard: boolean;
}> {
  try {
    const [user] = await db
      .select({
        activityStreak: users.activityStreak,
        lastActivityDate: users.lastActivityDate,
        streakFreezeAvailable: users.streakFreezeAvailable,
      })
      .from(users)
      .where(eq(users.id, userId));

    if (!user) {
      return { newStreak: 0, usedFreezeCard: false };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const lastActivity = user.lastActivityDate ? new Date(user.lastActivityDate) : null;
    const currentStreak = user.activityStreak || 0;
    let newStreak = currentStreak;
    let usedFreezeCard = false;

    if (lastActivity) {
      lastActivity.setHours(0, 0, 0, 0);
      const daysDiff = Math.floor((today.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysDiff === 0) {
        // 同一天，不增加连击
        return { newStreak: currentStreak, usedFreezeCard: false };
      } else if (daysDiff <= 7) {
        // 一周内有活动，连击+1
        newStreak = currentStreak + 1;
      } else if (daysDiff <= 14 && user.streakFreezeAvailable) {
        // 超过一周但两周内，使用冻结卡
        newStreak = currentStreak + 1;
        usedFreezeCard = true;
      } else {
        // 连击断了，重置为1
        newStreak = 1;
      }
    } else {
      // 首次活动
      newStreak = 1;
    }

    // 更新用户数据
    await db
      .update(users)
      .set({
        activityStreak: newStreak,
        lastActivityDate: today.toISOString().split('T')[0],
        streakFreezeAvailable: usedFreezeCard ? false : user.streakFreezeAvailable,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    // 检查连击里程碑奖励
    let streakBonus: { xp: number; coins: number; milestone: string } | undefined;
    
    if (newStreak === 3) {
      streakBonus = { xp: 200, coins: 100, milestone: "streak_3_weeks" };
    } else if (newStreak === 6) {
      streakBonus = { xp: 500, coins: 250, milestone: "streak_6_weeks" };
    } else if (newStreak === 12) {
      streakBonus = { xp: 1000, coins: 500, milestone: "streak_12_weeks" };
    }

    // 发放连击奖励
    if (streakBonus) {
      await awardXPAndCoins(userId, streakBonus.milestone);
    }

    return { newStreak, streakBonus, usedFreezeCard };
  } catch (error) {
    console.error("Error updating streak:", error);
    return { newStreak: 0, usedFreezeCard: false };
  }
}

// ============ 查询服务 ============

/**
 * 获取用户游戏化信息
 */
export async function getUserGamificationInfo(userId: string) {
  try {
    const [user] = await db
      .select({
        experiencePoints: users.experiencePoints,
        joyCoins: users.joyCoins,
        currentLevel: users.currentLevel,
        activityStreak: users.activityStreak,
        lastActivityDate: users.lastActivityDate,
        streakFreezeAvailable: users.streakFreezeAvailable,
        eventsAttended: users.eventsAttended,
      })
      .from(users)
      .where(eq(users.id, userId));

    if (!user) {
      return null;
    }

    const xp = user.experiencePoints || 0;
    const level = user.currentLevel || calculateLevel(xp);
    const levelConfig = getLevelConfig(level);
    const nextLevelInfo = getXPForNextLevel(xp);

    return {
      experiencePoints: xp,
      joyCoins: user.joyCoins || 0,
      currentLevel: level,
      levelConfig,
      nextLevelInfo,
      activityStreak: user.activityStreak || 0,
      lastActivityDate: user.lastActivityDate,
      streakFreezeAvailable: user.streakFreezeAvailable ?? true,
      eventsAttended: user.eventsAttended || 0,
    };
  } catch (error) {
    console.error("Error getting gamification info:", error);
    return null;
  }
}

/**
 * 获取用户XP交易历史
 */
export async function getUserTransactionHistory(
  userId: string,
  limit: number = 20
) {
  try {
    const transactions = await db
      .select()
      .from(xpTransactions)
      .where(eq(xpTransactions.userId, userId))
      .orderBy(desc(xpTransactions.createdAt))
      .limit(limit);

    return transactions;
  } catch (error) {
    console.error("Error getting transaction history:", error);
    return [];
  }
}

// ============ 管理员功能 ============

/**
 * 管理员调整用户积分
 */
export async function adminAdjustPoints(
  userId: string,
  xpAdjustment: number,
  coinsAdjustment: number,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const [user] = await db
      .select({
        experiencePoints: users.experiencePoints,
        joyCoins: users.joyCoins,
        currentLevel: users.currentLevel,
      })
      .from(users)
      .where(eq(users.id, userId));

    if (!user) {
      return { success: false, error: "User not found" };
    }

    const newXP = Math.max(0, (user.experiencePoints || 0) + xpAdjustment);
    const newCoins = Math.max(0, (user.joyCoins || 0) + coinsAdjustment);
    const newLevel = calculateLevel(newXP);

    await db
      .update(users)
      .set({
        experiencePoints: newXP,
        joyCoins: newCoins,
        currentLevel: newLevel,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    await db.insert(xpTransactions).values({
      userId,
      transactionType: "admin_adjust",
      xpAmount: xpAdjustment,
      coinsAmount: coinsAdjustment,
      xpBalance: newXP,
      coinsBalance: newCoins,
      description: `Admin adjustment: ${reason}`,
      descriptionCn: `管理员调整: ${reason}`,
    });

    return { success: true };
  } catch (error) {
    console.error("Error in admin adjustment:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}
