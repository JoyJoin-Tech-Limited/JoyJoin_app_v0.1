/**
 * 注册漏斗分析服务
 * 
 * 收集和分析用户注册过程中的三层信息漏斗数据
 * - L1 (显式基础): 7个必问字段的完成率
 * - L2 (自然丰富): 11个可选字段的参与度
 * - L3 (隐藏洞察): AI推断的置信度和准确率
 */

import { db } from '../db';
import { users, registrationSessions } from '@joyjoin/shared/schema';
import { sql, count, and, gte, lte, isNotNull, desc } from 'drizzle-orm';
import { storage } from '../storage';

// ============ 类型定义 ============

export interface RegistrationFunnelKPIs {
  // 总体转化
  totalStarted: number;
  totalCompleted: number;
  conversionRate: number;
  avgCompletionTimeMinutes: number;
  
  // 7天对比
  completedLast7Days: number;
  completedPrevious7Days: number;
  
  // L3 置信度
  avgL3Confidence: number;
}

export interface L1FieldDropoff {
  field: string;
  fieldLabel: string;
  started: number;
  completed: number;
  dropoffRate: number;
}

export interface L2Engagement {
  field: string;
  fieldLabel: string;
  totalEligible: number;
  filled: number;
  engagementRate: number;
}

export interface L3ConfidenceTrend {
  date: string;
  avgConfidence: number;
  sampleSize: number;
}

export interface FunnelStage {
  stage: string;
  stageLabel: string;
  count: number;
  percentage: number;
}

export interface RegistrationFunnelData {
  kpis: RegistrationFunnelKPIs;
  funnelStages: FunnelStage[];
  l1FieldDropoffs: L1FieldDropoff[];
  l2Engagements: L2Engagement[];
  l3ConfidenceTrend: L3ConfidenceTrend[];
  sessionDurationDistribution: { range: string; count: number }[];
}

// ============ L1 字段定义 ============

const L1_FIELDS = [
  { field: 'display_name', label: '昵称', isArray: false },
  { field: 'phone_number', label: '手机号', isArray: false },
  { field: 'gender', label: '性别', isArray: false },
  { field: 'birthdate', label: '年龄段', isArray: false },
  { field: 'current_city', label: '现居城市', isArray: false },
  { field: 'hometown_region_city', label: '家乡省份', isArray: false },
  { field: 'languages_comfort', label: '语言偏好', isArray: true },
];

// ============ L2 字段定义 ============

const L2_FIELDS = [
  { field: 'interests_top', label: '兴趣爱好', isArray: true },
  { field: 'occupation_id', label: '职业', isArray: false },
  { field: 'intent', label: '社交意向', isArray: true },
  { field: 'social_style', label: '社交风格', isArray: false },
  { field: 'ideal_group_size', label: '理想人数', isArray: false },
  { field: 'budget_range', label: '预算范围', isArray: false },
  { field: 'activity_time_preferences', label: '时间偏好', isArray: true },
  { field: 'dietary_restrictions', label: '饮食限制', isArray: true },
  { field: 'education_level', label: '学历', isArray: false },
  { field: 'relationship_status', label: '感情状态', isArray: false },
  { field: 'work_mode', label: '工作模式', isArray: false },
];

// ============ 分析函数 ============

/**
 * 获取注册漏斗完整数据
 */
export async function getRegistrationFunnelData(): Promise<RegistrationFunnelData> {
  const [kpis, funnelStages, l1FieldDropoffs, l2Engagements, l3ConfidenceTrend, sessionDurationDistribution] = await Promise.all([
    getKPIs(),
    getFunnelStages(),
    getL1FieldDropoffs(),
    getL2Engagements(),
    getL3ConfidenceTrend(),
    getSessionDurationDistribution(),
  ]);

  return {
    kpis,
    funnelStages,
    l1FieldDropoffs,
    l2Engagements,
    l3ConfidenceTrend,
    sessionDurationDistribution,
  };
}

/**
 * 获取核心KPI指标
 * 优先使用registration_sessions表的真实遥测数据，无数据时回退到users表统计
 */
