import { validateContentSafe, type ContentSafetyResult } from './contentSafety';
import { logAITrace } from './aiTraceLogger';
import type { AIProvider } from '@shared/types/aiMeta';

export interface ModerationCheck {
  /** Field name for logging / violation reporting. */
  field: string;
  /** Text to validate. */
  text: string | undefined;
}

export interface ModerationFailure {
  safe: false;
  field: string;
  message: string;
  violation?: NonNullable<ContentSafetyResult['violation']>;
}

export interface ModerationSuccess {
  safe: true;
}

export type ModerationResult = ModerationSuccess | ModerationFailure;

export interface ModerationOptions {
  domain: string;
  feature: string;
  provider: AIProvider;
  model?: string;
  latencyMs?: number;
  promptVersion?: string;
  traceId?: string;
}

/**
 * Post-generation content moderation for AI output.
 *
 * Runs validateContentSafe() on each provided text field. On the first
 * violation, logs a structured AITrace with fallbackUsed: true and returns
 * the violation details so the caller can swap in deterministic fallback
 * content.
 *
 * This is intentionally non-blocking at the request level — callers decide
 * whether to reject or degrade to fallback content.
 */
export function moderateGeneratedContent(
  checks: ModerationCheck[],
  options: ModerationOptions,
): ModerationResult {
  for (const check of checks) {
    const text = check.text?.trim();
    if (!text || text.length === 0) {
      continue;
    }
    const result = validateContentSafe(text, check.field);
    if (!result.safe) {
      logAITrace({
        traceId: options.traceId,
        domain: options.domain,
        feature: options.feature,
        provider: options.provider,
        model: options.model,
        latencyMs: options.latencyMs ?? 0,
        success: false,
        fallbackUsed: true,
        fromCache: false,
        promptVersion: options.promptVersion,
        errorCode: 'content_safety',
        extra: {
          field: check.field,
          violationType: result.violation?.type,
          severity: result.violation?.severity,
          matchedKeywords: result.violation?.matchedKeywords,
        },
      });
      return {
        safe: false,
        field: check.field,
        message: result.violation?.message ?? '内容安全检测未通过',
        violation: result.violation,
      };
    }
  }
  return { safe: true };
}

/**
 * Collect text fields from a record of strings into ModerationCheck objects.
 */
export function toModerationChecks(
  fields: Record<string, string | null | undefined>,
): ModerationCheck[] {
  return Object.entries(fields)
    .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
    .map(([field, text]) => ({ field, text }));
}

/**
 * Collect text fields from an array of objects by extracting a string property.
 */
export function toModerationChecksFromArray<T extends Record<string, unknown>>(
  items: T[],
  extract: (item: T) => { field: string; text: string }[],
): ModerationCheck[] {
  return items.flatMap((item) => extract(item));
}
