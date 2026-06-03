# Grill-Me — Mini-Program Frontend Excellence

> Stress-test mini-program implementation quality. One question per turn.
> Ask only questions matching changed scope. Stop when all triggered branches resolve.

## Pixel Precision

Ask when implementing new layout or spacing changes:

**Q1:** Are all spacings on the 8rpx grid? Show me any deviation.
- Recommended: Multiples of 8rpx. 4rpx only for hairlines/optical tweaks with a comment explaining why.

**Q2:** Did you verify computed layout in WeChat DevTools on the changed screens? Show me the measured values.
- Recommended: Yes, screenshots or selector notes attached. DevTools computed pane confirms spacing matches spec.

**Q3:** Any `px` values in SCSS instead of `rpx`? Any `vh`/`vw` units?
- Recommended: No. All layout uses `rpx`. No browser-only units.

## Taro Discipline

Ask when adding new components or pages:

**Q4:** Are all components from `@tarojs/components` (`View`, `Text`, `Image`, `ScrollView`)? Any `dangerouslySetInnerHTML` or raw HTML?
- Recommended: Only Taro primitives. No `dangerouslySetInnerHTML`. Rich content uses `RichText`.

**Q5:** Does the list use `VirtualList` for anything that can exceed 50 items? What's the max expected count?
- Recommended: VirtualList for any list capable of exceeding 50. If bounded ≤ 30, document the bound.

**Q6:** Are animations limited to `transform` + `opacity` only? Any layout-triggering properties in transitions?
- Recommended: Only compositor-friendly properties. Entrance uses `cubic-bezier(0.22, 1, 0.36, 1)`.

## State Completeness

Ask when implementing interactive UI:

**Q7:** Show me the loading state, empty state, error state, and disabled state for this component.
- Recommended: All four states exist. Skeleton matches content shape. Error has retry. Empty has branded illustration + CTA.

**Q8:** What happens when the user rapidly taps the CTA twice? Is there press feedback on every interactive element?
- Recommended: Double-tap guarded (loading/disabled during submission). Every tappable element has `hover-class` or visible feedback.

## Brand & Feel

Ask when new screens or visual changes:

**Q9:** Show me how this screen looks on a vivo or OPPO device (MediaTek GPU). Does it still feel premium?
- Recommended: Tested on ≥1 non-Snapdragon device. MediaTek GPUs render `box-shadow` and `border-radius` differently.

**Q10:** Is `prefers-reduced-motion` respected for all animations? Show me the static fallback.
- Recommended: CSS `@media (prefers-reduced-motion: reduce)` + JS fallback. Fallback is readable without animation.

**Q11:** Are CJK text blocks free of `overflow-wrap: anywhere`? Any 孤字 (orphan characters) on their own line?
- Recommended: No `overflow-wrap: anywhere` on display text. Containers are ≥ font-size × 8 wide.

## Cross-Device

Ask when touching layout, animation, or canvas:

**Q12:** Tested on iPhone specifically? WKWebView handles `backdrop-filter`, `position: fixed` + keyboard, and canvas WebP differently from Chromium.
- Recommended: Tested on physical iPhone 15/16. Safe area insets verified. Canvas WebP fallback works.
