# Lovart Design Brief: Tier Preset Icons

> **Status:** 📝 Superseded by [`lovart-brief-tier-selector-side-art-20260625.md`](./lovart-brief-tier-selector-side-art-20260625.md)  
> **Goal:** ~~Create 3 small, brand-aligned icons for the Social Icebreaker tier-selector preset cards, replacing the current colored placeholder dots.~~  
> The design direction has shifted to Oracle-card-style right-side illustrations for all 4 tier cards. This brief is kept for reference only.  
> **Target:** WeChat Mini Program (Taro)  
> **Integration:** `apps/mini-program/src/pages/icebreaker-session/tier-selector/index.tsx` via `iconToken` → future `localAsset('/assets/icons/tier-preset-{token}.webp')`

---

## Brand Parameters

| Parameter | Value |
|-----------|-------|
| Primary color | Vibrant Purple `#8B5CF6` |
| Secondary color | Warm Coral `#FF9B85` |
| Accent green | Soft Lime `#9ACD32` |
| Background | **Transparent** (PNG alpha) — sits on a warm cream card surface |
| Warm Beige | `#F5F1E8` |
| Visual tone | warm, cute-but-tasteful, rounded, soft, lively, minimal-yet-refined |
| Typography | No text in the asset — purely visual/iconic |

---

## Asset Specifications

- **Type:** 3 single expressive icons
- **Platform:** WeChat Mini Program (Taro)
- **Display size:** 48rpx inside a 96rpx circular placeholder area
- **Source dimensions:** 96×96px (2× for crisp downscaling)
- **Aspect ratio:** 1:1
- **Export format:** WebP with alpha transparency
- **File naming:** `tier-preset-sparkle.webp`, `tier-preset-heart.webp`, `tier-preset-controller.webp`
- **Save location:** `apps/mini-program/src/assets/icons/tier-preset-sparkle.webp`, etc.

---

## Icon Inventory

| Token | Preset title | Preset vibe | Metaphor direction | Notes |
|-------|--------------|-------------|--------------------|-------|
| `sparkle` | 轻松破冰 | balanced / light conversation | A small sparkle, star burst, or gentle conversation bubble | Should feel light, inviting, low-pressure |
| `heart` | 深度畅聊 | deep_chat / connection | A soft heart, two leaning figures, or warm speech bubble | Should feel intimate but not romantic/clinical |
| `controller` | 游戏狂欢 | play_fun / games | A tiny game controller, playful star, or bouncing figure | Should feel energetic and fun |

---

## Creative Direction

**Feeling:** Each icon should telegraph the *intention* of the preset at a glance.

**Style notes:**
- Match the existing low-poly geometric painterly style used in Batch A/B icons.
- Keep forms simple and centered; they will be displayed inside a 96rpx circle.
- Use Vibrant Purple as the primary form color with Warm Coral or Soft Lime as small accent glows.
- Soft, diffused shading; no hard black outlines.
- Rounded, almost clay-like forms matching the JoyJoin mascot and ceremony hero style.

**Mood by token:**
- `sparkle` — light, friendly, “let’s ease in”
- `heart` — warm, curious, “let’s actually talk”
- `controller` — playful, energetic, “let’s have fun”

---

## Placement Context

The icons sit on the left side of each preset card in the icebreaker tier selector:

```
┌─────────────────────────────────────┐
│ [●]  轻松破冰  对话为主 · 适合初次见面 │
│      40min · 2 个游戏                │
│      从轻快小游戏开始，慢慢熟络        │
├─────────────────────────────────────┤
│ [●]  深度畅聊  沉浸交流 · 默认推荐     │
│      60min · 3 个游戏                │
│      更多走心话题，聊到停不下来        │
├─────────────────────────────────────┤
│ [●]  游戏狂欢  活力互动 · 适合熟人群体 │
│      90min · 5-6 个游戏              │
│      全量游戏环节，玩得过瘾            │
└─────────────────────────────────────┘
```

Card background: warm cream (`$color-bg-tint-cream`). The icon area is a 96rpx circle with a subtle tinted background.

---

## Integration Notes

Once assets are delivered, update `apps/mini-program/src/pages/icebreaker-session/tier-selector/index.tsx`:

1. Place the WebP files in `apps/mini-program/src/assets/icons/`.
2. Replace the placeholder dot:

```tsx
// Before
<View className={`tier-selector__preset-icon-dot tier-selector__preset-icon-dot--${preset.iconToken}`} />

// After
<Image
  className='tier-selector__preset-icon-image'
  src={localAsset(`/assets/icons/tier-preset-${preset.iconToken}.webp`)}
  mode='aspectFit'
  lazyLoad
/>
```

3. Update this brief status to **Integrated**.

---

## Acceptance Criteria

- [ ] Transparent background, no stray pixels.
- [ ] Brand colors match JoyJoin palette exactly.
- [ ] Each icon reads clearly at 48×48rpx display size.
- [ ] All 3 icons share the same low-poly geometric painterly style.
- [ ] No text, numbers, or watermarks.
- [ ] Each WebP file size ≤ 8 KB.
- [ ] Naming matches `tier-preset-{token}.webp`.
