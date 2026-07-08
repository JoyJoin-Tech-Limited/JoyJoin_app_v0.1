import { callSocialAI } from './ai/socialModelRouter';
import { DISCUSSION_STYLE_LABELS } from '@shared/constants';
import { logAITrace } from './lib/aiTraceLogger';
import { logger } from './lib/logger';
import { buildAIGCMeta, buildFallbackAIMeta, buildLiveAIMeta, type AIResponseMeta } from '@shared/types/aiMeta';
import { moderateGeneratedContent } from './lib/aiContentModeration';

const CONVERSATION_TOPICS_PROMPT_VERSION = 'conversation-topics-v1';

export interface ParticipantProfile {
  displayName: string;
  archetype?: string | null;
  interests?: string[];
  topicsHappy?: string[];
  topicsAvoid?: string[];
  /** Optional interest signal boost data */
  interestSignals?: Array<{
    interestKey: string;
    interestLabel: string;
    enthusiasmLevel: number;
    discussionStyle: string;
    conversationDepth: number;
  }>;
}

export interface TopicSuggestion {
  topic: string;
  reason: string;
  icebreaker?: string;
}

export interface ConversationTopicsResponse {
  topics: TopicSuggestion[];
  commonInterests: string[];
  generatedAt: string;
  meta: AIResponseMeta;
}

const CONVERSATION_TOPICS_PROMPT = `你是"悦仔"，JoyJoin平台的社交氛围助手。你需要为一群即将见面的用户生成可以聊的话题建议。

## 你的任务
根据参与者的信息，推荐3-5个适合大家一起聊的话题，并为每个话题提供破冰开场白。

## 推荐原则
1. **兴趣重合**：优先找出参与者的共同兴趣点
2. **轻松有趣**：话题要让人感到轻松，不尴尬
3. **有互动性**：话题能让大家都参与进来
4. **避免敏感**：避免政治、宗教、薪资等敏感话题

## 社交原型参考
- corgi/rooster/hamster_praise：高能量，喜欢有趣话题
- koala/温暖金毛：温和，喜欢温馨话题
- cat/turtle：内敛，偏好深度话题
- octopus/fox：创意型，喜欢新奇话题

## 输出格式
返回一个JSON对象：
{
  "topics": [
    {
      "topic": "话题主题（5-15字）",
      "reason": "为什么适合这群人（20-40字）",
      "icebreaker": "具体的开场问题或话术（15-30字）"
    }
  ],
  "commonInterests": ["共同兴趣1", "共同兴趣2"]
}

只返回JSON，不要有其他内容。`;

