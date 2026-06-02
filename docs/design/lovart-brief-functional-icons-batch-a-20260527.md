# Lovart Design Brief: Functional Icon Batch A

> **Status:** 📝 Ready for commission
> **Goal:** Replace generic Unicode emoji across high-traffic functional surfaces with cohesive, brand-aligned proprietary icons. This batch covers icebreaker reactions, interest categories, and social intent selectors.
> **Target:** WeChat Mini Program (Taro)
> **Integration:** Maps into `emojiToIconMap.ts` via the new `tier` override system (foundation PR shipped 2026-05-27).

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

- **Type:** icon-set — small expressive icons
- **Platform:** WeChat Mini Program (Taro)
- **Dimensions:** 128×128px source art (displayed at 32–64rpx)
- **Aspect ratio:** 1:1
- **Export format:** PNG with transparency + WebP optimized variants
- **Minimum resolution:** 2× (256×256px source recommended for downscaling crispness)
- **File naming:** `lovart-icon-{tier}-{name}-20260527-v1.{ext}`
- **Save location:** 
  - Bundled (local): `apps/mini-program/src/assets/icons/{tier}-icons/`
  - CDN fallback: `/static/assets/icons/{tier}-icons/`

---

## Part 1 — Reaction Icons (7 assets)

Used in icebreaker phase views (PersonalityDice, MiniScript, UndercoverWord, QuipBattle, GroupMirror) as tap-to-react buttons. Displayed at **56rpx**.

### 1. `reaction-funny` — Replaces 😂
**Feeling:** Joyful laughter, amusement, something landed perfectly.
**Visual:** A small rounded character or abstract face with eyes squeezed shut in laughter, mouth open in a wide grin, maybe a tear of joy. Soft and warm — not manic.
**Color accent:** Warm Coral `#FF9B85` cheeks, Vibrant Purple `#8B5CF6` sparkles.

### 2. `reaction-fire` — Replaces 🔥
**Feeling:** Energy, excitement, "that was amazing."
**Visual:** A small stylized flame shape — rounded, geometric, friendly. Not aggressive or realistic fire. More like a warm glowing ember with personality.
**Color accent:** Warm Coral `#FF9B85` core, Soft Gold `#E4C76B` tips.

### 3. `reaction-clap` — Replaces 👏
**Feeling:** Appreciation, support, "well done."
**Visual:** Two rounded paw-like or hand-like shapes coming together in a clap, with small motion lines or sparkles to suggest impact. Keep it abstract and cute.
**Color accent:** Warm Beige `#F5F1E8` hands, Soft Gold `#E4C76B` sparkles.

### 4. `reaction-celebrate` — Replaces 🎉
**Feeling:** Celebration, victory, collective joy.
**Visual:** A small party popper or confetti burst — geometric shapes (triangles, circles) exploding outward from a central point. Dynamic but contained.
**Color accent:** Vibrant Purple `#8B5CF6` and Warm Coral `#FF9B85` confetti, Soft Gold `#E4C76B` highlights.

### 5. `reaction-rose` — Replaces 🌹
**Feeling:** Appreciation, flirt, admiration.
**Visual:** A single stylized rose or flower — rounded petals, geometric construction. Not photorealistic. Could be abstracted to a heart-shaped petal arrangement.
**Color accent:** Warm Coral `#FF9B85` petals, Fresh Green `#9ACD32` stem accent.

### 6. `reaction-think` — Replaces 🤔
**Feeling:** Curiosity, contemplation, "interesting..."
**Visual:** A small face with one eyebrow raised, finger to chin (or paw to muzzle), with a small thought bubble or question mark sparkle. Inquisitive but friendly.
**Color accent:** Medium Gray `#9CA3AF` thought bubble, Vibrant Purple `#8B5CF6` question sparkle.

### 7. `reaction-wow` — Replaces 😮
**Feeling:** Surprise, amazement, "no way!"
**Visual:** A small face with wide round eyes and a small 'o' mouth, hands/paws raised to cheeks in surprise. Expressive but not shocked or scared.
**Color accent:** Sky Blue `#A8C5DD` eye shine, Warm Beige `#F5F1E8` face.

