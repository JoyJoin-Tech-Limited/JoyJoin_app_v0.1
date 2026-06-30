# Lovart Prompt: Event Ticket Payment Success Hero v2

## Role
You are an elite illustration prompt engineer for JoyJoin, a warm, social-discovery mini-program brand. Your job is to craft a Lovart-ready prompt that maximizes 情绪价值 (emotional value) for the payment-success screen.

## Output requirement
Return **only** the final Lovart prompt plus a short rationale. No extra commentary, no markdown headers inside the prompt block.

---

## Prompt (copy-paste into Lovart ChatCanvas)

```
A warm, full-bleed JoyJoin ceremony illustration for a WeChat Mini Program success screen.

Scene: Xiaoyue (悦仔), the small corgi mascot in a purple hoodie, stands on the right, one paw reaching toward a glowing golden event ticket. Beside him on the left is a cheerful small rooster mascot (小太阳鸡) with warm golden-orange feathers, a soft rounded crest, and a gentle smile, wings slightly open in celebration. The golden ticket floats between them, emitting a soft warm light and a few sparkles. A few ribbons and paper confetti pieces hang in the upper area of the scene. The bottom third of the image dissolves into a clean, flat Warm Beige #F5F1E8 wash with generous negative space.

Background: breathable Warm Beige #F5F1E8 with subtle textured grain, circular vignette feel, soft and airy.

Colors: Vibrant Purple #8B5CF6 for Xiaoyue's hoodie accents and small confetti; warm golden-orange #FBBF24 / #FF9B85 for the rooster's feathers, ticket glow, sparks and ribbon highlights. Keep accents controlled and warm, never neon.

Style: 2D digital illustration, low-poly / geometric faceted aesthetic, painterly textured rendering with soft brushed feel inside each facet, soft gradients within polygonal shapes, minimal or no outlines, atmospheric grain, circular vignette, centered composition.

Mood: warm / cute / rounded / soft / lively / refined / celebratory / slightly magical.

Important: no sunglasses, no text, no watermarks, no photorealism, no harsh shadows, no dark vignette. Both characters look at the viewer with gentle, happy eyes. The scene should feel like a shared private celebration, not a marketing poster.

Canvas: 750 x 604 px, bottom ~180 px should be a near-flat #F5F1E8 wash for seamless text overlay.
```

---

## Style-reference uploads (attach before generating)
1. `apps/mini-program/src/assets/ceremony/welcome-back-hero-20260604-v1.webp` — primary style lock for low-poly geometric painterly style, warm palette, grain texture, and circular vignette.
2. `tmp/xiaoyue-reference-grid.webp` — canonical Xiaoyue / 悦仔 model reference (purple hoodie, sunglasses-free expressions, mascot proportions).
3. Current old asset `apps/mini-program/src/assets/ceremony/event-ticket-success-20260616-v1.webp` — negative example of what to avoid: do not make the characters stiff or the composition look like a posed证件照.

---

## Xiaoyue copy for the screen (must maximize 情绪价值)

The text that appears below this illustration must feel like Xiaoyue is speaking directly to the user after a small victory. Based on PM review, the default should be warm but concise — paid-success moments need truth and a clear next step before poetic flourish.

### Recommended default (matching-in-progress state)
```
{DEFAULT_MASCOT_DISPLAY_NAME}已收到你的入场券，正在为你匹配合适的伙伴。
```

### Recommended default (pool not yet matching)
```
报名成功！{DEFAULT_MASCOT_DISPLAY_NAME}拿着你的入场券，匹配开始前会第一时间通知你。
```

### Alternative three-line "craft" variant (use only in A/B test)
Matching-in-progress state:
```
{DEFAULT_MASCOT_DISPLAY_NAME}已收到你的入场券。
入场券在手里亮了一下。
匹配引擎正在为你找人。
```

Expectation-setting state:
```
{DEFAULT_MASCOT_DISPLAY_NAME}把你的入场券收好了。
匹配开始前，会第一时间通知你。
现在可以安心去忙别的。
```

### Why the default works
- **节奏:** 一句说完，不挡 CTA。
- **画面感:** 「收到」「拿着」「通知你」都是可被感知动作。
- **温度:** 悦仔是陪伴者，不是系统通知。
- **落点:** 指向匹配/通知，让用户知道下一步。
- **AI味儿屏蔽:** 无「总的来说」「值得注意的是」「你容易」等词。
- **PM guard:** 在付费成功瞬间，用户需要事实 + 预期，不是三行诗。

---

## Export requirements
- **WebP primary:** `event-ticket-success-20260701-v2.webp`, q=55, 750×604 px
- **PNG fallback:** `event-ticket-success-20260701-v2.png`
- **File size target:** < 120 KB WebP, < 300 KB PNG fallback
- **CDN path:** `/assets/ceremony/event-ticket-success-20260701-v2.webp`
- **Local path:** `apps/mini-program/src/assets/ceremony/`
- **Processed asset source:** `apps/mini-program/assets-source/lovart/registration flow/reg success screen.png`

## Review checklist for the generated image
- [ ] Background is exactly Warm Beige #F5F1E8, flat in the bottom 180 px
- [ ] Xiaoyue and the small sun rooster (小太阳鸡) are both present, warm-eyed, no sunglasses
- [ ] Golden ticket glows softly between them
- [ ] Confetti/ribbons stay in the upper half, do not crowd text area
- [ ] No text, no watermarks, no photorealism
- [ ] Style matches `welcome-back-hero-20260604-v1.webp`
- [ ] File size under 120 KB WebP

## Implementation notes
- The asset is rendered full-bleed with `mode='widthFix'` inside `.ticket-success__hero-wrap`.
- `.ticket-success__hero-wrap` has `min-height: 560rpx` to keep the faded-bottom characters emotionally present.
- A CSS `linear-gradient` bridge (180rpx tall) overlays the bottom of the hero to dissolve into `$color-bg-warm-to` (#F5F1E8).
- The message body is pulled up with `margin-top: -48rpx` so the text block reads as a continuation of the scene.
- No `backdrop-filter` or edge blur is used — blending is achieved via color-match + gradient bridge.
