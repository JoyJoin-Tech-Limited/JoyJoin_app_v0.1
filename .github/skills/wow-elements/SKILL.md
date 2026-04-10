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

## High-impact use cases in JoyJoin

**1. Onboarding first load**
The first authenticated screen a new user sees sets the perceived quality bar permanently. A subtle staggered entrance — content appearing with soft fade + translate rather than a hard render — signals premium craftsmanship before any feature is used.

**2. Completion moments**
Personality test completion, successful join, payment confirmation, and profile milestone completions are emotionally significant. A restrained celebration — a gentle scale pulse, a soft checkmark reveal, a warm confirmation copy moment — reinforces trust and satisfaction.

**3. Empty and loading states**
Empty states should feel like possibility, not absence. Loading states should feel like momentum, not waiting. A skeleton with a soft shimmer, a contextual illustration, or a warm short copy line transforms a neutral state into a brand-aligned moment.

## Guiding principles

| Principle | What it means |
|-----------|--------------|
| **Non-intrusive** | Delight supports the user's task — it never interrupts, delays, or distracts |
| **Performance-conscious** | No animation that causes layout shift, jank, or meaningful TTI regression |
| **Accessible** | Every animation must respect `prefers-reduced-motion`; copy and visual state must be readable without motion |
| **Brand-aligned** | Warm, sleek, restrained; no bouncy, corporate, cold, or over-designed treatments |

## Working pattern — iterative refinement

Do not attempt to polish everything in one pass.

**Pass 1 — Functional baseline**
Build the feature. Get the data, layout, and interactions correct. No polish yet.

**Pass 2 — Polish the key emotional moment**
Identify the single most emotionally significant moment in the flow. Add a targeted, minimal wow element to that moment only. Review against the checklist below.

**Pass 3 — Systemize if repeated**
If the same pattern appears in three or more unrelated places, extract it into a shared component, utility, or hook. Do not create an abstraction for a one-off.

## Implementation patterns

### CSS / Tailwind for small motion
Use `transition`, `duration-*`, and `ease-*` utilities for hover states, focus rings, button feedback, and simple reveal transitions. Apply them in the shared primitive or variant layer when the pattern is part of the system. This is the lightest and safest option.

```tsx
// Preferred: add motion to the shared Button primitive or variant classes
import { Button } from "@/components/ui/button";

<Button
  variant="default"
  size="lg"
  className="transition-transform duration-150 ease-out active:scale-[0.98]"
>
  Join
</Button>
```

### Framer Motion for choreographed entrances/exits
Use `motion.*` primitives for staggered entrance sequences, page transitions, and reveal choreography where CSS alone is insufficient.

```tsx
import { motion } from 'framer-motion';

<motion.div
  initial={{ opacity: 0, y: 8 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.3, ease: 'easeOut' }}
>
  {children}
</motion.div>
```

Always wrap Framer Motion usage with a `useReducedMotion` check or set `transition={{ duration: 0 }}` when `prefers-reduced-motion` is active. See `references/examples.md` for a reusable wrapper pattern.

### Reuse shared UI patterns
Before building a new animated component, check `packages/shared/src/ui/` for existing primitives. Prefer extending a shared component over creating a parallel one.

### When to extract a hook or utility
Only when the exact same animation pattern appears in 3+ unrelated places. A `useCompletionPulse()` hook is justified. A one-time animation inline is not worth abstracting.

## Common mistakes to avoid

| Mistake | Impact | Fix |
|---------|--------|-----|
| **Staggering every element on every screen** | Visual noise; slow perceived load | Reserve stagger for the single key moment per flow |
| **Animating during data fetching** | Competes with loading state; confusing | Animate after data is ready, not during skeleton phase |
| **No `prefers-reduced-motion` fallback** | Accessibility failure | Always wrap motion in a reduced-motion guard |
| **Using `duration > 400ms` for routine transitions** | Feels slow; slows task completion | Keep routine transitions ≤ 200ms; emotional moments ≤ 500ms |
| **Off-brand motion** | Feels corporate or childish | Reference `.github/skills/joyjoin-brand-guidelines/SKILL.md` — soft easing, restrained scale, no harsh bounce |
| **Layout-triggering animation** | Performance regression / CLS | Animate only `transform` and `opacity`; never `height`, `width`, or `margin` |
| **Polishing low-priority screens** | Wasted effort | Focus polish budget on onboarding, completion, and high-frequency surfaces |

