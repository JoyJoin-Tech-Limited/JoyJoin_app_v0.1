# Lovart Brief: 悦仔 (Xiaoyue) Sprite Animation Frames

> **Goal:** Create sequential animation frames for JoyJoin's mascot 悦仔 (Xiaoyue) to bring the personality test to life with subtle, emotionally responsive sprite animations.

---

## Character Reference

**悦仔 (Xiaoyue)** is JoyJoin's warm, friendly mascot — a small curious creature with geometric low-poly features, large glossy expressive eyes, and soft rounded forms. Think of it as the emotional companion that guides users through the personality test.

**Reference the existing expressions** in our asset library for character consistency:
- `xiaoyue-test-curious.webp` — interested lean
- `xiaoyue-test-listening.webp` — attentive tilt
- `xiaoyue-test-nod.webp` — affirmative reaction
- `xiaoyue-test-surprised.webp` — milestone excitement
- `xiaoyue-match-success.webp` — celebration glow
- `xiaoyue-coach-guide.webp` — warm explainer

The character should feel identical in style across all frames — same proportions, same eye shape, same soft low-poly texture.

---

## Style Lock (画风统一 — MANDATORY)

Every frame must follow JoyJoin's canonical illustration style:

- **Construction:** 2D digital illustration with low-poly / geometric faceted aesthetic
- **Textures:** Painterly, soft brushed feel within each polygonal facet — NOT flat vector or 3D render
- **Outlines:** Minimal or none — let facet edges define form
- **Gradients:** Soft color variation within individual facets, not global gradients
- **Backgrounds:** Transparent (no background for sprite frames)
- **Characters:** Geometric polygonal body, large expressive glossy eyes, simplified features, warm expressions
- **Color treatment:** Natural warm palette; brand purple `#8B5CF6` for key accent elements only (eye sparkles, small accessories)

**Anti-generic test:** Could this exact character appear in a generic app without modification? If yes → iterate.

---

## Brand Colors

| Token | Hex | Usage |
|-------|-----|-------|
| Vibrant Purple | `#8B5CF6` | Eye sparkle accents, tiny accessory details |
| Warm Coral | `#FF9B85` | Warm cheek blush, celebratory glow |
| Warm Beige | `#F5F1E8` | Skin/fur base tone highlights |
| Sky Blue | `#A8C5DD` | Cool reflection in eyes |
| Soft White | `#FFFFFF` | Eye highlight dots, teeth |

---

## Delivery Spec

| Field | Value |
|-------|-------|
| **Format** | PNG with transparency |
| **Frame size** | 200 × 200 px (square canvas) |
| **Resolution** | 1× source (we downscale from larger masters if needed) |
| **File naming** | `frame-00.png`, `frame-01.png`, `frame-02.png` … |
| **Folder structure** | One folder per state name |

---

## States to Generate

### Batch 1 — Priority (Personality Test Core)

Generate these **4 states first**. Each is a short looping or one-shot animation.

---

### 1. `idle` — Breathing Loop (4-6 frames)

**Feeling:** Calm, present, gently waiting.

**Animation:** Subtle breathing cycle.
- Frame 0: Neutral relaxed pose, eyes open
- Frame 1: Slight chest/body rise (inhale), eyes soften
- Frame 2: Peak rise, tiny content smile forming
- Frame 3: Hold at top
- Frame 4: Body settles back down (exhale)
- Frame 5: Back to Frame 0 position

**Loop:** Yes (seamless cycle)
**Motion range:** Very subtle — body moves ±3-4px vertically, eyes blink once per cycle.

---

### 2. `curious` — Interested Lean (4-5 frames)

**Feeling:** Intrigued, leaning in, "tell me more."

**Animation:** Head leans forward with sparkling eyes.
- Frame 0: Neutral, looking straight
- Frame 1: Head tilts 5°, eyes widen slightly
- Frame 2: Leans further forward, eyebrows raise, small smile
- Frame 3: Peak lean — eyes have purple `#8B5CF6` sparkle dots
- Frame 4: Slight settle back (holds interest)

**Loop:** Yes
**Motion range:** Head shifts 8-10px forward, eyes get progressively more sparkly.