---

## Part 2 — Interest Category Icons (5 assets)

Used in onboarding interest picker, profile tags, and discover filters. Displayed at **32–48rpx**.

### 8. `category-food` — Replaces 🍜
**Feeling:** Gastronomy, dining, culinary exploration.
**Visual:** A small rounded bowl with steam rising, or chopsticks holding a noodle. Geometric and warm. Should read as "food" even at 32px.
**Color accent:** Warm Coral `#FF9B85` bowl interior, Soft Gold `#E4C76B` steam.

### 9. `category-entertainment` — Replaces 🎮
**Feeling:** Games, fun, play, entertainment.
**Visual:** A small geometric game controller or joystick — rounded, friendly. Avoid literal PlayStation/Xbox shapes; make it abstract and brand-aligned.
**Color accent:** Vibrant Purple `#8B5CF6` controller body, Warm Coral `#FF9B85` button accents.

### 10. `category-lifestyle` — Replaces 🌿
**Feeling:** Wellness, balance, everyday life, nature.
**Visual:** A small rounded leaf or plant sprout, or a cozy mug with a leaf. Soft and calming.
**Color accent:** Fresh Green `#9ACD32` leaf, Warm Beige `#F5F1E8` pot/mug.

### 11. `category-culture` — Replaces 🎭
**Feeling:** Arts, performance, creativity, depth.
**Visual:** A small comedy-tragedy mask abstraction — two small rounded faces side by side, or a single mask with dual expression. Theatrical but cute.
**Color accent:** Vibrant Purple `#8B5CF6` mask, Warm Coral `#FF9B85` accent details.

### 12. `category-social` — Replaces 👥
**Feeling:** Community, gathering, people, connection.
**Visual:** Two small rounded figures standing close together, shoulders touching, with a subtle heart or connection line between them. Should feel warm and inclusive.
**Color accent:** Warm Beige `#F5F1E8` figures, Sky Blue `#A8C5DD` connection glow.

---

## Part 3 — Social Intent Icons (4 assets)

Used in onboarding essential-data intent selector. Displayed at **48–64rpx**.

### 13. `intent-friends` — Replaces 👋
**Feeling:** Openness, friendly greeting, new connections.
**Visual:** A small raised paw/hand in a wave, with a subtle motion line or sparkle to suggest movement. Welcoming and approachable.
**Color accent:** Warm Coral `#FF9B85` paw, Soft Gold `#E4C76B` motion sparkle.

### 14. `intent-networking` — Replaces 🤝
**Feeling:** Professional warmth, mutual benefit, collaboration.
**Visual:** Two rounded paws/hands shaking or clasping, with a small network-node or link icon above them. Should feel professional but not corporate.
**Color accent:** Vibrant Purple `#8B5CF6` link node, Warm Beige `#F5F1E8` hands.

### 15. `intent-discussion` — Replaces 💬
**Feeling:** Depth, meaningful conversation, listening.
**Visual:** A small speech bubble with a heart or sound wave inside, or two overlapping bubbles suggesting dialogue. Intimate and thoughtful.
**Color accent:** Sky Blue `#A8C5DD` bubble, Warm Coral `#FF9B85` heart/wave.

### 16. `intent-fun` — Replaces 🎉
**Feeling:** Lightness, spontaneity, "just enjoy yourself."
**Visual:** A small figure jumping or dancing with arms raised, or a playful star/sparkle shape. Energetic and carefree.
**Color accent:** Warm Coral `#FF9B85` figure, Vibrant Purple `#8B5CF6` sparkles.

---

## Unified Style Lock (画风统一)

All 16 assets MUST share this exact construction:

- **Construction:** 2D digital illustration with low-poly / geometric faceted aesthetic
- **Textures:** Painterly, soft brushed feel within each polygonal facet — NOT flat vector or 3D render
- **Outlines:** Minimal or none — let facet edges define form
- **Gradients:** Soft color variation within individual facets, not global gradients
- **Backgrounds:** Transparent PNG (no background)
- **Characters:** Geometric polygonal bodies, large expressive glossy eyes, simplified features, warm expressions
- **Composition:** Centered subjects, generous breathing space, circular framing when possible
- **Color treatment:** Natural warm palette; brand purple `#8B5CF6` and coral `#FF9B85` for key elements only
- **Scale:** Designed to read clearly at 32×32px and 64×64px. Test by viewing at 25% zoom.

