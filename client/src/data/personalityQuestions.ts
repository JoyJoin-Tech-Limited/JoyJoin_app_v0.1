/**
 * 12个社交氛围原型性格测评题库
 * 10题精准区分：开心柯基、太阳鸡、夸夸豚、机智狐、淡定海豚、织网蛛、暖心熊、灵感章鱼、沉思猫头鹰、定心大象、稳如龟、隐身猫
 */

export interface QuestionOption {
  value: string;
  text: string;
  roleMapping: string; // 映射到12个原型之一
  tag?: string; // 行为标签，用于增强视觉辨识度
}

export interface Question {
  id: number;
  category: string;
  questionText: string;
  scenarioText?: string;
  questionType: "single" | "dual";
  options: QuestionOption[];
}

export const personalityQuestions: Question[] = [
  {
    id: 1,
    category: "社交启动方式",
    scenarioText: "🎉 朋友生日聚会，你走进包厢，发现有5个人你都不认识...",
    questionText: "刚进门，你最自然的反应是？",
    questionType: "single",
    options: [
      { value: "A", text: "大声说「大家好！」用幽默开场让全场笑起来", roleMapping: "开心柯基", tag: "主动破冰" },
      { value: "B", text: "找到寿星，让ta来帮你介绍认识大家", roleMapping: "淡定海豚", tag: "借力社交" },
      { value: "C", text: "先找个角落坐下，用手机掩饰，默默观察", roleMapping: "隐身猫", tag: "隐身观察" },
      { value: "D", text: "挨个问「你是怎么认识XX的」，建立人际连接", roleMapping: "织网蛛", tag: "主动连接" },
    ],
  },
  
  {
    id: 2,
    category: "能量释放模式",
    scenarioText: "💬 话题聊起来了，有人提到最近发现的一家神秘咖啡馆...",
    questionText: "听到这个新鲜事，你的反应是？",
    questionType: "single",
    options: [
      { value: "A", text: "\"在哪里？我们现在就去！\" 立马拉人组队行动", roleMapping: "机智狐", tag: "即刻行动" },
      { value: "B", text: "\"哇好棒！你发现的地方都好有品味！\" 热情夸赞", roleMapping: "夸夸豚", tag: "赞美肯定" },
      { value: "C", text: "\"我之前也去过类似的，那次的故事是...\" 分享经历", roleMapping: "暖心熊", tag: "故事共鸣" },
      { value: "D", text: "\"这家店的定位是什么？为什么能火？\" 深挖原因", roleMapping: "沉思猫头鹰", tag: "深度分析" },
    ],
  },
  
  {
    id: 3,
    category: "情绪调节角色",
    scenarioText: "😔 气氛突然安静下来，有人分享了一段失落的经历...",
    questionText: "面对这个情绪低点，你会？",
    questionType: "dual",
    options: [
      { value: "A", text: "握住ta的手，说\"我懂...\"然后安静地深度倾听", roleMapping: "暖心熊", tag: "深度共情" },
      { value: "B", text: "\"没事！一切都会好的！我们都支持你！\" 积极鼓励", roleMapping: "太阳鸡", tag: "阳光鼓励" },
      { value: "C", text: "默默递纸巾，全程不说话，用眼神表达理解", roleMapping: "隐身猫", tag: "无声陪伴" },
      { value: "D", text: "等情绪稳定后，巧妙引入轻松话题转移注意力", roleMapping: "淡定海豚", tag: "氛围调控" },
    ],
  },
  
  {
    id: 4,
    category: "思维表达方式",
    scenarioText: "🌟 大家在讨论：\"如果能开一家梦想小店，你会开什么？\"",
    questionText: "你的大脑会？",
    questionType: "dual",
    options: [
      { value: "A", text: "\"猫咖！书店！奶茶车！还有...\" 5秒内冒出10个点子", roleMapping: "灵感章鱼", tag: "创意爆发" },
      { value: "B", text: "\"首先，目标客户是谁？核心竞争力是...\" 框架分析", roleMapping: "沉思猫头鹰", tag: "逻辑拆解" },
      { value: "C", text: "\"哎！A的想法+B的资源，你俩可以合作！\" 牵线搭桥", roleMapping: "织网蛛", tag: "人脉连接" },
      { value: "D", text: "\"租金、证照、启动资金...我来算一下\" 落地执行", roleMapping: "定心大象", tag: "务实规划" },
    ],
  },
  
  {
    id: 5,
    category: "冲突应对策略",
    scenarioText: "🤔 两个人就\"奶茶该喝全糖还是少糖\"开始认真争论，气氛有点紧张...",
    questionText: "你会如何应对？",
    questionType: "single",
    options: [
      { value: "A", text: "\"哈哈哈！要不猜拳决定？输的请客！\" 搞笑化解", roleMapping: "开心柯基", tag: "幽默破冰" },
      { value: "B", text: "分别私聊两人，协调出一个双方都能接受的方案", roleMapping: "淡定海豚", tag: "私下调解" },
      { value: "C", text: "一言不发，低头玩手机，等他们自己聊完", roleMapping: "稳如龟", tag: "沉默等待" },
      { value: "D", text: "\"说个冷知识：糖的甜度感知其实因人而异...\" 科普转移", roleMapping: "灵感章鱼", tag: "知识引流" },
    ],
  },
  
  {
    id: 6,
    category: "贡献价值方式",
    scenarioText: "💡 话题转向\"大家今年最大的成长是什么\"...",
    questionText: "你倾向于贡献什么？",
    questionType: "dual",
    options: [
      { value: "A", text: "等别人说完，最后总结：\"我觉得核心是...\" 一针见血", roleMapping: "稳如龟", tag: "压轴总结" },
      { value: "B", text: "\"哇！你们都好厉害！\" 边听边鼓掌，疯狂点赞", roleMapping: "夸夸豚", tag: "热情捧场" },
      { value: "C", text: "\"说到成长，我想起一个故事...\" 娓娓道来感人经历", roleMapping: "暖心熊", tag: "故事分享" },
      { value: "D", text: "\"成长最重要的是稳定，比如我这样做...\" 方法论输出", roleMapping: "定心大象", tag: "经验输出" },
    ],
  },
  
  {
    id: 7,
    category: "社交舒适区",
    scenarioText: "🎯 聚会进行到一半，你感觉最舒服的状态是？",
    questionText: "以下哪种描述最符合你？",
    questionType: "single",
    options: [
      { value: "A", text: "站在C位带节奏，全场的笑点都是你制造的", roleMapping: "开心柯基", tag: "全场焦点" },
      { value: "B", text: "像太阳一样照顾每个人，确保没人被冷落", roleMapping: "太阳鸡", tag: "普照全场" },
      { value: "C", text: "到处串场，和不同的人深聊，挖掘有趣信息", roleMapping: "机智狐", tag: "探索挖掘" },
      { value: "D", text: "找个舒服的角落，安静听大家聊，享受旁观", roleMapping: "隐身猫", tag: "边缘舒适" },
    ],
  },
  
  {
    id: 8,
    category: "深度交流偏好",
    scenarioText: "🧠 有人提议玩\"灵魂拷问\"游戏，每人回答一个深度问题...",
    questionText: "你的态度是？",
    questionType: "single",
    options: [
      { value: "A", text: "\"好玩！我先来！但...问题别太沉重哦～\" 积极但设限", roleMapping: "夸夸豚", tag: "轻松参与" },
      { value: "B", text: "\"太棒了！来聊聊人生意义！\" 眼睛放光，期待已久", roleMapping: "沉思猫头鹰", tag: "深度渴望" },
      { value: "C", text: "\"我来做主持！帮大家找到答案的共鸣点～\" 串联角色", roleMapping: "织网蛛", tag: "连接共鸣" },
      { value: "D", text: "\"你们先，我...再想想\" 尽量拖到最后，甚至跳过", roleMapping: "稳如龟", tag: "低调回避" },
    ],
  },
  
  {
    id: 9,
    category: "社交能量消耗",
    scenarioText: "⚡ 聚会结束后，你的状态是？",
    questionText: "回到家，你的感受是？",
    questionType: "single",
    options: [
      { value: "A", text: "\"累爆了但超爽！\" 躺床上还在回味今晚的高光时刻", roleMapping: "开心柯基", tag: "累并快乐" },
      { value: "B", text: "\"好充实～\" 心满意足，感觉给了很多也收获了很多", roleMapping: "太阳鸡", tag: "温暖充实" },
      { value: "C", text: "\"还行吧\" 正常消耗，独处一会儿就能恢复", roleMapping: "定心大象", tag: "平稳消耗" },
      { value: "D", text: "\"终于...\" 瘫在沙发上不想动，社交电量归零", roleMapping: "隐身猫", tag: "彻底耗尽" },
    ],
  },
  
  {
    id: 10,
    category: "核心社交动机",
    scenarioText: "🎁 如果朋友要用一句话介绍你给新朋友...",
    questionText: "你希望ta怎么说？",
    questionType: "single",
    options: [
      { value: "A", text: "\"人间小太阳，和ta在一起心情会变好！\"", roleMapping: "太阳鸡", tag: "温暖治愈" },
      { value: "B", text: "\"超会玩！总能带你发现新奇好玩的东西！\"", roleMapping: "机智狐", tag: "探索达人" },
      { value: "C", text: "\"脑洞王！创意源源不断，想法特别多！\"", roleMapping: "灵感章鱼", tag: "创意无限" },
      { value: "D", text: "\"超靠谱！关键时刻稳得一批！\"", roleMapping: "定心大象", tag: "稳定可靠" },
    ],
  },
  
  {
    id: 11,
    category: "新事物探索",
    scenarioText: "🗺️ 朋友分享了一个小众旅行目的地，你从没听说过...",
    questionText: "你的第一反应是？",
    questionType: "dual",
    options: [
      { value: "A", text: "\"太酷了！查攻略，下个月就去！\" 立刻规划行动", roleMapping: "机智狐", tag: "即刻探索" },
      { value: "B", text: "\"嗯，先看看评价和安全性...\" 谨慎评估风险", roleMapping: "沉思猫头鹰", tag: "理性评估" },
      { value: "C", text: "\"我们一起去吧！人多热闹！\" 拉人组队同行", roleMapping: "织网蛛", tag: "组队出发" },
      { value: "D", text: "\"有意思，但我再想想...\" 不急着做决定", roleMapping: "稳如龟", tag: "稳重观望" },
    ],
  },
  
  {
    id: 12,
    category: "未来畅想",
    scenarioText: "✨ 聊到\"五年后你想成为什么样的人\"...",
    questionText: "你脑海里浮现的画面是？",
    questionType: "dual",
    options: [
      { value: "A", text: "\"做着热爱的事，每天都充满新鲜感！\" 追求热情与可能性", roleMapping: "灵感章鱼", tag: "热爱驱动" },
      { value: "B", text: "\"事业稳定，能照顾好身边的人\" 务实且有担当", roleMapping: "定心大象", tag: "稳定担当" },
      { value: "C", text: "\"身边有懂我的朋友，内心平静满足\" 重视关系与内在", roleMapping: "暖心熊", tag: "关系滋养" },
      { value: "D", text: "\"健康平安就好，不求大富大贵\" 知足常乐的心态", roleMapping: "淡定海豚", tag: "平和知足" },
    ],
  },
];

