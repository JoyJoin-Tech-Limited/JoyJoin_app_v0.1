# Lovart Design Brief: Xiaoyue Portrait Set (pool-registration mascot section)

> **Status:** ✅ Delivered — assets generated, optimized, and wired (2026-08-06)
> **Goal:** Commission 3 high-res 悦仔 (Xiaoyue) portraits for the pool-registration mascot section — the premium static counterpart to the existing sprite animations (Steps 1–3 base states: coach / curious / listening), also used as the reduced-motion fallback visuals.
> **Target:** WeChat Mini Program (Taro)
> **Integration:** post-delivery wiring in `PoolRegistrationMascotSection` (reduced-motion path) — see "Frontend Integration Notes".

---

## Brand Parameters

| Parameter | Value |
|-----------|-------|
| Primary color | Vibrant Purple `#8B5CF6` — accent highlights only |
| Secondary color | Warm Coral `#FF9B85` — warmth, cheek glow, small props |
| Background | **Transparent** (PNG alpha) — assets sit on the warm beige card surface |
| Warm Beige | `#F5F1E8` — optional soft atmospheric wash behind the character |
| Visual tone | warm, cute-but-tasteful, rounded, soft, lively, minimal-yet-refined |
| Typography | No text in assets |

---

## Asset Specifications

- **Type:** mascot illustration (portrait, character only)
- **Set size:** 3 poses (coach / curious / listening)
- **Platform:** WeChat Mini Program (Taro)
- **Dimensions:** 1024×1024px PNG master; 480×480px WebP shipped (matches the expression asset spec: max width 480px @ ~3x for 160–180rpx display slots)
- **Aspect ratio:** 1:1 (displayed in a circular crop — character must stay centered with generous headroom, no limbs/props at the canvas edge)
- **Export format:** PNG with transparency (master) + WebP optimized variant (shipped)
- **File naming:** `lovart-mascot-xiaoyue-{pose}-20260805-v1.png` / `.webp`
- **Save location:**
  - Shipped WebP: `apps/mini-program/src/assets/personality/xiaoyue/` (or CDN-primary per existing expression policy — decided at integration)
  - PNG masters: `assets-source/lovart/xiaoyue-portraits/`

---

## Character (critical — must match the existing mascot)

**悦仔 (Xiaoyue)** is JoyJoin's companion mascot — the small warm **corgi** with large expressive glossy eyes, geometric low-poly construction, rounded ears, and a gentle smile. Reference assets for character consistency (Lovart: use the remix/consistency feature against these):

- Sprite sheets: `apps/mini-program/src/assets/mascot/xiaoyue-coach.webp`, `xiaoyue-curious.webp`, `xiaoyue-listening.webp`
- Existing static expressions: `xiaoyue-coach-guide.webp`, `xiaoyue-test-curious.webp`, `xiaoyue-test-listening.webp` (CDN at `https://joyjoinapp.com/static/assets/personality/xiaoyue/`)
- The character appears in the landing hero composite (`/assets/lovart/landing/` — peeking Xiaoyue) — same construction language.

**Do NOT redesign the character.** Same face shape, ear shape, eye style, fur colouring, body proportions. Only the pose/expression changes.

---

## The 3 Poses

| # | Pose | Emotion | Visual direction |
|---|------|---------|------------------|
| 1 | `coach` (预算 step) | Warm, guiding, dependable | Chest-up portrait, soft open-palm gesture or one paw raised mid-explanation, gentle encouraging smile, looking at the viewer |
| 2 | `curious` (期待 step) | Playful curiosity | Head slightly tilted, one ear perked, sparkle/star prop near the head (small, purple accent), bright interested eyes |
| 3 | `listening` (细节 step) | Attentive warmth | Leaning-in posture, ears relaxed, soft closed-lip smile, chin resting on a paw, patient listening energy |

---

## Unified Style Lock (画风统一) — MANDATORY

Same language as the app's established Lovart art (A/B-tested 2026-07: 2D low-poly painterly won over 3D clay):

