/**
 * 话题卡配置
 * 根据角色组合特点设计的针对性破冰问题
 * 每个组合类型有2-3个适合的话题，促进不同性格间的交流
 */

// 话题卡类型
export interface TopicCard {
  question: string;
  category: string;
  targetDynamic: string; // 适用的互动场景
  difficulty: "easy" | "medium" | "deep"; // 话题深度
}

// 基于能量组合的话题卡
export const energyBasedTopics: Record<string, TopicCard[]> = {
  // 高能量组（多数是活力型角色）
  high_energy: [
    {
      question: "如果让你组织一个完美的周末派对，你会怎么安排？",
      category: "生活方式",
      targetDynamic: "激发创意，让活力型角色发挥优势",
      difficulty: "easy",
    },
    {
      question: "你做过最疯狂的一件事是什么？后来后悔了吗？",
      category: "人生经历",
      targetDynamic: "分享冒险经历，增进了解",
      difficulty: "medium",
    },
    {
      question: "如果可以瞬间掌握一项技能，你选什么？",
      category: "脑洞问题",
      targetDynamic: "轻松有趣，人人都能参与",
      difficulty: "easy",
    },
  ],

  // 温暖治愈组（暖系角色为主）
  warm_cozy: [
    {
      question: "最近有什么小事让你觉得'生活还是很美好的'？",
      category: "小确幸",
      targetDynamic: "分享温暖瞬间，营造舒适氛围",
      difficulty: "easy",
    },
    {
      question: "你有什么私藏的'快乐秘方'？比如压力大时怎么放松？",
      category: "生活智慧",
      targetDynamic: "互相分享生活小技巧",
      difficulty: "easy",
    },
    {
      question: "如果可以给过去的自己写一封信，你想说什么？",
      category: "人生感悟",
      targetDynamic: "深度交流但不失温暖",
      difficulty: "medium",
    },
  ],

  // 动静结合组（能量分布均匀）
  balanced: [
    {
      question: "周末你更喜欢宅在家还是出门探索？为什么？",
      category: "生活方式",
      targetDynamic: "发现彼此差异，引发讨论",
      difficulty: "easy",
    },
    {
      question: "你身边有没有和你性格完全相反但关系很好的朋友？",
      category: "人际关系",
      targetDynamic: "探讨性格互补的话题",
      difficulty: "medium",
    },
    {
      question: "你觉得自己是'先想再做'还是'先做再说'的人？",
      category: "自我认知",
      targetDynamic: "轻松探讨性格差异",
      difficulty: "easy",
    },
  ],

  // 深度交流组（低能量角色为主）
  deep_connect: [
    {
      question: "最近有什么问题让你思考了很久？",
      category: "思考分享",
      targetDynamic: "给深度思考者发言空间",
      difficulty: "medium",
    },
    {
      question: "有没有一本书、一部电影或一个人，改变了你看世界的方式？",
      category: "人生影响",
      targetDynamic: "分享深度内容，建立共鸣",
      difficulty: "medium",
    },
    {
      question: "你理想中的'有意义的对话'是什么样的？",
      category: "沟通偏好",
      targetDynamic: "了解彼此的交流风格",
      difficulty: "deep",
    },
  ],

  // 创意碰撞组（灵感型角色较多）- 为灵感章鱼、机智狐等创意型用户扩展
  creative_spark: [
    {
      question: "如果可以发明一样东西解决日常困扰，你想发明什么？",
      category: "创意脑洞",
      targetDynamic: "激发创意，越脑洞越好",
      difficulty: "easy",
    },
    {
      question: "你觉得未来10年，什么东西会彻底改变我们的生活？",
      category: "未来畅想",
      targetDynamic: "激发讨论和头脑风暴",
      difficulty: "medium",
    },
    {
      question: "如果你的人生是一部电影，它会是什么类型？",
      category: "创意比喻",
      targetDynamic: "轻松有趣的自我表达",
      difficulty: "easy",
    },
    {
      question: "如果可以把任意两个不相关的东西结合，你会创造什么奇怪的产品？",
      category: "脑洞混搭",
      targetDynamic: "释放想象力，越离谱越有趣",
      difficulty: "easy",
    },
    {
      question: "如果你是一款APP，你的主要功能会是什么？",
      category: "创意自我介绍",
      targetDynamic: "用创意方式介绍自己",
      difficulty: "easy",
    },
    {
      question: "你最近被什么'冷门但超有意思'的东西吸引了？",
      category: "小众发现",
      targetDynamic: "分享独特视角和发现",
      difficulty: "easy",
    },
    {
      question: "如果可以在任何虚构世界生活一周，你选哪个？为什么？",
      category: "幻想世界",
      targetDynamic: "探索彼此的想象力边界",
      difficulty: "easy",
    },
    {
      question: "你有没有一个'愚蠢但我觉得可行'的想法？分享一下！",
      category: "疯狂创意",
      targetDynamic: "在安全空间分享不成熟的点子",
      difficulty: "medium",
    },
    {
      question: "如果让你重新设计一样日常物品，你会改什么？",
      category: "设计思维",
      targetDynamic: "激发产品思维和创造力",
      difficulty: "medium",
    },
    {
      question: "你最想学会的一项'无用但很酷'的技能是什么？",
      category: "酷技能",
      targetDynamic: "分享好奇心和探索欲",
      difficulty: "easy",
    },
  ],
};