async function getKPIs(): Promise<RegistrationFunnelKPIs> {
  // First, try to get stats from registration_sessions table (authoritative source)
  const sessionStats = await storage.getRegistrationSessionStats();
  
  // If we have session data, use it as the primary source
  if (sessionStats.totalStarted > 0) {
    const conversionRate = sessionStats.totalStarted > 0 
      ? (sessionStats.totalCompleted / sessionStats.totalStarted) * 100 
      : 0;
    
    return {
      totalStarted: sessionStats.totalStarted,
      totalCompleted: sessionStats.totalCompleted,
      conversionRate,
      avgCompletionTimeMinutes: sessionStats.avgCompletionTimeMinutes,
      completedLast7Days: sessionStats.completedLast7Days,
      completedPrevious7Days: sessionStats.completedPrevious7Days,
      avgL3Confidence: sessionStats.avgL3Confidence,
    };
  }
  
  // Fallback to users table for historical data (before session telemetry was implemented)
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  // 总用户数（已开始注册）
  const [totalResult] = await db
    .select({ count: count() })
    .from(users);
  const totalStarted = totalResult?.count || 0;

  // 已完成注册
  const [completedResult] = await db
    .select({ count: count() })
    .from(users)
    .where(sql`${users.hasCompletedRegistration} = true`);
  const totalCompleted = completedResult?.count || 0;

  // 近7天完成 (exclusive lower bound)
  const [last7DaysResult] = await db
    .select({ count: count() })
    .from(users)
    .where(and(
      sql`${users.hasCompletedRegistration} = true`,
      sql`${users.createdAt} > ${sevenDaysAgo}`
    ));
  const completedLast7Days = last7DaysResult?.count || 0;

  // 前7天完成 (exclusive bounds to avoid overlap)
  const [prev7DaysResult] = await db
    .select({ count: count() })
    .from(users)
    .where(and(
      sql`${users.hasCompletedRegistration} = true`,
      sql`${users.createdAt} > ${fourteenDaysAgo}`,
      sql`${users.createdAt} <= ${sevenDaysAgo}`
    ));
  const completedPrevious7Days = prev7DaysResult?.count || 0;

  // 转化率
  const conversionRate = totalStarted > 0 ? (totalCompleted / totalStarted) * 100 : 0;

  // 平均完成时长 - 从users表估算（无session数据时返回0而非魔术数字）
  let avgCompletionTimeMinutes = 0;
  
  try {
    const [timeResult] = await db
      .select({
        avgMinutes: sql<number>`AVG(EXTRACT(EPOCH FROM (${users.updatedAt} - ${users.createdAt})) / 60)`
      })
      .from(users)
      .where(sql`${users.hasCompletedRegistration} = true AND ${users.updatedAt} > ${users.createdAt}`);
    if (timeResult?.avgMinutes && timeResult.avgMinutes > 0 && timeResult.avgMinutes < 60) {
      avgCompletionTimeMinutes = Math.round(timeResult.avgMinutes * 10) / 10;
    }
  } catch {
    // Keep 0 as fallback (no fake data)
  }

  // L3 平均置信度 - 无session数据时返回0，从真实数据派生
  let avgL3Confidence = 0;
  
  try {
    // 计算有方言数据的用户比例作为L3置信度代理指标
    const [dialectResult] = await db
      .select({ count: count() })
      .from(users)
      .where(sql`"detected_dialect" IS NOT NULL AND "detected_dialect" != ''`);
    const dialectFilled = dialectResult?.count || 0;
    
    if (totalCompleted > 0) {
      // L3置信度 = 能推断出方言的用户比例（纯数据派生，无魔术数字）
      avgL3Confidence = Math.min(1.0, dialectFilled / totalCompleted);
    }
  } catch {
    // Keep 0 as fallback (no fake data)
  }

  return {
    totalStarted,
    totalCompleted,
    conversionRate,
    avgCompletionTimeMinutes,
    completedLast7Days,
    completedPrevious7Days,
    avgL3Confidence,
  };
}

