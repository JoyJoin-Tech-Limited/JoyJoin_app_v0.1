# Grill-Me — UI Layout Audit

> Stress-test layout decisions. One question per turn.
> Every finding must tie to a concrete measurement, not a vibe.

## Spacing Hierarchy

Ask when scoring any screen:

**Q1:** What's the vertical gap between each pair of adjacent layers? Map them for me top to bottom.
- Recommended: Every gap measured in rpx. Default inter-section is 24rpx; major breaks at 40rpx. No gap < 12rpx.

**Q2:** Any gap between 16rpx and 24rpx where the relationship is ambiguous? Does the spacing show hierarchy or is it uniform?
- Recommended: Spacing hierarchy is clear. Parent-child sections use smaller gaps; sibling sections use consistent spacing.

**Q3:** Are there any `ResponsiveSpacer` nodes with `heightRpx` values that duplicate what `gap` on the parent already achieves?
- Recommended: No redundancy. Either `gap` on the flex container OR `ResponsiveSpacer` between elements — never both.

## Typography

Ask when text is present:

**Q4:** What's the line-height on the primary display text? Body text? Are they ≥ 1.4 and ≥ 1.6 respectively?
- Recommended: Display ≥ 1.4, body ≥ 1.6. Anything tighter feels suffocating on Chinese text.

**Q5:** Show me the heading/body/meta size hierarchy. Are there at least 8rpx + 100 font-weight difference between levels?
- Recommended: Clear hierarchy. At minimum: heading 48rpx bold, body 32rpx regular, meta 24rpx light.

**Q6:** Any paragraph longer than 10 lines without visual relief (image, pull quote, spacing break)?
- Recommended: No. Text walls > 10 lines need a breathing moment — image, icon, or generous paragraph break.

## Emoji & Copy

Ask when primary copy is present:

**Q7:** Are there any emojis in headings, CTA labels, or primary questions?
- Recommended: Zero emojis in primary copy. Emojis allowed only in mascot speech, decorative badges, celebration states.

## Visual Coherence

Ask when text width is constrained:

**Q8:** Does any headline or button produce a lone character on its own row? Test on iPhone SE width (375px).
- Recommended: No 孤字. Containers ≥ font-size × 8 wide. `word-break: keep-all` on short display text.

**Q9:** Are there any English words inside Chinese copy that could break mid-word?
- Recommended: English words wrapped in `nowrap` or using `word-break: keep-all`.

## Emotional Craft

Ask when the layout feels "off":

**Q10:** Looking at this screen, does every element feel intentional or assembled? Point to anything that feels like a placeholder.
- Recommended: All elements have purpose. Nothing feels default-looking. Card borders, dividers, and backgrounds all feel chosen.

**Q11:** What's the reading rhythm? Does the eye flow naturally or jump between competing focal points?
- Recommended: Clear focal hierarchy. One primary element per section. No competing visual weights at the same level.
