# Lovart Design Brief: 悦仔 (Xiaoyue) 9-Frame Sprite Strips + Intro Animation

> **Reference grid:** `tmp/xiaoyue-reference-grid.png` — use this for character consistency
> **Date:** 2026-05-07
> **Priority:** High — blocks smoother sprite animation and intro mascot polish

---

## Goal

Replace choppy 4-frame sprite strips with smooth 9-frame versions for all 8 animated states. Add a new dedicated `intro` state for the onboarding welcome moment.

---

## Brand Parameters (MANDATORY — inject into every prompt)

| Parameter | Value |
|-----------|-------|
| **Primary accent** | Vibrant Purple `#8B5CF6` (hoodie color) |
| **Warm highlight** | Warm Coral `#FF9B85` (ears, nose warm tones) |
| **Background** | Transparent — NOT Warm Beige. These are sprite assets for CSS animation. |
| **Mascot** | 悦仔 (Xiaoyue) — 气氛组柯基 (Corgi archetype). Playful, optimistic, welcoming. |
| **Visual tone** | warm, cute-but-tasteful, rounded-and-soft, lively, minimal-yet-refined |

### Style Lock (画风统一) — MANDATORY

- **Construction:** 2D digital illustration with low-poly / geometric faceted aesthetic
- **Textures:** Painterly, soft brushed watercolor feel within each polygonal facet — NOT flat vector or 3D render
- **Outlines:** Minimal or none — let facet edges define form
- **Gradients:** Soft color variation within individual facets, not global gradients
- **Backgrounds:** Transparent PNG (alpha channel). No atmospheric background — these are UI sprite assets.
- **Characters:** Geometric polygonal bodies, large expressive glossy eyes, simplified features, warm expressions
- **Framing:** Upper-body bust portrait (head + shoulders + hoodie). Face occupies ~50% of frame height. NOT full-body.
- **Composition:** Centered subject, generous padding inside square frame, consistent head size across all frames
- **Color treatment:** Natural warm corgi palette (tan, white, cream); purple `#8B5CF6` hoodie; controlled purple accent only

**Anti-generic test:** If this corgi could appear in a generic pet app without the purple hoodie → add more JoyJoin-specific personality (expression dynamism, hoodie detail, ear positioning).

---

## Part A: 9-Frame Strips (8 States)

### Strip Spec

| Property | Value |
|----------|-------|
| **Frame size** | 512×512px |
| **Frames per strip** | 9, arranged horizontally left-to-right |
| **Strip dimensions** | 4608×512px |
| **Format** | PNG with transparency (alpha channel) |
| **Padding** | None between frames — edge-to-edge |
| **Frame consistency** | Character head size, body position, and hoodie details must be **pixel-identical** across all 9 frames. Only expression/gesture changes. |

### State Definitions

For each state below, generate a **4608×512px horizontal strip** (9 frames). Use the existing 4-frame strips in `xiaoyue-strips/` as motion reference — extend the same gesture into 9 smoother steps.

---

#### 1. `idle` — Gentle Breathing Loop
**Emotion:** Calm, present, subtly alive  
**Motion:** Subtle chest rise/fall breathing, slight ear twitch, gentle blink cycle  
**Frame breakdown:**
1. Neutral pose, eyes open
2. Eyes begin close (slow blink)
3. Eyes fully closed, slight smile
4. Eyes opening, chest slightly expanded (inhale)
5. Full inhale, chest up, ears perked
6. Hold breath, content expression
7. Begin exhale, chest relax
8. Full exhale, back to neutral
9. Micro-pause before next cycle

---

#### 2. `curious` — Interested Head-Tilt
**Emotion:** Curious, attentive, slightly puzzled  
**Motion:** Head tilts left/right, one ear perks higher, eyes widen slightly  
**Frame breakdown:**
1. Neutral, looking straight
2. Head begins tilt left
3. Full left tilt, left ear higher, eyebrow raised
4. Hold left tilt, eyes widen
5. Return to center (transition)
6. Head begins tilt right
7. Full right tilt, right ear higher
8. Hold right tilt, slight mouth open ("hmm?")
9. Return to center, expectant expression

