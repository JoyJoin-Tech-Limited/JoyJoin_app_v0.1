/**
 * KPI Service (关键绩效指标服务)
 * 
 * 负责收集、计算和存储平台关键绩效指标，支持：
 * - 日常 KPI 快照生成
 * - 用户参与度跟踪
 * - 活动满意度汇总
 * - CSAT 和 NPS 计算
 * - 流失风险预测
 */

import { db } from './db';
import { 
  users, 
  events, 
  eventFeedback, 
  eventPoolRegistrations,
  blindBoxEvents,
  kpiSnapshots,
  userEngagementMetrics,
  eventSatisfactionSummary,
  dialogueFeedback,
  type EventFeedback,
  type EventPoolRegistration,
  type UserEngagementMetrics as UserEngagementMetricsType,
} from '@shared/schema';
import { eq, sql, and, gte, lte, count, avg } from 'drizzle-orm';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';

// ============ CSAT 计算 ============

/**
 * 计算 CSAT (Customer Satisfaction) 分数
 * CSAT = (满意反馈数 / 总反馈数) * 100
 * 满意反馈定义为 atmosphereScore >= 4
 */
export async function calculateCSAT(startDate: Date, endDate: Date): Promise<number> {
  const feedbacks = await db.select({
    atmosphereScore: eventFeedback.atmosphereScore,
  })
    .from(eventFeedback)
    .where(
      and(
        gte(eventFeedback.createdAt, startDate),
        lte(eventFeedback.createdAt, endDate)
      )
    );

  if (feedbacks.length === 0) return 0;

  const satisfiedCount = feedbacks.filter((f: { atmosphereScore: number | null }) => 
    f.atmosphereScore && f.atmosphereScore >= 4
  ).length;

  return (satisfiedCount / feedbacks.length) * 100;
}

/**
 * 计算 NPS (Net Promoter Score)
 * NPS = % Promoters (>=9) - % Detractors (<=6)
 * 将 1-5 等级映射到 1-10 等级
 */
export async function calculateNPS(startDate: Date, endDate: Date): Promise<number> {
  const feedbacks = await db.select({
    atmosphereScore: eventFeedback.atmosphereScore,
    wouldAttendAgain: eventFeedback.wouldAttendAgain,
    connectionStatus: eventFeedback.connectionStatus,
  })
    .from(eventFeedback)
    .where(
      and(
        gte(eventFeedback.createdAt, startDate),
        lte(eventFeedback.createdAt, endDate)
      )
    );

  if (feedbacks.length === 0) return 0;

  let promoters = 0;
  let detractors = 0;

  feedbacks.forEach(f => {
    // 使用综合评分计算 NPS
    // atmosphereScore (1-5) * 2 = 2-10
    const score = (f.atmosphereScore || 3) * 2;
    
    // 加分因素
    let adjustedScore = score;
    if (f.wouldAttendAgain) adjustedScore += 1;
    if (f.connectionStatus === "已交换联系方式") adjustedScore += 1;
    
    // 限制在 1-10 范围
    adjustedScore = Math.min(10, Math.max(1, adjustedScore));
    
    if (adjustedScore >= 9) promoters++;
    else if (adjustedScore <= 6) detractors++;
  });

  return Math.round(((promoters - detractors) / feedbacks.length) * 100);
}

// ============ 用户参与度 ============

/**
 * 更新用户参与度指标
 */
