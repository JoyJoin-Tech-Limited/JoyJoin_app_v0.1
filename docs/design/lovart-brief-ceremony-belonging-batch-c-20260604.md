# Lovart Design Brief: Ceremony & Belonging Heroes — Batch C

> **Status:** 📝 Ready for commission (partially superseded 2026-06-25)
> **Goal:** Replace mascot-only and abstract surfaces at the highest-emotion transition moments (returning after absence, payment confirmation, inviting a friend, post-event thanks, session end) with full-bleed hero illustrations that lift 仪式感 (Ritual) and 归属感 (Belonging) — the two 情绪价值 dimensions currently scoring ~2.5/4 in the app.
>
> **2026-06-25 update:** The three tier-vibe backdrops (3a/b/c) were superseded by CDN-backed Lovart side-art `tier-card-{breeze,glow,blaze,custom}.webp` in `pages/icebreaker-session/tier-selector/index.tsx` and have been removed from `ceremonyHeroes.ts`. The remaining five heroes (C1, C2, C4, C5, C6) remain active.
> **Target:** WeChat Mini Program (Taro)
> **Generation strategy:** **Single grid prompt → crop script.** One 3200×1600 master image containing 8 cells (4 cols × 2 rows × 800×800). Each cell is one independent illustration sharing the same low-poly painterly style lock.
> **Companion assets:** Batch B (emotional icons), existing xiaoyue mascot expressions, and the speed-friending phase icon. All color accents must stay within the JoyJoin 8-color palette.
> **Related rubric:** [`docs/reference/emotional-value-rubric.md`](../../reference/emotional-value-rubric.md) — 6 dimensions, target lift 仪式感 2.5→4, 归属感 3→4.

---

## Brand Parameters

| Parameter | Value |
|-----------|-------|
| Primary color | Vibrant Purple `#8B5CF6` — primary anchor, ribbons, brand accent |
| Warmth | Warm Coral `#FF9B85` — emotional peaks, celebration, warmth |
| Calm | Sky Blue `#A8C5DD` — gentle transitions, breathable surfaces |
| Growth | Fresh Green `#9ACD32` — progress, "you leveled up" moments |
| Soft | Warm Beige `#F5F1E8` — atmospheric wash, page backgrounds |
| Premium | Soft Gold `#E4C76B` — premium tier glow, brand stamp |
| Subtle | Medium Gray `#9CA3AF` — secondary text, edge softening |
| Strong | Dark Gray `#374151` — primary text, structural contrast |
| Background | **Transparent** (PNG alpha) — assets sit on varied UI surfaces |
| Visual tone | warm, cute-but-tasteful, rounded, soft, lively, minimal-yet-refined |
| Typography | No text in assets — purely visual/iconic |

---

## Asset Specifications

- **Type:** hero-illustration set (8 full-bleed images)
- **Platform:** WeChat Mini Program (Taro)
- **Master canvas:** 3200×1600px (4 columns × 2 rows)
- **Cell size:** 800×800px each, edge-to-edge, no gutter
- **Aspect ratio per cell:** 1:1 square (display contexts letterbox/center-crop as needed at integration)
- **Export format:** PNG with transparency (master) + per-cell crops → WebP optimized for runtime
- **Minimum resolution:** 1× for master, 2× and 3× for tier-specific display
- **File naming:** `lovart-hero-{name}-20260604-v1.{ext}`
- **Save location (master):** `apps/mini-program/raw-assets/lovart-master-batch-c-20260604-v1.png`
- **Save location (crops):** `apps/mini-program/src/assets/ceremony/`

---

## The 8 Assets

### 1. `welcome-back-hero` — Returning user celebration
**Surface:** `/pages/onboarding/welcome-back` (replace mascot-only `coachGuide` with full hero)  
**Replaces:** Mascot + plain background  
**Emotion:** "We saved your place. Pick up where you left off."  
**Feeling:** Warm, slightly sheepish, genuinely happy to see the user return. The app remembered them. Their data is intact.  
**Visual:** Xiaoyue standing in a softly lit doorway, one paw holding the door open, the other gesturing "come in" with a gentle smile. Behind the door: a glimpse of the JoyJoin world — soft purple glow, small warm coral sparkles, a faint silhouette of the home tab. The doorway itself is rounded, framed by Warm Beige `#F5F1E8`. A small heart-shaped sparkle floats just above the doorframe.  
**Color accent:** Vibrant Purple `#8B5CF6` door frame, Warm Coral `#FF9B85` heart sparkle, Warm Beige `#F5F1E8` background atmosphere.  
**WTP dimension lift:** 归属感 +5, 仪式感 +5.

