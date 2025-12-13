/**
 * 小悦对话注册模拟测试脚本
 * 用于A/B测试评估对话式注册的用户体验
 */

import OpenAI from 'openai';

const deepseekClient = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com',
});

// 50个用户画像
const userProfiles = [
  // 年轻职场人 (10个)
  { name: "小美", age: 24, gender: "女", city: "深圳", job: "互联网产品经理", interests: ["旅行", "美食", "摄影"], style: "活泼健谈" },
  { name: "阿杰", age: 26, gender: "男", city: "深圳", job: "程序员", interests: ["游戏", "健身", "电影"], style: "内向简短" },
  { name: "莉莉", age: 25, gender: "女", city: "香港", job: "金融分析师", interests: ["红酒", "瑜伽", "看书"], style: "专业正式" },
  { name: "小王", age: 28, gender: "男", city: "广州", job: "创业者", interests: ["商业", "高尔夫", "投资"], style: "直接高效" },
  { name: "晓晓", age: 23, gender: "女", city: "深圳", job: "设计师", interests: ["艺术", "咖啡", "逛展"], style: "文艺感性" },
  { name: "大伟", age: 27, gender: "男", city: "香港", job: "律师", interests: ["阅读", "辩论", "威士忌"], style: "理性逻辑" },
  { name: "小雨", age: 24, gender: "女", city: "深圳", job: "市场营销", interests: ["社交", "KTV", "购物"], style: "热情外向" },
  { name: "阿明", age: 29, gender: "男", city: "广州", job: "销售总监", interests: ["高尔夫", "品酒", "networking"], style: "商务社交" },
  { name: "琪琪", age: 22, gender: "女", city: "深圳", job: "应届生", interests: ["追剧", "逛街", "小红书"], style: "可爱撒娇" },
  { name: "小陈", age: 30, gender: "男", city: "香港", job: "投行", interests: ["健身", "赛车", "旅行"], style: "精英简洁" },
  
  // 成熟职场人 (10个)
  { name: "张姐", age: 35, gender: "女", city: "深圳", job: "HR总监", interests: ["茶道", "烘焙", "亲子"], style: "温和稳重" },
  { name: "李哥", age: 38, gender: "男", city: "广州", job: "企业高管", interests: ["钓鱼", "品茶", "书法"], style: "成熟稳健" },
  { name: "王姐", age: 33, gender: "女", city: "香港", job: "医生", interests: ["音乐", "烹饪", "养生"], style: "专业关怀" },
  { name: "老周", age: 40, gender: "男", city: "深圳", job: "技术总监", interests: ["摄影", "徒步", "科技"], style: "技术geek" },
  { name: "陈姐", age: 36, gender: "女", city: "深圳", job: "律所合伙人", interests: ["旅行", "红酒", "艺术"], style: "干练优雅" },
  { name: "刘哥", age: 42, gender: "男", city: "香港", job: "基金经理", interests: ["高尔夫", "古董", "投资"], style: "沉稳精准" },
  { name: "黄姐", age: 34, gender: "女", city: "广州", job: "创业者", interests: ["商业", "社交", "健身"], style: "自信果断" },
  { name: "赵哥", age: 37, gender: "男", city: "深圳", job: "建筑师", interests: ["设计", "摄影", "旅行"], style: "艺术创意" },
  { name: "孙姐", age: 32, gender: "女", city: "深圳", job: "咨询顾问", interests: ["阅读", "瑜伽", "心理学"], style: "理性分析" },
  { name: "吴哥", age: 39, gender: "男", city: "香港", job: "银行家", interests: ["红酒", "马术", "收藏"], style: "精英严谨" },
  
  // 个性鲜明 (10个)
  { name: "疯狂小张", age: 25, gender: "男", city: "深圳", job: "自媒体", interests: ["脱口秀", "密室逃脱", "剧本杀"], style: "幽默搞笑" },
  { name: "佛系小林", age: 27, gender: "女", city: "广州", job: "自由职业", interests: ["冥想", "素食", "瑜伽"], style: "佛系淡然" },
  { name: "社恐小李", age: 23, gender: "男", city: "深圳", job: "程序员", interests: ["游戏", "动漫", "宅"], style: "害羞回避" },
  { name: "话痨小陈", age: 26, gender: "女", city: "香港", job: "主播", interests: ["化妆", "唱歌", "社交"], style: "话多热情" },
  { name: "冷淡风", age: 28, gender: "男", city: "深圳", job: "独立音乐人", interests: ["音乐", "咖啡", "独处"], style: "高冷简短" },
  { name: "撒娇怪", age: 22, gender: "女", city: "深圳", job: "学生", interests: ["萌宠", "甜品", "追星"], style: "撒娇卖萌" },
  { name: "理工男", age: 29, gender: "男", city: "广州", job: "工程师", interests: ["数码", "编程", "科幻"], style: "逻辑直男" },
  { name: "文艺青年", age: 24, gender: "女", city: "深圳", job: "编辑", interests: ["写作", "电影", "诗歌"], style: "文艺深沉" },
  { name: "运动达人", age: 26, gender: "男", city: "香港", job: "健身教练", interests: ["健身", "跑步", "户外"], style: "阳光积极" },
  { name: "吃货小姐姐", age: 25, gender: "女", city: "深圳", job: "美食博主", interests: ["美食", "探店", "烹饪"], style: "热爱生活" },
  
  // 特殊场景 (10个)
  { name: "匿名用户", age: 30, gender: "不透露", city: "深圳", job: "不想说", interests: ["隐私"], style: "保护隐私" },
  { name: "急性子", age: 27, gender: "男", city: "深圳", job: "销售", interests: ["快"], style: "极度简短" },
  { name: "质疑者", age: 32, gender: "女", city: "香港", job: "记者", interests: ["真相"], style: "质疑怀疑" },
  { name: "跑题王", age: 24, gender: "男", city: "广州", job: "学生", interests: ["闲聊"], style: "经常跑题" },
  { name: "完美主义", age: 29, gender: "女", city: "深圳", job: "设计师", interests: ["细节"], style: "追求完美" },
  { name: "懒惰型", age: 26, gender: "男", city: "深圳", job: "无业", interests: ["躺平"], style: "敷衍了事" },
  { name: "热心肠", age: 35, gender: "女", city: "香港", job: "社工", interests: ["公益", "帮助他人"], style: "热情过度" },
  { name: "技术控", age: 28, gender: "男", city: "深圳", job: "AI工程师", interests: ["AI", "机器人"], style: "测试系统" },
  { name: "新手妈妈", age: 31, gender: "女", city: "广州", job: "全职妈妈", interests: ["育儿", "亲子", "烘焙"], style: "温柔耐心" },
  { name: "海归精英", age: 33, gender: "男", city: "香港", job: "咨询", interests: ["国际视野", "投资"], style: "中英混搭" },
  
  // 边缘测试 (10个)
  { name: "表情包达人", age: 21, gender: "女", city: "深圳", job: "学生", interests: ["表情包"], style: "大量emoji" },
  { name: "方言王", age: 45, gender: "男", city: "广州", job: "生意人", interests: ["茶", "麻将"], style: "粤语夹杂" },
  { name: "极简主义", age: 30, gender: "女", city: "深圳", job: "设计师", interests: ["简单"], style: "一个字回复" },
  { name: "信息过载", age: 28, gender: "男", city: "香港", job: "产品经理", interests: ["什么都喜欢"], style: "信息过多" },
  { name: "选择困难", age: 25, gender: "女", city: "深圳", job: "行政", interests: ["不确定"], style: "纠结犹豫" },
  { name: "反问王", age: 27, gender: "男", city: "广州", job: "律师", interests: ["辩论"], style: "反问一切" },
  { name: "故事型", age: 35, gender: "女", city: "深圳", job: "作家", interests: ["写作"], style: "长篇大论" },
  { name: "数字控", age: 29, gender: "男", city: "香港", job: "数据分析", interests: ["数据"], style: "精确数字" },
  { name: "怀旧派", age: 40, gender: "女", city: "广州", job: "老师", interests: ["怀旧"], style: "怀念过去" },
  { name: "未来派", age: 22, gender: "男", city: "深圳", job: "学生", interests: ["元宇宙", "AI"], style: "科技未来" },
];

