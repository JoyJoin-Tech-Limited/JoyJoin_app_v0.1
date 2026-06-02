# Lovart Design Brief: Emotional Icon Batch B

> **Status:** 📝 Ready for commission
> **Goal:** Replace generic Unicode emoji in peak emotional moments (matching reveals + achievement badges) with premium, brand-aligned proprietary icons.
> **Target:** WeChat Mini Program (Taro)
> **Integration:** Maps into `emojiToIconMap.ts` via the `tier` override system (foundation PR shipped 2026-05-27).

---

## Brand Parameters

| Parameter | Value |
|-----------|-------|
| Primary color | Vibrant Purple `#8B5CF6` — accent highlights only |
| Secondary color | Warm Coral `#FF9B85` — emotional warmth, energy peaks |
| Background | **Transparent** (PNG alpha) — assets sit on UI card surfaces |
| Warm Beige | `#F5F1E8` — atmospheric wash if background needed for vignette |
| Visual tone | warm, cute-but-tasteful, rounded, soft, lively, minimal-yet-refined |
| Typography | No text in assets — purely visual/iconic |

---

## Asset Specifications

- **Type:** icon-set / badge-set — emotional illustrations
- **Platform:** WeChat Mini Program (Taro)
- **Dimensions:** 256×256px source art (displayed at 48–120rpx)
- **Aspect ratio:** 1:1
- **Export format:** PNG with transparency + WebP optimized variants
- **Minimum resolution:** 2× (512×512px source recommended for downscaling crispness)
- **File naming:** `lovart-icon-{tier}-{name}-20260527-v1.{ext}`
- **Save location (CDN):** `/static/assets/icons/{tier}-icons/`

---

## Part 1 — Common Ground Reveal Icons (5 assets)

Used in match reveal and squad unboxing — the highest-emotion surface in the app. Displayed at **80–120rpx**.

These icons represent the "connection type" between two matched users. They appear with animated reveals and should feel like discovered treasures.

### 1. `reveal-same-relationship` — Replaces 💫
**Feeling:** "You're in the same life chapter." Shared understanding, parallel journeys.
**Visual:** Two small rounded figures walking side by side on parallel paths that gently curve together. Soft sparkles trail behind them. Should feel like companionship, not romance.
**Color accent:** Sky Blue `#A8C5DD` paths, Soft Gold `#E4C76B` sparkles.

### 2. `reveal-same-archetype-band` — Replaces 🎵
**Feeling:** "Same frequency, different instrument." Harmony, resonance, mutual recognition.
**Visual:** Two overlapping sound waves or musical notes that form a heart-like shape, or two small figures with colored auras that blend where they meet. Should feel harmonic.
**Color accent:** Vibrant Purple `#8B5CF6` and Warm Coral `#FF9B85` blending in the overlap.

### 3. `reveal-same-work-industry` — Replaces 🤝
**Feeling:** "Industry peers, different perspectives." Professional camaraderie, mutual respect.
**Visual:** Two rounded paws/hands building something together — a small tower of geometric blocks, or holding a shared briefcase/tool. Collaborative energy.
**Color accent:** Warm Beige `#F5F1E8` structure, Vibrant Purple `#8B5CF6` shared accent.

### 4. `reveal-exact-archetype` — Replaces ✨
**Feeling:** "Same soul, different body." Rare connection, mirror recognition, destiny.
**Visual:** Two small figures facing each other, their outlines mirroring perfectly, with a bright spark or starburst between their foreheads. Should feel rare and precious.
**Color accent:** Soft Gold `#E4C76B` starburst core, Vibrant Purple `#8B5CF6` radiating lines.

### 5. `reveal-hometown-industry` — Replaces 🔥
**Feeling:** "Hometown + industry = instant deep bond." Compound luck, rare overlap, warmth.
**Visual:** A small map pin or location marker with a flame/heart inside, or two overlapping circles (location + profession) with a warm glow at the intersection.
**Color accent:** Warm Coral `#FF9B85` glow, Fresh Green `#9ACD32` location marker.

---

## Part 2 — Achievement Badges (7 assets)

