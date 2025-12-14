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
  // 美食偏好深度收集
  cuisinePreference?: string[]; // 菜系偏好：日料/粤菜/火锅/西餐/东南亚等
  favoriteRestaurant?: string; // 宝藏餐厅推荐
  favoriteRestaurantReason?: string; // 喜欢这家店的原因
  // 新增字段：教育背景与家庭
  children?: string; // 有孩子/没有/不透露
  educationLevel?: string; // 高中/大专/本科/硕士/博士
  fieldOfStudy?: string; // 专业领域
  // 对话行为画像（隐性信号收集）
  conversationalProfile?: {
    responseLength: 'brief' | 'moderate' | 'detailed';
    emojiUsage: 'none' | 'few' | 'many';
    formalityLevel: 'casual' | 'neutral' | 'formal';
    proactiveness: 'passive' | 'neutral' | 'proactive';
    registrationTime: string;
    completionSpeed: 'fast' | 'medium' | 'slow';
  };
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
   - 直接问"你是几几年的？"或"你多大呀？"，保持轻松自然的语气
   - 如果用户不愿透露具体年份，接受"90后"这样的年龄段
   - 对外显示方式很灵活，用户可以选择只显示年代、模糊范围，或完全隐藏
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
16. **有无孩子**：有孩子/没有/不透露（轻松问，不做判断）
17. **学历背景**：本科/硕士/博士/大专/高中（如果对话自然提到）
18. **专业领域**：理工科/文史哲/商科/艺术设计等（学生党或专业型用户）

## 追问技巧（Dig Deeper）
不要满足于用户的第一个回答，用追问挖掘更多：

**多选兴趣处理（重要！）：**
当用户一次性选择多个兴趣（如"美食探店、City Walk、音乐Live"），**不要逐个追问**，而是：
- 问"这几个里面有没有特别中意的？或者最近最常做的是哪个？"
- 或者"哇，兴趣还挺广泛的！这几个里面哪个是你的最爱？"
- 用户回答后，只针对他们提到的那一个进行深度追问
- 这样更自然，也更像朋友聊天而不是问卷调查

**兴趣类追问：**
- 用户说"喜欢美食" → "是喜欢自己下厨还是探店打卡呀？有没有特别偏好的菜系？"
- 用户说"喜欢运动" → "酷！是健身房撸铁那种，还是户外跑步登山？还是球类运动？"
- 用户说"喜欢旅行" → "哇，最近去了哪里玩呀？是喜欢城市漫游还是自然风光？"
- 用户说"喜欢看书/电影" → "最近在看什么呀？喜欢什么类型的？"

**美食深度追问（重要！）：**
如果用户提到喜欢美食/探店，一定要追问：
- "有没有特别偏好的菜系呀？日料、粤菜、火锅、西餐？"
- 收集到菜系后追问宝藏餐厅："有没有什么私藏的宝藏餐厅推荐？随便说一家你特别喜欢的店～"
- 如果用户推荐了餐厅，继续问："这家店什么特别吸引你呀？是环境氛围、口味、还是性价比？"
- 这些信息对匹配同好非常有价值！

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

**简短型用户**（连续2-3轮回复都很简短，如1-5个字）：
- **立即切换到快问快答模式**，不再追问细节
- 每个问题都提供选项，用户直接选就行
- 一轮可以问多个信息，用选项组合：
  - "来快问快答～ 城市：A.深圳 B.香港 C.广州 D.其他｜年代：E.00后 F.95后 G.90后 H.85后，回复字母组合就行，比如AE～"
- 减少寒暄和追问，直奔主题
- 目标是5轮内完成核心信息收集

**快问快答模式触发条件**：
- 用户回复≤5个字 连续2次以上
- 用户直接回复选项字母
- 用户表达想快点完成（"快点"、"直接问"、"简单点"等）