// 小悦系统提示词
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

## 需要收集的信息
1. 昵称 2. 性别 3. 年龄段 4. 所在城市 5. 职业/行业 6. 兴趣爱好 7. 场地风格偏好 8. 不想聊的话题

## 结束信号
当收集到足够信息（至少昵称+性别+城市+2个兴趣），标记 \`\`\`registration_complete\ntrue\n\`\`\``;

const XIAOYUE_OPENING = `嘿～欢迎来到JoyJoin！我是小悦，你的社交向导 ✨

在这里，我们会帮你找到志同道合的小伙伴，一起参加各种有趣的小型饭局和活动！

我先来认识一下你吧～你希望大家怎么称呼你呀？可以是真名，也可以是你喜欢的昵称～`;

// 模拟用户回复生成器
async function generateUserResponse(
  profile: typeof userProfiles[0],
  conversationHistory: { role: string; content: string }[],
  turnNumber: number
): Promise<string> {
  const prompt = `你现在扮演一个正在注册社交App的用户，以下是你的人物设定：
  
姓名：${profile.name}
年龄：${profile.age}岁
性别：${profile.gender}
城市：${profile.city}
职业：${profile.job}
兴趣：${profile.interests.join('、')}
说话风格：${profile.style}

这是你与AI助手"小悦"的对话历史：
${conversationHistory.map(m => `${m.role === 'assistant' ? '小悦' : '你'}: ${m.content}`).join('\n')}

现在轮到你回复了。请根据你的人设风格，自然地回答小悦的问题。
- 如果小悦问了你的信息，就根据人设回答
- 保持你的说话风格特点
- 回复长度适中，像真实聊天
- 这是第${turnNumber}轮对话

直接输出你的回复，不要加任何解释或引号：`;

  const response = await deepseekClient.chat.completions.create({
    model: 'deepseek-chat',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.9,
    max_tokens: 200,
  });

  return response.choices[0]?.message?.content || '好的';
}

