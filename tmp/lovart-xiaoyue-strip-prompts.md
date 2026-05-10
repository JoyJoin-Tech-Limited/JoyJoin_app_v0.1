# Lovart Strip-by-Strip Generation Prompts for 悦仔 (Xiaoyue)

> **Strategy:** Generate one horizontal strip per state. Each strip = 4 frames at 200×200px, arranged left-to-right. Strips are extracted into frames, then composited into per-state sprite sheets by our pipeline.

---

## STEP 0 — Base Character Reference (Generate This First)

**Prompt:**

> Generate a single reference portrait of JoyJoin's mascot character 悦仔 (Xiaoyue).
>
> **Style:** 2D low-poly geometric digital illustration. Painterly soft-brushed texture within polygonal facets. Minimal outlines — facet edges define form. Soft gradients within individual facets. Large glossy expressive eyes with highlight dots. Warm, cute but tasteful, not childish.
>
> **Character:** Small friendly creature with soft rounded geometric body, beige/cream fur tones, wearing a subtle purple `#8B5CF6` hoodie or scarf accent. Big round glossy eyes with sky blue `#A8C5DD` reflections and white `#FFFFFF` highlight dots. Warm natural palette.
>
> **Format:** 512×512px PNG, transparent background, centered, front-facing neutral expression with gentle smile.
>
> **Do NOT:** use photorealism, 3D render, flat vector, anime key art, complex tiny accessories, text, or background scenery.
>
> This is the canonical reference. All subsequent strips must match this exact character — same proportions, same eye shape, same fur color, same outfit details.

**Approval gate:** Do not proceed to Step 1 until you confirm this base reference looks correct and consistent with JoyJoin's brand.

---

## STEP 1 — Identity Check Strips (Generate These Next)

Generate `idle` and `curious` first. These establish whether Lovart can maintain identity across frames.

### Strip 1: `idle` — Breathing Loop

**Prompt:**

> Generate a horizontal sprite strip for the character 悦仔 (Xiaoyue), reference attached.
>
> **Strip spec:** 200×800px horizontal strip containing 4 frames left-to-right. Each frame is 200×200px. No gaps between frames. Transparent background.
>
> **Animation:** Very subtle breathing cycle.
> - Frame 1 (leftmost): Neutral relaxed pose, eyes gently open, soft smile
> - Frame 2: Body rises slightly (inhale), eyes soften
> - Frame 3: Peak of rise, tiny content smile, eyes half-blink
> - Frame 4 (rightmost): Settles back down (exhale), returns to near Frame 1
>
> **Motion range:** Body moves only ±3-4px vertically. Eyes blink once per cycle. Very gentle, almost imperceptible.
>
> **Critical rules:**
> - Character must be IDENTICAL to the base reference — same head shape, same eye size, same fur color, same outfit
> - Character must be centered in every 200×200 frame
> - No motion blur, no shadows, no ground plane, no background effects
> - No detached sparkles, floating symbols, or decorative elements
> - Transparent background only
>
> **Style lock:** Low-poly geometric illustration, painterly soft-brushed texture, minimal outlines, warm natural palette, purple `#8B5CF6` accent.

---

### Strip 2: `curious` — Interested Lean

**Prompt:**

> Generate a horizontal sprite strip for the character 悦仔 (Xiaoyue), reference attached.
>
> **Strip spec:** 200×800px horizontal strip, 4 frames, no gaps, transparent background.
>
> **Animation:** Intrigued, leaning in closer.
> - Frame 1: Neutral, looking straight at viewer
> - Frame 2: Head tilts 5° to side, eyes widen slightly
> - Frame 3: Leans forward, eyebrows raise, small smile forms
> - Frame 4: Peak lean — most engaged expression, eyes sparkle with purple `#8B5CF6` highlight
>
> **Motion range:** Head shifts 8-10px forward, eyes progressively more sparkly.
>
> **Critical rules:** (same as idle — identity lock, centered, no effects, transparent)

---

## STEP 2 — Batch Generation (After Idle + Curious Approved)

If idle and curious maintain identity well, generate the remaining 6 strips in parallel.

### Strip 3: `listening` — Attentive Focus

> Generate a horizontal sprite strip for 悦仔 (Xiaoyue), reference attached. 200×800px, 4 frames, no gaps, transparent.
>
> Animation: Tilted head, deeply attentive, tracking a voice.
> - Frame 1: Neutral, ears relaxed
> - Frame 2: Head tilts 8°, one ear perks up
> - Frame 3: Eyes shift slightly as if following sound
> - Frame 4: Slight lean, warm focused gaze
>
> Motion: Very subtle 3-4px head oscillation. Looping cycle.
> Rules: Identity lock, centered, no effects, transparent.

### Strip 4: `thinking` — Processing

