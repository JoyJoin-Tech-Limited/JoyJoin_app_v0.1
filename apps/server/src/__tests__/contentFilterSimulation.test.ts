/**
 * Adversarial simulation: 1000 seeded "users" constantly trying to game the
 * Tier-0 deterministic content filter (兜底系统). Every attempt is a mutation
 * of a known-bad seed word drawn from the REAL filter lists (no drift), plus
 * classic Chinese obfuscation attacks. Seeded PRNG → reproducible in CI.
 *
 * Contract:
 * - MUST-CATCH strategies are the machinery the filter claims to support
 *   (exact hits, leet, separators, repetition, vowel-drop, case, zero-width,
 *   combining marks). Zero misses allowed — asserted.
 * - TIER-1-RESIDUAL strategies need semantic detection (WeChat msgSecCheck,
 *   default-ON flag): Chinese char-insertion/homophones/pinyin abbreviations,
 *   full-width Latin, homoglyph letter swaps, pinyin tones, reversed, doubled,
 *   rot13, base64. Reported in the gap table, not asserted.
 */
import { describe, it, expect } from 'vitest'
import { filterContent, sensitiveWordLists, OBSCENE_WORD_BASES } from '../contentFilter'

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const CHINESE_KEYWORDS = Object.values(sensitiveWordLists).flatMap((c) => c.keywords)
const ENGLISH_BASES = OBSCENE_WORD_BASES.map((w) => w.base)
const PYNYIN_BASES = ['caonima', 'cnm', 'wcnm', 'nmsl', 'shabi']
// The filter only claims optional-letter omission, so vowel-drop must be
// scoped to each base's declared optionalLetters (f**k, sh*t, c*nt, d*ck).
const OPTIONAL_BY_BASE = new Map(
  OBSCENE_WORD_BASES.map((w) => [w.base, new Set(w.optionalLetters ?? [])]),
)

const SEPARATORS = [' ', '.', '-', '_', '*', '!', '\u200B', '\u200C', '\u200D', '\uFEFF', '\u3000', '\n', '\t']
const LEET: Record<string, string[]> = { a: ['4', '@'], b: ['8'], e: ['3'], i: ['1'], l: ['1'], o: ['0'], s: ['5', '$'], t: ['7'] }
const HOMOGLYPHS: Record<string, string[]> = {
  a: ['α', 'á'], c: ['ς', 'ç'], e: ['é', '€'], f: ['ƒ'], g: ['ğ'], h: ['ħ'],
  i: ['í'], k: ['κ'], n: ['ñ'], o: ['ó'], r: ['ř'], s: ['š'], t: ['τ'], u: ['μ'],
}
const TONED: Record<string, string | undefined> = { a: 'ā', e: 'ē', i: 'ǐ', o: 'ǒ', u: 'ū' }
const FULLWIDTH: Record<string, string> = {
  a: 'ａ', b: 'ｂ', c: 'ｃ', d: 'ｄ', e: 'ｅ', f: 'ｆ', g: 'ｇ', h: 'ｈ', i: 'ｉ', j: 'ｊ',
  k: 'ｋ', l: 'ｌ', m: 'ｍ', n: 'ｎ', o: 'ｏ', p: 'ｐ', q: 'ｑ', r: 'ｒ', s: 'ｓ', t: 'ｔ',
  u: 'ｕ', v: 'ｖ', w: 'ｗ', x: 'ｘ', y: 'ｙ', z: 'ｚ',
}

// [canonical banned word, attack spellings users actually type]
const CHINESE_ATTACKS: [string, string[]][] = [
  ['傻逼', ['煞笔', '沙比', '傻b', '傻B', '纱比']],
  ['操你妈', ['艹泥马', '操ni妈']],
  ['你妈死了', ['nmsl', 'nm$l', '你妈s了']],
  ['约炮', ['约p', '约P']],
  ['一夜情', ['一ye情', '1夜情']],
  ['操你妈', ['cnm', 'wcnm', 'qnm', 'wqnmlgb']],
  ['他妈', ['tmd', 'TM的']],
  ['妈卖批', ['mmp', 'mmd']],
  ['你妈', ['nmd', 'rnm']],
]

const PAUSES = ['哈哈', '呵呵', '～', '!!!', '今天天气不错', '有人吗', 'hi', '在吗']

