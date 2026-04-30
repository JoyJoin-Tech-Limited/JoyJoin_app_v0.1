# Lovart Asset Strategy — Icebreaker Visual Delightment

> **Derived from:** 4-judge UI/UX audit (2026-04-27)  
> **Scope:** Proprietary visual assets for the 6 phases scoring <6.5 on visual design  
> **Asset type:** Brand illustrations, card backgrounds, hero badges, celebration frames  
> **Style lock:** JoyJoin low-poly geometric faceted illustration (插画风统一)

---

## Executive Summary

The audit revealed a **cyan gradient identity crisis**: 4 phases (auction, personality_dice, mini_script, quip_battle) share `micro_challenge`'s clinical cyan card background. This makes a prestige auction, a warm dice game, and a murder mystery all look like the same checklist app.

**Lovart's highest-impact contribution:** Proprietary **per-phase card background art** that kills the cyan hijacking and gives each under-engineered phase instant visual personality. One background asset per phase = 80% of the visual problem solved.

---

## Impact-Prioritized Asset List

### 🔴 P0 — Card Background Art (One asset per phase, massive visual impact)

These replace the shared `.icebreaker__challenge-card` cyan gradient with proprietary themed backgrounds.

| Phase | Current Visual | Lovart Asset Needed | Archetype Colors | Mood |
|-------|---------------|---------------------|------------------|------|
| **auction** | Cyan `#ecfeff` clinical gradient | **Prestige gavel + coin themed card background** — warm gold/amber tones, subtle gavel silhouette, scattered coin motifs, velvet texture suggestion | Gold `#D4A017` / Amber `#F59E0B` | Prestigious, tense, celebratory |
| **personality_dice** | Cyan `#ecfeff` clinical gradient | **Warm dice + crystal ball card background** — soft pink/amber tones, translucent crystal ball center glow, floating polyhedral dice silhouettes, sparkles | Pink `#EC4899` / Amber `#F59E0B` | Playful, magical, warm |
| **undercover_word** | Plain white, no theme | **Dark mystery "secret file" card background** — deep indigo `#1e1b4b` to violet `#4c1d95` gradient, magnifying glass vignette, redacted-text texture, subtle fingerprint pattern | Indigo `#312E81` / Violet `#7C3AED` | Suspenseful, secretive, dramatic |
| **group_mirror** | Plain white, no theme | **Mirror prism card background** — teal `#0D9488` to cyan `#06B6D4` gradient, faceted mirror shards reflecting light, soft prism rainbow accents, reflective surface texture | Teal `#0D9488` / Cyan `#06B6D4` | Reflective, honest, ethereal |
| **quip_battle** | Cyan `#ecfeff` clinical gradient | **Battle energy card background** — yellow `#FACC15` to orange `#FB923C` gradient, lightning bolt accents, comic word-bubble silhouettes, spark/explosion motifs | Yellow `#FACC15` / Orange `#FB923C` | Energetic, competitive, witty |

**Spec for all P0 backgrounds:**
- Dimensions: **750×400px** (mini-program card width, 16:9-ish ratio)
- Export: PNG with transparency (layer behind content cards) OR JPG for texture-rich backgrounds
- Style: Low-poly geometric faceted, painterly textured rendering, atmospheric grain
- Must NOT contain text — all text overlaid in code
- File naming: `lovart-bg-{phase}-20260427-v1.{ext}`

---

### 🟡 P1 — Hero Celebration & Ceremony Assets (Emotional payoff moments)

These are the "money shot" visuals that appear at climactic game moments — the social payoff that makes players laugh and remember.

#### 1. Auction — "成交!" (Sold!) Celebration Frame
**Moment:** When host strikes the gavel, winner is revealed.
**Asset:** Full-screen overlay frame (not background) with:
- Central gavel striking a sound-block, motion lines indicating impact
- Burst of gold coins scattering outward
- Warm spotlight vignette from center
- Subtle confetti particles
**Spec:** 750×750px square, PNG transparent center (for text overlay), frame-only decoration around edges
**File:** `lovart-celebration-auction-sold-20260427-v1.png`

