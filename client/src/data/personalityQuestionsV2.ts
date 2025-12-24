/**
 * 12原型性格测评 V2 - 基于六维特质的测试系统
 * 
 * 六维度定义:
 * - A (Affinity): 亲和力 - 友善、共情、合作
 * - O (Openness): 开放性 - 好奇心、创新、接受新事物
 * - C (Conscientiousness): 责任心 - 可靠、计划性、稳定
 * - E (EmotionalStability): 情绪稳定 - 冷静、抗压、平和
 * - X (Extraversion): 外向性 - 社交能量、主动性
 * - P (Positivity): 积极性 - 乐观、正能量、热情
 * 
 * 计分机制:
 * - 每个选项影响1-3个维度
 * - 分数范围: -3 到 +3
 * - 累计后归一化到0-100（基准50分）
 * - 使用欧氏距离匹配最接近的原型
 */

export interface TraitScores {
  A?: number;  // Affinity 亲和力
  O?: number;  // Openness 开放性
  C?: number;  // Conscientiousness 责任心
  E?: number;  // Emotional Stability 情绪稳定
  X?: number;  // Extraversion 外向性
  P?: number;  // Positivity 积极性
}

export interface QuestionOptionV2 {
  value: string;
  text: string;
  traitScores: TraitScores;
  tag?: string; // 行为标签，增强视觉辨识度
}

export interface QuestionV2 {
  id: number;
  category: string;
  questionText: string;
  scenarioText: string;
  questionType: "single" | "dual";
  options: QuestionOptionV2[];
}