// 特定角色组合的专属话题（针对典型配对）
export const archetypePairTopics: Record<string, TopicCard[]> = {
  // 高能量 + 低能量 组合
  "开心柯基_隐身猫": [
    {
      question: "你们各自最享受的独处方式是什么？有没有觉得独处和社交都很重要？",
      category: "生活平衡",
      targetDynamic: "让内向者有发言空间，外向者学会倾听",
      difficulty: "easy",
    },
    {
      question: "社交能量耗尽时，你们怎么给自己充电？",
      category: "能量管理",
      targetDynamic: "分享不同的恢复方式",
      difficulty: "easy",
    },
  ],
  "开心柯基_沉思猫头鹰": [
    {
      question: "热闹和安静，你们更需要哪个来充电？为什么？",
      category: "能量来源",
      targetDynamic: "探讨能量恢复方式的差异",
      difficulty: "easy",
    },
    {
      question: "你们觉得'深度思考'和'快乐行动'哪个更重要？",
      category: "生活哲学",
      targetDynamic: "探索不同的价值观",
      difficulty: "medium",
    },
  ],
  "开心柯基_稳如龟": [
    {
      question: "遇到困难时，你是先行动还是先观察？",
      category: "处事风格",
      targetDynamic: "对比行动派和观察派",
      difficulty: "easy",
    },
  ],
  "太阳鸡_隐身猫": [
    {
      question: "你们觉得'被关注'是开心还是有压力？",
      category: "社交心理",
      targetDynamic: "理解不同的社交舒适度",
      difficulty: "easy",
    },
  ],
  
  // 暖系 + 深度 组合
  "暖心熊_沉思猫头鹰": [
    {
      question: "你们觉得'被理解'是什么感觉？怎样的对话让你觉得被真正听到了？",
      category: "情感连接",
      targetDynamic: "两个善于倾听的角色深度对话",
      difficulty: "medium",
    },
    {
      question: "你更擅长用言语还是行动表达关心？",
      category: "表达方式",
      targetDynamic: "探讨不同的关爱语言",
      difficulty: "easy",
    },
  ],
  "太阳鸡_稳如龟": [
    {
      question: "乐观和冷静，你们觉得哪个更重要？还是要看情况？",
      category: "处世态度",
      targetDynamic: "对比两种不同的处事风格",
      difficulty: "medium",
    },
  ],
  "夸夸豚_沉思猫头鹰": [
    {
      question: "你更喜欢被鼓励还是被分析？面对问题时需要什么样的支持？",
      category: "沟通偏好",
      targetDynamic: "了解不同的心理需求",
      difficulty: "medium",
    },
  ],
  "暖心熊_隐身猫": [
    {
      question: "你们觉得'舒适的沉默'存在吗？什么样的关系才能拥有？",
      category: "亲密关系",
      targetDynamic: "探讨陪伴的意义",
      difficulty: "medium",
    },
  ],

  // 社交型 + 内向型 组合
  "织网蛛_隐身猫": [
    {
      question: "你们觉得'高质量的社交'是什么样的？人多好还是人少好？",
      category: "社交偏好",
      targetDynamic: "探讨不同的社交需求",
      difficulty: "easy",
    },
    {
      question: "认识新朋友，你们更看重什么？兴趣相同还是性格互补？",
      category: "交友观",
      targetDynamic: "分享交友经验",
      difficulty: "easy",
    },
  ],
  "织网蛛_稳如龟": [
    {
      question: "你们觉得社交圈广好还是精好？为什么？",
      category: "社交策略",
      targetDynamic: "探讨不同的社交理念",
      difficulty: "easy",
    },
  ],
  
  // 创意型组合
  "机智狐_灵感章鱼": [
    {
      question: "最近发现的最有意思的事物是什么？分享一个'冷门但好玩'的东西",
      category: "新奇发现",
      targetDynamic: "激发两个探索者的分享欲",
      difficulty: "easy",
    },
    {
      question: "你们的灵感通常从哪里来？有什么独特的找灵感方式？",
      category: "创意来源",
      targetDynamic: "分享创意方法论",
      difficulty: "medium",
    },
  ],
  "灵感章鱼_沉思猫头鹰": [
    {
      question: "你觉得'有趣'和'有深度'冲突吗？怎样兼顾？",
      category: "思维方式",
      targetDynamic: "探讨创意与深度的平衡",
      difficulty: "medium",
    },
    {
      question: "你们的'灵光一闪'通常在什么情况下出现？",
      category: "创意时刻",
      targetDynamic: "分享灵感来源和思考方式",
      difficulty: "easy",
    },
  ],
  
  // 灵感章鱼的更多组合 - 创意型用户满意度提升
  "灵感章鱼_温暖金毛": [
    {
      question: "你有没有一个'很温暖但也很脑洞'的想法？",
      category: "温暖创意",
      targetDynamic: "结合创意和温暖感",
      difficulty: "easy",
    },
  ],
  "灵感章鱼_开心柯基": [
    {
      question: "如果你们一起策划一个派对，会是什么风格？",
      category: "创意活动",
      targetDynamic: "激发两个活力型角色的想象力",
      difficulty: "easy",
    },
    {
      question: "你们觉得什么样的'无聊事'其实可以变得超级有趣？",
      category: "创意转化",
      targetDynamic: "探索如何让日常变有趣",
      difficulty: "easy",
    },
  ],
  "灵感章鱼_隐身猫": [
    {
      question: "你们各自最'奇怪'但很享受的爱好是什么？",
      category: "小众爱好",
      targetDynamic: "让内向创意型用户分享独特兴趣",
      difficulty: "easy",
    },
  ],
  "灵感章鱼_淡定海豚": [
    {
      question: "创意很疯狂的时候，你们怎么判断'这个靠谱'还是'想太多'？",
      category: "创意判断",
      targetDynamic: "探讨创意和理性的平衡",
      difficulty: "medium",
    },
  ],
  "灵感章鱼_夸夸豚": [
    {
      question: "你们觉得'被鼓励'对创意有多重要？",
      category: "创意支持",
      targetDynamic: "探讨正向反馈对创造力的影响",
      difficulty: "easy",
    },
  ],
  "机智狐_开心柯基": [
    {
      question: "你们最近的'新发现'是什么？可以是任何让你惊喜的事",
      category: "生活发现",
      targetDynamic: "分享探索的乐趣",
      difficulty: "easy",
    },
    {
      question: "如果你们组队去探险，你们会各自负责什么？",
      category: "团队冒险",
      targetDynamic: "发现彼此的优势互补",
      difficulty: "easy",
    },
  ],
  
  // 机智狐的更多组合 - 探索型用户满意度提升
  "机智狐_隐身猫": [
    {
      question: "你们各自'悄悄研究'的领域是什么？有什么冷门发现？",
      category: "隐藏兴趣",
      targetDynamic: "让安静的探索者分享发现",
      difficulty: "easy",
    },
  ],
  "机智狐_沉思猫头鹰": [
    {
      question: "你们怎么判断一个新想法值不值得深入研究？",
      category: "探索方法",
      targetDynamic: "探讨好奇心与深度的结合",
      difficulty: "medium",
    },
  ],
  "机智狐_温暖金毛": [
    {
      question: "你们觉得'冒险精神'和'安全感'怎么平衡？",
      category: "生活平衡",
      targetDynamic: "探讨探索与稳定的关系",
      difficulty: "medium",
    },
  ],
  
  // 同类型高能量组合
  "开心柯基_太阳鸡": [
    {
      question: "你们是天生乐观还是后天修炼的？有没有'强颜欢笑'的时候？",
      category: "真实自我",
      targetDynamic: "让两个阳光角色聊点深的",
      difficulty: "medium",
    },
    {
      question: "你们的'开心果'身份，有时候会觉得累吗？",
      category: "角色压力",
      targetDynamic: "探讨外向者的另一面",
      difficulty: "medium",
    },
  ],
  "开心柯基_夸夸豚": [
    {
      question: "你们是怎么保持积极心态的？有什么秘诀？",
      category: "心态管理",
      targetDynamic: "分享正能量源泉",
      difficulty: "easy",
    },
  ],
  "太阳鸡_夸夸豚": [
    {
      question: "你们觉得鼓励别人时，什么样的话最有力量？",
      category: "鼓励艺术",
      targetDynamic: "探讨正向反馈的技巧",
      difficulty: "easy",
    },
  ],
  
  // 同类型低能量组合
  "隐身猫_稳如龟": [
    {
      question: "你们享受'安静的陪伴'吗？不说话也能很舒服那种？",
      category: "陪伴方式",
      targetDynamic: "给低能量组合舒适的话题",
      difficulty: "easy",
    },
    {
      question: "你们觉得'慢生活'是什么样的？向往吗？",
      category: "生活节奏",
      targetDynamic: "探讨理想的生活状态",
      difficulty: "easy",
    },
  ],
  "沉思猫头鹰_稳如龟": [
    {
      question: "你们平时会思考一些'大问题'吗？比如人生意义之类的",
      category: "深度思考",
      targetDynamic: "给思考者们一个话题空间",
      difficulty: "deep",
    },
  ],
  "隐身猫_沉思猫头鹰": [
    {
      question: "你们更喜欢一对一深聊还是群聊？为什么？",
      category: "社交偏好",
      targetDynamic: "理解内向者的社交方式",
      difficulty: "easy",
    },
  ],
  
  // 平衡型组合
  "淡定海豚_织网蛛": [
    {
      question: "你们在社交场合通常扮演什么角色？调节气氛还是串联大家？",
      category: "社交角色",
      targetDynamic: "探讨社交中的不同功能",
      difficulty: "easy",
    },
  ],
  "淡定海豚_暖心熊": [
    {
      question: "遇到朋友情绪低落时，你们会怎么做？",
      category: "情感支持",
      targetDynamic: "分享关心他人的方式",
      difficulty: "medium",
    },
  ],
  "定心大象_暖心熊": [
    {
      question: "你们觉得什么样的人让你有安全感？",
      category: "信任关系",
      targetDynamic: "探讨安全感的来源",
      difficulty: "medium",
    },
  ],
};

