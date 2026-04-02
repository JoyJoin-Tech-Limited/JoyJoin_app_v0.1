import type { InferredAttribute, InferenceEngineConfig, UserAttributeMap } from './types';
import { recordRuntimeLLMFallbackMetric } from '../middleware/metrics';

export type RuntimeLLMFallbackOutcome =
  | 'applied'
  | 'rejected_unapproved'
  | 'rejected_low_confidence'
  | 'skipped_user_declared';

export interface RuntimeLLMFallbackConfig {
  enabled: boolean;
  minConfidence: number;
  approvedFields: string[];
  promptVersion: string;
}

export interface RuntimeLLMFallbackEvent {
  timestamp: string;
  sessionId?: string;
  field: string;
  confidence: number;
  outcome: RuntimeLLMFallbackOutcome;
}

export interface RuntimeLLMFallbackEvaluation {
  config: RuntimeLLMFallbackConfig;
  attempted: number;
  applied: number;
  acceptedFields: string[];
  rejectedFields: string[];
  skippedUserDeclaredFields: string[];
  events: RuntimeLLMFallbackEvent[];
}

const MAX_RUNTIME_FALLBACK_EVENTS = 500;
const runtimeLLMFallbackEvents: RuntimeLLMFallbackEvent[] = [];

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) {
    return 0.75;
  }

  return Math.min(1, Math.max(0, value));
}

function parseApprovedFields(value: string | undefined): string[] {
  if (!value) {
    return ['lifeStage', 'industry', 'occupation', 'education', 'languages'];
  }

  const parsed = value
    .split(',')
    .map((field) => field.trim())
    .filter(Boolean);

  return parsed.length > 0
    ? Array.from(new Set(parsed))
    : ['lifeStage', 'industry', 'occupation', 'education', 'languages'];
}

export function getRuntimeLLMFallbackConfig(
  overrides: Partial<InferenceEngineConfig> = {},
): RuntimeLLMFallbackConfig {
  const enabledFromEnv = process.env.INFERENCE_RUNTIME_LLM_FALLBACK_ENABLED;
  const minConfidenceFromEnv = process.env.INFERENCE_RUNTIME_LLM_FALLBACK_MIN_CONFIDENCE;
  const approvedFieldsFromEnv = process.env.INFERENCE_RUNTIME_LLM_FALLBACK_APPROVED_FIELDS;
  const promptVersion = process.env.INFERENCE_RUNTIME_LLM_FALLBACK_PROMPT_VERSION?.trim()
    || 'runtime_llm_fallback_v1';

  const enabled = overrides.enableRuntimeLLMFallback
    ?? (enabledFromEnv === undefined ? true : !['0', 'false'].includes(enabledFromEnv.toLowerCase()));
  const minConfidence = clampConfidence(
    overrides.runtimeLLMFallbackMinConfidence
      ?? (minConfidenceFromEnv ? Number(minConfidenceFromEnv) : 0.75),
  );
  const approvedFields = Array.from(
    new Set(
      overrides.runtimeLLMFallbackApprovedFields
        ?? parseApprovedFields(approvedFieldsFromEnv),
    ),
  );

  return {
    enabled,
    minConfidence,
    approvedFields,
    promptVersion,
  };
}

export function applyRuntimeLLMFallbackPolicy(
  inferred: InferredAttribute[],
  currentState: UserAttributeMap,
  options: {
    sessionId?: string;
    config?: Partial<InferenceEngineConfig>;
  } = {},
): {
  acceptedInferred: InferredAttribute[];
  evaluation: RuntimeLLMFallbackEvaluation;
} {
  const config = getRuntimeLLMFallbackConfig(options.config);
  const approvedFields = new Set(config.approvedFields);
  const events: RuntimeLLMFallbackEvent[] = [];
  const acceptedInferred: InferredAttribute[] = [];
  const rejectedFields = new Set<string>();
  const skippedUserDeclaredFields = new Set<string>();

  if (!config.enabled) {
    return {
      acceptedInferred: [],
      evaluation: {
        config,
        attempted: 0,
        applied: 0,
        acceptedFields: [],
        rejectedFields: [],
        skippedUserDeclaredFields: [],
        events: [],
      },
    };
  }

  for (const inf of inferred) {
    let outcome: RuntimeLLMFallbackOutcome;
    const existing = currentState[inf.field];

    if (existing?.source === 'explicit') {
      outcome = 'skipped_user_declared';
      skippedUserDeclaredFields.add(inf.field);
    } else if (!approvedFields.has(inf.field)) {
      outcome = 'rejected_unapproved';
      rejectedFields.add(inf.field);
    } else if (inf.confidence < config.minConfidence) {
      outcome = 'rejected_low_confidence';
      rejectedFields.add(inf.field);
    } else {
      outcome = 'applied';
      acceptedInferred.push({
        ...inf,
        source: 'llm_fallback',
      });
    }

    const event: RuntimeLLMFallbackEvent = {
      timestamp: new Date().toISOString(),
      sessionId: options.sessionId,
      field: inf.field,
      confidence: inf.confidence,
      outcome,
    };

    events.push(event);
    runtimeLLMFallbackEvents.push(event);
    if (runtimeLLMFallbackEvents.length > MAX_RUNTIME_FALLBACK_EVENTS) {
      runtimeLLMFallbackEvents.shift();
    }

    recordRuntimeLLMFallbackMetric(inf.field, outcome);
  }

  return {
    acceptedInferred,
    evaluation: {
      config,
      attempted: inferred.length,
      applied: acceptedInferred.length,
      acceptedFields: acceptedInferred.map((inf) => inf.field),
      rejectedFields: Array.from(rejectedFields),
      skippedUserDeclaredFields: Array.from(skippedUserDeclaredFields),
      events,
    },
  };
}

export function getRuntimeLLMFallbackStats() {
  const byOutcome: Record<RuntimeLLMFallbackOutcome, number> = {
    applied: 0,
    rejected_unapproved: 0,
    rejected_low_confidence: 0,
    skipped_user_declared: 0,
  };
  const byField: Record<string, Record<RuntimeLLMFallbackOutcome | 'attempts', number>> = {};

  for (const event of runtimeLLMFallbackEvents) {
    byOutcome[event.outcome] += 1;

    if (!byField[event.field]) {
      byField[event.field] = {
        attempts: 0,
        applied: 0,
        rejected_unapproved: 0,
        rejected_low_confidence: 0,
        skipped_user_declared: 0,
      };
    }

    byField[event.field].attempts += 1;
    byField[event.field][event.outcome] += 1;
  }

  const attempts = runtimeLLMFallbackEvents.length;
  const applied = byOutcome.applied;

  return {
    totals: {
      attempts,
      applied,
      rejectedUnapproved: byOutcome.rejected_unapproved,
      rejectedLowConfidence: byOutcome.rejected_low_confidence,
      skippedUserDeclared: byOutcome.skipped_user_declared,
      appliedRate: attempts > 0 ? applied / attempts : 0,
    },
    byField,
    recentEvents: runtimeLLMFallbackEvents.slice(-25).reverse(),
  };
}

export function resetRuntimeLLMFallbackStatsForTest(): void {
  runtimeLLMFallbackEvents.length = 0;
}
