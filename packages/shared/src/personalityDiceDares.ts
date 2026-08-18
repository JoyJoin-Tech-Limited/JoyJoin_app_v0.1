/**
 * Personality Dice v2 — Archetype-Specific Dare Bank
 *
 * 36 curated dares (3 per archetype).
 * Rules:
 *   - Reference archetype name/mascot for "that's so me" resonance
 *   - Slightly embarrassing but not exposing; safe for mixed company
 *   - Designed for screenshotting and sharing
 *   - No sensitive topics, no targeting other players
 *   - Every dare has a "pass" option with a funny consequence
 */

export type DareDifficulty = 'easy' | 'medium' | 'spicy';

export interface ArchetypeDare {
  /** Unique dare ID: `{archetype}_{index}` */
  id: string;
  /** Short title (displayed on dice roll) */
  title: string;
  /** Full dare text */
  body: string;
  /** Emoji for visual identity */
  emoji: string;
  /** Difficulty tier */
  difficulty: DareDifficulty;
  /** Graceful opt-out text */
  passLine: string;
  /** Funny consequence for passing */
  passConsequence: string;
}

/** 3 dares per archetype — easy → medium → spicy */
export const PERSONALITY_DICE_DARES: Record<string, ArchetypeDare[]> = {
  corgi: [
    {
      id: 'corgi_1',
      title: '摇尾破冰',
      body: '模仿你家柯基摇尾巴的样子，走到每个人面前说一句专属的"欢迎语"。',
      emoji: '🐕',
      difficulty: 'easy',
      passLine: '我选择做一只安静的柯基。',
      passConsequence: 'pass的人要学说三声"汪汪"，并且被拍下来。',
    },
    {
      id: 'corgi_2',
      title: '热场急救',
      body: '现场编一个关于在场某个人的" exaggerated 夸奖"（不能出现真实姓名，用代号）。',
      emoji: '🔥',
      difficulty: 'medium',
      passLine: '我今天尾巴没电了。',
      passConsequence: 'pass的人要接受大家轮流拍头说"乖"。',
    },
    {
      id: 'corgi_3',
      title: '全场对焦',
      body: '用手机自拍一段15秒的视频："我是今天的点火官，现在我要点燃_____（现场编一个搞笑的任务给下一个人）。"',
      emoji: '📸',
      difficulty: 'spicy',
      passLine: '我……我选择关机。',
      passConsequence: 'pass的人要被大家轮流说一个你"今天很像柯基"的瞬间。',
    },
  ],

  rooster: [
    {
      id: 'rooster_1',
      title: '小太阳播报',
      body: '用新闻联播的语气，播报一件你今天发生的"大事"（比如"今天喝了一杯奶茶"）。',
      emoji: '🌅',
      difficulty: 'easy',
      passLine: '今天太阳休假。',
      passConsequence: 'pass的人要接受大家给你取一个"阴天版"的外号。',
    },
    {
      id: 'rooster_2',
      title: '情绪天气预报',
      body: '给在场的每个人"播报"一个情绪天气（例如"张三：局部多云转笑"）。',
      emoji: '🌤️',
      difficulty: 'medium',
      passLine: '气象站故障中。',
      passConsequence: 'pass的人要被大家一起模仿"打鸣"一声。',
    },
    {
      id: 'rooster_3',
      title: '太阳过载',
      body: '连续30秒，对每一个人说一个你真心觉得ta"很赞"的点（不能重复）。',
      emoji: '☀️',
      difficulty: 'spicy',
      passLine: '太阳能不足，需要充电。',
      passConsequence: 'pass的人要被大家轮流说一句"其实你也很暖"的事实。',
    },
  ],

  hamster_praise: [
    {
      id: 'hamster_1',
      title: '鼓掌仪式',
      body: '为左边的人做一段"颁奖典礼式"的介绍，用三个夸张的褒义词。',
      emoji: '👏',
      difficulty: 'easy',
      passLine: '我今天的掌声余额不足。',
      passConsequence: 'pass的人要被所有人一起鼓掌十秒。',
    },
    {
      id: 'hamster_2',
      title: '夸夸弹幕',
      body: '用"弹幕"的形式，快速说出在场每个人一个隐藏优点（每人一条，不许重复）。',
      emoji: '💬',
      difficulty: 'medium',
      passLine: '我……我今天只想被夸。',
      passConsequence: 'pass的人要被大家轮流夸一个"连你自己都没发现"的优点。',
    },
    {
      id: 'hamster_3',
      title: '首席鼓掌官演讲',
      body: '站起来做一段"获奖感言"，主题是"我为什么配得上这个局的C位"（30秒，不许笑场）。',
      emoji: '🏆',
      difficulty: 'spicy',
      passLine: '麦克风故障。',
      passConsequence: 'pass的人要被大家一起说"你本来就在C位"十遍。',
    },
  ],

  fox: [
    {
      id: 'fox_1',
      title: '雷达扫描',
      body: '用"侦探推理"的语气，描述你进门时第一个注意到的一个细节。',
      emoji: '🕵️',
      difficulty: 'easy',
      passLine: '我的雷达今天没信号。',
      passConsequence: 'pass的人要被大家追问"你其实发现了什么但不说"。',
    },
    {
      id: 'fox_2',
      title: '巷口密报',
      body: '编一个"情报"：在场某个人今天一定做了某件有趣的事（不能是真的，要明显是编的）。',
      emoji: '📰',
      difficulty: 'medium',
      passLine: '机密文件锁在保险柜里。',
      passConsequence: 'pass的人要被大家每人编一个关于你的"假情报"。',
    },
    {
      id: 'fox_3',
      title: '真相只有一个',
      body: '模仿侦探指着一个人说："真相只有一个——你今天_____（编一个搞笑的秘密）！"',
      emoji: '🔍',
      difficulty: 'spicy',
      passLine: '此案过于复杂，我需要一杯奶茶。',
      passConsequence: 'pass的人要被大家一起模仿"狐狸嗅东西"的样子。',
    },
  ],

  dolphin_calm: [
    {
      id: 'dolphin_1',
      title: '气氛冲浪',
      body: '用"海浪"的动作（手波浪状），描述今天局里的"气氛起伏曲线"。',
      emoji: '🌊',
      difficulty: 'easy',
      passLine: '今天海面平静，不想冲浪。',
      passConsequence: 'pass的人要被大家一起"泼水"（空气泼水动作）。',
    },
    {
      id: 'dolphin_2',
      title: '读空气挑战',
      body: '说出在场一个人"此刻真正想说什么但还没说"的话（要善意，不能冒犯）。',
      emoji: '🧘',
      difficulty: 'medium',
      passLine: '空气太稀薄，我读不懂。',
      passConsequence: 'pass的人要被大家一起问"那你现在到底想说什么"。',
    },
    {
      id: 'dolphin_3',
      title: '气氛裁判',
      body: '给今天的"局"做一个公正裁判：宣布"最佳瞬间"、"最冷瞬间"和"最需要再来一次的瞬间"。',
      emoji: '⚖️',
      difficulty: 'spicy',
      passLine: '裁判需要中场休息。',
      passConsequence: 'pass的人要被大家轮流说一个"你让气氛变好"的瞬间。',
    },
  ],

  spider: [
    {
      id: 'spider_1',
      title: '织网连线',
      body: '用一句话，把在场两个人"连接"起来（例如"A和B都_____"，找共同点）。',
      emoji: '🕸️',
      difficulty: 'easy',
      passLine: '我的蜘蛛丝用完了。',
      passConsequence: 'pass的人要被大家一起说"我们帮你织"。',
    },
    {
      id: 'spider_2',
      title: '关系地图',
      body: '用"如果这是一个朋友圈"的方式，描述在场三个人的"关系定位"。',
      emoji: '🗺️',
      difficulty: 'medium',
      passLine: '地图加载中……',
      passConsequence: 'pass的人要被大家每人说一个"你和ta的关系关键词"。',
    },
    {
      id: 'spider_3',
      title: '社交裁缝',
      body: '现场牵线让两个人成为"今天最佳拍档"，用30秒编一个他们应该合作的理由。',
      emoji: '🧵',
      difficulty: 'spicy',
      passLine: '今天不营业。',
      passConsequence: 'pass的人要被大家一起说"那你和谁是最佳拍档"。',
    },
  ],

  koala: [
    {
      id: 'koala_1',
      title: '树洞开放',
      body: '分享一件"很小但让你今天心情变好的事"（不能是吃饭睡觉）。',
      emoji: '🌳',
      difficulty: 'easy',
      passLine: '树洞今天只进不出。',
      passConsequence: 'pass的人要被大家轮流问一个"温柔的问题"。',
    },
    {
      id: 'koala_2',
      title: '怀抱故事',
      body: '用"讲故事"的方式，描述你今天来的路上"可能遇到的一个路人"。',
      emoji: '🧸',
      difficulty: 'medium',
      passLine: '我的故事书合上了。',
      passConsequence: 'pass的人要被大家每人编一个"关于你的小故事"。',
    },
    {
      id: 'koala_3',
      title: '情绪树洞主',
      body: '接受在场每个人问你一个"有点深但不过分"的问题，你必须真诚回答（共3个，自愿停）。',
      emoji: '🕳️',
      difficulty: 'spicy',
      passLine: '树洞满了，请排队。',
      passConsequence: 'pass的人要被大家轮流说一个"我们觉得你很好"的理由。',
    },
  ],

  octopus: [
    {
      id: 'octopus_1',
      title: '脑洞喷墨',
      body: '用"如果……会怎样"的句式，编一个关于在场某个人的无厘头假设。',
      emoji: '🐙',
      difficulty: 'easy',
      passLine: '墨汁用完了，正在补充。',
      passConsequence: 'pass的人要被大家一起说一个"关于你的无厘头假设"。',
    },
    {
      id: 'octopus_2',
      title: '八爪并行',
      body: '同时做两件事：用左手比耶 + 用右手描述你今天的早餐。',
      emoji: '✌️',
      difficulty: 'medium',
      passLine: '触手打结了。',
      passConsequence: 'pass的人要被大家一起说"我们来帮你解开"。',
    },
    {
      id: 'octopus_3',
      title: '脑洞黑洞',
      body: '连续说出5个"如果我是一个物品"的比喻（每个都不能重复，要越来越离谱）。',
      emoji: '🌀',
      difficulty: 'spicy',
      passLine: '黑洞暂时关闭维护。',
      passConsequence: 'pass的人要被大家每人说一个"你像什么物品"。',
    },
  ],

  owl: [
    {
      id: 'owl_1',
      title: '推镜观察',
      body: '说出你今天注意到的"一个细节"（可以是任何东西，越细越好）。',
      emoji: '👓',
      difficulty: 'easy',
      passLine: '我的眼镜起雾了。',
      passConsequence: 'pass的人要被大家轮流说一个"你观察到了什么"。',
    },
    {
      id: 'owl_2',
      title: '追问三连',
      body: '向一个人连续问三个"为什么"（从一件小事开始追问，不能停）。',
      emoji: '❓',
      difficulty: 'medium',
      passLine: '今天不问问题，只给答案。',
      passConsequence: 'pass的人要被大家每人问你一个"为什么"。',
    },
    {
      id: 'owl_3',
      title: '猫头鹰审判',
      body: '用"法官"的语气，给今天局里的"一个现象"做出"判决"（例如"我判决：今天的笑声分贝超标"）。',
      emoji: '⚖️',
      difficulty: 'spicy',
      passLine: '法庭休庭。',
      passConsequence: 'pass的人要被大家一起说"我们判你有罪——罪名是太可爱了"。',
    },
  ],

  elephant: [
    {
      id: 'elephant_1',
      title: '定心一瞬',
      body: '用"大象的脚步"（缓慢、稳重）走到房间中央，说一句"今天的主题是_____"（现场编）。',
      emoji: '🐘',
      difficulty: 'easy',
      passLine: '大象今天想静静。',
      passConsequence: 'pass的人要被大家一起模仿"大象走路"到你面前。',
    },
    {
      id: 'elephant_2',
      title: '记忆锚点',
      body: '说出你今天记住的"一个关于某人的细节"（证明你认真听了）。',
      emoji: '⚓',
      difficulty: 'medium',
      passLine: '记忆库正在整理。',
      passConsequence: 'pass的人要被大家每人说一个"我们记住的关于你的细节"。',
    },
    {
      id: 'elephant_3',
      title: '象鼻定风波',
      body: '如果今天局里出现了"一个假想的危机"（比如奶茶洒了），演示你会怎么"定风波"。',
      emoji: '🌪️',
      difficulty: 'spicy',
      passLine: '定海神针需要抛光。',
      passConsequence: 'pass的人要被大家一起说"你稳定了我们的哪一刻"。',
    },
  ],

  turtle: [
    {
      id: 'turtle_1',
      title: '慢语真知',
      body: '用"慢动作"语速（至少2秒一个字），说出你今天学会的一个"道理"。',
      emoji: '🐢',
      difficulty: 'easy',
      passLine: '龟速模式已启动，不说话。',
      passConsequence: 'pass的人要被大家一起"慢动作"拍你的肩膀。',
    },
    {
      id: 'turtle_2',
      title: '龟壳防御',
      body: '说出一件你"表面上不在乎但其实挺在意"的小事（自愿程度，不强迫）。',
      emoji: '🛡️',
      difficulty: 'medium',
      passLine: '龟壳锁死了。',
      passConsequence: 'pass的人要被大家轮流说"我们在意你"。',
    },
    {
      id: 'turtle_3',
      title: '慢半拍主角',
      body: '用"延迟3秒反应"的方式，回应每个人的一个问题或玩笑（共3轮）。',
      emoji: '⏳',
      difficulty: 'spicy',
      passLine: '延迟过高，连接超时。',
      passConsequence: 'pass的人要被大家一起"延迟3秒"给你鼓掌。',
    },
  ],

  cat: [
    {
      id: 'cat_1',
      title: '静音观察',
      body: '用"猫的眼神"（缓慢眨眼），看着你左边的人，然后说一个你观察到的ta的"隐藏特质"。',
      emoji: '🐱',
      difficulty: 'easy',
      passLine: '猫今天不想睁眼。',
      passConsequence: 'pass的人要被大家一起"缓慢眨眼"看你。',
    },
    {
      id: 'cat_2',
      title: '优雅路过',
      body: '用"猫走路"的姿态（无声、优雅），绕场一周，并在某个人面前"蹭"一下（空气蹭）。',
      emoji: '🐈',
      difficulty: 'medium',
      passLine: '猫只想躺着。',
      passConsequence: 'pass的人要被大家一起"空气蹭"你一下。',
    },
    {
      id: 'cat_3',
      title: '喵语翻译',
      body: '用"猫的视角"，描述今天这个局里的"人类行为"（要搞笑，不能刻薄）。',
      emoji: '😺',
      difficulty: 'spicy',
      passLine: '猫语系统故障。',
      passConsequence: 'pass的人要被大家每人用"猫的方式"跟你互动一次。',
    },
  ],
};

