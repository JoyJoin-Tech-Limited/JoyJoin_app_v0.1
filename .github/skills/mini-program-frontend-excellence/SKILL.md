---
name: mini-program-frontend-excellence
description: >
  Deliver premium, JoyJoin-native UI in apps/mini-program using Taro-native primitives,
  brand-aligned hierarchy, complete state design, and mini-program-safe performance discipline.
  Enforces pixel-precision when specs exist (match exactly; ≤1px effective deviation only with
  documented exception) and strict 8rpx spacing rhythm when they do not. Two-tier: Routine changes
  use a 5-point quick check; Full changes require WeChat DevTools inspection before merge.
  Use when implementing or refining Taro pages/components, raising a screen above generic
  "cheap mini-program" quality, or reviewing whether a mini-program UI feels native-quality
  and unmistakably JoyJoin. Trigger phrases: "mini-program UI", "Taro page", "make this feel
  premium", "native-quality mini-program", "cheap mini-program feel", "improve mini-program
  empty state", "pixel perfect", "match Figma", "rpx spacing", "WeChat DevTools".
---

# Mini-Program Frontend Excellence

**Core rule:** JoyJoin mini-program UI must feel unmistakably JoyJoin and operationally native. Do not ship browser ideas squeezed into Taro, and do not ship low-effort UI that merely "works".

## Speed tiering — which rules apply?

| Tier | Scope | Checklist | DevTools |
|---|---|---|---|
| **Routine** | Typos, copy, color tweaks, padding nudges, icon swaps | Quick check (5 items) | Recommended |
| **Full** | New screens, components, layout changes, visual redesign | Full checklist (17 items) | **Mandatory** |

When in doubt, treat as Full. A padding change that affects visual hierarchy = Full.
## Routine dev quick check (60 seconds)
Before push on Routine changes:
1. [ ] Spacing consistent with sibling screens? (eyeball)
2. [ ] Color from token, not hex literal?
3. [ ] No browser-only APIs (`window.*`, `vh`) or dynamic CSS custom properties for per-frame values?
4. [ ] Press/hover feedback on interactive elements?
5. [ ] Layout on smallest target device?
## When to use this skill

- Implementing or refining UI in `apps/mini-program`
- Translating web product intent into Taro-native UI
- Raising the quality bar on a screen that feels generic, cheap, or off-brand
- Reviewing whether a mini-program interaction feels premium, tactile, and complete
## Pixel precision

**Read [`references/pixel-precision.md`](references/pixel-precision.md) before shipping or approving Full-tier UI changes.**

- **Spec present** — Match measurements **exactly** (≤1px effective error only with documented exception + design sign-off).
- **No spec** — Primary spacing on **multiples of 8rpx**; 4rpx only for hairlines/optical tweaks (comment why).
- **DevTools** — Mandatory for Full tier: verify computed layout/typography on changed screens. CI cannot replace DevTools.
## Taro framework

Top rules. Deep reference: [`references/taro-ui-framework.md`](references/taro-ui-framework.md). Full workflow: [`references/implementation-guide.md`](references/implementation-guide.md).

- **Components:** `View`, `Text`, `Image`, `ScrollView` from `@tarojs/components`; `RichText` for rich content. Never `dangerouslySetInnerHTML`.
- **Styling:** Sass/SCSS, BEM class names, `rpx` units. No `vh`/`vw`, no browser-only selectors, no inline `px`.
- **Performance:** `VirtualList` for 50+ items; `CustomWrapper` for hot subtrees; animate only `transform` + `opacity`.
- **Cross-platform:** `process.env.TARO_ENV`, `*.weapp.*` file suffixes. No hardcoded platform assumptions.
## Quick examples

- **New screen:** classify scope → design direction → Taro-native structure → full state matrix → polish → Full checklist.
- **Loading skeleton:** Match shape to content layout via `View` nodes. Wrap content: `{loading ? <Skeleton /> : <Content />}`.
- **Empty state:** Branded illustration (Xiaoyue) + warm copy + CTA. Don't just add text.
- **Routine tweak:** Verify token → eyeball screen → quick check → push.
## Troubleshooting

