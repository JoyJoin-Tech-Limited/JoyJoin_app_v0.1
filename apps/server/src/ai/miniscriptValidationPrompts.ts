/**
 * MiniScript Pass 2 Validation Prompts
 *
 * Thinking-mode validation that checks logical consistency of a generated
 * mystery framework. Each genre has distinct validation criteria.
 *
 * Pass 2 does NOT regenerate the framework. It returns a validation report
 * that the pipeline uses to accept, fix, or reject the draft.
 */

import type { MiniScriptGameModeConfig } from '@shared/miniscriptGameModes';

export const MINISCRIPT_VALIDATION_PROMPT_VERSION = 'miniscript-validate-v2.0';

// ─── Base Validation System Prompt ────────────────────────────────────────────

const BASE_VALIDATION_SYSTEM =
  'You are a mystery game logic validator. Your job is to review a generated ' +
  'mini-script mystery framework and determine if it is logically consistent ' +
  'and mechanically sound. Be strict but fair. Reply with JSON only.';

// ─── Genre-Specific Validation Criteria ───────────────────────────────────────

const GENRE_VALIDATION_CRITERIA: Record<
  MiniScriptGameModeConfig['validationTemplateKey'],
  string
> = {
  'light-reasoning-validation-v1': `
【轻推理验证标准】
1. 线索数量是否在 3-4 条之间？
2. 每条线索是否都真实、可靠？（检查是否有意外混入的假线索）
3. 2-3 条线索组合后是否能明确推出 solution？
4. 是否有线索相互矛盾？
5. solution 是否过于复杂（不应该需要超过 3 条线索才能推出）？
6. 角色 alibi 是否与时间线一致？`,

  'thriller-mystery-validation-v1': `
【惊悚悬疑验证标准】
1. 线索数量是否在 5-7 条之间？
2. 假线索（redHerrings）是否至少有 2 条？它们是否确实指向错误答案？
3. 排除假线索后，真线索是否能唯一确定 solution？
4. 有隐藏任务的角色（hidden agenda）的 alibi 是否与真相一致？
5. 时间线是否有矛盾？（角色 A 说在 X，但线索显示在 Y）
6. solution 的动机是否合理？不是"因为他疯了"这种敷衍答案`,

  'romance-validation-v1': `
【浪漫爱情验证标准】
1. 线索是否是情感类的（信物、对话、巧合）而非犯罪类？
2. solution 是否是温馨/感动的，而不是惩罚性的？
3. 角色秘密是否关于"喜欢谁"或"想做什么"，而不是伤害性的？
4. 配对逻辑是否成立：线索 A 暗示 X 喜欢 Y，线索 B 暗示 Y 也喜欢 X？
5. 没有三角恋造成的痛苦剧情？
6. 结局 confessionMechanic 是否能自然引导到温馨收场？`,

  'absurd-comedy-validation-v1': `
【荒诞喜剧验证标准】
1. 谜底是否足够搞笑/离谱？（如果谜底太正经，不合格）
2. 自相矛盾的 alibi 是否有喜剧效果，而不是让人困惑？
3. 如果玩家认真推理，是否能"推出"一个离谱但一致的答案？
4. 没有真的伤害、犯罪、严肃后果？
5. 所有角色都能笑着收场？
6. 笑点是否跨文化友好？（避免需要特定文化背景才能懂的梗）`,
};

// ─── Validation Output Schema ─────────────────────────────────────────────────

const VALIDATION_OUTPUT_INSTRUCTIONS = `
请以下面 JSON 格式返回验证结果（仅此 JSON，不要 markdown）：
{
  "valid": true | false,
  "score": 0-100,
  "issues": [
    {
      "severity": "critical" | "warning" | "info",
      "field": "哪个字段有问题（如 clues[1].text）",
      "message": "具体问题描述",
      "suggestion": "如何修复"
    }
  ],
  "fixable": true | false, // 是否可以通过小修改修复
  "summary": "一句话总结验证结果"
}

评分标准：
- 90-100: 优秀，可以直接使用
- 70-89: 良好，有小问题但 playable
- 50-69: 及格，有明显问题需要修复
- 0-49: 不合格，建议重新生成

如果有 critical 问题，valid 必须为 false。
如果 fixable 为 true，说明 issues 中的 suggestion 可以指导修复。`;

// ─── Prompt Assembly ──────────────────────────────────────────────────────────

export interface MiniScriptValidationPromptParams {
  draftJson: string;
  config: MiniScriptGameModeConfig;
}

export function buildMiniScriptValidationPrompt(
  params: MiniScriptValidationPromptParams
): { system: string; user: string } {
  const criteria =
    GENRE_VALIDATION_CRITERIA[params.config.validationTemplateKey] ??
    GENRE_VALIDATION_CRITERIA['light-reasoning-validation-v1'];

  const userMessage =
    `请审查以下迷你剧本杀框架的逻辑一致性：\n\n` +
    '\`\`\`json\n' + params.draftJson + '\n\`\`\`' +
    `\n\n${criteria}\n\n` +
    `${VALIDATION_OUTPUT_INSTRUCTIONS}`;

  return {
    system: BASE_VALIDATION_SYSTEM,
    user: userMessage,
  };
}

// ─── Validation Result Types ──────────────────────────────────────────────────

export interface MiniScriptValidationIssue {
  severity: 'critical' | 'warning' | 'info';
  field: string;
  message: string;
  suggestion: string;
}

export interface MiniScriptValidationResult {
  valid: boolean;
  score: number;
  issues: MiniScriptValidationIssue[];
  fixable: boolean;
  summary: string;
}

export const miniScriptValidationResultSchema = {
  type: 'object',
  properties: {
    valid: { type: 'boolean' },
    score: { type: 'number', minimum: 0, maximum: 100 },
    issues: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          severity: { type: 'string', enum: ['critical', 'warning', 'info'] },
          field: { type: 'string' },
          message: { type: 'string' },
          suggestion: { type: 'string' },
        },
        required: ['severity', 'field', 'message', 'suggestion'],
      },
    },
    fixable: { type: 'boolean' },
    summary: { type: 'string' },
  },
  required: ['valid', 'score', 'issues', 'fixable', 'summary'],
} as const;