**Anti-generic test:** Could these exact illustrations appear in a generic social app without modification? If yes → iterate on the geometric low-poly painterly texture until they feel uniquely JoyJoin.

---

## Prompt Draft (for Lovart ChatCanvas)

```
Goal: Create a cohesive set of 16 small expressive icons to replace generic emoji across a social app's UI. Split into three groups: reactions (7), interest categories (5), and social intents (4). All must feel warm, geometric, and unmistakably part of the JoyJoin brand family.

Style lock for all 16:
- 2D digital illustration, low-poly geometric faceted aesthetic
- Painterly soft brushed texture within each facet
- Minimal or no outlines
- Soft gradients within polygonal facets
- Warm natural palette with Vibrant Purple #8B5CF6 and Warm Coral #FF9B85 as controlled accents
- Transparent background PNG
- Centered composition with breathing space
- Must read clearly when scaled down to 32×32px

--- REACTIONS (7) — displayed at 56×56px, tapped repeatedly during live events ---
1. Funny: Joyful laughter face, eyes squeezed shut, tear of joy. Coral cheeks, purple sparkles.
2. Fire: Rounded friendly flame shape, geometric, warm glowing ember. Coral core, gold tips.
3. Clap: Two rounded paws clapping with motion sparkles. Beige hands, gold sparkles.
4. Celebrate: Confetti burst — geometric triangles/circles exploding. Purple and coral confetti.
5. Rose: Stylized single rose, rounded petals, heart-shaped arrangement. Coral petals, green stem.
6. Think: Face with raised eyebrow, paw to chin, thought sparkle. Gray bubble, purple question.
7. Wow: Wide-eyed surprised face, paws to cheeks. Blue eye shine, beige face.

--- CATEGORIES (5) — displayed at 32–48px, used in onboarding filters ---
8. Food: Rounded bowl with steam, chopsticks holding noodle. Coral bowl, gold steam.
9. Entertainment: Abstract game controller/joystick, rounded. Purple body, coral buttons.
10. Lifestyle: Small leaf or plant sprout in cozy mug. Green leaf, beige mug.
11. Culture: Comedy-tragedy mask abstraction, dual expression. Purple mask, coral details.
12. Social: Two figures close together with connection glow. Beige figures, blue glow.

--- INTENTS (4) — displayed at 48–64px, used in onboarding selector ---
13. Friends: Raised paw in a wave, motion sparkle. Coral paw, gold sparkle.
14. Networking: Two paws shaking with network link node. Purple node, beige hands.
15. Discussion: Speech bubble with heart inside. Blue bubble, coral heart.
16. Fun: Figure jumping with arms raised, playful sparkles. Coral figure, purple sparkles.

Please generate all 16 as a cohesive set. Export each as 128×128px PNG with transparency, plus 256×256px 2× versions.
```

---

## Export Requirements

