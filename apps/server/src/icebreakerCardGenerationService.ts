import { topicCards, type TopicCard } from '@shared/topicCards';
import { calculateAge } from '@shared/utils';
import { getDeepseekClient, getDeepseekModel } from './ai/deepseekClient';
import { logger } from './lib/logger';

const deepseekApiKey = process.env.DEEPSEEK_API_KEY;

if (!deepseekApiKey) {
  logger.warn(
    'DEEPSEEK_API_KEY environment variable is not set. AI card generation will be disabled, falling back to curated cards only.',
    { component: 'CardGen' }
  );
}

export interface UserPersonalityData {
  // Six-dimension personality scores
  traitScores?: {
    A?: number; // Affinity
    C?: number; // Conscientiousness
    E?: number; // Emotional Stability
    O?: number; // Openness
    X?: number; // Extraversion
    P?: number; // Positivity
  };
  primaryArchetype?: string;
  secondaryArchetype?: string;
  
  // Essential data
  birthdate?: string;
  gender?: string;
  educationLevel?: string;
  industryCategory?: string;
  industrySegment?: string;
  relationshipStatus?: string;
  
  // Extended data
  interests?: string[];
  topPriorities?: Array<{ topicId: string; label: string; heat: number }>;
  intent?: string[];
  conversationMode?: string;
  conversationEnergy?: number;
}

export interface GeneratedCard {
  cardType: 'question' | 'vote' | 'mission';
  content: string;
  hint?: string;
  category?: string;
  difficulty: 'easy' | 'medium' | 'deep';
  aiRecommendReason?: string;
  
  // Vote-specific fields
  voteOptions?: Array<{ id: string; text: string; emoji?: string }>;
  
  // Mission-specific fields
  missionType?: 'group_challenge' | 'pair_challenge' | 'individual_share';
  unlockCondition?: string;
}

const CARD_GENERATION_PROMPT = `你是"小悦"，JoyJoin的破冰卡牌生成助手。你需要为一个活动生成个性化的破冰卡牌。

## 卡牌类型
1. **问题卡 (question)**: 引发有趣对话的问题
2. **投票卡 (vote)**: 快速表达观点的选择题（2-4个选项）
3. **任务卡 (mission)**: 小组挑战或互动任务

## 设计原则
1. **低信息密度**: 每张卡只有一个核心问题/投票/任务 + 一个简短提示
2. **个性化**: 基于参与者的性格原型、兴趣、行业背景定制
3. **难度分级**:
   - easy (聊着玩): 轻松、有趣、容易回答
   - medium (有点意思): 需要思考，但不会太私密
   - deep (走心聊): 深入、真诚、促进连接
4. **场景适配**: 适合线下面对面交流，不需要复杂操作
5. **简洁清晰**: 问题清晰，提示精炼（10字以内）

## 社交原型特点
- corgi/rooster: 高能量，喜欢活跃话题和游戏
- koala/温暖金毛: 善于倾听，喜欢温暖真诚的分享
- cat/turtle: 内敛深度，适合小组讨论而非大型活动
- owl: 喜欢深度思考和哲学话题
- octopus/fox: 创意型，喜欢脑洞和新奇话题
- spider/dolphin_calm: 社交达人，擅长破冰
- hamster_praise: 积极乐观，喜欢正能量话题
- elephant: 稳重，适合结构化讨论

## 输出格式
返回一个JSON对象：
{
  "cardType": "question" | "vote" | "mission",
  "content": "卡牌主内容（问题/投票主题/任务描述）",
  "hint": "简短提示（10字以内，可选）",
  "category": "话题分类（创意话题/美食话题/旅行话题等）",
  "difficulty": "easy" | "medium" | "deep",
  "aiRecommendReason": "推荐理由（15字以内，解释为什么适合这群人）",
  
  // 仅投票卡需要
  "voteOptions": [
    {"id": "opt1", "text": "选项文字", "emoji": "😊"},
    {"id": "opt2", "text": "选项文字", "emoji": "🤔"}
  ],
  
  // 仅任务卡需要
  "missionType": "group_challenge" | "pair_challenge" | "individual_share",
  "unlockCondition": "解锁条件说明"
}

只返回JSON，不要有任何其他文字。`;

