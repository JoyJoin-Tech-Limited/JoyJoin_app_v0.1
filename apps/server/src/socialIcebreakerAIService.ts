import type {
  SocialTopic,
  MicroChallenge,
  LieDetectiveStatement,
  AtmosphereMood,
  PersonalityDiceChallenge,
  SocialTopicDepthLevel,
  SocialTopicPromptStyle,
  SocialTopicSafety,
} from '@shared/socialIcebreaker';
import {
  buildFallbackAIMeta,
  buildLiveAIMeta,
  type AIResponseMeta,
} from '@shared/types/aiMeta';
import { getClientForFunction } from './ai/socialModelRouter';
import { logAITrace } from './lib/aiTraceLogger';

type AIServiceResult<T> = {
  data: T;
  meta: AIResponseMeta;
};

const WARMUP_TOPICS_PROMPT_VERSION = 'social-warmup-topics-v1';
const MICRO_CHALLENGES_PROMPT_VERSION = 'social-micro-challenges-v1';
const LIE_DETECTIVE_PROMPT_VERSION = 'social-lie-detective-v1';
const RECAP_SUMMARY_PROMPT_VERSION = 'social-recap-summary-v1';
const PERSONALITY_DICE_PROMPT_VERSION = 'social-personality-dice-v1';

function normalizeTopicDepthLevel(value: unknown): SocialTopicDepthLevel {
  return value === 3 ? 3 : value === 2 ? 2 : 1;
}

function normalizeTopicPromptStyle(value: unknown): SocialTopicPromptStyle {
  return value === 'binary' || value === 'reflective' ? value : 'experiential';
}

function normalizeTopicSafety(value: unknown): SocialTopicSafety {
  return value === 'open' || value === 'reflective' ? value : 'gentle';
}

function normalizeSocialTopic(topic: Partial<SocialTopic>, fallbackMood: AtmosphereMood, index: number): SocialTopic {
  return {
    id: topic.id || `topic_${index + 1}`,
    question: topic.question || '分享一件让你会心一笑的小事',
    mood: topic.mood || fallbackMood,
    emoji: topic.emoji || '✨',
    category: topic.category || '轻松开场',
    depthLevel: normalizeTopicDepthLevel(topic.depthLevel),
    promptStyle: normalizeTopicPromptStyle(topic.promptStyle),
    safety: normalizeTopicSafety(topic.safety),
  };
}

// ============ CURATED FALLBACK CONTENT ============

