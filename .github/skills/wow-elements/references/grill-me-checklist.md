# Grill-Me — Wow Elements

> Stress-test polish decisions. One question per turn.
> Every wow element must justify its existence: why here, why now, why this.

## Intent & Restraint

Ask before implementing any wow element:

**Q1:** What's the single most emotionally significant moment in this flow? Why does it deserve polish over others?
- Recommended: One moment identified — completion, reveal, or first meaningful interaction. Not the entire screen.

**Q2:** If someone never sees this animation (reduced motion, slow device, quick navigation), does the feature still work?
- Recommended: Yes. Polish is layered on top of functional completeness. The feature is complete without it.

**Q3:** Is this adding clarity or just decoration? Will the user understand the system state BETTER because of this?
- Recommended: Motion serves purpose — communicates state change, draws attention to result, or softens an abrupt transition. Not gratuitous.

## Performance Guardrails

Ask after implementing:

**Q4:** What properties are being animated? List them. Are they ALL `transform` or `opacity`?
- Recommended: Only compositor-friendly properties. No `width`, `height`, `margin`, `left`, `top`, or `filter: blur()` in animation keyframes.

**Q5:** What's the animation duration? Is it ≤ 200ms for feedback or ≤ 500ms for emotional reveals?
- Recommended: Routine feedback ≤ 200ms. Emotional reveals ≤ 500ms. Nothing over 500ms without documented justification.

**Q6:** Did you test this on a mid-range device (Xiaomi 13, OPPO Reno) AND an iPhone? Show me the frame timing.
- Recommended: Tested on ≥ 2 devices. Zero dropped frames. MediaTek GPU handled the animation without jank.

## Accessibility

Ask before shipping:

**Q7:** Show me the `prefers-reduced-motion` fallback. Is the static state fully readable and understandable?
- Recommended: Static fallback renders all content immediately. CSS `@media (prefers-reduced-motion: reduce)` disables motion. JS `useReducedMotion()` wraps Framer Motion.

**Q8:** Does the animation cause any layout shift (CLS)? Does content jump during or after the animation?
- Recommended: Zero layout shift. Animation space is pre-reserved. `will-change` applied before animation starts.

## Reusability

Ask when the same polish appears in 3+ places:

**Q9:** This pattern appears in multiple places. Should it be a shared component in `packages/shared/src/ui/` or a custom hook?
- Recommended: 3+ uses → extract to shared. One-off → keep inline. Don't over-abstract a single animation.

**Q10:** Is this effect implementable in Taro mini-program primitives? Or does it rely on browser-only APIs?
- Recommended: Taro-compatible: `hover-class`, WXSS `transition`, `Animation` API, or Taro-ported Framer Motion equivalents. No `document.*`, `window.*`, or CSS Houdini.

## 情绪价值 (Emotional Value)

Ask when the polish targets a key emotional moment:

**Q11:** Before adding this polish, did you score the target moment against `docs/reference/emotional-value-rubric.md`? What's the lowest sub-dimension?
- Recommended: Scored all 6 dimensions. The lowest is the highest-ROI polish target. Adding delight to a moment that scores 0 on 归属感 will not move willingness-to-pay.

**Q12:** Which 情绪价值 sub-dimension does this polish improve? Is it the right dimension for this moment?
- Recommended: Match reveal → 仪式感 + 归属感. Onboarding completion → 成就感 + 仪式感. Match explanation → 被理解感. Don't add 惊喜感 when the user needs 被理解感.

**Q13:** Will this polish change how the user feels about *themselves* — not just about the app? If not, it's decoration, not 情绪价值.
- Recommended: Yes. The polish reinforces identity (身份认同), signals belonging (归属感), or creates ceremony (仪式感). Decoration that doesn't shift self-perception should be removed.