export async function updateUserEngagement(userId: string): Promise<void> {
  // 获取用户活动历史
  const registrations = await db.select()
    .from(eventPoolRegistrations)
    .where(eq(eventPoolRegistrations.userId, userId));

  const feedbacks = await db.select()
    .from(eventFeedback)
    .where(eq(eventFeedback.userId, userId));

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user) return;

  // 计算基本指标
  const totalEventsAttended = registrations.filter(r => r.matchStatus === 'matched').length;
  const totalFeedbackGiven = feedbacks.length;

  // 计算平均满意度
  const satisfactionScores = feedbacks
    .filter(f => f.atmosphereScore)
    .map(f => f.atmosphereScore!);
  const avgSatisfactionScore = satisfactionScores.length > 0
    ? satisfactionScores.reduce((a, b) => a + b, 0) / satisfactionScores.length
    : null;

  // 计算最后活动日期
  const lastEventDate = registrations.length > 0
    ? registrations.sort((a, b) => 
        new Date(b.registeredAt || 0).getTime() - new Date(a.registeredAt || 0).getTime()
      )[0].registeredAt
    : null;

  // 计算流失状态（30天无活动）
  const daysSinceLastActivity = lastEventDate
    ? Math.floor((Date.now() - new Date(lastEventDate).getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const isChurned = daysSinceLastActivity ? daysSinceLastActivity > 30 : false;

  // 注册队列（YYYY-MM）
  const registrationCohort = user.createdAt
    ? format(new Date(user.createdAt), 'yyyy-MM')
    : null;

  // 更新或插入用户参与度记录
  const existing = await db.query.userEngagementMetrics.findFirst({
    where: eq(userEngagementMetrics.userId, userId),
  });

  const metricsData = {
    userId,
    totalEventsAttended,
    totalFeedbackGiven,
    avgSatisfactionScore: avgSatisfactionScore?.toFixed(2) || null,
    lastEventDate: lastEventDate ? format(new Date(lastEventDate), 'yyyy-MM-dd') : null,
    lastActiveDate: format(new Date(), 'yyyy-MM-dd'),
    daysSinceLastActivity,
    isChurned,
    registrationCohort,
    registrationMethod: user.registrationMethod,
    updatedAt: new Date(),
  };

  if (existing) {
    await db.update(userEngagementMetrics)
      .set(metricsData)
      .where(eq(userEngagementMetrics.id, existing.id));
  } else {
    await db.insert(userEngagementMetrics).values({
      ...metricsData,
      createdAt: new Date(),
    });
  }
}

// ============ 活动满意度汇总 ============

/**
 * 更新活动满意度汇总
 */
export async function updateEventSatisfaction(eventId: string, eventType: string): Promise<void> {
  const feedbacks = await db.select()
    .from(eventFeedback)
    .where(eq(eventFeedback.eventId, eventId));

  if (feedbacks.length === 0) return;

  // 计算汇总指标
  const atmosphereScores = feedbacks
    .filter(f => f.atmosphereScore)
    .map(f => f.atmosphereScore!);
  const avgAtmosphereScore = atmosphereScores.length > 0
    ? atmosphereScores.reduce((a, b) => a + b, 0) / atmosphereScores.length
    : null;

  // 连接情况统计
  const hasConnections = feedbacks.filter(f => f.hasNewConnections).length;
  const connectionRate = feedbacks.length > 0 
    ? hasConnections / feedbacks.length 
    : 0;

  // 场地满意度统计
  const venueLikeCount = feedbacks.filter(f => f.venueStyleRating === 'like').length;
  const venueNeutralCount = feedbacks.filter(f => f.venueStyleRating === 'neutral').length;
  const venueDislikeCount = feedbacks.filter(f => f.venueStyleRating === 'dislike').length;

  // 更新或插入汇总记录
  const existing = await db.query.eventSatisfactionSummary.findFirst({
    where: eq(eventSatisfactionSummary.eventId, eventId),
  });

  const summaryData = {
    eventId,
    eventType,
    feedbackCount: feedbacks.length,
    avgAtmosphereScore: avgAtmosphereScore?.toFixed(2) || null,
    connectionRate: connectionRate.toFixed(4),
    totalConnectionsMade: hasConnections,
    venueLikeCount,
    venueNeutralCount,
    venueDislikeCount,
    updatedAt: new Date(),
  };

  if (existing) {
    await db.update(eventSatisfactionSummary)
      .set(summaryData)
      .where(eq(eventSatisfactionSummary.id, existing.id));
  } else {
    await db.insert(eventSatisfactionSummary).values({
      ...summaryData,
      createdAt: new Date(),
    });
  }
}

// ============ 日常 KPI 快照 ============

/**
 * 生成每日 KPI 快照
 */
export async function generateDailyKpiSnapshot(date: Date = new Date()): Promise<void> {
  const snapshotDate = format(date, 'yyyy-MM-dd');
  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);
  const weekAgo = subDays(date, 7);
  const monthAgo = subDays(date, 30);

  // Parallelize all database queries for better performance
  const [
    [totalUsersResult],
    [newUsersTodayResult],
    [totalEventsResult],
    [newEventsTodayResult],
    [feedbackCountResult],
    [avgAtmosphereResult],
    csatScore,
    npsScore,
    [churnedUsersResult],
    [xiaoyueChatResult],
    [avgXiaoyueRatingResult]
  ] = await Promise.all([
    db.select({ count: count() }).from(users),
    db.select({ count: count() })
      .from(users)
      .where(and(
        gte(users.createdAt, dayStart),
        lte(users.createdAt, dayEnd)
      )),
    db.select({ count: count() }).from(events),
    db.select({ count: count() })
      .from(blindBoxEvents)
      .where(and(
        gte(blindBoxEvents.createdAt, dayStart),
        lte(blindBoxEvents.createdAt, dayEnd)
      )),
    db.select({ count: count() })
      .from(eventFeedback)
      .where(and(
        gte(eventFeedback.createdAt, monthAgo),
        lte(eventFeedback.createdAt, dayEnd)
      )),
    db.select({ avg: avg(eventFeedback.atmosphereScore) })
      .from(eventFeedback)
      .where(and(
        gte(eventFeedback.createdAt, monthAgo),
        lte(eventFeedback.createdAt, dayEnd)
      )),
    calculateCSAT(monthAgo, dayEnd),
    calculateNPS(monthAgo, dayEnd),
    db.select({ count: count() })
      .from(userEngagementMetrics)
      .where(eq(userEngagementMetrics.isChurned, true)),
    db.select({ count: count() })
      .from(dialogueFeedback)
      .where(and(
        gte(dialogueFeedback.createdAt, monthAgo),
        lte(dialogueFeedback.createdAt, dayEnd)
      ))
  ]);

  // 检查是否已存在今日快照
  const existing = await db.query.kpiSnapshots.findFirst({
    where: eq(kpiSnapshots.snapshotDate, snapshotDate),
  });

  const snapshotData = {
    snapshotDate,
    periodType: 'daily' as const,
    totalUsers: totalUsersResult.count,
    newUsersToday: newUsersTodayResult.count,
    totalEvents: totalEventsResult.count,
    newEventsToday: newEventsTodayResult.count,
    feedbackCount: feedbackCountResult.count,
    avgAtmosphereScore: avgAtmosphereResult.avg?.toString() || null,
    csatScore: csatScore.toFixed(2),
    npsScore: Math.round(npsScore),
    churnedUsersCount: churnedUsersResult.count,
    xiaoyueChatCount: xiaoyueChatResult.count,
    avgXiaoyueRating: avgXiaoyueRatingResult.avg?.toString() || null,
  };

  if (existing) {
    await db.update(kpiSnapshots)
      .set(snapshotData)
      .where(eq(kpiSnapshots.id, existing.id));
  } else {
    await db.insert(kpiSnapshots).values({
      ...snapshotData,
      createdAt: new Date(),
    });
  }

  console.log(`[KPI] Daily snapshot generated for ${snapshotDate}`);
}

