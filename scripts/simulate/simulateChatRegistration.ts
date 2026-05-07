/**
 * 小悦对话注册模拟测试脚本
 * 模拟不同用户画像与小悦进行注册对话，评估系统性能
 */

import OpenAI from 'openai';

const deepseekClient = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com',
});

// ============ 50 用户画像定义 ============
interface UserPersona {
  id: string;
  name: string;
  category: string;
  truthData: {
    displayName: string;
    gender: string;
    birthYear: number;
    currentCity: string;
    interests: string[];
    occupation?: string;
  };
  behaviorStyle: {
    verbosity: 'minimal' | 'normal' | 'verbose';
    privacyLevel: 'open' | 'selective' | 'guarded';
    responseSpeed: 'quick' | 'thoughtful';
    language: 'formal' | 'casual' | 'mixed';
  };
  specialTraits: string[];
}

const USER_PERSONAS: UserPersona[] = [
  // ===== 1-10: 标准用户（不同城市、性别、年龄段）=====
  { id: 'std-1', name: '深圳白领女', category: '标准', truthData: { displayName: '小雨', gender: '女性', birthYear: 1995, currentCity: '深圳', interests: ['美食', '旅行', '摄影'] }, behaviorStyle: { verbosity: 'normal', privacyLevel: 'open', responseSpeed: 'quick', language: 'casual' }, specialTraits: [] },
  { id: 'std-2', name: '香港金融男', category: '标准', truthData: { displayName: 'Alex', gender: '男性', birthYear: 1990, currentCity: '香港', interests: ['投资', '健身', '红酒'] }, behaviorStyle: { verbosity: 'normal', privacyLevel: 'selective', responseSpeed: 'thoughtful', language: 'mixed' }, specialTraits: ['中英混用'] },
  { id: 'std-3', name: '广州创意女', category: '标准', truthData: { displayName: '晓晓', gender: '女性', birthYear: 1998, currentCity: '广州', interests: ['手工', '咖啡', '阅读'] }, behaviorStyle: { verbosity: 'verbose', privacyLevel: 'open', responseSpeed: 'thoughtful', language: 'casual' }, specialTraits: [] },
  { id: 'std-4', name: '深圳科技男', category: '标准', truthData: { displayName: '阿明', gender: '男性', birthYear: 1992, currentCity: '深圳', interests: ['编程', '游戏', '数码'] }, behaviorStyle: { verbosity: 'minimal', privacyLevel: 'selective', responseSpeed: 'quick', language: 'casual' }, specialTraits: [] },
  { id: 'std-5', name: '香港设计女', category: '标准', truthData: { displayName: 'Lily', gender: '女性', birthYear: 1993, currentCity: '香港', interests: ['设计', '艺术', '电影'] }, behaviorStyle: { verbosity: 'normal', privacyLevel: 'open', responseSpeed: 'quick', language: 'mixed' }, specialTraits: [] },
  { id: 'std-6', name: '广州教师男', category: '标准', truthData: { displayName: '张老师', gender: '男性', birthYear: 1985, currentCity: '广州', interests: ['历史', '书法', '围棋'] }, behaviorStyle: { verbosity: 'verbose', privacyLevel: 'open', responseSpeed: 'thoughtful', language: 'formal' }, specialTraits: ['礼貌正式'] },
  { id: 'std-7', name: '深圳95后女', category: '标准', truthData: { displayName: '糖糖', gender: '女性', birthYear: 2000, currentCity: '深圳', interests: ['追星', '汉服', '剧本杀'] }, behaviorStyle: { verbosity: 'verbose', privacyLevel: 'open', responseSpeed: 'quick', language: 'casual' }, specialTraits: ['网络用语多'] },
  { id: 'std-8', name: '香港律师男', category: '标准', truthData: { displayName: 'David', gender: '男性', birthYear: 1988, currentCity: '香港', interests: ['法律', '高尔夫', '威士忌'] }, behaviorStyle: { verbosity: 'normal', privacyLevel: 'guarded', responseSpeed: 'thoughtful', language: 'formal' }, specialTraits: ['谨慎'] },
  { id: 'std-9', name: '广州医生女', category: '标准', truthData: { displayName: '林医生', gender: '女性', birthYear: 1991, currentCity: '广州', interests: ['瑜伽', '烹饪', '心理学'] }, behaviorStyle: { verbosity: 'normal', privacyLevel: 'selective', responseSpeed: 'thoughtful', language: 'formal' }, specialTraits: [] },
  { id: 'std-10', name: '深圳自由职业', category: '标准', truthData: { displayName: '小风', gender: '不透露', birthYear: 1994, currentCity: '深圳', interests: ['写作', '旅行', '冥想'] }, behaviorStyle: { verbosity: 'normal', privacyLevel: 'selective', responseSpeed: 'thoughtful', language: 'casual' }, specialTraits: ['性别模糊'] },

  // ===== 11-20: 极简用户（回答简短）=====
  { id: 'min-1', name: '惜字如金男', category: '极简', truthData: { displayName: '阿杰', gender: '男性', birthYear: 1996, currentCity: '深圳', interests: ['篮球', '音乐'] }, behaviorStyle: { verbosity: 'minimal', privacyLevel: 'selective', responseSpeed: 'quick', language: 'casual' }, specialTraits: ['一两个字回答'] },
  { id: 'min-2', name: '忙碌职场女', category: '极简', truthData: { displayName: 'Amy', gender: '女性', birthYear: 1989, currentCity: '香港', interests: ['健身'] }, behaviorStyle: { verbosity: 'minimal', privacyLevel: 'guarded', responseSpeed: 'quick', language: 'casual' }, specialTraits: ['时间紧迫感'] },
  { id: 'min-3', name: '社恐内向男', category: '极简', truthData: { displayName: '小陈', gender: '男性', birthYear: 1997, currentCity: '广州', interests: ['游戏', '动漫'] }, behaviorStyle: { verbosity: 'minimal', privacyLevel: 'guarded', responseSpeed: 'thoughtful', language: 'casual' }, specialTraits: ['不愿多说'] },
  { id: 'min-4', name: '测试心态用户', category: '极简', truthData: { displayName: '路人', gender: '男性', birthYear: 1993, currentCity: '深圳', interests: ['随便'] }, behaviorStyle: { verbosity: 'minimal', privacyLevel: 'guarded', responseSpeed: 'quick', language: 'casual' }, specialTraits: ['敷衍态度'] },
  { id: 'min-5', name: '只关心结果女', category: '极简', truthData: { displayName: '直接点', gender: '女性', birthYear: 1990, currentCity: '香港', interests: ['效率'] }, behaviorStyle: { verbosity: 'minimal', privacyLevel: 'selective', responseSpeed: 'quick', language: 'casual' }, specialTraits: ['跳过问题'] },
  { id: 'min-6', name: '谨慎观望男', category: '极简', truthData: { displayName: '观察者', gender: '男性', birthYear: 1987, currentCity: '深圳', interests: ['未知'] }, behaviorStyle: { verbosity: 'minimal', privacyLevel: 'guarded', responseSpeed: 'thoughtful', language: 'formal' }, specialTraits: ['反问多'] },
  { id: 'min-7', name: '表情包用户', category: '极简', truthData: { displayName: '😊', gender: '不透露', birthYear: 1999, currentCity: '广州', interests: ['emoji'] }, behaviorStyle: { verbosity: 'minimal', privacyLevel: 'open', responseSpeed: 'quick', language: 'casual' }, specialTraits: ['用emoji回复'] },
  { id: 'min-8', name: '问号用户', category: '极简', truthData: { displayName: '？？', gender: '男性', birthYear: 1995, currentCity: '深圳', interests: ['不确定'] }, behaviorStyle: { verbosity: 'minimal', privacyLevel: 'guarded', responseSpeed: 'quick', language: 'casual' }, specialTraits: ['回复问号'] },
  { id: 'min-9', name: '嗯啊用户', category: '极简', truthData: { displayName: '嗯嗯', gender: '女性', birthYear: 1998, currentCity: '香港', interests: ['都行'] }, behaviorStyle: { verbosity: 'minimal', privacyLevel: 'selective', responseSpeed: 'quick', language: 'casual' }, specialTraits: ['语气词回复'] },
  { id: 'min-10', name: '数字用户', category: '极简', truthData: { displayName: '007', gender: '男性', birthYear: 1992, currentCity: '深圳', interests: ['1'] }, behaviorStyle: { verbosity: 'minimal', privacyLevel: 'guarded', responseSpeed: 'quick', language: 'casual' }, specialTraits: ['用数字回答'] },

  // ===== 21-30: 健谈用户（详细分享）=====
  { id: 'ver-1', name: '社交达人女', category: '健谈', truthData: { displayName: '晴天', gender: '女性', birthYear: 1994, currentCity: '深圳', interests: ['社交', '派对', '美妆', '购物', '旅行'] }, behaviorStyle: { verbosity: 'verbose', privacyLevel: 'open', responseSpeed: 'quick', language: 'casual' }, specialTraits: ['主动分享故事'] },
  { id: 'ver-2', name: '创业者男', category: '健谈', truthData: { displayName: '老王', gender: '男性', birthYear: 1986, currentCity: '深圳', interests: ['创业', '投资', '人脉', '商业'] }, behaviorStyle: { verbosity: 'verbose', privacyLevel: 'open', responseSpeed: 'thoughtful', language: 'formal' }, specialTraits: ['爱讲道理'] },
  { id: 'ver-3', name: '文艺青年女', category: '健谈', truthData: { displayName: '诗诗', gender: '女性', birthYear: 1997, currentCity: '广州', interests: ['诗歌', '话剧', '咖啡馆', '独立音乐'] }, behaviorStyle: { verbosity: 'verbose', privacyLevel: 'open', responseSpeed: 'thoughtful', language: 'formal' }, specialTraits: ['文艺表达'] },
  { id: 'ver-4', name: '旅行博主男', category: '健谈', truthData: { displayName: '浪子', gender: '男性', birthYear: 1991, currentCity: '香港', interests: ['旅行', '摄影', '美食', '户外'] }, behaviorStyle: { verbosity: 'verbose', privacyLevel: 'open', responseSpeed: 'quick', language: 'casual' }, specialTraits: ['分享旅行经历'] },
  { id: 'ver-5', name: '育儿妈妈', category: '健谈', truthData: { displayName: '辣妈', gender: '女性', birthYear: 1988, currentCity: '深圳', interests: ['育儿', '烘焙', '亲子', '教育'] }, behaviorStyle: { verbosity: 'verbose', privacyLevel: 'open', responseSpeed: 'thoughtful', language: 'casual' }, specialTraits: ['聊孩子'] },
  { id: 'ver-6', name: '美食家男', category: '健谈', truthData: { displayName: '吃货阿东', gender: '男性', birthYear: 1993, currentCity: '广州', interests: ['美食', '探店', '烹饪', '红酒'] }, behaviorStyle: { verbosity: 'verbose', privacyLevel: 'open', responseSpeed: 'quick', language: 'casual' }, specialTraits: ['详细描述食物'] },
  { id: 'ver-7', name: '健身教练女', category: '健谈', truthData: { displayName: 'Coco', gender: '女性', birthYear: 1995, currentCity: '深圳', interests: ['健身', '营养', '瑜伽', '舞蹈'] }, behaviorStyle: { verbosity: 'verbose', privacyLevel: 'open', responseSpeed: 'quick', language: 'casual' }, specialTraits: ['推广健身'] },
  { id: 'ver-8', name: '心理咨询师', category: '健谈', truthData: { displayName: '静姐', gender: '女性', birthYear: 1985, currentCity: '香港', interests: ['心理学', '冥想', '阅读', '自我成长'] }, behaviorStyle: { verbosity: 'verbose', privacyLevel: 'selective', responseSpeed: 'thoughtful', language: 'formal' }, specialTraits: ['深度交流'] },
  { id: 'ver-9', name: '摄影师男', category: '健谈', truthData: { displayName: '光影', gender: '男性', birthYear: 1990, currentCity: '深圳', interests: ['摄影', '电影', '艺术', '设计'] }, behaviorStyle: { verbosity: 'verbose', privacyLevel: 'open', responseSpeed: 'thoughtful', language: 'casual' }, specialTraits: ['视觉描述'] },
  { id: 'ver-10', name: '音乐人', category: '健谈', truthData: { displayName: '小乐', gender: '不透露', birthYear: 1996, currentCity: '广州', interests: ['音乐', '创作', '演出', '乐器'] }, behaviorStyle: { verbosity: 'verbose', privacyLevel: 'open', responseSpeed: 'quick', language: 'casual' }, specialTraits: ['聊音乐'] },

  // ===== 31-40: 特殊行为用户 =====
  { id: 'sp-1', name: '隐私敏感用户', category: '特殊', truthData: { displayName: '匿名', gender: '不透露', birthYear: 1990, currentCity: '不方便说', interests: ['隐私'] }, behaviorStyle: { verbosity: 'normal', privacyLevel: 'guarded', responseSpeed: 'thoughtful', language: 'formal' }, specialTraits: ['拒绝透露信息', '质疑数据用途'] },
  { id: 'sp-2', name: '跑题用户', category: '特殊', truthData: { displayName: '跑题王', gender: '男性', birthYear: 1994, currentCity: '深圳', interests: ['聊天'] }, behaviorStyle: { verbosity: 'verbose', privacyLevel: 'open', responseSpeed: 'quick', language: 'casual' }, specialTraits: ['话题跑偏', '问无关问题'] },
  { id: 'sp-3', name: '纠错用户', category: '特殊', truthData: { displayName: '较真哥', gender: '男性', birthYear: 1987, currentCity: '深圳', interests: ['纠错'] }, behaviorStyle: { verbosity: 'normal', privacyLevel: 'selective', responseSpeed: 'thoughtful', language: 'formal' }, specialTraits: ['纠正小悦', '挑刺'] },
  { id: 'sp-4', name: '调戏AI用户', category: '特殊', truthData: { displayName: '皮皮', gender: '男性', birthYear: 1999, currentCity: '广州', interests: ['整蛊'] }, behaviorStyle: { verbosity: 'normal', privacyLevel: 'open', responseSpeed: 'quick', language: 'casual' }, specialTraits: ['测试AI边界', '开玩笑'] },
  { id: 'sp-5', name: '犹豫不决用户', category: '特殊', truthData: { displayName: '纠结', gender: '女性', birthYear: 1993, currentCity: '可能深圳', interests: ['不确定', '可能喜欢', '也许'] }, behaviorStyle: { verbosity: 'normal', privacyLevel: 'open', responseSpeed: 'thoughtful', language: 'casual' }, specialTraits: ['频繁改答案'] },
  { id: 'sp-6', name: '复制粘贴用户', category: '特殊', truthData: { displayName: 'test', gender: '男性', birthYear: 1995, currentCity: 'test', interests: ['test'] }, behaviorStyle: { verbosity: 'minimal', privacyLevel: 'guarded', responseSpeed: 'quick', language: 'casual' }, specialTraits: ['复制同样内容'] },
  { id: 'sp-7', name: '多语言用户', category: '特殊', truthData: { displayName: 'Kevin', gender: '男性', birthYear: 1992, currentCity: 'Hong Kong', interests: ['travel', '美食'] }, behaviorStyle: { verbosity: 'normal', privacyLevel: 'open', responseSpeed: 'quick', language: 'mixed' }, specialTraits: ['中英粤混用'] },
  { id: 'sp-8', name: '负面情绪用户', category: '特殊', truthData: { displayName: '算了', gender: '女性', birthYear: 1991, currentCity: '深圳', interests: ['没什么'] }, behaviorStyle: { verbosity: 'minimal', privacyLevel: 'guarded', responseSpeed: 'thoughtful', language: 'casual' }, specialTraits: ['消极回应'] },
  { id: 'sp-9', name: '质疑平台用户', category: '特殊', truthData: { displayName: '怀疑论者', gender: '男性', birthYear: 1988, currentCity: '广州', interests: ['质疑'] }, behaviorStyle: { verbosity: 'normal', privacyLevel: 'guarded', responseSpeed: 'thoughtful', language: 'formal' }, specialTraits: ['质疑平台安全性'] },
  { id: 'sp-10', name: '超长回复用户', category: '特殊', truthData: { displayName: '长篇大论', gender: '女性', birthYear: 1994, currentCity: '深圳', interests: ['写作', '分享', '表达', '交流', '思考'] }, behaviorStyle: { verbosity: 'verbose', privacyLevel: 'open', responseSpeed: 'thoughtful', language: 'formal' }, specialTraits: ['每次回复很长'] },

  // ===== 41-50: 边界测试用户 =====
  { id: 'edge-1', name: '空白回复', category: '边界', truthData: { displayName: '', gender: '', birthYear: 0, currentCity: '', interests: [] }, behaviorStyle: { verbosity: 'minimal', privacyLevel: 'guarded', responseSpeed: 'quick', language: 'casual' }, specialTraits: ['发送空格或空白'] },
  { id: 'edge-2', name: '特殊字符用户', category: '边界', truthData: { displayName: '🎉✨🌟', gender: '🚀', birthYear: 1995, currentCity: '💎深圳💎', interests: ['🎮', '🎵'] }, behaviorStyle: { verbosity: 'normal', privacyLevel: 'open', responseSpeed: 'quick', language: 'casual' }, specialTraits: ['大量emoji'] },
  { id: 'edge-3', name: '数字昵称', category: '边界', truthData: { displayName: '12345', gender: '男性', birthYear: 1996, currentCity: '深圳', interests: ['数字'] }, behaviorStyle: { verbosity: 'minimal', privacyLevel: 'selective', responseSpeed: 'quick', language: 'casual' }, specialTraits: ['纯数字回复'] },
  { id: 'edge-4', name: '超长昵称', category: '边界', truthData: { displayName: '这是一个非常非常非常长的昵称你能接受吗', gender: '女性', birthYear: 1997, currentCity: '广州', interests: ['测试'] }, behaviorStyle: { verbosity: 'normal', privacyLevel: 'open', responseSpeed: 'quick', language: 'casual' }, specialTraits: ['超长输入'] },
  { id: 'edge-5', name: '年龄边界老', category: '边界', truthData: { displayName: '资深用户', gender: '男性', birthYear: 1950, currentCity: '香港', interests: ['太极', '书法'] }, behaviorStyle: { verbosity: 'normal', privacyLevel: 'open', responseSpeed: 'thoughtful', language: 'formal' }, specialTraits: ['高龄用户'] },
  { id: 'edge-6', name: '年龄边界小', category: '边界', truthData: { displayName: '小朋友', gender: '女性', birthYear: 2010, currentCity: '深圳', interests: ['玩具'] }, behaviorStyle: { verbosity: 'normal', privacyLevel: 'open', responseSpeed: 'quick', language: 'casual' }, specialTraits: ['未成年暗示'] },
  { id: 'edge-7', name: '多城市用户', category: '边界', truthData: { displayName: '飞人', gender: '男性', birthYear: 1990, currentCity: '深圳香港广州都有', interests: ['商务'] }, behaviorStyle: { verbosity: 'normal', privacyLevel: 'selective', responseSpeed: 'quick', language: 'formal' }, specialTraits: ['多地居住'] },
  { id: 'edge-8', name: '兴趣超多用户', category: '边界', truthData: { displayName: '兴趣广泛', gender: '女性', birthYear: 1993, currentCity: '深圳', interests: ['读书', '电影', '音乐', '旅行', '美食', '摄影', '运动', '游戏', '手工', '烹饪', '园艺', '宠物'] }, behaviorStyle: { verbosity: 'verbose', privacyLevel: 'open', responseSpeed: 'quick', language: 'casual' }, specialTraits: ['列举大量兴趣'] },
  { id: 'edge-9', name: '无兴趣用户', category: '边界', truthData: { displayName: '佛系', gender: '男性', birthYear: 1995, currentCity: '广州', interests: [] }, behaviorStyle: { verbosity: 'minimal', privacyLevel: 'selective', responseSpeed: 'thoughtful', language: 'casual' }, specialTraits: ['声称无爱好'] },
  { id: 'edge-10', name: '完美配合用户', category: '边界', truthData: { displayName: '模范用户', gender: '女性', birthYear: 1994, currentCity: '深圳', interests: ['配合', '友好', '积极'] }, behaviorStyle: { verbosity: 'normal', privacyLevel: 'open', responseSpeed: 'quick', language: 'casual' }, specialTraits: ['完美回答所有问题'] },
];

