/**
 * Unified Archetype Registry - Single Source of Truth
 * 12原型数据中心 - 统一数据源
 * 
 * This module consolidates all archetype metadata that was previously scattered across:
 * - prototypes.ts (traitProfile, energyLevel, confusableWith)
 * - archetypes.ts (description, nickname, tagline, epicDescription)
 * - archetypeInsights.ts (counterIntuitive, scenarioSimulation, hiddenStrength)
 * - archetypeAvatars.ts (gradients, bgColors)
 */

import { TraitKey } from './types';

export interface ArchetypeProfile {
  traitProfile: Record<TraitKey, number>;
  energyLevel: number;
  secondaryDifferentiators: {
    motivationDirection: 'internal' | 'external' | 'balanced';
    conflictPosture: 'approach' | 'avoid' | 'mediate';
    riskTolerance: 'high' | 'medium' | 'low';
    statusOrientation: 'leader' | 'supporter' | 'independent';
  };
  confusableWith: string[];
  uniqueSignalTraits: TraitKey[];
}

export interface ArchetypeNarrative {
  nickname: string;
  tagline: string;
  epicDescription: string;
  styleQuote: string;
  coreContributions: string;
  description: string;
  traits: string[];
}

export interface ArchetypeInsights {
  counterIntuitive: string;
  scenarioSimulation: string;
  hiddenStrength: string;
  rarityPercentage: number;
}

export interface ArchetypeDisplayTokens {
  colorClass: string;
  bgColorClass: string;
  gradientKey: string;
}

export interface ArchetypeRecord {
  id: string;
  name: string;
  assetKey: string;
  profile: ArchetypeProfile;
  narrative: ArchetypeNarrative;
  insights: ArchetypeInsights;
  displayTokens: ArchetypeDisplayTokens;
}