// 通用破冰话题（适用于任何组合）
export const universalTopics: TopicCard[] = [
  {
    question: "如果明天放假一周，你会做什么？",
    category: "理想生活",
    targetDynamic: "轻松开场，人人都能聊",
    difficulty: "easy",
  },
  {
    question: "你最近在追什么剧/看什么书/玩什么游戏？",
    category: "兴趣爱好",
    targetDynamic: "找共同话题",
    difficulty: "easy",
  },
  {
    question: "有没有一个让你笑出声的糗事可以分享？",
    category: "趣味分享",
    targetDynamic: "拉近距离，制造欢乐",
    difficulty: "easy",
  },
  {
    question: "你觉得自己最'反差萌'的一点是什么？",
    category: "自我介绍",
    targetDynamic: "有趣的自我展示",
    difficulty: "easy",
  },
  {
    question: "如果可以拥有一种超能力，你选什么？为什么？",
    category: "脑洞问题",
    targetDynamic: "轻松有趣，适合破冰",
    difficulty: "easy",
  },
];

/**
 * 根据参与者角色获取推荐话题卡
 */
export function getRecommendedTopics(
  archetypes: string[],
  atmosphereType: string,
  count: number = 3
): TopicCard[] {
  const results: TopicCard[] = [];
  
  // 1. 先尝试找特定角色配对的话题
  for (let i = 0; i < archetypes.length; i++) {
    for (let j = i + 1; j < archetypes.length; j++) {
      const pair1 = `${archetypes[i]}_${archetypes[j]}`;
      const pair2 = `${archetypes[j]}_${archetypes[i]}`;
      
      if (archetypePairTopics[pair1]) {
        results.push(...archetypePairTopics[pair1]);
      } else if (archetypePairTopics[pair2]) {
        results.push(...archetypePairTopics[pair2]);
      }
      
      if (results.length >= count) break;
    }
    if (results.length >= count) break;
  }
  
  // 2. 根据氛围类型补充话题
  const atmosphereTopics = energyBasedTopics[atmosphereType] || energyBasedTopics["balanced"];
  for (const topic of atmosphereTopics) {
    if (results.length >= count) break;
    if (!results.some(r => r.question === topic.question)) {
      results.push(topic);
    }
  }
  
  // 3. 用通用话题补齐
  for (const topic of universalTopics) {
    if (results.length >= count) break;
    if (!results.some(r => r.question === topic.question)) {
      results.push(topic);
    }
  }
  
  return results.slice(0, count);
}

