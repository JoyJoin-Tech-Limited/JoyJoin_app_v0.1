# Lovart Brief: Phase Emblem Batch 001

> **Project:** JoyJoin Social Icebreaker — Phase Hero Emblems
> **Asset type:** Brand illustration / decorative hero art
> **Delivery:** PNG, @1x/@2x/@3x
> **Priority:** Medium (Q3) — not blocking launch

---

## Context

The `phase-icons/` folder contains small 80×80px navigation icons. The `phase-emblems/` folder is for **larger hero illustrations** (240×240px+) used in:
- Session start phase intro cards
- Moment Card backgrounds
- Empty state illustrations
- Shareable recap graphics

Currently empty. This brief requests the first batch: **7 emblems for the core Standard flow phases**.

---

## Visual Direction

Phase emblems are **louder and more expressive** than phase icons:
- Same low-poly geometric style as icons
- Same warm palette
- **Bigger canvas** = more detail, more atmosphere, more storytelling
- Can include a **mascot archetype** as the "host" of that phase
- Background: **not transparent** — has a soft gradient or textured wash

---

## Phase → Archetype Mapping

| Phase | Archetype Host | Scene Concept |
|-------|---------------|---------------|
| warmup | Corgi | Corgi stretching, sunrise energy, welcoming gesture |
| micro_challenge | Fox | Fox balancing on a puzzle piece, clever grin |
| lie_detective | Owl | Owl with magnifying glass, perched on books |
| personality_dice | Octopus | Octopus juggling dice, each die showing a different trait |
| auction | Rooster | Rooster on a podium, wing raised like an auctioneer |
| mini_script | Cat | Cat holding a script, dramatic spotlight pose |
| recap | Dolphin (calm) | Dolphin swimming through memory bubbles, gentle smile |

---

## Export Spec

| Variant | Dimensions | Format | File name |
|---------|-----------|--------|-----------|
| @1x | 240×240px | PNG | `emblem-{phase}.png` |
| @2x | 480×480px | PNG | `emblem-{phase}@2x.png` |
| @3x | 720×720px | PNG | `emblem-{phase}@3x.png` |

---

## Lovart ChatCanvas Prompt (Starter)

```
I need 7 hero emblems for a social icebreaker app. These are larger, more detailed versions of our phase icons.

Style lock:
- 2D digital illustration with low-poly geometric faceted aesthetic
- Painterly, soft brushed texture within each facet
- Soft gradients within polygonal facets
- Atmospheric textured background with subtle grain/noise
- Warm natural palette with brand purple #8B5CF6 as controlled accent
- Mascots: geometric polygonal bodies, large glossy eyes, simplified features

Each emblem features a JoyJoin archetype mascot as the "host" of that phase:

1. Warmup — Corgi stretching at sunrise, welcoming energy
2. Challenge — Fox balancing on a puzzle piece, clever expression
3. Lie Detective — Owl with magnifying glass, perched on books
4. Personality Dice — Octopus juggling colorful dice
5. Auction — Rooster on podium, wing raised like auctioneer
6. Mini Script — Cat holding a script, dramatic spotlight
7. Recap — Calm dolphin swimming through memory bubbles

Export: PNG @1x (240px), @2x (480px), @3x (720px) for each.

Start with Emblem 1 (Warmup / Corgi). Give me 2 mood variations: one energetic, one gentle.
```