/**
 * 角色映射表（用于后端计分）
 * 每个问题ID对应每个选项值到角色的映射
 */
export const roleMapping: Record<number, Record<string, string>> = {
  1: { A: "开心柯基", B: "淡定海豚", C: "隐身猫", D: "织网蛛" },
  2: { A: "机智狐", B: "夸夸豚", C: "暖心熊", D: "沉思猫头鹰" },
  3: { A: "暖心熊", B: "太阳鸡", C: "隐身猫", D: "淡定海豚" },
  4: { A: "灵感章鱼", B: "沉思猫头鹰", C: "织网蛛", D: "定心大象" },
  5: { A: "开心柯基", B: "淡定海豚", C: "稳如龟", D: "灵感章鱼" },
  6: { A: "稳如龟", B: "夸夸豚", C: "暖心熊", D: "定心大象" },
  7: { A: "开心柯基", B: "太阳鸡", C: "机智狐", D: "隐身猫" },
  8: { A: "夸夸豚", B: "沉思猫头鹰", C: "织网蛛", D: "稳如龟" },
  9: { A: "开心柯基", B: "太阳鸡", C: "定心大象", D: "隐身猫" },
  10: { A: "太阳鸡", B: "机智狐", C: "灵感章鱼", D: "定心大象" },
  11: { A: "机智狐", B: "沉思猫头鹰", C: "织网蛛", D: "稳如龟" },
  12: { A: "灵感章鱼", B: "定心大象", C: "暖心熊", D: "淡定海豚" },
};

