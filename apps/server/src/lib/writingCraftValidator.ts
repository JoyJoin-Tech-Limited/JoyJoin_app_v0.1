/**
 * Writing Craft Validator — Deterministic post-generation quality scoring.
 *
 * Reads the 8 Xiaoyue craft axioms and scores Chinese output on a 0-100
 * scale. Used as a pass/fail gate after every LLM call that produces
 * user-facing Chinese text.
 *
 * All checks are regex-based or simple statistical — no LLM dependency.
 * This ensures fast, deterministic, zero-cost validation.
 */

export interface CraftDiagnostics {
  /** Rhythm: number of consecutive sentences all >14 chars */
  consecutiveLongSentences: number;
  /** Rhythm: ratio of short (≤8 char) sentences to total sentences */
  shortSentenceRatio: number;
  /** Rhythm: standard deviation of sentence char lengths */
  sentenceLengthStdDev: number;

  /** Imagery: count of concrete sensory words found */
  sensoryWordCount: number;
  /** Imagery: count of concrete action verbs */
  concreteActionVerbCount: number;

  /** Anti-AI: banned words/phrases found */
  bannedWordsFound: string[];
  /** Anti-AI: max consecutive sentences starting with same char */
  consecutiveSameStart: number;
  /** Anti-AI: count of parallelism patterns (你+verb, 你+verb, ...) */
  parallelismCount: number;

  /** Temperature: count of acceptance signals */
  acceptanceSignalCount: number;
  /** Temperature: count of pathologizing phrases (你容易/你倾向于/你往往) */
  pathologizingPhrases: number;

  /** Landing: does last sentence end with actionable verb? */
  landingIsActionable: boolean;
  /** Landing: is last sentence an abstract summary? */
  landingIsAbstractSummary: boolean;

  /** Density: "你" character count per 100 chars */
  niDensity: number;