- **Screen feels like a cheap template** — reduce repetitive card patterns, create one focal hierarchy, remove decorative gradients that don't support the flow.
- **Looks on-brand on web but flat in mini-program** — rework spacing, copy rhythm, and pressed-state feedback using native Taro primitives instead of mimicking browser-only effects.
- **Polished interaction janks on device** — cut layout-triggering animation, compress assets, simplify to `transform` and `opacity` only.
- **Spec asks for something off-brand** — name the exact conflict (colour, font, motion, mascot use, density) and flag before implementation.
- **CSS-in-JS proposed** — default to existing repo Taro styling patterns unless the architecture explicitly shifts.
- **Chinese text breaks awkwardly** — never use `overflow-wrap: anywhere` on CJK display text (produces 孤字). Default `overflow-wrap: normal` is correct.
- **Entrance animations feel generic** — use `cubic-bezier(0.22, 1, 0.36, 1)`. Reserve `ease-out`/`ease-in-out` for loops only.
- **Component looks styled in H5 / DevTools but unstyled on device** — Taro may have chunked its SCSS into the subpackage's `sub-common.wxss`, which WeChat never loads. Fix: `@use` the component SCSS in the consuming page SCSS and remove the matching `import './X.scss'` from the component TSX; then run `npm run verify:subpackage-styles -w mini-program` (see `docs/runbooks/mini-program-asset-delivery.md` §4.6).
## Grill-me stress-test
After completing Full-tier changes, run [`references/grill-me-checklist.md`](references/grill-me-checklist.md) — a one-question-per-turn interview that stress-tests pixel precision, Taro discipline, state completeness, cross-device behavior, and brand feel.
## Full review checklist (17 items)

For Full-tier changes. Routine changes use the quick check above.

- [ ] Scope classified as `MINI_PROGRAM_ONLY` or `BOTH_REQUIRED`
- [ ] **Pixel discipline:** spec values match within tolerance; no-spec work uses **8rpx rhythm**; exceptions documented
- [ ] **WeChat DevTools:** computed layout/typography verified on changed screens (attach screenshots or selector notes in PR)
- [ ] Clear JoyJoin visual direction; no generic AI aesthetics
- [ ] Brand colours, typography, spacing, and mascot usage follow `joyjoin-brand-guidelines`
- [ ] Taro-native primitives and WXSS-safe patterns used (no browser-first assumptions; no dynamic CSS custom properties for per-frame values — use inline `style` transforms or SCSS tokens)
- [ ] Rich content uses `RichText` or structured Taro nodes — not `dangerouslySetInnerHTML`
- [ ] Flex-first layout; cross-end portability considered where selectors matter
- [ ] Large lists use `CustomWrapper` / `VirtualList` or profiled approach
- [ ] Loading, empty, error, disabled, busy, success, and pressed states are explicit
- [ ] Touch targets ≥ `44 pt` with visible active-state feedback
- [ ] Assets crisp; package/performance costs reasonable; oversized rasters flagged
- [ ] Motion restrained, `transform`/`opacity`-based, safe for mini-program
- [ ] Entrance animations use `cubic-bezier(0.22, 1, 0.36, 1)`; loops use `ease-out`/`ease-in-out`
- [ ] No `overflow-wrap: anywhere` on CJK display text; default breaking preserved
- [ ] Screen is unmistakably JoyJoin, not generic — don't sign off on "functional but cheap"
- [ ] For subpackage pages: `npm run build:weapp -w mini-program && npm run verify:subpackage-styles -w mini-program` passes with no non-empty `sub-common.wxss`
- [ ] 情绪价值 scored via `docs/reference/emotional-value-rubric.md` for user-facing screens (0–24). A technically perfect screen with 0 情绪价值 is a failure.
## Related skills

- [`ui-layout-audit`](./ui-layout-audit/SKILL.md) — pixel-level layout, spacing, typography audit
- [`frontend-design-audit`](./frontend-design-audit/SKILL.md) — 5-dimension design quality audit (0–20)
- [`completeness-audit`](../completeness-audit/SKILL.md) — 11-dimension 完成度 audit with ROI recommendations; run after Full-tier changes
- [`joyjoin-brand-guidelines`](./joyjoin-brand-guidelines/SKILL.md) — brand colour, typography, mascot usage
- [`wow-elements`](./wow-elements/SKILL.md) — crafted motion and emotional polish
- [`design-system-governance`](./design-system-governance/SKILL.md) — token and variant discipline
- [`references/grill-me-checklist.md`](references/grill-me-checklist.md) — stress-test interview for Full-tier changes
