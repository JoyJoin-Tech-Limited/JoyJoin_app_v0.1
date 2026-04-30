# Lovart Design Brief: Connections Empty State (`connectionsEmpty`)

## Goal
A warm, encouraging empty-state expression for the Connections page — when a user hasn't made any post-event connections yet. Should feel like "no pressure, but good things are waiting when you go out."

## Brand Parameters
- **Primary color:** Vibrant Purple `#8B5CF6` (hoodie)
- **Secondary colors:** Warm Coral `#FF9B85` (corgi fur highlights), Warm Beige `#F5F1E8` (background atmosphere)
- **Mascot:** Xiaoyue (小悦), the anthropomorphic Welsh Corgi Pembroke AI assistant
- **Typography feel:** Rounded and friendly Chinese display (AlimamaFangYuanTiVF feel), soft geometric English (Quicksand feel)
- **Visual tone:** Warm, cute but tasteful, rounded and soft, lively and breathable, minimal yet refined

## Asset Specifications
- **Type:** mascot-illustration
- **Platform:** WeChat Mini Program (Taro)
- **Dimensions:** 2000×3000px source → optimized to 480px width WebP
- **Aspect ratio:** 2:3 portrait
- **Export format:** PNG with transparency (master), WebP 480px (production)
- **Minimum resolution:** 2× for retina

## Prompt Draft (Paste into Lovart ChatCanvas)

```
Goal: A warm, gently encouraging empty-state expression for a "no connections yet" screen. This should feel like a friend saying "nothing here yet, but that's because you haven't been to the next event — and it's going to be great."

Character: Xiaoyue, the anthropomorphic corgi in a lightly weathered purple hoodie (#8B5CF6), sunglasses hanging from collar, vintage leather watch, silver chain. Hopeful, inviting posture — one paw slightly extended forward in a relaxed "come with me" gesture, the other in the hoodie pocket. Short corgi legs in a casual, ready-to-walk stance. Head tilted 10° toward the viewer with a soft, encouraging smile — not overly excited, not disappointed. Just warm and ready. Eyes looking slightly downward with gentle optimism, faint purple halo in pupils. Big upright ears in alert-but-friendly position.

Face: Soft encouraging smile, gentle optimism
Eyes: Looking slightly down with warm "let's go" energy
Eyebrows: Relaxed, neutral curve with a hint of upward optimism
Energy: Moderate / Encouraging

Style (插画风):
- 2D low-poly geometric faceted aesthetic, painterly textured rendering within facets
- Minimal outlines, facet edges define form
- Soft gradients within polygonal facets
- Atmospheric textured background with subtle grain
- Circular vignette composition

Brand colors: Vibrant Purple #8B5CF6 (hoodie), Warm Coral #FF9B85 (corgi fur highlights), Warm Beige #F5F1E8 (background)

Mood: "Nothing here yet, but the next event is going to change that."

Composition: Centered character, generous breathing space, circular vignette

Export: PNG with transparency, 2000x3000px
```

## Export Requirements
- **File naming:** `xiaoyue-connections-empty_master.png` → `xiaoyue-connections-empty.webp`
- **Save location:** `apps/mini-program/src/assets/personality/xiaoyue/` (CDN path: `/assets/personality/xiaoyue/xiaoyue-connections-empty.webp`)
- **Lazy loading:** Yes — empty state is conditional
- **Subpackage:** Main bundle (small WebP, <30KB)

## Code Integration (post-generation)

1. Add `connectionsEmpty` to `XiaoyueExpressionId` in `apps/mini-program/src/lib/xiaoyueExpressions.ts`
2. Add asset path: `xiaoyue-connections-empty.webp`
3. Update Connections page empty state to use `getXiaoyueExpressionAsset('connectionsEmpty')`

## Review Checklist
- [ ] Brand colors match JoyJoin palette exactly
- [ ] Xiaoyue is visually distinct from 气氛组柯基 (purple hoodie + accessories)
- [ ] Expression is encouraging but not overly cheerful
- [ ] Low-poly geometric construction consistent with existing 16 expressions
- [ ] Export format appropriate for mini-program (WebP, transparent)
- [ ] File size acceptable (<50KB after `npm run optimize:xiaoyue`)

## Anti-generic test
This should NOT look like a generic social app empty state. The weathered hoodie, hanging sunglasses, low-poly corgi construction, and warm painterly texture should make it unmistakably JoyJoin.