/**
 * 获取扩展的推荐话题池（用于轮换显示）
 * 合并所有相关话题源，去重后返回更大的话题池
 */
export function getExpandedRecommendedTopics(
  archetypes: string[],
  atmosphereType: string,
  maxCount: number = 8
): TopicCard[] {
  const allTopics: TopicCard[] = [];
  const seenQuestions = new Set<string>();
  
  // 辅助函数：添加话题并去重
  const addTopic = (topic: TopicCard) => {
    if (!seenQuestions.has(topic.question)) {
      seenQuestions.add(topic.question);
      allTopics.push(topic);
    }
  };
  
  // 1. 收集所有相关的角色配对话题（优先级最高）
  for (let i = 0; i < archetypes.length; i++) {
    for (let j = i + 1; j < archetypes.length; j++) {
      const pair1 = `${archetypes[i]}_${archetypes[j]}`;
      const pair2 = `${archetypes[j]}_${archetypes[i]}`;
      
      if (archetypePairTopics[pair1]) {
        archetypePairTopics[pair1].forEach(addTopic);
      }
      if (archetypePairTopics[pair2]) {
        archetypePairTopics[pair2].forEach(addTopic);
      }
    }
  }
  
  // 2. 添加当前氛围类型的所有话题
  const atmosphereTopics = energyBasedTopics[atmosphereType] || energyBasedTopics["balanced"];
  atmosphereTopics.forEach(addTopic);
  
  // 3. 添加相邻氛围类型的话题（增加多样性）
  const atmosphereRelations: Record<string, string[]> = {
    high_energy: ["creative_spark", "balanced"],
    warm_cozy: ["balanced", "deep_connect"],
    balanced: ["high_energy", "warm_cozy"],
    deep_connect: ["warm_cozy", "balanced"],
    creative_spark: ["high_energy", "balanced"],
  };
  
  const relatedAtmospheres = atmosphereRelations[atmosphereType] || [];
  for (const related of relatedAtmospheres) {
    const relatedTopics = energyBasedTopics[related] || [];
    relatedTopics.forEach(addTopic);
  }
  
  // 4. 添加通用话题
  universalTopics.forEach(addTopic);
  
  // 5. 随机打乱顺序但保持配对话题在前面
  const pairTopicCount = allTopics.filter(t => 
    Object.values(archetypePairTopics).flat().some(pt => pt.question === t.question)
  ).length;
  
  // 配对话题保持前面，其他话题随机排序
  const pairTopics = allTopics.slice(0, pairTopicCount);
  const otherTopics = allTopics.slice(pairTopicCount);
  
  // Fisher-Yates shuffle for other topics
  for (let i = otherTopics.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [otherTopics[i], otherTopics[j]] = [otherTopics[j], otherTopics[i]];
  }
  
  return [...pairTopics, ...otherTopics].slice(0, maxCount);
}

