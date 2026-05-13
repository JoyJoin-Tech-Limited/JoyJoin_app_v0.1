export interface EmbeddingTriplet {
  anchor: string;
  positive: string;
  negative: string;
  domain: string;
}

const TRIPLETS: EmbeddingTriplet[] = [
  // ── Lifestyle / interests ──
  {
    anchor: '喜欢安静的咖啡馆，周末看书',
    positive: '爱泡独立咖啡馆，周末读书和写作',
    negative: '热爱户外运动，攀岩和马拉松',
    domain: 'lifestyle',
  },
  {
    anchor: '周末不是在烤箱前就是在山里。期待在JoyJoin遇到真实的人。',
    positive: '喜欢烘焙和户外徒步，寻找一起探索城市和自然的朋友',
    negative: '游戏宅，周末打DOTA和吃鸡，社交太累了',
    domain: 'lifestyle',
  },
  {
    anchor: '上海外企设计师，爱好摄影和citywalk。喜欢发现隐藏在巷子里的小店',
    positive: '北京创意行业，喜欢街拍和城市探索，周末逛胡同和独立书店',
    negative: '深圳程序员，996写代码，周末只想睡觉打游戏',
    domain: 'lifestyle',
  },
  {
    anchor: 'Top interests: 烘焙, 瑜伽, 读书会, 露营',
    positive: '喜欢做甜点，每周去瑜伽课，周末和朋友去露营',
    negative: 'Top interests: 电竞, 炒股, 健身, 喝酒',
    domain: 'interests',
  },
  {
    anchor: 'Social tag: 温柔倾听者',
    positive: 'Social tag: 温暖陪伴者',
    negative: 'Social tag: 社交恐怖分子',
    domain: 'social-tag',
  },

  // ── Career / industry ──
  {
    anchor: '北京互联网行业产品经理，周末喜欢剧本杀和飞盘',
    positive: '深圳互联网产品运营，周末玩桌游和飞盘局',
    negative: '体制内公务员，周末喝茶钓鱼逛公园',
    domain: 'career',
  },
  {
    anchor: '深圳创业中，做AI方向。Deep interests: 机器学习, 量化交易',
    positive: 'AI工程师，关注LLM和NLP方向，对技术产品化感兴趣',
    negative: '幼儿园老师，喜欢小朋友和手工，周末做烘焙',
    domain: 'career',
  },
  {
    anchor: '杭州电商运营，业余时间在做自己的饰品品牌',
    positive: '上海时尚行业买手，业余经营自己的设计师品牌',
    negative: '工厂流水线管理，对时尚没兴趣',
    domain: 'career',
  },

  // ── Archetype / personality ──
  {
    anchor: '我是开心柯基，喜欢热闹和社交，周末组局组织活动',
    positive: '太阳鸡性格，热情开朗，喜欢成为聚会焦点',
    negative: '慵懒猫人格，享受独处，社交消耗能量',
    domain: 'archetype',
  },
  {
    anchor: '孤狼型人格，深度思考，更喜欢一对一的深度对话',
    positive: '喜欢小圈子的深度交流，四五个人聊人生最舒服',
    negative: '派对动物，人越多越兴奋，大型社交场合充电',
    domain: 'archetype',
  },

  // ── Intent ──
  {
    anchor: '寻找能一起逛展、喝咖啡、聊人生的朋友',
    positive: '找每周可以一起看展喝咖啡深度交流的搭子',
    negative: '找对象，奔着结婚去的那种',
    domain: 'intent',
  },
  {
    anchor: '想认识有趣的灵魂，拓宽社交圈',
    positive: '来JoyJoin是为了认识新朋友，拓宽自己的社交圈子',
    negative: '只想找同行业的人脉，职业 networking',
    domain: 'intent',
  },

  // ── Deep interests ──
  {
    anchor: 'Deep interests: 独立音乐, 胶片摄影, vintage文化',
    positive: '喜欢独立厂牌和黑胶唱片，玩胶片相机，逛古着店',
    negative: 'Deep interests: 量化交易, 区块链, 商业分析',
    domain: 'deep-interest',
  },
  {
    anchor: 'Deep interests: 精酿啤酒, 攀岩, 摩托车',
    positive: '周末去精酿酒吧探店，定期去岩馆，骑摩托跑山',
    negative: 'Deep interests: 茶道, 书法, 围棋',
    domain: 'deep-interest',
  },

  // ── Mixed zh/en ──
  {
    anchor: 'A tech enthusiast living in Shanghai, passionate about cross-cultural communication',
    positive: 'Tech industry professional in Shanghai, enjoys international social events',
    negative: '上海本地阿姨，喜欢跳广场舞和买菜',
    domain: 'bilingual',
  },
  {
    anchor: 'Love travel and food. Social tag: curious explorer',
    positive: 'Passionate about traveling and trying local cuisines around the world',
    negative: '宅家看剧，外卖度日，最远距离是去楼下便利店',
    domain: 'bilingual',
  },

  // ── Bio nuance ──
  {
    anchor: '喜欢把轻松聊天聊出层次感',
    positive: '享受有深度的对话，轻松的话题也能聊出内容',
    negative: '就爱瞎聊，啥话题都能扯但从不深入',
    domain: 'bio-nuance',
  },
  {
    anchor: '温柔但不无聊，有趣但不浮夸',
    positive: '温和但有主见，幽默但不喧闹',
    negative: '沉闷不说话，或者太吵停不下来',
    domain: 'bio-nuance',
  },
];

export function getAllTriplets(): EmbeddingTriplet[] {
  return TRIPLETS;
}

export function getTripletsByDomain(domain: string): EmbeddingTriplet[] {
  return TRIPLETS.filter((t) => t.domain === domain);
}

export function getDomainSummary(): Record<string, number> {
  const summary: Record<string, number> = {};
  for (const t of TRIPLETS) {
    summary[t.domain] = (summary[t.domain] || 0) + 1;
  }
  return summary;
}
