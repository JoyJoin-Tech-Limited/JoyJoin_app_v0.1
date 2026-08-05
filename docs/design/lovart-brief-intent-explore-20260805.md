# Lovart Design Brief: intent-explore (尝鲜体验)

> **Status:** 📋 Draft — awaiting Lovart generation
> **Goal:** Close the one gap in the social-intent icon set: 尝鲜体验 (explore) currently renders as raw emoji 🎯 because `intent-explore.webp` was never commissioned. Batch A (`lovart-brief-functional-icons-batch-a-20260527.md`) shipped 4 intents; `flexible` and `romance` were added later — `explore` is the only intent without a Lovart asset.
> **Target:** WeChat Mini Program (Taro)
> **Integration:** Zero code change required — `emojiToIconMap.ts:136` already maps 🎯 → `intent-explore` (`tier: 'intent'`). Drop the delivered WebP at `apps/mini-program/src/assets/icons/intent-icons/intent-explore.webp` and the existing `JoyJoinIcon` chain (local → CDN → emoji) upgrades to the branded icon automatically.

---

## Brand Parameters

| Parameter | Value |
|-----------|-------|
| Primary color | Vibrant Purple `#8B5CF6` — accent highlights only |
| Secondary color | Warm Coral `#FF9B85` — emotional warmth, energy peaks |
| Background | **Transparent** (PNG alpha) — asset sits on UI card surfaces |
| Warm Beige | `#F5F1E8` — atmospheric wash if a soft vignette is needed |
| Visual tone | warm, cute-but-tasteful, rounded, soft, lively, minimal-yet-refined |
| Typography | No text in asset — purely visual/iconic |

---

## Asset Specifications

- **Type:** icon-set member — single small expressive icon (matches `intent-*` siblings)
- **Platform:** WeChat Mini Program (Taro)
- **Dimensions:** 144×144px WebP (existing siblings measure 144×144, ~3–5KB); source PNG master 256×256px for crispness
- **Aspect ratio:** 1:1
- **Export format:** PNG with transparency (master) + WebP optimized variant (shipped)
- **Display context:** 144rpx hero icon in the two intent selector grids (pool-registration Step 2, onboarding essential-data — icon-led tiles since 2026-08-05), 54rpx in edit-profile intent cards, 36rpx in profile-review summary chips. Must read clearly at 32×32px.
- **File naming:** `lovart-icon-intent-explore-20260805-v1.png` / `lovart-icon-intent-explore-20260805-v1.webp`
- **Save location:**
  - Bundled (local): `apps/mini-program/src/assets/icons/intent-icons/intent-explore.webp`
  - PNG master: `assets-source/lovart/` (source-only, not bundled)

---

## Icon Concept

**`intent-explore` — Replaces 🎯 (iconHint: `Compass`)**

**Feeling:** Curiosity, discovery, "try something new", pleasant surprise. The intent means the user wants to explore novel experiences — it should feel inviting and adventurous, not like a task.

