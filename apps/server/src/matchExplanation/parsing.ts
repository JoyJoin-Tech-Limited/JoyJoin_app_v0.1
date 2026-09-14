import { logger } from '../lib/logger';
import { PAIR_EXPLANATION_PROMPT_VERSION } from './constants';

const DEFAULT_PAIR_EXPLANATION =
  '这两位都是有趣的人，期待你们在活动中发现彼此的闪光点！';

type MalformedExplanationRecoveryKind = 'truncated' | 'fenced' | 'nested' | 'missing-key';

/**
 * Generation-boundary observability for LLM-output recovery. Emitted only when
 * `recoverExplanationFromMalformedJson` salvages text AND the caller opted in
 * via `logRecovery` — serve-path normalization of legacy rows stays silent by
 * design. Never log the recovered text itself (user-adjacent profile data).
 */
function logMalformedExplanationRecovery(
  kind: MalformedExplanationRecoveryKind,
  recoveredLength: number,
): void {
  logger.warn('[MatchExplanation] recovered malformed explanation payload', {
    promptVersion: PAIR_EXPLANATION_PROMPT_VERSION,
    kind,
    recoveredLength,
  });
}

/**
 * Recover the human-readable `explanation` value from a JSON-ish string that
 * failed strict JSON.parse — e.g. truncated by the model's max_tokens limit or
 * wrapped in markdown code fences. Returns plain text, or null when nothing
 * usable can be salvaged.
 *
 * When `options.logRecovery` is set (LLM generation boundary only), a
 * successful salvage emits one `logger.warn` classifying the recovery so
 * truncation/fencing rates can inform max_tokens and prompt tuning.
 */
function recoverExplanationFromMalformedJson(
  raw: string,
  options?: { logRecovery?: boolean },
): string | null {
  let text = raw.trim();
  // Strip ```json ... ``` (or ``` ... ```) fences when the model ignored the
  // "no markdown code block" instruction.
  const fence = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fence) text = fence[1].trim();

  // Strict parse on the (possibly de-fenced) text — handles valid JSON and
  // double-serialized / object-wrapped explanations.
  let parseOk = false;
  try {
    const parsed = JSON.parse(text) as { explanation?: unknown };
    parseOk = true;
    if (parsed && typeof parsed === 'object' && 'explanation' in parsed) {
      const inner = normalizePairExplanationText(parsed.explanation);
      if (inner) {
        if (options?.logRecovery) {
          logMalformedExplanationRecovery(fence ? 'fenced' : 'nested', inner.length);
        }
        return inner;
      }
    }
  } catch {
    // Fall through to regex recovery for truncated / malformed JSON.
  }

  // Regex recovery: capture the explanation string value even when the closing
  // quote/brace is missing (truncated output).
  const match = text.match(/"explanation"\s*:\s*"((?:[^"\\]|\\.)*)/);
  if (match && match[1]) {
    const value = match[1]
      .replace(/\\(["\\/])/g, '$1')
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t')
      .trim();
    if (value) {
      if (options?.logRecovery) {
        // parseOk + regex salvage ⇒ valid JSON without a usable explanation key.
        logMalformedExplanationRecovery(parseOk ? 'missing-key' : 'truncated', value.length);
      }
      return value;
    }
  }

  return null;
}

/**
 * Normalize any pair-explanation payload to guaranteed plain text.
 *
 * The DB (event_pool_groups.pair_explanations_cache) must never hold a
 * serialized/truncated JSON wrapper as the explanation. This helper unwraps
 * JSON-encoded strings, extracts `.explanation` from objects, recovers text
 * from malformed/truncated JSON, and trims the result. It NEVER returns a
 * string beginning with '{' or '['; unrecoverable input yields `fallback`.
 * Idempotent — clean plain text passes through unchanged.
 *
 * `options.logRecovery` opts into a `logger.warn` when malformed-JSON recovery
 * salvages text — pass it only at the LLM generation boundary; serve-path and
 * persist-guard normalization must stay silent to avoid per-read log spam.
 */
export function normalizePairExplanationText(
  value: unknown,
  fallback = '',
  options?: { logRecovery?: boolean },
): string {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return fallback;
    // Route JSON objects/arrays AND markdown-fenced JSON to recovery; plain
    // prose (the normal case) falls through untouched.
    if (trimmed.startsWith('{') || trimmed.startsWith('[') || trimmed.startsWith('```')) {
      const recovered = recoverExplanationFromMalformedJson(trimmed, options);
      if (recovered && !recovered.startsWith('{') && !recovered.startsWith('[')) {
        return recovered;
      }
      return fallback;
    }
    return trimmed;
  }

  if (value && typeof value === 'object') {
    const obj = value as { explanation?: unknown };
    if ('explanation' in obj) {
      return normalizePairExplanationText(obj.explanation, fallback, options);
    }
    // Object without an explanation key: use its first string property.
    const firstString = Object.values(obj).find((v): v is string => typeof v === 'string');
    if (firstString) return normalizePairExplanationText(firstString, fallback, options);
  }

  return fallback;
}

/**
 * Parse pair-explanation LLM output: `pair-explanation-v3` expects a single JSON object;
 * legacy plain-text responses remain supported. The returned explanation is always
 * plain text — never a serialized/truncated JSON wrapper.
 *
 * This is the LLM generation boundary: recoveries are logged (logger.warn with
 * `logRecovery: true`) so malformed-output rates stay observable.
 */
export function parsePairExplanationContent(raw: string): { explanation: string; introAngle?: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { explanation: DEFAULT_PAIR_EXPLANATION };
  }
  try {
    const parsed = JSON.parse(trimmed) as { explanation?: unknown; introAngle?: unknown };
    if (parsed && typeof parsed === 'object') {
      const explanation = normalizePairExplanationText(
        parsed.explanation,
        DEFAULT_PAIR_EXPLANATION,
        { logRecovery: true },
      );
      const introAngle =
        typeof parsed.introAngle === 'string'
          ? normalizePairExplanationText(parsed.introAngle, '', { logRecovery: true }).slice(0, 48) || undefined
          : undefined;
      return { explanation, introAngle };
    }
  } catch {
    // Not valid complete JSON (truncated by max_tokens, fenced, or legacy plain
    // text): recover/unwrap instead of persisting the raw JSON wrapper.
  }
  return {
    explanation: normalizePairExplanationText(trimmed, DEFAULT_PAIR_EXPLANATION, {
      logRecovery: true,
    }),
  };
}

export { DEFAULT_PAIR_EXPLANATION };