// 模拟单次对话
async function simulateConversation(profile: typeof userProfiles[0]): Promise<{
  success: boolean;
  turns: number;
  collectedFields: string[];
  transcript: string[];
  error?: string;
}> {
  const transcript: string[] = [];
  const conversationHistory: { role: string; content: string }[] = [
    { role: 'system', content: XIAOYUE_SYSTEM_PROMPT },
    { role: 'assistant', content: XIAOYUE_OPENING }
  ];
  
  transcript.push(`小悦: ${XIAOYUE_OPENING}`);
  
  const maxTurns = 15;
  let turns = 0;
  let isComplete = false;
  
  try {
    for (let i = 0; i < maxTurns; i++) {
      turns++;
      
      // 生成用户回复
      const userMessage = await generateUserResponse(profile, conversationHistory, turns);
      conversationHistory.push({ role: 'user', content: userMessage });
      transcript.push(`${profile.name}: ${userMessage}`);
      
      // 获取小悦回复
      const response = await deepseekClient.chat.completions.create({
        model: 'deepseek-chat',
        messages: conversationHistory.map(m => ({
          role: m.role as 'system' | 'user' | 'assistant',
          content: m.content
        })),
        temperature: 0.8,
        max_tokens: 500,
      });
      
      const assistantMessage = response.choices[0]?.message?.content || '';
      const cleanMessage = assistantMessage
        .replace(/```collected_info[\s\S]*?```/g, '')
        .replace(/```registration_complete[\s\S]*?```/g, '')
        .trim();
      
      conversationHistory.push({ role: 'assistant', content: cleanMessage });
      transcript.push(`小悦: ${cleanMessage}`);
      
      if (assistantMessage.includes('registration_complete')) {
        isComplete = true;
        break;
      }
    }
    
    // 分析收集到的字段
    const collectedFields: string[] = [];
    const fullText = transcript.join(' ');
    if (fullText.includes(profile.name) || fullText.match(/叫|称呼/)) collectedFields.push('displayName');
    if (fullText.includes(profile.gender)) collectedFields.push('gender');
    if (fullText.includes(profile.city)) collectedFields.push('city');
    if (fullText.includes(profile.job)) collectedFields.push('occupation');
    if (profile.interests.some(i => fullText.includes(i))) collectedFields.push('interests');
    
    return {
      success: isComplete,
      turns,
      collectedFields,
      transcript,
    };
  } catch (error: any) {
    return {
      success: false,
      turns,
      collectedFields: [],
      transcript,
      error: error.message,
    };
  }
}

// 运行批量测试
async function runSimulation(count: number = 20) {
  console.log(`\n🚀 开始模拟测试 - 共 ${count} 次对话\n`);
  console.log('='.repeat(60));
  
  const results: {
    success: boolean;
    turns: number;
    collectedFields: string[];
    profileName: string;
    style: string;
  }[] = [];
  
  const startTime = Date.now();
  
  for (let i = 0; i < count; i++) {
    const profile = userProfiles[i % userProfiles.length];
    console.log(`\n[${i + 1}/${count}] 测试用户: ${profile.name} (${profile.style})`);
    
    const result = await simulateConversation(profile);
    results.push({
      success: result.success,
      turns: result.turns,
      collectedFields: result.collectedFields,
      profileName: profile.name,
      style: profile.style,
    });
    
    console.log(`  ✓ 完成: ${result.success ? '成功' : '未完成'}, ${result.turns}轮, 收集${result.collectedFields.length}项`);
    
    // 避免速率限制
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  const endTime = Date.now();
  
  // 生成报告
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 模拟测试报告\n');
  
  const successCount = results.filter(r => r.success).length;
  const avgTurns = results.reduce((sum, r) => sum + r.turns, 0) / results.length;
  const avgFields = results.reduce((sum, r) => sum + r.collectedFields.length, 0) / results.length;
  
  console.log(`测试数量: ${count}`);
  console.log(`完成率: ${(successCount / count * 100).toFixed(1)}%`);
  console.log(`平均对话轮数: ${avgTurns.toFixed(1)}`);
  console.log(`平均收集信息项: ${avgFields.toFixed(1)}`);
  console.log(`总耗时: ${((endTime - startTime) / 1000).toFixed(1)}秒`);
  
  // 按风格分组统计
  console.log('\n按用户风格分组统计:');
  const byStyle = new Map<string, { success: number; total: number; turns: number[] }>();
  results.forEach(r => {
    const existing = byStyle.get(r.style) || { success: 0, total: 0, turns: [] };
    existing.total++;
    if (r.success) existing.success++;
    existing.turns.push(r.turns);
    byStyle.set(r.style, existing);
  });
  
  byStyle.forEach((data, style) => {
    const avgT = data.turns.reduce((a, b) => a + b, 0) / data.turns.length;
    console.log(`  ${style}: ${data.success}/${data.total} 成功, 平均${avgT.toFixed(1)}轮`);
  });
  
  console.log('\n✅ 测试完成!\n');
}

// 主入口
const testCount = parseInt(process.argv[2] || '20');
runSimulation(testCount).catch(console.error);