#### 2. Personality Dice — Challenge Reveal Card
**Moment:** When a player's dice challenge is revealed.
**Asset:** A "dice card" hero illustration showing:
- Large glowing crystal ball / polyhedral die as centerpiece
- Archetype animal (Octopus for creative, Hamster for warm) peeking from behind the die
- Flame burst on one side ("accept"), playful sweat-drop on other ("pass")
**Spec:** 400×400px, PNG transparent, circular vignette composition
**File:** `lovart-hero-dice-reveal-20260427-v1.png`

#### 3. Undercover Word — Secret Identity Card Template
**Moment:** When a player is revealed as the undercover.
**Asset:** A "secret dossier" card frame:
- Dark indigo background with gold `#D4A017` border
- "CLASSIFIED" stamp texture (visual only, no text)
- Magnifying glass overlay in corner
- Subtle spy-silhouette watermark
**Spec:** 600×400px, PNG, designed to have player avatar + name overlaid in code
**File:** `lovart-frame-undercover-secret-20260427-v1.png`

#### 4. Group Mirror — Result Mirror Frame
**Moment:** When vote results are revealed per question.
**Asset:** An ornate mirror frame:
- Teal/cyan faceted mirror border
- Reflective surface center (where bar chart will render in code)
- Small archetype animal reflections in corner ornaments (Dolphin + Koala)
**Spec:** 700×500px, PNG transparent center, frame-only decoration
**File:** `lovart-frame-mirror-result-20260427-v1.png`

#### 5. Quip Battle — Champion Trophy Badge
**Moment:** Winner of a quip battle round is announced.
**Asset:** A champion badge/trophy:
- Gold trophy cup with lightning bolt accents
- Small Fox + Corgi mascots holding the trophy
- Victory banner ribbon at bottom
**Spec:** 300×300px, PNG transparent, circular vignette
**File:** `lovart-badge-quip-champion-20260427-v1.png`

---

### 🟢 P2 — Icon & Accent Assets (Polish layer)

#### Auction Currency Icons (Set of 3)
1. **Coin stack** — small gold coins piled (for balance display)
2. **Single coin** — one prominent gold coin with JoyJoin sparkle
3. **Empty purse** — sad/empty coin pouch (for "insufficient balance" state)
**Spec:** 48×48px, PNG, monochrome gold `#D4A017` with shading
**File:** `lovart-icons-auction-coins-20260427-v1.png` (sprite sheet)

#### Personality Dice — Pass/Accept Icons (Set of 2)
1. **Flame burst** — "接受挑战" accept icon
2. **Playful retreat** — "认怂" pass icon (sweat drop + cute retreat pose)
**Spec:** 80×80px, PNG transparent
**File:** `lovart-icons-dice-passaccept-20260427-v1.png` (sprite sheet)

#### Undercover Word — Role Reveal Icons (Set of 2)
1. **Detective badge** — civilian/correct guess indicator
2. **Shadow mask** — undercover/incognito indicator
**Spec:** 64×64px, PNG transparent
**File:** `lovart-icons-undercover-roles-20260427-v1.png` (sprite sheet)

---

## Archetype-to-Asset Mapping

| Phase | Primary Archetypes | Mascot Characters for Lovart Prompts |
|-------|-------------------|-------------------------------------|
| auction | Rooster (confident) + Elephant (grounding) | Rooster strutting with gavel, Elephant as auctioneer |
| personality_dice | Octopus (creative) + Hamster (warm) | Octopus juggling dice, Hamster peeking from crystal ball |
| undercover_word | Owl (observant) + Spider (detailed) | Owl with magnifying glass, Spider weaving clue web |
| group_mirror | Dolphin (perceptive) + Koala (empathetic) | Dolphin reflecting in mirror, Koala hugging mirror frame |
| quip_battle | Fox (clever) + Corgi (playful) | Fox with lightning wit, Corgi laughing with word bubbles |

