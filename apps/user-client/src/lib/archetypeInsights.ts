/**
 * Counter-intuitive insights and scenario simulations for each archetype
 * Designed to create "Barnum effect" - surprising yet relatable revelations
 */

export interface ArchetypeInsight {
  counterIntuitive: string; // "你可能不知道的自己" - surprising self-discovery
  scenarioSimulation: string; // "当你在饭局遇到..." - situational prediction
  rarityPercentage: number; // Approximate rarity (lower = rarer)
  hiddenStrength: string; // A strength they may not realize
  xiaoyueComment: string; // Dynamic comment based on archetype
}

export const archetypeInsights: Record<string, ArchetypeInsight> = {
  "开心柯基": {
    counterIntuitive: "你看起来永远充满活力，但其实你也有需要独处充电的时刻。你的热情不是无限的，它来自于你真心想让每个人都开心。",
    scenarioSimulation: "当饭局突然冷场时，你会下意识地抛出一个话题或笑话来救场，即使你自己其实也不太有话题。这是你的本能反应，不是刻意为之。",
    rarityPercentage: 12,
    hiddenStrength: "你比想象中更善于察言观色，只是你选择用积极的方式回应。",
    xiaoyueComment: "柯基同学！你的快乐是真的会传染的那种~"
  },
  "太阳鸡": {
    counterIntuitive: "你稳定的正能量让人觉得你从不焦虑，但实际上你只是更擅长消化负面情绪。你的乐观是选择，不是天生。",
    scenarioSimulation: "当有人在饭局上抱怨时，你会不自觉地想办法给话题一个积极的转折，但同时你内心也在共情对方的困扰。",
    rarityPercentage: 9,
    hiddenStrength: "你的情绪稳定性其实是后天修炼的结果，这让你成为团队的定海神针。",
    xiaoyueComment: "太阳鸡！你是我见过最暖的存在，真的~"
  },
  "夸夸豚": {
    counterIntuitive: "你总是在夸别人，但你自己其实很少被夸。你给予的赞美是真心的，但你对自己的评价往往比对别人严格得多。",
    scenarioSimulation: "当有人分享成就时，你会第一个鼓掌叫好。但当轮到自己分享时，你可能会下意识地淡化自己的成绩。",
    rarityPercentage: 11,
    hiddenStrength: "你的真诚赞美能力是稀缺资源，很多人说不出口的好话你说得自然。",
    xiaoyueComment: "夸夸豚！你的掌声是最珍贵的礼物呀~"
  },
  "机智狐": {
    counterIntuitive: "你看起来总有新奇的想法，但其实你也会担心自己的提议太冒险。你的勇于尝试背后，是对无聊生活的深深恐惧。",
    scenarioSimulation: "当大家在纠结去哪儿吃时，你会突然提议一个意想不到的地方，然后内心忐忑地等待大家的反应。",
    rarityPercentage: 8,
    hiddenStrength: "你的信息敏感度极高，总能在对话中捕捉到别人忽略的有趣细节。",
    xiaoyueComment: "机智狐！你的脑洞是聚会的宝藏~"
  },
  "淡定海豚": {
    counterIntuitive: "你看起来总是云淡风轻，但你其实一直在暗中观察和计算最佳干预时机。你的淡定不是冷漠，是高段位的情商。",
    scenarioSimulation: "当两个人观点对立时，你会在脑中快速评估局势，然后用一句轻描淡写的话化解紧张，让双方都觉得是自己想通了。",
    rarityPercentage: 7,
    hiddenStrength: "你是天生的调停者，很多矛盾被你化解于无形之中，甚至当事人都不知道。",
    xiaoyueComment: "海豚同学！你的高情商是隐藏技能~"
  },
  "织网蛛": {
    counterIntuitive: "你喜欢连接人，但你自己其实更享受观察者的位置。你编织关系网不是为了社交资本，而是真的觉得看到人与人连接很有成就感。",
    scenarioSimulation: "在饭局上你会敏锐地发现两个陌生人有共同爱好，然后不动声色地把话题引向那个方向，让他们自己发现彼此。",
    rarityPercentage: 6,
    hiddenStrength: "你的记忆力和关联能力超强，能记住每个人说过的小细节。",
    xiaoyueComment: "织网蛛！你是人际关系的魔法师~"
  },
  "暖心熊": {
    counterIntuitive: "你是最好的倾听者，但你很少有机会被人认真倾听。你习惯了承接他人的情绪，却不太会表达自己的需求。",
    scenarioSimulation: "当有人在饭局上开始倾诉时，你会自然地调整坐姿，给予专注的眼神和适时的回应，让对方感到被完全理解。",
    rarityPercentage: 10,
    hiddenStrength: "你的共情能力让人愿意敞开心扉，这是很多人羡慕但学不会的天赋。",
    xiaoyueComment: "暖心熊！你的拥抱是世界上最温暖的~"
  },
  "灵感章鱼": {
    counterIntuitive: "你的脑洞天马行空，但你其实很在意别人对你想法的评价。每次抛出创意前，你都在心里做好了被当成怪人的准备。",
    scenarioSimulation: "当话题变得无聊时，你会突然把两个完全不相关的概念联系起来，然后期待地看着大家的反应。",
    rarityPercentage: 5,
    hiddenStrength: "你的联想能力是创意工作的核心技能，很多人终其一生也学不会。",
    xiaoyueComment: "灵感章鱼！你的脑洞是无价之宝~"
  },
  "沉思猫头鹰": {
    counterIntuitive: "你看起来严肃深沉，但你其实也有想融入热闹的时刻。只是你更擅长深度对话，小聊天让你感到无所适从。",
    scenarioSimulation: "当大家聊得热火朝天时，你会在心里整理思路，等待一个合适的时机抛出你深思熟虑的观点。",
    rarityPercentage: 8,
    hiddenStrength: "你的洞察力能看穿表象，一针见血的点评往往让人恍然大悟。",
    xiaoyueComment: "猫头鹰同学！你的智慧是聚会的点睛之笔~"
  },
  "定心大象": {
    counterIntuitive: "你给人稳如泰山的感觉，但你内心其实也会焦虑。只是你更愿意把不安藏起来，让别人能安心依靠你。",
    scenarioSimulation: "当聚会出现意外状况时，你会自然地成为那个出主意、做决定的人，即使你自己也不确定这是最好的方案。",
    rarityPercentage: 7,
    hiddenStrength: "你的存在本身就给人安全感，这是领导力的核心要素。",
    xiaoyueComment: "定心大象！有你在大家都安心~"
  },
  "稳如龟": {
    counterIntuitive: "你看起来慢热，但一旦认定一个人，你会是最忠诚的朋友。你的慢不是冷漠，是在认真评估这段关系值不值得投入。",
    scenarioSimulation: "在饭局上你会安静观察每个人，心里默默给他们分类，决定哪些人值得进一步了解。",
    rarityPercentage: 9,
    hiddenStrength: "你的判断力极准，你看人的眼光很少出错。",
    xiaoyueComment: "稳如龟！你的友谊是最珍贵的~"
  },
  "隐身猫": {
    counterIntuitive: "你习惯躲在人群边缘，但你观察到的细节比任何人都多。你不是不想社交，只是大群体的社交让你消耗太大。",
    scenarioSimulation: "在热闹的饭局上，你会找一个安静的角落，和一两个人进行深度交谈，这种一对一的互动让你更自在。",
    rarityPercentage: 15,
    hiddenStrength: "你的观察力和深度交流能力，让你在小范围社交中极具魅力。",
    xiaoyueComment: "隐身猫！你的安静也是一种力量~"
  },
};

/**
 * Get insights for a specific archetype
 */
export function getArchetypeInsight(archetype: string): ArchetypeInsight | null {
  return archetypeInsights[archetype] || null;
}

/**
 * Get a random insight preview (for teaser purposes)
 */
export function getInsightPreview(archetype: string): string | null {
  const insight = archetypeInsights[archetype];
  if (!insight) return null;
  
  // Return first half of counter-intuitive insight as teaser
  const fullText = insight.counterIntuitive;
  const halfLength = Math.floor(fullText.length / 2);
  return fullText.substring(0, halfLength) + "...";
}