Used in personality test completion popups. Displayed at **64–80rpx**.

These should feel like collectible tokens — weighty, satisfying, with rarity-appropriate visual density.

### 6. `achievement-first-answer` — Replaces 🎯
**Rarity:** Common
**Feeling:** First step, beginning of a journey.
**Visual:** A small rounded target with a single dart in the bullseye. Simple, clean, encouraging. Not aggressive.
**Color accent:** Vibrant Purple `#8B5CF6` target rings, Warm Coral `#FF9B85` dart.

### 7. `achievement-quick-thinker` — Replaces ⚡
**Rarity:** Rare
**Feeling:** Speed, instinct, sharp mind.
**Visual:** A small lightning bolt shape wrapped in a soft glow or halo, or a brain with a lightning path through it. Energetic but not harsh.
**Color accent:** Soft Gold `#E4C76B` lightning, Sky Blue `#A8C5DD` glow.

### 8. `achievement-halfway-hero` — Replaces 🏃
**Rarity:** Common
**Feeling:** Milestone reached, momentum building.
**Visual:** A small figure mid-stride crossing a finish line, or a path that is exactly half-lit/half-traveled. Forward motion.
**Color accent:** Fresh Green `#9ACD32` finish line, Warm Beige `#F5F1E8` path.

### 9. `achievement-explorer` — Replaces 🔍
**Rarity:** Common
**Feeling:** Curiosity, discovery, trying new things.
**Visual:** A small magnifying glass with a sparkle or tiny discovered gem inside the lens. Inquisitive and playful.
**Color accent:** Vibrant Purple `#8B5CF6` handle, Soft Gold `#E4C76B` sparkle.

### 10. `achievement-destined-match` — Replaces ✨
**Rarity:** Epic
**Feeling:** Fate, rare alignment, magic.
**Visual:** Two small stars orbiting each other with a trail of smaller sparkles, or a constellation shape that forms a heart. Should feel special and luminous.
**Color accent:** Soft Gold `#E4C76B` primary star, Warm Coral `#FF9B85` secondary star, Vibrant Purple `#8B5CF6` trail.

### 11. `achievement-night-owl` — Replaces 🦉
**Rarity:** Rare
**Feeling:** Late-night dedication, quiet focus.
**Visual:** A small stylized owl face with half-closed sleepy eyes and a tiny moon crescent above. Cute, not creepy.
**Color accent:** Medium Gray `#9CA3AF` feathers, Sky Blue `#A8C5DD` moon, Soft Gold `#E4C76B` eye shine.

### 12. `achievement-perfectionist` — Replaces 💎
**Rarity:** Legendary
**Feeling:** Mastery, completion, excellence.
**Visual:** A faceted gem or crystal shape with internal light refraction, or a small crown made of geometric facets. Premium and weighty.
**Color accent:** Vibrant Purple `#8B5CF6` gem body, Soft Gold `#E4C76B` facets, Warm Coral `#FF9B85` inner glow.

---

## Unified Style Lock (画风统一)

All 12 assets MUST share this exact construction:

- **Construction:** 2D digital illustration with low-poly / geometric faceted aesthetic
- **Textures:** Painterly, soft brushed feel within each polygonal facet — NOT flat vector or 3D render
- **Outlines:** Minimal or none — let facet edges define form
- **Gradients:** Soft color variation within individual facets, not global gradients
- **Backgrounds:** Transparent PNG (no background)
- **Characters:** Geometric polygonal bodies, large expressive glossy eyes, simplified features, warm expressions
- **Composition:** Centered subjects, generous breathing space, circular framing when possible
- **Color treatment:** Natural warm palette; brand purple `#8B5CF6` and coral `#FF9B85` for key elements only
- **Scale:** Designed to read clearly at 48×48px and 120×120px. Test by viewing at 25% zoom.

**Anti-generic test:** Could these exact illustrations appear in a generic dating app without modification? If yes → iterate on the geometric low-poly painterly texture until they feel uniquely JoyJoin.

---

## Prompt Draft (for Lovart ChatCanvas)

