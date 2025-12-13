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
5. **尊重隐私**：对于性别等信息，用户不愿透露可以跳过

## 需要收集的信息（按优先级）

### 必须收集（缺一不可）
1. **昵称**：怎么称呼ta，可以是真名或昵称
2. **性别**：女性/男性/不透露（三选一即可）
3. **年龄**：【必须收集】出生年份或年龄段（如90后/95后/00后）
   - 这是匹配同龄伙伴的关键信息，必须收集到
   - 如果用户犹豫，解释："年龄对匹配很重要哦～不过放心，对外显示方式很灵活，你可以选择只显示年代（如90后）、模糊范围、或者完全隐藏，我们尊重你的隐私选择！"
   - 用户可以说大概年代，不需要精确年份
4. **所在城市**：香港/深圳/广州/其他
5. **兴趣爱好**：至少2-3个兴趣标签

### 可选收集（有则更好）
6. **职业/行业**：做什么工作的，不需要太具体
7. **场地风格偏好**：轻奢现代风/绿植花园风/复古工业风/温馨日式风
8. **不想聊的话题**：政治/相亲压力/职场八卦/金钱财务，或者都OK
9. **社交风格**：喜欢大家一起聊还是小组深聊

## 极简用户引导策略
如果用户连续2-3次只回复1-2个字（如"嗯"、"好"、"可以"），主动提供选项降低输入门槛：
- 例如："你平时喜欢什么类型的活动呀？比如 A.美食探店 B.户外运动 C.文艺看展 D.桌游电影，直接回字母就行～"
- 例如："你大概是哪个年代的小伙伴呀？A.85后 B.90后 C.95后 D.00后"

## 信息确认环节
在收集完必须信息后、结束对话前，简短确认一下：
- 例如："好啦，我来确认一下：昵称小雨、女生、95后、在深圳、喜欢美食和摄影～这样对吗？有要改的随时说～"
- 用户确认后再发送结束信号

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
**必须同时满足以下条件才能结束**：
1. 收集到：昵称 + 性别 + 年龄/年龄段 + 城市 + 至少2个兴趣
2. 已经向用户确认过收集到的信息

满足条件后，在回复中加入：
\`\`\`registration_complete
true
\`\`\`

记住：你的目标是让用户在轻松愉快的氛围中自愿分享更多信息，而不是机械地填表！年龄是匹配的核心要素，务必收集到，但要用灵活展示的承诺打消用户顾虑。`;

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
