# Lovart Design Brief: Tier Selector Card Backgrounds

> **Status:** ✅ Integrated  
> **Goal:** Create 4 full-card background illustrations for the Social Icebreaker tier-selector cards (3 presets + custom), replacing the plain cream card surface with a softly illustrated oracle-card-style background.  
> **Target:** WeChat Mini Program (Taro)  
> **Integration:** `apps/mini-program/src/pages/icebreaker-session/tier-selector/index.tsx` via `TIER_CARD_BACKGROUNDS` → `cdnAsset('/assets/lovart/icebreaker/tier-card-{token}.webp')`

---

## Brand Parameters

| Parameter | Value |
|-----------|-------|
| Primary color | Vibrant Purple `#8B5CF6` |
| Secondary color | Warm Coral `#FF9B85` |
| Accent green | Soft Lime `#9ACD32` |
| Card surface | Warm cream (`$color-bg-tint-cream`, `#FFFAF4`) — the illustration should sit on and blend into this surface |
| Visual tone | warm, cute-but-tasteful, rounded, soft, lively, minimal-yet-refined |
| Typography | No text in the asset — purely visual/illustrative |

---

## Asset Specifications

- **Type:** 4 full-card background illustrations
- **Platform:** WeChat Mini Program (Taro)
- **Display size:** Full tier card (roughly 686rpx wide × 160–180rpx tall)
- **Source dimensions:** 1137×320px (derived from the source grid; ~1.75 MB PNG)
- **Aspect ratio:** ~3.55:1 (wide horizontal card)
- **Export format:** WebP (opaque — card surface is part of the asset)
- **File naming:**
  - `tier-card-breeze.webp`
  - `tier-card-glow.webp`
  - `tier-card-blaze.webp`
  - `tier-card-custom.webp`
- **Save location:** `apps/mini-program/src/assets/lovart/icebreaker/`

---

## Illustration Inventory

| Token | Tier / Card | Mood | Metaphor direction | Notes |
|-------|-------------|------|--------------------|-------|
| `breeze` | 轻松破冰 (40 min) | light, airy, low-pressure | Soft sparkles, gentle conversation bubbles, floating petals, or a small warm lantern | Should feel like an easy entry point |
| `glow` | 深度畅聊 (60 min, recommended) | warm, intimate, connected | Figures gathered around a warm light, intertwined speech bubbles, or a cozy lantern | Avoid romantic cliché; aim for "real conversation" |
| `blaze` | 游戏狂欢 (90 min) | energetic, playful, celebratory | Trophy, dice, game pieces, confetti, stars | High energy without visual chaos |
| `custom` | 自由局 | open, creative, host-led | A magic wand, remix sliders, puzzle pieces, or a playful wildcard star | Communicates freedom and choice |

---

## Creative Direction

**Feeling:** Each card should feel like a small oracle card — the illustration and the card surface are one continuous piece, not an icon pasted on top.

**Style notes:**
- Match the existing low-poly geometric painterly style used in Batch C ceremony heroes and OracleCard corner assets.
- The art lives on the **left ~40%** of the card and softly fades into the warm cream card surface toward the right.
- Use the card's corner radius; the illustration should feel contained, not spilling awkwardly.
- Primary form color should harmonise with the tier mood:
  - `breeze` — Vibrant Purple accents
  - `glow` — Warm Coral / peach accents
  - `blaze` — Soft Lime / energetic orange accents
  - `custom` — Vibrant Purple + Warm Coral mixed accents
- Soft, diffused shading; no hard black outlines.
- Rounded, almost clay-like forms matching the JoyJoin mascot and ceremony hero style.
- Keep the **right ~60%** of the card relatively empty or low-contrast so the overlaid text content remains legible.
- Do not bake text into the asset — all copy is rendered in code.

---

## Placement Context

The full image becomes the card background; text and UI are overlaid on top:

```
┌──────────────────────────────────────────┐
│ [art]  轻松破冰      对话为主 · 适合初次见面 │
│        40min · 2 个游戏                     │
│        从轻快小游戏开始，慢慢熟络            │
└──────────────────────────────────────────┘
```

Card content has `padding-left: 42%` so it sits in the blank right-hand area of the asset.

---

## Integration Notes

The assets are already wired in `apps/mini-program/src/pages/icebreaker-session/tier-selector/index.tsx`:

```ts
const TIER_CARD_BACKGROUNDS: Record<'breeze' | 'glow' | 'blaze' | 'custom', string> = {
  breeze: cdnAsset('/assets/lovart/icebreaker/tier-card-breeze.webp'),
  glow: cdnAsset('/assets/lovart/icebreaker/tier-card-glow.webp'),
  blaze: cdnAsset('/assets/lovart/icebreaker/tier-card-blaze.webp'),
  custom: cdnAsset('/assets/lovart/icebreaker/tier-card-custom.webp'),
}
```

Each preset card and the custom card render the matching image as an absolute `<Image mode='scaleToFill'>` background layer. Content layers sit above it with `z-index: 1`.

---

## Acceptance Criteria

- [x] Card surface matches the warm cream tone used by the mini-program card component.
- [x] Brand colors match JoyJoin palette exactly.
- [x] Each card reads clearly at mini-program display size.
- [x] All 4 cards share the same low-poly geometric painterly style.
- [x] No text, numbers, or watermarks baked into the asset.
- [x] Each WebP file size ≤ 30 KB.
- [x] Naming matches `tier-card-{token}.webp`.