const FALLBACK_WARMUP_TOPICS: SocialTopic[] = [
  { id: 'w1', question: '最近最离谱的一次外卖经历是什么？', mood: 'funny', emoji: '🍜', category: '生活趣事', depthLevel: 1, promptStyle: 'binary', safety: 'gentle' },
  { id: 'w2', question: '如果能把今天的一件事重来，你会改变什么？', mood: 'life', emoji: '🔄', category: '今日状态', depthLevel: 2, promptStyle: 'experiential', safety: 'open' },
  { id: 'w3', question: '你手机里现在最奇怪的一张照片是什么？', mood: 'funny', emoji: '📱', category: '轻松破冰', depthLevel: 1, promptStyle: 'binary', safety: 'gentle' },
  { id: 'w4', question: '最近让你觉得"世界真小"的一次巧合？', mood: 'life', emoji: '🌍', category: '偶遇故事', depthLevel: 2, promptStyle: 'experiential', safety: 'open' },
  { id: 'w5', question: '如果你的性格是一道菜，你是什么菜？', mood: 'funny', emoji: '🍽️', category: '自我比喻', depthLevel: 1, promptStyle: 'binary', safety: 'gentle' },
  { id: 'w6', question: '你最近一次真正放松是什么时候？在哪里？', mood: 'relaxed', emoji: '😌', category: '舒适感', depthLevel: 2, promptStyle: 'experiential', safety: 'gentle' },
  { id: 'w7', question: '如果明天不用工作，你最想做什么？', mood: 'relaxed', emoji: '🌟', category: '理想日常', depthLevel: 1, promptStyle: 'binary', safety: 'gentle' },
  { id: 'w8', question: '你最想和谁（活着或已故）共进一顿晚餐？', mood: 'emotional', emoji: '💫', category: '重要关系', depthLevel: 3, promptStyle: 'reflective', safety: 'reflective' },
  { id: 'w9', question: '最近让你感动到的一个小细节是什么？', mood: 'emotional', emoji: '🥹', category: '感动瞬间', depthLevel: 3, promptStyle: 'reflective', safety: 'reflective' },
  { id: 'w10', question: '你觉得自己哪个优点是被低估的？', mood: 'life', emoji: '💡', category: '自我认知', depthLevel: 2, promptStyle: 'experiential', safety: 'open' },
  { id: 'w11', question: '描述一下你的理想周末是什么样的？', mood: 'relaxed', emoji: '☀️', category: '理想节奏', depthLevel: 2, promptStyle: 'experiential', safety: 'gentle' },
  { id: 'w12', question: '如果你能突然精通一门技能，你想要什么技能？', mood: 'funny', emoji: '🎯', category: '愿望清单', depthLevel: 1, promptStyle: 'binary', safety: 'gentle' },
  { id: 'w13', question: '最近让你哈哈大笑的是什么？', mood: 'funny', emoji: '😂', category: '快乐来源', depthLevel: 1, promptStyle: 'binary', safety: 'gentle' },
  { id: 'w14', question: '你小时候最想成为什么职业？现在还想吗？', mood: 'life', emoji: '👶', category: '成长轨迹', depthLevel: 2, promptStyle: 'experiential', safety: 'open' },
  { id: 'w15', question: '如果你能给5年前的自己一句话，你会说什么？', mood: 'emotional', emoji: '⏰', category: '自我回望', depthLevel: 3, promptStyle: 'reflective', safety: 'reflective' },
  { id: 'w16', question: '最近尝试过什么新事物，结果怎么样？', mood: 'life', emoji: '🚀', category: '新鲜体验', depthLevel: 2, promptStyle: 'experiential', safety: 'open' },
  { id: 'w17', question: '你的"精神充电"方式是什么？', mood: 'relaxed', emoji: '🔋', category: '恢复能量', depthLevel: 2, promptStyle: 'experiential', safety: 'gentle' },
  { id: 'w18', question: '有什么事情看起来很难但实际上很容易？', mood: 'funny', emoji: '🤔', category: '反差观察', depthLevel: 1, promptStyle: 'binary', safety: 'gentle' },
  { id: 'w19', question: '什么样的环境让你感到最舒适？', mood: 'relaxed', emoji: '🏡', category: '舒适空间', depthLevel: 2, promptStyle: 'experiential', safety: 'gentle' },
  { id: 'w20', question: '你最想去但还没去过的地方是哪里？为什么？', mood: 'emotional', emoji: '✈️', category: '向往之地', depthLevel: 2, promptStyle: 'experiential', safety: 'open' },
  { id: 'w21', question: '今晚来这里，你最期待的是什么？', mood: 'relaxed', emoji: '🎉', category: '现场期待', depthLevel: 1, promptStyle: 'binary', safety: 'gentle' },
  { id: 'w22', question: '用三个词描述你今天的心情？', mood: 'life', emoji: '💭', category: '情绪快照', depthLevel: 1, promptStyle: 'binary', safety: 'gentle' },
  { id: 'w23', question: '你有什么"奇怪"的生活习惯不好意思承认的？', mood: 'funny', emoji: '🙈', category: '可爱怪癖', depthLevel: 2, promptStyle: 'experiential', safety: 'open' },
  { id: 'w24', question: '最近有没有什么让你改变看法的经历？', mood: 'emotional', emoji: '🌱', category: '观点变化', depthLevel: 3, promptStyle: 'reflective', safety: 'reflective' },
  { id: 'w25', question: '如果你的生活是一部电影，现在是哪个章节？', mood: 'life', emoji: '🎬', category: '人生叙事', depthLevel: 3, promptStyle: 'reflective', safety: 'reflective' },
];

