---
name: viewport-zero-scroll
description: >
  Zero-scroll viewport policy for web and WeChat mini-program (launch priority): 100dvh shell,
  no document/page scroll, no-scroll containers, ResponsiveSpacer (web + Taro), ScrollSentinel
  (web dev), FormStepper (max 4 inputs per step). Trigger phrases: "zero scroll", "viewport lock",
  "mini-program layout", "Taro ScrollView", "100dvh", "ResponsiveSpacer", "collapseBelow".
---

# Viewport Zero-Scroll

**Core rule:** Prefer a locked viewport (`100dvh`, no document / page-level scroll)
and per-surface flex shells. Scrolling is allowed only inside an explicit scroll
port documented in a code comment.

**Launch priority:** Apply the same discipline to `apps/mini-program` (Taro / WeChat)
as to `user-client`.

## 100dvh policy

- `html` / `body` use `100dvh` (with `100%` fallback)
- `body { overflow: hidden; }` — document does not scroll
- `#root` is a flex column shell
- `.no-scroll-container` is the standard full-viewport flex shell

## No-scroll containers

Use `.no-scroll-container` for full-viewport steps:
- `display: flex; flex-direction: column; height: 100%; min-height: 0; overflow: hidden;`
- Place `ResponsiveSpacer` between content and bottom CTA for short phones
- Keep content from exceeding viewport without explicit scroll ports

## Exceptions

Allowed vertical scroll only when the surface is inherently variable-length
(transaction history, search results, Discover-style feeds). The scroll root must
include a short comment citing this exception.

## Mini-program (Taro)

Apply the same intent with renderer-native primitives:
- Root `page` + `@include no-scroll-page-shell` from `_mixins.scss`
- One explicit `ScrollView` per screen that needs it
- `ResponsiveSpacer` in `apps/mini-program/src/components/ui/ResponsiveSpacer.tsx`
- Same ≤4 text/numeric inputs per step rule as web

For detailed `ResponsiveSpacer` usage, `ScrollSentinel` setup, `FormStepper` rules,
Taro `ScrollView` patterns, and SCSS mixin reference, see
[`references/layout-patterns.md`](./references/layout-patterns.md).

## When to use this skill

- Building or refactoring a full-screen flow where the viewport must not scroll
- Implementing onboarding, payment, or auth steps
- Choosing between `.no-scroll-container`, `ScrollView`, or `ResponsiveSpacer`
- A screen feels janky or the CTA is pushed below the fold on short phones
- Reviewing a frontend PR that adds new pages or changes layout shells

## Quick examples

- **Onboarding step with 3 inputs and a bottom CTA** → Wrap in `.no-scroll-container`
  (web) or `no-scroll-page-shell` (Taro), place `ResponsiveSpacer` between content
  and CTA with `collapseBelow={640}`.
- **Feed-style discover page** → Use `#jj-scroll-chassis` (web) or a single
  `ScrollView` (Taro) with a documented scroll-exception comment.

## Troubleshooting

**CTA is hidden on small phones**
→ Add `ResponsiveSpacer` with `collapseBelow` at the viewport height where the CTA
   disappears; do not add document scroll.

**Page still scrolls despite `.no-scroll-container`**
→ Check parent chain has `height: 100%` / `min-height: 0`; verify no child has
   `min-height: 100vh` without `flex-shrink: 0`.

**Taro `ScrollView` does not scroll**
→ Ensure `scrollY` is set and the `ScrollView` itself has bounded height.

**Form step has 5 text inputs**
→ Split into two steps (max 4 per step); do not increase viewport scroll.

## Review checklist

- [ ] **Web:** full-screen flow uses `.no-scroll-container` or documented inner scroll port
- [ ] **Mini-program:** uses `viewport-min-height` / `no-scroll-page-shell` or documented `ScrollView`
- [ ] No step presents > 4 text/numeric inputs without splitting steps
- [ ] Short-viewport gaps use `ResponsiveSpacer` / `ResponsiveSpacer` (Taro) with `collapseBelow`
- [ ] Feed-style pages document the scroll exception at the scroll root
- [ ] **Launch:** sibling flows reviewed under platform coordination when layout changes

## Related files

- `apps/user-client/src/styles/viewport-lockdown.css`
- `apps/user-client/src/App.tsx`
- `packages/shared/src/ui/ResponsiveSpacer.tsx`
- `apps/mini-program/src/styles/_mixins.scss`
- [`references/layout-patterns.md`](./references/layout-patterns.md)
