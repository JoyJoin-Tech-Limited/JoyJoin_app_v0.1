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

import type { AtmosphereMood } from '@shared/socialIcebreaker';
import type { MiniScriptGenre, MiniScriptStyle } from '@shared/miniscriptStoryFramework';

export const XIAOYUE_COMMENT_PROMPT_VERSION = 'social-xiaoyue-comment-v2';
export const WARMUP_TOPICS_PROMPT_VERSION = 'social-warmup-topics-v2';
export const MICRO_CHALLENGES_PROMPT_VERSION = 'social-micro-challenges-v2';
export const LIE_DETECTIVE_PROMPT_VERSION = 'social-lie-detective-v1';
export const RECAP_SUMMARY_PROMPT_VERSION = 'social-recap-summary-v3';
export const PERSONALITY_DICE_PROMPT_VERSION = 'social-personality-dice-v2';
export const AUCTION_LOTS_PROMPT_VERSION = 'social-auction-lots-v2';
export const MINI_SCRIPT_FRAMEWORK_PROMPT_VERSION = 'social-miniscript-framework-v1';
export const SESSION_PACK_PROMPT_VERSION = 'social-session-pack-v2';

// ─── Warmup Topics ───────────────────────────────────────────────────────────

export function buildWarmupTopicsPrompt(params: {
  eventType: string;
  participantCount: number;
  mood: AtmosphereMood;
  avoidTopics?: string[];
}): string {
  const moodMap: Record<AtmosphereMood, string> = {
    relaxed: '轻松',
    funny: '搞笑',
    life: '生活',
    emotional: '情感',
  };

  return `你是JoyJoin的社交破冰专家。请为一个${params.eventType}活动（${params.participantCount}人）生成5个${moodMap[params.mood]}类型的破冰话题。

语气要求（活人感）：
- 像朋友间随口一问，不要像面试题或问卷调查
- 善用语气词：啦、嘛、呢、吧、咯，让问题有呼吸感
- 可以偶尔自嘲或带点小吐槽（"虽然有点老套但..."）
- 句子长短错落，不要全是工整的排比
- 当代网络用语每5条最多用1个，要自然不突兀（如：绝了、拿捏、整活、u1s1、栓Q、真香、破防）
- 禁止：客服腔、过度热情（"哇！""嘻嘻"）、AI味开场（"让我们一起..."）

内容要求：
- 话题深度形成曲线：至少2个 Level 1 轻松开场、2个 Level 2 体验分享、1个 Level 3 温和反思
- 适合初次见面，不查户口、不逼问隐私
- 每个话题一句话，不超过30字
${params.avoidTopics?.length ? `- 避免以下话题：${params.avoidTopics.join('、')}` : ''}

请以JSON格式返回：
[{"id":"ai1","question":"话题文本","mood":"${params.mood}","emoji":"相关emoji","category":"话题类别","depthLevel":1,"promptStyle":"binary","safety":"gentle"}]

直接返回JSON数组，不要其他内容。`;
}

// ─── Micro Challenges ────────────────────────────────────────────────────────

export function buildMicroChallengesPrompt(params: {
  eventType: string;
  participantCount: number;
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
- 适合在餐桌/酒桌旁进行，不需要太多空间
- 有趣且能促进互动，不搞尴尬惩罚

请以JSON格式返回：
[{"id":"ai_c1","title":"挑战名称","description":"详细描述","durationSeconds":120,"completionCTA":"完成按钮文字","visualHint":"2-3个相关emoji"}]

直接返回JSON数组，不要其他内容。`;
}

// ─── Lie Detective ───────────────────────────────────────────────────────────

export function buildLieDetectivePrompt(params: {
  displayName: string;
  archetype?: string;
  interests?: string[];
}): string {
  const context = [
    params.archetype ? `性格类型：${params.archetype}` : '',
    params.interests?.length ? `兴趣爱好：${params.interests.slice(0, 3).join('、')}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return `你是社交破冰专家小悦。请为"${params.displayName}"生成"两真一假"游戏的3个陈述句。
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

// ─── XiaoYue Comment (facilitator) ───────────────────────────────────────────

export function buildXiaoYueCommentPrompt(params: {
  phase: string;
  event: string;
  context?: string;
}): string {
  return `你是JoyJoin的社交破冰主持人。请为以下场景生成一句简短的主持评语（20-30字）：
- 当前阶段：${params.phase}
- 触发事件：${params.event}
${params.context ? `- 上下文：${params.context}` : ''}

语气要求（活人感）：
- 像局上最会带气氛的那个朋友，不是官方主持人
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

直接返回JSON，不要其他内容。`;
}

// ─── Personality Dice ────────────────────────────────────────────────────────

export function buildPersonalityDicePrompt(params: {
  participants: Array<{
    displayName: string;
    archetype?: string;
    dominantTrait: string;
  }>;
}): string {
  const participantList = params.participants.map((p) => ({
    displayName: p.displayName,
    archetype: p.archetype || '未知',
    dominantTrait: p.dominantTrait,
  }));

  return `你是JoyJoin的社交破冰专家。请为以下参与者各生成一个个性化挑战：

${JSON.stringify(participantList, null, 2)}

语气要求（活人感）：
- challengeTitle像朋友起的绰号或玩笑，不要太正经
- challengeBody像当面提出来的小捉弄，带语气词（"来，给大家表演一下...""敢不敢试试..."）
- 可以结合该人特质调侃，但要善意不冒犯
- 当代网络用语每人最多用1个（如：拿捏、整活、绝了、真香）
- 禁止："请该同学完成以下任务"等课堂/团建腔

内容要求：
- 基于该人的人格特质(dominantTrait)
- 适合当场执行（1-2分钟内）
- 有趣但不尴尬，不搞惩罚

请以JSON数组返回（顺序与输入一致）：
[{"challengeTitle":"挑战名称","challengeBody":"挑战说明（20字内）","challengeEmoji":"1个emoji","difficulty":"easy|medium|hard"}]

直接返回JSON数组，不要其他内容。`;
}

// ─── Auction Lots ────────────────────────────────────────────────────────────

export function buildAuctionLotsPrompt(params: {
  participantCount: number;
  eventType?: string;
}): string {
  const eventLabel = params.eventType ? `「${params.eventType}」` : '';
  return (
    `你是JoyJoin的社交破冰主持人。为一场线下小局（约${params.participantCount}人）设计${eventLabel}虚拟脑洞拍卖的竞拍条目。\n\n` +
    '语气要求（活人感）：\n' +
    '- title像朋友间随口抛出的脑洞，不是正式拍卖品\n' +
    '- teaser带点挑逗或悬念（"敢不敢...""今晚限定..."）\n' +
    '- 善用语气词和口语化\n' +
    '- 当代网络用语每3条最多用1个（如：整活、绝了、拿捏、栓Q）\n' +
    '- 禁止："恭喜获得...""起拍价..."等正式拍卖口吻\n\n' +
    '内容规则：\n' +
    '- 全部是轻松、低压力的分享或小表演类条目，不要涉及金钱、酒精、恋爱隐私、政治、宗教、身体伤害\n' +
    '- 每个条目要能在几分钟内完成\n' +
    '- 生成 3 到 5 条竞拍品\n\n' +
    '请以 JSON 对象返回（仅此对象，不要 markdown）：\n' +
    '{"lots":[{"id":"lot_1","title":"竞拍标题（≤20字）","teaser":"一句话说明（≤40字，可选）"}]}'
  );
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
    `你是社交破冰主持人小悦。为一场${eventLabel}（约${params.participantCount}人）生成一份开场会话包。\n\n` +
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
