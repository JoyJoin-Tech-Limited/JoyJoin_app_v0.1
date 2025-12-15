export interface IcebreakerGame {
  id: string;
  name: string;
  description: string;
  category: 'quick' | 'creative' | 'deep' | 'active';
  scene: 'dinner' | 'bar' | 'both';
  minPlayers: number;
  maxPlayers: number;
  duration: string;
  difficulty: 'easy' | 'medium' | 'hard';
  rules: string[];
  tips?: string[];
  drinkingWarning?: string;
}

export const icebreakerGames: IcebreakerGame[] = [
  {
    id: 'two-truths-one-lie',
    name: '两真一假',
    description: '每人说三件关于自己的事，其中一件是假的，大家猜哪个是假的',
    category: 'quick',
    scene: 'both',
    minPlayers: 4,
    maxPlayers: 6,
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
    id: 'would-you-rather',
    name: '你会选择...',
    description: '在两个有趣的选项中做选择，并分享理由',
    category: 'quick',
    scene: 'both',
    minPlayers: 4,
    maxPlayers: 6,
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
    description: '一起创作一个故事，每人接一句，适合创意型朋友',
    category: 'creative',
    scene: 'dinner',
    minPlayers: 4,
    maxPlayers: 6,
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
    scene: 'both',
    minPlayers: 4,
    maxPlayers: 6,
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
    description: '分享一个你持有的"少数派"观点，适合深度交流',
    category: 'deep',
    scene: 'bar',
    minPlayers: 4,
    maxPlayers: 6,
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
    description: '分享最近的一个开心时刻和一个小挑战，真诚分享',
    category: 'deep',
    scene: 'dinner',
    minPlayers: 4,
    maxPlayers: 6,
    duration: '15-20分钟',
    difficulty: 'easy',
    rules: [
      '每人分享最近一周/一月的一个"高光"时刻',
      '再分享一个"低谷"或小挑战',
      '其他人可以给予回应或共鸣',
    ],
  },
  {
    id: 'homophone-chain',
    name: '谐音梗接龙',
    description: '用谐音词来接龙，笑点满满',
    category: 'quick',
    scene: 'dinner',
    minPlayers: 4,
    maxPlayers: 6,
    duration: '5-10分钟',
    difficulty: 'easy',
    rules: [
      '第一人说出一个词或短语',
      '下一个人用谐音说出一个新词',
      '例如："不想上班" → "布香尚班"',
      '说不出来或重复的人出局',
      '最后留下的人获胜',
    ],
    tips: [
      '可以用网络流行梗作为开头',
      '允许方言谐音增加趣味性',
    ],
  },
  {
    id: 'most-likely-to',
    name: '最xxx的人',
    description: '"在座谁最可能..."投票游戏',
    category: 'quick',
    scene: 'dinner',
    minPlayers: 4,
    maxPlayers: 6,
    duration: '10-15分钟',
    difficulty: 'easy',
    rules: [
      '主持人提出一个问题，如"在座谁最可能成为百万富翁"',
      '大家同时指向自己认为的那个人',
      '被指最多的人可以解释或反驳',
      '轮流当主持人提问',
    ],
    tips: [
      '问题可以轻松有趣，如"谁最可能忘带钥匙"',
      '避免太尖锐或冒犯性的问题',
    ],
  },
  {
    id: 'if-i-were',
    name: '如果我是...',
    description: '假设性问题，激发想象力',
    category: 'creative',
    scene: 'dinner',
    minPlayers: 4,
    maxPlayers: 6,
    duration: '10-15分钟',
    difficulty: 'easy',
    rules: [
      '主持人提出假设性问题，如"如果你是一种动物，你会是什么？"',
      '每人回答并解释理由',
      '其他人可以提问或评论',
      '轮流出题',
    ],
    tips: [
      '问题示例：如果你能穿越时空、如果你中了彩票',
      '鼓励有创意的回答',
    ],
  },
  {
    id: 'spy-game',
    name: '谁是卧底',
    description: '经典推理游戏，找出拿到不同词的卧底',
    category: 'active',
    scene: 'bar',
    minPlayers: 4,
    maxPlayers: 6,
    duration: '15-20分钟',
    difficulty: 'medium',
    rules: [
      '随机分配词语，大部分人拿到相同的词，一人拿到相似但不同的词（卧底）',
      '每人轮流用一个词描述自己拿到的词',
      '描述后投票选出疑似卧底',
      '被投出的人亮出身份，如果是卧底则平民胜，否则继续',
      '卧底存活到最后两人则卧底获胜',
    ],
    tips: [
      '描述时要既不太明显也不太模糊',
      '仔细观察别人的反应找线索',
    ],
  },
  {
    id: 'kings-game',
    name: '国王游戏',
    description: '抽牌指派任务的经典酒局游戏，国王可能点到自己！',
    category: 'active',
    scene: 'bar',
    minPlayers: 4,
    maxPlayers: 6,
    duration: '15-25分钟',
    difficulty: 'medium',
    rules: [
      'N人游戏，共N+1张牌（1-N号 + 国王牌）',
      '每人抽一张牌，只能看自己的牌',
      '抽到国王牌的人亮牌成为"国王"',
      '剩下的一张牌是国王的"神秘号码"（国王不能看）',
      '国王发号施令："X号做XXX"',
      '如果X号刚好是神秘牌，国王自己执行任务！',
    ],
    tips: [
      '任务可以轻松有趣，避免太为难人',
      '悬念在于国王不知道自己的号码，可能点到自己',
    ],
    drinkingWarning: '这个游戏可能会让大家喝比较多哦～记得量力而行，开心最重要！',
  },
  {
    id: 'number-bomb',
    name: '数字炸弹',
    description: '猜数字，踩到"炸弹"的人喝酒',
    category: 'quick',
    scene: 'bar',
    minPlayers: 4,
    maxPlayers: 6,
    duration: '10-15分钟',
    difficulty: 'easy',
    rules: [
      '主持人心里想一个1-100之间的数字（炸弹）',
      '玩家轮流猜一个数字',
      '主持人告诉玩家是"大了"还是"小了"，缩小范围',
      '猜中炸弹数字的人喝酒',
      '换人当主持人继续',
    ],
    tips: [
      '可以增加难度，如"三的倍数不能说"',
      '范围可以根据人数调整',
    ],
    drinkingWarning: '这个游戏可能会让大家喝比较多哦～记得量力而行，开心最重要！',
  },
  {
    id: 'mind-link',
    name: '心有灵犀',
    description: '两人同时说答案，看默契程度',
    category: 'quick',
    scene: 'bar',
    minPlayers: 4,
    maxPlayers: 6,
    duration: '10-15分钟',
    difficulty: 'easy',
    rules: [
      '主持人提出一个问题，如"说一种水果"',
      '两名玩家同时喊出答案',
      '如果答案相同，两人都安全',
      '如果答案不同，两人都喝酒',
      '轮流换人配对',
    ],
    tips: [
      '问题可以越来越具体增加难度',
      '可以指定特定搭档增加互动',
    ],
  },
];