export async function generateAICards(
  attendees: UserPersonalityData[],
  roundNumber: number,
  cardsCount: number = 2,
  eventType?: string
): Promise<GeneratedCard[]> {
  // If no API key or no attendees, fall back to curated cards
  if (!deepseekApiKey) {
    logger.warn('[CardGen] DeepSeek API key not set, using fallback cards');
    return getFallbackCards(cardsCount, roundNumber);
  }
  
  if (attendees.length === 0) {
    logger.info('No attendees, using fallback cards', { component: 'CardGen' });
    return getFallbackCards(cardsCount, roundNumber);
  }

  // Extract group characteristics
  const archetypes = attendees.map(a => a.primaryArchetype).filter(Boolean);
  const allInterests = attendees.flatMap(a => a.interests || []).filter(Boolean);
  const interestCounts: Record<string, number> = {};
  allInterests.forEach(interest => {
    interestCounts[interest] = (interestCounts[interest] || 0) + 1;
  });
  const commonInterests = Object.entries(interestCounts)
    .filter(([_, count]) => count > 1)
    .map(([interest]) => interest)
    .slice(0, 5);

  const industries = attendees.map(a => a.industryCategory).filter(Boolean);
  const attendeesWithBirthdate = attendees.filter(a => a.birthdate) as Array<typeof attendees[0] & { birthdate: string }>;
  const avgAge = attendeesWithBirthdate.length > 0
    ? attendeesWithBirthdate.reduce((sum, a) => sum + calculateAge(a.birthdate), 0) / attendeesWithBirthdate.length
    : NaN;
  
  // Calculate average personality traits
  const avgTraits: Record<string, number> = {};
  ['A', 'C', 'E', 'O', 'X', 'P'].forEach(trait => {
    const scores = attendees
      .map(a => a.traitScores?.[trait as keyof typeof a.traitScores])
      .filter(s => s !== undefined) as number[];
    if (scores.length > 0) {
      avgTraits[trait] = scores.reduce((sum, s) => sum + s, 0) / scores.length;
    }
  });

  const userPrompt = `## 活动信息
参与人数: ${attendees.length}人
平均年龄: ${avgAge ? Math.round(avgAge) : '未知'}岁
活动类型: ${eventType || '饭局'}
当前轮次: 第${roundNumber}轮/共5轮

## 群体特征
社交原型分布: ${archetypes.join('、') || '未知'}
共同兴趣: ${commonInterests.length > 0 ? commonInterests.join('、') : '多元化'}
行业分布: ${industries.length > 0 ? Array.from(new Set(industries)).join('、') : '多元化'}
平均外向性(X): ${avgTraits.X ? avgTraits.X.toFixed(1) : '未知'}
平均开放性(O): ${avgTraits.O ? avgTraits.O.toFixed(1) : '未知'}

## 轮次策略
- 第1轮: 以easy难度为主，帮助破冰
- 第2-3轮: medium难度，深入了解
- 第4-5轮: 可以有deep难度，促进深度连接

请生成${cardsCount}张破冰卡牌（包含至少1张问题卡和1张投票卡）。`;

  try {
    const response = await getDeepseekClient().chat.completions.create({
      model: getDeepseekModel('flash'),
      messages: [
        { role: 'system', content: CARD_GENERATION_PROMPT },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.85,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      logger.info('No AI response, using fallback', { component: 'CardGen' });
      return getFallbackCards(cardsCount, roundNumber);
    }

    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch (parseError) {
      logger.error(
        'Failed to parse AI JSON response. Falling back to curated cards.',
        { component: 'CardGen', rawContent: content.substring(0, 200), error: parseError instanceof Error ? parseError.message : String(parseError) }
      );
      return getFallbackCards(cardsCount, roundNumber);
    }
    
    // Handle both single card and array responses
    let cards: GeneratedCard[] = [];
    if (Array.isArray(parsed)) {
      cards = parsed;
    } else if (parsed.cards && Array.isArray(parsed.cards)) {
      cards = parsed.cards;
    } else {
      cards = [parsed];
    }

    // Validate cards
    const validCards = cards.filter(card => 
      card.cardType && 
      card.content && 
      card.difficulty &&
      ['question', 'vote', 'mission'].includes(card.cardType)
    ).slice(0, cardsCount);

    if (validCards.length === 0) {
      logger.info('No valid cards from AI, using fallback', { component: 'CardGen' });
      return getFallbackCards(cardsCount, roundNumber);
    }

    logger.info('Generated AI cards', { component: 'CardGen', cardCount: validCards.length, roundNumber });
    return validCards;
  } catch (error) {
    logger.error('AI generation error', { component: 'CardGen', error: error instanceof Error ? error.message : String(error) });
    return getFallbackCards(cardsCount, roundNumber);
  }
}

export function getFallbackCards(count: number, roundNumber: number): GeneratedCard[] {
  // Use curated topic cards as fallback
  const availableCards = topicCards.filter(card => {
    if (roundNumber <= 2) {
      return card.difficulty === 'easy' || card.difficulty === 'medium';
    }
    return true;
  });

  const selectedTopics = [];
  for (let i = 0; i < Math.min(count, availableCards.length); i++) {
    const randomIndex = Math.floor(Math.random() * availableCards.length);
    selectedTopics.push(availableCards[randomIndex]);
    availableCards.splice(randomIndex, 1);
  }

  const cards: GeneratedCard[] = selectedTopics.map(topic => ({
    cardType: 'question',
    content: topic.question,
    category: topic.category,
    difficulty: topic.difficulty,
    hint: '分享你的想法',
    aiRecommendReason: topic.targetDynamic || '适合当前氛围',
  }));

  // Add a vote card if we have room
  if (count > 1 && cards.length < count) {
    cards.push(generateFallbackVoteCard(roundNumber));
  }

  return cards;
}

function generateFallbackVoteCard(roundNumber: number): GeneratedCard {
  const voteCards = [
    {
      content: '如果有一天可以穿越，你最想去哪个时代？',
      options: [
        { id: 'ancient', text: '古代', emoji: '🏛️' },
        { id: 'renaissance', text: '文艺复兴', emoji: '🎨' },
        { id: 'future', text: '未来', emoji: '🚀' },
      ],
      category: '创意话题',
      difficulty: 'easy' as const,
    },
    {
      content: '周末理想的一天是什么样的？',
      options: [
        { id: 'adventure', text: '探索冒险', emoji: '🏔️' },
        { id: 'relax', text: '宅家放松', emoji: '🏠' },
        { id: 'social', text: '朋友聚会', emoji: '🎉' },
        { id: 'culture', text: '文化活动', emoji: '🎭' },
      ],
      category: '生活话题',
      difficulty: 'easy' as const,
    },
    {
      content: '在团队中，你更喜欢哪个角色？',
      options: [
        { id: 'leader', text: '领导者', emoji: '👑' },
        { id: 'creator', text: '创意者', emoji: '💡' },
        { id: 'executor', text: '执行者', emoji: '⚡' },
        { id: 'supporter', text: '支持者', emoji: '🤝' },
      ],
      category: '个性话题',
      difficulty: 'medium' as const,
    },
  ];

  const selected = voteCards[roundNumber % voteCards.length];
  return {
    cardType: 'vote',
    content: selected.content,
    category: selected.category,
    difficulty: selected.difficulty,
    hint: '快速投票',
    voteOptions: selected.options,
    aiRecommendReason: '快速了解大家的偏好',
  };
}

export async function generateMixedCards(
  attendees: UserPersonalityData[],
  roundNumber: number,
  totalCards: number = 3,
  aiRatio: number = 70 // percentage
): Promise<{ cards: GeneratedCard[]; sources: Array<'ai' | 'curated'> }> {
  const aiCount = Math.round(totalCards * (aiRatio / 100));
  const curatedCount = totalCards - aiCount;

  const cards: GeneratedCard[] = [];
  const sources: Array<'ai' | 'curated'> = [];

  // Generate AI cards
  if (aiCount > 0) {
    const aiCards = await generateAICards(attendees, roundNumber, aiCount);
    cards.push(...aiCards);
    sources.push(...Array(aiCards.length).fill('ai' as const));
  }

  // Add curated cards
  if (curatedCount > 0) {
    const curatedCards = getFallbackCards(curatedCount, roundNumber);
    cards.push(...curatedCards);
    sources.push(...Array(curatedCards.length).fill('curated' as const));
  }

  // Shuffle to mix AI and curated
  const combined = cards.map((card, i) => ({ card, source: sources[i] }));
  for (let i = combined.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [combined[i], combined[j]] = [combined[j], combined[i]];
  }

  return {
    cards: combined.map(c => c.card),
    sources: combined.map(c => c.source),
  };
}
