# Lovart Design Brief: Custom Tier Icon

> **Status:** 📝 Ready for commission  
> **Goal:** Replace the broken placeholder on the Social Icebreaker tier-selector "自由局" (custom mode) card with a cohesive, brand-aligned proprietary icon.  
> **Target:** WeChat Mini Program (Taro)  
> **Integration:** `apps/mini-program/src/pages/icebreaker-session/tier-selector/index.tsx` via `localAsset('/assets/icons/custom-tier-icon.webp')`

---

## Brand Parameters

| Parameter | Value |
|-----------|-------|
| Primary color | Vibrant Purple `#8B5CF6` |
| Secondary color | Warm Coral `#FF9B85` |
| Background | **Transparent** (PNG alpha) — sits on a warm cream card surface |
| Warm Beige | `#F5F1E8` |
| Visual tone | warm, cute-but-tasteful, rounded, soft, lively, minimal-yet-refined |
| Typography | No text in the asset — purely visual/iconic |

---

## Asset Specifications

- **Type:** single expressive icon
- **Platform:** WeChat Mini Program (Taro)
- **Display size:** 96×96rpx
- **Source dimensions:** 256×256px (2× for crisp downscaling)
- **Aspect ratio:** 1:1
- **Export format:** WebP with alpha transparency
- **File naming:** `custom-tier-icon.webp`
- **Save location:** `apps/mini-program/src/assets/icons/custom-tier-icon.webp`

---

## Creative Direction

**Feeling:** Freedom, creativity, mix-and-match, "this round is yours to design."

**Visual concept:** A small, friendly rounded character or abstract object that conveys *customization* and *playful control*. Preferred metaphors (choose one or blend subtly):
- A soft magic wand / sparkle pen drawing a small constellation of hearts or stars
- A rounded DJ controller or mixing board with two soft knobs and a playful glow
- A puzzle piece morphing into a heart, suggesting "you put the pieces together"

**Style notes:**
- Keep it simple and readable at 96rpx.
- Use Vibrant Purple `#8B5CF6` as the main form color with Warm Coral `#FF9B85` as a small accent glow or sparkle.
- Soft, diffused shading; no hard black outlines.
- Rounded, almost clay-like forms matching the Lovart ceremony hero style.
- Centered composition with comfortable padding so it never touches the edges.

**Mood:** Inviting, light, empowering — not complicated or cluttered.

---

## Placement Context

The icon sits on the left side of the custom-mode card in the icebreaker tier selector:

```
┌─────────────────────────────────────┐
│ [icon]  自由局  自由定制            │
│         想玩哪个，由你决定          │
│         时长由你决定 · 环节自由组合 │
└─────────────────────────────────────┘
```

Card background: warm cream (`$color-bg-tint-cream`). The icon should feel like a friendly badge, not a dense illustration.

---

## Acceptance Criteria

- [ ] Transparent background, no stray pixels.
- [ ] Purple-forward with coral accent; matches JoyJoin palette exactly.
- [ ] Crisp and centered when displayed at 96×96rpx.
- [ ] No text, numbers, or watermarks.
- [ ] File size ≤ 8 KB after WebP optimization.
