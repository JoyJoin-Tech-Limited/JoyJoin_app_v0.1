# Lovart Brief — Xiaoyue City Unlock Expression

> **Status:** ✅ Implemented — asset integrated in City Unlock v0.1 (2026-05-19).
>
> **Goal:** A warm, adventurous expression for the city-unlock progress screen. Xiaoyue is setting off on a journey to reach the user's city — carrying a small paper airplane and a folded map. The mood is "excited but reliable" — this corgi has packed his bags and is genuinely on his way.
>
> **Related:** `docs/archive/xiaoyue/xiaoyue-lovart-prompts.md` (character model lock)
>
> **Shipped asset:** `xiaoyue-city-unlock.webp` (~50KB) referenced via `getXiaoyueExpressionAsset('cityUnlock')` on `pages/city-unlock/index`.

---

## Prompt — Paste into Lovart ChatCanvas

```
Goal: A warm, adventurous expression for the city-unlock progress screen. Xiaoyue is setting off on a journey to reach the user's city.

Character: Xiaoyue, the anthropomorphic Welsh Corgi Pembroke AI assistant — relaxed, street-smart, "seen it all" but still gets excited about new places. Wearing his signature lightly weathered purple hoodie (#8B5CF6) with "JoyJoin" small on left chest, sunglasses hanging from collar, vintage leather watch, silver chain necklace.

Pose & Props:
- Confident, forward-leaning traveler's stance — weight on front paws as if mid-stride or about to step off
- One paw holding a small folded paper airplane (origami style, white with a faint purple accent stripe)
- The other paw casually holding a small rolled-up map (beige/tan, tied with a thin cord)
- Short corgi legs in a dynamic "let's go" stance, fluffy butt slightly raised with energy
- Head tilted 10° toward viewer with an eager, genuine grin — "I'm on my way to you!"
- Big upright ears perked forward in alert-excited mode (this is an adventure, not a casual stroll)

Face: Eager, genuine adventure grin — mouth slightly open in happy anticipation
Eyes: Bright and warm, looking slightly downward-toward viewer with "see you soon" warmth
Eyebrows: Slightly raised, adding excitement without becoming cartoonish
Energy: Moderate-High / Adventurous

Style (插画风统一 — MANDATORY):
- 2D low-poly geometric faceted aesthetic, painterly textured rendering within facets
- Minimal outlines, facet edges define form
- Soft gradients within polygonal facets
- Atmospheric textured background with subtle grain — suggest a soft sky/atmosphere with Warm Beige (#F5F1E8) and very subtle Sky Blue (#A8C5DD) hints
- Circular vignette composition
- Natural warm palette with controlled purple accent

Brand colors: Vibrant Purple #8B5CF6 (hoodie), Warm Coral #FF9B85 (corgi fur highlights), Warm Beige #F5F1E8 (background atmosphere), Sky Blue #A8C5DD (subtle sky hint)

Mood: "Pack your bags, I'm on my way!" — reliable excitement, not frantic hype. A street-smart corgi who knows the route and can't wait to arrive.

Composition: Centered character, generous breathing space, circular vignette framing. Paper airplane and map should be clearly readable at small sizes (this will be used at ~200rpx on mobile).

Export: PNG with transparency, 2000x3000px, 2x resolution

Anti-generic test: This should NOT look like a generic travel sticker. The weathered hoodie, the specific corgi proportions (short legs, long body, fluffy butt), and the low-poly geometric construction make it unmistakably Xiaoyue. The paper airplane should feel handmade (origami), not a toy plane.

Anti-confusion addendum: This is XIAOYUE the AI assistant — relaxed, street-smart, wearing a purple hoodie with sunglasses hanging from the collar. NOT the playful energetic corgi archetype. Xiaoyue is chill but genuinely excited about this journey.
```

---

## Naming & Integration

| Expression ID | Lovart Export Filename | Sprite State | Usage |
|--------------|------------------------|--------------|-------|
| `cityUnlock` | `xiaoyue-city-unlock_master.png` | `cityUnlock` | City unlock progress screen top mascot |

### Code Integration Steps (after asset delivery)

1. Place PNG master in asset storage
2. Run `npm run optimize:xiaoyue` to generate WebP
3. Add to `xiaoyueExpressions.ts`:
   ```typescript
   | 'cityUnlock'
   
   cityUnlock: `${BASE}/xiaoyue-city-unlock.webp`,
   
   cityUnlock: ART.cityUnlock,
   
   cityUnlock: 'cityUnlock', // sprite state
   ```
4. Add `cityUnlock` to `XiaoyueSpriteState` union in `XiaoyueSpriteAnimator.tsx`
5. Generate sprite sheet if animated version needed

---

## Fallback Until Asset Ready

Until the Lovart asset is commissioned and optimized, map `cityUnlock` expression to `coachGuide` asset as a temporary fallback. The sprite animator will show the `coach` state.
