/**
 * Social Icebreaker AI benchmark harness
 *
 * Runs the same JoyJoin prompt fixtures against multiple LLM configurations
 * (MiniMax M2.7, M2.7-highspeed, DeepSeek) and produces a structured report
 * with latency percentiles, success rates, and parse-validity scores.
 *
 * Usage:
 *   npx tsx apps/server/src/benchmarks/socialAIBenchmark.cli.ts
 *
 * Environment:
 *   MINIMAX_API_KEY          — required for MiniMax runs
 *   DEEPSEEK_API_KEY         — required for DeepSeek runs
 *   BENCHMARK_ITERATIONS     — default 5
 *   BENCHMARK_MODELS         — comma-separated list of model ids to test
 *                              (default: "minimax-m2.7,minimax-m2.7-highspeed,deepseek-v4-flash")
 */

import { callSocialAI, type SocialAICallParams, type SocialAICallResult } from '../ai/socialModelRouter';
import { logger } from '../lib/logger';
import {
  buildXiaoYueCommentPrompt,
  buildWarmupTopicsPrompt,
  buildRecapSummaryPrompt,
  XIAOYUE_COMMENT_PROMPT_VERSION,
  WARMUP_TOPICS_PROMPT_VERSION,
  RECAP_SUMMARY_PROMPT_VERSION,
} from '../ai/socialIcebreakerPrompts';

export interface BenchmarkModelConfig {
  label: string;
  provider: 'minimax' | 'deepseek';
  model: string;
}

export interface BenchmarkFixture {
  id: string;
  feature: string;
  promptVersion: string;
  buildMessages: () => SocialAICallParams['messages'];
  temperature: number;
  maxTokens: number;
  validateOutput: (content: string) => { valid: boolean; error?: string };
}

export interface BenchmarkRunResult {
  fixtureId: string;
  modelLabel: string;
  provider: string;
  model: string;
  iteration: number;
  latencyMs: number;
  success: boolean;
  validationValid: boolean;
  validationError?: string;
  contentSample: string;
  tokenUsage?: { prompt?: number; completion?: number; total?: number };
  error?: string;
}

export interface BenchmarkFixtureSummary {
  fixtureId: string;
  modelLabel: string;
  provider: string;
  model: string;
  iterations: number;
  successCount: number;
  validCount: number;
  meanLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  minLatencyMs: number;
  maxLatencyMs: number;
}

