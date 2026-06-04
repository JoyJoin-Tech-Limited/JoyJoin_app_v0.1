# Lovart Design Brief: Achievement & Milestone Badges — Batch D

> **Status:** 📝 Ready for commission
> **Goal:** Fill the post-onboarding achievement gap with 9 collectible badge/medallion illustrations. Currently the app celebrates personality-test completion richly but goes silent on subsequent milestones (first event, 3-event streak, quiz midway, match chemistry reasons, end-of-year stamp). This batch gives users ongoing, craft-grade rewards for showing up.
> **Target:** WeChat Mini Program (Taro)
> **Generation strategy:** **Single grid prompt → crop script.** One 2400×2400 master image containing 9 cells (3 cols × 3 rows × 800×800). Each cell is one independent badge sharing the same low-poly painterly medallion style.
> **Companion assets:** Batch B emotional icons (`REVEAL_MAP` reveal icons), existing archetype hero images, and the new Batch C ceremony heroes. The 5 D4 sub-variants share their color palette with the 5 Batch B reveal icons so the "chemistry reveal" feels like one continuous family.
> **Related rubric:** [`docs/reference/emotional-value-rubric.md`](../../reference/emotional-value-rubric.md) — primary lift 成就感 (Achievement) 2.5→4, secondary lift 被理解感 (Being Understood) and 仪式感 (Ritual).

---

## Brand Parameters

| Parameter | Value |
|-----------|-------|
| Primary color | Vibrant Purple `#8B5CF6` — primary anchor, badge center |
| Warmth | Warm Coral `#FF9B85` — energy peaks, "you did it" moments |
| Calm | Sky Blue `#A8C5DD` — companionship, parallel paths |
| Growth | Fresh Green `#9ACD32` — progress, streaks, leveling up |
| Soft | Warm Beige `#F5F1E8` — page background, badge base |
| Premium | Soft Gold `#E4C76B` — earned-it, milestone, stamp of approval |
| Subtle | Medium Gray `#9CA3AF` — secondary text, edge softening |
| Strong | Dark Gray `#374151` — primary text, structural contrast |
| Background | **Transparent** (PNG alpha) — assets sit on varied UI surfaces |
| Visual tone | warm, cute-but-tasteful, rounded, soft, lively, minimal-yet-refined |
| Typography | No text in assets — purely visual/iconic. No letters, no numbers, no readable characters. |

---

## Asset Specifications

- **Type:** badge / medallion / stamp set (9 collectible illustrations)
- **Platform:** WeChat Mini Program (Taro)
- **Master canvas:** 2400×2400px (3 columns × 3 rows)
- **Cell size:** 800×800px each, edge-to-edge, no gutter
- **Aspect ratio per cell:** 1:1 square (badge format)
- **Export format:** PNG with transparency (master) + per-cell crops → WebP optimized for runtime
- **Minimum resolution:** 1× for master, 2× and 3× for tier-specific display
- **File naming:** `lovart-badge-{name}-20260604-v1.{ext}`
- **Save location (master):** `apps/mini-program/raw-assets/lovart-master-batch-d-20260604-v1.png`
- **Save location (crops):** `apps/mini-program/src/assets/badges/`

---

## The 9 Assets

### 1. `first-event-celebrate` — First event joined
**Surface:** `my-events` empty → first join transition, or "first event" profile badge  
**Replaces:** Plain "暂无活动" + text  
**Emotion:** "Welcome to your first one. This is just the start."  
**Feeling:** The crest of a small hill — you've just climbed it. Look at the view. Awe + anticipation.  
**Visual:** A small flag planted on a rounded hilltop, the flag billowing gently in a soft warm breeze. The hill is Warm Beige `#F5F1E8` with Fresh Green `#9ACD32` grass accents. The flag is Vibrant Purple `#8B5CF6` with a single Warm Coral `#FF9B85` star. Behind the hill: a soft sky gradient (Sky Blue `#A8C5DD` to Soft Gold `#E4C76B` — sunrise/sunset feel). A few tiny sparkles in the air suggest "the world opening up." Subject is the flag-on-hill, centered, with the sky filling the upper 60% of the cell.  
**Color accent:** Vibrant Purple `#8B5CF6` flag, Fresh Green `#9ACD32` grass, Warm Coral `#FF9B85` star, Soft Gold `#E4C76B` sky glow.  
**WTP dimension lift:** 成就感 +5, 惊喜感 +3.