/**
 * 检查题库覆盖度
 * 确保12个原型都有足够的题目覆盖
 */
export function validateCoverage(): Record<string, number> {
  const coverage: Record<string, number> = {};
  
  personalityQuestions.forEach(q => {
    q.options.forEach(opt => {
      coverage[opt.roleMapping] = (coverage[opt.roleMapping] || 0) + 1;
    });
  });
  
  return coverage;
}

/**
 * 补测题库 - 用于精准区分相似原型
 * 当基础测试的top2原型分数差距<3分时，从这里选择针对性题目
 */
export const supplementaryQuestions: Question[] = [
  // 1. 开心柯基 vs 太阳鸡 - 区分点：搞笑活泼 vs 温暖稳定
  {
    id: 101,
    category: "能量表达风格",
    scenarioText: "🎤 KTV聚会，大家点完歌在聊天...",
    questionText: "你更可能做什么？",
    questionType: "single",
    options: [
      { value: "A", text: "主动点搞笑歌曲，带动全场一起嗨！", roleMapping: "开心柯基" },
      { value: "B", text: "温柔地鼓励害羞的朋友：\"你唱得很好听，来一首吧～\"", roleMapping: "太阳鸡" },
    ],
  },
  {
    id: 102,
    category: "社交节奏偏好",
    scenarioText: "🎊 聚会进行到后半段，气氛有点疲惫...",
    questionText: "你的反应是？",
    questionType: "single",
    options: [
      { value: "A", text: "\"来来来！玩个游戏醒醒神！\" 提议破冰活动", roleMapping: "开心柯基" },
      { value: "B", text: "\"大家都辛苦啦～要不要吃点甜品休息一下？\" 温柔照顾", roleMapping: "太阳鸡" },
    ],
  },

  // 2. 淡定海豚 vs 织网蛛 - 区分点：氛围平衡 vs 人际连接
  {
    id: 103,
    category: "社交关注焦点",
    scenarioText: "🍜 一群人吃饭，发现有两个人全程没怎么说话...",
    questionText: "你会怎么做？",
    questionType: "single",
    options: [
      { value: "A", text: "观察整体氛围，适时调整话题让所有人都能参与", roleMapping: "淡定海豚" },
      { value: "B", text: "主动跟这两个人聊天，问\"你是做什么的？\"建立连接", roleMapping: "织网蛛" },
    ],
  },
  {
    id: 104,
    category: "冲突处理方式",
    scenarioText: "💬 微信群里两个人因为选日期起了小争执...",
    questionText: "你的第一反应是？",
    questionType: "single",
    options: [
      { value: "A", text: "私聊其中一方：\"要不咱们妥协一下？\" 协调平衡", roleMapping: "淡定海豚" },
      { value: "B", text: "群里@第三个人：\"XX你觉得呢？\" 引入更多视角", roleMapping: "织网蛛" },
    ],
  },

  // 3. 沉思猫头鹰 vs 稳如龟 - 区分点：主动思考分享 vs 沉默观察
  {
    id: 105,
    category: "发言频率",
    scenarioText: "🧠 大家在讨论一个有深度的话题...",
    questionText: "你的参与方式是？",
    questionType: "single",
    options: [
      { value: "A", text: "频繁发言，提出尖锐问题：\"但这个逻辑有个漏洞...\"", roleMapping: "沉思猫头鹰" },
      { value: "B", text: "大部分时间沉默思考，只在关键时刻说一句总结", roleMapping: "稳如龟" },
    ],
  },
  {
    id: 106,
    category: "思考表达风格",
    scenarioText: "💡 有人问你对某个社会现象的看法...",
    questionText: "你会？",
    questionType: "single",
    options: [
      { value: "A", text: "马上分析：\"这背后反映了三个问题...\" 展开深度论述", roleMapping: "沉思猫头鹰" },
      { value: "B", text: "停顿一下：\"嗯...我再想想\" 不急于表达", roleMapping: "稳如龟" },
    ],
  },

  // 4. 机智狐 vs 灵感章鱼 - 区分点：行动探索 vs 创意发散
  {
    id: 107,
    category: "新鲜事物偏好",
    scenarioText: "🎨 朋友推荐了一个新开的展览...",
    questionText: "你的兴奋点在哪？",
    questionType: "single",
    options: [
      { value: "A", text: "\"哇！在哪里？我们周末就去！\" 立刻规划行动", roleMapping: "机智狐" },
      { value: "B", text: "\"好有意思！这让我想到可以做个...\" 脑洞联想创意", roleMapping: "灵感章鱼" },
    ],
  },
  {
    id: 108,
    category: "信息处理方式",
    scenarioText: "📱 刷到一个新奇的生活方式分享...",
    questionText: "你会？",
    questionType: "single",
    options: [
      { value: "A", text: "\"我也要试试！\" 收藏并计划下周实践", roleMapping: "机智狐" },
      { value: "B", text: "\"如果把这个和那个结合...\" 产生新的创意灵感", roleMapping: "灵感章鱼" },
    ],
  },

  // 5. 暖心熊 vs 夸夸豚 - 区分点：深度共情 vs 热情鼓励
  {
    id: 109,
    category: "情感回应方式",
    scenarioText: "😢 朋友说\"我最近压力好大...\"",
    questionText: "你会怎么回应？",
    questionType: "single",
    options: [
      { value: "A", text: "\"我懂...上次我也经历过类似的...\" 深度共情并分享故事", roleMapping: "暖心熊" },
      { value: "B", text: "\"你已经很棒了！加油！我相信你可以的！\" 热情鼓励", roleMapping: "夸夸豚" },
    ],
  },
  {
    id: 110,
    category: "支持表达方式",
    scenarioText: "🎯 朋友分享了一个小成就...",
    questionText: "你的反应是？",
    questionType: "single",
    options: [
      { value: "A", text: "\"我知道你为此付出了多少努力...\" 看到背后的故事", roleMapping: "暖心熊" },
      { value: "B", text: "\"哇！太厉害了！你简直是天才！\" 夸张式赞美", roleMapping: "夸夸豚" },
    ],
  },

  // 6. 定心大象 vs 淡定海豚 - 区分点：被动稳定 vs 主动平衡
  {
    id: 111,
    category: "群体角色定位",
    scenarioText: "🎭 聚会上大家意见分歧，气氛有点乱...",
    questionText: "你倾向于？",
    questionType: "single",
    options: [
      { value: "A", text: "保持稳定存在，给大家安全感，不主动介入", roleMapping: "定心大象" },
      { value: "B", text: "主动协调：\"我们先听听A的想法，再听B的...\"", roleMapping: "淡定海豚" },
    ],
  },
  {
    id: 112,
    category: "应对变化态度",
    scenarioText: "📍 原定计划临时改了地点和时间...",
    questionText: "你的反应是？",
    questionType: "single",
    options: [
      { value: "A", text: "\"没事，我都可以～\" 包容接纳变化", roleMapping: "定心大象" },
      { value: "B", text: "\"那我们看看怎么调整比较好...\" 主动协调方案", roleMapping: "淡定海豚" },
    ],
  },

  // 7. 隐身猫 vs 稳如龟 - 区分点：完全隐身 vs 低频但有质量的发言
  {
    id: 113,
    category: "存在感管理",
    scenarioText: "💬 群聊很热闹，大家都在发言...",
    questionText: "你通常会？",
    questionType: "single",
    options: [
      { value: "A", text: "全程潜水，偶尔点个赞表示在看", roleMapping: "隐身猫" },
      { value: "B", text: "观察很久，最后发一条高质量总结", roleMapping: "稳如龟" },
    ],
  },
  {
    id: 114,
    category: "自我表达倾向",
    scenarioText: "🎤 有人点名问你的想法...",
    questionText: "你的内心独白是？",
    questionType: "single",
    options: [
      { value: "A", text: "\"啊...被cue到了...\" 希望快速应付过去", roleMapping: "隐身猫" },
      { value: "B", text: "\"嗯，我思考了一下...\" 认真分享自己的洞察", roleMapping: "稳如龟" },
    ],
  },

  // 8. 开心柯基 vs 机智狐 - 区分点：社交能量释放 vs 好奇探索
  {
    id: 115,
    category: "周末规划",
    scenarioText: "🌅 周五晚上，突然有一整个周末空闲...",
    questionText: "你最想做什么？",
    questionType: "single",
    options: [
      { value: "A", text: "\"召集朋友开派对！\" 社交聚会充电", roleMapping: "开心柯基" },
      { value: "B", text: "\"去探索那家新开的店！\" 发现新鲜体验", roleMapping: "机智狐" },
    ],
  },

  // 9. 太阳鸡 vs 暖心熊 - 区分点：普照温暖 vs 深度陪伴
  {
    id: 116,
    category: "关怀范围",
    scenarioText: "👥 10人聚会，你注意到一个人情绪低落...",
    questionText: "你会？",
    questionType: "single",
    options: [
      { value: "A", text: "提升整体氛围让大家都开心，包括ta", roleMapping: "太阳鸡" },
      { value: "B", text: "找机会单独陪伴ta，深度倾听ta的烦恼", roleMapping: "暖心熊" },
    ],
  },

  // 10. 织网蛛 vs 机智狐 - 区分点：连接人 vs 探索事
  {
    id: 117,
    category: "社交动机",
    scenarioText: "🎪 有个跨界沙龙活动，各行业的人都有...",
    questionText: "你最兴奋的点是？",
    questionType: "single",
    options: [
      { value: "A", text: "\"可以认识好多有趣的人！\" 建立人脉网络", roleMapping: "织网蛛" },
      { value: "B", text: "\"可以了解好多新领域！\" 获取新知识", roleMapping: "机智狐" },
    ],
  },

  // 11. 灵感章鱼 vs 沉思猫头鹰 - 区分点：发散创意 vs 逻辑分析
  {
    id: 118,
    category: "问题解决方式",
    scenarioText: "🧩 朋友遇到职业选择难题...",
    questionText: "你会提供什么帮助？",
    questionType: "single",
    options: [
      { value: "A", text: "\"哇！你可以试试ABC，还可以...\" 提供10个脑洞方向", roleMapping: "灵感章鱼" },
      { value: "B", text: "\"我们先分析核心问题是什么...\" 逻辑拆解", roleMapping: "沉思猫头鹰" },
    ],
  },

  // 12. 定心大象 vs 稳如龟 - 区分点：温暖包容 vs 冷静观察
  {
    id: 119,
    category: "稳定性来源",
    scenarioText: "🌊 团队遇到挫折，气氛低迷...",
    questionText: "你的存在感体现在？",
    questionType: "single",
    options: [
      { value: "A", text: "\"没事的，我们一起度过～\" 温暖的支持包容", roleMapping: "定心大象" },
      { value: "B", text: "保持冷静，观察局势，等待合适时机发言", roleMapping: "稳如龟" },
    ],
  },

  // 13. 夸夸豚 vs 太阳鸡 - 区分点：主动赞美 vs 散发温暖
  {
    id: 120,
    category: "正能量表达",
    scenarioText: "🎨 朋友展示了一幅画作...",
    questionText: "你会？",
    questionType: "single",
    options: [
      { value: "A", text: "\"哇！太棒了！你太有才华了！\" 热情赞美", roleMapping: "夸夸豚" },
      { value: "B", text: "\"画得真好～\" 温柔微笑，散发肯定能量", roleMapping: "太阳鸡" },
    ],
  },
];