---

## Batch Brief Recommendation

### Batch 1: P0 Card Backgrounds (5 assets)
**Why first:** One background per phase fixes the cyan identity crisis. These are the biggest visual impact per asset.
**Lovart approach:** Generate all 5 as a "card background set" with consistent geometric faceted style but distinct color palettes. Request them in one session to ensure style cohesion.
**Estimated:** 5 × 750×400px backgrounds

### Batch 2: P1 Celebration Frames (5 assets)
**Why second:** These create the emotional "money shots" — the moments players screenshot and share.
**Lovart approach:** Generate each as a "ceremony frame" with transparent centers for code-overlaid text. Reference the corresponding background batch for color consistency.
**Estimated:** 5 × 400–750px celebration frames

### Batch 3: P2 Icon Sets (3 sprite sheets)
**Why third:** Polish layer. Can be deferred if engineering bandwidth is constrained.
**Lovart approach:** Generate as icon sets with consistent stroke weight and corner radius. Prefer clean geometric treatment for legibility at small sizes.
**Estimated:** 3 sprite sheets (~6–9 individual icons)

---

## Engineering Handoff Notes

### Storage
```
apps/mini-program/src/assets/lovart/icebreaker/
├── backgrounds/
│   ├── lovart-bg-auction-20260427-v1.jpg
│   ├── lovart-bg-personality-dice-20260427-v1.jpg
│   ├── lovart-bg-undercover-word-20260427-v1.jpg
│   ├── lovart-bg-group-mirror-20260427-v1.jpg
│   └── lovart-bg-quip-battle-20260427-v1.jpg
├── celebrations/
│   ├── lovart-celebration-auction-sold-20260427-v1.png
│   ├── lovart-hero-dice-reveal-20260427-v1.png
│   ├── lovart-frame-undercover-secret-20260427-v1.png
│   ├── lovart-frame-mirror-result-20260427-v1.png
│   └── lovart-badge-quip-champion-20260427-v1.png
└── icons/
    ├── lovart-icons-auction-coins-20260427-v1.png
    ├── lovart-icons-dice-passaccept-20260427-v1.png
    └── lovart-icons-undercover-roles-20260427-v1.png
```

### Subpackage Strategy
If total asset size > 200KB, create a Taro subpackage:
```js
// app.config.ts
{
  subpackages: [
    {
      root: 'subpackage/icebreaker-assets/',
      pages: [], // assets only, lazy-loaded
      independent: false
    }
  ]
}
```

### CSS Integration Pattern
```scss
// Each phase gets its own background class
&__auction-card {
  background: url('../../assets/lovart/icebreaker/backgrounds/lovart-bg-auction-20260427-v1.jpg') center/cover;
}
&__personality-dice-card {
  background: url('../../assets/lovart/icebreaker/backgrounds/lovart-bg-personality-dice-20260427-v1.jpg') center/cover;
}
// ... etc
```

---

## Anti-Generic Test Checklist

Before approving each Lovart output, verify:
- [ ] Could this exact illustration appear in a generic dating app? (If yes → reject)
- [ ] Does it feature JoyJoin archetype mascots in recognizable poses?
- [ ] Are the colors from the exact JoyJoin palette (not generic purple/pink)?
- [ ] Is the low-poly geometric faceted style consistent with existing phase icons?
- [ ] Would a player screenshot this moment and share it? (The "shareable moment" test)

---

## Bottom Line

> **5 card backgrounds** (P0) fix 80% of the visual identity crisis.  
> **5 celebration frames** (P1) create the emotional payoff that turns "functional" into "memorable."  
> **3 icon sets** (P2) add the polish layer for states and micro-interactions.  
> Total proprietary asset count: **13 Lovart briefs** → estimated **~800KB** total (WebP compressed).  
> Estimated engineering wiring effort after assets arrive: **Medium** (new CSS classes + conditional rendering for celebration overlays).