export const gameCategories = {
  quick: { label: '快速破冰', description: '5-10分钟的快速游戏' },
  creative: { label: '创意游戏', description: '发挥想象力的游戏' },
  deep: { label: '深度交流', description: '促进深入了解的活动' },
  active: { label: '活力互动', description: '需要更多互动的游戏' },
};

export const sceneLabels = {
  dinner: { label: '饭局', description: '适合正餐聚会' },
  bar: { label: '酒局', description: '适合酒吧/夜场' },
  both: { label: '通用', description: '各种场合都适合' },
};

export function getGamesByCategory(category: IcebreakerGame['category']): IcebreakerGame[] {
  return icebreakerGames.filter(g => g.category === category);
}

export function getGamesByScene(scene: IcebreakerGame['scene']): IcebreakerGame[] {
  return icebreakerGames.filter(g => g.scene === scene || g.scene === 'both');
}

export function getRandomGame(): IcebreakerGame {
  return icebreakerGames[Math.floor(Math.random() * icebreakerGames.length)];
}

export function getRandomGameByCategory(category: IcebreakerGame['category']): IcebreakerGame | null {
  const games = getGamesByCategory(category);
  if (games.length === 0) return null;
  return games[Math.floor(Math.random() * games.length)];
}

export function getRandomGameByScene(scene: IcebreakerGame['scene']): IcebreakerGame | null {
  const games = getGamesByScene(scene);
  if (games.length === 0) return null;
  return games[Math.floor(Math.random() * games.length)];
}
