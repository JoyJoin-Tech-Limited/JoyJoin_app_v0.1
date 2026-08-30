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
import { XIAOYUE_CRAFT_LITE } from '../prompts/craft';

export const MINISCRIPT_GENERATION_PROMPT_VERSION = 'miniscript-generate-v3.3';

// ─── Base System Prompt (all modes share) ─────────────────────────────────────

const NARRATIVE_GOLDEN_RULES = `
【叙事黄金法则 — 每幕必须遵守】

法则一：展示而非讲述
- 角色性格通过行动展现，不要直接描述"XX是一个聪明的人"。
- 用"他把线索纸片翻过来看了三遍，然后轻轻放下"取代"他观察很仔细"。
- sinHook是角色的行为缺陷，不是性格标签。写"嘴上逞强接了一个明知完不成的任务"而不是"他是一个逞强的人"。
- alibi要像一段能拍出来的闪回场景，不要写成时间线报告。

法则二：冲突驱动剧情
- 每幕必须有至少一个冲突点或转折：新线索打破旧推断 / 角色之间出现张力 / 某人做的事情改变了其他人的判断。
- 冲突不等于吵架。可以是：一个人说了不该说的话、一条线索让之前合理的解释崩塌、两个人发现对方都在隐瞒同一件事。
- 绝对禁止：所有人友好地坐在一起，按顺序交换信息。

法则三：悬念承上启下
- 每幕结束必须留一个悬念钩子（cliffhanger）——让玩家迫不及待想进下一幕。
- cliffhanger要具体：可以是一个新问题（"那把钥匙在哪"）、一个矛盾（"两个人说的都对，但不可能同时成立"）、一个意外（"第三个人突然承认了之前没说过的事"）。
- 最差的cliffhanger：空泛的"事情并没有那么简单..."
- cliffhanger不超过80字，一句致命的短句最好。`;

const BASE_SYSTEM =
  'You are JoyJoin MiniScript story framework writer. Reply with one JSON object only (no markdown). ' +
  'Rules: light social mystery, low conflict, no graphic violence, no death, no hate, no real-person names. ' +
  'All narrative strings in Chinese. ' +
  'User-facing strings (premise, title, roleLabel, clue text, voteOptions) must NEVER contain English words, ' +
  'snake_case machine keys, or enum tokens such as western_court / light_reasoning / absurd_comedy — Chinese only. ' +
  'The mystery must be solvable by players combining clues — this is a game, not just a story.\n\n' +
  NARRATIVE_GOLDEN_RULES + '\n\n' +
  XIAOYUE_CRAFT_LITE;

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
  "title": "剧本标题（≤12个汉字，有画面感，如「凡尔赛的胸针」）",
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
      "beats": ["流程节拍1", "流程节拍2"],
      "cliffhanger": "悬念钩子（最后一幕不需要，其他幕必须）——一句让玩家迫不及待想进下一幕的短句",
      "evidence": [
        {
          "id": "e1",
          "name": "证物名（≤8字，具体物件）",
          "description": "证物描述（≤60字，可当众朗读）",
          "iconKey": "物件图标名（如 信封/钥匙/手帕）",
          "evidenceReactions": {
            "1": "1号角色被出示该证物时的反应（30-60字）",
            "2": "2号角色的反应（30-60字）"
          }
        }
      ]
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
    "who": "谁做的/是谁（与某个 character.roleLabel 完全一致）",
    "what": "做了什么/真相是什么",
    "why": "动机/原因",
    "whoSlot": "1-based index of that character in the characters array (1..N)"
  },
  "voteOptions": {
    "what": ["3-4个投票选项，每个≤12字，如「借走忘了还」「只是误会一场」"],
    "why": ["3-4个动机选项，每个≤12字，如「善意」「胆怯」「好面子」"]
  },
  "motiveOptions": ["3-4个动机候选句（每个≤20字），其中一个与 solution.why 语义一致，其余为合理干扰项；不要标注哪个正确"],
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
- title is required: ≤12 Chinese characters, evocative, no English
- clue text must NOT carry self-numbering prefixes like 「线索 1：」— the client adds ordinals itself
- voteOptions.what / voteOptions.why: 3-4 short Chinese chip labels each (≤12 chars per label), consistent with the solution
 - solution.whoSlot must be the 1-based index of solution.who inside the characters array; if omitted it will be inferred, but always include it
 - evidence: 每幕 0-2 件证物；evidenceReactions 必须覆盖每个角色（键为 1..N 的角色序号字符串）；每条反应目标 30-60 字、硬上限 120 字
 - 反应文本是被出示时的当场反应：不得确认或排除当事人、不得直接或间接泄露 solution（who/what/why）
 - motiveOptions: 3-4 个动机候选（每个≤20字）；干扰项必须合理但不得蕴含真动机；选项内不得出现「正确」「答案」等标记
 - Every act EXCEPT the last one must have a cliffhanger (≤80 chars, one hooking sentence). Last act has no cliffhanger — ending does its job.
- Each act must show at least one character acting on their sinHook (展示不是讲述)
- Each act must contain at least one moment of conflict or a plot turn (not just info exchange)
- All strings in Chinese — never emit English enum tokens (style/genre machine keys) in any user-facing string
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
  selectedLabel?: string;
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

  // Feed the model Chinese genre labels, not machine keys — whatever the
  // prompt shows in English risks being echoed back into user-facing strings.
  const genreLabels: Record<MiniScriptGenre, string> = {
    light_reasoning: '轻推理',
    thriller_mystery: '惊悚悬疑',
    romance: '浪漫爱情',
    absurd_comedy: '荒诞喜剧',
  };

  const liteModifier = params.lite
    ? '\n【精简模式】\n- 总共只生成2幕（act_flow长度为2）\n- 每幕只揭示1条关键线索\n- 角色秘密要简单直接，不要多层嵌套\n- 总游戏时长控制在25分钟以内\n- 投票只进行一轮，简单多数胜出\n'
    : '';

  const contextBlock = params.sessionContext?.mixText
    ? `\n【本组画像】${params.sessionContext.mixText}\n`
    : '';

  const selectedLabelBlock = params.selectedLabel
    ? `\n【主持人已选标签】${params.selectedLabel}\n`
    : '';

  const userMessage =
    `为一场${styleLabels[params.style]}风格的迷你剧本杀生成故事框架。\n\n` +
    `玩家数量：${params.playerCount}人\n` +
    `题材：${params.genres.map((genre) => genreLabels[genre]).join('、')}\n` +
    `${liteModifier}\n` +
    `${genreInstructions}\n\n` +
    `${buildJsonShapeInstructions(params.playerCount, params.config)}` +
    `${selectedLabelBlock}` +
    `${contextBlock}`;

  return {
    system: BASE_SYSTEM,
    user: userMessage,
  };
}

// ─── Re-export for downstream ─────────────────────────────────────────────────
// MINISCRIPT_GENERATION_PROMPT_VERSION is already exported at module top
