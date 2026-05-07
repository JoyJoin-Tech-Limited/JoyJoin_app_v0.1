# Lovart Brief: Phase Icon Batch 001

> **Project:** JoyJoin Social Icebreaker — 3 Missing Phase Icons
> **Asset type:** Icon / Icon Set (illustration-style feature icons)
> **Delivery:** PNG + WebP, @1x/@2x/@3x
> **Due:** Async — no blocker, but Q2 Week 6 ideal

---

## Context

JoyJoin's Social Icebreaker has 10 phases. We have proprietary icons for 7 of them:
`phase-warmup`, `phase-challenge`, `phase-detective`, `phase-dice`, `phase-auction`, `phase-script`, `phase-recap`.

**This brief requests the remaining 3:** `phase-quip-battle`, `phase-undercover-word`, `phase-group-mirror`.

These icons appear as 80×80rpx phase headers in the WeChat Mini Program (Taro) during live icebreaker sessions. They must feel like siblings to the existing 7 — same illustration language, same energy level, same color treatment.

---

## Existing Icon Reference

The existing phase icons share these characteristics:
- **Canvas:** Square, ~120×120px safe area (exported at 80×80, 160×160, 240×240 for @1x/@2x/@3x)
- **Style:** 2D digital illustration, low-poly geometric faceted aesthetic, painterly textured rendering
- **Treatment:** Soft gradients within polygonal facets, minimal outlines, atmospheric textured background with subtle grain
- **Composition:** Centered single subject, circular vignette feel, generous negative space
- **Background:** Transparent PNG (not circular crop — full square with centered illustration)
- **Color palette:** Warm natural tones with controlled Vibrant Purple #8B5CF6 accents only where appropriate

**Folder reference:** `apps/mini-program/src/assets/icons/phase-icons/`

---

## Icon 1: phase-quip-battle

**Chinese name:** 机智对决
**Concept:** Fill-in-the-blank comedy battle — players complete silly sentences and vote on the funniest answers.

**Visual direction:**
- Central motif: A lightbulb or speech bubble with playful spark/energy lines
- Alternative: A pen or pencil writing a wavy, funny sentence line
- Should feel **creative, playful, slightly chaotic** — like a brain glitching in a fun way
- Energy: Upbeat, clever, social-comedy
- Avoid: Boxing gloves, literal "battle" imagery (not a fight, it's wit)

**Color hints:** Warm yellow/orange accents (matching the quip_battle phase gradient `from-yellow-400 to-orange-500`). Purple #8B5CF6 only as a tiny accent if needed.

---

## Icon 2: phase-undercover-word

**Chinese name:** 谁是卧底
**Concept:** Word deduction game — one player gets a different word than everyone else; through description rounds, the group votes on who is the "undercover."

**Visual direction:**
- Central motif: A magnifying glass hovering over a word card or speech bubble
- Alternative: Two subtly different cards side by side with a question mark between them
- Should feel **mysterious but light** — social deduction, not murder mystery
- Energy: Curious, playful suspicion, Sherlock-lite
- Avoid: Dark noir, spy silhouettes, guns, violence

**Color hints:** Warm red/rose accents (matching the undercover_word phase gradient `from-red-500 to-rose-600`). Purple #8B5CF6 as a subtle accent.

---

## Icon 3: phase-group-mirror

**Chinese name:** 群像镜像
**Concept:** Anonymous group voting — players vote on who best fits each question ("Who's most likely to...?"), revealing how the group sees each other.

**Visual direction:**
- Central motif: A mirror reflecting multiple friendly faces, or overlapping speech bubbles forming a circle
- Alternative: A prism or kaleidoscope fragment showing different perspectives
- Should feel **reflective, warm, social** — about seeing each other clearly
- Energy: Gentle revelation, group bonding, "aha" moments
- Avoid: Literal mirrors with hard reflections, narcissism vibes, judgmental imagery

**Color hints:** Warm teal/cyan accents (matching the group_mirror phase gradient `from-teal-400 to-cyan-500`). Purple #8B5CF6 as a gentle accent.

---

## Style Lock (MANDATORY — paste into every Lovart prompt)

```
Style: 2D digital illustration with low-poly / geometric faceted aesthetic.
Textures: Painterly, soft brushed feel within each polygonal facet — NOT flat vector or 3D render.
Outlines: Minimal or none — let facet edges define form.
Gradients: Soft color variation within individual facets, not global gradients.
Backgrounds: Transparent PNG (no background fill). Subject centered with generous negative space.
Characters/Objects: Geometric polygonal forms, large expressive glossy details, simplified features, warm expressions.
Composition: Centered subject, circular vignette feel, breathing space on all sides.
Color treatment: Natural warm palette; brand purple #8B5CF6 for key elements only.
Anti-generic test: Could this exact illustration appear in a generic dating app? If yes → iterate.
```

---

## Export Spec

| Variant | Dimensions | Format | File name |
|---------|-----------|--------|-----------|
| @1x | 80×80px | PNG | `phase-{name}.png` |
| @2x | 160×160px | PNG | `phase-{name}@2x.png` |
| @3x | 240×240px | PNG | `phase-{name}@3x.png` |
| @1x WebP | 80×80px | WebP | `phase-{name}.webp` |

**Naming:**
- `phase-quip-battle.png`
- `phase-undercover-word.png`
- `phase-group-mirror.png`

---

## Acceptance Criteria

- [ ] All 3 icons feel like siblings to existing 7 (place them side by side in a grid — no obvious outsider)
- [ ] Each icon reads clearly at 40×40rpx (thumbnail size)
- [ ] Each icon has visual "pop" at 80×80rpx (header size)
- [ ] No emojis, no text, no UI chrome in the illustration itself
- [ ] Transparent background, centered composition
- [ ] Warm, cute-but-tasteful, rounded-and-soft, lively-and-breathable
- [ ] Brand purple #8B5CF6 used sparingly and intentionally

---

## Lovart ChatCanvas Prompt (Copy-Paste Ready)

```
I need 3 phase icons for a social icebreaker mini-program. They must match an existing family of 7 icons.

Style lock:
- 2D digital illustration with low-poly geometric faceted aesthetic
- Painterly, soft brushed texture within each facet
- Soft gradients within polygonal facets, minimal outlines
- Transparent PNG background, centered subject, circular vignette feel
- Warm natural palette with brand purple #8B5CF6 as accent only

ICON 1 — "Quip Battle" (机智对决):
Fill-in-the-blank comedy game. Visual: lightbulb or speech bubble with playful spark lines. Feel: creative, witty, slightly chaotic fun. Color: warm yellow/orange.

ICON 2 — "Undercover Word" (谁是卧底):
Word deduction game — one player has a different word. Visual: magnifying glass over a word card. Feel: playful mystery, Sherlock-lite. Color: warm red/rose.

ICON 3 — "Group Mirror" (群像镜像):
Anonymous group voting on "who's most likely...". Visual: mirror reflecting multiple friendly faces, or overlapping speech bubbles in a circle. Feel: reflective, warm, group bonding. Color: warm teal/cyan.

Export: PNG @1x (80px), @2x (160px), @3x (240px) for each. Also WebP @1x.

Start with Icon 1. Give me 2 composition variations.
```