/**
 * 获取随机话题卡（用于现有的IcebreakerTool）
 */
export function getRandomTopicCard(archetypes?: string[], atmosphereType?: string): TopicCard {
  if (archetypes && archetypes.length > 0 && atmosphereType) {
    const recommended = getRecommendedTopics(archetypes, atmosphereType, 5);
    return recommended[Math.floor(Math.random() * recommended.length)];
  }
  
  // 无角色信息时返回通用话题
  return universalTopics[Math.floor(Math.random() * universalTopics.length)];
}

// 用户话题偏好ID到话题卡类别的映射
// 基于 interestsTopicsData.ts 中的实际 topic IDs
const topicIdToCategoryMap: Record<string, string[]> = {
  // 聊着玩类 (casual)
  movies_shows: ["兴趣爱好", "生活方式", "趣味分享", "理想生活"],
  music_taste: ["兴趣爱好", "小确幸", "创意来源"],
  food_culture: ["生活方式", "趣味分享", "小确幸"],
  travel_stories: ["人生经历", "生活方式", "理想生活"],
  fashion_trends: ["生活方式", "趣味分享"],
  gossip_entertainment: ["趣味分享"],
  zodiac_mbti: ["自我认知", "社交偏好", "沟通偏好"],
  work_rants: ["社交心理", "角色压力"],
  hobbies_niche: ["兴趣爱好", "新奇发现", "小众爱好", "创意来源"],
  
  // 走心聊类 (deep)
  life_philosophy: ["人生感悟", "思考分享", "深度思考", "生活哲学"],
  career_growth: ["自我成长", "社交角色"],
  relationships: ["人际关系", "情感连接", "亲密关系", "陪伴方式"],
  dating_love: ["亲密关系", "情感连接", "信任关系"],
  mental_health: ["社交心理", "能量管理", "情感支持", "心态管理"],
  startup_ideas: ["创意脑洞", "创意来源", "脑洞问题", "创意转化"],
  tech_ai: ["未来畅想", "新奇发现"],
  self_growth: ["自我认知", "人生感悟", "人生影响"],
  
  // 看情况类 (sensitive)
  current_events: ["时事"],
  politics: ["时事"],
  social_issues: ["思考分享"],
  parenting: ["生活智慧"],
  religion: ["人生感悟", "深度思考"],
  money_finance: ["生活智慧"],
};