export const personalityQuestionsV2: QuestionV2[] = [
  {
    id: 1,
    category: "社交启动",
    scenarioText: "🎉 朋友生日聚会，你走进包厢，发现有5个人你都不认识...",
    questionText: "刚进门，你最自然的反应是？",
    questionType: "single",
    options: [
      { 
        value: "A", 
        text: "大声说「大家好！」用幽默开场让全场笑起来", 
        traitScores: { A: 2, X: 3, P: 1 },
        tag: "主动破冰"
      },
      { 
        value: "B", 
        text: "找到寿星，让ta来帮你介绍认识大家", 
        traitScores: { C: 1, E: 2, O: 1 },
        tag: "借力社交"
      },
      { 
        value: "C", 
        text: "挨个问「你是怎么认识XX的」，建立人际连接", 
        traitScores: { A: 3, X: 2, O: 1 },
        tag: "主动连接"
      },
      { 
        value: "D", 
        text: "先找个角落坐下，用手机掩饰，默默观察", 
        traitScores: { C: 2, E: 2, X: -2, P: -1 },
        tag: "隐身观察"
      },
      { 
        value: "E", 
        text: "先在门口观察一下场面，再慢慢找机会加入", 
        traitScores: { A: 1, E: 2, X: -1, O: 1 },
        tag: "观察再入"
      },
    ],
  },

  {
    id: 2,
    category: "新鲜事物",
    scenarioText: "☕ 有人提到最近发现了一家超神秘的咖啡馆，藏在老洋房里...",
    questionText: "听到这个，你的第一反应是？",
    questionType: "single",
    options: [
      { 
        value: "A", 
        text: "「在哪里？我们现在就去！」立马拉人组队行动", 
        traitScores: { O: 3, X: 2, P: 1 },
        tag: "即刻行动"
      },
      { 
        value: "B", 
        text: "「哇好棒！你发现的地方都好有品味！」热情夸赞", 
        traitScores: { A: 1, O: 2 },
        tag: "赞美肯定"
      },
      { 
        value: "C", 
        text: "「我之前也去过类似的，那次的故事是...」分享经历", 
        traitScores: { O: 1, X: 2 },
        tag: "故事共鸣"
      },
      { 
        value: "D", 
        text: "「这家店的定位是什么？为什么能火？」深挖原因", 
        traitScores: { O: 2, C: 1 },
        tag: "深度分析"
      },
      { 
        value: "E", 
        text: "「听起来不错，等确认好信息后我再决定去不去」", 
        traitScores: { C: 2, E: 1, X: -1 },  // V3新增：定心大象路径
        tag: "谨慎确认"
      },
    ],
  },

  {
    id: 3,
    category: "情绪支持",
    scenarioText: "😔 聊着聊着，有人突然叹气说最近工作压力好大...",
    questionText: "你最自然的反应是？",
    questionType: "single",
    options: [
      { 
        value: "A", 
        text: "握住ta的手，说「我懂...」然后安静地深度倾听", 
        traitScores: { A: 3, P: 1 },
        tag: "深度共情"
      },
      { 
        value: "B", 
        text: "「没事！一切都会好的！我们都支持你！」积极鼓励", 
        traitScores: { A: 1, P: 4 },
        tag: "阳光鼓励"
      },
      { 
        value: "C", 
        text: "默默递纸巾，全程不说话，用眼神表达理解", 
        traitScores: { A: 2, C: 2, E: 2, P: 0 },  // V3优化：稳如龟路径
        tag: "无声陪伴"
      },
      { 
        value: "D", 
        text: "等情绪稳定后，巧妙引入轻松话题转移注意力", 
        traitScores: { E: 3, X: -1, P: -1 },  // V3优化：稳如龟路径，移除X正分
        tag: "氛围调控"
      },
    ],
  },

  {
    id: 4,
    category: "想法表达",
    scenarioText: "🌟 大家在讨论：「如果能开一家梦想小店，你会开什么？」",
    questionText: "你的大脑会？",
    questionType: "single",
    options: [
      { 
        value: "A", 
        text: "「猫咖！书店！奶茶车！还有...」5秒内冒出10个点子", 
        traitScores: { O: 3, P: 2 },
        tag: "创意爆发"
      },
      { 
        value: "B", 
        text: "「首先，目标客户是谁？核心竞争力是...」框架分析", 
        traitScores: { C: 3, E: 1 },
        tag: "逻辑拆解"
      },
      { 
        value: "C", 
        text: "「嗯...让我想想」边想边组织语言，斟酌后才开口", 
        traitScores: { C: 3, E: 2, X: -1, P: 0 },  // V3优化：沉思猫头鹰路径
        tag: "稳健思考"
      },
      { 
        value: "D", 
        text: "「你们呢？我先听听大家的想法」", 
        traitScores: { A: 1, O: 1, X: 1 },
        tag: "倾听优先"
      },
      { 
        value: "E", 
        text: "心里有想法，但想回去记录下来好好研究一下", 
        traitScores: { O: 1, C: 2, E: 1, X: -1 },  // V3新增：沉思猫头鹰路径
        tag: "深度研究"
      },
    ],
  },

  {
    id: 5,
    category: "意见分歧",
    scenarioText: "🍜 点菜时，两个人为了吃火锅还是烧烤争起来了...",
    questionText: "你会？",
    questionType: "single",
    options: [
      { 
        value: "A", 
        text: "「要不这次听A的，下次听B的？」提出轮流方案", 
        traitScores: { A: 2, C: 2, E: 1 },
        tag: "理性协调"
      },
      { 
        value: "B", 
        text: "分别私聊两人，协调出一个双方都能接受的方案", 
        traitScores: { A: 2, E: 1, P: 1 },
        tag: "私下调解"
      },
      { 
        value: "C", 
        text: "「其实附近有家店两种都有！」找创意方案", 
        traitScores: { A: 1, O: 3, P: 1 },
        tag: "创意解法"
      },
      { 
        value: "D", 
        text: "安静等着，心想「吃什么都行，你们决定就好」", 
        traitScores: { E: 2, C: 1, X: -2 },
        tag: "随遇而安"
      },
      { 
        value: "E", 
        text: "「我没什么意见，但别吵太久哈～」温和表达边界", 
        traitScores: { E: 2, A: 1, X: -1, C: 1 },
        tag: "温和边界"
      },
    ],
  },

  {
    id: 6,
    category: "贡献方式",
    scenarioText: "🎯 聚会需要有人负责订位、点菜、AA收钱...",
    questionText: "你通常会？",
    questionType: "single",
    options: [
      { 
        value: "A", 
        text: "「我来订位！交给我没问题！」主动承担组织者", 
        traitScores: { C: 3, X: 2, P: 1 },
        tag: "主动担当"
      },
      { 
        value: "B", 
        text: "「需要帮忙喊一声～」愿意配合支持", 
        traitScores: { A: 2, C: 1, O: 1 },
        tag: "配合支持"
      },
      { 
        value: "C", 
        text: "默默把账单算好，等大家吃完发给大家", 
        traitScores: { C: 3, E: 2, X: -1 },
        tag: "细心执行"
      },
      { 
        value: "D", 
        text: "「我负责活跃气氛就好啦！」贡献其他价值", 
        traitScores: { X: 2, P: 2, O: 1 },
        tag: "气氛担当"
      },
      { 
        value: "E", 
        text: "负责安排行程时间节奏，确保大家准时到位", 
        traitScores: { C: 2, E: 2, O: 1 },
        tag: "节奏把控"
      },
    ],
  },

  {
    id: 7,
    category: "社交舒适区",
    scenarioText: "🌟 聚会进行到一半，你感觉最舒服的状态是...",
    questionText: "以下哪个最像你？",
    questionType: "single",
    options: [
      { 
        value: "A", 
        text: "站在C位带节奏，全场的笑点都是你制造的", 
        traitScores: { X: 4, P: 2 },
        tag: "全场焦点"
      },
      { 
        value: "B", 
        text: "像太阳一样照顾每个人，确保没人被冷落", 
        traitScores: { A: 2, O: 2 },
        tag: "普照全场"
      },
      { 
        value: "C", 
        text: "到处串场，和不同的人深聊，挖掘有趣信息", 
        traitScores: { A: 1, E: 1, O: 2 },
        tag: "探索挖掘"
      },
      { 
        value: "D", 
        text: "找个舒服的角落，安静听大家聊，享受旁观", 
        traitScores: { E: 3, C: 1, X: -3, P: -1 },
        tag: "边缘舒适"
      },
      { 
        value: "E", 
        text: "和两三位聊得来的人深度聊天，不追求面面俱到", 
        traitScores: { A: 2, E: 1, O: 1 },
        tag: "深度连接"
      },
    ],
  },

  {
    id: 8,
    category: "深度话题",
    scenarioText: "🎬 有人聊到最近看的一部电影，说被某个情节感动哭了...",
    questionText: "你会怎么接话？",
    questionType: "single",
    options: [
      { 
        value: "A", 
        text: "「我也看了！那段真的太戳了...」热烈分享自己的感受", 
        traitScores: { O: 3, X: 2 },
        tag: "热情分享"
      },
      { 
        value: "B", 
        text: "认真听ta讲完，追问细节和ta的感受", 
        traitScores: { A: 2, C: 2, E: 1, P: 0 },  // V3优化：暖心熊路径
        tag: "专注倾听"
      },
      { 
        value: "C", 
        text: "「是吗？我也想看！」记下来回头找", 
        traitScores: { A: 1, O: 2 },
        tag: "好奇记录"
      },
      { 
        value: "D", 
        text: "默默听着，觉得电影这种东西看缘分", 
        traitScores: { E: 3, X: -2, P: -1 },  // V3优化：稳如龟/隐身猫路径
        tag: "随缘佛系"
      },
    ],
  },

  {
    id: 9,
    category: "聚会结束",
    scenarioText: "🌙 聚会结束回到家，你的状态是...",
    questionText: "以下哪个最像你？",
    questionType: "single",
    options: [
      { 
        value: "A", 
        text: "「累爆了但超爽！」躺床上还在回味今晚的高光时刻", 
        traitScores: { X: 3, P: 2 },  // V3优化：降低X/P分值
        tag: "累并快乐"
      },
      { 
        value: "B", 
        text: "「好充实～」心满意足，感觉给了很多也收获了很多", 
        traitScores: { A: 1, E: 2, P: 2 },
        tag: "温暖充实"
      },
      { 
        value: "C", 
        text: "「还行吧」正常消耗，独处一会儿就能恢复", 
        traitScores: { C: 1, E: 2, X: -1 },  // V3优化：平衡选项
        tag: "平稳消耗"
      },
      { 
        value: "D", 
        text: "「终于...」瘫在沙发上不想动，社交电量归零", 
        traitScores: { E: 3, X: -3, P: -2 },  // V3优化：稳如龟/隐身猫路径
        tag: "彻底耗尽"
      },
      { 
        value: "E", 
        text: "安静地整理一下今天的事情，慢慢恢复能量", 
        traitScores: { C: 1, E: 2, X: -1 },  // V3新增：稳定型恢复
        tag: "安静恢复"
      },
    ],
  },

  {
    id: 10,
    category: "朋友评价",
    scenarioText: "💫 有个新朋友问别人：「ta是什么样的人呀？」",
    questionText: "你猜朋友会怎么形容你？",
    questionType: "single",
    options: [
      { 
        value: "A", 
        text: "「人间小太阳，和ta在一起心情会变好！」", 
        traitScores: { O: 1, X: 2, P: 3 },  // V3优化：降低X分值
        tag: "温暖治愈"
      },
      { 
        value: "B", 
        text: "「超会玩！总能带你发现新奇好玩的东西！」", 
        traitScores: { O: 4, X: 1 },  // V3优化：降低X分值
        tag: "探索达人"
      },
      { 
        value: "C", 
        text: "「脑洞王！创意源源不断，想法特别多！」", 
        traitScores: { O: 3, C: 1 },
        tag: "创意无限"
      },
      { 
        value: "D", 
        text: "「超靠谱！关键时刻稳得一批！」", 
        traitScores: { C: 3, E: 2 },
        tag: "稳定可靠"
      },
      { 
        value: "E", 
        text: "「踏实可靠型朋友，虽然话不多但很值得信赖！」", 
        traitScores: { C: 3, E: 2, X: -1 },  // V3新增：定心大象路径
        tag: "沉稳可信"
      },
    ],
  },

  {
    id: 11,
    category: "新尝试",
    scenarioText: "🎮 有人提议玩一个你完全没接触过的桌游/密室/剧本杀...",
    questionText: "你的第一反应是？",
    questionType: "single",
    options: [
      { 
        value: "A", 
        text: "「来来来！新游戏最好玩了！」眼睛放光", 
        traitScores: { O: 3, X: 3, P: 1 },
        tag: "即刻尝鲜"
      },
      { 
        value: "B", 
        text: "「规则是什么？先讲清楚吧」想搞懂再开始", 
        traitScores: { O: 1, C: 2 },
        tag: "先懂再玩"
      },
      { 
        value: "C", 
        text: "「你们玩过吗？带带我～」希望有人指导", 
        traitScores: { A: 2, O: 1, P: 1 },
        tag: "求带入门"
      },
      { 
        value: "D", 
        text: "「我在旁边看你们玩也挺好的」保持距离", 
        traitScores: { C: 2, E: 1, X: -1 },  // V3优化：隐身猫路径
        tag: "旁观为主"
      },
      { 
        value: "E", 
        text: "「让我先收集一下资料再决定要不要参与」", 
        traitScores: { O: 1, C: 3, E: 1, X: -1 },  // V3新增：沉思猫头鹰路径
        tag: "资料收集"
      },
    ],
  },

  {
    id: 12,
    category: "变化应对",
    scenarioText: "🔄 计划好的餐厅临时订不到位，需要换地方...",
    questionText: "你的反应是？",
    questionType: "single",
    options: [
      { 
        value: "A", 
        text: "「太好了！说不定能发现更好吃的！」反而兴奋", 
        traitScores: { O: 3, E: 1, P: 3 },
        tag: "乐见变化"
      },
      { 
        value: "B", 
        text: "「那我来查查附近有什么其他选择」立刻行动", 
        traitScores: { A: 1, C: 2, X: 1 },
        tag: "主动解决"
      },
      { 
        value: "C", 
        text: "「随便啦，有吃的就行～」无所谓", 
        traitScores: { A: 1, E: 2, P: 1 },
        tag: "随遇而安"
      },
      { 
        value: "D", 
        text: "「有点可惜...不过也没办法」接受现实", 
        traitScores: { C: 2, E: 3, X: -2, P: -1 },  // V3优化：稳如龟/隐身猫路径
        tag: "接受调整"
      },
      { 
        value: "E", 
        text: "「没关系，我来重新规划一下方案」", 
        traitScores: { C: 3, E: 2 },  // V3新增：定心大象路径
        tag: "计划适应"
      },
    ],
  },
];

/**
 * 维度覆盖验证（开发环境）
 */
export function validateV2Coverage(): Record<string, number> {
  const coverage: Record<string, number> = { A: 0, O: 0, C: 0, E: 0, X: 0, P: 0 };
  
  personalityQuestionsV2.forEach(q => {
    q.options.forEach(opt => {
      Object.keys(opt.traitScores).forEach(trait => {
        coverage[trait] = (coverage[trait] || 0) + 1;
      });
    });
  });
  
  return coverage;
}

if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
  const coverage = validateV2Coverage();
  console.log("📊 V2题库维度覆盖度:", coverage);
  
  const minCoverage = Math.min(...Object.values(coverage));
  if (minCoverage < 8) {
    console.warn("⚠️ 部分维度覆盖不足（少于8次）");
  }
}
