# Lovart Design Brief: 话题卡 (Topic Card) Phase Icon

## Goal
Create a warm, inviting phase icon for "话题卡" (Topic Cards) — the AI-generated conversation prompt feature in JoyJoin's social icebreaker toolkit. This icon will live on the landing page alongside 4 existing phase icons (谁是卧底, 性格骰子, 微挑战, 迷你剧本杀), so it must share the same visual language and weight.

## Brand Parameters
- **Primary color:** Vibrant Purple `#8B5CF6` — AI/magic accent
- **Secondary colors:** Warm Coral `#FF9B85` for emotional warmth, Sky Blue `#A8C5DD` for trust/calm
- **Background:** Transparent (PNG alpha) — icons sit on varied card backgrounds
- **Mascot:** Optional — if including a character, use 气氛组柯基 (Corgi) or 情绪树洞考拉 (Koala) in a curious/listening pose, representing the act of sparking conversation
- **Typography feel:** Not applicable — icon should be visual-only, no text
- **Visual tone:** warm, cute, rounded, soft, lively, minimal, refined, breathable

## Asset Specifications
- **Type:** icon (phase emblem)
- **Platform:** WeChat Mini Program (Taro)
- **Dimensions:** 240×240px (matches existing phase icon standard)
- **Aspect ratio:** 1:1
- **Export format:** PNG with transparency + WebP optimized version
- **Minimum resolution:** 2x (480×480px source, exported at 240×240px display)

## Prompt Draft

> **Goal:** A single feature icon for "Topic Cards" — an AI-powered conversation prompt game where players draw cards with thoughtful questions to spark deeper dialogue.
>
> **Visual concept:** A rounded, friendly card or speech-bubble shape floating gently, with a warm sparkle or heart accent to suggest emotional connection. Optional: a small cute animal paw or mascot peek (Corgi or Koala) holding or presenting the card. The card itself can have soft lines suggesting text or a question mark.
>
> **Style lock (画风统一):**
> - 2D digital illustration with low-poly / geometric faceted aesthetic
> - Painterly, textured rendering with soft brushed feel within each facet
> - Soft gradients within polygonal facets
> - Minimal or no outlines — facet edges define form
> - Atmospheric textured background with subtle grain/noise
> - Circular vignette composition
> - Warm natural palette with controlled purple accent
>
> **Brand colors:**
> - Vibrant Purple `#8B5CF6` for key accent elements (sparkle, card edge, mascot accessory)
> - Warm Coral `#FF9B85` for warmth highlights
> - Sky Blue `#A8C5DD` for soft secondary accents
> - Warm Beige `#F5F1E8` for neutral grounding
>
> **Mood:** Curious, warm, inviting — like receiving a handwritten note from a thoughtful friend.
>
> **Composition:** Centered subject, generous negative space, circular vignette framing. The icon should read clearly at 72×72rpx on a mobile screen.
>
> **Anti-generic test:** This should feel unmistakably JoyJoin — soft, polygonal, painterly, with gentle warmth. It should NOT look like a generic flat vector chat icon or a corporate messaging app logo.
>
> **Export:** PNG transparent background, 240×240px display size (480×480px source), plus WebP optimized version.

## Consistency Reference
This icon must visually harmonize with the existing phase icon set located at:
```
apps/mini-program/src/assets/icons/phase-icons/phase-undercover-word.png
apps/mini-program/src/assets/icons/phase-icons/phase-personality-dice.png
apps/mini-program/src/assets/icons/phase-icons/phase-micro-challenge.png
apps/mini-program/src/assets/icons/phase-icons/phase-mini-script.png
```

All existing phase icons are 240×240px, low-poly geometric style, with warm painterly textures and minimal outlines. Please match their stroke weight, color saturation, and "faceted illustration" style exactly.

## Export Requirements
- **File naming:** `phase-topic-card.png` / `phase-topic-card.webp`
- **Save location:** `apps/mini-program/src/assets/icons/phase-icons/`
- **Lazy loading:** No — this icon loads on the landing page, which is in the main bundle
- **Subpackage:** Main bundle

## Review Checklist
- [ ] Brand colors match JoyJoin palette exactly (purple `#8B5CF6`, coral `#FF9B85`)
- [ ] Mascot personality (if used) is consistent with character guide
- [ ] Icon is legible at 72×72rpx mobile display size
- [ ] No unintended sharp edges or cold textures
- [ ] Export format is PNG + WebP for mini-program compatibility
- [ ] File size is acceptable for main bundle loading (< 30KB WebP target)
- [ ] Anti-generic test passed — cannot be mistaken for a generic dating/social app icon