// 反向映射：类别到包含该类别的话题卡的关键词匹配
const categoryKeywords: Record<string, string[]> = {
  "兴趣爱好": ["追", "爱好", "兴趣", "玩"],
  "生活方式": ["周末", "生活", "日常"],
  "趣味分享": ["糗事", "笑", "有趣"],
  "理想生活": ["假期", "理想", "完美"],
  "小确幸": ["小事", "美好", "快乐"],
  "人生经历": ["经历", "过去", "做过"],
  "自我认知": ["自己", "性格", "反差"],
  "社交偏好": ["社交", "独处", "人多"],
  "沟通偏好": ["对话", "交流", "表达"],
  "人生感悟": ["过去的自己", "意义", "改变"],
  "思考分享": ["思考", "问题"],
  "深度思考": ["思考", "意义"],
  "生活哲学": ["先想再做", "先做再说"],
  "人际关系": ["朋友", "关系"],
  "情感连接": ["被理解", "倾听"],
  "亲密关系": ["沉默", "陪伴"],
  "能量管理": ["充电", "能量"],
  "情感支持": ["情绪", "支持"],
  "创意脑洞": ["发明", "创造", "脑洞"],
  "创意来源": ["灵感", "灵光"],
  "未来畅想": ["未来", "10年"],
  "新奇发现": ["发现", "冷门"],
};

