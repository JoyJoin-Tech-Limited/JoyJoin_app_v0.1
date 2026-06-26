# Lovart Design Brief: Custom Tier Icon

> **Status:** 📝 Ready for commission  
> **Goal:** Create a single brand-aligned icon for the Social Icebreaker tier-selector "自由局" (custom mode) card, replacing or formalizing the current `custom-tier-icon.webp` asset.  
> **Target:** WeChat Mini Program (Taro)  
> **Integration:** `apps/mini-program/src/pages/icebreaker-session/tier-selector/index.tsx` via `localAsset('/assets/icons/custom-tier-icon.webp')`

---

## Brand Parameters

| Parameter | Value |
|-----------|-------|
| Primary color | Vibrant Purple `#8B5CF6` |
| Secondary color | Warm Coral `#FF9B85` |
| Accent green | Soft Lime `#9ACD32` |
| Background | **Transparent** (WebP alpha) — sits on a warm cream card surface |
| Warm Beige | `#F5F1E8` |
| Visual tone | warm, cute-but-tasteful, rounded, soft, lively, minimal-yet-refined |
| Typography | No text in the asset — purely visual/iconic |

---

## Asset Specifications

- **Type:** 1 single expressive icon
- **Platform:** WeChat Mini Program (Taro)
- **Display size:** 96rpx inside a 96rpx square image area
- **Source dimensions:** 192×192px (2× for crisp downscaling)
- **Aspect ratio:** 1:1
- **Export format:** WebP with alpha transparency
- **File naming:** `custom-tier-icon.webp`
- **Save location:** `apps/mini-program/src/assets/icons/custom-tier-icon.webp`

---

## Icon Inventory

| Token | Card title | Card vibe | Metaphor direction | Notes |
|-------|------------|-----------|--------------------|-------|
| `custom` | 自由局 | freeform / host-driven | A small magic wand, remix sliders, puzzle pieces, or a playful wildcard star | Should feel open, creative, and host-empowering — not chaotic |

---

## Creative Direction

**Feeling:** The icon should say "this one is yours to shape" at a glance.

**Style notes:**
- Match the existing low-poly geometric painterly style used in Batch A/B icons and the tier preset icons.
- Keep the form simple and centered; it will be displayed inside a 96rpx square.
- Use Vibrant Purple as the primary form color with Warm Coral or Soft Lime as small accent glows.
- Soft, diffused shading; no hard black outlines.
- Rounded, almost clay-like forms matching the JoyJoin mascot and ceremony hero style.
- Avoid imagery that feels like "settings" or "admin" — this is a playful, social freedom, not a configuration panel.

**Mood:**
- `custom` — open, playful, "you're in charge"

---

## Placement Context

The icon sits on the left side of the custom-mode card in the icebreaker tier selector:

```
┌─────────────────────────────────────────┐
│ [●]  自由局     自由定制                 │
│      想玩哪个，由你决定                  │
│      时长由你决定 · 环节自由组合         │
└─────────────────────────────────────────┘
```

Card background: warm cream (`$color-bg-tint-cream`) with a subtle gradient. The icon area is a 96rpx square with rounded corners.

---

## Integration Notes

Once the asset is delivered, update `apps/mini-program/src/pages/icebreaker-session/tier-selector/index.tsx` if the path or component changes:

1. Place the WebP file in `apps/mini-program/src/assets/icons/`.
2. The current integration is already:

```tsx
<Image
  className='tier-selector__custom-card-icon'
  src={localAsset('/assets/icons/custom-tier-icon.webp')}
  mode='aspectFit'
  lazyLoad
/>
```

3. Update this brief status to **Integrated**.

---

## Acceptance Criteria

- [ ] Transparent background, no stray pixels.
- [ ] Brand colors match JoyJoin palette exactly.
- [ ] Icon reads clearly at 96×96rpx display size.
- [ ] Shares the same low-poly geometric painterly style as the preset icons.
- [ ] No text, numbers, or watermarks.
- [ ] WebP file size ≤ 12 KB.
- [ ] Naming matches `custom-tier-icon.webp`.
