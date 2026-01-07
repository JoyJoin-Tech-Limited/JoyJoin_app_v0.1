import OpenAI from 'openai';
import { XIAOYUE_PERSONA, GENDER_NEUTRAL } from './prompts';

const deepseekClient = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com',
});

export interface ArchetypeAnalysisInput {
  archetype: string;
  traitScores: {
    affinity: number;
    openness: number;
    conscientiousness: number;
    emotionalStability: number;
    extraversion: number;
    positivity: number;
  };
  questionPath?: string[];
  confidence?: number;
}

export interface XiaoyueAnalysisResult {
  analysis: string;
  cached: boolean;
}

const analysisCache = new Map<string, { analysis: string; timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 60;

function getCacheKey(input: ArchetypeAnalysisInput): string {
  return `${input.archetype}_${Object.values(input.traitScores).map(v => Math.round(v * 100)).join('_')}`;
}

function buildAnalysisPrompt(input: ArchetypeAnalysisInput): string {
  const { archetype, traitScores } = input;
  
  const traitLabels: Record<string, string> = {
    affinity: '亲和力',
    openness: '开放性',
    conscientiousness: '责任心',
    emotionalStability: '情绪稳定性',
    extraversion: '外向性',
    positivity: '正能量性',
  };
  
  const traitSummary = Object.entries(traitScores)
    .map(([key, value]) => {
      const normalizedValue = value <= 1 ? Math.round(value * 100) : Math.round(value);
      return `- ${traitLabels[key]}: ${normalizedValue}/100`;
    })
    .join('\n');

  const topTraits = Object.entries(traitScores)
    .map(([key, value]) => ({
      name: traitLabels[key],
      score: value <= 1 ? value * 100 : value,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map(t => t.name);

  const lowTraits = Object.entries(traitScores)
    .map(([key, value]) => ({
      name: traitLabels[key],
      score: value <= 1 ? value * 100 : value,
    }))
    .sort((a, b) => a.score - b.score)
    .slice(0, 2)
    .map(t => t.name);

  return `你是一个性格测试结果解读专家。用户刚完成性格测试，测出的原型是"${archetype}"。

用户的六维特质分数：
${traitSummary}

用户的突出特质：${topTraits.join('、')}
用户的相对较弱特质：${lowTraits.join('、')}

请用3-4句话，以第二人称"你"的口吻，给用户一段个性化的解读。

要求：
1. 开头用共情/场景共鸣引出原型气质，不要以分数或"测试结果"开场
2. 结合高低特质做洞察，用"情境偏好+主动选择"描述弱项，避免贴缺陷标签
3. 用理解性语言，语气自信但不评判，像老朋友聊天，避免感叹号和过度热情
4. 结尾给出1-2条具体可执行的微行动建议（可用"可以尝试/下次可以先做…"），不要开放式问句

示例风格：
"你身上有${archetype}的劲儿，能量在人群里不容易掉线，别人会先被你的热度看见。开放性和外向性更像你在场合里的主动选择，责任心相对收着一点，让你保留机动空间。下次遇到新局，可以提前想好一个轻松话题开场，或先锁定一位同频的人聊两句，再决定要不要把节奏带起来。"`;
}

export async function generateXiaoyueAnalysis(
  input: ArchetypeAnalysisInput
): Promise<XiaoyueAnalysisResult> {
  const cacheKey = getCacheKey(input);
  const cached = analysisCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log('[XiaoyueAnalysis] Cache hit for:', input.archetype);
    return { analysis: cached.analysis, cached: true };
  }

  const systemPrompt = `${XIAOYUE_PERSONA}\n\n${GENDER_NEUTRAL}`;
  const userPrompt = buildAnalysisPrompt(input);

  try {
    const response = await deepseekClient.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 300,
    });

    const analysis = response.choices[0]?.message?.content?.trim() || getDefaultAnalysis(input.archetype);
    
    analysisCache.set(cacheKey, { analysis, timestamp: Date.now() });
    console.log('[XiaoyueAnalysis] Generated for:', input.archetype);
    
    return { analysis, cached: false };
  } catch (error) {
    console.error('[XiaoyueAnalysis] API error:', error);
    return { analysis: getDefaultAnalysis(input.archetype), cached: false };
  }
}

function getDefaultAnalysis(archetype: string): string {
  const defaults: Record<string, string> = {
    "开心柯基": "开心柯基，能量满满的那种。你的正能量和亲和力都不低，这让你在聚会里很容易成为气氛组。不过别忘了，偶尔也给自己充充电。",
    "太阳鸡": "太阳鸡，稳定输出型选手。情绪稳定性和正能量是你的强项，遇到事不慌，还能给别人打气。这种人在饭局上是定海神针。",
    "夸夸豚": "夸夸豚，真诚赞美的行家。亲和力拉满，善于发现别人的闪光点。你给的认可不是客套，是真心觉得对方不错。",
    "机智狐": "机智狐，点子王。开放性高，新东西对你有吸引力，思路也灵活。在聚会上你多半是那个提议去新地方的人。",
    "淡定海豚": "淡定海豚，高情商选手。情绪稳定性和亲和力都不错，能在人群里游刃有余。你的淡定不是冷漠，是心里有数。",
    "织网蛛": "织网蛛，社交连接器。你喜欢撮合人，看到两个人有共同话题会暗暗高兴。这种能力很多人学不来。",
    "暖心熊": "暖心熊，天生的倾听者。亲和力是你的主场，让人愿意敞开心扉。不过也记得给自己留点空间。",
    "灵感章鱼": "灵感章鱼，创意脑洞王。开放性拉满，联想能力强，能把八竿子打不着的东西联系起来。这是创意工作的核心技能。",
    "沉思猫头鹰": "沉思猫头鹰，深度思考派。你更擅长一对一的深聊，热闹场合可能需要预热一下。但你的观点往往一针见血。",
    "定心大象": "定心大象，安全感担当。情绪稳定性和责任心都在线，让人觉得靠谱。出了状况你多半是那个拿主意的。",
    "稳如龟": "稳如龟，慢热但可靠。你看人的眼光准，认定了就是认定了。这种判断力在社交里很稀缺。",
    "隐身猫": "隐身猫，安静的观察者。你不是不想社交，只是大群体让你消耗大。一对一的深度交流才是你的主场。",
  };
  
  return defaults[archetype] || `${archetype}，你的特质组合挺有意思。根据你的测试结果，继续探索一下自己的社交风格。`;
}

export async function prefetchAnalysisIfReady(
  archetype: string,
  traitScores: ArchetypeAnalysisInput['traitScores'],
  confidence: number
): Promise<void> {
  if (confidence < 0.7) {
    console.log('[XiaoyueAnalysis] Skipping prefetch, confidence too low:', confidence);
    return;
  }

  const cacheKey = getCacheKey({ archetype, traitScores });
  if (analysisCache.has(cacheKey)) {
    console.log('[XiaoyueAnalysis] Already cached, skipping prefetch');
    return;
  }

  console.log('[XiaoyueAnalysis] Starting background prefetch for:', archetype);
  generateXiaoyueAnalysis({ archetype, traitScores, confidence }).catch(err => {
    console.error('[XiaoyueAnalysis] Background prefetch failed:', err);
    // Error logged, prefetch is non-critical
  });
}