export async function generateConversationTopics(
  participants: ParticipantProfile[],
  eventType?: string
): Promise<ConversationTopicsResponse> {
  const startedAt = Date.now();

  if (participants.length < 2) {
    logAITrace({
      domain: 'match_explanation',
      feature: 'generateConversationTopics',
      provider: null,
      latencyMs: Date.now() - startedAt,
      success: false,
      fallbackUsed: true,
      fromCache: false,
      promptVersion: CONVERSATION_TOPICS_PROMPT_VERSION,
      errorCode: 'insufficient_participants',
    });
    return getDefaultTopics(participants);
  }

  const archetypes = participants.map(p => p.archetype).filter(Boolean);
  const allInterests = participants.flatMap(p => p.interests || []);
  const allTopicsHappy = participants.flatMap(p => p.topicsHappy || []);
  const allTopicsAvoid = participants.flatMap(p => p.topicsAvoid || []);

  const interestCounts = allInterests.reduce((acc, interest) => {
    acc[interest] = (acc[interest] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const commonInterests = Object.entries(interestCounts)
    .filter(([_, count]) => count >= 2)
    .map(([interest]) => interest)
    .slice(0, 5);

  // Collect aligned interest signals (same interest key shared by ≥2 participants)
  const signalMap = new Map<string, { label: string; styles: string[]; depths: number[] }>();
  participants.forEach(p => {
    (p.interestSignals || []).forEach(sig => {
      const entry = signalMap.get(sig.interestKey) ?? { label: sig.interestLabel, styles: [], depths: [] };
      entry.styles.push(sig.discussionStyle);
      entry.depths.push(sig.conversationDepth);
      signalMap.set(sig.interestKey, entry);
    });
  });
  const sharedSignals = Array.from(signalMap.entries())
    .filter(([_, v]) => v.styles.length >= 2)
    .map(([_, v]) => {
      const styleCounts = new Map<string, number>();
      v.styles.forEach(s => styleCounts.set(s, (styleCounts.get(s) || 0) + 1));
      const dominant = Array.from(styleCounts.entries()).sort((a, b) => b[1] - a[1])[0][0];
      const avgDepth = Math.round(v.depths.reduce((a, c) => a + c, 0) / v.depths.length);
      return `${v.label}（${DISCUSSION_STYLE_LABELS[dominant] || dominant}，深度${avgDepth}/3）`;
    })
    .slice(0, 3);

  const userPrompt = `## 参与者信息
人数：${participants.length}人
昵称：${participants.map(p => p.displayName).join('、')}
社交原型：${archetypes.join('、') || '未知'}
共同兴趣：${commonInterests.length > 0 ? commonInterests.join('、') : '待发现'}
个人兴趣：${Array.from(new Set(allInterests)).slice(0, 8).join('、') || '未知'}
偏好话题：${Array.from(new Set(allTopicsHappy)).slice(0, 5).join('、') || '未知'}
避免话题：${Array.from(new Set(allTopicsAvoid)).slice(0, 3).join('、') || '无'}
${sharedSignals.length > 0 ? `兴趣偏好信号（成员自填）：${sharedSignals.join('；')}` : ''}
${eventType ? `活动类型：${eventType}` : ''}

请生成3-5个适合这群人的话题建议。`;

  try {
    const result = await callSocialAI({
      messages: [
        { role: 'system', content: CONVERSATION_TOPICS_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.8,
      max_tokens: 600,
      callerTag: 'conversationTopics',
      socialFunction: 'generateConversationTopics',
    });

    const meta = buildLiveAIMeta(result.provider, CONVERSATION_TOPICS_PROMPT_VERSION);
    logAITrace({
      domain: 'match_explanation',
      feature: 'generateConversationTopics',
      provider: result.provider,
      model: result.model,
      latencyMs: result.latencyMs,
      success: true,
      fallbackUsed: result.fallbackUsed,
      fromCache: false,
      promptVersion: CONVERSATION_TOPICS_PROMPT_VERSION,
    });

    const jsonMatch = result.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      logAITrace({
        domain: 'match_explanation',
        feature: 'generateConversationTopics',
        provider: result.provider,
        model: result.model,
        latencyMs: result.latencyMs,
        success: false,
        fallbackUsed: true,
        fromCache: false,
        promptVersion: CONVERSATION_TOPICS_PROMPT_VERSION,
        errorCode: 'parse_error',
      });
      return getDefaultTopics(participants, 'parse_error');
    }

    let parsed: {
      topics: TopicSuggestion[];
      commonInterests: string[];
    };
    try {
      parsed = JSON.parse(jsonMatch[0]) as {
        topics: TopicSuggestion[];
        commonInterests: string[];
      };
    } catch {
      logAITrace({
        domain: 'match_explanation',
        feature: 'generateConversationTopics',
        provider: result.provider,
        model: result.model,
        latencyMs: result.latencyMs,
        success: false,
        fallbackUsed: true,
        fromCache: false,
        promptVersion: CONVERSATION_TOPICS_PROMPT_VERSION,
        errorCode: 'parse_error',
      });
      return getDefaultTopics(participants, 'parse_error');
    }

    const topics = (parsed.topics || []).slice(0, 5);
    const moderationChecks = topics.flatMap((t, i) => [
      { field: `topic_${i}`, text: t.topic },
      { field: `reason_${i}`, text: t.reason },
      { field: `icebreaker_${i}`, text: t.icebreaker },
    ]);
    const moderation = moderateGeneratedContent(moderationChecks, {
      domain: 'match_explanation',
      feature: 'generateConversationTopics',
      provider: meta.provider,
      model: result.model,
      latencyMs: result.latencyMs,
      promptVersion: CONVERSATION_TOPICS_PROMPT_VERSION,
    });
    if (!moderation.safe) {
      return getDefaultTopics(participants, 'content_safety');
    }

    return {
      topics,
      commonInterests: parsed.commonInterests || commonInterests,
      generatedAt: new Date().toISOString(),
      meta: {
        ...meta,
        aigc: buildAIGCMeta({ fallbackUsed: meta.fallbackUsed, labelType: 'ai-generated' }),
      },
    };
  } catch (error) {
    logger.error('Conversation topics generation error', { operation: 'generateConversationTopics', error: error instanceof Error ? error.message : String(error) });
    logAITrace({
      domain: 'match_explanation',
      feature: 'generateConversationTopics',
      provider: null,
      latencyMs: Date.now() - startedAt,
      success: false,
      fallbackUsed: true,
      fromCache: false,
      promptVersion: CONVERSATION_TOPICS_PROMPT_VERSION,
      errorCode: 'llm_error',
    });
    return getDefaultTopics(participants, 'llm_error');
  }
}

function getDefaultTopics(
  participants: ParticipantProfile[],
  reason: 'insufficient_participants' | 'parse_error' | 'llm_error' | 'content_safety' = 'insufficient_participants',
): ConversationTopicsResponse {
  const allInterests = participants.flatMap(p => p.interests || []);
  const uniqueInterests = [...new Set(allInterests)].slice(0, 3);

  const defaultTopics: TopicSuggestion[] = [
    {
      topic: '最近发现的好地方',
      reason: '分享生活发现，轻松开场',
      icebreaker: '最近有没有发现什么宝藏餐厅或者好玩的地方？',
    },
    {
      topic: '周末都在做什么',
      reason: '了解大家的生活节奏和爱好',
      icebreaker: '你们周末一般怎么安排啊？',
    },
    {
      topic: '最近在追什么剧/综艺',
      reason: '影视话题容易引起共鸣',
      icebreaker: '最近有没有什么好看的剧推荐？',
    },
  ];

  if (uniqueInterests.includes('美食') || uniqueInterests.includes('探店')) {
    defaultTopics.unshift({
      topic: '美食探店心得',
      reason: '大家都对美食感兴趣',
      icebreaker: '你们最近有没有去过什么好吃的店？',
    });
  }

  return {
    topics: defaultTopics.slice(0, 4),
    commonInterests: uniqueInterests,
    generatedAt: new Date().toISOString(),
    meta: buildFallbackAIMeta(reason, CONVERSATION_TOPICS_PROMPT_VERSION),
  };
}
