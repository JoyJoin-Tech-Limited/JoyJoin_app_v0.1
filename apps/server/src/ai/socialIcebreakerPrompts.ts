/**
 * Social Icebreaker prompt builders
 *
 * Pure functions that construct the exact prompts sent to LLMs for social
 * icebreaker content generation.  Kept in a separate module so that:
 *   1. The AI service file stays focused on orchestration (client calls,
 *      fallback handling, tracing).
 *   2. Benchmark and evaluation harnesses can import the same prompts without
 *      duplicating text and risking drift.
 *
 * All functions are side-effect free and return strings (or arrays of message
 * params for special cases like MiniScript).
 */

import { z } from 'zod';
import type { AtmosphereMood } from '@shared/socialIcebreaker';
import type { SessionArchetypeContext } from '../lib/contextInjector';
import type { MiniScriptGenre, MiniScriptStyle } from '@shared/miniscriptStoryFramework';

export const XIAOYUE_COMMENT_PROMPT_VERSION = 'social-xiaoyue-comment-v2';
export const WARMUP_TOPICS_PROMPT_VERSION = 'social-warmup-topics-v2';
export const WARMUP_TOPICS_V3_PROMPT_VERSION = 'social-warmup-topics-v3';
export const MICRO_CHALLENGES_PROMPT_VERSION = 'social-micro-challenges-v2';
export const LIE_DETECTIVE_PROMPT_VERSION = 'social-lie-detective-v1';
export const LIE_DETECTIVE_V2_PROMPT_VERSION = 'social-lie-detective-v2';
export const RECAP_SUMMARY_PROMPT_VERSION = 'social-recap-summary-v3';
export const PERSONALITY_DICE_PROMPT_VERSION = 'social-personality-dice-v3';
export const PERSONALITY_DICE_CHOOSE_PROMPT_VERSION = 'social-personality-dice-v4';
export const AUCTION_LOTS_PROMPT_VERSION = 'social-auction-lots-v2';
export const MINI_SCRIPT_FRAMEWORK_PROMPT_VERSION = 'social-miniscript-framework-v1';
export const SESSION_PACK_PROMPT_VERSION = 'social-session-pack-v2';

// ─── Warmup Topics ───────────────────────────────────────────────────────────

function mapVibeToDisplayVibe(vibe: 'chat' | 'balanced' | 'game' | undefined): string {
  switch (vibe) {
    case 'chat': return '深聊';
    case 'game': return '暢玩';
    case 'balanced':
    default: return '均衡';
  }
}

export function buildWarmupTopicsPrompt(params: {
  eventType: string;
  participantCount: number;
  mood: AtmosphereMood;
  avoidTopics?: string[];
  _refinementHint?: string;
  sessionContext?: SessionArchetypeContext;
  /** Vibe drives card count, depth curve, and tier generation. */
  vibe?: 'chat' | 'balanced' | 'game';
}): string {
  const moodMap: Record<AtmosphereMood, string> = {
    relaxed: '轻松',
    funny: '搞笑',
    life: '生活',
    emotional: '情感',
  };

  const resolvedVibe = params.vibe ?? 'balanced';
  const vibeDisplay = mapVibeToDisplayVibe(resolvedVibe);

  // Per-vibe config
  const vibeConfig = {
    chat: {
      cardCount: '6-7',
      depthCurve: '1个 Level 1 轻松开场、3-4个 Level 2 体验分享、2个 Level 3 温和反思',
      styleNote: '每个话题必须包含三级提示（promptTiers）：\n  * opener：30秒 warm entry 引导语（≤15字）\n  * followUp：60秒 deeper probe 追问（≤20字）\n  * reflection：90秒 meaningful closure 反思引导（≤25字）',
      jsonShape: '{"id":"ai1","question":"话题文本","mood":"life","emoji":"相关emoji","category":"话题类别","depthLevel":2,"promptStyle":"experiential","safety":"gentle","promptTiers":{"opener":"...","followUp":"...","reflection":"..."}}',
    },
    balanced: {
      cardCount: '5',
      depthCurve: '至少2个 Level 1 轻松开场、2个 Level 2 体验分享、1个 Level 3 温和反思',
      styleNote: '每个话题一个简短引导即可',
      jsonShape: '{"id":"ai1","question":"话题文本","mood":"relaxed","emoji":"相关emoji","category":"话题类别","depthLevel":1,"promptStyle":"binary","safety":"gentle"}',
    },
    game: {
      cardCount: '4',
      depthCurve: '2个 Level 1 轻松开场、2个 Level 2 体验分享',
      styleNote: '快速暖场风格，每个话题一个简短引导，节奏轻快',
      jsonShape: '{"id":"ai1","question":"话题文本","mood":"funny","emoji":"相关emoji","category":"话题类别","depthLevel":1,"promptStyle":"binary","safety":"gentle"}',
    },
  }[resolvedVibe];

  return `你是JoyJoin的社交破冰专家。请为一个${params.eventType}活动（${params.participantCount}人，氛围：${vibeDisplay}）生成${vibeConfig.cardCount}个${moodMap[params.mood]}类型的破冰话题。

语气要求（活人感）：
- 像朋友间随口一问，不要像面试题或问卷调查
- 善用语气词：啦、嘛、呢、吧、咯，让问题有呼吸感
- 可以偶尔自嘲或带点小吐槽（"虽然有点老套但..."）
- 句子长短错落，不要全是工整的排比
- 当代网络用语每5条最多用1个，要自然不突兀（如：绝了、拿捏、整活、u1s1、栓Q、真香、破防）
- 禁止：客服腔、过度热情（"哇！""嘻嘻"）、AI味开场（"让我们一起..."）

内容要求：
- 话题深度形成曲线：${vibeConfig.depthCurve}
- 适合初次见面，不查户口、不逼问隐私
- 每个话题一句话，不超过30字
${vibeConfig.styleNote ? `- ${vibeConfig.styleNote}` : ''}
${params.avoidTopics?.length ? `- 避免以下话题：${params.avoidTopics.join('、')}` : ''}

请以JSON格式返回：
[${vibeConfig.jsonShape}]

${params.sessionContext?.mixText ? `

【本组画像】${params.sessionContext.mixText}` : ''}

直接返回JSON数组，不要其他内容。${params._refinementHint ? `

【改进建议】${params._refinementHint}` : ''}`;
}