## Frontend Excellence Notes

### Platform Applicability

- Applies to both Web and Taro mini-program frontend surfaces whenever polish, delight, or emotional resonance is being implemented in product UI.
- The same emotional intent should survive across platforms even when the available primitives and motion systems differ.

### UI/UX & Aesthetic Guidance

- Motion and polish must stay anchored to JoyJoin tokens, typography roles, and component variants; wow moments should emerge from the product system, not sit on top of it as decoration.
- Legendary polish requires complete state design: loading, error, empty, disabled, success, and reveal states should all feel intentional and visibly communicative.
- Use semantic web elements or native Taro components as the foundation, then layer motion or micro-interactions only after the baseline interaction is already clear.

### Web-Specific Considerations

- Hover, active, and `:focus-visible` states should work together; motion should complement cursor and keyboard feedback rather than duplicate or obscure it.
- Verify polished surfaces at narrow mobile widths first and ensure scroll containers remain smooth during staggered reveals or CTA feedback.
- Use the [shared frontend thresholds reference](../design-system-governance/references/frontend-excellence-thresholds.md) when deciding when a polished collection still needs virtualization instead of per-item motion.

### Taro-Specific Considerations

- Follow the [shared frontend thresholds reference](../design-system-governance/references/frontend-excellence-thresholds.md) for minimum touch targets and long-list handling, prefer native components like `View`, `Text`, `Button`, and `ScrollView`, and replace CSS hover behavior with `hover-class` or pressed-state styling.
- Keep animation-heavy routes and large media assets aware of mini-program subpackage budgets, and use `VirtualList` for long lists before adding per-item polish.
- Favor lightweight transform and opacity effects over DOM-like choreography that depends on browser-only APIs or expensive layout work.

### Accessibility & Performance Notes

- Respect WCAG 2.1 AA touchpoints, especially visible focus, readable contrast, and reduced-motion behavior; polish must never be the only carrier of meaning.
- Protect Core Web Vitals by keeping wow moments off the critical LCP path, avoiding layout shift, and keeping interaction feedback responsive for INP.
- On mini-program surfaces, treat scroll smoothness and tap latency as hard constraints; if an effect harms them, the effect is not production-ready.

## Wow Element Review Checklist

Before marking a polished interaction complete, verify:

- [ ] Does this moment genuinely benefit from animation or polish?
- [ ] Is the motion soft, restrained, and brand-aligned (not bouncy, corporate, or harsh)?
- [ ] Does it respect `prefers-reduced-motion`?
- [ ] Does it animate only `transform` / `opacity` (no layout-triggering properties)?
- [ ] Does it complete within ≤ 500ms (≤ 200ms for routine transitions)?
- [ ] Does it work correctly when data is loading, when the screen is slow, or when the user moves fast?
- [ ] Has it been tested on a mid-range device (not just a fast dev machine)?
- [ ] Is the pattern reused from shared primitives, or does it justify a new one?
- [ ] Is the copy/visual state still readable and correct without the animation?
- [ ] Would a new contributor understand why this animation exists?

## Related files and docs

| Resource | What it covers |
|----------|---------------|
| `.github/skills/joyjoin-brand-guidelines/SKILL.md` | Brand motion guidance, colour system, emotional tone |
| `.github/skills/design-system-governance/SKILL.md` | Token ownership, CVA variants, accessibility expectations |
| `.github/skills/frontend-component-architecture/SKILL.md` | Where polished components belong in the package structure |
| `docs/button-design.md` | Button variant rationale and interaction states |
| `docs/perf.md` | Performance budgets and CLS/TTI guidance |
| `docs/ui-matching-reveal-improvements.md` | Existing premium reveal pattern — reference for choreography decisions |
| `docs/matching-reveal-implementation-summary.md` | Implementation detail behind the matching reveal |
| `references/examples.md` | 3–4 concrete wow element examples with TypeScript/React snippets |
