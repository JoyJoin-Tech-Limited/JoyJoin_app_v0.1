/**
 * Pool Card AI Copy Worker
 * 活动池卡片AI文案生成 Worker
 *
 * Out-of-band headline generation for discover page pool cards.
 * Triggered by pool lifecycle events and a catch-up cron.
 * All output is written to `pool_ai_copy` in shadow mode.
 */

import { db } from '../../db';
import { eventPools, poolAICopy } from '@shared/schema';
import { eq, and, gt, isNull, or } from 'drizzle-orm';
import { callSocialAI } from '../socialModelRouter';
import { logAITrace } from '../../lib/aiTraceLogger';
import {
  buildLiveAIMeta,
  buildFallbackAIMeta,
} from '@shared/types/aiMeta';
import { getArchetypeFamily } from '@shared/archetypeColors';
import { recordPoolCardCopyBackfillLatency } from '../../middleware/metrics';

const PROMPT_VERSION = 'discover-card-v1';
const HEADLINE_TTL_HOURS = 24;

// ─── Fallback templates ───────────────────────────────────────────

const EVENT_TYPE_FALLBACKS: Record<string, string[]> = {
  dinner: [
    '饭局已热，就差你的故事',
    '一桌好菜，一群有趣的人',
    '今晚的饭桌，缺一个你',
    '来，边吃边聊',
  ],
  drinks: [
    '酒局正酣，等你开场',
    '一杯酒，一段新关系',
    '今晚的酒，为你留了一杯',
    '微醺局，来了就不想走',
  ],
  other: [
    '局已备好，就差你',
    '一场有趣的聚会正在等你',
    '新局开局，快来占位',
    '这里有你想认识的人',
  ],
};

const ENERGY_FALLBACKS: Record<string, string[]> = {
  warm: [
    '阳光气氛组已就位',
    '来，让场子更热一点',
    '这里的笑声会传染',
  ],
  cool: [
    '冷静又有趣的灵魂聚集地',
    '这里的对话，质量很高',
    '不吵不闹，刚好合适',
  ],
  fire: [
    '高能局，准备好被点燃',
    '热情已经满格',
    '来，把能量加满',
  ],
  calm: [
    '安静蓄力中，等你来',
    '慢热但走心的局',
    '这里适合认真聊天',
  ],
};

function getFallbackHeadline(
  eventType?: string,
  accentFamily?: string
): string {
  const typeLines = EVENT_TYPE_FALLBACKS[eventType ?? 'other'] ?? EVENT_TYPE_FALLBACKS.other;
  const energyLines = ENERGY_FALLBACKS[accentFamily ?? 'calm'] ?? ENERGY_FALLBACKS.calm;
  // Deterministic but varied: pick based on current minute
  const minute = new Date().getMinutes();
  const typeLine = typeLines[minute % typeLines.length];
  const energyLine = energyLines[minute % energyLines.length];
  // Return the shorter one for card fit
  return typeLine.length <= energyLine.length ? typeLine : energyLine;
}

// ─── Prompt builder ───────────────────────────────────────────────

function buildHeadlinePrompt(params: {
  poolTitle: string;
  eventType: string;
  city?: string;
  district?: string;
  dominantArchetype?: string;
  topArchetypes: string[];
}): string {
  const { poolTitle, eventType, city, district, dominantArchetype, topArchetypes } = params;

  const location = [city, district].filter(Boolean).join('·') || '未知区域';
  const typeLabel = eventType === 'dinner' ? '饭局' : eventType === 'drinks' ? '酒局' : '活动';
  const archetypeContext = topArchetypes.length > 0
    ? `已报名者的主要性格原型：${topArchetypes.join('、')}`
    : '';

  return `你是一位擅长写社交活动文案的助手。请为下面的活动池写一句吸引用户报名的短标题。

活动信息：
- 标题：${poolTitle}
- 类型：${typeLabel}
- 地点：${location}
- ${archetypeContext}

要求：
- 只输出这一句话，不要任何前缀、后缀或解释
- 长度：8-20 个汉字
- 语气：温暖、有吸引力、略带神秘感（盲盒社交）
- 让用户感觉到"这里有我想认识的人"
- 不要使用emoji

请只输出标题：`;
}