/**
 * 根据用户话题偏好过滤和排序话题
 * - 硬性排除触及任何用户 topicsAvoid 的话题
 * - 优先匹配用户的 topicsHappy
 */
export function filterTopicsByPreferences(
  topics: TopicCard[],
  topicsHappy: string[],
  topicsAvoid: string[],
  maxCount: number = 8
): TopicCard[] {
  if (topicsHappy.length === 0 && topicsAvoid.length === 0) {
    return topics.slice(0, maxCount);
  }
  
  // 去重
  const uniqueHappy = [...new Set(topicsHappy)];
  const uniqueAvoid = [...new Set(topicsAvoid)];
  
  // 构建喜欢的类别集合
  const happyCategories = new Set<string>();
  for (const topicId of uniqueHappy) {
    const categories = topicIdToCategoryMap[topicId] || [];
    categories.forEach(c => happyCategories.add(c));
  }
  
  // 构建避免的类别集合（硬性排除）
  const avoidCategories = new Set<string>();
  for (const topicId of uniqueAvoid) {
    const categories = topicIdToCategoryMap[topicId] || [];
    categories.forEach(c => avoidCategories.add(c));
  }
  
  // 计算每个话题的偏好分数
  const scoredTopics = topics.map(topic => {
    const category = topic.category;
    const question = topic.question;
    
    // 硬性排除：如果类别在避免列表中，标记为排除
    const shouldExclude = avoidCategories.has(category);
    
    let score = 0;
    
    // 类别匹配 +3
    if (happyCategories.has(category)) {
      score += 3;
    }
    
    // 关键词匹配加分
    for (const topicId of uniqueHappy) {
      const categories = topicIdToCategoryMap[topicId] || [];
      for (const cat of categories) {
        const keywords = categoryKeywords[cat] || [];
        if (keywords.some(kw => question.includes(kw))) {
          score += 1;
          break;
        }
      }
    }
    
    return { topic, score, exclude: shouldExclude };
  });
  
  // 先过滤掉应排除的话题，再按分数排序
  const filtered = scoredTopics
    .filter(({ exclude }) => !exclude)
    .sort((a, b) => b.score - a.score);
  
  // 如果过滤后话题不足，补充中性话题
  if (filtered.length < maxCount) {
    const excluded = scoredTopics.filter(({ exclude }) => exclude);
    // 不添加被排除的话题，保持用户心理安全
  }
  
  return filtered.slice(0, maxCount).map(({ topic }) => topic);
}
