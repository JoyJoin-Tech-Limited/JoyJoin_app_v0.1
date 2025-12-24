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

const GAME_RECOMMENDATION_PROMPT = `你是"小悦"，JoyJoin平台的智能破冰助手。你需要根据参与者的画像，从游戏列表中推荐最适合当前群体氛围的破冰游戏。

## 可选游戏列表
以下是所有可选的破冰游戏（格式：id | 名称 | 场景 | 类型 | 难度 | 人数 | 描述）：
{GAMES_LIST}

## 社交原型特点
- 开心柯基/太阳鸡/夸夸豚：高能量、活跃气氛、喜欢热闹互动
- 暖心熊：温暖、善于倾听、喜欢深度交流
- 隐身猫/稳如龟：内敛、偏好安静、适合低压力游戏
- 沉思猫头鹰：深度思考者、喜欢有意义的话题
- 灵感章鱼/机智狐：创意型、好奇心强、喜欢脑洞游戏
- 织网蛛/淡定海豚：社交达人、适应力强
- 定心大象：稳重可靠、适合引导型游戏

## 推荐原则
1. 人数匹配：游戏的minPlayers和maxPlayers要覆盖当前参与人数
2. 氛围匹配：根据群体原型组合推荐合适的游戏类型
   - 高能量群体 → 推荐 active/quick 类型
   - 内敛群体 → 推荐 deep/creative 类型，避免太激烈的游戏
   - 混合群体 → 推荐 both 场景的通用游戏
3. 场景考虑：dinner场景适合安静一些，bar场景可以更活跃
4. 难度平衡：首次破冰建议选择 easy 或 medium 难度

## 输出格式
请严格按以下JSON格式输出，不要有任何其他内容：
{"gameId": "游戏ID", "reason": "推荐理由（20-40字，口语化，提及群体特点）"}`;

export interface GameRecommendationResult {
  gameId: string;
  gameName: string;
  reason: string;
}

interface GameInfo {
  id: string;
  name: string;
  scene: string;
  category: string;
  difficulty: string;
  minPlayers: number;
  maxPlayers: number;
  description: string;
}

export async function recommendGameForParticipants(
  participants: ParticipantInfo[],
  games: GameInfo[],
  scene?: 'dinner' | 'bar' | 'both'
): Promise<GameRecommendationResult> {
  const participantCount = participants.length;
  
  const eligibleGames = games.filter(g => 
    g.minPlayers <= participantCount && 
    g.maxPlayers >= participantCount &&
    (!scene || scene === 'both' || g.scene === scene || g.scene === 'both')
  );
  
  if (eligibleGames.length === 0) {
    const fallbackGame = games[0];
    return {
      gameId: fallbackGame.id,
      gameName: fallbackGame.name,
      reason: `${participantCount}人刚刚好可以玩这个游戏，简单有趣，先热热场！`
    };
  }

  const gamesListStr = eligibleGames.map(g => 
    `${g.id} | ${g.name} | ${g.scene} | ${g.category} | ${g.difficulty} | ${g.minPlayers}-${g.maxPlayers}人 | ${g.description}`
  ).join('\n');

  const archetypes = participants.map(p => p.archetype).filter((a): a is string => !!a);
  const allInterests = participants.flatMap(p => p.interests || []);
  const uniqueInterests = Array.from(new Set(allInterests)).slice(0, 5);

  const userPrompt = `## 参与者信息
人数：${participantCount}人
社交原型：${archetypes.length > 0 ? archetypes.join('、') : '未知'}
共同兴趣：${uniqueInterests.length > 0 ? uniqueInterests.join('、') : '未知'}
场景：${scene === 'dinner' ? '饭局' : scene === 'bar' ? '酒局' : '通用'}

请从游戏列表中推荐最适合这个群体的游戏。`;

  const systemPrompt = GAME_RECOMMENDATION_PROMPT.replace('{GAMES_LIST}', gamesListStr);

  try {
    const response = await deepseekClient.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 200,
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (content) {
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          const recommendedGame = eligibleGames.find(g => g.id === parsed.gameId);
          if (recommendedGame) {
            return {
              gameId: parsed.gameId,
              gameName: recommendedGame.name,
              reason: parsed.reason || `这个游戏很适合${participantCount}人一起玩！`
            };
          }
        }
      } catch (parseError) {
        console.error('Failed to parse AI game recommendation:', parseError);
      }
    }
  } catch (error) {
    console.error('AI game recommendation error:', error);
  }

  const fallbackGame = eligibleGames[Math.floor(Math.random() * eligibleGames.length)];
  return {
    gameId: fallbackGame.id,
    gameName: fallbackGame.name,
    reason: getDefaultGameReason(fallbackGame, participantCount, archetypes)
  };
}

function getDefaultGameReason(game: GameInfo, count: number, archetypes: string[]): string {
  const hasHighEnergy = archetypes.some(a => 
    ['开心柯基', '太阳鸡', '夸夸豚'].some(t => a.includes(t))
  );
  const hasCreative = archetypes.some(a => 
    ['灵感章鱼', '机智狐'].some(t => a.includes(t))
  );
  
  if (game.category === 'quick') {
    return `${count}人玩这个刚刚好，快速热场，${hasHighEnergy ? '活力派会很喜欢！' : '简单有趣！'}`;
  }
  if (game.category === 'creative') {
    return `看到有${hasCreative ? '创意型选手' : '小伙伴'}，这个脑洞游戏很适合你们！`;
  }
  if (game.category === 'deep') {
    return `这个游戏可以让大家更深入地了解彼此，${count}人聊起来刚刚好～`;
  }
  return `${count}人一起玩这个游戏，互动感十足！`;
}
