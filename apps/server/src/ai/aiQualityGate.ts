/**
 * AI Quality Gate — LLM-as-Judge for AI-Generated Content
 *
 * 趣味性 (fun / engagement) is the absolute key metric with zero tolerance.
 * Below-threshold content triggers automatic refinement (回炉重做).
 * Below-discard-threshold content is rejected in favor of deterministic fallback.
 *
 * Architecture:
 *   - Judge runs asynchronously by default (fire-and-forget telemetry)
 *   - Blocking refinement loop is gated by QUALITY_GATE_BLOCKING_ENABLED
 *   - Sampling rate controlled by QUALITY_GATE_SAMPLE_RATE
 *
 * Integration points:
 *   - Called from socialModelRouter.ts / creativeModelRouter.ts after generation
 *   - Scores feed into AITrace metadata and Prometheus metrics
 *   - Admin endpoint: GET /api/admin/ai-quality/summary
 */

import { z } from 'zod';
import { getDeepseekClient } from './deepseekClient';
import { logger } from '../lib/logger';
import {
  type JudgeContext,
  type JudgeFeatureType,
  buildJudgeSystemPrompt,
  buildJudgeUserPrompt,
  JudgeOutputSchema,
  FUN_SCORE_REFINEMENT_THRESHOLD,
  FUN_SCORE_DISCARD_THRESHOLD,
  BRAND_ALIGNMENT_THRESHOLD,
  APPROPRIATENESS_THRESHOLD,
  CLARITY_THRESHOLD,
} from './qualityJudgePrompts';

// ─── Configuration ───────────────────────────────────────────────────────────

const GATE_ENABLED = process.env.QUALITY_GATE_ENABLED === 'true';
const BLOCKING_ENABLED = process.env.QUALITY_GATE_BLOCKING_ENABLED === 'true';
const SAMPLE_RATE = parseFloat(process.env.QUALITY_GATE_SAMPLE_RATE || '0.1');
const JUDGE_TIMEOUT_MS = parseInt(process.env.QUALITY_GATE_TIMEOUT_MS || '3000', 10);
const MAX_REFINEMENT_ATTEMPTS = 2;

// ─── Circuit breaker for judge health ────────────────────────────────────────

/** Sliding window of recent judge outcomes. Simple in-memory guard. */
const recentOutcomes: { timestamp: number; failed: boolean }[] = [];
const CIRCUIT_BREAKER_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const CIRCUIT_BREAKER_FAILURE_RATE = 0.20;        // 20%
const CIRCUIT_BREAKER_MIN_SAMPLES = 10;

function recordJudgeOutcome(failed: boolean) {
  const now = Date.now();
  recentOutcomes.push({ timestamp: now, failed });
  // Prune old entries
  while (recentOutcomes.length > 0 && recentOutcomes[0].timestamp < now - CIRCUIT_BREAKER_WINDOW_MS) {
    recentOutcomes.shift();
  }
}

