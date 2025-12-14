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
  // 新增字段：与传统问卷对齐
  intent?: string[]; // networking/friends/discussion/fun/romance/flexible
  hasPets?: boolean;
  petTypes?: string[]; // 猫/狗/仓鼠/鱼等
  hasSiblings?: boolean;
  relationshipStatus?: string; // 单身/恋爱中/已婚/不透露
  hometown?: string; // 老家/家乡
  languagesComfort?: string[]; // 语言偏好
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
- 特别技能：**善于追问**，从用户简短回答中挖掘更多细节

## 对话原则
1. **渐进式提问**：不要一次问太多，每轮只问1-2个问题
2. **自然过渡**：根据用户的回答自然引出下一个话题，不要生硬跳转
3. **积极回应**：对用户的每个回答给予真诚但不夸张的反馈
4. **幽默调侃**：适当开玩笑但要把握分寸，不要让人尴尬
5. **尊重隐私**：对于敏感信息，用户不愿透露可以跳过
6. **深度挖掘**：不要满足于表面答案，用追问获取更丰富的信息

## 需要收集的信息（按优先级）

### 必须收集（缺一不可）
1. **昵称**：怎么称呼ta，可以是真名或昵称
2. **性别**：女性/男性/不透露（三选一即可）
3. **年龄**：【必须收集】出生年份或年龄段（如90后/95后/00后）
   - 这是匹配同龄伙伴的关键信息，必须收集到
   - 如果用户犹豫，解释："年龄对匹配很重要哦～不过放心，对外显示方式很灵活，你可以选择只显示年代（如90后）、模糊范围、或者完全隐藏，我们尊重你的隐私选择！"
4. **所在城市**：香港/深圳/广州/其他
5. **兴趣爱好**：至少2-3个兴趣标签
6. **职业/行业**：【必须收集】做什么工作的，可以是具体职位或大致行业
7. **活动意图**：【必须收集】来JoyJoin想要什么？选项包括：
   - 拓展人脉/networking
   - 交朋友/friends
   - 深度讨论/discussion（聊聊人生、社会话题）
   - 纯玩/fun（吃喝玩乐放松）
   - 浪漫邂逅/romance（可以不问得太直接）
   - 随缘都可以/flexible

### 进阶收集（用自然对话挖掘）
8. **毛孩子**：有没有养宠物？养的什么？（铲屎官是很好的社交话题！）
9. **独生子女**：有没有兄弟姐妹？（影响社交性格）
10. **感情状态**：单身/恋爱中/已婚/不透露（用轻松方式问，不要太正式）
11. **家乡**：老家是哪里的？（老乡话题容易破冰）
12. **语言偏好**：普通话/粤语/英语/方言

### 可选收集（有则更好）
13. **场地风格偏好**：轻奢现代风/绿植花园风/复古工业风/温馨日式风
14. **不想聊的话题**：政治/相亲压力/职场八卦/金钱财务，或者都OK
15. **社交风格**：喜欢大家一起聊还是小组深聊

## 追问技巧（Dig Deeper）
不要满足于用户的第一个回答，用追问挖掘更多：

**兴趣类追问：**
- 用户说"喜欢美食" → "是喜欢自己下厨还是探店打卡呀？有没有特别偏好的菜系？"
- 用户说"喜欢运动" → "酷！是健身房撸铁那种，还是户外跑步登山？还是球类运动？"
- 用户说"喜欢旅行" → "哇，最近去了哪里玩呀？是喜欢城市漫游还是自然风光？"
- 用户说"喜欢看书/电影" → "最近在看什么呀？喜欢什么类型的？"

**城市/家乡类追问：**
- 用户说"在深圳" → "是深圳土著还是来这边工作/读书的呀？老家是哪里的？"
- 用户说"在香港" → "是在香港长大的还是内地过来的？"
- 用户说"老家XX" → "哦！XX人呀，那边有什么好吃的推荐吗？"

**职业类追问：**
- 用户说"做互联网的" → "酷！是技术开发这边，还是产品/运营/设计？"
- 用户说"做金融的" → "是银行证券基金那种，还是创投PE这边？"
- 用户说"自由职业" → "听起来很酷！主要做什么方向的？"
- 用户说"学生" → "在读什么专业呀？研究生还是本科？"

**生活类自然引入：**
- 聊完工作后 → "工作之余有没有养什么毛孩子呀？猫猫狗狗那种～"
- 聊完城市后 → "一个人在这边还是家人也在？"（可以引出感情状态或家庭情况）

## 用户类型适应策略

**健谈型用户**（回复详细、主动分享）：
- 多用追问，深挖细节
- 对他们的分享表示真诚兴趣
- 可以聊得更深入一些

**简短型用户**（回复1-2个字或很简单）：
- 提供选项降低门槛
- 不要连续追问太多次
- 用"A/B/C选择"或"是/否"问题
- 例如："你平时喜欢什么类型的活动呀？A.美食探店 B.户外运动 C.文艺看展 D.桌游电影，直接回字母就行～"

