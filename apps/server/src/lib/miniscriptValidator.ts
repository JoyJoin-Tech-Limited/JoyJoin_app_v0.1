/**
 * MiniScript Pass 2 — Thinking-Mode Validation
 *
 * Validates a generated mystery framework for logical consistency,
 * clue→solution derivability, and genre-appropriate mechanical soundness.
 *
 * Uses DeepSeek thinking mode for chain-of-thought reasoning.
 * Returns a structured validation report, NOT a regenerated framework.
 */

import type { MiniScriptGameModeConfig } from '@shared/miniscriptGameModes';
import type { MiniScriptStoryFramework } from '@shared/miniscriptStoryFramework';
import {
  buildMiniScriptValidationPrompt,
  MINISCRIPT_VALIDATION_PROMPT_VERSION,
  type MiniScriptValidationResult,
} from '../ai/miniscriptValidationPrompts';
import { getDeepseekSelection } from '../ai/socialModelRouter';
import { createAiCorrelationId, logAITrace } from './aiTraceLogger';
import { logger } from './logger';

const VALIDATION_TIMEOUT_MS = 15_000;
const VALIDATION_MIN_ACCEPT_SCORE = 70;

export interface ValidationRunMeta {
  correlationId: string;
  promptVersion: string;
  provider: string;
  model: string;
  latencyMs: number;
  score: number;
  valid: boolean;
  fixable: boolean;
  issueCount: number;
}

/**
 * Run Pass 2 validation on a draft mystery framework.
 *
 * Returns:
 *   - valid: true if the framework passes validation (score ≥ 70, no critical issues)
 *   - result: the parsed validation report
 *   - meta: telemetry for AITrace
 */
export async function validateMiniScriptFramework(params: {
  draft: MiniScriptStoryFramework;
  config: MiniScriptGameModeConfig;
}): Promise<{
  valid: boolean;
  result: MiniScriptValidationResult;
  meta: ValidationRunMeta;
}> {
  const correlationId = createAiCorrelationId();
  const t0 = Date.now();

  // Serialize draft for the validation prompt
  const draftJson = JSON.stringify(params.draft, null, 2);
  const prompt = buildMiniScriptValidationPrompt({
    draftJson,
    config: params.config,
  });

  // Use flash-thinking with max reasoning for validation accuracy
  const deepseek = getDeepseekSelection('flash-thinking', 'max');

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), VALIDATION_TIMEOUT_MS);

    const response = await deepseek.client.chat.completions.create(
      {
        model: deepseek.model,
        messages: [
          { role: 'system', content: prompt.system },
          { role: 'user', content: prompt.user },
        ],
        temperature: 0.3,
        max_tokens: 800,
        // Request JSON output for reliable parsing
        response_format: { type: 'json_object' },
      },
      { signal: controller.signal }
    );

    clearTimeout(timer);

    const content = response.choices[0]?.message?.content?.trim() ?? '';
    const latencyMs = Date.now() - t0;

    let parsed: MiniScriptValidationResult;
    try {
      parsed = JSON.parse(content) as MiniScriptValidationResult;
    } catch {
      // JSON parse failed — treat as invalid
      const fallbackResult: MiniScriptValidationResult = {
        valid: false,
        score: 0,
        issues: [
          {
            severity: 'critical',
            field: 'validation_response',
            message: 'Validator returned unparseable JSON',
            suggestion: 'Use catalog fallback',
          },
        ],
        fixable: false,
        summary: 'Validation failed due to parser error',
      };

      const meta: ValidationRunMeta = {
        correlationId,
        promptVersion: MINISCRIPT_VALIDATION_PROMPT_VERSION,
        provider: deepseek.provider,
        model: deepseek.model,
        latencyMs,
        score: 0,
        valid: false,
        fixable: false,
        issueCount: 1,
      };

      emitValidationTrace(correlationId, meta);
      return { valid: false, result: fallbackResult, meta };
    }

    // Normalize and evaluate
    const score = Math.max(0, Math.min(100, parsed.score ?? 0));
    const hasCritical = (parsed.issues ?? []).some((i) => i.severity === 'critical');
    const valid = parsed.valid === true && score >= VALIDATION_MIN_ACCEPT_SCORE && !hasCritical;

    const meta: ValidationRunMeta = {
      correlationId,
      promptVersion: MINISCRIPT_VALIDATION_PROMPT_VERSION,
      provider: deepseek.provider,
      model: deepseek.model,
      latencyMs,
      score,
      valid,
      fixable: parsed.fixable === true,
      issueCount: (parsed.issues ?? []).length,
    };

    emitValidationTrace(correlationId, meta);

    return {
      valid,
      result: parsed,
      meta,
    };
  } catch (error) {
    logger.error('[MiniScriptValidator] validation error', { error: error instanceof Error ? error.message : String(error) });
    const latencyMs = Date.now() - t0;

    const fallbackResult: MiniScriptValidationResult = {
      valid: false,
      score: 0,
      issues: [
        {
          severity: 'critical',
          field: 'validation_call',
          message: error instanceof Error ? error.message : 'Unknown validation error',
          suggestion: 'Use catalog fallback',
        },
      ],
      fixable: false,
      summary: 'Validation call failed',
    };

    const meta: ValidationRunMeta = {
      correlationId,
      promptVersion: MINISCRIPT_VALIDATION_PROMPT_VERSION,
      provider: deepseek.provider,
      model: deepseek.model,
      latencyMs,
      score: 0,
      valid: false,
      fixable: false,
      issueCount: 1,
    };

    emitValidationTrace(correlationId, meta);
    return { valid: false, result: fallbackResult, meta };
  }
}

function emitValidationTrace(correlationId: string, meta: ValidationRunMeta) {
  logAITrace({
    traceId: correlationId,
    domain: 'miniscript',
    feature: 'validateMiniScriptFramework',
    provider: meta.provider as any,
    model: meta.model,
    latencyMs: meta.latencyMs,
    success: meta.valid,
    fallbackUsed: false,
    fromCache: false,
    promptVersion: meta.promptVersion,
    errorCode: meta.valid
      ? undefined
      : meta.fixable
        ? 'validation_fixable'
        : 'validation_failed',
  });
}