/**
 * 获取漏斗各阶段数据
 */
async function getFunnelStages(): Promise<FunnelStage[]> {
  // 阶段1: 开始注册（有记录的用户）
  const [startedResult] = await db
    .select({ count: count() })
    .from(users);
  const started = startedResult?.count || 0;

  // 阶段2: L1完成（基础信息填完）
  const [l1CompleteResult] = await db
    .select({ count: count() })
    .from(users)
    .where(and(
      isNotNull(users.displayName),
      isNotNull(users.gender),
      isNotNull(users.currentCity)
    ));
  const l1Complete = l1CompleteResult?.count || 0;

  // 阶段3: L2参与（填写了可选信息）
  const [l2EngagedResult] = await db
    .select({ count: count() })
    .from(users)
    .where(sql`${users.interestsTop} IS NOT NULL AND array_length(${users.interestsTop}, 1) > 0`);
  const l2Engaged = l2EngagedResult?.count || 0;

  // 阶段4: L3推断（完成对话，有推断数据）
  const [l3InferredResult] = await db
    .select({ count: count() })
    .from(users)
    .where(sql`${users.hasCompletedRegistration} = true`);
  const l3Inferred = l3InferredResult?.count || 0;

  // 阶段5: 注册完成
  const [completedResult] = await db
    .select({ count: count() })
    .from(users)
    .where(sql`${users.hasCompletedRegistration} = true`);
  const completed = completedResult?.count || 0;

  const stages: FunnelStage[] = [
    { stage: 'started', stageLabel: '开始注册', count: started, percentage: 100 },
    { stage: 'l1_complete', stageLabel: 'L1 基础信息', count: l1Complete, percentage: started > 0 ? (l1Complete / started) * 100 : 0 },
    { stage: 'l2_engaged', stageLabel: 'L2 兴趣填写', count: l2Engaged, percentage: started > 0 ? (l2Engaged / started) * 100 : 0 },
    { stage: 'l3_inferred', stageLabel: 'L3 AI推断', count: l3Inferred, percentage: started > 0 ? (l3Inferred / started) * 100 : 0 },
    { stage: 'completed', stageLabel: '注册完成', count: completed, percentage: started > 0 ? (completed / started) * 100 : 0 },
  ];

  return stages;
}

/**
 * 获取L1字段流失热力图数据
 */
async function getL1FieldDropoffs(): Promise<L1FieldDropoff[]> {
  const results: L1FieldDropoff[] = [];
  
  // 总用户数
  const [totalResult] = await db.select({ count: count() }).from(users);
  const total = totalResult?.count || 0;

  for (const { field, label, isArray } of L1_FIELDS) {
    let filledCount = 0;
    
    try {
      if (isArray) {
        const [result] = await db
          .select({ count: count() })
          .from(users)
          .where(sql`"${sql.raw(field)}" IS NOT NULL AND array_length("${sql.raw(field)}", 1) > 0`);
        filledCount = result?.count || 0;
      } else {
        const [result] = await db
          .select({ count: count() })
          .from(users)
          .where(sql`"${sql.raw(field)}" IS NOT NULL AND "${sql.raw(field)}" != ''`);
        filledCount = result?.count || 0;
      }
    } catch (e) {
      // 字段可能不存在，返回0
      filledCount = 0;
    }

    results.push({
      field,
      fieldLabel: label,
      started: total,
      completed: filledCount,
      dropoffRate: total > 0 ? Math.max(0, ((total - filledCount) / total) * 100) : 0,
    });
  }

  // 按流失率降序排列
  return results.sort((a, b) => b.dropoffRate - a.dropoffRate);
}

/**
 * 获取L2可选字段参与度
 */