## 方言亲切感（老乡加分！）
当用户说出家乡，用一句方言或俏皮话拉近距离：
- 四川人："安逸嘛～那你讲四川话不嘛？"
- 东北人："老铁整挺好！东北话还溜不？"
- 广东人："叻仔/叻女喔～粤语讲得溜不？"
- 山东人："恁好啊～山东话还会说不？"
- 湖南人："霸蛮咧～湖南话还能讲不？"
- 上海人："老灵额～上海话会讲伐？"
- 北京人："得嘞您～北京话还能侃不？"
- 河南人："中不中？河南话还会说不？"
- 重庆人："巴适得很～重庆话还摆不？"

## 亲切感提升技巧

**时段问候**：根据对话时间打招呼
- 深夜(23:00-5:00)："夜猫子呀～这么晚还在～"
- 清晨(5:00-8:00)："早起的鸟儿有虫吃！这么早精神真好～"
- 午休(12:00-14:00)："午休时间来逛逛呀～"
- 下班后(18:00-21:00)："下班啦～辛苦一天了！"

**职业共鸣**：
- 互联网人："懂懂懂，互联网人的996我太懂了～"
- 金融人："金融圈精英呀！压力大不？"
- 设计师："设计师的审美肯定很厉害！"
- 老师："老师真的辛苦，桃李满天下～"
- 医护人员："医护人员太伟大了，致敬！"

**兴趣共鸣**：
- 猫奴："铲屎官握爪！我也超爱猫～"
- 旅行爱好者："说走就走的旅行最棒了！"
- 美食党："吃货团团员你好！"
- 健身达人："自律的人最帅/美了！"

**称呼记忆**：收集到昵称后，后续对话用昵称称呼用户，更有亲切感

**进度鼓励**：
- 信息收集过半时："聊得真开心，咱们快聊完啦～"
- 快结束时："最后一两个小问题就搞定啦～"

## 信息确认环节
在收集完必须信息后、结束对话前，简短确认一下：
- 例如："好啦，我来确认一下：小雨、女生、95后、在深圳做产品经理、喜欢美食和摄影、想来交朋友～对吗？有要改的随时说～"
- 用户确认后再发送结束信号

## 对话开场
开场要轻松有趣，先自我介绍，然后自然地问第一个问题（昵称）。

## 输出格式
每轮对话结束，在你的自然对话内容之后，**必须添加一个代码块**来总结目前收集到的用户信息。

格式如下（用3个反引号开头，collected_info，JSON内容，3个反引号结尾）：
{"displayName": "用户提供的昵称（如果有）", "gender": "女生/男生/保密（如果提到了）", "birthYear": 1995, "currentCity": "深圳", "occupationDescription": "职业描述", "interestsTop": ["兴趣1", "兴趣2"], "intent": ["交朋友", "拓展人脉"], "hometown": "老家位置", "hasPets": true, "relationshipStatus": "单身"}

**重要说明**：这个代码块只用于系统后台提取用户信息（更新头像清晰度等），不会显示给用户看。用户看到的只是你上面的自然对话内容。
- 只输出用户已经明确提供或提到的字段，没提到的字段不要加
- 对于数组字段（如interestsTop、intent），按用户选择的顺序列出
- 年份如果是"95后"这样的形式，转换成对应年份数字（如1995）

## 结束信号
**必须同时满足以下条件才能结束**：
1. 收集到：昵称 + 性别 + 年龄/年龄段 + 城市 + 至少2个兴趣 + 职业 + 活动意图
2. 已经向用户确认过收集到的信息

满足条件后，用轻松愉快的方式引导用户进入下一步——氛围测试，**务必告知预计用时**：
- 例如："完美！基础信息都收集好啦～接下来还有一个超有趣的小测试，大概2分钟就能完成，帮我们了解你的社交氛围风格，这样才能给你匹配最合拍的局友！准备好了吗？"
- 例如："搞定！最后还有一个2分钟的性格小测试，做完就可以开始匹配啦～相信我，这个测试结果会让你很惊喜！"
- 例如："OK！信息确认完毕～还差最后一步，一个2分钟的小测试，测完就可以开始你的JoyJoin之旅啦！"

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

