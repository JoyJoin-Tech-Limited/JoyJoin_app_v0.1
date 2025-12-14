import OpenAI from 'openai';

const deepseekClient = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com',
});

export interface ParticipantInfo {
  displayName: string;
  archetype: string | null;
  interests?: string[];
}

const WELCOME_PROMPT = `你是"小悦"，JoyJoin平台的破冰助手。你需要为一群即将开始破冰的用户生成一段温暖、有趣的欢迎语。

## 你的任务
根据参与者信息，生成一段简短（30-50字）的个性化欢迎语，让大家感到轻松和期待。

## 欢迎语原则
1. 温暖友好：让每个人都感到被欢迎
2. 提及亮点：如果有共同兴趣或有趣的原型组合，简单提及
3. 营造期待：让大家对接下来的交流充满期待
4. 简洁口语化：像朋友说话一样自然

## 社交原型简介
- 开心柯基/太阳鸡/夸夸豚：高能量、活跃气氛
- 暖心熊/温暖金毛：温暖、善于倾听
- 隐身猫/稳如龟：内敛、深度交流
- 沉思猫头鹰：深度思考者
- 灵感章鱼/机智狐：创意型、好奇心强
- 织网蛛/淡定海豚：社交达人
- 定心大象：稳重可靠

## 输出要求
直接输出欢迎语文本，不要有任何格式标记或额外解释。`;

const CLOSING_PROMPT = `你是"小悦"，JoyJoin平台的破冰助手。破冰环节结束了，你需要生成一段温馨的结束语。

## 你的任务
根据破冰活动信息，生成一段简短（30-60字）的结束语，让大家带着美好的心情离开。

## 结束语原则
1. 肯定大家：感谢参与，肯定今天的交流
2. 温馨回顾：如果有值得提及的亮点，简单回顾
3. 期待未来：祝福大家，期待下次相遇
4. 简洁温暖：像朋友告别一样自然

## 输出要求
直接输出结束语文本，不要有任何格式标记或额外解释。`;

export async function generateWelcomeMessage(
  participants: ParticipantInfo[],
  eventTitle?: string
): Promise<string> {
  if (participants.length === 0) {
    return '欢迎来到破冰时刻！准备好认识新朋友了吗？';
  }

  const archetypes = participants.map(p => p.archetype).filter(Boolean);
  const allInterests = participants.flatMap(p => p.interests || []);
  const uniqueInterests = Array.from(new Set(allInterests)).slice(0, 5);

  const userPrompt = `## 参与者信息
人数：${participants.length}人
昵称：${participants.map(p => p.displayName).join('、')}
社交原型：${archetypes.join('、') || '未知'}
共同兴趣：${uniqueInterests.join('、') || '未知'}
${eventTitle ? `活动：${eventTitle}` : ''}

请生成一段欢迎语。`;

  try {
    const response = await deepseekClient.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: WELCOME_PROMPT },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.8,
      max_tokens: 150,
    });

    const content = response.choices[0]?.message?.content?.trim();
    return content || getDefaultWelcome(participants);
  } catch (error) {
    console.error('AI welcome message error:', error);
    return getDefaultWelcome(participants);
  }
}

export async function generateClosingMessage(
  participants: ParticipantInfo[],
  durationMinutes: number,
  topicsDiscussed?: string[],
  gamesPlayed?: string[]
): Promise<string> {
  if (participants.length === 0) {
    return '感谢大家的参与，期待下次相遇！';
  }

  const userPrompt = `## 破冰活动信息
参与人数：${participants.length}人
活动时长：约${durationMinutes}分钟
${topicsDiscussed?.length ? `聊过的话题：${topicsDiscussed.slice(0, 3).join('、')}` : ''}
${gamesPlayed?.length ? `玩过的游戏：${gamesPlayed.slice(0, 3).join('、')}` : ''}

请生成一段结束语。`;

  try {
    const response = await deepseekClient.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: CLOSING_PROMPT },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.8,
      max_tokens: 150,
    });

    const content = response.choices[0]?.message?.content?.trim();
    return content || getDefaultClosing(durationMinutes);
  } catch (error) {
    console.error('AI closing message error:', error);
    return getDefaultClosing(durationMinutes);
  }
}

function getDefaultWelcome(participants: ParticipantInfo[]): string {
  const count = participants.length;
  const hasHighEnergy = participants.some(p => 
    ['开心柯基', '太阳鸡', '夸夸豚'].some(a => p.archetype?.includes(a))
  );
  const hasWarm = participants.some(p => 
    ['暖心熊', '温暖金毛'].some(a => p.archetype?.includes(a))
  );

  if (hasHighEnergy) {
    return `哇～${count}位小伙伴都到齐啦！看到有活力派在场，今天的破冰一定很热闹！准备好了吗？`;
  }
  if (hasWarm) {
    return `欢迎${count}位小伙伴！感觉今天的氛围会特别温馨～让我们开始轻松愉快的破冰吧！`;
  }
  return `${count}位小伙伴都到齐啦！准备好开始一段有趣的破冰之旅了吗？Let's go！`;
}

function getDefaultClosing(durationMinutes: number): string {
  if (durationMinutes > 30) {
    return `哇，不知不觉聊了${durationMinutes}分钟！时间过得真快～感谢大家今天的分享，期待下次再见！`;
  }
  if (durationMinutes > 15) {
    return `${durationMinutes}分钟的破冰很精彩！感谢大家的参与，希望今天交到了新朋友～下次见！`;
  }
  return '短暂但精彩的破冰！期待大家在活动中继续愉快交流～';
}

export async function generateQuickWelcome(
  participantCount: number,
  archetypes: string[]
): Promise<string> {
  const hasHighEnergy = archetypes.some(a => 
    ['开心柯基', '太阳鸡', '夸夸豚'].some(t => a.includes(t))
  );
  const hasCreative = archetypes.some(a => 
    ['灵感章鱼', '机智狐'].some(t => a.includes(t))
  );
  const hasDeep = archetypes.some(a => 
    ['沉思猫头鹰', '稳如龟', '隐身猫'].some(t => a.includes(t))
  );
  const hasWarm = archetypes.some(a => 
    ['暖心熊', '温暖金毛'].some(t => a.includes(t))
  );

  if (hasHighEnergy && hasCreative) {
    return `哇！${participantCount}位创意活力派小伙伴集合完毕，今天的脑洞碰撞一定超精彩！`;
  }
  if (hasHighEnergy) {
    return `${participantCount}位小伙伴到齐！有活力派在场，今天的破冰一定很热闘！准备嗨起来～`;
  }
  if (hasWarm && hasDeep) {
    return `欢迎${participantCount}位小伙伴！温暖的倾听者 + 深度思考者，今天的交流会很有质量！`;
  }
  if (hasWarm) {
    return `${participantCount}位小伙伴都到啦！感觉今天会是一场温馨又舒服的破冰～`;
  }
  if (hasDeep) {
    return `${participantCount}位小伙伴集合！看来今天会有很多有深度的对话，准备好分享了吗？`;
  }
  if (hasCreative) {
    return `${participantCount}位创意型选手就位！今天的话题可能会很有趣哦～`;
  }
  return `${participantCount}位小伙伴都到齐啦！准备好开始有趣的破冰了吗？Let's go！`;
}
