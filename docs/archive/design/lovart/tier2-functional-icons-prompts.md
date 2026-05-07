# Tier 2 — Functional Icon System

> Proprietary icon set to replace all emoji usage across the JoyJoin mini-program
> Categories: Rating Faces, Chemistry Badges, Mood Icons, Info Labels, Status Icons

---

## Design Brief

Current problem: The mini-program uses system emojis (😕🙂🔥✨📅) for functional UI elements.
This feels generic and breaks brand cohesion. We need proprietary icons in the same low-poly
geometric illustration style as the 12 archetype characters.

Style lock (applies to ALL icons):
- Same low-poly geometric aesthetic as the archetype illustrations
- Monochrome filled shapes using #333333 (neutral dark) on transparent background
- NO gradients, NO outlines, NO drop shadows — solid fill only
- Clean silhouette style, readable at small sizes (16–32px actual)
- Rounded, friendly proportions (not sharp corporate icons)

---

## GRID 1: Rating Faces (5 icons)

These appear in the event feedback form — users tap a face to rate their experience.
Size: 64×64px display (deliver at 64/128/192px)

| # | Current Emoji | Name | Description |
|---|--------------|------|-------------|
| 1 | 😕 | rating-1-disappointed | Slightly downturned mouth, raised eyebrow — "meh" |
| 2 | 🙁 | rating-2-sad | Clear frown, downturned eyes — "not great" |
| 3 | 😐 | rating-3-neutral | Flat line mouth, neutral eyes — "okay" |
| 4 | 🙂 | rating-4-happy | Gentle upturned smile, soft eyes — "good" |
| 5 | 🤩 | rating-5-ecstatic | Wide grin, star-shaped excited eyes — "amazing" |

Style notes for faces:
- Circular head shape (like the archetype heads)
- Simple geometric eyes (dots, lines, or star shapes)
- Mouth expressed as a simple curved line
- Each face should be instantly readable at 64×64
- Faces should feel like they belong to the same character universe as the archetypes

---

## GRID 2: Chemistry Badges (5 icons)

These appear in matching status cards to describe squad chemistry.
Size: 32×32px display (deliver at 32/64/96px)

| # | Current Emoji | Name | Description |
|---|--------------|------|-------------|
| 1 | 🔥 | chemistry-fire | Flame shape — high energy, spark, intensity |
| 2 | ✨ | chemistry-sparkle | Four-pointed star burst — magic, surprise, delight |
| 3 | 🌱 | chemistry-sprout | Seedling with two leaves — growth, potential, new beginnings |
| 4 | 💬 | chemistry-chat | Speech bubble with two dots — conversation, connection, talk |
| 5 | 💫 | chemistry-orbit | Circle with orbiting dot — chemistry, bond, gravitational pull |

Style notes for chemistry:
- Abstract symbolic shapes (not literal representations)
- Same rounded, organic geometry as archetype illustrations
- Each icon should feel energetic and positive

---

## GRID 3: Mood + Status Icons (8 icons, 2 rows)

Mood icons appear in icebreaker session topic selection.
Status icons appear in matching status and icebreaker waiting states.
Size: 32×32px display (deliver at 32/64/96px)

### Row 1 — Mood Icons (icebreaker topic moods)

| # | Current Emoji | Name | Description |
|---|--------------|------|-------------|
| 1 | 😂 | mood-funny | Grinning face with tilted eyes — humor, jokes |
| 2 | ☕ | mood-life | Coffee cup with steam — daily life, routines, stories |
| 3 | ✨ | mood-relaxed | Soft glow/rays — chill, calm, easygoing |
| 4 | 💫 | mood-emotional | Heart with ripple waves — feelings, depth, vulnerability |

### Row 2 — Status Icons (system states)

| # | Current Emoji | Name | Description |
|---|--------------|------|-------------|
| 5 | ⏳ | status-waiting | Hourglass shape — loading, pending, patience |
| 6 | 🎭 | status-theater | Comedy+tragedy masks overlapping — roleplay, drama, improv |
| 7 | 🎁 | status-reward | Gift box with ribbon — prize, bonus, reward |
| 8 | 🤝 | status-partnership | Two hands shaking — agreement, match, team |

---

## GRID 4: Info Labels (4 icons)

These appear in event detail cards and discover pool cards.
Size: 24×24px display (deliver at 24/48/72px)

| # | Current Emoji | Name | Description |
|---|--------------|------|-------------|
| 1 | 📅 | info-calendar | Simple calendar page with grid dots — date, time |
| 2 | 📍 | info-location | Map pin with small circle center — place, venue |
| 3 | 👥 | info-people | Two overlapping head silhouettes — group, participants |
| 4 | 🎯 | info-target | Concentric circles with center dot — purpose, goal, type |

Style notes for info labels:
- Most minimal of all sets — extra simple geometry
- Must be perfectly readable at 24×24px
- Consistent stroke weight / fill density across all 4

---

## OUTPUT FORMAT

For each of the 4 grids:
- Single grid image showing all icons at 4× display size with labels
- Individual SVG source files (for all 22 icons)
- Individual PNG exports at 3 sizes:
  - Rating faces: 64px / 128px / 192px
  - Chemistry + Mood + Status: 32px / 64px / 96px
  - Info labels: 24px / 48px / 72px

Naming convention:
```
icon-{category}-{name}.svg
icon-{category}-{name}.png (1×)
icon-{category}-{name}@2x.png
icon-{category}-{name}@3x.png
```

Examples:
```
icon-rating-disappointed.png
icon-chemistry-fire@2x.png
icon-mood-funny@3x.png
icon-status-waiting.svg
```

---

## ANTI-GENERIC TEST

These must NOT look like:
- Apple/Google system emojis
- Fluent/Material icon sets
- Generic flat icon packs

They MUST look like:
- Custom low-poly illustrations from the same universe as the archetype characters
- Cohesive family where every icon shares the same geometric DNA

---

## Tier 2 Delivery Checklist

| Grid | Icons | Sizes | Status |
|------|-------|-------|--------|
| 1 — Rating Faces | 5 faces | 64/128/192px | ⬜ |
| 2 — Chemistry Badges | 5 badges | 32/64/96px | ⬜ |
| 3 — Mood + Status | 8 icons | 32/64/96px | ⬜ |
| 4 — Info Labels | 4 icons | 24/48/72px | ⬜ |

**Total Tier 2: 22 icons + 4 grid sheets + SVG sources**