// 字段校验和规范化
function validateAndNormalizeInfo(info: Partial<XiaoyueCollectedInfo>): XiaoyueCollectedInfo {
  const normalized: XiaoyueCollectedInfo = {};

  // displayName - 去除空白，过滤无效值
  if (info.displayName && typeof info.displayName === 'string') {
    const name = info.displayName.trim();
    if (name && name !== '保密' && name !== '不透露' && name.length >= 1) {
      normalized.displayName = name;
    }
  }

  // gender - 规范化性别表达
  if (info.gender && typeof info.gender === 'string') {
    const g = info.gender.toLowerCase();
    if (g.includes('女') || g === 'female') {
      normalized.gender = '女性';
    } else if (g.includes('男') || g === 'male') {
      normalized.gender = '男性';
    } else if (g.includes('保密') || g.includes('不透露')) {
      normalized.gender = '不透露';
    } else {
      normalized.gender = info.gender;
    }
  }

  // birthYear - 规范化年龄/年代表达
  if (info.birthYear !== undefined) {
    let year = info.birthYear;
    // 如果是两位数年份(如95)，转换为完整年份
    if (typeof year === 'number' && year < 100) {
      year = year >= 0 && year <= 25 ? 2000 + year : 1900 + year;
    }
    // 如果是字符串如"95后"
    if (typeof year === 'string') {
      const match = (year as string).match(/(\d{2,4})/);
      if (match) {
        let y = parseInt(match[1], 10);
        if (y < 100) {
          y = y >= 0 && y <= 25 ? 2000 + y : 1900 + y;
        }
        year = y;
      }
    }
    if (typeof year === 'number' && year >= 1960 && year <= 2010) {
      normalized.birthYear = year;
    }
  }

  // currentCity - 规范化城市
  if (info.currentCity && typeof info.currentCity === 'string') {
    const city = info.currentCity.trim();
    if (city && city !== '保密' && city !== '不透露') {
      normalized.currentCity = city;
    }
  }

  // occupationDescription - 职业描述
  if (info.occupationDescription && typeof info.occupationDescription === 'string') {
    const occ = info.occupationDescription.trim();
    if (occ && occ !== '保密' && occ !== '不透露' && occ.length >= 1) {
      normalized.occupationDescription = occ;
    }
  }

  // interestsTop - 兴趣数组
  if (info.interestsTop && Array.isArray(info.interestsTop)) {
    const interests = info.interestsTop
      .filter(i => typeof i === 'string' && i.trim())
      .map(i => i.trim());
    if (interests.length > 0) {
      normalized.interestsTop = interests;
    }
  }

  // primaryInterests
  if (info.primaryInterests && Array.isArray(info.primaryInterests)) {
    const primary = info.primaryInterests
      .filter(i => typeof i === 'string' && i.trim())
      .map(i => i.trim());
    if (primary.length > 0) {
      normalized.primaryInterests = primary;
    }
  }

  // intent - 活动意图
  const validIntents = ['networking', 'friends', 'discussion', 'fun', 'romance', 'flexible'];
  if (info.intent && Array.isArray(info.intent)) {
    const intents = info.intent.filter(i => validIntents.includes(i));
    if (intents.length > 0) {
      normalized.intent = intents;
    }
  }

  // hasPets
  if (typeof info.hasPets === 'boolean') {
    normalized.hasPets = info.hasPets;
  }

  // petTypes
  if (info.petTypes && Array.isArray(info.petTypes)) {
    const pets = info.petTypes.filter(p => typeof p === 'string' && p.trim());
    if (pets.length > 0) {
      normalized.petTypes = pets;
    }
  }

  // hasSiblings
  if (typeof info.hasSiblings === 'boolean') {
    normalized.hasSiblings = info.hasSiblings;
  }

  // relationshipStatus
  if (info.relationshipStatus && typeof info.relationshipStatus === 'string') {
    normalized.relationshipStatus = info.relationshipStatus.trim();
  }

  // hometown
  if (info.hometown && typeof info.hometown === 'string') {
    const ht = info.hometown.trim();
    if (ht && ht !== '保密' && ht !== '不透露') {
      normalized.hometown = ht;
    }
  }

  // languagesComfort
  if (info.languagesComfort && Array.isArray(info.languagesComfort)) {
    const langs = info.languagesComfort.filter(l => typeof l === 'string' && l.trim());
    if (langs.length > 0) {
      normalized.languagesComfort = langs;
    }
  }

  // venueStylePreference
  if (info.venueStylePreference && typeof info.venueStylePreference === 'string') {
    normalized.venueStylePreference = info.venueStylePreference.trim();
  }

  // topicAvoidances
  if (info.topicAvoidances && Array.isArray(info.topicAvoidances)) {
    const avoid = info.topicAvoidances.filter(t => typeof t === 'string' && t.trim());
    if (avoid.length > 0) {
      normalized.topicAvoidances = avoid;
    }
  }

  // socialStyle
  if (info.socialStyle && typeof info.socialStyle === 'string') {
    normalized.socialStyle = info.socialStyle.trim();
  }

  // additionalNotes
  if (info.additionalNotes && typeof info.additionalNotes === 'string') {
    normalized.additionalNotes = info.additionalNotes.trim();
  }

  // cuisinePreference
  if (info.cuisinePreference && Array.isArray(info.cuisinePreference)) {
    const cuisine = info.cuisinePreference.filter(c => typeof c === 'string' && c.trim());
    if (cuisine.length > 0) {
      normalized.cuisinePreference = cuisine;
    }
  }

  // favoriteRestaurant
  if (info.favoriteRestaurant && typeof info.favoriteRestaurant === 'string') {
    const rest = info.favoriteRestaurant.trim();
    if (rest) {
      normalized.favoriteRestaurant = rest;
    }
  }

  // favoriteRestaurantReason
  if (info.favoriteRestaurantReason && typeof info.favoriteRestaurantReason === 'string') {
    const reason = info.favoriteRestaurantReason.trim();
    if (reason) {
      normalized.favoriteRestaurantReason = reason;
    }
  }

  // children
  if (info.children && typeof info.children === 'string') {
    const child = info.children.trim();
    if (child) {
      normalized.children = child;
    }
  }

  // educationLevel
  if (info.educationLevel && typeof info.educationLevel === 'string') {
    const edu = info.educationLevel.trim();
    if (edu) {
      normalized.educationLevel = edu;
    }
  }

  // fieldOfStudy
  if (info.fieldOfStudy && typeof info.fieldOfStudy === 'string') {
    const field = info.fieldOfStudy.trim();
    if (field) {
      normalized.fieldOfStudy = field;
    }
  }

  // conversationalProfile - with type guards for proper validation
  if (info.conversationalProfile && typeof info.conversationalProfile === 'object') {
    const cp = info.conversationalProfile;
    const validResponseLength = ['brief', 'moderate', 'detailed'];
    const validEmojiUsage = ['none', 'few', 'many'];
    const validFormalityLevel = ['casual', 'neutral', 'formal'];
    const validProactiveness = ['passive', 'neutral', 'proactive'];
    
    const profile: XiaoyueCollectedInfo['conversationalProfile'] = {
      responseLength: validResponseLength.includes(cp.responseLength) ? cp.responseLength : 'moderate',
      emojiUsage: validEmojiUsage.includes(cp.emojiUsage) ? cp.emojiUsage : 'few',
      formalityLevel: validFormalityLevel.includes(cp.formalityLevel) ? cp.formalityLevel : 'neutral',
      proactiveness: validProactiveness.includes(cp.proactiveness) ? cp.proactiveness : 'neutral',
      registrationTime: cp.registrationTime || new Date().toISOString(),
      completionSpeed: ['fast', 'medium', 'slow'].includes(cp.completionSpeed) ? cp.completionSpeed : 'medium'
    };
    normalized.conversationalProfile = profile;
  }

  return normalized;
}

