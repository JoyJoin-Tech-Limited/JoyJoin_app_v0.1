# Lovart Prompt: 悦仔 (Xiaoyue) Master Sprite Sheet

> Generate a complete sprite animation sheet for JoyJoin's mascot 悦仔. This is a **single master image** containing all animation frames for 8 core states, arranged in a precise grid.

---

## STEP 1 — Character Design Lock (Generate First)

Before the sprite sheet, confirm the character design with me:

**悦仔 (Xiaoyue)** is JoyJoin's warm, friendly mascot companion. Style requirements:

- **2D low-poly geometric illustration** — painterly soft-brushed texture within polygonal facets
- **Minimal outlines** — facet edges define form
- **Large glossy expressive eyes** with soft highlight dots
- **Soft rounded body** — cute but tasteful, not childish
- **Warm natural palette** — beige/cream fur, purple `#8B5CF6` hoodie or accent details
- **No photorealism, no 3D render, no flat vector**

Generate **ONE reference portrait** first (front-facing, neutral expression, 512×512px) for approval. Do not proceed to the sprite sheet until I confirm the design.

---

## STEP 2 — Master Sprite Sheet Spec (After Design Approval)

Once the character design is locked, generate the **master sprite sheet** as a single image.

### Grid Layout

**8 rows × 4 columns** — each row is one animation state, each column is one frame.

| Row | State | Frame 0 | Frame 1 | Frame 2 | Frame 3 |
|-----|-------|---------|---------|---------|---------|
| 0 | **idle** | Neutral | Inhale rise | Peak rise | Exhale settle |
| 1 | **curious** | Neutral | Tilt 5° | Lean forward | Peak lean |
| 2 | **listening** | Neutral | Head tilt | Ear perk | Eyes track |
| 3 | **thinking** | Neutral | Chin rest | Eyes up | Blink |
| 4 | **nod** | Neutral | Eyes close, dip | Lowest point | Eyes open, up |
| 5 | **celebrate** | Neutral | Squash prep | Stretch up | Peak jump |
| 6 | **surprised** | Neutral | Eyes widen | Hands up | Mouth O |
| 7 | **coach** | Neutral | Wave hand | Nod smile | Encourage |

### Technical Spec

| Field | Value |
|-------|-------|
| **Frame size** | 256 × 256 px |
| **Grid** | 4 frames wide × 8 states tall |
| **Sheet size** | 1024 × 2048 px |
| **Spacing** | 0 px between frames (edge-to-edge) |
| **Background** | Fully transparent |
| **Format** | PNG with transparency |

### Frame-by-Frame Descriptions

#### Row 0: `idle` — Breathing Loop (4 frames)
A calm, gentle breathing cycle. Very subtle motion.
- **Frame 0:** Neutral relaxed pose, eyes gently open, soft smile
- **Frame 1:** Body rises 4px (inhale), eyes soften slightly
- **Frame 2:** Peak of rise, tiny content smile, eyes half-blink
- **Frame 3:** Settles back down (exhale), returns to near Frame 0

#### Row 1: `curious` — Interested Lean (4 frames)
Intrigued, leaning in to listen closer.
- **Frame 0:** Neutral, looking straight at viewer
- **Frame 1:** Head tilts 5° to side, eyes widen slightly
- **Frame 2:** Leans 10px forward, eyebrows raise, small smile forms
- **Frame 3:** Peak lean, eyes have purple `#8B5CF6` sparkle, most engaged

#### Row 2: `listening` — Attentive Focus (4 frames)
Tilted head, tracking a voice, deeply attentive.
- **Frame 0:** Neutral, ears relaxed
- **Frame 1:** Head tilts 8°, one ear perks up
- **Frame 2:** Eyes shift slightly as if following sound
- **Frame 3:** Slight lean, warm focused gaze

#### Row 3: `thinking` — Processing (4 frames)
Classic "hmm" pose — hand to chin, looking upward.
- **Frame 0:** Neutral, looking at viewer
- **Frame 1:** Hand (or paw) to chin, eyes glance upward
- **Frame 2:** Eyes move side to side as if processing
- **Frame 3:** Gentle blink, slight head rock

#### Row 4: `nod` — Affirmative Acknowledgment (4 frames)
Single warm nod — "Got it." Plays once.
- **Frame 0:** Warm neutral, looking at viewer
- **Frame 1:** Eyes close gently, head dips down 6px
- **Frame 2:** Head at lowest point, small satisfied smile
- **Frame 3:** Eyes open, head back up, content expression

#### Row 5: `celebrate` — Happy Success (4 frames)
Tiny joyful bounce — "Yes!" Plays once.
- **Frame 0:** Neutral happy
- **Frame 1:** Squash down (preparing to jump), eyes sparkle
- **Frame 2:** Stretch up, rising 12px, biggest smile, arms up
- **Frame 3:** Landing, gentle bounce settle, starry eyes

#### Row 6: `surprised` — Milestone Excitement (4 frames)
Eyes widen, tiny jump — milestone reaction. Plays once.
- **Frame 0:** Neutral happy
- **Frame 1:** Eyes widen dramatically, eyebrows shoot up
- **Frame 2:** Tiny jump, hands/paws up near face
- **Frame 3:** Peak surprise, mouth small O shape, excited glow

#### Row 7: `coach` — Warm Explainer (4 frames)
Friendly teacher — encouraging and warm. Looping.
- **Frame 0:** Warm smile, looking at viewer
- **Frame 1:** Gentle hand/paw wave, inviting gesture
- **Frame 2:** Nod with smile, eyes crinkled
- **Frame 3:** Open gesture, "you got this" expression

---

## CRITICAL Consistency Rules

These are **non-negotiable** for the sprite sheet to work:

1. **Character must be identical across all 32 frames** — same proportions, same eye shape, same fur color, same outfit. No redesigns between frames.

2. **Character must be centered** in every 256×256 cell. Face/body should occupy the middle 60% of the frame. Do not drift left/right/up/down between frames.

3. **Silhouette must stay stable** — outer body shape should not change drastically. Sprite animation relies on small incremental changes.

4. **No motion blur** — every frame must be crisp and sharp.

5. **Transparent background only** — absolutely no ground plane, shadows, or atmospheric background in any frame.

6. **Grid alignment must be pixel-perfect** — each frame is exactly 256×256, arranged in a strict 4×8 grid with zero padding between cells.

---

## Brand Color Reference

Use these exact hex codes:

| Color | Hex | Where to use |
|-------|-----|--------------|
| Vibrant Purple | `#8B5CF6` | Eye sparkle accents, hoodie/clothing |
| Warm Coral | `#FF9B85` | Cheek blush, warm highlights |
| Warm Beige | `#F5F1E8` | Skin/fur base tone |
| Sky Blue | `#A8C5DD` | Eye reflections |
| Soft White | `#FFFFFF` | Eye highlights |

---

## Output

Deliver as:
1. **Reference portrait** (512×512 PNG, transparent) — for design approval
2. **Master sprite sheet** (1024×2048 PNG, transparent) — the final grid

Label the final image clearly: `xiaoyue-master-spritesheet.png`

---

## Reference Material

For character consistency, study these existing JoyJoin expressions:

![Xiaoyue Reference Grid](/Users/vincentlai/GitHub/JoyJoin_app_v0.1/tmp/xiaoyue-reference-grid.png)

This grid shows all current 悦仔 expressions. The character in your sprite sheet must be the **exact same character** — same proportions, same style, same warmth.

---

*Prompt prepared for Lovart ChatCanvas — 2026-05-07*