### 2. `streak-3-events` — 3-event streak
**Surface:** Profile / rewards — "你已参加 3 场活动"  
**Replaces:** Plain text "已参加 3 场"  
**Emotion:** "You're building something. Keep going."  
**Feeling:** A small flame on a candle that's been burning steadily. Not roaring — warm, persistent, "I keep showing up."  
**Visual:** A rounded ribbon banner (decorative shape only, no text) with a small stylized flame icon at its center. The flame is rounded, friendly, geometric — Warm Coral `#FF9B85` core, Soft Gold `#E4C76B` tips. The ribbon is Vibrant Purple `#8B5CF6` with Warm Beige `#F5F1E8` inner panels. Three small star pips on the ribbon hint at the "3" count without using numbers. Soft Warm Beige `#F5F1E8` atmospheric wash.  
**Color accent:** Warm Coral `#FF9B85` flame, Vibrant Purple `#8B5CF6` ribbon, Soft Gold `#E4C76B` flame tips.  
**WTP dimension lift:** 成就感 +4, 归属感 +3.

### 3. `quiz-halfway-cheer` — Personality test midpoint (Q30)
**Surface:** `/pages/onboarding/personality-test/index.tsx` at Q30 trigger  
**Replaces:** Plain progress bar update  
**Emotion:** "Halfway there! You're doing great."  
**Feeling:** A breath, a stretch, a small celebration before the second half. Encouraging without being patronizing.  
**Visual:** A small rounded figure (no specific archetype — generic JoyJoin style) stretching arms up, standing on a small horizontal progress bar that's exactly half-filled. The half-filled portion is Vibrant Purple `#8B5CF6`, the unfilled is Medium Gray `#9CA3AF` at low opacity. A small Warm Coral `#FF9B85` heart floats above the figure. Sparkles in the air suggest "you're making progress." Subject centered with breathing space.  
**Color accent:** Vibrant Purple `#8B5CF6` filled bar, Warm Coral `#FF9B85` heart, Medium Gray `#9CA3AF` unfilled bar.  
**WTP dimension lift:** 成就感 +3, 惊喜感 +2.

### 4a. `match-reason-same-relationship` — Shared life chapter
**Surface:** `matching-status/UnifiedRevealCard.tsx` shared-chemistry card hero (paired with Batch B `reveal-same-relationship` icon)  
**Replaces:** Plain text "你们处在相同的人生阶段"  
**Emotion:** "You're in the same chapter. Walking side by side."  
**Feeling:** Parallel companionship. Two people at the same point in life, each with their own path, but somehow the paths feel similar.  
**Visual:** Two small rounded figures walking on parallel curved paths that gently diverge then converge. The paths are Sky Blue `#A8C5DD`. Soft Gold `#E4C76B` sparkles trail behind each figure. Vibrant Purple `#8B5CF6` silhouettes. A subtle warm glow at the figure silhouettes. The composition reads left-to-right with generous negative space in the center. **Must use the same color accents as Batch B `reveal-same-relationship` for visual continuity.**  
**Color accent:** Sky Blue `#A8C5DD` paths, Soft Gold `#E4C76B` sparkles, Vibrant Purple `#8B5CF6` silhouettes.  
**WTP dimension lift:** 被理解感 +4, 归属感 +3.

