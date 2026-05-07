/**
 * 12-Archetype Animal Social Vibe System
 * 用于JoyJoin盲盒活动的AI匹配算法
 */

export const archetypeConfig: Record<string, { 
  icon: string; 
  color: string;
  bgColor: string;
  description: string;
  traits: string[]; // 核心特质
  energyLevel: number; // 社交能量值 (30-95)
  nickname: string; // 鲜活昵称
  tagline: string; // 一句定位
  epicDescription: string; // 角色史诗描述
  styleQuote: string; // 独特风格描述
  coreContributions: string; // 核心贡献
}> = {
  // 高能量区 (82-95)
  "corgi": { 
    icon: "🐕", 
    color: "text-orange-600 dark:text-orange-400",
    bgColor: "bg-orange-100 dark:bg-orange-900/20",
    description: "团队永动机，摇尾点火官，擅长破冰和带动气氛",
    traits: ["能量充沛", "幽默感强", "善于调动气氛"],
    energyLevel: 95,
    nickname: "摇尾点火官",
    tagline: "瞬间破冰的气氛点火手",
    epicDescription: "他们是场域中不可或缺的活力源泉，如同一位技艺高超的引火者，总能以极具感染力的开朗与热情迅速点燃全场。当对话陷入僵局或空气突然安静时，他们一个恰到好处的提问、一个应景的幽默玩笑，便能瞬间打破坚冰，将原本可能尴尬的沉默巧妙转化为所有人参与其中的、热火朝天的欢乐讨论。",
    styleQuote: "团队永动机，尾巴摇一摇，冷场焦虑全赶跑",
    coreContributions: "破冰启动，创造欢乐氛围"
  },
  "rooster": { 
    icon: "🐓", 
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-100 dark:bg-amber-900/20",
    description: "人间小暖气，咯咯小太阳，散发稳定温暖的正能量",
    traits: ["乐观开朗", "感染力强", "情绪稳定"],
    energyLevel: 90,
    nickname: "咯咯小太阳",
    tagline: "稳定输出的暖意基线",
    epicDescription: "他们是群体中'快乐的常量'，本身就是一个温暖的小宇宙。无需刻意制造话题或行动，他们稳定而乐观的存在，就像一道和煦的阳光，能自然而然地提升整个空间的幸福基线。当你和他们相处时，会不自觉地感觉世界简单美好了一些，那些小小的压力与烦恼也随之悄然消散。",
    styleQuote: "人间小暖气，咯咯咯一笑，负面情绪全蒸发",
    coreContributions: "散发温暖能量，提升整体幸福感"
  },
  "hamster_praise": { 
    icon: "🐬", 
    color: "text-cyan-600 dark:text-cyan-400",
    bgColor: "bg-cyan-100 dark:bg-cyan-900/20",
    description: "掌声发动机，首席鼓掌官，善于发现和放大他人优点",
    traits: ["鼓励性强", "反应热情", "正能量满满"],
    energyLevel: 85,
    nickname: "首席鼓掌官",
    tagline: "即时正反馈的自信放大器",
    epicDescription: "他们是团队中不可或缺的积极能量源泉，是一位专业的'闪光时刻'捕捉师。无论谁做出了何种分享，他们总能报以最及时的兴奋、最专注的倾听与最真诚的赞美。他们的存在本身就像一种无形的声援，让团队中的每一位成员都感觉自己的发言是有趣的、被欣赏的，从而获得更多自信，更愿意敞开心扉。",
    styleQuote: "首席鼓掌官，小手拍一拍，你的魅力全打开",
    coreContributions: "提供积极反馈，增强团队信心"
  },
  "fox": { 
    icon: "🦊", 
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-100 dark:bg-red-900/20",
    description: "城市探险家，巷口密探，好奇心强、信息灵通",
    traits: ["好奇心强", "信息灵通", "勇于尝试"],
    energyLevel: 82,
    nickname: "巷口密探",
    tagline: "带来新鲜玩法与地点的发现官",
    epicDescription: "他们是城市里行走的惊奇发现官，仿佛拥有一张旁人无法窥见的秘密地图。当聚会流于寻常套路时，他们总能如数家珍地抛出藏匿于小巷深处的特色小店，或是一个别出心裁的活动点子，轻易将一次平凡的相聚升级为一场令人回味无穷的、充满发现感的共同冒险。",
    styleQuote: "城市探险家，鼻子嗅一嗅，新奇玩法全都有",
    coreContributions: "引入新鲜体验，拓展活动边界"
  },
  
  // 中能量区 (68-75)
  "dolphin_calm": { 
    icon: "🐬", 
    color: "text-indigo-600 dark:text-indigo-400",
    bgColor: "bg-indigo-100 dark:bg-indigo-900/20",
    description: "气氛调频手，气氛冲浪手，情商高、应变力强",
    traits: ["情商高", "应变力强", "包容性好"],
    energyLevel: 75,
    nickname: "气氛冲浪手",
    tagline: "在情绪波动时的气氛调频手",
    epicDescription: "他们如同一位在社交情绪波浪中自如滑行的冲浪手，或者说是一位经验丰富的现场DJ。凭借非凡的观察力，他们能精准捕捉到空气中每一丝微妙的情感波动与能量流向，并用一句轻松的玩笑化解潜在的紧张，微妙地调和着气氛，始终维持着整个场域的和谐、轻松与包容。",
    styleQuote: "气氛冲浪手，微笑露一露，尴尬紧张全冲走",
    coreContributions: "平衡群体氛围，化解潜在冲突"
  },
  "spider": { 
    icon: "🕷️", 
    color: "text-purple-600 dark:text-purple-400",
    bgColor: "bg-purple-100 dark:bg-purple-900/20",
    description: "社交黏合剂，关系织网师，善于建立连接和构建网络",
    traits: ["观察敏锐", "善于发现共同点", "人脉广泛"],
    energyLevel: 72,
    nickname: "关系织网师",
    tagline: "发现共同点并撮合交流的连接器",
    epicDescription: "他们是人群中天生的关系建筑师，拥有如蜘蛛侠般的敏锐直觉。他们能精准感知到人与人之间那些尚未被发现的共同兴趣或潜在关联，并乐于扮演那个关键的连接点，用巧妙的话语作丝线，编织出一张让所有人惊叹的社交网络，确保没有任何一个人在这场集体对话中成为孤岛。",
    styleQuote: "社交黏合剂，网络织一织，陌生朋友变知己",
    coreContributions: "连接不同人群，构建社交网络"
  },
  "koala": { 
    icon: "🐻", 
    color: "text-pink-600 dark:text-pink-400",
    bgColor: "bg-pink-100 dark:bg-pink-900/20",
    description: "故事收藏家，怀抱故事熊，善于倾听和共情",
    traits: ["善于倾听", "共情力强", "故事力丰富"],
    energyLevel: 70,
    nickname: "怀抱故事熊",
    tagline: "把片段变故事的情感黏合剂",
    epicDescription: "他们是群体中温暖的情感联结者，如同一个承载着无数珍贵片段的活体博物馆。他们不仅善于将平凡的日常编织成引人入胜的故事，更拥有一双能听见心跳的耳朵，让每个人的分享都得到最深情的回响。经由他们的讲述与倾听，陌生的个体之间得以建立起坚实的情感纽带，让整个场域因这份深层的懂得而变得格外紧密。",
    styleQuote: "故事收藏家，怀抱暖一暖，心事烦恼全消散",
    coreContributions: "建立情感连接，营造深度交流"
  },
  "octopus": { 
    icon: "🐙", 
    color: "text-violet-600 dark:text-violet-400",
    bgColor: "bg-violet-100 dark:bg-violet-900/20",
    description: "创意喷射器，脑洞喷墨章，思维跳跃、联想丰富",
    traits: ["思维跳跃", "联想丰富", "创意无穷"],
    energyLevel: 68,
    nickname: "脑洞喷墨章",
    tagline: "多线发散的创意喷射口",
    epicDescription: "他们的思维如同一个永不停歇的脑洞喷射器，总能从最平凡的事物中挖掘出令人惊叹的趣味。无论是一个异想天开的游戏设计，还是一个对寻常概念的绝妙比喻，他们总能凭借出其不意的幽默感和独特视角，为每一次聚会注入魔法般的惊喜与持续不断的新鲜感。",
    styleQuote: "创意喷射器，触手伸一伸，奇妙点子八方来",
    coreContributions: "多线程发散思维，激发集体脑暴"
  },
  
  // 低能量区 (52-55)
  "owl": { 
    icon: "🦉", 
    color: "text-slate-600 dark:text-slate-400",
    bgColor: "bg-slate-100 dark:bg-slate-900/20",
    description: "哲学带师，推镜思考官，逻辑性强、善于提问",
    traits: ["逻辑性强", "善于提问", "追求真理"],
    energyLevel: 55,
    nickname: "推镜思考官",
    tagline: "把闲聊引向本质的深潜引导者",
    epicDescription: "在习惯于寒暄的社交浅水区，他们是一位温和而坚定的思想深潜教练。不满足于停留在'今天天气真好'的表面，他们会用充满智慧的追问，巧妙地挑战成见，引导大家潜入思维的海底，去探讨现象背后的本质，从而将轻松的闲聊催生为营养丰富、更具启发性的高质量思想交锋。",
    styleQuote: "哲学带师，镜框推一推，聊天深度往上飞",
    coreContributions: "提升对话质量，激发深度思考"
  },
  "elephant": { 
    icon: "🐘", 
    color: "text-gray-600 dark:text-gray-400",
    bgColor: "bg-gray-100 dark:bg-gray-900/20",
    description: "团队定盘星，象鼻定心锚，稳重可靠、包容豁达",
    traits: ["稳重可靠", "包容豁达", "给人安全感"],
    energyLevel: 52,
    nickname: "象鼻定心锚",
    tagline: "让人安心的稳定后盾与守望者",
    epicDescription: "他们是团队中温暖而坚实的后盾，天生具备一种让人心安的力量。他们或许不是话题的中心，但总是用细腻的观察力默默关怀着每个人，像一位无声的守护者，通过一个默契的眼神、一次及时的援手，为整个场域奠定下高度信任与安全的基调，让所有人都能安心地做自己。",
    styleQuote: "团队定盘星，象鼻卷一卷，安全感立马拉满",
    coreContributions: "提供稳定支持，奠定安心基调"
  },
  
  // 超低能量区 (30-38)
  "turtle": { 
    icon: "🐢", 
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-100 dark:bg-emerald-900/20",
    description: "人间观察家，慢语真知龟，思考深入、言简意赅",
    traits: ["思考深入", "言简意赅", "洞察力强"],
    energyLevel: 38,
    nickname: "慢语真知龟",
    tagline: "低频高质的洞察投放者",
    epicDescription: "他们是社交中的深度思考者，信奉'沉默是金，但真理是钻石'。他们享受通过观察与倾听来参与社交，用一种更深刻的方式'品尝'对话。当他们经过深思熟虑终于开口时，往往能提供独一无二的视角或一针见血的总结，轻易推动对话进入一个更具洞察力的新层次。",
    styleQuote: "人间观察家，脖子伸一伸，一语道破万事皆",
    coreContributions: "提供深度洞察，贡献独到见解"
  },
  "cat": { 
    icon: "🐱", 
    color: "text-indigo-600 dark:text-indigo-400",
    bgColor: "bg-indigo-100 dark:bg-indigo-900/20",
    description: "安静陪伴者，安静伴伴猫，存在感低但不施加压力",
    traits: ["存在感低", "不施加压力", "享受旁观"],
    energyLevel: 30,
    nickname: "安静伴伴猫",
    tagline: "低压陪伴的静默同在者",
    epicDescription: "他们是'陪伴式社交'的完美代言人，为'社恐'或社交能量低的用户提供了最舒适的身份认同。他们参与社交的核心目的并非交换信息，而是为了对抗孤独，享受一种'共同存在'的温暖陪伴。他们的存在，如同一个安静而舒适的角落，让整个场域的氛围变得更加轻松和无压。",
    styleQuote: "安静陪伴者，角落窝一窝，你在身边就快乐",
    coreContributions: "提供安静陪伴，营造轻松氛围"
  },
};

// 原型分类（按能量区分）
export const archetypeCategories = {
  highEnergy: ["corgi", "rooster", "hamster_praise", "fox"],
  mediumEnergy: ["dolphin_calm", "spider", "koala", "octopus"],
  lowEnergy: ["owl", "elephant"],
  veryLowEnergy: ["turtle", "cat"],
};

// 获取所有原型名称
export const allArchetypes = Object.keys(archetypeConfig);

// 根据分类获取原型
export function getArchetypesByCategory(category: keyof typeof archetypeCategories): string[] {
  return archetypeCategories[category];
}

// 检查是否为有效原型
export function isValidArchetype(archetype: string): boolean {
  return allArchetypes.includes(archetype);
}

// 根据能量等级获取原型
export function getArchetypesByEnergyRange(min: number, max: number): string[] {
  return allArchetypes.filter(
    archetype => {
      const energy = archetypeConfig[archetype].energyLevel;
      return energy >= min && energy <= max;
    }
  );
}
