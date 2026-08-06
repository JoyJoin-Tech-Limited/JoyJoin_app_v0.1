/**
 * 内容过滤模块 - 敏感词检测
 * 检测政治、色情、暴力等敏感内容
 */

export type ViolationType = 'political' | 'pornographic' | 'violent' | 'spam' | 'harassment' | 'illegal';

export interface ContentFilterResult {
  isViolation: boolean;
  violationType?: ViolationType;
  severity: 'none' | 'warning' | 'severe';
  matchedKeywords: string[];
  message?: string;
}

export const sensitiveWordLists: Record<ViolationType, { keywords: string[]; severity: 'warning' | 'severe' }> = {
  political: {
    keywords: [
      '共产党', '国民党', '习近平', '毛泽东', '六四', '天安门', '法轮功', 
      '台独', '藏独', '疆独', '民运', '反党', '颠覆政权', '推翻政府',
      '专制', '独裁', '维尼熊', '膜蛤', '翻墙', '防火长城'
    ],
    severity: 'severe'
  },
  pornographic: {
    keywords: [
      '约炮', '一夜情', '做爱', '性交', '口交', '肛交', '自慰', '手淫',
      '阴茎', '阴道', '乳房', '裸体', '色情', '黄片', 'AV', '成人片',
      '嫖娼', '卖淫', '援交', '包养', '情人', '小三', '出轨'
    ],
    severity: 'severe'
  },
  violent: {
    keywords: [
      '杀人', '谋杀', '自杀', '枪击', '爆炸', '恐怖袭击', '绑架', '强奸',
      '虐待', '酷刑', '血腥', '砍死', '打死', '弄死'
    ],
    severity: 'severe'
  },
  harassment: {
    keywords: [
      '傻逼', '操你妈', '草泥马', '你妈死了', '去死', '滚蛋', '废物',
      '垃圾', '白痴', '智障', '脑残', '神经病', '变态', '恶心'
    ],
    severity: 'warning'
  },
  spam: {
    keywords: [
      '微信', 'QQ', '加我', '联系方式', '手机号', '电话', '私聊',
      '免费领取', '点击链接', '扫码', '转账', '红包', '抽奖', '中奖'
    ],
    severity: 'warning'
  },
  illegal: {
    keywords: [
      '毒品', '冰毒', '海洛因', '大麻', '赌博', '洗钱', '诈骗', 
      '偷盗', '抢劫', '走私', '贩卖', '传销'
    ],
    severity: 'severe'
  }
};

/**
 * Leet-speak / obfuscation character map applied before regex-based profanity
 * matching: 4→a, @→a, 8→b, 3→e, 0→o, 5→s, $→s, 7→t. `1` is ambiguous (d1ck→dick,
 * s1ut→slut) so it is normalized twice — once to `i`, once to `l` — and a
 * keyword matches if either normalization triggers.
 */
const LEET_MAP: Record<string, string> = {
  '4': 'a', '@': 'a', '8': 'b', '3': 'e', '0': 'o', '5': 's', '$': 's', '7': 't',
};

const ONE_AS_VARIANTS = ['i', 'l'] as const;

function normalizeObfuscated(text: string, oneAs: 'i' | 'l'): string {
  let out = text.toLowerCase();
  for (const [leet, plain] of Object.entries(LEET_MAP)) {
    out = out.split(leet).join(plain);
  }
  return out.split('1').join(oneAs);
}

/**
 * Builds a separator-tolerant profanity regex: letters of the base word may be
 * separated by any non-alphabetic character or digit (f**k, f u c k, f.u.c.k),
 * letters may repeat (fucck), and listed optional letters (usually vowels) may
 * be omitted entirely so star-forms match: f**k, sh*t, b*tch, c*nt, d*ck.
 * Word-boundary guards prevent false positives inside legit words
 * (class / pass / assessment / sit / duck / dan).
 */
function obfuscatedPattern(base: string, suffixes: string[] = [], optionalLetters: string[] = []): RegExp {
  const letters = base.split('');
  const core = letters.map((letter, index) => {
    const isLast = index === letters.length - 1;
    const skippable = optionalLetters.includes(letter) && !isLast;
    return skippable
      ? `[\\W0-9_]*(?:${letter}+)?[\\W0-9_]*`
      : `[\\W0-9_]*${letter}+`;
  }).join('');
  const suffix = suffixes.length > 0 ? `(?:${suffixes.join('|')})?` : '';
  return new RegExp(`\\b${core}${suffix}\\b`, 'i');
}

interface ObfuscatedWord {
  base: string;
  suffixes: string[];
  optionalLetters?: string[];
}