> Generate a horizontal sprite strip for 悦仔 (Xiaoyue), reference attached. 200×800px, 4 frames, no gaps, transparent.
>
> Animation: Classic "hmm" pose — hand/paw to chin, looking upward.
> - Frame 1: Neutral, looking at viewer
> - Frame 2: Hand/paw to chin, eyes glance upward
> - Frame 3: Eyes move side to side as if processing
> - Frame 4: Gentle blink, slight head rock
>
> Motion: Head rocks back and forth 4-5px. Looping.
> Rules: Identity lock, centered, no effects, transparent.

### Strip 5: `nod` — Affirmative Acknowledgment (One-Shot)

> Generate a horizontal sprite strip for 悦仔 (Xiaoyue), reference attached. 200×800px, 4 frames, no gaps, transparent.
>
> Animation: Single warm nod — "Got it." Plays once, freezes on last frame.
> - Frame 1: Warm neutral, looking at viewer
> - Frame 2: Eyes close gently, head dips down 6px
> - Frame 3: Head at lowest point, small satisfied smile
> - Frame 4: Eyes open, head back up, content expression
>
> Motion: Head bobs down and up ~6px. One-shot, not looping.
> Rules: Identity lock, centered, no effects, transparent.

### Strip 6: `celebrate` — Happy Success (One-Shot)

> Generate a horizontal sprite strip for 悦仔 (Xiaoyue), reference attached. 200×800px, 4 frames, no gaps, transparent.
>
> Animation: Tiny joyful bounce — "Yes!" One-shot.
> - Frame 1: Neutral happy
> - Frame 2: Squash down preparing to jump, eyes sparkle
> - Frame 3: Stretch up, rising 12px, biggest smile, arms/paws up
> - Frame 4: Landing, gentle bounce settle, starry eyes
>
> Motion: Vertical bounce 10-12px with squash-and-stretch.
> Rules: Identity lock, centered, no effects, transparent.

### Strip 7: `surprised` — Milestone Excitement (One-Shot)

> Generate a horizontal sprite strip for 悦仔 (Xiaoyue), reference attached. 200×800px, 4 frames, no gaps, transparent.
>
> Animation: Eyes widen, tiny jump — milestone reaction. One-shot.
> - Frame 1: Neutral happy
> - Frame 2: Eyes widen dramatically, eyebrows shoot up
> - Frame 3: Tiny jump, hands/paws up near face
> - Frame 4: Peak surprise, mouth small O shape, excited glow
>
> Motion: Quick vertical pop 10px + facial expression change.
> Rules: Identity lock, centered, no effects, transparent.

### Strip 8: `coach` — Warm Explainer

> Generate a horizontal sprite strip for 悦仔 (Xiaoyue), reference attached. 200×800px, 4 frames, no gaps, transparent.
>
> Animation: Friendly teacher — encouraging and warm. Looping.
> - Frame 1: Warm smile, looking at viewer
> - Frame 2: Gentle hand/paw wave, inviting gesture
> - Frame 3: Nod with smile, eyes crinkled
> - Frame 4: Open gesture, "you got this" expression
>
> Motion: Subtle hand wave + head nod. Looping cycle.
> Rules: Identity lock, centered, no effects, transparent.

---

## STEP 3 — Extract and Build

Once all 8 strips are approved, run the extraction pipeline:

```bash
# 1. Place strips in: apps/mini-program/assets-source/mascot/xiaoyue-strips/

# 2. Extract frames
cd apps/mini-program
node scripts/extract-xiaoyue-strip-frames.mjs --all

# 3. QA contact sheet
node scripts/generate-xiaoyue-contact-sheet.mjs

# 4. Check for repairs
node scripts/queue-xiaoyue-repairs.mjs

# 5. Build sprite sheets
node scripts/generate-xiaoyue-spritesheet.mjs
```

---

## Troubleshooting

**"Lovart can't fit 4 frames in one strip consistently"**
→ Ask for **individual 200×200 frames** instead of strips, then place them manually in `xiaoyue-animations/<state>/frame-00.png` etc. Skip the strip extraction step.

**"Identity drifts between frames"**
→ Reduce frame count from 4 to 3, or ask for 2-frame minimal animations (Frame 0 + Frame 1) and let our CSS animation interpolate with fewer steps.

**"Lovart adds background or effects"**
→ Re-send the anti-pattern list:
> Do NOT add: shadows, ground plane, floating sparkles, speed lines, motion blur, text, UI elements, decorative frames, or background scenery. Transparent background only. Character must be isolated.

---

## Reference Material

Attach to every strip generation prompt:
1. **Base reference portrait** (512×512, approved in Step 0)
2. **Reference grid** (`tmp/xiaoyue-reference-grid.png`) — shows all existing static expressions

This ensures Lovart sees both the target character design and the existing expression range.
