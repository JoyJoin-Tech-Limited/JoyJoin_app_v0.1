# Lovart Design Brief: Personality Test Emoji Replacement Assets

## Goal
Replace generic Unicode emoji in the personality test answer interactions with 7 cohesive, brand-aligned mini-illustrations that feel unmistakably JoyJoin — warm, geometric, and expressive at small sizes.

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

- **Type:** icon-set / small mascot expression set
- **Platform:** WeChat Mini Program (Taro)
- **Dimensions:** 128×128px source art (displayed at 32–56rpx)
- **Aspect ratio:** 1:1
- **Export format:** PNG with transparency
- **Minimum resolution:** 2× (256×256px source recommended for downscaling crispness)
- **File naming:** `lovart-icon-personality-{name}-20260507-v1.png`
- **Save location:** `apps/mini-program/src/assets/lovart/personality-emojis/`
- **Lazy loading:** Yes — loaded via CDN or mini-program subpackage

---

## The 7 Assets

### 1. `solo_rest` — "Need solitude" 😮‍💨
Replaces slider left-emoji for "想一个人待着" (want to be alone).

**Feeling:** A gentle exhale, peaceful solitude, recharging energy.
**Visual:** A small JoyJoin-style character (or abstract face) with closed eyes, soft breath lines, leaning back comfortably. Should read as "rest" even at 32px.
**Color accent:** Warm Beige `#F5F1E8` wash, soft purple `#8B5CF6` highlights.

---

### 2. `party_ready` — "Let's celebrate!" 🥳
Replaces slider right-emoji for "快叫上朋友！" (call friends!).

**Feeling:** Bursting energy, open invitation, warm excitement.
**Visual:** A small character with raised arms, sparkles or confetti fragments, open happy expression. Dynamic but not chaotic.
**Color accent:** Warm Coral `#FF9B85` energy bursts, Vibrant Purple `#8B5CF6` confetti accents.

---

### 3. `popcorn_observe` — "Spectator mode" 🍿
Replaces emoji-tap option "吃瓜围观，看看怎么发展" (watch from sidelines).

**Feeling:** Curious but detached, amused observer, relaxed watching.
**Visual:** A small character peeking from behind a rounded shape, holding a popcorn-like element, wide curious eyes. Or a stylized popcorn bowl with expressive eyes.
**Color accent:** Warm yellow/cream tones, Soft White `#FFFFFF` highlights.

---

### 4. `private_dm` — "Check in privately" 💬
Replaces emoji-tap option "私信其中一个：你还好吗？" (DM someone to check in).

**Feeling:** Gentle care, quiet concern, one-to-one warmth.
**Visual:** A small speech bubble with a heart inside, or a character leaning in to whisper. Intimate and soft.
**Color accent:** Sky Blue `#A8C5DD` bubble tint, Warm Coral `#FF9B85` heart accent.

---

### 5. `leave_quietly` — "Stealth exit" 🤫
Replaces emoji-tap option "默默退出群聊一小会儿" (quietly leave the chat).

**Feeling:** Respectful withdrawal, needing space, gentle disappearance.
**Visual:** A small character tiptoeing away, or fading into soft mist/cloud. Finger-to-lips gesture could work but keep it JoyJoin-rounded, not literal emoji.
**Color accent:** Soft gray/blue mist, Medium Gray `#9CA3AF` fade edges.

---

### 6. `peacemaker` — "Diffuse tension" 🕊️
Replaces emoji-tap option "发条轻松消息转移话题" (send a light message to shift topic).

**Feeling:** Calming presence, bridging conflict, light-hearted redirection.
**Visual:** A small dove-like or wing-like shape (abstracted), or a character holding out an olive branch. Soft and round — avoid literal realistic dove.
**Color accent:** Fresh Green `#9ACD32` for growth/peace signal, Warm Beige `#F5F1E8` body.

---

