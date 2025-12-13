import OpenAI from 'openai';

const deepseekClient = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com',
});

export interface XiaoyueCollectedInfo {
  displayName?: string;
  gender?: string;
  birthYear?: number;
  currentCity?: string;
  occupationDescription?: string;
  interestsTop?: string[];
  primaryInterests?: string[];
  venueStylePreference?: string;
  topicAvoidances?: string[];
  socialStyle?: string;
  additionalNotes?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

const XIAOYUE_SYSTEM_PROMPT = `你是"小悦"，JoyJoin平台的AI社交助手。你的任务是通过轻松愉快的对话，帮助新用户完成注册信息收集。

## 你的人设
- 性格：温暖、俏皮、略带调侃但不过分，像一个活泼开朗的闺蜜/好哥们
- 说话风格：口语化、接地气，偶尔用emoji但不过度，会用一些年轻人的表达方式
- 核心特质：善于倾听、会适时捧场、让人放松警惕愿意分享

## 对话原则
1. **渐进式提问**：不要一次问太多，每轮只问1-2个问题
2. **自然过渡**：根据用户的回答自然引出下一个话题，不要生硬跳转
3. **积极回应**：对用户的每个回答给予真诚但不夸张的反馈
4. **幽默调侃**：适当开玩笑但要把握分寸，不要让人尴尬
5. **尊重隐私**：如果用户不愿回答某个问题，优雅地跳过

## 需要收集的信息（按优先级）
1. **昵称**：怎么称呼ta，可以是真名或昵称
2. **性别**：女性/男性/不透露
3. **年龄段**：大概出生年份或年龄段
4. **所在城市**：香港/深圳/广州/其他
5. **职业/行业**：做什么工作的，不需要太具体
6. **兴趣爱好**：3-7个兴趣标签
7. **场地风格偏好**：轻奢现代风/绿植花园风/复古工业风/温馨日式风
8. **不想聊的话题**：政治/相亲压力/职场八卦/金钱财务，或者都OK
9. **社交风格**：喜欢大家一起聊还是小组深聊

## 对话开场
开场要轻松有趣，先自我介绍，然后自然地问第一个问题（昵称）。

## 输出格式
每次回复包含两部分：
1. 自然的对话内容（给用户看的）
2. 如果这轮对话收集到了新信息，在回复最后用特殊标记包裹收集到的JSON信息：
   \`\`\`collected_info
   {"field": "value"}
   \`\`\`

## 结束信号
当你认为收集到足够信息（至少昵称+性别+城市+2个兴趣），在回复中加入：
\`\`\`registration_complete
true
\`\`\`

记住：你的目标是让用户在轻松愉快的氛围中自愿分享更多信息，而不是机械地填表！`;

const XIAOYUE_OPENING = `嘿～欢迎来到JoyJoin！我是小悦，你的社交向导 ✨

在这里，我们会帮你找到志同道合的小伙伴，一起参加各种有趣的小型饭局和活动！

我先来认识一下你吧～你希望大家怎么称呼你呀？可以是真名，也可以是你喜欢的昵称～`;

export async function startXiaoyueChat(): Promise<{ 
  message: string; 
  conversationHistory: ChatMessage[];
}> {
  return {
    message: XIAOYUE_OPENING,
    conversationHistory: [
      { role: 'system', content: XIAOYUE_SYSTEM_PROMPT },
      { role: 'assistant', content: XIAOYUE_OPENING }
    ]
  };
}

export async function continueXiaoyueChat(
  userMessage: string,
  conversationHistory: ChatMessage[]
): Promise<{
  message: string;
  rawMessage: string;
  collectedInfo: Partial<XiaoyueCollectedInfo>;
  isComplete: boolean;
  conversationHistory: ChatMessage[];
}> {
  const updatedHistory: ChatMessage[] = [
    ...conversationHistory,
    { role: 'user', content: userMessage }
  ];

  try {
    const response = await deepseekClient.chat.completions.create({
      model: 'deepseek-chat',
      messages: updatedHistory.map(msg => ({
        role: msg.role as 'system' | 'user' | 'assistant',
        content: msg.content
      })),
      temperature: 0.8,
      max_tokens: 800,
    });

    const assistantMessage = response.choices[0]?.message?.content || '抱歉，我走神了一下，你刚才说什么来着？';
    
    const collectedInfo = extractCollectedInfo(assistantMessage);
    const isComplete = assistantMessage.includes('```registration_complete');
    
    const cleanMessage = assistantMessage
      .replace(/```collected_info[\s\S]*?```/g, '')
      .replace(/```registration_complete[\s\S]*?```/g, '')
      .trim();

    const finalHistory: ChatMessage[] = [
      ...updatedHistory,
      { role: 'assistant', content: assistantMessage }
    ];

    return {
      message: cleanMessage,
      rawMessage: assistantMessage,
      collectedInfo,
      isComplete,
      conversationHistory: finalHistory
    };
  } catch (error) {
    console.error('DeepSeek API error:', error);
    throw new Error('小悦暂时有点忙，请稍后再试～');
  }
}

function extractCollectedInfo(message: string): Partial<XiaoyueCollectedInfo> {
  const match = message.match(/```collected_info\s*([\s\S]*?)```/);
  if (!match) return {};
  
  try {
    const jsonStr = match[1].trim();
    return JSON.parse(jsonStr);
  } catch {
    return {};
  }
}

export async function summarizeAndExtractInfo(
  conversationHistory: ChatMessage[]
): Promise<XiaoyueCollectedInfo> {
  const summaryPrompt = `根据以下对话历史，提取用户提供的所有注册信息，以JSON格式返回。

对话历史：
${conversationHistory.filter(m => m.role !== 'system').map(m => `${m.role === 'user' ? '用户' : '小悦'}: ${m.content}`).join('\n')}

请返回以下格式的JSON（只包含用户明确提供的信息，没有提供的字段不要包含）：
{
  "displayName": "用户昵称",
  "gender": "女性/男性/不透露",
  "birthYear": 1995,
  "currentCity": "深圳/香港/广州/其他",
  "occupationDescription": "职业描述",
  "interestsTop": ["兴趣1", "兴趣2"],
  "primaryInterests": ["主要兴趣"],
  "venueStylePreference": "轻奢现代风/绿植花园风/复古工业风/温馨日式风",
  "topicAvoidances": ["politics", "dating_pressure"],
  "socialStyle": "群聊型/小组深聊型"
}

只返回JSON，不要其他内容。`;

  try {
    const response = await deepseekClient.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: '你是一个信息提取助手，根据对话历史提取结构化信息。' },
        { role: 'user', content: summaryPrompt }
      ],
      temperature: 0.3,
      max_tokens: 500,
    });

    const content = response.choices[0]?.message?.content || '{}';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return {};
  } catch (error) {
    console.error('Failed to extract info:', error);
    return {};
  }
}

export default deepseekClient;
