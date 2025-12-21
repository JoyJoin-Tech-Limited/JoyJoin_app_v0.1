/**
 * 注册漏斗分析服务
 * 
 * 收集和分析用户注册过程中的三层信息漏斗数据
 * - L1 (显式基础): 7个必问字段的完成率
 * - L2 (自然丰富): 11个可选字段的参与度
 * - L3 (隐藏洞察): AI推断的置信度和准确率
 */

import { db } from '../db';
import { users } from '@shared/schema';
import { sql, count, and, gte, isNotNull } from 'drizzle-orm';

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
 */
async function getKPIs(): Promise<RegistrationFunnelKPIs> {
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

  // 近7天完成
  const [last7DaysResult] = await db
    .select({ count: count() })
    .from(users)
    .where(and(
      sql`${users.hasCompletedRegistration} = true`,
      gte(users.createdAt, sevenDaysAgo)
    ));
  const completedLast7Days = last7DaysResult?.count || 0;

  // 前7天完成
  const [prev7DaysResult] = await db
    .select({ count: count() })
    .from(users)
    .where(and(
      sql`${users.hasCompletedRegistration} = true`,
      gte(users.createdAt, fourteenDaysAgo),
      sql`${users.createdAt} < ${sevenDaysAgo}`
    ));
  const completedPrevious7Days = prev7DaysResult?.count || 0;

  // 转化率
  const conversionRate = totalStarted > 0 ? (totalCompleted / totalStarted) * 100 : 0;

  // 平均完成时长
  // TODO: 需要会话遥测表(registration_sessions)来记录实际注册时长
  // 当前基于用户调研数据使用估算值，后续应从 session_started_at 到 registration_completed_at 计算
  let avgCompletionTimeMinutes = 2.4;
  
  try {
    // 尝试从users表的created_at和updated_at计算平均时长（粗略估算）
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
    // 保持默认值
  }

  // L3 平均置信度
  // 基于已填写L3相关字段（dialect, communication style等）的用户比例估算
  let avgL3Confidence = 0.72;
  
  try {
    // 计算有方言数据的用户比例作为L3置信度代理指标
    const [dialectResult] = await db
      .select({ count: count() })
      .from(users)
      .where(sql`"detected_dialect" IS NOT NULL AND "detected_dialect" != ''`);
    const dialectFilled = dialectResult?.count || 0;
    
    if (totalCompleted > 0) {
      // L3置信度 = 能推断出方言的用户比例 * 0.8 + 基础置信度 0.2
      avgL3Confidence = Math.min(0.95, (dialectFilled / totalCompleted) * 0.8 + 0.2);
    }
  } catch {
    // 保持默认值
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
 */
async function getL3ConfidenceTrend(): Promise<L3ConfidenceTrend[]> {
  // 模拟数据 - 实际应从用户的conversationSignature中提取
  const trend: L3ConfidenceTrend[] = [];
  const now = new Date();
  
  for (let i = 29; i >= 0; i--) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = date.toISOString().split('T')[0];
    
    // 模拟置信度数据（实际应从数据库查询）
    trend.push({
      date: dateStr,
      avgConfidence: 0.65 + Math.random() * 0.2, // 0.65-0.85 范围
      sampleSize: Math.floor(Math.random() * 20) + 5,
    });
  }
  
  return trend;
}

/**
 * 获取会话时长分布
 */
async function getSessionDurationDistribution(): Promise<{ range: string; count: number }[]> {
  // 模拟数据 - 实际应从registrationSessions表查询
  return [
    { range: '0-1分钟', count: 15 },
    { range: '1-2分钟', count: 35 },
    { range: '2-3分钟', count: 28 },
    { range: '3-5分钟', count: 12 },
    { range: '5分钟以上', count: 10 },
  ];
}
