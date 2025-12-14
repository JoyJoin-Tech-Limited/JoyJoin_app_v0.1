export interface IcebreakerGame {
  id: string;
  name: string;
  description: string;
  category: 'quick' | 'creative' | 'deep' | 'active';
  minPlayers: number;
  maxPlayers: number;
  duration: string;
  difficulty: 'easy' | 'medium' | 'hard';
  rules: string[];
  tips?: string[];
}

export const icebreakerGames: IcebreakerGame[] = [
  {
    id: 'two-truths-one-lie',
    name: '两真一假',
    description: '每人说三件关于自己的事，其中一件是假的，大家猜哪个是假的',
    category: 'quick',
    minPlayers: 3,
    maxPlayers: 12,
    duration: '10-15分钟',
    difficulty: 'easy',
    rules: [
      '每人轮流说出三件关于自己的事情',
      '其中两件是真的，一件是编造的',
      '其他人一起猜测哪件是假的',
      '揭晓答案后，可以分享真实故事的背景',
    ],
    tips: [
      '编造的事情可以是"听起来不太可能但其实是真的"风格',
      '真实的事情可以选择一些出人意料的经历',
    ],
  },
  {
    id: 'word-association',
    name: '词语接龙',
    description: '快速反应游戏，说出与前一个词相关的词',
    category: 'quick',
    minPlayers: 3,
    maxPlayers: 10,
    duration: '5-10分钟',
    difficulty: 'easy',
    rules: [
      '主持人说出第一个词',
      '下一个人在3秒内说出相关的词',
      '依次循环，不能重复已说过的词',
      '超时或重复的人出局',
    ],
  },
  {
    id: 'would-you-rather',
    name: '你会选择...',
    description: '在两个有趣的选项中做选择，并分享理由',
    category: 'quick',
    minPlayers: 2,
    maxPlayers: 15,
    duration: '10-20分钟',
    difficulty: 'easy',
    rules: [
      '主持人提出"你会选择A还是B"的问题',
      '每个人选择一个答案',
      '选择相同的人可以交流为什么这么选',
      '选择不同的人可以"辩论"一下',
    ],
  },
  {
    id: 'story-chain',
    name: '故事接龙',
    description: '一起创作一个故事，每人接一句',
    category: 'creative',
    minPlayers: 4,
    maxPlayers: 10,
    duration: '10-15分钟',
    difficulty: 'medium',
    rules: [
      '第一人说出故事的开头',
      '每人接着说一到两句',
      '必须与前文逻辑连贯',
      '最后一人需要给故事一个结尾',
    ],
    tips: [
      '可以限定一个主题，如"未来旅行"',
      '故事走向可以很脑洞',
    ],
  },
  {
    id: 'describe-and-guess',
    name: '我说你猜',
    description: '用语言描述一个词，让队友猜出来',
    category: 'active',
    minPlayers: 4,
    maxPlayers: 12,
    duration: '15-20分钟',
    difficulty: 'medium',
    rules: [
      '分成两组',
      '描述者看到词后用语言描述',
      '不能说出词里的字',
      '队友在规定时间内猜词',
      '猜对越多的队获胜',
    ],
  },
  {
    id: 'unpopular-opinions',
    name: '小众观点',
    description: '分享一个你持有的"少数派"观点',
    category: 'deep',
    minPlayers: 3,
    maxPlayers: 8,
    duration: '15-25分钟',
    difficulty: 'medium',
    rules: [
      '每人分享一个自己持有但可能不太主流的观点',
      '其他人可以提问了解更多',
      '重点是理解而非说服',
      '保持开放和尊重的态度',
    ],
    tips: [
      '可以是关于生活方式、工作习惯等轻松话题',
      '避免太敏感的政治或宗教话题',
    ],
  },
  {
    id: 'highs-and-lows',
    name: '高光与低谷',
    description: '分享最近的一个开心时刻和一个小挑战',
    category: 'deep',
    minPlayers: 3,
    maxPlayers: 8,
    duration: '15-20分钟',
    difficulty: 'easy',
    rules: [
      '每人分享最近一周/一月的一个"高光"时刻',
      '再分享一个"低谷"或小挑战',
      '其他人可以给予回应或共鸣',
    ],
  },
  {
    id: 'speed-networking',
    name: '快速交流',
    description: '两两配对，快速交流后换人',
    category: 'active',
    minPlayers: 4,
    maxPlayers: 20,
    duration: '15-25分钟',
    difficulty: 'easy',
    rules: [
      '两两配对进行2-3分钟的对话',
      '可以用提供的话题引导',
      '时间到后换一个搭档',
      '确保每个人都和不同的人聊过',
    ],
  },
];

export const gameCategories = {
  quick: { label: '快速破冰', icon: '⚡', description: '5-10分钟的快速游戏' },
  creative: { label: '创意游戏', icon: '🎨', description: '发挥想象力的游戏' },
  deep: { label: '深度交流', icon: '💬', description: '促进深入了解的活动' },
  active: { label: '活力互动', icon: '🎯', description: '需要更多互动的游戏' },
};

export function getGamesByCategory(category: IcebreakerGame['category']): IcebreakerGame[] {
  return icebreakerGames.filter(g => g.category === category);
}

export function getRandomGame(): IcebreakerGame {
  return icebreakerGames[Math.floor(Math.random() * icebreakerGames.length)];
}

export function getRandomGameByCategory(category: IcebreakerGame['category']): IcebreakerGame | null {
  const games = getGamesByCategory(category);
  if (games.length === 0) return null;
  return games[Math.floor(Math.random() * games.length)];
}