// ─── Micro Challenges ────────────────────────────────────────────────────────

export function buildMicroChallengesPrompt(params: {
  eventType: string;
  participantCount: number;
  _refinementHint?: string;
  sessionContext?: SessionArchetypeContext;
}): string {
  return `你是JoyJoin的社交破冰专家。请为一个${params.eventType}活动（${params.participantCount}人）生成3个有趣的微挑战。

语气要求（活人感）：
- 像朋友提议玩个小游戏，不要像团建教官发号施令
- 标题可以俏皮一点，带点梗或双关
- description里可以用语气词（"来，大家试试这个...""反正就两分钟，玩玩看咯"）
-  completionCTA要像玩家会喊的口号，不是公文按钮
- 当代网络用语每3条最多用1个，自然融入（如：拿捏、整活、绝了、真香）
- 禁止："请各组派代表""请各位同学"等团建/课堂口吻

内容要求：
- 简单易执行，2-5分钟内可完成
- 适合坐着进行，不需要太多空间
- 有趣且能促进互动，不搞尴尬惩罚

请以JSON格式返回：
[{"id":"ai_c1","title":"挑战名称","description":"详细描述","durationSeconds":120,"completionCTA":"完成按钮文字","visualHint":"2-3个相关emoji"}]

${params.sessionContext?.mixText ? `

【本组画像】${params.sessionContext.mixText}` : ''}

直接返回JSON数组，不要其他内容。${params._refinementHint ? `

【改进建议】${params._refinementHint}` : ''}`;
}

// ─── Lie Detective V1 (legacy — AI generates all 3) ──────────────────────────