### 4b. `match-reason-same-archetype-band` — Same frequency, different instrument
**Surface:** `matching-status/UnifiedRevealCard.tsx` (paired with Batch B `reveal-same-archetype-band` icon)  
**Replaces:** Plain text "你们的原型接近"  
**Emotion:** "Same frequency, different instrument. You harmonize."  
**Feeling:** Two people vibing — same song, different parts. Complementary, not identical.  
**Visual:** Two overlapping circular sound waves or musical notes that form a heart-like shape in their overlap region. The first wave is Vibrant Purple `#8B5CF6`, the second is Warm Coral `#FF9B85`; their overlap is Soft Gold `#E4C76B`. Sparkles around the heart-overlap suggest resonance. **Must use the same color accents as Batch B `reveal-same-archetype-band`.**  
**Color accent:** Vibrant Purple `#8B5CF6` + Warm Coral `#FF9B85` blending, Soft Gold `#E4C76B` resonance highlight.  
**WTP dimension lift:** 被理解感 +5, 惊喜感 +2.

### 4c. `match-reason-same-work-industry` — Industry peers
**Surface:** `matching-status/UnifiedRevealCard.tsx` (paired with Batch B `reveal-same-work-industry` icon)  
**Replaces:** Plain text "你们在同一行业"  
**Emotion:** "Industry peers, different perspectives."  
**Feeling:** Two people who understand each other's work context, even if they do different things. Camaraderie.  
**Visual:** Two rounded paw-shaped hands (abstract, no specific species — rounded polygonal body parts, NOT 悦仔 brand mascot) holding a small briefcase or rolled blueprint together, mid-stride as if walking to a meeting. The briefcase is Warm Beige `#F5F1E8` with Vibrant Purple `#8B5CF6` accent strap. Soft warm glow between the two paws. **Must use the same color accents as Batch B `reveal-same-work-industry`.**  
**Color accent:** Warm Beige `#F5F1E8` briefcase, Vibrant Purple `#8B5CF6` accent strap, soft warm glow.  
**WTP dimension lift:** 被理解感 +3, 身份认同 +3.

### 4d. `match-reason-exact-archetype` — Same soul, different body
**Surface:** `matching-status/UnifiedRevealCard.tsx` (paired with Batch B `reveal-exact-archetype` icon)  
**Replaces:** Plain text "你们的原型完全相同"  
**Emotion:** "Same soul, different body. Rare. Precious."  
**Feeling:** Mirror recognition. The rarest connection — when two strangers see themselves in each other.  
**Visual:** Two small figures facing each other, their outlines mirroring perfectly (left is mirror of right). A bright Soft Gold `#E4C76B` starburst with Warm Coral `#FF9B85` core sits between their foreheads. Vibrant Purple `#8B5CF6` radiating lines extend from the starburst outward. **Must use the same color accents as Batch B `reveal-exact-archetype`.**  
**Color accent:** Soft Gold `#E4C76B` starburst core, Warm Coral `#FF9B85` inner, Vibrant Purple `#8B5CF6` radiating lines.  
**WTP dimension lift:** 被理解感 +5, 仪式感 +4.

### 4e. `match-reason-hometown-industry` — Hometown + industry overlap
**Surface:** `matching-status/UnifiedRevealCard.tsx` (paired with Batch B `reveal-hometown-industry` icon)  
**Replaces:** Plain text "你们同乡又同行"  
**Emotion:** "Same hometown, same industry. Instant deep bond."  
**Feeling:** The "small world" surprise. Compound luck — meeting someone who's both from your city and your field.  
**Visual:** A small map pin / location marker with a warm flame/heart inside. The marker is Fresh Green `#9ACD32` (location) with a Warm Coral `#FF9B85` flame heart at the center. Soft Gold `#E4C76B` sparkles around the marker. A subtle Vibrant Purple `#8B5CF6` halo. **Must use the same color accents as Batch B `reveal-hometown-industry`.**  
**Color accent:** Fresh Green `#9ACD32` marker, Warm Coral `#FF9B85` flame heart, Soft Gold `#E4C76B` sparkles.  
**WTP dimension lift:** 归属感 +4, 被理解感 +3.

