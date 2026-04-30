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
import { ArchetypeId } from './archetypeNames';

export interface ArchetypeProfile {
  traitProfile: Record<TraitKey, number>;
  energyLevel: number;
  secondaryDifferentiators: {
    motivationDirection: 'internal' | 'external' | 'balanced';
    conflictPosture: 'approach' | 'avoid' | 'mediate';
    riskTolerance: 'high' | 'medium' | 'low';
    statusOrientation: 'leader' | 'supporter' | 'independent';
  };
  confusableWith: ArchetypeId[];
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

export interface ArchetypeUniqueTrait {
  trait: string;
  description: string;
}

export interface ArchetypeXiaoyueFallback {
  headline: string;
  shareLine: string;
  stateLabel: string;
  analysis: string;
  socialRole: string;
  bestScene: string;
  microAction: string;
}

export interface ArchetypeShareVariants {
  selfIntro: string;
  friendCallout: string;
  socialInvite: string;
}

export interface ArchetypeDisplay {
  uniqueTraits: ArchetypeUniqueTrait[];
  xiaoyueFallback: ArchetypeXiaoyueFallback;
  shareVariants: ArchetypeShareVariants;
}

export interface ArchetypeRecord {
  id: string;
  name: string;
  assetKey: string;
  profile: ArchetypeProfile;
  narrative: ArchetypeNarrative;
  insights: ArchetypeInsights;
  displayTokens: ArchetypeDisplayTokens;
  display: ArchetypeDisplay;
}

export const archetypeRegistry: Record<ArchetypeId, ArchetypeRecord> = {
  "corgi": {
    id: "corgi",
    name: "气氛组柯基",
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
      confusableWith: ["rooster"],
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
    },
    display: {
      uniqueTraits: [
        { trait: "自带氛围感", description: "你走到哪里，快乐就跟到哪里。这种天然的感染力让你在人群中像发光体一样，总能带动周围人的情绪。" },
        { trait: "破冰达人", description: "让陌生人也能迅速放下防备。你善于寻找轻松的话题切入点，能敏锐察觉尴尬气氛并用幽默化解，让初次见面变得简单。" },
      ],
      xiaoyueFallback: {
        headline: "你不是硬撑热闹，你是自然带热的人",
        shareLine: "我是气氛组柯基型，属于一进场就会慢慢把气氛带起来的那种。",
        stateLabel: "快热带动型",
        analysis: "你是气氛组柯基型：热场快，接梗快，给人安全感也快。很多局有你在，气氛会自然松下来。只是别总顾着让大家开心，自己的电量也得留一点。",
        socialRole: "你更像开场加速器，能让陌生局更快松下来。",
        bestScene: "更适合6到8人的轻松热场局，有接梗空间会更舒服。",
        microAction: "下次进新局先抛一个轻松问题，再接住第一个回应你的人。",
      },
      shareVariants: {
        selfIntro: "我是气氛组柯基型，属于一进场就会慢慢把气氛带起来的那种。",
        friendCallout: "认识我的人应该会懂，你不是硬撑热闹，你是自然带热的人。",
        socialInvite: "如果一起组局，我更适合6到8人的轻松热场局，会比较容易进入状态。",
      },
    },
  },
  "rooster": {
    id: "rooster",
    name: "情绪稳定鸡",
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
      confusableWith: ["corgi", "hamster_praise"],
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
    },
    display: {
      uniqueTraits: [
        { trait: "正能量持久输出", description: "你的积极态度不是一时兴起，而是源于内在的稳定发电。即便在压力之下，你也能保持乐观，给予他人持续的鼓舞。" },
        { trait: "情绪恒温器", description: "遇事不慌，还能稳住别人。你拥有强大的自我调节能力，像一个恒温器一样维持着环境的心理安全感。" },
      ],
      xiaoyueFallback: {
        headline: "你不抢镜，但全场会跟着你稳下来",
        shareLine: "我是情绪稳定鸡型，不吵，但会把场子慢慢稳住。",
        stateLabel: "稳场推进型",
        analysis: "你是情绪稳定鸡型：情绪稳，正能量真，出了状况也不慌。别人焦虑的时候你那份稳，让整个场子缓下来。这种底气不是表演出来的，是刻在里头的。",
        socialRole: "你更像节奏稳定器，能把场子从散乱拉回舒服的推进感。",
        bestScene: "更适合有主题、能边聊边推进的饭局或桌游局。",
        microAction: "下次参加活动，先认领一个能稳节奏的小动作。",
      },
      shareVariants: {
        selfIntro: "我是情绪稳定鸡型，不吵，但会把场子慢慢稳住。",
        friendCallout: "认识我的人应该会懂，你不抢镜，但全场会跟着你稳下来。",
        socialInvite: "如果一起组局，我更适合有主题、能边聊边推进的饭局或桌游局，会比较容易进入状态。",
      },
    },
  },
  "hamster_praise": {
    id: "hamster_praise",
    name: "捧场王仓鼠",
    assetKey: "hamster_praise",
    profile: {
      traitProfile: { A: 95, C: 50, E: 65, O: 62, X: 82, P: 88 },
      energyLevel: 85,
      secondaryDifferentiators: {
        motivationDirection: 'external',
        conflictPosture: 'mediate',
        riskTolerance: 'medium',
        statusOrientation: 'supporter'
      },
      confusableWith: ["dolphin_calm", "rooster"],
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
    },
    display: {
      uniqueTraits: [
        { trait: "真诚赞美", description: "你的夸奖从不是客套的奉承，而是基于细致观察后的真心认可。这种真诚让你播撒的善意拥有真实的力量。" },
        { trait: "情感敏锐", description: "你总能敏锐地捕捉到别人被忽略的闪光点。通过你这面镜子，周围的人往往能看到一个更美好、更有价值的自己。" },
      ],
      xiaoyueFallback: {
        headline: "你不是场面话选手，你是真的会看见人",
        shareLine: "我是捧场王仓鼠型，看着温和，其实很会把关系聊热。",
        stateLabel: "熟了更有火花型",
        analysis: "你是捧场王仓鼠型：发现别人的好，然后真心说出来，不是客套。被你夸到的人，会记很久。这种看见人的能力，比多数社交技巧都稀缺。",
        socialRole: "你更像关系升温器，能把陌生感聊成舒服感。",
        bestScene: "更适合2到6人的局，能给彼此一点真实交流空间。",
        microAction: "下次遇到顺眼的人，先给一个具体的真诚反馈。",
      },
      shareVariants: {
        selfIntro: "我是捧场王仓鼠型，看着温和，其实很会把关系聊热。",
        friendCallout: "认识我的人应该会懂，你不是场面话选手，你是真的会看见人。",
        socialInvite: "如果一起组局，我更适合2到6人的局，会比较容易进入状态。",
      },
    },
  },
  "fox": {
    id: "fox",
    name: "探宝雷达狐",
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
      confusableWith: ["octopus"],
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
    },
    display: {
      uniqueTraits: [
        { trait: "创意脑洞", description: "你能把平凡的事物变得趣味横生，点子源源不断且不落俗套。你的存在让原本枯燥的聚会总能多出一份惊喜。" },
        { trait: "快速适应", description: "无论环境如何变化，你总能迅速找准定位并与不同背景的人接轨。这种灵活的认知切换让你在各种场合都能游刃有余。" },
      ],
      xiaoyueFallback: {
        headline: "你不靠硬聊破冰，你靠灵感把场子聊活",
        shareLine: "我是探宝雷达狐型，属于会把普通聊天聊出新鲜感的那种。",
        stateLabel: "灵感破冰型",
        analysis: "你是探宝雷达狐型：反应快，点子多，能在谈话里找到最有意思的角度。饭桌上那个率先提新方向的，通常是你。有时候话说快了，记得等一等慢半拍的人。",
        socialRole: "你更像话题点火器，能把普通聊天拐到更有意思的方向。",
        bestScene: "更适合有探索感的新局、主题活动或能交换想法的场子。",
        microAction: "下次开场先准备一个最近看到的有趣东西。",
      },
      shareVariants: {
        selfIntro: "我是探宝雷达狐型，属于会把普通聊天聊出新鲜感的那种。",
        friendCallout: "认识我的人应该会懂，你不靠硬聊破冰，你靠灵感把场子聊活。",
        socialInvite: "如果一起组局，我更适合有探索感的新局、主题活动或能交换想法的场子，会比较容易进入状态。",
      },
    },
  },
  "dolphin_calm": {
    id: "dolphin_calm",
    name: "读空气海豚",
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
      confusableWith: ["hamster_praise", "koala"],
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
    },
    display: {
      uniqueTraits: [
        { trait: "张弛有度", description: "你在热闹喧嚣与宁静独处之间自如切换。你懂得在社交中释放魅力，也懂得在安静中通过自我思考来沉淀和恢复。" },
        { trait: "情商在线", description: "你对社交分寸感的把握精准。你能在不冒犯他人的前提下表达真实见解，在人际网络中游走得既自在又得体。" },
      ],
      xiaoyueFallback: {
        headline: "你不是掉线型，你是先看气场再发力",
        shareLine: "我是读空气海豚型，习惯先看气场，再决定什么时候出手。",
        stateLabel: "低耗观察型",
        analysis: "你是读空气海豚型：情绪稳，读人准，在任何人群里都能找到自己的节奏。你那种淡定不是疏离，是心里有底。局里最让人放心的，往往是你这种人。",
        socialRole: "你更像安静观察者，关键时刻往往说到点上。",
        bestScene: "更适合3到6人的轻松聚会，或者先有共同话题的场景。",
        microAction: "下次别逼自己立刻热起来，先记住一个想继续聊的人。",
      },
      shareVariants: {
        selfIntro: "我是读空气海豚型，习惯先看气场，再决定什么时候出手。",
        friendCallout: "认识我的人应该会懂，你不是掉线型，你是先看气场再发力。",
        socialInvite: "如果一起组局，我更适合3到6人的轻松聚会，会比较容易进入状态。",
      },
    },
  },
  "spider": {
    id: "spider",
    name: "社交裁缝蛛",
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
      confusableWith: ["koala"],
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
    },
    display: {
      uniqueTraits: [
        { trait: "人脉连接", description: "你不仅是信息的汇聚点，更是人际关系的桥接者。你总能一眼看出谁和谁会碰撞出火花，并乐于成就他人的连接。" },
        { trait: "长情维护", description: "你珍视每一份关系，记得朋友们那些细碎的喜好与重要时刻。你的细水长流让关系网络不仅广阔，而且温润持久。" },
      ],
      xiaoyueFallback: {
        headline: "你不是社交用力派，你是把关系慢慢织起来",
        shareLine: "我是社交裁缝蛛型，更擅长让关系慢慢连起来，不是硬撑热闹。",
        stateLabel: "局内升温型",
        analysis: "你是社交裁缝蛛型：发现两个人应该认识，然后悄悄搭一座桥。撮合成功了你是最高兴的那个，也是最不显眼的那个。这种连接的眼光，不是所有人都有。",
        socialRole: "你更像连接器，擅长让对的人自然搭上线。",
        bestScene: "更适合有轮流交流空间的小局，而不是只顾抢话的大场子。",
        microAction: "下次进局先记下两个可能聊得来的人，再顺手搭一座桥。",
      },
      shareVariants: {
        selfIntro: "我是社交裁缝蛛型，更擅长让关系慢慢连起来，不是硬撑热闹。",
        friendCallout: "认识我的人应该会懂，你不是社交用力派，你是把关系慢慢织起来。",
        socialInvite: "如果一起组局，我更适合有轮流交流空间的小局，会比较容易进入状态。",
      },
    },
  },
  "koala": {
    id: "koala",
    name: "情绪树洞考拉",
    assetKey: "koala",
    profile: {
      traitProfile: { A: 90, C: 65, E: 80, O: 60, X: 48, P: 70 },
      energyLevel: 70,
      secondaryDifferentiators: {
        motivationDirection: 'internal',
        conflictPosture: 'avoid',
        riskTolerance: 'low',
        statusOrientation: 'supporter'
      },
      confusableWith: ["elephant", "spider"],
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
    },
    display: {
      uniqueTraits: [
        { trait: "主动关怀", description: "你拥有极强的共情能力，往往在对方开口之前就已感知其需求。这种无声的理解往往比任何言语都更具疗愈力。" },
        { trait: "安全感担当", description: "你温和且包容的特质让人不自觉地想要敞开心扉。在你面前，人们无需伪装，这种心理安全感是你给予他人最珍贵的礼物。" },
      ],
      xiaoyueFallback: {
        headline: "你不是慢，你只是只对对的人升温",
        shareLine: "我是情绪树洞考拉型，看着慢热，其实聊到点上就很能聊。",
        stateLabel: "慢热深聊型",
        analysis: "你是情绪树洞考拉型：别人说话你真的在听，不是在等自己开口。这种陪伴让人觉得被接住了，在社交里很稀缺。只是别忘了，你自己也需要被接住的时候。",
        socialRole: "你更像深聊引线，能让对方很快觉得被接住。",
        bestScene: "更适合2到4人的小局、饭后散步局或咖啡局。",
        microAction: "下次先和一个顺眼的人聊深两轮，不用急着全场营业。",
      },
      shareVariants: {
        selfIntro: "我是情绪树洞考拉型，看着慢热，其实聊到点上就很能聊。",
        friendCallout: "认识我的人应该会懂，你不是慢，你只是只对对的人升温。",
        socialInvite: "如果一起组局，我更适合2到4人的小局、饭后散步局或咖啡局，会比较容易进入状态。",
      },
    },
  },
  "octopus": {
    id: "octopus",
    name: "脑洞喷泉章鱼",
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
      confusableWith: ["fox", "owl"],
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
    },
    display: {
      uniqueTraits: [
        { trait: "跨界联想", description: "你的思维跳跃且广阔，能将互不相关的领域奇妙地联系起来。这种独特的跨界洞察力让你总能提供令人耳目一新的视角。" },
        { trait: "深度对话", description: "你厌倦浅尝辄止的社交，更倾心于直抵灵魂的深度交流。在这一对一的深谈中，你的智慧和深度总能带给对方深刻启发。" },
      ],
      xiaoyueFallback: {
        headline: "你不靠热闹存在，你靠脑洞让人记住",
        shareLine: "我是脑洞喷泉章鱼型，属于会把聊天聊出新方向的那种。",
        stateLabel: "灵感破冰型",
        analysis: "你是脑洞喷泉章鱼型：脑洞停不下来，能把八竿子打不着的东西串在一起，然后说一句让大家愣一下的话。这种跳跃性思维是创意的核心。如果有时候能把想法落地一下就更完整了。",
        socialRole: "你更像灵感点火器，总能把聊天拐到别人没想到的地方。",
        bestScene: "更适合主题活动、创意局，或能交换观点的小范围聚会。",
        microAction: "下次开场先抛一个你最近觉得有意思的问题。",
      },
      shareVariants: {
        selfIntro: "我是脑洞喷泉章鱼型，属于会把聊天聊出新方向的那种。",
        friendCallout: "认识我的人应该会懂，你不靠热闹存在，你靠脑洞让人记住。",
        socialInvite: "如果一起组局，我更适合主题活动、创意局，或能交换观点的小范围聚会，会比较容易进入状态。",
      },
    },
  },
  "owl": {
    id: "owl",
    name: "追问猫头鹰",
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
      confusableWith: ["turtle", "octopus"],
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
    },
    display: {
      uniqueTraits: [
        { trait: "观察敏锐", description: "你像是一个冷静的旁观者，那些被大多数人忽略的细节和底层逻辑都逃不过你的眼睛。这让你总能把握事物的本质。" },
        { trait: "一针见血", description: "你不喜欢废话，但每一次开口都直指核心。你的言语虽然不多，但分量十足，总能在关键时刻提供关键的决策参考。" },
      ],
      xiaoyueFallback: {
        headline: "你不是社交慢，你只是更擅长聊到点上",
        shareLine: "我是追问猫头鹰型，看着安静，其实聊到点上会很能聊。",
        stateLabel: "慢热深聊型",
        analysis: "你是追问猫头鹰型：大群体里你不一定最活跃，但你说出来的话往往比热闹了半天的人更准。观察、消化、再开口，这个节奏是你的强项，不是弱点。",
        socialRole: "你更像深聊引线，话不一定多，但往往最有记忆点。",
        bestScene: "更适合2到4人的小局、一对一深聊，或有明确主题的场景。",
        microAction: "下次只要提前准备一个你真想聊的问题就够了。",
      },
      shareVariants: {
        selfIntro: "我是追问猫头鹰型，看着安静，其实聊到点上会很能聊。",
        friendCallout: "认识我的人应该会懂，你不是社交慢，你只是更擅长聊到点上。",
        socialInvite: "如果一起组局，我更适合2到4人的小局、一对一深聊，或有明确主题的场景，会比较容易进入状态。",
      },
    },
  },
  "elephant": {
    id: "elephant",
    name: "定海神针大象",
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
      confusableWith: ["koala", "turtle"],
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
    },
    display: {
      uniqueTraits: [
        { trait: "稳定可靠", description: "你是团队中的定海神针，在混乱局面中依然能保持定力。这种基于实力的稳重，让你自然而然地成为大家的依赖。" },
        { trait: "责任担当", description: "你对承诺有着近乎偏执的坚守，言出必行是你的底色。这种极高的可预测性，构建了你无可替代的个人品牌信誉。" },
      ],
      xiaoyueFallback: {
        headline: "你不抢戏，但大家会因为你在而更安心",
        shareLine: "我是定海神针大象型，不吵，但会让场子先稳下来。",
        stateLabel: "稳场推进型",
        analysis: "你是定海神针大象型：出了状况你不乱，身边的人看见你在就先稳了三分。这种靠谱是从内到外的，不是刻意维持的。只是别把别人的事全扛到自己身上。",
        socialRole: "你更像局里的稳定器，能让大家更快进入舒服节奏。",
        bestScene: "更适合有一点主题、需要人稳住节奏的小局。",
        microAction: "下次参加活动，先认领一个能帮大家进入状态的小动作。",
      },
      shareVariants: {
        selfIntro: "我是定海神针大象型，不吵，但会让场子先稳下来。",
        friendCallout: "认识我的人应该会懂，你不抢戏，但大家会因为你在而更安心。",
        socialInvite: "如果一起组局，我更适合有一点主题、需要人稳住节奏的小局，会比较容易进入状态。",
      },
    },
  },
  "turtle": {
    id: "turtle",
    name: "慢半拍龟",
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
      confusableWith: ["owl", "cat"],
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
    },
    display: {
      uniqueTraits: [
        { trait: "看人准", description: "你从不急于对人下定论，而是通过长期的静默观察来过滤噪音。这种慢火烘焙出的洞察力，让你极少在重大判断上失误。" },
        { trait: "深度交往", description: "你的朋友圈可能不大，但每一段关系都历经考验且深厚无比。你更愿意把精力投入在那些值得深交一生的人身上。" },
      ],
      xiaoyueFallback: {
        headline: "你不是慢半拍，你是先判断再投入",
        shareLine: "我是慢半拍龟型，习惯先判断气场，再决定什么时候发力。",
        stateLabel: "低耗观察型",
        analysis: "你是慢半拍龟型：慢热，但认准了就是真的认准了。你那双看人的眼睛很准，不容易看走眼。这种判断力在人多的场合里其实是优势。",
        socialRole: "你更像安静观察者，一旦决定靠近就会很靠谱。",
        bestScene: "更适合允许留白的3到6人局，而不是一上来就很吵的场子。",
        microAction: "下次别要求自己立刻融入，先锁定一个值得继续聊的人。",
      },
      shareVariants: {
        selfIntro: "我是慢半拍龟型，习惯先判断气场，再决定什么时候发力。",
        friendCallout: "认识我的人应该会懂，你不是慢半拍，你是先判断再投入。",
        socialInvite: "如果一起组局，我更适合允许留白的3到6人局，会比较容易进入状态。",
      },
    },
  },
  "cat": {
    id: "cat",
    name: "静音模式猫",
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
      confusableWith: ["turtle"],
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
    },
    display: {
      uniqueTraits: [
        { trait: "独立自主", description: "你拥有一个丰盈且自洽的内心世界，不随波逐流。这种精神上的独立让你即便身处孤身，也能自得其乐且保持高昂的能量。" },
        { trait: "质量至上", description: "你对社交极度挑剔，坚持'无意义的社交不如高质量的独处'。这种对品质的坚持，确保了你生活中的每一份连接都是真实且有意义的。" },
      ],
      xiaoyueFallback: {
        headline: "你不是掉线型，你是先观察再发力",
        shareLine: "我是静音模式猫型，习惯先看气场，再决定什么时候出手。",
        stateLabel: "低耗观察型",
        analysis: "你是静音模式猫型：坐在那里不怎么说话，但其实全场最清楚谁是真有趣、谁在表演。人群让你耗电，但一对一你完全是另一个人。这种深度，多数人一辈子才遇到一两次。",
        socialRole: "你更像安静观察者，关键时刻往往能说到点上。",
        bestScene: "更适合一对一深聊，或节奏不吵、允许留白的小局。",
        microAction: "下次先记住一个你真正想继续聊的人，再顺着靠近。",
      },
      shareVariants: {
        selfIntro: "我是静音模式猫型，习惯先看气场，再决定什么时候出手。",
        friendCallout: "认识我的人应该会懂，你不是掉线型，你是先观察再发力。",
        socialInvite: "如果一起组局，我更适合一对一深聊，或节奏不吵、允许留白的小局，会比较容易进入状态。",
      },
    },
  }
};

