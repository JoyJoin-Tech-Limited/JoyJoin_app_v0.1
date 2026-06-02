# Lovart Design Brief: Phase Icon — Speed Friending (快速交友)

> **Status:** 📝 Ready for commission  
> **Asset ID:** `phase-speed-friending`  
> **Target:** WeChat Mini Program (Taro) phase header icon  
> **Display sizes:** 48–80rpx inline, 120rpx hero/modal  
> **Source resolution:** 240×240px  
> **Export:** WebP with transparency + PNG fallback  
> **File naming:** `phase-speed-friending.webp` / `phase-speed-friending.png`

---

## Brand Parameters

| Parameter | Value |
|-----------|-------|
| Primary accent | Fresh Green `#9ACD32` — growth, connection, new bonds |
| Secondary accent | Vibrant Purple `#8B5CF6` — JoyJoin brand identity |
| Warmth | Warm Coral `#FF9B85` — energy peaks, social warmth |
| Background | **Transparent** — assets sit on varied UI surfaces |
| Visual tone | warm, cute-but-tasteful, rounded, soft, lively, minimal-yet-refined |

---

## Prompt (Text-Free)

A dynamic, social icon centered on two friendly rounded figures facing each other in conversation, connected by a subtle circular rotation arrow or loop path suggesting movement and exchange. The two figures occupy 60% of the center composition. A cheerful corgi peeks from the bottom left with an open, welcoming expression, while a wise owl perches on the top right observing the exchange. Fresh green and soft emerald tones dominate with warm coral sparks between the figures suggesting conversation energy. Small clock or timer motifs (abstract, geometric) hint at the timed rotation mechanic. Sparkles and connection lines fill the remaining space. The mood is "New friends, fast — but genuine." Clean, modern illustration style suitable for 80px icon display. No text, no symbols, no readable characters.

---

## Style Lock (画风统一)

Must match the existing 10 phase icons exactly:

- **Construction:** 2D digital illustration with low-poly / geometric faceted aesthetic
- **Textures:** Painterly, soft brushed feel within each polygonal facet — NOT flat vector or 3D render
- **Outlines:** Minimal or none — let facet edges define form
- **Gradients:** Soft color variation within individual facets, not global gradients
- **Backgrounds:** Transparent (no background)
- **Characters:** Geometric polygonal bodies, large expressive glossy eyes, simplified features, warm expressions
- **Composition:** Centered subjects, generous breathing space, 60% dominant subject / 30% archetype framers / 10% atmosphere
- **Color treatment:** Natural warm palette; Fresh Green `#9ACD32` and Vibrant Purple `#8B5CF6` as controlled accents
- **Scale:** Designed to read clearly at 48×48px and 80×80px. Test by viewing at 25% zoom.

---

## Reference Icons

Match the style of:
- `phase-warmup.webp` — sun + corgi + rooster
- `phase-group-mirror.webp` — mirror + dolphin + koala
- `phase-personality-dice.webp` — die + octopus + hamster

---

## Export Requirements

| Format | File name | Size | Background | Save location |
|--------|-----------|------|------------|---------------|
| WebP (primary) | `phase-speed-friending.webp` | 240×240px | Transparent | `apps/mini-program/src/assets/icons/phase-icons/` |
| PNG (fallback) | `phase-speed-friending.png` | 240×240px | Transparent | Same directory |
| CDN path | `/assets/icons/phase-icons/phase-speed-friending.webp` | — | — | Upload via `npm run upload:cdn-assets` |

**File size target:** < 30KB for WebP at 240×240px.

---

## Frontend Integration Notes

Once delivered:

1. Place both `.webp` and `.png` in `apps/mini-program/src/assets/icons/phase-icons/`
2. Upload to CDN via the standard asset upload workflow
3. The code already references this path in `phaseUtils.tsx`:
   ```ts
   speed_friending: cdnAsset('/assets/icons/phase-icons/phase-speed-friending.webp'),
   ```
4. No code changes needed — the asset is hot-swapped.

---

## Review Checklist

- [ ] Style matches existing 10 phase icons (low-poly painterly, geometric faceted)
- [ ] Brand colors (`#9ACD32`, `#8B5CF6`) used consistently and sparingly
- [ ] Reads clearly at 48×48px and 80×80px
- [ ] Transparent background (no white fringes)
- [ ] No text or lettering in the illustration
- [ ] Two figures + rotation/exchange motif clearly readable
- [ ] Corgi and Owl archetype framers present and recognizable
- [ ] File size under 30KB for WebP
- [ ] Naming follows `phase-speed-friending.{webp,png}`