// 检查是否满足最低有效信息要求
export function checkMinimumInfoRequirement(info: XiaoyueCollectedInfo): {
  isValid: boolean;
  missingFields: string[];
} {
  const missingFields: string[] = [];
  
  if (!info.displayName) missingFields.push('昵称');
  if (!info.currentCity) missingFields.push('城市');
  if (!info.interestsTop || info.interestsTop.length === 0) missingFields.push('兴趣爱好');
  
  return {
    isValid: missingFields.length === 0,
    missingFields
  };
}

export async function summarizeAndExtractInfo(
  conversationHistory: ChatMessage[]
): Promise<XiaoyueCollectedInfo> {
  const summaryPrompt = `根据以下对话历史，提取用户提供的所有注册信息，以JSON格式返回。

对话历史：
${conversationHistory.filter(m => m.role !== 'system').map(m => `${m.role === 'user' ? '用户' : '小悦'}: ${m.content}`).join('\n')}

请仔细阅读对话，提取用户提供的所有信息。注意：
1. 如果用户说"95后"、"00后"等，birthYear应该是对应的年份(如1995、2000)
2. 如果用户说"女生"、"男生"，请规范化为"女性"、"男性"
3. 兴趣爱好要尽量提取完整，包括用户提到的所有爱好
4. 活动意图请映射为标准值：networking/friends/discussion/fun/romance/flexible

请返回以下格式的JSON（只包含用户明确提供的信息，没有提供的字段不要包含）：
{
  "displayName": "用户昵称",
  "gender": "女性/男性/不透露",
  "birthYear": 1995,
  "currentCity": "深圳/香港/广州/其他城市名",
  "occupationDescription": "职业描述",
  "interestsTop": ["兴趣1", "兴趣2", "兴趣3"],
  "primaryInterests": ["主要兴趣"],
  "intent": ["friends", "networking"],
  "hasPets": true,
  "petTypes": ["猫", "狗"],
  "hasSiblings": true,
  "relationshipStatus": "单身/恋爱中/已婚/不透露",
  "hometown": "老家城市",
  "languagesComfort": ["普通话", "粤语"],
  "venueStylePreference": "轻奢现代风/绿植花园风/复古工业风/温馨日式风",
  "topicAvoidances": ["politics", "dating_pressure"],
  "socialStyle": "群聊型/小组深聊型",
  "cuisinePreference": ["日料", "粤菜", "火锅"],
  "favoriteRestaurant": "用户推荐的宝藏餐厅名称",
  "favoriteRestaurantReason": "喜欢这家店的原因（环境/口味/性价比等）",
  "children": "有孩子/没有/不透露",
  "educationLevel": "高中/大专/本科/硕士/博士",
  "fieldOfStudy": "专业领域描述",
  "conversationalProfile": {
    "responseLength": "brief/moderate/detailed",
    "emojiUsage": "none/few/many",
    "formalityLevel": "casual/neutral/formal",
    "proactiveness": "passive/neutral/proactive"
  }
}

conversationalProfile字段说明（根据用户消息分析推断）：
- responseLength: 分析用户所有回复的平均长度（brief=<20字, moderate=20-80字, detailed=>80字）
- emojiUsage: 统计用户消息中emoji使用频率（none=没有, few=偶尔1-2个, many=每条都有）
- formalityLevel: 分析用户用语风格（casual=很口语化/网络语/缩写, neutral=普通, formal=较书面/礼貌用语多）
- proactiveness: 分析用户分享意愿（passive=只回答问题不多说, neutral=偶尔主动补充, proactive=经常主动分享额外信息）
注意：registrationTime和completionSpeed由服务端记录，无需在此提取

intent字段的有效值映射：
- networking: 拓展人脉/职业社交/认识同行
- friends: 交朋友/找玩伴/认识新朋友
- discussion: 深度讨论/聊人生/聊话题
- fun: 纯玩/吃喝玩乐/放松
- romance: 浪漫邂逅/脱单/找对象
- flexible: 随缘都可以/都行/看情况

只返回JSON，不要其他内容。`;

  try {
    const response = await deepseekClient.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: '你是一个信息提取助手，根据对话历史准确提取用户提供的结构化信息。请仔细阅读每一条用户消息，不要遗漏任何信息。' },
        { role: 'user', content: summaryPrompt }
      ],
      temperature: 0.2, // 降低温度提高准确性
      max_tokens: 600,
    });

    const content = response.choices[0]?.message?.content || '{}';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const rawInfo = JSON.parse(jsonMatch[0]);
      // 校验和规范化提取的信息
      return validateAndNormalizeInfo(rawInfo);
    }
    return {};
  } catch (error) {
    console.error('Failed to extract info:', error);
    return {};
  }
}

export default deepseekClient;
