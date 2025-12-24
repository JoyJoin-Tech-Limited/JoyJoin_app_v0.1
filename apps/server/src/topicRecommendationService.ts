import OpenAI from 'openai';
import type { TopicCard } from '@joyjoin/shared/topicCards';
import { 
  getExpandedRecommendedTopics, 
  getRecommendedTopics,
  universalTopics,
  energyBasedTopics 
} from '@joyjoin/shared/topicCards';

const deepseekClient = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com',
});

export interface ParticipantProfile {
  displayName: string;
  archetype: string;
  interests?: string[];
  topicsHappy?: string[];
  topicsAvoid?: string[];
}

export interface RecommendedTopicWithReason {
  topic: TopicCard;
  reason: string;
  score: number;
}

const TOPIC_RECOMMENDATION_PROMPT = `你是"小悦"，JoyJoin平台的社交氛围助手。你需要为一群准备破冰的用户推荐合适的话题。

## 你的任务
根据参与者的社交角色原型（archetype）和兴趣爱好，从提供的话题库中筛选最合适的话题，并为每个话题生成个性化的推荐理由。

## 推荐原则
1. **角色互补**：考虑不同社交原型的互动化学反应
2. **兴趣重合**：找出参与者共同的兴趣话题
3. **难度递进**：推荐从简单到深入的话题梯度
4. **氛围匹配**：根据整体能量水平选择合适的话题
5. **避免敏感**：考虑用户不想聊的话题

## 社交原型简介
- 开心柯基/太阳鸡/夸夸豚：高能量、外向、善于活跃气氛
- 暖心熊/温暖金毛：温暖、善于倾听、营造舒适氛围
- 隐身猫/稳如龟：低能量、内敛、偏好深度交流
- 沉思猫头鹰：深度思考者、喜欢有意义的对话
- 灵感章鱼/机智狐：创意型、好奇心强、喜欢新奇话题
- 织网蛛/淡定海豚：社交达人、善于串联人脉
- 定心大象：稳重可靠、给人安全感

## 输出格式
返回一个JSON数组，每个元素包含：
- topicIndex: 话题在输入列表中的索引（从0开始）
- reason: 推荐理由（15-30字，口语化，体现为什么适合这群人）
- score: 推荐分数（1-100，越高越推荐）

示例：
[
  {"topicIndex": 0, "reason": "正好有两位创意型选手，这个话题能激发脑洞碰撞！", "score": 95},
  {"topicIndex": 3, "reason": "大家都喜欢旅行，聊起来肯定很投缘～", "score": 88}
]

只返回JSON数组，不要有其他内容。`;