/** Get 3 dares for a specific archetype */
export function getDaresForArchetype(archetypeId: string): ArchetypeDare[] {
  return PERSONALITY_DICE_DARES[archetypeId] ?? PERSONALITY_DICE_DARES['corgi'];
}

/** Get a single dare by archetype + difficulty, or random if not found */
export function getDareForArchetype(
  archetypeId: string,
  difficulty: DareDifficulty,
): ArchetypeDare {
  const dares = getDaresForArchetype(archetypeId);
  const match = dares.find((d) => d.difficulty === difficulty);
  if (match) return match;
  return dares[Math.floor(Math.random() * dares.length)];
}

/** Get a random dare from the full bank (used when archetype is unknown) */
export function getRandomDare(): ArchetypeDare {
  const all = Object.values(PERSONALITY_DICE_DARES).flat();
  return all[Math.floor(Math.random() * all.length)];
}

/** Validate that every archetype in the registry has 3 dares */
export function validateDareBank(registryArchetypes: string[]): {
  valid: boolean;
  missing: string[];
  counts: Record<string, number>;
} {
  const counts: Record<string, number> = {};
  const missing: string[] = [];

  for (const id of registryArchetypes) {
    const dares = PERSONALITY_DICE_DARES[id];
    const count = dares?.length ?? 0;
    counts[id] = count;
    if (count !== 3) {
      missing.push(id);
    }
  }

  return { valid: missing.length === 0, missing, counts };
}