// Helper functions
export function getArchetype(id: string): ArchetypeRecord | null {
  return archetypeRegistry[id as ArchetypeId] || null;
}

export function getAllArchetypeIds(): ArchetypeId[] {
  return Object.keys(archetypeRegistry) as ArchetypeId[];
}

export function getArchetypesByEnergyRange(min: number, max: number): ArchetypeId[] {
  return Object.entries(archetypeRegistry)
    .filter(([_, record]) => {
      const energy = record.profile.energyLevel;
      return energy >= min && energy <= max;
    })
    .map(([id]) => id as ArchetypeId);
}

export const archetypeCategories = {
  highEnergy: ["corgi", "rooster", "hamster_praise", "fox"],
  mediumEnergy: ["dolphin_calm", "spider", "koala", "octopus"],
  lowEnergy: ["owl", "elephant"],
  veryLowEnergy: ["turtle", "cat"],
};

// For backward compatibility with prototypes.ts
export function getArchetypePrototype(id: string): ArchetypeProfile | null {
  const record = archetypeRegistry[id as ArchetypeId];
  return record ? record.profile : null;
}

// For backward compatibility with archetypeInsights.ts
export function getArchetypeInsight(id: string): ArchetypeInsights | null {
  const record = archetypeRegistry[id as ArchetypeId];
  return record ? record.insights : null;
}

// For backward compatibility with archetypes.ts
export function getArchetypeNarrative(id: string): ArchetypeNarrative | null {
  const record = archetypeRegistry[id as ArchetypeId];
  return record ? record.narrative : null;
}

// Type exports
export type { TraitKey };