// ─── Core generation ──────────────────────────────────────────────

export interface GeneratePoolCardCopyResult {
  headline: string;
  fallbackUsed: boolean;
  provider: string | null;
}

export async function generatePoolCardCopy(
  poolId: string
): Promise<GeneratePoolCardCopyResult> {
  const startedAt = Date.now();

  // Fetch pool + archetype breakdown
  const [pool] = await db
    .select()
    .from(eventPools)
    .where(eq(eventPools.id, poolId))
    .limit(1);

  if (!pool) {
    console.warn(`[poolCardCopyWorker] Pool not found: ${poolId}`);
    return {
      headline: getFallbackHeadline(),
      fallbackUsed: true,
      provider: null,
    };
  }

  // Fetch top archetypes for this pool
  const archetypeRows = await db.execute(`
    SELECT coalesce(u.primary_archetype, u.archetype, '未设置') AS archetype, count(*)::int AS count
    FROM event_pool_registrations r
    JOIN users u ON r.user_id = u.id
    WHERE r.pool_id = ${poolId}
    GROUP BY coalesce(u.primary_archetype, u.archetype, '未设置')
    ORDER BY count DESC
    LIMIT 3
  `);

  const topArchetypes = ((archetypeRows.rows as Array<{ archetype: string; count: number }>) ?? [])
    .map((r: { archetype: string }) => r.archetype)
    .filter((a: string) => a !== '未设置');

  const accentFamily = getArchetypeFamily(topArchetypes[0]);

  const prompt = buildHeadlinePrompt({
    poolTitle: pool.title,
    eventType: pool.eventType ?? 'other',
    city: pool.city ?? undefined,
    district: pool.district ?? undefined,
    dominantArchetype: topArchetypes[0],
    topArchetypes,
  });

  try {
    const result = await callSocialAI({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.75,
      max_tokens: 60,
      callerTag: 'poolCardCopy',
      socialFunction: 'generatePoolCardHeadline',
    });

    const raw = result.content.trim();

    // Quality gate: non-empty, reasonable length, no markdown
    const cleaned = raw
      .replace(/^[""'`]+|[""'`]+$/g, '')
      .replace(/[\n\r]/g, '')
      .trim();

    if (!cleaned || cleaned.length < 4 || cleaned.length > 40) {
      console.warn(`[poolCardCopyWorker] LLM output failed quality check (length=${cleaned.length}), using fallback`);
      const meta = buildFallbackAIMeta('low_quality_score', PROMPT_VERSION);
      logAITrace({
        domain: 'discover',
        feature: 'generatePoolCardHeadline',
        provider: result.provider,
        latencyMs: Date.now() - startedAt,
        success: false,
        fallbackUsed: meta.fallbackUsed,
        fromCache: meta.fromCache,
        promptVersion: meta.promptVersion,
        errorCode: meta.evaluatorRejectionReason,
      });
      return {
        headline: getFallbackHeadline(pool.eventType ?? undefined, accentFamily),
        fallbackUsed: true,
        provider: result.provider,
      };
    }

    const meta = buildLiveAIMeta(result.provider, PROMPT_VERSION);
    logAITrace({
      domain: 'discover',
      feature: 'generatePoolCardHeadline',
      provider: meta.provider,
      latencyMs: Date.now() - startedAt,
      success: true,
      fallbackUsed: meta.fallbackUsed,
      fromCache: meta.fromCache,
      promptVersion: meta.promptVersion,
    });

    return {
      headline: cleaned,
      fallbackUsed: false,
      provider: result.provider,
    };
  } catch (err) {
    console.error('[poolCardCopyWorker] LLM call failed, using fallback:', err);
    const meta = buildFallbackAIMeta('provider_error', PROMPT_VERSION);
    logAITrace({
      domain: 'discover',
      feature: 'generatePoolCardHeadline',
      provider: null,
      latencyMs: Date.now() - startedAt,
      success: false,
      fallbackUsed: meta.fallbackUsed,
      fromCache: meta.fromCache,
      promptVersion: meta.promptVersion,
      errorCode: meta.evaluatorRejectionReason,
    });
    return {
      headline: getFallbackHeadline(pool.eventType ?? undefined, accentFamily),
      fallbackUsed: true,
      provider: null,
    };
  }
}

// ─── Cache write ──────────────────────────────────────────────────

export async function savePoolCardCopy(
  poolId: string,
  segmentHash: string,
  result: GeneratePoolCardCopyResult
): Promise<void> {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + HEADLINE_TTL_HOURS);

  await db
    .insert(poolAICopy)
    .values({
      poolId,
      segmentHash,
      headline: result.headline,
      displayStatus: 'shadow',
      generatedAt: new Date(),
      provider: result.provider,
      fallbackUsed: result.fallbackUsed,
      promptVersion: PROMPT_VERSION,
      expiresAt,
    })
    .onConflictDoUpdate({
      target: [poolAICopy.poolId, poolAICopy.segmentHash],
      set: {
        headline: result.headline,
        displayStatus: 'shadow',
        generatedAt: new Date(),
        provider: result.provider,
        fallbackUsed: result.fallbackUsed,
        promptVersion: PROMPT_VERSION,
        expiresAt,
      },
    });

  console.log(`[poolCardCopyWorker] Saved copy for pool ${poolId} (fallback=${result.fallbackUsed})`);
}

// ─── Orchestrator: generate + save ────────────────────────────────

export async function generateAndSavePoolCardCopy(poolId: string): Promise<void> {
  const result = await generatePoolCardCopy(poolId);
  // Simple segment hash: pool_id only (segmented by pool for now)
  await savePoolCardCopy(poolId, poolId, result);
}

// ─── Catch-up cron: find stale/missing entries and backfill ───────

export async function backfillStalePoolCardCopy(): Promise<number> {
  const startedAt = Date.now();
  const now = new Date();

  // Find active pools that either have no copy or have expired shadow copy
  const stalePools = await db.execute(`
    SELECT p.id
    FROM event_pools p
    WHERE p.status = 'active'
      AND p.registration_deadline > NOW()
      AND NOT EXISTS (
        SELECT 1 FROM pool_ai_copy c
        WHERE c.pool_id = p.id
          AND c.expires_at > NOW()
      )
    LIMIT 10
  `);

  const poolIds = ((stalePools.rows as Array<{ id: string }>) ?? []).map((r: { id: string }) => r.id);
  let generated = 0;

  for (const poolId of poolIds) {
    try {
      await generateAndSavePoolCardCopy(poolId);
      generated++;
    } catch (err) {
      console.error(`[poolCardCopyWorker] Backfill failed for pool ${poolId}:`, err);
    }
  }

  if (generated > 0) {
    console.log(`[poolCardCopyWorker] Backfilled ${generated} pools`);
  }

  recordPoolCardCopyBackfillLatency(Date.now() - startedAt);
  return generated;
}

// ─── Interval initializer ─────────────────────────────────────────

let _intervalId: NodeJS.Timeout | null = null;

export function startPoolCardCopyWorker(intervalMinutes = 5): void {
  if (_intervalId) {
    console.warn('[poolCardCopyWorker] Already running; skipping duplicate start');
    return;
  }

  console.log(`[poolCardCopyWorker] Starting catch-up cron (every ${intervalMinutes} min)`);

  _intervalId = setInterval(() => {
    void backfillStalePoolCardCopy();
  }, intervalMinutes * 60 * 1000);

  // Run once immediately on startup
  void backfillStalePoolCardCopy();
}

export function stopPoolCardCopyWorker(): void {
  if (_intervalId) {
    clearInterval(_intervalId);
    _intervalId = null;
  }
}