/**
 * English profanity + pinyin abuse (exact-substring Chinese keywords live in
 * `sensitiveWordLists` above; these cover Latin-script and obfuscated variants).
 * The last letter of every base stays required so `dan`/`sit`/`duck` are safe.
 */
export const OBSCENE_WORD_BASES: ObfuscatedWord[] = [
  { base: 'fuck', suffixes: ['s', 'ing', 'ed', 'er', 'ers', 'head', 'face', 'you'], optionalLetters: ['u', 'c'] },
  { base: 'fuk', suffixes: ['s', 'ing', 'ed', 'er'], optionalLetters: ['u'] },
  { base: 'fxck', suffixes: ['s', 'ing', 'ed', 'er'] },
  { base: 'shit', suffixes: ['s', 'ty', 'head', 'hole'], optionalLetters: ['i'] },
  { base: 'bitch', suffixes: ['es', 'ing', 'y', 'er'], optionalLetters: ['i'] },
  { base: 'ass', suffixes: ['es', 'hole', 'holes', 'hat', 'hats', 'wipe'] },
  { base: 'cunt', suffixes: ['s'], optionalLetters: ['u'] },
  { base: 'dick', suffixes: ['s', 'head', 'heads', 'face'], optionalLetters: ['i'] },
  { base: 'pussy', suffixes: [], optionalLetters: ['u'] },
  { base: 'whore', suffixes: ['s'], optionalLetters: ['o'] },
  { base: 'slut', suffixes: ['s', 'ty'], optionalLetters: ['u'] },
  { base: 'nigger', suffixes: ['s'] },
  { base: 'nigga', suffixes: ['s'] },
  { base: 'fag', suffixes: ['s', 'got', 'gots'] },
  { base: 'retard', suffixes: ['s', 'ed'] },
  { base: 'damn', suffixes: ['ed', 'ing'] },
  { base: 'motherfucker', suffixes: ['s'] },
  { base: 'caonima', suffixes: [] },
  { base: 'cnm', suffixes: [] },
  { base: 'wcnm', suffixes: [] },
  { base: 'nmsl', suffixes: [] },
  { base: 'shabi', suffixes: [] },
];

const OBSCENE_PATTERNS: { pattern: RegExp; display: string }[] = OBSCENE_WORD_BASES.map(({ base, suffixes, optionalLetters }) => ({
  pattern: obfuscatedPattern(base, suffixes, optionalLetters),
  display: base,
}));

export function filterContent(text: string): ContentFilterResult {
  const lowerText = text.toLowerCase();
  const matchedKeywords: string[] = [];
  let highestSeverity: 'none' | 'warning' | 'severe' = 'none';
  let violationType: ViolationType | undefined;

  for (const [type, config] of Object.entries(sensitiveWordLists) as [ViolationType, { keywords: string[]; severity: 'warning' | 'severe' }][]) {
    for (const keyword of config.keywords) {
      if (lowerText.includes(keyword.toLowerCase())) {
        matchedKeywords.push(keyword);
        if (config.severity === 'severe' || (config.severity === 'warning' && highestSeverity === 'none')) {
          highestSeverity = config.severity;
          violationType = type;
        }
      }
    }
  }

  const normalizedVariants = ONE_AS_VARIANTS.map((oneAs) => normalizeObfuscated(lowerText, oneAs));
  const profanityHits = OBSCENE_PATTERNS
    .filter(({ pattern }) => normalizedVariants.some((normalized) => pattern.test(normalized)))
    .map(({ display }) => display);

  if (profanityHits.length > 0) {
    matchedKeywords.push(...profanityHits);
    if (highestSeverity === 'none') {
      highestSeverity = sensitiveWordLists.harassment.severity;
      violationType = 'harassment';
    }
  }

  if (matchedKeywords.length === 0) {
    return {
      isViolation: false,
      severity: 'none',
      matchedKeywords: []
    };
  }

  const messages: Record<ViolationType, string> = {
    political: '您的消息包含敏感政治内容，请保持友好的对话氛围。',
    pornographic: '您的消息包含不当内容，请遵守社区规范。',
    violent: '您的消息包含暴力相关内容，请保持文明对话。',
    harassment: '您的消息包含不友好内容，请尊重他人。',
    spam: '您的消息包含疑似广告或联系方式，请遵守社区规范。',
    illegal: '您的消息包含违规内容，请遵守法律法规。'
  };

  return {
    isViolation: true,
    violationType,
    severity: highestSeverity,
    matchedKeywords,
    message: violationType ? messages[violationType] : '您的消息包含敏感内容，请修改后重试。'
  };
}