---

### 3. `nod` — Affirmative Acknowledgment (3-4 frames)

**Feeling:** "Got it." Warm, reassuring.

**Animation:** Single nod + satisfied smile.
- Frame 0: Looking at user, neutral warm expression
- Frame 1: Eyes close gently, head dips down 6px
- Frame 2: Head at lowest point, small smile
- Frame 3: Eyes open, head back up, content expression

**Loop:** No — plays once, holds on final frame
**Motion range:** Head bobs down and up (~6px), eyes close then open.

---

### 4. `celebrate` — Happy Success (5-6 frames)

**Feeling:** "Yes!" Small joyful bounce.

**Animation:** Tiny hop with starry eyes.
- Frame 0: Neutral happy
- Frame 1: Squash down (preparing to jump)
- Frame 2: Stretch up, rising 10px, eyes sparkle
- Frame 3: Peak height, arms/hands up if visible, biggest smile
- Frame 4: Falling back down
- Frame 5: Gentle landing with a tiny bounce settle

**Loop:** No — plays once, holds on final frame
**Motion range:** Vertical bounce 10-12px, squash-and-stretch on body.

---

## Batch 2 — Follow-up (4 states)

After Batch 1 is approved, generate these:

### 5. `listening` — Attentive Focus (4-5 frames)

Head tilted, ears (if any) perked, eyes tracking slightly as if following a voice.
Loop. Very subtle — 3-4px head tilt oscillation.

### 6. `thinking` — Processing (4-6 frames)

Hand to chin (or chin-rest pose), eyes looking upward, occasional blink.
Loop. Slight head rock back and forth. Classic "hmm" expression.

### 7. `surprised` — Milestone Excitement (4-5 frames)

**One-shot.** Eyes widen dramatically, tiny jump, hands up (if applicable), mouth small O.
Plays when user hits Q4/Q8 milestones.

### 8. `coach` — Warm Explainer (4-5 frames)

**Loop.** Gentle hand wave or head nod while speaking. Encouraging smile, soft eye contact.
Like a friendly teacher explaining something.

---

## Technical Notes for the Artist

1. **Keep the character centered** in every frame. The sprite engine crops to a circle, so face should be in the middle 60% of the canvas.

2. **Consistent silhouette** — the outer shape should not change drastically between frames. Sprite animation relies on small incremental changes.

3. **No motion blur** — each frame must be crisp. The animation engine handles timing via frame duration, not motion blur.

4. **Transparent background only** — no shadows, no ground plane, no atmospheric background. The frames will be composited onto UI surfaces.

5. **Eye sparkles are optional** — if they complicate the low-poly style, omit them. A simple glossy highlight dot is sufficient.

6. **Limbs** — if 悦仔 has arms/hands, keep them simple and geometric. If the character design works better as a floating head-like creature with no limbs, that's fine too. Consistency with existing expressions matters most.

---

## Output Handoff

When complete, deliver as:

```
xiaoyue-idle/
  frame-00.png
  frame-01.png
  frame-02.png
  frame-03.png
  frame-04.png
  frame-05.png

xiaoyue-curious/
  frame-00.png
  frame-01.png
  ...

xiaoyue-nod/
  ...

xiaoyue-celebrate/
  ...
```

Place all folders in `apps/mini-program/assets-source/mascot/xiaoyue-animations/` and run:

```bash
cd apps/mini-program
npm run generate:xiaoyue-spritesheet
```

The pipeline will auto-build WebP sprite sheets and update the manifest — no code changes needed.

---

## Anti-Pattern Warning

❌ **Do NOT:**
- Change character design between states (must be the exact same 悦仔)
- Add complex backgrounds or shadows
- Use 3D renders or photorealistic textures
- Make frames wildly different in size or position
- Add text, UI elements, or logos to frames

✅ **DO:**
- Keep changes incremental between frames
- Maintain the low-poly geometric texture style
- Keep the character centered and well-cropped
- Use the warm natural color palette consistently

---

*Brief prepared: 2026-05-07*  
*Skill: lovart-design-workflow*  
*Target platform: WeChat Mini Program (Taro)*
