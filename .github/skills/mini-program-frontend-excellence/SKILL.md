---
name: mini-program-frontend-excellence
description: >
  Deliver premium, JoyJoin-native UI in apps/mini-program using Taro-native primitives,
  brand-aligned hierarchy, complete state design, and mini-program-safe performance discipline.
  Enforces pixel-precision when specs exist (match exactly; ≤1px effective deviation only with
  documented exception) and strict 8rpx spacing rhythm when they do not; WeChat DevTools
  inspection is mandatory before merge for UI changes. Use when implementing or refining Taro
  pages/components, raising a screen above generic "cheap mini-program" quality, or reviewing
  whether a mini-program UI feels native-quality and unmistakably JoyJoin. Trigger phrases:
  "mini-program UI", "Taro page", "make this feel premium", "native-quality mini-program",
  "cheap mini-program feel", "improve mini-program empty state", "pixel perfect", "match Figma",
  "rpx spacing", "WeChat DevTools".
---

# Mini-Program Frontend Excellence

**Core rule:** JoyJoin mini-program UI must feel unmistakably JoyJoin and operationally native. Do not ship browser ideas squeezed into Taro, and do not ship low-effort mini-program UI that merely "works".

## When to use this skill

- Implementing or refining UI in `apps/mini-program`
- Translating web product intent into Taro-native UI
- Raising the quality bar on a mini-program screen that feels generic, cheap, or off-brand
- Reviewing whether a mini-program interaction feels premium, tactile, and complete
- Deciding how to preserve JoyJoin brand feel without browser-only effects

## Pixel precision (non-negotiable)

**Read [`references/pixel-precision.md`](references/pixel-precision.md) before shipping or approving UI.**

- **Design spec present** — Match measurements **exactly** (zero tolerance for avoidable drift; ≤1px effective error only with documented platform exception + design sign-off).
- **No spec** — Enforce **internal consistency**: primary spacing on **multiples of 8rpx**, align to existing container padding and section rhythm; **4rpx** only for hairlines/optical tweaks (comment if unusual).
- **Pre-merge** — Authors run **WeChat DevTools** (Wxml + computed styles) on touched screens; reviewers **block** visual PRs without this evidence when the diff affects layout or typography. CI cannot replace DevTools.

## Taro framework (read first for structural UI work)

For layout constraints, `setData` / list performance, cross-end files, `RichText` vs HTML, WeChat tooling, and **asset size budgets**, follow **[`references/taro-ui-framework.md`](references/taro-ui-framework.md)**.

- Prefer **Flex** layout and repo Sass/class patterns; avoid browser-only selectors and unsafe HTML (`dangerouslySetInnerHTML`); use **`RichText`** or structured nodes for rich content.
- Treat **VirtualList**, **CustomWrapper**, and subpackage strategy as product decisions when lists or update hot spots are large.
- Use **`process.env.TARO_ENV`** and **multi-suffix files** (`*.weapp.*`, etc.) for real platform splits.
- **Flag** new or changed assets that exceed the reference thresholds; propose compression, SVG optimization, vector substitution, or route/subpackage moves before merging heavy binaries.

See [`references/implementation-guide.md`](references/implementation-guide.md) for the full delivery workflow, premium quality bar, Taro execution rules, common mistakes, and DevTools inspection checklist.

## Quick examples

**User says:** "Polish this mini-program onboarding step - it feels cheap."
**Apply this skill by:** Choosing one emotional focal moment, tightening hierarchy and spacing, using brand-backed colour and copy, adding pressed and loading states, and keeping the interaction Taro-native.
**Result:** The step feels premium without pretending to be a browser screen.

**User says:** "Make this Taro page feel more like a top consumer app."
**Apply this skill by:** Upgrading the focal hierarchy, asset sharpness, state completeness, and tactile feedback first; only then add restrained motion that survives WeChat constraints.
**Result:** The page feels native-quality instead of generically decorated.

## Troubleshooting

- **The screen feels like a cheap template** — reduce repetitive card patterns, create one focal hierarchy, and remove decorative gradients that do not support the flow.
- **The design looks on-brand on web but flat in mini-program** — rework spacing, copy rhythm, and pressed-state feedback using native Taro primitives instead of trying to mimic browser-only effects.
- **A polished interaction janks on device** — cut layout-triggering animation, compress assets, and simplify the effect to `transform` and `opacity` only.
- **The spec asks for something off-brand** — name the exact conflict (colour, font, motion, mascot use, density) and flag it before implementation.
- **The team wants to add CSS-in-JS for dynamic styling** — default to the repo's existing Taro styling patterns unless there is an explicit approved shift in architecture.

## Review checklist

- [ ] Scope was classified as `MINI_PROGRAM_ONLY` or `BOTH_REQUIRED`
- [ ] **Pixel discipline:** Spec-backed values match within the tolerance in [`references/pixel-precision.md`](references/pixel-precision.md); no-spec work uses **8rpx rhythm** and aligns with sibling screens; any exception is documented with design approval
- [ ] **WeChat DevTools:** Author verified computed layout/typography on changed screens (and noted in PR when reviewers cannot reproduce)
- [ ] The screen has a clear JoyJoin visual direction and avoids generic AI aesthetics
- [ ] Brand colours, typography, spacing, and mascot usage follow `joyjoin-brand-guidelines`
- [ ] Taro-native primitives and WXSS-safe patterns are used instead of browser-first assumptions
- [ ] Rich content uses `RichText` or structured Taro nodes—not `dangerouslySetInnerHTML` for cross-end HTML
- [ ] Layout follows Flex-first discipline; cross-end or RN portability considered where selectors matter
- [ ] Hot re-renders or large lists addressed with `CustomWrapper` / `VirtualList` or other profiled approach when thresholds suggest it (`references/taro-ui-framework.md`)
- [ ] Loading, empty, error, disabled, busy, success, and pressed states are explicit
- [ ] Touch targets are at least `44 pt` and active-state feedback is visible
- [ ] Assets are crisp and package/performance costs are reasonable
- [ ] New or changed rasters/icons were checked against size budgets; oversized files flagged and addressed
- [ ] Motion is restrained, `transform`/`opacity`-based, and safe for mini-program performance
- [ ] A screen that still feels cheap but functional has not been signed off as complete
