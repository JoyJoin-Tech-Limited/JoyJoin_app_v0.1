/**
 * 滥用检测与资源保护模块
 * 处理行为监控、资源限制和惩罚机制
 */

import { db } from './db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { type ViolationType } from './contentFilter';

const VIOLATION_THRESHOLDS = {
  WARNING_FREEZE_HOURS: 1,
  TEMP_BAN_COUNT: 3,
  TEMP_BAN_HOURS: 24,
  PERM_BAN_COUNT: 5
};

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

export async function recordViolation(userId: string, violationType: ViolationType, severity: 'warning' | 'severe'): Promise<void> {
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
