/**
 * Craft Quality Gate — shared LLM wrapper for writing craft enforcement.
 *
 * Injects craft principles into any LLM prompt, validates output against
 * the 8+ axiom checklist, and retries (with refinement hints) on failure.
 *
 * Usage:
 *   import { generateWithCraftQuality } from './lib/craftQualityGate';
 *   const result = await generateWithCraftQuality({
 *     buildPrompt: () => ({ system: '...', user: '...' }),
 *     callLLM: (system, user) => client.chat.completions.create({ ... }),
 *     parseResult: (raw) => JSON.parse(raw),
 *     context: 'analysis',
 *   });
 */

import { validateCraft, buildRefinementHints, type CraftContext } from './writingCraftValidator';
import {
  XIAOYUE_CRAFT_PRINCIPLES,
  XIAOYUE_CRAFT_LITE,
  getCraftInstructions,
} from '../prompts/craft';
import { logger } from './logger';

export { type CraftContext } from './writingCraftValidator';

export interface CraftQualityResult<T> {
  result: T;
  /** Craft score for the final output (0-100). */
  craftScore: number;
  /** Number of retry attempts used (0 = first pass passed). */
  retries: number;
  /** Whether the result passed the craft threshold. */
  passed: boolean;
  /** Whether the craft system fell back to best-effort after max retries. */
  exhausted: boolean;
  /** Issues that remain unresolved (empty if passed). */
  unresolvedIssues: string[];
}

export interface CraftQualityParams<T> {
  /** Returns { system, user } prompt strings. Called fresh each attempt. */
  buildPrompt: () => { system?: string; user: string };
  /** Calls the LLM and returns the raw response text. */
  callLLM: (systemPrompt: string, userPrompt: string) => Promise<string>;
  /** Parses raw LLM text into T. Returns null if unparseable. */
  parseResult: (rawText: string) => T | null;
  /** Craft context for threshold selection. */
  context: CraftContext;
  /** Max retry attempts after initial generation (default: 2 for analysis/narrative, 1 otherwise). */
  maxRetries?: number;
  /** Quality threshold (default: 70 for analysis/narrative, 55 for comment/coaching). */
  qualityThreshold?: number;
  /** Text extractor — pulls the string to validate from the parsed result. */
  extractText: (result: T) => string;
  /** Fallback result if all attempts fail entirely (e.g. parse failure, API error). */
  fallback: T;
  /** Custom craft principles override (default: auto-select from context). */
  craftPrinciplesOverride?: string;
}

function getDefaultMaxRetries(context: CraftContext): number {
  switch (context) {
    case 'analysis':
    case 'narrative':
      return 2;
    case 'comment':
    case 'coaching':
    case 'lite':
      return 1;
    default:
      return 2;
  }
}

function getDefaultThreshold(context: CraftContext): number {
  switch (context) {
    case 'analysis':
    case 'narrative':
      return 70;
    case 'comment':
    case 'coaching':
      return 55;
    case 'lite':
      return 55;
    default:
      return 70;
  }
}

function getCraftPrinciples(context: CraftContext): string {
  switch (context) {
    case 'analysis':
    case 'narrative':
      return getCraftInstructions();
    case 'comment':
    case 'coaching':
    case 'lite':
      return XIAOYUE_CRAFT_LITE;
    default:
      return getCraftInstructions();
  }
}

export async function generateWithCraftQuality<T>(
  params: CraftQualityParams<T>
): Promise<CraftQualityResult<T>> {
  const maxRetries = params.maxRetries ?? getDefaultMaxRetries(params.context);
  const threshold = params.qualityThreshold ?? getDefaultThreshold(params.context);
  const craftPrinciples = params.craftPrinciplesOverride ?? getCraftPrinciples(params.context);

  let lastResult: T | null = null;
  let lastDiag: ReturnType<typeof validateCraft> | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const prompt = params.buildPrompt();
      const systemPrompt = [prompt.system, craftPrinciples].filter(Boolean).join('\n\n');
      let userPrompt = prompt.user;

      // On retry, inject refinement hints
      if (attempt > 0 && lastDiag) {
        const hints = buildRefinementHints(lastDiag);
        if (hints) {
          userPrompt = `${prompt.user}\n\n${hints}`;
        }
      }

      const rawText = await params.callLLM(systemPrompt, userPrompt);
      const parsed = params.parseResult(rawText);

      if (!parsed) {
        // Parse failure — retry with explicit JSON instruction if attempts remain
        if (attempt < maxRetries) {
          logger.info('[CraftQualityGate] Parse failure, retrying with JSON hint', {
            context: params.context,
            attempt,
          });
          // On retry, add JSON-only hint to user prompt
          continue;
        }
        return {
          result: params.fallback,
          craftScore: 0,
          retries: attempt,
          passed: false,
          exhausted: true,
          unresolvedIssues: ['Parse failure — raw LLM text could not be parsed'],
        };
      }

      const textToValidate = params.extractText(parsed);
      const diag = validateCraft(textToValidate, params.context);

      if (diag.craftScore >= threshold) {
        return {
          result: parsed,
          craftScore: diag.craftScore,
          retries: attempt,
          passed: diag.passes,
          exhausted: false,
          unresolvedIssues: [],
        };
      }

      // Craft failed — store for retry
      lastResult = parsed;
      lastDiag = diag;

      if (attempt < maxRetries) {
        logger.info('[CraftQualityGate] Craft score below threshold, retrying', {
          context: params.context,
          craftScore: diag.craftScore,
          threshold,
          attempt,
          issues: diag.fixableIssues.length,
        });
        continue;
      }

      // Max retries exhausted
      logger.warn('[CraftQualityGate] Max retries exhausted, using best effort', {
        context: params.context,
        craftScore: diag.craftScore,
        threshold,
        issues: diag.fixableIssues,
      });

      return {
        result: parsed,
        craftScore: diag.craftScore,
        retries: attempt,
        passed: false,
        exhausted: true,
        unresolvedIssues: diag.fixableIssues,
      };
    } catch (error) {
      logger.error('[CraftQualityGate] LLM call failed', {
        context: params.context,
        attempt,
        error: error instanceof Error ? error.message : String(error),
      });

      // On API error mid-retry, use last successful parse if any
      if (lastResult) {
        return {
          result: lastResult,
          craftScore: lastDiag?.craftScore ?? 0,
          retries: attempt,
          passed: false,
          exhausted: true,
          unresolvedIssues: lastDiag?.fixableIssues ?? [],
        };
      }

      if (attempt < maxRetries) continue;

      return {
        result: params.fallback,
        craftScore: 0,
        retries: attempt,
        passed: false,
        exhausted: true,
        unresolvedIssues: ['LLM API error — all attempts exhausted'],
      };
    }
  }

  // Safety net
  return {
    result: lastResult ?? params.fallback,
    craftScore: lastDiag?.craftScore ?? 0,
    retries: maxRetries,
    passed: false,
    exhausted: true,
    unresolvedIssues: lastDiag?.fixableIssues ?? ['Unexpected: retry loop exhausted without resolution'],
  };
}