export function buildLieDetectivePrompt(params: {
  displayName: string;
  archetype?: string;
  interests?: string[];
  _refinementHint?: string;
}): string {
  const context = [
    params.archetype ? `性格类型：${params.archetype}` : '',
    params.interests?.length ? `兴趣爱好：${params.interests.slice(0, 3).join('、')}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return `你是社交破冰专家悦仔。请为"${params.displayName}"生成"两真一假"游戏的3个陈述句。
${context ? `关于这个人的信息：\n${context}` : ''}

要求：
- 3个陈述中，2个是可能为真的，1个是假的
- 陈述要有趣且令人难以判断真假
- 每句不超过20字
- 要有一定的个人特色

请以JSON格式返回，并标注哪个是假的：
[{"index":1,"text":"陈述文本","isLie":false},{"index":2,"text":"陈述文本","isLie":true},{"index":3,"text":"陈述文本","isLie":false}]

直接返回JSON数组，确保只有一个isLie为true。`;
}

// ─── Lie Detective V2 (tag-based — user writes 2 tags, AI expands + fakes 1) ─

/**
 * Zod schema for a single Lie Detective V2 statement.
 */
export const LieDetectiveV2StatementSchema = z.object({
  index: z.number().int().min(1).max(3),
  text: z.string().max(30),
  is_ai: z.boolean(),
  source_tag: z.string().nullable().optional(),
});

/**
 * Zod schema for the complete Lie Detective V2 AI response.
 *
 * Validation rules enforced:
 *   - Exactly 3 items in the array
 *   - Exactly 1 item has `is_ai: true`
 *   - All `index` values are unique (1–3)
 *   - `text` is a string ≤ 30 characters
 *   - `source_tag` is string | null | undefined
 */
export const LieDetectiveV2ResponseSchema = z
  .array(LieDetectiveV2StatementSchema)
  .length(3)
  .refine((items) => items.filter((i) => i.is_ai).length === 1, {
    message: 'Exactly one statement must have is_ai=true',
  })
  .refine((items) => new Set(items.map((i) => i.index)).size === 3, {
    message: 'All index values must be unique',
  });

export type LieDetectiveV2Statement = z.infer<typeof LieDetectiveV2StatementSchema>;

/**
 * Build the Lie Detective V2 prompt.
 *
 * Input contract:
 * @param displayName - Player's display name (shown in prompt context)
 * @param tags        - Exactly 2 user-written tags, 2–20 chars each
 * @param archetype   - Optional archetype (e.g. "开心柯基") to influence tone/style
 * @param difficulty  - 'easy' | 'medium' | 'hard' — controls how convincing the fake is
 *
 * Expected AI output (JSON array of 3 objects):
 *   [
 *     { index: 1, text: "≤30字陈述", is_ai: false, source_tag: "tag1" },
 *     { index: 2, text: "≤30字陈述", is_ai: false, source_tag: "tag2" },
 *     { index: 3, text: "≤30字陈述", is_ai: true,  source_tag: null   }
 *   ]
 *
 * Validation rules:
 *   - Exactly 3 items
 *   - Exactly 1 item has `is_ai: true`
 *   - No duplicate `index` values
 *   - `text` ≤ 30 characters
 *   - `source_tag` must match the original tag when `is_ai: false`
 *
 * Fallback / degrade guidance for Backend Engineer:
 *   1. Parse raw LLM response → attempt `JSON.parse`.
 *   2. Validate with `LieDetectiveV2ResponseSchema.safeParse(parsed)`.
 *   3. If validation fails OR `is_ai` count ≠ 1:
 *        - Log `fallbackUsed: true` with reason `parse_error` or `validation_error`.
 *        - Do NOT surface malformed V2 data to clients.
 *        - Fall back to V1 flow: call the existing `generateLieDetectiveStatements()` (V1).
 *   4. If V1 also fails, use deterministic fallback statements
 *      (`getRandomFallbackStatements()` in `socialIcebreakerAIService.ts`).
 *   5. Never return partial / invalid V2 arrays to the game state.
 */
export function buildLieDetectiveV2Prompt(params: {
  displayName: string;
  tags: [string, string];
  archetype?: string;
  difficulty: 'easy' | 'medium' | 'hard';
}): string {
  const difficultyGuide: Record<typeof params.difficulty, string> = {
    easy: 'AI生成的假陈述要有轻微破绽（比如用词稍正式、细节稍夸张），让细心玩家能察觉。',
    medium: 'AI生成的假陈述要足够自然，与玩家自己写的风格接近，真假难辨。',
    hard: 'AI生成的假陈述必须非常逼真，几乎无法与玩家自己写的区分，甚至要模仿该玩家的口吻和细节密度。',
  };

  const context = [params.archetype ? `性格类型：${params.archetype}` : ''].filter(Boolean).join('\n');

  return `你是社交破冰专家悦仔。现在要进行V2版"找出AI"游戏。

玩家"${params.displayName}"写了2个关于自己的标签，你的任务是：
1. 把标签1扩展成一句自然、口语化的个人陈述
2. 把标签2扩展成一句自然、口语化的个人陈述
3. 再额外生成1条"AI假陈述"——这条必须看起来也像是玩家自己写的

游戏规则变了：大家不再猜"哪句是谎言"，而是猜"哪句是AI生成的"。
${context ? `\n关于这个人的信息：\n${context}` : ''}

难度设定：${difficultyGuide[params.difficulty]}

要求：
- 3条陈述都必须像玩家亲口说的，口语化、有画面感
- 扩展时要保留原标签的核心信息，不能偏离原意
- AI假陈述必须融入整体风格，不能突兀
- 每条不超过30字
- 禁止：过度书面语、AI腔（"作为一个..."）、过度热情（"哇！""嘻嘻"）

输入标签：
- 标签1：${params.tags[0]}
- 标签2：${params.tags[1]}

示例（难度medium，标签为"爱爬山"和"怕蟑螂"）：
[{"index":1,"text":"我每周末都往山里跑，觉得山顶的风比空调舒服","is_ai":false,"source_tag":"爱爬山"},{"index":2,"text":"看见蟑螂我会先僵住三秒，然后才想起来要跑","is_ai":false,"source_tag":"怕蟑螂"},{"index":3,"text":"有次爬山遇到暴雨，我在山洞里躲了两个小时才下来","is_ai":true,"source_tag":null}]

请以JSON格式返回，不要markdown代码块：
[{"index":1,"text":"陈述文本","is_ai":false,"source_tag":"${params.tags[0]}"},{"index":2,"text":"陈述文本","is_ai":false,"source_tag":"${params.tags[1]}"},{"index":3,"text":"陈述文本","is_ai":true,"source_tag":null}]`;
}

// ─── XiaoYue Comment (facilitator) ───────────────────────────────────────────

export function buildXiaoYueCommentPrompt(params: {
  phase: string;
  event: string;
  context?: string;
  playerCount?: number;
  participants?: Array<{ displayName: string; archetype?: string | null; profile?: { archetype?: string | null; industryLabel?: string | null; age?: number | null; city?: string | null; stateLabel?: string | null; gender?: string | null; educationLevel?: string | null; lifeStage?: string | null; bio?: string | null } | null }>;
}): string {
  const sizeHint = params.playerCount
    ? params.playerCount <= 4
      ? `（${params.playerCount}人小局，语气亲密一点，每个人的参与感都很重要）`
      : `（${params.playerCount}人局，节奏可以稍快，但仍要给每个人开口的机会）`
    : '';

  let participantHint = '';
  if (params.participants && params.participants.length > 0) {
    const lines: string[] = [];
    for (const p of params.participants) {
      const pf = p.profile;
      const parts: string[] = [p.displayName];
      if (p.archetype) parts.push(p.archetype);
      if (pf) {
        if (pf.industryLabel) parts.push(pf.industryLabel);
        if (pf.age) parts.push(`${pf.age}岁`);
        if (pf.city) parts.push(pf.city);
        if (pf.stateLabel) parts.push(pf.stateLabel);
        if (pf.gender && pf.gender !== '不透露') parts.push(pf.gender);
        if (pf.educationLevel) parts.push(pf.educationLevel);
        if (pf.lifeStage) parts.push(pf.lifeStage);
        if (pf.bio) parts.push(`"${pf.bio}"`);
      }
      lines.push(parts.join('，'));
    }
    participantHint = `\n本局参与者快照（你对他们已知的了解——仅来自他们的自述档案，不是实时看到的）：\n${lines.map(l => `- ${l}`).join('\n')}\n\n数据真实性原则：你只能引用他们档案里写的东西，以及本局的游戏状态数据。你无法实时看到或听到他们。不要把档案里的特征假装成你正在观察的行为——说"你的资料显示你笑点低"而不是"我看见你笑了"。`;
  }

  return `你是JoyJoin的社交破冰主持人。请为以下场景生成一句简短的主持评语（20-30字）：
- 当前阶段：${params.phase}
- 触发事件：${params.event}
${params.context ? `- 上下文：${params.context}` : ''}
${sizeHint}${participantHint}

语气要求（活人感）：
- 像最会把聊天节奏带舒服的那个声音，不是官方主持人
- 短句为主，偶尔抛个梗或调侃
- 善用语气词：啦、嘛、呢、吧
- 可以自黑或吐槽（"好吧，这个环节我也没想到会这样"）
- emoji最多1个，不要堆砌
- 当代网络用语偶尔用（如：绝了、拿捏、整活、栓Q），但一条评语最多1个
- 禁止："让我们一起...""恭喜大家..."等AI/团建腔

直接返回评语文本，不要其他内容。`;
}

// ─── Recap Summary ───────────────────────────────────────────────────────────

export function buildRecapSummaryPrompt(params: {
  participants: Array<{ displayName: string; archetype?: string }>;
  topicsDiscussed: string[];
  challengesCompleted: number;
  commonGroundCount: number;
  lieDetectiveHighlights?: string[];
  personalityDiceRecapLines?: string[];
  miniScriptRecapLine?: string;
  auctionRecapLines?: string[];
  durationMinutes: number;
  sessionContext?: SessionArchetypeContext;
}): string {
  const diceBlock =
    params.personalityDiceRecapLines?.length
      ? `人格骰子亮点：${params.personalityDiceRecapLines.join('；')}`
      : '';
  const miniBlock = params.miniScriptRecapLine ? `迷你剧本杀：${params.miniScriptRecapLine}` : '';
  const auctionBlock =
    params.auctionRecapLines?.length ? `拍卖环节：${params.auctionRecapLines.join('；')}` : '';

  return `你是JoyJoin的社交破冰主持人。请为今晚的活动生成一个总结。

参与者：${params.participants.map((p) => p.displayName).join('、')}
讨论话题数：${params.topicsDiscussed.length}
完成挑战数：${params.challengesCompleted}
发现共同点：${params.commonGroundCount}
活动时长：${params.durationMinutes}分钟
${params.lieDetectiveHighlights?.length ? `谎言侦探亮点：${params.lieDetectiveHighlights.join('、')}` : ''}
${diceBlock}
${miniBlock}
${auctionBlock}

语气要求（活人感）：
- headline像朋友发朋友圈的文案，不是新闻标题
- moments具体、有画面感，避免"大家都很积极"这种空话
- closingLine温暖但不过度煽情，可以留个小钩子（"下次继续""这局算你们赢"）
- 善用语气词和口语化表达
- 当代网络用语整段最多用1个（如：绝了、拿捏、整活、真香、破防）
- 禁止："本次活动圆满成功""感谢各位的积极参与"等公文腔

请以JSON格式返回：
{
  "headline": "一句话总结（15字内）",
  "moments": ["精彩瞬间1", "精彩瞬间2", "精彩瞬间3"],
  "closingLine": "温馨结束语（20-30字）"
}

${params.sessionContext?.mixText ? `【本组画像】${params.sessionContext.mixText}

` : ''}直接返回JSON，不要其他内容。`;
}

// ─── Personality Dice ────────────────────────────────────────────────────────

export function buildPersonalityDicePrompt(params: {
  participants: Array<{
    displayName: string;
    archetype?: string;
    dominantTrait: string;
  }>;
  _refinementHint?: string;
  sessionContext?: SessionArchetypeContext;
}): string {
  const participantList = params.participants.map((p) => ({
    displayName: p.displayName,
    archetype: p.archetype || '未知',
    dominantTrait: p.dominantTrait,
  }));

  return `你是JoyJoin的社交破冰专家。请为以下参与者各生成一个个性化挑战：

${JSON.stringify(participantList, null, 2)}

核心规则（Archetype-Aware v2）：
- 每个人的挑战必须结合ta的archetype（原型）特征，让ta感到"这说的就是我"
- 参考原型风格：
  * 社牛柯基 → 热场、破冰、带动气氛类挑战
  * 小太阳鸡 → 温暖、鼓励、正面能量类挑战
  * 夸夸仓鼠 → 夸奖、鼓励、发现别人优点类挑战
  * 寻宝狐 → 观察、推理、发现细节类挑战
  * 机灵海豚 → 感知气氛、调节节奏、平衡类挑战
  * 人脉蛛 → 连接他人、发现关系、织网类挑战
  * 树洞考拉 → 倾听、分享、温柔互动类挑战
  * 脑洞章鱼 → 创意、无厘头、脑洞类挑战
  * 好奇猫头鹰 → 深度提问、观察、思考类挑战
  * 靠谱大象 → 稳定、记忆、可靠类挑战
  * 慢热龟 → 慢节奏、深度、反思类挑战
  * 小透明猫 → 优雅、观察、低调互动类挑战

语气要求（活人感）：
- challengeTitle像朋友起的绰号或玩笑，不要太正经
- challengeBody像当面提出来的小捉弄，带语气词（"来，给大家表演一下...""敢不敢试试..."）
- 可以结合该人特质和原型调侃，但要善意不冒犯
- 当代网络用语每人最多用1个（如：拿捏、整活、绝了、真香）
- 禁止："请该同学完成以下任务"等课堂/团建腔

内容要求：
- 基于该人的人格原型(archetype)和主导特质(dominantTrait)
- 适合当场执行（1-2分钟内）
- 有趣但不尴尬，不搞惩罚
- 每个人都要有不同的挑战，不能重复
- 每个挑战必须包含一个「认怂选项」(passLine)和一个「认怂后果」(passConsequence)：
  * passLine：一句轻松的opt-out台词，比如"我选择认怂"、"这题我不会"（≤15字）
  * passConsequence：一个搞笑但无害的小后果，比如"请用三种语气说'我真棒'"、"模仿一种动物叫三声"（≤20字）

请以JSON数组返回（顺序与输入一致）：
[{"challengeTitle":"挑战名称","challengeBody":"挑战说明（30字内）","challengeEmoji":"1个emoji","difficulty":"easy|medium|hard","passLine":"认怂台词","passConsequence":"认怂后果"}]

直接返回JSON数组，不要其他内容。${params._refinementHint ? `

【改进建议】${params._refinementHint}` : ''}`;
}

// ─── Personality Dice V4 (Choose-Your-Prompt) ─────────────────────────────

export function buildPersonalityDicePromptV4(params: {
  participants: Array<{
    displayName: string;
    archetype?: string;
    dominantTrait: string;
  }>;
  _refinementHint?: string;
  sessionContext?: SessionArchetypeContext;
}): string {
  const participantList = params.participants.map((p) => ({
    displayName: p.displayName,
    archetype: p.archetype || '未知',
    dominantTrait: p.dominantTrait,
  }));

  return `你是JoyJoin的社交破冰专家。请为以下每位参与者各生成3个不同难度的个性化挑战：

${JSON.stringify(participantList, null, 2)}

核心规则（Choose-Your-Prompt V4）：
- 每人3个挑战：easy（轻松入门）、medium（中等难度）、hard（高能挑战）
- 每个人的挑战必须结合ta的archetype（原型）特征，让ta感到"这说的就是我"
- 三个难度要有明显的递进关系：easy让人轻松上手，medium需要一点勇气，hard需要真正投入
- 参考原型风格：
  * 社牛柯基 → 热场、破冰、带动气氛类挑战
  * 小太阳鸡 → 温暖、鼓励、正面能量类挑战
  * 夸夸仓鼠 → 夸奖、鼓励、发现别人优点类挑战
  * 寻宝狐 → 观察、推理、发现细节类挑战
  * 机灵海豚 → 感知气氛、调节节奏、平衡类挑战
  * 人脉蛛 → 连接他人、发现关系、织网类挑战
  * 树洞考拉 → 倾听、分享、温柔互动类挑战
  * 脑洞章鱼 → 创意、无厘头、脑洞类挑战
  * 好奇猫头鹰 → 深度提问、观察、思考类挑战
  * 靠谱大象 → 稳定、记忆、可靠类挑战
  * 慢热龟 → 慢节奏、深度、反思类挑战
  * 小透明猫 → 优雅、观察、低调互动类挑战

语气要求（活人感）：
- challengeTitle像朋友起的绰号或玩笑，不要太正经
- challengeBody像当面提出来的小捉弄，带语气词（"来，给大家表演一下...""敢不敢试试..."）
- 可以结合该人特质和原型调侃，但要善意不冒犯
- 当代网络用语每人最多用1个（如：拿捏、整活、绝了、真香）
- 禁止："请该同学完成以下任务"等课堂/团建腔

内容要求：
- 基于该人的人格原型(archetype)和主导特质(dominantTrait)
- 适合当场执行（1-2分钟内）
- 有趣但不尴尬，不搞惩罚
- 每个人3个选项不能重复主题
- 每个挑战必须包含一个「认怂选项」(passLine)和一个「认怂后果」(passConsequence)：
  * passLine：一句轻松的opt-out台词，比如"我选择认怂"、"这题我不会"（≤15字）
  * passConsequence：一个搞笑但无害的小后果，比如"请用三种语气说'我真棒'"、"模仿一种动物叫三声"（≤20字）

输出格式（二维JSON数组 — 外层每人一个子数组，内层3个难度选项，共N个人×3个挑战）：
[
  [
    {"challengeTitle":"挑战名称","challengeBody":"挑战说明（30字内）","challengeEmoji":"1个emoji","difficulty":"easy","passLine":"认怂台词","passConsequence":"认怂后果"},
    {"challengeTitle":"挑战名称","challengeBody":"挑战说明（30字内）","challengeEmoji":"1个emoji","difficulty":"medium","passLine":"认怂台词","passConsequence":"认怂后果"},
    {"challengeTitle":"挑战名称","challengeBody":"挑战说明（30字内）","challengeEmoji":"1个emoji","difficulty":"hard","passLine":"认怂台词","passConsequence":"认怂后果"}
  ],
  ...
]

难度标记顺序必须为 easy / medium / hard，不得颠倒。
直接返回JSON二维数组，不要其他内容。${params._refinementHint ? `

【改进建议】${params._refinementHint}` : ''}`;
}

// ─── Auction Lots ────────────────────────────────────────────────────────────

export function buildAuctionLotsPrompt(params: {
  participantCount: number;
  eventType?: string;
  _refinementHint?: string;
  mixText?: string;
}): string {
  const eventLabel = params.eventType ? `「${params.eventType}」` : '';
  const mixBlock = params.mixText
    ? `\n【本组画像】${params.mixText}。请根据这组性格画像调整竞拍条目的风格与难度，让不同性格的人都能找到舒适的参与方式。`
    : '';
  return `你是JoyJoin的社交破冰主持人。为一场线下小局（约${params.participantCount}人）设计${eventLabel}虚拟脑洞拍卖的竞拍条目。

（你是纯数字助手，不身处现场——不要承诺任何物理世界的行动，不要涉及金钱交易。）
${mixBlock}

语气要求（活人感）：
- title像朋友间随口抛出的脑洞，不是正式拍卖品
- teaser带点挑逗或悬念（"敢不敢...""今晚限定..."）
- 善用语气词和口语化
- 当代网络用语每3条最多用1个（如：整活、绝了、拿捏、栓Q）
- 禁止："恭喜获得...""起拍价..."等正式拍卖口吻

内容规则：
- 全部是轻松、低压力的分享或小表演类条目，不要涉及金钱、酒精、恋爱隐私、政治、宗教、身体伤害
- 每个条目要能在几分钟内完成
- 生成 3 到 5 条竞拍品
- 为每条竞拍品选一个贴合主题的emoji（如 🎭、🎤、🍀、🔮），放在 emoji 字段

请以 JSON 对象返回（仅此对象，不要 markdown）：
{"lots":[{"id":"lot_1","title":"竞拍标题（≤20字）","teaser":"一句话说明（≤40字，可选）","emoji":"🎭"}]}${params._refinementHint ? `

【改进建议】${params._refinementHint}` : ''}`;
}

// ─── MiniScript Framework ────────────────────────────────────────────────────

export const MINISCRIPT_FRAMEWORK_SYSTEM =
  'You are JoyJoin MiniScript story framework writer. Reply with one JSON object only (no markdown). ' +
  'Rules: light social mystery, low conflict, no graphic violence, no hate, no real-person names. ' +
  'All narrative strings in Chinese.';

export function buildMiniScriptFrameworkUserMessage(params: {
  playerCount: number;
  style: MiniScriptStyle;
  genres: MiniScriptGenre[];
}): string {
  return (
    `Host-locked parameters (must match exactly in output):\n` +
    `- playerCount: ${params.playerCount} — output exactly ${params.playerCount} characters.\n` +
    `- style: "${params.style}"\n` +
    `- genres: ${JSON.stringify(params.genres)}\n\n` +
    'JSON shape: { "schemaVersion": 1, "style", "genres", "premise", "characters", "act_flow", "ending" }.\n' +
    'characters: ordered slotIndex 0..n-1; roleLabel, sinHook, alibi, secret (playful, not cruel).\n' +
    'act_flow: 2–4 acts with actNumber, title, beats (short strings).\n' +
    'ending: resolutionSummary, confessionMechanic.\n\n' +
    'Strict: reply with a single JSON object only — no markdown fences, no commentary before or after.'
  );
}

// ─── Xiaoyue Session Pack ────────────────────────────────────────────────────

export function buildXiaoyueSessionPackPrompt(params: {
  participantCount: number;
  eventType?: string;
  participants: Array<{ displayName: string; archetype?: string }>;
}): string {
  const eventLabel = params.eventType ? `「${params.eventType}」` : '线下小局';
  const participantList = params.participants
    .map((p, i) => `${i + 1}. ${p.displayName}${p.archetype ? `（${p.archetype}）` : ''}`)
    .join('\n');

  return (
    `你是社交破冰主持人悦仔。为一场${eventLabel}（约${params.participantCount}人）生成一份开场会话包。\n\n` +
    `（你是纯数字助手，不身处现场——不要承诺任何物理世界的行动。）\n\n` +
    `参与者：\n${participantList}\n\n` +
    '要求：\n' +
    '- 语气松弛、有故事感，像一位靠谱的街头老狐狸，不要客服腔\n' +
    '- 短句为主，偶尔调侃，温暖但不油腻\n' +
    '- 不要堆砌emoji，不要用“哇！”“嘻嘻”等过度兴奋的表达\n' +
    '- 角色标签要贴合每个人，有趣但不冒犯\n\n' +
    '请以 JSON 对象返回（仅此对象，不要 markdown）：\n' +
    '{\n' +
    '  "opener": "开场白（30-60字）",\n' +
    '  "phaseCoaching": {\n' +
    '    "warmup": { "toneLine": "语气引导（≤30字）", "hostHint": "主持人提示（可选，≤40字）", "energyRescue": "救场话术（可选，≤40字）" },\n' +
    '    "micro_challenge": { "toneLine": "...", "hostHint": "...", "energyRescue": "..." },\n' +
    '    "lie_detective": { "toneLine": "...", "hostHint": "...", "energyRescue": "..." },\n' +
    '    "auction": { "toneLine": "...", "hostHint": "...", "energyRescue": "..." },\n' +
    '    "personality_dice": { "toneLine": "...", "hostHint": "...", "energyRescue": "..." },\n' +
    '    "mini_script": { "toneLine": "...", "hostHint": "...", "energyRescue": "..." },\n' +
    '    "recap": { "toneLine": "...", "hostHint": "...", "energyRescue": "..." }\n' +
    '  },\n' +
    '  "backupPrompts": ["救场话术1（≤40字）", "救场话术2", "救场话术3"],\n' +
    '  "recapFraming": {\n' +
    '    "open": "回顾开场（≤40字）",\n' +
    '    "highlightTemplate": "亮点模板（≤30字）",\n' +
    '    "close": "结束语（≤40字）"\n' +
    '  },\n' +
    '  "playerSkillRoles": [\n' +
    '    { "userId": "", "displayName": "", "roleLabel": "角色标签（≤8字）", "roleBlurb": "角色说明（≤30字）" }\n' +
    '  ]\n' +
    '}'
  );
}

// ─── Quip Battle Prompts ─────────────────────────────────────────────────────

export function buildQuipBattlePrompt(params: {
  participantCount: number;
  eventType?: string;
  participants: Array<{ displayName: string; archetype?: string }>;
  _refinementHint?: string;
  sessionContext?: SessionArchetypeContext;
}): string {
  const eventLabel = params.eventType ? `「${params.eventType}」` : '线下小局';
  const participantList = params.participants
    .map((p) => `${p.displayName}${p.archetype ? `（${p.archetype}）` : ''}`)
    .join('、');

  return `你是JoyJoin的社交喜剧编剧。为一场${eventLabel}（${params.participantCount}人）生成3个"机智对决"填空题。

（你是纯数字助手，不身处现场——生成的题目是所有玩家在手机/屏幕上共用完成的。）

参与者：${participantList}

要求：
- 每个题目是一个带空格的句子，玩家填入搞笑答案
- 题目要结合中国人的日常语境（工作、社交、外卖、租房、相亲等）
- 题目要有"留白感"——空格处可以填很多不同的东西，越开放越好
- 语气像朋友聚会时的随口吐槽，不要像考试题
- 禁止使用敏感话题（政治、宗教、种族、性、疾病）
- 当代网络用语每题最多1个
- 每个题目15-30字，空格用"_____"表示

请以JSON数组返回：
[{"id":"qb_1","promptText":"如果_____有段位，你已经是王者了","category":"自嘲"},{"id":"qb_2","promptText":"...","category":"..."},{"id":"qb_3","promptText":"...","category":"..."}]

${params.sessionContext?.mixText ? `【本组画像】${params.sessionContext.mixText}` : ''}

直接返回JSON，不要其他内容。${params._refinementHint ? `

【改进建议】${params._refinementHint}` : ''}`;
}

// ─── Undercover Word Prompts ─────────────────────────────────────────────────

export const UNDERCOVER_WORD_PROMPT_VERSION = 'social-undercover-word-v1';

export function buildUndercoverWordPrompt(params: {
  participantCount: number;
  eventType?: string;
  sessionContext?: SessionArchetypeContext;
}): string {
  const eventLabel = params.eventType ? `「${params.eventType}」` : '线下聚会';

  return `你是JoyJoin的社交游戏设计师。为一场${eventLabel}（${params.participantCount}人）设计一组"谁是卧底"词对。

（你是纯数字助手，不身处现场——生成的词对通过应用界面分发给各玩家。）

游戏规则：
- 大部分玩家（平民）拿到同一个词A
- 1名玩家（卧底）拿到词B
- 两个词要在同一类别下、语义相近但又有明显区别
- 玩家通过描述自己的词来推理谁是卧底，卧底要尽量隐藏自己

要求：
- 词对必须是中文日常词汇（2-4个字）
- 平民词和卧底词要在同一类别（如饮品、美食、交通、社交App等）
- 两个词要有一定相似度，让卧底有机会浑水摸鱼
- 但又不能太像，否则游戏无法推进
- 禁止使用敏感话题（政治、宗教、种族、性、疾病、地域歧视）
- 优先选择年轻人熟悉的日常词汇
${params.sessionContext?.mixText ? `\n【本组画像】${params.sessionContext.mixText}` : ''}

请以JSON返回：
{"civilianWord":"奶茶","undercoverWord":"咖啡","category":"饮品"}

直接返回JSON，不要其他内容。`;
}

// ─── Group Mirror Prompts ────────────────────────────────────────────────────

export const GROUP_MIRROR_PROMPT_VERSION = 'social-group-mirror-v1';

export function buildGroupMirrorPrompt(params: {
  participantCount: number;
  eventType?: string;
  participantNames: string[];
  sessionContext?: SessionArchetypeContext;
}): string {
  const eventLabel = params.eventType ? `「${params.eventType}」` : '线下聚会';
  const names = params.participantNames.join('、');

  return `你是JoyJoin的社交观察家。为一场${eventLabel}（${params.participantCount}人，参与者：${names}）生成5个"群像镜像"问题。

（你是纯数字助手，不身处现场——生成的问题通过应用界面完成匿名投票。）

游戏规则：
- 每个问题都是关于在场某人的趣味观察/猜测
- 大家匿名投票选出"最符合这个问题描述的人"
- 最后揭晓投票结果，形成"群像镜像"

要求：
- 问题要轻松、无攻击性，不能有冒犯性
- 问题要有"画面感"，让人能立刻想到某位朋友
- 问题类型覆盖：观察（谁最像...）、预测（谁最可能...）、记忆（谁给人的第一印象最...）
- 每个问题20-40字
- 禁止使用敏感话题（政治、宗教、种族、性、疾病、外貌攻击、收入）
- 语气像朋友间的好奇打量，不要像心理测试

请以JSON数组返回：
[{"id":"gm_1","questionText":"谁最有可能在聚会结束后第一个提议续摊？","category":"perception"},{"id":"gm_2","questionText":"...","category":"..."}]

category只能是 perception / memory / prediction 之一。
直接返回JSON，不要其他内容。${params.sessionContext?.mixText ? `

【本组画像】${params.sessionContext.mixText}` : ''}`;
}