// ============ 模拟用户回复生成 ============
async function generateUserResponse(
  persona: UserPersona,
  xiaoyueMessage: string,
  conversationContext: string[],
  turnNumber: number
): Promise<string> {
  const personaPrompt = `你正在扮演一个用户，与名为"小悦"的AI进行注册对话。

## 你的角色设定
- 昵称: ${persona.truthData.displayName}
- 性别: ${persona.truthData.gender}
- 出生年份: ${persona.truthData.birthYear}
- 所在城市: ${persona.truthData.currentCity}
- 兴趣爱好: ${persona.truthData.interests.join('、')}
- 职业: ${persona.truthData.occupation || '未设定'}

## 你的行为风格
- 话多程度: ${persona.behaviorStyle.verbosity === 'minimal' ? '惜字如金，回答简短' : persona.behaviorStyle.verbosity === 'verbose' ? '健谈，喜欢详细分享' : '正常'}
- 隐私态度: ${persona.behaviorStyle.privacyLevel === 'guarded' ? '谨慎，不愿透露太多' : persona.behaviorStyle.privacyLevel === 'open' ? '开放，愿意分享' : '有选择性分享'}
- 语言风格: ${persona.behaviorStyle.language === 'formal' ? '正式礼貌' : persona.behaviorStyle.language === 'mixed' ? '中英混用' : '随意口语化'}
- 特殊特点: ${persona.specialTraits.join('、') || '无'}

## 当前对话轮次: ${turnNumber}
如果是第1-2轮，主要回答昵称问题。
如果是第3-4轮，可以回答性别和年龄问题。
如果是第5轮以后，可以分享兴趣和城市信息。

## 小悦刚才说:
${xiaoyueMessage}

## 之前的对话:
${conversationContext.slice(-4).join('\n')}

请以这个用户的身份回复小悦。只输出用户的回复内容，不要加任何解释。`;

  try {
    const response = await deepseekClient.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: '你是一个角色扮演助手，扮演指定的用户角色进行对话。' },
        { role: 'user', content: personaPrompt }
      ],
      temperature: 0.9,
      max_tokens: 200,
    });
    return response.choices[0]?.message?.content || '嗯';
  } catch (error) {
    console.error('Error generating user response:', error);
    return '好的';
  }
}

