/**
 * MiniScript Genre-Aware Prompt Templates
 *
 * Each game mode has a generation prompt (Pass 1) that instructs the AI
 * to produce mechanically appropriate mystery content. Prompts are
 * assembled by key — the agent selects the template based on merged
 * genre config.
 */

import type { MiniScriptGameModeConfig } from '@shared/miniscriptGameModes';
import type { MiniScriptStyle, MiniScriptGenre } from '@shared/miniscriptStoryFramework';

export const MINISCRIPT_GENERATION_PROMPT_VERSION = 'miniscript-generate-v2.0';

// ─── Base System Prompt (all modes share) ─────────────────────────────────────

const BASE_SYSTEM =
  'You are JoyJoin MiniScript story framework writer. Reply with one JSON object only (no markdown). ' +
  'Rules: light social mystery, low conflict, no graphic violence, no death, no hate, no real-person names. ' +
  'All narrative strings in Chinese. ' +
  'The mystery must be solvable by players combining clues — this is a game, not just a story.';

// ─── Genre-Specific Generation Instructions ───────────────────────────────────

const GENRE_GENERATION_INSTRUCTIONS: Record<
  MiniScriptGameModeConfig['promptTemplateKey'],
  string
> = {
  'light-reasoning-v1': `
【轻推理模式】
- 生成 3-4 条清晰线索，分布在 2-3 幕中
- 每条线索必须指向谜底的一部分（谁/做了什么/为什么）
- 没有假线索（red herrings）—— 所有线索都是真的
- 谜底应该显而易见：2-3 条线索组合后就能推出答案
- 角色没有隐藏任务，所有人合作解谜
- 难度：小学生都能看懂`,

  'thriller-mystery-v1': `
【惊悚悬疑模式】
- 生成 5-7 条线索，分布在 3-4 幕中
- 包含 2-3 条假线索（red herrings），看似指向错误答案
- 至少 1 个角色有隐藏任务（hidden agenda），TA在暗中误导
- 谜底需要排除假线索后才能推出
- 角色之间有互相怀疑的张力
- 投票方式：每人指控一个"最可疑"的角色`,

  'romance-v1': `
【浪漫爱情模式】
- 生成 3-5 条情感线索（信物、对话、巧合）
- 谜底不是"谁犯了错"，而是"谁暗恋谁"或"谁想表白"
- 角色有秘密心事，但没有恶人
- 结局是温馨、感动的，不是惩罚性的
- 玩家通过配对角色来"赢"——找到互相喜欢的人
- 禁止：三角恋造成伤害、背叛、分手剧情`,

  'absurd-comedy-v1': `
【荒诞喜剧模式】
- 生成 2-4 条离谱线索（越不合理越好）
- 可以有不合逻辑的假线索，但要有喜剧效果
- 谜底应该是搞笑的：比如"凶手是那只猫"、"合同被风吹走了"
- 角色alibi可以自相矛盾，但要好笑不要让人困惑
- 没有胜负，目标是让大家笑
- 禁止：真的伤害、严肃推理、复杂逻辑`,
};

// ─── JSON Shape Instructions (all modes share) ────────────────────────────────