// ============ KPI 仪表盘数据 ============

/**
 * 获取 KPI 仪表盘数据
 */
export async function getKpiDashboardData(days: number = 30) {
  const startDate = subDays(new Date(), days);
  const endDate = new Date();

  // 获取历史快照
  const snapshots = await db.select()
    .from(kpiSnapshots)
    .where(and(
      gte(kpiSnapshots.snapshotDate, format(startDate, 'yyyy-MM-dd')),
      lte(kpiSnapshots.snapshotDate, format(endDate, 'yyyy-MM-dd'))
    ))
    .orderBy(kpiSnapshots.snapshotDate);

  // 获取最新快照
  const latestSnapshot = snapshots[snapshots.length - 1];

  // 计算趋势
  const previousSnapshot = snapshots[Math.max(0, snapshots.length - 8)]; // 一周前
  
  return {
    current: latestSnapshot,
    history: snapshots,
    trends: {
      userGrowth: latestSnapshot && previousSnapshot
        ? ((latestSnapshot.totalUsers || 0) - (previousSnapshot.totalUsers || 0))
        : 0,
      csatTrend: latestSnapshot && previousSnapshot
        ? (parseFloat(latestSnapshot.csatScore || '0') - parseFloat(previousSnapshot.csatScore || '0'))
        : 0,
      npsTrend: latestSnapshot && previousSnapshot
        ? ((latestSnapshot.npsScore || 0) - (previousSnapshot.npsScore || 0))
        : 0,
    },
  };
}

/**
 * 获取用户流失分析
 */
export async function getChurnAnalysis() {
  const churnedUsers = await db.select()
    .from(userEngagementMetrics)
    .where(eq(userEngagementMetrics.isChurned, true));

  // 按注册队列分组
  const byRegistrationCohort = new Map<string, number>();
  churnedUsers.forEach(u => {
    const cohort = u.registrationCohort || 'unknown';
    byRegistrationCohort.set(cohort, (byRegistrationCohort.get(cohort) || 0) + 1);
  });

  // 按注册方式分组
  const byRegistrationMethod = new Map<string, number>();
  churnedUsers.forEach(u => {
    const method = u.registrationMethod || 'unknown';
    byRegistrationMethod.set(method, (byRegistrationMethod.get(method) || 0) + 1);
  });

  return {
    totalChurned: churnedUsers.length,
    byCohort: Object.fromEntries(byRegistrationCohort),
    byMethod: Object.fromEntries(byRegistrationMethod),
    avgEventsBeforeChurn: churnedUsers.length > 0
      ? churnedUsers.reduce((sum, u) => sum + (u.totalEventsAttended || 0), 0) / churnedUsers.length
      : 0,
  };
}