### 2. `event-paid-confirmed` — Post-payment confirmation
**Surface:** `/pages/blind-box-payment` success state (replace text-only success)  
**Replaces:** "支付成功" toast + checkmark  
**Emotion:** "You're officially in. This is real."  
**Feeling:** Breathtaking, ticket-in-hand moment. The user just committed money to attend an event; the surface should feel like opening an envelope with a real ticket inside — not a generic "payment received" page.  
**Visual:** Xiaoyue proudly presenting a small stylized event ticket toward the viewer, both paws holding the ticket's edges, grinning with genuine excitement. The ticket has a small Vibrant Purple `#8B5CF6` ribbon, a "JoyJoin" stamp in the corner, and a Soft Gold `#E4C76B` serial number band (decorative, no readable text). Behind the ticket, soft Warm Coral `#FF9B85` glow radiates outward. A few tiny confetti dots float around.  
**Color accent:** Vibrant Purple `#8B5CF6` ribbon, Soft Gold `#E4C76B` ticket band, Warm Coral `#FF9B85` glow halo.  
**WTP dimension lift:** 仪式感 +4, 成就感 +3.

### 3a. `tier-vibe-breeze` — 破冰局 (40 min, light ice-breaker)
**Surface:** `/pages/icebreaker-session/tier-selector` — backdrop for the `breeze` tier card  
**Replaces:** Phase icon only (no backdrop)  
**Emotion:** "A soft start. Easy in, no pressure."  
**Feeling:** A gentle morning breeze, leaves drifting, soft sky. Calming, low-stakes, "you can do this."  
**Visual:** Soft Wind + drifting leaf + small teacup motif. Abstract swirling Sky Blue `#A8C5DD` wind lines curve gently around a small Fresh Green `#9ACD32` leaf mid-flight. A tiny rounded teacup with warm steam sits on the lower-left. Should feel breathable and quiet — never empty.  
**Color accent:** Sky Blue `#A8C5DD` primary, Fresh Green `#9ACD32` leaf, Warm Beige `#F5F1E8` cup body.  
**WTP dimension lift:** 身份认同 +3, 仪式感 +2.

### 3b. `tier-vibe-glow` — 畅聊局 (60 min, deep connection)
**Surface:** `/pages/icebreaker-session/tier-selector` — backdrop for the `glow` tier card  
**Replaces:** Phase icon only (no backdrop)  
**Emotion:** "Warm, real conversation. Worth the hour."  
**Feeling:** A warm evening glow, two people leaning in across a small table, soft light between them. Premium, intimate, "this is the real thing."  
**Visual:** Two small rounded figures (silhouettes only — no faces) facing each other across a tiny round table, with a small warm glow between them. Two wine-glass or teacup silhouettes sit on the table. Vibrant Purple `#8B5CF6` backlight frames the scene; Warm Coral `#FF9B85` glow emanates from the center. Should feel like a Polaroid of a good conversation.  
**Color accent:** Vibrant Purple `#8B5CF6` rim light, Warm Coral `#FF9B85` inner glow, Soft Gold `#E4C76B` table surface.  
**WTP dimension lift:** 身份认同 +5, 仪式感 +3.

### 3c. `tier-vibe-blaze` — 狂欢局 (90 min, high energy)
**Surface:** `/pages/icebreaker-session/tier-selector` — backdrop for the `blaze` tier card  
**Replaces:** Phase icon only (no backdrop)  
**Emotion:** "Big energy. Bring it."  
**Feeling:** A burst of confetti, fireworks, music-volume-up. Celebratory, kinetic, "this is the night."  
**Visual:** Confetti burst — geometric triangles, circles, and sparkles exploding outward from a central point in the lower third. Three or four confetti shapes are Warm Coral `#FF9B85`, two are Vibrant Purple `#8B5CF6`, the rest are Soft Gold `#E4C76B`. A small abstract music-note or megaphone silhouette anchors the center. Should feel dynamic but contained within the cell frame.  
**Color accent:** Warm Coral `#FF9B85` primary confetti, Soft Gold `#E4C76B` highlights, Vibrant Purple `#8B5CF6` accents.  
**WTP dimension lift:** 惊喜感 +3, 身份认同 +3.