```
Goal: Create a cohesive set of 12 premium emotional icons for a social matching app. Split into two groups: common ground reveals (5) and achievement badges (7). All must feel warm, geometric, and unmistakably part of the JoyJoin brand family.

Style lock for all 12:
- 2D digital illustration, low-poly geometric faceted aesthetic
- Painterly soft brushed texture within each facet
- Minimal or no outlines
- Soft gradients within polygonal facets
- Warm natural palette with Vibrant Purple #8B5CF6 and Warm Coral #FF9B85 as controlled accents
- Transparent background PNG
- Centered composition with breathing space
- Must read clearly when scaled down to 48×48px

--- COMMON GROUND REVEALS (5) — displayed at 80-120px, highest emotion surface ---
1. Same Relationship: Two figures walking on parallel paths with sparkles. Sky blue paths, gold sparkles.
2. Same Archetype Band: Overlapping sound waves or musical notes forming harmony. Purple and coral blending.
3. Same Work Industry: Two paws building geometric blocks together. Beige structure, purple accent.
4. Exact Archetype: Two mirrored figures with a starburst between foreheads. Gold starburst, purple radiating lines.
5. Hometown + Industry: Location pin with warm glow at profession intersection. Coral glow, green marker.

--- ACHIEVEMENT BADGES (7) — displayed at 64-80px, collectible tokens ---
6. First Answer: Rounded target with a single dart in bullseye. Purple rings, coral dart.
7. Quick Thinker: Lightning bolt in soft halo. Gold lightning, blue glow.
8. Halfway Hero: Figure crossing finish line, half-lit path. Green finish, beige path.
9. Explorer: Magnifying glass with sparkle inside. Purple handle, gold sparkle.
10. Destined Match: Two orbiting stars with sparkle trail. Gold primary, coral secondary, purple trail.
11. Night Owl: Sleepy owl face with moon crescent. Gray feathers, blue moon, gold eye shine.
12. Perfectionist: Faceted gem with internal light. Purple body, gold facets, coral glow.

Please generate all 12 as a cohesive set. Export each as 256×256px PNG with transparency, plus 512×512px 2× versions.
```

---

## Export Requirements

| # | Tier | Asset ID | File name (PNG) | File name (WebP) | Sizes |
|---|------|----------|-----------------|------------------|-------|
| 1 | reveal | same-relationship | `lovart-icon-reveal-same-relationship-20260527-v1.png` | `lovart-icon-reveal-same-relationship-20260527-v1.webp` | 256×256, 512×512 |
| 2 | reveal | same-archetype-band | `lovart-icon-reveal-same-archetype-band-20260527-v1.png` | `lovart-icon-reveal-same-archetype-band-20260527-v1.webp` | 256×256, 512×512 |
| 3 | reveal | same-work-industry | `lovart-icon-reveal-same-work-industry-20260527-v1.png` | `lovart-icon-reveal-same-work-industry-20260527-v1.webp` | 256×256, 512×512 |
| 4 | reveal | exact-archetype | `lovart-icon-reveal-exact-archetype-20260527-v1.png` | `lovart-icon-reveal-exact-archetype-20260527-v1.webp` | 256×256, 512×512 |
| 5 | reveal | hometown-industry | `lovart-icon-reveal-hometown-industry-20260527-v1.png` | `lovart-icon-reveal-hometown-industry-20260527-v1.webp` | 256×256, 512×512 |
| 6 | achievement | first-answer | `lovart-icon-achievement-first-answer-20260527-v1.png` | `lovart-icon-achievement-first-answer-20260527-v1.webp` | 256×256, 512×512 |
| 7 | achievement | quick-thinker | `lovart-icon-achievement-quick-thinker-20260527-v1.png` | `lovart-icon-achievement-quick-thinker-20260527-v1.webp` | 256×256, 512×512 |
| 8 | achievement | halfway-hero | `lovart-icon-achievement-halfway-hero-20260527-v1.png` | `lovart-icon-achievement-halfway-hero-20260527-v1.webp` | 256×256, 512×512 |
| 9 | achievement | explorer | `lovart-icon-achievement-explorer-20260527-v1.png` | `lovart-icon-achievement-explorer-20260527-v1.webp` | 256×256, 512×512 |
| 10 | achievement | destined-match | `lovart-icon-achievement-destined-match-20260527-v1.png` | `lovart-icon-achievement-destined-match-20260527-v1.webp` | 256×256, 512×512 |
| 11 | achievement | night-owl | `lovart-icon-achievement-night-owl-20260527-v1.png` | `lovart-icon-achievement-night-owl-20260527-v1.webp` | 256×256, 512×512 |
| 12 | achievement | perfectionist | `lovart-icon-achievement-perfectionist-20260527-v1.png` | `lovart-icon-achievement-perfectionist-20260527-v1.webp` | 256×256, 512×512 |