// ============ V2 Assessment Metrics ============

export interface AssessmentMetrics {
  totalAssessments: number;
  v1Count: number;
  v2Count: number;
  v2Percentage: number;
  decisiveCount: number;
  decisiveRatio: number;
  avgConfidence: number;
  avgQuestions: number;
  confidenceDistribution: {
    low: number;    // < 0.5
    medium: number; // 0.5 - 0.7
    high: number;   // > 0.7
  };
  completionRates: {
    v1: number;
    v2: number;
  };
}

/**
 * Get V2 assessment metrics for monitoring and A/B test analysis
 */
export async function getAssessmentMetrics(startDate: Date, endDate: Date): Promise<AssessmentMetrics> {
  // Query assessment sessions within date range
  const sessions = await db.execute(sql`
    SELECT 
      algorithm_version,
      is_decisive,
      confidence_score,
      answer_count,
      status
    FROM assessment_sessions
    WHERE created_at >= ${startDate}
      AND created_at <= ${endDate}
  `);

  const rows = sessions.rows as Array<{
    algorithm_version: string | null;
    is_decisive: boolean | null;
    confidence_score: string | null;
    answer_count: number | null;
    status: string | null;
  }>;

  if (rows.length === 0) {
    return {
      totalAssessments: 0,
      v1Count: 0,
      v2Count: 0,
      v2Percentage: 0,
      decisiveCount: 0,
      decisiveRatio: 0,
      avgConfidence: 0,
      avgQuestions: 0,
      confidenceDistribution: { low: 0, medium: 0, high: 0 },
      completionRates: { v1: 0, v2: 0 },
    };
  }

  const completed = rows.filter(r => r.status === 'completed');
  const v1Sessions = completed.filter(r => !r.algorithm_version || r.algorithm_version === 'v1');
  const v2Sessions = completed.filter(r => r.algorithm_version === 'v2');

  const decisiveCount = v2Sessions.filter(r => r.is_decisive === true).length;

  // Confidence distribution for V2 sessions
  let lowConf = 0, medConf = 0, highConf = 0;
  let totalConfidence = 0;
  let confCount = 0;

  v2Sessions.forEach(r => {
    if (r.confidence_score) {
      const conf = parseFloat(r.confidence_score);
      totalConfidence += conf;
      confCount++;
      if (conf < 0.5) lowConf++;
      else if (conf <= 0.7) medConf++;
      else highConf++;
    }
  });

  // Average questions
  const totalQuestions = completed.reduce((sum, r) => sum + (r.answer_count || 0), 0);

  // Completion rates (started vs completed)
  const v1Started = rows.filter(r => !r.algorithm_version || r.algorithm_version === 'v1').length;
  const v2Started = rows.filter(r => r.algorithm_version === 'v2').length;

  return {
    totalAssessments: completed.length,
    v1Count: v1Sessions.length,
    v2Count: v2Sessions.length,
    v2Percentage: completed.length > 0 ? (v2Sessions.length / completed.length) * 100 : 0,
    decisiveCount,
    decisiveRatio: v2Sessions.length > 0 ? decisiveCount / v2Sessions.length : 0,
    avgConfidence: confCount > 0 ? totalConfidence / confCount : 0,
    avgQuestions: completed.length > 0 ? totalQuestions / completed.length : 0,
    confidenceDistribution: {
      low: lowConf,
      medium: medConf,
      high: highConf,
    },
    completionRates: {
      v1: v1Started > 0 ? v1Sessions.length / v1Started : 0,
      v2: v2Started > 0 ? v2Sessions.length / v2Started : 0,
    },
  };
}

/**
 * Log assessment completion for telemetry
 */
export function logAssessmentCompletion(data: {
  userId: number;
  sessionId: string;
  algorithmVersion: 'v1' | 'v2';
  isDecisive: boolean;
  confidenceScore: number;
  questionCount: number;
  archetype: string;
}) {
  console.log(`[Assessment Telemetry] User ${data.userId} completed ${data.algorithmVersion} assessment:`, {
    sessionId: data.sessionId,
    archetype: data.archetype,
    isDecisive: data.isDecisive,
    confidence: data.confidenceScore.toFixed(3),
    questions: data.questionCount,
  });
}

// ============ 导出服务 ============

export const kpiService = {
  calculateCSAT,
  calculateNPS,
  updateUserEngagement,
  updateEventSatisfaction,
  generateDailyKpiSnapshot,
  getKpiDashboardData,
  getChurnAnalysis,
  getAssessmentMetrics,
  logAssessmentCompletion,
};
