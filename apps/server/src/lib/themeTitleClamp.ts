/**
 * Display-safe clamping for AI-generated group theme titles.
 *
 * Why this exists (designer B3, 2026-11-11): the events card renders the theme
 * at 28rpx in `font-cn-display`. The value column is 338rpx wide
 * (390rpx body column − 44rpx label box − 8rpx gap), so 12 CJK glyphs fit with
 * ~2rpx of slack — i.e. no slack at all once letter shapes vary. The generator
 * prompt asks for 4–8 characters, but the prompt is advisory and both write
 * paths accepted up to 20 (`validateEventThemeTitleResult`). A display-size
 * name truncated with an ellipsis is the ugliest failure this element can have,
 * so the invariant lives in code, not in the prompt.
 *
 * Clamping strategy is meaning-preserving, not a blunt substring:
 *   1. A compound title ("高能充电站：柯基×狐狸的周末探险") keeps its head
 *      clause ("高能充电站") — the generator's compound half is a subtitle
 *      fragment, and the row's own rationale line already carries group traits.
 *   2. Only when the head clause is itself too long do we cut at a grapheme
 *      boundary, and we never cut into a trailing separator or punctuation.
 *   3. Never append an ellipsis: the UI owns truncation, and a stored "…" would
 *      ellipsize itself twice.
 */

/**
 * Ceiling in grapheme clusters. 11 rather than 12 because 12 fills the 338rpx
 * value column exactly (12 × 28rpx = 336rpx) and leaves no room for the
 * letter-shape variance between "微醺夜话" and a run containing 「×」「·」.
 */
export const THEME_TITLE_MAX_GRAPHEMES = 11;

/**
 * The rationale line under the theme values at 24rpx in a 338rpx column
 * (390rpx body − 52rpx indent), so ~14 CJK fit. The generator validates
 * taglines up to 20 characters, which ellipsized on roughly a third of cards —
 * the same defect the title clamp removed one line above it. 13 keeps the same
 * buffer logic as 11/28 (13 × 24 = 312 against 338).
 */
export const THEME_TAGLINE_MAX_GRAPHEMES = 13;

/** Characters the generator uses to glue a compound title together. */
const COMPOUND_SEPARATORS = /[·：:|｜—–\-]/;

/** Quotes models like to wrap their own output in. */
const WRAPPING_QUOTES = /^["'“”‘’「」『』]+|["'“”‘’」』]+$/g;

/** Trailing glue we refuse to leave dangling after a cut. */
const DANGLING_TRAIL = /[\s·：:|｜—–\-、，,。.]+$/;

function toGraphemes(input: string): string[] {
  if (!input) return [];
  // Prefer Intl.Segmenter so emoji and ZWJ sequences count as one unit, matching
  // how the renderer lays them out. Falls back to code points elsewhere.
  if (typeof (Intl as any).Segmenter === 'function') {
    const segmenter = new (Intl as any).Segmenter('zh', { granularity: 'grapheme' });
    const out: string[] = [];
    for (const { segment } of segmenter.segment(input)) {
      out.push(segment);
    }
    return out;
  }
  return Array.from(input);
}

function normalize(raw: string): string {
  return raw
    .replace(WRAPPING_QUOTES, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Clamp a theme title to something that renders on one line without the UI
 * having to ellipsize it. Total function: never throws, returns '' for empty
 * input, and returns input unchanged when it already fits.
 */
export function clampThemeTitle(
  raw: string | null | undefined,
  max: number = THEME_TITLE_MAX_GRAPHEMES,
): string {
  const cleaned = normalize(String(raw ?? ''));
  if (!cleaned) return '';

  const graphemes = toGraphemes(cleaned);
  if (graphemes.length <= max) return cleaned;

  // 1. Prefer the head clause of a compound title.
  const head = normalize(cleaned.split(COMPOUND_SEPARATORS)[0] ?? '');
  const headGraphemes = toGraphemes(head);
  if (headGraphemes.length > 0 && headGraphemes.length <= max) {
    return head.replace(DANGLING_TRAIL, '');
  }

  // 2. Cut at a grapheme boundary, then drop any trailing glue the cut exposed.
  const cut = graphemes.slice(0, max).join('').replace(DANGLING_TRAIL, '').trim();
  return cut || graphemes.slice(0, max).join('').trim();
}