export interface BenchmarkReport {
  ranAt: string;
  iterationsPerFixture: number;
  models: BenchmarkModelConfig[];
  results: BenchmarkRunResult[];
  summary: BenchmarkFixtureSummary[];
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

export const BENCHMARK_FIXTURES: BenchmarkFixture[] = [
  {
    id: 'xiaoyue-comment',
    feature: 'generateXiaoYueComment',
    promptVersion: XIAOYUE_COMMENT_PROMPT_VERSION,
    buildMessages: () => [
      {
        role: 'user',
        content: buildXiaoYueCommentPrompt({
          phase: 'warmup',
          event: 'phase_start',
          context: '6人饭局，氛围轻松',
        }),
      },
    ],
    temperature: 0.8,
    maxTokens: 100,
    validateOutput: (content: string) => {
      if (!content || content.trim().length === 0) {
        return { valid: false, error: 'empty_output' };
      }
      if (content.trim().length > 100) {
        return { valid: false, error: 'too_long' };
      }
      return { valid: true };
    },
  },
  {
    id: 'warmup-topics',
    feature: 'generateWarmupTopics',
    promptVersion: WARMUP_TOPICS_PROMPT_VERSION,
    buildMessages: () => [
      {
        role: 'user',
        content: buildWarmupTopicsPrompt({
          eventType: '饭局',
          participantCount: 6,
          mood: 'relaxed',
          avoidTopics: ['政治', '宗教'],
        }),
      },
    ],
    temperature: 0.9,
    maxTokens: 500,
    validateOutput: (content: string) => {
      if (!content || content.trim().length === 0) {
        return { valid: false, error: 'empty_output' };
      }
      try {
        const parsed = JSON.parse(content);
        if (!Array.isArray(parsed) || parsed.length === 0) {
          return { valid: false, error: 'not_array' };
        }
        if (!parsed.every((item: unknown) => item && typeof (item as Record<string, unknown>).question === 'string')) {
          return { valid: false, error: 'missing_question' };
        }
        return { valid: true };
      } catch {
        return { valid: false, error: 'json_parse' };
      }
    },
  },
  {
    id: 'recap-summary',
    feature: 'generateRecapSummary',
    promptVersion: RECAP_SUMMARY_PROMPT_VERSION,
    buildMessages: () => [
      {
        role: 'user',
        content: buildRecapSummaryPrompt({
          participants: [
            { displayName: '小明', archetype: 'corgi' },
            { displayName: '小红', archetype: 'rooster' },
            { displayName: '小刚', archetype: '好奇猫' },
            { displayName: '小丽', archetype: '温柔兔' },
          ],
          topicsDiscussed: ['理想周末', '最离谱的外卖', '童年梦想'],
          challengesCompleted: 2,
          commonGroundCount: 3,
          durationMinutes: 90,
          lieDetectiveHighlights: ['小明竟然不会骑自行车'],
        }),
      },
    ],
    temperature: 0.8,
    maxTokens: 300,
    validateOutput: (content: string) => {
      if (!content || content.trim().length === 0) {
        return { valid: false, error: 'empty_output' };
      }
      try {
        const parsed = JSON.parse(content);
        if (
          typeof parsed.headline !== 'string' ||
          !Array.isArray(parsed.moments) ||
          typeof parsed.closingLine !== 'string'
        ) {
          return { valid: false, error: 'missing_fields' };
        }
        return { valid: true };
      } catch {
        return { valid: false, error: 'json_parse' };
      }
    },
  },
];

// ─── Default model matrix ────────────────────────────────────────────────────

export function getDefaultModelConfigs(): BenchmarkModelConfig[] {
  const raw = process.env.BENCHMARK_MODELS;
  if (raw) {
    return raw.split(',').map((s) => {
      const label = s.trim();
      if (label.startsWith('minimax-')) {
        return { label, provider: 'minimax', model: label };
      }
      if (label.startsWith('deepseek-')) {
        return { label, provider: 'deepseek', model: label };
      }
      // Fallback — assume minimax if ambiguous
      return { label, provider: 'minimax', model: label };
    });
  }

  return [
    { label: 'minimax-m2.7', provider: 'minimax', model: 'minimax-m2.7' },
    { label: 'minimax-m2.7-highspeed', provider: 'minimax', model: 'minimax-m2.7-highspeed' },
    { label: 'deepseek-v4-flash', provider: 'deepseek', model: 'deepseek-v4-flash' },
  ];
}

// ─── Percentile helpers ──────────────────────────────────────────────────────

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const idx = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  const weight = idx - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

function computeSummary(
  fixtureId: string,
  modelConfig: BenchmarkModelConfig,
  runs: BenchmarkRunResult[]
): BenchmarkFixtureSummary {
  const latencies = runs.map((r) => r.latencyMs).sort((a, b) => a - b);
  const successCount = runs.filter((r) => r.success).length;
  const validCount = runs.filter((r) => r.validationValid).length;
  const mean = latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;

  return {
    fixtureId,
    modelLabel: modelConfig.label,
    provider: modelConfig.provider,
    model: modelConfig.model,
    iterations: runs.length,
    successCount,
    validCount,
    meanLatencyMs: Math.round(mean),
    p50LatencyMs: Math.round(percentile(latencies, 50)),
    p95LatencyMs: Math.round(percentile(latencies, 95)),
    p99LatencyMs: Math.round(percentile(latencies, 99)),
    minLatencyMs: latencies[0] ?? 0,
    maxLatencyMs: latencies[latencies.length - 1] ?? 0,
  };
}

// ─── Core runner ─────────────────────────────────────────────────────────────

export async function runSocialAIBenchmark(options?: {
  iterations?: number;
  models?: BenchmarkModelConfig[];
  fixtures?: BenchmarkFixture[];
  onProgress?: (result: BenchmarkRunResult) => void;
}): Promise<BenchmarkReport> {
  const iterations = options?.iterations ?? parseInt(process.env.BENCHMARK_ITERATIONS || '5', 10);
  const models = options?.models ?? getDefaultModelConfigs();
  const fixtures = options?.fixtures ?? BENCHMARK_FIXTURES;
  const results: BenchmarkRunResult[] = [];

  for (const fixture of fixtures) {
    for (const modelConfig of models) {
      for (let i = 0; i < iterations; i++) {
        const runResult = await runSingleIteration(fixture, modelConfig, i);
        results.push(runResult);
        options?.onProgress?.(runResult);
      }
    }
  }

  const summary: BenchmarkFixtureSummary[] = [];
  for (const fixture of fixtures) {
    for (const modelConfig of models) {
      const runs = results.filter(
        (r) => r.fixtureId === fixture.id && r.modelLabel === modelConfig.label
      );
      summary.push(computeSummary(fixture.id, modelConfig, runs));
    }
  }

  return {
    ranAt: new Date().toISOString(),
    iterationsPerFixture: iterations,
    models,
    results,
    summary,
  };
}

async function runSingleIteration(
  fixture: BenchmarkFixture,
  modelConfig: BenchmarkModelConfig,
  iteration: number
): Promise<BenchmarkRunResult> {
  const messages = fixture.buildMessages();

  try {
    const aiResult: SocialAICallResult = await callSocialAI({
      messages,
      temperature: fixture.temperature,
      max_tokens: fixture.maxTokens,
      callerTag: fixture.id,
      socialFunction: fixture.feature as SocialAICallParams['socialFunction'],
      modelOverride: modelConfig.model,
    });

    const validation = fixture.validateOutput(aiResult.content);

    return {
      fixtureId: fixture.id,
      modelLabel: modelConfig.label,
      provider: aiResult.provider,
      model: aiResult.model,
      iteration,
      latencyMs: aiResult.latencyMs,
      success: true,
      validationValid: validation.valid,
      validationError: validation.error,
      contentSample: aiResult.content.slice(0, 200),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn('Benchmark iteration failed', { domain: 'benchmark', feature: 'socialAIBenchmark', error: message });
    return {
      fixtureId: fixture.id,
      modelLabel: modelConfig.label,
      provider: modelConfig.provider,
      model: modelConfig.model,
      iteration,
      latencyMs: 0,
      success: false,
      validationValid: false,
      validationError: 'exception',
      contentSample: '',
      error: message,
    };
  }
}

// ─── Formatters ──────────────────────────────────────────────────────────────

export function formatBenchmarkReport(report: BenchmarkReport): string {
  const lines: string[] = [];
  lines.push('=== JoyJoin Social Icebreaker AI Benchmark ===');
  lines.push(`Ran at: ${report.ranAt}`);
  lines.push(`Iterations per fixture-model: ${report.iterationsPerFixture}`);
  lines.push(`Models: ${report.models.map((m) => m.label).join(', ')}`);
  lines.push('');

  for (const s of report.summary) {
    lines.push(`[${s.fixtureId}] × [${s.modelLabel}]`);
    lines.push(`  success: ${s.successCount}/${s.iterations} | valid: ${s.validCount}/${s.iterations}`);
    lines.push(`  latency  mean=${s.meanLatencyMs}ms  p50=${s.p50LatencyMs}ms  p95=${s.p95LatencyMs}ms  p99=${s.p99LatencyMs}ms  min=${s.minLatencyMs}ms  max=${s.maxLatencyMs}ms`);
    lines.push('');
  }

  lines.push('=== Raw results (first per fixture-model) ===');
  for (const s of report.summary) {
    const first = report.results.find(
      (r) => r.fixtureId === s.fixtureId && r.modelLabel === s.modelLabel && r.iteration === 0
    );
    if (first) {
      lines.push(`[${s.fixtureId}] × [${s.modelLabel}] sample:`);
      lines.push(`  ${first.contentSample.replace(/\n/g, ' ')}`);
      lines.push('');
    }
  }

  return lines.join('\n');
}