/**
 * 补测题映射表
 */
export const supplementaryRoleMapping: Record<number, Record<string, string>> = {
  101: { A: "开心柯基", B: "太阳鸡" },
  102: { A: "开心柯基", B: "太阳鸡" },
  103: { A: "淡定海豚", B: "织网蛛" },
  104: { A: "淡定海豚", B: "织网蛛" },
  105: { A: "沉思猫头鹰", B: "稳如龟" },
  106: { A: "沉思猫头鹰", B: "稳如龟" },
  107: { A: "机智狐", B: "灵感章鱼" },
  108: { A: "机智狐", B: "灵感章鱼" },
  109: { A: "暖心熊", B: "夸夸豚" },
  110: { A: "暖心熊", B: "夸夸豚" },
  111: { A: "定心大象", B: "淡定海豚" },
  112: { A: "定心大象", B: "淡定海豚" },
  113: { A: "隐身猫", B: "稳如龟" },
  114: { A: "隐身猫", B: "稳如龟" },
  115: { A: "开心柯基", B: "机智狐" },
  116: { A: "太阳鸡", B: "暖心熊" },
  117: { A: "织网蛛", B: "机智狐" },
  118: { A: "灵感章鱼", B: "沉思猫头鹰" },
  119: { A: "定心大象", B: "稳如龟" },
  120: { A: "夸夸豚", B: "太阳鸡" },
};