### 5. `recap-stamp-of-you` — End-of-year / season "stamp of you"
**Surface:** `/pages/icebreaker-session/phases/RecapPhaseView.tsx` end stamp overlay  
**Replaces:** Plain "感谢参与" text  
**Emotion:** "This season was yours. Here's your stamp."  
**Feeling:** A wax seal on a letter — official, warm, "you were here, and it mattered."  
**Visual:** A circular stamp/seal in Soft Gold `#E4C76B` (the "wax"), with an embossed Xiaoyue silhouette at the center. The Xiaoyue is rendered in Vibrant Purple `#8B5CF6` with a small star sparkle on the chest. Around the seal edge: decorative geometric dots and small sparkles (suggesting text without text). A subtle Warm Beige `#F5F1E8` inner ring frames the seal. Should feel collectible, weighty, "earned."  
**Color accent:** Soft Gold `#E4C76B` wax, Vibrant Purple `#8B5CF6` Xiaoyue silhouette, Warm Coral `#FF9B85` small star accent.  
**WTP dimension lift:** 仪式感 +5, 身份认同 +4.

---

## Cell Coordinate Table (Lovart Master Grid)

| Cell ID | Row | Col | Pixel offset (x, y) | Tier name | Palette anchor |
|---|---|---|---|---|---|
| D1 | 0 | 0 | (0, 0) | `first-event-celebrate` | Purple + Green + Gold |
| D2 | 0 | 1 | (800, 0) | `streak-3-events` | Coral + Purple + Gold |
| D3 | 0 | 2 | (1600, 0) | `quiz-halfway-cheer` | Purple + Coral + Gray |
| D4a | 1 | 0 | (0, 800) | `match-reason-same-relationship` | Sky Blue + Gold + Purple |
| D4b | 1 | 1 | (800, 800) | `match-reason-same-archetype-band` | Purple + Coral + Gold |
| D4c | 1 | 2 | (1600, 800) | `match-reason-same-work-industry` | Beige + Purple + warm glow |
| D4d | 2 | 0 | (0, 1600) | `match-reason-exact-archetype` | Gold + Coral + Purple |
| D4e | 2 | 1 | (800, 1600) | `match-reason-hometown-industry` | Green + Coral + Gold |
| D5 | 2 | 2 | (1600, 1600) | `recap-stamp-of-you` | Gold + Purple + Coral |

---

## Unified Style Lock (画风统一) — MANDATORY

All 9 cells MUST share this exact construction:

- **Construction:** 2D digital illustration with low-poly / geometric faceted aesthetic
- **Textures:** Painterly, soft brushed feel within each polygonal facet — NOT flat vector or 3D render
- **Outlines:** Minimal or none — let facet edges define form
- **Gradients:** Soft color variation within individual facets, not global gradients
- **Backgrounds:** **Transparent PNG (entire image alpha — every cell floats on transparent)**
- **Medallion weight:** Every cell should feel like a **collectible token** — slightly more visual density than an icon, with clear silhouette weight. Cells should be distinguishable at 64rpx and feel "earned" at 240rpx.
- **Characters — locked mascot = 悦仔 (Yuezai) / Xiaoyue:** When mascots appear (only D5 stamp), use the **JoyJoin brand mascot 悦仔** (Welsh Corgi Pembroke, weathered Vibrant Purple `#8B5CF6` hoodie, sunglasses hanging from collar, vintage watch, silver chain).
  - **DO NOT use the 社牛柯基 (corgi archetype)** — that's a user personality type (one of 12 archetypes), bouncy and without the purple hoodie. Putting the user archetype on system-level achievement surfaces would confuse users who got a different archetype.
  - **Reference image for Lovart:** upload `tmp/xiaoyue-reference-grid.webp` or `xiaoyue-master-spritesheet.webp` as the locked character model. Match it exactly.
  - For non-悦仔 figures (D1–D4, D5 supporting elements): use generic rounded polygonal bodies with large expressive glossy eyes — no specific species, no hoodie. These represent abstract people/relationships, not the brand mascot.