- **Construction:** 2D digital illustration with low-poly / geometric faceted aesthetic
- **Textures:** Painterly, soft brushed feel within each polygonal facet — NOT flat vector or 3D render
- **Outlines:** Minimal or none — facet edges define form
- **Gradients:** Soft color variation within individual facets, not global gradients
- **Backgrounds:** Transparent; optionally a faint warm beige `#F5F1E8` atmospheric wash behind the character (soft vignette) — keep the canvas edges clean for circular cropping
- **Characters:** Geometric polygonal body, large expressive glossy eyes, simplified features, warm expression
- **Color treatment:** Natural warm palette; brand purple `#8B5CF6` for key accents only (e.g., a small sparkle or collar accent)
- **Composition:** Centered chest-up portrait, generous negative space above the head (circular crop safe zone)

**Anti-generic test:** Could this exact character appear in a generic dating app without modification? If yes → iterate until it feels unmistakably JoyJoin.

---

## Prompt Draft (for Lovart ChatCanvas)

```
Goal: Create 3 high-res chest-up portraits of our mascot 悦仔 (Xiaoyue) — a small warm corgi companion — matching the EXACT character design already in our app (face, ears, eye style, fur colours, proportions). Do not redesign the character; only change pose/expression.

Style lock for all 3:
- 2D digital illustration, low-poly geometric faceted aesthetic
- Painterly soft brushed texture within each facet — not flat vector, not 3D render
- Minimal or no outlines — facet edges define form
- Soft gradients within polygonal facets
- Large expressive glossy eyes, rounded ears, gentle smile
- Transparent background (optional faint warm beige #F5F1E8 wash behind the character)
- Centered chest-up composition, generous headroom above the head (safe for circular crop)
- Natural warm palette; Vibrant Purple #8B5CF6 accents only (small sparkle or collar)

Pose 1 — coach: warm guiding energy, one paw raised mid-explanation, gentle encouraging smile, looking at the viewer.
Pose 2 — curious: head slightly tilted, one ear perked, bright interested eyes, a small purple sparkle/star near the head.
Pose 3 — listening: leaning in slightly, ears relaxed, soft closed-lip smile, chin resting on a paw, patient warm energy.

Reference the existing character art and keep the construction identical. Export each as 1024×1024px PNG with transparency, plus 480×480px versions.
```

---

## Export Requirements

| # | Pose | File name (PNG master) | File name (WebP shipped) | Sizes |
|---|------|------------------------|--------------------------|-------|
| 1 | coach | `lovart-mascot-xiaoyue-coach-20260805-v1.png` | `lovart-mascot-xiaoyue-coach-20260805-v1.webp` | 1024×1024, 480×480 |
| 2 | curious | `lovart-mascot-xiaoyue-curious-20260805-v1.png` | `lovart-mascot-xiaoyue-curious-20260805-v1.webp` | 1024×1024, 480×480 |
| 3 | listening | `lovart-mascot-xiaoyue-listening-20260805-v1.png` | `lovart-mascot-xiaoyue-listening-20260805-v1.webp` | 1024×1024, 480×480 |

**Optimization:** WebP q85, alphaQuality 100, 480px max (follow `scripts/optimize-xiaoyue-assets.mjs` conventions).

---

## Frontend Integration Notes (delivered)

1. ✅ WebP assets placed in `apps/mini-program/src/assets/personality/xiaoyue/` and registered in `cdn-asset-manifest.json` for CDN-primary delivery.
2. ✅ Wired into `PoolRegistrationMascotSection`: the reduced-motion portrait path now maps `coach` / `curious` / `listening` sprite states to the new portraits via `PORTRAIT_URL_BY_SPRITE_STATE` using `cdnAsset()` paths.
3. Optional: use the `coach` portrait as the CDN-failure fallback for the animated sprite (graceful static under the animator).
4. ✅ Verified: `npm run typecheck -w mini-program` and `npm run guardrails` both pass.
5. ✅ CDN upload entries added to `cdn-asset-manifest.json`.

---

## Review Checklist

- [ ] Character is recognisably the same 悦仔 (face, ears, eyes, proportions — not a redesign)
- [ ] All 3 poses share identical construction and palette
- [ ] Brand colors exact: `#8B5CF6` + `#FF9B85` accents only
- [ ] Centered chest-up composition with circular-crop safe zone
- [ ] Transparent background, no white fringes
- [ ] No text or lettering
- [ ] Warm, cute-but-tasteful tone — passes the anti-generic test
- [ ] Naming follows `lovart-mascot-xiaoyue-{pose}-20260805-v1.{ext}`