export const archetypeRegistry: Record<string, ArchetypeRecord> = {
  "开心柯基": {
    id: "corgi",
    name: "开心柯基",
    assetKey: "corgi",
    profile: {
      traitProfile: { A: 60, C: 50, E: 60, O: 65, X: 95, P: 85 },
      energyLevel: 95,
      secondaryDifferentiators: {
        motivationDirection: 'external',
        conflictPosture: 'approach',
        riskTolerance: 'high',
        statusOrientation: 'leader'
      },
      confusableWith: ["太阳鸡"],
      uniqueSignalTraits: ["P", "A", "X"]
    },
    narrative: {
      nickname: "摇尾点火官",
      tagline: "瞬间破冰的气氛点火手",
      epicDescription: "他们是场域中不可或缺的活力源泉，如同一位技艺高超的引火者，总能以极具感染力的开朗与热情迅速点燃全场。当对话陷入僵局或空气突然安静时，他们一个恰到好处的提问、一个应景的幽默玩笑，便能瞬间打破坚冰，将原本可能尴尬的沉默巧妙转化为所有人参与其中的、热火朝天的欢乐讨论。",
      styleQuote: "团队永动机，尾巴摇一摇，冷场焦虑全赶跑",
      coreContributions: "破冰启动，创造欢乐氛围",
      description: "团队永动机，摇尾点火官，擅长破冰和带动气氛",
      traits: ["能量充沛", "幽默感强", "善于调动气氛"]
    },
    insights: {
      counterIntuitive: "你看起来永远充满活力，但其实你也有需要独处充电的时刻。你的热情不是无限的，它来自于你真心想让每个人都开心。",
      scenarioSimulation: "当饭局突然冷场时，你会下意识地抛出一个话题或笑话来救场，即使你自己其实也不太有话题。这是你的本能反应，不是刻意为之。",
      hiddenStrength: "你比想象中更善于察言观色，只是你选择用积极的方式回应。",
      rarityPercentage: 12
    },
    displayTokens: {
      colorClass: "text-orange-600 dark:text-orange-400",
      bgColorClass: "bg-orange-100 dark:bg-orange-900/20",
      gradientKey: "from-yellow-500 via-orange-500 to-red-500"
    }
  },
  "太阳鸡": {
    id: "rooster",
    name: "太阳鸡",
    assetKey: "rooster",
    profile: {
      traitProfile: { A: 70, C: 78, E: 88, O: 55, X: 78, P: 92 },
      energyLevel: 90,
      secondaryDifferentiators: {
        motivationDirection: 'external',
        conflictPosture: 'mediate',
        riskTolerance: 'medium',
        statusOrientation: 'supporter'
      },
      confusableWith: ["开心柯基", "夸夸豚"],
      uniqueSignalTraits: ["P", "X", "E"]
    },
    narrative: {
      nickname: "咯咯小太阳",
      tagline: "稳定输出的暖意基线",
      epicDescription: "他们是群体中'快乐的常量'，本身就是一个温暖的小宇宙。无需刻意制造话题或行动，他们稳定而乐观的存在，就像一道和煦的阳光，能自然而然地提升整个空间的幸福基线。当你和他们相处时，会不自觉地感觉世界简单美好了一些，那些小小的压力与烦恼也随之悄然消散。",
      styleQuote: "人间小暖气，咯咯咯一笑，负面情绪全蒸发",
      coreContributions: "散发温暖能量，提升整体幸福感",
      description: "人间小暖气，咯咯小太阳，散发稳定温暖的正能量",
      traits: ["乐观开朗", "感染力强", "情绪稳定"]
    },
    insights: {
      counterIntuitive: "你稳定的正能量让人觉得你从不焦虑，但实际上你只是更擅长消化负面情绪。你的乐观是选择，不是天生。",
      scenarioSimulation: "当有人在饭局上抱怨时，你会不自觉地想办法给话题一个积极的转折，但同时你内心也在共情对方的困扰。",
      hiddenStrength: "你的情绪稳定性其实是后天修炼的结果，这让你成为团队的定海神针。",
      rarityPercentage: 9
    },
    displayTokens: {
      colorClass: "text-amber-600 dark:text-amber-400",
      bgColorClass: "bg-amber-100 dark:bg-amber-900/20",
      gradientKey: "from-amber-500 via-yellow-500 to-orange-500"
    }
  },
  "夸夸豚": {
    id: "dolphin_praise",
    name: "夸夸豚",
    assetKey: "dolphin_praise",
    profile: {
      traitProfile: { A: 95, C: 50, E: 65, O: 62, X: 82, P: 88 },
      energyLevel: 85,
      secondaryDifferentiators: {
        motivationDirection: 'external',
        conflictPosture: 'mediate',
        riskTolerance: 'medium',
        statusOrientation: 'supporter'
      },
      confusableWith: ["淡定海豚", "太阳鸡"],
      uniqueSignalTraits: ["A", "X", "P"]
    },
    narrative: {
      nickname: "首席鼓掌官",
      tagline: "即时正反馈的自信放大器",
      epicDescription: "他们是团队中不可或缺的积极能量源泉，是一位专业的'闪光时刻'捕捉师。无论谁做出了何种分享，他们总能报以最及时的兴奋、最专注的倾听与最真诚的赞美。他们的存在本身就像一种无形的声援，让团队中的每一位成员都感觉自己的发言是有趣的、被欣赏的，从而获得更多自信，更愿意敞开心扉。",
      styleQuote: "首席鼓掌官，小手拍一拍，你的魅力全打开",
      coreContributions: "提供积极反馈，增强团队信心",
      description: "掌声发动机，首席鼓掌官，善于发现和放大他人优点",
      traits: ["鼓励性强", "反应热情", "正能量满满"]
    },
    insights: {
      counterIntuitive: "你总是在夸别人，但你自己其实很少被夸。你给予的赞美是真心的，但你对自己的评价往往比对别人严格得多。",
      scenarioSimulation: "当有人分享成就时，你会第一个鼓掌叫好。但当轮到自己分享时，你可能会下意识地淡化自己的成绩。",
      hiddenStrength: "你的真诚赞美能力是稀缺资源，很多人说不出口的好话你说得自然。",
      rarityPercentage: 11
    },
    displayTokens: {
      colorClass: "text-cyan-600 dark:text-cyan-400",
      bgColorClass: "bg-cyan-100 dark:bg-cyan-900/20",
      gradientKey: "from-cyan-500 via-blue-500 to-indigo-500"
    }
  },
  "机智狐": {
    id: "fox",
    name: "机智狐",
    assetKey: "fox",
    profile: {
      traitProfile: { A: 40, C: 50, E: 60, O: 92, X: 78, P: 58 },
      energyLevel: 82,
      secondaryDifferentiators: {
        motivationDirection: 'external',
        conflictPosture: 'approach',
        riskTolerance: 'high',
        statusOrientation: 'independent'
      },
      confusableWith: ["灵感章鱼"],
      uniqueSignalTraits: ["O", "X", "P"]
    },
    narrative: {
      nickname: "巷口密探",
      tagline: "带来新鲜玩法与地点的发现官",
      epicDescription: "他们是城市里行走的惊奇发现官，仿佛拥有一张旁人无法窥见的秘密地图。当聚会流于寻常套路时，他们总能如数家珍地抛出藏匿于小巷深处的特色小店，或是一个别出心裁的活动点子，轻易将一次平凡的相聚升级为一场令人回味无穷的、充满发现感的共同冒险。",
      styleQuote: "城市探险家，鼻子嗅一嗅，新奇玩法全都有",
      coreContributions: "引入新鲜体验，拓展活动边界",
      description: "城市探险家，巷口密探，好奇心强、信息灵通",
      traits: ["好奇心强", "信息灵通", "勇于尝试"]
    },
    insights: {
      counterIntuitive: "你看起来总有新奇的想法，但其实你也会担心自己的提议太冒险。你的勇于尝试背后，是对无聊生活的深深恐惧。",
      scenarioSimulation: "当大家在纠结去哪儿吃时，你会突然提议一个意想不到的地方，然后内心忐忑地等待大家的反应。",
      hiddenStrength: "你的信息敏感度极高，总能在对话中捕捉到别人忽略的有趣细节。",
      rarityPercentage: 8
    },
    displayTokens: {
      colorClass: "text-red-600 dark:text-red-400",
      bgColorClass: "bg-red-100 dark:bg-red-900/20",
      gradientKey: "from-orange-500 via-red-500 to-pink-500"
    }
  },
  "淡定海豚": {
    id: "dolphin_calm",
    name: "淡定海豚",
    assetKey: "dolphin_calm",
    profile: {
      traitProfile: { A: 70, C: 70, E: 85, O: 65, X: 65, P: 68 },
      energyLevel: 75,
      secondaryDifferentiators: {
        motivationDirection: 'balanced',
        conflictPosture: 'mediate',
        riskTolerance: 'medium',
        statusOrientation: 'supporter'
      },
      confusableWith: ["夸夸豚", "暖心熊"],
      uniqueSignalTraits: ["E", "O", "A"]
    },
    narrative: {
      nickname: "气氛冲浪手",
      tagline: "在情绪波动时的气氛调频手",
      epicDescription: "他们如同一位在社交情绪波浪中自如滑行的冲浪手，或者说是一位经验丰富的现场DJ。凭借非凡的观察力，他们能精准捕捉到空气中每一丝微妙的情感波动与能量流向，并用一句轻松的玩笑化解潜在的紧张，微妙地调和着气氛，始终维持着整个场域的和谐、轻松与包容。",
      styleQuote: "气氛冲浪手，微笑露一露，尴尬紧张全冲走",
      coreContributions: "平衡群体氛围，化解潜在冲突",
      description: "气氛调频手，气氛冲浪手，情商高、应变力强",
      traits: ["情商高", "应变力强", "包容性好"]
    },
    insights: {
      counterIntuitive: "你看起来总是云淡风轻，但你其实一直在暗中观察和计算最佳干预时机。你的淡定不是冷漠，是高段位的情商。",
      scenarioSimulation: "当两个人观点对立时，你会在脑中快速评估局势，然后用一句轻描淡写的话化解紧张，让双方都觉得是自己想通了。",
      hiddenStrength: "你是天生的调停者，很多矛盾被你化解于无形之中，甚至当事人都不知道。",
      rarityPercentage: 7
    },
    displayTokens: {
      colorClass: "text-blue-600 dark:text-blue-400",
      bgColorClass: "bg-blue-100 dark:bg-blue-900/20",
      gradientKey: "from-blue-500 via-indigo-500 to-purple-500"
    }
  },
  "织网蛛": {
    id: "spider",
    name: "织网蛛",
    assetKey: "spider",
    profile: {
      traitProfile: { A: 70, C: 85, E: 65, O: 70, X: 60, P: 60 },
      energyLevel: 72,
      secondaryDifferentiators: {
        motivationDirection: 'balanced',
        conflictPosture: 'mediate',
        riskTolerance: 'medium',
        statusOrientation: 'independent'
      },
      confusableWith: ["暖心熊"],
      uniqueSignalTraits: ["C", "E", "A"]
    },
    narrative: {
      nickname: "关系织网师",
      tagline: "发现共同点并撮合交流的连接器",
      epicDescription: "他们是人群中天生的关系建筑师，拥有如蜘蛛侠般的敏锐直觉。他们能精准感知到人与人之间那些尚未被发现的共同兴趣或潜在关联，并乐于扮演那个关键的连接点，用巧妙的话语作丝线，编织出一张让所有人惊叹的社交网络，确保没有任何一个人在这场集体对话中成为孤岛。",
      styleQuote: "社交黏合剂，网络织一织，陌生朋友变知己",
      coreContributions: "连接不同人群，构建社交网络",
      description: "社交黏合剂，关系织网师，善于建立连接和构建网络",
      traits: ["观察敏锐", "善于发现共同点", "人脉广泛"]
    },
    insights: {
      counterIntuitive: "你喜欢连接人，但你自己其实更享受观察者的位置。你编织关系网不是为了社交资本，而是真的觉得看到人与人连接很有成就感。",
      scenarioSimulation: "在饭局上你会敏锐地发现两个陌生人有共同爱好，然后不动声色地把话题引向那个方向，让他们自己发现彼此。",
      hiddenStrength: "你的记忆力和关联能力超强，能记住每个人说过的小细节。",
      rarityPercentage: 6
    },
    displayTokens: {
      colorClass: "text-purple-600 dark:text-purple-400",
      bgColorClass: "bg-purple-100 dark:bg-purple-900/20",
      gradientKey: "from-purple-500 via-pink-500 to-fuchsia-500"
    }
  },
  "暖心熊": {
    id: "bear",
    name: "暖心熊",
    assetKey: "bear",
    profile: {
      traitProfile: { A: 90, C: 65, E: 80, O: 60, X: 48, P: 70 },
      energyLevel: 70,
      secondaryDifferentiators: {
        motivationDirection: 'internal',
        conflictPosture: 'avoid',
        riskTolerance: 'low',
        statusOrientation: 'supporter'
      },
      confusableWith: ["定心大象", "织网蛛"],
      uniqueSignalTraits: ["A", "E", "P"]
    },
    narrative: {
      nickname: "怀抱故事熊",
      tagline: "把片段变故事的情感黏合剂",
      epicDescription: "他们是群体中温暖的情感联结者，如同一个承载着无数珍贵片段的活体博物馆。他们不仅善于将平凡的日常编织成引人入胜的故事，更拥有一双能听见心跳的耳朵，让每个人的分享都得到最深情的回响。经由他们的讲述与倾听，陌生的个体之间得以建立起坚实的情感纽带，让整个场域因这份深层的懂得而变得格外紧密。",
      styleQuote: "故事收藏家，怀抱暖一暖，心事烦恼全消散",
      coreContributions: "建立情感连接，营造深度交流",
      description: "故事收藏家，怀抱故事熊，善于倾听和共情",
      traits: ["善于倾听", "共情力强", "故事力丰富"]
    },
    insights: {
      counterIntuitive: "你是最好的倾听者，但你很少有机会被人认真倾听。你习惯了承接他人的情绪，却不太会表达自己的需求。",
      scenarioSimulation: "当有人在饭局上开始倾诉时，你会自然地调整坐姿，给予专注的眼神和适时的回应，让对方感到被完全理解。",
      hiddenStrength: "你的共情能力让人愿意敞开心扉，这是很多人羡慕但学不会的天赋。",
      rarityPercentage: 10
    },
    displayTokens: {
      colorClass: "text-pink-600 dark:text-pink-400",
      bgColorClass: "bg-pink-100 dark:bg-pink-900/20",
      gradientKey: "from-rose-500 via-pink-500 to-red-500"
    }
  },
  "灵感章鱼": {
    id: "octopus",
    name: "灵感章鱼",
    assetKey: "octopus",
    profile: {
      traitProfile: { A: 50, C: 28, E: 55, O: 95, X: 52, P: 70 },
      energyLevel: 68,
      secondaryDifferentiators: {
        motivationDirection: 'internal',
        conflictPosture: 'avoid',
        riskTolerance: 'high',
        statusOrientation: 'independent'
      },
      confusableWith: ["机智狐", "沉思猫头鹰"],
      uniqueSignalTraits: ["O", "P", "X"]
    },
    narrative: {
      nickname: "脑洞喷墨章",
      tagline: "多线发散的创意喷射口",
      epicDescription: "他们的思维如同一个永不停歇的脑洞喷射器，总能从最平凡的事物中挖掘出令人惊叹的趣味。无论是一个异想天开的游戏设计，还是一个对寻常概念的绝妙比喻，他们总能凭借出其不意的幽默感和独特视角，为每一次聚会注入魔法般的惊喜与持续不断的新鲜感。",
      styleQuote: "创意喷射器，触手伸一伸，奇妙点子八方来",
      coreContributions: "多线程发散思维，激发集体脑暴",
      description: "创意喷射器，脑洞喷墨章，思维跳跃、联想丰富",
      traits: ["思维跳跃", "联想丰富", "创意无穷"]
    },
    insights: {
      counterIntuitive: "你的脑洞天马行空，但你其实很在意别人对你想法的评价。每次抛出创意前，你都在心里做好了被当成怪人的准备。",
      scenarioSimulation: "当话题变得无聊时，你会突然把两个完全不相关的概念联系起来，然后期待地看着大家的反应。",
      hiddenStrength: "你的联想能力是创意工作的核心技能，很多人终其一生也学不会。",
      rarityPercentage: 5
    },
    displayTokens: {
      colorClass: "text-violet-600 dark:text-violet-400",
      bgColorClass: "bg-violet-100 dark:bg-violet-900/20",
      gradientKey: "from-violet-500 via-purple-500 to-indigo-500"
    }
  },
  "沉思猫头鹰": {
    id: "owl",
    name: "沉思猫头鹰",
    assetKey: "owl",
    profile: {
      traitProfile: { A: 45, C: 80, E: 75, O: 88, X: 40, P: 50 },
      energyLevel: 55,
      secondaryDifferentiators: {
        motivationDirection: 'internal',
        conflictPosture: 'avoid',
        riskTolerance: 'low',
        statusOrientation: 'independent'
      },
      confusableWith: ["稳如龟", "灵感章鱼"],
      uniqueSignalTraits: ["O", "C", "E"]
    },
    narrative: {
      nickname: "推镜思考官",
      tagline: "把闲聊引向本质的深潜引导者",
      epicDescription: "在习惯于寒暄的社交浅水区，他们是一位温和而坚定的思想深潜教练。不满足于停留在'今天天气真好'的表面，他们会用充满智慧的追问，巧妙地挑战成见，引导大家潜入思维的海底，去探讨现象背后的本质，从而将轻松的闲聊催生为营养丰富、更具启发性的高质量思想交锋。",
      styleQuote: "哲学带师，镜框推一推，聊天深度往上飞",
      coreContributions: "提升对话质量，激发深度思考",
      description: "哲学带师，推镜思考官，逻辑性强、善于提问",
      traits: ["逻辑性强", "善于提问", "追求真理"]
    },
    insights: {
      counterIntuitive: "你看起来严肃深沉，但你其实也有想融入热闹的时刻。只是你更擅长深度对话，小聊天让你感到无所适从。",
      scenarioSimulation: "当大家聊得热火朝天时，你会在心里整理思路，等待一个合适的时机抛出你深思熟虑的观点。",
      hiddenStrength: "你的洞察力能看穿表象，一针见血的点评往往让人恍然大悟。",
      rarityPercentage: 8
    },
    displayTokens: {
      colorClass: "text-slate-600 dark:text-slate-400",
      bgColorClass: "bg-slate-100 dark:bg-slate-900/20",
      gradientKey: "from-slate-500 via-gray-500 to-zinc-500"
    }
  },
  "定心大象": {
    id: "elephant",
    name: "定心大象",
    assetKey: "elephant",
    profile: {
      traitProfile: { A: 70, C: 90, E: 86, O: 50, X: 40, P: 60 },
      energyLevel: 52,
      secondaryDifferentiators: {
        motivationDirection: 'internal',
        conflictPosture: 'avoid',
        riskTolerance: 'low',
        statusOrientation: 'supporter'
      },
      confusableWith: ["暖心熊", "稳如龟"],
      uniqueSignalTraits: ["E", "C", "A"]
    },
    narrative: {
      nickname: "象鼻定心锚",
      tagline: "让人安心的稳定后盾与守望者",
      epicDescription: "他们是团队中温暖而坚实的后盾，天生具备一种让人心安的力量。他们或许不是话题的中心，但总是用细腻的观察力默默关怀着每个人，像一位无声的守护者，通过一个默契的眼神、一次及时的援手，为整个场域奠定下高度信任与安全的基调，让所有人都能安心地做自己。",
      styleQuote: "团队定盘星，象鼻卷一卷，安全感立马拉满",
      coreContributions: "提供稳定支持，奠定安心基调",
      description: "团队定盘星，象鼻定心锚，稳重可靠、包容豁达",
      traits: ["稳重可靠", "包容豁达", "给人安全感"]
    },
    insights: {
      counterIntuitive: "你给人稳如泰山的感觉，但你内心其实也会焦虑。只是你更愿意把不安藏起来，让别人能安心依靠你。",
      scenarioSimulation: "当聚会出现意外状况时，你会自然地成为那个出主意、做决定的人，即使你自己也不确定这是最好的方案。",
      hiddenStrength: "你的存在本身就给人安全感，这是领导力的核心要素。",
      rarityPercentage: 7
    },
    displayTokens: {
      colorClass: "text-gray-600 dark:text-gray-400",
      bgColorClass: "bg-gray-100 dark:bg-gray-900/20",
      gradientKey: "from-gray-500 via-slate-500 to-stone-500"
    }
  },
  "稳如龟": {
    id: "turtle",
    name: "稳如龟",
    assetKey: "turtle",
    profile: {
      traitProfile: { A: 55, C: 90, E: 82, O: 58, X: 28, P: 45 },
      energyLevel: 38,
      secondaryDifferentiators: {
        motivationDirection: 'internal',
        conflictPosture: 'avoid',
        riskTolerance: 'low',
        statusOrientation: 'independent'
      },
      confusableWith: ["沉思猫头鹰", "隐身猫"],
      uniqueSignalTraits: ["E", "C"]
    },
    narrative: {
      nickname: "慢语真知龟",
      tagline: "低频高质的洞察投放者",
      epicDescription: "他们是社交中的深度思考者，信奉'沉默是金，但真理是钻石'。他们享受通过观察与倾听来参与社交，用一种更深刻的方式'品尝'对话。当他们经过深思熟虑终于开口时，往往能提供独一无二的视角或一针见血的总结，轻易推动对话进入一个更具洞察力的新层次。",
      styleQuote: "人间观察家，脖子伸一伸，一语道破万事皆",
      coreContributions: "提供深度洞察，贡献独到见解",
      description: "人间观察家，慢语真知龟，思考深入、言简意赅",
      traits: ["思考深入", "言简意赅", "洞察力强"]
    },
    insights: {
      counterIntuitive: "你看起来慢热，但一旦认定一个人，你会是最忠诚的朋友。你的慢不是冷漠，是在认真评估这段关系值不值得投入。",
      scenarioSimulation: "在饭局上你会安静观察每个人，心里默默给他们分类，决定哪些人值得进一步了解。",
      hiddenStrength: "你的判断力极准，你看人的眼光很少出错。",
      rarityPercentage: 9
    },
    displayTokens: {
      colorClass: "text-emerald-600 dark:text-emerald-400",
      bgColorClass: "bg-emerald-100 dark:bg-emerald-900/20",
      gradientKey: "from-green-500 via-emerald-500 to-teal-500"
    }
  },
  "隐身猫": {
    id: "cat",
    name: "隐身猫",
    assetKey: "cat",
    profile: {
      traitProfile: { A: 40, C: 55, E: 65, O: 72, X: 22, P: 42 },
      energyLevel: 30,
      secondaryDifferentiators: {
        motivationDirection: 'internal',
        conflictPosture: 'avoid',
        riskTolerance: 'low',
        statusOrientation: 'independent'
      },
      confusableWith: ["稳如龟"],
      uniqueSignalTraits: ["E"]
    },
    narrative: {
      nickname: "安静伴伴猫",
      tagline: "低压陪伴的静默同在者",
      epicDescription: "他们是'陪伴式社交'的完美代言人，为'社恐'或社交能量低的用户提供了最舒适的身份认同。他们参与社交的核心目的并非交换信息，而是为了对抗孤独，享受一种'共同存在'的温暖陪伴。他们的存在，如同一个安静而舒适的角落，让整个场域的氛围变得更加轻松和无压。",
      styleQuote: "安静陪伴者，角落窝一窝，你在身边就快乐",
      coreContributions: "提供安静陪伴，营造轻松氛围",
      description: "安静陪伴者，安静伴伴猫，存在感低但不施加压力",
      traits: ["存在感低", "不施加压力", "享受旁观"]
    },
    insights: {
      counterIntuitive: "你习惯躲在人群边缘，但你观察到的细节比任何人都多。你不是不想社交，只是大群体的社交让你消耗太大。",
      scenarioSimulation: "在热闹的饭局上，你会找一个安静的角落，和一两个人进行深度交谈，这种一对一的互动让你更自在。",
      hiddenStrength: "你的观察力和深度交流能力，让你在小范围社交中极具魅力。",
      rarityPercentage: 15
    },
    displayTokens: {
      colorClass: "text-indigo-600 dark:text-indigo-400",
      bgColorClass: "bg-indigo-100 dark:bg-indigo-900/20",
      gradientKey: "from-indigo-500 via-purple-500 to-violet-500"
    }
  }
};

