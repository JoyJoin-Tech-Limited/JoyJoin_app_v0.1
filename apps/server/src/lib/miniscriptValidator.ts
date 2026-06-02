/**
 * MiniScript Pass 2 — Thinking-Mode Validation + Narrative Craft Checks
 *
 * Phase 1 (deterministic): Check narrative golden rules before LLM validation
 *   - Cliffhanger presence (all acts except last)
 *   - Show-don't-tell signals (concrete action vs abstract description)
 *   - Conflict presence per act
 * Phase 2 (LLM): Validate logical consistency, clue→solution derivability
 *   - Uses DeepSeek thinking mode for chain-of-thought reasoning
 *   - Returns structured validation report
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

// ─── Deterministic Narrative Craft Checks ─────────────────────────────────────

interface NarrativeCraftIssue {
  severity: 'critical' | 'warning';
  field: string;
  message: string;
  suggestion: string;
}

function validateNarrativeCraft(draft: MiniScriptStoryFramework): NarrativeCraftIssue[] {
  const issues: NarrativeCraftIssue[] = [];

  // 1. Cliffhanger check: all acts except last must have a cliffhanger
  draft.act_flow.forEach((act, i) => {
    const isLastAct = i === draft.act_flow.length - 1;
    if (!isLastAct && (!act.cliffhanger || act.cliffhanger.trim().length === 0)) {
      issues.push({
        severity: 'critical',
        field: `act_flow[${i}].cliffhanger`,
        message: `第${act.actNumber}幕缺少悬念钩子（cliffhanger）`,
        suggestion: '每幕结束必须留一个让玩家想继续玩的具体悬念',
      });
    }
    if (act.cliffhanger && act.cliffhanger.length > 80) {
      issues.push({
        severity: 'warning',
        field: `act_flow[${i}].cliffhanger`,
        message: `第${act.actNumber}幕cliffhanger超过80字`,
        suggestion: '悬念钩子应为一句话（≤80字），过长会破坏节奏',
      });
    }
  });

  // 2. Show-don't-tell: character sinHook must describe actions, not labels
  const abstractSinPatterns = ['是一个', '的人', '性格', '特点', '倾向', '总是', '经常'];
  draft.characters.forEach((c: MiniScriptStoryFramework['characters'][number]) => {
    const matchCount = abstractSinPatterns.filter(p => c.sinHook.includes(p)).length;
    if (matchCount >= 3) {
      issues.push({
        severity: 'critical',
        field: `characters[${c.slotIndex}].sinHook`,
        message: `"${c.roleLabel}" 的sinHook过于抽象，应通过具体行为展现`,
        suggestion: '用"他会..."开头的动作句替换性格标签词（如"是一个喜欢逞强的人"→"嘴上答应的事，私下偷偷多干三倍"）',
      });
    } else if (matchCount === 2) {
      issues.push({
        severity: 'warning',
        field: `characters[${c.slotIndex}].sinHook`,
        message: `"${c.roleLabel}" 的sinHook略显抽象，可考虑更具体的行为描述`,
        suggestion: '尝试用具体动作替换一两个抽象词',
      });
    }
  });

  // 3. Alibi concreteness: should read like a flashback scene, not a timeline report
  const alibiReportPatterns = ['后来', '然后', '之后', '接下来', '第一', '第二'];
  draft.characters.forEach((c: MiniScriptStoryFramework['characters'][number]) => {
    const reportCount = alibiReportPatterns.filter(p => c.alibi.includes(p)).length;
    if (reportCount >= 3) {
      issues.push({
        severity: 'warning',
        field: `characters[${c.slotIndex}].alibi`,
        message: `"${c.roleLabel}" 的alibi像时间线报告，缺乏画面感`,
        suggestion: 'alibi应该是一段能拍出来的闪回场景（她在哪里、看见了什么、手边有什么），不是事件列表',
      });
    }
  });

  // 4. Conflict presence per act: each act must have at least 1 conflict/turn beat
  const conflictSignals = ['矛盾', '冲突', '争执', '推翻', '反转', '发现', '揭开', '暴露', '对峙', '误会'];
  draft.act_flow.forEach((act, i) => {
    const hasConflict = act.beats.some((beat: string) =>
      conflictSignals.some((signal: string) => beat.includes(signal))
    );
    if (!hasConflict) {
      issues.push({
        severity: 'critical',
        field: `act_flow[${i}].beats`,
        message: `第${act.actNumber}幕缺少冲突或转折点`,
        suggestion: '每一幕必须有至少一个冲突/转折（新线索推翻旧判断、角色间出现张力、某人做了出乎意料的事）',
      });
    }
  });

  // 5. SinHook activation: at least one character's sinHook should be referenced in the act beats
  draft.act_flow.forEach((act, i) => {
    const sinHooksMentioned = draft.characters.filter((c: MiniScriptStoryFramework['characters'][number]) =>
      act.beats.some((beat: string) => beat.includes(c.sinHook.slice(0, 6)))
    );
    if (sinHooksMentioned.length === 0 && i < draft.act_flow.length - 1) {
      issues.push({
        severity: 'warning',
        field: `act_flow[${i}].beats`,
        message: `第${act.actNumber}幕没有展现任何角色的sinHook`,
        suggestion: '每幕应有至少一个角色因为自身的小缺陷（sinHook）做出行动或造成误解',
      });
    }
  });

  return issues;
}

function injectCraftIssuesIntoPrompt(
  issues: NarrativeCraftIssue[],
  currentPrompt: { system: string; user: string }
): { system: string; user: string } {
  if (issues.length === 0) return currentPrompt;

  const issueBlock = issues
    .map((issue, i) => `${i + 1}. [${issue.severity}] ${issue.message}\n   建议：${issue.suggestion}`)
    .join('\n');

  return {
    system: currentPrompt.system,
    user: `${currentPrompt.user}\n\n【叙事工艺前置检查 — 以下问题已发现，请重点验证】\n${issueBlock}`,
  };
}

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

  // Phase 1: Deterministic narrative craft checks
  const craftIssues = validateNarrativeCraft(params.draft);

  // Serialize draft for the validation prompt
  const draftJson = JSON.stringify(params.draft, null, 2);
  let prompt = buildMiniScriptValidationPrompt({
    draftJson,
    config: params.config,
  });

  // Inject craft issues into validation prompt for targeted LLM review
  prompt = injectCraftIssuesIntoPrompt(craftIssues, prompt);

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