- **Composition:** Each cell's subject centered in its 800×800 frame with generous breathing space (~15% margin all sides)
- **Color treatment:** Natural warm palette; brand purple `#8B5CF6` and coral `#FF9B85` for key elements only. The 5 D4 cells **must match** Batch B `REVEAL_MAP` color accents exactly (the shared-chemistry hero should feel like a magnified version of the reveal icon).
- **Scale:** Designed to read clearly when displayed at 64rpx (small badge) and 240rpx (full badge card)
- **No text or symbols** in any cell. No letters, no numbers, no readable characters, no emoji. All text overlaid in code at integration.

**Anti-generic test (反通用测试):** Before approving, ask: *"Could these 9 illustrations appear in a generic social app or Duolingo-clone without modification?"* If yes → iterate. The medallion weight, the specific Xiaoyue construction, the low-poly painterly texture, and the deliberate "earned not granted" framing should make these unmistakably JoyJoin.

---

## Prompt Draft (Single Grid — paste into Lovart ChatCanvas)

> **Before pasting:** Upload `tmp/xiaoyue-reference-grid.webp` as a reference image in Lovart ChatCanvas and say "Use this as the locked character model — match the JoyJoin mascot 悦仔 exactly for the D5 stamp cell."

```
Generate 2400×2400 image, 3×3 grid of 9 cells at 800×800 px each, edge-to-edge, fully transparent background, pixel-perfect alignment.

Style: 2D low-poly geometric faceted illustration, painterly soft-brushed texture within facets, minimal outlines, soft gradients within facets. Medallion weight (collectible-token feel). Warm natural palette; Vibrant Purple #8B5CF6 and Warm Coral #FF9B85 as controlled accents. 悦仔 cells use the brand mascot (Welsh Corgi Pembroke, weathered purple hoodie, sunglasses, watch) — NOT the 社牛柯基 archetype. Other figures: generic rounded polygonal, large glossy eyes. ~15% breathing margin. No text, no symbols, no letters, no numbers, no emoji, no 3D, no photorealism, no flat vector. The 5 match-reason cells (D4a–D4e) MUST match the color palette of the JoyJoin Batch B REVEAL_MAP icons.

Cells:
(0,0) first-event-celebrate — Small flag on rounded hilltop, soft breeze. Hill #F5F1E8 + #9ACD32 grass. Flag #8B5CF6 with #FF9B85 star. Sky #A8C5DD→#E4C76B sunrise gradient, sparkles. "Welcome to your first one."
(0,1) streak-3-events — Decorative ribbon banner, stylized flame at center. Flame #FF9B85 core + #E4C76B tips. Ribbon #8B5CF6 with #F5F1E8 inner, 3 star pips. "You're building something."
(0,2) quiz-halfway-cheer — Small figure stretching arms up, standing on half-filled progress bar. Filled #8B5CF6, unfilled #9CA3AF low-opacity, #FF9B85 heart above. "Halfway there!"
(1,0) match-reason-same-relationship — Two figures on parallel curved paths that diverge then converge. Paths #A8C5DD, #E4C76B sparkles trail, #8B5CF6 silhouettes. Matches B "reveal-same-relationship" palette. "Same chapter."
(1,1) match-reason-same-archetype-band — Two overlapping sound waves forming heart in overlap. Wave 1 #8B5CF6, wave 2 #FF9B85, overlap #E4C76B. Matches B "reveal-same-archetype-band" palette. "Same frequency."
(1,2) match-reason-same-work-industry — Two abstract paw shapes holding briefcase mid-stride. Briefcase #F5F1E8 with #8B5CF6 strap, warm glow between. Matches B "reveal-same-work-industry" palette. "Industry peers."
(2,0) match-reason-exact-archetype — Two figures facing, outlines mirroring. #E4C76B starburst with #FF9B85 core between foreheads, #8B5CF6 radiating lines. Matches B "reveal-exact-archetype" palette. "Same soul."
(2,1) match-reason-hometown-industry — Map pin with flame/heart inside. Pin #9ACD32, flame #FF9B85, #E4C76B sparkles, #8B5CF6 halo. Matches B "reveal-hometown-industry" palette. "Same hometown + industry."
(2,2) recap-stamp-of-you — Circular gold seal (#E4C76B), embossed 悦仔 silhouette in #8B5CF6 with star on chest, decorative dots around edge (no text). "This season was yours."

Critical: all 9 cells same low-poly faceted painterly rendering, medallion weight, D4 cells match Batch B REVEAL_MAP palette exactly, every cell crisp no motion blur, full transparent background.

Export: PNG, 2400×2400, 2× resolution, full transparency. Filename: lovart-master-batch-d-20260604-v1.png
```