const FALLBACK_MICRO_CHALLENGES: MicroChallenge[] = [
  {
    id: 'c1',
    title: '找3个共同点',
    description: '在座所有人找出3个共同的爱好或经历',
    durationSeconds: 180,
    completionCTA: '找到了！',
    visualHint: '🔍🤝',
  },
  {
    id: 'c2',
    title: '用3个词形容彼此',
    description: '每人用3个词形容坐在自己右边的人',
    durationSeconds: 120,
    completionCTA: '说完了！',
    visualHint: '💬🌟',
  },
  {
    id: 'c3',
    title: '组队想出最离谱的创业点子',
    description: '大家一起想出一个绝对不会成功的创业想法',
    durationSeconds: 150,
    completionCTA: '想到了！',
    visualHint: '🚀💡',
  },
  {
    id: 'c4',
    title: '哼歌猜曲',
    description: '每人哼一首歌，其他人猜歌名，猜对了换下一首',
    durationSeconds: 120,
    completionCTA: '猜完了！',
    visualHint: '🎵🎤',
  },
  {
    id: 'c5',
    title: '最快自我介绍',
    description: '每人用30秒介绍自己最不为人知的一面',
    durationSeconds: 180,
    completionCTA: '介绍完了！',
    visualHint: '⚡👤',
  },
  {
    id: 'c6',
    title: '心灵感应挑战',
    description: '两人背对背同时说出同一个数字，全组尝试心灵感应',
    durationSeconds: 90,
    completionCTA: '挑战完成！',
    visualHint: '🧠✨',
  },
  {
    id: 'c7',
    title: '排列组合游戏',
    description: '所有人按照生日月份从小到大排成一排，不能说话只能用手势',
    durationSeconds: 120,
    completionCTA: '排好了！',
    visualHint: '🎯👥',
  },
  {
    id: 'c8',
    title: '集体讲故事',
    description: '每人说一句话，接力完成一个完整故事，结尾必须出乎意料',
    durationSeconds: 180,
    completionCTA: '故事完成！',
    visualHint: '📖🎭',
  },
];

const FALLBACK_LIE_DETECTIVE_STATEMENTS: LieDetectiveStatement[][] = [
  [
    { index: 1, text: '我曾经在凌晨3点独自爬过一座山', isLie: false },
    { index: 2, text: '我会说5种语言', isLie: true },
    { index: 3, text: '我的第一份工作是在便利店打工', isLie: false },
  ],
  [
    { index: 1, text: '我曾经在电视上出现过', isLie: true },
    { index: 2, text: '我养过一只龟，养了10年', isLie: false },
    { index: 3, text: '我大学时是系里的长跑冠军', isLie: false },
  ],
  [
    { index: 1, text: '我曾经在飞机上遇到过名人', isLie: false },
    { index: 2, text: '我做过职业厨师', isLie: true },
    { index: 3, text: '我第一次坐飞机是25岁之后', isLie: false },
  ],
];

// ============ AI GENERATORS ============