### 4. `invite-co-branded` — Invite-a-friend share card art
**Surface:** `/pages/invite` (share-card section)  
**Replaces:** Plain text invite copy  
**Emotion:** "Bring a friend. It's better together."  
**Feeling:** Two figures side by side, slightly overlapping, like a social profile pic. The vibe is "you + me, going to this thing."  
**Visual:** Two rounded figures standing close, shoulders touching, soft warm glow at the contact point. A small JoyJoin box logo (simplified) sits in the lower-left as a brand mark — no text. The figures are Warm Beige `#F5F1E8` with Vibrant Purple `#8B5CF6` accents on their clothing (matching the JoyJoin box logo's purple ribbon). Sky Blue `#A8C5DD` connection arc between them. Should feel warm and inclusive — not romantic, not couple-coded.  
**Color accent:** Warm Beige `#F5F1E8` figures, Vibrant Purple `#8B5CF6` accents, Sky Blue `#A8C5DD` connection arc.  
**WTP dimension lift:** 归属感 +5, 惊喜感 +2.

### 5. `event-feedback-thanks` — Post-event feedback thanks
**Surface:** `/pages/event-feedback` success state (after submission)  
**Replaces:** Mascot `thanksFeedback` + plain checkmark  
**Emotion:** "Thanks for showing up. We see you."  
**Feeling:** Warm, appreciative, "your feedback matters." Should NOT feel like a corporate "your response has been recorded" — should feel like a friend saying "thanks for the evening."  
**Visual:** Xiaoyue sitting with a small open journal or notebook on their lap, one paw resting on the page as if just finishing writing, looking up at the viewer with a soft "I heard you" smile. A small Warm Coral `#FF9B85` heart hovers above the journal. Soft Warm Beige `#F5F1E8` wash in the background. A small teacup or coffee mug sits to the side — intimate, "let's chat" energy.  
**Color accent:** Warm Coral `#FF9B85` heart, Warm Beige `#F5F1E8` background, Vibrant Purple `#8B5CF6` small pen accent.  
**WTP dimension lift:** 仪式感 +4, 归属感 +3.

### 6. `see-you-next-time` — Session end / recap close
**Surface:** `/pages/icebreaker-session` recap end state (in `RecapPhaseView.tsx` final overlay)  
**Replaces:** Plain "本次破冰结束" text  
**Emotion:** "That was great. Let's do it again."  
**Feeling:** The lights come up after a good show. You're walking out the door with a few new numbers in your phone. Warm, slightly nostalgic, "until next time."  
**Visual:** Xiaoyue standing at a slightly opened door (similar to C1 but a different angle), waving goodbye with one paw, the other holding a small "see you later" gesture. Behind the door: a soft gradient sky transitioning from Warm Coral `#FF9B85` (sunset) to Vibrant Purple `#8B5CF6` (evening). A small calendar icon (decorative, no text) floats near the doorframe as a hint of "next event."  
**Color accent:** Warm Coral `#FF9B85` sunset, Vibrant Purple `#8B5CF6` evening sky, Soft Gold `#E4C76B` calendar sparkles.  
**WTP dimension lift:** 仪式感 +4, 归属感 +3.

---

## Cell Coordinate Table (Lovart Master Grid)

| Cell ID | Row | Col | Pixel offset (x, y) | Tier name | Palette anchor |
|---|---|---|---|---|---|
| C1 | 0 | 0 | (0, 0) | `welcome-back-hero` | Purple + Coral + Beige |
| C2 | 0 | 1 | (800, 0) | `event-paid-confirmed` | Purple + Gold + Coral |
| C3a | 0 | 2 | (1600, 0) | `tier-vibe-breeze` | Sky Blue + Green + Beige |
| C3b | 0 | 3 | (2400, 0) | `tier-vibe-glow` | Purple + Coral + Gold |
| C4 | 1 | 0 | (0, 800) | `invite-co-branded` | Beige + Purple + Sky Blue |
| C5 | 1 | 1 | (800, 800) | `event-feedback-thanks` | Coral + Beige + Purple |
| C6 | 1 | 2 | (1600, 800) | `see-you-next-time` | Coral + Purple + Gold |
| C3c | 1 | 3 | (2400, 800) | `tier-vibe-blaze` | Coral + Gold + Purple |

---

## Unified Style Lock (画风统一) — MANDATORY

All 8 cells MUST share this exact construction:

- **Construction:** 2D digital illustration with low-poly / geometric faceted aesthetic
- **Textures:** Painterly, soft brushed feel within each polygonal facet — NOT flat vector or 3D render
- **Outlines:** Minimal or none — let facet edges define form
- **Gradients:** Soft color variation within individual facets, not global gradients
- **Backgrounds:** **Transparent PNG (entire image alpha — every cell floats on transparent)**
- **Characters — locked mascot = 悦仔 (Yuezai) / Xiaoyue:** When mascots appear, use the **JoyJoin brand mascot 悦仔** (Welsh Corgi Pembroke, weathered Vibrant Purple `#8B5CF6` hoodie, sunglasses hanging from collar, vintage leather watch, silver chain necklace). 悦仔 is the AI assistant / brand identity — street-smart, relaxed, mature.
  - **DO NOT use the 社牛柯基 (corgi archetype)** — that's a user personality type (one of 12 archetypes), bouncy and without the purple hoodie. Putting the user archetype on system-level ceremony surfaces would confuse users who got a different archetype.
  - **Reference image for Lovart:** upload `tmp/xiaoyue-reference-grid.webp` or `xiaoyue-master-spritesheet.webp` as the locked character model. Match it exactly across all mascot cells.
  - For non-mascot cells (C3 tier vibes, C4 invite figures): use generic rounded polygonal bodies with large expressive glossy eyes — no specific species.
- **Composition:** Each cell's subject centered in its 800×800 frame with generous breathing space (~15% margin all sides)
- **Color treatment:** Natural warm palette; brand purple `#8B5CF6` and coral `#FF9B85` for key elements only (don't over-saturate the entire image)
- **Scale:** Designed to read clearly when displayed at 80rpx–240rpx in the mini-program UI
- **No text or symbols** in any cell. No letters, no numbers, no readable characters, no emoji. All text overlaid in code at integration.

**Anti-generic test (反通用测试):** Before approving, ask: *"Could these 8 illustrations appear in a generic dating app or event-booking tool without modification?"* If yes → iterate. The warmth, the specific Xiaoyue construction, the low-poly painterly texture, and the deliberate "ceremony not transaction" framing should make these unmistakably JoyJoin.

---

## Prompt Draft (Single Grid — paste into Lovart ChatCanvas)

> **Before pasting:** Upload `tmp/xiaoyue-reference-grid.webp` as a reference image in Lovart ChatCanvas and say "Use this as the locked character model — match the JoyJoin mascot 悦仔 exactly across all mascot cells."

```
Generate one 3200×1600 image: 4-col × 2-row grid of 8 cells, each 800×800 px, edge-to-edge, fully transparent background, pixel-perfect grid alignment.

Style lock (all 8 cells):
2D low-poly geometric faceted illustration, painterly soft-brushed texture within facets, minimal outlines, soft gradients within facets. Warm natural palette; Vibrant Purple #8B5CF6 and Warm Coral #FF9B85 as controlled accents (not dominant fill). For mascot cells: use 悦仔 — the JoyJoin brand mascot (Welsh Corgi Pembroke, short legs, weathered purple hoodie, sunglasses hanging from collar, vintage watch, silver chain). DO NOT use 社牛柯基 (corgi archetype, no hoodie) — that's a user type, not the brand. Centered subject per cell with ~15% breathing margin. Reads at 80–240 rpx. No text, no symbols, no letters, no numbers, no emoji, no 3D, no photorealism, no flat vector.

Cells (row, col, name — subject, palette anchor, mood):
(0,0) welcome-back-hero — 悦仔 in rounded doorway, one paw holding door open, "come in" gesture, gentle smile. Warm Beige #F5F1E8 door frame, Warm Coral #FF9B85 heart sparkle above. "We saved your place."
(0,1) event-paid-confirmed — 悦仔 presenting stylized event ticket to viewer, both paws holding edges, grinning. Ticket: Vibrant Purple #8B5CF6 ribbon, Soft Gold #E4C76B serial band (decorative, no real text). Warm Coral #FF9B85 glow halo. "You're officially in."
(0,2) tier-vibe-breeze — Soft Sky Blue #A8C5DD wind swirling around Fresh Green #9ACD32 leaf. Small Warm Beige #F5F1E8 teacup with steam, lower-left. "Soft start, easy in."
(0,3) tier-vibe-glow — Two silhouettes facing across a tiny table, Warm Coral #FF9B85 glow between them, Vibrant Purple #8B5CF6 rim light, Soft Gold #E4C76B table. "Real conversation."
(1,0) invite-co-branded — Two rounded figures close, shoulders touching, warm glow at contact, simplified JoyJoin box mark lower-left. Warm Beige #F5F1E8 figures, Vibrant Purple #8B5CF6 clothing accents, Sky Blue #A8C5DD connection arc. "Better together."
(1,1) event-feedback-thanks — 悦仔 with open journal on lap, one paw on page, soft smile. Warm Coral #FF9B85 heart above journal, Warm Beige #F5F1E8 wash, small teacup. "Thanks for showing up."
(1,2) see-you-next-time — 悦仔 at slightly opened door, waving goodbye. Behind door: sky gradient Warm Coral #FF9B85 → Vibrant Purple #8B5CF6 (sunset to evening). Decorative calendar shape (no text) near doorframe. "Until next time."
(1,3) tier-vibe-blaze — Confetti burst from lower-center, geometric triangles/circles exploding. 3–4 Warm Coral #FF9B85, 2 Vibrant Purple #8B5CF6, rest Soft Gold #E4C76B. Small abstract music-note anchor. "Big energy."

Critical: All 4 悦仔 cells depict the EXACT same character (same corgi, same hoodie, same accessories, same angle). Each cell subject centered with breathing space. Every cell crisp, no motion blur. Entire image transparent background.

Export: PNG, 3200×1600 px, 2× resolution, full transparency. Filename: lovart-master-batch-c-20260604-v1.png
```

---

## Crop Script (Post-Generation)

After the master image is delivered, run this script to extract the 8 individual tiles.

```javascript
// apps/mini-program/scripts/crop-batch-c-grid.mjs
// Dependencies: sharp (already in mini-program devDependencies)
// Run: node apps/mini-program/scripts/crop-batch-c-grid.mjs

import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'

const SRC = 'apps/mini-program/raw-assets/lovart-master-batch-c-20260604-v1.png'
const OUT_DIR = 'apps/mini-program/src/assets/ceremony'
const CELL = 800

const CELLS = [
  { id: 'welcome-back-hero',     col: 0, row: 0 },
  { id: 'event-paid-confirmed',  col: 1, row: 0 },
  { id: 'tier-vibe-breeze',      col: 2, row: 0 },
  { id: 'tier-vibe-glow',        col: 3, row: 0 },
  { id: 'invite-co-branded',     col: 0, row: 1 },
  { id: 'event-feedback-thanks', col: 1, row: 1 },
  { id: 'see-you-next-time',     col: 2, row: 1 },
  { id: 'tier-vibe-blaze',       col: 3, row: 1 },
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
  console.log(`[batch-c] cropped ${c.id}`)
}
console.log(`[batch-c] done. ${CELLS.length} tiles written to ${OUT_DIR}`)
```

Then run `npm run optimize:lovart` (or the equivalent WebP optimizer) on the cropped tiles.

---

## Export Requirements

| # | ID | PNG | WebP | Display size | Tier / Variant |
|---|---|---|---|---|---|
| 1 | welcome-back-hero | `lovart-hero-welcome-back-20260604-v1.png` | `lovart-hero-welcome-back-20260604-v1.webp` | 240rpx | letterbox in 800×1200 frame |
| 2 | event-paid-confirmed | `lovart-hero-event-paid-confirmed-20260604-v1.png` | `lovart-hero-event-paid-confirmed-20260604-v1.webp` | 240rpx | letterbox in 800×1200 frame |
| 3 | tier-vibe-breeze | `lovart-hero-tier-vibe-breeze-20260604-v1.png` | `lovart-hero-tier-vibe-breeze-20260604-v1.webp` | 200rpx | C3a |
| 4 | tier-vibe-glow | `lovart-hero-tier-vibe-glow-20260604-v1.png` | `lovart-hero-tier-vibe-glow-20260604-v1.webp` | 200rpx | C3b |
| 5 | tier-vibe-blaze | `lovart-hero-tier-vibe-blaze-20260604-v1.png` | `lovart-hero-tier-vibe-blaze-20260604-v1.webp` | 200rpx | C3c |
| 6 | invite-co-branded | `lovart-hero-invite-co-branded-20260604-v1.png` | `lovart-hero-invite-co-branded-20260604-v1.webp` | 200rpx | square |
| 7 | event-feedback-thanks | `lovart-hero-event-feedback-thanks-20260604-v1.png` | `lovart-hero-event-feedback-thanks-20260604-v1.webp` | 240rpx | letterbox in 800×1200 frame |
| 8 | see-you-next-time | `lovart-hero-see-you-next-time-20260604-v1.png` | `lovart-hero-see-you-next-time-20260604-v1.webp` | 240rpx | letterbox in 800×1200 frame |

**File size target:** < 80KB per tile WebP, < 1.2MB for the full 3200×1600 master PNG.

**Save location (master):** `apps/mini-program/raw-assets/lovart-master-batch-c-20260604-v1.png`  
**Save location (crops):** `apps/mini-program/src/assets/ceremony/{name}-20260604-v1.{png,webp}`  
**CDN path:** `/static/assets/ceremony/{name}-20260604-v1.webp` (upload via `npm run upload:cdn-assets`)

---

## Frontend Integration Notes

After the 8 cropped tiles arrive:

### 1. Tier-selector (C3a/b/c) — `/pages/icebreaker-session/tier-selector/index.tsx`
- Each `breeze` / `glow` / `blaze` tier card gets a `backdropSrc` prop pointing to the new asset
- The existing `phaseUtils.tsx` already exports the `speed_friending` cdn path pattern — extend with the 3 new tier backdrops
- Maintain the existing brand color tokens on the tier card itself; the new hero is the visual anchor behind the text

### 2. Welcome-back (C1) — `/pages/onboarding/welcome-back/index.tsx`
- Replace the current mascot-only render with a full-bleed hero
- Existing `getXiaoyueExpressionAsset('coachGuide')` fallback stays; the hero sits BEHIND or ABOVE the mascot, not in place of it
- Recommended: full-bleed hero at top 30% of viewport, mascot at center, CTAs at bottom

### 3. Event-paid-confirmed (C2) — `/pages/blind-box-payment/index.tsx`
- Insert into the success state section
- Hero should be ~240rpx tall, centered above the existing "支付成功" text
- Hero should NOT replace the existing Xiaoyue success mascot — they pair together

### 4. Invite (C4) — `/pages/invite/index.tsx`
- Insert as the share-card section visual
- Square aspect works naturally for the share preview card

### 5. Event-feedback-thanks (C5) — `/pages/event-feedback/index.tsx`
- Replaces or pairs with existing `getXiaoyueExpressionAsset('thanksFeedback')`
- Hero at top of success state, mascot remains as a smaller anchor

### 6. See-you-next-time (C6) — `/pages/icebreaker-session/phases/RecapPhaseView.tsx`
- New `endOverlay` slot — full-bleed, ~60% of viewport height
- Existing recap content (medal/stats/moments) remains; this hero frames the close
- Trigger: when host advances past recap OR session reaches `ended` state

### 7. Optional: ceremony registry

If the team wants a single source of truth for these heroes, add:
```ts
// apps/mini-program/src/lib/ceremonyHeroes.ts
export const CEREMONY_HEROES = {
  welcomeBack: cdnAsset('/assets/ceremony/welcome-back-hero-20260604-v1.webp'),
  eventPaidConfirmed: cdnAsset('/assets/ceremony/event-paid-confirmed-20260604-v1.webp'),
  inviteCoBranded: cdnAsset('/assets/ceremony/invite-co-branded-20260604-v1.webp'),
  eventFeedbackThanks: cdnAsset('/assets/ceremony/event-feedback-thanks-20260604-v1.webp'),
  seeYouNextTime: cdnAsset('/assets/ceremony/see-you-next-time-20260604-v1.webp'),
} as const
```

**Current state (before commission):** All 6 surfaces use either mascot-only, text-only, or the existing `center-empty-illustration` placeholder. The new heroes sit on top of (not in place of) existing mascot usage, so the change is additive — no risk of removing existing warmth.

---

## Review Checklist

- [ ] All 8 cells share the same low-poly geometric painterly style
- [ ] All 4 Xiaoyue cells depict the identical character (proportions, hoodie, accessories)
- [ ] Brand colors (`#8B5CF6`, `#FF9B85`) used consistently and sparingly per cell
- [ ] Each cell reads clearly when cropped to 800×800 and displayed at 200rpx
- [ ] Transparent backgrounds across the entire 3200×1600 master image (no white fringes)
- [ ] No text, no symbols, no letters, no numbers in any cell
- [ ] No 3D render, no photorealism, no flat vector
- [ ] Cell alignment pixel-perfect (no drift between cells)
- [ ] Master file size under 1.2MB PNG
- [ ] Each cropped tile under 80KB WebP
- [ ] Naming follows `lovart-hero-{name}-20260604-v1.{ext}`
- [ ] 3 tier-vibe palettes align with `breeze` (sky blue + green) / `glow` (purple + coral) / `blaze` (coral + gold) per `docs/reference/emotional-value-rubric.md`
- [ ] Anti-generic test passed: "Could these appear in a generic dating app without modification?" → NO