| # | Tier | Asset ID | File name (PNG) | File name (WebP) | Sizes |
|---|------|----------|-----------------|------------------|-------|
| 1 | reaction | funny | `lovart-icon-reaction-funny-20260527-v1.png` | `lovart-icon-reaction-funny-20260527-v1.webp` | 128×128, 256×256 |
| 2 | reaction | fire | `lovart-icon-reaction-fire-20260527-v1.png` | `lovart-icon-reaction-fire-20260527-v1.webp` | 128×128, 256×256 |
| 3 | reaction | clap | `lovart-icon-reaction-clap-20260527-v1.png` | `lovart-icon-reaction-clap-20260527-v1.webp` | 128×128, 256×256 |
| 4 | reaction | celebrate | `lovart-icon-reaction-celebrate-20260527-v1.png` | `lovart-icon-reaction-celebrate-20260527-v1.webp` | 128×128, 256×256 |
| 5 | reaction | rose | `lovart-icon-reaction-rose-20260527-v1.png` | `lovart-icon-reaction-rose-20260527-v1.webp` | 128×128, 256×256 |
| 6 | reaction | think | `lovart-icon-reaction-think-20260527-v1.png` | `lovart-icon-reaction-think-20260527-v1.webp` | 128×128, 256×256 |
| 7 | reaction | wow | `lovart-icon-reaction-wow-20260527-v1.png` | `lovart-icon-reaction-wow-20260527-v1.webp` | 128×128, 256×256 |
| 8 | category | food | `lovart-icon-category-food-20260527-v1.png` | `lovart-icon-category-food-20260527-v1.webp` | 128×128, 256×256 |
| 9 | category | entertainment | `lovart-icon-category-entertainment-20260527-v1.png` | `lovart-icon-category-entertainment-20260527-v1.webp` | 128×128, 256×256 |
| 10 | category | lifestyle | `lovart-icon-category-lifestyle-20260527-v1.png` | `lovart-icon-category-lifestyle-20260527-v1.webp` | 128×128, 256×256 |
| 11 | category | culture | `lovart-icon-category-culture-20260527-v1.png` | `lovart-icon-category-culture-20260527-v1.webp` | 128×128, 256×256 |
| 12 | category | social | `lovart-icon-category-social-20260527-v1.png` | `lovart-icon-category-social-20260527-v1.webp` | 128×128, 256×256 |
| 13 | intent | friends | `lovart-icon-intent-friends-20260527-v1.png` | `lovart-icon-intent-friends-20260527-v1.webp` | 128×128, 256×256 |
| 14 | intent | networking | `lovart-icon-intent-networking-20260527-v1.png` | `lovart-icon-intent-networking-20260527-v1.webp` | 128×128, 256×256 |
| 15 | intent | discussion | `lovart-icon-intent-discussion-20260527-v1.png` | `lovart-icon-intent-discussion-20260527-v1.webp` | 128×128, 256×256 |
| 16 | intent | fun | `lovart-icon-intent-fun-20260527-v1.png` | `lovart-icon-intent-fun-20260527-v1.webp` | 128×128, 256×256 |

**Bundled save location:** `apps/mini-program/src/assets/icons/{reaction-icons,category-icons,intent-icons}/`

---

## Frontend Integration Notes

Once assets are delivered:

1. **Place PNG masters** in `apps/mini-program/src/assets/icons/{tier}-icons/`
2. **Run WebP optimization** if needed (or keep PNG for mini-program compatibility)
3. **Update `REACTION_MAP` in `emojiToIconMap.ts`:**
   Swap temporary `assetKey` values from existing mood/chemistry assets to dedicated reaction assets:
   ```ts
   '😂': { assetKey: 'reaction-funny', tier: 'reaction', size: 56, fallbackEmoji: '😂' },
   '🔥': { assetKey: 'reaction-fire', tier: 'reaction', size: 56, fallbackEmoji: '🔥' },
   // etc.
   ```
4. **Add `CATEGORY_MAP` and `INTENT_MAP`** to `emojiToIconMap.ts` with the new asset keys.
5. **Wire onboarding surfaces:** Replace raw `<Text>{emoji}</Text>` with `<JoyJoinIcon emoji={emoji} tier="category" size={40} />` in interest pickers and intent selectors.

**Current state:** `TapReaction` is already wired with `tier="reaction"`. `😂` and `🔥` render via temporary fallback to existing `mood-funny` and `chem-fire` assets. The other 5 reactions gracefully fall back to native emoji until dedicated assets arrive.

---

## Review Checklist

- [ ] All 16 assets share the same low-poly geometric painterly style
- [ ] Brand colors (`#8B5CF6`, `#FF9B85`) used consistently and sparingly
- [ ] Each asset reads clearly at 32×32px and 64×64px
- [ ] Transparent backgrounds (no white fringes)
- [ ] No text or lettering in the illustrations
- [ ] Warm, cute-but-tasteful tone throughout
- [ ] File sizes under 30KB each at 128×128px
- [ ] Naming follows `lovart-icon-{tier}-{name}-20260527-v1.{ext}`
