# Grill-Me — Frontend Design Audit

> Stress-test design quality scores. One question per turn.
> Every dimension score must be defendable with specific evidence.

## Brand Fidelity (Dimension 1)

Ask when any dimension 1 score < 4:

**Q1:** Show me exactly where this screen uses brand colors from tokens vs hardcoded hex values.
- Recommended: All colors from token system. No raw hex values. Brand purple (`$color-primary`) used intentionally, not everywhere.

**Q2:** Where is the mascot (Xiaoyue) on this screen? Is its placement intentional or an afterthought?
- Recommended: Mascot has a clear role — coaching, celebration, or companionship. Not randomly placed.

**Q3:** Does this screen feel unmistakably JoyJoin, or could it be any other app? What makes it JoyJoin-specific?
- Recommended: JoyJoin-specific elements present: warm beige backgrounds, rounded forms, Xiaoyue, conversational Chinese copy, restrained purple accents.

## State Completeness (Dimension 2)

Ask when dimension 2 < 4:

**Q4:** Show me every state this component/screen can be in. Walk me through: loading → empty → error → success → disabled → busy.
- Recommended: All six states exist and are visually distinct. No state is a plain text fallback.

**Q5:** What does the error state look like? Is there a retry action? What error message does the user see?
- Recommended: Error state has branded illustration, warm copy, and a retry CTA. Error message is Chinese, human-readable, not a raw code.

**Q6:** What happens on the empty state? Does it feel hopeful or dead? Is there a CTA to populate data?
- Recommended: Empty state has Xiaoyue illustration, uplifting copy, and a clear next action. Not a blank page.

## Token Discipline (Dimension 3)

Ask when dimension 3 < 4:

**Q7:** How many unique color values appear in this component's SCSS? Count them. Are they ALL from tokens?
- Recommended: ≤ 5 unique color tokens. All from `$color-*` variables. No raw hex/rgb values.

**Q8:** Are spacing values consistent? Show me any two adjacent sections with different spacing — why?
- Recommended: Spacing uses token values (8/16/24/40/64rpx). Any deviation has documented reason.

## Platform Safety (Dimension 4)

Ask when dimension 4 < 4:

**Q9:** Show me the smallest screen this was tested on (iPhone SE, 375px width). Any horizontal overflow or truncated content?
- Recommended: No horizontal scroll. Content reflows correctly. Touch targets ≥ 88rpx even at minimum width.

**Q10:** Did you test on a real mini-program device, not just DevTools? Show me a screenshot from a physical iPhone 15 or vivo X100.
- Recommended: Screenshot from at least one physical device. DevTools can hide WKWebView-specific rendering bugs.

## Motion Hygiene (Dimension 5)

Ask when dimension 5 < 4:

**Q11:** List every animation on this screen. For each: is it `transform`/`opacity` only? Does it respect `prefers-reduced-motion`?
- Recommended: All animations use only compositor properties. Every animation has a reduced-motion static fallback.

**Q12:** What's the total animation duration budget for this screen? Is anything over 500ms justified?
- Recommended: Routine feedback ≤ 200ms, emotional reveals ≤ 500ms. Nothing over 500ms without explicit reason.