// Helper functions
export function getArchetype(name: string): ArchetypeRecord | null {
  return archetypeRegistry[name] || null;
}

export function getAllArchetypes(): string[] {
  return Object.keys(archetypeRegistry);
}

export function getArchetypesByEnergyRange(min: number, max: number): string[] {
  return Object.entries(archetypeRegistry)
    .filter(([_, record]) => {
      const energy = record.profile.energyLevel;
      return energy >= min && energy <= max;
    })
    .map(([name]) => name);
}

export const archetypeCategories = {
  highEnergy: ["开心柯基", "太阳鸡", "夸夸豚", "机智狐"],
  mediumEnergy: ["淡定海豚", "织网蛛", "暖心熊", "灵感章鱼"],
  lowEnergy: ["沉思猫头鹰", "定心大象"],
  veryLowEnergy: ["稳如龟", "隐身猫"],
};

// For backward compatibility with prototypes.ts
export function getArchetypePrototype(name: string): ArchetypeProfile | null {
  const record = archetypeRegistry[name];
  return record ? record.profile : null;
}

// For backward compatibility with archetypeInsights.ts
export function getArchetypeInsight(name: string): ArchetypeInsights | null {
  const record = archetypeRegistry[name];
  return record ? record.insights : null;
}

// For backward compatibility with archetypes.ts
export function getArchetypeNarrative(name: string): ArchetypeNarrative | null {
  const record = archetypeRegistry[name];
  return record ? record.narrative : null;
}

// Type exports
export type { TraitKey };
