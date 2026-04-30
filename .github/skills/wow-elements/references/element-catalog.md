# Wow Element Catalog Reference

## Detailed Element List

| Element | Best for | Platform | Notes |
|---------|----------|----------|-------|
| **Pulse** | CTA confirmation, achievement reveal | Web + Taro | Scale 1 → 1.05 → 1, 300ms ease-out |
| **Shimmer** | Skeleton loading, empty state | Web + Taro | Translating gradient mask, loop 1.5s |
| **Stagger** | Onboarding entrance, list reveal | Web (Framer), Taro (timed) | 50–80ms delay between children |
| **Soft fade** | Modal/content reveal | Web + Taro | Opacity 0 → 1, 200ms ease-out |
| **Scale pop** | Completion checkmark, success | Web + Taro | Scale 0.8 → 1, 250ms spring-ish |
| **Slide up** | Bottom sheet, toast | Web + Taro | TranslateY 16px → 0, 200ms |
| **Press feedback** | Button tap | Taro primary | `hover-class` or `active:scale-[0.98]` |

## Taro-Specific Implementation Notes

- Browser-only effects (`backdrop-filter`, CSS Grid masonry, custom cursor, hover-only reveals) have no direct equivalent in Taro.
- Translate the *intent* of the aesthetic into what Taro primitives (`View`, `Text`, `Image`, `ScrollView`) and WXSS-safe properties can deliver.
- A restrained, opinionated treatment with native press states and brand-aligned spacing beats a generic-looking attempt to clone browser effects.
- Use `hover-class` or pressed-state styling instead of CSS hover behavior.
- Favor lightweight transform and opacity effects over DOM-like choreography that depends on browser-only APIs or expensive layout work.
- Keep animation-heavy routes and large media assets aware of mini-program subpackage budgets.
- Use `VirtualList` for long lists before adding per-item polish.

## Easing Tables

| Context | Easing | Duration |
|---------|--------|----------|
| Routine hover / focus | `ease-out` | ≤ 150ms |
| Button press feedback | `ease-out` | ≤ 100ms |
| Content reveal | `ease-out` | 200–300ms |
| Emotional moment (completion) | `cubic-bezier(0.22, 1, 0.36, 1)` | 300–500ms |
| Stagger between children | `ease-out` | 50–80ms gap |

## Spring Physics Params

When using Framer Motion spring transitions (web only):

| Feel | Stiffness | Damping | Mass |
|------|-----------|---------|------|
| Snappy | 300 | 25 | 1 |
| Soft | 120 | 20 | 1 |
| Gentle | 80 | 15 | 1.2 |

Avoid bouncy springs. JoyJoin motion should feel controlled and warm.

## Reduced-Motion Details

- Always wrap Framer Motion usage with a `useReducedMotion` check or set `transition={{ duration: 0 }}` when `prefers-reduced-motion` is active.
- On Taro, respect system accessibility settings; provide static fallback states.
- Never gate meaning behind motion alone — copy and visual state must be readable without animation.

## Scroll-Trigger Details

- Avoid scroll-triggered animations on mini-program; they compete with native scroll performance.
- On web, use `IntersectionObserver` for reveal-on-scroll, not scroll-event listeners.
- Keep scroll-triggered effects minimal (opacity + translateY only).
- Test on mid-range devices; if frame drops occur, remove the effect.

## Common Mistakes to Avoid

| Mistake | Impact | Fix |
|---------|--------|-----|
| **Staggering every element on every screen** | Visual noise; slow perceived load | Reserve stagger for the single key moment per flow |
| **Animating during data fetching** | Competes with loading state; confusing | Animate after data is ready, not during skeleton phase |
| **No `prefers-reduced-motion` fallback** | Accessibility failure | Always wrap motion in a reduced-motion guard |
| **Using `duration > 400ms` for routine transitions** | Feels slow; slows task completion | Keep routine transitions ≤ 200ms; emotional moments ≤ 500ms |
| **Off-brand motion** | Feels corporate or childish | Reference `joyjoin-brand-guidelines` — soft easing, restrained scale, no harsh bounce |
| **Layout-triggering animation** | Performance regression / CLS | Animate only `transform` and `opacity`; never `height`, `width`, or `margin` |
| **Polishing low-priority screens** | Wasted effort | Focus polish budget on onboarding, completion, and high-frequency surfaces |
