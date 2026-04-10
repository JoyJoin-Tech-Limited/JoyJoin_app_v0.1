# Frontend Excellence Thresholds

This file is the canonical source for reusable frontend performance and interaction thresholds referenced by JoyJoin's frontend-facing agents and skills. Link here instead of copying the numbers into additional docs.

## Web Scroll Surfaces

- Start profiling long tables, feeds, grids, and similar scroll surfaces when they approach roughly 100 lightweight rows or items, or about 40 rich cards.
- Introduce virtualization, pagination, or progressive disclosure before scroll jank is visible.
- Re-measure earlier when rows include media, animation, or expensive visual effects.

## Taro Interaction Surfaces

- Keep primary tappable controls at or above 44 pt.
- Prefer native mini-program components such as `View`, `Text`, `Button`, `Input`, `Image`, and `ScrollView`, and use `hover-class` or pressed-state styling instead of CSS `:hover`.
- Use `VirtualList` or another renderer-appropriate strategy once a mini-program collection approaches roughly 60 rich cards or 100 lightweight rows.
- Watch subpackage budgets when adding heavy assets or low-frequency route clusters.

## Usage Notes

- Treat these values as heuristics that trigger profiling and review, not guaranteed safe limits for every surface.
- If a surface needs a different threshold, document the reason near the implementation or in the owning domain doc instead of editing multiple agents or skills.