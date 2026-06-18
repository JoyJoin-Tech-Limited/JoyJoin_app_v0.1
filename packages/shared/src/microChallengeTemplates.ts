/**
 * Micro-Challenge Template Catalog & Deterministic Selector
 *
 * Server-owned, typed template system for the micro_challenge phase.
 * Design goals:
 *   - Deterministic eligibility (no hidden AI improvisation)
 *   - Weighted top-k seeded sampling (reproducible)
 *   - Explicit soft wow modifiers (auditable delight)
 *
 * The catalog is the source of truth. AI may apply "wow overlays" to
 * selected templates, but the selection itself is deterministic.
 */

import type { MicroChallenge } from './socialIcebreaker';

export type MicroChallengeCategory = 'quick' | 'creative' | 'deep' | 'active';
export type MicroChallengeScene = 'dinner' | 'bar' | 'both';
export type MicroChallengeEnergy = 'low' | 'medium' | 'high';

export interface MicroChallengeTemplate extends MicroChallenge {
  category: MicroChallengeCategory;
  scene: MicroChallengeScene;
  minPlayers: number;
  maxPlayers: number;
  energyLevel: MicroChallengeEnergy;
  /** Which atmosphere moods this template naturally fits. */
  moodFit: Array<'relaxed' | 'funny' | 'life' | 'emotional'>;
  /** Base sampling weight (0–1). Higher = more likely to be picked. */
  baseWeight: number;
  /** Optional alternative CTAs for wow-modifier rotation. */
  altCTAs?: string[];
  /** Optional variant descriptions for wow-modifier rotation. */
  altDescriptions?: string[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sfc32(a: number, b: number, c: number, d: number) {
  return function () {
    a >>>= 0;
    b >>>= 0;
    c >>>= 0;
    d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

/** Create a deterministic PRNG from a seed string. */
export function createSeededRandom(seed: string): () => number {
  let h1 = 1779033703,
    h2 = 3144134277,
    h3 = 1013904242,
    h4 = 2773480762;
  for (let i = 0; i < seed.length; i++) {
    const k = seed.charCodeAt(i);
    h1 = (h1 ^ k) | 0;
    h2 = (h2 ^ k) | 0;
    h3 = (h3 ^ k) | 0;
    h4 = (h4 ^ k) | 0;
  }
  return sfc32(h1, h2, h3, h4);
}

// ─── Catalog ─────────────────────────────────────────────────────────────────

export const MICRO_CHALLENGE_TEMPLATES: MicroChallengeTemplate[] = [
  {
    id: 'c1-common-ground',
    title: '找3个共同点',
    description: '在座所有人一起找出3个共同的爱好或经历，可以是任何意想不到的小事。',
    durationSeconds: 180,
    completionCTA: '找到了！',
    visualHint: '🔍🤝',
    category: 'quick',
    scene: 'both',
    minPlayers: 3,
    maxPlayers: 8,
    energyLevel: 'low',
    moodFit: ['relaxed', 'life'],
    baseWeight: 1.0,
    altCTAs: ['搞定！', '发现共同点！'],
    altDescriptions: ['在座所有人一起找出3个共同的爱好或经历，越具体越好。'],
  },
  {
    id: 'c2-three-words',
    title: '用3个词形容彼此',
    description: '每人用3个词形容坐在自己右边的人，不许重复！',
    durationSeconds: 120,
    completionCTA: '说完了！',
    visualHint: '💬🌟',
    category: 'creative',
    scene: 'both',
    minPlayers: 3,
    maxPlayers: 8,
    energyLevel: 'medium',
    moodFit: ['funny', 'relaxed'],
    baseWeight: 1.0,
    altCTAs: ['描述完毕！', '贴标签完成！'],
  },
  {
    id: 'c3-bad-startup',
    title: '组队想出最离谱的创业点子',
    description: '大家一起想出一个绝对不会成功的创业想法，但要听起来很认真。',
    durationSeconds: 150,
    completionCTA: '想到了！',
    visualHint: '🚀💡',
    category: 'creative',
    scene: 'both',
    minPlayers: 3,
    maxPlayers: 8,
    energyLevel: 'high',
    moodFit: ['funny', 'life'],
    baseWeight: 0.9,
    altCTAs: ['点子诞生！', '创业失败！'],
  },
  {
    id: 'c4-hum-song',
    title: '哼歌猜曲',
    description: '每人哼一首歌，其他人猜歌名，猜对了换下一首。不准用歌词！',
    durationSeconds: 120,
    completionCTA: '猜完了！',
    visualHint: '🎵🎤',
    category: 'active',
    scene: 'bar',
    minPlayers: 3,
    maxPlayers: 8,
    energyLevel: 'high',
    moodFit: ['funny', 'relaxed'],
    baseWeight: 0.85,
    altCTAs: ['猜对啦！', '下一首！'],
  },
  {
    id: 'c5-quick-intro',
    title: '最快自我介绍',
    description: '每人用30秒介绍自己最不为人知的一面，不许说名字和职业。',
    durationSeconds: 180,
    completionCTA: '介绍完了！',
    visualHint: '⚡👤',
    category: 'deep',
    scene: 'both',
    minPlayers: 3,
    maxPlayers: 8,
    energyLevel: 'medium',
    moodFit: ['life', 'emotional'],
    baseWeight: 0.9,
    altCTAs: ['自我揭露！', '讲完了！'],
  },
  {
    id: 'c6-mind-link',
    title: '心灵感应挑战',
    description: '两人背对背同时说出一个数字，全组尝试心灵感应，直到成功。',
    durationSeconds: 90,
    completionCTA: '挑战完成！',
    visualHint: '🧠✨',
    category: 'quick',
    scene: 'both',
    minPlayers: 3,
    maxPlayers: 8,
    energyLevel: 'low',
    moodFit: ['relaxed', 'funny'],
    baseWeight: 0.9,
    altCTAs: ['感应成功！', '默契达成！'],
  },
  {
    id: 'c7-birthday-line',
    title: '排列组合游戏',
    description: '所有人按照生日月份从小到大排成一排，不能说话只能用手势。',
    durationSeconds: 120,
    completionCTA: '排好了！',
    visualHint: '🎯👥',
    category: 'active',
    scene: 'both',
    minPlayers: 4,
    maxPlayers: 8,
    energyLevel: 'medium',
    moodFit: ['funny', 'relaxed'],
    baseWeight: 0.85,
    altCTAs: ['站队完毕！', '排排站！'],
  },
  {
    id: 'c8-story-chain',
    title: '集体讲故事',
    description: '每人说一句话，接力完成一个完整故事，结尾必须出乎意料。',
    durationSeconds: 180,
    completionCTA: '故事完成！',
    visualHint: '📖🎭',
    category: 'creative',
    scene: 'dinner',
    minPlayers: 3,
    maxPlayers: 8,
    energyLevel: 'medium',
    moodFit: ['funny', 'creative', 'relaxed'] as any,
    baseWeight: 0.9,
    altCTAs: ['完结撒花！', '故事讲完！'],
  },
  {
    id: 'c9-would-you-rather',
    title: '你会选择……',
    description: '主持人提出两个有趣的选项，每人选择并分享理由，选相同的人可以击掌。',
    durationSeconds: 120,
    completionCTA: '选好了！',
    visualHint: '🤔✋',
    category: 'quick',
    scene: 'both',
    minPlayers: 3,
    maxPlayers: 8,
    energyLevel: 'low',
    moodFit: ['relaxed', 'life'],
    baseWeight: 1.0,
    altCTAs: ['理由说完！', '选边完毕！'],
  },
  {
    id: 'c10-compliment-bomb',
    title: '赞美炸弹',
    description: '指定一个人为"靶子"，其他人轮流真诚赞美TA一句，不能重复。',
    durationSeconds: 120,
    completionCTA: '赞美完毕！',
    visualHint: '💣💖',
    category: 'deep',
    scene: 'both',
    minPlayers: 3,
    maxPlayers: 8,
    energyLevel: 'medium',
    moodFit: ['emotional', 'relaxed'],
    baseWeight: 0.85,
    altCTAs: ['炸弹投放！', '暖心完毕！'],
  },
  {
    id: 'c11-never-have-i-ever',
    title: '我从来没有……',
    description: '每人说一件"我从来没有做过的事"，做过的人要举手，分享背后故事。',
    durationSeconds: 150,
    completionCTA: '爆料完毕！',
    visualHint: '🙋🍻',
    category: 'deep',
    scene: 'bar',
    minPlayers: 3,
    maxPlayers: 8,
    energyLevel: 'medium',
    moodFit: ['life', 'funny'],
    baseWeight: 0.85,
    altCTAs: ['坦白完毕！', '举手结束！'],
  },
  {
    id: 'c9-telephone-drawing',
    title: '电话传画',
    description: '第一个人画一个词，下一个人只能看前一个人的画来猜词并重画，传到最后看变成什么。',
    durationSeconds: 180,
    completionCTA: '看结果！',
    visualHint: '🖼️✏️',
    category: 'active',
    scene: 'both',
    minPlayers: 4,
    maxPlayers: 8,
    energyLevel: 'high',
    moodFit: ['funny', 'relaxed'],
    baseWeight: 0.8,
    altCTAs: ['揭晓答案！', '画传完毕！'],
  },

  // ─── 2‑player challenges ──────────────────────────────────────────────────────
  {
    id: 'c10-two-deep-questions',
    title: '互相问3个问题',
    description: '每人轮流问对方3个问题，问题越有意思越好。可以关于梦想、恐惧、或者任何好奇的事。',
    durationSeconds: 180,
    completionCTA: '问完了！',
    visualHint: '❓💬',
    category: 'deep',
    scene: 'both',
    minPlayers: 2,
    maxPlayers: 8,
    energyLevel: 'low',
    moodFit: ['relaxed', 'life', 'emotional'],
    baseWeight: 1.0,
    altCTAs: ['了解完毕！', '默契+1！'],
    altDescriptions: ['每人准备3个能真正了解对方的问题，轮流问。越真诚越好。'],
  },
  {
    id: 'c11-rapid-fire',
    title: '快问快答10连发',
    description: '每人轮流快速回答10个「你更愿意…」或「有没有过…」的问题。不许想太久！',
    durationSeconds: 120,
    completionCTA: '答完了！',
    visualHint: '⚡🔥',
    category: 'quick',
    scene: 'both',
    minPlayers: 2,
    maxPlayers: 8,
    energyLevel: 'medium',
    moodFit: ['funny', 'relaxed', 'life'],
    baseWeight: 1.0,
    altCTAs: ['10连完成！', '接招完毕！'],
  },
  {
    id: 'c12-three-facts',
    title: '说出3个事实',
    description: '每人说出3件关于自己的事，其中1件是假的，让对方猜哪个是假的。',
    durationSeconds: 150,
    completionCTA: '猜完了！',
    visualHint: '🎭🤥',
    category: 'creative',
    scene: 'both',
    minPlayers: 2,
    maxPlayers: 8,
    energyLevel: 'high',
    moodFit: ['funny', 'relaxed', 'life'],
    baseWeight: 0.95,
    altCTAs: ['揭穿你了！', '真假难辨！'],
  },
];

// ─── Selector ────────────────────────────────────────────────────────────────

export interface MicroChallengeSelectorParams {
  participantCount: number;
  /** IDs of templates already used in this session (to avoid repeats). */
  completedIds?: string[];
  /** Optional scene filter. Defaults to 'both' if omitted. */
  scene?: MicroChallengeScene;
  /** Optional mood hint for scoring boost. */
  mood?: 'relaxed' | 'funny' | 'life' | 'emotional';
  /** Optional energy arc hint ('start' = low energy, 'peak' = high energy). */
  energyArc?: 'start' | 'build' | 'peak' | 'winddown';
  /** How many challenges to select. Default 3. */
  count?: number;
  /** Deterministic seed (e.g. session ID hash). */
  seed: string;
}

function inferTargetEnergy(arc?: MicroChallengeSelectorParams['energyArc']): MicroChallengeEnergy | undefined {
  switch (arc) {
    case 'start':
    case 'winddown':
      return 'low';
    case 'build':
      return 'medium';
    case 'peak':
      return 'high';
    default:
      return undefined;
  }
}

function scoreTemplate(
  template: MicroChallengeTemplate,
  params: MicroChallengeSelectorParams
): number {
  let score = template.baseWeight;

  // Mood boost
  if (params.mood && template.moodFit.includes(params.mood)) {
    score += 0.25;
  }

  // Scene boost
  if (params.scene && (template.scene === params.scene || template.scene === 'both')) {
    score += 0.15;
  }

  // Energy arc boost
  const targetEnergy = inferTargetEnergy(params.energyArc);
  if (targetEnergy && template.energyLevel === targetEnergy) {
    score += 0.2;
  }

  // Category diversity bonus: handled during sampling (not here)
  return Math.max(0, score);
}

/** Apply explicit soft wow modifiers to a selected template. Currently minimal — rotates CTA/description variants. */
export function applyWowModifier(
  template: MicroChallengeTemplate,
  random: () => number
): MicroChallenge {
  const useAlt = random() < 0.3; // 30% chance to use an alternative variant
  const cta =
    useAlt && template.altCTAs?.length
      ? template.altCTAs[Math.floor(random() * template.altCTAs.length)]
      : template.completionCTA;
  const description =
    useAlt && template.altDescriptions?.length
      ? template.altDescriptions[Math.floor(random() * template.altDescriptions.length)]
      : template.description;

  return {
    id: template.id,
    title: template.title,
    description,
    durationSeconds: template.durationSeconds,
    completionCTA: cta,
    visualHint: template.visualHint,
  };
}

/**
 * Deterministic micro-challenge selector.
 *
 * 1. Filter by player count and completion history.
 * 2. Score by contextual fit (mood, scene, energy arc).
 * 3. Weighted sample without replacement using seeded PRNG.
 * 4. Apply explicit soft wow modifiers.
 */
export function selectMicroChallenges(
  params: MicroChallengeSelectorParams
): MicroChallenge[] {
  const count = params.count ?? 3;
  const rand = createSeededRandom(params.seed);

  // 1. Filter
  const eligible = MICRO_CHALLENGE_TEMPLATES.filter((t) => {
    if (params.participantCount < t.minPlayers || params.participantCount > t.maxPlayers) {
      return false;
    }
    if (params.completedIds?.includes(t.id)) {
      return false;
    }
    if (params.scene && t.scene !== 'both' && t.scene !== params.scene) {
      return false;
    }
    return true;
  });

  if (eligible.length === 0) {
    // Ultimate fallback: ignore scene/completed filters but keep player count
    const fallback = MICRO_CHALLENGE_TEMPLATES.filter(
      (t) =>
        params.participantCount >= t.minPlayers &&
        params.participantCount <= t.maxPlayers
    );
    if (fallback.length === 0) {
      throw new Error(
        `No micro-challenge templates available for ${params.participantCount} players`
      );
    }
    return fallback.slice(0, count).map((t) => applyWowModifier(t, rand));
  }

  // 2. Score
  const scored = eligible.map((t) => ({
    template: t,
    score: scoreTemplate(t, params),
  }));

  // 3. Weighted sample without replacement
  const selected: MicroChallengeTemplate[] = [];
  const pool = [...scored];

  while (selected.length < count && pool.length > 0) {
    const totalWeight = pool.reduce((sum, item) => sum + item.score, 0);
    let threshold = rand() * totalWeight;
    let chosenIndex = 0;
    for (let i = 0; i < pool.length; i++) {
      threshold -= pool[i].score;
      if (threshold <= 0) {
        chosenIndex = i;
        break;
      }
    }
    selected.push(pool[chosenIndex].template);
    pool.splice(chosenIndex, 1);
  }

  // 4. Apply wow modifiers
  return selected.map((t) => applyWowModifier(t, rand));
}