### 7. `direct_speak` — "Cut through" 🔥
Replaces emoji-tap option "直接说：好了好了，你们都有道理" (speak directly: you're both right).

**Feeling:** Honest, direct, warm truth-telling, cutting through noise.
**Visual:** A small flame or spark shape (abstracted, rounded, cute — not aggressive), or a character with hands on hips speaking confidently. Should feel bold but friendly.
**Color accent:** Warm Coral `#FF9B85` flame core, Vibrant Purple `#8B5CF6` spark tips.

---

## Unified Style Lock (画风统一)

All 7 assets MUST share this exact construction:

- **Construction:** 2D digital illustration with low-poly / geometric faceted aesthetic
- **Textures:** Painterly, soft brushed feel within each polygonal facet — NOT flat vector or 3D render
- **Outlines:** Minimal or none — let facet edges define form
- **Gradients:** Soft color variation within individual facets, not global gradients
- **Backgrounds:** Transparent PNG (no background) OR atmospheric textured circular vignette if needed for readability
- **Characters:** Geometric polygonal bodies, large expressive glossy eyes, simplified features, warm expressions
- **Composition:** Centered subjects, generous breathing space, circular framing when possible
- **Color treatment:** Natural warm palette; brand purple `#8B5CF6` and coral `#FF9B85` for key elements only
- **Scale:** Designed to read clearly at 32×32px (slider pill) and 56×56px (emoji grid). Test by viewing at 25% zoom.

**Anti-generic test:** Could these exact illustrations appear in a generic dating app without modification? If yes → iterate on the geometric low-poly painterly texture until they feel uniquely JoyJoin.

---

## Prompt Draft (for Lovart ChatCanvas)

```
Goal: Create a set of 7 small expressive mini-illustrations to replace emoji icons in a personality test UI. Each should feel warm, geometric, and unmistakably part of the JoyJoin brand family.

Style lock for all 7:
- 2D digital illustration, low-poly geometric faceted aesthetic
- Painterly soft brushed texture within each facet
- Minimal or no outlines
- Soft gradients within polygonal facets
- Warm natural palette with Vibrant Purple #8B5CF6 and Warm Coral #FF9B85 as controlled accents
- Transparent background PNG
- Centered composition with breathing space
- Must read clearly when scaled down to 32×32px

Asset 1 — "Solo Rest": A peaceful character exhaling softly, eyes closed, resting. Warm beige #F5F1E8 atmospheric wash, soft purple highlights.

Asset 2 — "Party Ready": An energetic character with raised arms and tiny confetti sparkles. Warm Coral #FF9B85 energy, purple confetti accents.

Asset 3 — "Popcorn Observe": A curious spectator character peeking with wide eyes, holding a rounded popcorn shape. Cream and soft yellow tones.

Asset 4 — "Private DM": A gentle speech bubble with a heart inside, or a character leaning in to whisper. Sky Blue #A8C5DD tint, coral heart.

Asset 5 — "Leave Quietly": A character tiptoeing or fading into soft mist. Soft gray-blue mist edges, gentle disappearance feeling.

Asset 6 — "Peacemaker": An abstracted soft wing or dove shape holding an olive branch. Fresh Green #9ACD32 peace signal, rounded and friendly.

Asset 7 — "Direct Speak": A small rounded flame or spark shape, bold but friendly. Warm Coral #FF9B85 core, purple spark tips.

Please generate all 7 as a cohesive set. Export each as 128×128px PNG with transparency, plus 256×256px 2× versions.
```

---

## Export Requirements

| Asset ID | File name | Sizes |
|----------|-----------|-------|
| solo_rest | `lovart-icon-personality-solo-rest-20260507-v1.png` | 128×128, 256×256 |
| party_ready | `lovart-icon-personality-party-ready-20260507-v1.png` | 128×128, 256×256 |
| popcorn_observe | `lovart-icon-personality-popcorn-observe-20260507-v1.png` | 128×128, 256×256 |
| private_dm | `lovart-icon-personality-private-dm-20260507-v1.png` | 128×128, 256×256 |
| leave_quietly | `lovart-icon-personality-leave-quietly-20260507-v1.png` | 128×128, 256×256 |
| peacemaker | `lovart-icon-personality-peacemaker-20260507-v1.png` | 128×128, 256×256 |
| direct_speak | `lovart-icon-personality-direct-speak-20260507-v1.png` | 128×128, 256×256 |

**Save location:** `apps/mini-program/src/assets/lovart/personality-emojis/`

---

## Frontend Integration Notes

Once assets are delivered, frontend work involves:

1. **Create `emojiAssets.ts` mapping:**
   ```ts
   export const PERSONALITY_EMOJI_ASSETS: Record<string, string> = {
     '😮‍💨': '/assets/lovart/personality-emojis/lovart-icon-personality-solo-rest-20260507-v1.png',
     '🥳': '/assets/lovart/personality-emojis/lovart-icon-personality-party-ready-20260507-v1.png',
     '🍿': '/assets/lovart/personality-emojis/lovart-icon-personality-popcorn-observe-20260507-v1.png',
     '💬': '/assets/lovart/personality-emojis/lovart-icon-personality-private-dm-20260507-v1.png',
     '🤫': '/assets/lovart/personality-emojis/lovart-icon-personality-leave-quietly-20260507-v1.png',
     '🕊️': '/assets/lovart/personality-emojis/lovart-icon-personality-peacemaker-20260507-v1.png',
     '🔥': '/assets/lovart/personality-emojis/lovart-icon-personality-direct-speak-20260507-v1.png',
   }
   ```

2. **Update `PersonalityTestAnswerArea.tsx`:**
   - Replace `<Text>{sliderConfig.leftEmoji}</Text>` with `<Image src={PERSONALITY_EMOJI_ASSETS[sliderConfig.leftEmoji]} />`
   - Replace `<Text>{parts.emoji}</Text>` with `<Image src={PERSONALITY_EMOJI_ASSETS[parts.emoji]} />`
   - Update SCSS from `font-size` to `width/height` for images

3. **Update `PersonalityTestAnswerArea.scss`:**
   - `&__slider-pill-emoji`: `font-size` → `width: 32rpx; height: 32rpx;`
   - `&__emoji-option-emoji`: `font-size` → `width: 56rpx; height: 56rpx;`

4. **Bundle consideration:** These 7 PNGs (~10–20KB each) should be loaded via CDN or mini-program subpackage to avoid inflating the main bundle.

---

## Review Checklist

- [ ] All 7 assets share the same low-poly geometric painterly style
- [ ] Brand colors (`#8B5CF6`, `#FF9B85`) used consistently and sparingly
- [ ] Each asset reads clearly at 32×32px and 56×56px
- [ ] Transparent backgrounds (no white fringes)
- [ ] No text or lettering in the illustrations
- [ ] Warm, cute-but-tasteful tone throughout
- [ ] File sizes under 30KB each at 128×128px
- [ ] Naming follows `lovart-icon-personality-{name}-20260507-v1.png`