/**
 * 获取针对特定原型对的补测题
 * @param archetype1 第一个原型
 * @param archetype2 第二个原型
 * @param count 需要的题目数量（默认3题）
 */
export function getSupplementaryQuestions(
  archetype1: string,
  archetype2: string,
  count: number = 3
): Question[] {
  const relevantQuestions = supplementaryQuestions.filter(q => {
    const options = q.options.map(opt => opt.roleMapping);
    return (
      (options.includes(archetype1) && options.includes(archetype2)) ||
      (options.includes(archetype2) && options.includes(archetype1))
    );
  });

  // 随机打乱并取前count个
  const shuffled = relevantQuestions.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

// 验证覆盖度（开发环境自动检查）
if (import.meta.env.DEV) {
  const coverage = validateCoverage();
  console.log("📊 12个原型基础题库覆盖度:", coverage);
  
  const allArchetypes = [
    "开心柯基", "太阳鸡", "夸夸豚", "机智狐",
    "淡定海豚", "织网蛛", "暖心熊", "灵感章鱼",
    "沉思猫头鹰", "定心大象", "稳如龟", "隐身猫"
  ];
  
  const missing = allArchetypes.filter(a => !coverage[a] || coverage[a] < 2);
  if (missing.length > 0) {
    console.warn("⚠️ 以下原型覆盖不足（少于2题）:", missing);
  }

  // 测试补测题筛选
  console.log("🎯 补测题库测试:");
  console.log("柯基vs太阳鸡:", getSupplementaryQuestions("开心柯基", "太阳鸡", 3).length, "题");
  console.log("海豚vs蛛:", getSupplementaryQuestions("淡定海豚", "织网蛛", 3).length, "题");
}
