/**
 * MiniScript Runtime Critic — lightweight post-generation, pre-persist gate.
 *
 * Runs a single DeepSeek flash-tier call (top-level thinking disabled via the
 * shared client wrapper — never extra_body) to detect:
 *   - solution leaks in evidence reactions / motive options
 *   - violence / death content
 *   - high-pressure tone (hard constraint: low-stakes mishap only)
 *
 * Budget semantics (AC-05): the critic gets min(5s, remaining 28s pipeline
 * budget). Budget exhaustion or LLM timeout → treated as PASS (fail-open) and
 * reported as `miniscript_runtime_critic_timeout`; the offline critic-revise
 * pipeline is the quality backstop. A detected violation → fail-closed to the
 * catalog fallback and reported as `miniscript_runtime_critic_blocked`.
 *
 * REL-01: this module never throws — any critic exception degrades to PASS.
 * Flag: MINISCRIPT_RUNTIME_CRITIC_ENABLED (default false) — when off the
 * module is a provable no-op (zero LLM calls).
 */

import type { MiniScriptStoryFramework } from '@shared/miniscriptStoryFramework';
import { getDeepseekSelection } from '../ai/socialModelRouter';
import { isLLMTimeoutError, raceWithTimeout } from '../socialIcebreakerAICore';
import { createAiCorrelationId, logAITrace } from './aiTraceLogger';
import { recordMiniscriptRuntimeCriticMetric } from '../middleware/metrics';
import { logger } from './logger';

export const MINISCRIPT_RUNTIME_CRITIC_PROMPT_VERSION = 'miniscript-runtime-critic-v1';

const CRITIC_MAX_BUDGET_MS = 5_000;
const CRITIC_MAX_TOKENS = 600;

export function isMiniScriptRuntimeCriticEnabled(): boolean {
  const v = process.env.MINISCRIPT_RUNTIME_CRITIC_ENABLED;
  return v === '1' || v?.toLowerCase() === 'true';
}

export type MiniScriptRuntimeCriticVerdict = 'pass' | 'blocked' | 'timeout';

export type MiniScriptRuntimeCriticResult = {
  verdict: MiniScriptRuntimeCriticVerdict;
  /** True when no LLM call was made (flag off or budget exhausted). */
  skipped: boolean;
  violations: string[];
  latencyMs: number;
};

function buildCriticPrompt(framework: MiniScriptStoryFramework): { system: string; user: string } {
  const evidenceLines: string[] = [];
  for (const act of framework.act_flow) {
    for (const item of act.evidence ?? []) {
      for (const [roleSlot, reaction] of Object.entries(item.evidenceReactions ?? {})) {
        evidenceLines.push(`- [${item.id}→角色${roleSlot}] ${reaction}`);
      }
    }
  }

  const system =
    'You are a content safety reviewer for a light social mystery party game. ' +
    'Reply with one JSON object only (no markdown).';

  const user =
    `审查以下迷你剧本杀剧本的反应文本与动机选项。\n\n` +
    `【真相（仅你可见，用于泄露检测）】\n` +
    `当事人：${framework.solution.who}\n` +
    `做了什么：${framework.solution.what}\n` +
    `真实动机：${framework.solution.why}\n\n` +
    `【证物反应文本（逐条审查）】\n${evidenceLines.length > 0 ? evidenceLines.join('\n') : '（无）'}\n\n` +
    `【动机选项（公开下发给玩家）】\n${(framework.motiveOptions ?? []).map((o, i) => `${i + 1}. ${o}`).join('\n') || '（无）'}\n\n` +
    `检测三类违规：\n` +
    `1. leak：反应文本确认或排除当事人、或直接/间接泄露真相；动机干扰项蕴含真实动机；动机选项标注了哪个正确\n` +
    `2. violence：任何暴力、死亡、血腥内容\n` +
    `3. tone：高压、对抗、恐吓式基调（本游戏只允许低压力小误会基调）\n\n` +
    `输出 JSON：{"violations":[{"type":"leak|violence|tone","detail":"≤40字说明"}]}，无违规则 {"violations":[]}`;

  return { system, user };
}