  /** Combined craft score (0-100) */
  craftScore: number;
  /** Whether the text passes quality threshold */
  passes: boolean;
  /** Human-readable issues for LLM refinement hints */
  fixableIssues: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PASS_THRESHOLD = 70;

/** Characters used as Chinese sentence-ending punctuation. */
const SENTENCE_END = /[。！？\n]/;

/** Split text into sentences (Chinese-aware). */
function splitSentences(text: string): string[] {
  const raw = text.split(SENTENCE_END).filter(s => s.trim().length > 0);
  // Avoid splitting mid-quote / mid-comma; treat comma-separated clauses as sub-sentences for rhythm checks
  const withCommas: string[] = [];
  for (const s of raw) {
    const parts = s.split(/[，,]/).filter(p => p.trim().length > 0);
    withCommas.push(...parts);
  }
  return withCommas.length > 0 ? withCommas : raw;
}

/** Whether a sentence ends with actionable/specific verb rather than abstract summary. */
function isActionableEnding(sentences: string[]): boolean {
  if (sentences.length === 0) return false;
  const last = sentences[sentences.length - 1].trim();
  // Abstract summary patterns
  if (/相信你.+(会|能|可以|将)/.test(last)) return false;
  if (/属于自己.+方式/.test(last)) return false;
  if (/找到.+位置/.test(last)) return false;
  if (/成为.+人$/.test(last)) return false;
  if (/收获.+关系/.test(last)) return false;
  // Actionable patterns: 试着/下次/试试/不妨/可以+verb
  if (/[试着下次试试不妨可以].+[去来]/.test(last)) return true;
  if (/把.+了/.test(last)) return true;
  // Contains a specific action verb with a direct object
  if (/([观察接问听看找选翻聊记].+[一下一圈一人一句话一个人遍回])/.test(last)) return true;
  return false;
}

function isAbstractSummaryEnding(sentences: string[]): boolean {
  if (sentences.length === 0) return false;
  const last = sentences[sentences.length - 1].trim();
  return /相信你|属于你|适合你|你会找到|一定能|总会/.test(last);
}

// ─── Banned Words ─────────────────────────────────────────────────────────────

const BANNED_WORDS = [
  '总的来说',
  '值得注意',
  '需要指出',
  '不仅仅',
  '在某种意义上',
  '作为一种',
  '作为您的',
  '让我们一起',
  '有趣的是',
  '值得注意的是',
  '值得一提的是',
  '具备了',
  '呈现出',
  '体现出了',
  '展现了',
];

const BANNED_SENTENCE_PATTERNS = [
  { regex: /你是.{1,30}的人/, label: '"你是...的人"句型' },
  { regex: /对于.{2,20}来说/g, label: '"对于...来说"出现过多' },
];

const PATHOLOGIZING_PHRASES = ['你容易', '你倾向于', '你往往', '你总是'];

const ACCEPTANCE_SIGNALS = [
  '也可以',
  '也没关系',
  '也很好',
  '不必',
  '不需要',
  '不一定',
  '没关系的',
  '不急',
  '慢慢来',
  '有自己的节奏',
  '这样挺好',
  '也挺好',
  '不用改',
  '不是问题',
];

// ─── Sensory & Action Words ───────────────────────────────────────────────────

const SENSORY_WORDS = [
  '听见', '听到', '看见', '看到', '闻到', '摸到', '触碰',
  '声音', '颜色', '味道', '温度', '光', '影子', '风',
  '眼睛', '耳朵', '手指', '皮肤', '镜头',
  '画面', '场景',
];

const CONCRETE_ACTION_VERBS = [
  '放下', '拿起来', '推开门', '坐下', '站', '走', '跑',
  '回头', '接一句', '接话', '补刀', '翻面',
  '放在桌上', '攥着', '递过去', '收进口袋',
  '停下', '转身', '抬起来', '低头',
];

// ─── Scoring ──────────────────────────────────────────────────────────────────

export type CraftContext = 'analysis' | 'comment' | 'coaching' | 'narrative' | 'lite';

/**
 * Whether rhythm and imagery checks should apply for this context.
 * Short-form text (comments, coaching hints) cannot meaningfully satisfy
 * sentence-length variance or sensory-word requirements.
 */
function shouldCheckRhythmAndImagery(context: CraftContext): boolean {
  switch (context) {
    case 'analysis':
    case 'narrative':
      return true;
    case 'comment':
    case 'coaching':
    case 'lite':
      return false;
  }
}

/**
 * Calculate crafting score (0-100) from 8 axiom dimensions.
 * Score distribution varies by context to avoid penalizing short text
 * for axioms that only make sense in long-form prose.
 */
function calculateScore(diag: Omit<CraftDiagnostics, 'craftScore' | 'passes' | 'fixableIssues'>, context: CraftContext): { score: number; issues: string[] } {
  const issues: string[] = [];
  let score = 100;

  const skipFormChecks = !shouldCheckRhythmAndImagery(context);

  // Axiom 1: Rhythm (12.5 pts) — skipped for short text
  if (!skipFormChecks) {
    if (diag.consecutiveLongSentences >= 4) {
      score -= 12;
      issues.push(`连续${diag.consecutiveLongSentences}句超过14字，缺乏节奏变化`);
    } else if (diag.consecutiveLongSentences >= 3) {
      score -= 6;
      issues.push(`连续${diag.consecutiveLongSentences}句长句，建议插入短句打断节奏`);
    }
    if (diag.shortSentenceRatio < 0.15) {
      score -= 6;
      issues.push('短句占比过低，口语感不足');
    }
    if (diag.sentenceLengthStdDev < 5) {
      score -= 6;
      issues.push('句子长度过于均匀，缺少起伏');
    }
  }

  // Axiom 2: Imagery (12.5 pts) — skipped for short text
  if (!skipFormChecks) {
    if (diag.sensoryWordCount === 0) {
      score -= 8;
      issues.push('缺少具象画面，读起来全是抽象概念');
    }
    if (diag.concreteActionVerbCount < 1) {
      score -= 6;
      issues.push('缺少具体动作描写，建议增加能被摄像机拍到的动词');
    }
  } else {
    // Short text: imagery is nice-to-have but not penalized
    // Instead, redistribution: banned words and temperature get heavier weight
  }

  // Axiom 4: Concrete over abstract (shared with axiom 2)
  // Axiom 5: Sentence variety (12.5 pts)
  if (diag.consecutiveSameStart >= 3) {
    score -= 12;
    issues.push(`连续${diag.consecutiveSameStart}句以相同字开头，机器人感明显`);
  }
  if (diag.parallelismCount >= 2) {
    score -= 8;
    issues.push('检测到排比句，缺乏人味');
  }

  // Axiom 6: Temperature (12.5 pts)
  if (diag.acceptanceSignalCount === 0) {
    score -= 6;
    issues.push('缺少接纳信号，通篇看起来像在分析而不是陪伴');
  }
  if (diag.pathologizingPhrases > 0) {
    score -= 10;
    issues.push(`发现${diag.pathologizingPhrases}处病理化句式（"你容易/你倾向于"），改为"你更愿意/有时你会"`);
  }

  // Axiom 7: Landing (12.5 pts) — skipped for short text
  if (!skipFormChecks) {
    if (diag.landingIsAbstractSummary) {
      score -= 8;
      issues.push('结尾为抽象总结而非具体动作，落点不够利落');
    }
    if (!diag.landingIsActionable) {
      score -= 6;
      issues.push('结尾缺少可执行的具体动作');
    }
  }

  // Axiom 8: Banned words (critical — 25 pts)
  if (diag.bannedWordsFound.length > 0) {
    score -= 20;
    issues.push(`AI味屏蔽词: ${diag.bannedWordsFound.join('、')}`);
  }

  // Density check (skipped for short text where "你" is naturally denser)
  if (!skipFormChecks && diag.niDensity > 8) {
    score -= 8;
    issues.push(`"你"字密度${diag.niDensity.toFixed(1)}/100字，读起来像审讯`);
  }

  return { score: Math.max(0, score), issues };
}

// ─── Main Validator ───────────────────────────────────────────────────────────

export function validateCraft(text: string, _context: CraftContext = 'analysis'): CraftDiagnostics {
  const sentences = splitSentences(text);
  const lengths = sentences.map(s => s.length);
  const totalChars = text.replace(/\s/g, '').length;

  // Rhythm
  let maxConsecutiveLong = 0;
  let currentConsecutive = 0;
  for (const len of lengths) {
    if (len > 14) {
      currentConsecutive++;
      maxConsecutiveLong = Math.max(maxConsecutiveLong, currentConsecutive);
    } else {
      currentConsecutive = 0;
    }
  }
  const shortCount = sentences.filter(s => s.length <= 8).length;
  const shortRatio = sentences.length > 0 ? shortCount / sentences.length : 0;
  const mean = lengths.reduce((a, b) => a + b, 0) / (lengths.length || 1);
  const variance = lengths.reduce((sum, len) => sum + (len - mean) ** 2, 0) / (lengths.length || 1);
  const lengthStdDev = Math.sqrt(variance);

  // Imagery
  const sensoryCount = SENSORY_WORDS.filter(w => text.includes(w)).length;
  const concreteCount = CONCRETE_ACTION_VERBS.filter(w => text.includes(w)).length;

  // Banned words
  const banned = BANNED_WORDS.filter(w => text.includes(w));
  const bannedPatterns = BANNED_SENTENCE_PATTERNS
    .filter(p => p.regex.test(text))
    .map(p => p.label);
  const allBanned = [...banned, ...bannedPatterns];

  // Sentence starts
  let maxSameStart = 0;
  let currentSame = 1;
  for (let i = 1; i < sentences.length; i++) {
    if (sentences[i].charAt(0) === sentences[i - 1].charAt(0)) {
      currentSame++;
      maxSameStart = Math.max(maxSameStart, currentSame);
    } else {
      currentSame = 1;
    }
  }
  if (maxSameStart < 1) maxSameStart = 1;

  // Parallelism: 3+ consecutive sentences starting with "你" + verb
  let paraCount = 0;
  for (let i = 0; i < sentences.length - 2; i++) {
    if (
      sentences[i].startsWith('你') &&
      sentences[i + 1].startsWith('你') &&
      sentences[i + 2].startsWith('你')
    ) {
      paraCount++;
    }
  }

  // Temperature
  const acceptCount = ACCEPTANCE_SIGNALS.filter(w => text.includes(w)).length;
  const pathoCount = PATHOLOGIZING_PHRASES.filter(w => text.includes(w)).length;

  // Landing
  const actionable = isActionableEnding(sentences);
  const abstractEnding = isAbstractSummaryEnding(sentences);

  // Density
  const niCount = (text.match(/你/g) || []).length;
  const niDensity = totalChars > 0 ? (niCount / totalChars) * 100 : 0;

  // Compound diagnostics
  const rawDiag = {
    consecutiveLongSentences: maxConsecutiveLong,
    shortSentenceRatio: Math.round(shortRatio * 100) / 100,
    sentenceLengthStdDev: Math.round(lengthStdDev * 10) / 10,
    sensoryWordCount: sensoryCount,
    concreteActionVerbCount: concreteCount,
    bannedWordsFound: allBanned,
    consecutiveSameStart: maxSameStart,
    parallelismCount: paraCount,
    acceptanceSignalCount: acceptCount,
    pathologizingPhrases: pathoCount,
    landingIsActionable: actionable,
    landingIsAbstractSummary: abstractEnding,
    niDensity: Math.round(niDensity * 10) / 10,
  };

  const { score, issues } = calculateScore(rawDiag, _context);
  const threshold = _context === 'comment' || _context === 'coaching' || _context === 'lite' ? 55 : PASS_THRESHOLD;

  return {
    ...rawDiag,
    craftScore: score,
    passes: score >= threshold,
    fixableIssues: issues,
  };
}

/**
 * Generate LLM-friendly refinement hints from diagnostics.
 * Append to prompt as "【改进建议】" when retrying.
 */
export function buildRefinementHints(diag: CraftDiagnostics): string | null {
  if (diag.fixableIssues.length === 0) return null;
  return `【文字功底改进建议 — 上一轮未通过，请逐条修复】\n${diag.fixableIssues.map((issue, i) => `  ${i + 1}. ${issue}`).join('\n')}`;
}