function buildJsonShapeInstructions(
  playerCount: number,
  config: MiniScriptGameModeConfig
): string {
  const clueMin = config.clueCountRange[0];
  const clueMax = config.clueCountRange[1];

  return `
JSON shape:
{
  "schemaVersion": 2,
  "style": "${config.genreKeys[0]}风格名称",
  "genres": [${config.genreKeys.map((g) => `"${g}"`).join(', ')}],
  "gameModeConfig": {
    "clueCountRange": [${clueMin}, ${clueMax}],
    "hasRedHerrings": ${config.hasRedHerrings},
    "hasHiddenAgendas": ${config.hasHiddenAgendas},
    "votingStyle": "${config.votingStyle}",
    "winCondition": "${config.winCondition}",
    "targetPlayMinutes": ${config.targetPlayMinutes},
    "difficulty": "${config.difficulty}"
  },
  "premise": "场景设定（1-2句）",
  "characters": [
    {
      "slotIndex": 0..${playerCount - 1},
      "roleLabel": "角色名",
      "sinHook": "一个无伤大雅的小麻烦",
      "alibi": "当时在哪（表面说法）",
      "secret": "隐藏的秘密"
    }
  ],
  "act_flow": [
    {
      "actNumber": 1..4,
      "title": "幕标题",
      "beats": ["流程节拍1", "流程节拍2"]
    }
  ],
  "ending": {
    "resolutionSummary": "真相总结（温暖/有趣/不锋利）",
    "confessionMechanic": "主持人如何引导收尾"
  },
  "clues": [
    {
      "clueId": "c1",
      "text": "线索描述（玩家会看到）",
      "revealedInAct": 1..4,
      "implies": ["c2"] // 这条线索暗示了哪些其他线索
    }
  ],
  "solution": {
    "who": "谁做的/是谁",
    "what": "做了什么/真相是什么",
    "why": "动机/原因"
  },
  "playerKnowledge": [
    {
      "slotIndex": 0..${playerCount - 1},
      "knownFacts": ["这个角色从一开始就知道的事"],
      "secretAgenda": "这个角色想隐藏的秘密",
      "truthfulAlibi": "真实的去向（可能与表面alibi不同）"
    }
  ],
  ${config.hasRedHerrings ? `"redHerrings": [
    {
      "text": "假线索描述",
      "misleadingTarget": "这条假线索想让人怀疑谁"
    }
  ],` : ''}
  "deductionChain": [
    {
      "stepNumber": 1,
      "fromClues": ["c1", "c2"],
      "conclusion": "从这两条线索可以推出什么"
    }
  ]
}

Strict rules:
- Output exactly ${playerCount} characters and exactly ${playerCount} playerKnowledge entries
- clueIds must be unique (c1, c2, ...)
- implies[] references must be valid clueIds
- All strings in Chinese
- No markdown fences, no commentary before or after JSON`;
}

// ─── Prompt Assembly ──────────────────────────────────────────────────────────

export interface MiniScriptGenerationPromptParams {
  playerCount: number;
  style: MiniScriptStyle;
  genres: MiniScriptGenre[];
  config: MiniScriptGameModeConfig;
  lite?: boolean;
  sessionContext?: { mixText: string };
}

export function buildMiniScriptGenerationPrompt(
  params: MiniScriptGenerationPromptParams
): { system: string; user: string } {
  const genreInstructions =
    GENRE_GENERATION_INSTRUCTIONS[params.config.promptTemplateKey] ??
    GENRE_GENERATION_INSTRUCTIONS['light-reasoning-v1'];

  const styleLabels: Record<MiniScriptStyle, string> = {
    western_court: '西欧宫廷',
    medieval: '中世纪',
    ancient_chinese: '古风',
    xianxia: '仙侠',
    future_tech: '未来科技',
    modern_urban: '现代都市',
    republican_era: '民国',
  };

  const liteModifier = params.lite
    ? '\n【精简模式】\n- 总共只生成2幕（act_flow长度为2）\n- 每幕只揭示1条关键线索\n- 角色秘密要简单直接，不要多层嵌套\n- 总游戏时长控制在25分钟以内\n- 投票只进行一轮，简单多数胜出\n'
    : '';

  const contextBlock = params.sessionContext?.mixText
    ? `\n【本组画像】${params.sessionContext.mixText}\n`
    : '';

  const userMessage =
    `为一场${styleLabels[params.style]}风格的迷你剧本杀生成故事框架。\n\n` +
    `玩家数量：${params.playerCount}人\n` +
    `题材：${params.genres.join('、')}\n` +
    `${liteModifier}\n` +
    `${genreInstructions}\n\n` +
    `${buildJsonShapeInstructions(params.playerCount, params.config)}` +
    `${contextBlock}`;

  return {
    system: BASE_SYSTEM,
    user: userMessage,
  };
}

// ─── Re-export for downstream ─────────────────────────────────────────────────
// MINISCRIPT_GENERATION_PROMPT_VERSION is already exported at module top