---

#### 3. `listening` — Attentive Ear-Perk
**Emotion:** Focused, empathetic, engaged  
**Motion:** Ears rotate forward, slight lean-in, gentle nod rhythm  
**Frame breakdown:**
1. Neutral, ears relaxed
2. Both ears perk forward slightly
3. Full forward perk, eyes soften
4. Lean in (upper body shifts 2-3% forward)
5. Hold lean, gentle closed-mouth smile
6. Micro-nod down
7. Micro-nod up
8. Return to lean position
9. Soft blink, still engaged

---

#### 4. `thinking` — Contemplative Chin-Stroke
**Emotion:** Processing, thoughtful, unhurried  
**Motion:** Paw touches chin, eyes look upward, slow rhythmic tap  
**Frame breakdown:**
1. Neutral, looking up-right
2. Right paw begins lifting
3. Paw touches chin
4. Hold chin-touch, eyes shift up-left
5. Tap 1 (paw presses slightly)
6. Tap 2
7. Eyes narrow slightly ("processing...")
8. Tap 3
9. Paw begins lowering, slight "aha" eyebrow raise

---

#### 5. `nod` — Happy Affirmation (One-Shot)
**Emotion:** Encouraging, positive, approving  
**Motion:** Confident down-up nod, slight smile widening  
**Frame breakdown:**
1. Neutral smile
2. Chin begins down
3. Full down nod, eyes close happily
4. Chin begins up
5. Return center, bigger smile
6. Micro-bounce (excess energy)
7. Settle
8. Hold content expression
9. Return to still neutral

---

#### 6. `surprised` — Delighted Shock (One-Shot)
**Emotion:** Pleasantly surprised, ears perked, eyes wide  
**Motion:** Quick ear pop, eyes widen, mouth opens in happy "o"  
**Frame breakdown:**
1. Neutral
2. Eyes begin widening
3. Ears shoot straight up
4. Full surprise — wide eyes, open mouth, raised eyebrows
5. Hold peak surprise
6. Begin softening ("oh wow!")
7. Smile replaces open mouth
8. Ears relax halfway
9. Happy residual expression

---

#### 7. `celebrate` — Joyful Triumph (One-Shot)
**Emotion:** Ecstatic, paws up, triumphant  
**Motion:** Both paws raise, mouth open in happy bark-laugh, slight jump  
**Frame breakdown:**
1. Neutral, building excitement
2. Mouth opens, eyes brighten
3. Left paw raises
4. Right paw raises
5. Both paws up, peak joy, tongue slightly out
6. Hold celebration pose
7. Begin settling (paws lower slightly)
8. Wide satisfied grin
9. Warm afterglow smile

---

#### 8. `coach` — Warm Guidance Wave (Loop)
**Emotion:** Friendly, mentoring, welcoming  
**Motion:** Gentle wave with one paw, reassuring smile, slight head bob  
**Frame breakdown:**
1. Neutral welcoming smile
2. Right paw begins raising
3. Paw up, open-palm wave start
4. Wave left
5. Wave right
6. Wave left
7. Paw begins lowering
8. Both paws down, warm smile
9. Slight lean forward ("you got this")

---

## Part B: Intro State (New)

### `intro` — Onboarding Welcome Entrance (One-Shot)

**Usage:** First-time user sees this when entering the personality test. Plays once, then transitions to `idle` loop.

**Emotion:** Enthusiastic greeting, personal welcome, settling into conversation  
**Motion:** Peek up from below → wave hello → settle into idle  

**Frame breakdown:**
1. **Peek:** Character is 30% below frame center, only ears and eyes visible at bottom edge, curious expression
2. **Rise:** Rising into full view, mouth closed, eyes bright
3. **Center:** Fully centered, neutral happy face
4. **Wave start:** Right paw raises in greeting wave
5. **Wave peak:** Full wave, big open smile, eyes sparkling ("Hello!")
6. **Wave settle:** Paw lowers slightly, warm closed-mouth smile
7. **Breathe in:** Chest expands, content expression
8. **Breathe out:** Relax, gentle smile
9. **Idle ready:** Neutral idle pose, ready for conversation