---

## Crop Script (Post-Generation)

After the master image is delivered, run this script to extract the 9 individual tiles.

```javascript
// apps/mini-program/scripts/crop-batch-d-grid.mjs
// Dependencies: sharp (already in mini-program devDependencies)
// Run: node apps/mini-program/scripts/crop-batch-d-grid.mjs

import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'

const SRC = 'apps/mini-program/raw-assets/lovart-master-batch-d-20260604-v1.png'
const OUT_DIR = 'apps/mini-program/src/assets/badges'
const CELL = 800

const CELLS = [
  { id: 'first-event-celebrate',                  col: 0, row: 0 },
  { id: 'streak-3-events',                        col: 1, row: 0 },
  { id: 'quiz-halfway-cheer',                     col: 2, row: 0 },
  { id: 'match-reason-same-relationship',         col: 0, row: 1 },
  { id: 'match-reason-same-archetype-band',       col: 1, row: 1 },
  { id: 'match-reason-same-work-industry',        col: 2, row: 1 },
  { id: 'match-reason-exact-archetype',           col: 0, row: 2 },
  { id: 'match-reason-hometown-industry',         col: 1, row: 2 },
  { id: 'recap-stamp-of-you',                     col: 2, row: 2 },
]

await mkdir(OUT_DIR, { recursive: true })

for (const c of CELLS) {
  await sharp(SRC)
    .extract({
      left: c.col * CELL,
      top:  c.row * CELL,
      width: CELL,
      height: CELL,
    })
    .png()
    .toFile(`${OUT_DIR}/${c.id}-20260604-v1.png`)
  console.log(`[batch-d] cropped ${c.id}`)
}
console.log(`[batch-d] done. ${CELLS.length} tiles written to ${OUT_DIR}`)
```

Then run `npm run optimize:lovart` (or the equivalent WebP optimizer) on the cropped tiles.

---

## Export Requirements

| # | ID | PNG | WebP | Display size | Notes |
|---|---|---|---|---|---|
| 1 | first-event-celebrate | `lovart-badge-first-event-celebrate-20260604-v1.png` | `lovart-badge-first-event-celebrate-20260604-v1.webp` | 200rpx hero / 80rpx badge | — |
| 2 | streak-3-events | `lovart-badge-streak-3-events-20260604-v1.png` | `lovart-badge-streak-3-events-20260604-v1.webp` | 80rpx | — |
| 3 | quiz-halfway-cheer | `lovart-badge-quiz-halfway-cheer-20260604-v1.png` | `lovart-badge-quiz-halfway-cheer-20260604-v1.webp` | 160rpx | in-flow, lighter palette |
| 4a | match-reason-same-relationship | `lovart-badge-match-reason-same-relationship-20260604-v1.png` | `lovart-badge-match-reason-same-relationship-20260604-v1.webp` | 240rpx hero / 120rpx inline | paired with Batch B `reveal-same-relationship` |
| 4b | match-reason-same-archetype-band | `lovart-badge-match-reason-same-archetype-band-20260604-v1.png` | `lovart-badge-match-reason-same-archetype-band-20260604-v1.webp` | 240rpx hero / 120rpx inline | paired with Batch B `reveal-same-archetype-band` |
| 4c | match-reason-same-work-industry | `lovart-badge-match-reason-same-work-industry-20260604-v1.png` | `lovart-badge-match-reason-same-work-industry-20260604-v1.webp` | 240rpx hero / 120rpx inline | paired with Batch B `reveal-same-work-industry` |
| 4d | match-reason-exact-archetype | `lovart-badge-match-reason-exact-archetype-20260604-v1.png` | `lovart-badge-match-reason-exact-archetype-20260604-v1.webp` | 240rpx hero / 120rpx inline | paired with Batch B `reveal-exact-archetype` |
| 4e | match-reason-hometown-industry | `lovart-badge-match-reason-hometown-industry-20260604-v1.png` | `lovart-badge-match-reason-hometown-industry-20260604-v1.webp` | 240rpx hero / 120rpx inline | paired with Batch B `reveal-hometown-industry` |
| 5 | recap-stamp-of-you | `lovart-badge-recap-stamp-of-you-20260604-v1.png` | `lovart-badge-recap-stamp-of-you-20260604-v1.webp` | 280rpx | large seal at recap end |