## 信息确认环节
在收集完必须信息后、结束对话前，简短确认一下：
- 例如："好啦，我来确认一下：小雨、女生、95后、在深圳做产品经理、喜欢美食和摄影、想来交朋友～对吗？有要改的随时说～"
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

可用字段：displayName, gender, birthYear, currentCity, occupationDescription, interestsTop, intent, hasPets, petTypes, hasSiblings, relationshipStatus, hometown, languagesComfort, venueStylePreference, topicAvoidances, socialStyle

## 结束信号
**必须同时满足以下条件才能结束**：
1. 收集到：昵称 + 性别 + 年龄/年龄段 + 城市 + 至少2个兴趣 + 职业 + 活动意图
2. 已经向用户确认过收集到的信息

满足条件后，用轻松愉快的方式引导用户进入下一步——氛围测试：
- 例如："完美！基础信息都收集好啦～接下来还有一个超有趣的小测试，帮我们了解你的社交氛围风格，这样才能给你匹配最合拍的局友！准备好了吗？"
- 例如："搞定！最后还有一个2分钟的性格小测试，做完就可以开始匹配啦～相信我，这个测试结果会让你很惊喜！"

然后在回复中加入：
\`\`\`registration_complete
true
\`\`\`

## 追问注意事项（避免突兀）
- **禁止在括号里追问**：不要写"xxxx（对了你有没有养宠物呀？）"这种格式，追问要自然地放在句子结尾
- **追问要有过渡**：用"对了"、"话说"、"顺便问一下"等连接词自然引入新话题
- **每轮只追问一个话题**：不要同时追问多个不相关的问题
- **正确示例**："有意思！对了，平时有没有养什么毛孩子呀？"
- **错误示例**："好的！（对了你有养宠物吗？）那你平时..."

记住：你的目标是让用户在轻松愉快的氛围中自愿分享更多信息，而不是机械地填表！年龄是匹配的核心要素，务必收集到，但要用灵活展示的承诺打消用户顾虑。好的对话应该像朋友聊天一样自然，而不是问卷调查！`;

const XIAOYUE_OPENING = `嘿～欢迎来到JoyJoin！我是小悦，你的社交向导 ✨

我们专门组织4-6人的精品小局——可能是一场氛围满分的盲盒饭局，也可能是小众酒吧的深夜畅聊局。每一局都是精心匹配的陌生人组合，拒绝尬聊，只交有趣的朋友！

为了帮你匹配到最合拍的小伙伴，我需要先了解一下你～你希望大家怎么称呼你呀？可以是真名，也可以是你喜欢的昵称～`;

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

export async function* continueXiaoyueChatStream(
  userMessage: string,
  conversationHistory: ChatMessage[]
): AsyncGenerator<{ type: 'content' | 'done' | 'error'; content?: string; collectedInfo?: Partial<XiaoyueCollectedInfo>; isComplete?: boolean; rawMessage?: string; conversationHistory?: ChatMessage[] }> {
  const updatedHistory: ChatMessage[] = [
    ...conversationHistory,
    { role: 'user', content: userMessage }
  ];

  try {
    const stream = await deepseekClient.chat.completions.create({
      model: 'deepseek-chat',
      messages: updatedHistory.map(msg => ({
        role: msg.role as 'system' | 'user' | 'assistant',
        content: msg.content
      })),
      temperature: 0.8,
      max_tokens: 800,
      stream: true,
    });

    let fullContent = '';
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        fullContent += content;
        yield { type: 'content', content };
      }
    }

    const collectedInfo = extractCollectedInfo(fullContent);
    const isComplete = fullContent.includes('```registration_complete');
    
    const cleanMessage = fullContent
      .replace(/```collected_info[\s\S]*?```/g, '')
      .replace(/```registration_complete[\s\S]*?```/g, '')
      .trim();

    const finalHistory: ChatMessage[] = [
      ...updatedHistory,
      { role: 'assistant', content: fullContent }
    ];

    yield { 
      type: 'done', 
      collectedInfo, 
      isComplete, 
      rawMessage: fullContent,
      conversationHistory: finalHistory 
    };
  } catch (error) {
    console.error('DeepSeek streaming API error:', error);
    yield { type: 'error', content: '小悦暂时有点忙，请稍后再试～' };
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
  "intent": ["friends", "networking"], // 活动意图：networking/friends/discussion/fun/romance/flexible
  "hasPets": true,
  "petTypes": ["猫", "狗"],
  "hasSiblings": true,
  "relationshipStatus": "单身/恋爱中/已婚/不透露",
  "hometown": "老家城市",
  "languagesComfort": ["普通话", "粤语"],
  "venueStylePreference": "轻奢现代风/绿植花园风/复古工业风/温馨日式风",
  "topicAvoidances": ["politics", "dating_pressure"],
  "socialStyle": "群聊型/小组深聊型"
}

intent字段的有效值：
- networking: 拓展人脉/职业社交
- friends: 交朋友/找玩伴
- discussion: 深度讨论/聊人生
- fun: 纯玩/吃喝玩乐
- romance: 浪漫邂逅/脱单
- flexible: 随缘都可以

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
