/**
 * 滥用检测与资源保护模块
 * 处理行为监控、资源限制和惩罚机制
 */

import { db } from './db';
import { users } from '@joyjoin/shared/schema';
import { eq } from 'drizzle-orm';
import { filterContent, detectGibberish, detectRepetition, type ContentFilterResult, type ViolationType } from './contentFilter';

const DAILY_TOKEN_LIMIT = 50000;
const MAX_CONVERSATION_TURNS = 30;
const MIN_MESSAGE_INTERVAL_MS = 500;
const VIOLATION_THRESHOLDS = {
  WARNING_FREEZE_HOURS: 1,
  TEMP_BAN_COUNT: 3,
  TEMP_BAN_HOURS: 24,
  PERM_BAN_COUNT: 5
};

interface UserAbuseState {
  lastMessageTime: number;
  conversationTurns: number;
  recentMessages: string[];
}

const userStates = new Map<string, UserAbuseState>();

export interface AbuseCheckResult {
  allowed: boolean;
  reason?: string;
  action?: 'warn' | 'block' | 'freeze' | 'ban';
  violationType?: ViolationType;
  message?: string;
}

function getUserState(userId: string): UserAbuseState {
  if (!userStates.has(userId)) {
    userStates.set(userId, {
      lastMessageTime: 0,
      conversationTurns: 0,
      recentMessages: []
    });
  }
  return userStates.get(userId)!;
}

export function resetConversationTurns(userId: string): void {
  const state = getUserState(userId);
  state.conversationTurns = 0;
  state.recentMessages = [];
}

export async function checkUserAbuse(userId: string, message: string): Promise<AbuseCheckResult> {
  const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user.length) {
    return { allowed: false, reason: 'user_not_found', message: '用户不存在' };
  }

  const userData = user[0];

  if (userData.isBanned) {
    return { 
      allowed: false, 
      reason: 'banned', 
      action: 'ban',
      message: '您的账号已被封禁，如有疑问请联系客服。' 
    };
  }

  if (userData.aiFrozenUntil && new Date(userData.aiFrozenUntil) > new Date()) {
    const freezeEnd = new Date(userData.aiFrozenUntil);
    const hoursLeft = Math.ceil((freezeEnd.getTime() - Date.now()) / (1000 * 60 * 60));
    return { 
      allowed: false, 
      reason: 'frozen', 
      action: 'freeze',
      message: `AI功能暂时冻结，${hoursLeft}小时后恢复。` 
    };
  }

  const today = new Date().toISOString().split('T')[0];
  const lastReset = userData.lastTokenResetDate;
  let dailyTokenUsed = userData.dailyTokenUsed || 0;
  
  if (!lastReset || lastReset !== today) {
    dailyTokenUsed = 0;
    await db.update(users)
      .set({ dailyTokenUsed: 0, lastTokenResetDate: today })
      .where(eq(users.id, userId));
  }

  if (dailyTokenUsed >= DAILY_TOKEN_LIMIT) {
    return { 
      allowed: false, 
      reason: 'daily_limit', 
      action: 'freeze',
      message: '今日AI对话额度已用完，请明天再来。' 
    };
  }

  const state = getUserState(userId);
  const now = Date.now();

  if (now - state.lastMessageTime < MIN_MESSAGE_INTERVAL_MS) {
    return { 
      allowed: false, 
      reason: 'too_fast', 
      action: 'warn',
      message: '发送太快了，请稍后再试。' 
    };
  }

  if (state.conversationTurns >= MAX_CONVERSATION_TURNS) {
    return { 
      allowed: false, 
      reason: 'max_turns', 
      action: 'block',
      message: '对话轮次已达上限，请开始新对话。' 
    };
  }

  const contentResult = filterContent(message);
  if (contentResult.isViolation) {
    await recordViolation(userId, contentResult.violationType!, contentResult.severity as 'warning' | 'severe');
    
    if (contentResult.severity === 'severe') {
      return { 
        allowed: false, 
        reason: 'content_violation', 
        action: 'block',
        violationType: contentResult.violationType,
        message: contentResult.message 
      };
    } else {
      return { 
        allowed: true, 
        reason: 'content_warning', 
        action: 'warn',
        violationType: contentResult.violationType,
        message: contentResult.message 
      };
    }
  }

  if (detectGibberish(message)) {
    return { 
      allowed: false, 
      reason: 'gibberish', 
      action: 'warn',
      message: '请输入有意义的内容。' 
    };
  }

  if (detectRepetition(message)) {
    return { 
      allowed: false, 
      reason: 'repetition', 
      action: 'warn',
      message: '请避免重复发送相同内容。' 
    };
  }

  if (state.recentMessages.length >= 3) {
    const lastThree = state.recentMessages.slice(-3);
    if (lastThree.every(m => m === message)) {
      return { 
        allowed: false, 
        reason: 'duplicate_message', 
        action: 'warn',
        message: '请不要重复发送相同消息。' 
      };
    }
  }

  state.lastMessageTime = now;
  state.conversationTurns++;
  state.recentMessages.push(message);
  if (state.recentMessages.length > 10) {
    state.recentMessages.shift();
  }

  return { allowed: true };
}

export async function recordTokenUsage(userId: string, tokensUsed: number): Promise<void> {
  const user = await db.select({ dailyTokenUsed: users.dailyTokenUsed })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  
  if (user.length) {
    const newTotal = (user[0].dailyTokenUsed || 0) + tokensUsed;
    await db.update(users)
      .set({ dailyTokenUsed: newTotal })
      .where(eq(users.id, userId));
  }
}

async function recordViolation(userId: string, violationType: ViolationType, severity: 'warning' | 'severe'): Promise<void> {
  const user = await db.select({ violationCount: users.violationCount })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  
  if (!user.length) return;

  const currentCount = user[0].violationCount || 0;
  const newCount = currentCount + (severity === 'severe' ? 2 : 1);

  const updates: Partial<{
    violationCount: number;
    lastViolationReason: string;
    aiFrozenUntil: Date;
    isBanned: boolean;
  }> = {
    violationCount: newCount,
    lastViolationReason: violationType
  };

  if (newCount >= VIOLATION_THRESHOLDS.PERM_BAN_COUNT) {
    updates.isBanned = true;
  } else if (newCount >= VIOLATION_THRESHOLDS.TEMP_BAN_COUNT) {
    updates.aiFrozenUntil = new Date(Date.now() + VIOLATION_THRESHOLDS.TEMP_BAN_HOURS * 60 * 60 * 1000);
  } else if (severity === 'severe') {
    updates.aiFrozenUntil = new Date(Date.now() + VIOLATION_THRESHOLDS.WARNING_FREEZE_HOURS * 60 * 60 * 1000);
  }

  await db.update(users)
    .set(updates)
    .where(eq(users.id, userId));
}

export function getConversationTurns(userId: string): number {
  const state = getUserState(userId);
  return state.conversationTurns;
}