export async function generateWarmupTopics(params: {
  mood: AtmosphereMood;
  eventType: string;
  participantCount: number;
  avoidTopics?: string[];
}): Promise<AIServiceResult<SocialTopic[]>> {
  const moodMap: Record<AtmosphereMood, string> = {
    relaxed: '轻松',
    funny: '搞笑',
    life: '生活',
    emotional: '情感',
  };

  const { client, model, provider } = getClientForFunction('generateWarmupTopics');
  const t0 = Date.now();
  try {
    const prompt = `你是社交破冰专家小悦。请为一个${params.eventType}活动（${params.participantCount}人）生成5个${moodMap[params.mood]}类型的破冰话题。
    
要求：
- 话题深度要形成曲线：至少2个 Level 1 轻松开场、2个 Level 2 体验分享、1个 Level 3 温和反思
- 话题要轻松有趣，适合初次见面
- 每个话题一句话，不超过30字
- 不要过于严肃或私人
${params.avoidTopics?.length ? `- 避免以下话题：${params.avoidTopics.join('、')}` : ''}

请以JSON格式返回，格式如下：
[{"id":"ai1","question":"话题文本","mood":"${params.mood}","emoji":"相关emoji","category":"话题类别","depthLevel":1,"promptStyle":"binary","safety":"gentle"}]

直接返回JSON数组，不要其他内容。`;

    const response = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.9,
      max_tokens: 500,
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      const meta = buildFallbackAIMeta('empty_response', WARMUP_TOPICS_PROMPT_VERSION);
      logAITrace({ domain: 'icebreaker', feature: 'generateWarmupTopics', provider, model, latencyMs: Date.now() - t0, success: false, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
      return { data: getFallbackTopics(params.mood), meta };
    }

    const parsed = JSON.parse(content);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const latencyMs = Date.now() - t0;
      console.log(`[SocialIcebreakerAI] generateWarmupTopics provider=${provider} latency=${latencyMs}ms`);
      const meta = buildLiveAIMeta(provider, WARMUP_TOPICS_PROMPT_VERSION);
      logAITrace({ domain: 'icebreaker', feature: 'generateWarmupTopics', provider, model, latencyMs, success: true, fallbackUsed: false, fromCache: false, promptVersion: meta.promptVersion });
      return {
        data: parsed.slice(0, 5).map((topic, index) => normalizeSocialTopic(topic, params.mood, index)),
        meta,
      };
    }
    const latencyMs = Date.now() - t0;
    console.warn(`[SocialIcebreakerAI] generateWarmupTopics provider=${provider} latency=${latencyMs}ms: invalid response shape, using fallback`);
    const meta = buildFallbackAIMeta('parse_error', WARMUP_TOPICS_PROMPT_VERSION);
    logAITrace({ domain: 'icebreaker', feature: 'generateWarmupTopics', provider, model, latencyMs, success: false, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
    return { data: getFallbackTopics(params.mood), meta };
  } catch (error) {
    const latencyMs = Date.now() - t0;
    console.error(`[SocialIcebreakerAI] generateWarmupTopics error provider=${provider} latency=${latencyMs}ms:`, error);
    const meta = buildFallbackAIMeta('llm_error', WARMUP_TOPICS_PROMPT_VERSION);
    logAITrace({ domain: 'icebreaker', feature: 'generateWarmupTopics', provider, model, latencyMs, success: false, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
    return { data: getFallbackTopics(params.mood), meta };
  }
}

function getFallbackTopics(mood: AtmosphereMood): SocialTopic[] {
  const filtered = FALLBACK_WARMUP_TOPICS.filter(t => t.mood === mood);
  const shuffled = [...filtered].sort(() => Math.random() - 0.5);
  // If not enough for this mood, supplement with others
  if (shuffled.length < 5) {
    const others = FALLBACK_WARMUP_TOPICS.filter(t => t.mood !== mood)
      .sort(() => Math.random() - 0.5)
      .slice(0, 5 - shuffled.length);
    return [...shuffled, ...others].map((topic, index) => normalizeSocialTopic(topic, mood, index));
  }
  return shuffled.slice(0, 5).map((topic, index) => normalizeSocialTopic(topic, mood, index));
}

export async function generateMicroChallenges(params: {
  eventType: string;
  participantCount: number;
  completedChallengeIds?: string[];
}): Promise<AIServiceResult<MicroChallenge[]>> {
  const { client, model, provider } = getClientForFunction('generateMicroChallenges');
  const t0 = Date.now();
  try {
    const prompt = `你是社交破冰专家小悦。请为一个${params.eventType}活动（${params.participantCount}人）生成3个有趣的微挑战。

要求：
- 挑战要简单易执行，2-5分钟内可完成
- 适合在餐桌/酒桌旁进行，不需要太多空间
- 有趣且能促进互动

请以JSON格式返回：
[{"id":"ai_c1","title":"挑战名称","description":"详细描述","durationSeconds":120,"completionCTA":"完成按钮文字","visualHint":"2-3个相关emoji"}]

直接返回JSON数组，不要其他内容。`;

    const response = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8,
      max_tokens: 400,
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      const meta = buildFallbackAIMeta('empty_response', MICRO_CHALLENGES_PROMPT_VERSION);
      logAITrace({ domain: 'icebreaker', feature: 'generateMicroChallenges', provider, model, latencyMs: Date.now() - t0, success: false, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
      return { data: getFallbackChallenges(params.completedChallengeIds), meta };
    }

    const parsed = JSON.parse(content);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const latencyMs = Date.now() - t0;
      console.log(`[SocialIcebreakerAI] generateMicroChallenges provider=${provider} latency=${latencyMs}ms`);
      const meta = buildLiveAIMeta(provider, MICRO_CHALLENGES_PROMPT_VERSION);
      logAITrace({ domain: 'icebreaker', feature: 'generateMicroChallenges', provider, model, latencyMs, success: true, fallbackUsed: false, fromCache: false, promptVersion: meta.promptVersion });
      return { data: parsed.slice(0, 3), meta };
    }
    const latencyMs = Date.now() - t0;
    console.warn(`[SocialIcebreakerAI] generateMicroChallenges provider=${provider} latency=${latencyMs}ms: invalid response shape, using fallback`);
    const meta = buildFallbackAIMeta('parse_error', MICRO_CHALLENGES_PROMPT_VERSION);
    logAITrace({ domain: 'icebreaker', feature: 'generateMicroChallenges', provider, model, latencyMs, success: false, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
    return { data: getFallbackChallenges(params.completedChallengeIds), meta };
  } catch (error) {
    const latencyMs = Date.now() - t0;
    console.error(`[SocialIcebreakerAI] generateMicroChallenges error provider=${provider} latency=${latencyMs}ms:`, error);
    const meta = buildFallbackAIMeta('llm_error', MICRO_CHALLENGES_PROMPT_VERSION);
    logAITrace({ domain: 'icebreaker', feature: 'generateMicroChallenges', provider, model, latencyMs, success: false, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
    return { data: getFallbackChallenges(params.completedChallengeIds), meta };
  }
}

function getFallbackChallenges(completedIds?: string[]): MicroChallenge[] {
  const available = FALLBACK_MICRO_CHALLENGES.filter(
    c => !completedIds?.includes(c.id)
  );
  return [...available].sort(() => Math.random() - 0.5).slice(0, 3);
}

export async function generateLieDetectiveStatements(params: {
  userId: string;
  displayName: string;
  archetype?: string;
  interests?: string[];
}): Promise<AIServiceResult<LieDetectiveStatement[]>> {
  const { client, model, provider } = getClientForFunction('generateLieDetectiveStatements');
  const t0 = Date.now();
  try {
    const context = [
      params.archetype ? `性格类型：${params.archetype}` : '',
      params.interests?.length ? `兴趣爱好：${params.interests.slice(0, 3).join('、')}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const prompt = `你是社交破冰专家小悦。请为"${params.displayName}"生成"两真一假"游戏的3个陈述句。
${context ? `关于这个人的信息：\n${context}` : ''}

要求：
- 3个陈述中，2个是可能为真的，1个是假的
- 陈述要有趣且令人难以判断真假
- 每句不超过20字
- 要有一定的个人特色

请以JSON格式返回，并标注哪个是假的：
[{"index":1,"text":"陈述文本","isLie":false},{"index":2,"text":"陈述文本","isLie":true},{"index":3,"text":"陈述文本","isLie":false}]

直接返回JSON数组，确保只有一个isLie为true。`;

    const response = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.9,
      max_tokens: 300,
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      const meta = buildFallbackAIMeta('empty_response', LIE_DETECTIVE_PROMPT_VERSION);
      logAITrace({ domain: 'icebreaker', feature: 'generateLieDetectiveStatements', provider, model, latencyMs: Date.now() - t0, success: false, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
      return { data: getRandomFallbackStatements(), meta };
    }

    const parsed = JSON.parse(content);
    if (
      Array.isArray(parsed) &&
      parsed.length === 3 &&
      parsed.filter((s: LieDetectiveStatement) => s.isLie).length === 1
    ) {
      const latencyMs = Date.now() - t0;
      console.log(`[SocialIcebreakerAI] generateLieDetectiveStatements provider=${provider} latency=${latencyMs}ms`);
      const meta = buildLiveAIMeta(provider, LIE_DETECTIVE_PROMPT_VERSION);
      logAITrace({ domain: 'icebreaker', feature: 'generateLieDetectiveStatements', provider, model, latencyMs, success: true, fallbackUsed: false, fromCache: false, promptVersion: meta.promptVersion });
      return { data: parsed, meta };
    }
    const latencyMs = Date.now() - t0;
    console.warn(`[SocialIcebreakerAI] generateLieDetectiveStatements provider=${provider} latency=${latencyMs}ms: invalid response shape (expected 3 items with exactly 1 lie), using fallback`);
    const meta = buildFallbackAIMeta('parse_error', LIE_DETECTIVE_PROMPT_VERSION);
    logAITrace({ domain: 'icebreaker', feature: 'generateLieDetectiveStatements', provider, model, latencyMs, success: false, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
    return { data: getRandomFallbackStatements(), meta };
  } catch (error) {
    const latencyMs = Date.now() - t0;
    console.error(`[SocialIcebreakerAI] generateLieDetectiveStatements error provider=${provider} latency=${latencyMs}ms:`, error);
    const meta = buildFallbackAIMeta('llm_error', LIE_DETECTIVE_PROMPT_VERSION);
    logAITrace({ domain: 'icebreaker', feature: 'generateLieDetectiveStatements', provider, model, latencyMs, success: false, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
    return { data: getRandomFallbackStatements(), meta };
  }
}

function getRandomFallbackStatements(): LieDetectiveStatement[] {
  const sets = [...FALLBACK_LIE_DETECTIVE_STATEMENTS].sort(() => Math.random() - 0.5);
  return sets[0];
}

export async function generateXiaoYueComment(params: {
  phase: string;
  event: string;
  context?: string;
}): Promise<string> {
  const defaultComments: Record<string, Record<string, string>> = {
    warmup: {
      phase_start: '欢迎来到今晚的破冰时间！先从轻松的话题暖暖场吧 🌅',
      topic_refresh: '换个话题，继续聊！这个更有趣～ ✨',
      mood_change: '好主意，切换心情！新话题来了 🎯',
    },
    micro_challenge: {
      phase_start: '热身完毕！接下来是微挑战环节，大家准备好了吗？⚡',
      timer_warning: '加油！时间不多了 ⚡',
      challenge_complete: '太棒了！大家都完成了！🎉',
    },
    lie_detective: {
      phase_start: '侦探们，仔细听每一句话，找出谎言！🕵️',
      vote_reveal: '揭晓时刻到了！谁是最佳说谎者？😏',
      generating: '小悦正在为大家准备谎言游戏内容...',
    },
    recap: {
      phase_start: '今晚的破冰之旅圆满结束！✨',
    },
  };

  const phaseComments = defaultComments[params.phase];
  if (phaseComments?.[params.event]) {
    return phaseComments[params.event];
  }

  const { client, model, provider } = getClientForFunction('generateXiaoYueComment');
  const t0 = Date.now();
  try {
    const prompt = `你是社交破冰助手小悦。请为以下场景生成一句简短的主持评语（20-30字）：
- 当前阶段：${params.phase}
- 触发事件：${params.event}
${params.context ? `- 上下文：${params.context}` : ''}

要求：温暖有趣，有主持人的活力，可以加emoji。直接返回评语文本，不要其他内容。`;

    const response = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8,
      max_tokens: 100,
    });

    const content = response.choices[0]?.message?.content?.trim();
    console.log(`[SocialIcebreakerAI] generateXiaoYueComment provider=${provider} latency=${Date.now() - t0}ms`);
    return content || '继续加油，破冰进行中！✨';
  } catch (error) {
    console.error(`[SocialIcebreakerAI] generateXiaoYueComment error provider=${provider} latency=${Date.now() - t0}ms:`, error);
    return '继续加油，破冰进行中！✨';
  }
}

export async function generateRecapSummary(params: {
  participants: Array<{ displayName: string; archetype?: string }>;
  topicsDiscussed: string[];
  challengesCompleted: number;
  commonGroundCount: number;
  lieDetectiveHighlights?: string[];
  durationMinutes: number;
}): Promise<AIServiceResult<{ headline: string; moments: string[]; closingLine: string }>> {
  const { client, model, provider } = getClientForFunction('generateRecapSummary');
  const t0 = Date.now();
  try {
    const prompt = `你是社交破冰助手小悦。请为今晚的活动生成一个温馨的总结：

参与者：${params.participants.map(p => p.displayName).join('、')}
讨论话题数：${params.topicsDiscussed.length}
完成挑战数：${params.challengesCompleted}
 发现共同点：${params.commonGroundCount}
活动时长：${params.durationMinutes}分钟
${params.lieDetectiveHighlights?.length ? `谎言侦探亮点：${params.lieDetectiveHighlights.join('、')}` : ''}

请以JSON格式返回：
{
  "headline": "一句话总结（15字内）",
  "moments": ["精彩瞬间1", "精彩瞬间2", "精彩瞬间3"],
  "closingLine": "温馨结束语（20-30字）"
}

直接返回JSON，不要其他内容。`;

    const response = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8,
      max_tokens: 300,
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      const meta = buildFallbackAIMeta('empty_response', RECAP_SUMMARY_PROMPT_VERSION);
      logAITrace({ domain: 'icebreaker', feature: 'generateRecapSummary', provider, model, latencyMs: Date.now() - t0, success: false, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
      return { data: getDefaultRecap(params), meta };
    }

    const parsed = JSON.parse(content);
    if (parsed.headline && parsed.moments && parsed.closingLine) {
      const latencyMs = Date.now() - t0;
      console.log(`[SocialIcebreakerAI] generateRecapSummary provider=${provider} latency=${latencyMs}ms`);
      const meta = buildLiveAIMeta(provider, RECAP_SUMMARY_PROMPT_VERSION);
      logAITrace({ domain: 'icebreaker', feature: 'generateRecapSummary', provider, model, latencyMs, success: true, fallbackUsed: false, fromCache: false, promptVersion: meta.promptVersion });
      return { data: parsed, meta };
    }
    const latencyMs = Date.now() - t0;
    console.warn(`[SocialIcebreakerAI] generateRecapSummary provider=${provider} latency=${latencyMs}ms: invalid response shape, using fallback`);
    const meta = buildFallbackAIMeta('parse_error', RECAP_SUMMARY_PROMPT_VERSION);
    logAITrace({ domain: 'icebreaker', feature: 'generateRecapSummary', provider, model, latencyMs, success: false, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
    return { data: getDefaultRecap(params), meta };
  } catch (error) {
    const latencyMs = Date.now() - t0;
    console.error(`[SocialIcebreakerAI] generateRecapSummary error provider=${provider} latency=${latencyMs}ms:`, error);
    const meta = buildFallbackAIMeta('llm_error', RECAP_SUMMARY_PROMPT_VERSION);
    logAITrace({ domain: 'icebreaker', feature: 'generateRecapSummary', provider, model, latencyMs, success: false, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
    return { data: getDefaultRecap(params), meta };
  }
}

function getDefaultRecap(params: {
  participants: Array<{ displayName: string }>;
  topicsDiscussed: string[];
  challengesCompleted: number;
  commonGroundCount: number;
  durationMinutes: number;
}): { headline: string; moments: string[]; closingLine: string } {
  const names = params.participants.map(p => p.displayName);
  return {
    headline: `${params.durationMinutes}分钟的精彩破冰！`,
    moments: [
      `聊了${params.topicsDiscussed.length}个有趣话题`,
      `完成了${params.challengesCompleted}个微挑战`,
      `发现了${params.commonGroundCount}个共同点`,
      `${names.length}个人的新奇缘分`,
    ],
    closingLine: `感谢${names.slice(0, 2).join('和')}${names.length > 2 ? '等' : ''}大家的参与！期待下次再见 🌟`,
  };
}

// ─── Personality Dice ─────────────────────────────────────────────────────────

type DominantTrait = 'A' | 'C' | 'E' | 'O' | 'X' | 'P';

const DICE_CURATED: Record<DominantTrait, Omit<PersonalityDiceChallenge, 'userId' | 'displayName' | 'archetype' | 'dominantTrait'>> = {
  X: { challengeTitle: '快速印象官', challengeBody: '用3个词描述在座每个人，不能重复！', challengeEmoji: '🎤', difficulty: 'easy' },
  A: { challengeTitle: '温暖传递者', challengeBody: '找出今晚你感受到最多温暖的人，当面告诉他为什么', challengeEmoji: '🤗', difficulty: 'medium' },
  O: { challengeTitle: '奇异探险家', challengeBody: '分享一件你最近做过的、大多数人不会做的事', challengeEmoji: '🌟', difficulty: 'medium' },
  C: { challengeTitle: '严苛评委', challengeBody: '你来当评委：给今晚的破冰打分，并说出最值得改进的一点', challengeEmoji: '📋', difficulty: 'hard' },
  E: { challengeTitle: '误解澄清者', challengeBody: '有没有一件事，你觉得大家可能误解你了？说出来', challengeEmoji: '💭', difficulty: 'medium' },
  P: { challengeTitle: '阳光分享者', challengeBody: '说一件今晚让你开心的小事，越具体越好', challengeEmoji: '☀️', difficulty: 'easy' },
};

function getDominantTrait(traitScores?: Record<string, number>): DominantTrait {
  if (!traitScores) return 'P';
  const traits: DominantTrait[] = ['A', 'C', 'E', 'O', 'X', 'P'];
  let best: DominantTrait = 'P';
  let bestScore = -Infinity;
  for (const t of traits) {
    const score = traitScores[t] ?? traitScores[t.toLowerCase()] ?? 0;
    if (score > bestScore) {
      bestScore = score;
      best = t;
    }
  }
  return best;
}

export async function generatePersonalityDiceChallenges(participants: Array<{
  userId: string;
  displayName: string;
  archetype?: string;
  traitScores?: Record<string, number>;
}>): Promise<AIServiceResult<PersonalityDiceChallenge[]>> {
  // Build curated fallbacks first
  const fallbacks: PersonalityDiceChallenge[] = participants.map(p => {
    const trait = getDominantTrait(p.traitScores);
    const curated = DICE_CURATED[trait];
    return {
      userId: p.userId,
      displayName: p.displayName,
      archetype: p.archetype,
      dominantTrait: trait,
      ...curated,
    };
  });

  const { client, model, provider } = getClientForFunction('generatePersonalityDiceChallenges');
  const t0 = Date.now();
  try {
    const participantList = participants.map(p => ({
      displayName: p.displayName,
      archetype: p.archetype || '未知',
      dominantTrait: getDominantTrait(p.traitScores),
    }));

    const prompt = `你是社交破冰专家小悦。请为以下参与者各生成一个个性化挑战：

${JSON.stringify(participantList, null, 2)}

每个挑战要基于该人的人格特质(dominantTrait)，要有趣且适合当场执行（1-2分钟内）。

请以JSON数组返回（顺序与输入一致）：
[{"challengeTitle":"挑战名称","challengeBody":"挑战说明（20字内）","challengeEmoji":"1个emoji","difficulty":"easy|medium|hard"}]

直接返回JSON数组，不要其他内容。`;

    const response = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.85,
      max_tokens: 400,
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      const meta = buildFallbackAIMeta('empty_response', PERSONALITY_DICE_PROMPT_VERSION);
      logAITrace({ domain: 'icebreaker', feature: 'generatePersonalityDiceChallenges', provider, model, latencyMs: Date.now() - t0, success: false, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
      return { data: fallbacks, meta };
    }

    const parsed = JSON.parse(content);
    if (Array.isArray(parsed) && parsed.length === participants.length) {
      const latencyMs = Date.now() - t0;
      console.log(`[SocialIcebreakerAI] generatePersonalityDiceChallenges provider=${provider} latency=${latencyMs}ms`);
      const meta = buildLiveAIMeta(provider, PERSONALITY_DICE_PROMPT_VERSION);
      logAITrace({ domain: 'icebreaker', feature: 'generatePersonalityDiceChallenges', provider, model, latencyMs, success: true, fallbackUsed: false, fromCache: false, promptVersion: meta.promptVersion });
      return { data: participants.map((p, i) => ({
        userId: p.userId,
        displayName: p.displayName,
        archetype: p.archetype,
        dominantTrait: getDominantTrait(p.traitScores),
        challengeTitle: parsed[i].challengeTitle || fallbacks[i].challengeTitle,
        challengeBody: parsed[i].challengeBody || fallbacks[i].challengeBody,
        challengeEmoji: parsed[i].challengeEmoji || fallbacks[i].challengeEmoji,
        difficulty: parsed[i].difficulty || fallbacks[i].difficulty,
      })), meta };
    }
    const latencyMs = Date.now() - t0;
    console.warn(`[SocialIcebreakerAI] generatePersonalityDiceChallenges provider=${provider} latency=${latencyMs}ms: invalid response shape (expected ${participants.length} items), using fallback`);
    const meta = buildFallbackAIMeta('parse_error', PERSONALITY_DICE_PROMPT_VERSION);
    logAITrace({ domain: 'icebreaker', feature: 'generatePersonalityDiceChallenges', provider, model, latencyMs, success: false, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
    return { data: fallbacks, meta };
  } catch (error) {
    const latencyMs = Date.now() - t0;
    console.error(`[SocialIcebreakerAI] generatePersonalityDiceChallenges error provider=${provider} latency=${latencyMs}ms:`, error);
    const meta = buildFallbackAIMeta('llm_error', PERSONALITY_DICE_PROMPT_VERSION);
    logAITrace({ domain: 'icebreaker', feature: 'generatePersonalityDiceChallenges', provider, model, latencyMs, success: false, fallbackUsed: true, fromCache: false, promptVersion: meta.promptVersion, errorCode: meta.evaluatorRejectionReason });
    return { data: fallbacks, meta };
  }
}