**File size target:** < 60KB per tile WebP, < 1.0MB for the full 2400×2400 master PNG.

**Save location (master):** `apps/mini-program/raw-assets/lovart-master-batch-d-20260604-v1.png`  
**Save location (crops):** `apps/mini-program/src/assets/badges/{name}-20260604-v1.{png,webp}`  
**CDN path:** `/static/assets/badges/{name}-20260604-v1.webp` (upload via `npm run upload:cdn-assets`)

---

## Frontend Integration Notes

After the 9 cropped tiles arrive:

### 1. New milestone badge registry — `apps/mini-program/src/lib/milestoneBadges.ts`

```ts
import { cdnAsset } from './cdn'

export const MILESTONE_BADGES = {
  firstEvent: cdnAsset('/assets/badges/first-event-celebrate-20260604-v1.webp'),
  streak3: cdnAsset('/assets/badges/streak-3-events-20260604-v1.webp'),
  quizHalfway: cdnAsset('/assets/badges/quiz-halfway-cheer-20260604-v1.webp'),
  matchReasonSameRelationship: cdnAsset('/assets/badges/match-reason-same-relationship-20260604-v1.webp'),
  matchReasonSameArchetypeBand: cdnAsset('/assets/badges/match-reason-same-archetype-band-20260604-v1.webp'),
  matchReasonSameWorkIndustry: cdnAsset('/assets/badges/match-reason-same-work-industry-20260604-v1.webp'),
  matchReasonExactArchetype: cdnAsset('/assets/badges/match-reason-exact-archetype-20260604-v1.webp'),
  matchReasonHometownIndustry: cdnAsset('/assets/badges/match-reason-hometown-industry-20260604-v1.webp'),
  recapStamp: cdnAsset('/assets/badges/recap-stamp-of-you-20260604-v1.webp'),
} as const

export type MilestoneBadgeKey = keyof typeof MILESTONE_BADGES
```

### 2. First-event-celebrate (D1) — `pages/my-events/index.tsx` + profile

- Trigger: when the user joins their first event (server returns `first_event: true` flag, or localStorage check on first join)
- Render: full hero at 200rpx on the my-events page, paired with celebratory copy
- Also surface as a 80rpx badge on the profile page (next to archetype hero)

### 3. Streak-3-events (D2) — profile + rewards

- Trigger: when the server reports `eventsAttended >= 3`
- Render: 80rpx badge on profile (alongside archetype hero)
- Replaces or pairs with existing plain text "已参加 N 场" copy

### 4. Quiz-halfway-cheer (D3) — `pages/onboarding/personality-test/index.tsx`

- Trigger: at Q30 (midpoint of V4 assessment)
- Render: inline celebration at 160rpx with a 0.5s entrance animation
- Pair with Xiaoyue `coachGuide` mascot + encouraging copy
- Disappears after the user taps to continue