// ============ 小悦对话API调用 ============
interface ChatMessage {
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

## 极简用户引导策略
如果用户连续2-3次只回复1-2个字（如"嗯"、"好"、"可以"），主动提供选项降低输入门槛：
- 例如："你平时喜欢什么类型的活动呀？比如 A.美食探店 B.户外运动 C.文艺看展 D.桌游电影，直接回字母就行～"
- 例如："你大概是哪个年代的小伙伴呀？A.85后 B.90后 C.95后 D.00后"

## 信息确认环节
在收集完必须信息后、结束对话前，简短确认一下：
- 例如："好啦，我来确认一下：昵称小雨、女生、95后、在深圳、喜欢美食和摄影～这样对吗？有要改的随时说～"
- 用户确认后再发送结束信号

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

async function xiaoyueRespond(conversationHistory: ChatMessage[]): Promise<{
  message: string;
  rawMessage: string;
  isComplete: boolean;
  collectedInfo: any;
}> {
  try {
    const response = await deepseekClient.chat.completions.create({
      model: 'deepseek-chat',
      messages: conversationHistory.map(msg => ({
        role: msg.role as 'system' | 'user' | 'assistant',
        content: msg.content
      })),
      temperature: 0.8,
      max_tokens: 800,
    });

    const rawMessage = response.choices[0]?.message?.content || '抱歉，我走神了一下';
    const isComplete = rawMessage.includes('```registration_complete');
    
    // Extract collected info
    const infoMatch = rawMessage.match(/```collected_info\s*([\s\S]*?)```/);
    let collectedInfo = {};
    if (infoMatch) {
      try {
        collectedInfo = JSON.parse(infoMatch[1].trim());
      } catch {}
    }

    const cleanMessage = rawMessage
      .replace(/```collected_info[\s\S]*?```/g, '')
      .replace(/```registration_complete[\s\S]*?```/g, '')
      .trim();

    return { message: cleanMessage, rawMessage, isComplete, collectedInfo };
  } catch (error) {
    console.error('Xiaoyue API error:', error);
    throw error;
  }
}

// ============ 单次模拟对话 ============
interface SimulationResult {
  personaId: string;
  personaName: string;
  category: string;
  success: boolean;
  turnCount: number;
  collectedFields: string[];
  extractedInfo: any;
  truthData: any;
  extractionAccuracy: number;
  conversationLog: string[];
  errors: string[];
  durationMs: number;
}

async function simulateConversation(persona: UserPersona): Promise<SimulationResult> {
  const startTime = Date.now();
  const conversationHistory: ChatMessage[] = [
    { role: 'system', content: XIAOYUE_SYSTEM_PROMPT },
    { role: 'assistant', content: XIAOYUE_OPENING }
  ];
  const conversationLog: string[] = [`[小悦] ${XIAOYUE_OPENING}`];
  const collectedFields: string[] = [];
  const errors: string[] = [];
  let turnCount = 0;
  let isComplete = false;
  let allCollectedInfo: any = {};

  const MAX_TURNS = 15;

  try {
    while (!isComplete && turnCount < MAX_TURNS) {
      turnCount++;

      // Generate user response
      const userResponse = await generateUserResponse(
        persona,
        conversationHistory[conversationHistory.length - 1].content,
        conversationLog,
        turnCount
      );
      
      conversationLog.push(`[用户] ${userResponse}`);
      conversationHistory.push({ role: 'user', content: userResponse });

      // Get Xiaoyue's response
      const xiaoyueResult = await xiaoyueRespond(conversationHistory);
      conversationLog.push(`[小悦] ${xiaoyueResult.message}`);
      conversationHistory.push({ role: 'assistant', content: xiaoyueResult.rawMessage });

      // Track collected info
      if (xiaoyueResult.collectedInfo && Object.keys(xiaoyueResult.collectedInfo).length > 0) {
        Object.keys(xiaoyueResult.collectedInfo).forEach(key => {
          if (!collectedFields.includes(key)) {
            collectedFields.push(key);
          }
        });
        allCollectedInfo = { ...allCollectedInfo, ...xiaoyueResult.collectedInfo };
      }

      isComplete = xiaoyueResult.isComplete;

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Calculate extraction accuracy
    let matchCount = 0;
    let totalFields = 0;
    
    if (persona.truthData.displayName && allCollectedInfo.displayName) {
      totalFields++;
      if (allCollectedInfo.displayName.includes(persona.truthData.displayName) || 
          persona.truthData.displayName.includes(allCollectedInfo.displayName)) {
        matchCount++;
      }
    }
    if (persona.truthData.gender) {
      totalFields++;
      if (allCollectedInfo.gender === persona.truthData.gender) {
        matchCount++;
      }
    }
    if (persona.truthData.currentCity) {
      totalFields++;
      if (allCollectedInfo.currentCity?.includes(persona.truthData.currentCity) ||
          persona.truthData.currentCity.includes(allCollectedInfo.currentCity || '')) {
        matchCount++;
      }
    }

    const extractionAccuracy = totalFields > 0 ? (matchCount / totalFields) * 100 : 0;

    return {
      personaId: persona.id,
      personaName: persona.name,
      category: persona.category,
      success: isComplete,
      turnCount,
      collectedFields,
      extractedInfo: allCollectedInfo,
      truthData: persona.truthData,
      extractionAccuracy,
      conversationLog,
      errors,
      durationMs: Date.now() - startTime
    };
  } catch (error: any) {
    errors.push(error.message || 'Unknown error');
    return {
      personaId: persona.id,
      personaName: persona.name,
      category: persona.category,
      success: false,
      turnCount,
      collectedFields,
      extractedInfo: allCollectedInfo,
      truthData: persona.truthData,
      extractionAccuracy: 0,
      conversationLog,
      errors,
      durationMs: Date.now() - startTime
    };
  }
}

// ============ 批量测试运行 ============
interface TestReport {
  totalTests: number;
  successCount: number;
  failureCount: number;
  completionRate: number;
  averageTurns: number;
  averageExtractionAccuracy: number;
  categoryBreakdown: Record<string, { success: number; total: number; avgTurns: number }>;
  fieldCoverage: Record<string, number>;
  commonErrors: string[];
  results: SimulationResult[];
  timestamp: string;
  durationMinutes: number;
}

async function runSimulationBatch(
  personas: UserPersona[],
  concurrency: number = 2
): Promise<TestReport> {
  const startTime = Date.now();
  const results: SimulationResult[] = [];
  
  console.log(`\n🚀 开始模拟测试: ${personas.length} 个用户画像\n`);
  console.log('='.repeat(60));

  // Process in batches to control concurrency
  for (let i = 0; i < personas.length; i += concurrency) {
    const batch = personas.slice(i, i + concurrency);
    console.log(`\n📊 处理批次 ${Math.floor(i / concurrency) + 1}/${Math.ceil(personas.length / concurrency)}`);
    
    const batchResults = await Promise.all(
      batch.map(async (persona, idx) => {
        console.log(`  ▸ 测试 [${persona.id}] ${persona.name}...`);
        const result = await simulateConversation(persona);
        console.log(`  ${result.success ? '✅' : '❌'} [${persona.id}] ${result.turnCount}轮, ${result.collectedFields.length}字段`);
        return result;
      })
    );
    
    results.push(...batchResults);
    
    // Delay between batches
    if (i + concurrency < personas.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // Calculate statistics
  const successCount = results.filter(r => r.success).length;
  const totalTurns = results.reduce((sum, r) => sum + r.turnCount, 0);
  const totalAccuracy = results.reduce((sum, r) => sum + r.extractionAccuracy, 0);

  const categoryBreakdown: Record<string, { success: number; total: number; avgTurns: number }> = {};
  results.forEach(r => {
    if (!categoryBreakdown[r.category]) {
      categoryBreakdown[r.category] = { success: 0, total: 0, avgTurns: 0 };
    }
    categoryBreakdown[r.category].total++;
    if (r.success) categoryBreakdown[r.category].success++;
    categoryBreakdown[r.category].avgTurns += r.turnCount;
  });
  Object.keys(categoryBreakdown).forEach(cat => {
    categoryBreakdown[cat].avgTurns /= categoryBreakdown[cat].total;
  });

  const fieldCoverage: Record<string, number> = {};
  results.forEach(r => {
    r.collectedFields.forEach(field => {
      fieldCoverage[field] = (fieldCoverage[field] || 0) + 1;
    });
  });

  const allErrors = results.flatMap(r => r.errors);
  const errorCounts: Record<string, number> = {};
  allErrors.forEach(err => {
    errorCounts[err] = (errorCounts[err] || 0) + 1;
  });
  const commonErrors = Object.entries(errorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([err, count]) => `${err} (${count}次)`);

  const report: TestReport = {
    totalTests: results.length,
    successCount,
    failureCount: results.length - successCount,
    completionRate: (successCount / results.length) * 100,
    averageTurns: totalTurns / results.length,
    averageExtractionAccuracy: totalAccuracy / results.length,
    categoryBreakdown,
    fieldCoverage,
    commonErrors,
    results,
    timestamp: new Date().toISOString(),
    durationMinutes: (Date.now() - startTime) / 60000
  };

  return report;
}

// ============ 报告生成 ============
function generateReportMarkdown(report: TestReport): string {
  let md = `# 小悦对话注册模拟测试报告

## 测试概览

| 指标 | 数值 |
|------|------|
| 测试时间 | ${report.timestamp} |
| 测试总数 | ${report.totalTests} |
| 成功数 | ${report.successCount} |
| 失败数 | ${report.failureCount} |
| **完成率** | **${report.completionRate.toFixed(1)}%** |
| 平均对话轮数 | ${report.averageTurns.toFixed(1)} |
| 平均信息提取准确率 | ${report.averageExtractionAccuracy.toFixed(1)}% |
| 测试耗时 | ${report.durationMinutes.toFixed(1)} 分钟 |

## 分类表现

| 用户类型 | 成功/总数 | 成功率 | 平均轮数 |
|----------|-----------|--------|----------|
`;

  Object.entries(report.categoryBreakdown).forEach(([cat, data]) => {
    const rate = ((data.success / data.total) * 100).toFixed(1);
    md += `| ${cat} | ${data.success}/${data.total} | ${rate}% | ${data.avgTurns.toFixed(1)} |\n`;
  });

  md += `
## 字段收集覆盖率

| 字段 | 收集次数 | 覆盖率 |
|------|----------|--------|
`;

  Object.entries(report.fieldCoverage)
    .sort((a, b) => b[1] - a[1])
    .forEach(([field, count]) => {
      const rate = ((count / report.totalTests) * 100).toFixed(1);
      md += `| ${field} | ${count} | ${rate}% |\n`;
    });

  if (report.commonErrors.length > 0) {
    md += `
## 常见错误

`;
    report.commonErrors.forEach(err => {
      md += `- ${err}\n`;
    });
  }

  md += `
## 详细结果

<details>
<summary>点击展开全部 ${report.results.length} 个测试结果</summary>

`;

  report.results.forEach((r, idx) => {
    const status = r.success ? '✅' : '❌';
    md += `### ${idx + 1}. ${status} [${r.personaId}] ${r.personaName}

- **分类**: ${r.category}
- **轮数**: ${r.turnCount}
- **收集字段**: ${r.collectedFields.join(', ') || '无'}
- **提取准确率**: ${r.extractionAccuracy.toFixed(1)}%
${r.errors.length > 0 ? `- **错误**: ${r.errors.join(', ')}` : ''}

<details>
<summary>对话记录</summary>

\`\`\`
${r.conversationLog.join('\n\n')}
\`\`\`

</details>

---

`;
  });

  md += `</details>

## 结论与建议

### 优势
- 完成率: ${report.completionRate >= 80 ? '良好' : report.completionRate >= 60 ? '中等' : '需改进'}
- 平均对话轮数: ${report.averageTurns <= 8 ? '高效' : report.averageTurns <= 12 ? '正常' : '偏长'}

### 改进建议
${report.completionRate < 80 ? '- 优化对简短回复的处理能力\n' : ''}${report.averageTurns > 10 ? '- 提高信息收集效率，减少对话轮数\n' : ''}${Object.keys(report.fieldCoverage).length < 5 ? '- 增强兴趣爱好等字段的收集率\n' : ''}

---
*报告生成时间: ${report.timestamp}*
`;

  return md;
}

// ============ 主函数 ============
async function main() {
  const args = process.argv.slice(2);
  const testCount = parseInt(args[0]) || 30; // Default to 30 for smoke test
  
  console.log('\n' + '='.repeat(60));
  console.log('     小悦对话注册 - 模拟测试系统');
  console.log('='.repeat(60));
  
  // Select personas based on test count
  let selectedPersonas: UserPersona[];
  if (testCount >= 50) {
    // Full test - use all personas, potentially multiple times
    const repetitions = Math.ceil(testCount / 50);
    selectedPersonas = [];
    for (let i = 0; i < repetitions; i++) {
      selectedPersonas.push(...USER_PERSONAS.slice(0, Math.min(testCount - selectedPersonas.length, 50)));
    }
  } else {
    // Stratified sampling - ensure coverage of all categories
    const categories = ['标准', '极简', '健谈', '特殊', '边界'];
    const perCategory = Math.ceil(testCount / categories.length);
    selectedPersonas = [];
    categories.forEach(cat => {
      const catPersonas = USER_PERSONAS.filter(p => p.category === cat);
      selectedPersonas.push(...catPersonas.slice(0, perCategory));
    });
    selectedPersonas = selectedPersonas.slice(0, testCount);
  }
  
  console.log(`\n📋 选择了 ${selectedPersonas.length} 个测试用户画像`);
  console.log(`   分布: ${['标准', '极简', '健谈', '特殊', '边界'].map(cat => 
    `${cat}(${selectedPersonas.filter(p => p.category === cat).length})`
  ).join(', ')}`);

  // Run simulations
  const report = await runSimulationBatch(selectedPersonas, 2);

  // Generate and save report
  const reportMd = generateReportMarkdown(report);
  const reportPath = `scripts/simulation_report_${new Date().toISOString().slice(0, 10)}.md`;
  
  const fs = await import('fs');
  fs.writeFileSync(reportPath, reportMd);
  
  console.log('\n' + '='.repeat(60));
  console.log('                    测试完成！');
  console.log('='.repeat(60));
  console.log(`\n📊 测试结果摘要:`);
  console.log(`   完成率: ${report.completionRate.toFixed(1)}%`);
  console.log(`   平均轮数: ${report.averageTurns.toFixed(1)}`);
  console.log(`   平均准确率: ${report.averageExtractionAccuracy.toFixed(1)}%`);
  console.log(`   测试耗时: ${report.durationMinutes.toFixed(1)} 分钟`);
  console.log(`\n📄 详细报告已保存: ${reportPath}`);
  console.log('='.repeat(60) + '\n');

  // Also output JSON for programmatic access
  const jsonPath = `scripts/simulation_results_${new Date().toISOString().slice(0, 10)}.json`;
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  console.log(`📦 JSON数据已保存: ${jsonPath}\n`);
}

main().catch(console.error);