function emitVerdict(params: {
  verdict: MiniScriptRuntimeCriticVerdict | 'error';
  violations: string[];
  latencyMs: number;
  budgetMs: number;
  model?: string;
  errorCode?: string;
}) {
  const { verdict, violations, latencyMs, budgetMs, model, errorCode } = params;
  recordMiniscriptRuntimeCriticMetric(verdict);
  if (verdict === 'blocked') {
    logger.info('miniscript_runtime_critic_blocked', {
      event: 'miniscript_runtime_critic_blocked',
      violations,
      latencyMs,
      promptVersion: MINISCRIPT_RUNTIME_CRITIC_PROMPT_VERSION,
    });
  } else if (verdict === 'timeout') {
    logger.info('miniscript_runtime_critic_timeout', {
      event: 'miniscript_runtime_critic_timeout',
      latencyMs,
      budgetMs,
      promptVersion: MINISCRIPT_RUNTIME_CRITIC_PROMPT_VERSION,
    });
  }
  logAITrace({
    traceId: createAiCorrelationId(),
    domain: 'miniscript',
    feature: 'miniscriptRuntimeCritic',
    provider: model ? 'deepseek' : null,
    model,
    latencyMs,
    success: verdict === 'pass' || verdict === 'blocked',
    fallbackUsed: verdict !== 'pass',
    fromCache: false,
    promptVersion: MINISCRIPT_RUNTIME_CRITIC_PROMPT_VERSION,
    errorCode,
  });
}

/**
 * Run the runtime critic against a generated framework. Never throws:
 * - flag off → skipped pass, zero LLM calls
 * - remaining pipeline budget exhausted → skipped pass + timeout event
 * - LLM timeout / error / unparseable output → pass (fail-open)
 * - violation detected → blocked (fail-closed to catalog upstream)
 */
export async function runMiniScriptRuntimeCritic(params: {
  framework: MiniScriptStoryFramework;
  remainingBudgetMs: number;
}): Promise<MiniScriptRuntimeCriticResult> {
  if (!isMiniScriptRuntimeCriticEnabled()) {
    return { verdict: 'pass', skipped: true, violations: [], latencyMs: 0 };
  }

  const t0 = Date.now();
  const budgetMs = Math.min(CRITIC_MAX_BUDGET_MS, Math.max(0, params.remainingBudgetMs));
  if (budgetMs <= 0) {
    emitVerdict({ verdict: 'timeout', violations: [], latencyMs: 0, budgetMs, errorCode: 'budget_exhausted' });
    return { verdict: 'timeout', skipped: true, violations: [], latencyMs: 0 };
  }

  let model: string | undefined;
  try {
    const selection = getDeepseekSelection('flash');
    model = selection.model;
    const prompt = buildCriticPrompt(params.framework);

    const response = await raceWithTimeout(
      selection.client.chat.completions.create({
        model: selection.model,
        messages: [
          { role: 'system', content: prompt.system },
          { role: 'user', content: prompt.user },
        ],
        temperature: 0,
        max_tokens: CRITIC_MAX_TOKENS,
        response_format: { type: 'json_object' },
      }),
      budgetMs,
    );

    const latencyMs = Date.now() - t0;
    const content = response.choices[0]?.message?.content?.trim() ?? '';
    let violations: string[] = [];
    try {
      const jsonMatch = content.match(/```json\s*([\s\S]*?)```/) || content.match(/```\s*([\s\S]*?)```/);
      const parsed = JSON.parse(jsonMatch?.[1]?.trim() ?? content) as {
        violations?: Array<{ type?: string; detail?: string }>;
      };
      violations = (parsed.violations ?? [])
        .filter((v) => typeof v?.type === 'string')
        .map((v) => `${v.type}: ${v.detail ?? ''}`.slice(0, 80));
    } catch {
      // Unparseable critic output → fail-open (offline pipeline is the backstop).
      emitVerdict({ verdict: 'pass', violations: [], latencyMs, budgetMs, model, errorCode: 'parse_error' });
      return { verdict: 'pass', skipped: false, violations: [], latencyMs };
    }

    if (violations.length > 0) {
      emitVerdict({ verdict: 'blocked', violations, latencyMs, budgetMs, model });
      return { verdict: 'blocked', skipped: false, violations, latencyMs };
    }

    emitVerdict({ verdict: 'pass', violations: [], latencyMs, budgetMs, model });
    return { verdict: 'pass', skipped: false, violations: [], latencyMs };
  } catch (error) {
    const latencyMs = Date.now() - t0;
    if (isLLMTimeoutError(error)) {
      emitVerdict({ verdict: 'timeout', violations: [], latencyMs, budgetMs, model, errorCode: 'critic_timeout' });
      return { verdict: 'timeout', skipped: false, violations: [], latencyMs };
    }
    logger.error('[miniscriptCritic] critic call failed — treating as pass (fail-open)', {
      error: error instanceof Error ? error.message : String(error),
    });
    emitVerdict({ verdict: 'error', violations: [], latencyMs, budgetMs, model, errorCode: 'critic_error' });
    return { verdict: 'pass', skipped: false, violations: [], latencyMs };
  }
}