> **Shipped variant (2026-06-04) — diverges from this brief:**
>
> - **Trigger is `progressPercent >= 50`**, not Q30-specific. The V4 adaptive engine varies total question count (8–16) per user, so a hardcoded Q30 is wrong; the percentage threshold matches the "halfway" user-perception semantically.
> - **Badge is 112rpx (hero-sized)**, not 160rpx. Paired with a soft halo (`&__halfway-badge-halo` radial gradient) + 9 CSS-only confetti particles (`star`/`sparkle`/`dot`/`ribbon` shapes with hand-tuned positions and 0.04–0.68s staggered delays). Confetti is CSS-only — no new Lovart assets, no JS state.
> - **Animation**: 0.36s stage entrance + 0.6s halo settle + 0.4s text enter. `cubic-bezier(0.22, 1, 0.36, 1)` for all three.
> - **Copy**: eyebrow `半程已过` + main `走到一半了，继续走～` (xiaoyue-writing-craft + wow-elements, not a corporate cheerleader).
> - **No `coachGuide` mascot paired.** The testing-zone mascot (Zone C) was independently re-architected (2026-06-04) to render a high-res 1190×1190 CDN WebP at rest, so the static mascot itself reads as a high-quality image. Adding `coachGuide` on top would crowd the zone.
> - **Does NOT disappear on tap.** The badge stays for the rest of the testing phase (`phase === 'testing'`) and only unmounts when the user leaves the testing state. The "Halfway there!" feeling should accompany the second-half questions, not vanish on first tap.
> - **Operational**: `logInfo('[PersonalityTest] halfway milestone reached')` + `analytics.interaction('personality_test_halfway_milestone_reached', { answered, estimatedTotal })` fire once via `halfwayShownRef`. `aria-label='测验已完成一半，半程已过，继续加油'` on the stage. Reduced-motion: confetti freezes at `opacity: 0.85; scale(1)` instead of `display: none` — preserves the celebratory feel for users who opt out of motion.
> - **Resumed-test safety**: `halfwayShownRef` initializes to `false` and is set to `true` inside the existing useEffect when `progressPercent >= 50` and `phase === 'testing'`. Users who already passed 50% on a prior session get the badge on the next render.

### 5. Match-reason heroes (D4a–D4e) — `pages/matching-status/UnifiedRevealCard.tsx`

- The 5 D4 tiles pair with the 5 Batch B `REVEAL_MAP` entries
- Layout: Batch B icon at 96rpx (existing wiring in `emojiToIconMap.ts`) + D4 hero at 240rpx behind/around it as the "magnified shared-chemistry" backdrop
- The hero is the visual anchor; the icon is the corner detail
- Color palette must feel like one family across the 5 (each cell uses its specific color accent per the spec above)

### 6. Recap-stamp-of-you (D5) — `RecapPhaseView.tsx` end overlay

- Trigger: when the recap phase reaches its end state
- Render: 280rpx centered seal with celebratory animation (wax-press effect via CSS scale + opacity)
- Pair with text like "这是属于你的季度印记" (overlay in code, not in the asset)

**Current state (before commission):** All 9 surfaces use either plain text, mascot-only, or no celebration. Adding the new badges is purely additive — no risk of removing existing warmth.

---

## Review Checklist

- [ ] All 9 cells share the same low-poly geometric painterly medallion style
- [ ] All cells depict a "collectible token" weight (slightly more visual density than a flat icon)
- [ ] Brand colors (`#8B5CF6`, `#FF9B85`, `#E4C76B`) used consistently and sparingly per cell
- [ ] The 5 match-reason cells (D4a–D4e) use **exactly** the same color accents as the corresponding Batch B `REVEAL_MAP` entries
- [ ] Each cell reads clearly when cropped to 800×800 and displayed at 80rpx (small) and 240rpx (hero)
- [ ] Transparent backgrounds across the entire 2400×2400 master image (no white fringes)
- [ ] No text, no symbols, no letters, no numbers in any cell
- [ ] No 3D render, no photorealism, no flat vector
- [ ] Cell alignment pixel-perfect (no drift between cells)
- [ ] Master file size under 1.0MB PNG
- [ ] Each cropped tile under 60KB WebP
- [ ] Naming follows `lovart-badge-{name}-20260604-v1.{ext}`
- [ ] 5 match-reason cells form a coherent "chemistry family" with Batch B `REVEAL_MAP` (verified by side-by-side visual check)
- [ ] Anti-generic test passed: "Could these appear in a generic social app without modification?" → NO
- [ ] Medallion-weight test passed: At 64rpx, each cell still reads as a token (not as a flat icon)