**CDN save location:** `/static/assets/icons/{reveal-icons,achievement-badges}/`

---

## Frontend Integration Notes

Once assets are delivered:

1. **Add `REVEAL_MAP` and `ACHIEVEMENT_MAP`** to `emojiToIconMap.ts`:
   ```ts
   export const REVEAL_MAP: Record<string, IconMapping> = {
     '💫': { assetKey: 'reveal-same-relationship', tier: 'reveal', size: 96, fallbackEmoji: '💫' },
     '🎵': { assetKey: 'reveal-same-archetype-band', tier: 'reveal', size: 96, fallbackEmoji: '🎵' },
     '🤝': { assetKey: 'reveal-same-work-industry', tier: 'reveal', size: 96, fallbackEmoji: '🤝' },
     '✨': { assetKey: 'reveal-exact-archetype', tier: 'reveal', size: 96, fallbackEmoji: '✨' },
     '🔥': { assetKey: 'reveal-hometown-industry', tier: 'reveal', size: 96, fallbackEmoji: '🔥' },
   }

   export const ACHIEVEMENT_MAP: Record<string, IconMapping> = {
     '🎯': { assetKey: 'achievement-first-answer', tier: 'achievement', size: 72, fallbackEmoji: '🎯' },
     '⚡': { assetKey: 'achievement-quick-thinker', tier: 'achievement', size: 72, fallbackEmoji: '⚡' },
     '🏃': { assetKey: 'achievement-halfway-hero', tier: 'achievement', size: 72, fallbackEmoji: '🏃' },
     '🔍': { assetKey: 'achievement-explorer', tier: 'achievement', size: 72, fallbackEmoji: '🔍' },
     '✨': { assetKey: 'achievement-destined-match', tier: 'achievement', size: 72, fallbackEmoji: '✨' },
     '🦉': { assetKey: 'achievement-night-owl', tier: 'achievement', size: 72, fallbackEmoji: '🦉' },
     '💎': { assetKey: 'achievement-perfectionist', tier: 'achievement', size: 72, fallbackEmoji: '💎' },
   }
   ```

2. **Update `TIER_MAPS`** to include `reveal: REVEAL_MAP` and `achievement: ACHIEVEMENT_MAP`.

3. **Wire matching reveal surfaces:** Replace raw emoji `<Text>` with `<JoyJoinIcon emoji={emoji} tier="reveal" size={96} />` in `matching-status/` and `squad-unboxing/` pages.

4. **Wire achievement popups:** Replace raw emoji `<Text>` with `<JoyJoinIcon emoji={achievement.emoji} tier="achievement" size={72} />` in personality test completion flow.

**Current state:** These surfaces render native emoji. No temporary visual change until assets are delivered.

---

## Review Checklist

- [ ] All 12 assets share the same low-poly geometric painterly style
- [ ] Brand colors (`#8B5CF6`, `#FF9B85`) used consistently and sparingly
- [ ] Each asset reads clearly at 48×48px and 120×120px
- [ ] Transparent backgrounds (no white fringes)
- [ ] No text or lettering in the illustrations
- [ ] Warm, cute-but-tasteful tone throughout
- [ ] File sizes under 50KB each at 256×256px
- [ ] Naming follows `lovart-icon-{tier}-{name}-20260527-v1.{ext}`