**Strip spec:** Same as above — 4608×512px, 9 frames, 512×512 each, transparent PNG.

---

## Production Notes for Lovart

### Frame Consistency Rules

These are **critical** — inconsistent frames break the CSS sprite animation:

1. **Head size:** Must be pixel-identical across all 9 frames. Use a circular head guide.
2. **Body anchor:** Shoulders/hoodie bottom should stay in the same Y-position (±2px max).
3. **Hoodie details:** Drawstrings, zipper, folds must not jump between frames.
4. **Color consistency:** Same hex values for purple `#8B5CF6`, tan fur, cream belly across all frames.
5. **No background:** Pure transparency. Not white, not grey, not "almost transparent."

### Delivery Format

Deliver as **9 individual square PNGs per state** (we'll composite the strip). OR deliver as **one horizontal strip per state**.

If individual: name as `xiaoyue-{state}-frame-{00..08}.png`
If strip: name as `xiaoyue-{state}-strip.png`

### Batch Order (Recommended)

Generate in this order for review/feedback:
1. `idle` (simplest — establish baseline consistency)
2. `intro` (new state — validate the entrance motion)
3. `curious`, `listening`, `thinking` (core personality test states)
4. `nod`, `surprised`, `celebrate`, `coach` (reaction states)

---

## Lovart Prompt Template (Copy-Paste Ready)

```
Hi Lovart! I need sprite animation frames for my app's mascot — a corgi character named 悦仔 (Xiaoyue).

**Character reference:** See the attached reference grid. Corgi in purple hoodie #8B5CF6, low-poly geometric watercolor style, painterly soft brushed texture within polygonal facets, large expressive glossy eyes, minimal outlines.

**Task:** Generate 9 animation frames for the [STATE] state.

**Motion description:** [Paste from Part A above]

**Framing rules (MANDATORY):**
- Upper-body bust portrait ONLY (head + shoulders + hoodie). NOT full body.
- Face occupies ~50% of frame height.
- Character centered in a 512×512 square.
- Head size and body anchor position must be IDENTICAL across all 9 frames.
- Transparent background (alpha PNG) — no color, no vignette, no atmospheric background.

**Style lock:**
- 2D digital illustration, low-poly geometric faceted aesthetic
- Soft watercolor brushed texture within each facet
- Warm natural corgi palette (tan, cream, white)
- Purple hoodie #8B5CF6
- Minimal outlines, facet edges define form

**Deliverable:** 9 individual 512×512 transparent PNGs, or one 4608×512 horizontal strip.

Please generate all 9 frames in one batch so I can verify consistency.
```

---

## Review Checklist (After Delivery)

- [ ] All 9 frames have identical head size (overlay test)
- [ ] Body anchor point consistent (±2px)
- [ ] Hoodie details match across frames
- [ ] Transparent background (check with checkerboard in image viewer)
- [ ] No frame has missing ears, shifted eyes, or color drift
- [ ] Motion reads clearly at 100ms/frame (9 frames = ~900ms cycle)
- [ ] `intro` state: frame 1 (peek) is recognizable as "entering from below"
- [ ] `intro` state: frame 5 (wave peak) feels genuinely welcoming

---

## Pipeline Handoff

After Lovart delivery:
1. Place strips in `apps/mini-program/assets-source/mascot/xiaoyue-strips/`
2. Run `node scripts/extract-xiaoyue-strip-frames.mjs --all --frame-size 512`
3. Run `node scripts/clean-xiaoyue-backgrounds.mjs` (safety pass)
4. Run `node scripts/generate-xiaoyue-spritesheet.mjs`
5. Update `state-meta.json` — `intro` gets `oneShot: true`, `frameCount: 9`, `duration: 900`
6. Wire `intro` into `PersonalityTestPage` intro phase