export async function getAIRecommendedTopics(
  participants: ParticipantProfile[],
  atmosphereType: string,
  topicCount: number = 5
): Promise<RecommendedTopicWithReason[]> {
  const archetypes = participants.map(p => p.archetype).filter(Boolean);
  const allInterests = participants.flatMap(p => p.interests || []);
  const allTopicsHappy = participants.flatMap(p => p.topicsHappy || []);
  const allTopicsAvoid = participants.flatMap(p => p.topicsAvoid || []);
  
  const candidateTopics = getExpandedRecommendedTopics(archetypes, atmosphereType, 15);
  
  if (candidateTopics.length === 0) {
    return universalTopics.slice(0, topicCount).map(topic => ({
      topic,
      reason: '轻松有趣，适合破冰开场～',
      score: 70,
    }));
  }

  try {
    const userPrompt = `## 参与者信息
人数：${participants.length}人
社交原型：${archetypes.join('、') || '未知'}
共同兴趣：${Array.from(new Set(allInterests)).slice(0, 5).join('、') || '未知'}
偏好话题：${Array.from(new Set(allTopicsHappy)).slice(0, 5).join('、') || '未知'}
避免话题：${Array.from(new Set(allTopicsAvoid)).slice(0, 3).join('、') || '无'}
整体氛围：${atmosphereType}

## 候选话题库
${candidateTopics.map((t, i) => `${i}. [${t.category}] ${t.question} (难度: ${t.difficulty})`).join('\n')}

请从以上话题中选择${topicCount}个最合适的话题，并生成推荐理由。`;

    const response = await deepseekClient.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: TOPIC_RECOMMENDATION_PROMPT },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    const content = response.choices[0]?.message?.content || '';
    
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('Invalid response format');
    }

    const recommendations = JSON.parse(jsonMatch[0]) as Array<{
      topicIndex: number;
      reason: string;
      score: number;
    }>;

    const results: RecommendedTopicWithReason[] = recommendations
      .filter(r => r.topicIndex >= 0 && r.topicIndex < candidateTopics.length)
      .map(r => ({
        topic: candidateTopics[r.topicIndex],
        reason: r.reason,
        score: r.score,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topicCount);

    if (results.length < topicCount) {
      const existingQuestions = new Set(results.map(r => r.topic.question));
      for (const topic of candidateTopics) {
        if (results.length >= topicCount) break;
        if (!existingQuestions.has(topic.question)) {
          results.push({
            topic,
            reason: getDefaultReason(topic, archetypes),
            score: 60,
          });
        }
      }
    }

    return results;
  } catch (error) {
    console.error('AI topic recommendation error:', error);
    return getFallbackRecommendations(candidateTopics, archetypes, topicCount);
  }
}

function getDefaultReason(topic: TopicCard, archetypes: string[]): string {
  const hasCreative = archetypes.some(a => ['灵感章鱼', '机智狐'].includes(a));
  const hasDeep = archetypes.some(a => ['沉思猫头鹰', '稳如龟'].includes(a));
  const hasEnergetic = archetypes.some(a => ['开心柯基', '太阳鸡', '夸夸豚'].includes(a));
  const hasWarm = archetypes.some(a => ['暖心熊', '温暖金毛'].includes(a));

  if (topic.difficulty === 'easy') {
    if (hasEnergetic) return '轻松有趣，活跃气氛刚刚好～';
    if (hasWarm) return '温暖的话题，让大家都能参与～';
    return '简单易聊，适合暖场～';
  }
  
  if (topic.difficulty === 'medium') {
    if (hasCreative) return '这个话题能激发创意碰撞！';
    if (hasDeep) return '有深度又不难开口，很适合～';
    return '话题不深不浅，刚好可以聊开～';
  }
  
  if (topic.difficulty === 'deep') {
    if (hasDeep) return '深度思考者的最爱，聊起来会很有收获～';
    return '稍微有点深度，适合进一步了解彼此～';
  }

  return '小悦精选推荐～';
}

function getFallbackRecommendations(
  topics: TopicCard[],
  archetypes: string[],
  count: number
): RecommendedTopicWithReason[] {
  return topics.slice(0, count).map((topic, i) => ({
    topic,
    reason: getDefaultReason(topic, archetypes),
    score: 80 - i * 5,
  }));
}

export function getQuickRecommendedTopics(
  archetypes: string[],
  atmosphereType: string,
  count: number = 5
): RecommendedTopicWithReason[] {
  const topics = getRecommendedTopics(archetypes, atmosphereType, count);
  return topics.map((topic, i) => ({
    topic,
    reason: getDefaultReason(topic, archetypes),
    score: 90 - i * 10,
  }));
}

export function getAllTopicsForToolkit(
  archetypes: string[],
  atmosphereType: string
): TopicCard[] {
  const expanded = getExpandedRecommendedTopics(archetypes, atmosphereType, 20);
  
  const allCategories = Object.values(energyBasedTopics).flat();
  const seenQuestions = new Set(expanded.map(t => t.question));
  
  for (const topic of [...universalTopics, ...allCategories]) {
    if (!seenQuestions.has(topic.question)) {
      expanded.push(topic);
      seenQuestions.add(topic.question);
    }
  }
  
  return expanded;
}