async function getL2Engagements(): Promise<L2Engagement[]> {
  const results: L2Engagement[] = [];

  // 已完成L1的用户作为分母
  const [eligibleResult] = await db
    .select({ count: count() })
    .from(users)
    .where(and(
      isNotNull(users.displayName),
      isNotNull(users.gender)
    ));
  const totalEligible = eligibleResult?.count || 0;

  for (const { field, label, isArray } of L2_FIELDS) {
    let filledCount = 0;
    
    try {
      if (isArray) {
        const [result] = await db
          .select({ count: count() })
          .from(users)
          .where(sql`"${sql.raw(field)}" IS NOT NULL AND array_length("${sql.raw(field)}", 1) > 0`);
        filledCount = result?.count || 0;
      } else {
        const [result] = await db
          .select({ count: count() })
          .from(users)
          .where(sql`"${sql.raw(field)}" IS NOT NULL AND "${sql.raw(field)}" != ''`);
        filledCount = result?.count || 0;
      }
    } catch (e) {
      // 字段可能不存在，返回0
      filledCount = 0;
    }

    results.push({
      field,
      fieldLabel: label,
      totalEligible,
      filled: filledCount,
      engagementRate: totalEligible > 0 ? Math.max(0, (filledCount / totalEligible) * 100) : 0,
    });
  }

  // 按参与度降序排列
  return results.sort((a, b) => b.engagementRate - a.engagementRate);
}

/**
 * 获取L3置信度趋势（近30天）
 * 从registration_sessions表查询真实数据
 */
async function getL3ConfidenceTrend(): Promise<L3ConfidenceTrend[]> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  try {
    // Query daily L3 confidence averages from registration_sessions
    const dailyStats = await db
      .select({
        date: sql<string>`DATE(${registrationSessions.completedAt})::text`,
        avgConfidence: sql<number>`AVG(${registrationSessions.l3Confidence}::numeric)`,
        sampleSize: sql<number>`COUNT(*)::int`,
      })
      .from(registrationSessions)
      .where(and(
        sql`${registrationSessions.completedAt} IS NOT NULL`,
        sql`${registrationSessions.l3Confidence} IS NOT NULL`,
        gte(registrationSessions.completedAt, thirtyDaysAgo)
      ))
      .groupBy(sql`DATE(${registrationSessions.completedAt})`)
      .orderBy(sql`DATE(${registrationSessions.completedAt})`);
    
    if (dailyStats.length > 0) {
      return dailyStats.map(stat => ({
        date: stat.date,
        avgConfidence: stat.avgConfidence || 0,
        sampleSize: stat.sampleSize || 0,
      }));
    }
  } catch (e) {
    console.warn('[Analytics] Failed to query L3 confidence trend:', e);
  }
  
  // Return empty array when no real data exists (no fake data)
  return [];
}

/**
 * 获取会话时长分布
 * 从registration_sessions表查询真实数据
 */
async function getSessionDurationDistribution(): Promise<{ range: string; count: number }[]> {
  try {
    // Query session duration distribution from registration_sessions
    const durationStats = await db
      .select({
        durationMinutes: sql<number>`EXTRACT(EPOCH FROM (${registrationSessions.completedAt} - ${registrationSessions.startedAt})) / 60`,
      })
      .from(registrationSessions)
      .where(sql`${registrationSessions.completedAt} IS NOT NULL`);
    
    if (durationStats.length === 0) {
      return [];
    }
    
    // Bucket the durations
    const buckets = {
      '0-1分钟': 0,
      '1-2分钟': 0,
      '2-3分钟': 0,
      '3-5分钟': 0,
      '5分钟以上': 0,
    };
    
    for (const stat of durationStats) {
      const minutes = stat.durationMinutes || 0;
      if (minutes < 1) {
        buckets['0-1分钟']++;
      } else if (minutes < 2) {
        buckets['1-2分钟']++;
      } else if (minutes < 3) {
        buckets['2-3分钟']++;
      } else if (minutes < 5) {
        buckets['3-5分钟']++;
      } else {
        buckets['5分钟以上']++;
      }
    }
    
    return Object.entries(buckets).map(([range, count]) => ({ range, count }));
  } catch (e) {
    console.warn('[Analytics] Failed to query session duration distribution:', e);
    return [];
  }
}
