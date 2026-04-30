---
name: wow-elements
description: >
  Add crafted, brand-aligned micro-interactions and polish to JoyJoin screens.
  Use this skill when a moment deserves more emotional resonance — not decoration.
  Trigger phrases: "make this feel premium", "add delight here", "polish the
  interaction", "improve micro-interactions". Never use it to add motion for its
  own sake. Accessibility and performance are hard constraints, not trade-offs.
---

# Wow Elements

**Core rule:** A wow element is successful when it makes the product feel more considered, more alive, and more emotionally resonant — **crafted confidence, not decoration** — without making it slower, harder to understand, or less accessible.

JoyJoin wow elements should feel like **subtle luxury in motion**: warm, polished, emotionally intelligent, and never noisy.

## When to use this skill

- A key user moment (completion, reveal, first load) feels flat or generic
- A transition between states is abrupt or cold
- An empty or loading state feels dead rather than hopeful
- A CTA or confirmation flow lacks emotional payoff
- You are reviewing a PR and asking: "does this moment feel crafted?"

Do **not** use this skill to:
- add motion to low-traffic or operational screens
- justify one-off animations that cannot be maintained
- work around missing product design intent

## Golden rules

| Principle | What it means |
|-----------|--------------|
| **Non-intrusive** | Delight supports the user's task — it never interrupts, delays, or distracts |
| **Performance-conscious** | No animation that causes layout shift, jank, or meaningful TTI regression |
| **Accessible** | Every animation must respect `prefers-reduced-motion`; copy and visual state must be readable without motion |
| **Brand-aligned** | Warm, sleek, restrained; no bouncy, corporate, cold, or over-designed treatments |

## Working pattern — iterative refinement

**Pass 1 — Functional baseline:** Build the feature. Get the data, layout, and interactions correct. No polish yet.

**Pass 2 — Polish the key emotional moment:** Identify the single most emotionally significant moment in the flow. Add a targeted, minimal wow element to that moment only.

**Pass 3 — Systemize if repeated:** If the same pattern appears in 3+ unrelated places, extract it into a shared component, utility, or hook. Do not create an abstraction for a one-off.

## Quick examples

- **Onboarding completion** — add a one-time soft checkmark reveal and restrained CTA pulse after the submission succeeds, with reduced-motion fallback.
- **Match reveal entrance** — stagger only the title, summary, and primary CTA after data is ready; do not animate the entire screen tree.
- **Empty state polish** — pair a short hopeful line of copy with a subtle shimmer or fade-in illustration, keeping the state fully readable without motion.

## Troubleshooting

- **Animation feels janky on mobile** — Check if you're animating `transform`/`opacity` only. Layout-triggering properties like `height`, `width`, or `margin` cause frame drops.
- **Reduced-motion preference is ignored** — Wrap Framer Motion transitions with `useReducedMotion()` or set `duration: 0` when `prefers-reduced-motion` matches.
- **Effect looks generic or off-brand** — Re-run the Anti-Generic Checklist. Verify you're using JoyJoin tokens (Vibrant Purple sparingly, Warm Beige backgrounds, rounded forms).
- **Taro mini-program doesn't support the browser effect** — Translate intent to Taro primitives. Use `hover-class`, `animation` attributes, or WXSS `transition`.
- **Same polish pattern duplicated across 3+ screens** — Extract to a shared hook or component. One-off inline animations should stay inline; repeated patterns belong in `packages/shared/src/ui/`.

## Review checklist

- [ ] The polished moment is the single most emotionally significant one in the flow
- [ ] Motion uses `transform` and `opacity` only — no layout-triggering properties
- [ ] `prefers-reduced-motion` is respected with a readable static fallback
- [ ] Transition duration is ≤ 200 ms for routine feedback, ≤ 500 ms for emotional reveals
- [ ] Effect is warm, restrained, and brand-aligned (not bouncy or corporate)
- [ ] Copy and visual state remain fully understandable without animation
- [ ] Pattern is either reused from shared primitives or justifies a new abstraction
- [ ] Verified on a mid-range device, not just a fast dev machine

## References

- [`references/element-catalog.md`](references/element-catalog.md) — Detailed element list (pulse, shimmer, stagger, etc.), Taro-specific implementation notes, easing tables, spring physics params, reduced-motion details, scroll-trigger details
- [`references/examples.md`](references/examples.md) — 3–4 concrete wow element examples with TypeScript/React snippets