function isCircuitOpen(): boolean {
  if (recentOutcomes.length < CIRCUIT_BREAKER_MIN_SAMPLES) return false;
  const failedCount = recentOutcomes.filter((o) => o.failed).length;
  const failureRate = failedCount / recentOutcomes.length;
  if (failureRate >= CIRCUIT_BREAKER_FAILURE_RATE) {
    logger.error('AI quality gate circuit breaker OPEN — too many failures', {
      service: 'qualityGate',
      failureRate: failureRate.toFixed(2),
      sampleSize: recentOutcomes.length,
    });
    return true;
  }
  return false;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AIQualityScores {
  funEngagement: number;
  brandAlignment: number;
  appropriateness: number;
  clarity: number;
}

export interface AIQualityJudgment {
  scores: AIQualityScores;
  passed: boolean;
  critique: string;
  refinementHint?: string;
}

export interface QualityGateResult {
  judgment: AIQualityJudgment;
  action: 'pass' | 'refine' | 'discard';
  /** Number of refinement attempts consumed */
  refinementAttempts: number;
}

// ─── Internal judge call ─────────────────────────────────────────────────────

async function runJudge(
  content: string,
  ctx: JudgeContext,
): Promise<AIQualityJudgment | null> {
  const client = getDeepseekClient();
  const systemPrompt = buildJudgeSystemPrompt(ctx);
  const userPrompt = buildJudgeUserPrompt(content);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), JUDGE_TIMEOUT_MS);

  try {
    const response = await client.chat.completions.create(
      {
        model: 'deepseek-v4-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 400,
        response_format: { type: 'json_object' },
      },
      { signal: controller.signal },
    );

    clearTimeout(timer);

    const raw = response.choices[0]?.message?.content?.trim() ?? '';
    if (!raw) return null;

    const parsedRaw = JSON.parse(raw);
    const validated = JudgeOutputSchema.safeParse(parsedRaw);
    if (!validated.success) {
      logger.warn('AI quality judge returned malformed JSON', {
        service: 'qualityGate',
        error: validated.error.message,
      });
      recordJudgeOutcome(true);
      return null;
    }
    const parsed = validated.data;

    // Normalize and clamp scores
    const scores: AIQualityScores = {
      funEngagement: clampScore(parsed.scores.funEngagement),
      brandAlignment: clampScore(parsed.scores.brandAlignment),
      appropriateness: clampScore(parsed.scores.appropriateness),
      clarity: clampScore(parsed.scores.clarity),
    };

    // Recompute passed based on thresholds (don't trust the model's boolean)
    const passed =
      scores.funEngagement >= FUN_SCORE_REFINEMENT_THRESHOLD &&
      scores.brandAlignment >= BRAND_ALIGNMENT_THRESHOLD &&
      scores.appropriateness >= APPROPRIATENESS_THRESHOLD &&
      scores.clarity >= CLARITY_THRESHOLD;

    recordJudgeOutcome(false);
    return {
      scores,
      passed,
      critique: parsed.critique ?? '',
      refinementHint: parsed.refinementHint ?? undefined,
    };
  } catch (err) {
    clearTimeout(timer);
    recordJudgeOutcome(true);
    logger.warn('AI quality judge failed', {
      service: 'qualityGate',
      featureType: ctx.featureType,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

function clampScore(n: unknown): number {
  if (typeof n !== 'number' || Number.isNaN(n)) return 0;
  return Math.max(1, Math.min(10, Math.round(n)));
}

function determineAction(judgment: AIQualityJudgment): QualityGateResult['action'] {
  if (judgment.scores.funEngagement < FUN_SCORE_DISCARD_THRESHOLD) return 'discard';
  if (judgment.scores.appropriateness < APPROPRIATENESS_THRESHOLD) return 'discard';
  if (!judgment.passed) return 'refine';
  return 'pass';
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Evaluate AI-generated content quality.
 *
 * Behavior depends on configuration:
 *   - If gate disabled → returns null immediately (no overhead)
 *   - If sampling active and this call not sampled → returns null
 *   - Otherwise → runs judge and returns judgment + recommended action
 *
 * @param content  The AI-generated text to evaluate
 * @param ctx      Context about the feature type, phase, audience
 * @returns        Judgment + action, or null if gate skipped
 */
export async function evaluateContent(
  content: string,
  ctx: JudgeContext,
): Promise<QualityGateResult | null> {
  if (!GATE_ENABLED) return null;
  if (isCircuitOpen()) {
    logger.warn('AI quality gate skipped — circuit breaker open', {
      service: 'qualityGate',
      featureType: ctx.featureType,
    });
    return null;
  }
  if (Math.random() > SAMPLE_RATE) return null;

  const judgment = await runJudge(content, ctx);
  if (!judgment) return null;

  const action = determineAction(judgment);

  logger.info('AI quality gate judgment', {
    service: 'qualityGate',
    featureType: ctx.featureType,
    action,
    scores: judgment.scores,
    passed: judgment.passed,
  });

  return {
    judgment,
    action,
    refinementAttempts: 0,
  };
}

/**
 * Blocking refinement loop.
 *
 * ONLY use this when BLOCKING_ENABLED is true and the feature is explicitly
 * opted into blocking quality gating. In production, this should be enabled
 * only after calibration proves thresholds work correctly.
 *
 * @param generateFn  Async function that generates content. Receives refinementHint on retries.
 * @param ctx         Judge context
 * @returns           Final content + gate result, or null if all attempts failed
 */
export async function generateWithQualityGate(
  generateFn: (refinementHint?: string) => Promise<string>,
  ctx: JudgeContext,
  opts?: { forceBlocking?: boolean },
): Promise<{ content: string; gateResult: QualityGateResult } | null> {
  const blocking = opts?.forceBlocking ?? BLOCKING_ENABLED;
  if (!GATE_ENABLED || !blocking) {
    const content = await generateFn();
    return { content, gateResult: { judgment: placeholderPass(), action: 'pass', refinementAttempts: 0 } };
  }

  let refinementHint: string | undefined;

  for (let attempt = 0; attempt <= MAX_REFINEMENT_ATTEMPTS; attempt++) {
    const content = await generateFn(refinementHint);
    const judgment = await runJudge(content, ctx);

    if (!judgment) {
      // Judge failed — accept content rather than blocking user
      return { content, gateResult: { judgment: placeholderPass(), action: 'pass', refinementAttempts: attempt } };
    }

    const action = determineAction(judgment);

    if (action === 'pass') {
      return {
        content,
        gateResult: { judgment, action, refinementAttempts: attempt },
      };
    }

    if (action === 'discard') {
      logger.warn('AI quality gate discarded content', {
        service: 'qualityGate',
        featureType: ctx.featureType,
        scores: judgment.scores,
        attempt,
      });
      return null;
    }

    // action === 'refine'
    refinementHint = judgment.refinementHint ?? 'Improve fun and engagement while keeping brand voice.';
    logger.info('AI quality gate triggered refinement', {
      service: 'qualityGate',
      featureType: ctx.featureType,
      attempt,
      hint: refinementHint,
    });
  }

  // Max refinement attempts exceeded — discard
  logger.warn('AI quality gate max refinements exceeded', {
    service: 'qualityGate',
    featureType: ctx.featureType,
    maxAttempts: MAX_REFINEMENT_ATTEMPTS,
  });
  return null;
}

function placeholderPass(): AIQualityJudgment {
  return {
    scores: { funEngagement: 10, brandAlignment: 10, appropriateness: 10, clarity: 10 },
    passed: true,
    critique: 'Gate disabled or judge unavailable — placeholder pass.',
  };
}

// ─── Metrics helpers ─────────────────────────────────────────────────────────

/** Format scores for Prometheus / structured logging */
export function formatQualityMetrics(
  featureType: JudgeFeatureType,
  result: QualityGateResult,
): Record<string, number | string> {
  return {
    feature_type: featureType,
    quality_fun: result.judgment.scores.funEngagement,
    quality_brand: result.judgment.scores.brandAlignment,
    quality_safety: result.judgment.scores.appropriateness,
    quality_clarity: result.judgment.scores.clarity,
    quality_passed: result.judgment.passed ? 1 : 0,
    quality_action: result.action,
    quality_refinement_attempts: result.refinementAttempts,
    judge_evaluated: 1,
  };
}

/**
 * Build metrics object when the gate was NOT evaluated (for honest dashboard coverage).
 */
export function formatUnevaluatedMetrics(
  featureType: JudgeFeatureType,
): Record<string, number | string> {
  return {
    feature_type: featureType,
    quality_fun: -1,
    quality_brand: -1,
    quality_safety: -1,
    quality_clarity: -1,
    quality_passed: -1,
    quality_action: 'unevaluated',
    quality_refinement_attempts: -1,
    judge_evaluated: 0,
  };
}