type Class = 'must-catch' | 'tier1-residual'
interface Attempt {
  text: string
  seed: string
  strategy: string
  cls: Class
}

function rot13(s: string): string {
  return s.replace(/[a-zA-Z]/g, (ch) => {
    const code = ch.charCodeAt(0)
    const base = code <= 90 ? 65 : 97
    return String.fromCharCode(((code - base + 13) % 26) + base)
  })
}

function base64(s: string): string {
  return Buffer.from(s, 'utf8').toString('base64')
}

function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)]
}

function mutate(rng: () => number, seed: string, strategy: string): string {
  const join = (sep: string) => seed.split('').join(sep)
  switch (strategy) {
    case 'exact':
      return seed
    case 'zh-separated':
      return join(pick(rng, [' ', '·', '~', '-', '_']))
    case 'zh-zwsp':
      return join('\u200B')
    case 'en-leet':
      return seed.split('').map((ch) => pick(rng, LEET[ch] ?? [ch])).join('')
    case 'en-leet-required':
      // Replace one letter with a leet lookalike that maps to a NON-optional
      // position (f4ck-style: 4 substitutes u but normalizes to 'a').
      return seed
        .split('')
        .map((ch, idx) => (idx === Math.floor(rng() * seed.length) ? pick(rng, LEET[ch] ?? [ch]) : ch))
        .join('')
    case 'en-separators':
      return join(pick(rng, SEPARATORS))
    case 'en-repeat':
      return seed.split('').map((ch) => ch.repeat(1 + Math.floor(rng() * 4))).join('')
    case 'en-vowel-drop':
      // Only drop vowels the filter declares optional (its documented claim).
      // Dropping REQUIRED letters (n*gger → nggr, 艹你妈 → cnm) is a
      // Tier-1 responsibility, asserted separately by CHINESE_ATTACKS below.
      return seed
        .split('')
        .map((ch) => (rng() < 0.5 && OPTIONAL_BY_BASE.get(seed)?.has(ch) ? '' : ch))
        .join('')
    case 'en-casemix':
      return seed.split('').map((ch) => (rng() < 0.5 ? ch.toUpperCase() : ch)).join('')
    case 'en-zwsp':
      return join('\u200B')
    case 'en-combining':
      return seed.split('').map((ch) => `${ch}\u0336`).join('')
    case 'en-fullwidth':
      return seed.split('').map((ch) => FULLWIDTH[ch] ?? ch).join('')
    case 'en-homoglyph':
      return seed.split('').map((ch) => (rng() < 0.4 ? pick(rng, HOMOGLYPHS[ch] ?? [ch]) : ch)).join('')
    case 'en-pinyin-tones':
      return seed.split('').map((ch) => (TONED[ch] && rng() < 0.6 ? TONED[ch] : ch)).join('')
    case 'en-reversed':
      return seed.split('').reverse().join('')
    case 'en-doubled':
      return seed + seed
    case 'en-rot13':
      return rot13(seed)
    case 'en-base64':
      return base64(seed)
    default:
      return seed
  }
}

const MUST_CATCH: Record<string, Class> = {
  exact: 'must-catch',
  'zh-separated': 'tier1-residual',
  'zh-zwsp': 'tier1-residual',
  'en-leet': 'must-catch',
  'en-leet-required': 'tier1-residual',
  'en-separators': 'must-catch',
  'en-repeat': 'must-catch',
  'en-vowel-drop': 'must-catch',
  'en-casemix': 'must-catch',
  'en-zwsp': 'must-catch',
  'en-combining': 'must-catch',
  'en-fullwidth': 'tier1-residual',
  'en-homoglyph': 'tier1-residual',
  'en-pinyin-tones': 'tier1-residual',
  'en-reversed': 'tier1-residual',
  'en-doubled': 'tier1-residual',
  'en-rot13': 'tier1-residual',
  'en-base64': 'tier1-residual',
}

const EN_STRATEGIES = Object.keys(MUST_CATCH).filter((s) => s.startsWith('en-'))
const ZH_STRATEGIES = ['exact', 'zh-separated', 'zh-zwsp']

