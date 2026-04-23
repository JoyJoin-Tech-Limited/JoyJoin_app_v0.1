# Phase 1 Icon Prompts — Ready to Send to Designer

> **29 icons total** — highest user visibility, ship first  
> **Style:** 插画风 low-poly geometric, matching Xiaoyue  
> **Tool:** Send these to Lovart / your icon designer

---

## Batch 1-A: 12 Archetype Glyphs (32×32px)

Copy-paste each prompt into Lovart or send to designer as a batch.

```
Generate 12 small archetype glyph icons for JoyJoin personality system.

Style lock (插画风 — applies to all):
- 2D low-poly geometric digital illustration
- Built from triangular facets with soft brush feel inside each facet
- No outlines — edges defined by facet boundaries
- Transparent background
- Premium game-character-portrait quality

Common spec:
- 32×32px viewport, head/face only filling the frame
- Warm natural palette with the specified accent color as primary facet color

1. [开心柯基] Playful corgi face, warm orange #D4845C, big open smile with tongue slightly out, perky ears
2. [太阳鸡] Bright rooster head with comb, warm coral #FF9B85, head high chest puffed, alert eyes
3. [夸夸豚] Smiling dolphin with heart-shaped blowhole spray, sky blue #A8C5DD, gentle supportive expression
4. [机智狐] Winking fox wearing small glasses, warm orange #D4845C, knowing smirk
5. [淡定海豚] Serene dolphin with closed eyes, sky blue #5B9BD5, content peaceful expression
6. [织网蛛] Geometric spider with multiple gleaming eyes, purple-gray #8B7FB0, intricate web pattern suggested in facets
7. [暖心熊] Soft-eyed bear with gentle smile, warm brown #A0522D, protective warm expression
8. [灵感章鱼] Creative octopus holding paintbrush with one tentacle, purple #8B5CF6, curious wide eyes
9. [沉思猫头鹰] Wise owl with forward-facing large eyes, deep blue #4A6FA5, book tucked under wing
10. [定心大象] Steady elephant with calm steady gaze, gray-blue #708090, large ears spread with calm
11. [稳如龟] Patient turtle with shell pattern visible, forest green #6B8E6B, wise old eyes with slow blink expression
12. [隐身猫] Mysterious cat peeking from shadow, soft gray #9CA3AF, one eye visible, mysterious half-smile

Deliver: 12 PNGs with transparency, 32×32, 64×64, 96×96 variants.
Grid: Display all 12 on a single reference sheet for style consistency review.
```

---

## Batch 1-B: 9 Chemistry Badge Icons (24×24px)

```
Generate 9 chemistry/vibe badge icons for JoyJoin match compatibility scoring.

Style lock: 2D low-poly geometric, triangular facets, soft brush feel, transparent background.

Common spec:
- 24×24px viewport
- All share a consistent circular coin/badge base shape with the glyph inside
- Badge color fills the circular base; glyph sits on top in contrasting tone

1. [炽热] Red gradient base #EF4444 → #DC2626, flame/comet burst glyph shooting upward from center
2. [温暖] Orange gradient base #F97316 → #EA580C, glowing orb/sun with radiating warmth lines
3. [适宜] Blue gradient base #60A5FA → #3B82F6, balanced cloud parting to reveal sun behind
4. [冷淡] Gray gradient base #9CA3AF → #6B7280, crystal/snowflake with geometric facets
5. [健谈] Green gradient base #22C55E → #16A34A, three stacked chat bubbles ascending in size
6. [闪耀] Purple gradient base #A855F7 → #9333EA, four-point star burst with inner glow dot
7. [成长] Teal gradient base #14B8A6 → #0D9488, bud/sprout emerging from geometric soil at bottom
8. [奇妙] Pink gradient base #EC4899 → #DB2777, orbital ring around central dot suggesting motion
9. [未知] Neutral gray base #9CA3AF, simple circle with question mark formed from facets

Deliver: 9 PNGs with transparency, 24×24, 48×48, 72×72 variants.
```

---

## Batch 1-C: 8 Status Indicator Icons (16×16px)

```
Generate 8 tiny status indicator icons for JoyJoin admin tables and user lists.

Style lock: 2D low-poly geometric, triangular facets, transparent background.

Common spec:
- 16×16px viewport — VERY small, keep shapes bold and high-contrast
- Minimum feature size: 2px
- Solid filled style (not outline)

1. [成功] Filled circle with centered check mark inside, green #22C55E
2. [等待] Hollow circle with a small rotating dot position marked (for CSS animation), amber #F59E0B
3. [错误] Circle with X cross inside, red #EF4444
4. [在线] Solid circle with smaller inner white dot creating glow effect, green #22C55E
5. [离线] Hollow circle ring only, gray #9CA3AF
6. [新消息] Solid circle with outer notification ring, red #EF4444
7. [已验证] Shield shape with centered check mark, blue #3B82F6
8. [会员] Diamond/gem shape with facet lines visible, purple #8B5CF6

Also provide outline variants of each (same shape but hollow/stroke only).

Deliver: 8 solid + 8 outline = 16 PNGs with transparency, 16×16, 32×32, 48×48 variants.
```

---

## Quick Reference: Phase 1 Deliverables

| Batch | Count | Size | Priority |
|-------|-------|------|----------|
| 1-A Archetype Glyphs | 12 | 32×32px | P0 — on every result screen |
| 1-B Chemistry Badges | 9 | 24×24px | P0 — on match status page |
| 1-C Status Indicators | 8 | 16×16px | P0 — in every table/list |
| **Total Phase 1** | **29 icons** | | |

---

## What Happens After Phase 1 is Delivered

1. You receive 29 PNG files with transparency
2. We run them through our optimization pipeline (`npm run optimize:icons`)
3. We replace emoji references in code with icon constants
4. We smoke-test in WeChat DevTools + browser
5. Then we start Phase 2 (61 icons: interests, industries, icebreaker phases)

**Phase 1 alone will eliminate the most visible emojis in the product.**