**Visual (match sibling construction):** A small rounded **compass/dial** — circular geometric body, faceted face, with a coral needle/pointer tilted toward a small purple sparkle or star (the "new thing" it's pointing at). One compact subject, generous breathing space, no extra clutter. Avoid literal GPS/wayfinding aesthetics — keep it cute and abstract like the rest of the set.

**Color accent (follow sibling pattern — two accents max):** Vibrant Purple `#8B5CF6` dial body + compass points, Warm Coral `#FF9B85` needle/sparkle. (Compare siblings: intent-friends = coral paw + gold sparkle; intent-networking = purple node + beige hands.)

---

## Unified Style Lock (画风统一) — MANDATORY

Match the Batch A intent icons exactly (`intent-friends.webp` etc. are the reference):

- **Construction:** 2D digital illustration with low-poly / geometric faceted aesthetic
- **Textures:** Painterly, soft brushed feel within each polygonal facet — NOT flat vector or 3D render
- **Outlines:** Minimal or none — let facet edges define form
- **Gradients:** Soft color variation within individual facets, not global gradients
- **Backgrounds:** Transparent (no background)
- **Composition:** Centered subject, generous breathing space, circular framing when possible
- **Color treatment:** Natural warm palette; brand purple `#8B5CF6` and coral `#FF9B85` for key elements only
- **Scale:** Designed to read clearly at 32×32px and 64×64px. Test by viewing at 25% zoom.
- **Weight:** Visual weight and corner roundness must feel identical to the other 6 intent icons when placed side by side at 48rpx.

**Anti-generic test:** Could this exact illustration appear in a generic social app without modification? If yes → iterate on the geometric low-poly painterly texture until it feels uniquely JoyJoin.

---

## Prompt Draft (for Lovart ChatCanvas)

```
Goal: Create ONE small expressive icon that completes our social-intent icon set — the "explore" / 尝鲜体验 intent, replacing a generic target emoji 🎯. It must feel like a warm invitation to try something new: curious, adventurous, delightful — not task-like.

This icon joins a family of 6 existing icons (friends, networking, discussion, fun, romance, flexible). Match their construction exactly:
- 2D digital illustration, low-poly geometric faceted aesthetic
- Painterly soft brushed texture within each facet
- Minimal or no outlines — facet edges define form
- Soft gradients within polygonal facets
- Warm natural palette; Vibrant Purple #8B5CF6 and Warm Coral #FF9B85 as controlled accents only
- Transparent background, centered composition with breathing space
- Same visual weight and corner roundness as the siblings at 48px

Subject: a small rounded compass dial, geometric faceted face, coral needle tilted toward a small purple sparkle/star. Cute and abstract — no literal GPS or wayfinding look. Two accents only: purple dial body, coral needle + sparkle.

Export: 256×256px PNG with transparency (master) and a 144×144px version. Must read clearly at 32×32px.
```

---

## Export Requirements

| # | Tier | Asset ID | File name (PNG master) | File name (WebP shipped) | Sizes |
|---|------|----------|------------------------|--------------------------|-------|
| 1 | intent | explore | `lovart-icon-intent-explore-20260805-v1.png` | `lovart-icon-intent-explore-20260805-v1.webp` | 256×256 master, 144×144 shipped |

**Optimization:** convert the PNG master to WebP at 144×144px, transparent, targeting ~3–6KB (sibling range: 3.1–5.4KB). Optimizer available at `apps/mini-program/scripts/optimize-lovart-assets.mjs` (adjust to 144px max) or a one-off `cwebp` run.

---

## Frontend Integration Notes (post-delivery)

1. Place `intent-explore.webp` at `apps/mini-program/src/assets/icons/intent-icons/` (already copied to dist by `config/index.ts:217` — no config change).
2. **No `emojiToIconMap.ts` change** — mapping `'🎯' → { assetKey: 'intent-explore', tier: 'intent' }` is already live.
3. **No CDN manifest change** — `intent` tier is local-bundled; `JoyJoinIcon` retries CDN then emoji automatically if the local copy is ever stripped at upload.
4. Run `npm run validate:icon-transparency -w mini-program` (part of `build:weapp`) and a visual check of the three surfaces: pool-registration intent grid, onboarding essential-data, edit-profile — side-by-side at 48rpx against `intent-fun.webp` and `intent-romance.webp`.
5. Target file size ≤6KB (sibling range) — keeps the main package at 1.69MB.

---

## Review Checklist

- [ ] Style matches the 6 sibling intent icons (same facets, texture, weight, roundness)
- [ ] Brand colors exact: `#8B5CF6` + `#FF9B85` accents only
- [ ] Reads clearly at 32×32px (view at 25% zoom)
- [ ] Transparent background, no white fringes
- [ ] No text or lettering
- [ ] Warm, cute-but-tasteful tone — passes the anti-generic test
- [ ] WebP ≤6KB at 144×144px
- [ ] Naming follows `lovart-icon-intent-explore-20260805-v1.{ext}`