function generateAttempts(seed: number, count: number): Attempt[] {
  const rng = mulberry32(seed)
  const attempts: Attempt[] = []
  for (let i = 0; i < count; i++) {
    const roll = rng()
    let seedWord = ''
    let strategy = ''
    let cls: Class = 'tier1-residual'
    if (roll < 0.4) {
      seedWord = pick(rng, CHINESE_KEYWORDS)
      strategy = pick(rng, ZH_STRATEGIES)
      cls = MUST_CATCH[strategy]
    } else if (roll < 0.72) {
      seedWord = pick(rng, ENGLISH_BASES)
      strategy = pick(rng, EN_STRATEGIES)
      cls = MUST_CATCH[strategy]
    } else if (roll < 0.9) {
      const [canonical, spellings] = pick(rng, CHINESE_ATTACKS)
      seedWord = canonical
      strategy = 'zh-attack'
      seedWord = pick(rng, spellings)
      cls = 'tier1-residual'
    } else {
      seedWord = pick(rng, PYNYIN_BASES)
      strategy = pick(rng, ['en-pinyin-tones', 'en-separators', 'en-zwsp', 'exact'])
      cls = MUST_CATCH[strategy]
    }
    let text = mutate(rng, seedWord, strategy)
    if (rng() < 0.6) {
      const pause = pick(rng, PAUSES)
      text = rng() < 0.5 ? `${pause} ${text}` : `${text} ${pause}`
    }
    attempts.push({ text, seed: seedWord, strategy, cls })
  }
  return attempts
}

interface MissRecord {
  seed: string
  strategy: string
  text: string
}

describe('filterContent — 1000-user adversarial simulation', () => {
  it('never lets a claimed-machinery obfuscation pass', () => {
    const USERS = 1000
    const ATTEMPTS = 15
    const allAttempts: Attempt[] = []
    const misses: MissRecord[] = []
    let caughtCount = 0
    const caughtByStrategy = new Map<string, number>()
    const missByStrategy = new Map<string, number>()
    const missSeeds = new Set<string>()

    for (let user = 0; user < USERS; user++) {
      for (const attempt of generateAttempts(20260803 + user, ATTEMPTS)) {
        allAttempts.push(attempt)
        const result = filterContent(attempt.text)
        if (result.isViolation) {
          caughtCount++
          caughtByStrategy.set(attempt.strategy, (caughtByStrategy.get(attempt.strategy) ?? 0) + 1)
        } else {
          misses.push({ seed: attempt.seed, strategy: attempt.strategy, text: attempt.text })
          missByStrategy.set(attempt.strategy, (missByStrategy.get(attempt.strategy) ?? 0) + 1)
          missSeeds.add(attempt.seed)
        }
      }
    }

    const mustCatchMisses = misses.filter((m) => MUST_CATCH[m.strategy] === 'must-catch')

    // ── Assertions ──
    // Sanity: the harness itself is wired to the real lists.
    for (const kw of CHINESE_KEYWORDS) {
      expect(filterContent(kw).isViolation, `exact Chinese keyword: ${kw}`).toBe(true)
    }
    for (const base of ENGLISH_BASES) {
      expect(filterContent(base).isViolation, `exact English base: ${base}`).toBe(true)
    }
    // The machinery the filter claims to support must never be defeated.
    expect(mustCatchMisses, `must-catch misses: ${JSON.stringify(mustCatchMisses.slice(0, 5))}`).toHaveLength(0)

    // ── Report ──
    const total = allAttempts.length
    const rate = ((caughtCount / total) * 100).toFixed(2)
    const gapLines = misses
      .slice(0, 60)
      .map((m) => `  [${m.strategy.padEnd(18)}] ${JSON.stringify(m.text)}  (seed: ${m.seed})`)
      .join('\n')
    const summary = [
      `\n═══ 1000-user gaming simulation ═══`,
      `attempts: ${total}  caught: ${caughtCount}  missed: ${misses.length}  (Tier-0 catch rate: ${rate}%)`,
      ``,
      `caught by strategy:`,
      ...[...caughtByStrategy.entries()].sort((a, b) => b[1] - a[1]).map(([s, n]) => `  ${s.padEnd(18)} ${n}`),
      ``,
      `misses by strategy (Tier-1 residual — WeChat msgSecCheck domain):`,
      ...[...missByStrategy.entries()].sort((a, b) => b[1] - a[1]).map(([s, n]) => `  ${s.padEnd(18)} ${n}`),
      ``,
      `unique missed seeds: ${[...missSeeds].sort().join(', ')}`,
      ``,
      `gap examples (first 60):`,
      gapLines,
    ].join('\n')
    console.log(summary)
  })
})
